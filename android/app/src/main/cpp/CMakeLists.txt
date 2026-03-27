cmake_minimum_required(VERSION 3.22.1)
project(plugador_atomico)

# Usa GLOB para encontrar automaticamente todos os .c do Codec2
# Isso é robusto contra mudanças de versão — não importa quais arquivos
# existem ou não existem, o CMake pega o que tiver
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
)

target_link_libraries(
  codec2_jni
  android
  log
)
