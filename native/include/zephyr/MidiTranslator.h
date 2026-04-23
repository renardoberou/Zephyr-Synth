#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>

#include "MidiEvent.h"

namespace zephyr {

class MidiTranslator {
public:
  std::optional<MidiEvent> translate(const std::uint8_t* data, std::size_t size, std::uint16_t sampleOffset, std::uint64_t frameIndex) noexcept;

private:
  std::array<float, 16> lastPitchBend_ {};
};

} // namespace zephyr
