import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CameraView, useCameraPermissions } from 'expo-camera';

import { HUD } from '@/constants/hud-theme';
import { api, type DaySection, type ExerciseItem, type RomResult } from '@/constants/api';
import { useUser } from '@/context/UserContext';
import PainCheckin from '@/components/hud/PainCheckin';

// ── Rehab Check synthetic item injected into every day ────────────────────────

function makeRehabCheck(date: string): ExerciseItem {
  return {
    id: `rehab-check-${date}`,
    name: 'Rehab Check',
    sets: 1,
    reps: 1,
    cat: 'mobility',
    accent_color: HUD.cyan,
    is_rehab: true,
    scheduled_date: date,
    completed: false,
  };
}

// ── Rehab Check card — HUD box with corner brackets ───────────────────────────

function RehabCheckCard({ onPress, completed }: { onPress: () => void; completed: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.rehabCard, completed && styles.rehabCardDone]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.cH, { top: 0, left: 0 }]} />
      <View style={[styles.cV, { top: 0, left: 0 }]} />
      <View style={[styles.cH, { top: 0, right: 0 }]} />
      <View style={[styles.cV, { top: 0, right: 0 }]} />
      <View style={[styles.cH, { bottom: 0, left: 0 }]} />
      <View style={[styles.cV, { bottom: 0, left: 0 }]} />
      <View style={[styles.cH, { bottom: 0, right: 0 }]} />
      <View style={[styles.cV, { bottom: 0, right: 0 }]} />

      <View style={styles.rehabCardInner}>
        <View style={[styles.rehabIconBox, completed && styles.rehabIconBoxDone]}>
          <Ionicons
            name={completed ? 'checkmark' : 'scan-outline'}
            size={16}
            color={completed ? HUD.success : HUD.cyan}
          />
        </View>
        <Text style={[styles.rehabCardName, completed && styles.rehabCardNameDone]}>
          DAILY REHAB CHECK
        </Text>
        <View style={[styles.rehabBadge, completed && styles.rehabBadgeDone]}>
          <Text style={[styles.rehabBadgeText, completed && styles.rehabBadgeTextDone]}>
            {completed ? 'DONE' : 'ROM'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Regular exercise card — play button style ─────────────────────────────────

function ExerciseCard({
  ex,
  onPress,
  onToggle,
}: {
  ex: ExerciseItem;
  onPress: () => void;
  onToggle: () => void;
}) {
  return (
    <View style={[styles.exerciseCard, ex.completed && styles.exerciseCardDone]}>
      <View style={[styles.accentBar, { backgroundColor: ex.completed ? HUD.success : ex.accent_color }]} />
      <TouchableOpacity style={styles.exerciseCardBody} onPress={onPress} activeOpacity={0.75}>
        <Text style={[styles.exerciseName, ex.completed && styles.exerciseNameDone]}>
          {ex.name.toUpperCase()}
        </Text>
        {ex.duration ? (
          <Text style={[styles.exerciseMeta, { color: ex.completed ? HUD.success : ex.accent_color }]}>
            {ex.duration}
          </Text>
        ) : (
          <Text style={styles.exerciseMeta}>{ex.sets}×{ex.reps}</Text>
        )}
      </TouchableOpacity>
      {/* Toggle complete button */}
      <TouchableOpacity
        style={[
          styles.checkBtn,
          ex.completed
            ? { borderColor: HUD.success, backgroundColor: `${HUD.success}20` }
            : { borderColor: `${ex.accent_color}50`, backgroundColor: 'transparent' },
        ]}
        onPress={onToggle}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {ex.completed
          ? <Ionicons name="checkmark" size={12} color={HUD.success} />
          : <View style={styles.checkBtnEmpty} />
        }
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ExercisesScreen() {
  const { user } = useUser();
  const [sections, setSections] = useState<DaySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [cameraModal, setCameraModal] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [selectedDate, setSelectedDate] = useState('');
  // Track which rehab check dates are done (keyed by date string)
  const [rehabDone, setRehabDone] = useState<Record<string, boolean>>({});

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = React.useRef<CameraView>(null);
  type ScanState = 'idle' | 'recording' | 'uploading' | 'result' | 'error';
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [countdown, setCountdown] = useState(5);
  const [romResult, setRomResult] = useState<RomResult | null>(null);

  useEffect(() => {
    if (!user) return;
    api.getExerciseSchedule(user.id)
      .then(setSections)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  function handleExercisePress(ex: ExerciseItem) {
    Linking.openURL(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' physical therapy exercise')}`
    );
  }

  function handleRehabCheckPress(date: string) {
    setSelectedDate(date);
    setScanState('idle');
    setModalStep(1);
    setCameraModal(true);
  }

  function handleRehabCheckDone() {
    // Mark this day's rehab check as complete
    setRehabDone((prev) => ({ ...prev, [selectedDate]: true }));
    handleClose();
  }

  function handleClose() {
    setCameraModal(false);
    setModalStep(1);
    setScanState('idle');
    setCountdown(5);
    setRomResult(null);
    setSelectedDate('');
  }

  async function handleToggleExercise(ex: ExerciseItem) {
    if (!user) return;
    // Optimistic update
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        exercises: s.exercises.map((e) =>
          e.id === ex.id ? { ...e, completed: !e.completed } : e
        ),
      }))
    );
    try {
      await api.toggleExercise(user.id, ex.id);
    } catch {
      // Revert on failure
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          exercises: s.exercises.map((e) =>
            e.id === ex.id ? { ...e, completed: ex.completed } : e
          ),
        }))
      );
    }
  }

  async function handleStartRecording() {
    if (!cameraRef.current) return;
    setScanState('recording');
    setCountdown(5);

    // Countdown ticker
    let remaining = 5;
    const ticker = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) clearInterval(ticker);
    }, 1000);

    try {
      const recording = await cameraRef.current.recordAsync({ maxDuration: 5 });
      clearInterval(ticker);
      if (!recording?.uri) throw new Error('No video recorded');

      setScanState('uploading');
      const muscle = user?.injury_description ?? 'knee';
      const result = await api.analyzeVideo(recording.uri, muscle);
      setRomResult(result);
      setScanState('result');
    } catch (e) {
      clearInterval(ticker);
      setScanState('error');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerAccentLine} />
        <View style={styles.headerRow}>
          <View>
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
              REHAB PROTOCOL
            </Text>
            <Text style={styles.subtitle}>EXERCISE QUEUE — ACL RECOVERY</Text>
          </View>
          <View style={styles.headerBadge}>
            <Ionicons name="barbell-outline" size={18} color={HUD.cyan} />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={HUD.cyan} />
            <Text style={styles.loadingText}>LOADING SCHEDULE...</Text>
          </View>
        )}

        {!loading && sections.length === 0 && (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>NO EXERCISES SCHEDULED</Text>
          </View>
        )}

        {sections.map((section, si) => {
          const date = `${section.month}-${section.day_num}`;
          return (
            <View key={si} style={styles.section}>
              <View style={styles.row}>
                {/* Date bubble */}
                <View style={styles.dayBubbleCol}>
                  <View style={styles.dayBubble}>
                    <Text style={styles.dayAbbr}>{section.day_abbr.toUpperCase()}</Text>
                    <Text style={styles.dayNum}>{section.day_num}</Text>
                    <Text style={styles.dayMonth}>{section.month.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Exercise cards */}
                <View style={styles.exerciseCol}>
                  {/* Hardcoded daily Rehab Check always first */}
                  <RehabCheckCard
                    onPress={() => handleRehabCheckPress(date)}
                    completed={!!rehabDone[date]}
                  />

                  {section.exercises.map((ex) => (
                    <ExerciseCard
                      key={ex.id}
                      ex={ex}
                      onPress={() => handleExercisePress(ex)}
                      onToggle={() => handleToggleExercise(ex)}
                    />
                  ))}
                </View>
              </View>

              {si < sections.length - 1 && <View style={styles.divider} />}
            </View>
          );
        })}
      </ScrollView>

      {/* ROM + Diagnostic modal */}
      <Modal
        visible={cameraModal}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={handleClose}
      >
        <SafeAreaView style={styles.modalSafe}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLine} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>
                  {modalStep === 1 ? 'ROM ANALYSIS' : 'DAILY DIAGNOSTIC'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {modalStep === 1
                    ? `REHAB CHECK — ${selectedDate}`
                    : 'LOG PAIN + SYMPTOMS'}
                </Text>
              </View>
              <View style={styles.modalHeaderRight}>
                {/* Step indicator */}
                <View style={styles.stepIndicator}>
                  <View style={[styles.stepDot, modalStep === 1 && styles.stepDotActive]} />
                  <View style={[styles.stepDot, modalStep === 2 && styles.stepDotActive]} />
                </View>
                <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
                  <Ionicons name="close-outline" size={20} color={HUD.muted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Step 1 — Camera / ROM */}
          {modalStep === 1 && (
            <>
              {/* Camera preview */}
              <View style={styles.cameraPreview}>
                <View style={[styles.cornerH, { top: 0, left: 0 }]} />
                <View style={[styles.cornerV, { top: 0, left: 0 }]} />
                <View style={[styles.cornerH, { bottom: 0, right: 0 }]} />
                <View style={[styles.cornerV, { bottom: 0, right: 0 }]} />

                {!permission?.granted ? (
                  <View style={styles.permissionBox}>
                    <Ionicons name="camera-outline" size={36} color={`${HUD.cyan}60`} />
                    <Text style={styles.cameraHint}>CAMERA ACCESS REQUIRED</Text>
                    <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission} activeOpacity={0.8}>
                      <Text style={styles.primaryBtnText}>GRANT ACCESS</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="back"
                    mode="video"
                  >
                    {/* Recording overlay */}
                    {scanState === 'recording' && (
                      <View style={styles.recordingOverlay}>
                        <View style={styles.recDot} />
                        <Text style={styles.recCountdown}>{countdown}s</Text>
                        {/* Progress bar */}
                        <View style={styles.recBarBg}>
                          <View style={[styles.recBarFill, { width: `${((5 - countdown) / 5) * 100}%` }]} />
                        </View>
                      </View>
                    )}

                    {/* Uploading overlay */}
                    {scanState === 'uploading' && (
                      <View style={styles.uploadOverlay}>
                        <ActivityIndicator color={HUD.cyan} size="large" />
                        <Text style={styles.uploadText}>ANALYZING...</Text>
                      </View>
                    )}
                  </CameraView>
                )}
              </View>

              {/* Result card */}
              {scanState === 'result' && romResult && (
                <View style={styles.resultCard}>
                  <View style={[styles.cH, { top: 0, left: 0 }]} />
                  <View style={[styles.cV, { top: 0, left: 0 }]} />
                  <View style={[styles.cH, { top: 0, right: 0 }]} />
                  <View style={[styles.cV, { top: 0, right: 0 }]} />
                  <View style={styles.resultRow}>
                    <View style={styles.resultStat}>
                      <Text style={styles.resultStatVal}>{romResult.angle}°</Text>
                      <Text style={styles.resultStatLabel}>PEAK ROM</Text>
                    </View>
                    <View style={styles.resultDivider} />
                    <View style={styles.resultStat}>
                      <Text style={styles.resultStatVal}>{romResult.average_angle}°</Text>
                      <Text style={styles.resultStatLabel}>AVG ROM</Text>
                    </View>
                    <View style={styles.resultDivider} />
                    <View style={styles.resultStat}>
                      <Text style={[styles.resultStatVal, {
                        color: romResult.ml_status === 'HEALTHY' ? HUD.success
                          : romResult.ml_status === 'IMPROVING' ? HUD.warning
                          : HUD.danger,
                      }]}>{romResult.ml_status}</Text>
                      <Text style={styles.resultStatLabel}>STATUS</Text>
                    </View>
                  </View>
                  <Text style={styles.resultMsg} numberOfLines={3}>{romResult.message}</Text>
                </View>
              )}

              {scanState === 'error' && (
                <View style={styles.errorBox}>
                  <Ionicons name="warning-outline" size={13} color={HUD.danger} />
                  <Text style={styles.errorText}>SCAN FAILED — TRY AGAIN</Text>
                </View>
              )}

              {/* Action button */}
              {(scanState === 'idle' || scanState === 'error') && permission?.granted && (
                <TouchableOpacity style={styles.primaryBtn} onPress={handleStartRecording} activeOpacity={0.8}>
                  <View style={styles.primaryBtnAccentTL} />
                  <View style={styles.primaryBtnAccentBR} />
                  <Text style={styles.primaryBtnText}>START 5s SCAN →</Text>
                </TouchableOpacity>
              )}

              {scanState === 'result' && (
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setModalStep(2)} activeOpacity={0.8}>
                  <View style={styles.primaryBtnAccentTL} />
                  <View style={styles.primaryBtnAccentBR} />
                  <Text style={styles.primaryBtnText}>NEXT →</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.ghostBtn} onPress={handleClose} activeOpacity={0.7}>
                <Text style={styles.ghostBtnText}>CANCEL</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Step 2 — Daily diagnostic check-in */}
          {modalStep === 2 && (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.checkinScroll}
              keyboardShouldPersistTaps="handled"
            >
              <PainCheckin onComplete={handleRehabCheckDone} />

              <TouchableOpacity style={[styles.ghostBtn, { marginTop: 8 }]} onPress={() => setModalStep(1)} activeOpacity={0.7}>
                <Text style={styles.ghostBtnText}>← BACK TO ROM SCAN</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HUD.bg },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  headerAccentLine: { height: 1, backgroundColor: HUD.cyan, opacity: 0.3, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: {
    fontFamily: HUD.mono,
    fontSize: 18,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 3,
  },
  subtitle: { fontFamily: HUD.mono, fontSize: 9, color: HUD.muted, letterSpacing: 1.5, marginTop: 2 },
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

  list: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 24, justifyContent: 'center' },
  loadingText: { fontFamily: HUD.mono, fontSize: 9, color: HUD.muted, letterSpacing: 1.5 },
  emptyRow: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontFamily: HUD.mono, fontSize: 9, color: HUD.muted, letterSpacing: 1.5 },
  section: { marginBottom: 4 },
  divider: { height: 1, backgroundColor: HUD.cyan, opacity: 0.08, marginVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },

  dayBubbleCol: { width: 54, alignItems: 'center', marginRight: 10, paddingTop: 2 },
  dayBubble: {
    width: 50,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: HUD.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HUD.cardBg,
  },
  dayAbbr: { fontFamily: HUD.mono, fontSize: 9, color: HUD.muted, letterSpacing: 1 },
  dayNum: { fontFamily: HUD.mono, fontSize: 20, fontWeight: '700', color: HUD.cyan, lineHeight: 24 },
  dayMonth: { fontFamily: HUD.mono, fontSize: 8, color: HUD.muted, marginTop: 1, letterSpacing: 0.5 },

  exerciseCol: { flex: 1, gap: 6 },

  // ── Rehab Check card ──
  rehabCard: {
    backgroundColor: `${HUD.cyan}10`,
    borderWidth: 1,
    borderColor: `${HUD.cyan}40`,
    borderRadius: 4,
    padding: 10,
    overflow: 'hidden',
  },
  cH: { position: 'absolute', width: 12, height: 1.5, backgroundColor: HUD.cyan, opacity: 0.9 },
  cV: { position: 'absolute', width: 1.5, height: 12, backgroundColor: HUD.cyan, opacity: 0.9 },
  rehabCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rehabIconBox: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: `${HUD.cyan}50`,
    backgroundColor: `${HUD.cyan}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rehabCardName: {
    flex: 1,
    fontFamily: HUD.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 2,
  },
  rehabBadge: {
    borderWidth: 1,
    borderColor: `${HUD.cyan}50`,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: `${HUD.cyan}15`,
  },
  rehabBadgeText: {
    fontFamily: HUD.mono,
    fontSize: 8,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 1.5,
  },

  // ── Regular exercise card ──
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    minHeight: 44,
    overflow: 'hidden',
  },
  accentBar: { width: 3, alignSelf: 'stretch' },
  exerciseName: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: HUD.mono,
    fontSize: 11,
    fontWeight: '600',
    color: HUD.text,
    letterSpacing: 1.5,
  },
  exerciseMeta: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1,
    marginRight: 8,
  },
  playBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  // ── Modals ──
  modalSafe: { flex: 1, backgroundColor: HUD.bg, padding: 16 },
  modalHeader: { marginBottom: 24 },
  modalHeaderLine: { height: 1, backgroundColor: HUD.cyan, opacity: 0.3, marginBottom: 12 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: {
    fontFamily: HUD.mono,
    fontSize: 18,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 3,
  },
  modalSubtitle: { fontFamily: HUD.mono, fontSize: 9, color: HUD.muted, letterSpacing: 1.5, marginTop: 2 },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepIndicator: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  stepDot: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: HUD.border,
  },
  stepDotActive: {
    backgroundColor: HUD.cyan,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: HUD.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinScroll: {
    paddingBottom: 40,
  },

  cameraPreview: {
    flex: 1,
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  cameraHint: {
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.muted,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 18,
  },
  recordingOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    alignItems: 'center',
    gap: 6,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: HUD.danger,
  },
  recCountdown: {
    fontFamily: HUD.mono,
    fontSize: 32,
    fontWeight: '700',
    color: HUD.text,
    letterSpacing: 2,
  },
  recBarBg: {
    height: 3,
    width: '100%',
    backgroundColor: `${HUD.cyan}30`,
    borderRadius: 2,
  },
  recBarFill: {
    height: 3,
    backgroundColor: HUD.danger,
    borderRadius: 2,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: `${HUD.bg}cc`,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadText: {
    fontFamily: HUD.mono,
    fontSize: 12,
    color: HUD.cyan,
    letterSpacing: 2,
  },
  resultCard: {
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: `${HUD.cyan}30`,
    borderRadius: 4,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  resultStatVal: {
    fontFamily: HUD.mono,
    fontSize: 18,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 1,
  },
  resultStatLabel: {
    fontFamily: HUD.mono,
    fontSize: 7,
    color: HUD.muted,
    letterSpacing: 1.5,
  },
  resultDivider: {
    width: 1,
    height: 32,
    backgroundColor: HUD.border,
  },
  resultMsg: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 0.5,
    lineHeight: 14,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${HUD.danger}12`,
    borderWidth: 1,
    borderColor: `${HUD.danger}40`,
    borderRadius: 4,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: HUD.mono,
    fontSize: 10,
    color: HUD.danger,
    letterSpacing: 0.5,
  },

  cornerH: { position: 'absolute', width: 18, height: 1.5, backgroundColor: HUD.cyan, opacity: 0.7 },
  cornerV: { position: 'absolute', width: 1.5, height: 18, backgroundColor: HUD.cyan, opacity: 0.7 },

  primaryBtn: {
    borderWidth: 1,
    borderColor: HUD.cyan,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: `${HUD.cyan}18`,
    overflow: 'hidden',
    marginBottom: 10,
  },
  primaryBtnAccentTL: { position: 'absolute', top: 0, left: 0, width: 16, height: 1.5, backgroundColor: HUD.cyan, opacity: 0.8 },
  primaryBtnAccentBR: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 1.5, backgroundColor: HUD.cyan, opacity: 0.8 },
  primaryBtnText: { fontFamily: HUD.mono, color: HUD.cyan, fontSize: 13, fontWeight: '700', letterSpacing: 2 },

  ghostBtn: { paddingVertical: 12, alignItems: 'center' },
  ghostBtnText: { fontFamily: HUD.mono, fontSize: 10, color: HUD.muted, letterSpacing: 2 },
});
