import { MPE } from "./mpe.js";

export class Synth {
  /**
   * @param {AudioContext} ctx
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.params = new Map();
    this.mpe = new MPE(this);

    this.master = null;
    this.osc = null;
    this.gain = null;
  }

  async init() {
    await this.ctx.audioWorklet.addModule("./src/worklets/vcoProcessor.js");

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    this.osc = new AudioWorkletNode(this.ctx, "vco");

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.2;

    this.osc.connect(this.gain);
    this.gain.connect(this.master);

    this.defineParams();
    this.initMIDI();
  }

  defineParams() {
    this.params.set("volume", (norm) => {
      if (!this.gain) return;
      this.gain.gain.setValueAtTime(norm, this.ctx.currentTime);
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

  initMIDI() {
    if (!("requestMIDIAccess" in navigator)) return;

    navigator.requestMIDIAccess().then((access) => {
      access.inputs.forEach((input) => {
        input.onmidimessage = (e) => this.mpe.handleMIDI(e);
      });
    }).catch(() => {
      // MIDI unavailable or denied
    });
  }
}
