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
