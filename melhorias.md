Vou resolver tudo de uma vez. São vários arquivos — vou mandar um por um em sequência.

---

**1. `android/.../sms/SmsReceiver.kt`** — remove a permission bloqueante

```kotlin
package com.plugadoratomico.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        val fullBody = messages.joinToString("") { it.messageBody }
        val sender   = messages.first().originatingAddress ?: ""

        if (!fullBody.startsWith("[MSG]") &&
            !fullBody.startsWith("[VOZ]") &&
            !fullBody.startsWith("[GPS]") &&
            !fullBody.startsWith("[IMG]")) return

        abortBroadcast()

        val reactApp     = context.applicationContext as? ReactApplication
        val reactContext = reactApp?.reactNativeHost?.reactInstanceManager?.currentReactContext

        if (reactContext != null) {
            val params = Arguments.createMap().apply {
                putString("body",   fullBody)
                putString("sender", sender)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("SMS_RECEIVED", params)
        } else {
            SmsQueue.add(fullBody, sender)
        }
    }
}
```

---

**2. `AndroidManifest.xml`** — remove a permission do receiver e adiciona permissão de SMS padrão

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.SEND_SMS"/>
    <uses-permission android:name="android.permission.RECEIVE_SMS"/>
    <uses-permission android:name="android.permission.READ_SMS"/>
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
    <uses-permission android:name="android.permission.RECORD_AUDIO"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE"/>
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>

    <application
        android:name=".MainApplication"
        android:label="Plugador Atômico"
        android:allowBackup="false"
        android:theme="@style/AppTheme">

        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>

        <service
            android:name=".overlay.OverlayService"
            android:exported="false"
            android:foregroundServiceType="specialUse"/>

        <service
            android:name=".gps.GpsService"
            android:exported="false"
            android:foregroundServiceType="location"/>

        <!-- SEM android:permission aqui — era isso que bloqueava o recebimento -->
        <receiver
            android:name=".sms.SmsReceiver"
            android:exported="true">
            <intent-filter android:priority="999">
                <action android:name="android.provider.Telephony.SMS_RECEIVED"/>
            </intent-filter>
        </receiver>

    </application>
</manifest>
```

---

**3. `android/.../sms/SmsSender.kt`** — adiciona addListener/removeListeners obrigatórios

```kotlin
package com.plugadoratomico.sms

import android.telephony.SmsManager
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsSender(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SmsSender"

    // Obrigatório para NativeEventEmitter funcionar no RN 0.73
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    @ReactMethod
    fun sendText(phoneNumber: String, message: String, promise: Promise) {
        try {
            val smsManager = SmsManager.getDefault()
            val fullMessage = "[MSG]$message"
            val parts = smsManager.divideMessage(fullMessage)
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            emitSent("MSG", message, null, null)
            promise.resolve(true)
        } catch (e: Exception) {
            emitError("MSG", message)
            promise.reject("SMS_SEND_ERROR", e.message)
        }
    }

    @ReactMethod
    fun sendVoice(phoneNumber: String, audioBase64: String, promise: Promise) {
        try {
            val smsManager = SmsManager.getDefault()
            val fullMessage = "[VOZ]$audioBase64"
            val parts = smsManager.divideMessage(fullMessage)
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            emitSent("VOZ", audioBase64, null, null)
            promise.resolve(true)
        } catch (e: Exception) {
            emitError("VOZ", audioBase64)
            promise.reject("SMS_SEND_ERROR", e.message)
        }
    }

    @ReactMethod
    fun sendLocation(phoneNumber: String, lat: Double, lng: Double, promise: Promise) {
        try {
            val smsManager = SmsManager.getDefault()
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
            putString("type", type)
            putString("payload", payload)
            lat?.let { putDouble("lat", it) }
            lng?.let { putDouble("lng", it) }
            putString("status", "sent")
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("SMS_SENT", params)
    }

    private fun emitError(type: String, payload: String?) {
        val params = Arguments.createMap().apply {
            putString("type", type)
            putString("payload", payload)
            putString("status", "error")
        }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("SMS_SENT", params)
    }
}
```

---

**4. `android/.../gps/GpsService.kt`** — corrige o foreground service

```kotlin
package com.plugadoratomico.gps

import android.app.*
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.IBinder
import android.telephony.SmsManager
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class GpsService : Service(), LocationListener {

    companion object {
        const val CHANNEL_ID = "plugador_gps"
    }

    private lateinit var locationManager: LocationManager
    private var targetPhone: String = ""
    private var intervalMs: Long = 15000

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        // startForeground deve ser chamado AQUI em onCreate, não em onStartCommand
        startForeground(2, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        targetPhone = intent?.getStringExtra("targetPhone") ?: ""
        intervalMs  = intent?.getLongExtra("intervalMs", 15000) ?: 15000

        val singleUpdate = intent?.getBooleanExtra("singleUpdate", false) ?: false

        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager

        try {
            if (singleUpdate) {
                locationManager.requestSingleUpdate(LocationManager.GPS_PROVIDER, this, null)
            } else {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    intervalMs,
                    0f,
                    this
                )
            }
        } catch (e: SecurityException) {
            stopSelf()
        }

        return START_STICKY
    }

    override fun onLocationChanged(location: Location) {
        val lat = location.latitude
        val lng = location.longitude

        if (targetPhone.isNotEmpty()) {
            try {
                SmsManager.getDefault().sendTextMessage(
                    targetPhone, null, "[GPS]$lat,$lng", null, null
                )
            } catch (e: Exception) { }
        }

        val reactApp     = applicationContext as? ReactApplication ?: return
        val reactContext = reactApp.reactNativeHost.reactInstanceManager.currentReactContext ?: return
        val params = Arguments.createMap().apply {
            putDouble("lat", lat)
            putDouble("lng", lng)
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("MY_LOCATION_UPDATED", params)
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Plugador Atômico")
            .setContentText("GPS ativo")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "GPS Plugador", NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        if (::locationManager.isInitialized) locationManager.removeUpdates(this)
        super.onDestroy()
    }
}
```

---

**5. `src/services/Database.js`** — adiciona persistência do número configurado

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
      id                    INTEGER PRIMARY KEY,
      my_name               TEXT    DEFAULT 'Eu',
      my_avatar_path        TEXT,
      my_wallpaper_path     TEXT,
      contact_phone         TEXT,
      contact_name          TEXT    DEFAULT 'Contato',
      contact_avatar_path   TEXT,
      contact_wallpaper_path TEXT
    );
  `);

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

// ─── PERFIL ───────────────────────────────────────────────────────────────────

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

// Salva o número configurado — persiste entre sessões
export async function saveContactPhone(phone) {
  await updateProfile({ contact_phone: phone });
}

// Recupera o número salvo — usado no App.jsx ao iniciar
export async function getSavedContactPhone() {
  const profile = await getProfile();
  return profile?.contact_phone ?? null;
}

export async function saveProfileImage(field, sourceUri) {
  const filename = `${field}_${Date.now()}.jpg`;
  const destPath = `${RNFS.DocumentDirectoryPath}/${filename}`;

  // Trata URI content:// do Xiaomi e outros Android modernos
  const cleanUri = sourceUri.startsWith('content://')
    ? sourceUri
    : sourceUri.replace('file://', '');

  await RNFS.copyFile(cleanUri, destPath);
  await updateProfile({ [field]: destPath });
  return destPath;
}

// ─── MENSAGENS ────────────────────────────────────────────────────────────────

export async function saveMessage({ id, type, direction, payload, lat, lng, status }) {
  await db.executeSql(
    `INSERT OR REPLACE INTO messages
       (id, type, direction, payload, lat, lng, status, created_at)
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
  const [result] = await db.executeSql(
    `SELECT * FROM messages ORDER BY created_at ASC`
  );
  return rowsToArray(result);
}

// ─── CHUNKS ───────────────────────────────────────────────────────────────────

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

// ─── LOCALIZAÇÃO ──────────────────────────────────────────────────────────────

export async function saveLocation({ direction, lat, lng }) {
  await db.executeSql(
    `INSERT INTO locations (direction, lat, lng, created_at) VALUES (?, ?, ?, ?)`,
    [direction, lat, lng, Date.now()]
  );
}

export async function getLocationHistory(direction = 'received', limit = 500) {
  const [result] = await db.executeSql(
    `SELECT * FROM locations WHERE direction = ? ORDER BY created_at DESC LIMIT ?`,
    [direction, limit]
  );
  return rowsToArray(result);
}

// ─── UTILITÁRIO ───────────────────────────────────────────────────────────────

function rowsToArray(result) {
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
}
```

---

**6. `App.jsx`** — recupera número salvo automaticamente

```jsx
import React, { useState, useEffect } from 'react';
import SetupScreen   from './src/screens/SetupScreen';
import HomeScreen    from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { initDatabase, getSavedContactPhone, saveContactPhone } from './src/services/Database';

export default function App() {
  const [ready,       setReady]       = useState(false);
  const [targetPhone, setTargetPhone] = useState(null);
  const [screen,      setScreen]      = useState('home');

  useEffect(() => {
    initDatabase()
      .then(() => getSavedContactPhone())
      .then(phone => {
        if (phone) setTargetPhone(phone);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  async function handleSetupComplete(phone) {
    await saveContactPhone(phone);
    setTargetPhone(phone);
  }

  if (!ready) return null;

  if (!targetPhone) {
    return <SetupScreen onSetupComplete={handleSetupComplete} />;
  }
  if (screen === 'profile') {
    return <ProfileScreen onBack={() => setScreen('home')} />;
  }
  return (
    <HomeScreen
      targetPhone={targetPhone}
      onOpenProfile={() => setScreen('profile')}
    />
  );
}
```

---

**7. `src/services/MessageRouter.js`** — corrige o NativeEventEmitter

```javascript
import { NativeEventEmitter, NativeModules } from 'react-native';
import {
  saveMessage, saveChunk, tryReassemble,
  saveLocation, markMessageRead,
} from './Database';

const { SmsSender, SmsModule } = NativeModules;

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function initMessageRouter({ onText, onVoice, onGps }) {
  // DeviceEventEmitter direto — evita o bug do NativeEventEmitter sem addListener
  const { DeviceEventEmitter } = require('react-native');

  const subscription = DeviceEventEmitter.addListener('SMS_RECEIVED', (event) => {
    handleIncoming(event.body, event.sender, { onText, onVoice, onGps });
  });

  SmsModule?.getPendingMessages().then(pending => {
    pending?.forEach(msg =>
      handleIncoming(msg.body, msg.sender, { onText, onVoice, onGps })
    );
  });

  return () => subscription.remove();
}

export function initSentListener() {
  const { DeviceEventEmitter } = require('react-native');

  const subscription = DeviceEventEmitter.addListener('SMS_SENT', async (event) => {
    const id = generateId();
    await saveMessage({
      id,
      type:      event.type,
      direction: 'sent',
      payload:   event.payload ?? null,
      lat:       event.lat    ?? null,
      lng:       event.lng    ?? null,
      status:    event.status,
    });

    if (event.type === 'GPS' && event.status === 'sent') {
      await saveLocation({ direction: 'sent', lat: event.lat, lng: event.lng });
    }
  });

  return () => subscription.remove();
}

async function handleIncoming(body, sender, { onText, onVoice, onGps }) {
  if (body.startsWith('[MSG]')) {
    const text = body.replace('[MSG]', '');
    const id   = generateId();
    await saveMessage({ id, type: 'MSG', direction: 'received', payload: text, status: 'received' });
    onText({ id, text, sender });

  } else if (body.startsWith('[VOZ]')) {
    const raw = body.replace('[VOZ]', '');
    await handleChunked(raw, 'VOZ', async (payload) => {
      const id = generateId();
      await saveMessage({ id, type: 'VOZ', direction: 'received', payload, status: 'received' });
      onVoice({ id, audioBase64: payload, sender });
    });

  } else if (body.startsWith('[GPS]')) {
    const raw = body.replace('[GPS]', '');
    const [lat, lng] = raw.split(',').map(parseFloat);
    const id = generateId();
    await saveMessage({ id, type: 'GPS', direction: 'received', lat, lng, status: 'received' });
    await saveLocation({ direction: 'received', lat, lng });
    onGps({ id, lat, lng, sender });

  } else if (body.startsWith('[IMG]')) {
    const raw = body.replace('[IMG]', '');
    await handleChunked(raw, 'IMG', async (payload) => {
      const id = generateId();
      await saveMessage({ id, type: 'IMG', direction: 'received', payload, status: 'received' });
    });
  }
}

async function handleChunked(raw, type, onComplete) {
  if (!raw.startsWith('id=')) {
    await onComplete(raw);
    return;
  }
  const [idPart, seqPart, ...rest] = raw.split('|');
  const messageId = idPart.replace('id=', '');
  const [seqStr, totalStr] = seqPart.replace('seq=', '').split('/');
  const seq   = parseInt(seqStr, 10);
  const total = parseInt(totalStr, 10);
  const data  = rest.join('|');

  await saveChunk({ messageId, seq, total, data });
  const reassembled = await tryReassemble(messageId);
  if (reassembled !== null) await onComplete(reassembled);
}

export async function markAsRead(messageId) {
  await markMessageRead(messageId);
}
```

---

**8. `src/services/LocationTracker.js`** — corrige o NativeEventEmitter

```javascript
import { NativeModules, DeviceEventEmitter } from 'react-native';

const { GpsModule, SmsSender } = NativeModules;

let intervalId = null;

export function startTracking({ targetPhone, intervalMs = 15000, onMyLocation }) {
  stopTracking();

  // DeviceEventEmitter direto — sem NativeEventEmitter que quebrava
  const sub = DeviceEventEmitter.addListener('MY_LOCATION_UPDATED', onMyLocation);

  GpsModule?.startService({ targetPhone, intervalMs });

  return () => {
    sub.remove();
    stopTracking();
  };
}

export function stopTracking() {
  GpsModule?.stopService();
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export async function sendLocationOnce(targetPhone) {
  return new Promise((resolve, reject) => {
    const sub = DeviceEventEmitter.addListener('MY_LOCATION_UPDATED', async ({ lat, lng }) => {
      sub.remove();
      try {
        await SmsSender.sendLocation(targetPhone, lat, lng);
        resolve({ lat, lng });
      } catch (e) {
        reject(e);
      }
    });
    GpsModule?.requestSingleUpdate();
  });
}
```

---

São 8 arquivos. Sobe o build com todos e me manda o resultado.
