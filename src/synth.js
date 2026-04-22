import { MPE } from "./mpe.js?v=7";

export class Synth {
  constructor(ctx) {
    this.ctx = ctx;
    this.mpe = new MPE(this);
    this.master = null;
    this.voiceBus = null;
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
    this.voiceCount = 8;
    this.voices = [];
    this.baseDetune = { osc1: 0, osc2: -7, osc3: 7 };
    this.baseWaves = { osc1: 1, osc2: 1, osc3: 1 };
    this.baseOscGains = { osc1: 0.7, osc2: 0.5, osc3: 0.5 };
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
    this.envSettings = { attack: 0.01, decay: 0.35, sustain: 0.65, release: 0.45 };
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
    await this.ctx.audioWorklet.addModule("./src/worklets/vcoProcessor.js?v=5");
    this.buildVoiceCore();
    this.buildFX();
    this.defineParams();
    this.initMIDI();
  }

  buildVoiceCore() {
    this.master = this.ctx.createGain();
    this.master.gain.value = this.baseValues.masterGain;
    this.master.connect(this.ctx.destination);
    this.voiceBus = this.ctx.createGain();
    this.voiceBus.gain.value = 1.0;
    this.voices = [];
    for (let i = 0; i < this.voiceCount; i++) this.voices.push(this.createVoice(i));
  }

  createVoice(index) {
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this.baseValues.filterCutoff;
    filter.Q.value = this.baseValues.filterResonance;
    const amp = this.ctx.createGain();
    amp.gain.value = 0;
    const postAmpMod = this.ctx.createGain();
    postAmpMod.gain.value = 1;
    filter.connect(amp);
    amp.connect(postAmpMod);
    postAmpMod.connect(this.voiceBus);
    const osc1 = new AudioWorkletNode(this.ctx, "vco");
    const osc2 = new AudioWorkletNode(this.ctx, "vco");
    const osc3 = new AudioWorkletNode(this.ctx, "vco");
    const osc1Gain = this.ctx.createGain();
    const osc2Gain = this.ctx.createGain();
    const osc3Gain = this.ctx.createGain();
    osc1Gain.gain.value = this.baseOscGains.osc1;
    osc2Gain.gain.value = this.baseOscGains.osc2;
    osc3Gain.gain.value = this.baseOscGains.osc3;
    osc1.connect(osc1Gain); osc2.connect(osc2Gain); osc3.connect(osc3Gain);
    osc1Gain.connect(filter); osc2Gain.connect(filter); osc3Gain.connect(filter);
    const voice = {
      index, noteId: null, frequency: this.baseFrequency, isActive: false, startedAt: 0, lastEventAt: 0,
      osc1, osc2, osc3, osc1Gain, osc2Gain, osc3Gain, filter, amp, postAmpMod,
      env: { value: 0, stage: "idle", stageStart: 0, stageStartValue: 0 },
    };
    this.applyWaveSettingsToVoice(voice, this.ctx.currentTime);
    this.applyCurrentDetunesToVoice(voice, this.ctx.currentTime);
    this.setVoiceFrequency(voice, this.baseFrequency, this.ctx.currentTime);
    return voice;
  }

  buildFX() {
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1.0;
    this.fxSendGain = this.ctx.createGain();
    this.fxSendGain.gain.value = this.baseValues.fxSend;
    this.voiceBus.connect(this.dryGain);
    this.voiceBus.connect(this.fxSendGain);
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
      this.baseOscGains.osc1 = norm;
      this.voices.forEach((voice) => voice.osc1Gain.gain.setValueAtTime(norm, this.ctx.currentTime));
    });
    this.params.set("osc2.gain", (norm) => {
      this.baseOscGains.osc2 = norm;
      this.voices.forEach((voice) => voice.osc2Gain.gain.setValueAtTime(norm, this.ctx.currentTime));
    });
    this.params.set("osc3.gain", (norm) => {
      this.baseOscGains.osc3 = norm;
      this.voices.forEach((voice) => voice.osc3Gain.gain.setValueAtTime(norm, this.ctx.currentTime));
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
    this.params.set("macro1.value", (norm) => { this.baseValues.macro1 = norm; });
    this.params.set("macro2.value", (norm) => { this.baseValues.macro2 = norm; });
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
      this.baseWaves.osc1 = this.waveToIndex(value);
      this.voices.forEach((voice) => voice.osc1.parameters.get("wave").setValueAtTime(this.baseWaves.osc1, this.ctx.currentTime));
    });
    this.discreteParams.set("osc2.wave", (value) => {
      this.baseWaves.osc2 = this.waveToIndex(value);
      this.voices.forEach((voice) => voice.osc2.parameters.get("wave").setValueAtTime(this.baseWaves.osc2, this.ctx.currentTime));
    });
    this.discreteParams.set("osc3.wave", (value) => {
      this.baseWaves.osc3 = this.waveToIndex(value);
      this.voices.forEach((voice) => voice.osc3.parameters.get("wave").setValueAtTime(this.baseWaves.osc3, this.ctx.currentTime));
    });
    this.discreteParams.set("osc1.detune", (value) => { this.baseDetune.osc1 = value; });
    this.discreteParams.set("osc2.detune", (value) => { this.baseDetune.osc2 = value; });
    this.discreteParams.set("osc3.detune", (value) => { this.baseDetune.osc3 = value; });
    this.discreteParams.set("filter.resonance", (value) => {
      this.baseValues.filterResonance = value;
      this.voices.forEach((voice) => voice.filter.Q.setValueAtTime(value, this.ctx.currentTime));
    });
    this.discreteParams.set("env.attack", (value) => { this.envSettings.attack = value; });
    this.discreteParams.set("env.decay", (value) => { this.envSettings.decay = value; });
    this.discreteParams.set("env.sustain", (value) => { this.envSettings.sustain = value; });
    this.discreteParams.set("env.release", (value) => { this.envSettings.release = value; });
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

  setParam(key, value) {
    const handler = this.params.get(key);
    if (handler) handler(value);
  }

  setDiscreteParam(key, value) {
    const handler = this.discreteParams.get(key);
    if (handler) handler(value);
  }

  setRoute(index, patch) {
    if (!this.routes[index]) return;
    this.routes[index] = { ...this.routes[index], ...patch };
  }

  tick() {
    const now = this.ctx.currentTime;
    const lfo = Math.sin(now * Math.PI * 2 * this.baseValues.lfoRate);
    let maxEnv = 0;
    for (const voice of this.voices) {
      if (!voice.isActive && voice.env.stage === "idle") continue;
      this.updateVoiceEnvelope(voice, now);
      this.applyVoiceModMatrix(voice, now, lfo);
      if (voice.env.value > maxEnv) maxEnv = voice.env.value;
      if (voice.env.stage === "idle" && !voice.isActive) {
        voice.amp.gain.setValueAtTime(0, now);
        voice.postAmpMod.gain.setValueAtTime(1, now);
      }
    }
    this.applyGlobalFxModMatrix(now, lfo, maxEnv);
  }

  updateVoiceEnvelope(voice, now) {
    const env = voice.env;
    const settings = this.envSettings;
    if (env.stage === "idle") {
      env.value = 0;
      return;
    }
    if (env.stage === "attack") {
      const progress = Math.min(1, (now - env.stageStart) / Math.max(0.0001, settings.attack));
      env.value = this.lerp(env.stageStartValue, 1, progress);
      if (progress >= 1) {
        env.stage = "decay";
        env.stageStart = now;
        env.stageStartValue = 1;
      }
    } else if (env.stage === "decay") {
      const progress = Math.min(1, (now - env.stageStart) / Math.max(0.0001, settings.decay));
      env.value = this.lerp(env.stageStartValue, settings.sustain, progress);
      if (progress >= 1) {
        env.stage = "sustain";
        env.stageStart = now;
        env.stageStartValue = settings.sustain;
      }
    } else if (env.stage === "sustain") {
      env.value = settings.sustain;
    } else if (env.stage === "release") {
      const progress = Math.min(1, (now - env.stageStart) / Math.max(0.0001, settings.release));
      env.value = this.lerp(env.stageStartValue, 0, progress);
      if (progress >= 1) {
        env.stage = "idle";
        env.stageStart = now;
        env.stageStartValue = 0;
        env.value = 0;
        voice.isActive = false;
        voice.noteId = null;
      }
    }
    voice.amp.gain.setValueAtTime(env.value, now);
  }

  applyVoiceModMatrix(voice, now, lfo) {
    const sources = { lfo, env: voice.env.value, macro1: this.baseValues.macro1, macro2: this.baseValues.macro2 };
    const sums = { "osc1.detune": 0, "osc2.detune": 0, "osc3.detune": 0, "filter.cutoff": 0, "amp.level": 0 };
    for (const route of this.routes) {
      if (!(route.dest in sums)) continue;
      const sourceValue = sources[route.source] ?? 0;
      sums[route.dest] += sourceValue * (route.amount ?? 0) * this.getDestinationScale(route.dest);
    }
    voice.osc1.parameters.get("detune").setValueAtTime(this.baseDetune.osc1 + sums["osc1.detune"], now);
    voice.osc2.parameters.get("detune").setValueAtTime(this.baseDetune.osc2 + sums["osc2.detune"], now);
    voice.osc3.parameters.get("detune").setValueAtTime(this.baseDetune.osc3 + sums["osc3.detune"], now);
    const finalCutoff = this.clamp(this.baseValues.filterCutoff + sums["filter.cutoff"], 40, 16000);
    voice.filter.frequency.setValueAtTime(finalCutoff, now);
    voice.filter.Q.setValueAtTime(this.baseValues.filterResonance, now);
    const finalAmpMod = this.clamp(1 + sums["amp.level"], 0, 1.5);
    voice.postAmpMod.gain.setValueAtTime(finalAmpMod, now);
  }

  applyGlobalFxModMatrix(now, lfo, envValue) {
    const sources = { lfo, env: envValue, macro1: this.baseValues.macro1, macro2: this.baseValues.macro2 };
    const sums = { "chorus.mix": 0, "delay.mix": 0, "reverb.mix": 0 };
    for (const route of this.routes) {
      if (!(route.dest in sums)) continue;
      const sourceValue = sources[route.source] ?? 0;
      sums[route.dest] += sourceValue * (route.amount ?? 0) * this.getDestinationScale(route.dest);
    }
    this.setChorusMix(this.clamp(this.baseValues.chorusMix + sums["chorus.mix"], 0, 1));
    this.setDelayMix(this.clamp(this.baseValues.delayMix + sums["delay.mix"], 0, 1));
    this.setReverbMix(this.clamp(this.baseValues.reverbMix + sums["reverb.mix"], 0, 1));
  }

  getDestinationScale(dest) {
    switch (dest) {
      case "osc1.detune":
      case "osc2.detune":
      case "osc3.detune": return 50;
      case "filter.cutoff": return 3000;
      case "amp.level": return 0.8;
      case "chorus.mix":
      case "delay.mix":
      case "reverb.mix": return 0.7;
      default: return 1;
    }
  }

  noteOn(freq, noteId = `note-${freq}`) {
    const now = this.ctx.currentTime;
    const voice = this.allocateVoice(noteId);
    voice.noteId = noteId;
    voice.frequency = freq;
    voice.isActive = true;
    voice.startedAt = now;
    voice.lastEventAt = now;
    this.setVoiceFrequency(voice, freq, now);
    this.applyWaveSettingsToVoice(voice, now);
    this.applyCurrentDetunesToVoice(voice, now);
    voice.env.stage = "attack";
    voice.env.stageStart = now;
    voice.env.stageStartValue = voice.env.value;
  }

  noteOff(noteId = null) {
    const now = this.ctx.currentTime;
    if (noteId === null || noteId === undefined) {
      this.voices.forEach((voice) => { if (voice.isActive) this.releaseVoice(voice, now); });
      return;
    }
    for (const voice of this.voices) {
      if (voice.isActive && voice.noteId === noteId) this.releaseVoice(voice, now);
    }
  }

  releaseVoice(voice, now) {
    voice.lastEventAt = now;
    voice.env.stage = "release";
    voice.env.stageStart = now;
    voice.env.stageStartValue = voice.env.value;
  }

  allocateVoice(noteId) {
    const existing = this.voices.find((voice) => voice.isActive && voice.noteId === noteId);
    if (existing) return existing;
    const idle = this.voices.find((voice) => !voice.isActive && voice.env.stage === "idle");
    if (idle) return idle;
    return this.voices.reduce((oldest, voice) => (!oldest || voice.startedAt < oldest.startedAt ? voice : oldest), null);
  }

  setVoiceFrequency(voice, freq, time) {
    voice.osc1.parameters.get("frequency").setValueAtTime(freq, time);
    voice.osc2.parameters.get("frequency").setValueAtTime(freq, time);
    voice.osc3.parameters.get("frequency").setValueAtTime(freq, time);
  }

  applyWaveSettingsToVoice(voice, time) {
    voice.osc1.parameters.get("wave").setValueAtTime(this.baseWaves.osc1, time);
    voice.osc2.parameters.get("wave").setValueAtTime(this.baseWaves.osc2, time);
    voice.osc3.parameters.get("wave").setValueAtTime(this.baseWaves.osc3, time);
  }

  applyCurrentDetunesToVoice(voice, time) {
    voice.osc1.parameters.get("detune").setValueAtTime(this.baseDetune.osc1, time);
    voice.osc2.parameters.get("detune").setValueAtTime(this.baseDetune.osc2, time);
    voice.osc3.parameters.get("detune").setValueAtTime(this.baseDetune.osc3, time);
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
      case "sine": return 0;
      case "sawtooth": return 1;
      case "square": return 2;
      case "triangle": return 3;
      default: return 1;
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

  lerp(a, b, t) { return a + (b - a) * t; }
  clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

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
