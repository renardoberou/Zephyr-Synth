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
  deferredReleases_.reserve(64);
}

void ZephyrEngine::prepare(double sampleRate, std::uint32_t maxBlockSize) {
  sampleRate_ = sampleRate > 0.0 ? sampleRate : 48000.0;
  maxBlockSize_ = maxBlockSize;
  absoluteFrame_ = 0;
  midiQueue_.clear();
  parameterQueue_.clear();
  deferredReleases_.clear();
  applyParametersToVoices();

  channelPitchBend_.fill(0.0f);
  channelPressure_.fill(0.0f);
  channelTimbre_.fill(0.0f);
  channelSustainPedal_.fill(false);
}

bool ZephyrEngine::pushMidiEvent(const MidiEvent& event) noexcept {
  return midiQueue_.push(event);
}

bool ZephyrEngine::pushParameterMessage(const ParameterMessage& message) noexcept {
  MidiEvent packed {};
  packed.note = static_cast<std::uint8_t>(message.target);
  packed.value = message.value;
  return parameterQueue_.push(packed);
}

void ZephyrEngine::render(float* left, float* right, std::uint32_t numFrames) {
  if (!left || !right || numFrames == 0) {
    return;
  }

  drainParameterMessages();

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
  parameters_.masterGain = masterGain_;
  for (auto& voice : voices_) {
    voice.setMasterGain(masterGain_);
  }
}

void ZephyrEngine::setPitchBendRange(float semitones) noexcept {
  pitchBendRangeSemitones_ = std::clamp(semitones, 0.0f, 24.0f);
  parameters_.pitchBendRangeSemitones = pitchBendRangeSemitones_;
  for (auto& voice : voices_) {
    voice.setPitchBendRange(pitchBendRangeSemitones_);
  }
}

void ZephyrEngine::setParameters(const EngineParameters& parameters) noexcept {
  parameters_ = parameters;
  masterGain_ = std::clamp(parameters_.masterGain, 0.0f, 1.0f);
  pitchBendRangeSemitones_ = std::clamp(parameters_.pitchBendRangeSemitones, 0.0f, 24.0f);
  applyParametersToVoices();
}

void ZephyrEngine::drainParameterMessages() {
  MidiEvent packed;
  while (parameterQueue_.pop(packed)) {
    ParameterMessage message {};
    message.target = static_cast<ParameterTarget>(packed.note);
    message.value = packed.value;
    applyParameterMessage(message);
  }
}

void ZephyrEngine::applyParameterMessage(const ParameterMessage& message) noexcept {
  switch (message.target) {
    case ParameterTarget::MasterGain:
      setMasterGain(message.value);
      break;
    case ParameterTarget::PitchBendRange:
      setPitchBendRange(message.value);
      break;
    case ParameterTarget::VoiceMix1:
      parameters_.voice.oscillatorMix[0] = std::clamp(message.value, 0.0f, 1.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::VoiceMix2:
      parameters_.voice.oscillatorMix[1] = std::clamp(message.value, 0.0f, 1.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::VoiceMix3:
      parameters_.voice.oscillatorMix[2] = std::clamp(message.value, 0.0f, 1.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::VoiceDetune1:
      parameters_.voice.detuneCents[0] = std::clamp(message.value, -100.0f, 100.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::VoiceDetune2:
      parameters_.voice.detuneCents[1] = std::clamp(message.value, -100.0f, 100.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::VoiceDetune3:
      parameters_.voice.detuneCents[2] = std::clamp(message.value, -100.0f, 100.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::Attack:
      parameters_.voice.attackSeconds = std::clamp(message.value, 0.0001f, 10.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::Decay:
      parameters_.voice.decaySeconds = std::clamp(message.value, 0.0001f, 10.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::Sustain:
      parameters_.voice.sustainLevel = std::clamp(message.value, 0.0f, 1.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::Release:
      parameters_.voice.releaseSeconds = std::clamp(message.value, 0.0001f, 10.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::FilterBaseCutoff:
      parameters_.voice.filterBaseCutoffHz = std::clamp(message.value, 20.0f, 18000.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::FilterEnvelopeAmount:
      parameters_.voice.filterEnvelopeAmountHz = std::clamp(message.value, 0.0f, 20000.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::FilterPressureAmount:
      parameters_.voice.filterPressureAmountHz = std::clamp(message.value, 0.0f, 20000.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::FilterTimbreAmount:
      parameters_.voice.filterTimbreAmountHz = std::clamp(message.value, 0.0f, 20000.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::Filter2BaseCutoff:
      parameters_.voice.filter2BaseCutoffHz = std::clamp(message.value, 20.0f, 18000.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::Filter2EnvelopeAmount:
      parameters_.voice.filter2EnvelopeAmountHz = std::clamp(message.value, 0.0f, 20000.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::Filter2PressureAmount:
      parameters_.voice.filter2PressureAmountHz = std::clamp(message.value, 0.0f, 20000.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::Filter2TimbreAmount:
      parameters_.voice.filter2TimbreAmountHz = std::clamp(message.value, 0.0f, 20000.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::FilterRoutingBlend:
      parameters_.voice.filterRoutingBlend = std::clamp(message.value, 0.0f, 1.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::FilterRoutingMode:
      parameters_.voice.filterRoutingMode = std::clamp(message.value, 0.0f, 1.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::HighpassCutoff:
      parameters_.voice.highpassCutoffHz = std::clamp(message.value, 20.0f, 4000.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::LfoRate:
      parameters_.voice.lfoRateHz = std::clamp(message.value, 0.01f, 40.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::LfoPitchAmount:
      parameters_.voice.lfoPitchAmountSemitones = std::clamp(message.value, -24.0f, 24.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::LfoFilterAmount:
      parameters_.voice.lfoFilterAmountHz = std::clamp(message.value, -12000.0f, 12000.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::Macro1Value:
      parameters_.voice.macro1Value = std::clamp(message.value, 0.0f, 1.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::Macro1ToCutoff:
      parameters_.voice.macro1ToCutoffHz = std::clamp(message.value, -12000.0f, 12000.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::Macro1ToDrive:
      parameters_.voice.macro1ToDrive = std::clamp(message.value, -4.0f, 4.0f);
      applyParametersToVoices();
      break;
    case ParameterTarget::DriveAmount:
      parameters_.voice.driveAmount = std::clamp(message.value, 0.1f, 8.0f);
      applyParametersToVoices();
      break;
  }
}

void ZephyrEngine::releaseDeferredNotesForChannel(std::uint8_t channel) noexcept {
  auto it = deferredReleases_.begin();
  while (it != deferredReleases_.end()) {
    if (it->channel == channel) {
      if (auto* voice = findNewestMatchingVoice(it->channel, it->note)) {
        voice->release();
      }
      it = deferredReleases_.erase(it);
    } else {
      ++it;
    }
  }
}

void ZephyrEngine::applyParametersToVoices() noexcept {
  for (auto& voice : voices_) {
    voice.setSampleRate(sampleRate_);
    voice.setMasterGain(masterGain_);
    voice.setPitchBendRange(pitchBendRangeSemitones_);
    voice.setParameters(parameters_.voice);
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
      voice->setMasterGain(masterGain_);
      voice->setPitchBendRange(pitchBendRangeSemitones_);
      voice->setParameters(parameters_.voice);
      voice->start(event.channel, event.note, midiNoteToFrequency(event.note), std::clamp(event.value, 0.0f, 1.0f), absoluteFrame_ + event.sampleOffset);
      voice->setPitchBend(channelPitchBend_[channel]);
      voice->setPressure(channelPressure_[channel]);
      voice->setTimbre(channelTimbre_[channel]);
      break;
    }
    case MidiEventType::NoteOff: {
      if (channelSustainPedal_[channel]) {
        deferredReleases_.push_back({ event.channel, event.note });
      } else if (auto* voice = findNewestMatchingVoice(event.channel, event.note)) {
        voice->release();
      }
      break;
    }
    case MidiEventType::PitchBend: {
      channelPitchBend_[channel] = std::clamp(event.value, -1.0f, 1.0f);
      for (auto& voice : voices_) {
        if (voice.isActive() && voice.channel() == event.channel) {
          voice.setPitchBend(channelPitchBend_[channel]);
        }
      }
      break;
    }
    case MidiEventType::ChannelPressure: {
      channelPressure_[channel] = std::clamp(event.value, 0.0f, 1.0f);
      for (auto& voice : voices_) {
        if (voice.isActive() && voice.channel() == event.channel) {
          voice.setPressure(channelPressure_[channel]);
        }
      }
      break;
    }
    case MidiEventType::Timbre: {
      channelTimbre_[channel] = std::clamp(event.value, 0.0f, 1.0f);
      for (auto& voice : voices_) {
        if (voice.isActive() && voice.channel() == event.channel) {
          voice.setTimbre(channelTimbre_[channel]);
        }
      }
      break;
    }
    case MidiEventType::SustainPedal: {
      const bool down = event.value >= 0.5f;
      channelSustainPedal_[channel] = down;
      if (!down) {
        releaseDeferredNotesForChannel(event.channel);
      }
      break;
    }
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
