import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { INJURY_PROFILE_KEY, type InjuryProfile } from '@/constants/injury-store';
import { BODY_DIAGRAM_KEY, type MarkedPart } from '@/constants/body-store';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';
  const [profile, setProfile] = useState<InjuryProfile | null>(null);
  const [bodyParts, setBodyParts] = useState<Record<string, MarkedPart>>({});

  useEffect(() => {
    AsyncStorage.getItem(INJURY_PROFILE_KEY).then((raw) => {
      if (raw) setProfile(JSON.parse(raw));
    });
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

        {profile ? (
          <ThemedView style={[styles.card, { borderColor: colors.tint, borderWidth: 1 }]}>
            <ThemedText type="defaultSemiBold" style={styles.cardTitle}>Your Injury Profile</ThemedText>
            <Row label="Sport / Activity" value={profile.sportActivity} />
            <Row label="Date of Injury" value={profile.dateOfInjury} />
            <Row label="How it happened" value={profile.howItHappened} />
            {profile.doctorDiagnosis ? <Row label="Diagnosis" value={profile.doctorDiagnosis} /> : null}
            {profile.initialSymptoms ? <Row label="Symptoms" value={profile.initialSymptoms} /> : null}
            <TouchableOpacity
              style={[styles.editButton, { borderColor: colors.tint }]}
              onPress={() => router.push('/injury-report')}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.editButtonText, { color: colors.tint }]}>Edit Profile</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        ) : (
          <ThemedView style={styles.emptyState}>
            <ThemedText style={styles.emptyText}>
              Get started by setting up your injury profile.
            </ThemedText>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.tint }]}
              onPress={() => router.push('/injury-report')}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.primaryButtonText}>Set Up Injury Profile</ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView style={styles.row}>
      <ThemedText type="defaultSemiBold" style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText style={styles.rowValue}>{value}</ThemedText>
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
  emptyState: {
    gap: 20,
  },
  emptyText: {
    opacity: 0.6,
    lineHeight: 22,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  card: {
    borderRadius: 14,
    padding: 18,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    marginBottom: 4,
  },
  row: {
    gap: 2,
    backgroundColor: 'transparent',
  },
  rowLabel: {
    fontSize: 12,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  editButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
