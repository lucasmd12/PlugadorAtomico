package com.plugadoratomico.codec2

class Codec2Wrapper {
    private var handle: Long = 0

    init {
        // Carrega a biblioteca compilada pelo NDK
        System.loadLibrary("codec2_jni")
        handle = createInstance()
    }

    fun encode(pcmFrame: ShortArray): ByteArray = encode(handle, pcmFrame)
    fun decode(encodedBits: ByteArray): ShortArray = decode(handle, encodedBits)

    fun destroy() {
        destroyInstance(handle)
        handle = 0
    }

    // Declarações das funções nativas em C++
    private external fun createInstance(): Long
    private external fun destroyInstance(handle: Long)
    private external fun encode(handle: Long, pcmFrame: ShortArray): ByteArray
    private external fun decode(handle: Long, encodedBits: ByteArray): ShortArray
}
