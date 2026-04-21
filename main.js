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
};

const readouts = {
  "osc1.gain": document.getElementById("osc1-gain-readout"),
  "osc2.gain": document.getElementById("osc2-gain-readout"),
  "osc3.gain": document.getElementById("osc3-gain-readout"),
  "master.gain": document.getElementById("master-gain-readout"),
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
  if (readouts[paramKey]) readouts[paramKey].textContent = value.toFixed(2);

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

    if (readouts[paramKey]) {
      readouts[paramKey].textContent = value.toFixed(2);
    }
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

const detuneControls = [
  ["osc1-detune", "osc1.detune", "osc1-detune-readout"],
  ["osc2-detune", "osc2.detune", "osc2-detune-readout"],
  ["osc3-detune", "osc3.detune", "osc3-detune-readout"],
];

detuneControls.forEach(([id, param, readoutId]) => {
  const el = document.getElementById(id);
  const readout = document.getElementById(readoutId);

  synth.setDiscreteParam(param, Number(el.value));
  readout.textContent = `${el.value} ct`;

  el.addEventListener("input", () => {
    const value = Number(el.value);
    synth.setDiscreteParam(param, value);
    readout.textContent = `${value} ct`;
  });
});

const baseFrequency = document.getElementById("base-frequency");
const baseFrequencyReadout = document.getElementById("base-frequency-readout");

synth.setDiscreteParam("base.frequency", Number(baseFrequency.value));
baseFrequencyReadout.textContent = `${baseFrequency.value} Hz`;

baseFrequency.addEventListener("input", () => {
  const value = Number(baseFrequency.value);
  synth.setDiscreteParam("base.frequency", value);
  baseFrequencyReadout.textContent = `${value} Hz`;
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

function loop() {
  ui.frame();
  requestAnimationFrame(loop);
}

loop();
