cmake_minimum_required(VERSION 3.22.1)
project(plugador_atomico)

# Desativa tudo que gera targets de host (exemplos, testes, ferramentas)
# Sem isso, o Codec2 tenta compilar c2enc, c2dec etc para a máquina host
# dentro de um contexto Android NDK, o que quebra porque não tem Ninja/GCC host
set(BUILD_SHARED_LIBS OFF)
set(CODEC2_BUILD_EXAMPLES OFF)
set(CODEC2_BUILD_TESTS OFF)
set(CODEC2_STATIC ON)

# Essa flag é a chave — desativa o ExternalProject que tenta buildar
# o codec2_native (versão host) durante o cross-compile Android
set(UNITTEST OFF)
set(INSTALL_EXAMPLES OFF)

# Inclui apenas a lib estática do Codec2, sem os executáveis
add_subdirectory(codec2)

# Nossa lib JNI que faz a ponte Kotlin <-> Codec2
add_library(
  codec2_jni
  SHARED
  codec2_jni.cpp
)

target_link_libraries(
  codec2_jni
  codec2
  android
  log
)
