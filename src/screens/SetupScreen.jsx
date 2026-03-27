import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, PermissionsAndroid } from 'react-native';

export default function SetupScreen({ onSetupComplete }) {
  const [phone, setPhone] = useState('');

  async function requestPermissions() {
    // Solicita todas as permissões necessárias de uma vez
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);

    // Permissão especial de overlay — abre configurações do sistema
    const { NativeModules } = require('react-native');
    NativeModules.OverlayModule?.requestOverlayPermission();
  }

  async function handleStart() {
    if (!phone.trim()) return;
    await requestPermissions();
    onSetupComplete(phone.trim());
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>☢️ Plugador Atômico</Text>
      <Text style={styles.subtitle}>Comunicação privada. Zero internet.</Text>

      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="Número dela (ex: 11999999999)"
        placeholderTextColor="#888"
        keyboardType="phone-pad"
      />

      <TouchableOpacity style={styles.btn} onPress={handleStart}>
        <Text style={styles.btnText}>Conectar ⚡</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', justifyContent: 'center', padding: 32 },
  title: { color: '#e94560', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#888', textAlign: 'center', marginBottom: 48 },
  input: { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 16 },
  btn: { backgroundColor: '#e94560', borderRadius: 12, padding: 18, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});
