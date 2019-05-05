import { WrappedCanvas } from "./lib";
import { vec2 } from "gl-matrix";
import { DCEL, Vertex, HalfEdge, Face } from "./dcel";
import { left, orientPseudoAngle, orientPseudoAngle_unrolled } from "./primitives";


let globalCanvas: WrappedCanvas;

export function main (canvas: WrappedCanvas){
    console.log("Loaded Voronoi");

    globalCanvas = canvas;

    let tester = new VoronoiTester(canvas);
    tester.draw();
}


class VoronoiTester {
  private dcel: DCEL;
  constructor(private canvas: WrappedCanvas) {
    this.dcel = new DCEL();
    this.dcel.initializeBox();


  }

  draw() {
    this.dcel.verts.forEach(vert => {
      this.canvas.putPoint(vert.v);
    });

    this.dcel.edges.forEach(edge => {
      this.canvas.putLine(edge.origin.v, edge.next.origin.v);
    });
  }
}


/* 
Render: 
-Draw all points
-Draw all edges
-Draw all face-centers

-Check where the mouse is.
-- If on a vertex, do some shit (highlight vertex, highlight edge)
-- If on an edge, decide which half-edge it's touching (highlight edge, twin, next, prev)
-- Else check which face it's in, show debug info (outeredge, site)

 */
