import { MPE } from "./mpe.js?v=7";

export class Synth {
  constructor(ctx) {
    this.ctx = ctx;
    this.mpe = new MPE(this);
    this.master = null;
    this.masterInput = null;
    this.masterDriveGain = null;
    this.masterSaturator = null;
    this.masterCompGain = null;
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
      filter2Cutoff: 2200,
      filter2Resonance: 7.5,
      hpfCutoff: 30,
      filterKeytrack: 0.35,
      filter2Keytrack: 0.20,
      hpfKeytrack: 0.0,
      filterEnvDepth: 0.55,
      filter2EnvDepth: 0.30,
      hpfEnvDepth: 0.08,
      filterParallelBlend: 0.5,
      filterRoutingMode: "serial",
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
      activeVoiceCount: 8,
      unisonCount: 1,
      unisonSpread: 0.35,
      analogDrift: 0.18,
      analogInstability: 0.12,
      voiceDrive: 0.22,
      driveCompensation: 0.72,
      masterDrive: 0.16,
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
    for (let i = 0; i < this.voiceCount; i++) {
      this.voices.push(this.createVoice(i));
    }
  }

  createVoice(index) {
    const voiceMix = this.ctx.createGain();
    const driveGain = this.ctx.createGain();
    const driveShaper = this.ctx.createWaveShaper();
    driveShaper.oversample = "2x";
    const driveCompGain = this.ctx.createGain();

    const filterSplit = this.ctx.createGain();
    const serialLpf1A = this.ctx.createBiquadFilter();
    const serialLpf1B = this.ctx.createBiquadFilter();
    const serialLpf2 = this.ctx.createBiquadFilter();
    const serialModeGain = this.ctx.createGain();

    const parallelLpf1A = this.ctx.createBiquadFilter();
    const parallelLpf1B = this.ctx.createBiquadFilter();
    const parallelLpf2 = this.ctx.createBiquadFilter();
    const parallelLpf1Gain = this.ctx.createGain();
    const parallelLpf2Gain = this.ctx.createGain();
    const parallelSum = this.ctx.createGain();
    const parallelModeGain = this.ctx.createGain();

    const hpf = this.ctx.createBiquadFilter();
    const postFilterSum = this.ctx.createGain();

    const amp = this.ctx.createGain();
    amp.gain.value = 0;

    const postAmpMod = this.ctx.createGain();
    postAmpMod.gain.value = 1;

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = 0;

    serialLpf1A.type = "lowpass";
    serialLpf1B.type = "lowpass";
    serialLpf2.type = "lowpass";
    parallelLpf1A.type = "lowpass";
    parallelLpf1B.type = "lowpass";
    parallelLpf2.type = "lowpass";
    hpf.type = "highpass";

    voiceMix.connect(driveGain);
    driveGain.connect(driveShaper);
    driveShaper.connect(driveCompGain);
    driveCompGain.connect(filterSplit);

    filterSplit.connect(serialLpf1A);
    serialLpf1A.connect(serialLpf1B);
    serialLpf1B.connect(serialLpf2);
    serialLpf2.connect(serialModeGain);
    serialModeGain.connect(postFilterSum);

    filterSplit.connect(parallelLpf1A);
    parallelLpf1A.connect(parallelLpf1B);
    parallelLpf1B.connect(parallelLpf1Gain);
    parallelLpf1Gain.connect(parallelSum);

    filterSplit.connect(parallelLpf2);
    parallelLpf2.connect(parallelLpf2Gain);
    parallelLpf2Gain.connect(parallelSum);
    parallelSum.connect(parallelModeGain);
    parallelModeGain.connect(postFilterSum);

    postFilterSum.connect(hpf);
    hpf.connect(amp);
    amp.connect(postAmpMod);
    postAmpMod.connect(panner);
    panner.connect(this.voiceBus);

    const osc1 = new AudioWorkletNode(this.ctx, "vco");
    const osc2 = new AudioWorkletNode(this.ctx, "vco");
    const osc3 = new AudioWorkletNode(this.ctx, "vco");

    const osc1Gain = this.ctx.createGain();
    const osc2Gain = this.ctx.createGain();
    const osc3Gain = this.ctx.createGain();

    osc1Gain.gain.value = this.baseOscGains.osc1;
    osc2Gain.gain.value = this.baseOscGains.osc2;
    osc3Gain.gain.value = this.baseOscGains.osc3;

    osc1.connect(osc1Gain);
    osc2.connect(osc2Gain);
    osc3.connect(osc3Gain);

    osc1Gain.connect(voiceMix);
    osc2Gain.connect(voiceMix);
    osc3Gain.connect(voiceMix);

    const voice = {
      index,
      noteId: null,
      groupId: null,
      frequency: this.baseFrequency,
      isActive: false,
      startedAt: 0,
      lastEventAt: 0,
      stackIndex: 0,
      stackSize: 1,
      basePan: 0,
      unisonDetuneCents: 0,
      randomDetuneSeed: 0,
      randomFilterSeed: 0,
      randomPanSeed: 0,
      driftPhase: 0,
      driftRate: 0.1,
      panner,
      voiceMix,
      driveGain,
      driveShaper,
      driveCompGain,
      filterSplit,
      serialLpf1A,
      serialLpf1B,
      serialLpf2,
      serialModeGain,
      parallelLpf1A,
      parallelLpf1B,
      parallelLpf2,
      parallelLpf1Gain,
      parallelLpf2Gain,
      parallelSum,
      parallelModeGain,
      hpf,
      postFilterSum,
      osc1,
      osc2,
      osc3,
      osc1Gain,
      osc2Gain,
      osc3Gain,
      amp,
      postAmpMod,
      env: { value: 0, stage: "idle", stageStart: 0, stageStartValue: 0 },
    };

    this.refreshVoiceAnalogProfile(voice);
    this.updateSingleVoiceDriveSettings(voice, this.ctx.currentTime);
    this.updateSingleVoiceRoutingSettings(voice, this.ctx.currentTime);
    this.applyWaveSettingsToVoice(voice, this.ctx.currentTime);
    this.applyCurrentDetunesToVoice(voice, this.ctx.currentTime);
    this.applyVoiceFilterSettings(voice, this.ctx.currentTime, this.baseValues.filterCutoff, this.baseValues.filter2Cutoff, this.baseValues.hpfCutoff);
    this.setVoiceFrequency(voice, this.baseFrequency, this.ctx.currentTime);
    return voice;
  }

  refreshVoiceAnalogProfile(voice) {
    voice.randomDetuneSeed = (Math.random() * 2) - 1;
    voice.randomFilterSeed = (Math.random() * 2) - 1;
    voice.randomPanSeed = (Math.random() * 2) - 1;
    voice.driftPhase = Math.random() * Math.PI * 2;
    voice.driftRate = 0.045 + (Math.random() * 0.18);
  }

  buildFX() {
    this.dryGain = this.ctx.createGain();
    this.dryGain.gain.value = 1.0;
    this.fxSendGain = this.ctx.createGain();
    this.fxSendGain.gain.value = this.baseValues.fxSend;

    this.masterInput = this.ctx.createGain();
    this.masterInput.gain.value = 1.0;
    this.masterDriveGain = this.ctx.createGain();
    this.masterSaturator = this.ctx.createWaveShaper();
    this.masterSaturator.oversample = "2x";
    this.masterCompGain = this.ctx.createGain();

    this.voiceBus.connect(this.dryGain);
    this.voiceBus.connect(this.fxSendGain);
    this.dryGain.connect(this.masterInput);

    this.buildChorusSection();
    this.buildDelaySection();
    this.buildReverbSection();

    this.fxSendGain.connect(this.chorusDryGain);
    this.fxSendGain.connect(this.chorusDelay);
    this.chorusOut.connect(this.delayBypassGain);
    this.chorusOut.connect(this.delayNode);
    this.delayOut.connect(this.reverbBypassGain);
    this.delayOut.connect(this.reverbConvolver);
    this.reverbOut.connect(this.masterInput);

    this.masterInput.connect(this.masterDriveGain);
    this.masterDriveGain.connect(this.masterSaturator);
    this.masterSaturator.connect(this.masterCompGain);
    this.masterCompGain.connect(this.master);

    this.updateMasterDriveSettings(this.ctx.currentTime);
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
    this.delaySaturator.curve = this.createDriveCurve(2.5);
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
    this.params.set("filter2.cutoff", (norm) => {
      this.baseValues.filter2Cutoff = this.denormalizeLog(norm, 60, 12000);
    });
    this.params.set("hpf.cutoff", (norm) => {
      this.baseValues.hpfCutoff = this.denormalizeLog(norm, 20, 4000);
    });
    this.params.set("filter.parallelBlend", (norm) => {
      this.baseValues.filterParallelBlend = norm;
      this.updateAllVoiceRoutingSettings(this.ctx.currentTime);
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
    this.params.set("unison.spread", (norm) => {
      this.baseValues.unisonSpread = norm;
      this.updateAllVoiceUnisonPositions(this.ctx.currentTime);
    });
    this.params.set("analog.drift", (norm) => {
      this.baseValues.analogDrift = norm;
    });
    this.params.set("drive.voice", (norm) => {
      this.baseValues.voiceDrive = norm;
      this.updateAllVoiceDriveSettings(this.ctx.currentTime);
    });
    this.params.set("drive.master", (norm) => {
      this.baseValues.masterDrive = norm;
      this.updateMasterDriveSettings(this.ctx.currentTime);
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
    this.discreteParams.set("filter.routing", (value) => {
      this.baseValues.filterRoutingMode = value === "parallel" ? "parallel" : "serial";
      this.updateAllVoiceRoutingSettings(this.ctx.currentTime);
    });
    this.discreteParams.set("filter.keytrack", (value) => { this.baseValues.filterKeytrack = value; });
    this.discreteParams.set("filter2.keytrack", (value) => { this.baseValues.filter2Keytrack = value; });
    this.discreteParams.set("hpf.keytrack", (value) => { this.baseValues.hpfKeytrack = value; });
    this.discreteParams.set("filter.envDepth", (value) => { this.baseValues.filterEnvDepth = value; });
    this.discreteParams.set("filter2.envDepth", (value) => { this.baseValues.filter2EnvDepth = value; });
    this.discreteParams.set("hpf.envDepth", (value) => { this.baseValues.hpfEnvDepth = value; });
    this.discreteParams.set("osc1.detune", (value) => { this.baseDetune.osc1 = value; });
    this.discreteParams.set("osc2.detune", (value) => { this.baseDetune.osc2 = value; });
    this.discreteParams.set("osc3.detune", (value) => { this.baseDetune.osc3 = value; });
    this.discreteParams.set("filter.resonance", (value) => {
      this.baseValues.filterResonance = value;
    });
    this.discreteParams.set("filter2.resonance", (value) => {
      this.baseValues.filter2Resonance = value;
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
    this.discreteParams.set("voice.count", (value) => {
      this.baseValues.activeVoiceCount = this.clamp(Math.round(value), 1, this.voiceCount);
      const now = this.ctx.currentTime;
      this.voices.forEach((voice) => {
        if (voice.index >= this.baseValues.activeVoiceCount && voice.isActive) {
          this.releaseVoice(voice, now);
        }
      });
    });
    this.discreteParams.set("unison.count", (value) => {
      this.baseValues.unisonCount = this.clamp(Math.round(value), 1, 4);
      this.updateAllVoiceUnisonPositions(this.ctx.currentTime);
    });
    this.discreteParams.set("analog.instability", (value) => {
      this.baseValues.analogInstability = value;
    });
    this.discreteParams.set("drive.compensation", (value) => {
      this.baseValues.driveCompensation = value;
      this.updateAllVoiceDriveSettings(this.ctx.currentTime);
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
        voice.groupId = null;
      }
    }
    voice.amp.gain.setValueAtTime(env.value, now);
  }

  applyVoiceModMatrix(voice, now, lfo) {
    const sources = { lfo, env: voice.env.value, macro1: this.baseValues.macro1, macro2: this.baseValues.macro2 };
    const sums = {
      "osc1.detune": 0,
      "osc2.detune": 0,
      "osc3.detune": 0,
      "filter.cutoff": 0,
      "filter2.cutoff": 0,
      "hpf.cutoff": 0,
      "amp.level": 0,
    };

    for (const route of this.routes) {
      if (!(route.dest in sums)) continue;
      const sourceValue = sources[route.source] ?? 0;
      sums[route.dest] += sourceValue * (route.amount ?? 0) * this.getDestinationScale(route.dest);
    }

    const slowDrift = Math.sin((now * Math.PI * 2 * voice.driftRate) + voice.driftPhase) * this.baseValues.analogDrift * 7;
    const staticSlop = voice.randomDetuneSeed * this.baseValues.analogInstability * 10;
    const totalAnalogDetune = slowDrift + staticSlop;

    voice.osc1.parameters.get("detune").setValueAtTime(this.baseDetune.osc1 + voice.unisonDetuneCents + totalAnalogDetune + sums["osc1.detune"], now);
    voice.osc2.parameters.get("detune").setValueAtTime(this.baseDetune.osc2 + voice.unisonDetuneCents + totalAnalogDetune + sums["osc2.detune"], now);
    voice.osc3.parameters.get("detune").setValueAtTime(this.baseDetune.osc3 + voice.unisonDetuneCents + totalAnalogDetune + sums["osc3.detune"], now);

    const filterDrift = Math.sin((now * Math.PI * 2 * voice.driftRate * 0.63) + (voice.driftPhase * 0.71)) * this.baseValues.analogDrift * 220;
    const filterSlop = voice.randomFilterSeed * this.baseValues.analogInstability * 180;
    const noteSemitoneOffset = this.getNoteSemitoneOffset(voice.frequency);

    const trackedCutoff1 = this.baseValues.filterCutoff * Math.pow(2, (noteSemitoneOffset * this.baseValues.filterKeytrack) / 12);
    const trackedCutoff2 = this.baseValues.filter2Cutoff * Math.pow(2, (noteSemitoneOffset * this.baseValues.filter2Keytrack) / 12);
    const trackedHpf = this.baseValues.hpfCutoff * Math.pow(2, (noteSemitoneOffset * this.baseValues.hpfKeytrack) / 12);

    const envBoost1 = voice.env.value * this.baseValues.filterEnvDepth * 5200;
    const envBoost2 = voice.env.value * this.baseValues.filter2EnvDepth * 4200;
    const envBoostHpf = voice.env.value * this.baseValues.hpfEnvDepth * 900;

    const finalCutoff1 = this.clamp(trackedCutoff1 + envBoost1 + filterDrift + filterSlop + sums["filter.cutoff"], 40, 16000);
    const finalCutoff2 = this.clamp(trackedCutoff2 + envBoost2 + (filterDrift * 0.55) + (filterSlop * 0.4) + (sums["filter.cutoff"] * 0.35) + sums["filter2.cutoff"], 40, 16000);
    const finalHpf = this.clamp(trackedHpf + envBoostHpf + sums["hpf.cutoff"] + Math.max(0, this.baseValues.analogInstability * 18 * voice.randomFilterSeed), 20, 4000);

    this.applyVoiceFilterSettings(voice, now, finalCutoff1, finalCutoff2, finalHpf);

    const panWobble = (voice.randomPanSeed * this.baseValues.analogInstability * 0.08) + (Math.sin((now * Math.PI * 2 * voice.driftRate * 0.41) + voice.driftPhase) * this.baseValues.analogDrift * 0.04);
    voice.panner.pan.setValueAtTime(this.clamp(voice.basePan + panWobble, -1, 1), now);

    const finalAmpMod = this.clamp(1 + sums["amp.level"], 0, 1.5);
    voice.postAmpMod.gain.setValueAtTime(finalAmpMod, now);
  }

  applyVoiceFilterSettings(voice, time, cutoff1, cutoff2, hpfCutoff) {
    const ladderQ1 = this.clamp(this.baseValues.filterResonance * 0.2, 0.01, 18);
    const ladderQ2 = this.clamp(this.baseValues.filterResonance, 0.01, 24);
    const ms20Q = this.clamp(this.baseValues.filter2Resonance, 0.1, 24);

    voice.serialLpf1A.frequency.setValueAtTime(cutoff1, time);
    voice.serialLpf1B.frequency.setValueAtTime(cutoff1, time);
    voice.parallelLpf1A.frequency.setValueAtTime(cutoff1, time);
    voice.parallelLpf1B.frequency.setValueAtTime(cutoff1, time);

    voice.serialLpf1A.Q.setValueAtTime(ladderQ1, time);
    voice.serialLpf1B.Q.setValueAtTime(ladderQ2, time);
    voice.parallelLpf1A.Q.setValueAtTime(ladderQ1, time);
    voice.parallelLpf1B.Q.setValueAtTime(ladderQ2, time);

    voice.serialLpf2.frequency.setValueAtTime(cutoff2, time);
    voice.parallelLpf2.frequency.setValueAtTime(cutoff2, time);
    voice.serialLpf2.Q.setValueAtTime(ms20Q, time);
    voice.parallelLpf2.Q.setValueAtTime(ms20Q, time);

    voice.hpf.frequency.setValueAtTime(hpfCutoff, time);
    voice.hpf.Q.setValueAtTime(0.7, time);
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
      case "osc3.detune":
        return 50;
      case "filter.cutoff":
      case "filter2.cutoff":
        return 3000;
      case "hpf.cutoff":
        return 900;
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

  noteOn(freq, noteId = `note-${freq}`) {
    const now = this.ctx.currentTime;
    const stackSize = this.getCurrentUnisonCount();
    for (let i = 0; i < stackSize; i++) {
      const internalNoteId = `${noteId}::${i}`;
      const voice = this.allocateVoice(internalNoteId);
      voice.noteId = internalNoteId;
      voice.groupId = noteId;
      voice.frequency = freq;
      voice.isActive = true;
      voice.startedAt = now;
      voice.lastEventAt = now;
      voice.stackIndex = i;
      voice.stackSize = stackSize;
      voice.unisonDetuneCents = this.getUnisonDetune(i, stackSize);
      voice.basePan = this.getUnisonPan(i, stackSize);
      this.refreshVoiceAnalogProfile(voice);
      voice.panner.pan.setValueAtTime(voice.basePan, now);
      this.updateSingleVoiceDriveSettings(voice, now);
      this.updateSingleVoiceRoutingSettings(voice, now);
      this.setVoiceFrequency(voice, freq, now);
      this.applyWaveSettingsToVoice(voice, now);
      this.applyCurrentDetunesToVoice(voice, now);
      voice.env.stage = "attack";
      voice.env.stageStart = now;
      voice.env.stageStartValue = voice.env.value;
    }
  }

  noteOff(noteId = null) {
    const now = this.ctx.currentTime;
    if (noteId === null || noteId === undefined) {
      this.voices.forEach((voice) => { if (voice.isActive) this.releaseVoice(voice, now); });
      return;
    }
    for (const voice of this.voices) {
      if (voice.isActive && (voice.groupId === noteId || voice.noteId === noteId)) {
        this.releaseVoice(voice, now);
      }
    }
  }

  releaseVoice(voice, now) {
    voice.lastEventAt = now;
    voice.env.stage = "release";
    voice.env.stageStart = now;
    voice.env.stageStartValue = voice.env.value;
  }

  allocateVoice(noteId) {
    const pool = this.voices.slice(0, this.baseValues.activeVoiceCount);
    const existing = pool.find((voice) => voice.isActive && voice.noteId === noteId);
    if (existing) return existing;
    const idle = pool.find((voice) => !voice.isActive && voice.env.stage === "idle");
    if (idle) return idle;
    const releasing = pool.find((voice) => !voice.isActive);
    if (releasing) return releasing;
    return pool.reduce((oldest, voice) => (!oldest || voice.startedAt < oldest.startedAt ? voice : oldest), null);
  }

  getCurrentUnisonCount() {
    return this.clamp(Math.round(this.baseValues.unisonCount), 1, Math.min(4, this.baseValues.activeVoiceCount));
  }

  getUnisonDetune(index, total) {
    if (total <= 1) return 0;
    const position = (index / (total - 1)) * 2 - 1;
    return position * this.baseValues.unisonSpread * 35;
  }

  getUnisonPan(index, total) {
    if (total <= 1) return 0;
    const position = (index / (total - 1)) * 2 - 1;
    return this.clamp(position * this.baseValues.unisonSpread, -1, 1);
  }

  updateAllVoiceUnisonPositions(time) {
    for (const voice of this.voices) {
      if (!voice.groupId) continue;
      voice.unisonDetuneCents = this.getUnisonDetune(voice.stackIndex, voice.stackSize);
      voice.basePan = this.getUnisonPan(voice.stackIndex, voice.stackSize);
      voice.panner.pan.setValueAtTime(voice.basePan, time);
    }
  }

  updateSingleVoiceRoutingSettings(voice, time) {
    const isParallel = this.baseValues.filterRoutingMode === "parallel";
    voice.serialModeGain.gain.setValueAtTime(isParallel ? 0 : 1, time);
    voice.parallelModeGain.gain.setValueAtTime(isParallel ? 1 : 0, time);
    voice.parallelLpf1Gain.gain.setValueAtTime(1 - this.baseValues.filterParallelBlend, time);
    voice.parallelLpf2Gain.gain.setValueAtTime(this.baseValues.filterParallelBlend, time);
  }

  updateAllVoiceRoutingSettings(time) {
    this.voices.forEach((voice) => this.updateSingleVoiceRoutingSettings(voice, time));
  }

  updateSingleVoiceDriveSettings(voice, time) {
    const driveAmount = 1 + (this.baseValues.voiceDrive * 8.5);
    const compensation = this.clamp(1 - (this.baseValues.voiceDrive * this.baseValues.driveCompensation * 0.78), 0.18, 1);
    voice.driveGain.gain.setValueAtTime(driveAmount, time);
    voice.driveShaper.curve = this.createDriveCurve(1.4 + (this.baseValues.voiceDrive * 5.5));
    voice.driveCompGain.gain.setValueAtTime(compensation, time);
  }

  updateAllVoiceDriveSettings(time) {
    this.voices.forEach((voice) => this.updateSingleVoiceDriveSettings(voice, time));
  }

  updateMasterDriveSettings(time) {
    const driveAmount = 1 + (this.baseValues.masterDrive * 6.5);
    const compensation = this.clamp(1 - (this.baseValues.masterDrive * 0.52), 0.32, 1);
    this.masterDriveGain.gain.setValueAtTime(driveAmount, time);
    this.masterSaturator.curve = this.createDriveCurve(1.3 + (this.baseValues.masterDrive * 4.5));
    this.masterCompGain.gain.setValueAtTime(compensation, time);
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
    voice.osc1.parameters.get("detune").setValueAtTime(this.baseDetune.osc1 + voice.unisonDetuneCents, time);
    voice.osc2.parameters.get("detune").setValueAtTime(this.baseDetune.osc2 + voice.unisonDetuneCents, time);
    voice.osc3.parameters.get("detune").setValueAtTime(this.baseDetune.osc3 + voice.unisonDetuneCents, time);
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

  getNoteSemitoneOffset(freq) {
    return 12 * Math.log2(Math.max(0.0001, freq) / this.baseFrequency);
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

  createDriveCurve(amount = 2.5) {
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * amount);
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

  lerp(a, b, t) { return a + ((b - a) * t); }
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
