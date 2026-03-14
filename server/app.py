import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, Modal, TextInput } from 'react-native';

// Web-safe body parts list
const BODY_PARTS = ['Head', 'Shoulders', 'Chest', 'Back', 'Left Arm', 'Right Arm', 'Left Leg', 'Right Leg', 'Knees'];

export default function App() {
  const [injuredParts, setInjuredParts] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [activeMuscle, setActiveMuscle] = useState(null);
  const [painLevel, setPainLevel] = useState('');

  const handlePress = (part) => {
    setActiveMuscle(part);
    setModalVisible(true);
  };

  const saveInjury = () => {
    const level = parseInt(painLevel);
    let color = '#e2e8f0'; // default gray
    if (level >= 1 && level <= 3) color = '#4ade80'; // green
    if (level >= 4 && level <= 6) color = '#facc15'; // yellow
    if (level >= 7 && level <= 10) color = '#ef4444'; // red

    setInjuredParts({ ...injuredParts, [activeMuscle]: { level, color } });
    setModalVisible(false);
    setPainLevel('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recovery Tracker</Text>
        <Text style={styles.subtitle}>Tap the area that hurts</Text>
      </View>

      <View style={styles.grid}>
        {BODY_PARTS.map((part) => {
          const partData = injuredParts[part];
          const bgColor = partData ? partData.color : '#ffffff';
          
          return (
            <TouchableOpacity 
              key={part} 
              style={[styles.card, { backgroundColor: bgColor }]} 
              onPress={() => handlePress(part)}
            >
              <Text style={styles.cardText}>{part}</Text>
              {partData && <Text style={styles.scoreText}>Pain: {partData.level}/10</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal animationType="fade" transparent={true} visible={modalVisible}>
        <View style={styles.modalBackground}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Log: {activeMuscle}</Text>
            <Text style={styles.modalLabel}>Pain Level (1-10):</Text>
            <TextInput 
              style={styles.input} keyboardType="numeric" 
              placeholder="e.g. 7" value={painLevel} onChangeText={setPainLevel}
            />
            <TouchableOpacity style={styles.saveButton} onPress={saveInjury}>
              <Text style={styles.buttonText}>Save Log</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 16, color: '#64748b', marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', padding: 10 },
  card: { width: '45%', margin: '2.5%', padding: 20, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardText: { fontSize: 18, fontWeight: '600', color: '#334155' },
  scoreText: { marginTop: 8, fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  modalBackground: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalView: { margin: 20, backgroundColor: 'white', padding: 25, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.25, elevation: 5 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 15 },
  modalLabel: { fontSize: 16, marginBottom: 5 },
  input: { borderBottomWidth: 1, borderColor: '#ccc', fontSize: 18, marginBottom: 20, paddingVertical: 10 },
  saveButton: { backgroundColor: '#3b82f6', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  cancelText: { color: '#ef4444', fontSize: 16, textAlign: 'center' }
});