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
  Modal,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../supabaseClient'; // Ensure this path is correct for your setup

import { HUD, hudGlow } from '@/constants/hud-theme';
import { BODY_DIAGRAM_KEY, type MarkedPart } from '@/constants/body-store';
import ExerciseTracker from '@/components/hud/ExerciseTracker';
import HudPanel from '@/components/hud/HudPanel';
import PainCheckin from '@/components/hud/PainCheckin';
import RecoveryChart from '@/components/hud/RecoveryChart';
import StatsCards from '@/components/hud/StatsCards';

// ─── Arc-reactor logo ────────────────────────────────────────────────────────
function ArcReactor({ size = 40 }: { size?: number }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const r = size / 2;
  return (
    <Animated.View
      style={[
        { width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: pulse },
        Platform.OS === 'ios' && { shadowColor: HUD.cyan, shadowOffset: { width: 0, height: 0 }, shadowRadius: 10, shadowOpacity: 0.7 },
      ]}
    >
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: r, borderWidth: 1, borderColor: `${HUD.cyan}30` }} />
      <View style={{ position: 'absolute', width: size * 0.72, height: size * 0.72, borderRadius: r * 0.72, borderWidth: 1.5, borderColor: `${HUD.cyan}60` }} />
      <View style={{ width: size * 0.44, height: size * 0.44, borderRadius: r * 0.44, borderWidth: 2, borderColor: HUD.cyan, backgroundColor: `${HUD.cyan}20`, alignItems: 'center', justifyContent: 'center' }}>
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
  row: { flexDirection: 'row', alignItems: 'center' },
  lineLeft: { flex: 1, height: 1, backgroundColor: HUD.cyan, opacity: 0.2 },
  lineRight: { flex: 1, height: 1, backgroundColor: HUD.cyan, opacity: 0.2 },
  label: { fontFamily: HUD.mono, fontSize: 8, color: HUD.muted, letterSpacing: 2 },
});

// ─── Quick action card ────────────────────────────────────────────────────────
interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}
function QuickActionCard({ icon, color, title, subtitle, onPress }: QuickActionProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[qaStyles.card, { borderColor: HUD.border }]}>
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
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: HUD.cardBg, borderWidth: 1, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 14, gap: 12, overflow: 'hidden', marginBottom: 8 },
  accentHRight: { position: 'absolute', top: 0, right: 0, width: 16, height: 1.5, opacity: 0.7 },
  accentVRight: { position: 'absolute', top: 0, right: 0, width: 1.5, height: 16, opacity: 0.7 },
  iconBox: { width: 40, height: 40, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  textCol: { flex: 1, gap: 3 },
  title: { fontFamily: HUD.mono, fontSize: 12, fontWeight: '700', letterSpacing: 1.5 },
  subtitle: { fontFamily: HUD.mono, fontSize: 8, color: HUD.muted, letterSpacing: 1 },
});

// ─── Header ───────────────────────────────────────────────────────────────────
function useCurrentTime() {
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 8));
  useEffect(() => {
    const id = setInterval(() => setTime(new Date().toTimeString().slice(0, 8)), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function DashHeader() {
  const time = useCurrentTime();
  const sysPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(sysPulse, { toValue: 0.3, duration: 900, useNativeDriver: true }),
      Animated.timing(sysPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [sysPulse]);

  return (
    <View style={headerStyles.wrapper}>
      <View style={headerStyles.row}>
        <View style={headerStyles.left}>
          <ArcReactor size={36} />
          <View style={headerStyles.titleCol}>
            <Text style={[headerStyles.brand, Platform.OS === 'ios' && { textShadowColor: HUD.cyan, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }]}>R.E.B.O.U.N.D</Text>
            <Text style={headerStyles.version}>RECOVERY SYSTEM v2.4</Text>
          </View>
        </View>
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
  wrapper: { marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleCol: { gap: 2 },
  brand: { fontFamily: HUD.mono, fontSize: 16, fontWeight: '700', color: HUD.cyan, letterSpacing: 2 },
  version: { fontFamily: HUD.mono, fontSize: 8, color: HUD.muted, letterSpacing: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: HUD.success },
  statusText: { fontFamily: HUD.mono, fontSize: 8, color: HUD.success, letterSpacing: 1 },
  timeText: { fontFamily: HUD.mono, fontSize: 10, color: HUD.cyan, letterSpacing: 1, marginLeft: 4 },
  bellWrap: { position: 'relative', marginLeft: 4 },
  notifDot: { position: 'absolute', top: 0, right: 0, width: 6, height: 6, borderRadius: 3, backgroundColor: HUD.danger, borderWidth: 1, borderColor: HUD.bg },
  border: { height: 1, backgroundColor: HUD.cyan, opacity: 0.2 },
});


// ─── Main screen ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  // --- TELEMETRY & APP STATE ---
  const [bodyParts, setBodyParts] = useState<Record<string, MarkedPart>>({});
  
  // --- AI SCANNER STATE ---
  const [streamUrl, setStreamUrl] = useState("http://localhost:5001/video_feed");
  const [scanTimer, setScanTimer] = useState(null);
  const timerRef = useRef(null);
  const [scanResult, setScanResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [activeMuscle, setActiveMuscle] = useState('Shoulder'); // Default target

  useEffect(() => {
    AsyncStorage.getItem(BODY_DIAGRAM_KEY).then((raw) => {
      if (raw) setBodyParts(JSON.parse(raw) as Record<string, MarkedPart>);
    });
  }, []);

  // --- AI SCANNER FUNCTIONS ---
  const startScanner = (muscle = 'Shoulder') => {
    setActiveMuscle(muscle);
    setScanTimer(null); 
    setStreamUrl(`http://localhost:5001/video_feed?t=${Date.now()}`); 
    setCameraActive(true); 
  };

  const beginRecordingSession = async () => {
    try {
      await fetch('http://localhost:5001/start-scan', { method: 'POST' });
    } catch (e) {
      alert("Ensure Python server is running."); return;
    }
    let timeLeft = 15; 
    setScanTimer(timeLeft);
    timerRef.current = setInterval(() => {
      timeLeft -= 1;
      setScanTimer(timeLeft);
      if (timeLeft <= 0) {
        clearInterval(timerRef.current);
        setScanTimer(null);
        runAIScan();
      }
    }, 1000);
  };

  const runAIScan = async () => {
    setCameraActive(false); 
    try {
      const { data: pastScans } = await supabase.from('mobility_scans').select('max_rom').eq('muscle', activeMuscle).order('created_at', { ascending: false }).limit(1);
      let previousRom = pastScans && pastScans.length > 0 ? pastScans[0].max_rom : null;
      const response = await fetch('http://localhost:5001/analyze-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muscle: activeMuscle, previous_rom: previousRom })
      });
      const data = await response.json();
      await supabase.from('mobility_scans').insert([{ muscle: activeMuscle, max_rom: data.angle }]);
      setScanResult(data);
    } catch (err) {
      alert("AI Server Offline or Error: " + err.message);
    }
  };

  const abortScan = () => {
    clearInterval(timerRef.current);
    setScanTimer(null);
    setCameraActive(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" backgroundColor={HUD.bg} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <DashHeader />
        <View style={{ marginBottom: 8 }}><HudSeparator label="OPERATOR STATUS" /></View>

        {/* Welcome */}
        <View style={{ marginBottom: 24 }}>
          <Text style={styles.welcome}>Welcome back, <Text style={[styles.operatorName, Platform.OS === 'ios' && { textShadowColor: HUD.cyan, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }]}>OPERATOR ALEX</Text></Text>
          <Text style={styles.statusLine}>// DAY 056 :: ACL RECOVERY PROTOCOL :: STATUS ACTIVE</Text>
        </View>

        <View style={{ marginBottom: 20 }}><StatsCards /></View>

        <HudPanel title="REHAB PROTOCOL" subtitle="DAILY EXERCISE QUEUE" style={{ marginBottom: 16 }}>
          <ExerciseTracker />
        </HudPanel>

        <HudPanel title="DAILY DIAGNOSTIC" subtitle="SYMPTOM & PAIN INPUT" style={{ marginBottom: 24 }}>
          <PainCheckin />
        </HudPanel>

        <View style={{ marginBottom: 16 }}><HudSeparator label="QUICK ACCESS" /></View>

        {/* Quick actions - WIRED UP YOUR SCANNER HERE! */}
        <View style={{ marginBottom: 24 }}>
          <QuickActionCard icon="camera-outline" color={HUD.cyan} title="PHOTO TIMELINE" subtitle="VISUAL RECOVERY DOCUMENTATION" />
          <QuickActionCard icon="location-outline" color={HUD.success} title="PT LOCATOR" subtitle="FIND SPECIALISTS NEARBY" />
          
          {/* TAP THIS TO START THE YOLO CAMERA */}
          <QuickActionCard 
             icon="scan-outline" 
             color={HUD.warning} 
             title="ROM ANALYSIS" 
             subtitle="AI-POWERED MOVEMENT SCAN" 
             onPress={() => startScanner('Shoulder')} 
          />
        </View>

        <View style={styles.footer}>
          <HudSeparator label="R.E.B.O.U.N.D // RECOVERY ENHANCEMENT BODY OPTIMIZATION UNIFIED NETWORK DIAGNOSTICS" />
          <Text style={styles.disclaimer}>THIS SYSTEM DOES NOT REPLACE PROFESSIONAL MEDICAL ADVICE</Text>
        </View>
      </ScrollView>

      {/* THE AI TELEMETRY DASHBOARD MODAL */}
      <Modal animationType="fade" transparent visible={!!scanResult}>
        <View style={modalStyles.modalBg}>
          <View style={[modalStyles.modalBody, {height: '85%'}]}>
            <Text style={modalStyles.modalTitle}>// AI_CLINICAL_REPORT: {scanResult?.muscle}</Text>
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
              <View>
                <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                  <Text style={{color: '#fff', fontSize: 22, fontWeight: '900'}}>PEAK ROM: {scanResult?.angle}°</Text>
                  {scanResult?.peak_delta !== undefined && scanResult?.peak_delta !== 0 && (
                    <View style={{ backgroundColor: scanResult.peak_delta > 0 ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 10 }}>
                      <Text style={{color: scanResult.peak_delta > 0 ? '#4ade80' : '#ef4444', fontSize: 14, fontWeight: 'bold'}}>
                        {scanResult.peak_delta > 0 ? '▲ +' : '▼ '}{scanResult.peak_delta}°
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={{color: '#38bdf8', fontSize: 14, fontWeight: 'bold'}}>AVG ROM: {scanResult?.average_angle}°</Text>
              </View>
              <Text style={{color: '#64748b', fontSize: 10}}>SAMPLES: {scanResult?.data_points}</Text>
            </View>

            <Text style={{color: '#06b6d4', fontWeight: '900', fontSize: 12, marginTop: 20}}>// RAW_TELEMETRY_DATA</Text>
            <View style={modalStyles.chartContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{alignItems: 'flex-end', paddingHorizontal: 10}}>
                {scanResult?.raw_data?.map((val, idx) => (
                  <View key={idx} style={{ width: 4, height: (val / 180) * 130, backgroundColor: val === scanResult?.angle ? '#ef4444' : '#06b6d4', marginHorizontal: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
                ))}
              </ScrollView>
            </View>
            <Text style={{color: '#475569', fontSize: 10, textAlign: 'center', marginTop: 5, marginBottom: 15}}>FILE ARCHIVED: {scanResult?.filename}</Text>
            <Text style={{color: '#94a3b8', lineHeight: 22, fontWeight: 'bold'}}>{scanResult?.message}</Text>
            <TouchableOpacity style={[modalStyles.modalSave, {marginTop: 'auto'}]} onPress={() => setScanResult(null)}>
              <Text style={modalStyles.saveText}>ACKNOWLEDGE & CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* THE LIVE YOLO CAMERA MODAL */}
      <Modal animationType="slide" transparent visible={cameraActive}>
        <View style={modalStyles.modalBg}>
          <View style={[modalStyles.modalBody, {height: '95%'}]}>
            <Text style={modalStyles.modalTitle}>// LIVE_YOLO_FEED: {activeMuscle}</Text>
            <View style={[modalStyles.viewfinder, { flex: 1, height: 'auto', marginBottom: 20, backgroundColor: '#000' }]}>
              {cameraActive && (
                <img src={streamUrl} style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }} alt="AI Vision Stream" />
              )}
            </View>
            {scanTimer === null ? (
              <TouchableOpacity style={[modalStyles.modalSave, {backgroundColor: '#ef4444'}]} onPress={beginRecordingSession}>
                <Text style={[modalStyles.saveText, {color: '#fff'}]}>🔴 START 15-SECOND RECORDING</Text>
              </TouchableOpacity>
            ) : (
              <View style={[modalStyles.modalSave, {backgroundColor: '#1e293b'}]}>
                <Text style={[modalStyles.saveText, {color: '#ef4444', fontSize: 18}]}>RECORDING... {scanTimer}s</Text>
              </View>
            )}
            <TouchableOpacity onPress={abortScan}><Text style={modalStyles.cancelText}>ABORT SCAN</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: HUD.bg },
  scroll: { backgroundColor: HUD.bg },
  content: { padding: 16, paddingBottom: 40 },
  welcome: { fontFamily: HUD.mono, fontSize: 14, color: HUD.text, letterSpacing: 0.5, marginBottom: 4 },
  operatorName: { color: HUD.cyan, fontWeight: '700' },
  statusLine: { fontFamily: HUD.mono, fontSize: 9, color: HUD.muted, letterSpacing: 1 },
  footer: { gap: 10, marginTop: 20 },
  disclaimer: { fontFamily: HUD.mono, fontSize: 7, color: HUD.muted, letterSpacing: 1.5, textAlign: 'center', opacity: 0.6 },
});

const modalStyles = StyleSheet.create({
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalBody: { backgroundColor: '#0f172a', padding: 25, borderTopWidth: 2, borderColor: '#06b6d4' },
  modalTitle: { color: '#06b6d4', fontWeight: '900', marginBottom: 20 },
  viewfinder: { width: '100%', height: 350, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  chartContainer: { height: 140, backgroundColor: '#020617', borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginTop: 10, paddingVertical: 10, justifyContent: 'flex-end' },
  modalSave: { backgroundColor: '#06b6d4', padding: 15, alignItems: 'center', borderRadius: 4, marginBottom: 10, marginTop: 15 },
  saveText: { fontWeight: 'bold', color: '#020617' },
  cancelText: { color: '#ef4444', textAlign: 'center', fontSize: 12, marginTop: 10 }
});