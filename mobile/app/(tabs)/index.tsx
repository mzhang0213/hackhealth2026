import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HUD, hudGlow } from '@/constants/hud-theme';
import { BODY_DIAGRAM_KEY, type MarkedPart } from '@/constants/body-store';
import { useUser } from '@/context/UserContext';
import ExerciseTracker from '@/components/hud/ExerciseTracker';
import HudPanel from '@/components/hud/HudPanel';
import PainCheckin from '@/components/hud/PainCheckin';
import RecoveryChart from '@/components/hud/RecoveryChart';
import StatsCards from '@/components/hud/StatsCards';

// ─── Arc-reactor logo ────────────────────────────────────────────────────────

function ArcReactor({ size = 38 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const r = size / 2;
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pulse,
        },
        Platform.OS === 'ios' && {
          shadowColor: HUD.cyan,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 10,
          shadowOpacity: 0.7,
        },
      ]}
    >
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: r,
          borderWidth: 1,
          borderColor: `${HUD.cyan}30`,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: r * 0.72,
          borderWidth: 1.5,
          borderColor: `${HUD.cyan}60`,
        }}
      />
      <View
        style={{
          width: size * 0.44,
          height: size * 0.44,
          borderRadius: r * 0.44,
          borderWidth: 2,
          borderColor: HUD.cyan,
          backgroundColor: `${HUD.cyan}20`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="pulse-outline" size={size * 0.22} color={HUD.cyan} />
      </View>
    </Animated.View>
  );
}

// ─── Separator ───────────────────────────────────────────────────────────────

function HudSeparator({ label }: { label: string }) {
  return (
    <View style={sepStyles.row}>
      <View style={sepStyles.lineLeft} />
      <Text style={sepStyles.label}>{label}</Text>
      <View style={sepStyles.lineRight} />
    </View>
  );
}

const sepStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lineLeft: {
    flex: 1,
    height: 1,
    // gradient via opacity trick
    backgroundColor: HUD.cyan,
    opacity: 0.2,
  },
  lineRight: {
    flex: 1,
    height: 1,
    backgroundColor: HUD.cyan,
    opacity: 0.2,
  },
  label: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 2,
  },
});

// ─── Quick action card ────────────────────────────────────────────────────────

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  subtitle: string;
}

function QuickActionCard({ icon, color, title, subtitle }: QuickActionProps) {
  return (
    <TouchableOpacity activeOpacity={0.75} style={[qaStyles.card, { borderColor: HUD.border }]}>
      {/* Top-right corner accents */}
      <View style={[qaStyles.accentHRight, { backgroundColor: color }]} />
      <View style={[qaStyles.accentVRight, { backgroundColor: color }]} />

      <View style={[qaStyles.iconBox, { borderColor: `${color}50`, backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={qaStyles.textCol}>
        <Text style={[qaStyles.title, { color }]}>{title}</Text>
        <Text style={qaStyles.subtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward-outline" size={14} color={HUD.muted} />
    </TouchableOpacity>
  );
}

const qaStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  accentHRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 1.5,
    opacity: 0.7,
  },
  accentVRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 1.5,
    height: 16,
    opacity: 0.7,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: HUD.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 1,
  },
});

// ─── AI Banner ────────────────────────────────────────────────────────────────

function AiBanner() {
  return (
    <View style={aiStyles.banner}>
      {/* Left cyan line */}
      <View style={aiStyles.leftLine} />
      {/* Top gradient line */}
      <View style={aiStyles.topLine} />

      <View style={aiStyles.inner}>
        <ArcReactor size={36} />
        <View style={aiStyles.textCol}>
          <Text style={aiStyles.title}>AI RECOVERY ASSISTANT</Text>
          <Text style={aiStyles.sub}>
            PATTERN ANALYSIS · WEEKLY SUMMARIES · PROGRESS INSIGHTS
          </Text>
        </View>
        <TouchableOpacity style={aiStyles.btn} activeOpacity={0.75}>
          <Text style={aiStyles.btnText}>[GENERATE REPORT]</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const aiStyles = StyleSheet.create({
  banner: {
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  leftLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: HUD.cyan,
    opacity: 0.8,
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: HUD.cyan,
    opacity: 0.3,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 18,
    paddingRight: 12,
    paddingVertical: 14,
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.cyan,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  sub: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 0.5,
  },
  btn: {
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  btnText: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.cyan,
    letterSpacing: 1,
  },
});

// ─── Header ───────────────────────────────────────────────────────────────────

function useCurrentTime() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toTimeString().slice(0, 8);
  });
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toTimeString().slice(0, 8));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function DashHeader() {
  const time = useCurrentTime();
  const sysPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sysPulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(sysPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sysPulse]);

  return (
    <View style={headerStyles.wrapper}>
      <View style={headerStyles.row}>
        {/* Left: logo + title */}
        <View style={headerStyles.left}>
          <ArcReactor size={36} />
          <View style={headerStyles.titleCol}>
            <Text
              style={[
                headerStyles.brand,
                Platform.OS === 'ios' && {
                  textShadowColor: HUD.cyan,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 8,
                },
              ]}
            >
              R.E.B.O.U.N.D
            </Text>
            <Text style={headerStyles.version}>RECOVERY SYSTEM v2.4</Text>
          </View>
        </View>

        {/* Right: status + time + bell */}
        <View style={headerStyles.right}>
          <Animated.View style={[headerStyles.onlineDot, { opacity: sysPulse }]} />
          <Text style={headerStyles.statusText}>SYS ONLINE</Text>
          <Text style={headerStyles.timeText}>{time}</Text>
          <View style={headerStyles.bellWrap}>
            <Ionicons name="notifications-outline" size={18} color={HUD.muted} />
            <View style={headerStyles.notifDot} />
          </View>
        </View>
      </View>
      <View style={headerStyles.border} />
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleCol: {
    gap: 2,
  },
  brand: {
    fontFamily: HUD.mono,
    fontSize: 16,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 2,
  },
  version: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: HUD.success,
  },
  statusText: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.success,
    letterSpacing: 1,
  },
  timeText: {
    fontFamily: HUD.mono,
    fontSize: 10,
    color: HUD.cyan,
    letterSpacing: 1,
    marginLeft: 4,
  },
  bellWrap: {
    position: 'relative',
    marginLeft: 4,
  },
  notifDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: HUD.danger,
    borderWidth: 1,
    borderColor: HUD.bg,
  },
  border: {
    height: 1,
    backgroundColor: HUD.cyan,
    opacity: 0.2,
  },
});

// ─── Body Map panel content ───────────────────────────────────────────────────

function BodyMapContent({ bodyParts }: { bodyParts: Record<string, MarkedPart> }) {
  const count = Object.keys(bodyParts).length;

  function dotColor(status: MarkedPart['status']): string {
    if (status === 'pain') return HUD.danger;
    if (status === 'moderate') return HUD.warning;
    return HUD.success;
  }

  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/injury')}
      activeOpacity={0.75}
      style={bodyStyles.button}
    >
      <View style={bodyStyles.inner}>
        <Ionicons name="body-outline" size={32} color={HUD.cyan} />
        <View style={bodyStyles.textCol}>
          <Text style={bodyStyles.title}>BODY MAP</Text>
          <Text style={bodyStyles.sub}>TAP TO VIEW INJURY MARKERS</Text>
        </View>
        <Ionicons name="chevron-forward-outline" size={16} color={HUD.muted} />
      </View>

      {count > 0 && (
        <View style={bodyStyles.badgeRow}>
          <View style={bodyStyles.badge}>
            <Text style={bodyStyles.badgeText}>{count} AREAS MARKED</Text>
          </View>
          <View style={bodyStyles.dots}>
            {Object.values(bodyParts)
              .slice(0, 8)
              .map((p, i) => (
                <View
                  key={i}
                  style={[bodyStyles.dot, { backgroundColor: dotColor(p.status) }]}
                />
              ))}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const bodyStyles = StyleSheet.create({
  button: {
    gap: 10,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  textCol: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: HUD.mono,
    fontSize: 13,
    fontWeight: '700',
    color: HUD.text,
    letterSpacing: 2,
  },
  sub: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  badge: {
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.cyan,
    letterSpacing: 1,
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user } = useUser();
  const [bodyParts, setBodyParts] = useState<Record<string, MarkedPart>>({});

  useEffect(() => {
    AsyncStorage.getItem(BODY_DIAGRAM_KEY).then((raw) => {
      if (raw) setBodyParts(JSON.parse(raw) as Record<string, MarkedPart>);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" backgroundColor={HUD.bg} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <DashHeader />

        {/*/!* Operator status separator *!/*/}
        {/*<View style={{ marginBottom: 8 }}>*/}
        {/*  <HudSeparator label="OPERATOR STATUS" />*/}
        {/*</View>*/}

        {/* Welcome */}
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.welcome}>
            Welcome back,{' '}
            <Text
              style={[
                styles.operatorName,
                Platform.OS === 'ios' && {
                  textShadowColor: HUD.cyan,
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 8,
                },
              ]}
            >
              {user ? user.name.toUpperCase() : '...'}
            </Text>
          </Text>
          <Text style={styles.statusLine}>
            {user
              ? `// DAY ${String(user.recovery_day).padStart(3, '0')} :: ${user.injury_description.toUpperCase()} :: STATUS ACTIVE`
              : '// LOADING OPERATOR DATA...'}
          </Text>
        </View>

        {/* Stats cards */}
        <View style={{ marginBottom: 20 }}>
          <StatsCards recoveryDay={user?.recovery_day ?? 0} />
        </View>

        {/* Exercise tracker */}
        <HudPanel
            title="REHAB PROTOCOL"
            subtitle="DAILY EXERCISE QUEUE"
            style={{ marginBottom: 16 }}
        >
          <ExerciseTracker />
        </HudPanel>

        {/* Pain check-in */}
        <HudPanel
            title="DAILY DIAGNOSTIC"
            subtitle="SYMPTOM & PAIN INPUT"
            style={{ marginBottom: 24 }}
        >
          <PainCheckin />
        </HudPanel>

        {/*/!* Body Map *!/*/}
        {/*<HudPanel*/}
        {/*  title="BIOMETRIC SCANNER"*/}
        {/*  subtitle="TAP MARKERS FOR DIAGNOSTICS"*/}
        {/*  style={{ marginBottom: 16 }}*/}
        {/*>*/}
        {/*  <BodyMapContent bodyParts={bodyParts} />*/}
        {/*</HudPanel>*/}

        {/*/!* Quick access separator *!/*/}
        {/*<View style={{ marginBottom: 16 }}>*/}
        {/*  <HudSeparator label="QUICK ACCESS" />*/}
        {/*</View>*/}

        {/*/!* Quick actions *!/*/}
        {/*<View style={{ marginBottom: 24 }}>*/}
        {/*  <QuickActionCard*/}
        {/*    icon="camera-outline"*/}
        {/*    color={HUD.cyan}*/}
        {/*    title="PHOTO TIMELINE"*/}
        {/*    subtitle="VISUAL RECOVERY DOCUMENTATION"*/}
        {/*  />*/}
        {/*  <QuickActionCard*/}
        {/*    icon="location-outline"*/}
        {/*    color={HUD.success}*/}
        {/*    title="PT LOCATOR"*/}
        {/*    subtitle="FIND SPECIALISTS NEARBY"*/}
        {/*  />*/}
        {/*  <QuickActionCard*/}
        {/*    icon="scan-outline"*/}
        {/*    color={HUD.warning}*/}
        {/*    title="ROM ANALYSIS"*/}
        {/*    subtitle="AI-POWERED MOVEMENT SCAN"*/}
        {/*  />*/}
        {/*</View>*/}

        {/* AI Banner */}
        <View style={{ marginBottom: 24 }}>
          <AiBanner />
        </View>

        {/*/!* Footer *!/*/}
        {/*<View style={styles.footer}>*/}
        {/*  <HudSeparator label="R.E.B.O.U.N.D // RECOVERY ENHANCEMENT BODY OPTIMIZATION UNIFIED NETWORK DIAGNOSTICS" />*/}
        {/*  <Text style={styles.disclaimer}>*/}
        {/*    THIS SYSTEM DOES NOT REPLACE PROFESSIONAL MEDICAL ADVICE*/}
        {/*  </Text>*/}
        {/*</View>*/}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: HUD.bg,
  },
  scroll: {
    backgroundColor: HUD.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  welcome: {
    fontFamily: HUD.mono,
    fontSize: 14,
    color: HUD.text,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  operatorName: {
    color: HUD.cyan,
    fontWeight: '700',
  },
  statusLine: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1,
  },
  footer: {
    gap: 10,
  },
  disclaimer: {
    fontFamily: HUD.mono,
    fontSize: 7,
    color: HUD.muted,
    letterSpacing: 1.5,
    textAlign: 'center',
    opacity: 0.6,
  },
});
