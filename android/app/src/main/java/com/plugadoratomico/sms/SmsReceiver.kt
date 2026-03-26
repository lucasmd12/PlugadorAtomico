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
