---
### Início do arquivo: ./.gitmodules
```
[submodule "android/app/src/main/cpp/codec2"]
    path = android/app/src/main/cpp/codec2
    url = https://github.com/drowe67/codec2
```
### Fim do arquivo: ./.gitmodules
---
### Início do arquivo: ./App.jsx
```
import React, { useState } from 'react';
import SetupScreen from './src/screens/SetupScreen';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  const [targetPhone, setTargetPhone] = useState(null);

  if (!targetPhone) {
    return <SetupScreen onSetupComplete={setTargetPhone} />;
  }

  return <HomeScreen targetPhone={targetPhone} />;
}
```
### Fim do arquivo: ./App.jsx
---
### Início do arquivo: ./android/app/build.gradle
```
apply plugin: "com.android.application"
apply plugin: "org.jetbrains.kotlin.android"
apply plugin: "com.facebook.react"

android {
    ndkVersion = "25.2.9519653"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.plugadoratomico"
        minSdk = 21
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        // Essa seção diz pro Gradle que existe código C++ pra compilar
        // Sem isso, o Codec2 seria completamente ignorado
        externalNativeBuild {
            cmake {
                cppFlags "-std=c++17"
                abiFilters "arm64-v8a"
            }
        }
    }

    // Aponta pro nosso CMakeLists.txt que sabe compilar o Codec2
    externalNativeBuild {
        cmake {
            path "src/main/cpp/CMakeLists.txt"
            version "3.22.1"
        }
    }

    buildTypes {
        debug {
            debuggable true
        }
        profile {
            initWith(buildTypes.debug)
            debuggable false
            // Profile é otimizado como release mas sem precisar de keystore
            matchingFallbacks = ['debug', 'release']
        }
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
}

dependencies {
    implementation("com.facebook.react:react-android")
    implementation("com.facebook.react:hermes-android")
}
```
### Fim do arquivo: ./android/app/build.gradle
---
### Início do arquivo: ./android/app/src/main/AndroidManifest.xml
```
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permissões necessárias para o Plugador Atômico -->
    <uses-permission android:name="android.permission.SEND_SMS"/>
    <uses-permission android:name="android.permission.RECEIVE_SMS"/>
    <uses-permission android:name="android.permission.READ_SMS"/>
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
    <uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION"/>
    <uses-permission android:name="android.permission.RECORD_AUDIO"/>
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
    <!-- Permissão especial para desenhar sobre outros apps (overlay) -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW"/>

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

        <!-- Serviço de overlay — roda em foreground permanentemente -->
        <service
            android:name=".overlay.OverlayService"
            android:exported="false"
            android:foregroundServiceType="specialUse"/>

        <!-- Serviço de GPS em background -->
        <service
            android:name=".gps.GpsService"
            android:exported="false"
            android:foregroundServiceType="location"/>

        <!-- Receiver que intercepta SMS antes do app de mensagens padrão -->
        <receiver
            android:name=".sms.SmsReceiver"
            android:exported="true"
            android:permission="android.permission.BROADCAST_SMS">
            <intent-filter android:priority="999">
                <action android:name="android.provider.Telephony.SMS_RECEIVED"/>
            </intent-filter>
        </receiver>

    </application>
</manifest>
```
### Fim do arquivo: ./android/app/src/main/AndroidManifest.xml
---
### Início do arquivo: ./android/app/src/main/cpp/CMakeLists.txt
```
cmake_minimum_required(VERSION 3.22.1)
project(plugador_atomico)

# Desativa tudo que não precisamos do Codec2 (exemplos, testes, etc)
set(BUILD_SHARED_LIBS OFF)
set(CODEC2_BUILD_EXAMPLES OFF)
set(CODEC2_BUILD_TESTS OFF)

# Inclui o Codec2 como subprojeto
add_subdirectory(codec2)

# Cria nossa biblioteca JNI que faz a ponte entre Kotlin e o Codec2
add_library(
  codec2_jni
  SHARED
  codec2_jni.cpp
)

# Linka nossa lib JNI com o Codec2 e com o log do Android
target_link_libraries(
  codec2_jni
  codec2
  android
  log
)
```
### Fim do arquivo: ./android/app/src/main/cpp/CMakeLists.txt
---
### Início do arquivo: ./android/app/src/main/cpp/codec2_jni.cpp
```
#include <jni.h>
#include <android/log.h>
#include "codec2/src/codec2.h"
#include <vector>
#include <cstring>

#define LOG_TAG "Codec2JNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

// Cria uma instância do Codec2 no modo 1200bps (menor bitrate, cabe num SMS)
extern "C" JNIEXPORT jlong JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_createInstance(JNIEnv *env, jobject thiz) {
    struct CODEC2 *codec2 = codec2_create(CODEC2_MODE_1200);
    return (jlong)(uintptr_t)codec2;
}

// Destrói a instância quando não precisar mais
extern "C" JNIEXPORT void JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_destroyInstance(JNIEnv *env, jobject thiz, jlong handle) {
    struct CODEC2 *codec2 = (struct CODEC2 *)(uintptr_t)handle;
    codec2_destroy(codec2);
}

// Comprime um frame de áudio PCM para bits Codec2
extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_encode(JNIEnv *env, jobject thiz, jlong handle, jshortArray pcmFrame) {
    struct CODEC2 *codec2 = (struct CODEC2 *)(uintptr_t)handle;

    int samplesPerFrame = codec2_samples_per_frame(codec2);
    int bitsPerFrame = codec2_bits_per_frame(codec2);
    int bytesPerFrame = (bitsPerFrame + 7) / 8;

    jshort *pcm = env->GetShortArrayElements(pcmFrame, nullptr);
    std::vector<unsigned char> bits(bytesPerFrame);

    codec2_encode(codec2, bits.data(), pcm);

    env->ReleaseShortArrayElements(pcmFrame, pcm, JNI_ABORT);

    jbyteArray result = env->NewByteArray(bytesPerFrame);
    env->SetByteArrayRegion(result, 0, bytesPerFrame, (jbyte *)bits.data());
    return result;
}

// Descomprime bits Codec2 de volta para áudio PCM
extern "C" JNIEXPORT jshortArray JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_decode(JNIEnv *env, jobject thiz, jlong handle, jbyteArray encodedBits) {
    struct CODEC2 *codec2 = (struct CODEC2 *)(uintptr_t)handle;

    int samplesPerFrame = codec2_samples_per_frame(codec2);
    int bitsPerFrame = codec2_bits_per_frame(codec2);
    int bytesPerFrame = (bitsPerFrame + 7) / 8;

    jbyte *bits = env->GetByteArrayElements(encodedBits, nullptr);
    std::vector<short> pcm(samplesPerFrame);

    codec2_decode(codec2, pcm.data(), (unsigned char *)bits);

    env->ReleaseByteArrayElements(encodedBits, bits, JNI_ABORT);

    jshortArray result = env->NewShortArray(samplesPerFrame);
    env->SetShortArrayRegion(result, 0, samplesPerFrame, pcm.data());
    return result;
}
```
### Fim do arquivo: ./android/app/src/main/cpp/codec2_jni.cpp
---
### Início do arquivo: ./android/app/src/main/java/com/plugadoratomico/MainApplication.kt
```
package com.plugadoratomico

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {

            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // Aqui registramos nosso pacote com todos os módulos nativos
                    // Sem essa linha, Codec2, SMS, GPS e Overlay seriam invisíveis pro JavaScript
                    add(PlugadorPackage())
                }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            load()
        }
    }
}
```
### Fim do arquivo: ./android/app/src/main/java/com/plugadoratomico/MainApplication.kt
---
### Início do arquivo: ./android/app/src/main/java/com/plugadoratomico/PlugadorPackage.kt
```
package com.plugadoratomico

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.plugadoratomico.codec2.Codec2Module
import com.plugadoratomico.sms.SmsSender
import com.plugadoratomico.sms.SmsModule
import com.plugadoratomico.overlay.OverlayModule
import com.plugadoratomico.gps.GpsModule

class PlugadorPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(
            Codec2Module(reactContext),
            SmsSender(reactContext),
            SmsModule(reactContext),
            OverlayModule(reactContext),
            GpsModule(reactContext)
        )
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
```
### Fim do arquivo: ./android/app/src/main/java/com/plugadoratomico/PlugadorPackage.kt
---
### Início do arquivo: ./android/app/src/main/java/com/plugadoratomico/codec2/Codec2Module.kt
```
package com.plugadoratomico.codec2

import com.facebook.react.bridge.*
import android.util.Base64

class Codec2Module(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val wrapper = Codec2Wrapper()

    override fun getName() = "Codec2Module"

    // Recebe PCM em Base64, comprime com Codec2, retorna bits em Base64
    @ReactMethod
    fun encode(pcmBase64: String, promise: Promise) {
        try {
            val pcmBytes = Base64.decode(pcmBase64, Base64.DEFAULT)
            // Converte bytes para shorts (PCM 16-bit)
            val pcmShorts = ShortArray(pcmBytes.size / 2) { i ->
                ((pcmBytes[i * 2 + 1].toInt() shl 8) or (pcmBytes[i * 2].toInt() and 0xFF)).toShort()
            }
            val encoded = wrapper.encode(pcmShorts)
            promise.resolve(Base64.encodeToString(encoded, Base64.DEFAULT))
        } catch (e: Exception) {
            promise.reject("CODEC2_ENCODE_ERROR", e.message)
        }
    }

    // Recebe bits Codec2 em Base64, descomprime, retorna PCM em Base64
    @ReactMethod
    fun decode(encodedBase64: String, promise: Promise) {
        try {
            val encodedBytes = Base64.decode(encodedBase64, Base64.DEFAULT)
            val pcmShorts = wrapper.decode(encodedBytes)
            // Converte shorts de volta para bytes
            val pcmBytes = ByteArray(pcmShorts.size * 2)
            pcmShorts.forEachIndexed { i, s ->
                pcmBytes[i * 2] = (s.toInt() and 0xFF).toByte()
                pcmBytes[i * 2 + 1] = (s.toInt() shr 8).toByte()
            }
            promise.resolve(Base64.encodeToString(pcmBytes, Base64.DEFAULT))
        } catch (e: Exception) {
            promise.reject("CODEC2_DECODE_ERROR", e.message)
        }
    }
}
```
### Fim do arquivo: ./android/app/src/main/java/com/plugadoratomico/codec2/Codec2Module.kt
---
### Início do arquivo: ./android/app/src/main/java/com/plugadoratomico/codec2/Codec2Wrapper.kt
```
package com.plugadoratomico.codec2

class Codec2Wrapper {
    private var handle: Long = 0

    init {
        // Carrega a biblioteca compilada pelo NDK
        System.loadLibrary("codec2_jni")
        handle = createInstance()
    }

    fun encode(pcmFrame: ShortArray): ByteArray = encode(handle, pcmFrame)
    fun decode(encodedBits: ByteArray): ShortArray = decode(handle, encodedBits)

    fun destroy() {
        destroyInstance(handle)
        handle = 0
    }

    // Declarações das funções nativas em C++
    private external fun createInstance(): Long
    private external fun destroyInstance(handle: Long)
    private external fun encode(handle: Long, pcmFrame: ShortArray): ByteArray
    private external fun decode(handle: Long, encodedBits: ByteArray): ShortArray
}
```
### Fim do arquivo: ./android/app/src/main/java/com/plugadoratomico/codec2/Codec2Wrapper.kt
---
### Início do arquivo: ./android/app/src/main/java/com/plugadoratomico/gps/GpsService.kt
```
package com.plugadoratomico.gps

import android.app.Service
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.IBinder
import android.telephony.SmsManager
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class GpsService : Service(), LocationListener {

    private lateinit var locationManager: LocationManager
    private var targetPhone: String = ""
    // Intervalo padrão: 15 segundos (configurável pelo app)
    private var intervalMs: Long = 15000

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        targetPhone = intent?.getStringExtra("targetPhone") ?: ""
        intervalMs = intent?.getLongExtra("intervalMs", 15000) ?: 15000

        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager

        try {
            // Solicita atualizações GPS — intervalo e distância mínima configuráveis
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                intervalMs,        // tempo mínimo entre updates
                0f,                // distância mínima (0 = qualquer movimento)
                this
            )
        } catch (e: SecurityException) {
            stopSelf()
        }

        return START_STICKY // Reinicia automaticamente se o sistema matar o serviço
    }

    override fun onLocationChanged(location: Location) {
        val lat = location.latitude
        val lng = location.longitude

        // Envia a localização via SMS pro número configurado
        if (targetPhone.isNotEmpty()) {
            try {
                SmsManager.getDefault().sendTextMessage(
                    targetPhone, null, "[GPS]$lat,$lng", null, null
                )
            } catch (e: Exception) { /* ignora erros de envio isolados */ }
        }

        // Também notifica o React Native para atualizar o mapa local
        val reactApp = applicationContext as? ReactApplication ?: return
        val reactContext = reactApp.reactNativeHost.reactInstanceManager.currentReactContext ?: return
        val params = Arguments.createMap().apply {
            putDouble("lat", lat)
            putDouble("lng", lng)
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("MY_LOCATION_UPDATED", params)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        locationManager.removeUpdates(this)
        super.onDestroy()
    }
}
```
### Fim do arquivo: ./android/app/src/main/java/com/plugadoratomico/gps/GpsService.kt
---
### Início do arquivo: ./android/app/src/main/java/com/plugadoratomico/overlay/DragTouchListener.kt
```
package com.plugadoratomico.overlay

import android.view.MotionEvent
import android.view.View
import android.view.WindowManager

// Permite que o usuário arraste a bolha overlay por qualquer lugar da tela
class DragTouchListener(
    private val windowManager: WindowManager,
    private val view: View,
    private val params: WindowManager.LayoutParams
) : View.OnTouchListener {

    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f

    override fun onTouch(v: View, event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                // Salva posição inicial quando o dedo toca a bolha
                initialX = params.x
                initialY = params.y
                initialTouchX = event.rawX
                initialTouchY = event.rawY
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                // Atualiza posição conforme o dedo move
                params.x = initialX + (event.rawX - initialTouchX).toInt()
                params.y = initialY + (event.rawY - initialTouchY).toInt()
                windowManager.updateViewLayout(view, params)
                return true
            }
        }
        return false
    }
}
```
### Fim do arquivo: ./android/app/src/main/java/com/plugadoratomico/overlay/DragTouchListener.kt
---
### Início do arquivo: ./android/app/src/main/java/com/plugadoratomico/overlay/OverlayService.kt
```
package com.plugadoratomico.overlay

import android.app.*
import android.content.Intent
import android.graphics.PixelFormat
import android.os.IBinder
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import com.plugadoratomico.R

class OverlayService : Service() {

    private lateinit var windowManager: WindowManager
    private lateinit var overlayView: View

    companion object {
        const val CHANNEL_ID = "plugador_overlay"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(1, buildNotification())
        showOverlay()
    }

    private fun showOverlay() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        // Infla o layout da bolha flutuante
        overlayView = LayoutInflater.from(this).inflate(R.layout.overlay_widget, null)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY, // requer SYSTEM_ALERT_WINDOW
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            x = 16
            y = 100
        }

        // Permite arrastar a bolha pela tela
        overlayView.setOnTouchListener(DragTouchListener(windowManager, overlayView, params))

        windowManager.addView(overlayView, params)
    }

    // Notificação persistente obrigatória para Foreground Service
    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Plugador Atômico ativo")
            .setContentText("Monitorando mensagens e localização")
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
        if (::overlayView.isInitialized) windowManager.removeView(overlayView)
        super.onDestroy()
    }
}
```
### Fim do arquivo: ./android/app/src/main/java/com/plugadoratomico/overlay/OverlayService.kt
---
### Início do arquivo: ./android/app/src/main/java/com/plugadoratomico/sms/SmsModule.kt
```
package com.plugadoratomico.sms

import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SmsModule"

    // Fila de mensagens recebidas enquanto o app estava fechado
    // Quando o JavaScript inicializa, ele chama esse método para buscar
    // mensagens que chegaram antes do app estar pronto
    @ReactMethod
    fun getPendingMessages(promise: Promise) {
        val messages = WritableNativeArray()
        SmsQueue.drain().forEach { msg ->
            val map = WritableNativeMap().apply {
                putString("body", msg.body)
                putString("sender", msg.sender)
            }
            messages.pushMap(map)
        }
        promise.resolve(messages)
    }
}
```
### Fim do arquivo: ./android/app/src/main/java/com/plugadoratomico/sms/SmsModule.kt
---
### Início do arquivo: ./android/app/src/main/java/com/plugadoratomico/sms/SmsQueue.kt
```
package com.plugadoratomico.sms

// Fila simples em memória para guardar SMS recebidos antes do app estar pronto
// Funciona como uma caixa de entrada temporária
object SmsQueue {
    data class SmsMessage(val body: String, val sender: String)

    private val queue = mutableListOf<SmsMessage>()

    fun add(body: String, sender: String) {
        // Guarda no máximo 50 mensagens para não consumir memória demais
        if (queue.size < 50) queue.add(SmsMessage(body, sender))
    }

    // Retorna todas as mensagens pendentes e limpa a fila
    fun drain(): List<SmsMessage> {
        val copy = queue.toList()
        queue.clear()
        return copy
    }
}
```
### Fim do arquivo: ./android/app/src/main/java/com/plugadoratomico/sms/SmsQueue.kt
---
### Início do arquivo: ./android/app/src/main/java/com/plugadoratomico/sms/SmsReceiver.kt
```
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
        val fullBody = messages.joinToString("") { it.messageBody }
        val sender = messages.first().originatingAddress ?: ""

        // Ignora qualquer SMS que não seja do nosso app
        if (!fullBody.startsWith("[MSG]") &&
            !fullBody.startsWith("[VOZ]") &&
            !fullBody.startsWith("[GPS]")) return

        // Aborta o broadcast — o SMS não aparece no app de mensagens padrão
        abortBroadcast()

        val reactApp = context.applicationContext as? ReactApplication
        val reactContext = reactApp?.reactNativeHost?.reactInstanceManager?.currentReactContext

        if (reactContext != null) {
            // App está aberto — entrega direto pro JavaScript
            val params = Arguments.createMap().apply {
                putString("body", fullBody)
                putString("sender", sender)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("SMS_RECEIVED", params)
        } else {
            // App está fechado — guarda na fila para entregar quando abrir
            SmsQueue.add(fullBody, sender)
        }
    }
}
```
### Fim do arquivo: ./android/app/src/main/java/com/plugadoratomico/sms/SmsReceiver.kt
---
### Início do arquivo: ./android/app/src/main/java/com/plugadoratomico/sms/SmsSender.kt
```
package com.plugadoratomico.sms

import android.telephony.SmsManager
import com.facebook.react.bridge.*

class SmsSender(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SmsSender"

    // Envia uma mensagem de texto — prefixo [MSG] é adicionado aqui
    @ReactMethod
    fun sendText(phoneNumber: String, message: String, promise: Promise) {
        try {
            val smsManager = SmsManager.getDefault()
            val fullMessage = "[MSG]$message"
            // Divide em múltiplos SMS se necessário (mensagens longas)
            val parts = smsManager.divideMessage(fullMessage)
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SMS_SEND_ERROR", e.message)
        }
    }

    // Envia áudio comprimido — prefixo [VOZ] identifica pro receiver
    @ReactMethod
    fun sendVoice(phoneNumber: String, audioBase64: String, promise: Promise) {
        try {
            val smsManager = SmsManager.getDefault()
            val fullMessage = "[VOZ]$audioBase64"
            val parts = smsManager.divideMessage(fullMessage)
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SMS_SEND_ERROR", e.message)
        }
    }

    // Envia coordenadas GPS — prefixo [GPS] identifica pro receiver
    @ReactMethod
    fun sendLocation(phoneNumber: String, lat: Double, lng: Double, promise: Promise) {
        try {
            val smsManager = SmsManager.getDefault()
            val fullMessage = "[GPS]$lat,$lng"
            smsManager.sendTextMessage(phoneNumber, null, fullMessage, null, null)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SMS_SEND_ERROR", e.message)
        }
    }
}
```
### Fim do arquivo: ./android/app/src/main/java/com/plugadoratomico/sms/SmsSender.kt
---
### Início do arquivo: ./android/app/src/main/res/layout/overlay_widget.xml
```
<?xml version="1.0" encoding="utf-8"?>
<!-- Bolha flutuante compacta que fica sobre todos os apps -->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:orientation="vertical"
    android:background="#CC1a1a2e"
    android:padding="12dp"
    android:elevation="8dp">

    <!-- Botão PTT compacto -->
    <Button
        android:id="@+id/btn_ptt_overlay"
        android:layout_width="64dp"
        android:layout_height="64dp"
        android:text="🎙"
        android:textSize="24sp"
        android:background="#e94560"
        android:layout_marginBottom="4dp"/>

    <!-- Indicador de mensagens não lidas -->
    <TextView
        android:id="@+id/tv_unread"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="0 msg"
        android:textColor="#ffffff"
        android:textSize="10sp"
        android:layout_gravity="center"/>

</LinearLayout>
```
### Fim do arquivo: ./android/app/src/main/res/layout/overlay_widget.xml
---
### Início do arquivo: ./codemagic.yaml
```
workflows:
  plugador-profile:
    name: Plugador Atômico — Profile APK
    max_build_duration: 60

    environment:
      node: v18.0.0

    scripts:
      - name: Inicializar submódulo Codec2
        script: |
          git submodule update --init --recursive

      - name: Instalar dependências Node
        script: |
          npm install
          npm install react-native-audio-recorder-player react-native-fs

      - name: Gerar infraestrutura Android via React Native CLI
        script: |
          npx react-native init TempPlugador --version 0.73.0 --skip-install
          cp TempPlugador/android/gradlew android/
          cp TempPlugador/android/gradlew.bat android/
          cp -r TempPlugador/android/gradle android/
          cp TempPlugador/android/settings.gradle android/
          cp TempPlugador/android/build.gradle android/build.gradle
          cp TempPlugador/android/gradle.properties android/gradle.properties
          sed -i "s/TempPlugador/PlugadorAtomico/g" android/settings.gradle
          chmod +x android/gradlew
          rm -rf TempPlugador

      - name: Garantir index.js existe
        script: |
          cat > index.js << 'JS'
          import {AppRegistry} from 'react-native';
          import App from './App';
          AppRegistry.registerComponent('PlugadorAtomico', () => App);
          JS

      - name: Corrigir build.gradle do app com namespace
        script: |
          cat > android/app/build.gradle << 'GRADLE'
          apply plugin: "com.android.application"
          apply plugin: "org.jetbrains.kotlin.android"
          apply plugin: "com.facebook.react"

          android {
              namespace "com.plugadoratomico"
              ndkVersion "25.2.9519653"
              compileSdk 34

              defaultConfig {
                  applicationId "com.plugadoratomico"
                  minSdk 21
                  targetSdk 34
                  versionCode 1
                  versionName "1.0"

                  externalNativeBuild {
                      cmake {
                          cppFlags "-std=c++17"
                          abiFilters "arm64-v8a"
                      }
                  }
              }

              externalNativeBuild {
                  cmake {
                      path "src/main/cpp/CMakeLists.txt"
                      version "3.22.1"
                  }
              }

              buildTypes {
                  debug {
                      debuggable true
                  }
                  profile {
                      initWith(buildTypes.debug)
                      debuggable false
                      matchingFallbacks = ['debug', 'release']
                  }
                  release {
                      minifyEnabled true
                      proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
                  }
              }
          }

          dependencies {
              implementation("com.facebook.react:react-android")
              implementation("com.facebook.react:hermes-android")
          }
          GRADLE

      - name: Criar GpsModule e OverlayModule faltando
        script: |
          cat > android/app/src/main/java/com/plugadoratomico/gps/GpsModule.kt << 'KT'
          package com.plugadoratomico.gps
          import android.content.Intent
          import android.os.Build
          import com.facebook.react.bridge.*
          class GpsModule(private val reactContext: ReactApplicationContext)
              : ReactContextBaseJavaModule(reactContext) {
              override fun getName() = "GpsModule"
              @ReactMethod
              fun startService(options: ReadableMap) {
                  val intent = Intent(reactContext, GpsService::class.java).apply {
                      putExtra("targetPhone", options.getString("targetPhone"))
                      putExtra("intervalMs", options.getDouble("intervalMs").toLong())
                  }
                  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                      reactContext.startForegroundService(intent)
                  } else {
                      reactContext.startService(intent)
                  }
              }
              @ReactMethod
              fun stopService() {
                  reactContext.stopService(Intent(reactContext, GpsService::class.java))
              }
              @ReactMethod
              fun requestSingleUpdate() {
                  val intent = Intent(reactContext, GpsService::class.java).apply {
                      putExtra("singleUpdate", true)
                  }
                  reactContext.startService(intent)
              }
          }
          KT

          cat > android/app/src/main/java/com/plugadoratomico/overlay/OverlayModule.kt << 'KT'
          package com.plugadoratomico.overlay
          import android.content.Intent
          import android.net.Uri
          import android.os.Build
          import android.provider.Settings
          import com.facebook.react.bridge.*
          class OverlayModule(private val reactContext: ReactApplicationContext)
              : ReactContextBaseJavaModule(reactContext) {
              override fun getName() = "OverlayModule"
              @ReactMethod
              fun requestOverlayPermission() {
                  val intent = Intent(
                      Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                      Uri.parse("package:${reactContext.packageName}")
                  ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
                  reactContext.startActivity(intent)
              }
              @ReactMethod
              fun startOverlay() {
                  if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                      reactContext.startForegroundService(Intent(reactContext, OverlayService::class.java))
                  } else {
                      reactContext.startService(Intent(reactContext, OverlayService::class.java))
                  }
              }
              @ReactMethod
              fun stopOverlay() {
                  reactContext.stopService(Intent(reactContext, OverlayService::class.java))
              }
          }
          KT

      - name: Build APK Profile
        script: |
          cd android
          ./gradlew assembleProfile \
            --no-daemon \
            --stacktrace

    artifacts:
      - android/app/build/outputs/apk/profile/*.apk
```
### Fim do arquivo: ./codemagic.yaml
---
### Início do arquivo: ./saida_do_projeto.md
```
```
### Fim do arquivo: ./saida_do_projeto.md
---
### Início do arquivo: ./package.json
```
{
  "name": "PlugadorAtomico",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "android": "react-native run-android",
    "start": "react-native start"
  },
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.73.0",
    "react-native-audio-recorder-player": "^3.5.3",
    "react-native-fs": "^2.20.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@babel/preset-env": "^7.20.0",
    "@babel/runtime": "^7.20.0",
    "@react-native/babel-preset": "0.73.0",
    "@react-native/eslint-config": "0.73.0",
    "@react-native/metro-config": "0.73.0",
    "@react-native/typescript-config": "0.73.0",
    "babel-jest": "^29.2.1",
    "jest": "^29.2.1",
    "typescript": "5.0.4"
  }
}
```
### Fim do arquivo: ./package.json
---
### Início do arquivo: ./src/screens/HomeScreen.jsx
```
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
```
### Fim do arquivo: ./src/screens/HomeScreen.jsx
---
### Início do arquivo: ./src/screens/SetupScreen.jsx
```
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
```
### Fim do arquivo: ./src/screens/SetupScreen.jsx
---
### Início do arquivo: ./src/services/AudioRecorder.js
```
import { NativeModules } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

const { Codec2Module } = NativeModules;
const recorder = new AudioRecorderPlayer();

const AudioRecorder = {
  // Inicia gravação quando o PTT é pressionado
  async start() {
    await recorder.startRecorder();
  },

  // Para a gravação, comprime com Codec2 e retorna Base64 pronto pra enviar
  async stopAndEncode() {
    try {
      const path = await recorder.stopRecorder();
      // Lê o arquivo PCM gravado e converte pra Base64
      const RNFS = require('react-native-fs');
      const pcmBase64 = await RNFS.readFile(path, 'base64');
      // Comprime com Codec2 (1200bps) — resultado cabe num SMS
      const encodedBase64 = await Codec2Module.encode(pcmBase64);
      return encodedBase64;
    } catch (e) {
      console.error('Erro ao gravar/codificar:', e);
      return null;
    }
  },

  // Toca áudio recebido — descompressão já foi feita pelo MessageRouter
  async play(pcmBase64) {
    try {
      const RNFS = require('react-native-fs');
      const path = `${RNFS.CachesDirectoryPath}/received_audio.pcm`;
      await RNFS.writeFile(path, pcmBase64, 'base64');
      await recorder.startPlayer(path);
    } catch (e) {
      console.error('Erro ao tocar áudio:', e);
    }
  }
};

export default AudioRecorder;
```
### Fim do arquivo: ./src/services/AudioRecorder.js
---
### Início do arquivo: ./src/services/LocationTracker.js
```
import { NativeModules, NativeEventEmitter } from 'react-native';

const { SmsSender } = NativeModules;

let intervalId = null;

// Inicia o envio periódico da localização via SMS
// intervalMs pode ser 15000 (15s), 60000 (1min), 3600000 (1h), etc.
export function startTracking({ targetPhone, intervalMs = 15000, onMyLocation }) {
  stopTracking(); // garante que não tem dois timers rodando

  // Escuta atualizações da própria localização para atualizar o mapa local
  const emitter = new NativeEventEmitter();
  const sub = emitter.addListener('MY_LOCATION_UPDATED', onMyLocation);

  // O GpsService.kt cuida do envio via SMS — aqui só iniciamos o serviço
  NativeModules.GpsModule?.startService({ targetPhone, intervalMs });

  return () => {
    sub.remove();
    stopTracking();
  };
}

export function stopTracking() {
  NativeModules.GpsModule?.stopService();
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Envia a localização atual uma única vez (botão "enviar local agora")
export async function sendLocationOnce(targetPhone) {
  return new Promise((resolve, reject) => {
    const emitter = new NativeEventEmitter();
    // Escuta a próxima atualização de localização e envia só ela
    const sub = emitter.addListener('MY_LOCATION_UPDATED', async ({ lat, lng }) => {
      sub.remove();
      try {
        await SmsSender.sendLocation(targetPhone, lat, lng);
        resolve({ lat, lng });
      } catch (e) {
        reject(e);
      }
    });
    // Solicita uma leitura única do GPS
    NativeModules.GpsModule?.requestSingleUpdate();
  });
}
```
### Fim do arquivo: ./src/services/LocationTracker.js
---
### Início do arquivo: ./src/services/MessageRouter.js
```
import { NativeEventEmitter, NativeModules } from 'react-native';

const { SmsModule } = NativeModules;

export function initMessageRouter({ onText, onVoice, onGps }) {
  const emitter = new NativeEventEmitter(NativeModules.SmsSender);

  // Escuta SMS chegando em tempo real (app aberto)
  const subscription = emitter.addListener('SMS_RECEIVED', (event) => {
    routeMessage(event.body, event.sender, { onText, onVoice, onGps });
  });

  // Busca mensagens que chegaram enquanto o app estava fechado
  SmsModule?.getPendingMessages().then(pending => {
    pending.forEach(msg => routeMessage(msg.body, msg.sender, { onText, onVoice, onGps }));
  });

  return () => subscription.remove();
}

// Função central de roteamento — classifica a mensagem pelo prefixo
function routeMessage(body, sender, { onText, onVoice, onGps }) {
  if (body.startsWith('[MSG]')) {
    onText({ text: body.replace('[MSG]', ''), sender });

  } else if (body.startsWith('[VOZ]')) {
    onVoice({ audioBase64: body.replace('[VOZ]', ''), sender });

  } else if (body.startsWith('[GPS]')) {
    const coords = body.replace('[GPS]', '').split(',');
    onGps({
      lat: parseFloat(coords[0]),
      lng: parseFloat(coords[1]),
      sender
    });
  }
}
```
### Fim do arquivo: ./src/services/MessageRouter.js
