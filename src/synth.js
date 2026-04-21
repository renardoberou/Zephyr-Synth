import { MPE } from "./mpe.js";

export class Synth {
  constructor(ctx) {
    this.ctx = ctx;
    this.mpe = new MPE(this);

    this.master = null;
    this.mix = null;
    this.filter = null;
    this.amp = null;
    this.lfo = null;
    this.lfoGain = null;

    this.osc1 = null;
    this.osc2 = null;
    this.osc3 = null;

    this.osc1Gain = null;
    this.osc2Gain = null;
    this.osc3Gain = null;

    this.baseFrequency = 220;
    this.currentNoteFrequency = 220;
    this.isNoteHeld = false;

    this.env = {
      attack: 0.01,
      decay: 0.35,
      sustain: 0.65,
      release: 0.45,
    };

    this.lfoState = {
      rate: 3,
      pitchDepth: 0,
      filterDepth: 600,
      ampDepth: 0,
    };

    this.filterEnvAmount = 1800;
    this.baseCutoff = 1200;
    this.baseResonance = 0.5;

    this.params = new Map();
    this.discreteParams = new Map();

    this.lfoAnimationFrame = null;
  }

  async init() {
    await this.ctx.audioWorklet.addModule("./src/worklets/vcoProcessor.js");

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);

    this.amp = this.ctx.createGain();
    this.amp.gain.value = 0;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = this.baseCutoff;
    this.filter.Q.value = this.baseResonance;

    this.mix = this.ctx.createGain();
    this.mix.gain.value = 1.0;

    this.mix.connect(this.filter);
    this.filter.connect(this.amp);
    this.amp.connect(this.master);

    this.osc1 = new AudioWorkletNode(this.ctx, "vco");
    this.osc2 = new AudioWorkletNode(this.ctx, "vco");
    this.osc3 = new AudioWorkletNode(this.ctx, "vco");

    this.osc1Gain = this.ctx.createGain();
    this.osc2Gain = this.ctx.createGain();
    this.osc3Gain = this.ctx.createGain();

    this.osc1Gain.gain.value = 0.7;
    this.osc2Gain.gain.value = 0.5;
    this.osc3Gain.gain.value = 0.5;

    this.osc1.connect(this.osc1Gain);
    this.osc2.connect(this.osc2Gain);
    this.osc3.connect(this.osc3Gain);

    this.osc1Gain.connect(this.mix);
    this.osc2Gain.connect(this.mix);
    this.osc3Gain.connect(this.mix);

    this.osc1.parameters.get("wave").setValueAtTime(1, this.ctx.currentTime);
    this.osc2.parameters.get("wave").setValueAtTime(1, this.ctx.currentTime);
    this.osc3.parameters.get("wave").setValueAtTime(1, this.ctx.currentTime);

    this.osc1.parameters.get("detune").setValueAtTime(0, this.ctx.currentTime);
    this.osc2.parameters.get("detune").setValueAtTime(-7, this.ctx.currentTime);
    this.osc3.parameters.get("detune").setValueAtTime(7, this.ctx.currentTime);

    this.setAllFrequencies(this.baseFrequency);
    this.defineParams();
    this.initLFO();
    this.initMIDI();
  }

  defineParams() {
    this.params.set("osc1.gain", (norm) => {
      this.osc1Gain.gain.setValueAtTime(norm, this.ctx.currentTime);
    });

    this.params.set("osc2.gain", (norm) => {
      this.osc2Gain.gain.setValueAtTime(norm, this.ctx.currentTime);
    });

    this.params.set("osc3.gain", (norm) => {
      this.osc3Gain.gain.setValueAtTime(norm, this.ctx.currentTime);
    });

    this.params.set("master.gain", (norm) => {
      this.master.gain.setValueAtTime(norm, this.ctx.currentTime);
    });

    this.params.set("filter.cutoff", (norm) => {
      const cutoff = this.denormalizeLog(norm, 60, 12000);
      this.baseCutoff = cutoff;
    });

    this.params.set("lfo.rate", (norm) => {
      const rate = this.denormalizeLog(norm, 0.1, 20);
      this.lfoState.rate = rate;
      if (this.lfo) {
        this.lfo.frequency.setValueAtTime(rate, this.ctx.currentTime);
      }
    });

    this.discreteParams.set("osc1.wave", (value) => {
      this.osc1.parameters.get("wave").setValueAtTime(this.waveToIndex(value), this.ctx.currentTime);
    });

    this.discreteParams.set("osc2.wave", (value) => {
      this.osc2.parameters.get("wave").setValueAtTime(this.waveToIndex(value), this.ctx.currentTime);
    });

    this.discreteParams.set("osc3.wave", (value) => {
      this.osc3.parameters.get("wave").setValueAtTime(this.waveToIndex(value), this.ctx.currentTime);
    });

    this.discreteParams.set("osc1.detune", (value) => {
      this.osc1.parameters.get("detune").setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("osc2.detune", (value) => {
      this.osc2.parameters.get("detune").setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("osc3.detune", (value) => {
      this.osc3.parameters.get("detune").setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("filter.resonance", (value) => {
      this.baseResonance = value;
      this.filter.Q.setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("filter.envAmount", (value) => {
      this.filterEnvAmount = value;
    });

    this.discreteParams.set("env.attack", (value) => {
      this.env.attack = value;
    });

    this.discreteParams.set("env.decay", (value) => {
      this.env.decay = value;
    });

    this.discreteParams.set("env.sustain", (value) => {
      this.env.sustain = value;
    });

    this.discreteParams.set("env.release", (value) => {
      this.env.release = value;
    });

    this.discreteParams.set("lfo.pitchDepth", (value) => {
      this.lfoState.pitchDepth = value;
    });

    this.discreteParams.set("lfo.filterDepth", (value) => {
      this.lfoState.filterDepth = value;
    });

    this.discreteParams.set("lfo.ampDepth", (value) => {
      this.lfoState.ampDepth = value;
    });
  }

  setParam(key, norm) {
    const setter = this.params.get(key);
    if (setter) setter(norm);
  }

  setDiscreteParam(key, value) {
    const setter = this.discreteParams.get(key);
    if (setter) setter(value);
  }

  noteOn(freq) {
    const t = this.ctx.currentTime;
    this.currentNoteFrequency = freq;
    this.isNoteHeld = true;

    this.setAllFrequencies(freq);

    this.amp.gain.cancelScheduledValues(t);
    this.filter.frequency.cancelScheduledValues(t);

    this.amp.gain.setValueAtTime(this.amp.gain.value, t);
    this.amp.gain.linearRampToValueAtTime(1.0, t + this.env.attack);
    this.amp.gain.linearRampToValueAtTime(this.env.sustain, t + this.env.attack + this.env.decay);

    const peakCutoff = Math.min(16000, this.baseCutoff + this.filterEnvAmount);

    this.filter.frequency.setValueAtTime(this.baseCutoff, t);
    this.filter.frequency.linearRampToValueAtTime(peakCutoff, t + this.env.attack);
    this.filter.frequency.linearRampToValueAtTime(
      this.baseCutoff + this.filterEnvAmount * this.env.sustain * 0.5,
      t + this.env.attack + this.env.decay
    );
  }

  noteOff() {
    const t = this.ctx.currentTime;
    this.isNoteHeld = false;

    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setValueAtTime(this.amp.gain.value, t);
    this.amp.gain.linearRampToValueAtTime(0, t + this.env.release);

    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, t);
    this.filter.frequency.linearRampToValueAtTime(this.baseCutoff, t + this.env.release);

    this.setAllFrequencies(this.baseFrequency);
  }

  setAllFrequencies(freq) {
    this.osc1.parameters.get("frequency").setValueAtTime(freq, this.ctx.currentTime);
    this.osc2.parameters.get("frequency").setValueAtTime(freq, this.ctx.currentTime);
    this.osc3.parameters.get("frequency").setValueAtTime(freq, this.ctx.currentTime);
  }

  initLFO() {
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = this.lfoState.rate;
    this.lfo.start();

    this.startLFOTick();
  }

  startLFOTick() {
    if (this.lfoAnimationFrame) {
      cancelAnimationFrame(this.lfoAnimationFrame);
    }

    const tick = () => {
      const t = this.ctx.currentTime;
      const phase = Math.sin(t * Math.PI * 2 * this.lfoState.rate);

      const pitchOffset = phase * this.lfoState.pitchDepth;
      const filterOffset = phase * this.lfoState.filterDepth;
      const ampMod = 1 - this.lfoState.ampDepth + ((phase + 1) * 0.5) * this.lfoState.ampDepth;

      this.osc1.parameters.get("detune").setValueAtTime(pitchOffset, t);
      this.osc2.parameters.get("detune").setValueAtTime(-7 + pitchOffset, t);
      this.osc3.parameters.get("detune").setValueAtTime(7 + pitchOffset, t);

      const targetCutoff = Math.max(40, this.baseCutoff + filterOffset);
      if (!this.isNoteHeld) {
        this.filter.frequency.setValueAtTime(targetCutoff, t);
      }

      if (!this.isNoteHeld) {
        this.amp.gain.setValueAtTime(ampMod * 0.0001, t);
      }

      this.lfoAnimationFrame = requestAnimationFrame(tick);
    };

    tick();
  }

  waveToIndex(wave) {
    switch (wave) {
      case "sine":
        return 0;
      case "sawtooth":
        return 1;
      case "square":
        return 2;
      case "triangle":
        return 3;
      default:
        return 1;
    }
  }

  denormalizeLog(norm, min, max) {
    const minLog = Math.log(min);
    const maxLog = Math.log(max);
    return Math.exp(minLog + norm * (maxLog - minLog));
  }

  initMIDI() {
    if (!("requestMIDIAccess" in navigator)) return;

    navigator.requestMIDIAccess().then((access) => {
      access.inputs.forEach((input) => {
        input.onmidimessage = (e) => this.mpe.handleMIDI(e);
      });
    }).catch(() => {
      // ignore
    });
  }
}
