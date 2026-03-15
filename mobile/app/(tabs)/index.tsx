import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
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
  const [injuredParts, setInjuredParts] = useState({});
  const [isFrontView, setIsFrontView] = useState(true);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  const [activeMuscle, setActiveMuscle] = useState(null);
  const [painLevel, setPainLevel] = useState(1);
  const [noteContent, setNoteContent] = useState('');
  const [targetMuscle, setTargetMuscle] = useState('');
  
  const [zipQuery, setZipQuery] = useState('');
  const [insuranceQuery, setInsuranceQuery] = useState('');
  const [matchedClinics, setMatchedClinics] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const [streamUrl, setStreamUrl] = useState("http://localhost:5001/video_feed");
  const [scanTimer, setScanTimer] = useState(null);
  const timerRef = useRef(null);
  
  // NEW: State to hold the AI Report and Graph Data!
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => { fetchInjuries(); }, []);

  const fetchInjuries = async () => {
    const { data } = await supabase.from('injury_logs').select('*').order('created_at', { ascending: false });
    if (data) {
      const loadedParts = {};
      data.forEach(log => {
        if (!loadedParts[log.muscle]) loadedParts[log.muscle] = { level: log.pain_level, color: log.color, borderColor: log.border_color, date: new Date(log.created_at).toLocaleDateString() };
      });
      setInjuredParts(loadedParts);
    }
  };

  const saveInjury = async () => {
    let color = 'rgba(6, 182, 212, 0.1)'; let borderColor = '#06b6d4'; 
    if (painLevel <= 3) { color = 'rgba(74, 222, 128, 0.4)'; borderColor = '#4ade80'; } 
    else if (painLevel <= 6) { color = 'rgba(250, 204, 21, 0.4)'; borderColor = '#facc15'; } 
    else { color = 'rgba(239, 68, 68, 0.5)'; borderColor = '#ef4444'; } 
    setInjuredParts({ ...injuredParts, [activeMuscle]: { level: painLevel, color, borderColor, date: 'Saving...' } });
    setModalVisible(false);
    await supabase.from('injury_logs').insert([{ muscle: activeMuscle, pain_level: painLevel, color, border_color: borderColor }]);
    fetchInjuries();
  };

  const savePatientNote = async () => {
    await supabase.from('patient_notes').insert([{ muscle_group: targetMuscle, content: noteContent }]);
    alert("Success: Note uploaded to clinical record.");
    setNoteModalVisible(false); setNoteContent('');
  };

  const handleFileUpload = async (muscle) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      await supabase.storage.from('patient_files').upload(`uploads/${muscle}_${Date.now()}_${file.name}`, decode(base64), { contentType: file.mimeType });
      alert(`Upload Complete: ${file.name} saved to Supabase.`);
    } catch (err) { alert("Upload Failed: " + err.message); }
  };

  const startScanner = (muscle) => {
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
      const response = await fetch('http://localhost:5001/analyze-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ muscle: activeMuscle })
      });
      const data = await response.json();
      
      // OPTIMIZATION: Instead of an alert, we load the Dashboard!
      setScanResult(data);
    } catch (err) {
      alert("AI Server Offline. Ensure python server.py is running on port 5001.");
    }
  };

  const abortScan = () => {
    clearInterval(timerRef.current);
    setScanTimer(null);
    setCameraActive(false);
  };

  const findClinics = () => {
    setHasSearched(true);
    setMatchedClinics(CLINIC_DB.filter(c => c.insurance.some(i => i.toLowerCase().includes(insuranceQuery.toLowerCase())) && (zipQuery === '' || c.zip === zipQuery)));
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
                  <TouchableOpacity style={styles.btnMain} onPress={() => handleFileUpload(m)}><Text style={styles.btnText}>📁 UPLOAD DOCS</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.btnAlt} onPress={() => { setTargetMuscle(m); setNoteModalVisible(true); }}><Text style={styles.btnTextAlt}>📝 SYMPTOMS</Text></TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.btnMain, { backgroundColor: '#a855f7', marginTop: 10 }]} onPress={() => startScanner(m)}>
                  <Text style={[styles.btnText, { color: '#fff' }]}>🤖 RUN AI MOBILITY SCAN</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

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

      {/* NEW: THE AI TELEMETRY DASHBOARD MODAL */}
      <Modal animationType="fade" transparent visible={!!scanResult}>
        <View style={styles.modalBg}>
          <View style={[styles.modalBody, {height: '85%'}]}>
            <Text style={styles.modalTitle}>// AI_CLINICAL_REPORT: {scanResult?.muscle}</Text>
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
              <Text style={{color: '#fff', fontSize: 22, fontWeight: '900'}}>PEAK ROM: {scanResult?.angle}°</Text>
              <Text style={{color: '#64748b', fontSize: 10}}>SAMPLES: {scanResult?.data_points}</Text>
            </View>

            {/* THE DYNAMIC BAR CHART */}
            <Text style={[styles.sectionTitle, {fontSize: 12, marginTop: 20}]}>// RAW_TELEMETRY_DATA</Text>
            <View style={styles.chartContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{alignItems: 'flex-end', paddingHorizontal: 10}}>
                {scanResult?.raw_data?.map((val, idx) => (
                  <View key={idx} style={{
                    width: 4,
                    height: (val / 180) * 130, // Math to keep the bars fitting inside the box
                    backgroundColor: val === scanResult?.angle ? '#ef4444' : '#06b6d4', // Highlights the Peak Angle in Red!
                    marginHorizontal: 1,
                    borderTopLeftRadius: 2,
                    borderTopRightRadius: 2,
                  }} />
                ))}
              </ScrollView>
            </View>
            <Text style={{color: '#475569', fontSize: 10, textAlign: 'center', marginTop: 5, marginBottom: 15}}>FILE ARCHIVED: {scanResult?.filename}</Text>

            <Text style={{color: '#94a3b8', lineHeight: 22}}>{scanResult?.message}</Text>

            <TouchableOpacity style={[styles.modalSave, {marginTop: 'auto'}]} onPress={() => setScanResult(null)}>
              <Text style={styles.saveText}>ACKNOWLEDGE & CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* THE LIVE YOLO CAMERA MODAL */}
      <Modal animationType="slide" transparent visible={cameraActive}>
        <View style={styles.modalBg}>
          <View style={[styles.modalBody, {height: '75%'}]}>
            <Text style={styles.modalTitle}>// LIVE_YOLO_FEED: {activeMuscle}</Text>
            
            <View style={styles.viewfinder}>
              {cameraActive && (
                <img src={streamUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="AI Vision Stream" />
              )}
            </View>
            
            {scanTimer === null ? (
              <TouchableOpacity style={[styles.modalSave, {backgroundColor: '#ef4444'}]} onPress={beginRecordingSession}>
                <Text style={[styles.saveText, {color: '#fff'}]}>🔴 START 15-SECOND RECORDING</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.modalSave, {backgroundColor: '#1e293b'}]}>
                <Text style={[styles.saveText, {color: '#ef4444', fontSize: 18}]}>RECORDING... {scanTimer}s</Text>
              </View>
            )}
            
            <TouchableOpacity onPress={abortScan}><Text style={styles.cancelText}>ABORT SCAN</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

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

      {/* NOTES MODAL */}
      <Modal animationType="fade" transparent visible={noteModalVisible}>
        <View style={styles.modalBg}><View style={styles.modalBody}>
          <Text style={styles.modalTitle}>// CLINICAL_ENTRY: {targetMuscle}</Text>
          <TextInput style={styles.textArea} multiline placeholder="Type clinical notes..." placeholderTextColor="#475569" value={noteContent} onChangeText={setNoteContent}/>
          <TouchableOpacity style={styles.modalSave} onPress={savePatientNote}><Text style={styles.saveText}>UPLOAD TEXT TO CLOUD</Text></TouchableOpacity>
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
  inputRow: { flexDirection: 'row', marginBottom: 10 },
  input: { backgroundColor: '#0f172a', borderBottomWidth: 2, borderColor: '#06b6d4', color: '#fff', padding: 12, borderRadius: 4 },
  scanBtn: { backgroundColor: '#38bdf8', padding: 12, borderRadius: 4, alignItems: 'center' },
  scanBtnText: { fontWeight: '900', color: '#020617' },
  clinicCard: { backgroundColor: '#0f172a', padding: 12, marginTop: 5, borderRadius: 4 },
  clinicName: { color: '#fff', fontWeight: 'bold' },
  clinicDetails: { color: '#94a3b8', fontSize: 12 },
  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalBody: { backgroundColor: '#0f172a', padding: 25, borderTopWidth: 2, borderColor: '#06b6d4' },
  modalTitle: { color: '#06b6d4', fontWeight: '900', marginBottom: 20 },
  viewfinder: { width: '100%', height: 350, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  chartContainer: { height: 140, backgroundColor: '#020617', borderRadius: 8, borderWidth: 1, borderColor: '#334155', marginTop: 10, paddingVertical: 10, justifyContent: 'flex-end' },
  sliderRow: { flexDirection: 'row', marginBottom: 20 },
  block: { flex: 1, height: 35, marginHorizontal: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  blockText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  modalSave: { backgroundColor: '#06b6d4', padding: 15, alignItems: 'center', borderRadius: 4, marginBottom: 10, marginTop: 15 },
  saveText: { fontWeight: 'bold', color: '#020617' },
  cancelText: { color: '#ef4444', textAlign: 'center', fontSize: 12, marginTop: 10 },
  textArea: { backgroundColor: '#020617', color: '#fff', padding: 15, height: 100, borderRadius: 4, marginBottom: 20, textAlignVertical: 'top' }
});