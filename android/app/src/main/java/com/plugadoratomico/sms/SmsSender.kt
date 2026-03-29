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
