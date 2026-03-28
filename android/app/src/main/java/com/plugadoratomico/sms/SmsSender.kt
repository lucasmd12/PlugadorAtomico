package com.plugadoratomico.sms

import android.telephony.SmsManager
import com.facebook.react.bridge.*

class SmsSender(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SmsSender"

    @ReactMethod
    fun sendText(phoneNumber: String, message: String, promise: Promise) {
        try {
            val smsManager = SmsManager.getDefault()
            val fullMessage = "[MSG]$message"
            val parts = smsManager.divideMessage(fullMessage)
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            // Notifica o JS para persistir no banco com status 'sent'
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

    // Evento emitido pro JS para que o banco registre a mensagem enviada
    private fun emitSent(type: String, payload: String?, lat: Double?, lng: Double?) {
        val params = com.facebook.react.bridge.Arguments.createMap().apply {
            putString("type", type)
            putString("payload", payload)
            lat?.let { putDouble("lat", it) }
            lng?.let { putDouble("lng", it) }
            putString("status", "sent")
        }
        reactApplicationContext
            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("SMS_SENT", params)
    }

    private fun emitError(type: String, payload: String?) {
        val params = com.facebook.react.bridge.Arguments.createMap().apply {
            putString("type", type)
            putString("payload", payload)
            putString("status", "error")
        }
        reactApplicationContext
            .getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("SMS_SENT", params)
    }
}
