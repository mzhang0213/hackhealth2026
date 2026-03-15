import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { HUD } from '@/constants/hud-theme';
import { supabase } from '@/constants/supabase';

// ── Field component ────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  secure,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
  autoCapitalize?: 'none' | 'words';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, focused && fieldStyles.inputFocused]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={`${HUD.muted}80`}
        secureTextEntry={secure}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardAppearance="dark"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {focused && <View style={fieldStyles.focusBar} />}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap:  { marginBottom: 18, position: 'relative' },
  label: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    backgroundColor: HUD.cardBg,
    color: HUD.text,
    fontFamily: HUD.mono,
    letterSpacing: 0.5,
  },
  inputFocused: {
    borderColor: `${HUD.cyan}60`,
  },
  focusBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: HUD.cyan,
    opacity: 0.5,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
});

// ── Mode toggle ────────────────────────────────────────────────────────────────

function ModeToggle({
  mode,
  onSelect,
}: {
  mode: 'signin' | 'register';
  onSelect: (m: 'signin' | 'register') => void;
}) {
  return (
    <View style={toggleStyles.row}>
      {(['register', 'signin'] as const).map((m) => {
        const active = mode === m;
        return (
          <TouchableOpacity
            key={m}
            style={[toggleStyles.btn, active && toggleStyles.btnActive]}
            onPress={() => onSelect(m)}
            activeOpacity={0.75}
          >
            <Text style={[toggleStyles.btnText, active && toggleStyles.btnTextActive]}>
              {m === 'register' ? 'REGISTER' : 'SIGN IN'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 28,
  },
  btn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  btnActive: {
    backgroundColor: `${HUD.cyan}18`,
    borderColor: HUD.cyan,
  },
  btnText: {
    fontFamily: HUD.mono,
    fontSize: 10,
    color: HUD.muted,
    letterSpacing: 2,
  },
  btnTextActive: {
    color: HUD.cyan,
    fontWeight: '700',
  },
});

// ── Main screen ────────────────────────────────────────────────────────────────

export default function AuthScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'signin' | 'register'>(
    params.mode === 'register' ? 'register' : 'signin',
  );

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Animate form on mode switch
  const fadeAnim = useRef(new Animated.Value(1)).current;
  function switchMode(m: 'signin' | 'register') {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setMode(m);
    setError('');
    setPassword('');
    setConfirm('');
  }

  async function handleSubmit() {
    setError('');
    if (!email.trim() || !password) {
      setError('EMAIL AND PASSWORD ARE REQUIRED');
      return;
    }
    if (mode === 'register' && password !== confirm) {
      setError('PASSWORDS DO NOT MATCH');
      return;
    }
    if (password.length < 6) {
      setError('PASSWORD MUST BE AT LEAST 6 CHARACTERS');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const { error: err } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        // UserContext listener will handle redirect
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (err) throw err;
        // UserContext listener will handle redirect
      }
    } catch (e: any) {
      setError((e?.message ?? 'Authentication failed').toUpperCase());
    } finally {
      setLoading(false);
    }
  }

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
          {/* Top accent */}
          <View style={styles.topLine} />

          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[
                styles.brand,
                Platform.OS === 'ios' && {
                  textShadowColor: HUD.cyan,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 10,
                },
              ]}
            >
              R.E.B.O.U.N.D
            </Text>
            <Text style={styles.brandSub}>
              {mode === 'register' ? 'CREATE OPERATOR ACCOUNT' : 'AUTHENTICATE OPERATOR'}
            </Text>
          </View>

          {/* Mode toggle */}
          <ModeToggle mode={mode} onSelect={switchMode} />

          {/* Form */}
          <Animated.View style={{ opacity: fadeAnim }}>
            <Field
              label="OPERATOR EMAIL"
              value={email}
              onChange={setEmail}
              placeholder="operator@email.com"
            />
            <Field
              label="ACCESS CODE"
              value={password}
              onChange={setPassword}
              placeholder="••••••••••"
              secure
            />
            {mode === 'register' && (
              <Field
                label="CONFIRM ACCESS CODE"
                value={confirm}
                onChange={setConfirm}
                placeholder="••••••••••"
                secure
              />
            )}
          </Animated.View>

          {/* Error */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>// ERR: {error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            <View style={[styles.btnH, { top: 0, left: 0 }]} />
            <View style={[styles.btnV, { top: 0, left: 0 }]} />
            <View style={[styles.btnH, { bottom: 0, right: 0 }]} />
            <View style={[styles.btnV, { bottom: 0, right: 0 }]} />
            {loading
              ? <ActivityIndicator color={HUD.bg} />
              : <Text style={styles.submitBtnText}>
                  {mode === 'register' ? 'CREATE ACCOUNT  →' : 'AUTHENTICATE  →'}
                </Text>
            }
          </TouchableOpacity>

          {/* Back to landing */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>← BACK</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: HUD.bg },
  content: { padding: 24, paddingBottom: 48 },

  topLine: { height: 1, backgroundColor: HUD.cyan, opacity: 0.4, marginBottom: 36 },

  header: { alignItems: 'center', marginBottom: 32, gap: 6 },
  brand: {
    fontFamily: HUD.mono,
    fontSize: 22,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 4,
  },
  brandSub: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 2,
  },

  errorBox: {
    borderWidth: 1,
    borderColor: `${HUD.danger}50`,
    backgroundColor: `${HUD.danger}10`,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.danger,
    letterSpacing: 1,
  },

  submitBtn: {
    borderWidth: 1.5,
    borderColor: HUD.cyan,
    borderRadius: 4,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: HUD.cyan,
    overflow: 'hidden',
    marginBottom: 12,
    ...(Platform.OS === 'ios'
      ? { shadowColor: HUD.cyan, shadowOffset: { width: 0, height: 0 }, shadowRadius: 10, shadowOpacity: 0.35 }
      : {}),
  },
  btnH: { position: 'absolute', width: 18, height: 1.5, backgroundColor: HUD.bg, opacity: 0.3 },
  btnV: { position: 'absolute', width: 1.5, height: 18, backgroundColor: HUD.bg, opacity: 0.3 },
  submitBtnText: {
    fontFamily: HUD.mono,
    fontSize: 13,
    fontWeight: '700',
    color: HUD.bg,
    letterSpacing: 2,
  },

  backBtn:     { alignItems: 'center', paddingVertical: 12 },
  backBtnText: { fontFamily: HUD.mono, fontSize: 10, color: HUD.muted, letterSpacing: 2 },
});
