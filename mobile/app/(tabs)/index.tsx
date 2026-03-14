import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { BODY_DIAGRAM_KEY, type MarkedPart } from '@/constants/body-store';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const [bodyParts, setBodyParts] = useState<Record<string, MarkedPart>>({});

  useEffect(() => {
    AsyncStorage.getItem(BODY_DIAGRAM_KEY).then((raw) => {
      if (raw) setBodyParts(JSON.parse(raw));
    });
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="title" style={styles.heading}>HackHealth 2026</ThemedText>

        {/* Body Map card */}
        <TouchableOpacity
          style={[styles.mapCard, { backgroundColor: isDark ? '#1e2122' : '#f5f5f5' }]}
          onPress={() => router.push('/body-diagram')}
          activeOpacity={0.8}
        >
          <View style={styles.mapCardHeader}>
            <ThemedText type="defaultSemiBold" style={styles.mapCardTitle}>Body Map</ThemedText>
            <ThemedText style={[styles.mapCardChevron, { color: colors.icon }]}>›</ThemedText>
          </View>
          {Object.keys(bodyParts).length > 0 ? (
            <View style={styles.statusDots}>
              {Object.values(bodyParts).slice(0, 6).map((p, i) => (
                <View
                  key={i}
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        p.status === 'pain' ? '#EF4444'
                        : p.status === 'moderate' ? '#F59E0B'
                        : '#22C55E',
                    },
                  ]}
                />
              ))}
              {Object.keys(bodyParts).length > 6 && (
                <ThemedText style={[styles.moreText, { color: colors.icon }]}>
                  +{Object.keys(bodyParts).length - 6} more
                </ThemedText>
              )}
            </View>
          ) : (
            <ThemedText style={[styles.mapCardSubtitle, { color: colors.icon }]}>
              Tap to mark injured areas
            </ThemedText>
          )}
        </TouchableOpacity>

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 48,
  },
  heading: {
    marginBottom: 32,
  },
  mapCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  mapCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mapCardTitle: { fontSize: 16 },
  mapCardChevron: { fontSize: 22 },
  mapCardSubtitle: { fontSize: 13 },
  statusDots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  moreText: { fontSize: 12, marginLeft: 2 },
});
