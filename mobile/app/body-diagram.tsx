import AsyncStorage from '@react-native-async-storage/async-storage';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

export const BODY_DIAGRAM_KEY = 'body_diagram';

export type InjuryStatus = 'pain' | 'moderate' | 'recovering';

export type MarkedPart = {
  slug: Slug;
  side?: 'left' | 'right';
  status: InjuryStatus;
};

type ToolMode = InjuryStatus | 'clear';

const STATUS_COLORS: Record<InjuryStatus, string> = {
  pain: '#EF4444',       // red
  moderate: '#F59E0B',   // yellow/amber
  recovering: '#22C55E', // green
};

const TOOL_LABELS: Record<ToolMode, string> = {
  pain: 'Pain',
  moderate: 'Moderate',
  recovering: 'Recovering',
  clear: 'Clear',
};

function makeKey(slug: Slug, side?: 'left' | 'right') {
  return side ? `${slug}-${side}` : slug;
}

export default function BodyDiagramScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const [view, setView] = useState<'front' | 'back'>('front');
  const [activeTool, setActiveTool] = useState<ToolMode>('pain');
  const [markedParts, setMarkedParts] = useState<Record<string, MarkedPart>>({});

  // Load saved data
  useEffect(() => {
    AsyncStorage.getItem(BODY_DIAGRAM_KEY).then((raw) => {
      if (raw) setMarkedParts(JSON.parse(raw));
    });
  }, []);

  // Persist on change
  useEffect(() => {
    AsyncStorage.setItem(BODY_DIAGRAM_KEY, JSON.stringify(markedParts));
  }, [markedParts]);

  function handleBodyPartPress(part: ExtendedBodyPart, side?: 'left' | 'right') {
    if (!part.slug) return;
    const key = makeKey(part.slug, side);

    setMarkedParts((prev) => {
      const next = { ...prev };
      if (activeTool === 'clear') {
        delete next[key];
      } else {
        next[key] = { slug: part.slug!, side, status: activeTool };
      }
      return next;
    });
  }

  function handleClearAll() {
    Alert.alert('Clear All', 'Remove all marked body parts?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => setMarkedParts({}),
      },
    ]);
  }

  // Build data array for the Body component
  const bodyData: ExtendedBodyPart[] = Object.values(markedParts).map((p) => ({
    slug: p.slug,
    side: p.side,
    color: STATUS_COLORS[p.status],
    intensity: 1,
  }));

  const markedCount = Object.keys(markedParts).length;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText type="title" style={styles.heading}>Body Map</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
          Tap a body part to mark its status. {markedCount > 0 ? `${markedCount} area${markedCount > 1 ? 's' : ''} marked.` : ''}
        </ThemedText>

        {/* Tool selector */}
        <View style={styles.toolRow}>
          {(['pain', 'moderate', 'recovering', 'clear'] as ToolMode[]).map((tool) => {
            const isActive = activeTool === tool;
            const dotColor = tool === 'clear' ? colors.icon : STATUS_COLORS[tool as InjuryStatus];
            return (
              <TouchableOpacity
                key={tool}
                style={[
                  styles.toolChip,
                  {
                    backgroundColor: isActive
                      ? (tool === 'clear' ? colors.icon : STATUS_COLORS[tool as InjuryStatus])
                      : (isDark ? '#2a2a2a' : '#f0f0f0'),
                    borderColor: dotColor,
                    borderWidth: 1.5,
                  },
                ]}
                onPress={() => setActiveTool(tool)}
                activeOpacity={0.7}
              >
                {!isActive && tool !== 'clear' && (
                  <View style={[styles.dot, { backgroundColor: dotColor }]} />
                )}
                <ThemedText
                  style={[
                    styles.toolLabel,
                    isActive && styles.toolLabelActive,
                  ]}
                >
                  {TOOL_LABELS[tool]}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Front / Back toggle */}
        <View style={[styles.toggleRow, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
          {(['front', 'back'] as const).map((v) => (
            <TouchableOpacity
              key={v}
              style={[
                styles.toggleBtn,
                view === v && { backgroundColor: colors.tint },
              ]}
              onPress={() => setView(v)}
              activeOpacity={0.8}
            >
              <ThemedText
                style={[
                  styles.toggleLabel,
                  view === v && styles.toggleLabelActive,
                ]}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Body diagram */}
        <View style={styles.bodyContainer}>
          <Body
            data={bodyData}
            side={view}
            scale={1.1}
            gender="male"
            onBodyPartPress={handleBodyPartPress}
            defaultFill={isDark ? '#3a3a3a' : '#d0d0d0'}
            border={isDark ? '#555' : '#bbb'}
          />
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {(Object.entries(STATUS_COLORS) as [InjuryStatus, string][]).map(([status, color]) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <ThemedText style={styles.legendLabel}>
                {TOOL_LABELS[status]}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Marked parts list */}
        {markedCount > 0 && (
          <View style={styles.partsList}>
            <ThemedText type="defaultSemiBold" style={styles.partsHeader}>Marked Areas</ThemedText>
            {Object.values(markedParts).map((p) => {
              const key = makeKey(p.slug, p.side);
              return (
                <View key={key} style={[styles.partRow, { borderBottomColor: isDark ? '#333' : '#eee' }]}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[p.status] }]} />
                  <ThemedText style={styles.partName}>
                    {p.slug}{p.side ? ` (${p.side})` : ''}
                  </ThemedText>
                  <ThemedText style={[styles.partStatus, { color: STATUS_COLORS[p.status] }]}>
                    {TOOL_LABELS[p.status]}
                  </ThemedText>
                </View>
              );
            })}
            <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtn}>
              <ThemedText style={[styles.clearAllText, { color: '#EF4444' }]}>Clear All</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: 60, paddingBottom: 48 },
  heading: { marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },

  // Tools
  toolRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toolLabel: { fontSize: 13, fontWeight: '500' },
  toolLabelActive: { color: '#fff' },

  // Front/back toggle
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
    alignSelf: 'center',
    width: 200,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleLabel: { fontSize: 14, fontWeight: '500', opacity: 0.5 },
  toggleLabelActive: { color: '#fff', opacity: 1 },

  // Body
  bodyContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 13, opacity: 0.8 },

  // Parts list
  partsList: { marginTop: 4 },
  partsHeader: { marginBottom: 12, fontSize: 16 },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  partName: { flex: 1, fontSize: 15, textTransform: 'capitalize' },
  partStatus: { fontSize: 13, fontWeight: '500' },
  clearAllBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  clearAllText: { fontSize: 14, fontWeight: '500' },
});
