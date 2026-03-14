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
  dayAbbr: string;  // e.g. "Tue"
  dayNum: string;   // e.g. "21"
  month: string;    // e.g. "Mar"
  exercises: Exercise[];
};

// ── Sample data ───────────────────────────────────────────────────────────────

const SECTIONS: DaySection[] = [
  {
    dayAbbr: 'Tue',
    dayNum: '17',
    month: 'Mar',
    exercises: [
      { id: '1', name: 'Quad Sets', accentColor: '#e74c3c' },
      { id: '2', name: 'Heel Slides', accentColor: '#2ecc71' },
      { id: '3', name: 'Compound Stretches', accentColor: '#f39c12' },
      { id: '4', name: 'Rehab Check', accentColor: '#0a7ea4', isRehab: true },
    ],
  },
  {
    dayAbbr: 'Wed',
    dayNum: '18',
    month: 'Mar',
    exercises: [
      { id: '5', name: 'Straight Leg Raises', accentColor: '#e74c3c' },
      { id: '6', name: 'Step-Ups', accentColor: '#9b59b6' },
    ],
  },
  {
    dayAbbr: 'Thu',
    dayNum: '19',
    month: 'Mar',
    exercises: [
      { id: '7', name: 'Hip Abduction', accentColor: '#2ecc71' },
      { id: '8', name: 'Calf Raises', accentColor: '#f39c12' },
    ],
  },
  {
    dayAbbr: 'Fri',
    dayNum: '20',
    month: 'Mar',
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

  function handleExercisePress(ex: Exercise, isRehab: boolean | undefined) {
    setSelectedExercise(ex);
    if (isRehab) {
      setCameraModal(true);
    } else {
      setVideoModal(true);
    }
  }

  // function handleCameraNext() {
  //   setCameraModal(false);
  //   setVideoModal(true);
  // }

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
            {/* Left: date bubble | Right: exercise stack */}
            <View style={styles.row}>
              <View style={styles.dayBubbleCol}>
                <View style={styles.dayBubble}>
                  <Text style={styles.dayAbbr}>{section.dayAbbr}</Text>
                  <Text style={styles.dayNum}>{section.dayNum}</Text>
                  <Text style={styles.dayMonth}>{section.month}</Text>
                </View>
              </View>

              <View style={styles.exerciseCol}>
                {section.exercises.map((ex) => (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.exerciseCard, ex.isRehab && styles.rehabCard]}
                    onPress={() => handleExercisePress(ex, ex.isRehab)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.accentBar, { backgroundColor: ex.accentColor }]} />
                    <Text style={[styles.exerciseName, ex.isRehab && styles.rehabName]}>
                      {ex.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Camera modal */}
      <Modal visible={cameraModal} animationType="slide" onRequestClose={handleClose}>
        <View style={styles.cameraScreen}>
          <Text style={styles.cameraTitle}>{selectedExercise?.name}</Text>
          <View style={styles.cameraPreview}>
            <Text style={styles.cameraHint}>open camera{'\n'}use visuals like apple face id setup</Text>
          </View>
          <TouchableOpacity style={styles.nextButton} onPress={handleClose}> {/*<<< THIS IS TEMP RIGHT HERE <<<*/}
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
  list: { paddingHorizontal: 16, paddingBottom: 32 },

  section: { marginBottom: 12 },

  row: { flexDirection: 'row', alignItems: 'flex-start' },

  dayBubbleCol: { width: 52, alignItems: 'center', marginRight: 10, paddingTop: 2 },
  dayBubble: {
    width: 50,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#C5CDD3',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  exerciseCol: { flex: 1, gap: 6 },
  dayAbbr: { fontSize: 11, fontWeight: '600', color: '#687076', letterSpacing: 0.3 },
  dayNum: { fontSize: 18, fontWeight: '700', color: '#11181C', lineHeight: 22 },
  dayMonth: { fontSize: 10, fontWeight: '400', color: '#9BA1A6', marginTop: 1 },

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
