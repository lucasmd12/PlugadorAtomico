#include <jni.h>
#include <android/log.h>
#include "codec2/src/codec2.h"
#include <vector>
#include <cstring>

#define LOG_TAG "Codec2JNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

// Cria uma instância do Codec2 no modo 1200bps (menor bitrate, cabe num SMS)
extern "C" JNIEXPORT jlong JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_createInstance(JNIEnv *env, jobject thiz) {
    struct CODEC2 *codec2 = codec2_create(CODEC2_MODE_1200);
    return (jlong)(uintptr_t)codec2;
}

// Destrói a instância quando não precisar mais
extern "C" JNIEXPORT void JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_destroyInstance(JNIEnv *env, jobject thiz, jlong handle) {
    struct CODEC2 *codec2 = (struct CODEC2 *)(uintptr_t)handle;
    codec2_destroy(codec2);
}

// Comprime um frame de áudio PCM para bits Codec2
extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_encode(JNIEnv *env, jobject thiz, jlong handle, jshortArray pcmFrame) {
    struct CODEC2 *codec2 = (struct CODEC2 *)(uintptr_t)handle;

    int samplesPerFrame = codec2_samples_per_frame(codec2);
    int bitsPerFrame = codec2_bits_per_frame(codec2);
    int bytesPerFrame = (bitsPerFrame + 7) / 8;

    jshort *pcm = env->GetShortArrayElements(pcmFrame, nullptr);
    std::vector<unsigned char> bits(bytesPerFrame);

    codec2_encode(codec2, bits.data(), pcm);

    env->ReleaseShortArrayElements(pcmFrame, pcm, JNI_ABORT);

    jbyteArray result = env->NewByteArray(bytesPerFrame);
    env->SetByteArrayRegion(result, 0, bytesPerFrame, (jbyte *)bits.data());
    return result;
}

// Descomprime bits Codec2 de volta para áudio PCM
extern "C" JNIEXPORT jshortArray JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_decode(JNIEnv *env, jobject thiz, jlong handle, jbyteArray encodedBits) {
    struct CODEC2 *codec2 = (struct CODEC2 *)(uintptr_t)handle;

    int samplesPerFrame = codec2_samples_per_frame(codec2);
    int bitsPerFrame = codec2_bits_per_frame(codec2);
    int bytesPerFrame = (bitsPerFrame + 7) / 8;

    jbyte *bits = env->GetByteArrayElements(encodedBits, nullptr);
    std::vector<short> pcm(samplesPerFrame);

    codec2_decode(codec2, pcm.data(), (unsigned char *)bits);

    env->ReleaseByteArrayElements(encodedBits, bits, JNI_ABORT);

    jshortArray result = env->NewShortArray(samplesPerFrame);
    env->SetShortArrayRegion(result, 0, samplesPerFrame, pcm.data());
    return result;
}
