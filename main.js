import { Synth } from "./src/synth.js";
import { UIEngine } from "./src/ui/uiEngine.js";
import { KnobRenderer } from "./src/ui/knobRenderer.js";

const ctx = new AudioContext();
const synth = new Synth(ctx);
const ui = new UIEngine();

await synth.init();

const startButton = document.getElementById("start");
startButton.addEventListener("click", async () => {
  if (ctx.state !== "running") {
    await ctx.resume();
  }
  startButton.classList.add("active");
  startButton.textContent = "Audio Running";
});

document.querySelectorAll(".knob").forEach((el) => {
  const bg = el.querySelector(".bg");
  const fg = el.querySelector(".fg");
  const renderer = new KnobRenderer(bg, fg);
  const paramKey = el.dataset.param;

  ui.register(paramKey, renderer);

  let value = 0.2;
  let lastY = null;

  ui.update(paramKey, { value, morph: 0, mod: null });
  synth.setParam(paramKey, value);

  el.addEventListener("pointerdown", (e) => {
    lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener("pointermove", (e) => {
    if (lastY === null) return;

    const dy = lastY - e.clientY;
    lastY = e.clientY;

    value += dy * 0.005;
    value = Math.max(0, Math.min(1, value));

    synth.setParam(paramKey, value);
    ui.update(paramKey, { value, morph: 0, mod: null });
  });

  const endDrag = (e) => {
    lastY = null;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", () => {
    lastY = null;
  });
});

function loop() {
  ui.frame();
  requestAnimationFrame(loop);
}

loop();
