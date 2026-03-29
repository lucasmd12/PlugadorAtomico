package com.plugadoratomico.gps

import android.app.*
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

    companion object {
        const val CHANNEL_ID = "plugador_gps"
    }

    private lateinit var locationManager: LocationManager
    private var targetPhone: String = ""
    private var intervalMs: Long = 15000

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        // startForeground deve ser chamado AQUI em onCreate, não em onStartCommand
        startForeground(2, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        targetPhone = intent?.getStringExtra("targetPhone") ?: ""
        intervalMs  = intent?.getLongExtra("intervalMs", 15000) ?: 15000

        val singleUpdate = intent?.getBooleanExtra("singleUpdate", false) ?: false

        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager

        try {
            if (singleUpdate) {
                locationManager.requestSingleUpdate(LocationManager.GPS_PROVIDER, this, null)
            } else {
                locationManager.requestLocationUpdates(
                    LocationManager.GPS_PROVIDER,
                    intervalMs,
                    0f,
                    this
                )
            }
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
                SmsManager.getDefault().sendTextMessage(
                    targetPhone, null, "[GPS]$lat,$lng", null, null
                )
            } catch (e: Exception) { }
        }

        val reactApp     = applicationContext as? ReactApplication ?: return
        val reactContext = reactApp.reactNativeHost.reactInstanceManager.currentReactContext ?: return
        val params = Arguments.createMap().apply {
            putDouble("lat", lat)
            putDouble("lng", lng)
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("MY_LOCATION_UPDATED", params)
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Plugador Atômico")
            .setContentText("GPS ativo")
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
        if (::locationManager.isInitialized) locationManager.removeUpdates(this)
        super.onDestroy()
    }
}
