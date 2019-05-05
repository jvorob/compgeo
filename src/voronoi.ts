import { WrappedCanvas } from "./lib";
import { vec2 } from "gl-matrix";
import { left, orientPseudoAngle, orientPseudoAngle_unrolled } from "./primitives";


let globalCanvas: WrappedCanvas;

export function main (canvas: WrappedCanvas){
    console.log("Loaded Voronoi");

    globalCanvas = canvas;
}


