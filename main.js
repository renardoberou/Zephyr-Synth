import { Synth } from "./src/synth.js?v=11";
import { UIEngine } from "./src/ui/uiEngine.js?v=11";
import { KnobRenderer } from "./src/ui/knobRenderer.js?v=11";

const STORAGE_KEY = "zephyr-synth-presets-v1";

const ctx = new AudioContext();
const synth = new Synth(ctx);
const ui = new UIEngine();

const statusEl = document.getElementById("status");
const startButton = document.getElementById("start");

const knobState = {};
const knobControllers = new Map();

let presetLibrary = [];
let snapshotA = null;
let snapshotB = null;

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
  return Math.exp(minLog + (norm * (maxLog - minLog)));
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

const defaults = {
  "osc1.gain": 0.7,
  "osc2.gain": 0.5,
  "osc3.gain": 0.5,
  "master.gain": 0.6,
  "filter.cutoff": normalizeLog(1200, 60, 12000),
  "filter2.cutoff": normalizeLog(2200, 60, 12000),
  "hpf.cutoff": normalizeLog(30, 20, 4000),
  "filter.parallelBlend": 0.5,
  "lfo.rate": normalizeLog(3, 0.1, 20),
  "macro1.value": 0.0,
  "macro2.value": 0.0,
  "chorus.mix": 0.25,
  "delay.mix": 0.20,
  "reverb.mix": 0.25,
  "unison.spread": 0.35,
  "analog.drift": 0.18,
  "drive.voice": 0.22,
  "drive.master": 0.16,
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
  "filter2.cutoff": (v) => {
    const el = byId("filter2-cutoff-readout");
    if (el) el.textContent = `${Math.round(denormalizeLog(v, 60, 12000))} Hz`;
  },
  "hpf.cutoff": (v) => {
    const el = byId("hpf-cutoff-readout");
    if (el) el.textContent = `${Math.round(denormalizeLog(v, 20, 4000))} Hz`;
  },
  "filter.parallelBlend": (v) => {
    const el = byId("filter-parallel-blend-readout");
    if (el) el.textContent = `${Math.round(v * 100)}%`;
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
  "unison.spread": (v) => {
    const el = byId("unison-spread-readout");
    if (el) el.textContent = `${Math.round(v * 100)}%`;
  },
  "analog.drift": (v) => {
    const el = byId("analog-drift-readout");
    if (el) el.textContent = `${Math.round(v * 100)}%`;
  },
  "drive.voice": (v) => {
    const el = byId("voice-drive-readout");
    if (el) el.textContent = `${Math.round(v * 100)}%`;
  },
  "drive.master": (v) => {
    const el = byId("master-drive-readout");
    if (el) el.textContent = `${Math.round(v * 100)}%`;
  },
};

const selectBindings = [
  { id: "osc1-wave", param: "osc1.wave" },
  { id: "osc2-wave", param: "osc2.wave" },
  { id: "osc3-wave", param: "osc3.wave" },
  { id: "filter-routing", param: "filter.routing" },
];

const sliderBindings = [
  { id: "voice-count", param: "voice.count", readoutId: "voice-count-readout", suffix: "", decimals: 0 },
  { id: "unison-count", param: "unison.count", readoutId: "unison-count-readout", suffix: "", decimals: 0 },
  { id: "analog-instability", param: "analog.instability", readoutId: "analog-instability-readout", suffix: "%", decimals: 0, transform: (v) => Math.round(v * 100) },
  { id: "drive-compensation", param: "drive.compensation", readoutId: "drive-compensation-readout", suffix: "%", decimals: 0, transform: (v) => Math.round(v * 100) },
  { id: "osc1-detune", param: "osc1.detune", readoutId: "osc1-detune-readout", suffix: " ct", decimals: 0 },
  { id: "osc2-detune", param: "osc2.detune", readoutId: "osc2-detune-readout", suffix: " ct", decimals: 0 },
  { id: "osc3-detune", param: "osc3.detune", readoutId: "osc3-detune-readout", suffix: " ct", decimals: 0 },
  { id: "filter-resonance", param: "filter.resonance", readoutId: "filter-resonance-readout", suffix: "", decimals: 1 },
  { id: "filter2-resonance", param: "filter2.resonance", readoutId: "filter2-resonance-readout", suffix: "", decimals: 1 },
  { id: "env-attack", param: "env.attack", readoutId: "env-attack-readout", suffix: " s", decimals: 3 },
  { id: "env-decay", param: "env.decay", readoutId: "env-decay-readout", suffix: " s", decimals: 2 },
  { id: "env-sustain", param: "env.sustain", readoutId: "env-sustain-readout", suffix: "", decimals: 2 },
  { id: "env-release", param: "env.release", readoutId: "env-release-readout", suffix: " s", decimals: 2 },
  { id: "chorus-rate", param: "chorus.rate", readoutId: "chorus-rate-readout", suffix: " Hz", decimals: 1 },
  { id: "chorus-depth", param: "chorus.depth", readoutId: "chorus-depth-readout", suffix: " ms", decimals: 1 },
  { id: "fx-send", param: "fx.send", readoutId: "fx-send-readout", suffix: "", decimals: 2 },
  { id: "delay-time", param: "delay.time", readoutId: "delay-time-readout", suffix: " s", decimals: 2 },
  { id: "delay-feedback", param: "delay.feedback", readoutId: "delay-feedback-readout", suffix: "", decimals: 2 },
  { id: "reverb-decay", param: "reverb.decay", readoutId: "reverb-decay-readout", suffix: " s", decimals: 1 },
];

function injectVoicePanel() {
  const grid = document.querySelector(".synth-grid");
  if (!grid || byId("voice-count")) return;

  const section = document.createElement("section");
  section.className = "panel";
  section.innerHTML = `
    <h2>VOICE / ANALOG</h2>
    <div class="knob-pair" style="margin-bottom: 12px;">
      <div class="knob" data-param="unison.spread">
        <canvas class="bg" width="140" height="140"></canvas>
        <canvas class="fg" width="140" height="140"></canvas>
        <div class="knob-value" id="unison-spread-readout">35%</div>
      </div>
      <div class="knob" data-param="analog.drift">
        <canvas class="bg" width="140" height="140"></canvas>
        <canvas class="fg" width="140" height="140"></canvas>
        <div class="knob-value" id="analog-drift-readout">18%</div>
      </div>
    </div>
    <div class="knob-pair" style="margin-bottom: 12px;">
      <div class="knob" data-param="drive.voice">
        <canvas class="bg" width="140" height="140"></canvas>
        <canvas class="fg" width="140" height="140"></canvas>
        <div class="knob-value" id="voice-drive-readout">22%</div>
      </div>
      <div class="knob" data-param="drive.master">
        <canvas class="bg" width="140" height="140"></canvas>
        <canvas class="fg" width="140" height="140"></canvas>
        <div class="knob-value" id="master-drive-readout">16%</div>
      </div>
    </div>
    <div class="param-list">
      <div class="param">
        <label for="voice-count">Polyphony</label>
        <input id="voice-count" type="range" min="1" max="8" step="1" value="8" />
      </div>
      <div class="status" id="voice-count-readout">8</div>

      <div class="param">
        <label for="unison-count">Unison</label>
        <input id="unison-count" type="range" min="1" max="4" step="1" value="1" />
      </div>
      <div class="status" id="unison-count-readout">1</div>

      <div class="param">
        <label for="analog-instability">Instability</label>
        <input id="analog-instability" type="range" min="0" max="0.5" step="0.01" value="0.12" />
      </div>
      <div class="status" id="analog-instability-readout">12%</div>

      <div class="param">
        <label for="drive-compensation">Drive Compensation</label>
        <input id="drive-compensation" type="range" min="0" max="1" step="0.01" value="0.72" />
      </div>
      <div class="status" id="drive-compensation-readout">72%</div>

      <div class="status">Spread thickens the stack. Drift and instability add motion. Voice and master drive add analog saturation with level compensation.</div>
    </div>
  `;

  const presetPanel = Array.from(grid.querySelectorAll(".panel")).find((panel) => {
    const heading = panel.querySelector("h2");
    return heading && heading.textContent.includes("PRESETS");
  });

  if (presetPanel) {
    grid.insertBefore(section, presetPanel);
  } else {
    grid.appendChild(section);
  }
}

function createInitialState() {
  return {
    version: 1,
    knobs: { ...defaults },
    selects: {
      "osc1-wave": "sawtooth",
      "osc2-wave": "sawtooth",
      "osc3-wave": "sawtooth",
      "filter-routing": "serial",
    },
    sliders: {
      "voice-count": 8,
      "unison-count": 1,
      "analog-instability": 0.12,
      "drive-compensation": 0.72,
      "osc1-detune": 0,
      "osc2-detune": -7,
      "osc3-detune": 7,
      "filter-resonance": 0.5,
      "filter2-resonance": 7.5,
      "env-attack": 0.01,
      "env-decay": 0.35,
      "env-sustain": 0.65,
      "env-release": 0.45,
      "chorus-rate": 0.8,
      "chorus-depth": 4,
      "fx-send": 0.45,
      "delay-time": 0.28,
      "delay-feedback": 0.35,
      "reverb-decay": 2.0,
    },
    routes: [
      { source: "env", dest: "filter.cutoff", amount: 0.60 },
      { source: "lfo", dest: "filter.cutoff", amount: 0.20 },
      { source: "macro1", dest: "delay.mix", amount: 0.40 },
      { source: "macro2", dest: "reverb.mix", amount: 0.50 },
    ],
  };
}

function createBuiltinPresets() {
  const init = createInitialState();

  const warm = structuredClone(init);
  warm.knobs["filter.cutoff"] = normalizeLog(420, 60, 12000);
  warm.knobs["filter2.cutoff"] = normalizeLog(1400, 60, 12000);
  warm.knobs["hpf.cutoff"] = normalizeLog(40, 20, 4000);
  warm.knobs["filter.parallelBlend"] = 0.28;
  warm.knobs["chorus.mix"] = 0.35;
  warm.knobs["reverb.mix"] = 0.42;
  warm.knobs["delay.mix"] = 0.12;
  warm.knobs["unison.spread"] = 0.28;
  warm.knobs["analog.drift"] = 0.14;
  warm.knobs["drive.voice"] = 0.18;
  warm.knobs["drive.master"] = 0.12;
  warm.selects["filter-routing"] = "serial";
  warm.sliders["voice-count"] = 6;
  warm.sliders["unison-count"] = 2;
  warm.sliders["analog-instability"] = 0.08;
  warm.sliders["drive-compensation"] = 0.78;
  warm.sliders["filter2-resonance"] = 5.5;
  warm.sliders["env-attack"] = 0.22;
  warm.sliders["env-decay"] = 0.85;
  warm.sliders["env-sustain"] = 0.78;
  warm.sliders["env-release"] = 1.2;
  warm.sliders["chorus-depth"] = 8.5;
  warm.routes[0] = { source: "env", dest: "filter.cutoff", amount: 0.72 };
  warm.routes[1] = { source: "lfo", dest: "filter2.cutoff", amount: 0.12 };

  const bright = structuredClone(init);
  bright.knobs["filter.cutoff"] = normalizeLog(4200, 60, 12000);
  bright.knobs["filter2.cutoff"] = normalizeLog(2800, 60, 12000);
  bright.knobs["hpf.cutoff"] = normalizeLog(90, 20, 4000);
  bright.knobs["filter.parallelBlend"] = 0.62;
  bright.knobs["lfo.rate"] = normalizeLog(5.8, 0.1, 20);
  bright.knobs["delay.mix"] = 0.28;
  bright.knobs["reverb.mix"] = 0.18;
  bright.knobs["unison.spread"] = 0.45;
  bright.knobs["analog.drift"] = 0.11;
  bright.knobs["drive.voice"] = 0.26;
  bright.knobs["drive.master"] = 0.20;
  bright.selects["filter-routing"] = "parallel";
  bright.sliders["voice-count"] = 8;
  bright.sliders["unison-count"] = 2;
  bright.sliders["analog-instability"] = 0.18;
  bright.sliders["drive-compensation"] = 0.70;
  bright.sliders["filter2-resonance"] = 9.5;
  bright.sliders["delay-feedback"] = 0.48;
  bright.sliders["chorus-rate"] = 1.7;
  bright.routes[0] = { source: "lfo", dest: "osc1.detune", amount: 0.28 };
  bright.routes[1] = { source: "lfo", dest: "filter.cutoff", amount: 0.16 };
  bright.routes[2] = { source: "macro1", dest: "filter.parallelBlend", amount: 0.0 };
  bright.routes[3] = { source: "macro2", dest: "reverb.mix", amount: 0.30 };

  const drone = structuredClone(init);
  drone.knobs["osc1.gain"] = 0.8;
  drone.knobs["osc2.gain"] = 0.65;
  drone.knobs["osc3.gain"] = 0.65;
  drone.knobs["filter.cutoff"] = normalizeLog(260, 60, 12000);
  drone.knobs["filter2.cutoff"] = normalizeLog(720, 60, 12000);
  drone.knobs["hpf.cutoff"] = normalizeLog(28, 20, 4000);
  drone.knobs["filter.parallelBlend"] = 0.35;
  drone.knobs["chorus.mix"] = 0.45;
  drone.knobs["delay.mix"] = 0.34;
  drone.knobs["reverb.mix"] = 0.52;
  drone.knobs["macro1.value"] = 0.25;
  drone.knobs["macro2.value"] = 0.35;
  drone.knobs["unison.spread"] = 0.55;
  drone.knobs["analog.drift"] = 0.34;
  drone.knobs["drive.voice"] = 0.34;
  drone.knobs["drive.master"] = 0.24;
  drone.selects["osc2-wave"] = "triangle";
  drone.selects["osc3-wave"] = "square";
  drone.selects["filter-routing"] = "serial";
  drone.sliders["voice-count"] = 8;
  drone.sliders["unison-count"] = 3;
  drone.sliders["analog-instability"] = 0.24;
  drone.sliders["drive-compensation"] = 0.82;
  drone.sliders["filter2-resonance"] = 12.0;
  drone.sliders["env-attack"] = 0.6;
  drone.sliders["env-decay"] = 1.6;
  drone.sliders["env-sustain"] = 0.9;
  drone.sliders["env-release"] = 2.2;
  drone.sliders["osc2-detune"] = -11;
  drone.sliders["osc3-detune"] = 11;
  drone.routes[0] = { source: "env", dest: "filter.cutoff", amount: 0.25 };
  drone.routes[1] = { source: "lfo", dest: "hpf.cutoff", amount: 0.10 };
  drone.routes[2] = { source: "macro1", dest: "delay.mix", amount: 0.60 };
  drone.routes[3] = { source: "macro2", dest: "reverb.mix", amount: 0.65 };

  return [
    { name: "Init", state: init },
    { name: "Warm Space", state: warm },
    { name: "Bright Motion", state: bright },
    { name: "Drone Wash", state: drone },
  ];
}

function loadPresetLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const builtins = createBuiltinPresets();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(builtins));
      return builtins;
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const builtins = createBuiltinPresets();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(builtins));
      return builtins;
    }

    return parsed;
  } catch {
    return createBuiltinPresets();
  }
}

function savePresetLibrary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presetLibrary));
}

function populatePresetSelect(selectedName = null) {
  const select = byId("preset-select");
  if (!select) return;

  select.innerHTML = "";

  presetLibrary.forEach((preset, index) => {
    const option = document.createElement("option");
    option.value = preset.name;
    option.textContent = preset.name;
    option.selected = selectedName ? preset.name === selectedName : index === 0;
    select.appendChild(option);
  });
}

function getSelectedPreset() {
  const select = byId("preset-select");
  if (!select) return null;
  return presetLibrary.find((preset) => preset.name === select.value) ?? null;
}

function collectState() {
  const state = {
    version: 1,
    knobs: {},
    selects: {},
    sliders: {},
    routes: [],
  };

  Object.keys(defaults).forEach((key) => {
    state.knobs[key] = knobState[key] ?? defaults[key];
  });

  selectBindings.forEach(({ id }) => {
    const el = byId(id);
    if (el) state.selects[id] = el.value;
  });

  sliderBindings.forEach(({ id }) => {
    const el = byId(id);
    if (el) state.sliders[id] = Number(el.value);
  });

  for (let i = 0; i < 4; i++) {
    const sourceEl = byId(`route-${i}-source`);
    const destEl = byId(`route-${i}-dest`);
    const amountEl = byId(`route-${i}-amount`);
    if (!sourceEl || !destEl || !amountEl) continue;

    state.routes.push({
      source: sourceEl.value,
      dest: destEl.value,
      amount: Number(amountEl.value),
    });
  }

  return state;
}

function applyKnob(paramKey, value) {
  knobState[paramKey] = value;
  synth.setParam(paramKey, value);
  ui.update(paramKey, { value, morph: 0, mod: null });
  if (knobReadouts[paramKey]) knobReadouts[paramKey](value);
}

function applySelect(id, value) {
  const binding = selectBindings.find((item) => item.id === id);
  const el = byId(id);
  if (!binding || !el) return;

  el.value = value;
  synth.setDiscreteParam(binding.param, value);
}

function applySlider(id, value) {
  const binding = sliderBindings.find((item) => item.id === id);
  const el = byId(id);
  const readout = binding ? byId(binding.readoutId) : null;
  if (!binding || !el) return;

  el.value = String(value);
  synth.setDiscreteParam(binding.param, value);
  if (readout) {
    const displayValue = binding.transform ? binding.transform(Number(value)) : Number(value);
    readout.textContent = `${Number(displayValue).toFixed(binding.decimals)}${binding.suffix}`;
  }
}

function applyRoutes(routes) {
  for (let i = 0; i < 4; i++) {
    const route = routes[i];
    if (!route) continue;

    const sourceEl = byId(`route-${i}-source`);
    const destEl = byId(`route-${i}-dest`);
    const amountEl = byId(`route-${i}-amount`);
    const readoutEl = byId(`route-${i}-readout`);

    if (!sourceEl || !destEl || !amountEl) continue;

    sourceEl.value = route.source;
    destEl.value = route.dest;
    amountEl.value = String(route.amount);
    if (readoutEl) readoutEl.textContent = Number(route.amount).toFixed(2);

    synth.setRoute(i, {
      source: route.source,
      dest: route.dest,
      amount: Number(route.amount),
    });
  }
}

function applyState(state) {
  if (!state) return;

  Object.entries(state.knobs ?? {}).forEach(([key, value]) => {
    applyKnob(key, Number(value));
  });

  Object.entries(state.selects ?? {}).forEach(([id, value]) => {
    applySelect(id, value);
  });

  Object.entries(state.sliders ?? {}).forEach(([id, value]) => {
    applySlider(id, Number(value));
  });

  if (Array.isArray(state.routes)) {
    applyRoutes(state.routes);
  }
}

function morphStates(a, b, t) {
  const result = {
    version: 1,
    knobs: {},
    selects: {},
    sliders: {},
    routes: [],
  };

  const knobKeys = new Set([
    ...Object.keys(a.knobs ?? {}),
    ...Object.keys(b.knobs ?? {}),
  ]);

  knobKeys.forEach((key) => {
    const av = Number(a.knobs?.[key] ?? defaults[key] ?? 0);
    const bv = Number(b.knobs?.[key] ?? defaults[key] ?? 0);
    result.knobs[key] = lerp(av, bv, t);
  });

  const selectKeys = new Set([
    ...Object.keys(a.selects ?? {}),
    ...Object.keys(b.selects ?? {}),
  ]);

  selectKeys.forEach((key) => {
    result.selects[key] = t < 0.5
      ? (a.selects?.[key] ?? b.selects?.[key])
      : (b.selects?.[key] ?? a.selects?.[key]);
  });

  const sliderKeys = new Set([
    ...Object.keys(a.sliders ?? {}),
    ...Object.keys(b.sliders ?? {}),
  ]);

  sliderKeys.forEach((key) => {
    const av = Number(a.sliders?.[key] ?? 0);
    const bv = Number(b.sliders?.[key] ?? 0);
    result.sliders[key] = lerp(av, bv, t);
  });

  const routeCount = Math.max(a.routes?.length ?? 0, b.routes?.length ?? 0, 4);
  for (let i = 0; i < routeCount; i++) {
    const ar = a.routes?.[i];
    const br = b.routes?.[i];
    result.routes.push({
      source: t < 0.5 ? (ar?.source ?? br?.source ?? "env") : (br?.source ?? ar?.source ?? "env"),
      dest: t < 0.5 ? (ar?.dest ?? br?.dest ?? "filter.cutoff") : (br?.dest ?? ar?.dest ?? "filter.cutoff"),
      amount: lerp(Number(ar?.amount ?? 0), Number(br?.amount ?? 0), t),
    });
  }

  return result;
}

function updateSnapshotStatus() {
  const el = byId("snapshot-status");
  if (!el) return;
  el.textContent = `A: ${snapshotA ? "captured" : "empty"} · B: ${snapshotB ? "captured" : "empty"}`;
}

function bindKnobs() {
  document.querySelectorAll(".knob").forEach((el) => {
    const bg = el.querySelector(".bg");
    const fg = el.querySelector(".fg");
    const paramKey = el.dataset.param;

    if (!bg || !fg || !paramKey) return;

    const renderer = new KnobRenderer(bg, fg);
    knobControllers.set(paramKey, { renderer, el });
    ui.register(paramKey, renderer);

    knobState[paramKey] = defaults[paramKey] ?? 0.5;
    applyKnob(paramKey, knobState[paramKey]);

    let lastY = null;
    let dragging = false;

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

      let value = (knobState[paramKey] ?? 0.5) + (dy * 0.005);
      value = Math.max(0, Math.min(1, value));

      applyKnob(paramKey, value);
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

function bindSlider(id, param, readoutId, suffix = "", decimals = 0, transform = null) {
  const el = byId(id);
  const readout = byId(readoutId);
  if (!el) return;

  const write = (value) => {
    synth.setDiscreteParam(param, value);
    if (readout) {
      const displayValue = transform ? transform(value) : value;
      readout.textContent = `${Number(displayValue).toFixed(decimals)}${suffix}`;
    }
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

    const noteId = `ui-${note.name}`;

    const start = async () => {
      if (ctx.state !== "running") {
        await ctx.resume();
        if (startButton) {
          startButton.classList.add("active");
          startButton.textContent = "Audio Running";
        }
        setStatus("Audio running");
      }
      synth.noteOn(note.freq, noteId);
      btn.classList.add("active");
    };

    const stop = () => {
      synth.noteOff(noteId);
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

function bindPresetUI() {
  const presetSelect = byId("preset-select");
  const presetName = byId("preset-name");
  const presetLoad = byId("preset-load");
  const presetSave = byId("preset-save");
  const presetOverwrite = byId("preset-overwrite");
  const presetDelete = byId("preset-delete");
  const snapshotAButton = byId("snapshot-a");
  const snapshotBButton = byId("snapshot-b");
  const morphSlider = byId("morph-slider");
  const morphReadout = byId("morph-readout");
  const morphReset = byId("morph-reset");

  presetLibrary = loadPresetLibrary();
  populatePresetSelect();
  updateSnapshotStatus();

  if (presetLoad) {
    presetLoad.addEventListener("click", () => {
      const preset = getSelectedPreset();
      if (!preset) return;
      applyState(preset.state);
      if (presetName) presetName.value = preset.name;
      if (morphSlider) morphSlider.value = "0";
      if (morphReadout) morphReadout.textContent = "0.00";
      setStatus(`Loaded preset: ${preset.name}`);
    });
  }

  if (presetSave) {
    presetSave.addEventListener("click", () => {
      const name = presetName?.value.trim();
      if (!name) {
        setStatus("Enter a preset name");
        return;
      }

      const existingIndex = presetLibrary.findIndex((item) => item.name === name);
      const payload = { name, state: collectState() };

      if (existingIndex >= 0) {
        presetLibrary[existingIndex] = payload;
      } else {
        presetLibrary.push(payload);
      }

      savePresetLibrary();
      populatePresetSelect(name);
      setStatus(`Saved preset: ${name}`);
    });
  }

  if (presetOverwrite) {
    presetOverwrite.addEventListener("click", () => {
      const preset = getSelectedPreset();
      if (!preset) {
        setStatus("No preset selected");
        return;
      }

      const idx = presetLibrary.findIndex((item) => item.name === preset.name);
      if (idx < 0) return;

      presetLibrary[idx] = {
        name: preset.name,
        state: collectState(),
      };

      savePresetLibrary();
      populatePresetSelect(preset.name);
      if (presetName) presetName.value = preset.name;
      setStatus(`Overwrote preset: ${preset.name}`);
    });
  }

  if (presetDelete) {
    presetDelete.addEventListener("click", () => {
      const preset = getSelectedPreset();
      if (!preset) return;

      presetLibrary = presetLibrary.filter((item) => item.name !== preset.name);
      if (presetLibrary.length === 0) {
        presetLibrary = createBuiltinPresets();
      }

      savePresetLibrary();
      populatePresetSelect();
      setStatus(`Deleted preset: ${preset.name}`);
    });
  }

  if (snapshotAButton) {
    snapshotAButton.addEventListener("click", () => {
      snapshotA = collectState();
      updateSnapshotStatus();
      setStatus("Captured snapshot A");
    });
  }

  if (snapshotBButton) {
    snapshotBButton.addEventListener("click", () => {
      snapshotB = collectState();
      updateSnapshotStatus();
      setStatus("Captured snapshot B");
    });
  }

  if (morphSlider) {
    morphSlider.addEventListener("input", () => {
      const t = Number(morphSlider.value);
      if (morphReadout) morphReadout.textContent = t.toFixed(2);

      if (!snapshotA || !snapshotB) {
        setStatus("Capture A and B first");
        return;
      }

      const morphed = morphStates(snapshotA, snapshotB, t);
      applyState(morphed);
    });
  }

  if (morphReset) {
    morphReset.addEventListener("click", () => {
      if (morphSlider) morphSlider.value = "0";
      if (morphReadout) morphReadout.textContent = "0.00";
      if (snapshotA) applyState(snapshotA);
      setStatus("Morph reset");
    });
  }

  if (presetSelect) {
    presetSelect.addEventListener("change", () => {
      const preset = getSelectedPreset();
      if (presetName && preset) presetName.value = preset.name;
    });
  }
}

async function boot() {
  try {
    injectVoicePanel();
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

  selectBindings.forEach(({ id, param }) => bindSelect(id, param));
  sliderBindings.forEach(({ id, param, readoutId, suffix, decimals, transform }) => {
    bindSlider(id, param, readoutId, suffix, decimals, transform);
  });

  bindRoutes();
  buildKeyboard();
  bindPresetUI();

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

boot();
