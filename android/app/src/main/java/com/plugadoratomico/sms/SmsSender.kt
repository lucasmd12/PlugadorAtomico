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
