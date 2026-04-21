import { Synth } from "./src/synth.js";
import { UIEngine } from "./src/ui/uiEngine.js";
import { KnobRenderer } from "./src/ui/knobRenderer.js";

const ctx = new AudioContext();

const synth = new Synth(ctx);
await synth.init();

document.getElementById("start").onclick = () => ctx.resume();

const ui = new UIEngine();

document.querySelectorAll(".knob").forEach(el => {
  const bg = el.querySelector(".bg");
  const fg = el.querySelector(".fg");

  const renderer = new KnobRenderer(bg, fg);
  const param = el.dataset.param;

  ui.register(param, renderer);

  let value = 0.5;

  el.addEventListener("pointermove", e => {
    if (!e.buttons) return;

    value += (e.movementY * -0.005);
    value = Math.max(0, Math.min(1, value));

    synth.setParam(param, value);

    ui.update(param, {
      value,
      morph: 0,
      mod: 0
    });
  });
});

function loop(){
  ui.frame();
  requestAnimationFrame(loop);
}
loop();
