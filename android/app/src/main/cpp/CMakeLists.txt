cmake_minimum_required(VERSION 3.22.1)
project(plugador_atomico)

# Desativa tudo que não precisamos do Codec2 (exemplos, testes, etc)
set(BUILD_SHARED_LIBS OFF)
set(CODEC2_BUILD_EXAMPLES OFF)
set(CODEC2_BUILD_TESTS OFF)

# Inclui o Codec2 como subprojeto
add_subdirectory(codec2)

# Cria nossa biblioteca JNI que faz a ponte entre Kotlin e o Codec2
add_library(
  codec2_jni
  SHARED
  codec2_jni.cpp
)

# Linka nossa lib JNI com o Codec2 e com o log do Android
target_link_libraries(
  codec2_jni
  codec2
  android
  log
)
