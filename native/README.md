# Zephyr Native Engine

This folder starts the native pivot for Zephyr.

## Goal

Build Zephyr as a **native low-latency instrument** using a real audio callback architecture instead of a browser/UI-driven note path.

The target architecture is:

- **audio-thread driven engine**
- **lock-free MIDI/event queue**
- **sample-accurate event handling inside render blocks**
- **polyphonic voice allocation in the engine**
- **UI demoted to control/observer layer only**
- **Android audio backend via Oboe/AAudio**

## What exists now

- `native/include/zephyr/MidiEvent.h`
  - timestampable MIDI/control events with `sampleOffset`
- `native/include/zephyr/LockFreeMidiQueue.h`
  - fixed-size lock-free queue for thread-safe audio messaging
- `native/include/zephyr/ParameterMessage.h`
  - UI/app-to-engine parameter message payloads
- `native/include/zephyr/MidiTranslator.h`
  - converts raw MIDI bytes into engine events
- `native/include/zephyr/Voice.h`
  - polyphonic voice object with configurable 3-oscillator core, ADSR, and filter state
- `native/include/zephyr/ZephyrEngine.h`
  - engine entry point for block rendering, event ingestion, sustain handling, and parameter messaging
- `native/include/zephyr/AndroidAudioEngine.h`
  - Android-facing wrapper for the engine
- `native/src/MidiTranslator.cpp`
  - raw MIDI parsing for note, bend, pressure, timbre, and sustain events
- `native/src/Voice.cpp`
  - configurable native voice implementation with oscillator stack, lowpass stage, and drive
- `native/src/ZephyrEngine.cpp`
  - sample-accurate block renderer that consumes queued events and queued parameter messages inside the audio path
- `native/src/android/AndroidAudioEngine.cpp`
  - initial Oboe callback wrapper that feeds the engine inside the output callback
- `native/CMakeLists.txt`
  - native engine target plus Android wrapper target

## Current scope

This is still a **scaffold**, but it is now beyond a pure engine sketch.

Zephyr already has the correct high-level shape:
- raw MIDI -> translator -> event queue -> audio callback -> sample-accurate render block
- app/UI parameter changes -> parameter queue -> audio callback -> engine state update

The synthesis is still intentionally reduced. The priority remains establishing the correct **real-time architecture** before layering full Zephyr complexity.

## Immediate next steps

1. Add a second native filter stage and clearer routing options.
2. Add modulation sources and destination handling inside the engine.
3. Build Android app glue around the Oboe wrapper.
4. Add preset serialization and parameter messaging from UI shell to engine.
5. Add performance macros as native engine controls rather than shell-only ideas.

## Design rule

No note timing should depend on frame rendering, DOM events, or UI loops.
