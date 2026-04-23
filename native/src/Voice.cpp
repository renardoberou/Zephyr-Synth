#include "zephyr/Voice.h"

#include <algorithm>
#include <cmath>

namespace zephyr {

namespace {
constexpr float kPi = 3.14159265358979323846f;
constexpr float kTwoPi = 2.0f * kPi;
constexpr float kMaxPitchBendSemitones = 2.0f;
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
  phase_ = 0.0f;
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
  const float increment = kTwoPi * frequency / static_cast<float>(sampleRate_);
  phase_ += increment;
  if (phase_ >= kTwoPi) {
    phase_ -= kTwoPi;
  }

  const float sine = std::sin(phase_);
  const float bright = 2.0f * (phase_ / kTwoPi) - 1.0f;
  const float waveform = (sine * (1.0f - timbre_)) + (bright * timbre_ * 0.35f);
  const float pressureGain = 1.0f + (pressure_ * 0.25f);
  return waveform * envelopeValue * velocity_ * masterGain_ * pressureGain;
}

float Voice::currentFrequency() const noexcept {
  const float bendSemitones = pitchBend_ * kMaxPitchBendSemitones;
  return baseFrequency_ * std::pow(2.0f, bendSemitones / 12.0f);
}

constexpr float Voice::midiToFrequency(std::uint8_t note) noexcept {
  return 440.0f * std::pow(2.0f, (static_cast<int>(note) - 69) / 12.0f);
}

} // namespace zephyr
