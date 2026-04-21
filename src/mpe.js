export class MPE {
  /**
   * @param {Synth} synth
   */
  constructor(synth) {
    this.synth = synth;
  }

  /**
   * @param {MIDIMessageEvent} e
   */
  handleMIDI(e) {
    const [status, data1, data2] = e.data;
    const type = status & 0xf0;

    if (type === 0x90 && data2 > 0) {
      const freq = 440 * Math.pow(2, (data1 - 69) / 12);
      this.synth.noteOn(freq);
    }

    if (type === 0x80 || (type === 0x90 && data2 === 0)) {
      this.synth.noteOff();
    }
  }
}
