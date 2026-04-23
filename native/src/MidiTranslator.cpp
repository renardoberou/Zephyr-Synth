#include "zephyr/MidiTranslator.h"

namespace zephyr {

bool MidiTranslator::translate(const std::uint8_t* data, std::size_t size, std::uint16_t sampleOffset, std::uint64_t frameIndex, MidiEvent& outEvent) noexcept {
  if (!data || size == 0) {
    return false;
  }
  outEvent.sampleOffset = sampleOffset;
  outEvent.frameIndex = frameIndex;
  return false;
}

} // namespace zephyr
