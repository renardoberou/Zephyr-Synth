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
      });
    }
    return this.channels.get(channel);
  }

  getActiveNoteIds(state, noteNumber = null) {
    if (noteNumber === null || noteNumber === undefined) {
      return Array.from(state.activeNotes.keys());
    }
    return [...(state.noteStacks.get(noteNumber) ?? [])];
  }

  pushChannelExpressionUpdate(channel, updates) {
    const state = this.ensureChannelState(channel);
    Object.assign(state, updates);
    this.getActiveNoteIds(state).forEach((noteId) => {
      this.synth.updateNoteExpression(noteId, updates);
    });
  }

  pushNoteExpressionUpdate(channel, noteNumber, updates) {
    const state = this.ensureChannelState(channel);
    this.getActiveNoteIds(state, noteNumber).forEach((noteId) => {
      this.synth.updateNoteExpression(noteId, updates);
    });
  }

  refreshPrimaryNoteState(state) {
    const last = Array.from(state.activeNotes.entries()).at(-1) ?? null;
    if (!last) {
      state.noteId = null;
      state.noteNumber = null;
      state.baseFreq = 440;
      state.velocity = 1;
      return;
    }
    const [noteId, meta] = last;
    state.noteId = noteId;
    state.noteNumber = meta.noteNumber;
    state.baseFreq = meta.baseFreq;
    state.velocity = meta.velocity;
  }

  handleNoteOn(channel, noteNumber, velocityByte) {
    const state = this.ensureChannelState(channel);
    const freq = 440 * Math.pow(2, (noteNumber - 69) / 12);
    const velocity = velocityByte / 127;
    const noteId = `midi-${channel}-${noteNumber}-${++this.noteSerial}`;

    if (!state.noteStacks.has(noteNumber)) state.noteStacks.set(noteNumber, []);
    state.noteStacks.get(noteNumber).push(noteId);
    state.activeNotes.set(noteId, { noteNumber, baseFreq: freq, velocity });
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
  }

  handleNoteOff(channel, noteNumber) {
    const state = this.ensureChannelState(channel);
    const stack = state.noteStacks.get(noteNumber);
    const noteId = stack?.pop() ?? null;
    if (!noteId) return;

    this.synth.noteOff(noteId);
    state.activeNotes.delete(noteId);

    if (stack.length === 0) state.noteStacks.delete(noteNumber);
    this.refreshPrimaryNoteState(state);
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
