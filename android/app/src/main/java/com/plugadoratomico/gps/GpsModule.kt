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
