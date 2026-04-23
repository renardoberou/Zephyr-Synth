#include "zephyr/Voice.h"

#include <algorithm>
#include <cmath>

namespace zephyr {

namespace {
constexpr float kPi = 3.14159265358979323846f;
constexpr float kTwoPi = 2.0f * kPi;

float clamp01(float value) noexcept {
  return std::clamp(value, 0.0f, 1.0f);
}
} // namespace

void AdsrEnvelope::setSampleRate(double sampleRate) noexcept {
  sampleRate_ = sampleRate > 0.0 ? sampleRate : 48000.0;
}

void AdsrEnvelope::setAttack(float seconds) noexcept {
  attackSeconds_ = std::max(0.0001f, seconds);
}

void AdsrEnvelope::setDecay(float seconds) noexcept {
  decaySeconds_ = std::max(0.0001f, seconds);
}

void AdsrEnvelope::setSustain(float level) noexcept {
  sustainLevel_ = std::clamp(level, 0.0f, 1.0f);
}

void AdsrEnvelope::setRelease(float seconds) noexcept {
  releaseSeconds_ = std::max(0.0001f, seconds);
}

void AdsrEnvelope::noteOn() noexcept {
  stage_ = Stage::Attack;
}

void AdsrEnvelope::noteOff() noexcept {
  if (stage_ != Stage::Idle) {
    stage_ = Stage::Release;
  }
}

float AdsrEnvelope::nextSample() noexcept {
  const float attackInc = 1.0f / static_cast<float>(attackSeconds_ * sampleRate_);
  const float decayInc = (1.0f - sustainLevel_) / static_cast<float>(decaySeconds_ * sampleRate_);
  const float releaseInc = std::max(0.000001f, level_) / static_cast<float>(releaseSeconds_ * sampleRate_);

  switch (stage_) {
    case Stage::Idle:
      level_ = 0.0f;
      break;
    case Stage::Attack:
      level_ += attackInc;
      if (level_ >= 1.0f) {
        level_ = 1.0f;
        stage_ = Stage::Decay;
      }
      break;
    case Stage::Decay:
      level_ -= decayInc;
      if (level_ <= sustainLevel_) {
        level_ = sustainLevel_;
        stage_ = Stage::Sustain;
      }
      break;
    case Stage::Sustain:
      level_ = sustainLevel_;
      break;
    case Stage::Release:
      level_ -= releaseInc;
      if (level_ <= 0.0f) {
        level_ = 0.0f;
        stage_ = Stage::Idle;
      }
      break;
  }

  return level_;
}

void Voice::setSampleRate(double sampleRate) noexcept {
  sampleRate_ = sampleRate > 0.0 ? sampleRate : 48000.0;
  envelope_.setSampleRate(sampleRate_);
}

void Voice::start(std::uint8_t channel, std::uint8_t note, float frequency, float velocity, std::uint64_t frameIndex) noexcept {
  channel_ = channel;
  note_ = note;
  baseFrequency_ = frequency;
  velocity_ = std::clamp(velocity, 0.0f, 1.0f);
  pressure_ = 0.0f;
  timbre_ = 0.0f;
  pitchBend_ = 0.0f;
  phases_ = { 0.0f, 0.0f, 0.0f };
  filterState_ = 0.0f;
  active_ = true;
  releasing_ = false;
  startFrame_ = frameIndex;
  envelope_.noteOn();
}

void Voice::release() noexcept {
  releasing_ = true;
  envelope_.noteOff();
}

void Voice::setPitchBend(float normalized) noexcept {
  pitchBend_ = std::clamp(normalized, -1.0f, 1.0f);
}

void Voice::setPressure(float value) noexcept {
  pressure_ = std::clamp(value, 0.0f, 1.0f);
}

void Voice::setTimbre(float value) noexcept {
  timbre_ = std::clamp(value, 0.0f, 1.0f);
}

bool Voice::matches(std::uint8_t channel, std::uint8_t note) const noexcept {
  return active_ && channel_ == channel && note_ == note;
}

float Voice::renderSample() noexcept {
  if (!active_) {
    return 0.0f;
  }

  const float envelopeValue = envelope_.nextSample();
  if (envelope_.isIdle()) {
    active_ = false;
    releasing_ = false;
    return 0.0f;
  }

  const float frequency = currentFrequency();
  float mixed = 0.0f;
  for (std::size_t i = 0; i < oscillatorMix_.size(); ++i) {
    mixed += renderOscillator(i, frequency) * oscillatorMix_[i];
  }

  const float contour = 0.35f + (envelopeValue * 0.65f);
  const float pressureBoost = pressure_ * 1800.0f;
  const float timbreBoost = timbre_ * 4200.0f;
  const float cutoffHz = std::clamp(220.0f + pressureBoost + timbreBoost + (contour * 2800.0f), 80.0f, 12000.0f);
  const float filtered = updateLowpass(mixed, cutoffHz);
  const float driven = std::tanh(filtered * (1.2f + (pressure_ * 0.45f)));

  return driven * envelopeValue * velocity_ * masterGain_;
}

float Voice::currentFrequency() const noexcept {
  const float bendSemitones = pitchBend_ * pitchBendRangeSemitones_;
  return baseFrequency_ * std::pow(2.0f, bendSemitones / 12.0f);
}

float Voice::renderOscillator(std::size_t index, float frequency) noexcept {
  const float detunedFrequency = frequency * std::pow(2.0f, detuneCents_[index] / 1200.0f);
  const float increment = kTwoPi * detunedFrequency / static_cast<float>(sampleRate_);
  phases_[index] += increment;
  if (phases_[index] >= kTwoPi) {
    phases_[index] -= kTwoPi;
  }

  const float normalizedPhase = phases_[index] / kTwoPi;
  switch (index) {
    case 0: {
      const float saw = (2.0f * normalizedPhase) - 1.0f;
      const float soft = std::sin(phases_[index]);
      return (saw * (0.82f - (timbre_ * 0.28f))) + (soft * 0.18f);
    }
    case 1: {
      const float pulseWidth = 0.5f + ((timbre_ - 0.5f) * 0.32f);
      return normalizedPhase < pulseWidth ? 1.0f : -1.0f;
    }
    case 2: {
      const float triangle = 1.0f - (4.0f * std::fabs(normalizedPhase - 0.5f));
      return triangle;
    }
    default:
      return std::sin(phases_[index]);
  }
}

float Voice::updateLowpass(float input, float cutoffHz) noexcept {
  const float x = std::exp((-2.0f * kPi * cutoffHz) / static_cast<float>(sampleRate_));
  filterState_ = ((1.0f - x) * input) + (x * filterState_);
  return filterState_;
}

constexpr float Voice::midiToFrequency(std::uint8_t note) noexcept {
  return 440.0f * std::pow(2.0f, (static_cast<int>(note) - 69) / 12.0f);
}

} // namespace zephyr
