cmake_minimum_required(VERSION 3.22.1)
project(plugador_atomico)

# Gera o version.h necessário para o Codec2
file(MAKE_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/codec2/src/codec2")
file(WRITE "${CMAKE_CURRENT_SOURCE_DIR}/codec2/src/codec2/version.h"
"#ifndef CODEC2_VERSION_H\n\
#define CODEC2_VERSION_H\n\
#define CODEC2_VERSION_MAJOR 1\n\
#define CODEC2_VERSION_MINOR 2\n\
#define CODEC2_VERSION_PATCH 0\n\
#define CODEC2_VERSION \"1.2.0\"\n\
#endif\n"
)

# Lista exata extraída do src/CMakeLists.txt oficial do repositório drowe67/codec2
# Inclui apenas o core da biblioteca — sem arquivos de teste ou utilitários CLI
set(CODEC2_SOURCES
    codec2/src/dump.c
    codec2/src/lpc.c
    codec2/src/nlp.c
    codec2/src/postfilter.c
    codec2/src/sine.c
    codec2/src/codec2.c
    codec2/src/codec2_fft.c
    codec2/src/codec2_fifo.c
    codec2/src/kiss_fft.c
    codec2/src/kiss_fftr.c
    codec2/src/linreg.c
    codec2/src/interp.c
    codec2/src/lsp.c
    codec2/src/mbest.c
    codec2/src/newamp1.c
    codec2/src/phase.c
    codec2/src/quantise.c
    codec2/src/pack.c
    codec2/src/golay23.c
    codec2/src/varicode.c
    codec2/src/modem_stats.c
    codec2/src/mpdecode_core.c
    codec2/src/phi0.c
    codec2/src/cohpsk.c
    codec2/src/fdmdv.c
    codec2/src/fm.c
    codec2/src/fsk.c
    codec2/src/fmfsk.c
    codec2/src/ofdm.c
    codec2/src/ofdm_mode.c
    codec2/src/freedv_api.c
    codec2/src/freedv_1600.c
    codec2/src/freedv_700.c
    codec2/src/freedv_2020.c
    codec2/src/freedv_fsk.c
    codec2/src/freedv_vhf_framing.c
    codec2/src/freedv_data_channel.c
)

add_library(
  codec2_jni
  SHARED
  codec2_jni.cpp
  ${CODEC2_SOURCES}
)

target_include_directories(
  codec2_jni
  PRIVATE
  codec2/src
  codec2/src/..
)

target_compile_definitions(
  codec2_jni
  PRIVATE
  GIT_HASH="plugador-build"
)

target_link_libraries(
  codec2_jni
  android
  log
)
