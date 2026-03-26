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

        // Só processa mensagens do nosso app — ignora todo o resto
        if (!fullBody.startsWith("[MSG]") &&
            !fullBody.startsWith("[VOZ]") &&
            !fullBody.startsWith("[GPS]")) return

        // Aborta o broadcast para que o SMS não apareça no app de mensagens padrão
        abortBroadcast()

        // Envia o evento para o React Native processar
        val reactApp = context.applicationContext as? ReactApplication ?: return
        val reactContext = reactApp.reactNativeHost.reactInstanceManager.currentReactContext ?: return

        val params = Arguments.createMap().apply {
            putString("body", fullBody)
            putString("sender", messages.first().originatingAddress ?: "")
        }

        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("SMS_RECEIVED", params)
    }
}
