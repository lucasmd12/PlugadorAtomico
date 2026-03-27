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
