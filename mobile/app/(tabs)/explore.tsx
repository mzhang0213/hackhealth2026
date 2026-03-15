import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';

import { HUD } from '@/constants/hud-theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProviderCard {
  npi: string;
  name: string;
  credential: string;
  specialty: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  coords?: [number, number]; // [lat, lng]
}

// ─── NPI Registry API ─────────────────────────────────────────────────────────

async function searchPTs(zipCode: string): Promise<ProviderCard[]> {
  const params = new URLSearchParams({
    taxonomy_description: 'Physical Therapist',
    postal_code: zipCode,
    limit: '20',
    version: '2.1',
  });
  const res = await fetch(`https://npiregistry.cms.hhs.gov/api/?${params}`);
  if (!res.ok) throw new Error(`NPI API error: ${res.status}`);
  const data = await res.json();

  return (data.results ?? []).map((r: any) => {
    const basic = r.basic ?? {};
    const name = basic.organization_name
      ? basic.organization_name
      : [basic.first_name, basic.middle_name, basic.last_name].filter(Boolean).join(' ');
    const practiceAddr =
      r.addresses?.find((a: any) => a.address_purpose === 'LOCATION') ?? r.addresses?.[0];
    const specialty =
      r.taxonomies?.find((t: any) => t.primary)?.desc ?? r.taxonomies?.[0]?.desc ?? 'Physical Therapist';
    const rawZip = practiceAddr?.postal_code ?? '';
    const zip = rawZip.length > 5 ? `${rawZip.slice(0, 5)}-${rawZip.slice(5)}` : rawZip;
    return {
      npi: r.number,
      name: name || 'Unknown Provider',
      credential: basic.credential ?? '',
      specialty,
      address: [practiceAddr?.address_1, practiceAddr?.address_2].filter(Boolean).join(', '),
      city: practiceAddr?.city ?? '',
      state: practiceAddr?.state ?? '',
      zip,
      phone: practiceAddr?.telephone_number ?? '',
    };
  });
}

// ─── Nominatim geocoding ──────────────────────────────────────────────────────

async function geocodeAddress(p: ProviderCard): Promise<[number, number] | null> {
  try {
    const q = [p.address, p.city, p.state, p.zip].filter(Boolean).join(', ');
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ReboundRecoveryApp/1.0' },
    });
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {}
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocodeAll(providers: ProviderCard[]): Promise<ProviderCard[]> {
  const result: ProviderCard[] = [];
  for (let i = 0; i < providers.length; i++) {
    const coords = await geocodeAddress(providers[i]);
    result.push({ ...providers[i], coords: coords ?? undefined });
    // Nominatim rate limit: 1 req/sec
    if (i < providers.length - 1) await sleep(1100);
  }
  return result;
}

// ─── Leaflet map HTML ─────────────────────────────────────────────────────────

function buildMapHtml(providers: ProviderCard[], centerLat: number, centerLng: number): string {
  const mapped = providers.filter((p) => p.coords);
  const markersJson = JSON.stringify(
    mapped.map((p, i) => ({
      lat: p.coords![0],
      lng: p.coords![1],
      name: p.name + (p.credential ? `, ${p.credential}` : ''),
      addr: [p.address, p.city, p.state].filter(Boolean).join(', '),
      phone: p.phone,
      colorIdx: i % 3,
    }))
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { height:100%; width:100%; background:#080c14; }
    .leaflet-container { background:#080c14 !important; }
    .leaflet-popup-content-wrapper {
      background:#0d1623;
      border:1px solid rgba(0,212,255,0.35);
      border-radius:4px;
      color:#c8dde8;
      box-shadow: 0 0 16px rgba(0,212,255,0.15);
    }
    .leaflet-popup-tip-container { display:none; }
    .leaflet-popup-close-button { color:#00d4ff !important; font-size:16px !important; }
    .leaflet-popup-content { margin:12px 14px; font-family:monospace; }
    .pop-name { color:#00d4ff; font-weight:700; font-size:11px; letter-spacing:1px; margin-bottom:5px; line-height:1.4; }
    .pop-addr { color:#8899a6; font-size:9px; margin-bottom:4px; letter-spacing:0.5px; line-height:1.5; }
    .pop-phone { color:#22c55e; font-size:9px; letter-spacing:0.5px; }
    .leaflet-control-zoom a {
      background:#0d1623 !important;
      color:#00d4ff !important;
      border-color:rgba(0,212,255,0.3) !important;
    }
    .leaflet-control-attribution {
      background:rgba(8,12,20,0.8) !important;
      color:#4a5568 !important;
      font-size:8px !important;
    }
    .leaflet-control-attribution a { color:#4a6070 !important; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var markers = ${markersJson};
  var colors = ['#00d4ff','#22c55e','#f59e0b'];
  var zoom = markers.length === 0 ? 12 : markers.length === 1 ? 14 : 12;

  var map = L.map('map', {
    zoomControl: true,
    attributionControl: true
  }).setView([${centerLat}, ${centerLng}], zoom);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com">CARTO</a>',
    maxZoom: 19
  }).addTo(map);

  var bounds = [];

  markers.forEach(function(p) {
    var color = colors[p.colorIdx];
    var icon = L.divIcon({
      className: '',
      html: '<div style="width:14px;height:14px;background:' + color + ';border-radius:50%;border:2px solid rgba(8,12,20,0.8);box-shadow:0 0 10px ' + color + ',0 0 4px ' + color + ';"></div>',
      iconSize: [14,14],
      iconAnchor: [7,7],
      popupAnchor: [0,-10]
    });
    var popup = '<div class="pop-name">' + p.name + '</div>'
      + (p.addr ? '<div class="pop-addr">' + p.addr + '</div>' : '')
      + (p.phone ? '<div class="pop-phone">' + p.phone + '</div>' : '');

    var m = L.marker([p.lat, p.lng], { icon: icon }).addTo(map).bindPopup(popup, { maxWidth: 220 });
    bounds.push([p.lat, p.lng]);
  });

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [30, 30] });
  }
</script>
</body>
</html>`;
}

// ─── Provider list card ───────────────────────────────────────────────────────

function PTCard({ provider, index }: { provider: ProviderCard; index: number }) {
  const accentColor = index % 3 === 0 ? HUD.cyan : index % 3 === 1 ? HUD.success : HUD.warning;

  return (
    <View style={[styles.card, { borderColor: HUD.border }]}>
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={[styles.cardIconBox, { borderColor: `${accentColor}30`, backgroundColor: `${accentColor}08` }]}>
            <Ionicons name="medkit-outline" size={14} color={accentColor} />
          </View>
          <View style={styles.cardTitleCol}>
            <Text style={styles.cardName} numberOfLines={2}>
              {provider.name}{provider.credential ? `, ${provider.credential}` : ''}
            </Text>
            <Text style={[styles.cardSpecialty, { color: accentColor }]}>
              {provider.specialty.toUpperCase()}
            </Text>
          </View>
          {provider.coords && (
            <View style={[styles.npiBadge, { borderColor: `${HUD.success}50` }]}>
              <Ionicons name="location" size={8} color={HUD.success} />
            </View>
          )}
        </View>

        {provider.address ? (
          <View style={styles.cardRow}>
            <Ionicons name="location-outline" size={11} color={HUD.muted} />
            <Text style={styles.cardMeta}>
              {provider.address}, {provider.city}, {provider.state} {provider.zip}
            </Text>
          </View>
        ) : null}

        {provider.phone ? (
          <View style={styles.cardPhoneRow}>
            <Ionicons name="call-outline" size={11} color={HUD.muted} />
            <Text style={styles.cardMeta}>{provider.phone}</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${provider.phone.replace(/\D/g, '')}`)}
              style={[styles.callBtn, { borderColor: `${accentColor}50`, backgroundColor: `${accentColor}12` }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.callBtnText, { color: accentColor }]}>CALL</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'map';

export default function PTLocatorScreen() {
  const [zipCode, setZipCode] = useState('');
  const [insurance, setInsurance] = useState('');
  const [results, setResults] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.7128, -74.006]);
  const geocodeAbort = useRef(false);

  async function handleSearch() {
    const zip = zipCode.trim();
    if (zip.length < 5) {
      setError('Enter a valid 5-digit zip code.');
      return;
    }
    Keyboard.dismiss();
    geocodeAbort.current = true; // cancel any in-progress geocode
    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);
    setViewMode('list');

    try {
      const providers = await searchPTs(zip);
      if (providers.length === 0) {
        setError('No physical therapists found for that zip code.');
        setLoading(false);
        return;
      }
      setResults(providers);
      setLoading(false);

      // Geocode zip center first (single fast request) for map default center
      const zipGeo = await geocodeAddress({ address: '', city: '', state: '', zip, npi: '', name: '', credential: '', specialty: '', phone: '' });
      if (zipGeo) setMapCenter(zipGeo);

      // Geocode all providers in the background
      setGeocoding(true);
      geocodeAbort.current = false;
      const geocoded: ProviderCard[] = [...providers];
      for (let i = 0; i < providers.length; i++) {
        if (geocodeAbort.current) break;
        const coords = await geocodeAddress(providers[i]);
        if (coords) {
          geocoded[i] = { ...providers[i], coords };
          setResults([...geocoded]);
        }
        if (i < providers.length - 1) await sleep(1100);
      }
      setGeocoding(false);
    } catch {
      setError('Failed to fetch results. Check your connection and try again.');
      setLoading(false);
      setGeocoding(false);
    }
  }

  const geocodedCount = results.filter((p) => p.coords).length;
  const mapHtml = buildMapHtml(results, mapCenter[0], mapCenter[1]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* ── Fixed top section (header + search + toggle) ── */}
        <View style={styles.topSection}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerAccentLine} />
            <View style={styles.headerRow}>
              <View style={styles.headerTitleCol}>
                <Text
                  style={[
                    styles.heading,
                    Platform.OS === 'ios' && {
                      textShadowColor: HUD.cyan,
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 6,
                    },
                  ]}
                >
                  PT LOCATOR
                </Text>
                <Text style={styles.subtitle}>FIND PHYSICAL THERAPISTS NEAR YOU</Text>
              </View>
              <View style={styles.headerBadge}>
                <Ionicons name="location-outline" size={18} color={HUD.cyan} />
              </View>
            </View>
          </View>

          {/* Search panel */}
          <View style={styles.searchPanel}>
            <View style={[styles.cornerH, { top: 0, left: 0 }]} />
            <View style={[styles.cornerV, { top: 0, left: 0 }]} />
            <View style={[styles.cornerH, { bottom: 0, right: 0 }]} />
            <View style={[styles.cornerV, { bottom: 0, right: 0 }]} />

            <View style={styles.searchInputRow}>
              {/* Zip input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>ZIP CODE</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="navigate-outline" size={13} color={HUD.muted} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 10001"
                    placeholderTextColor={HUD.muted}
                    value={zipCode}
                    onChangeText={(t) => setZipCode(t.replace(/\D/g, '').slice(0, 5))}
                    keyboardType="number-pad"
                    maxLength={5}
                    returnKeyType="search"
                    onSubmitEditing={handleSearch}
                  />
                </View>
              </View>

              {/* Insurance input */}
              <View style={[styles.inputGroup, styles.inputGroupFlex]}>
                <Text style={styles.inputLabel}>INSURANCE</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="shield-checkmark-outline" size={13} color={HUD.muted} />
                  <TextInput
                    style={styles.input}
                    placeholder="Aetna, Blue Cross…"
                    placeholderTextColor={HUD.muted}
                    value={insurance}
                    onChangeText={setInsurance}
                    returnKeyType="search"
                    onSubmitEditing={handleSearch}
                  />
                </View>
              </View>

              {/* Search button */}
              <TouchableOpacity
                style={[styles.scanBtn, loading && styles.scanBtnDisabled]}
                onPress={handleSearch}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color={HUD.cyan} />
                  : <Ionicons name="search-outline" size={18} color={HUD.cyan} />}
              </TouchableOpacity>
            </View>

            {insurance.length > 0 && (
              <View style={styles.insuranceNote}>
                <Ionicons name="information-circle-outline" size={10} color={HUD.warning} />
                <Text style={styles.insuranceNoteText}>Call to verify insurance acceptance</Text>
              </View>
            )}
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={13} color={HUD.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Results header + LIST/MAP toggle */}
          {results.length > 0 && (
            <View style={styles.resultsBar}>
              <Text style={styles.resultsCount}>{results.length} PROVIDERS</Text>
              {geocoding && (
                <View style={styles.geocodingBadge}>
                  <ActivityIndicator size="small" color={HUD.warning} style={{ transform: [{ scale: 0.6 }] }} />
                  <Text style={styles.geocodingText}>
                    MAPPING {geocodedCount}/{results.length}
                  </Text>
                </View>
              )}
              <View style={styles.viewToggle}>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                  onPress={() => setViewMode('list')}
                  activeOpacity={0.7}
                >
                  {viewMode === 'list' && <View style={styles.toggleActiveLine} />}
                  <Ionicons name="list-outline" size={14} color={viewMode === 'list' ? HUD.cyan : HUD.muted} />
                  <Text style={[styles.viewToggleText, viewMode === 'list' && styles.viewToggleTextActive]}>LIST</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
                  onPress={() => setViewMode('map')}
                  activeOpacity={0.7}
                >
                  {viewMode === 'map' && <View style={styles.toggleActiveLine} />}
                  <Ionicons name="map-outline" size={14} color={viewMode === 'map' ? HUD.cyan : HUD.muted} />
                  <Text style={[styles.viewToggleText, viewMode === 'map' && styles.viewToggleTextActive]}>MAP</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Map view ── */}
        {viewMode === 'map' && results.length > 0 && (
          <View style={styles.mapContainer}>
            <View style={[styles.mapCornerH, { top: 0, left: 0 }]} />
            <View style={[styles.mapCornerV, { top: 0, left: 0 }]} />
            <View style={[styles.mapCornerH, { top: 0, right: 0 }]} />
            <View style={[styles.mapCornerV, { top: 0, right: 0 }]} />
            <View style={[styles.mapCornerH, { bottom: 0, left: 0 }]} />
            <View style={[styles.mapCornerV, { bottom: 0, left: 0 }]} />
            <View style={[styles.mapCornerH, { bottom: 0, right: 0 }]} />
            <View style={[styles.mapCornerV, { bottom: 0, right: 0 }]} />

            <WebView
              style={styles.map}
              source={{ html: mapHtml }}
              originWhitelist={['*']}
              javaScriptEnabled
              scrollEnabled={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            />

            {geocodedCount === 0 && (
              <View style={styles.mapOverlay}>
                <ActivityIndicator color={HUD.cyan} />
                <Text style={styles.mapOverlayText}>GEOCODING PROVIDERS…</Text>
              </View>
            )}

            {/* Map legend */}
            <View style={styles.mapLegend}>
              {[HUD.cyan, HUD.success, HUD.warning].map((c, i) => (
                <View key={i} style={styles.mapLegendItem}>
                  <View style={[styles.mapLegendDot, { backgroundColor: c, shadowColor: c }]} />
                </View>
              ))}
              <Text style={styles.mapLegendText}>{geocodedCount} MAPPED</Text>
            </View>
          </View>
        )}

        {/* ── List view ── */}
        {viewMode === 'list' && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {results.length > 0 && (
              <View style={styles.disclaimer}>
                <Ionicons name="alert-circle-outline" size={10} color={HUD.muted} />
                <Text style={styles.disclaimerText}>
                  DATA FROM NPPES NATIONAL PROVIDER REGISTRY · CALL TO VERIFY INSURANCE &amp; AVAILABILITY
                </Text>
              </View>
            )}

            {results.map((p, i) => (
              <PTCard key={p.npi} provider={p} index={i} />
            ))}

            {!searched && (
              <View style={styles.emptyState}>
                <Ionicons name="map-outline" size={40} color={`${HUD.cyan}30`} />
                <Text style={styles.emptyTitle}>AWAITING COORDINATES</Text>
                <Text style={styles.emptySubtitle}>
                  Enter your zip code to scan for nearby physical therapists
                </Text>
              </View>
            )}
          </ScrollView>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HUD.bg },
  flex: { flex: 1 },

  topSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: HUD.bg,
  },

  // Header
  header: { marginBottom: 14 },
  headerAccentLine: {
    height: 1,
    backgroundColor: HUD.cyan,
    opacity: 0.3,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleCol: { gap: 3 },
  heading: {
    fontFamily: HUD.mono,
    fontSize: 20,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 3,
  },
  subtitle: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1.5,
  },
  headerBadge: {
    width: 38,
    height: 38,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: `${HUD.cyan}40`,
    backgroundColor: `${HUD.cyan}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search panel
  searchPanel: {
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    padding: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cornerH: {
    position: 'absolute',
    width: 16,
    height: 1.5,
    backgroundColor: HUD.cyan,
    opacity: 0.7,
  },
  cornerV: {
    position: 'absolute',
    width: 1.5,
    height: 16,
    backgroundColor: HUD.cyan,
    opacity: 0.7,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputGroup: {
    width: 100,
  },
  inputGroupFlex: {
    flex: 1,
  },
  inputLabel: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 2,
    marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    backgroundColor: '#0d1623',
    paddingHorizontal: 8,
    gap: 6,
  },
  input: {
    flex: 1,
    fontFamily: HUD.mono,
    fontSize: 13,
    color: HUD.text,
    paddingVertical: 8,
  },
  scanBtn: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: HUD.cyan,
    borderRadius: 4,
    backgroundColor: `${HUD.cyan}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnDisabled: { opacity: 0.4 },
  insuranceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  insuranceNoteText: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.warning,
    letterSpacing: 0.5,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${HUD.danger}12`,
    borderWidth: 1,
    borderColor: `${HUD.danger}40`,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: HUD.mono,
    fontSize: 10,
    color: HUD.danger,
    flex: 1,
    letterSpacing: 0.5,
  },

  // Results bar
  resultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  resultsCount: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1.5,
  },
  geocodingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: `${HUD.warning}40`,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: `${HUD.warning}10`,
  },
  geocodingText: {
    fontFamily: HUD.mono,
    fontSize: 7,
    color: HUD.warning,
    letterSpacing: 1,
  },
  viewToggle: {
    flexDirection: 'row',
    marginLeft: 'auto',
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  viewToggleBtnActive: {
    backgroundColor: `${HUD.cyan}15`,
  },
  toggleActiveLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: HUD.cyan,
    opacity: 0.9,
  },
  viewToggleText: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1.5,
  },
  viewToggleTextActive: {
    color: HUD.cyan,
    fontWeight: '700',
  },

  // Map
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  mapCornerH: {
    position: 'absolute',
    width: 16,
    height: 1.5,
    backgroundColor: HUD.cyan,
    opacity: 0.8,
    zIndex: 10,
  },
  mapCornerV: {
    position: 'absolute',
    width: 1.5,
    height: 16,
    backgroundColor: HUD.cyan,
    opacity: 0.8,
    zIndex: 10,
  },
  map: {
    flex: 1,
    backgroundColor: HUD.bg,
  },
  mapOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${HUD.bg}cc`,
    gap: 10,
    zIndex: 5,
  },
  mapOverlayText: {
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.cyan,
    letterSpacing: 2,
  },
  mapLegend: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(8,12,20,0.85)',
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 10,
  },
  mapLegendItem: { alignItems: 'center', justifyContent: 'center' },
  mapLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
    shadowOpacity: 0.9,
  },
  mapLegendText: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 1,
  },

  // List
  scroll: { backgroundColor: HUD.bg },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginBottom: 10,
  },
  disclaimerText: {
    fontFamily: HUD.mono,
    fontSize: 7,
    color: HUD.muted,
    letterSpacing: 0.5,
    flex: 1,
    opacity: 0.6,
  },

  // Provider card
  card: {
    flexDirection: 'row',
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardAccent: { width: 2, opacity: 0.7 },
  cardBody: { flex: 1, padding: 12, gap: 8 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  cardIconBox: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardTitleCol: { flex: 1, gap: 3 },
  cardName: {
    fontFamily: HUD.mono,
    fontSize: 12,
    fontWeight: '700',
    color: HUD.text,
    letterSpacing: 0.5,
  },
  cardSpecialty: {
    fontFamily: HUD.mono,
    fontSize: 8,
    letterSpacing: 1,
  },
  npiBadge: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  cardMeta: {
    fontFamily: HUD.mono,
    fontSize: 10,
    color: HUD.muted,
    flex: 1,
    lineHeight: 15,
    letterSpacing: 0.3,
  },
  cardPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callBtn: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 'auto',
  },
  callBtnText: {
    fontFamily: HUD.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: HUD.mono,
    fontSize: 13,
    color: `${HUD.cyan}50`,
    letterSpacing: 3,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontFamily: HUD.mono,
    fontSize: 10,
    color: HUD.muted,
    letterSpacing: 1,
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 16,
    maxWidth: 260,
  },
});
