#pragma once

#include <cstdint>

namespace zephyr {

enum class MidiEventType : std::uint8_t {
  NoteOn,
  NoteOff,
  PitchBend,
  ChannelPressure,
  Timbre,
  SustainPedal,
};

struct MidiEvent {
  MidiEventType type { MidiEventType::NoteOn };
  std::uint8_t channel { 0 };
  std::uint8_t note { 0 };
  std::uint16_t sampleOffset { 0 };
  float value { 0.0f };
  std::uint64_t frameIndex { 0 };
};

} // namespace zephyr
