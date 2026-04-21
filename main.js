import { Synth } from "./src/synth.js";
import { UIEngine } from "./src/ui/uiEngine.js";
import { KnobRenderer } from "./src/ui/knobRenderer.js";

const ctx = new AudioContext();
const synth = new Synth(ctx);
const ui = new UIEngine();

await synth.init();

const defaults = {
  "osc1.gain": 0.7,
  "osc2.gain": 0.5,
  "osc3.gain": 0.5,
  "master.gain": 0.6,
  "filter.cutoff": normalizeLog(1200, 60, 12000),
  "lfo.rate": normalizeLog(3, 0.1, 20),
};

const knobReadouts = {
  "osc1.gain": (v) => document.getElementById("osc1-gain-readout").textContent = v.toFixed(2),
  "osc2.gain": (v) => document.getElementById("osc2-gain-readout").textContent = v.toFixed(2),
  "osc3.gain": (v) => document.getElementById("osc3-gain-readout").textContent = v.toFixed(2),
  "master.gain": (v) => document.getElementById("master-gain-readout").textContent = v.toFixed(2),
  "filter.cutoff": (v) => {
    const hz = denormalizeLog(v, 60, 12000);
    document.getElementById("filter-cutoff-readout").textContent = `${Math.round(hz)} Hz`;
  },
  "lfo.rate": (v) => {
    const hz = denormalizeLog(v, 0.1, 20);
    document.getElementById("lfo-rate-readout").textContent = `${hz.toFixed(1)} Hz`;
  },
};

const statusEl = document.getElementById("status");
const startButton = document.getElementById("start");

startButton.addEventListener("click", async () => {
  if (ctx.state !== "running") {
    await ctx.resume();
  }
  startButton.classList.add("active");
  startButton.textContent = "Audio Running";
  statusEl.textContent = "Audio running";
});

document.querySelectorAll(".knob").forEach((el) => {
  const bg = el.querySelector(".bg");
  const fg = el.querySelector(".fg");
  const renderer = new KnobRenderer(bg, fg);
  const paramKey = el.dataset.param;

  ui.register(paramKey, renderer);

  let value = defaults[paramKey] ?? 0.5;
  let lastY = null;

  synth.setParam(paramKey, value);
  ui.update(paramKey, { value, morph: 0, mod: null });
  if (knobReadouts[paramKey]) knobReadouts[paramKey](value);

  el.addEventListener("pointerdown", (e) => {
    lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener("pointermove", (e) => {
    if (lastY === null) return;

    const dy = lastY - e.clientY;
    lastY = e.clientY;

    value += dy * 0.005;
    value = Math.max(0, Math.min(1, value));

    synth.setParam(paramKey, value);
    ui.update(paramKey, { value, morph: 0, mod: null });

    if (knobReadouts[paramKey]) knobReadouts[paramKey](value);
  });

  const endDrag = (e) => {
    lastY = null;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", () => {
    lastY = null;
  });
});

const waveSelects = [
  ["osc1-wave", "osc1.wave"],
  ["osc2-wave", "osc2.wave"],
  ["osc3-wave", "osc3.wave"],
];

waveSelects.forEach(([id, param]) => {
  const el = document.getElementById(id);
  el.addEventListener("change", () => {
    synth.setDiscreteParam(param, el.value);
  });
});

const sliders = [
  ["osc1-detune", "osc1.detune", "osc1-detune-readout", " ct"],
  ["osc2-detune", "osc2.detune", "osc2-detune-readout", " ct"],
  ["osc3-detune", "osc3.detune", "osc3-detune-readout", " ct"],
  ["filter-resonance", "filter.resonance", "filter-resonance-readout", ""],
  ["filter-env-amount", "filter.envAmount", "filter-env-amount-readout", ""],
  ["env-attack", "env.attack", "env-attack-readout", " s", 3],
  ["env-decay", "env.decay", "env-decay-readout", " s", 2],
  ["env-sustain", "env.sustain", "env-sustain-readout", "", 2],
  ["env-release", "env.release", "env-release-readout", " s", 2],
  ["lfo-pitch-depth", "lfo.pitchDepth", "lfo-pitch-depth-readout", " ct"],
  ["lfo-filter-depth", "lfo.filterDepth", "lfo-filter-depth-readout", " Hz"],
  ["lfo-amp-depth", "lfo.ampDepth", "lfo-amp-depth-readout", "", 2],
];

sliders.forEach(([id, param, readoutId, suffix, decimals]) => {
  const el = document.getElementById(id);
  const readout = document.getElementById(readoutId);

  synth.setDiscreteParam(param, Number(el.value));
  readout.textContent = `${Number(el.value).toFixed(decimals ?? 0)}${suffix}`;

  el.addEventListener("input", () => {
    const value = Number(el.value);
    synth.setDiscreteParam(param, value);
    readout.textContent = `${value.toFixed(decimals ?? 0)}${suffix}`;
  });
});

const notes = [
  { name: "A2", freq: 110 },
  { name: "B2", freq: 123.47 },
  { name: "C3", freq: 130.81 },
  { name: "D3", freq: 146.83 },
  { name: "E3", freq: 164.81 },
  { name: "F3", freq: 174.61 },
  { name: "G3", freq: 196.0 },
  { name: "A3", freq: 220.0 },
];

const keysEl = document.getElementById("keys");

notes.forEach((note) => {
  const btn = document.createElement("button");
  btn.className = "key";
  btn.type = "button";
  btn.textContent = note.name;

  const start = async () => {
    if (ctx.state !== "running") {
      await ctx.resume();
      startButton.classList.add("active");
      startButton.textContent = "Audio Running";
      statusEl.textContent = "Audio running";
    }
    synth.noteOn(note.freq);
    btn.classList.add("active");
  };

  const stop = () => {
    synth.noteOff();
    btn.classList.remove("active");
  };

  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", stop);
  btn.addEventListener("pointercancel", stop);
  btn.addEventListener("pointerleave", (e) => {
    if (e.buttons) stop();
  });

  keysEl.appendChild(btn);
});

function normalizeLog(value, min, max) {
  return (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min));
}

function denormalizeLog(norm, min, max) {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  return Math.exp(minLog + norm * (maxLog - minLog));
}

function loop() {
  ui.frame();
  requestAnimationFrame(loop);
}

loop();
