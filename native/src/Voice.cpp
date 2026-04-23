#include "zephyr/Voice.h"

#include <algorithm>
#include <cmath>

namespace zephyr {

namespace {
constexpr float kPi = 3.14159265358979323846f;
constexpr float kTwoPi = 2.0f * kPi;
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

void Voice::setParameters(const VoiceParameters& parameters) noexcept {
  parameters_ = parameters;
  envelope_.setAttack(parameters_.attackSeconds);
  envelope_.setDecay(parameters_.decaySeconds);
  envelope_.setSustain(parameters_.sustainLevel);
  envelope_.setRelease(parameters_.releaseSeconds);
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
  lfoPhase_ = 0.0f;
  filterState1_ = 0.0f;
  filterState2_ = 0.0f;
  hpfState_ = 0.0f;
  hpfLastInput_ = 0.0f;
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

  const float lfoIncrement = kTwoPi * parameters_.lfoRateHz / static_cast<float>(sampleRate_);
  lfoPhase_ += lfoIncrement;
  if (lfoPhase_ >= kTwoPi) {
    lfoPhase_ -= kTwoPi;
  }
  const float lfoValue = std::sin(lfoPhase_);
  const float macroValue = std::clamp(parameters_.macro1Value, 0.0f, 1.0f);

  float pitchModSemitones = 0.0f;
  float filter1ModHz = 0.0f;
  float filter2ModHz = 0.0f;
  float driveMod = 0.0f;

  for (const auto& route : parameters_.modulationRoutes) {
    if (!route.enabled) {
      continue;
    }
    const float modValue = sourceValue(route.source, envelopeValue, lfoValue, macroValue);
    const float contribution = modValue * route.amount;
    switch (route.destination) {
      case ModulationDestination::PitchSemitones:
        pitchModSemitones += contribution;
        break;
      case ModulationDestination::Filter1Cutoff:
        filter1ModHz += contribution;
        break;
      case ModulationDestination::Filter2Cutoff:
        filter2ModHz += contribution;
        break;
      case ModulationDestination::Drive:
        driveMod += contribution;
        break;
    }
  }

  const float frequency = currentFrequency() * std::pow(2.0f, pitchModSemitones / 12.0f);

  float mixed = 0.0f;
  for (std::size_t i = 0; i < parameters_.oscillatorMix.size(); ++i) {
    mixed += renderOscillator(i, frequency) * parameters_.oscillatorMix[i];
  }

  const float cutoff1Hz = std::clamp(parameters_.filterBaseCutoffHz + filter1ModHz, 40.0f, 16000.0f);
  const float cutoff2Hz = std::clamp(parameters_.filter2BaseCutoffHz + filter2ModHz, 40.0f, 18000.0f);

  const float stage1 = updateLowpass(mixed, cutoff1Hz, filterState1_);
  const float stage2Parallel = updateLowpass(mixed, cutoff2Hz, filterState2_);
  const float stage2Serial = updateLowpass(stage1, cutoff2Hz, filterState2_);

  const float blend = std::clamp(parameters_.filterRoutingBlend, 0.0f, 1.0f);
  const float mode = std::clamp(parameters_.filterRoutingMode, 0.0f, 1.0f);
  const float parallelOut = (stage1 * (1.0f - blend)) + (stage2Parallel * blend);
  const float serialOut = stage2Serial;
  const float routed = (serialOut * (1.0f - mode)) + (parallelOut * mode);

  const float highpassed = updateHighpass(routed, std::clamp(parameters_.highpassCutoffHz, 20.0f, 4000.0f));
  const float drive = std::max(0.1f, parameters_.driveAmount + driveMod);
  const float driven = std::tanh(highpassed * drive);

  return driven * envelopeValue * velocity_ * masterGain_;
}

float Voice::currentFrequency() const noexcept {
  const float bendSemitones = pitchBend_ * pitchBendRangeSemitones_;
  return baseFrequency_ * std::pow(2.0f, bendSemitones / 12.0f);
}

float Voice::renderOscillator(std::size_t index, float frequency) noexcept {
  const float detunedFrequency = frequency * std::pow(2.0f, parameters_.detuneCents[index] / 1200.0f);
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

float Voice::sourceValue(ModulationSource source, float envelopeValue, float lfoValue, float macroValue) const noexcept {
  switch (source) {
    case ModulationSource::Envelope:
      return envelopeValue;
    case ModulationSource::Pressure:
      return pressure_;
    case ModulationSource::Timbre:
      return timbre_;
    case ModulationSource::Lfo1:
      return lfoValue;
    case ModulationSource::Macro1:
      return macroValue;
  }
  return 0.0f;
}

float Voice::updateLowpass(float input, float cutoffHz, float& state) noexcept {
  const float x = std::exp((-2.0f * kPi * cutoffHz) / static_cast<float>(sampleRate_));
  state = ((1.0f - x) * input) + (x * state);
  return state;
}

float Voice::updateHighpass(float input, float cutoffHz) noexcept {
  const float x = std::exp((-2.0f * kPi * cutoffHz) / static_cast<float>(sampleRate_));
  const float output = x * (hpfState_ + input - hpfLastInput_);
  hpfState_ = output;
  hpfLastInput_ = input;
  return output;
}

constexpr float Voice::midiToFrequency(std::uint8_t note) noexcept {
  return 440.0f * std::pow(2.0f, (static_cast<int>(note) - 69) / 12.0f);
}

} // namespace zephyr
