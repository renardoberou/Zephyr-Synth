import { Synth } from "./src/synth.js?v=14";

const LATENCY_LOOP_MS = 4;
const MOBILE_MAX_VOICES = 3;

function isMobileLikeDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
}

function getVelocityGain(synth, velocity) {
  if (typeof synth.getVelocityGain === "function") {
    return synth.getVelocityGain(velocity);
  }
  const v = Math.min(1, Math.max(0, velocity ?? 1));
  return 0.35 + (v * 0.65);
}

function findTargetVoices(synth, noteId) {
  return synth.voices.filter((voice) => voice.noteId === noteId || voice.groupId === noteId);
}

function writeStatus(text) {
  const el = document.getElementById("status");
  if (el) el.textContent = text;
}

function installRafThrottle() {
  if (!isMobileLikeDevice() || window.__zephyrRafThrottleInstalled) return;
  window.__zephyrRafThrottleInstalled = true;

  const nativeRAF = window.requestAnimationFrame.bind(window);
  const nativeCancelRAF = window.cancelAnimationFrame.bind(window);
  const timerMap = new Map();
  const frameBudgetMs = 1000 / 12;
  let lastFrameTime = 0;
  let rafIdSerial = 1;

  window.requestAnimationFrame = (callback) => {
    const rafId = rafIdSerial++;
    const now = performance.now();
    const delay = Math.max(0, frameBudgetMs - (now - lastFrameTime));
    const timer = setTimeout(() => {
      nativeRAF((ts) => {
        lastFrameTime = ts;
        timerMap.delete(rafId);
        callback(ts);
      });
    }, delay);
    timerMap.set(rafId, timer);
    return rafId;
  };

  window.cancelAnimationFrame = (id) => {
    const timer = timerMap.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timerMap.delete(id);
      return;
    }
    nativeCancelRAF(id);
  };
}

function simplifyVoicePath(voice) {
  if (!voice || voice.__zephyrSimplePath) return;
  voice.__zephyrSimplePath = true;

  try { voice.voiceMix.disconnect(); } catch {}
  try { voice.filterSplit.disconnect(); } catch {}
  try { voice.serialLpf1A.disconnect(); } catch {}
  try { voice.serialLpf1B.disconnect(); } catch {}
  try { voice.serialLpf2.disconnect(); } catch {}
  try { voice.serialModeGain.disconnect(); } catch {}
  try { voice.parallelLpf1A.disconnect(); } catch {}
  try { voice.parallelLpf1B.disconnect(); } catch {}
  try { voice.parallelLpf2.disconnect(); } catch {}
  try { voice.parallelLpf1Gain.disconnect(); } catch {}
  try { voice.parallelLpf2Gain.disconnect(); } catch {}
  try { voice.parallelSum.disconnect(); } catch {}
  try { voice.parallelModeGain.disconnect(); } catch {}
  try { voice.postFilterSum.disconnect(); } catch {}
  try { voice.hpf.disconnect(); } catch {}

  try { voice.voiceMix.connect(voice.amp); } catch {}

  if (voice.osc2Gain?.gain) voice.osc2Gain.gain.setValueAtTime(0, 0);
  if (voice.osc3Gain?.gain) voice.osc3Gain.gain.setValueAtTime(0, 0);
}

function optimizeInstanceForMobile(synth) {
  if (!isMobileLikeDevice() || synth.__zephyrMobileOptimized) return;
  synth.__zephyrMobileOptimized = true;

  installRafThrottle();

  synth.voices.forEach((voice) => {
    simplifyVoicePath(voice);
    if (voice.driveShaper) voice.driveShaper.oversample = "none";
  });
  if (synth.masterSaturator) synth.masterSaturator.oversample = "none";
  if (synth.delaySaturator) synth.delaySaturator.oversample = "none";

  synth.baseValues.activeVoiceCount = Math.min(synth.baseValues.activeVoiceCount, MOBILE_MAX_VOICES);
  synth.baseValues.unisonCount = 1;
  synth.baseValues.fxSend = 0;
  synth.baseValues.analogDrift = 0;
  synth.baseValues.analogInstability = 0;
  synth.baseValues.voiceDrive = 0;
  synth.baseValues.masterDrive = 0;

  if (synth.fxSendGain) synth.fxSendGain.gain.setValueAtTime(0, synth.ctx.currentTime);
  if (synth.masterDriveGain) synth.masterDriveGain.gain.setValueAtTime(1, synth.ctx.currentTime);
  if (synth.masterCompGain) synth.masterCompGain.gain.setValueAtTime(1, synth.ctx.currentTime);

  const setSlider = (id, value, readoutId = null, readoutText = null) => {
    const slider = document.getElementById(id);
    const readout = readoutId ? document.getElementById(readoutId) : null;
    if (slider) slider.value = String(value);
    if (readout && readoutText !== null) readout.textContent = readoutText;
  };

  setSlider("voice-count", MOBILE_MAX_VOICES, "voice-count-readout", String(MOBILE_MAX_VOICES));
  setSlider("unison-count", 1, "unison-count-readout", "1");
  setSlider("fx-send", 0, "fx-send-readout", "0.00");
  setSlider("analog-instability", 0, "analog-instability-readout", "0%");

  document.documentElement.classList.add("zephyr-low-latency-mode");
  writeStatus("Audio running · ultra-light mobile mode");
}

function ensureRealtimeLoop(synth) {
  if (synth.__zephyrRealtimeLoop) return;
  synth.__zephyrRealtimeLoop = setInterval(() => {
    try {
      synth.tick();
    } catch {
      // keep the normal app loop as fallback
    }
  }, LATENCY_LOOP_MS);
}

function scheduleImmediateAttack(synth, voice) {
  const now = synth.ctx.currentTime;
  const velocityGain = getVelocityGain(synth, voice.expression?.velocity ?? 1);
  const attack = Math.max(0.001, synth.envSettings?.attack ?? 0.01);
  const decay = Math.max(0.001, synth.envSettings?.decay ?? 0.35);
  const sustain = Math.min(1, Math.max(0, synth.envSettings?.sustain ?? 0.65));
  const current = voice.amp.gain.value;

  voice.amp.gain.cancelScheduledValues(now);
  voice.amp.gain.setValueAtTime(current, now);
  voice.amp.gain.linearRampToValueAtTime(velocityGain, now + attack);
  voice.amp.gain.linearRampToValueAtTime(velocityGain * sustain, now + attack + decay);

  voice.postAmpMod.gain.cancelScheduledValues(now);
  voice.postAmpMod.gain.setValueAtTime(1, now);
}

function scheduleImmediateRelease(synth, voice) {
  const now = synth.ctx.currentTime;
  const release = Math.max(0.005, synth.envSettings?.release ?? 0.45);
  const current = voice.amp.gain.value;

  voice.amp.gain.cancelScheduledValues(now);
  voice.amp.gain.setValueAtTime(current, now);
  voice.amp.gain.linearRampToValueAtTime(0, now + release);
}

if (!Synth.prototype.__zephyrLatencyPatchApplied) {
  Synth.prototype.__zephyrLatencyPatchApplied = true;

  const originalNoteOn = Synth.prototype.noteOn;
  const originalNoteOff = Synth.prototype.noteOff;
  const originalUpdateNoteExpression = Synth.prototype.updateNoteExpression;

  Synth.prototype.noteOn = function patchedNoteOn(freq, noteId, options = {}) {
    optimizeInstanceForMobile(this);
    ensureRealtimeLoop(this);
    const result = originalNoteOn.call(this, freq, noteId, options);
    const voices = findTargetVoices(this, noteId);
    for (let i = 0; i < voices.length; i++) {
      scheduleImmediateAttack(this, voices[i]);
    }
    try {
      this.tick();
    } catch {}
    return result;
  };

  Synth.prototype.noteOff = function patchedNoteOff(noteId = null) {
    optimizeInstanceForMobile(this);
    ensureRealtimeLoop(this);
    const voices = noteId === null || noteId === undefined
      ? this.voices.filter((voice) => voice.isActive)
      : findTargetVoices(this, noteId);
    for (let i = 0; i < voices.length; i++) {
      scheduleImmediateRelease(this, voices[i]);
    }
    const result = originalNoteOff.call(this, noteId);
    try {
      this.tick();
    } catch {}
    return result;
  };

  Synth.prototype.updateNoteExpression = function patchedUpdateNoteExpression(noteId, updates = {}) {
    const result = originalUpdateNoteExpression.call(this, noteId, updates);
    const voices = findTargetVoices(this, noteId);
    for (let i = 0; i < voices.length; i++) {
      const voice = voices[i];
      const now = this.ctx.currentTime;
      const envValue = Math.max(0, Math.min(1, voice.env?.value ?? 0));
      const velocityGain = getVelocityGain(this, voice.expression?.velocity ?? 1);
      voice.amp.gain.cancelScheduledValues(now);
      voice.amp.gain.setValueAtTime(envValue * velocityGain, now);
    }
    return result;
  };
}
