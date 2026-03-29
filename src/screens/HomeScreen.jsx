import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, NativeModules, Image
} from 'react-native';
import { initMessageRouter, initSentListener, markAsRead } from '../services/MessageRouter';
import { startTracking, stopTracking, sendLocationOnce } from '../services/LocationTracker';
import AudioRecorder from '../services/AudioRecorder';
import { getAllMessages, getProfile, getSavedSubscriptionId } from '../services/Database';

const { SmsSender, OverlayModule } = NativeModules;

export default function HomeScreen({ targetPhone, onOpenProfile }) {
  const [messages,       setMessages]       = useState([]);
  const [inputText,      setInputText]      = useState('');
  const [theirLocation,  setTheirLocation]  = useState(null);
  const [myLocation,     setMyLocation]     = useState(null);
  const [isTracking,     setIsTracking]     = useState(false);
  const [isPressing,     setIsPressing]     = useState(false);
  const [profile,        setProfile]        = useState(null);
  const [subscriptionId, setSubscriptionId] = useState(-1);
  const [overlayActive,  setOverlayActive]  = useState(false);
  const flatListRef = useRef();

  useEffect(() => {
    loadHistory();
    loadProfile();
    loadSubscriptionId();

    const cleanupRouter = initMessageRouter({
      onText:  ({ id, text })        => addMessage({ id, type: 'MSG', payload: text, direction: 'received', status: 'received' }),
      onVoice: ({ id, audioBase64 }) => handleIncomingVoice(id, audioBase64),
      onGps:   ({ id, lat, lng })    => {
        setTheirLocation({ lat, lng });
        addMessage({ id, type: 'GPS', lat, lng, direction: 'received', status: 'received' });
      },
    });

    const cleanupSent = initSentListener();

    return () => {
      cleanupRouter();
      cleanupSent();
    };
  }, []);

  async function loadHistory() {
    const rows = await getAllMessages();
    setMessages(rows.map(normalizeRow));
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }

  async function loadProfile() {
    const p = await getProfile();
    setProfile(p);
  }

  async function loadSubscriptionId() {
    const id = await getSavedSubscriptionId();
    setSubscriptionId(id);
  }

  function normalizeRow(row) {
    return {
      id: row.id, type: row.type, direction: row.direction,
      payload: row.payload, lat: row.lat, lng: row.lng,
      status: row.status, createdAt: row.created_at,
    };
  }

  function addMessage(msg) {
    setMessages(prev => [...prev, { ...msg, createdAt: Date.now() }]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }

  async function handleIncomingVoice(id, audioBase64) {
    const pcmBase64 = await NativeModules.Codec2Module.decode(audioBase64);
    AudioRecorder.play(pcmBase64);
    addMessage({ id, type: 'VOZ', direction: 'received', status: 'received' });
  }

  async function sendText() {
    if (!inputText.trim()) return;
    await SmsSender.sendText(targetPhone, inputText, subscriptionId);
    addMessage({ id: `local-${Date.now()}`, type: 'MSG', payload: inputText, direction: 'sent', status: 'sent' });
    setInputText('');
  }

  async function onPttRelease() {
    setIsPressing(false);
    const audioBase64 = await AudioRecorder.stopAndEncode();
    if (!audioBase64) return;
    await SmsSender.sendVoice(targetPhone, audioBase64, subscriptionId);
    addMessage({ id: `local-${Date.now()}`, type: 'VOZ', direction: 'sent', status: 'sent' });
  }

  useEffect(() => {
    messages
      .filter(m => m.direction === 'received' && m.status === 'received')
      .forEach(m => markAsRead(m.id));
  }, [messages]);

  function toggleTracking() {
    if (isTracking) {
      stopTracking();
      setIsTracking(false);
    } else {
      startTracking({ targetPhone, intervalMs: 15000, onMyLocation: setMyLocation });
      setIsTracking(true);
    }
  }

  function toggleOverlay() {
    if (overlayActive) {
      OverlayModule?.stopOverlay();
      setOverlayActive(false);
    } else {
      OverlayModule?.startOverlay();
      setOverlayActive(true);
    }
  }

  function renderMessage({ item }) {
    const isMe = item.direction === 'sent';
    let content = null;

    if (item.type === 'MSG') {
      content = <Text style={styles.bubbleText}>{item.payload}</Text>;
    } else if (item.type === 'VOZ') {
      content = <Text style={styles.bubbleText}>🎙 Mensagem de voz</Text>;
    } else if (item.type === 'GPS') {
      content = <Text style={styles.bubbleText}>📍 {item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}</Text>;
    } else if (item.type === 'IMG') {
      content = item.payload
        ? <Image source={{ uri: `data:image/jpeg;base64,${item.payload}` }} style={styles.bubbleImage} />
        : <Text style={styles.bubbleText}>🖼 Imagem</Text>;
    }

    return (
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        {content}
        <View style={styles.bubbleMeta}>
          <Text style={styles.bubbleTime}>{formatTime(item.createdAt)}</Text>
          {isMe && (
            <Text style={styles.bubbleStatus}>
              {item.status === 'sending' ? '⏳' : item.status === 'sent' ? '✓' : item.status === 'error' ? '✗' : '✓✓'}
            </Text>
          )}
        </View>
      </View>
    );
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }

  return (
    <View style={styles.container}>

      {/* Cabeçalho */}
      <View style={styles.header}>
        {profile?.contact_avatar_path
          ? <Image source={{ uri: profile.contact_avatar_path }} style={styles.avatar} />
          : <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>?</Text></View>
        }
        <View style={{ flex: 1 }}>
          <Text style={styles.contactName}>{profile?.contact_name ?? targetPhone}</Text>
          <Text style={styles.contactPhone}>{targetPhone}</Text>
        </View>
        <TouchableOpacity onPress={toggleOverlay} style={styles.headerBtn}>
          <Text style={{ fontSize: 20 }}>{overlayActive ? '🟢' : '⚫'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpenProfile} style={styles.headerBtn}>
          <Text style={{ color: '#e94560', fontSize: 20 }}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* GPS */}
      <View style={styles.mapArea}>
        <Text style={styles.mapTitle}>📍 Localizações</Text>
        {myLocation && <Text style={styles.locText}>Você: {myLocation.lat.toFixed(4)}, {myLocation.lng.toFixed(4)}</Text>}
        {theirLocation && <Text style={styles.locText}>{profile?.contact_name ?? 'Contato'}: {theirLocation.lat.toFixed(4)}, {theirLocation.lng.toFixed(4)}</Text>}
        <View style={styles.locationButtons}>
          <TouchableOpacity style={styles.btnSecondary} onPress={toggleTracking}>
            <Text style={styles.btnText}>{isTracking ? '⏹ Parar GPS' : '▶ GPS (15s)'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={() => sendLocationOnce(targetPhone)}>
            <Text style={styles.btnText}>📍 Enviar agora</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        style={styles.chat}
        renderItem={renderMessage}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Digite uma mensagem..."
          placeholderTextColor="#888"
          multiline
        />
        <TouchableOpacity style={styles.btnSend} onPress={sendText}>
          <Text style={styles.btnText}>➤</Text>
        </TouchableOpacity>
      </View>

      {/* PTT */}
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
  container:         { flex: 1, backgroundColor: '#0f0f1a' },
  header:            { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#1a1a2e', gap: 8 },
  avatar:            { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e94560', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:     { color: '#fff', fontWeight: 'bold' },
  contactName:       { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  contactPhone:      { color: '#888', fontSize: 12 },
  headerBtn:         { padding: 4 },
  mapArea:           { padding: 12, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderColor: '#333' },
  mapTitle:          { color: '#e94560', fontWeight: 'bold', marginBottom: 4 },
  locText:           { color: '#ccc', fontSize: 12 },
  locationButtons:   { flexDirection: 'row', gap: 8, marginTop: 8 },
  chat:              { flex: 1, padding: 12 },
  bubble:            { maxWidth: '80%', padding: 10, borderRadius: 12, marginBottom: 8 },
  bubbleMe:          { backgroundColor: '#e94560', alignSelf: 'flex-end' },
  bubbleThem:        { backgroundColor: '#2a2a3e', alignSelf: 'flex-start' },
  bubbleText:        { color: '#fff' },
  bubbleImage:       { width: 120, height: 120, borderRadius: 8 },
  bubbleMeta:        { flexDirection: 'row', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  bubbleTime:        { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  bubbleStatus:      { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  inputRow:          { flexDirection: 'row', padding: 8, gap: 8 },
  input:             { flex: 1, backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  btnSend:           { backgroundColor: '#e94560', borderRadius: 20, padding: 12, justifyContent: 'center' },
  btnSecondary:      { backgroundColor: '#2a2a3e', borderRadius: 8, padding: 8 },
  btnText:           { color: '#fff', fontSize: 12 },
  pttButton:         { margin: 16, backgroundColor: '#e94560', borderRadius: 40, padding: 24, alignItems: 'center' },
  pttActive:         { backgroundColor: '#c0392b', transform: [{ scale: 0.96 }] },
  pttText:           { color: '#fff', fontWeight: 'bold', fontSize: 18 },
});
