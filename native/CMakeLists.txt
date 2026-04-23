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
  add_library(zephyr_android STATIC
    src/android/AndroidAudioEngine.cpp
  )

  target_include_directories(zephyr_android PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include)
  target_link_libraries(zephyr_android PUBLIC zephyr_engine)
endif()
