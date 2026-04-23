#pragma once

#include <cstddef>
#include <cstdint>
#include <memory>

namespace oboe {
class AudioStream;
class AudioStreamBuilder;
class MidiInputStream;
class Result;
} // namespace oboe

namespace zephyr {

class MidiTranslator;
class ZephyrEngine;

class AndroidAudioEngine {
public:
  AndroidAudioEngine();
  ~AndroidAudioEngine();

  bool start();
  void stop();

  bool handleMidiMessage(const std::uint8_t* data, std::size_t size);

private:
  class Impl;
  std::unique_ptr<Impl> impl_;
};

} // namespace zephyr
