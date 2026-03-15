import { Ionicons } from '@expo/vector-icons';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import HudPanel from '@/components/hud/HudPanel';
import RecoveryChart from '@/components/hud/RecoveryChart';
import StatsCards from '@/components/hud/StatsCards';
import { HUD } from '@/constants/hud-theme';

// ── Profile info ──────────────────────────────────────────────────────────────

const USER = {
  name: 'ALEX MORGAN',
  handle: 'OPERATOR_ALEX',
  sport: 'Basketball',
  injury: 'ACL — Left Knee',
  injuryDate: 'Jan 20, 2026',
  recoveryDay: 56,
  targetDate: 'Jul 01, 2026',
  pt: 'Dr. Sarah Kim, PT',
};

function Avatar() {
  return (
    <View style={avatarStyles.ring}>
      <View style={avatarStyles.inner}>
        <Ionicons name="person" size={36} color={HUD.cyan} />
      </View>
      <View style={avatarStyles.statusDot} />
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  ring: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: HUD.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${HUD.cyan}10`,
  },
  inner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: `${HUD.cyan}40`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: HUD.success,
    borderWidth: 2,
    borderColor: HUD.bg,
  },
});

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HUD.border,
  },
  label: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1.5,
  },
  value: {
    fontFamily: HUD.mono,
    fontSize: 12,
    color: HUD.text,
    letterSpacing: 0.5,
  },
});

// ── Recovery progress bar ─────────────────────────────────────────────────────

function RecoveryProgress() {
  const progress = 0.45; // 45% — replace with real calc
  return (
    <View style={progressStyles.container}>
      <View style={progressStyles.header}>
        <Text style={progressStyles.label}>RECOVERY PROGRESS</Text>
        <Text style={[progressStyles.pct, { color: HUD.cyan }]}>45%</Text>
      </View>
      <View style={progressStyles.track}>
        <View style={[progressStyles.fill, { width: `${progress * 100}%` }]} />
        <View style={[progressStyles.marker, { left: `${progress * 100}%` as any }]} />
      </View>
      <View style={progressStyles.footer}>
        <Text style={progressStyles.footerLabel}>DAY {USER.recoveryDay}</Text>
        <Text style={progressStyles.footerLabel}>TARGET: {USER.targetDate}</Text>
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontFamily: HUD.mono, fontSize: 9, color: HUD.muted, letterSpacing: 1.5 },
  pct: { fontFamily: HUD.mono, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  track: {
    height: 6,
    backgroundColor: `${HUD.cyan}15`,
    borderRadius: 3,
    overflow: 'visible',
    borderWidth: 1,
    borderColor: `${HUD.cyan}20`,
  },
  fill: {
    height: '100%',
    backgroundColor: HUD.cyan,
    borderRadius: 3,
    opacity: 0.8,
  },
  marker: {
    position: 'absolute',
    top: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: HUD.cyan,
    borderWidth: 2,
    borderColor: HUD.bg,
    marginLeft: -6,
  },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  footerLabel: { fontFamily: HUD.mono, fontSize: 8, color: HUD.muted, letterSpacing: 1 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.pageHeader}>
          <View style={styles.pageHeaderLine} />
          <View style={styles.pageHeaderRow}>
            <View>
              <Text
                style={[
                  styles.pageTitle,
                  Platform.OS === 'ios' && {
                    textShadowColor: HUD.cyan,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 6,
                  },
                ]}
              >
                OPERATOR PROFILE
              </Text>
              <Text style={styles.pageSubtitle}>RECOVERY SYSTEM v2.4</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} activeOpacity={0.7}>
              <Ionicons name="pencil-outline" size={14} color={HUD.cyan} />
              <Text style={styles.editBtnText}>EDIT</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Identity card */}
        <HudPanel title="IDENTITY" subtitle="OPERATOR CREDENTIALS" style={{ marginBottom: 16 }}>
          <View style={styles.identityRow}>
            <Avatar />
            <View style={styles.identityText}>
              <Text
                style={[
                  styles.userName,
                  Platform.OS === 'ios' && {
                    textShadowColor: HUD.cyan,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 6,
                  },
                ]}
              >
                {USER.name}
              </Text>
              <Text style={styles.userHandle}>@{USER.handle}</Text>
              <View style={styles.sportBadge}>
                <Text style={styles.sportBadgeText}>{USER.sport.toUpperCase()}</Text>
              </View>
            </View>
          </View>
        </HudPanel>

        {/* Injury info */}
        <HudPanel title="INJURY PROFILE" subtitle="ACTIVE RECOVERY PROTOCOL" style={{ marginBottom: 16 }}>
          <InfoRow label="DIAGNOSIS" value={USER.injury} color={HUD.danger} />
          <InfoRow label="DATE OF INJURY" value={USER.injuryDate} />
          <InfoRow label="PHYSICAL THERAPIST" value={USER.pt} color={HUD.cyan} />
          <View style={{ marginTop: 16 }}>
            <RecoveryProgress />
          </View>
        </HudPanel>

        {/*/!* Stats *!/*/}
        {/*<HudPanel title="PERFORMANCE METRICS" subtitle="CURRENT CYCLE STATISTICS" style={{ marginBottom: 16 }}>*/}
        {/*  <StatsCards />*/}
        {/*</HudPanel>*/}

        {/* Analytics chart */}
        <HudPanel
          title="RECOVERY ANALYTICS"
          subtitle="TRACKING: PAIN | MOBILITY | STRENGTH"
          style={{ marginBottom: 16 }}
        >
          <RecoveryChart />
        </HudPanel>

        {/* Settings shortcuts */}
        <HudPanel title="SYSTEM" subtitle="ACCOUNT & PREFERENCES" style={{ marginBottom: 32 }}>
          {[
            { icon: 'notifications-outline' as const, label: 'NOTIFICATIONS', sub: 'Reminders & alerts' },
            { icon: 'shield-checkmark-outline' as const, label: 'PRIVACY', sub: 'Data & permissions' },
            { icon: 'medical-outline' as const, label: 'MEDICAL INFO', sub: 'Insurance & doctor details' },
            { icon: 'log-out-outline' as const, label: 'SIGN OUT', sub: '', danger: true },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.settingsRow} activeOpacity={0.7}>
              <View style={[styles.settingsIcon, item.danger && styles.settingsIconDanger]}>
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={item.danger ? HUD.danger : HUD.cyan}
                />
              </View>
              <View style={styles.settingsText}>
                <Text style={[styles.settingsLabel, item.danger && { color: HUD.danger }]}>
                  {item.label}
                </Text>
                {item.sub ? <Text style={styles.settingsSub}>{item.sub}</Text> : null}
              </View>
              <Ionicons name="chevron-forward-outline" size={14} color={HUD.muted} />
            </TouchableOpacity>
          ))}
        </HudPanel>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HUD.bg },
  scroll: { backgroundColor: HUD.bg },
  content: { padding: 16, paddingBottom: 48 },

  pageHeader: { marginBottom: 20, overflow: 'hidden' },
  pageHeaderLine: { height: 1, backgroundColor: HUD.cyan, opacity: 0.3, marginBottom: 14 },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontFamily: HUD.mono,
    fontSize: 18,
    fontWeight: '700',
    color: HUD.cyan,
    letterSpacing: 3,
  },
  pageSubtitle: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: `${HUD.cyan}50`,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `${HUD.cyan}10`,
  },
  editBtnText: { fontFamily: HUD.mono, fontSize: 9, color: HUD.cyan, letterSpacing: 1 },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  identityText: { flex: 1, gap: 4 },
  userName: {
    fontFamily: HUD.mono,
    fontSize: 16,
    fontWeight: '700',
    color: HUD.text,
    letterSpacing: 1.5,
  },
  userHandle: { fontFamily: HUD.mono, fontSize: 10, color: HUD.muted, letterSpacing: 1 },
  sportBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: `${HUD.cyan}40`,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: `${HUD.cyan}10`,
    marginTop: 4,
  },
  sportBadgeText: { fontFamily: HUD.mono, fontSize: 9, color: HUD.cyan, letterSpacing: 1 },

  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HUD.border,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: `${HUD.cyan}30`,
    backgroundColor: `${HUD.cyan}10`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIconDanger: {
    borderColor: `${HUD.danger}30`,
    backgroundColor: `${HUD.danger}10`,
  },
  settingsText: { flex: 1 },
  settingsLabel: {
    fontFamily: HUD.mono,
    fontSize: 11,
    color: HUD.text,
    letterSpacing: 1.5,
  },
  settingsSub: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
});
