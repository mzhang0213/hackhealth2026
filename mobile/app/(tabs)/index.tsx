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
  const [modalVisible, setModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [activeMuscle, setActiveMuscle] = useState(null);
  const [painLevel, setPainLevel] = useState(1);
  const [noteContent, setNoteContent] = useState('');
  const [targetMuscle, setTargetMuscle] = useState('');
  const [zipQuery, setZipQuery] = useState('');
  const [insuranceQuery, setInsuranceQuery] = useState('');
  const [matchedClinics, setMatchedClinics] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    fetchInjuries();
  }, []);

  const fetchInjuries = async () => {
    const { data, error } = await supabase.from('injury_logs').select('*').order('created_at', { ascending: false });
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

  const saveInjury = async () => {
    let color = 'rgba(6, 182, 212, 0.1)'; 
    let borderColor = '#06b6d4'; 
    if (painLevel <= 3) { color = 'rgba(74, 222, 128, 0.4)'; borderColor = '#4ade80'; } 
    else if (painLevel <= 6) { color = 'rgba(250, 204, 21, 0.4)'; borderColor = '#facc15'; } 
    else { color = 'rgba(239, 68, 68, 0.5)'; borderColor = '#ef4444'; } 

    setInjuredParts({ ...injuredParts, [activeMuscle]: { level: painLevel, color, borderColor, date: 'Saving...' } });
    setModalVisible(false);

    const { error } = await supabase.from('injury_logs').insert([{ muscle: activeMuscle, pain_level: painLevel, color, border_color: borderColor }]);
    if (error) console.error("Save Error:", error.message);
    fetchInjuries();
  };

  const savePatientNote = async () => {
    const { error } = await supabase.from('patient_notes').insert([{ muscle_group: targetMuscle, content: noteContent }]);
    if (error) console.error("Note Save Error:", error.message);
    else {
      Alert.alert("Success", "Note uploaded to clinical record.");
      setNoteModalVisible(false);
      setNoteContent('');
    }
  };

  const handleFileUpload = async (muscle) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      const filePath = `uploads/${muscle}_${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('patient_files').upload(filePath, decode(base64), { contentType: file.mimeType });
      if (error) throw error;
      Alert.alert("Upload Complete", `${file.name} saved to Supabase.`);
    } catch (err) {
      Alert.alert("Upload Failed", err.message);
    }
  };

  const runAIScan = async (muscle) => {
    try {
      const response = await fetch('http://localhost:5000/analyze-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muscle: muscle })
      });
      const data = await response.json();
      Alert.alert("🤖 AI_VISION_ANALYSIS", `Muscle: ${muscle}\nROM Angle: ${data.angle}°\n\nStatus: ${data.message}`);
    } catch (err) {
      Alert.alert("Server Offline", "Ensure your Python server is running on port 5000.");
    }
  };

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 50 }}>
        <View style={styles.header}>
          <Text style={styles.title}>RECOVERY_HUD_v1.0</Text>
          <TouchableOpacity style={styles.flipBtn} onPress={() => setIsFrontView(!isFrontView)}>
            <Text style={styles.flipText}>ROTATE SUBJECT [{isFrontView ? 'FRONT' : 'BACK'}]</Text>
          </TouchableOpacity>
        </View>

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

        {Object.keys(injuredParts).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>// ACTIVE_TRAUMA_LOGS</Text>
            {Object.keys(injuredParts).map(m => (
              <View key={m} style={[styles.card, { borderColor: injuredParts[m].borderColor }]}>
                <View style={styles.cardHead}><Text style={styles.cardTitle}>{m}</Text><Text style={styles.cardDate}>{injuredParts[m].date}</Text></View>
                <Text style={styles.cardInfo}>PAIN_INDEX: {injuredParts[m].level}/10</Text>
                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.btnMain} onPress={() => handleFileUpload(m)}><Text style={styles.btnText}>📁 UPLOAD</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnAlt} onPress={() => { setTargetMuscle(m); setNoteModalVisible(true); }}><Text style={styles.btnTextAlt}>📝 SYMPTOMS</Text></TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.btnMain, { backgroundColor: '#a855f7', marginTop: 10 }]} onPress={() => runAIScan(m)}>
                  <Text style={styles.btnText}>🤖 RUN AI SCAN</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* MODALS */}
      <Modal animationType="slide" transparent visible={modalVisible}>
        <View style={styles.modalBg}><View style={styles.modalBody}>
          <Text style={styles.modalTitle}>// LOG: {activeMuscle}</Text>
          <View style={styles.sliderRow}>{[1,2,3,4,5,6,7,8,9,10].map(i => (
            <TouchableOpacity key={i} onPress={() => setPainLevel(i)} style={[styles.block, { backgroundColor: i <= painLevel ? (i<=3?'#4ade80':i<=6?'#facc15':'#ef4444') : '#1e293b' }]}><Text style={styles.blockText}>{i}</Text></TouchableOpacity>
          ))}</View>
          <TouchableOpacity style={styles.modalSave} onPress={saveInjury}><Text style={styles.saveText}>SAVE</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>ABORT</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal animationType="fade" transparent visible={noteModalVisible}>
        <View style={styles.modalBg}><View style={styles.modalBody}>
          <Text style={styles.modalTitle}>// CLINICAL_ENTRY: {targetMuscle}</Text>
          <TextInput style={styles.textArea} multiline placeholder="Type clinical notes..." placeholderTextColor="#475569" value={noteContent} onChangeText={setNoteContent}/>
          <TouchableOpacity style={[styles.btnAlt, { marginBottom: 15, padding: 15 }]} onPress={() => handleFileUpload(targetMuscle)}>
            <Text style={styles.btnTextAlt}>📎 ATTACH MEDICAL DOCUMENT</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalSave} onPress={savePatientNote}><Text style={styles.saveText}>UPLOAD TEXT</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setNoteModalVisible(false)}><Text style={styles.cancelText}>CANCEL</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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