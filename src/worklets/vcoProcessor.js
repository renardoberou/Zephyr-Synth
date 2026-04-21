class VCOProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "frequency",
        defaultValue: 220,
        minValue: 20,
        maxValue: 4000,
        automationRate: "a-rate",
      },
      {
        name: "detune",
        defaultValue: 0,
        minValue: -1200,
        maxValue: 1200,
        automationRate: "a-rate",
      },
      {
        name: "wave",
        defaultValue: 1,
        minValue: 0,
        maxValue: 3,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();
    this.phase = Math.random();
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const channel = output[0];
    const frequency = parameters.frequency;
    const detune = parameters.detune;
    const wave = parameters.wave;

    for (let i = 0; i < channel.length; i++) {
      const baseFreq = frequency.length > 1 ? frequency[i] : frequency[0];
      const cents = detune.length > 1 ? detune[i] : detune[0];
      const waveIndex = wave[0];

      const freqWithDetune = baseFreq * Math.pow(2, cents / 1200);

      this.phase += freqWithDetune / sampleRate;
      if (this.phase >= 1) this.phase -= 1;

      let sample = 0;
      if (waveIndex < 0.5) {
        sample = Math.sin(this.phase * Math.PI * 2);
      } else if (waveIndex < 1.5) {
        sample = 2 * this.phase - 1;
      } else if (waveIndex < 2.5) {
        sample = this.phase < 0.5 ? 1 : -1;
      } else {
        sample = 1 - 4 * Math.abs(this.phase - 0.5);
      }

      channel[i] = sample * 0.18;
    }

    return true;
  }
}

registerProcessor("vco", VCOProcessor);
