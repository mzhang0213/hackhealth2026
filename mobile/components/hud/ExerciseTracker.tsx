import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { HUD } from '@/constants/hud-theme';
import { api, type ExerciseItem } from '@/constants/api';
import { useUser } from '@/context/UserContext';

type Category = 'stretch' | 'strength' | 'mobility';

function catColor(cat: Category): string {
  switch (cat) {
    case 'mobility': return HUD.cyan;
    case 'strength': return HUD.success;
    case 'stretch':  return HUD.warning;
  }
}

function catIcon(cat: Category): keyof typeof Ionicons.glyphMap {
  switch (cat) {
    case 'mobility': return 'time-outline';
    case 'strength': return 'barbell-outline';
    case 'stretch':  return 'body-outline';
  }
}

export default function ExerciseTracker() {
  const { user } = useUser();
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api.getTodayExercises(user.id)
      .then(setExercises)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  async function toggle(id: string) {
    if (!user) return;
    // Optimistic update
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e)),
    );
    try {
      const res = await api.toggleExercise(user.id, id);
      setExercises((prev) =>
        prev.map((e) => (e.id === id ? { ...e, completed: res.completed } : e)),
      );
    } catch {
      // Revert on error
      setExercises((prev) =>
        prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e)),
      );
    }
  }

  const total = exercises.length;
  const doneCount = exercises.filter((e) => e.completed).length;
  const allDone = total > 0 && doneCount === total;
  const activeColor = allDone ? HUD.success : HUD.cyan;

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={HUD.cyan} />
        <Text style={styles.loadingText}>LOADING PROTOCOL...</Text>
      </View>
    );
  }

  if (exercises.length === 0) {
    return (
      <View style={styles.emptyRow}>
        <Text style={styles.emptyText}>NO EXERCISES SCHEDULED TODAY</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Daily exercise guide label */}
      <Text style={styles.dailyLabel}>DAILY EXERCISE GUIDE</Text>

      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.progressLabel}>PROTOCOL.PROGRESS</Text>
        <Text style={[styles.counterText, allDone && styles.counterTextDone]}>
          {doneCount}/{total} COMPLETE
        </Text>
      </View>

      {/* Segmented progress bar */}
      <View style={styles.segmentRow}>
        {exercises.map((e) => (
          <View
            key={e.id}
            style={[
              styles.segment,
              {
                backgroundColor: e.completed ? activeColor : `${activeColor}18`,
                borderColor: e.completed ? activeColor : HUD.border,
                ...(e.completed && Platform.OS === 'ios'
                  ? {
                      shadowColor: activeColor,
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
          const borderStyle = ex.completed
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
              <Text style={[styles.index, { color: HUD.muted }]}>
                {String(idx + 1).padStart(2, '0')}
              </Text>

              <View style={[styles.catIcon, { borderColor: `${color}40`, backgroundColor: `${color}12` }]}>
                <Ionicons name={catIcon(ex.cat)} size={13} color={color} />
              </View>

              <View style={styles.nameCol}>
                <Text
                  style={[
                    styles.exName,
                    ex.completed && styles.doneName,
                    ex.completed && { color: HUD.muted },
                  ]}
                >
                  {ex.name}
                </Text>
                <Text style={styles.setsReps}>
                  {ex.sets}×{ex.duration ?? ex.reps}
                </Text>
              </View>

              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: ex.completed ? color : 'transparent',
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  loadingText: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1.5,
  },
  emptyRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1.5,
  },
  dailyLabel: {
    fontFamily: HUD.mono,
    fontSize: 11,
    fontWeight: '700',
    color: HUD.text,
    letterSpacing: 2,
    marginBottom: 10,
  },
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
  counterTextDone: {
    color: HUD.success,
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
