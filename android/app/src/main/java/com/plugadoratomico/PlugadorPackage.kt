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
