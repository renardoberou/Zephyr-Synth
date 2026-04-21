export class UIEngine {
  constructor() {
    this.knobs = new Map();
    this.needsRender = false;
  }

  /**
   * @param {string} param
   * @param {any} renderer
   */
  register(param, renderer) {
    this.knobs.set(param, {
      renderer,
      value: 0,
      morph: 0,
      mod: null,
    });
  }

  /**
   * @param {string} param
   * @param {{ value: number, morph: number, mod: number | null }} data
   */
  update(param, data) {
    const knob = this.knobs.get(param);
    if (!knob) return;

    knob.value = data.value;
    knob.morph = data.morph;
    knob.mod = data.mod;
    this.needsRender = true;
  }

  frame() {
    if (!this.needsRender) return;

    this.knobs.forEach((knob) => {
      knob.renderer.draw(knob.value, knob.morph, knob.mod);
    });

    this.needsRender = false;
  }
}
