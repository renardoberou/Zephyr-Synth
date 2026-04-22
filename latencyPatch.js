import { Synth } from "./src/synth.js?v=14";

const LATENCY_LOOP_MS = 4;
const MOBILE_MAX_VOICES = 4;

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
  const frameBudgetMs = 1000 / 30;
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

function optimizeInstanceForMobile(synth) {
  if (!isMobileLikeDevice() || synth.__zephyrMobileOptimized) return;
  synth.__zephyrMobileOptimized = true;

  installRafThrottle();

  synth.voices.forEach((voice) => {
    if (voice.driveShaper) voice.driveShaper.oversample = "none";
  });
  if (synth.masterSaturator) synth.masterSaturator.oversample = "none";
  if (synth.delaySaturator) synth.delaySaturator.oversample = "none";

  if (synth.baseValues.activeVoiceCount > MOBILE_MAX_VOICES) {
    synth.baseValues.activeVoiceCount = MOBILE_MAX_VOICES;
    const voiceSlider = document.getElementById("voice-count");
    const voiceReadout = document.getElementById("voice-count-readout");
    if (voiceSlider) voiceSlider.value = String(MOBILE_MAX_VOICES);
    if (voiceReadout) voiceReadout.textContent = String(MOBILE_MAX_VOICES);
  }

  synth.baseValues.fxSend = 0;
  if (synth.fxSendGain) synth.fxSendGain.gain.setValueAtTime(0, synth.ctx.currentTime);
  const fxSendSlider = document.getElementById("fx-send");
  const fxSendReadout = document.getElementById("fx-send-readout");
  if (fxSendSlider) fxSendSlider.value = "0";
  if (fxSendReadout) fxSendReadout.textContent = "0.00";

  writeStatus("Audio running · mobile low-latency mode");
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
