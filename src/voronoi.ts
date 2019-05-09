import { WrappedCanvas } from "./lib";
import { vec2 } from "gl-matrix";
import { v2ToString } from "./util";
import { Integrity, edgeWalkForEach,  IntersectType, lineIntersectWalk, DCEL, Vertex, HalfEdge, Face } from "./dcel";
import * as DCEL_module from "./dcel";
import { left, pointRelToVector,orientPseudoAngle, orientPseudoAngle_unrolled } from "./primitives";


let globalCanvas: WrappedCanvas;

export function main (canvas: WrappedCanvas){
  console.log("Loaded Voronoi");

  globalCanvas = canvas;

  let tester = new VoronoiTester(canvas);
  tester.draw();
}


class VoronoiTester {
  private readonly VERT_RADIUS=5; //pixels
  private readonly MOUSE_RADIUS=0.05; //world

  private textbox: HTMLElement;
  private lastMousePos: vec2 = vec2.create();;
  private highlightedFeature: Vertex | HalfEdge | Face | null = null;

  private dcel: DCEL;
  constructor(private canvas: WrappedCanvas) {
    this.textbox = (document.getElementById("textbox") as any);


    this.dcel = new DCEL();
    //for debugging
    (window as any).dcel = this.dcel;
    (window as any).integ = Integrity;
    (window as any).dcel_module = DCEL_module;
    (window as any).vor = this;
    this.dcel.initializeBox();


    console.log(this.dcel.toString());


    this.canvas.canvas.addEventListener("mousemove", e=>this.handleMouseMove(e));
    this.canvas.canvas.addEventListener("mousedown", e=>this.handleMouseClick(e));

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


  drawFace(face: Face, style="black") {
    //edgeWalkForEach(face.someEdge, e=>e.next, e=> {
    //  this.canvas.putLine(e.origin.v,e.next.origin.v,style);
    //});
    if(face.site != null) {this.canvas.putPoint(face.site,this.VERT_RADIUS, style);}
  }

  drawFeature(elem: Vertex|HalfEdge|Face|null, style="black") {
    //delegates to the appropriate method
    if(elem == null) 
    {return}
    else if(elem instanceof Vertex)
    { this.drawVert(elem,style); }
    else if(elem instanceof HalfEdge)
    { this.drawHalfEdge(elem,style); }
    else if(elem instanceof Face) 
    { this.drawFace(elem, style); }
    else { throw Error("drawFeature not implemented for" + elem); }
  }

  debugDrawFeature(elem: Vertex|HalfEdge|Face|null, style="black") {
    //delegates to the appropriate method
    if(elem == null) 
    {return}
    else if(elem instanceof Vertex)
    { this.debugDrawVert(elem); }
    else if(elem instanceof HalfEdge)
    { this.debugDrawHalfEdge(elem); }
    else if(elem instanceof Face) 
    { this.debugDrawFace(elem); }
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

  debugDrawFace(face: Face) {
    if(face.someEdge != null) { 
      edgeWalkForEach(face.someEdge, e=> e.next, e=> this.drawHalfEdge(e, "green"));
      this.drawHalfEdge(face.someEdge, "red");
    }
    if(face.site != null) { this.canvas.putPoint(face.site, this.VERT_RADIUS, "red"); }

  }

  draw() {
    this.canvas.clear();
    this.canvas.drawAxes();

    this.dcel.verts.forEach(vert => this.drawVert(vert));
    this.dcel.edges.forEach(edge => this.drawHalfEdge(edge));
    this.dcel.faces.forEach(face => this.drawFace(face));
    //dont draw faces


    this.debugDrawFeature(this.highlightedFeature);
  }

  update() {
    // Draw user interaction
    const feat = this.dcel.getFeatureNearPoint(this.lastMousePos, this.MOUSE_RADIUS);
    this.highlightedFeature = feat;
    this.textbox.textContent = (feat&&feat.toString());
  }





  // =========== UI STUFF
  eventToCoords(e: any) {
    const rect = this.canvas.canvas.getBoundingClientRect();
    const s_x = e.clientX - rect.left;
    const s_y = e.clientY - rect.top;
    return [s_x, s_y];
  }

  handleMouseMove(e: any) {
    const [s_x, s_y] = this.eventToCoords(e);
    const pt = this.canvas.screen2world(vec2.fromValues(s_x,s_y));
    this.lastMousePos.set(pt);

    //console.log(v2ToString(pt));
    this.update();
    this.draw();
  }

  handleMouseClick(e: any) {
    const [s_x, s_y] = this.eventToCoords(e);
    const pt = this.canvas.screen2world(vec2.fromValues(s_x,s_y));

    const feat = this.dcel.getFeatureNearPoint(pt, this.MOUSE_RADIUS);
    console.log("Clicked! : " + (feat && feat.toString()));

    try {
      if(feat instanceof Face) {
        this.doAddSite(feat, pt);
      }
      else if(feat instanceof HalfEdge) {
        this.doDeleteEdge(feat);
      }
    } catch (e) {console.error(e); }

    this.update();
    this.draw();
  }


  doDeleteEdge(edge: HalfEdge) {
    edge.deleteEdge(); //Deletes the edge from the side we clicked
    Integrity.verifyAll(this.dcel);
  }

  doAddSite(face: Face, pt: vec2) {
    if(face.site == null) { face.site = pt; return}

    console.log("Doing doAddSite");
    //make perpendicular bisector

    //should get perp bisector facing CCW around new site
    let p1 = pointRelToVector(pt, face.site, 0.5, -1); //right of center
    let p2 = pointRelToVector(pt, face.site, 0.5, 1); // left of center
    //p1 to p2 is CCW

    const new_edge = face.splitWithLine(p1,p2);
    if(new_edge == null) { throw Error("Failed to split with line");}

    //split returns edge pointing at midp
    if(new_edge.face.site != null) { throw Error("New face should have null site"); }

    const new_face = new_edge.face;
    new_face.site = pt;

    console.log("new edge: " + new_edge.toString());
    console.log("new face: " + new_face.toString());

    // We have one face, fix it up
    //new edge faces new site
    //this.doFixupEdges(new_face, new_edge);
    
  }



  doFixupEdges(targetFace: Face, curr_e:HalfEdge){
    //For the newly inserted face target
    //With the newly-inserted bisector e
    //Want to propagate bisector to next face
    //If hit at edge, 
    //const next_left  = curr_e.next.twin
    //const next_right = curr_e.twin.prev.twin

    //console.log("Fixing up at " + curr_e.toString());

    //if(next_left.face.isInf || next_right.face.isInf) {
    //  console.log("next is inf, done");
    //  return;
    //}

    ////if hit at vertex, go left
    ////if hit at edge, doesn't matter
    //const next_face = next_left.face;
    //const next_site = next_face.site
    //if(next_site == null) { console.log("null site"); return;}

    ////make perpendicular bisector
    //let v1 = pointRelToVector(targetFace.site, next_site, 0.5, 1);
    //let v2 = pointRelToVector(targetFace.site, next_site, 0.5, -1);

    //const intersections = lineIntersectWalk(next_face.someEdge, v1,v2);
    //const [e1, p1] = intersections[0];
    //const [e2, p2] = intersections[1];

    //let next_el, next_pt;
    //function check(elem: HalfEdge|Vertex, pt: vec2) {
    //  if(elem instanceof Vertex) { return false; }
    //  else {next_el = elem; next_pt = pt; return true;}
    //}

    //let count = 0;
    //if(check(e1,p1))  { count++;}
    //if(check(e2,p2))  { count++;}

    //try {
    //if(count == 0) {throw Error("no edges intersecting"); }
    //if(count == 2) {throw Error("two edges intersecting"); } // shuldn't happen, one is a vertex
    //} catch (e) { console.error(e); }

    ////split edge
    //const edge_to_split = next_el;
    //const e_new = (edge_to_split as HalfEdge).split(next_pt);
    //const new_vert = e_new.next.origin;
    ////split returns edge pointing at midp
    //
    //// insert edge
    //const last_vert = curr_e.next.origin;
    //let new_edge = this.dcel.insertEdge(last_vert, new_vert);

    ////That's the one we just hopped
    //curr_e.next.deleteEdge();
  
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
