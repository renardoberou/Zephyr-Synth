# Zephyr Native Android App

This directory is the native Android app around the Zephyr C++ engine — a true
native build (Kotlin + JNI + Oboe), not a WebView shell.

## What exists

- Gradle settings and root build file (AGP 8.6.1 / Kotlin 2.0.20 / Gradle 8.10.2, compileSdk 35)
- app module with JNI bridge (`zephyr_jni`) into the C++20 engine
- Oboe audio output via Prefab (`com.google.oboe:oboe:1.10.0`)
- Android MIDI input controller that opens hardware MIDI output ports and
  forwards raw MIDI bytes to the native engine
- `ZephyrKeyboardView`: a multitouch two-octave on-screen keyboard (C3–C5)
  with glide between keys, y-position velocity, and haptic feedback
- Audio-focus-aware lifecycle in `MainActivity` (pauses on focus loss,
  resumes on regain, keeps screen on while playing)
- Zephyr dark theme, adaptive launcher icon, brand palette
  (charcoal / amber / copper)
- native CMake glue that pulls in the engine from `native/`

## Current control mapping

- Start / Stop engine (engine auto-starts on launch)
- MIDI device scan and connection status
- Two-octave multitouch keyboard
- Macro 1 slider
- Filter base cutoff slider

## Toolchain note

The module intentionally uses the proven AGP 8.6.1 / Kotlin 2.0.20 /
Gradle 8.10.2 / compileSdk 35 stack (same as the other Resonant Systems
Android apps) rather than AGP 9.x. The earlier AGP 9 scaffold never built;
migrating to AGP 9 can be retried later as an isolated change once the app
is stable on CI.

## Next steps

1. Replace the simple MIDI controller with stronger device/port selection.
2. Grow the keyboard shell into the full performance surface
   (Synth / Perform / Matrix / FX workspaces per ROADMAP.md).
3. Expand JNI parameter bridging beyond a few controls.
4. Add preset save/load messaging.
5. Signed release build for distribution (Phase B pattern).

## Build status

The C++ engine compiles clean (`-std=c++20 -Wall -Wextra`) and passes a
behavioral smoke test (note on/off, packed parameter queue, modulation
routing, sustain pedal, voice stealing). The Android/JNI layer typechecks
against the JNI headers and an Oboe API surface. APKs are produced by the
`android-debug-apk` GitHub Actions workflow.
