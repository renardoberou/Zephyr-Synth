#pragma once

#include <array>
#include <cstdint>

#include "Modulation.h"

namespace zephyr {

struct VoiceParameters {
  static constexpr std::size_t kRouteCount = 10;

  std::array<float, 3> oscillatorMix { 0.62f, 0.24f, 0.14f };
  std::array<float, 3> detuneCents { 0.0f, -7.0f, 7.0f };
  float attackSeconds { 0.002f };
  float decaySeconds { 0.08f };
  float sustainLevel { 0.75f };
  float releaseSeconds { 0.12f };
  float filterBaseCutoffHz { 220.0f };
  float filter2BaseCutoffHz { 3400.0f };
  float filterRoutingBlend { 0.5f };
  float filterRoutingMode { 0.0f };
  float highpassCutoffHz { 40.0f };
  float lfoRateHz { 4.5f };
  float macro1Value { 0.0f };
  float driveAmount { 1.2f };
  std::array<ModulationRoute, kRouteCount> modulationRoutes {{
    { true, ModulationSource::Envelope, ModulationDestination::Filter1Cutoff, 2800.0f },
    { true, ModulationSource::Envelope, ModulationDestination::Filter2Cutoff, 1600.0f },
    { true, ModulationSource::Pressure, ModulationDestination::Filter1Cutoff, 1800.0f },
    { true, ModulationSource::Pressure, ModulationDestination::Filter2Cutoff, 900.0f },
    { true, ModulationSource::Timbre, ModulationDestination::Filter1Cutoff, 4200.0f },
    { true, ModulationSource::Timbre, ModulationDestination::Filter2Cutoff, 2200.0f },
    { true, ModulationSource::Lfo1, ModulationDestination::PitchSemitones, 0.0f },
    { true, ModulationSource::Lfo1, ModulationDestination::Filter1Cutoff, 0.0f },
    { true, ModulationSource::Macro1, ModulationDestination::Filter1Cutoff, 0.0f },
    { true, ModulationSource::Macro1, ModulationDestination::Drive, 0.0f },
  }};
};

class AdsrEnvelope {
public:
  void setSampleRate(double sampleRate) noexcept;
  void setAttack(float seconds) noexcept;
  void setDecay(float seconds) noexcept;
  void setSustain(float level) noexcept;
  void setRelease(float seconds) noexcept;

  void noteOn() noexcept;
  void noteOff() noexcept;
  float nextSample() noexcept;

  bool isIdle() const noexcept { return stage_ == Stage::Idle; }

private:
  enum class Stage : std::uint8_t {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
  };

  float attackSeconds_ { 0.002f };
  float decaySeconds_ { 0.08f };
  float sustainLevel_ { 0.75f };
  float releaseSeconds_ { 0.12f };
  float level_ { 0.0f };
  double sampleRate_ { 48000.0 };
  Stage stage_ { Stage::Idle };
};

class Voice {
public:
  void setSampleRate(double sampleRate) noexcept;
  void setMasterGain(float gain) noexcept { masterGain_ = gain; }
  void setPitchBendRange(float semitones) noexcept { pitchBendRangeSemitones_ = semitones; }
  void setParameters(const VoiceParameters& parameters) noexcept;

  void start(std::uint8_t channel, std::uint8_t note, float frequency, float velocity, std::uint64_t frameIndex) noexcept;
  void release() noexcept;

  void setPitchBend(float normalized) noexcept;
  void setPressure(float value) noexcept;
  void setTimbre(float value) noexcept;

  bool matches(std::uint8_t channel, std::uint8_t note) const noexcept;
  bool isActive() const noexcept { return active_; }
  bool isReleasing() const noexcept { return releasing_; }
  std::uint8_t channel() const noexcept { return channel_; }
  std::uint8_t note() const noexcept { return note_; }
  std::uint64_t startFrame() const noexcept { return startFrame_; }

  float renderSample() noexcept;

private:
  float currentFrequency() const noexcept;
  float renderOscillator(std::size_t index, float frequency) noexcept;
  float sourceValue(ModulationSource source, float envelopeValue, float lfoValue, float macroValue) const noexcept;
  float updateLowpass(float input, float cutoffHz, float& state) noexcept;
  float updateHighpass(float input, float cutoffHz) noexcept;
  static constexpr float midiToFrequency(std::uint8_t note) noexcept;

  AdsrEnvelope envelope_ {};
  VoiceParameters parameters_ {};
  std::uint8_t channel_ { 0 };
  std::uint8_t note_ { 0 };
  float baseFrequency_ { 440.0f };
  float velocity_ { 0.0f };
  float pressure_ { 0.0f };
  float timbre_ { 0.0f };
  float pitchBend_ { 0.0f };
  float pitchBendRangeSemitones_ { 2.0f };
  float masterGain_ { 0.18f };
  double sampleRate_ { 48000.0 };
  std::array<float, 3> phases_ { 0.0f, 0.0f, 0.0f };
  float lfoPhase_ { 0.0f };
  float filterState1_ { 0.0f };
  float filterState2_ { 0.0f };
  float hpfState_ { 0.0f };
  float hpfLastInput_ { 0.0f };
  bool active_ { false };
  bool releasing_ { false };
  std::uint64_t startFrame_ { 0 };
};

} // namespace zephyr
