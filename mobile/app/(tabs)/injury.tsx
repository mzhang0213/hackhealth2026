import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { HUD } from '@/constants/hud-theme';
import { type InjuryStatus, type MarkedPart } from '@/constants/body-store';
import { api, type InjuryFormData } from '@/constants/api';
import { useUser } from '@/context/UserContext';
import Body, { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';

const STATUS_COLORS: Record<InjuryStatus, string> = {
  pain: '#EF4444',
  moderate: '#F59E0B',
  recovering: '#22C55E',
};

const STATUS_LABELS: Record<InjuryStatus, string> = {
  pain: 'PAIN',
  moderate: 'MODERATE',
  recovering: 'RECOVERING',
};

function makeKey(slug: Slug, side?: 'left' | 'right') {
  return side ? `${slug}-${side}` : slug;
}

function formatSlug(slug: string) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function InjuryScreen() {
  const { user } = useUser();
  const [view, setView] = useState<'front' | 'back'>('front');
  const [markedParts, setMarkedParts] = useState<Record<string, MarkedPart>>({});
  const [sheetMode, setSheetMode] = useState<'add' | 'view'>('add');
  const [activePart, setActivePart] = useState<{ slug: Slug; side?: 'left' | 'right' } | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<InjuryStatus>('pain');
  const [howItHappened, setHowItHappened] = useState('');
  const [dateOfInjury, setDateOfInjury] = useState('');
  const [doctorDiagnosis, setDoctorDiagnosis] = useState('');
  const [initialSymptoms, setInitialSymptoms] = useState('');

  type MicState = 'idle' | 'recording' | 'processing';
  const [micState, setMicState] = useState<MicState>('idle');
  const [micError, setMicError] = useState('');
  const [recentlyFilled, setRecentlyFilled] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const activeRecording = useRef<Audio.Recording | null>(null);

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['55%', '78%'], []);
  const hasLoaded = useRef(false);

  // Load markers from API on mount
  useEffect(() => {
    if (!user) return;
    api.getInjuryMarkers(user.id).then((rows) => {
      const parts: Record<string, MarkedPart> = {};
      for (const r of rows) {
        const key = r.side ? `${r.slug}-${r.side}` : r.slug;
        parts[key] = {
          slug: r.slug as Slug,
          side: r.side as 'left' | 'right' | undefined ?? undefined,
          status: r.status as InjuryStatus,
          howItHappened: r.how_it_happened ?? undefined,
          dateOfInjury: r.date_of_injury ?? undefined,
          doctorDiagnosis: r.doctor_diagnosis ?? undefined,
          initialSymptoms: r.initial_symptoms ?? undefined,
        };
      }
      setMarkedParts(parts);
      hasLoaded.current = true;
    }).catch(() => {
      hasLoaded.current = true;
    });
  }, [user]);

  // Sync markers to API whenever they change
  useEffect(() => {
    if (!user || !hasLoaded.current) return;
    const markers = Object.values(markedParts).map((p) => ({
      slug: p.slug,
      side: p.side ?? null,
      status: p.status,
      how_it_happened: p.howItHappened ?? null,
      date_of_injury: p.dateOfInjury ?? null,
      doctor_diagnosis: p.doctorDiagnosis ?? null,
      initial_symptoms: p.initialSymptoms ?? null,
    }));
    api.saveInjuryMarkers(user.id, markers).catch(() => {});
  }, [markedParts, user]);

  // Pulse animation while mic is recording
  useEffect(() => {
    if (micState !== 'recording') {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [micState]);

  async function handleMicPress() {
    setMicError('');

    if (micState === 'recording') {
      // Stop and process
      const rec = activeRecording.current;
      if (!rec) { setMicState('idle'); return; }
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      activeRecording.current = null;
      if (!uri) { setMicState('idle'); return; }

      setMicState('processing');
      try {
        const data: InjuryFormData = await api.transcribeInjury(uri);
        // Stagger-fill each field for a visual autofill effect
        setTimeout(() => setHowItHappened(data.how_it_happened || ''),   0);
        setTimeout(() => setDateOfInjury(data.date_of_injury || ''),     160);
        setTimeout(() => setDoctorDiagnosis(data.doctor_diagnosis || ''), 320);
        setTimeout(() => setInitialSymptoms(data.initial_symptoms || ''), 480);
        const s = (data.status || 'pain') as InjuryStatus;
        if (STATUS_COLORS[s]) setTimeout(() => setSelectedStatus(s), 80);
        setRecentlyFilled(true);
        setTimeout(() => setRecentlyFilled(false), 4000);
      } catch {
        setMicError('VOICE RECOGNITION FAILED — TRY AGAIN');
      } finally {
        setMicState('idle');
      }
      return;
    }

    // Start recording
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      setMicError('MICROPHONE ACCESS DENIED');
      return;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    activeRecording.current = recording;
    setMicState('recording');
  }

  function resetForm() {
    setSelectedStatus('pain');
    setHowItHappened('');
    setDateOfInjury('');
    setDoctorDiagnosis('');
    setInitialSymptoms('');
  }

  function handleBodyPartPress(part: ExtendedBodyPart, side?: 'left' | 'right') {
    if (!part.slug) return;
    const resolvedSide = side ?? part.side;
    const key = makeKey(part.slug, resolvedSide);

    setActivePart({ slug: part.slug, side: resolvedSide });

    if (markedParts[key]) {
      setSheetMode('view');
    } else {
      setSheetMode('add');
      resetForm();
    }

    sheetRef.current?.snapToIndex(0);
  }

  function handleSave() {
    if (!activePart) return;
    const key = makeKey(activePart.slug, activePart.side);
    const part: MarkedPart = {
      slug: activePart.slug,
      side: activePart.side,
      status: selectedStatus,
      ...(howItHappened.trim() && { howItHappened: howItHappened.trim() }),
      ...(dateOfInjury.trim() && { dateOfInjury: dateOfInjury.trim() }),
      ...(doctorDiagnosis.trim() && { doctorDiagnosis: doctorDiagnosis.trim() }),
      ...(initialSymptoms.trim() && { initialSymptoms: initialSymptoms.trim() }),
    };
    setMarkedParts((prev) => ({ ...prev, [key]: part }));
    sheetRef.current?.close();
  }

  function handleClear() {
    if (!activePart) return;
    const label = `${formatSlug(activePart.slug)}${activePart.side ? ` (${activePart.side})` : ''}`;
    Alert.alert('Clear Injury', `Remove injury mark from ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setMarkedParts((prev) => {
            const next = { ...prev };
            delete next[makeKey(activePart.slug, activePart.side)];
            return next;
          });
          sheetRef.current?.close();
        },
      },
    ]);
  }

  function handleClearAll() {
    Alert.alert('Clear All', 'Remove all marked body parts?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setMarkedParts({}) },
    ]);
  }

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  const bodyData: ExtendedBodyPart[] = useMemo(() =>
    Object.values(markedParts).map((p) => ({
      slug: p.slug,
      side: p.side,
      color: STATUS_COLORS[p.status],
      intensity: 1,
    })),
  [markedParts]);

  const markedCount = Object.keys(markedParts).length;
  const activeKey = activePart ? makeKey(activePart.slug, activePart.side) : null;
  const activeMarkedPart = activeKey ? markedParts[activeKey] : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
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
                BODY MAP
              </Text>
              <Text style={styles.subtitle}>
                {markedCount > 0
                  ? `${markedCount} AREA${markedCount !== 1 ? 'S' : ''} MARKED — TAP TO VIEW OR LOG`
                  : 'TAP A BODY PART TO LOG AN INJURY'}
              </Text>
            </View>
            <View style={styles.headerBadge}>
              <Ionicons name="body-outline" size={18} color={HUD.cyan} />
            </View>
          </View>
        </View>

        {/* Front / Back toggle */}
        <View style={styles.toggleRow}>
          {(['front', 'back'] as const).map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.toggleBtn, view === v && styles.toggleBtnActive]}
              onPress={() => setView(v)}
              activeOpacity={0.8}
            >
              {view === v && <View style={styles.toggleActiveLine} />}
              <Text style={[styles.toggleLabel, view === v && styles.toggleLabelActive]}>
                {v.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Body diagram */}
        <View style={styles.bodyContainer}>
          <View style={[styles.cornerH, { top: 0, left: 0, backgroundColor: HUD.cyan }]} />
          <View style={[styles.cornerV, { top: 0, left: 0, backgroundColor: HUD.cyan }]} />
          <View style={[styles.cornerH, { bottom: 0, right: 0, backgroundColor: HUD.cyan }]} />
          <View style={[styles.cornerV, { bottom: 0, right: 0, backgroundColor: HUD.cyan }]} />

          <Body
            data={bodyData}
            side={view}
            scale={1.1}
            gender="male"
            onBodyPartPress={handleBodyPartPress}
            defaultFill="#1a2535"
            border="#2a3a50"
          />
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {(Object.entries(STATUS_COLORS) as [InjuryStatus, string][]).map(([status, color]) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={[styles.legendLabel, { color }]}>{STATUS_LABELS[status]}</Text>
            </View>
          ))}
        </View>

        {/* Marked parts list */}
        {markedCount > 0 && (
          <View style={styles.partsList}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionTitle}>MARKED AREAS</Text>
              <View style={styles.sectionLine} />
            </View>

            {Object.values(markedParts).map((p) => {
              const key = makeKey(p.slug, p.side);
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.partRow}
                  onPress={() => {
                    setActivePart({ slug: p.slug, side: p.side });
                    setSheetMode('view');
                    sheetRef.current?.snapToIndex(0);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.partRowAccent, { backgroundColor: STATUS_COLORS[p.status] }]} />
                  <View style={[styles.partDot, { backgroundColor: STATUS_COLORS[p.status] }]} />
                  <Text style={styles.partName}>
                    {formatSlug(p.slug).toUpperCase()}{p.side ? ` (${p.side.toUpperCase()})` : ''}
                  </Text>
                  <Text style={[styles.partStatus, { color: STATUS_COLORS[p.status] }]}>
                    {STATUS_LABELS[p.status]}
                  </Text>
                  <Ionicons name="chevron-forward-outline" size={14} color={HUD.muted} />
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtn}>
              <Ionicons name="trash-outline" size={13} color="#EF4444" />
              <Text style={styles.clearAllText}>CLEAR ALL</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        handleIndicatorStyle={{ backgroundColor: HUD.border }}
        backgroundStyle={{ backgroundColor: '#0d1623' }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          <View style={styles.sheetTopAccent} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleCol}>
              <Text style={styles.sheetTitle}>
                {activePart ? formatSlug(activePart.slug).toUpperCase() : ''}
                {activePart?.side ? ` (${activePart.side.toUpperCase()})` : ''}
              </Text>
              {sheetMode === 'view' && activeMarkedPart && (
                <View style={styles.sheetSubRow}>
                  <View style={[styles.sheetSubDot, { backgroundColor: STATUS_COLORS[activeMarkedPart.status] }]} />
                  <Text style={[styles.sheetSubText, { color: STATUS_COLORS[activeMarkedPart.status] }]}>
                    {STATUS_LABELS[activeMarkedPart.status]}
                  </Text>
                </View>
              )}
            </View>
            {sheetMode === 'add' && (
              <View style={styles.sheetAddBadge}>
                <Text style={styles.sheetAddBadgeText}>LOG INJURY</Text>
              </View>
            )}
          </View>

          {sheetMode === 'add' ? (
            <>
              <Text style={styles.fieldLabel}>STATUS</Text>
              <View style={styles.statusRow}>
                {(Object.keys(STATUS_COLORS) as InjuryStatus[]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.statusChip,
                      { borderColor: STATUS_COLORS[s] },
                      selectedStatus === s && { backgroundColor: STATUS_COLORS[s] + '30' },
                    ]}
                    onPress={() => setSelectedStatus(s)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.statusChipDot, { backgroundColor: STATUS_COLORS[s] }]} />
                    <Text style={[
                      styles.statusChipText,
                      { color: selectedStatus === s ? STATUS_COLORS[s] : HUD.muted },
                    ]}>
                      {STATUS_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Voice autofill ── */}
              <Animated.View style={[styles.voiceBtnWrap, { opacity: micState === 'recording' ? pulseAnim : 1 }]}>
                <TouchableOpacity
                  style={[
                    styles.voiceBtn,
                    micState === 'recording'  && styles.voiceBtnRecording,
                    micState === 'processing' && styles.voiceBtnProcessing,
                  ]}
                  onPress={handleMicPress}
                  disabled={micState === 'processing'}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={micState === 'recording' ? 'stop-circle-outline' : 'mic-outline'}
                    size={13}
                    color={
                      micState === 'recording'  ? HUD.danger  :
                      micState === 'processing' ? HUD.warning :
                      HUD.cyan
                    }
                  />
                  <Text style={[
                    styles.voiceBtnText,
                    micState === 'recording'  && { color: HUD.danger },
                    micState === 'processing' && { color: HUD.warning },
                  ]}>
                    {micState === 'idle'       ? 'VOICE AUTOFILL'  :
                     micState === 'recording'  ? '● STOP RECORDING' :
                     '⟳  ANALYZING...'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
              {recentlyFilled && (
                <Text style={styles.autofillNote}>// FIELDS AUTOFILLED — REVIEW BEFORE SAVING</Text>
              )}
              {micError ? <Text style={styles.micErrorText}>{micError}</Text> : null}

              <View style={styles.divider} />
              <Text style={styles.optionalNote}>// ALL FIELDS BELOW ARE OPTIONAL</Text>

              <Text style={styles.fieldLabel}>HOW DID IT HAPPEN?</Text>
              <BottomSheetTextInput
                style={[styles.input, styles.multiline]}
                placeholder="Describe what happened..."
                placeholderTextColor={HUD.muted}
                value={howItHappened}
                onChangeText={setHowItHappened}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>DATE OF INJURY</Text>
              <BottomSheetTextInput
                style={styles.input}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={HUD.muted}
                value={dateOfInjury}
                onChangeText={setDateOfInjury}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />

              <Text style={styles.fieldLabel}>DOCTOR DIAGNOSIS</Text>
              <BottomSheetTextInput
                style={[styles.input, styles.multiline]}
                placeholder="e.g. Grade II sprain, ACL tear..."
                placeholderTextColor={HUD.muted}
                value={doctorDiagnosis}
                onChangeText={setDoctorDiagnosis}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>INITIAL SYMPTOMS</Text>
              <BottomSheetTextInput
                style={[styles.input, styles.multiline]}
                placeholder="e.g. Swelling, limited range of motion..."
                placeholderTextColor={HUD.muted}
                value={initialSymptoms}
                onChangeText={setInitialSymptoms}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                <View style={styles.saveBtnAccentTL} />
                <View style={styles.saveBtnAccentBR} />
                <Text style={styles.saveBtnText}>SAVE INJURY MARKER</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {activeMarkedPart && (
                <>
                  {activeMarkedPart.howItHappened && (
                    <DetailRow label="HOW IT HAPPENED" value={activeMarkedPart.howItHappened} />
                  )}
                  {activeMarkedPart.dateOfInjury && (
                    <DetailRow label="DATE OF INJURY" value={activeMarkedPart.dateOfInjury} />
                  )}
                  {activeMarkedPart.doctorDiagnosis && (
                    <DetailRow label="DOCTOR DIAGNOSIS" value={activeMarkedPart.doctorDiagnosis} />
                  )}
                  {activeMarkedPart.initialSymptoms && (
                    <DetailRow label="INITIAL SYMPTOMS" value={activeMarkedPart.initialSymptoms} />
                  )}
                  {!activeMarkedPart.howItHappened &&
                    !activeMarkedPart.dateOfInjury &&
                    !activeMarkedPart.doctorDiagnosis &&
                    !activeMarkedPart.initialSymptoms && (
                      <Text style={styles.noDetails}>// NO ADDITIONAL DETAILS RECORDED</Text>
                    )}
                  <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.8}>
                    <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    <Text style={styles.clearBtnText}>CLEAR INJURY</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabelRow}>
        <View style={styles.detailLabelDash} />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: HUD.bg,
  },
  scroll: {
    backgroundColor: HUD.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },

  header: {
    marginBottom: 20,
    overflow: 'hidden',
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
  headerTitleCol: {
    gap: 4,
  },
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

  toggleRow: {
    flexDirection: 'row',
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    padding: 3,
    marginBottom: 12,
    alignSelf: 'center',
    width: 220,
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 3,
    alignItems: 'center',
    overflow: 'hidden',
  },
  toggleBtnActive: {
    backgroundColor: `${HUD.cyan}18`,
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
  toggleLabel: {
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.muted,
    letterSpacing: 2,
  },
  toggleLabelActive: {
    color: HUD.cyan,
    fontWeight: '700',
  },

  bodyContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  cornerH: {
    position: 'absolute',
    width: 18,
    height: 1.5,
    opacity: 0.7,
  },
  cornerV: {
    position: 'absolute',
    width: 1.5,
    height: 18,
    opacity: 0.7,
  },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 14,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontFamily: HUD.mono,
    fontSize: 9,
    letterSpacing: 1,
  },

  partsList: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
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
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  partRowAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    opacity: 0.7,
  },
  partDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  partName: {
    flex: 1,
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.text,
    letterSpacing: 1,
  },
  partStatus: {
    fontFamily: HUD.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EF444440',
    borderRadius: 4,
  },
  clearAllText: {
    fontFamily: HUD.mono,
    fontSize: 10,
    color: '#EF4444',
    letterSpacing: 1.5,
  },

  sheetContent: {
    padding: 24,
    paddingBottom: 48,
  },
  sheetTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: HUD.cyan,
    opacity: 0.3,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  sheetTitleCol: {
    flex: 1,
    gap: 6,
  },
  sheetTitle: {
    fontFamily: HUD.mono,
    fontSize: 18,
    fontWeight: '700',
    color: HUD.text,
    letterSpacing: 2,
  },
  sheetSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetSubDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sheetSubText: {
    fontFamily: HUD.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  sheetAddBadge: {
    borderWidth: 1,
    borderColor: `${HUD.cyan}50`,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: `${HUD.cyan}10`,
  },
  sheetAddBadgeText: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.cyan,
    letterSpacing: 1,
  },

  fieldLabel: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 2,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontFamily: HUD.mono,
    fontSize: 10,
    letterSpacing: 1,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HUD.border,
    marginBottom: 16,
  },
  optionalNote: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1,
    marginBottom: 16,
    opacity: 0.7,
  },
  input: {
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
    backgroundColor: '#0d1623',
    color: HUD.text,
    fontFamily: HUD.mono,
  },
  multiline: {
    minHeight: 80,
    paddingTop: 10,
  },
  saveBtn: {
    borderWidth: 1,
    borderColor: HUD.cyan,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: `${HUD.cyan}18`,
    overflow: 'hidden',
  },
  saveBtnAccentTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 16,
    height: 1.5,
    backgroundColor: HUD.cyan,
    opacity: 0.8,
  },
  saveBtnAccentBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 1.5,
    backgroundColor: HUD.cyan,
    opacity: 0.8,
  },
  saveBtnText: {
    fontFamily: HUD.mono,
    color: HUD.cyan,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },

  detailRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HUD.border,
    gap: 6,
  },
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabelDash: {
    width: 12,
    height: 1,
    backgroundColor: HUD.cyan,
    opacity: 0.5,
  },
  detailLabel: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1.5,
  },
  detailValue: {
    fontFamily: HUD.mono,
    fontSize: 13,
    color: HUD.text,
    lineHeight: 20,
  },
  noDetails: {
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.muted,
    marginVertical: 16,
    letterSpacing: 1,
    opacity: 0.7,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#EF444450',
    borderRadius: 4,
    paddingVertical: 14,
    marginTop: 20,
    backgroundColor: '#EF444410',
  },
  clearBtnText: {
    fontFamily: HUD.mono,
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },

  voiceBtnWrap: { marginBottom: 16 },
  voiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: `${HUD.cyan}50`,
    borderRadius: 4,
    paddingVertical: 10,
    backgroundColor: `${HUD.cyan}08`,
  },
  voiceBtnRecording: {
    borderColor: `${HUD.danger}70`,
    backgroundColor: `${HUD.danger}10`,
  },
  voiceBtnProcessing: {
    borderColor: `${HUD.warning}50`,
    backgroundColor: `${HUD.warning}08`,
  },
  voiceBtnText: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.cyan,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  autofillNote: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.success,
    letterSpacing: 1,
    marginBottom: 10,
    opacity: 0.9,
  },
  micErrorText: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.danger,
    letterSpacing: 1,
    marginBottom: 8,
  },
});
