package com.plugadoratomico.gps

import android.app.Service
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.IBinder
import android.telephony.SmsManager
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class GpsService : Service(), LocationListener {

    private lateinit var locationManager: LocationManager
    private var targetPhone: String = ""
    // Intervalo padrão: 15 segundos (configurável pelo app)
    private var intervalMs: Long = 15000

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        targetPhone = intent?.getStringExtra("targetPhone") ?: ""
        intervalMs = intent?.getLongExtra("intervalMs", 15000) ?: 15000

        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager

        try {
            // Solicita atualizações GPS — intervalo e distância mínima configuráveis
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                intervalMs,        // tempo mínimo entre updates
                0f,                // distância mínima (0 = qualquer movimento)
                this
            )
        } catch (e: SecurityException) {
            stopSelf()
        }

        return START_STICKY // Reinicia automaticamente se o sistema matar o serviço
    }

    override fun onLocationChanged(location: Location) {
        val lat = location.latitude
        val lng = location.longitude

        // Envia a localização via SMS pro número configurado
        if (targetPhone.isNotEmpty()) {
            try {
                SmsManager.getDefault().sendTextMessage(
                    targetPhone, null, "[GPS]$lat,$lng", null, null
                )
            } catch (e: Exception) { /* ignora erros de envio isolados */ }
        }

        // Também notifica o React Native para atualizar o mapa local
        val reactApp = applicationContext as? ReactApplication ?: return
        val reactContext = reactApp.reactNativeHost.reactInstanceManager.currentReactContext ?: return
        val params = Arguments.createMap().apply {
            putDouble("lat", lat)
            putDouble("lng", lng)
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("MY_LOCATION_UPDATED", params)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        locationManager.removeUpdates(this)
        super.onDestroy()
    }
}
