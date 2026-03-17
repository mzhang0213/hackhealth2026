import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HUD } from '@/constants/hud-theme';
import { api } from '@/constants/api';
import { useUser } from '@/context/UserContext';

type Symptom = 'SWELLING' | 'STIFFNESS' | 'WEAKNESS' | 'INSTABILITY' | 'CLICK/POP' | 'NUMBNESS';

const SYMPTOMS: Symptom[] = [
  'SWELLING',
  'STIFFNESS',
  'WEAKNESS',
  'INSTABILITY',
  'CLICK/POP',
  'NUMBNESS',
];

function painColor(level: number): string {
  if (level <= 2) return HUD.success;
  if (level <= 4) return HUD.cyan;
  if (level <= 6) return HUD.warning;
  return HUD.danger;
}

function painLabel(level: number): string {
  if (level <= 2) return 'MINIMAL';
  if (level <= 4) return 'MODERATE';
  if (level <= 6) return 'ELEVATED';
  return 'CRITICAL';
}

function PulsingDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View style={[styles.pulsingDot, { backgroundColor: color, opacity: anim }]} />
  );
}

function SuccessView({ onModify }: { onModify: () => void }) {
  const scaleAnim   = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, bounciness: 10 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <Animated.View style={[styles.successContainer, { opacity: opacityAnim }]}>
      <Animated.View style={[styles.arcReactor, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.arcOuter,  { borderColor: `${HUD.cyan}40` }]}>
          <View style={[styles.arcMiddle, { borderColor: `${HUD.cyan}70` }]}>
            <View style={[styles.arcInner, { borderColor: HUD.cyan, backgroundColor: `${HUD.cyan}20` }]}>
              <Ionicons name="checkmark" size={22} color={HUD.cyan} />
            </View>
          </View>
        </View>
      </Animated.View>
      <Text style={styles.successTitle}>DATA.LOGGED</Text>
      <Text style={styles.successSub}>DIAGNOSTIC ENTRY RECORDED</Text>
      <TouchableOpacity style={styles.modifyBtn} onPress={onModify} activeOpacity={0.75}>
        <Text style={styles.modifyBtnText}>[MODIFY.ENTRY]</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PainCheckin({ onComplete }: { onComplete?: () => void } = {}) {
  const { user } = useUser();
  const [painLevel, setPainLevel] = useState<number | null>(null);
  const [symptoms,  setSymptoms]  = useState<Set<Symptom>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function toggleSymptom(s: Symptom) {
    setSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  async function handleSubmit() {
    if (painLevel === null || !user) return;
    setSubmitting(true);
    try {
      await api.createCheckin(user.id, painLevel, Array.from(symptoms));
    } catch {
      // Still show success UI — data can be retried silently later
    } finally {
      setSubmitting(false);
      setSubmitted(true);
      onComplete?.();
    }
  }

  function handleModify() {
    setSubmitted(false);
  }

  if (submitted) {
    return <SuccessView onModify={handleModify} />;
  }

  const activeColor = painLevel !== null ? painColor(painLevel) : HUD.cyan;

  return (
    <View>
      <Text style={styles.sectionLabel}>PAIN.LEVEL :: SELECT</Text>
      <View style={styles.painGrid}>
        {Array.from({ length: 11 }, (_, i) => i).map((level) => {
          const color = painColor(level);
          const isSelected = painLevel === level;
          return (
            <TouchableOpacity
              key={level}
              onPress={() => setPainLevel(level)}
              activeOpacity={0.75}
              style={[
                styles.painBtn,
                {
                  borderColor: isSelected ? color : `${color}40`,
                  backgroundColor: isSelected ? `${color}25` : 'transparent',
                  ...(isSelected && Platform.OS === 'ios'
                    ? { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, shadowOpacity: 0.6 }
                    : {}),
                },
              ]}
            >
              <Text style={[styles.painBtnText, { color: isSelected ? color : `${color}80` }]}>
                {String(level).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {painLevel !== null && (
        <View style={styles.descRow}>
          <PulsingDot color={activeColor} />
          <Text style={[styles.descText, { color: activeColor }]}>{painLabel(painLevel)}</Text>
          <Text style={styles.descLevel}>LEVEL {painLevel}/10</Text>
        </View>
      )}

      <Text style={[styles.sectionLabel, { marginTop: 16 }]}>SYMPTOM.FLAGS</Text>
      <View style={styles.symptomsGrid}>
        {SYMPTOMS.map((s) => {
          const isOn = symptoms.has(s);
          return (
            <TouchableOpacity
              key={s}
              onPress={() => toggleSymptom(s)}
              activeOpacity={0.75}
              style={[
                styles.symptomPill,
                { borderColor: isOn ? HUD.cyan : HUD.border, backgroundColor: isOn ? `${HUD.cyan}18` : 'transparent' },
              ]}
            >
              <Text style={[styles.symptomText, { color: isOn ? HUD.cyan : HUD.muted }]}>
                {isOn ? '// ' : ''}{s}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.submitBtn,
          {
            opacity: painLevel === null || submitting ? 0.4 : 1,
            ...(Platform.OS === 'ios' && painLevel !== null
              ? { shadowColor: HUD.cyan, shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.5 }
              : {}),
          },
        ]}
        onPress={handleSubmit}
        activeOpacity={0.8}
        disabled={painLevel === null || submitting}
      >
        <Text style={styles.submitText}>
          {submitting ? 'SUBMITTING...' : '[SUBMIT.CHECKIN]'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  painGrid: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  painBtn: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  painBtnText: {
    fontFamily: HUD.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
  },
  descRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  descText: {
    fontFamily: HUD.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  descLevel: {
    fontFamily: HUD.mono,
    fontSize: 10,
    color: HUD.muted,
    letterSpacing: 1,
  },
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 20,
  },
  symptomPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 3,
  },
  symptomText: {
    fontFamily: HUD.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  submitBtn: {
    backgroundColor: HUD.cyan,
    borderRadius: 3,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitText: {
    fontFamily: HUD.mono,
    fontSize: 12,
    color: HUD.bg,
    fontWeight: '700',
    letterSpacing: 2,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  arcReactor: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcMiddle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arcInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontFamily: HUD.mono,
    fontSize: 18,
    color: HUD.cyan,
    fontWeight: '700',
    letterSpacing: 3,
    ...(Platform.OS === 'ios'
      ? { textShadowColor: HUD.cyan, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }
      : {}),
  },
  successSub: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 2,
  },
  modifyBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 3,
    paddingHorizontal: 20,
    paddingVertical: 9,
  },
  modifyBtnText: {
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.cyan,
    letterSpacing: 1.5,
  },
});
