import { WrappedCanvas } from "./lib";
import { vec2 } from "gl-matrix";
import { dom, v2ToString, genRandomPoint } from "./util";
import { Integrity, edgeWalkForEach,  IntersectType, lineIntersectWalk, DCEL, Vertex, HalfEdge, Face } from "./dcel";
import * as DCEL_module from "./dcel";
import { left, pointsClose, pointRelToVector,orientPseudoAngle, orientPseudoAngle_unrolled } from "./primitives";

let globalCanvas: WrappedCanvas;

export function main (canvas: WrappedCanvas){
  console.log("Loaded Voronoi");

  globalCanvas = canvas;

  let tester = new VoronoiTester(canvas);
  tester.draw();
}


class VoronoiTester {
  private readonly VERT_RADIUS=3; //pixels
  private readonly SITE_RADIUS=5; //pixels
  private readonly MOUSE_RADIUS=0.05; //world

  //private readonly STEP_MODE:any = "FAST"; //"FAST" or "SLOW"
  private readonly STEP_DELAY = 500;

  private is_already_inserting = false; 
  //If inserting slowly, make sure we can only insert one site at a time

  private textbox: HTMLElement; //textbox to put element descriptions in
  private checkbox_slow_add: HTMLInputElement; //whether to add sites instantly or slowly

  private lastMousePos: vec2 = vec2.create();;
  private highlightedFeature: Vertex | HalfEdge | Face | null = null;

  private dcel: DCEL;
  constructor(private canvas: WrappedCanvas) {
    const targetWidget = document.getElementById("textbox");
    if(targetWidget == null) { throw Error("Need element #textbox to inject ui into"); }
    //Insert textbox and options in there
    this.makeOptionsBox(targetWidget);

    this.dcel = new DCEL();
    //for debugging
    (window as any).dcel = this.dcel;
    (window as any).integ = Integrity;
    (window as any).dcel_module = DCEL_module;
    (window as any).vor = this;
    this.dcel.initializeBox(1);


    console.log(this.dcel.toString());


    this.canvas.canvas.addEventListener("mousemove", e=>this.handleMouseMove(e));
    this.canvas.canvas.addEventListener("mousedown", e=>this.handleMouseClick(e));


    
    //for(let i = 0; i < 100; i++) {
    //  let p = genRandomPoint();
    //  const feat = this.dcel.getFeatureNearPoint(p, this.MOUSE_RADIUS/10000);
    //  if(feat instanceof Face) {
    //    try{
    //    this.doAddSite(feat, p);
    //    }catch(e){console.error(e);}
    //  }
    //}
  }

  makeOptionsBox(target: HTMLElement) {
    //Takes target element:
    //sets it up to hold ui textbox and fast/slow checkbox
    //
    target.innerHTML = "";
    
    this.textbox = dom("div", "@style= font-size:1.5rem; height: 2.5rem"),
    this.checkbox_slow_add = (dom("input", "#check-slow", "@type=checkbox") as HTMLInputElement)

    const newNode = dom("div",
      this.textbox,
      dom("div", dom("label", "@for=check-slow", "Add sites step-by-step"), this.checkbox_slow_add)
    );

    target.insertAdjacentElement("beforeend", newNode);
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

      const radius = 0.1 //half the length of the arrow
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
    if(face.site != null) {this.canvas.putPoint(face.site,this.SITE_RADIUS, style);}
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

    this.drawHalfEdge(edge.prev, "magenta");
    this.drawHalfEdge(edge, "red");
    this.drawHalfEdge(edge.next, "deepskyblue");
  }

  debugDrawFace(face: Face) {
    if(face.someEdge != null) { 
      edgeWalkForEach(face.someEdge, e=> e.next, e=> this.drawHalfEdge(e, "limegreen"));
      this.drawHalfEdge(face.someEdge, "red");
    }
    if(face.site != null) { this.canvas.putPoint(face.site, this.VERT_RADIUS, "red"); }

  }

  draw() {
    this.canvas.clear();
    //this.canvas.drawAxes();

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

  async handleMouseClick(e: any) {
    const [s_x, s_y] = this.eventToCoords(e);
    const pt = this.canvas.screen2world(vec2.fromValues(s_x,s_y));

    const feat = this.dcel.getFeatureNearPoint(pt, this.MOUSE_RADIUS/ 10);
    console.log("Clicked! : " + (feat && feat.toString()));
    console.log("inserting?: " + this.is_already_inserting);

    if (this.is_already_inserting) {
      console.log("Already inserting, returning early");
      return;
    } else {

      try {
        if(feat instanceof Face) {
          this.is_already_inserting = true;
          await this.doAddSite(feat, pt);
        }
        else if(feat instanceof HalfEdge) {
          //this.doDeleteEdge(feat);
        }
      } catch (e) {console.error(e); }
      finally {
        this.update();
        this.draw();
        this.is_already_inserting = false;
      }
    }

  }


  doDeleteEdge(edge: HalfEdge) {
    edge.deleteEdge(); //Deletes the edge from the side we clicked
    Integrity.verifyAll(this.dcel);
  }

  delay(): Promise<void> {
    //If slow_add, redraws the sceen and resolves after delay
    //Else resolve instantly
    
    if(this.checkbox_slow_add.checked) {  //If we asked to do it slowly, add a delay
      console.log("delaying");
      this.update();
      this.draw();
      return new Promise((resolve, reject) => {
        setTimeout(resolve, this.STEP_DELAY);
      });
    }
    else {
      console.log("skipping delay");
      return Promise.resolve();
    }
  }

  done() {
    //Should be called when doAddSite terminates
  }

  async doAddSite(face: Face, pt: vec2) {
    if(face.site == null) { face.site = pt; return}
    if(pointsClose(face.site, pt) ) { console.error("duplicate site, ignoring"); return;}

    console.log("Doing doAddSite");
    //make perpendicular bisector

    //should get perp bisector facing CCW around new site
    let p1 = pointRelToVector(pt, face.site, 0.5, -1); //right of center
    let p2 = pointRelToVector(pt, face.site, 0.5, 1); // left of center
    //p1 to p2 is CCW

    const new_edge = face.splitWithLine(p1,p2);
    if(new_edge == null) { throw Error("Failed to split with line");}

    //split returns edge pointing at midp
    if(new_edge.face.site != null) { throw Error("New face should have null site: new face:" +new_edge.face); }

    const new_face = new_edge.face;
    new_face.site = pt;

    //console.log("new edge: " + new_edge.toString());
    //console.log("new face: " + new_face.toString());

    // We have one face, fix it up
    //new edge faces new site
    await this.delay();
    return this.doFixupEdgesBidirectional(new_face, new_edge, new_edge, true);
  }

  async doFixupEdgesBidirectional(
        targetFace: Face, stop_edge: HalfEdge, curr_edge:HalfEdge, isCCW: boolean): Promise<void>{
    //Extends the perpendicular-bisector edges for newly-inserted targetFace
    //goes CCW from curr_edge.
    //If we loop around to stop_edge, we're done
    //If we hit the face at infinity, go CW from stop_edge until the other inf
    
    //For the newly inserted face target
    //With the newly-inserted bisector e
    //Want to propagate bisector to next face
    //If hit at edge, 
    
    console.log(`Fixing up ${isCCW?"CCW":"CW"} at ` + curr_edge.toString());

    //next_left will actually be prev_right if CW, but whatever
    const next_left  = isCCW? curr_edge.next.twin       :  curr_edge.prev.twin;
    const next_right = isCCW? curr_edge.twin.prev.twin  :  curr_edge.twin.next.twin;

    const next_edge_to_check = isCCW? curr_edge.next : curr_edge.prev;
    const next_vert = isCCW? curr_edge.next.origin   : curr_edge.origin;

    //we want to delete all edges between us and new_face
    //           \    next_site              |
    //             \ ------------            |
    //    .         |          /             |
    //    targ      | new_face               |
    //              |        /               |
    //              .         <insert bisec  |
    //              \n_left/                 |
    //         n_edge\             last      |
    //     curr>      \  /        site.      |
    //   ---------------x n_vert             |
    //                    \ n_right          |
    

    // ==== Check loop termination
    if(next_edge_to_check == stop_edge) { console.log("Finished a full loop, done"); return; }

    // ==== Check inf termination
    if((next_left.face.isInf || next_right.face.isInf) && isCCW) { // first time, switch to CW
      console.log("next is inf, reversing");
      return this.doFixupEdgesBidirectional(targetFace, curr_edge, stop_edge, false);
      //stop if we come around to curr_edge, start_fixing in the other direction from our initial stop_edge
      
    } else if((next_left.face.isInf || next_right.face.isInf) && !isCCW) { // if CW, done
      console.log("hit inf, twice, done"); return;
    }

    // ============== Now: create next bisector edge
    // we want to take next_left.face, and split it with a perp bisector w/r to site
    const next_face = next_left.face;
    const next_site = next_face.site
    if(next_site == null) { console.error("hit null site"); return;}
    if(targetFace.site == null) { throw Error("TargetFace shouldn't have null site: " + targetFace); }

    //make perpendicular bisector
    let p1 = next_vert.v; //use the intersection point, since it's guaranteed to be on the bisector
    let p2 = pointRelToVector(targetFace.site, next_site, 0.5, isCCW ? 1: -1); // positive is left, ccw

    let new_edge = next_face.splitWithLine(p1,p2);
    if(new_edge == null) { throw Error("Failed to split with line");}

    // ========= Split off new face, find which half-edge is on the new face
    //split returns edge pointing at midp
    if(new_edge.face.site != null) { new_edge = new_edge.twin; console.log("Site on wrong side, flipping : " + new_edge);}
    if(new_edge.face.site != null) { throw Error("Neither face on new_edge has null site. new face:" +new_edge.face); }
    
    // ========= delete the string of edges between us and new face
    const del_edge = next_left;
    del_edge.deleteEdgeString()


    //new_edge should now be facing new_face

    //const new_face = new_edge.face;
    await this.delay();
    return this.doFixupEdgesBidirectional(targetFace, stop_edge, new_edge!, isCCW);
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
