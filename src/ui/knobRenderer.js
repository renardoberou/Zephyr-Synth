export class KnobRenderer {

  constructor(bgCanvas, fgCanvas){
    this.bg = bgCanvas.getContext("2d");
    this.fg = fgCanvas.getContext("2d");

    this.w = bgCanvas.width = 120;
    this.h = bgCanvas.height = 120;

    this.cx = this.w/2;
    this.cy = this.h/2;
    this.r = 40;

    this.drawStatic();
  }

  drawStatic(){
    const ctx = this.bg;

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 6;

    ctx.beginPath();
    ctx.arc(this.cx,this.cy,this.r,Math.PI*0.75,Math.PI*2.25);
    ctx.stroke();
  }

  draw(value){

    const ctx = this.fg;
    ctx.clearRect(0,0,this.w,this.h);

    const start = Math.PI*0.75;
    const angle = start + value * Math.PI*1.5;

    ctx.strokeStyle = "#FF6600";
    ctx.lineWidth = 6;

    ctx.beginPath();
    ctx.arc(this.cx,this.cy,this.r,start,angle);
    ctx.stroke();
  }
}
