import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { HUD } from '@/constants/hud-theme';

interface StatDef {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  change?: string;
}

const STATS: StatDef[] = [
  { label: 'RECOVERY.DAY', value: 56, icon: 'calendar-outline', color: HUD.cyan },
  { label: 'STREAK.ACTIVE', value: 12, change: '+3', icon: 'flame-outline', color: HUD.warning },
  { label: 'MOBILITY.INDEX', value: 78, change: '+5%', icon: 'analytics-outline', color: HUD.success },
  { label: 'PAIN.REDUCTION', value: 62, change: '+8%', icon: 'trending-up-outline', color: HUD.cyan },
];

function padNum(n: number): string {
  return String(Math.floor(n)).padStart(3, '0');
}

function CornerAccentTL({ color }: { color: string }) {
  return (
    <>
      <View style={[styles.accentH, { top: 0, left: 0, backgroundColor: color }]} />
      <View style={[styles.accentV, { top: 0, left: 0, backgroundColor: color }]} />
    </>
  );
}

function CornerAccentBR({ color }: { color: string }) {
  return (
    <>
      <View style={[styles.accentH, { bottom: 0, right: 0, backgroundColor: color }]} />
      <View style={[styles.accentV, { bottom: 0, right: 0, backgroundColor: color }]} />
    </>
  );
}

function StatCard({ stat }: { stat: StatDef }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = stat.value;
    const stepMs = 20;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setDisplayValue(target);
        clearInterval(interval);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, stepMs);
    return () => clearInterval(interval);
  }, [stat.value]);

  const numberGlowStyle: ViewStyle =
    Platform.OS === 'ios'
      ? ({
          textShadowColor: stat.color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        } as unknown as ViewStyle)
      : {};

  return (
    <View style={[styles.card, { borderColor: HUD.border }]}>
      <CornerAccentTL color={stat.color} />
      <CornerAccentBR color={stat.color} />

      {/* Top row: icon + change badge */}
      <View style={styles.topRow}>
        <View style={[styles.iconBox, { borderColor: `${stat.color}40`, backgroundColor: `${stat.color}12` }]}>
          <Ionicons name={stat.icon} size={14} color={stat.color} />
        </View>
        {stat.change ? (
          <View style={[styles.changeBadge, { borderColor: `${stat.color}50`, backgroundColor: `${stat.color}15` }]}>
            <Text style={[styles.changeText, { color: stat.color }]}>{stat.change}</Text>
          </View>
        ) : null}
      </View>

      {/* Number */}
      <Text
        style={[
          styles.number,
          { color: stat.color },
          Platform.OS === 'ios' && {
            textShadowColor: stat.color,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
          },
        ]}
      >
        {padNum(displayValue)}
      </Text>

      {/* Label */}
      <Text style={styles.label}>{stat.label}</Text>
    </View>
  );
}

export default function StatsCards() {
  return (
    <View style={styles.grid}>
      {STATS.map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '47.5%',
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    overflow: 'hidden',
  },
  accentH: {
    position: 'absolute',
    width: 14,
    height: 1.5,
    opacity: 0.8,
  },
  accentV: {
    position: 'absolute',
    width: 1.5,
    height: 14,
    opacity: 0.8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  changeText: {
    fontFamily: HUD.mono,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  number: {
    fontFamily: HUD.mono,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
    lineHeight: 36,
  },
  label: {
    fontFamily: HUD.mono,
    fontSize: 8,
    color: HUD.muted,
    letterSpacing: 1.5,
    marginTop: 4,
  },
});
