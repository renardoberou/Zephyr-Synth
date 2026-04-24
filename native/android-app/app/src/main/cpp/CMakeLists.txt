cmake_minimum_required(VERSION 3.22)
project(zephyr_jni LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_subdirectory(${CMAKE_CURRENT_SOURCE_DIR}/../../../../../ ${CMAKE_CURRENT_BINARY_DIR}/zephyr_native)

add_library(zephyr_jni SHARED zephyr_jni.cpp)

find_library(log-lib log)

target_link_libraries(zephyr_jni
  PRIVATE
    zephyr_android
    ${log-lib}
)
