class VCO extends AudioWorkletProcessor {

  static get parameterDescriptors(){
    return [{ name:"frequency", defaultValue:220 }];
  }

  constructor(){
    super();
    this.phase = 0;
  }

  process(inputs, outputs, params){

    const out = outputs[0][0];
    const freq = params.frequency;

    for(let i=0;i<out.length;i++){

      const f = freq.length > 1 ? freq[i] : freq[0];

      this.phase += f / sampleRate;
      if(this.phase > 1) this.phase -= 1;

      out[i] = Math.sin(this.phase * Math.PI * 2);
    }

    return true;
  }
}

registerProcessor("vco", VCO);
