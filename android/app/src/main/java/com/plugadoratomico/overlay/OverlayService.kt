package com.plugadoratomico.overlay

import android.app.*
import android.content.Intent
import android.graphics.PixelFormat
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.view.*
import android.widget.Button
import androidx.core.app.NotificationCompat
import com.plugadoratomico.R

class OverlayService : Service() {

    private lateinit var windowManager: WindowManager
    private lateinit var overlayView: View
    private var mediaRecorder: MediaRecorder? = null
    private var isRecording = false
    private var targetPhone: String = ""

    companion object {
        const val CHANNEL_ID = "plugador_overlay"
        var instance: OverlayService? = null
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        startForeground(1, buildNotification())
        showOverlay()
    }

    fun setTargetPhone(phone: String) {
        targetPhone = phone
    }

    private fun showOverlay() {
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        overlayView   = LayoutInflater.from(this).inflate(R.layout.overlay_widget, null)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.END
            x = 16; y = 100
        }

        overlayView.setOnTouchListener(DragTouchListener(windowManager, overlayView, params))

        val btnPtt = overlayView.findViewById<Button>(R.id.btn_ptt_overlay)
        btnPtt.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> { startRecording(); true }
                MotionEvent.ACTION_UP   -> { stopAndSend();    true }
                else -> false
            }
        }

        windowManager.addView(overlayView, params)
    }

    private fun startRecording() {
        if (isRecording) return
        try {
            val outputFile = "${cacheDir}/overlay_ptt.3gp"
            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            mediaRecorder?.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP)
                setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB)
                setOutputFile(outputFile)
                prepare()
                start()
            }
            isRecording = true
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopAndSend() {
        if (!isRecording) return
        try {
            mediaRecorder?.stop()
            mediaRecorder?.release()
            mediaRecorder = null
            isRecording = false
            // TODO: integrar com Codec2 e SmsSender quando o PTT nativo estiver estável
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Plugador Atômico ativo")
            .setContentText("Toque na bolha para PTT")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Overlay Plugador", NotificationManager.IMPORTANCE_LOW
        )
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        instance = null
        if (::overlayView.isInitialized) windowManager.removeView(overlayView)
        super.onDestroy()
    }
}
