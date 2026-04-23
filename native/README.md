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
- **Android audio backend via Oboe/AAudio in the next phase**

## What exists in this first native step

- `native/include/zephyr/MidiEvent.h`
  - timestampable MIDI/control events with `sampleOffset`
- `native/include/zephyr/LockFreeMidiQueue.h`
  - fixed-size lock-free queue for control-thread or MIDI-thread -> audio-thread communication
- `native/include/zephyr/Voice.h`
  - polyphonic voice object with per-voice ADSR and expression state
- `native/include/zephyr/ZephyrEngine.h`
  - engine entry point for block rendering, event ingestion, and voice allocation
- `native/src/Voice.cpp`
  - simple voice implementation with oscillator + ADSR
- `native/src/ZephyrEngine.cpp`
  - sample-accurate block renderer that consumes queued events inside the audio path
- `native/CMakeLists.txt`
  - initial static-library build target for the engine

## Current scope

This is the **engine scaffold**, not yet a complete Android app.

The oscillator and modulation are intentionally simple at this stage. The priority is to establish the correct **real-time architecture** before layering richer synthesis.

## Next native steps

1. Add Android standalone wrapper using **Oboe** with low-latency performance mode.
2. Feed hardware MIDI into the engine queue and render in the callback.
3. Add Zephyr voice architecture layers:
   - multi-oscillator voice core
   - filter block
   - modulation matrix
   - macro system
4. Add preset serialization.
5. Build native UI shell around the engine.

## Design rule

No note timing should depend on frame rendering, DOM events, or UI loops.
