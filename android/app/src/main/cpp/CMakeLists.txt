cmake_minimum_required(VERSION 3.22.1)
project(plugador_atomico)

# Gera o version.h que o Codec2 espera encontrar em <codec2/version.h>
# Esse arquivo não vem no repositório — é normalmente gerado pelo cmake do Codec2
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

# Pega todos os .c do Codec2
file(GLOB CODEC2_SOURCES "codec2/src/*.c")

add_library(
  codec2_jni
  SHARED
  codec2_jni.cpp
  ${CODEC2_SOURCES}
)

# Dois paths de include:
# - codec2/src        → para includes internos do Codec2 como "codec2.h"
# - codec2/src/codec2 → NÃO. O correto é o pai, para que <codec2/version.h> resolva
# O compilador precisa enxergar codec2/src como raiz, pois o include é <codec2/version.h>
# Isso significa que version.h deve estar em codec2/src/codec2/version.h — já criado acima
target_include_directories(
  codec2_jni
  PRIVATE
  codec2/src        # resolve "codec2.h" e outros includes internos
  codec2/src/..     # resolve <codec2/version.h> via o diretório pai de codec2/src
)

target_link_libraries(
  codec2_jni
  android
  log
)
