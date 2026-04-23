#include "zephyr/MidiTranslator.h"

#include <algorithm>

namespace zephyr {

bool MidiTranslator::translate(const std::uint8_t* data, std::size_t size, std::uint16_t sampleOffset, std::uint64_t frameIndex, MidiEvent& outEvent) noexcept {
  if (!data || size == 0) {
    return false;
  }

  const std::uint8_t status = data[0];
  const std::uint8_t type = static_cast<std::uint8_t>(status & 0xF0);
  const std::uint8_t channel = static_cast<std::uint8_t>(status & 0x0F);
  const std::uint8_t data1 = size > 1 ? data[1] : 0;
  const std::uint8_t data2 = size > 2 ? data[2] : 0;

  outEvent = MidiEvent {};
  outEvent.channel = channel;
  outEvent.note = data1;
  outEvent.sampleOffset = sampleOffset;
  outEvent.frameIndex = frameIndex;

  switch (type) {
    case 0x80:
      outEvent.type = MidiEventType::NoteOff;
      outEvent.value = 0.0f;
      return true;
    case 0x90:
      outEvent.type = data2 == 0 ? MidiEventType::NoteOff : MidiEventType::NoteOn;
      outEvent.value = static_cast<float>(data2) / 127.0f;
      return true;
    case 0xD0:
      outEvent.type = MidiEventType::ChannelPressure;
      outEvent.value = static_cast<float>(data1) / 127.0f;
      return true;
    case 0xE0: {
      const int value14 = static_cast<int>(data1) | (static_cast<int>(data2) << 7);
      const float normalized = std::clamp((static_cast<float>(value14) - 8192.0f) / 8192.0f, -1.0f, 1.0f);
      lastPitchBend_[channel] = normalized;
      outEvent.type = MidiEventType::PitchBend;
      outEvent.value = normalized;
      return true;
    }
    case 0xB0:
      if (data1 == 74) {
        outEvent.type = MidiEventType::Timbre;
        outEvent.value = static_cast<float>(data2) / 127.0f;
        return true;
      }
      if (data1 == 64) {
        outEvent.type = MidiEventType::SustainPedal;
        outEvent.value = data2 >= 64 ? 1.0f : 0.0f;
        return true;
      }
      return false;
    default:
      return false;
  }
}

} // namespace zephyr
