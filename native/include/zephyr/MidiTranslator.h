#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

#include "MidiEvent.h"

namespace zephyr {

class MidiTranslator {
public:
  bool translate(const std::uint8_t* data, std::size_t size, std::uint16_t sampleOffset, std::uint64_t frameIndex, MidiEvent& outEvent) noexcept;

private:
  std::array<float, 16> lastPitchBend_ {};
};

} // namespace zephyr
