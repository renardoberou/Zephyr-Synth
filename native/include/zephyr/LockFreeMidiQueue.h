#pragma once

#include <array>
#include <atomic>
#include <cstddef>

#include "MidiEvent.h"

namespace zephyr {

template <std::size_t Capacity>
class LockFreeMidiQueue {
public:
  bool push(const MidiEvent& event) noexcept {
    const auto write = writeIndex_.load(std::memory_order_relaxed);
    const auto next = increment(write);
    if (next == readIndex_.load(std::memory_order_acquire)) {
      return false;
    }

    buffer_[write] = event;
    writeIndex_.store(next, std::memory_order_release);
    return true;
  }

  bool pop(MidiEvent& event) noexcept {
    const auto read = readIndex_.load(std::memory_order_relaxed);
    if (read == writeIndex_.load(std::memory_order_acquire)) {
      return false;
    }

    event = buffer_[read];
    readIndex_.store(increment(read), std::memory_order_release);
    return true;
  }

  void clear() noexcept {
    readIndex_.store(0, std::memory_order_release);
    writeIndex_.store(0, std::memory_order_release);
  }

private:
  static constexpr std::size_t increment(std::size_t index) noexcept {
    return (index + 1) % Capacity;
  }

  std::array<MidiEvent, Capacity> buffer_ {};
  std::atomic<std::size_t> readIndex_ { 0 };
  std::atomic<std::size_t> writeIndex_ { 0 };
};

} // namespace zephyr
