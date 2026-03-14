<<<<<<< Updated upstream
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { INJURY_PROFILE_KEY, type InjuryProfile } from '@/app/injury-report';
import { BODY_DIAGRAM_KEY, type MarkedPart } from '@/app/body-diagram';
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
=======
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Modal, TextInput, ScrollView, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../supabaseClient';

const CLINIC_DB = [
  { id: 1, name: "University Sports Medicine", zip: "02215", insurance: ["Blue Cross", "Aetna", "Cigna"], distance: "0.8 miles" },
  { id: 2, name: "Fenway Physical Therapy", zip: "02215", insurance: ["MassHealth", "Blue Cross", "Medicare"], distance: "1.2 miles" },
  { id: 3, name: "Commonwealth PT", zip: "02446", insurance: ["MassHealth", "Tufts"], distance: "2.5 miles" },
  { id: 4, name: "Downtown Rehab Center", zip: "02108", insurance: ["Aetna", "Cigna", "Tufts"], distance: "3.1 miles" }
];

export default function App() {
  // --- STATE ---
  const [injuredParts, setInjuredParts] = useState({});
  const [isFrontView, setIsFrontView] = useState(true);
  
  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  
  // Form Inputs
  const [activeMuscle, setActiveMuscle] = useState(null);
  const [painLevel, setPainLevel] = useState(1);
  const [noteContent, setNoteContent] = useState('');
  const [targetMuscle, setTargetMuscle] = useState('');
  
  // Search
  const [zipQuery, setZipQuery] = useState('');
  const [insuranceQuery, setInsuranceQuery] = useState('');
  const [matchedClinics, setMatchedClinics] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  // --- DATABASE: LOAD DATA ---
  useEffect(() => {
    fetchInjuries();
  }, []);

  const fetchInjuries = async () => {
    const { data, error } = await supabase
      .from('injury_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) console.error("Database Error:", error.message);
    else if (data) {
      const loadedParts = {};
      data.forEach(log => {
        if (!loadedParts[log.muscle]) {
          loadedParts[log.muscle] = {
            level: log.pain_level,
            color: log.color,
            borderColor: log.border_color,
            date: new Date(log.created_at).toLocaleDateString()
          };
        }
      });
      setInjuredParts(loadedParts);
    }
  };

  // --- DATABASE: SAVE INJURY ---
  const saveInjury = async () => {
    let color = 'rgba(6, 182, 212, 0.1)'; 
    let borderColor = '#06b6d4'; 
    if (painLevel <= 3) { color = 'rgba(74, 222, 128, 0.4)'; borderColor = '#4ade80'; } 
    else if (painLevel <= 6) { color = 'rgba(250, 204, 21, 0.4)'; borderColor = '#facc15'; } 
    else { color = 'rgba(239, 68, 68, 0.5)'; borderColor = '#ef4444'; } 

    const newEntry = { muscle: activeMuscle, pain_level: painLevel, color, border_color: borderColor };
    
    setInjuredParts({ ...injuredParts, [activeMuscle]: { level: painLevel, color, borderColor, date: 'Saving...' } });
    setModalVisible(false);

    const { error } = await supabase.from('injury_logs').insert([newEntry]);
    if (error) console.error("Save Error:", error.message);
    fetchInjuries();
  };

  // --- DATABASE: SAVE NOTE ---
  const savePatientNote = async () => {
    const { error } = await supabase.from('patient_notes').insert([{ muscle_group: targetMuscle, content: noteContent }]);
    if (error) console.error("Note Save Error:", error.message);
    else {
      Alert.alert("Success", "Note uploaded to clinical record.");
      setNoteModalVisible(false);
      setNoteContent('');
    }
  };

  // --- STORAGE: FILE UPLOAD ---
  const handleFileUpload = async (muscle) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) return;

      const file = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const filePath = `uploads/${muscle}_${Date.now()}_${file.name}`;

      const { data, error } = await supabase.storage
        .from('patient_files')
        .upload(filePath, decode(base64), { contentType: file.mimeType });

      if (error) throw error;
      Alert.alert("Upload Complete", `${file.name} has been saved to Supabase.`);
    } catch (err) {
      Alert.alert("Upload Failed", err.message);
    }
  };

  // --- UI HELPERS ---
  const renderBodyPart = (name, w, h) => {
    const data = injuredParts[name];
    const bg = data ? data.color : 'rgba(6, 182, 212, 0.05)';
    const bc = data ? data.borderColor : '#06b6d4';
    return (
      <TouchableOpacity key={name} style={[styles.node, { width: w, height: h, backgroundColor: bg, borderColor: bc }]} onPress={() => { setActiveMuscle(name); setPainLevel(1); setModalVisible(true); }}>
        <Text style={styles.nodeText}>{name}</Text>
        {data && <Text style={styles.scoreText}>{data.level}/10</Text>}
      </TouchableOpacity>
    );
  };

  const findClinics = () => {
    setHasSearched(true);
    setMatchedClinics(CLINIC_DB.filter(c => c.insurance.some(i => i.toLowerCase().includes(insuranceQuery.toLowerCase())) && (zipQuery === '' || c.zip === zipQuery)));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>RECOVERY_HUD_v1.0</Text>
          <TouchableOpacity style={styles.flipBtn} onPress={() => setIsFrontView(!isFrontView)}>
            <Text style={styles.flipText}>ROTATE SUBJECT [{isFrontView ? 'FRONT' : 'BACK'}]</Text>
          </TouchableOpacity>
        </View>

        {/* BODY MAP */}
        <View style={styles.mapContainer}>
          {isFrontView ? (
            <><View style={styles.row}>{renderBodyPart('Head', 100, 70)}</View>
              <View style={styles.row}>{renderBodyPart('L_Shoulder', 80, 80)}{renderBodyPart('Chest', 120, 80)}{renderBodyPart('R_Shoulder', 80, 80)}</View>
              <View style={styles.row}>{renderBodyPart('L_Arm', 70, 110)}{renderBodyPart('Abdomen', 110, 110)}{renderBodyPart('R_Arm', 70, 110)}</View>
              <View style={styles.row}>{renderBodyPart('L_Quad', 90, 130)}{renderBodyPart('R_Quad', 90, 130)}</View></>
          ) : (
            <><View style={styles.row}>{renderBodyPart('Back_Head', 100, 70)}</View>
              <View style={styles.row}>{renderBodyPart('L_Trap', 80, 80)}{renderBodyPart('Upper_Back', 120, 80)}{renderBodyPart('R_Trap', 80, 80)}</View>
              <View style={styles.row}>{renderBodyPart('L_Tricep', 70, 110)}{renderBodyPart('Lower_Back', 110, 110)}{renderBodyPart('R_Tricep', 70, 110)}</View>
              <View style={styles.row}>{renderBodyPart('L_Glute', 90, 100)}{renderBodyPart('R_Glute', 90, 100)}</View></>
          )}
        </View>

        {/* LOGS DASHBOARD */}
        {Object.keys(injuredParts).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>// ACTIVE_TRAUMA_LOGS</Text>
            {Object.keys(injuredParts).map(m => (
              <View key={m} style={[styles.card, { borderColor: injuredParts[m].borderColor }]}>
                <View style={styles.cardHead}><Text style={styles.cardTitle}>{m}</Text><Text style={styles.cardDate}>{injuredParts[m].date}</Text></View>
                <Text style={styles.cardInfo}>PAIN_INDEX: {injuredParts[m].level}/10</Text>
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.btnMain} onPress={() => handleFileUpload(m)}><Text style={styles.btnText}>📁 UPLOAD DOCS</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnAlt} onPress={() => { setTargetMuscle(m); setNoteModalVisible(true); }}><Text style={styles.btnTextAlt}>📝 SYMPTOMS</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* PT MATCHER */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>// IN_NETWORK_SCANNER</Text>
          <View style={styles.inputRow}>
            <TextInput style={[styles.input, { flex: 1, marginRight: 10 }]} placeholder="Zip" placeholderTextColor="#475569" value={zipQuery} onChangeText={setZipQuery}/>
            <TextInput style={[styles.input, { flex: 2 }]} placeholder="Insurance" placeholderTextColor="#475569" value={insuranceQuery} onChangeText={setInsuranceQuery}/>
          </View>
          <TouchableOpacity style={styles.scanBtn} onPress={findClinics}><Text style={styles.scanBtnText}>RUN SCAN</Text></TouchableOpacity>
          {hasSearched && matchedClinics.map(c => <View key={c.id} style={styles.clinicCard}><Text style={styles.clinicName}>{c.name}</Text><Text style={styles.clinicDetails}>📍 {c.distance}</Text></View>)}
        </View>

      </ScrollView>

      {/* PAIN MODAL */}
      <Modal animationType="slide" transparent visible={modalVisible}>
        <View style={styles.modalBg}><View style={styles.modalBody}>
          <Text style={styles.modalTitle}>// LOG: {activeMuscle}</Text>
          <View style={styles.sliderRow}>{[1,2,3,4,5,6,7,8,9,10].map(i => (
            <TouchableOpacity key={i} onPress={() => setPainLevel(i)} style={[styles.block, { backgroundColor: i <= painLevel ? (i<=3?'#4ade80':i<=6?'#facc15':'#ef4444') : '#1e293b' }]}><Text style={styles.blockText}>{i}</Text></TouchableOpacity>
          ))}</View>
          <TouchableOpacity style={styles.modalSave} onPress={saveInjury}><Text style={styles.saveText}>INITIALIZE SAVE</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>ABORT</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal animationType="fade" transparent visible={noteModalVisible}>
        <View style={styles.modalBg}><View style={styles.modalBody}>
          <Text style={styles.modalTitle}>// CLINICAL_ENTRY: {targetMuscle}</Text>
          
          <TextInput 
            style={styles.textArea} 
            multiline 
            placeholder="Type clinical notes..." 
            placeholderTextColor="#475569" 
            value={noteContent} 
            onChangeText={setNoteContent}
          />

          {/* ADD THIS NEW BUTTON HERE */}
          <TouchableOpacity 
            style={[styles.btnAlt, { marginBottom: 15, padding: 15 }]} 
            onPress={() => handleFileUpload(targetMuscle)}
          >
            <Text style={styles.btnTextAlt}>📎 ATTACH MEDICAL DOCUMENT (PDF/IMG)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalSave} onPress={savePatientNote}>
            <Text style={styles.saveText}>UPLOAD TEXT TO CLOUD</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => setNoteModalVisible(false)}>
            <Text style={styles.cancelText}>CANCEL</Text>
          </TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
>>>>>>> Stashed changes
  );
}

const styles = StyleSheet.create({
<<<<<<< Updated upstream
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
=======
  container: { flex: 1, backgroundColor: '#020617' },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: '900', color: '#06b6d4', letterSpacing: 2 },
  flipBtn: { marginTop: 15, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#38bdf8' },
  flipText: { color: '#38bdf8', fontSize: 10, fontWeight: 'bold' },
  mapContainer: { alignItems: 'center', padding: 10 },
  row: { flexDirection: 'row', marginVertical: 5, gap: 10 },
  node: { borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  nodeText: { fontSize: 10, color: '#e2e8f0', fontWeight: 'bold' },
  scoreText: { fontSize: 16, color: '#fff', fontWeight: '900' },
  section: { marginTop: 30, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#06b6d4', marginBottom: 15 },
  card: { backgroundColor: 'rgba(15, 23, 42, 0.8)', padding: 15, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { fontSize: 18, color: '#f1f5f9', fontWeight: 'bold' },
  cardDate: { color: '#64748b', fontSize: 10 },
  cardInfo: { color: '#94a3b8', marginVertical: 10 },
  btnRow: { flexDirection: 'row', gap: 10 },
  btnMain: { flex: 1, backgroundColor: '#06b6d4', padding: 10, borderRadius: 4, alignItems: 'center' },
  btnText: { color: '#020617', fontWeight: 'bold', fontSize: 12 },
  btnAlt: { flex: 1, borderWidth: 1, borderColor: '#38bdf8', padding: 10, borderRadius: 4, alignItems: 'center' },
  btnTextAlt: { color: '#38bdf8', fontWeight: 'bold', fontSize: 12 },
  inputRow: { flexDirection: 'row', marginBottom: 10 },
  input: { backgroundColor: '#0f172a', borderBottomWidth: 2, borderColor: '#06b6d4', color: '#fff', padding: 12 },
  scanBtn: { backgroundColor: '#38bdf8', padding: 12, borderRadius: 4, alignItems: 'center' },
  scanBtnText: { fontWeight: '900', color: '#020617' },
  clinicCard: { backgroundColor: '#0f172a', padding: 12, marginTop: 5, borderRadius: 4 },
  clinicName: { color: '#fff', fontWeight: 'bold' },
  clinicDetails: { color: '#94a3b8', fontSize: 12 },
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalBody: { backgroundColor: '#0f172a', padding: 25, borderTopWidth: 2, borderColor: '#06b6d4' },
  modalTitle: { color: '#06b6d4', fontWeight: '900', marginBottom: 20 },
  sliderRow: { flexDirection: 'row', marginBottom: 20 },
  block: { flex: 1, height: 35, marginHorizontal: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  blockText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  modalSave: { backgroundColor: '#06b6d4', padding: 15, alignItems: 'center', borderRadius: 4, marginBottom: 10 },
  saveText: { fontWeight: 'bold', color: '#020617' },
  cancelText: { color: '#ef4444', textAlign: 'center', fontSize: 12, marginTop: 5 },
  textArea: { backgroundColor: '#020617', color: '#fff', padding: 15, height: 100, borderRadius: 4, marginBottom: 20, textAlignVertical: 'top' }
});
>>>>>>> Stashed changes
