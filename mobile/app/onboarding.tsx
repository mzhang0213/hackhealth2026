import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/constants/api';
import { HUD } from '@/constants/hud-theme';
import { supabase } from '@/constants/supabase';
import { useUser } from '@/context/UserContext';

const TOTAL_STEPS = 4;

const SPORTS = [
  'Basketball', 'Football', 'Soccer', 'Tennis', 'Running',
  'Swimming', 'Baseball', 'Volleyball', 'Cycling', 'Other',
];

// ── Field component ───────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numbers-and-punctuation';
}) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={HUD.muted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
        autoCapitalize="words"
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: HUD.cardBg,
    color: HUD.text,
    fontFamily: HUD.mono,
  },
  multiline: { minHeight: 80, paddingTop: 10 },
});

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ step }: { step: number }) {
  return (
    <View style={stepStyles.row}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            stepStyles.seg,
            {
              backgroundColor: i < step ? HUD.cyan : `${HUD.cyan}18`,
              borderColor: i < step ? HUD.cyan : HUD.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  seg: { flex: 1, height: 3, borderRadius: 2, borderWidth: 0.5 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { setUser } = useUser();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — Identity
  const [name, setName] = useState('');
  const [sport, setSport] = useState('');

  // Step 2 — Injury
  const [injuryDesc, setInjuryDesc] = useState('');
  const [injuryDate, setInjuryDate] = useState('');

  // Step 3 — Medical
  const [diagnosis, setDiagnosis] = useState('');
  const [ptName, setPtName] = useState('');

  function canAdvance(): boolean {
    if (step === 1) return name.trim().length > 0 && sport.trim().length > 0;
    if (step === 2) return injuryDesc.trim().length > 0 && injuryDate.trim().length > 0;
    return true;
  }

  async function handleNext() {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    // Step 3 → submit
    setSaving(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const profile = await api.createUser({
        id: session.user.id,       // use Supabase user.id as the profile ID
        name: name.trim(),
        sport: sport.trim(),
        injury_description: injuryDesc.trim(),
        injury_date: injuryDate.trim(),
        doctor_diagnosis: diagnosis.trim(),
        pt_name: ptName.trim(),
      });
      setUser(profile);
      setStep(TOTAL_STEPS); // success step
    } catch (e: any) {
      setError(e.message ?? 'Failed to connect to server.');
    } finally {
      setSaving(false);
    }
  }

  function handleFinish() {
    router.replace('/(tabs)');
  }

  const STEP_TITLES = [
    'IDENTITY', 'INJURY INFO', 'MEDICAL DETAILS', 'SYSTEM ONLINE',
  ];
  const STEP_SUBS = [
    'TELL US WHO YOU ARE',
    'DESCRIBE YOUR INJURY',
    'OPTIONAL — SKIP IF UNKNOWN',
    'PROFILE CREATED SUCCESSFULLY',
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLine} />
            <Text
              style={[
                styles.appTitle,
                Platform.OS === 'ios' && {
                  textShadowColor: HUD.cyan,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 8,
                },
              ]}
            >
              R.E.B.O.U.N.D
            </Text>
            <Text style={styles.appSub}>RECOVERY SYSTEM — OPERATOR SETUP</Text>
          </View>

          {/* Step bar */}
          <StepBar step={step} />

          {/* Step title */}
          <View style={styles.stepHeader}>
            <Text style={styles.stepNum}>STEP {step}/{TOTAL_STEPS}</Text>
            <Text style={[
              styles.stepTitle,
              Platform.OS === 'ios' && step === TOTAL_STEPS && {
                textShadowColor: HUD.cyan,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 6,
              },
            ]}>
              {STEP_TITLES[step - 1]}
            </Text>
            <Text style={styles.stepSub}>{STEP_SUBS[step - 1]}</Text>
          </View>

          <View style={styles.divider} />

          {/* ── Step 1: Identity ── */}
          {step === 1 && (
            <View>
              <Field
                label="FULL NAME"
                value={name}
                onChange={setName}
                placeholder="e.g. Alex Morgan"
              />

              <Text style={[fieldStyles.label, { marginBottom: 10 }]}>SPORT / ACTIVITY</Text>
              <View style={styles.sportGrid}>
                {SPORTS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.sportChip,
                      sport === s && styles.sportChipActive,
                    ]}
                    onPress={() => setSport(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.sportChipText,
                      sport === s && styles.sportChipTextActive,
                    ]}>
                      {s.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* ── Step 2: Injury ── */}
          {step === 2 && (
            <View>
              <Field
                label="INJURY DESCRIPTION"
                value={injuryDesc}
                onChange={setInjuryDesc}
                placeholder="e.g. ACL tear, left knee"
                multiline
              />
              <Field
                label="DATE OF INJURY (YYYY-MM-DD)"
                value={injuryDate}
                onChange={setInjuryDate}
                placeholder="e.g. 2026-01-20"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          )}

          {/* ── Step 3: Medical ── */}
          {step === 3 && (
            <View>
              <Field
                label="DOCTOR DIAGNOSIS"
                value={diagnosis}
                onChange={setDiagnosis}
                placeholder="e.g. Grade II ACL sprain"
                multiline
              />
              <Field
                label="PHYSICAL THERAPIST NAME"
                value={ptName}
                onChange={setPtName}
                placeholder="e.g. Dr. Sarah Kim, PT"
              />
            </View>
          )}

          {/* ── Step 4: Success ── */}
          {step === TOTAL_STEPS && (
            <View style={styles.successBlock}>
              <View style={styles.arcOuter}>
                <View style={styles.arcMiddle}>
                  <View style={styles.arcInner}>
                    <Text style={styles.arcCheck}>✓</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.successName}>{name.toUpperCase()}</Text>
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>SPORT</Text>
                <Text style={styles.successValue}>{sport.toUpperCase()}</Text>
              </View>
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>INJURY</Text>
                <Text style={styles.successValue}>{injuryDesc}</Text>
              </View>
              <View style={styles.successRow}>
                <Text style={styles.successLabel}>DATE</Text>
                <Text style={styles.successValue}>{injuryDate}</Text>
              </View>
              {ptName ? (
                <View style={styles.successRow}>
                  <Text style={styles.successLabel}>PT</Text>
                  <Text style={styles.successValue}>{ptName}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* CTA */}
          <View style={styles.ctaWrap}>
            {step < TOTAL_STEPS ? (
              <TouchableOpacity
                style={[styles.btn, !canAdvance() && styles.btnDisabled]}
                onPress={handleNext}
                disabled={!canAdvance() || saving}
                activeOpacity={0.8}
              >
                <View style={styles.btnAccentTL} />
                <View style={styles.btnAccentBR} />
                {saving ? (
                  <ActivityIndicator color={HUD.bg} />
                ) : (
                  <Text style={styles.btnText}>
                    {step === TOTAL_STEPS - 1 ? 'INITIALIZE PROFILE' : 'NEXT →'}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.btn} onPress={handleFinish} activeOpacity={0.8}>
                <View style={styles.btnAccentTL} />
                <View style={styles.btnAccentBR} />
                <Text style={styles.btnText}>ENTER SYSTEM →</Text>
              </TouchableOpacity>
            )}

            {step > 1 && step < TOTAL_STEPS && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setStep((s) => s - 1)}
                activeOpacity={0.7}
              >
                <Text style={styles.backBtnText}>← BACK</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HUD.bg },
  content: { padding: 24, paddingBottom: 48 },

  header: { marginBottom: 32, alignItems: 'center' },
  headerLine: {
    height: 1, width: '100%', backgroundColor: HUD.cyan, opacity: 0.3, marginBottom: 20,
  },
  appTitle: {
    fontFamily: HUD.mono,
    fontSize: 24,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 4,
  },
  appSub: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 2,
    marginTop: 6,
  },

  stepHeader: { marginBottom: 20 },
  stepNum: { fontFamily: HUD.mono, fontSize: 9, color: HUD.muted, letterSpacing: 2, marginBottom: 6 },
  stepTitle: {
    fontFamily: HUD.mono,
    fontSize: 20,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 3,
    marginBottom: 4,
  },
  stepSub: { fontFamily: HUD.mono, fontSize: 9, color: HUD.muted, letterSpacing: 1.5 },

  divider: { height: 1, backgroundColor: HUD.cyan, opacity: 0.15, marginBottom: 24 },

  sportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  sportChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    backgroundColor: HUD.cardBg,
  },
  sportChipActive: {
    borderColor: HUD.cyan,
    backgroundColor: `${HUD.cyan}18`,
  },
  sportChipText: { fontFamily: HUD.mono, fontSize: 9, color: HUD.muted, letterSpacing: 1 },
  sportChipTextActive: { color: HUD.cyan },

  successBlock: { alignItems: 'center', gap: 16, marginBottom: 24 },
  arcOuter: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 1, borderColor: `${HUD.cyan}40`,
    alignItems: 'center', justifyContent: 'center',
  },
  arcMiddle: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 1.5, borderColor: `${HUD.cyan}70`,
    alignItems: 'center', justifyContent: 'center',
  },
  arcInner: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 2, borderColor: HUD.cyan,
    backgroundColor: `${HUD.cyan}20`,
    alignItems: 'center', justifyContent: 'center',
  },
  arcCheck: { fontSize: 22, color: HUD.cyan, fontWeight: '700' },
  successName: {
    fontFamily: HUD.mono, fontSize: 18, fontWeight: '700',
    color: HUD.text, letterSpacing: 2,
  },
  successRow: {
    flexDirection: 'row', gap: 12, alignSelf: 'stretch',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HUD.border,
  },
  successLabel: { fontFamily: HUD.mono, fontSize: 9, color: HUD.muted, letterSpacing: 1.5, width: 60 },
  successValue: { fontFamily: HUD.mono, fontSize: 12, color: HUD.text, flex: 1 },

  errorText: {
    fontFamily: HUD.mono, fontSize: 10, color: HUD.danger,
    letterSpacing: 1, marginBottom: 12, textAlign: 'center',
  },

  ctaWrap: { gap: 10 },
  btn: {
    borderWidth: 1, borderColor: HUD.cyan, borderRadius: 4,
    paddingVertical: 14, alignItems: 'center',
    backgroundColor: HUD.cyan, overflow: 'hidden',
  },
  btnDisabled: { opacity: 0.35 },
  btnAccentTL: {
    position: 'absolute', top: 0, left: 0,
    width: 16, height: 1.5, backgroundColor: HUD.bg, opacity: 0.4,
  },
  btnAccentBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: 16, height: 1.5, backgroundColor: HUD.bg, opacity: 0.4,
  },
  btnText: {
    fontFamily: HUD.mono, color: HUD.bg,
    fontSize: 13, fontWeight: '700', letterSpacing: 2,
  },
  backBtn: { alignItems: 'center', paddingVertical: 10 },
  backBtnText: { fontFamily: HUD.mono, fontSize: 10, color: HUD.muted, letterSpacing: 2 },
});
