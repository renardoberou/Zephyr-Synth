import { MPE } from "./mpe.js";

export class Synth {
  /**
   * @param {AudioContext} ctx
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.mpe = new MPE(this);

    this.master = null;
    this.mix = null;

    this.osc1 = null;
    this.osc2 = null;
    this.osc3 = null;

    this.osc1Gain = null;
    this.osc2Gain = null;
    this.osc3Gain = null;

    this.baseFrequency = 220;

    this.params = new Map();
    this.discreteParams = new Map();
  }

  async init() {
    await this.ctx.audioWorklet.addModule("./src/worklets/vcoProcessor.js");

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);

    this.mix = this.ctx.createGain();
    this.mix.gain.value = 1.0;
    this.mix.connect(this.master);

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

    this.discreteParams.set("base.frequency", (value) => {
      this.baseFrequency = value;
      this.setAllFrequencies(value);
    });
  }

  /**
   * @param {string} key
   * @param {number} norm
   */
  setParam(key, norm) {
    const setter = this.params.get(key);
    if (setter) setter(norm);
  }

  /**
   * @param {string} key
   * @param {string|number} value
   */
  setDiscreteParam(key, value) {
    const setter = this.discreteParams.get(key);
    if (setter) setter(value);
  }

  /**
   * @param {number} freq
   */
  noteOn(freq) {
    this.setAllFrequencies(freq);
  }

  noteOff() {
    this.setAllFrequencies(this.baseFrequency);
  }

  /**
   * @param {number} freq
   */
  setAllFrequencies(freq) {
    this.osc1.parameters.get("frequency").setValueAtTime(freq, this.ctx.currentTime);
    this.osc2.parameters.get("frequency").setValueAtTime(freq, this.ctx.currentTime);
    this.osc3.parameters.get("frequency").setValueAtTime(freq, this.ctx.currentTime);
  }

  /**
   * @param {string} wave
   * @returns {number}
   */
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
