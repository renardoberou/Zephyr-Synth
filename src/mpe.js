export class MPE {
  /**
   * @param {Synth} synth
   */
  constructor(synth) {
    this.synth = synth;
    this.channels = new Map();
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
      });
    }
    return this.channels.get(channel);
  }

  pushExpressionUpdate(channel, updates) {
    const state = this.ensureChannelState(channel);
    Object.assign(state, updates);
    if (state.noteId) {
      this.synth.updateNoteExpression(state.noteId, updates);
    }
  }

  handleNoteOff(channel, noteNumber) {
    const state = this.ensureChannelState(channel);
    const noteId = state.noteId ?? `midi-${channel}-${noteNumber}`;
    this.synth.noteOff(noteId);

    if (state.noteNumber === noteNumber) {
      state.noteId = null;
      state.noteNumber = null;
      state.baseFreq = 440;
      state.velocity = 1;
      state.pressure = 0;
      state.timbre = 0;
    }
  }

  /**
   * @param {MIDIMessageEvent} e
   */
  handleMIDI(e) {
    const [status = 0, data1 = 0, data2 = 0] = e.data;
    const type = status & 0xf0;
    const channel = status & 0x0f;

    if (type === 0x90 && data2 > 0) {
      const state = this.ensureChannelState(channel);
      if (state.noteId && state.noteNumber !== data1) {
        this.synth.noteOff(state.noteId);
      }

      const noteId = `midi-${channel}-${data1}`;
      const freq = 440 * Math.pow(2, (data1 - 69) / 12);
      const velocity = data2 / 127;

      state.noteId = noteId;
      state.noteNumber = data1;
      state.baseFreq = freq;
      state.velocity = velocity;

      this.synth.noteOn(freq, noteId, {
        channel,
        velocity,
        pressure: state.pressure,
        timbre: state.timbre,
        bend: state.bend,
      });
      return;
    }

    if (type === 0x80 || (type === 0x90 && data2 === 0)) {
      this.handleNoteOff(channel, data1);
      return;
    }

    if (type === 0xa0) {
      const state = this.ensureChannelState(channel);
      if (state.noteNumber === data1) {
        this.pushExpressionUpdate(channel, { pressure: data2 / 127 });
      }
      return;
    }

    if (type === 0xd0) {
      this.pushExpressionUpdate(channel, { pressure: data1 / 127 });
      return;
    }

    if (type === 0xb0 && data1 === 74) {
      this.pushExpressionUpdate(channel, { timbre: data2 / 127 });
      return;
    }

    if (type === 0xe0) {
      const value14 = data1 | (data2 << 7);
      const bend = Math.max(-1, Math.min(1, (value14 - 8192) / 8192));
      this.pushExpressionUpdate(channel, { bend });
    }
  }
}
