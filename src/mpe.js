export class MPE {

  constructor(synth){
    this.synth = synth;
  }

  handleMIDI(e){
    console.log("MIDI:", e.data);
  }
}
