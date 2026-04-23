#pragma once

#include <array>
#include <cstdint>

namespace zephyr {

struct VoiceParameters {
  std::array<float, 3> oscillatorMix { 0.62f, 0.24f, 0.14f };
  std::array<float, 3> detuneCents { 0.0f, -7.0f, 7.0f };
  float attackSeconds { 0.002f };
  float decaySeconds { 0.08f };
  float sustainLevel { 0.75f };
  float releaseSeconds { 0.12f };
  float filterBaseCutoffHz { 220.0f };
  float filterEnvelopeAmountHz { 2800.0f };
  float filterPressureAmountHz { 1800.0f };
  float filterTimbreAmountHz { 4200.0f };
  float driveAmount { 1.2f };
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
  float updateLowpass(float input, float cutoffHz) noexcept;
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
  float filterState_ { 0.0f };
  bool active_ { false };
  bool releasing_ { false };
  std::uint64_t startFrame_ { 0 };
};

} // namespace zephyr
