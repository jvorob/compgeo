import { WrappedCanvas } from "./lib";
import { vec2 } from "gl-matrix";
import { v2ToString } from "./util";
import { DCEL, Vertex, HalfEdge, Face } from "./dcel";
import { left, pointRelToVector, orientPseudoAngle, orientPseudoAngle_unrolled } from "./primitives";


let globalCanvas: WrappedCanvas;

export function main (canvas: WrappedCanvas){
  console.log("Loaded Voronoi");

  globalCanvas = canvas;

  let tester = new VoronoiTester(canvas);
  tester.draw();
}


class VoronoiTester {
  private readonly VERT_RADIUS=5; //pixels

  private textbox: HTMLElement;

  private dcel: DCEL;
  constructor(private canvas: WrappedCanvas) {
    this.textbox = document.getElementById("textbox");


    this.dcel = new DCEL();
    this.dcel.initializeBox();

    this.dcel.insertEdge(this.dcel.verts[0], this.dcel.verts[2]);


    this.canvas.canvas.addEventListener("mousemove", e=>this.handleMouseMove(e));
  }

  drawVert(vert: Vertex, style="black")  //radius 5 pixels
  { this.canvas.putPoint(vert.v, this.VERT_RADIUS, style); }

  drawHalfEdge(edge:HalfEdge, style="black") {
    const v1 = edge.origin.v;
    const v2 = edge.next.origin.v;
    this.canvas.putLine(v1,v2, style);


    if(true) { // ======== ADD AN ARROW 
      //halfedges go clockwise around an edge
      //therefore arrow is on the left side

      const radius = 0.05 //half the length of the arrow
      const barb_size = radius * 0.3 //how long the barb is along the arrow
      const offset = radius * 0.1 //how far the arrow is from the edge
      //                |rad |              |
      //   ----------------------------     |
      //                          offset    |
      //            ---------   -           |
      //                   /    - barbsize  |

      const v_arrow_base = pointRelToVector(v1,v2, 0.5 - radius, offset);
      const v_arrow_tip  = pointRelToVector(v1,v2, 0.5 + radius, offset);
      const v_arrow_barb = pointRelToVector(v1,v2, 0.5 + radius - barb_size * 2, offset+barb_size);


      this.canvas.putLine(v_arrow_base,v_arrow_tip, style);
      this.canvas.putLine(v_arrow_tip,v_arrow_barb, style);
    }
  }


  drawFeature(elem: Vertex|HalfEdge|Face, style="black") {
    //delegates to the appropriate method
    if(elem == null) 
      {return}
    else if(elem instanceof Vertex)
      { this.drawVert(elem,style); }
    else if(elem instanceof HalfEdge)
      { this.drawHalfEdge(elem,style); }
    else { throw Error("drawFeature not implemented for" + elem); }
  }

  debugDrawFeature(elem: Vertex|HalfEdge|Face, style="black") {
    //delegates to the appropriate method
    if(elem == null) 
      {return}
    else if(elem instanceof Vertex)
      { this.debugDrawVert(elem); }
    else if(elem instanceof HalfEdge)
      { this.debugDrawHalfEdge(elem); }
    else { throw Error("debugDrawFeature not implemented for" + elem); }
  }

  debugDrawVert(vert: Vertex) {
    this.drawVert(vert, "red");
    if(vert.someEdgeAway) { 
      this.drawHalfEdge(vert.someEdgeAway, "gold");
    }
  }

  debugDrawHalfEdge(edge: HalfEdge) {
    this.drawVert(edge.origin, "red");
    this.drawHalfEdge(edge.twin, "gold");

    this.drawHalfEdge(edge.prev, "orangered");
    this.drawHalfEdge(edge, "red");
    this.drawHalfEdge(edge.next, "darkmagenta");

  }

  draw() {

    this.canvas.drawAxes();

    this.dcel.verts.forEach(vert => this.drawVert(vert));

    //add a little arrow, size relative to edge length?
    this.dcel.edges.forEach(edge => this.drawHalfEdge(edge));
  }





  // =========== UI STUFF

  handleMouseMove(e: any) {
    const rect = this.canvas.canvas.getBoundingClientRect();
    const s_x = e.clientX - rect.left;
    const s_y = e.clientY - rect.top;


    const pt = this.canvas.screen2world(vec2.fromValues(s_x,s_y));
    //console.log(v2ToString(pt));

    const feat = this.dcel.getFeatureAtPoint(pt, 0.05);
    this.textbox.textContent = (feat&&feat.toString());


    this.canvas.clear();
    this.draw();
    this.debugDrawFeature(feat);
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
