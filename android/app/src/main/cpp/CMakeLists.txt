cmake_minimum_required(VERSION 3.22.1)
project(plugador_atomico)

# Em vez de usar add_subdirectory(codec2) que puxa o CMakeLists.txt
# completo do Codec2 — cheio de ExternalProject e targets de desktop
# que quebram no cross-compile Android — compilamos só os arquivos
# C que o codec2_jni.cpp realmente usa, diretamente.
# Isso é mais simples, mais rápido e nunca vai quebrar.

add_library(
  codec2_jni
  SHARED

  # Nossa ponte JNI entre Kotlin e o Codec2
  codec2_jni.cpp

  # Núcleo do Codec2 — só o que é necessário para codec2_create/encode/decode
  codec2/src/codec2.c
  codec2/src/lpc.c
  codec2/src/nlp.c
  codec2/src/postfilter.c
  codec2/src/sine.c
  codec2/src/codec2_fft.c
  codec2/src/kiss_fft.c
  codec2/src/kiss_fftr.c
  codec2/src/quantise.c
  codec2/src/phase.c
  codec2/src/interp.c
  codec2/src/newamp1.c
  codec2/src/newamp2.c
  codec2/src/codebook.c
  codec2/src/codebookd.c
  codec2/src/codebookge.c
  codec2/src/codebookjnd.c
  codec2/src/codebookjvm.c
  codec2/src/codebooknewamp1.c
  codec2/src/codebooknewamp1_energy.c
  codec2/src/codebooknewamp2.c
  codec2/src/codebooknewamp2_energy.c
  codec2/src/codebookdt.c
)

# Diz onde ficam os headers do Codec2
target_include_directories(
  codec2_jni
  PRIVATE
  codec2/src
  codec2/src/kiss_fft
)

target_link_libraries(
  codec2_jni
  android
  log
)
