#include "zephyr/ZephyrEngine.h"

#include <algorithm>
#include <cmath>

namespace zephyr {

namespace {
float midiNoteToFrequency(std::uint8_t note) noexcept {
  return 440.0f * std::pow(2.0f, (static_cast<int>(note) - 69) / 12.0f);
}
} // namespace

ZephyrEngine::ZephyrEngine() {
  blockEvents_.reserve(kMaxEventsPerBlock);
}

void ZephyrEngine::prepare(double sampleRate, std::uint32_t maxBlockSize) {
  sampleRate_ = sampleRate > 0.0 ? sampleRate : 48000.0;
  maxBlockSize_ = maxBlockSize;
  absoluteFrame_ = 0;
  midiQueue_.clear();

  for (auto& voice : voices_) {
    voice.setSampleRate(sampleRate_);
    voice.setMasterGain(masterGain_);
  }

  channelPitchBend_.fill(0.0f);
  channelPressure_.fill(0.0f);
  channelTimbre_.fill(0.0f);
}

bool ZephyrEngine::pushMidiEvent(const MidiEvent& event) noexcept {
  return midiQueue_.push(event);
}

void ZephyrEngine::render(float* left, float* right, std::uint32_t numFrames) {
  if (!left || !right || numFrames == 0) {
    return;
  }

  std::fill(left, left + numFrames, 0.0f);
  std::fill(right, right + numFrames, 0.0f);

  drainEvents(numFrames);

  std::size_t eventIndex = 0;
  for (std::uint32_t sample = 0; sample < numFrames; ++sample) {
    while (eventIndex < blockEvents_.size() && blockEvents_[eventIndex].sampleOffset == sample) {
      handleEvent(blockEvents_[eventIndex]);
      ++eventIndex;
    }

    float mixed = 0.0f;
    for (auto& voice : voices_) {
      mixed += voice.renderSample();
    }

    left[sample] = mixed;
    right[sample] = mixed;
    ++absoluteFrame_;
  }

  while (eventIndex < blockEvents_.size()) {
    handleEvent(blockEvents_[eventIndex]);
    ++eventIndex;
  }
}

void ZephyrEngine::setMasterGain(float gain) noexcept {
  masterGain_ = std::clamp(gain, 0.0f, 1.0f);
  for (auto& voice : voices_) {
    voice.setMasterGain(masterGain_);
  }
}

void ZephyrEngine::drainEvents(std::uint32_t numFrames) {
  blockEvents_.clear();

  MidiEvent event;
  while (blockEvents_.size() < kMaxEventsPerBlock && midiQueue_.pop(event)) {
    event.sampleOffset = static_cast<std::uint16_t>(std::min<std::uint32_t>(event.sampleOffset, numFrames - 1));
    blockEvents_.push_back(event);
  }

  std::stable_sort(blockEvents_.begin(), blockEvents_.end(), [](const MidiEvent& a, const MidiEvent& b) {
    return a.sampleOffset < b.sampleOffset;
  });
}

void ZephyrEngine::handleEvent(const MidiEvent& event) {
  const std::size_t channel = static_cast<std::size_t>(event.channel & 0x0f);

  switch (event.type) {
    case MidiEventType::NoteOn: {
      auto* voice = allocateVoice();
      if (!voice) {
        return;
      }
      voice->start(event.channel, event.note, midiNoteToFrequency(event.note), std::clamp(event.value, 0.0f, 1.0f), absoluteFrame_ + event.sampleOffset);
      voice->setPitchBend(channelPitchBend_[channel]);
      voice->setPressure(channelPressure_[channel]);
      voice->setTimbre(channelTimbre_[channel]);
      break;
    }
    case MidiEventType::NoteOff: {
      if (auto* voice = findNewestMatchingVoice(event.channel, event.note)) {
        voice->release();
      }
      break;
    }
    case MidiEventType::PitchBend: {
      channelPitchBend_[channel] = std::clamp(event.value, -1.0f, 1.0f);
      for (auto& voice : voices_) {
        if (voice.isActive() && voice.matches(event.channel, voice.matches(event.channel, event.note) ? event.note : 255)) {
          voice.setPitchBend(channelPitchBend_[channel]);
        }
      }
      for (auto& voice : voices_) {
        if (voice.isActive() && !voice.isReleasing()) {
          voice.setPitchBend(channelPitchBend_[channel]);
        }
      }
      break;
    }
    case MidiEventType::ChannelPressure: {
      channelPressure_[channel] = std::clamp(event.value, 0.0f, 1.0f);
      for (auto& voice : voices_) {
        if (voice.isActive()) {
          voice.setPressure(channelPressure_[channel]);
        }
      }
      break;
    }
    case MidiEventType::Timbre: {
      channelTimbre_[channel] = std::clamp(event.value, 0.0f, 1.0f);
      for (auto& voice : voices_) {
        if (voice.isActive()) {
          voice.setTimbre(channelTimbre_[channel]);
        }
      }
      break;
    }
    case MidiEventType::SustainPedal:
      break;
  }
}

Voice* ZephyrEngine::allocateVoice() noexcept {
  for (auto& voice : voices_) {
    if (!voice.isActive()) {
      return &voice;
    }
  }

  for (auto& voice : voices_) {
    if (voice.isReleasing()) {
      return &voice;
    }
  }

  Voice* oldest = nullptr;
  for (auto& voice : voices_) {
    if (!oldest || voice.startFrame() < oldest->startFrame()) {
      oldest = &voice;
    }
  }
  return oldest;
}

Voice* ZephyrEngine::findNewestMatchingVoice(std::uint8_t channel, std::uint8_t note) noexcept {
  Voice* newest = nullptr;
  for (auto& voice : voices_) {
    if (!voice.matches(channel, note)) {
      continue;
    }
    if (!newest || voice.startFrame() > newest->startFrame()) {
      newest = &voice;
    }
  }
  return newest;
}

} // namespace zephyr
