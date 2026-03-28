cmake_minimum_required(VERSION 3.22.1)
project(plugador_atomico)

# Gera o version.h que o Codec2 espera encontrar em <codec2/version.h>
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

file(GLOB CODEC2_SOURCES "codec2/src/*.c")

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

# Define GIT_HASH como string fixa — normalmente injetado pelo CMake do Codec2
# Sem isso, freedv_api.c falha com "use of undeclared identifier 'GIT_HASH'"
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
