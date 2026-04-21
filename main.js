import { Synth } from "./src/synth.js";
import { UIEngine } from "./src/ui/uiEngine.js";
import { KnobRenderer } from "./src/ui/knobRenderer.js";

const ctx = new AudioContext();
const synth = new Synth(ctx);
const ui = new UIEngine();

const statusEl = document.getElementById("status");
const startButton = document.getElementById("start");

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function byId(id) {
  return document.getElementById(id);
}

function normalizeLog(value, min, max) {
  return (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min));
}

function denormalizeLog(norm, min, max) {
  const minLog = Math.log(min);
  const maxLog = Math.log(max);
  return Math.exp(minLog + norm * (maxLog - minLog));
}

const defaults = {
  "osc1.gain": 0.7,
  "osc2.gain": 0.5,
  "osc3.gain": 0.5,
  "master.gain": 0.6,
  "filter.cutoff": normalizeLog(1200, 60, 12000),
  "lfo.rate": normalizeLog(3, 0.1, 20),
  "macro1.value": 0.0,
  "macro2.value": 0.0,
  "chorus.mix": 0.25,
  "delay.mix": 0.20,
  "reverb.mix": 0.25,
};

const knobReadouts = {
  "osc1.gain": (v) => { const el = byId("osc1-gain-readout"); if (el) el.textContent = v.toFixed(2); },
  "osc2.gain": (v) => { const el = byId("osc2-gain-readout"); if (el) el.textContent = v.toFixed(2); },
  "osc3.gain": (v) => { const el = byId("osc3-gain-readout"); if (el) el.textContent = v.toFixed(2); },
  "master.gain": (v) => { const el = byId("master-gain-readout"); if (el) el.textContent = v.toFixed(2); },
  "filter.cutoff": (v) => {
    const el = byId("filter-cutoff-readout");
    if (el) el.textContent = `${Math.round(denormalizeLog(v, 60, 12000))} Hz`;
  },
  "lfo.rate": (v) => {
    const el = byId("lfo-rate-readout");
    if (el) el.textContent = `${denormalizeLog(v, 0.1, 20).toFixed(1)} Hz`;
  },
  "macro1.value": (v) => { const el = byId("macro1-readout"); if (el) el.textContent = v.toFixed(2); },
  "macro2.value": (v) => { const el = byId("macro2-readout"); if (el) el.textContent = v.toFixed(2); },
  "chorus.mix": (v) => { const el = byId("chorus-mix-readout"); if (el) el.textContent = v.toFixed(2); },
  "delay.mix": (v) => { const el = byId("delay-mix-readout"); if (el) el.textContent = v.toFixed(2); },
  "reverb.mix": (v) => { const el = byId("reverb-mix-readout"); if (el) el.textContent = v.toFixed(2); },
};

async function boot() {
  try {
    await synth.init();
    setStatus("Ready");
  } catch (err) {
    console.error(err);
    setStatus("Startup error");
    return;
  }

  if (startButton) {
    startButton.addEventListener("click", async () => {
      try {
        if (ctx.state !== "running") {
          await ctx.resume();
        }
        startButton.classList.add("active");
        startButton.textContent = "Audio Running";
        setStatus("Audio running");
      } catch (err) {
        console.error(err);
        setStatus("Audio start failed");
      }
    });
  }

  bindKnobs();
  bindSelect("osc1-wave", "osc1.wave");
  bindSelect("osc2-wave", "osc2.wave");
  bindSelect("osc3-wave", "osc3.wave");

  bindSlider("osc1-detune", "osc1.detune", "osc1-detune-readout", " ct");
  bindSlider("osc2-detune", "osc2.detune", "osc2-detune-readout", " ct");
  bindSlider("osc3-detune", "osc3.detune", "osc3-detune-readout", " ct");
  bindSlider("filter-resonance", "filter.resonance", "filter-resonance-readout", "");
  bindSlider("env-attack", "env.attack", "env-attack-readout", " s", 3);
  bindSlider("env-decay", "env.decay", "env-decay-readout", " s", 2);
  bindSlider("env-sustain", "env.sustain", "env-sustain-readout", "", 2);
  bindSlider("env-release", "env.release", "env-release-readout", " s", 2);
  bindSlider("chorus-rate", "chorus.rate", "chorus-rate-readout", " Hz", 1);
  bindSlider("chorus-depth", "chorus.depth", "chorus-depth-readout", " ms", 1);
  bindSlider("fx-send", "fx.send", "fx-send-readout", "", 2);
  bindSlider("delay-time", "delay.time", "delay-time-readout", " s", 2);
  bindSlider("delay-feedback", "delay.feedback", "delay-feedback-readout", "", 2);
  bindSlider("reverb-decay", "reverb.decay", "reverb-decay-readout", " s", 1);

  bindRoutes();
  buildKeyboard();

  function frame() {
    try {
      synth.tick();
      ui.frame();
    } catch (err) {
      console.error(err);
      setStatus("Runtime error");
      return;
    }
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function bindKnobs() {
  document.querySelectorAll(".knob").forEach((el) => {
    const bg = el.querySelector(".bg");
    const fg = el.querySelector(".fg");
    const paramKey = el.dataset.param;

    if (!bg || !fg || !paramKey) return;

    const renderer = new KnobRenderer(bg, fg);
    ui.register(paramKey, renderer);

    let value = defaults[paramKey] ?? 0.5;
    let lastY = null;
    let dragging = false;

    synth.setParam(paramKey, value);
    ui.update(paramKey, { value, morph: 0, mod: null });
    if (knobReadouts[paramKey]) knobReadouts[paramKey](value);

    const onDown = (e) => {
      e.preventDefault();
      dragging = true;
      lastY = e.clientY;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    const onMove = (e) => {
      if (!dragging || lastY === null) return;
      e.preventDefault();

      const dy = lastY - e.clientY;
      lastY = e.clientY;

      value += dy * 0.005;
      value = Math.max(0, Math.min(1, value));

      synth.setParam(paramKey, value);
      ui.update(paramKey, { value, morph: 0, mod: null });
      if (knobReadouts[paramKey]) knobReadouts[paramKey](value);
    };

    const onUp = (e) => {
      dragging = false;
      lastY = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  });
}

function bindSelect(id, param) {
  const el = byId(id);
  if (!el) return;

  el.addEventListener("change", () => {
    synth.setDiscreteParam(param, el.value);
  });
}

function bindSlider(id, param, readoutId, suffix = "", decimals = 0) {
  const el = byId(id);
  const readout = byId(readoutId);
  if (!el) return;

  const write = (value) => {
    synth.setDiscreteParam(param, value);
    if (readout) readout.textContent = `${value.toFixed(decimals)}${suffix}`;
  };

  write(Number(el.value));

  el.addEventListener("input", () => {
    write(Number(el.value));
  });
}

function bindRoutes() {
  for (let i = 0; i < 4; i++) {
    const sourceEl = byId(`route-${i}-source`);
    const destEl = byId(`route-${i}-dest`);
    const amountEl = byId(`route-${i}-amount`);
    const readoutEl = byId(`route-${i}-readout`);

    if (!sourceEl || !destEl || !amountEl) continue;

    const apply = () => {
      const amount = Number(amountEl.value);
      synth.setRoute(i, {
        source: sourceEl.value,
        dest: destEl.value,
        amount,
      });
      if (readoutEl) readoutEl.textContent = amount.toFixed(2);
    };

    apply();

    sourceEl.addEventListener("change", apply);
    destEl.addEventListener("change", apply);
    amountEl.addEventListener("input", apply);
  }
}

function buildKeyboard() {
  const keysEl = byId("keys");
  if (!keysEl) return;

  keysEl.innerHTML = "";

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

  notes.forEach((note) => {
    const btn = document.createElement("button");
    btn.className = "key";
    btn.type = "button";
    btn.textContent = note.name;

    const start = async () => {
      if (ctx.state !== "running") {
        await ctx.resume();
        if (startButton) {
          startButton.classList.add("active");
          startButton.textContent = "Audio Running";
        }
        setStatus("Audio running");
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
}

boot();
