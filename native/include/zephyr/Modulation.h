#pragma once

#include <cstdint>

namespace zephyr {

enum class ModulationSource : std::uint8_t {
  Envelope,
  Pressure,
  Timbre,
  Lfo1,
  Macro1,
};

enum class ModulationDestination : std::uint8_t {
  PitchSemitones,
  Filter1Cutoff,
  Filter2Cutoff,
  Drive,
};

struct ModulationRoute {
  bool enabled { false };
  ModulationSource source { ModulationSource::Envelope };
  ModulationDestination destination { ModulationDestination::Filter1Cutoff };
  float amount { 0.0f };
};

} // namespace zephyr
