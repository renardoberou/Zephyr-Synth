export class MPE {
  /**
   * @param {unknown} synth
   */
  constructor(synth) {
    this.synth = synth;
  }

  /**
   * @param {MIDIMessageEvent} e
   */
  handleMIDI(e) {
    console.log("MIDI:", e.data);
  }
}
