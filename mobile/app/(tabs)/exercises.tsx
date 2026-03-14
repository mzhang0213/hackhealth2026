import React, { useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ── Types ─────────────────────────────────────────────────────────────────────

type Exercise = {
  id: string;
  name: string;
  accentColor: string;
  isRehab?: boolean;
};

type DaySection = {
  dayLetter: string;
  date: string; // e.g. "Mar 17"
  event?: string; // optional holiday / event label
  exercises: Exercise[];
};

// ── Sample data ───────────────────────────────────────────────────────────────

const SECTIONS: DaySection[] = [
  {
    dayLetter: 'T',
    date: 'Mar 17',
    event: "St. Patrick's Day",
    exercises: [
      { id: '1', name: 'Quad Sets', accentColor: '#e74c3c' },
      { id: '2', name: 'Heel Slides', accentColor: '#2ecc71' },
      { id: '3', name: 'Compound Stretches', accentColor: '#f39c12' },
      { id: '4', name: 'Rehab Check', accentColor: '#0a7ea4', isRehab: true },
    ],
  },
  {
    dayLetter: 'W',
    date: 'Mar 18',
    exercises: [
      { id: '5', name: 'Straight Leg Raises', accentColor: '#e74c3c' },
      { id: '6', name: 'Step-Ups', accentColor: '#9b59b6' },
    ],
  },
  {
    dayLetter: 'T',
    date: 'Mar 19',
    exercises: [
      { id: '7', name: 'Hip Abduction', accentColor: '#2ecc71' },
      { id: '8', name: 'Calf Raises', accentColor: '#f39c12' },
    ],
  },
  {
    dayLetter: 'F',
    date: 'Mar 20',
    exercises: [
      { id: '9', name: 'Balance Board', accentColor: '#e74c3c' },
      { id: '10', name: 'pwc event', accentColor: '#9b59b6' },
    ],
  },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ExercisesScreen() {
  const [cameraModal, setCameraModal] = useState(false);
  const [videoModal, setVideoModal] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  function handleExercisePress(ex: Exercise) {
    setSelectedExercise(ex);
    setCameraModal(true);
  }

  function handleCameraNext() {
    setCameraModal(false);
    setVideoModal(true);
  }

  function handleClose() {
    setCameraModal(false);
    setVideoModal(false);
    setSelectedExercise(null);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Title */}
      <Text style={styles.title}>My Exercises</Text>

      <ScrollView contentContainerStyle={styles.list}>
        {SECTIONS.map((section, si) => (
          <View key={si} style={styles.section}>
            {/* Event banner */}
            {section.event && (
              <View style={styles.eventBanner}>
                <Text style={styles.eventBannerText}>{section.event}</Text>
              </View>
            )}

            {/* Day rows */}
            {section.exercises.map((ex, ei) => (
              <View key={ex.id} style={styles.row}>
                {/* Day bubble — only on first exercise of section */}
                <View style={styles.dayBubbleCol}>
                  {ei === 0 ? (
                    <View style={styles.dayBubble}>
                      <Text style={styles.dayLetter}>{section.dayLetter}</Text>
                    </View>
                  ) : (
                    <View style={styles.dayBubbleSpacer} />
                  )}
                </View>

                {/* Exercise card */}
                <TouchableOpacity
                  style={[styles.exerciseCard, ex.isRehab && styles.rehabCard]}
                  onPress={() => handleExercisePress(ex)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.accentBar, { backgroundColor: ex.accentColor }]} />
                  <Text style={[styles.exerciseName, ex.isRehab && styles.rehabName]}>
                    {ex.name}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Camera modal */}
      <Modal visible={cameraModal} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.cameraScreen}>
          <Text style={styles.cameraTitle}>{selectedExercise?.name}</Text>
          <View style={styles.cameraPreview}>
            <Text style={styles.cameraHint}>open camera{'\n'}use visuals like apple face id setup</Text>
          </View>
          <TouchableOpacity style={styles.nextButton} onPress={handleCameraNext}>
            <Text style={styles.nextButtonText}>Next →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Video example modal */}
      <Modal visible={videoModal} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.videoScreen}>
          <Text style={styles.videoTitle}>{selectedExercise?.name}</Text>
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoPlaceholderText}>video exercise example</Text>
          </View>
          <TouchableOpacity style={styles.nextButton} onPress={handleClose}>
            <Text style={styles.nextButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#11181C',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  list: { paddingHorizontal: 16, paddingBottom: 100 },

  section: { marginBottom: 4 },

  eventBanner: {
    backgroundColor: '#2a9d7c',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginLeft: 44,
    marginBottom: 4,
    marginTop: 8,
  },
  eventBannerText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },

  dayBubbleCol: { width: 36, alignItems: 'center', marginRight: 8 },
  dayBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#C5CDD3',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  dayBubbleSpacer: { width: 32, height: 32 },
  dayLetter: { fontSize: 14, fontWeight: '600', color: '#11181C' },

  exerciseCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    minHeight: 44,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  rehabCard: { backgroundColor: '#0a7ea4' },
  accentBar: { width: 5, alignSelf: 'stretch' },
  exerciseName: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#11181C',
  },
  rehabName: { color: '#fff', fontWeight: '600' },

  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#11181C',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabIcon: { fontSize: 28, color: '#fff', lineHeight: 32 },

  // Camera modal
  cameraScreen: {
    flex: 1,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  cameraTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 32 },
  cameraPreview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginBottom: 32,
  },
  cameraHint: { color: '#fff', fontSize: 16, textAlign: 'center', lineHeight: 24 },

  // Video modal
  videoScreen: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  videoTitle: { fontSize: 22, fontWeight: '700', color: '#11181C', marginBottom: 32 },
  videoPlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    backgroundColor: '#e0e5ea',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  videoPlaceholderText: { fontSize: 15, color: '#687076' },

  nextButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  nextButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeButton: { paddingVertical: 10 },
  closeButtonText: { color: '#687076', fontSize: 15 },
});
