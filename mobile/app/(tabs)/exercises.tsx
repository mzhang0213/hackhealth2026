import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HUD } from '@/constants/hud-theme';

// ── Types ─────────────────────────────────────────────────────────────────────

type Exercise = {
  id: string;
  name: string;
  accentColor: string;
  isRehab?: boolean;
};

type DaySection = {
  dayAbbr: string;
  dayNum: string;
  month: string;
  exercises: Exercise[];
};

// ── Sample data ───────────────────────────────────────────────────────────────

const SECTIONS: DaySection[] = [
  {
    dayAbbr: 'Tue',
    dayNum: '17',
    month: 'Mar',
    exercises: [
      { id: '1', name: 'Quad Sets', accentColor: HUD.danger },
      { id: '2', name: 'Heel Slides', accentColor: HUD.success },
      { id: '3', name: 'Compound Stretches', accentColor: HUD.warning },
      { id: '4', name: 'Rehab Check', accentColor: HUD.cyan, isRehab: true },
    ],
  },
  {
    dayAbbr: 'Wed',
    dayNum: '18',
    month: 'Mar',
    exercises: [
      { id: '5', name: 'Straight Leg Raises', accentColor: HUD.danger },
      { id: '6', name: 'Step-Ups', accentColor: HUD.cyan },
    ],
  },
  {
    dayAbbr: 'Thu',
    dayNum: '19',
    month: 'Mar',
    exercises: [
      { id: '7', name: 'Hip Abduction', accentColor: HUD.success },
      { id: '8', name: 'Calf Raises', accentColor: HUD.warning },
    ],
  },
  {
    dayAbbr: 'Fri',
    dayNum: '20',
    month: 'Mar',
    exercises: [
      { id: '9', name: 'Balance Board', accentColor: HUD.danger },
      { id: '10', name: 'PWC Event', accentColor: HUD.cyan },
    ],
  },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ExercisesScreen() {
  const [cameraModal, setCameraModal] = useState(false);
  const [videoModal, setVideoModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  function handleExercisePress(ex: Exercise, isRehab: boolean | undefined) {
    setSelectedExercise(ex);
    if (isRehab) {
      setCameraModal(true);
    } else {
      setVideoModal(true);
    }
  }

  function handleClose() {
    setCameraModal(false);
    setVideoModal(false);
    setSelectedExercise(null);
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
        {SECTIONS.map((section, si) => (
          <View key={si} style={styles.section}>
            <View style={styles.row}>
              {/* Date bubble */}
              <View style={styles.dayBubbleCol}>
                <View style={styles.dayBubble}>
                  <Text style={styles.dayAbbr}>{section.dayAbbr.toUpperCase()}</Text>
                  <Text style={styles.dayNum}>{section.dayNum}</Text>
                  <Text style={styles.dayMonth}>{section.month.toUpperCase()}</Text>
                </View>
              </View>

              {/* Exercise cards */}
              <View style={styles.exerciseCol}>
                {section.exercises.map((ex) => (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.exerciseCard, ex.isRehab && styles.rehabCard]}
                    onPress={() => handleExercisePress(ex, ex.isRehab)}
                    activeOpacity={0.75}
                  >
                    {/* Left accent bar */}
                    <View style={[styles.accentBar, { backgroundColor: ex.accentColor }]} />

                    <Text style={[styles.exerciseName, ex.isRehab && styles.rehabName]}>
                      {ex.name.toUpperCase()}
                    </Text>

                    <Ionicons
                      name={ex.isRehab ? 'scan-outline' : 'play-circle-outline'}
                      size={16}
                      color={ex.isRehab ? '#fff' : ex.accentColor}
                      style={styles.exerciseIcon}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Section divider */}
            {si < SECTIONS.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </ScrollView>

      {/* Camera / ROM modal */}
      <Modal visible={cameraModal} animationType="slide" onRequestClose={handleClose}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLine} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>ROM ANALYSIS</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedExercise?.name.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
                <Ionicons name="close-outline" size={20} color={HUD.muted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cameraPreview}>
            {/* Corner accents */}
            <View style={[styles.cornerH, { top: 0, left: 0 }]} />
            <View style={[styles.cornerV, { top: 0, left: 0 }]} />
            <View style={[styles.cornerH, { bottom: 0, right: 0 }]} />
            <View style={[styles.cornerV, { bottom: 0, right: 0 }]} />

            <Ionicons name="scan-outline" size={48} color={`${HUD.cyan}50`} />
            <Text style={styles.cameraHint}>
              OPEN CAMERA{'\n'}USE VISUALS LIKE APPLE FACE ID SETUP
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleClose} activeOpacity={0.8}>
            <View style={styles.primaryBtnAccentTL} />
            <View style={styles.primaryBtnAccentBR} />
            <Text style={styles.primaryBtnText}>NEXT →</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtn} onPress={handleClose} activeOpacity={0.7}>
            <Text style={styles.ghostBtnText}>CANCEL</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* Video example modal */}
      <Modal visible={videoModal} animationType="slide" onRequestClose={handleClose}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLine} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>EXERCISE DEMO</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedExercise?.name.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
                <Ionicons name="close-outline" size={20} color={HUD.muted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.videoPlaceholder}>
            <View style={[styles.cornerH, { top: 0, left: 0 }]} />
            <View style={[styles.cornerV, { top: 0, left: 0 }]} />
            <View style={[styles.cornerH, { bottom: 0, right: 0 }]} />
            <View style={[styles.cornerV, { bottom: 0, right: 0 }]} />

            <Ionicons name="play-circle-outline" size={56} color={`${HUD.cyan}50`} />
            <Text style={styles.videoPlaceholderText}>VIDEO EXERCISE EXAMPLE</Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleClose} activeOpacity={0.8}>
            <View style={styles.primaryBtnAccentTL} />
            <View style={styles.primaryBtnAccentBR} />
            <Text style={styles.primaryBtnText}>DONE</Text>
          </TouchableOpacity>
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

  list: { paddingHorizontal: 16, paddingBottom: 32 },
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
  rehabCard: {
    backgroundColor: `${HUD.cyan}18`,
    borderColor: `${HUD.cyan}50`,
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
  rehabName: { color: HUD.cyan },
  exerciseIcon: { marginRight: 12 },

  // Modals
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
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: HUD.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraPreview: {
    flex: 1,
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
    overflow: 'hidden',
  },
  cameraHint: {
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.muted,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 18,
  },

  videoPlaceholder: {
    flex: 1,
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
    overflow: 'hidden',
  },
  videoPlaceholderText: {
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.muted,
    letterSpacing: 1.5,
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
