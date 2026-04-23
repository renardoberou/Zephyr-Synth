#pragma once

#include <cstdint>

namespace zephyr {

enum class ParameterTarget : std::uint8_t {
  MasterGain,
  PitchBendRange,
  VoiceMix1,
  VoiceMix2,
  VoiceMix3,
  VoiceDetune1,
  VoiceDetune2,
  VoiceDetune3,
  Attack,
  Decay,
  Sustain,
  Release,
  FilterBaseCutoff,
  FilterEnvelopeAmount,
  FilterPressureAmount,
  FilterTimbreAmount,
  Filter2BaseCutoff,
  Filter2EnvelopeAmount,
  Filter2PressureAmount,
  Filter2TimbreAmount,
  FilterRoutingBlend,
  FilterRoutingMode,
  HighpassCutoff,
  LfoRate,
  LfoPitchAmount,
  LfoFilterAmount,
  Macro1Value,
  Macro1ToCutoff,
  Macro1ToDrive,
  DriveAmount,
};

struct ParameterMessage {
  ParameterTarget target { ParameterTarget::MasterGain };
  float value { 0.0f };
};

} // namespace zephyr
