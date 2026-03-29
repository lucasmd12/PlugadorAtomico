import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, PermissionsAndroid, FlatList, NativeModules
} from 'react-native';
import Contacts from 'react-native-contacts';
import { saveSubscriptionId } from '../services/Database';

const { SmsSender } = NativeModules;

export default function SetupScreen({ onSetupComplete }) {
  const [phone,       setPhone]       = useState('');
  const [simCards,    setSimCards]    = useState([]);
  const [selectedSim, setSelectedSim] = useState(null);
  const [step,        setStep]        = useState('sim'); // 'sim' | 'contact'
  const [contacts,    setContacts]    = useState([]);
  const [search,      setSearch]      = useState('');
  const [showAgenda,  setShowAgenda]  = useState(false);

  useEffect(() => {
    loadSimCards();
  }, []);

  async function loadSimCards() {
    try {
      const sims = await SmsSender.getSimCards();
      setSimCards(sims);
      if (sims.length === 1) {
        // Só um chip — seleciona automaticamente e avança
        setSelectedSim(sims[0]);
        setStep('contact');
      }
    } catch (e) {
      // Sem permissão ou erro — pula seleção de SIM
      setStep('contact');
    }
  }

  async function openAgenda() {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        const all = await Contacts.getAll();
        setContacts(all);
        setShowAgenda(true);
      }
    } catch (e) {
      console.error('Erro ao abrir agenda:', e);
    }
  }

  function selectContact(contact) {
    const number = contact.phoneNumbers?.[0]?.number?.replace(/\D/g, '') ?? '';
    setPhone(number);
    setShowAgenda(false);
  }

  async function requestPermissions() {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
    ]);
    NativeModules.OverlayModule?.requestOverlayPermission();
  }

  async function handleStart() {
    if (!phone.trim()) return;
    await requestPermissions();
    if (selectedSim) {
      await saveSubscriptionId(selectedSim.subscriptionId);
    }
    onSetupComplete(phone.trim());
  }

  function selectSim(sim) {
    setSelectedSim(sim);
    setStep('contact');
  }

  const filteredContacts = contacts.filter(c =>
    c.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    c.phoneNumbers?.some(p => p.number?.includes(search))
  );

  // ── Tela de seleção de SIM ─────────────────────────────────────────────────
  if (step === 'sim') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>☢️ Plugador Atômico</Text>
        <Text style={styles.subtitle}>Qual chip deseja usar para enviar mensagens?</Text>

        {simCards.map((sim, i) => (
          <TouchableOpacity
            key={sim.subscriptionId}
            style={styles.simCard}
            onPress={() => selectSim(sim)}>
            <Text style={styles.simSlot}>SIM {sim.simSlotIndex + 1}</Text>
            <Text style={styles.simNumber}>
              {sim.number || 'Número não disponível'}
            </Text>
            <Text style={styles.simCarrier}>{sim.carrierName}</Text>
          </TouchableOpacity>
        ))}

        {simCards.length === 0 && (
          <TouchableOpacity style={styles.btn} onPress={() => setStep('contact')}>
            <Text style={styles.btnText}>Continuar →</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Agenda de contatos ─────────────────────────────────────────────────────
  if (showAgenda) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setShowAgenda(false)} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar contato..."
          placeholderTextColor="#888"
        />
        <FlatList
          data={filteredContacts}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.contactItem} onPress={() => selectContact(item)}>
              <Text style={styles.contactName}>{item.displayName}</Text>
              <Text style={styles.contactNumber}>
                {item.phoneNumbers?.[0]?.number ?? ''}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // ── Tela de contato ────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={styles.title}>☢️ Plugador Atômico</Text>
      {selectedSim && (
        <View style={styles.simBadge}>
          <Text style={styles.simBadgeText}>
            📶 SIM {selectedSim.simSlotIndex + 1} — {selectedSim.carrierName}
          </Text>
          <TouchableOpacity onPress={() => setStep('sim')}>
            <Text style={styles.changeText}>Trocar</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.subtitle}>Com quem quer se comunicar?</Text>

      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Número (ex: 11999999999)"
        placeholderTextColor="#888"
        keyboardType="phone-pad"
      />

      <TouchableOpacity style={styles.btnSecondary} onPress={openAgenda}>
        <Text style={styles.btnSecondaryText}>📒 Escolher da agenda</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, !phone.trim() && styles.btnDisabled]}
        onPress={handleStart}
        disabled={!phone.trim()}>
        <Text style={styles.btnText}>Conectar ⚡</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0f0f1a', justifyContent: 'center', padding: 32 },
  title:            { color: '#e94560', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle:         { color: '#888', textAlign: 'center', marginBottom: 24 },
  simCard:          { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  simSlot:          { color: '#e94560', fontWeight: 'bold', fontSize: 12, marginBottom: 4 },
  simNumber:        { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  simCarrier:       { color: '#888', fontSize: 13, marginTop: 2 },
  simBadge:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 8, padding: 10, marginBottom: 16 },
  simBadgeText:     { color: '#ccc', fontSize: 13 },
  changeText:       { color: '#e94560', fontSize: 13 },
  input:            { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 12 },
  btn:              { backgroundColor: '#e94560', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 8 },
  btnDisabled:      { opacity: 0.4 },
  btnText:          { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  btnSecondary:     { backgroundColor: '#2a2a3e', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 8 },
  btnSecondaryText: { color: '#ccc', fontSize: 15 },
  backBtn:          { marginBottom: 16 },
  backText:         { color: '#e94560', fontSize: 16 },
  contactItem:      { padding: 16, borderBottomWidth: 1, borderColor: '#1a1a2e' },
  contactName:      { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  contactNumber:    { color: '#888', fontSize: 13 },
});
