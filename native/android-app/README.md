# Zephyr Native Android App Scaffold

This directory is the first Android app shell around the native Zephyr engine.

## What exists

- Gradle settings and root build file
- app module scaffold
- JNI bridge (`zephyr_jni`)
- minimal Kotlin activity and bridge
- simple layout with start/stop, three test pads, and two parameter controls
- native CMake glue that pulls in the engine from `native/`

## Current purpose

This is not yet the final Zephyr app UI.

Its purpose is to let the native engine be started and exercised on-device while the real-time audio architecture matures.

## Current control mapping

- Start / Stop engine
- C4 / E4 / G4 touch pads
- Macro 1 slider
- Filter base cutoff slider

## Next steps

1. Connect real Android MIDI input into the app shell.
2. Replace the test-pad shell with a proper performance surface.
3. Expand JNI parameter bridging beyond a few controls.
4. Add preset save/load messaging.
5. Improve native engine build verification and runtime testing.

## Important note

This scaffold has been written into the repository, but it has not been compiled or runtime-tested here.
