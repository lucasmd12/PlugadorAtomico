package com.plugadoratomico.codec2

import com.facebook.react.bridge.*
import android.util.Base64

class Codec2Module(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val wrapper = Codec2Wrapper()

    override fun getName() = "Codec2Module"

    // Recebe PCM em Base64, comprime com Codec2, retorna bits em Base64
    @ReactMethod
    fun encode(pcmBase64: String, promise: Promise) {
        try {
            val pcmBytes = Base64.decode(pcmBase64, Base64.DEFAULT)
            // Converte bytes para shorts (PCM 16-bit)
            val pcmShorts = ShortArray(pcmBytes.size / 2) { i ->
                ((pcmBytes[i * 2 + 1].toInt() shl 8) or (pcmBytes[i * 2].toInt() and 0xFF)).toShort()
            }
            val encoded = wrapper.encode(pcmShorts)
            promise.resolve(Base64.encodeToString(encoded, Base64.DEFAULT))
        } catch (e: Exception) {
            promise.reject("CODEC2_ENCODE_ERROR", e.message)
        }
    }

    // Recebe bits Codec2 em Base64, descomprime, retorna PCM em Base64
    @ReactMethod
    fun decode(encodedBase64: String, promise: Promise) {
        try {
            val encodedBytes = Base64.decode(encodedBase64, Base64.DEFAULT)
            val pcmShorts = wrapper.decode(encodedBytes)
            // Converte shorts de volta para bytes
            val pcmBytes = ByteArray(pcmShorts.size * 2)
            pcmShorts.forEachIndexed { i, s ->
                pcmBytes[i * 2] = (s.toInt() and 0xFF).toByte()
                pcmBytes[i * 2 + 1] = (s.toInt() shr 8).toByte()
            }
            promise.resolve(Base64.encodeToString(pcmBytes, Base64.DEFAULT))
        } catch (e: Exception) {
            promise.reject("CODEC2_DECODE_ERROR", e.message)
        }
    }
}
