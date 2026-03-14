import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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

import { HUD } from '@/constants/hud-theme';

// ─── NPI Registry types ───────────────────────────────────────────────────────

interface NpiAddress {
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postal_code: string;
  telephone_number?: string;
}

interface NpiResult {
  number: string; // NPI number
  basic: {
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    credential?: string;
    organization_name?: string;
    name?: string;
  };
  addresses: NpiAddress[];
  taxonomies: { desc: string; primary: boolean }[];
}

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
}

// ─── NPI API ──────────────────────────────────────────────────────────────────

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

  const results: NpiResult[] = data.results ?? [];

  return results.map((r) => {
    const basic = r.basic ?? {};
    const name = basic.organization_name
      ? basic.organization_name
      : [basic.first_name, basic.middle_name, basic.last_name]
          .filter(Boolean)
          .join(' ');

    const practiceAddr =
      r.addresses?.find((a) => a.address_purpose === 'LOCATION') ??
      r.addresses?.[0];

    const specialty =
      r.taxonomies?.find((t) => t.primary)?.desc ??
      r.taxonomies?.[0]?.desc ??
      'Physical Therapist';

    const rawZip = practiceAddr?.postal_code ?? '';
    const zip = rawZip.length > 5 ? `${rawZip.slice(0, 5)}-${rawZip.slice(5)}` : rawZip;

    return {
      npi: r.number,
      name: name || 'Unknown Provider',
      credential: basic.credential ?? '',
      specialty,
      address: [practiceAddr?.address_1, practiceAddr?.address_2]
        .filter(Boolean)
        .join(', '),
      city: practiceAddr?.city ?? '',
      state: practiceAddr?.state ?? '',
      zip,
      phone: practiceAddr?.telephone_number ?? '',
    };
  });
}

// ─── Provider card component ──────────────────────────────────────────────────

function PTCard({ provider, index }: { provider: ProviderCard; index: number }) {
  const accentColor = index % 3 === 0 ? HUD.cyan : index % 3 === 1 ? HUD.success : HUD.warning;

  function dial() {
    if (provider.phone) {
      Linking.openURL(`tel:${provider.phone.replace(/\D/g, '')}`);
    }
  }

  return (
    <View style={[styles.card, { borderColor: HUD.border }]}>
      {/* Left accent bar */}
      <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

      <View style={styles.cardBody}>
        {/* Top row: name + NPI badge */}
        <View style={styles.cardTopRow}>
          <View style={styles.cardIconBox}>
            <Ionicons name="medkit-outline" size={14} color={accentColor} />
          </View>
          <View style={styles.cardTitleCol}>
            <Text style={styles.cardName} numberOfLines={2}>
              {provider.name}
              {provider.credential ? `, ${provider.credential}` : ''}
            </Text>
            <Text style={[styles.cardSpecialty, { color: accentColor }]}>
              {provider.specialty.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.npiBadge, { borderColor: `${accentColor}40` }]}>
            <Text style={[styles.npiText, { color: accentColor }]}>NPI</Text>
          </View>
        </View>

        {/* Address */}
        {provider.address ? (
          <View style={styles.cardRow}>
            <Ionicons name="location-outline" size={11} color={HUD.muted} />
            <Text style={styles.cardMeta}>
              {provider.address}, {provider.city}, {provider.state} {provider.zip}
            </Text>
          </View>
        ) : null}

        {/* Phone + call button */}
        {provider.phone ? (
          <View style={styles.cardPhoneRow}>
            <Ionicons name="call-outline" size={11} color={HUD.muted} />
            <Text style={styles.cardMeta}>{provider.phone}</Text>
            <TouchableOpacity
              onPress={dial}
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

export default function PTLocatorScreen() {
  const [zipCode, setZipCode] = useState('');
  const [insurance, setInsurance] = useState('');
  const [results, setResults] = useState<ProviderCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    const zip = zipCode.trim();
    if (zip.length < 5) {
      setError('Enter a valid 5-digit zip code.');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);
    try {
      const providers = await searchPTs(zip);
      setResults(providers);
      if (providers.length === 0) setError('No physical therapists found for that zip code.');
    } catch {
      setError('Failed to fetch results. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
            {/* Corner accents */}
            <View style={[styles.cornerH, { top: 0, left: 0 }]} />
            <View style={[styles.cornerV, { top: 0, left: 0 }]} />
            <View style={[styles.cornerH, { bottom: 0, right: 0 }]} />
            <View style={[styles.cornerV, { bottom: 0, right: 0 }]} />

            <Text style={styles.inputLabel}>ZIP CODE</Text>
            <View style={styles.inputRow}>
              <Ionicons name="navigate-outline" size={14} color={HUD.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. 10001"
                placeholderTextColor={HUD.muted}
                value={zipCode}
                onChangeText={(t) => setZipCode(t.replace(/\D/g, '').slice(0, 5))}
                keyboardType="number-pad"
                maxLength={5}
                returnKeyType="next"
              />
            </View>

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>INSURANCE PROVIDER</Text>
            <View style={styles.inputRow}>
              <Ionicons name="shield-checkmark-outline" size={14} color={HUD.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="e.g. Blue Cross, Aetna, UnitedHealth"
                placeholderTextColor={HUD.muted}
                value={insurance}
                onChangeText={setInsurance}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
            </View>

            {insurance.length > 0 && (
              <View style={styles.insuranceNote}>
                <Ionicons name="information-circle-outline" size={11} color={HUD.warning} />
                <Text style={styles.insuranceNoteText}>
                  Insurance shown for reference — call to verify acceptance
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.searchBtn, loading && styles.searchBtnDisabled]}
              onPress={handleSearch}
              activeOpacity={0.8}
              disabled={loading}
            >
              <View style={styles.searchBtnAccentTL} />
              <View style={styles.searchBtnAccentBR} />
              {loading ? (
                <ActivityIndicator size="small" color={HUD.cyan} />
              ) : (
                <>
                  <Ionicons name="search-outline" size={14} color={HUD.cyan} />
                  <Text style={styles.searchBtnText}>SCAN AREA</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={13} color={HUD.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Results header */}
          {results.length > 0 && (
            <View style={styles.resultsHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionTitle}>{results.length} PROVIDERS FOUND</Text>
              <View style={styles.sectionLine} />
            </View>
          )}

          {/* Disclaimer when results present */}
          {results.length > 0 && (
            <View style={styles.disclaimer}>
              <Ionicons name="alert-circle-outline" size={11} color={HUD.muted} />
              <Text style={styles.disclaimerText}>
                DATA FROM NPPES NATIONAL PROVIDER REGISTRY · CALL TO VERIFY INSURANCE &amp; AVAILABILITY
              </Text>
            </View>
          )}

          {/* Provider cards */}
          {results.map((p, i) => (
            <PTCard key={p.npi} provider={p} index={i} />
          ))}

          {/* Empty state */}
          {!loading && !searched && (
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={40} color={`${HUD.cyan}30`} />
              <Text style={styles.emptyTitle}>AWAITING COORDINATES</Text>
              <Text style={styles.emptySubtitle}>
                Enter your zip code to scan for nearby physical therapists
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: HUD.bg,
  },
  flex: { flex: 1 },
  scroll: { backgroundColor: HUD.bg },
  content: {
    padding: 16,
    paddingBottom: 48,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  headerAccentLine: {
    height: 1,
    backgroundColor: HUD.cyan,
    opacity: 0.3,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleCol: { gap: 4 },
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
    width: 40,
    height: 40,
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
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cornerH: {
    position: 'absolute',
    width: 18,
    height: 1.5,
    backgroundColor: HUD.cyan,
    opacity: 0.7,
  },
  cornerV: {
    position: 'absolute',
    width: 1.5,
    height: 18,
    backgroundColor: HUD.cyan,
    opacity: 0.7,
  },
  inputLabel: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 2,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    backgroundColor: '#0d1623',
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: HUD.mono,
    fontSize: 14,
    color: HUD.text,
    paddingVertical: 10,
  },
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
    flex: 1,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    borderWidth: 1,
    borderColor: HUD.cyan,
    borderRadius: 4,
    paddingVertical: 13,
    backgroundColor: `${HUD.cyan}18`,
    overflow: 'hidden',
  },
  searchBtnDisabled: {
    opacity: 0.5,
  },
  searchBtnAccentTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 16,
    height: 1.5,
    backgroundColor: HUD.cyan,
    opacity: 0.8,
  },
  searchBtnAccentBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 1.5,
    backgroundColor: HUD.cyan,
    opacity: 0.8,
  },
  searchBtnText: {
    fontFamily: HUD.mono,
    fontSize: 12,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 2,
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
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.danger,
    flex: 1,
    letterSpacing: 0.5,
  },

  // Results
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: HUD.cyan,
    opacity: 0.2,
  },
  sectionTitle: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 2,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 14,
  },
  disclaimerText: {
    fontFamily: HUD.mono,
    fontSize: 7,
    color: HUD.muted,
    letterSpacing: 0.5,
    flex: 1,
    opacity: 0.7,
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
  cardAccent: {
    width: 2,
    opacity: 0.7,
  },
  cardBody: {
    flex: 1,
    padding: 12,
    gap: 8,
  },
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
    borderColor: `${HUD.cyan}30`,
    backgroundColor: `${HUD.cyan}08`,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardTitleCol: {
    flex: 1,
    gap: 3,
  },
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
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  npiText: {
    fontFamily: HUD.mono,
    fontSize: 7,
    letterSpacing: 1,
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
