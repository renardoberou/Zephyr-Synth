import { MPE } from "./mpe.js";

export class Synth {

  constructor(ctx){
    this.ctx = ctx;
    this.params = new Map();
    this.mpe = new MPE(this);
  }

  async init(){

    await this.ctx.audioWorklet.addModule("./src/worklets/vcoProcessor.js");

    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);

    this.osc = new AudioWorkletNode(this.ctx, "vco");

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0.2;

    this.osc.connect(this.gain).connect(this.master);

    this.defineParams();

    this.initMIDI();
  }

  defineParams(){

    this.params.set("volume", v => {
      this.gain.gain.setValueAtTime(v, this.ctx.currentTime);
    });
  }

  setParam(key, norm){
    const p = this.params.get(key);
    if(p) p(norm);
  }

  initMIDI(){
    navigator.requestMIDIAccess().then(access=>{
      access.inputs.forEach(input=>{
        input.onmidimessage = e => this.mpe.handleMIDI(e);
      });
    });
  }
}
