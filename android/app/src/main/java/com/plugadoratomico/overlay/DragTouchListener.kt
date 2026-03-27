package com.plugadoratomico.overlay

import android.view.MotionEvent
import android.view.View
import android.view.WindowManager

// Permite que o usuário arraste a bolha overlay por qualquer lugar da tela
class DragTouchListener(
    private val windowManager: WindowManager,
    private val view: View,
    private val params: WindowManager.LayoutParams
) : View.OnTouchListener {

    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f

    override fun onTouch(v: View, event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                // Salva posição inicial quando o dedo toca a bolha
                initialX = params.x
                initialY = params.y
                initialTouchX = event.rawX
                initialTouchY = event.rawY
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                // Atualiza posição conforme o dedo move
                params.x = initialX + (event.rawX - initialTouchX).toInt()
                params.y = initialY + (event.rawY - initialTouchY).toInt()
                windowManager.updateViewLayout(view, params)
                return true
            }
        }
        return false
    }
}
