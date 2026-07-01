#pragma once

#include <cstddef>
#include <cstdint>
#include <memory>

namespace zephyr {

class MidiTranslator;
class ParameterMessage;
class ZephyrEngine;

class AndroidAudioEngine {
public:
  AndroidAudioEngine();
  ~AndroidAudioEngine();

  bool start();
  void stop();

  bool handleMidiMessage(const std::uint8_t* data, std::size_t size);
  bool pushParameterMessage(const ParameterMessage& message);

private:
  class Impl;
  std::unique_ptr<Impl> impl_;
};

} // namespace zephyr
