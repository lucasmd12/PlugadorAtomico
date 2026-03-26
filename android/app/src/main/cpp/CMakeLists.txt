cmake_minimum_required(VERSION 3.22.1)
project(plugador_atomico)

set(BUILD_SHARED_LIBS OFF)
set(CODEC2_BUILD_EXAMPLES OFF)
set(CODEC2_BUILD_TESTS OFF)

add_subdirectory(codec2)

add_library(
  codec2_jni
  SHARED
  codec2_jni.cpp
)

# Expõe os headers do Codec2 para nosso JNI
target_include_directories(codec2_jni PRIVATE codec2/src)

target_link_libraries(
  codec2_jni
  codec2
  android
  log
)
