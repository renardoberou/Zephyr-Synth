export class UIEngine {

  constructor(){
    this.knobs = new Map();
    this.needsRender = false;
  }

  register(param, renderer){
    this.knobs.set(param, {
      renderer,
      value: 0
    });
  }

  update(param, data){
    const k = this.knobs.get(param);
    if(!k) return;

    k.value = data.value;
    this.needsRender = true;
  }

  frame(){
    if(!this.needsRender) return;

    this.knobs.forEach(k=>{
      k.renderer.draw(k.value);
    });

    this.needsRender = false;
  }
}
