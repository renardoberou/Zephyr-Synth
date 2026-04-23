# Zephyr Native Engine

This folder starts the native pivot for Zephyr.

## Goal

Build Zephyr as a native low-latency instrument using a real audio callback architecture instead of a browser/UI-driven note path.

The target architecture is:

- audio-thread driven engine
- lock-free MIDI/event queue
- sample-accurate event handling inside render blocks
- polyphonic voice allocation in the engine
- UI demoted to control/observer layer only
- Android audio backend via Oboe/AAudio

## What exists now

- `native/include/zephyr/MidiEvent.h`
  - timestampable MIDI/control events with `sampleOffset`
- `native/include/zephyr/LockFreeMidiQueue.h`
  - fixed-size lock-free queue for thread-safe audio messaging
- `native/include/zephyr/ParameterMessage.h`
  - UI/app-to-engine parameter message payloads
- `native/include/zephyr/Modulation.h`
  - named modulation sources, destinations, and routes
- `native/include/zephyr/MidiTranslator.h`
  - converts raw MIDI bytes into engine events
- `native/include/zephyr/Voice.h`
  - polyphonic voice object with configurable 3-oscillator core, dual lowpass routing, highpass, and route-based modulation
- `native/include/zephyr/ZephyrEngine.h`
  - engine entry point for block rendering, event ingestion, sustain handling, and parameter messaging
- `native/include/zephyr/AndroidAudioEngine.h`
  - Android-facing wrapper for the engine
- `native/src/MidiTranslator.cpp`
  - raw MIDI parsing for note, bend, pressure, timbre, and sustain events
- `native/src/Voice.cpp`
  - configurable native voice implementation with oscillator stack, dual lowpass path, highpass, drive, LFO, and macro-driven modulation routes
- `native/src/ZephyrEngine.cpp`
  - sample-accurate block renderer that consumes queued events and queued parameter messages inside the audio path
- `native/src/android/AndroidAudioEngine.cpp`
  - initial Oboe callback wrapper that feeds the engine inside the output callback
- `native/CMakeLists.txt`
  - native engine target plus Android wrapper target

## Current scope

This is still a scaffold, but it is now beyond a pure engine sketch.

Zephyr already has the correct high-level shape:
- raw MIDI -> translator -> event queue -> audio callback -> sample-accurate render block
- app/UI parameter changes -> parameter queue -> audio callback -> engine state update
- named modulation routes -> per-voice render path

The synthesis is still intentionally reduced. The priority remains establishing the correct real-time architecture before layering full Zephyr complexity.

## Immediate next steps

1. Add Android app glue around the native engine so it can be started and tested on device.
2. Expand route-based modulation into a fuller matrix instead of a fixed route array.
3. Add preset serialization and parameter messaging from a native UI shell.
4. Add performance macros as engine controls, not shell-only ideas.
5. Add richer filter behavior and voice-level refinement.

## Design rule

No note timing should depend on frame rendering, DOM events, or UI loops.
