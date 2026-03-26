import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, NativeModules
} from 'react-native';
import { initMessageRouter } from '../services/MessageRouter';
import { startTracking, stopTracking, sendLocationOnce } from '../services/LocationTracker';
import AudioRecorder from '../services/AudioRecorder';

const { SmsSender } = NativeModules;

export default function HomeScreen({ targetPhone }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [theirLocation, setTheirLocation] = useState(null);
  const [myLocation, setMyLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPressing, setIsPressing] = useState(false); // PTT pressionado
  const flatListRef = useRef();

  useEffect(() => {
    // Inicializa o roteador de mensagens — escuta SMS chegando
    const cleanup = initMessageRouter({
      onText: ({ text, sender }) => {
        addMessage({ type: 'text', text, from: 'them' });
      },
      onVoice: async ({ audioBase64 }) => {
        // Descomprime e toca o áudio recebido
        const pcmBase64 = await NativeModules.Codec2Module.decode(audioBase64);
        AudioRecorder.play(pcmBase64);
        addMessage({ type: 'voice', from: 'them' });
      },
      onGps: ({ lat, lng }) => {
        setTheirLocation({ lat, lng });
      }
    });

    return cleanup;
  }, []);

  function addMessage(msg) {
    setMessages(prev => [...prev, { ...msg, id: Date.now().toString() }]);
    setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
  }

  async function sendText() {
    if (!inputText.trim()) return;
    await SmsSender.sendText(targetPhone, inputText);
    addMessage({ type: 'text', text: inputText, from: 'me' });
    setInputText('');
  }

  // PTT — grava enquanto segura, envia quando solta
  async function onPttRelease() {
    setIsPressing(false);
    const audioBase64 = await AudioRecorder.stopAndEncode();
    if (audioBase64) {
      await SmsSender.sendVoice(targetPhone, audioBase64);
      addMessage({ type: 'voice', from: 'me' });
    }
  }

  function toggleTracking() {
    if (isTracking) {
      stopTracking();
      setIsTracking(false);
    } else {
      startTracking({
        targetPhone,
        intervalMs: 15000, // 15 segundos — configurável futuramente
        onMyLocation: setMyLocation
      });
      setIsTracking(true);
    }
  }

  return (
    <View style={styles.container}>

      {/* Mapa simplificado — mostra coordenadas até integrar OpenStreetMap offline */}
      <View style={styles.mapArea}>
        <Text style={styles.mapTitle}>📍 Localizações</Text>
        {myLocation && (
          <Text style={styles.locText}>
            Você: {myLocation.lat.toFixed(4)}, {myLocation.lng.toFixed(4)}
          </Text>
        )}
        {theirLocation && (
          <Text style={styles.locText}>
            Ela: {theirLocation.lat.toFixed(4)}, {theirLocation.lng.toFixed(4)}
          </Text>
        )}
        <View style={styles.locationButtons}>
          <TouchableOpacity style={styles.btnSecondary} onPress={toggleTracking}>
            <Text style={styles.btnText}>
              {isTracking ? '⏹ Parar GPS' : '▶ Iniciar GPS (15s)'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => sendLocationOnce(targetPhone)}>
            <Text style={styles.btnText}>📍 Enviar local agora</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Histórico de mensagens */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        style={styles.chat}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.from === 'me' ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={styles.bubbleText}>
              {item.type === 'voice' ? '🎙 Mensagem de voz' : item.text}
            </Text>
          </View>
        )}
      />

      {/* Input de texto */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Digite uma mensagem..."
          placeholderTextColor="#888"
        />
        <TouchableOpacity style={styles.btnSend} onPress={sendText}>
          <Text style={styles.btnText}>➤</Text>
        </TouchableOpacity>
      </View>

      {/* Botão PTT grande */}
      <TouchableOpacity
        style={[styles.pttButton, isPressing && styles.pttActive]}
        onPressIn={() => { setIsPressing(true); AudioRecorder.start(); }}
        onPressOut={onPttRelease}
        activeOpacity={0.8}>
        <Text style={styles.pttText}>{isPressing ? '🔴 Falando...' : '🎙 Segure pra falar'}</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  mapArea: { padding: 12, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderColor: '#333' },
  mapTitle: { color: '#e94560', fontWeight: 'bold', marginBottom: 4 },
  locText: { color: '#ccc', fontSize: 12 },
  locationButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chat: { flex: 1, padding: 12 },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 12, marginBottom: 8 },
  bubbleMe: { backgroundColor: '#e94560', alignSelf: 'flex-end' },
  bubbleThem: { backgroundColor: '#2a2a3e', alignSelf: 'flex-start' },
  bubbleText: { color: '#fff' },
  inputRow: { flexDirection: 'row', padding: 8, gap: 8 },
  input: { flex: 1, backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 20, paddingHorizontal: 16 },
  btnSend: { backgroundColor: '#e94560', borderRadius: 20, padding: 12, justifyContent: 'center' },
  btnSecondary: { backgroundColor: '#2a2a3e', borderRadius: 8, padding: 8 },
  btnText: { color: '#fff', fontSize: 12 },
  pttButton: { margin: 16, backgroundColor: '#e94560', borderRadius: 40, padding: 24, alignItems: 'center' },
  pttActive: { backgroundColor: '#c0392b', transform: [{ scale: 0.96 }] },
  pttText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});
