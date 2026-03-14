import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HUD } from '@/constants/hud-theme';

type Category = 'stretch' | 'strength' | 'mobility';

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  duration?: string;
  done: boolean;
  cat: Category;
}

const INITIAL_EXERCISES: Exercise[] = [
  { id: '1', name: 'QUAD_STRETCH', sets: 3, reps: 30, duration: '30s', done: true, cat: 'stretch' },
  { id: '2', name: 'LEG_RAISES', sets: 3, reps: 15, done: true, cat: 'strength' },
  { id: '3', name: 'KNEE_FLEXION', sets: 3, reps: 20, done: false, cat: 'mobility' },
  { id: '4', name: 'WALL_SLIDES', sets: 2, reps: 12, done: false, cat: 'mobility' },
  { id: '5', name: 'CALF_RAISES', sets: 3, reps: 15, done: false, cat: 'strength' },
];

function catColor(cat: Category): string {
  switch (cat) {
    case 'mobility': return HUD.cyan;
    case 'strength': return HUD.success;
    case 'stretch': return HUD.warning;
  }
}

function catIcon(cat: Category): keyof typeof Ionicons.glyphMap {
  switch (cat) {
    case 'mobility': return 'time-outline';
    case 'strength': return 'barbell-outline';
    case 'stretch': return 'body-outline';
  }
}

export default function ExerciseTracker() {
  const [exercises, setExercises] = useState<Exercise[]>(INITIAL_EXERCISES);

  const total = exercises.length;
  const doneCount = exercises.filter((e) => e.done).length;

  function toggle(id: string) {
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, done: !e.done } : e)),
    );
  }

  return (
    <View>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.progressLabel}>PROTOCOL.PROGRESS</Text>
        <Text style={styles.counterText}>
          {doneCount}/{total} COMPLETE
        </Text>
      </View>

      {/* Segmented progress bar */}
      <View style={styles.segmentRow}>
        {exercises.map((e, i) => (
          <View
            key={e.id}
            style={[
              styles.segment,
              {
                backgroundColor: e.done ? HUD.cyan : 'rgba(0,212,255,0.1)',
                borderColor: e.done ? HUD.cyan : HUD.border,
                ...(e.done && Platform.OS === 'ios'
                  ? {
                      shadowColor: HUD.cyan,
                      shadowOffset: { width: 0, height: 0 },
                      shadowRadius: 4,
                      shadowOpacity: 0.7,
                    }
                  : {}),
              },
            ]}
          />
        ))}
      </View>

      {/* Exercise list */}
      <View style={styles.list}>
        {exercises.map((ex, idx) => {
          const color = catColor(ex.cat);
          const borderStyle = ex.done
            ? {
                borderColor: `${color}50`,
                ...(Platform.OS === 'ios'
                  ? {
                      shadowColor: color,
                      shadowOffset: { width: 0, height: 0 },
                      shadowRadius: 6,
                      shadowOpacity: 0.35,
                    }
                  : {}),
              }
            : { borderColor: HUD.border };

          return (
            <TouchableOpacity
              key={ex.id}
              onPress={() => toggle(ex.id)}
              activeOpacity={0.75}
              style={[styles.row, borderStyle]}
            >
              {/* Index */}
              <Text style={[styles.index, { color: HUD.muted }]}>
                {String(idx + 1).padStart(2, '0')}
              </Text>

              {/* Icon */}
              <View style={[styles.catIcon, { borderColor: `${color}40`, backgroundColor: `${color}12` }]}>
                <Ionicons name={catIcon(ex.cat)} size={13} color={color} />
              </View>

              {/* Name + sets */}
              <View style={styles.nameCol}>
                <Text
                  style={[
                    styles.exName,
                    ex.done && styles.doneName,
                    ex.done && { color: HUD.muted },
                  ]}
                >
                  {ex.name}
                </Text>
                <Text style={styles.setsReps}>
                  {ex.sets}×{ex.duration ?? ex.reps}
                </Text>
              </View>

              {/* Status dot */}
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: ex.done ? color : 'transparent',
                    borderColor: color,
                  },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1.5,
  },
  counterText: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.cyan,
    letterSpacing: 1,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 14,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    borderWidth: 0.5,
  },
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HUD.bg,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  index: {
    fontFamily: HUD.mono,
    fontSize: 10,
    width: 20,
  },
  catIcon: {
    width: 24,
    height: 24,
    borderRadius: 3,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameCol: {
    flex: 1,
    gap: 2,
  },
  exName: {
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.text,
    letterSpacing: 0.5,
  },
  doneName: {
    textDecorationLine: 'line-through',
  },
  setsReps: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 0.5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});
