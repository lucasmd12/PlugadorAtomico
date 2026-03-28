#include <jni.h>
#include <android/log.h>
#include "codec2/src/codec2.h"
#include <vector>
#include <cstring>

#define LOG_TAG "Codec2JNI"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)

extern "C" JNIEXPORT jlong JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_createInstance(JNIEnv *env, jobject thiz) {
    struct CODEC2 *codec2 = codec2_create(CODEC2_MODE_1200);
    return (jlong)(uintptr_t)codec2;
}

extern "C" JNIEXPORT void JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_destroyInstance(JNIEnv *env, jobject thiz, jlong handle) {
    struct CODEC2 *codec2 = (struct CODEC2 *)(uintptr_t)handle;
    codec2_destroy(codec2);
}

// Encode: recebe PCM completo, processa frame a frame e concatena os bits
// O Codec2 no modo 1200bps opera com frames de 160 amostras (20ms a 8000Hz)
extern "C" JNIEXPORT jbyteArray JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_encode(JNIEnv *env, jobject thiz, jlong handle, jshortArray pcmData) {
    struct CODEC2 *codec2 = (struct CODEC2 *)(uintptr_t)handle;

    int samplesPerFrame = codec2_samples_per_frame(codec2);
    int bitsPerFrame    = codec2_bits_per_frame(codec2);
    int bytesPerFrame   = (bitsPerFrame + 7) / 8;

    jsize totalSamples = env->GetArrayLength(pcmData);
    jshort *pcm = env->GetShortArrayElements(pcmData, nullptr);

    int numFrames = totalSamples / samplesPerFrame; // frames completos apenas
    std::vector<unsigned char> allBits(numFrames * bytesPerFrame);

    for (int i = 0; i < numFrames; i++) {
        codec2_encode(
            codec2,
            allBits.data() + i * bytesPerFrame,
            pcm + i * samplesPerFrame
        );
    }

    env->ReleaseShortArrayElements(pcmData, pcm, JNI_ABORT);

    jbyteArray result = env->NewByteArray((jsize)allBits.size());
    env->SetByteArrayRegion(result, 0, (jsize)allBits.size(), (jbyte *)allBits.data());
    return result;
}

// Decode: recebe todos os bits, descomprime frame a frame e concatena o PCM
extern "C" JNIEXPORT jshortArray JNICALL
Java_com_plugadoratomico_codec2_Codec2Wrapper_decode(JNIEnv *env, jobject thiz, jlong handle, jbyteArray encodedBits) {
    struct CODEC2 *codec2 = (struct CODEC2 *)(uintptr_t)handle;

    int samplesPerFrame = codec2_samples_per_frame(codec2);
    int bitsPerFrame    = codec2_bits_per_frame(codec2);
    int bytesPerFrame   = (bitsPerFrame + 7) / 8;

    jsize totalBytes = env->GetArrayLength(encodedBits);
    jbyte *bits = env->GetByteArrayElements(encodedBits, nullptr);

    int numFrames = totalBytes / bytesPerFrame;
    std::vector<short> allPcm(numFrames * samplesPerFrame);

    for (int i = 0; i < numFrames; i++) {
        codec2_decode(
            codec2,
            allPcm.data() + i * samplesPerFrame,
            (unsigned char *)bits + i * bytesPerFrame
        );
    }

    env->ReleaseByteArrayElements(encodedBits, bits, JNI_ABORT);

    jshortArray result = env->NewShortArray((jsize)allPcm.size());
    env->SetShortArrayRegion(result, 0, (jsize)allPcm.size(), allPcm.data());
    return result;
}
