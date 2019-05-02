import { beep } from "./test";
import { WrappedCanvas } from "./lib";
import { vec2 } from "gl-matrix";
import * as ConvexHull from "./convex-hull";
import * as Voronoi from "./voronoi";

console.log("Loaded bundle");
let modules: { [key:string]: Function; } = Object.create(null);
modules["convex-hull"]= ConvexHull.main;
modules["voronoi"] = Voronoi.main;


const htmlid = "canvas"; //ID to look for to get canvas element from

export function init(module_key: string) {
  let el: HTMLCanvasElement = document.getElementById(htmlid) as HTMLCanvasElement;
  let canvas= new WrappedCanvas(el);

  if(! (module_key in modules)) {
    console.log(`Error: unknown module "${module_key}"`);
    console.log(`Available modules are: ${Object.keys(modules)}`);
  } else {
    modules[module_key](canvas);
  }
}

(window as any).init = init;


