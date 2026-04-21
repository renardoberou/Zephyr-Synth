# Zephyr Synth

A small browser synth scaffold using the Web Audio API and an AudioWorklet oscillator.

## What it currently does

- Loads a simple oscillator through an AudioWorklet
- Starts audio only after a user gesture
- Renders a canvas knob UI
- Lets you control output volume by dragging the knob

## Run

This repo is configured to work on GitHub Pages.

Open:

`https://renardoberou.github.io/Zephyr-Synth/`

## Files

- `index.html` — page and styles
- `main.js` — UI and app boot
- `src/synth.js` — synth engine
- `src/mpe.js` — MIDI/MPE placeholder
- `src/ui/*` — canvas UI
- `src/worklets/vcoProcessor.js` — oscillator DSP
