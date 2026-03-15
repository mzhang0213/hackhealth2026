import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HUD } from '@/constants/hud-theme';

const { height: SCREEN_H } = Dimensions.get('window');

// ── Scanline ──────────────────────────────────────────────────────────────────

function ScanLine() {
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: SCREEN_H, duration: 3200, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0,        duration: 0,    useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [y]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.scanline, { transform: [{ translateY: y }] }]}
    />
  );
}

// ── Arc reactor ───────────────────────────────────────────────────────────────

function ArcReactor() {
  const pulse = useRef(new Animated.Value(0.5)).current;
  const ring  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 1400, useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ring, { toValue: 1.08, duration: 1800, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ]),
    ).start();
    return () => { pulse.stopAnimation(); ring.stopAnimation(); };
  }, [pulse, ring]);

  return (
    <Animated.View style={[styles.arcWrap, { opacity: pulse, transform: [{ scale: ring }] }]}>
      <View style={styles.arcOuter}>
        <View style={styles.arcMiddle}>
          <View style={styles.arcInner}>
            <Ionicons name="pulse-outline" size={28} color={HUD.cyan} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Feature row ───────────────────────────────────────────────────────────────

function Feature({
  num,
  icon,
  title,
  sub,
  color,
}: {
  num: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  color: string;
}) {
  return (
    <View style={[styles.feature, { borderColor: `${color}25` }]}>
      {/* Left accent */}
      <View style={[styles.featureAccent, { backgroundColor: color }]} />

      <View style={[styles.featureIcon, { borderColor: `${color}40`, backgroundColor: `${color}12` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>

      <View style={styles.featureText}>
        <View style={styles.featureTitleRow}>
          <Text style={[styles.featureNum, { color: `${color}60` }]}>[{num}]</Text>
          <Text style={[styles.featureTitle, { color }]}>{title}</Text>
        </View>
        <Text style={styles.featureSub}>{sub}</Text>
      </View>

      {/* Corner accents */}
      <View style={[styles.cH, { top: 0, right: 0, backgroundColor: color }]} />
      <View style={[styles.cV, { top: 0, right: 0, backgroundColor: color }]} />
    </View>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function LandingScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScanLine />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Top accent line */}
        <View style={styles.topLine} />

        {/* Hero */}
        <View style={styles.hero}>
          <ArcReactor />
          <Text
            style={[
              styles.brand,
              Platform.OS === 'ios' && {
                textShadowColor: HUD.cyan,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 14,
              },
            ]}
          >
            R.E.B.O.U.N.D
          </Text>
          <Text style={styles.brandFull}>
            RECOVERY ENHANCEMENT BODY OPTIMIZATION{'\n'}UNIFIED NETWORK DIAGNOSTICS
          </Text>
          <View style={styles.versionRow}>
            <View style={styles.versionDot} />
            <Text style={styles.versionText}>RECOVERY SYSTEM v2.4 — ONLINE</Text>
          </View>
        </View>

        {/*/!* Stats strip *!/*/}
        {/*<View style={styles.statsRow}>*/}
        {/*  <StatChip value="AI" label="POWERED" />*/}
        {/*  <View style={styles.statDivider} />*/}
        {/*  <StatChip value="CV" label="ROM SCAN" />*/}
        {/*  <View style={styles.statDivider} />*/}
        {/*  <StatChip value="24/7" label="TRACKING" />*/}
        {/*</View>*/}

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionLabel}>SYSTEM FEATURES</Text>
          <View style={styles.sectionLine} />
        </View>

        {/* Features */}
        <View style={styles.features}>
          <Feature
            num="01"
            icon="scan-outline"
            color={HUD.cyan}
            title="ROM TRACKING"
            sub="AI computer vision measures range of motion in real time using YOLO pose estimation"
          />
          <Feature
            num="02"
            icon="body-outline"
            color={HUD.warning}
            title="BODY MAPPING"
            sub="Interactive injury diagram — mark affected areas and track severity over recovery"
          />
          <Feature
            num="03"
            icon="analytics-outline"
            color={HUD.success}
            title="AI ANALYTICS"
            sub="Weekly recovery summaries, pain trend analysis, and Gemini-powered protocol recommendations"
          />
          <Feature
            num="04"
            icon="medical-outline"
            color={HUD.danger}
            title="PT INTEGRATION"
            sub="Log your physical therapist's exercises, track completions, and find specialists nearby"
          />
        </View>

        <View style={[styles.sectionHeader, { marginTop: 8 }]}>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionLabel}>INITIALIZE OPERATOR</Text>
          <View style={styles.sectionLine} />
        </View>

        {/* CTAs */}
        <View style={styles.ctas}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/auth?mode=register')}
            activeOpacity={0.85}
          >
            {/* corner brackets */}
            <View style={[styles.btnH, { top: 0, left: 0 }]} />
            <View style={[styles.btnV, { top: 0, left: 0 }]} />
            <View style={[styles.btnH, { bottom: 0, right: 0 }]} />
            <View style={[styles.btnV, { bottom: 0, right: 0 }]} />
            <Text style={styles.primaryBtnText}>CREATE ACCOUNT  →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push('/auth?mode=signin')}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryBtnText}>SIGN IN</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>
            THIS SYSTEM DOES NOT REPLACE PROFESSIONAL MEDICAL ADVICE.{'\n'}
            ALWAYS CONSULT YOUR PHYSICIAN AND PHYSICAL THERAPIST.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: HUD.bg },
  content:  { paddingHorizontal: 20, paddingBottom: 48 },

  scanline: {
    position: 'absolute',
    left: 0, right: 0,
    height: 2,
    backgroundColor: HUD.cyan,
    opacity: 0.04,
    zIndex: 0,
  },

  topLine: {
    height: 1,
    backgroundColor: HUD.cyan,
    opacity: 0.4,
    marginBottom: 40,
  },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  arcWrap: {
    marginBottom: 8,
  },
  arcOuter: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 1, borderColor: `${HUD.cyan}30`,
    alignItems: 'center', justifyContent: 'center',
  },
  arcMiddle: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: 1.5, borderColor: `${HUD.cyan}60`,
    alignItems: 'center', justifyContent: 'center',
  },
  arcInner: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: HUD.cyan,
    backgroundColor: `${HUD.cyan}15`,
    alignItems: 'center', justifyContent: 'center',
  },
  brand: {
    fontFamily: HUD.mono,
    fontSize: 28,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 5,
  },
  brandFull: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 1.5,
    textAlign: 'center',
    lineHeight: 14,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  versionDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: HUD.success,
  },
  versionText: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.success,
    letterSpacing: 1.5,
  },

  // ── Stats strip ──
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    paddingVertical: 14,
    marginBottom: 28,
    gap: 0,
  },
  statChip: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: {
    fontFamily: HUD.mono,
    fontSize: 15,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 1,
  },
  statLabel: {
    fontFamily: HUD.mono,
    fontSize: 7,
    color: HUD.muted,
    letterSpacing: 1.5,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: HUD.border,
  },

  // ── Section header ──
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: HUD.cyan, opacity: 0.15 },
  sectionLabel: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 2,
  },

  // ── Features ──
  features: { gap: 10, marginBottom: 28 },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 14,
    paddingRight: 14,
    overflow: 'hidden',
  },
  featureAccent: { width: 3, alignSelf: 'stretch' },
  featureIcon: {
    width: 42, height: 42,
    borderRadius: 4, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  featureText: { flex: 1, gap: 4 },
  featureTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureNum: { fontFamily: HUD.mono, fontSize: 8, letterSpacing: 1 },
  featureTitle: { fontFamily: HUD.mono, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  featureSub: { fontFamily: HUD.mono, fontSize: 8, color: HUD.muted, letterSpacing: 0.5, lineHeight: 13 },
  cH: { position: 'absolute', width: 12, height: 1.5, opacity: 0.7 },
  cV: { position: 'absolute', width: 1.5, height: 12, opacity: 0.7 },

  // ── CTAs ──
  ctas: { gap: 10, marginBottom: 32 },
  primaryBtn: {
    borderWidth: 1.5,
    borderColor: HUD.cyan,
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: `${HUD.cyan}15`,
    overflow: 'hidden',
    ...(Platform.OS === 'ios'
      ? { shadowColor: HUD.cyan, shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.3 }
      : {}),
  },
  btnH: { position: 'absolute', width: 20, height: 1.5, backgroundColor: HUD.cyan, opacity: 0.8 },
  btnV: { position: 'absolute', width: 1.5, height: 20, backgroundColor: HUD.cyan, opacity: 0.8 },
  primaryBtnText: {
    fontFamily: HUD.mono,
    fontSize: 14,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 3,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryBtnText: {
    fontFamily: HUD.mono,
    fontSize: 12,
    color: HUD.muted,
    letterSpacing: 3,
  },

  // ── Footer ──
  footer: { gap: 12, alignItems: 'center' },
  footerLine: { height: 1, width: '100%', backgroundColor: HUD.cyan, opacity: 0.1 },
  footerText: {
    fontFamily: HUD.mono,
    fontSize: 7,
    color: HUD.muted,
    letterSpacing: 1,
    opacity: 0.5,
    textAlign: 'center',
    lineHeight: 12,
  },
});
