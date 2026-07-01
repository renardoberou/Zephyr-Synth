cmake_minimum_required(VERSION 3.22)
project(zephyr_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(zephyr_engine STATIC
  src/MidiTranslator.cpp
  src/Voice.cpp
  src/ZephyrEngine.cpp
)

target_include_directories(zephyr_engine PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)

if(ANDROID)
  message(STATUS "Building for Android")
  message(STATUS "CMAKE_FIND_ROOT_PATH: ${CMAKE_FIND_ROOT_PATH}")
  message(STATUS "CMAKE_SYSTEM_PREFIX_PATH: ${CMAKE_SYSTEM_PREFIX_PATH}")
  # Gradle/AGP sets CMAKE_FIND_ROOT_PATH to include prefab libs
  find_package(oboe REQUIRED CONFIG)

  add_library(zephyr_android STATIC
    src/android/AndroidAudioEngine.cpp
  )

  target_include_directories(zephyr_android PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
  target_link_libraries(zephyr_android PUBLIC zephyr_engine oboe::oboe)
endif()
