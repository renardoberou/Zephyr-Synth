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
  - fixed-size lock-free queue for control-thread or MIDI-thread -> audio-thread communication
- `native/include/zephyr/MidiTranslator.h`
  - converts raw MIDI bytes into engine events
- `native/include/zephyr/Voice.h`
  - polyphonic voice object with per-voice ADSR and expression state
- `native/include/zephyr/ZephyrEngine.h`
  - engine entry point for block rendering, event ingestion, and voice allocation
- `native/include/zephyr/AndroidAudioEngine.h`
  - Android-facing wrapper for the engine
- `native/src/MidiTranslator.cpp`
  - raw MIDI parsing for note, bend, pressure, timbre, and sustain events
- `native/src/Voice.cpp`
  - simple voice implementation with oscillator + ADSR
- `native/src/ZephyrEngine.cpp`
  - sample-accurate block renderer that consumes queued events inside the audio path
- `native/src/android/AndroidAudioEngine.cpp`
  - initial Oboe callback wrapper that feeds the engine inside the output callback
- `native/CMakeLists.txt`
  - native engine target plus Android wrapper target

## Current scope

This is still a **scaffold**, but it is now beyond a pure engine sketch.

Zephyr already has the correct high-level shape:
- raw MIDI -> translator -> event queue -> audio callback -> sample-accurate render block

The oscillator and modulation are intentionally simple. The priority remains establishing the correct **real-time architecture** before layering richer synthesis.

## Immediate next steps

1. Replace the simple sine/bright voice with the Zephyr multi-oscillator voice core.
2. Add native filter stages in the voice path.
3. Add channel-scoped and per-note modulation routing in the engine.
4. Build Android app glue around the Oboe wrapper.
5. Add preset serialization and parameter messaging from UI to engine.

## Design rule

No note timing should depend on frame rendering, DOM events, or UI loops.
