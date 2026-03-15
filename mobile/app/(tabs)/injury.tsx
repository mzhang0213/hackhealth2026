import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import Anthropic from '@anthropic-ai/sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { HUD } from '@/constants/hud-theme';
import {
  BODY_DIAGRAM_KEY,
  type InjuryStatus,
  type MarkedPart,
} from '@/constants/body-store';
import Body, { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';

// ─── Claude client ────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
  dangerouslyAllowBrowser: true,
});

interface ParsedInjury {
  howItHappened?: string;
  dateOfInjury?: string;
  doctorDiagnosis?: string;
  initialSymptoms?: string;
  status?: InjuryStatus;
}

async function parseInjuryFromSpeech(transcript: string): Promise<ParsedInjury> {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are extracting injury details from a voice description. Parse the following speech transcript and return a JSON object with these optional fields:
- howItHappened: how the injury occurred
- dateOfInjury: date mentioned (format as MM/DD/YYYY if possible, otherwise keep as said)
- doctorDiagnosis: any medical diagnosis mentioned
- initialSymptoms: symptoms described (swelling, pain, limited motion, etc.)
- status: one of "pain", "moderate", or "recovering" based on severity described

Only include fields that are clearly mentioned. Return ONLY valid JSON, no explanation.

Transcript: "${transcript}"`,
      },
    ],
  });
  const raw = (message.content[0] as { type: string; text: string }).text.trim();
  const clean = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(clean) as ParsedInjury;
}

// ─── Voice overlay ────────────────────────────────────────────────────────────

interface VoiceOverlayProps {
  visible: boolean;
  onClose: () => void;
  onResult: (parsed: ParsedInjury) => void;
}

function VoiceOverlay({ visible, onClose, onResult }: VoiceOverlayProps) {
  const [phase, setPhase] = useState<'idle' | 'listening' | 'processing' | 'done' | 'error'>('idle');
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (visible) {
      setPhase('idle');
      setTranscript('');
      setErrorMsg('');
    } else {
      try { ExpoSpeechRecognitionModule.stop(); } catch {}
    }
  }, [visible]);

  useEffect(() => {
    if (phase === 'listening') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [phase]);

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript ?? '';
    setTranscript(text);
  });

  useSpeechRecognitionEvent('end', () => {
    if (phase === 'listening') handleTranscriptDone();
  });

  useSpeechRecognitionEvent('error', (event) => {
    setErrorMsg(event.error ?? 'Speech recognition failed.');
    setPhase('error');
  });

  async function requestPermissionAndStart() {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      setErrorMsg('Microphone permission denied.');
      setPhase('error');
      return;
    }
    setTranscript('');
    setPhase('listening');
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  }

  async function handleTranscriptDone() {
    if (!transcript.trim()) { setPhase('idle'); return; }
    setPhase('processing');
    try {
      const parsed = await parseInjuryFromSpeech(transcript);
      setPhase('done');
      setTimeout(() => { onResult(parsed); onClose(); }, 800);
    } catch {
      setErrorMsg('Failed to parse your description. Please try again.');
      setPhase('error');
    }
  }

  function handleMicPress() {
    if (phase === 'idle' || phase === 'error') requestPermissionAndStart();
    else if (phase === 'listening') try { ExpoSpeechRecognitionModule.stop(); } catch {}
  }

  const micColor =
    phase === 'listening' ? HUD.danger :
    phase === 'processing' ? HUD.warning :
    phase === 'done' ? HUD.success :
    phase === 'error' ? HUD.danger : HUD.cyan;

  const statusText =
    phase === 'idle' ? 'TAP MIC TO BEGIN' :
    phase === 'listening' ? 'LISTENING — TAP TO STOP' :
    phase === 'processing' ? 'ANALYZING WITH AI…' :
    phase === 'done' ? 'FIELDS POPULATED' : 'ERROR';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={voiceStyles.backdrop}>
        <View style={voiceStyles.panel}>
          <View style={[voiceStyles.cornerH, { top: 0, left: 0 }]} />
          <View style={[voiceStyles.cornerV, { top: 0, left: 0 }]} />
          <View style={[voiceStyles.cornerH, { top: 0, right: 0 }]} />
          <View style={[voiceStyles.cornerV, { top: 0, right: 0 }]} />
          <View style={[voiceStyles.cornerH, { bottom: 0, left: 0 }]} />
          <View style={[voiceStyles.cornerV, { bottom: 0, left: 0 }]} />
          <View style={[voiceStyles.cornerH, { bottom: 0, right: 0 }]} />
          <View style={[voiceStyles.cornerV, { bottom: 0, right: 0 }]} />
          <View style={[voiceStyles.topLine, { backgroundColor: micColor }]} />

          <TouchableOpacity style={voiceStyles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close-outline" size={20} color={HUD.muted} />
          </TouchableOpacity>

          <Text style={voiceStyles.title}>VOICE INPUT</Text>
          <Text style={voiceStyles.hint}>
            Describe your injury freely — what happened,{'\n'}when, any diagnosis, and your symptoms
          </Text>

          <View style={voiceStyles.micArea}>
            {phase === 'listening' && (
              <Animated.View
                style={[voiceStyles.pulseRing, { borderColor: micColor, transform: [{ scale: pulseAnim }] }]}
              />
            )}
            <TouchableOpacity
              style={[voiceStyles.micBtn, { borderColor: micColor, backgroundColor: `${micColor}18` }]}
              onPress={handleMicPress}
              activeOpacity={0.8}
              disabled={phase === 'processing' || phase === 'done'}
            >
              {phase === 'processing' ? (
                <Ionicons name="pulse-outline" size={32} color={HUD.warning} />
              ) : phase === 'done' ? (
                <Ionicons name="checkmark-outline" size={32} color={HUD.success} />
              ) : (
                <Ionicons
                  name={phase === 'listening' ? 'stop-circle-outline' : 'mic-outline'}
                  size={32}
                  color={micColor}
                />
              )}
            </TouchableOpacity>
          </View>

          <Text style={[voiceStyles.statusText, { color: micColor }]}>{statusText}</Text>

          {transcript.length > 0 && (
            <View style={voiceStyles.transcriptBox}>
              <View style={[voiceStyles.transcriptAccent, { backgroundColor: micColor }]} />
              <Text style={voiceStyles.transcriptText}>{transcript}</Text>
            </View>
          )}

          {phase === 'error' && (
            <View style={voiceStyles.errorRow}>
              <Ionicons name="warning-outline" size={12} color={HUD.danger} />
              <Text style={voiceStyles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {phase === 'idle' && (
            <Text style={voiceStyles.example}>
              e.g. "I hurt my knee playing basketball last Tuesday,{'\n'}
              doctor said it's a grade 2 sprain, lots of swelling"
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const [view, setView] = useState<'front' | 'back'>('front');
  const [markedParts, setMarkedParts] = useState<Record<string, MarkedPart>>({});
  const [sheetMode, setSheetMode] = useState<'add' | 'view'>('add');
  const [activePart, setActivePart] = useState<{ slug: Slug; side?: 'left' | 'right' } | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<InjuryStatus>('pain');
  const [howItHappened, setHowItHappened] = useState('');
  const [dateOfInjury, setDateOfInjury] = useState('');
  const [doctorDiagnosis, setDoctorDiagnosis] = useState('');
  const [initialSymptoms, setInitialSymptoms] = useState('');
  const [voiceVisible, setVoiceVisible] = useState(false);

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['55%', '92%'], []);

  useEffect(() => {
    AsyncStorage.getItem(BODY_DIAGRAM_KEY).then((raw) => {
      if (raw) setMarkedParts(JSON.parse(raw));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(BODY_DIAGRAM_KEY, JSON.stringify(markedParts));
  }, [markedParts]);

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

  function handleVoiceResult(parsed: ParsedInjury) {
    if (parsed.howItHappened) setHowItHappened(parsed.howItHappened);
    if (parsed.dateOfInjury) setDateOfInjury(parsed.dateOfInjury);
    if (parsed.doctorDiagnosis) setDoctorDiagnosis(parsed.doctorDiagnosis);
    if (parsed.initialSymptoms) setInitialSymptoms(parsed.initialSymptoms);
    if (parsed.status && STATUS_COLORS[parsed.status]) setSelectedStatus(parsed.status);
    sheetRef.current?.snapToIndex(1);
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

      <VoiceOverlay
        visible={voiceVisible}
        onClose={() => setVoiceVisible(false)}
        onResult={handleVoiceResult}
      />

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
              <View style={styles.sheetHeaderRight}>
                <TouchableOpacity
                  style={styles.micTriggerBtn}
                  onPress={() => setVoiceVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="mic-outline" size={16} color={HUD.cyan} />
                </TouchableOpacity>
                <View style={styles.sheetAddBadge}>
                  <Text style={styles.sheetAddBadgeText}>LOG INJURY</Text>
                </View>
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
  sheetHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  micTriggerBtn: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: `${HUD.cyan}60`,
    backgroundColor: `${HUD.cyan}15`,
    alignItems: 'center',
    justifyContent: 'center',
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
});

const voiceStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,12,20,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    width: '100%',
    backgroundColor: '#0d1623',
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    opacity: 0.8,
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
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 4,
  },
  title: {
    fontFamily: HUD.mono,
    fontSize: 14,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 3,
    marginBottom: 8,
    marginTop: 8,
    ...(Platform.OS === 'ios' && {
      textShadowColor: HUD.cyan,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 6,
    }),
  },
  hint: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 0.8,
    textAlign: 'center',
    lineHeight: 15,
    marginBottom: 28,
  },
  micArea: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pulseRing: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1.5,
    opacity: 0.5,
  },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontFamily: HUD.mono,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 16,
  },
  transcriptBox: {
    width: '100%',
    backgroundColor: `${HUD.cyan}08`,
    borderWidth: 1,
    borderColor: `${HUD.cyan}30`,
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  transcriptAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    opacity: 0.7,
  },
  transcriptText: {
    fontFamily: HUD.mono,
    fontSize: 12,
    color: HUD.text,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: HUD.mono,
    fontSize: 10,
    color: HUD.danger,
    flex: 1,
    letterSpacing: 0.5,
  },
  example: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    textAlign: 'center',
    lineHeight: 15,
    opacity: 0.6,
    letterSpacing: 0.3,
  },
});
