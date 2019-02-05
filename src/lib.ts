import { vec2 } from "gl-matrix";


//generates a random point in the unit square
function genRandomPoint() {
  return vec2.fromValues(Math.random(),Math.random());
}

type Context = CanvasRenderingContext2D;
export class MyCanvas {
  /* Wrapper around canvas
   * Handles worldspace and screenspace coordinates separately
   *
   * Main thing is: locations are specified in worldspace coords, and scaled
   * to fit properly on the canvas. Line widths and symbol sizes are specified in pixels
   *
   *
   */
  private ctx: CanvasRenderingContext2D;

  // Fits a square from -fieldSize to fieldSize inside the canvas
  public fieldSize: number = 1.1;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");

    this.putRect(vec2.fromValues(-1,-1), vec2.fromValues(1,1));
  }

  getCanvasSize() {
    return vec2.fromValues(this.canvas.width, this.canvas.height);
  }

  // Returns the scaling conversion from world coords to screen coords
  // scale up so that world:fieldSize = screen:canvas.width
  // e.g.: fieldSize=2, canvasSize=100
  // w:0 -> 0, w:2 -> 50, w:-2 -> -50
  getScaleFactor() { 
    // to preserve aspect ratio, use the smaller of the two dimensions
    let minDim = Math.min(this.canvas.width, this.canvas.height);
    //if canvas is big and width is small, we want to zoom in;
    return minDim / this.fieldSize / 2; 
  }

  //Takes point in worldspace coords, shifts to screenspace so it's centered and scaled
  world2screen(p: vec2) {
    let canvasSize = this.getCanvasSize();
    let canvasCenter = vec2.create();
    vec2.scale(canvasCenter, canvasSize, 0.5);

    //First scale up
    let v = vec2.create();
    vec2.scale(v, p, this.getScaleFactor());
    
    //Then translate to canvas center
    vec2.add(v, v, canvasCenter);
    return v;
  }

  // =======================================================
  // Public graphics interface (WORLDSPACE)
  // =======================================================

  //point in worldspace, rad in pixels
  putPoint(p: vec2, radius=2) {
    let v = this.world2screen(p);
    this.fillCircle(v, radius);
  }

  putLine(p1: vec2, p2: vec2) {
    let v1 = this.world2screen(p1);
    let v2 = this.world2screen(p2);
    this.strokeLine(v1, v2);
  }
  
  // strokes a rectangle with corners at p1 and p2
  putRect(p1: vec2, p2: vec2){
    let v1 = this.world2screen(p1);
    let v2 = this.world2screen(p2);

    let l = Math.min(v1[0], v2[0]);
    let r = Math.max(v1[0], v2[0]);
    let t = Math.min(v1[1], v2[1]);
    let b = Math.max(v1[1], v2[1]);

    let w = r-l;
    let h = b-t;

    this.ctx.strokeRect(l, t, w, h);
  }


  // =======================================================
  // Graphics primitives (circles, lines)  (SCREENSPACE)
  // =======================================================
  
  private fillCircle(p: vec2, radius: number) {
    this.ctx.beginPath();
    this.ctx.ellipse(p[0], p[1], radius, radius, 0, 0, 2 * 3.14159265);
    this.ctx.fill();
  }

  private strokeLine(v1: vec2, v2: vec2) {
    this.ctx.beginPath();
    this.ctx.moveTo(v1[0], v1[1]);
    this.ctx.lineTo(v2[0], v2[1]);
    this.ctx.stroke();
  }

}





// moves the point x,y into the center of the screen
function centerOn(ctx: Context, x: number, y: number) {
  ctx.translate(ctx.canvas.width / 2 - x, ctx.canvas.height / 2 - y);
}


export function testFun(htmlid: string) {
  let el: HTMLCanvasElement = document.getElementById(htmlid) as HTMLCanvasElement;
  let canv = new MyCanvas(el);

  //put the origin in the center
  //centerOn(context, 0, 0);


  //scale so unit circle takes up the screen
  //scaleSize(context, 2.2, 2.2);

  //rect
  //context.lineWidth = 0.01;
  //context.strokeRect(-1, -1, 2, 2);

  for(let i = 0; i < 15; i++ ) {
    canv.putPoint(genRandomPoint());
  }
  for(let i = 0; i < 10; i++ ) {
    //canv.putLine(genRandomPoint(), genRandomPoint());
  }
}
