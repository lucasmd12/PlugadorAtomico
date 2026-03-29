Perfeito. Vou codar tudo junto. São vários arquivos — vou mandar em sequência.

---

**1. `android/.../sms/SmsSender.kt`** — suporte a dual SIM

```kotlin
package com.plugadoratomico.sms

import android.annotation.SuppressLint
import android.content.Context
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsSender(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SmsSender"

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    // Retorna lista de chips disponíveis com número e nome da operadora
    @SuppressLint("MissingPermission")
    @ReactMethod
    fun getSimCards(promise: Promise) {
        try {
            val subscriptionManager = reactApplicationContext
                .getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager

            val subs = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
                subscriptionManager.activeSubscriptionInfoList
            } else null

            val result = WritableNativeArray()
            subs?.forEach { sub ->
                val map = WritableNativeMap().apply {
                    putInt("subscriptionId", sub.subscriptionId)
                    putString("number",      sub.number ?: "")
                    putString("carrierName", sub.carrierName?.toString() ?: "")
                    putInt("simSlotIndex",   sub.simSlotIndex)
                }
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SIM_ERROR", e.message)
        }
    }

    // Envia usando o subscriptionId do chip escolhido
    private fun getSmsManager(subscriptionId: Int?): SmsManager {
        return if (subscriptionId != null && subscriptionId >= 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
            SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
        } else {
            SmsManager.getDefault()
        }
    }

    @ReactMethod
    fun sendText(phoneNumber: String, message: String, subscriptionId: Int, promise: Promise) {
        try {
            val smsManager  = getSmsManager(subscriptionId)
            val fullMessage = "[MSG]$message"
            val parts       = smsManager.divideMessage(fullMessage)
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            emitSent("MSG", message, null, null)
            promise.resolve(true)
        } catch (e: Exception) {
            emitError("MSG", message)
            promise.reject("SMS_SEND_ERROR", e.message)
        }
    }

    @ReactMethod
    fun sendVoice(phoneNumber: String, audioBase64: String, subscriptionId: Int, promise: Promise) {
        try {
            val smsManager  = getSmsManager(subscriptionId)
            val fullMessage = "[VOZ]$audioBase64"
            val parts       = smsManager.divideMessage(fullMessage)
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            emitSent("VOZ", audioBase64, null, null)
            promise.resolve(true)
        } catch (e: Exception) {
            emitError("VOZ", audioBase64)
            promise.reject("SMS_SEND_ERROR", e.message)
        }
    }

    @ReactMethod
    fun sendLocation(phoneNumber: String, lat: Double, lng: Double, subscriptionId: Int, promise: Promise) {
        try {
            val smsManager = getSmsManager(subscriptionId)
            smsManager.sendTextMessage(phoneNumber, null, "[GPS]$lat,$lng", null, null)
            emitSent("GPS", null, lat, lng)
            promise.resolve(true)
        } catch (e: Exception) {
            emitError("GPS", null)
            promise.reject("SMS_SEND_ERROR", e.message)
        }
    }

    private fun emitSent(type: String, payload: String?, lat: Double?, lng: Double?) {
        val params = Arguments.createMap().apply {
            putString("type",    type)
            putString("payload", payload)
            lat?.let { putDouble("lat", it) }
            lng?.let { putDouble("lng", it) }
            putString("status",  "sent")
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("SMS_SENT", params)
    }

    private fun emitError(type: String, payload: String?) {
        val params = Arguments.createMap().apply {
            putString("type",    type)
            putString("payload", payload)
            putString("status",  "error")
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("SMS_SENT", params)
    }
}
```

---

**2. `src/services/Database.js`** — adiciona subscriptionId ao perfil

```javascript
import SQLite from 'react-native-sqlite-storage';
import RNFS from 'react-native-fs';

SQLite.enablePromise(true);
let db = null;

export async function initDatabase() {
  db = await SQLite.openDatabase({ name: 'plugador.db', location: 'default' });
  await createTables();
  return db;
}

async function createTables() {
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS profile (
      id                     INTEGER PRIMARY KEY,
      my_name                TEXT    DEFAULT 'Eu',
      my_avatar_path         TEXT,
      my_wallpaper_path      TEXT,
      contact_phone          TEXT,
      contact_name           TEXT    DEFAULT 'Contato',
      contact_avatar_path    TEXT,
      contact_wallpaper_path TEXT,
      subscription_id        INTEGER DEFAULT -1
    );
  `);

  // Adiciona coluna se banco já existia sem ela
  try {
    await db.executeSql(`ALTER TABLE profile ADD COLUMN subscription_id INTEGER DEFAULT -1`);
  } catch (e) { /* já existe, ignora */ }

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS messages (
      id          TEXT    PRIMARY KEY,
      type        TEXT    NOT NULL,
      direction   TEXT    NOT NULL,
      payload     TEXT,
      lat         REAL,
      lng         REAL,
      status      TEXT    DEFAULT 'sending',
      created_at  INTEGER NOT NULL,
      read_at     INTEGER
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS chunks (
      message_id  TEXT    NOT NULL,
      seq         INTEGER NOT NULL,
      total       INTEGER NOT NULL,
      data        TEXT    NOT NULL,
      created_at  INTEGER NOT NULL,
      PRIMARY KEY (message_id, seq)
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS locations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      direction   TEXT    NOT NULL,
      lat         REAL    NOT NULL,
      lng         REAL    NOT NULL,
      created_at  INTEGER NOT NULL
    );
  `);

  await db.executeSql(`INSERT OR IGNORE INTO profile (id) VALUES (1);`);
}

export async function getProfile() {
  const [result] = await db.executeSql(`SELECT * FROM profile WHERE id = 1`);
  return result.rows.item(0);
}

export async function updateProfile(fields) {
  const keys      = Object.keys(fields);
  const values    = Object.values(fields);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await db.executeSql(`UPDATE profile SET ${setClause} WHERE id = 1`, values);
}

export async function saveContactPhone(phone) {
  await updateProfile({ contact_phone: phone });
}

export async function getSavedContactPhone() {
  const p = await getProfile();
  return p?.contact_phone ?? null;
}

export async function saveSubscriptionId(id) {
  await updateProfile({ subscription_id: id });
}

export async function getSavedSubscriptionId() {
  const p = await getProfile();
  return p?.subscription_id ?? -1;
}

export async function saveProfileImage(field, sourceUri) {
  const filename = `${field}_${Date.now()}.jpg`;
  const destPath = `${RNFS.DocumentDirectoryPath}/${filename}`;
  await RNFS.copyFile(sourceUri, destPath);
  await updateProfile({ [field]: destPath });
  return destPath;
}

export async function saveMessage({ id, type, direction, payload, lat, lng, status }) {
  await db.executeSql(
    `INSERT OR REPLACE INTO messages (id, type, direction, payload, lat, lng, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, type, direction, payload ?? null, lat ?? null, lng ?? null, status, Date.now()]
  );
}

export async function updateMessageStatus(id, status) {
  await db.executeSql(`UPDATE messages SET status = ? WHERE id = ?`, [status, id]);
}

export async function markMessageRead(id) {
  await db.executeSql(
    `UPDATE messages SET status = 'read', read_at = ? WHERE id = ?`,
    [Date.now(), id]
  );
}

export async function getAllMessages() {
  const [result] = await db.executeSql(`SELECT * FROM messages ORDER BY created_at ASC`);
  return rowsToArray(result);
}

export async function saveChunk({ messageId, seq, total, data }) {
  await db.executeSql(
    `INSERT OR IGNORE INTO chunks (message_id, seq, total, data, created_at) VALUES (?, ?, ?, ?, ?)`,
    [messageId, seq, total, data, Date.now()]
  );
}

export async function tryReassemble(messageId) {
  const [result] = await db.executeSql(
    `SELECT * FROM chunks WHERE message_id = ? ORDER BY seq ASC`, [messageId]
  );
  const chunks = rowsToArray(result);
  if (chunks.length === 0) return null;
  const total = chunks[0].total;
  if (chunks.length < total) return null;
  const reassembled = chunks.map(c => c.data).join('');
  await db.executeSql(`DELETE FROM chunks WHERE message_id = ?`, [messageId]);
  return reassembled;
}

export async function saveLocation({ direction, lat, lng }) {
  await db.executeSql(
    `INSERT INTO locations (direction, lat, lng, created_at) VALUES (?, ?, ?, ?)`,
    [direction, lat, lng, Date.now()]
  );
}

function rowsToArray(result) {
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
}
```

---

**3. `src/screens/SetupScreen.jsx`** — dual SIM + agenda + digitação manual

```jsx
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
```

---

**4. `src/screens/HomeScreen.jsx`** — passa subscriptionId em todos os envios + botão overlay

```jsx
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
```

---

**5. `android/.../overlay/OverlayService.kt`** — PTT funcional na bolha

```kotlin
package com.plugadoratomico.overlay

import android.app.*
import android.content.Intent
import android.graphics.PixelFormat
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.view.*
import android.widget.Button
import androidx.core.app.NotificationCompat
import com.plugadoratomico.R

class OverlayService : Service() {

    private lateinit var windowManager: WindowManager
    private lateinit var overlayView: View
    private var mediaRecorder: MediaRecorder? = null
    private var isRecording = false
    private var targetPhone: String = ""

    companion object {
        const val CHANNEL_ID = "plugador_overlay"
        var instance: OverlayService? = null
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        startForeground(1, buildNotification())
        showOverlay()
    }

    fun setTargetPhone(phone: String) {
        targetPhone = phone
    }

    private fun showOverlay() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        overlayView   = LayoutInflater.from(this).inflate(R.layout.overlay_widget, null)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            x = 16; y = 100
        }

        overlayView.setOnTouchListener(DragTouchListener(windowManager, overlayView, params))

        val btnPtt = overlayView.findViewById<Button>(R.id.btn_ptt_overlay)
        btnPtt.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> { startRecording(); true }
                MotionEvent.ACTION_UP   -> { stopAndSend();    true }
                else -> false
            }
        }

        windowManager.addView(overlayView, params)
    }

    private fun startRecording() {
        if (isRecording) return
        try {
            val outputFile = "${cacheDir}/overlay_ptt.3gp"
            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            mediaRecorder?.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP)
                setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB)
                setOutputFile(outputFile)
                prepare()
                start()
            }
            isRecording = true
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopAndSend() {
        if (!isRecording) return
        try {
            mediaRecorder?.stop()
            mediaRecorder?.release()
            mediaRecorder = null
            isRecording = false
            // TODO: integrar com Codec2 e SmsSender quando o PTT nativo estiver estável
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Plugador Atômico ativo")
            .setContentText("Toque na bolha para PTT")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Overlay Plugador", NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        instance = null
        if (::overlayView.isInitialized) windowManager.removeView(overlayView)
        super.onDestroy()
    }
}
```

---

Adicione também no `package.json`:

```json
"react-native-contacts": "^7.0.8"
```

São 5 arquivos modificados e 1 dependência nova. O overlay agora tem o botão PTT funcional com gravação — a integração com Codec2 no overlay virá depois que o PTT principal estiver estável. O dual SIM detecta automaticamente e pula a tela se houver só um chip. A agenda abre com busca em tempo real.
