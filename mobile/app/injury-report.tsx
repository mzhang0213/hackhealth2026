import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { INJURY_PROFILE_KEY, type InjuryProfile } from '@/constants/injury-store';

export default function InjuryReportScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [howItHappened, setHowItHappened] = useState('');
  const [sportActivity, setSportActivity] = useState('');
  const [dateOfInjury, setDateOfInjury] = useState('');
  const [doctorDiagnosis, setDoctorDiagnosis] = useState('');
  const [initialSymptoms, setInitialSymptoms] = useState('');
  const [saving, setSaving] = useState(false);

  const inputStyle = [
    styles.input,
    {
      color: colors.text,
      borderColor: colors.icon,
      backgroundColor: colorScheme === 'dark' ? '#1e2122' : '#f5f5f5',
    },
  ];

  async function handleSave() {
    if (!howItHappened.trim() || !sportActivity.trim() || !dateOfInjury.trim()) {
      Alert.alert('Missing info', 'Please fill in how the injury happened, sport/activity, and date.');
      return;
    }

    setSaving(true);
    try {
      const profile: InjuryProfile = {
        howItHappened: howItHappened.trim(),
        sportActivity: sportActivity.trim(),
        dateOfInjury: dateOfInjury.trim(),
        doctorDiagnosis: doctorDiagnosis.trim(),
        initialSymptoms: initialSymptoms.trim(),
        savedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(INJURY_PROFILE_KEY, JSON.stringify(profile));
      Alert.alert('Saved', 'Your injury profile has been saved.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title" style={styles.title}>Injury Profile</ThemedText>
          <ThemedText style={styles.subtitle}>
            Help us understand your injury so we can track your recovery.
          </ThemedText>

          <ThemedText type="defaultSemiBold" style={styles.label}>
            How did the injury happen? *
          </ThemedText>
          <TextInput
            style={[inputStyle, styles.multiline]}
            placeholder="Describe what happened (e.g. twisted ankle while pivoting)"
            placeholderTextColor={colors.icon}
            value={howItHappened}
            onChangeText={setHowItHappened}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <ThemedText type="defaultSemiBold" style={styles.label}>
            Sport / Activity *
          </ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Basketball, Running, Soccer"
            placeholderTextColor={colors.icon}
            value={sportActivity}
            onChangeText={setSportActivity}
          />

          <ThemedText type="defaultSemiBold" style={styles.label}>
            Date of Injury *
          </ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={colors.icon}
            value={dateOfInjury}
            onChangeText={setDateOfInjury}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          <ThemedText type="defaultSemiBold" style={styles.label}>
            Doctor's Diagnosis
          </ThemedText>
          <TextInput
            style={[inputStyle, styles.multiline]}
            placeholder="e.g. Grade II ankle sprain, ACL tear"
            placeholderTextColor={colors.icon}
            value={doctorDiagnosis}
            onChangeText={setDoctorDiagnosis}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <ThemedText type="defaultSemiBold" style={styles.label}>
            Initial Symptoms
          </ThemedText>
          <TextInput
            style={[inputStyle, styles.multiline]}
            placeholder="e.g. Swelling, pain when bearing weight, limited range of motion"
            placeholderTextColor={colors.icon}
            value={initialSymptoms}
            onChangeText={setInitialSymptoms}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.tint }, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Injury Profile'}
            </ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    marginBottom: 28,
    lineHeight: 22,
  },
  label: {
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  multiline: {
    minHeight: 90,
    paddingTop: 12,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  disabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
