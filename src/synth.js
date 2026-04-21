import { MPE } from "./mpe.js";

export class Synth {
  constructor(ctx) {
    this.ctx = ctx;
    this.mpe = new MPE(this);

    this.master = null;
    this.mix = null;
    this.filter = null;
    this.amp = null;
    this.tremolo = null;

    this.osc1 = null;
    this.osc2 = null;
    this.osc3 = null;

    this.osc1Gain = null;
    this.osc2Gain = null;
    this.osc3Gain = null;

    this.lfo = null;
    this.lfoPitchGain = null;
    this.lfoFilterGain = null;
    this.lfoAmpGain = null;

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

    this.chorusState = {
      mix: 0.25,
      rate: 0.8,
      depthMs: 4,
      baseDelay: 0.018,
    };

    this.delayState = {
      mix: 0.20,
      time: 0.28,
      feedback: 0.35,
    };

    this.reverbState = {
      mix: 0.25,
      decay: 2.0,
    };

    this.fxSend = 0.45;

    this.filterEnvAmount = 1800;
    this.baseCutoff = 1200;
    this.baseResonance = 0.5;

    this.params = new Map();
    this.discreteParams = new Map();
  }

  async init() {
    await this.ctx.audioWorklet.addModule("./src/worklets/vcoProcessor.js");

    this.buildVoiceCore();
    this.buildModulation();
    this.buildFX();
    this.defineParams();
    this.initMIDI();
  }

  buildVoiceCore() {
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);

    this.amp = this.ctx.createGain();
    this.amp.gain.value = 0;

    this.tremolo = this.ctx.createGain();
    this.tremolo.gain.value = 1;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = this.baseCutoff;
    this.filter.Q.value = this.baseResonance;

    this.mix = this.ctx.createGain();
    this.mix.gain.value = 1.0;

    this.mix.connect(this.filter);
    this.filter.connect(this.amp);
    this.amp.connect(this.tremolo);

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
  }

  buildModulation() {
    this.lfo = this.ctx.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = this.lfoState.rate;

    this.lfoPitchGain = this.ctx.createGain();
    this.lfoFilterGain = this.ctx.createGain();
    this.lfoAmpGain = this.ctx.createGain();

    this.lfoPitchGain.gain.value = this.lfoState.pitchDepth;
    this.lfoFilterGain.gain.value = this.lfoState.filterDepth;
    this.setAmpLfoDepth(this.lfoState.ampDepth);

    this.lfo.connect(this.lfoPitchGain);
    this.lfo.connect(this.lfoFilterGain);
    this.lfo.connect(this.lfoAmpGain);

    this.lfoPitchGain.connect(this.osc1.parameters.get("detune"));
    this.lfoPitchGain.connect(this.osc2.parameters.get("detune"));
    this.lfoPitchGain.connect(this.osc3.parameters.get("detune"));

    this.lfoFilterGain.connect(this.filter.frequency);
    this.lfoAmpGain.connect(this.tremolo.gain);

    this.lfo.start();
  }

  buildFX() {
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1.0;

    this.fxSendGain = this.ctx.createGain();
    this.fxSendGain.gain.value = this.fxSend;

    this.tremolo.connect(this.dryGain);
    this.tremolo.connect(this.fxSendGain);
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
    this.chorusDelay.delayTime.value = this.chorusState.baseDelay;

    this.chorusDryGain = this.ctx.createGain();
    this.chorusWetGain = this.ctx.createGain();
    this.chorusOut = this.ctx.createGain();

    this.setChorusMix(this.chorusState.mix);

    this.chorusDryGain.connect(this.chorusOut);
    this.chorusDelay.connect(this.chorusWetGain);
    this.chorusWetGain.connect(this.chorusOut);

    this.chorusLFO = this.ctx.createOscillator();
    this.chorusLFO.type = "sine";
    this.chorusLFO.frequency.value = this.chorusState.rate;

    this.chorusDepthGain = this.ctx.createGain();
    this.chorusDepthGain.gain.value = this.chorusState.depthMs / 1000;

    this.chorusLFO.connect(this.chorusDepthGain);
    this.chorusDepthGain.connect(this.chorusDelay.delayTime);
    this.chorusLFO.start();
  }

  buildDelaySection() {
    this.delayNode = this.ctx.createDelay(1.0);
    this.delayNode.delayTime.value = this.delayState.time;

    this.delayBypassGain = this.ctx.createGain();
    this.delayWetGain = this.ctx.createGain();
    this.delayOut = this.ctx.createGain();

    this.delayFeedbackGain = this.ctx.createGain();
    this.delayFeedbackGain.gain.value = this.delayState.feedback;

    this.delayTone = this.ctx.createBiquadFilter();
    this.delayTone.type = "lowpass";
    this.delayTone.frequency.value = 2200;

    this.delaySaturator = this.ctx.createWaveShaper();
    this.delaySaturator.curve = this.createSaturatorCurve();
    this.delaySaturator.oversample = "2x";

    this.setDelayMix(this.delayState.mix);

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
    this.reverbConvolver.buffer = this.createImpulseResponse(this.reverbState.decay);

    this.reverbBypassGain = this.ctx.createGain();
    this.reverbWetGain = this.ctx.createGain();
    this.reverbOut = this.ctx.createGain();

    this.setReverbMix(this.reverbState.mix);

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
      this.master.gain.setValueAtTime(norm, this.ctx.currentTime);
    });

    this.params.set("filter.cutoff", (norm) => {
      this.baseCutoff = this.denormalizeLog(norm, 60, 12000);
    });

    this.params.set("lfo.rate", (norm) => {
      const rate = this.denormalizeLog(norm, 0.1, 20);
      this.lfoState.rate = rate;
      this.lfo.frequency.setValueAtTime(rate, this.ctx.currentTime);
    });

    this.params.set("chorus.mix", (norm) => {
      this.chorusState.mix = norm;
      this.setChorusMix(norm);
    });

    this.params.set("delay.mix", (norm) => {
      this.delayState.mix = norm;
      this.setDelayMix(norm);
    });

    this.params.set("reverb.mix", (norm) => {
      this.reverbState.mix = norm;
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
      this.lfoPitchGain.gain.setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("lfo.filterDepth", (value) => {
      this.lfoState.filterDepth = value;
      this.lfoFilterGain.gain.setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("lfo.ampDepth", (value) => {
      this.lfoState.ampDepth = value;
      this.setAmpLfoDepth(value);
    });

    this.discreteParams.set("chorus.rate", (value) => {
      this.chorusState.rate = value;
      this.chorusLFO.frequency.setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("chorus.depth", (value) => {
      this.chorusState.depthMs = value;
      this.chorusDepthGain.gain.setValueAtTime(value / 1000, this.ctx.currentTime);
    });

    this.discreteParams.set("fx.send", (value) => {
      this.fxSend = value;
      this.fxSendGain.gain.setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("delay.time", (value) => {
      this.delayState.time = value;
      this.delayNode.delayTime.setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("delay.feedback", (value) => {
      this.delayState.feedback = value;
      this.delayFeedbackGain.gain.setValueAtTime(value, this.ctx.currentTime);
    });

    this.discreteParams.set("reverb.decay", (value) => {
      this.reverbState.decay = value;
      this.reverbConvolver.buffer = this.createImpulseResponse(value);
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

    const currentAmp = Math.max(this.amp.gain.value, 0.0001);
    this.amp.gain.setValueAtTime(currentAmp, t);
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
    this.amp.gain.setValueAtTime(Math.max(this.amp.gain.value, 0.0001), t);
    this.amp.gain.linearRampToValueAtTime(0, t + this.env.release);

    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setValueAtTime(this.filter.frequency.value, t);
    this.filter.frequency.linearRampToValueAtTime(this.baseCutoff, t + this.env.release);
  }

  setAllFrequencies(freq) {
    this.osc1.parameters.get("frequency").setValueAtTime(freq, this.ctx.currentTime);
    this.osc2.parameters.get("frequency").setValueAtTime(freq, this.ctx.currentTime);
    this.osc3.parameters.get("frequency").setValueAtTime(freq, this.ctx.currentTime);
  }

  setAmpLfoDepth(depth) {
    this.tremolo.gain.setValueAtTime(1 - depth / 2, this.ctx.currentTime);
    this.lfoAmpGain.gain.setValueAtTime(depth / 2, this.ctx.currentTime);
  }

  setChorusMix(mix) {
    this.chorusDryGain.gain.setValueAtTime(1 - mix, this.ctx.currentTime);
    this.chorusWetGain.gain.setValueAtTime(mix, this.ctx.currentTime);
  }

  setDelayMix(mix) {
    this.delayBypassGain.gain.setValueAtTime(1 - mix, this.ctx.currentTime);
    this.delayWetGain.gain.setValueAtTime(mix, this.ctx.currentTime);
  }

  setReverbMix(mix) {
    this.reverbBypassGain.gain.setValueAtTime(1 - mix, this.ctx.currentTime);
    this.reverbWetGain.gain.setValueAtTime(mix, this.ctx.currentTime);
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

  createSaturatorCurve() {
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 512) - 1;
      curve[i] = Math.tanh(x * 2.5);
    }
    return curve;
  }

  createImpulseResponse(decaySeconds) {
    const rate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(rate * decaySeconds));
    const impulse = this.ctx.createBuffer(2, length, rate);

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.5);
      }
    }

    return impulse;
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
