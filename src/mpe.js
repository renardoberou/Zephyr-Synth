export class MPE {
  /**
   * @param {Synth} synth
   */
  constructor(synth) {
    this.synth = synth;
    this.channels = new Map();
    this.noteSerial = 0;
  }

  ensureChannelState(channel) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, {
        noteId: null,
        noteNumber: null,
        baseFreq: 440,
        velocity: 1,
        pressure: 0,
        timbre: 0,
        bend: 0,
        activeNotes: new Map(),
        noteStacks: new Map(),
        noteOrder: [],
      });
    }
    return this.channels.get(channel);
  }

  getActiveNoteIds(state, noteNumber = null) {
    if (noteNumber === null || noteNumber === undefined) {
      return state.noteOrder.slice();
    }
    const stack = state.noteStacks.get(noteNumber);
    return stack ? stack.slice() : [];
  }

  pushChannelExpressionUpdate(channel, updates) {
    const state = this.ensureChannelState(channel);
    Object.assign(state, updates);
    const noteIds = this.getActiveNoteIds(state);
    for (let i = 0; i < noteIds.length; i++) {
      this.synth.updateNoteExpression(noteIds[i], updates);
    }
    this.flushImmediate();
  }

  pushNoteExpressionUpdate(channel, noteNumber, updates) {
    const state = this.ensureChannelState(channel);
    const noteIds = this.getActiveNoteIds(state, noteNumber);
    for (let i = 0; i < noteIds.length; i++) {
      this.synth.updateNoteExpression(noteIds[i], updates);
    }
    this.flushImmediate();
  }

  refreshPrimaryNoteState(state) {
    if (!state.noteOrder.length) {
      state.noteId = null;
      state.noteNumber = null;
      state.baseFreq = 440;
      state.velocity = 1;
      return;
    }

    const noteId = state.noteOrder[state.noteOrder.length - 1];
    const meta = state.activeNotes.get(noteId);
    if (!meta) {
      state.noteId = null;
      state.noteNumber = null;
      state.baseFreq = 440;
      state.velocity = 1;
      return;
    }

    state.noteId = noteId;
    state.noteNumber = meta.noteNumber;
    state.baseFreq = meta.baseFreq;
    state.velocity = meta.velocity;
  }

  trackNoteStart(state, noteId, noteNumber, baseFreq, velocity) {
    if (!state.noteStacks.has(noteNumber)) state.noteStacks.set(noteNumber, []);
    state.noteStacks.get(noteNumber).push(noteId);
    state.activeNotes.set(noteId, { noteNumber, baseFreq, velocity });
    state.noteOrder.push(noteId);
  }

  trackNoteEnd(state, noteId, noteNumber) {
    state.activeNotes.delete(noteId);

    const stack = state.noteStacks.get(noteNumber);
    if (stack) {
      const stackIndex = stack.lastIndexOf(noteId);
      if (stackIndex >= 0) stack.splice(stackIndex, 1);
      if (!stack.length) state.noteStacks.delete(noteNumber);
    }

    const orderIndex = state.noteOrder.lastIndexOf(noteId);
    if (orderIndex >= 0) state.noteOrder.splice(orderIndex, 1);
  }

  ensureRunning() {
    const ctx = this.synth?.ctx;
    if (!ctx || ctx.state === "running") return;
    ctx.resume().catch(() => {});
  }

  flushImmediate() {
    try {
      this.synth.tick();
    } catch {
      // ignore immediate flush errors here; main frame loop still runs
    }
  }

  handleNoteOn(channel, noteNumber, velocityByte) {
    this.ensureRunning();
    const state = this.ensureChannelState(channel);
    const freq = 440 * Math.pow(2, (noteNumber - 69) / 12);
    const velocity = velocityByte / 127;
    const noteId = `midi-${channel}-${noteNumber}-${++this.noteSerial}`;

    this.trackNoteStart(state, noteId, noteNumber, freq, velocity);
    state.noteId = noteId;
    state.noteNumber = noteNumber;
    state.baseFreq = freq;
    state.velocity = velocity;

    this.synth.noteOn(freq, noteId, {
      channel,
      velocity,
      pressure: state.pressure,
      timbre: state.timbre,
      bend: state.bend,
    });
    this.flushImmediate();
  }

  handleNoteOff(channel, noteNumber) {
    const state = this.ensureChannelState(channel);
    const stack = state.noteStacks.get(noteNumber);
    const noteId = stack && stack.length ? stack[stack.length - 1] : null;
    if (!noteId) return;

    this.trackNoteEnd(state, noteId, noteNumber);
    this.synth.noteOff(noteId);
    this.refreshPrimaryNoteState(state);
    this.flushImmediate();
  }

  /**
   * @param {MIDIMessageEvent} e
   */
  handleMIDI(e) {
    const [status = 0, data1 = 0, data2 = 0] = e.data;
    const type = status & 0xf0;
    const channel = status & 0x0f;

    if (type === 0x90 && data2 > 0) {
      this.handleNoteOn(channel, data1, data2);
      return;
    }

    if (type === 0x80 || (type === 0x90 && data2 === 0)) {
      this.handleNoteOff(channel, data1);
      return;
    }

    if (type === 0xa0) {
      this.pushNoteExpressionUpdate(channel, data1, { pressure: data2 / 127 });
      return;
    }

    if (type === 0xd0) {
      this.pushChannelExpressionUpdate(channel, { pressure: data1 / 127 });
      return;
    }

    if (type === 0xb0 && data1 === 74) {
      this.pushChannelExpressionUpdate(channel, { timbre: data2 / 127 });
      return;
    }

    if (type === 0xe0) {
      const value14 = data1 | (data2 << 7);
      const bend = Math.max(-1, Math.min(1, (value14 - 8192) / 8192));
      this.pushChannelExpressionUpdate(channel, { bend });
    }
  }
}
