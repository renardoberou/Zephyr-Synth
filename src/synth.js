import { MPE } from "./mpe.js";

export class Synth {
  constructor(ctx) {
    this.ctx = ctx;
    this.mpe = new MPE(this);

    this.master = null;
    this.mix = null;
    this.filter = null;
    this.amp = null;
    this.postAmpMod = null;

    this.osc1 = null;
    this.osc2 = null;
    this.osc3 = null;

    this.osc1Gain = null;
    this.osc2Gain = null;
    this.osc3Gain = null;

    this.fxSendGain = null;
    this.dryGain = null;

    this.chorusDelay = null;
    this.chorusDryGain = null;
    this.chorusWetGain = null;
    this.chorusOut = null;
    this.chorusLFO = null;
    this.chorusDepthGain = null;

    this.delayNode = null;
    this.delayBypassGain = null;
    this.delayWetGain = null;
    this.delayOut = null;
    this.delayFeedbackGain = null;
    this.delayTone = null;
    this.delaySaturator = null;

    this.reverbConvolver = null;
    this.reverbBypassGain = null;
    this.reverbWetGain = null;
    this.reverbOut = null;

    this.baseFrequency = 220;
    this.currentNoteFrequency = 220;
    this.noteHeld = false;

    this.baseDetune = {
      osc1: 0,
      osc2: -7,
      osc3: 7,
    };

    this.baseValues = {
      filterCutoff: 1200,
      filterResonance: 0.5,
      masterGain: 0.6,
      chorusMix: 0.25,
      chorusRate: 0.8,
      chorusDepthMs: 4,
      delayMix: 0.20,
      delayTime: 0.28,
      delayFeedback: 0.35,
      reverbMix: 0.25,
      reverbDecay: 2.0,
      fxSend: 0.45,
      lfoRate: 3.0,
      macro1: 0.0,
      macro2: 0.0,
    };

    this.env = {
      attack: 0.01,
      decay: 0.35,
      sustain: 0.65,
      release: 0.45,
      value: 0,
      stage: "idle",
      stageStart: 0,
      stageStartValue: 0,
    };

    this.routes = [
      { source: "env", dest: "filter.cutoff", amount: 0.60 },
      { source: "lfo", dest: "filter.cutoff", amount: 0.20 },
      { source: "macro1", dest: "delay.mix", amount: 0.40 },
      { source: "macro2", dest: "reverb.mix", amount: 0.50 },
    ];

    this.params = new Map();
    this.discreteParams = new Map();
  }

  async init() {
    await this.ctx.audioWorklet.addModule("./src/worklets/vcoProcessor.js");

    this.buildVoiceCore();
    this.buildFX();
    this.defineParams();
    this.initMIDI();
  }

  buildVoiceCore() {
    this.master = this.ctx.createGain();
    this.master.gain.value = this.baseValues.masterGain;
    this.master.connect(this.ctx.destination);

    this.amp = this.ctx.createGain();
    this.amp.gain.value = 0;

    this.postAmpMod = this.ctx.createGain();
    this.postAmpMod.gain.value = 1;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = this.baseValues.filterCutoff;
    this.filter.Q.value = this.baseValues.filterResonance;

    this.mix = this.ctx.createGain();
    this.mix.gain.value = 1.0;

    this.mix.connect(this.filter);
    this.filter.connect(this.amp);
    this.amp.connect(this.postAmpMod);

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

    this.applyCurrentDetunes(this.ctx.currentTime);
    this.setAllFrequencies(this.baseFrequency);
  }

  buildFX() {
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1.0;

    this.fxSendGain = this.ctx.createGain();
    this.fxSendGain.gain.value = this.baseValues.fxSend;

    this.postAmpMod.connect(this.dryGain);
    this.postAmpMod.connect(this.fxSendGain);
    this.dryGain.connect(this.master);

    this.buildChorusSection();
    this.buildDelaySection();
    this.buildReverbSection();

    this.fxSendGain.connect(this.chorusDryGain);
    this.fxSendGain.connect(this.chorusDelay);

    this.chorusOut.connect(this.delayBypassGain);
    this.chorusOut.connect(this.delayNode);

    this.delayOut.connect(this.reverbBypassGain);
    this.delayOut.connect(this.reverbConvolver);

    this.reverbOut.connect(this.master);
  }

  buildChorusSection() {
    this.chorusDelay = this.ctx.createDelay(0.05);
    this.chorusDelay.delayTime.value = 0.018;

    this.chorusDryGain = this.ctx.createGain();
    this.chorusWetGain = this.ctx.createGain();
    this.chorusOut = this.ctx.createGain();

    this.setChorusMix(this.baseValues.chorusMix);

    this.chorusDryGain.connect(this.chorusOut);
    this.chorusDelay.connect(this.chorusWetGain);
    this.chorusWetGain.connect(this.chorusOut);

    this.chorusLFO = this.ctx.createOscillator();
    this.chorusLFO.type = "sine";
    this.chorusLFO.frequency.value = this.baseValues.chorusRate;

    this.chorusDepthGain = this.ctx.createGain();
    this.chorusDepthGain.gain.value = this.baseValues.chorusDepthMs / 1000;

    this.chorusLFO.connect(this.chorusDepthGain);
    this.chorusDepthGain.connect(this.chorusDelay.delayTime);
    this.chorusLFO.start();
  }

  buildDelaySection() {
    this.delayNode = this.ctx.createDelay(1.0);
    this.delayNode.delayTime.value = this.baseValues.delayTime;

    this.delayBypassGain = this.ctx.createGain();
    this.delayWetGain = this.ctx.createGain();
    this.delayOut = this.ctx.createGain();

    this.delayFeedbackGain = this.ctx.createGain();
    this.delayFeedbackGain.gain.value = this.baseValues.delayFeedback;

    this.delayTone = this.ctx.createBiquadFilter();
    this.delayTone.type = "lowpass";
    this.delayTone.frequency.value = 2200;

    this.delaySaturator = this.ctx.createWaveShaper();
    this.delaySaturator.curve = this.createSaturatorCurve();
    this.delaySaturator.oversample = "2x";

    this.setDelayMix(this.baseValues.delayMix);

    this.delayBypassGain.connect(this.delayOut);
    this.delayNode.connect(this.delayWetGain);
    this.delayWetGain.connect(this.delayOut);

    this.delayNode.connect(this.delayTone);
    this.delayTone.connect(this.delaySaturator);
    this.delaySaturator.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delayNode);
  }

  buildReverbSection() {
    this.reverbConvolver = this.ctx.createConvolver();
    this.reverbConvolver.buffer = this.createImpulseResponse(this.baseValues.reverbDecay);

    this.reverbBypassGain = this.ctx.createGain();
    this.reverbWetGain = this.ctx.createGain();
    this.reverbOut = this.ctx.createGain();

    this.setReverbMix(this.baseValues.reverbMix);

    this.reverbBypassGain.connect(this.reverbOut);
    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.reverbOut);
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
      this.baseValues.masterGain = norm;
      this.master.gain.setValueAtTime(norm, this.ctx.currentTime);
    });

    this.params.set("filter.cutoff", (norm) => {
      this.baseValues.filterCutoff = this.denormalizeLog(norm, 60, 12000);
    });

    this.params.set("lfo.rate", (norm) => {
      this.baseValues.lfoRate = this.denormalizeLog(norm, 0.1, 20);
    });

    this.params.set("macro1.value", (norm) => {
      this.baseValues.macro1 = norm;
    });

    this.params.set("macro2.value", (norm) => {
      this.baseValues.macro2 = norm;
    });

    this.params.set("chorus.mix", (norm) => {
      this.baseValues.chorusMix = norm;
      this.setChorusMix(norm);
    });

    this.params.set("delay.mix", (norm) => {
      this.baseValues.delayMix = norm;
      this.setDelayMix(norm);
    });

    this.params.set("reverb.mix", (norm) => {
      this.baseValues.reverbMix = norm;
      this.setReverbMix(norm);
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
      this.baseDetune.osc1 = value;
    });

    this.discreteParams.set("osc2.detune", (value) => {
      this.baseDetune.osc2 = value;
    });

    this.discreteParams.set("osc3.detune", (value) => {
      this.baseDetune.osc3 = value;
    });

    this.discreteParams.set("filter.resonance", (value) => {
      this.baseValues.filterResonance = value;
      this.filter.Q.setValueAtTime(value, this.ctx.currentTime);
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

    this.discreteParams.set("chorus.rate", (value) => {
      this.baseValues.chorusRate = value;
      this.chorusLFO.frequency.setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("chorus.depth", (value) => {
      this.baseValues.chorusDepthMs = value;
      this.chorusDepthGain.gain.setValueAtTime(value / 1000, this.ctx.currentTime);
    });

    this.discreteParams.set("fx.send", (value) => {
      this.baseValues.fxSend = value;
      this.fxSendGain.gain.setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("delay.time", (value) => {
      this.baseValues.delayTime = value;
      this.delayNode.delayTime.setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("delay.feedback", (value) => {
      this.baseValues.delayFeedback = value;
      this.delayFeedbackGain.gain.setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("reverb.decay", (value) => {
      this.baseValues.reverbDecay = value;
      this.reverbConvolver.buffer = this.createImpulseResponse(value);
    });
  }

  setRoute(index, patch) {
    if (!this.routes[index]) return;
    this.routes[index] = { ...this.routes[index], ...patch };
  }

  tick() {
    const now = this.ctx.currentTime;

    this.updateEnvelope(now);
    this.applyModMatrix(now);
  }

  updateEnvelope(now) {
    const env = this.env;

    if (env.stage === "idle") {
      env.value = 0;
    } else if (env.stage === "attack") {
      const progress = Math.min(1, (now - env.stageStart) / Math.max(0.0001, env.attack));
      env.value = this.lerp(env.stageStartValue, 1, progress);
      if (progress >= 1) {
        env.stage = "decay";
        env.stageStart = now;
        env.stageStartValue = 1;
      }
    } else if (env.stage === "decay") {
      const progress = Math.min(1, (now - env.stageStart) / Math.max(0.0001, env.decay));
      env.value = this.lerp(env.stageStartValue, env.sustain, progress);
      if (progress >= 1) {
        env.stage = "sustain";
        env.stageStart = now;
        env.stageStartValue = env.sustain;
      }
    } else if (env.stage === "sustain") {
      env.value = env.sustain;
    } else if (env.stage === "release") {
      const progress = Math.min(1, (now - env.stageStart) / Math.max(0.0001, env.release));
      env.value = this.lerp(env.stageStartValue, 0, progress);
      if (progress >= 1) {
        env.stage = "idle";
        env.stageStart = now;
        env.stageStartValue = 0;
        env.value = 0;
      }
    }

    this.amp.gain.setValueAtTime(env.value, now);
  }

  applyModMatrix(now) {
    const lfo = Math.sin(now * Math.PI * 2 * this.baseValues.lfoRate);
    const env = this.env.value;
    const macro1 = this.baseValues.macro1;
    const macro2 = this.baseValues.macro2;

    const sources = {
      lfo,
      env,
      macro1,
      macro2,
    };

    const sums = {
      "osc1.detune": 0,
      "osc2.detune": 0,
      "osc3.detune": 0,
      "filter.cutoff": 0,
      "amp.level": 0,
      "chorus.mix": 0,
      "delay.mix": 0,
      "reverb.mix": 0,
    };

    for (const route of this.routes) {
      const sourceValue = sources[route.source] ?? 0;
      const amount = route.amount ?? 0;
      const dest = route.dest;
      if (!(dest in sums)) continue;

      sums[dest] += sourceValue * amount * this.getDestinationScale(dest);
    }

    this.osc1.parameters.get("detune").setValueAtTime(this.baseDetune.osc1 + sums["osc1.detune"], now);
    this.osc2.parameters.get("detune").setValueAtTime(this.baseDetune.osc2 + sums["osc2.detune"], now);
    this.osc3.parameters.get("detune").setValueAtTime(this.baseDetune.osc3 + sums["osc3.detune"], now);

    const finalCutoff = this.clamp(this.baseValues.filterCutoff + sums["filter.cutoff"], 40, 16000);
    this.filter.frequency.setValueAtTime(finalCutoff, now);

    const finalAmpMod = this.clamp(1 + sums["amp.level"], 0, 1.5);
    this.postAmpMod.gain.setValueAtTime(finalAmpMod, now);

    this.setChorusMix(this.clamp(this.baseValues.chorusMix + sums["chorus.mix"], 0, 1));
    this.setDelayMix(this.clamp(this.baseValues.delayMix + sums["delay.mix"], 0, 1));
    this.setReverbMix(this.clamp(this.baseValues.reverbMix + sums["reverb.mix"], 0, 1));
  }

  getDestinationScale(dest) {
    switch (dest) {
      case "osc1.detune":
      case "osc2.detune":
      case "osc3.detune":
        return 50;
      case "filter.cutoff":
        return 3000;
      case "amp.level":
        return 0.8;
      case "chorus.mix":
      case "delay.mix":
      case "reverb.mix":
        return 0.7;
      default:
        return 1;
    }
  }

  noteOn(freq) {
    const now = this.ctx.currentTime;
    this.currentNoteFrequency = freq;
    this.noteHeld = true;

    this.setAllFrequencies(freq);

    this.env.stage = "attack";
    this.env.stageStart = now;
    this.env.stageStartValue = this.env.value;
  }

  noteOff() {
    const now = this.ctx.currentTime;
    this.noteHeld = false;

    this.env.stage = "release";
    this.env.stageStart = now;
    this.env.stageStartValue = this.env.value;
  }

  setAllFrequencies(freq) {
    this.osc1.parameters.get("frequency").setValueAtTime(freq, this.ctx.currentTime);
    this.osc2.parameters.get("frequency").setValueAtTime(freq, this.ctx.currentTime);
    this
