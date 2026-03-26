package com.plugadoratomico.gps

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.IBinder
import android.telephony.SmsManager
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class GpsService : Service(), LocationListener {

    private lateinit var locationManager: LocationManager
    private var targetPhone: String = ""
    private var intervalMs: Long = 15000

    companion object {
        const val CHANNEL_ID = "plugador_gps"
        const val NOTIF_ID = 2
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        targetPhone = intent?.getStringExtra("targetPhone") ?: ""
        intervalMs  = intent?.getLongExtra("intervalMs", 15000) ?: 15000

        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager

        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                intervalMs,
                0f,
                this
            )
        } catch (e: SecurityException) {
            stopSelf()
        }

        return START_STICKY
    }

    override fun onLocationChanged(location: Location) {
        val lat = location.latitude
        val lng = location.longitude

        if (targetPhone.isNotEmpty()) {
            try {
                val smsManager = if (android.os.Build.VERSION.SDK_INT >= 31)
                    getSystemService(SmsManager::class.java)
                else
                    @Suppress("DEPRECATION") SmsManager.getDefault()

                smsManager.sendTextMessage(
                    targetPhone, null, "[GPS]$lat,$lng", null, null
                )
            } catch (e: Exception) { /* ignora erros isolados */ }
        }

        // Notifica o JS com a localização atual
        val reactApp = applicationContext as? ReactApplication
        val ctx = reactApp?.reactNativeHost?.reactInstanceManager?.currentReactContext
        ctx?.let {
            val params = Arguments.createMap().apply {
                putDouble("lat", lat)
                putDouble("lng", lng)
            }
            it.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
              .emit("MY_LOCATION_UPDATED", params)
        }
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("GPS ativo")
            .setContentText("Compartilhando localização")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "GPS Plugador", NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        locationManager.removeUpdates(this)
        super.onDestroy()
    }
}
