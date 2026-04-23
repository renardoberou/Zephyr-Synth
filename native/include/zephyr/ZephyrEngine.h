#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

#include "LockFreeMidiQueue.h"
#include "Voice.h"

namespace zephyr {

class ZephyrEngine {
public:
  static constexpr std::size_t kMaxVoices = 16;
  static constexpr std::size_t kMaxEventsPerBlock = 256;

  ZephyrEngine();

  void prepare(double sampleRate, std::uint32_t maxBlockSize);
  bool pushMidiEvent(const MidiEvent& event) noexcept;

  void render(float* left, float* right, std::uint32_t numFrames);

  void setMasterGain(float gain) noexcept;
  void setPitchBendRange(float semitones) noexcept { pitchBendRangeSemitones_ = semitones; }

private:
  void drainEvents(std::uint32_t numFrames);
  void handleEvent(const MidiEvent& event);
  Voice* allocateVoice() noexcept;
  Voice* findNewestMatchingVoice(std::uint8_t channel, std::uint8_t note) noexcept;

  double sampleRate_ { 48000.0 };
  std::uint32_t maxBlockSize_ { 0 };
  float masterGain_ { 0.18f };
  float pitchBendRangeSemitones_ { 2.0f };
  std::uint64_t absoluteFrame_ { 0 };

  std::array<Voice, kMaxVoices> voices_ {};
  LockFreeMidiQueue<2048> midiQueue_ {};
  std::vector<MidiEvent> blockEvents_ {};
  std::array<float, 16> channelPitchBend_ {};
  std::array<float, 16> channelPressure_ {};
  std::array<float, 16> channelTimbre_ {};
};

} // namespace zephyr
