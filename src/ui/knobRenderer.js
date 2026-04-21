export class KnobRenderer {
  /**
   * @param {HTMLCanvasElement} bgCanvas
   * @param {HTMLCanvasElement} fgCanvas
   */
  constructor(bgCanvas, fgCanvas) {
    this.bgCanvas = bgCanvas;
    this.fgCanvas = fgCanvas;
    this.bg = bgCanvas.getContext("2d");
    this.fg = fgCanvas.getContext("2d");

    this.w = bgCanvas.width;
    this.h = bgCanvas.height;
    this.cx = this.w / 2;
    this.cy = this.h / 2;
    this.r = 42;

    this.last = {
      value: -1,
      morph: -1,
      mod: null,
    };

    this.drawStatic();
  }

  drawStatic() {
    const ctx = this.bg;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.w, this.h);

    ctx.beginPath();
    ctx.strokeStyle = "#2f2f2f";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.arc(this.cx, this.cy, this.r, Math.PI * 0.75, Math.PI * 2.25);
    ctx.stroke();
  }

  /**
   * @param {number} value
   * @param {number} morphDelta
   * @param {number | null} modValue
   */
  draw(value, morphDelta = 0, modValue = null) {
    const ctx = this.fg;
    if (!ctx) return;

    if (
      Math.abs(value - this.last.value) < 0.001 &&
      Math.abs(morphDelta - this.last.morph) < 0.001 &&
      modValue === this.last.mod
    ) {
      return;
    }

    this.last.value = value;
    this.last.morph = morphDelta;
    this.last.mod = modValue;

    ctx.clearRect(0, 0, this.w, this.h);

    const start = Math.PI * 0.75;
    const span = Math.PI * 1.5;
    const angle = start + span * value;

    ctx.beginPath();
    ctx.strokeStyle = "#ff6600";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.arc(this.cx, this.cy, this.r, start, angle);
    ctx.stroke();

    const px = this.cx + Math.cos(angle) * this.r;
    const py = this.cy + Math.sin(angle) * this.r;

    ctx.beginPath();
    ctx.fillStyle = "#ffffff";
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
