class VCOProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "frequency",
        defaultValue: 220,
        minValue: 20,
        maxValue: 2000,
        automationRate: "a-rate",
      },
    ];
  }

  constructor() {
    super();
    this.phase = 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const channel = output[0];
    const frequency = parameters.frequency;

    for (let i = 0; i < channel.length; i++) {
      const f = frequency.length > 1 ? frequency[i] : frequency[0];

      this.phase += f / sampleRate;
      if (this.phase >= 1) this.phase -= 1;

      channel[i] = Math.sin(this.phase * Math.PI * 2);
    }

    return true;
  }
}

registerProcessor("vco", VCOProcessor);
