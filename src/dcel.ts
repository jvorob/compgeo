import { vec2 } from "gl-matrix";
import { pointsClose, segmentIntersectLine, distPointToLine,
  DIST_EPSILON, left, orientPseudoAngle, distPointToSeg } from "./primitives";
import { v2ToString, min, max, intStrZeroPad } from "./util";


// ==============================================================
//                     TRAVERSAL QUERIES
// ==============================================================
type Stepper = (e:HalfEdge) => HalfEdge;
type Reducer<T> = (accum: T, curr_edge: HalfEdge) => T;
type Action<T> = (curr_edge:HalfEdge) => T;

function edgeWalkReduce<T>(start_edge: HalfEdge, step: Stepper, reduce: Reducer<T>, init: T) {
  //walks edges using step(e)
  //calls reduce once on each edge, accumulating values

  let curr_e = start_edge;
  let accum = init;
  while(true) {
    //call reduce
    accum = reduce(accum, curr_e);

    //move to next e or terminate
    curr_e = step(curr_e);
    if(curr_e == start_edge) 
    { break; }
  } 
  return accum;
}

export function edgeWalkForEach<T>(start_edge: HalfEdge, step: Stepper, doThing: Action<T>) {
  //walks edges using step(e)
  //calls action on each

  let curr_e = start_edge;
  while(true) {
    //call reduce
    doThing(curr_e);

    //move to next e or terminate
    curr_e = step(curr_e);
    if(curr_e == start_edge) 
    { break; }
  } 
}

type Comparator = (a: HalfEdge, b: HalfEdge) => number;
function edgeWalkMin<T>(start_edge: HalfEdge, step:Stepper, compare: Comparator) {
  //walks all edges on a component
  //compare returns >0 if a > b
  //keeps min
  //returns the edge that was min

  //reduce should keep best value so far
  function reduceKeepMin(acc: HalfEdge,  e:HalfEdge): HalfEdge {
    const best_e = acc;
    if(compare(e, best_e) <= 0) { return e; } // if <= best, keep new
    else { return best_e; } 
  }

  return edgeWalkReduce(start_edge, step, reduceKeepMin, start_edge);
}


function canReach(start_edge: HalfEdge, step: Stepper, target: HalfEdge) {
  const reduceHasReached = (accum: boolean, curr_edge: HalfEdge) => {
    return (accum || curr_edge == target)
  }
  return edgeWalkReduce(start_edge, step, reduceHasReached, false);
}



export function isInnerComponent(edge: HalfEdge): boolean {
  // walks edge list to determine of this component is interior (i.e. face is inf)
  // 
  // If we take the leftmost lowermost vert encountered on the walk, it must be convex
  // therefore innerComp would turn right, outerComp would turn left

  const start = edge;
  let leftmost_vert = start.origin;

  const stepNext = (e:HalfEdge) => e.next;
  const compareMinLeftmost = (e1: HalfEdge, e2: HalfEdge) => {
    const v1 = e1.origin.v;
    const v2 = e2.origin.v;

    if(v1 != v2){ //If distinct vertices, sort by coordinates
      if(v1[0] < v2[0]) { return -1; }      // if v1 leftward of v2, return -1 (left is smaller)
      else if(v1[0] == v2[0] && v1[1] < v2[1]) { return -1; } // if x-cor tied, use ycor (down is smaller)
      else { return 1; }

    } else { //If same vertex, break ties by angle
      //    ^ |             |
      //    eA|   we want eA|
      //      .             |
      //        \eB         |
      //         \v         |
      //eA can't be left of vertical, B can't be vertical ever, 
      //we want eA if eA_next_orig is left of eB

      const e1_head = e1.next.origin.v;
      const e2_head = e2.next.origin.v;
      const mid = v1

      if(left(mid, e2_head, e1_head) > 0) { return -1; } //if e1 left, then e1 is the one we ant
      else { return 1; } //e1 is right, so e2 is the outside one
    };
  }

  const leftmostVert_edgeAway = edgeWalkMin(edge, stepNext, compareMinLeftmost);
  //console.log("isInnerComponent, edge is " + leftmostVert_edgeAway);

  //a, b, c are prev, leftmost, next
  const lv = leftmostVert_edgeAway.origin;
  const lv_prev = leftmostVert_edgeAway.prev.origin;
  const lv_next = leftmostVert_edgeAway.next.origin;

  //if only two halfEdges, return true, isolated edge
  if(lv_prev == lv_next) { return true;} 

  //innerComponent iff right turn
  if(left(lv_prev.v, lv.v, lv_next.v) < 0) {return true; }
  else {return false;}
}

export enum IntersectType { "VERT", "DEGENERATE", "EDGE", "NONE"}
export function edgeIntersectLineCombinatoric(edge: HalfEdge, a: vec2, b:vec2): IntersectType {
  //Tests whether line ab intersects the edge at its interior or its origin (not the far endpoint)
  //
  //Returns [edge.origin, false] if line intersects only at vertex
  //Returns [edge, true] if line intersects both vertices
  //Returns [edge, false] if line intersects interior (vertices are left and right)
  //
  //Returns [null, false] if line doesn't intersect at all
  //Returns [null, false] if line intersects vertex but is degenerate with previous edge
  
  const [v1, v2] = [edge.origin, edge.next.origin ];
  const v1_on = VertOnLine(v1, a, b);
  const v2_on = VertOnLine(v2, a, b);
  const vprev_on = VertOnLine(edge.prev.origin, a, b);

  if(            !v1_on && v2_on)  { return IntersectType.NONE }        //next has intersection, dont count it
  if(             v1_on && v2_on)  { return IntersectType.DEGENERATE }  //degenerate intersection
  if( vprev_on && v1_on && !v2_on) { return IntersectType.NONE }        //degenerate in prev edge, dont count it here
  if(!vprev_on && v1_on && !v2_on) { return IntersectType.VERT}         //proper vertex intersection

  //ELSE: neither vertex is on the line: check if they're on opposite sides
  const VertLeftOfLine = (v:Vertex) => { return left(a, b, v.v) > 0; }
  if(VertLeftOfLine(v1) == VertLeftOfLine(v2)) { //Same side
    return IntersectType.NONE

  } else { //Opposite sides, edge will have intersection
    return IntersectType.EDGE;
  }
}

type IntersectResult = [IntersectType, HalfEdge]
export function lineIntersectWalk(start_edge:HalfEdge, a: vec2, b: vec2, 
                                  stop_before?:HalfEdge): IntersectResult {
  //walks the edges, returns the first edge that intersects the line
  //according to edgeIntersectLineCombinatoric, so next.origin intersection wont be counted until we reach next
  //returns [IntersectType, edge_where_it_happened]
  //If stop_before is provided, it will stop before at that edge without checking it

  if(stop_before == undefined) { stop_before = start_edge; }
  let curr_edge = start_edge
  while(true) {
    //If we found anything of interest, return it
    const intx_type = edgeIntersectLineCombinatoric(curr_edge, a, b)
    if(intx_type != IntersectType.NONE) { return [ intx_type, curr_edge ] }

    curr_edge = curr_edge.next;
    if(curr_edge == stop_before) { return [IntersectType.NONE, start_edge]; } //Found no intersections
  }
}


// ====================================================================================
//
//                              LOCAL PRIMITIVES
//
//
// ====================================================================================

function PointOnEdgeInterior(pt: vec2, edge: HalfEdge): vec2 | null {
  //Returns pt if it lies on the edge
  // else null
  
  const [v1, v2] = edge.getPoints();
  if(pointsClose(v1, pt) || pointsClose(v2, pt)) { return null; }
  if(distPointToSeg(pt, v1, v2) > DIST_EPSILON) { return null; }
  return pt;
}


function VertOnLine(vert:Vertex, a: vec2, b: vec2) {
  //Returns vert.v if on line, else null
  
  //TESTING:
  const d = distPointToLine(vert.v, a, b)
  if(d >= DIST_EPSILON && d <= 3* DIST_EPSILON) { 
    console.error(`NEAR MISS: dist=${d}, eps=${DIST_EPSILON}`);
  }

  return (distPointToLine(vert.v, a, b) < DIST_EPSILON) ? vert.v: null;
}

function EdgeInteriorIntersectLine(e:HalfEdge, a: vec2, b: vec2) {
  //returns point of intersection or null
  const [v1, v2] = e.getPoints();

  if(distPointToLine(v1, a, b) < DIST_EPSILON) { return null; }
  if(distPointToLine(v2, a, b) < DIST_EPSILON) { return null; }
  return segmentIntersectLine(v1, v2, a, b);
}



// ====================================================================================
//
//                              PARTIAL PRIMITIVES
//
// Things which can't be called on their own, but are used as
// building blocks in more complete methods
//
// ====================================================================================

function splitFaceAt(edge: HalfEdge) {
  // =================================
  // PRECONDITION: We've just inserted edge:
  //  edge has been spliced in (next/prev/twin work safely)
  //  faces have been set on edge and edge.twin
  //  edge and edge.twin are no longer connected
  //  edge.face = edge.twin.face
  //
  // THIS DOES:
  //  Splits face into two faces
  //  Assigns one face to each edge in each component
  //
  //  if this is the inf face, make sure that the inf side gets the inf face,
  //  so the inf face is always the same
  //
  // POSTCONDITION:
  //  Valid DCEL


  //console.log("Splitting face " + edge.face + " at edge " + edge);

  let curr_face = edge.face;
  let new_face = new Face(edge.dcel);

  // ========= If splitting the face at infinity, we want the new face to be on the non-inf side
  if(curr_face.isInf) {
    //If the twin is the one that gets the inf side, recur on twin
    if(isInnerComponent(edge.twin)) { 
      splitFaceAt(edge.twin);
      return; } }

  //From now on, if curr_face.isInf, then the inf side will be on edge and not twin


  //link faces -> edges;
  curr_face.someEdge = edge;
  new_face.someEdge = edge.twin;

  //link edges -> faces, and propagate
  edge.face = curr_face;
  edge.twin.face = new_face;
  edgeWalkForEach(edge,      e=>e.next, e=>{e.face = edge.face});
  edgeWalkForEach(edge.twin, e=>e.next, e=>{e.face = edge.twin.face});


  // ============ If has a site, put it on the correct side of the new edge
  const site = curr_face.site;
  if(site != null){
    let side_with_site;
    const [v0, v1] = edge.getPoints();
    if(left(v0, v1, edge.face.site!) > 0)  //if site in edge.face then site left of edge
         { side_with_site = edge; }
    else { side_with_site = edge.twin; }

    side_with_site.face.site = site;
    side_with_site.twin.face.site = null;
  }

  // ====== Insert into list (if a face is inf it will be curr_Face)
  edge.dcel.faces.push(new_face)

  //console.log("Just split face at " + edge.toString());
}

function mergeFacesAt(edge:HalfEdge) {
  // used for deleting an edge. Fixes up all the faces to be merged
  // Doesn't alter edges otherwise
  // PRECONDITION
  //  valid DCEL
  //  edge and edge.twin are in separate components
  // POSTCONDITION:
  //  edge.face = edge.twin.face, other face deleted
  //  edges still need to be removed/deleted
  
  // We'll delete the twin face
  const keep_face = edge.face
  const del_face = edge.twin.face
  const del_index = edge.dcel.faces.indexOf(del_face);
  if(del_index < 0){ throw Error("face not in dcel in mergeFaces");}
    
  //We never want to delete the face at infinity, so switch sides if that happens
  if(del_face.isInf) { 
    if(keep_face.isInf) { throw Error("Merging face when both sides are inf: " + edge)}
    mergeFacesAt(edge.twin);
    return;
  }

  //Now, any inf will be on edge.face, so we can delete twin

  //Merge attributes (copy over site if needed)
  if(del_face.site != null) {
    if(keep_face.site == null) { keep_face.site = del_face.site; }
    else { throw Error("Can't merge two faces both with sites: " + keep_face + " " + del_face); }
  }

  //set twin component to keep_face
  edgeWalkForEach(edge.twin, e=> e.next, e=>  e.face = keep_face );



  // remove del_face
  edge.dcel.faces.splice(del_index, 1); //delete it
}

// ====================================================================================================
//
//
//
//
// ====================================================================================================

export class DCEL {
  public verts: Vertex[] = [];
  public edges: HalfEdge[] = [];
  public faces: Face[] = [];

  constructor() {
    //make the face at infinity
    const face_inf = new Face(this, true);
    this.faces.push(face_inf);
  }

  //Sets up DCEL for initial box
  initializeBox() {
    let v1, v2, v3, v4: Vertex;
    let r = 0.8;

    v1 = new Vertex(-r, r, this);
    v2 = new Vertex( r, r, this);
    v3 = new Vertex( r,-r, this);
    v4 = new Vertex(-r,-r, this);

    this.verts.push(v1);
    this.verts.push(v2);
    this.verts.push(v3);
    this.verts.push(v4);


    this.insertEdge(v1,v2);
    this.insertEdge(v2,v3);
    this.insertEdge(v3,v4);
    this.insertEdge(v4,v1);

    //console.log(this.toString(this.getHalfEdgeHittingRay(v3,v4)))
    //console.log(this.toString(this.getHalfEdgeHittingRay(v1,v4)))

  }

  toId(elem: Vertex | HalfEdge | Face | null): string {
    //returns a short string like  v12 or e01 or f01
    //number is index in this dcel
    //if element cant be found in dcel, return e???

    let msg ="";
    let index: number;
    let prefix: string;
    if(elem == null) {
      return "null";
    } else if (elem instanceof Vertex) {
      index = this.verts.indexOf(elem);
      prefix = "v";

    } else if (elem instanceof HalfEdge) {
      index = this.edges.indexOf(elem);
      prefix = "e";

    } else if (elem instanceof Face) {
      index = this.faces.indexOf(elem);
      prefix = "f";

    } else { throw Error("Unknown type in dcel.toId") }

    let numDigits = this.edges.length > 50 ? 3:2;
    if(index < 0)
    { return prefix + "???" }
    else 
    {return prefix + intStrZeroPad(index,numDigits);}
  }

  toStringElem(elem: Vertex | HalfEdge | Face): string {
    let msg = "";
    const shortcode = this.toId(elem);

    if        (elem instanceof Vertex) {
      let fmt = (f:number) => (f<0?"":" ") + f.toFixed(2);
      msg = `[${shortcode}: (${fmt(elem.v[0])},${fmt(elem.v[1])}), `+
        `e=${this.toId(elem.someEdgeAway)}]`;

    } else if (elem instanceof HalfEdge) {
      msg = `[${shortcode}: o=${this.toId(elem.origin)}, ` +
        `t=${this.toId(elem.twin)}, `+
        `n=${this.toId(elem.next)}, `+
        `p=${this.toId(elem.prev)}, `+
        `f=${this.toId(elem.face)}` +
        "]";

    } else if (elem instanceof Face) {
      const infStr= elem.isInf ? " inf" : "";
      const siteStr= (elem.site!=null) ? " " + v2ToString(elem.site): "";
      msg = `[${shortcode}:${infStr}${siteStr} e=${this.toId(elem.someEdge)}]`;

    }

    return msg;
  }

  toString(): string {
    const vert_str = this.verts.map(v => this.toStringElem(v)).join(",\n        ");
    const edge_str = this.edges.map(v => this.toStringElem(v)).join(",\n        ");
    const face_str = this.faces.map(v => this.toStringElem(v)).join(",\n        ");

    return `DCEL{\n`+
      ` verts= ${vert_str}` + "\n\n" +
      ` edges= ${edge_str}` + "\n\n" +
      ` faces= ${face_str}` + "\n" +
      `}`;

  }

  getHalfEdgeHittingRay(Va: Vertex, Vb: Vertex): HalfEdge|null {
    // Looks at all half-edges around Va. 
    // Finds the half-edge whose next would be ray Va->Vb
    // If no edges, return null
    // Returns the half-edge pointing at Va
    //      ^ |ein        |
    //      | |v   ->     |
    //        a- - - - -b |
    //       / \     <-   |
    //      /   \         |
    //     /     \        |

    const e_away = Va.someEdgeAway;
    if(e_away == null) { return null; } // no edges

    const first_e_towards = e_away.prev;

    // find the one with min angle relative to a->b (immediately left of b coming in)

    //walk clockwise around vectors incoming to point
    const step = (edge_in:HalfEdge) => edge_in.next.twin;

    //want smallest pseudo angle of (a, b, edge)
    const compareMinAngle = (e1: HalfEdge, e2:HalfEdge) => { 
      const a1 = orientPseudoAngle(Va.v, Vb.v, e1.origin.v); 
      const a2 = orientPseudoAngle(Va.v, Vb.v, e2.origin.v); 
      return a1 - a2;
    }

    return edgeWalkMin(first_e_towards, step, compareMinAngle);

    //console.log("DONE!");
    //console.log(`best:${best_e.toString()}, ${min_angle}`);
  }

  insertEdge(Va: Vertex, Vb: Vertex): HalfEdge {
    // Inserts two half-edges between Va and Vb
    // If edge would intersect some other edge, throws.
    //
    // twins them together
    // inserts into this.edges[]
    // patches up next/prev pointers of appropriate edges 
    // TODO: fix faces
    // returns edge from a to b
    //
    // TODO THOUGHTS: api doesnt define how to handle splitting of faces.
    // Will ultimately depend on sites and things
    //
    //
    //---------------------------------------------------*
    //              Ea                                   |
    //        < \ \               > /                    |
    //         \ \ >    E_ab     / /  /                  |
    //            \      =>       /  <                   |
    //            Va - - - - - -Vb                       |
    //          > /      <=       \                      |
    //         / / /    E_ba     < \ \                   |
    //          / <               \ \ >                  |
    //                          Eb                       |
    //                                                   |
    //Ea and Eb are found by calling getHalfEdgeHittingRay


    // ============ CHECK IF EDGES INTERSECT
    // !!!!!!!! TODO  !!!!!!!!!!!!

    // Make two twinned half-edges
    let E_ab = new HalfEdge(this);
    let E_ba = new HalfEdge(this);

    E_ab.twin = E_ba;
    E_ba.twin = E_ab;

    E_ab.origin = Va;
    E_ba.origin = Vb;


    // =============== SPLICE IN NEXT/PREV =============
    // (also attaches edge to vertex if empty)

    function linkEdges(e1:HalfEdge, e2: HalfEdge) {
      //connects next and prev pointers for e1->e2
      e1.next = e2; e2.prev = e1; }

    function spliceEdgesAround(V: Vertex, incoming_edge: HalfEdge | null,
      new_away: HalfEdge, new_towards: HalfEdge) {
      //          \ \ incoming_edge            |
      //         \ \ >                       |
      //            \      => new_away       |
      //             V - - - - -             |
      //          > /      <= new_towards    |
      //         / / /                       |
      //          / < incoming_edge.next     |

      if(incoming_edge == null) {
        // Vertex has no edges, so new ones just wrap around
        linkEdges(new_towards, new_away); 
        V.someEdgeAway = new_away; //Also need to add edge to formerly-empty point
        //console.log(`splicing around empty vertex ${V.toString()}`);

      } else { //link things up normally
        linkEdges(new_towards, incoming_edge.next);
        linkEdges(incoming_edge, new_away);
        //console.log(`splicing around edged vertex ${V.toString()}`);
      }
    }

    //console.log(`Inserting edge from ${Va.toString()} to ${Vb.toString()}`);
    let Ea = this.getHalfEdgeHittingRay(Va, Vb);
    let Eb = this.getHalfEdgeHittingRay(Vb, Va);
    //if(Ea == null || Eb == null) { throw Error("No hitting ray in insertedge splice edges")}
    spliceEdgesAround(Va, Ea, E_ab, E_ba); //v, e, new_away, new_towards
    spliceEdgesAround(Vb, Eb, E_ba, E_ab);

    // =============== FIX UP FACES =============

    // ===  Set face on new edges
    // TODO: this coul be a lot cleaner

    if(this.edges.length == 0) { //first face, add to inf
      this.faces[0].someEdge = E_ab;
      E_ab.face = E_ba.face = this.faces[0];

    } else { //
      if(E_ab.next == E_ab.prev) { // we can't have unconnected edges except for the first one
        throw Error("Can't insert unconnected edges after the first"); }

      if(E_ab.next == E_ba) { //get face from neighbor, make sure it's not twin
        E_ab.face = E_ab.prev.face;
        E_ba.face = E_ba.next.face;

      } else { //E_ab.next != E_ba
        E_ab.face = E_ab.next.face;
        E_ba.face = E_ba.prev.face;
      }
    }


    // == Check if we need to split
    if(!canReach(E_ab, (e)=>e.next, E_ab.twin)){
      splitFaceAt(E_ab);
    }

    // ====== Insert into arrays
    this.edges.push(E_ab);
    this.edges.push(E_ba);
    //console.log(`Inserted edge ${E_ab.toString()} Doing verify:`);
    Integrity.verifyAll(this);
    return E_ab;
  }


  // ===================================================
  //                     FACE METHODS
  // ===================================================


  // ================= ETC

  getFeatureNearPoint(pt: vec2, epsilon=0.01): Vertex | HalfEdge | Face | null {
    // Returns the feature at that point in space
    // Returns closest vertex if within epsilon of one
    // If no vertex, returns closest edge if within epsilon of one
    // else return face it's in or null TODO: will return null for now

    //get closest vertex
    if(this.verts.length > 0) {
      const closestVert = min(this.verts, (vert) => vec2.dist(vert.v,pt));

      if(vec2.dist(closestVert.v, pt) < epsilon) {
        return closestVert;
      }
    }


    // ======== EDGES
    function edge_dist (edge:HalfEdge) {
      const [p1, p2] = edge.getPoints();
      return distPointToSeg(pt, p1, p2);
    }

    //no closest vertex, try for an edge
    if(this.edges.length > 0) {
      const closestEdge = min(this.edges, edge_dist);

      if(edge_dist(closestEdge) < epsilon) {
        //figure out which half-edge it is
        //halfedges have a face on their left

        const [p1, p2] = closestEdge.getPoints();
        if(left(p1, p2, pt) >= 0) {
          return closestEdge;
        } else {
          return closestEdge.twin;
        }
      }
    }

    // ======= FACES
    for(let i = 0; i < this.faces.length; i++){
      if(this.faces[i].containsPoint(pt))
      {return this.faces[i]; }
    }

    return null;
  }




}



export class Vertex {
  public v: vec2;
  public someEdgeAway: HalfEdge | null; //Returns an edge whose origin is v, is null iff no edges

  constructor(x: number, y:number, public dcel:DCEL) {
    this.v = vec2.fromValues(x,y);
    this.someEdgeAway = null;
  }

  toString():string { return this.dcel.toStringElem(this); }
  
  delete() {
    //deletes self
    this.someEdgeAway = null;
    const i = this.dcel.verts.indexOf(this);
    if(i < 0) {throw Error("vertex not in own dcel list"); }
    this.dcel.verts.splice(i,1);
  }
}

export class HalfEdge {
  public origin: Vertex;
  public next: HalfEdge;
  public prev: HalfEdge;
  public twin: HalfEdge;

  public face: Face;

  constructor(public dcel:DCEL) {
  }

  toString():string { return this.dcel.toStringElem(this); }

  getPoints(): [vec2, vec2] { return [this.origin.v, this.next.origin.v] }

  split(pt: vec2): HalfEdge | null {
    //splits edge at pt, insert two half-edges
    //check that pt is on edge and not at verts
    // returns edge pointing at midpoint
    //     e_1    e_2         |
    //     ->       ->       |
    //   a - - mid- - - b    |
    //     <-       <-       |
    //    et_1     et_2
    //
    // this becomes e_1
    //
    // if degenerate returns null

    //console.log("splitting edge" + this + "at pt" + v2ToString(pt));

    //======= Make sure we dont get a degenerate split
    if(PointOnEdgeInterior(pt, this) == null) { console.error("split edge: point not on edge"); return null; }

    //console.log("checkspassed");

    //Now all is well
    const a = this.origin;
    const b = this.next.origin

    let mid = new Vertex(pt[0], pt[1], this.dcel);
    let e_2 = new HalfEdge(this.dcel);
    let et_2 = new HalfEdge(this.dcel);
    let e_1 = this;
    let et_1 = this.twin;

    //console.log(e_1.toString());
    //console.log(et_1.toString());

    // Make new edges, set origins, twin, set faces
    e_2.origin  = mid; e_2.twin  = et_2; e_2.face  = this.face;
    et_2.origin = b  ; et_2.twin = e_2 ; et_2.face = this.twin.face;
    et_1.origin = mid; //twin and face are still e_1
    mid.someEdgeAway = e_2;
    b.someEdgeAway = et_2;
    //a.someEdgeAway = et_1; // which it already is

    //link around b
    HalfEdge.linkEdges(e_2,this.next);
    HalfEdge.linkEdges(this.twin.prev, et_2);

    //link around mid
    HalfEdge.linkEdges(e_1,e_2);
    HalfEdge.linkEdges(et_2,et_1);

    //link around a
    //e1 and twin are already spliced around a

    //add everything
    this.dcel.edges.push(e_2);
    this.dcel.edges.push(et_2);
    this.dcel.verts.push(mid);
    //a, b, e1, et1 are not new

    //console.log("Doing verify in edge.split:");
    Integrity.verifyAll(this.dcel);
    return e_1;
  }


  deleteEdge() {
    // Merges the two faces at edge and edge.twin
    // Unsplices and deletes this edge
    // Returns the merged face
    //---------------------------------------------------*
    //              Ea         Eb_next                   |
    //        < \ \               > /                    |
    //         \ \ >    E_ab     / /  /                  |
    //            \      =>       /  <                   |
    //            Va - - - - - -Vb                       |
    //          > /      <=       \                      |
    //         / / /    E_ba     < \ \                   |
    //          / <               \ \ >                  |
    //             Ea_next      Eb                       |
    //                                                   |
    
    console.log("deleting edge at " + this.toString());

    const E_ab = this;
    const E_ba = this.twin;
    const a = this.origin;
    const b = this.twin.origin;

    //first merge faces: sets all faces on both sides, merges attributes
    if(! canReach(E_ab, e=>e.next, E_ba)) {
      mergeFacesAt(this)
    }
    const new_face = E_ab.face;

    //then unsplice edges
    HalfEdge.linkEdges(E_ab.prev, E_ba.next);
    HalfEdge.linkEdges(E_ba.prev, E_ab.next);

    //console.log("unsplicing edges at " + this.toString());
    //console.log(this.prev.toString());
    //console.log(this.next.toString());


    //If we're the only edge at a, origin now has no edges
    if(E_ba.next == E_ab) { a.delete(); }// a.someEdgeAway = null; }
    else if(a.someEdgeAway = E_ab){ a.someEdgeAway = E_ba.next } //otherwise find a replacement

    //If only edge at b, update
    if(E_ab.next == E_ba) { b.delete(); } //b.someEdgeAway = null; }
    else if(b.someEdgeAway = E_ba){ b.someEdgeAway = E_ab.next } //otherwise find a replacement

    //delete this and twin
    const i1 = this.dcel.edges.indexOf(E_ab);
    this.dcel.edges.splice(i1, 1); //delete it
    const i2 = this.dcel.edges.indexOf(E_ba);
    this.dcel.edges.splice(i2, 1); //delete it


    //wipe them also just to be safe
    E_ab.next = E_ab.prev = E_ab.twin = E_ab.origin = E_ab.face = (null as any);
    E_ba.next = E_ba.prev = E_ba.twin = E_ba.origin = E_ba.face = (null as any);

    console.log("Doing verify in edge.delete:");
    Integrity.verifyAll(this.dcel);
    return new_face;
  }



  static linkEdges(e1:HalfEdge, e2: HalfEdge) {
    //connects next and prev pointers for e1->e2
    e1.next = e2; e2.prev = e1; }
}

export class Face {
  public someEdge: HalfEdge | null;
  // public readonly innerComponents: HalfEdge[]; //Voronoi diagram won't have holes, dont need this
  public readonly isInf: boolean; //Set to true on the face at infinity
  public site: vec2| null;

  constructor(public dcel: DCEL, isInf = false) {
    this.isInf = isInf;
    this.site = null;
  }

  public toString() {
    return this.dcel.toStringElem(this);
  }

  containsPoint(pt: vec2) {
    // If face left of all edges or on edges
    if(!this.someEdge) {return false;}
    let allleft = true;
    edgeWalkForEach(this.someEdge, e=>e.next, e=> {
      const [v1, v2] = e.getPoints();
      if(left(v1, v2, pt) < 0) { allleft = false; } //if right of line
    });

    return allleft;
  }

  splitWithLine(p1: vec2, p2: vec2): HalfEdge|null {
    //Tries to split this face across the line p1, p2
    //If line doesn't intersect at two points, return null
    //Else return new halfEdge, oriented to match p1, p2
    
    if(!this.someEdge) { console.error("Trying to split empty face"); return null; }
    console.log("Doing splitWithLine: " + this + " pts: " + v2ToString(p1) + v2ToString(p2));
    //console.log("First edge: " + this.someEdge);

    //Try to get two intersection points
    const [intx_type_1, edge_1 ] = lineIntersectWalk(this.someEdge, p1,p2);
    if(intx_type_1 == IntersectType.NONE) { throw Error("No intersections found"); }
    if(intx_type_1 == IntersectType.DEGENERATE) { throw Error("Degenerate intersection found"); }

    //console.log("First intesection: " + edge_1);

    const [intx_type_2, edge_2 ] = lineIntersectWalk(edge_1.next, p1,p2, edge_1); //stop before edge_1
    if(intx_type_2 == IntersectType.NONE) { throw Error("Only one intersection found"); }
    if(intx_type_2 == IntersectType.DEGENERATE) { throw Error("Degenerate intersection found"); }

    //console.log("2nd intesection: " + edge_2);

    const splitEdgeWithLine = (edge: HalfEdge, a: vec2, b: vec2) =>  {
      //returns null if failed
      const [ e_p1, e_p2 ] = edge.getPoints();

      const intx_pt = segmentIntersectLine(e_p1,e_p2, p1, p2);
      if(intx_pt == null) { return null; }

      const edge_to_mid = edge.split(intx_pt);
      if(edge_to_mid == null) { return null; } //TODO: make method to split edge across line instead?

      const v_mid = edge_to_mid.next.origin; //new vertex
      return v_mid
    }

    // Convert them to vertices
    let v1!: Vertex | null, v2! : Vertex | null;
    if(     intx_type_1 == IntersectType.VERT) { v1 = edge_1.origin; }
    else if(intx_type_1 == IntersectType.EDGE) { v1 = splitEdgeWithLine(edge_1, p1, p2); }

    if(     intx_type_2 == IntersectType.VERT) { v2 = edge_2.origin; }
    else if(intx_type_2 == IntersectType.EDGE) { v2 = splitEdgeWithLine(edge_2, p1, p2); }
    //can't be none or degenerate

    if(v1 == null || v2 == null) { throw Error("SplitedgewithLine failed in Face.splitWithLine"); }

    const new_edge = this.dcel.insertEdge(v1,v2);
    //we want the edge running from p1, to p2
    const [ edge_p1, edge_p2 ] = new_edge.getPoints();

    const delta_line = vec2.create();
    vec2.sub(delta_line, p2, p1); //delta = p2 - p1

    const delta_edge = vec2.create();
    vec2.sub(delta_edge, edge_p2, edge_p1); //delta = end_of_edge - origin
    
    //if edge facing opposite to line, dot product will be negative
    if(vec2.dot(delta_line, delta_edge) < 0) {
      return new_edge.twin;
    } else {
      return new_edge;
    }
  }

}


// ==========================================================
//               INTEGRITY TESTS
// ==========================================================

export module Integrity {
  // Contains integrity tests, which are functions that can be called on a DCEL
  // Check various invariants
  // If they fail, will throw and output appropriate logging
  
  function runTests(dcel: DCEL, msg="") {
    // Runs the full suite of tests, if fail print message
  }
  
  class AssertionError extends Error {
  }

  function assert(b:boolean, msg="", e?: Element) {
    if(e != undefined) { msg += ": " + e.toString(); }
    if(!b) { throw new AssertionError(msg); }
  }

  
  type Test = (d:DCEL) => boolean;
  type Element = HalfEdge|Vertex|Face;
  
  //if(elem instanceof HalfEdge) {
  //} else if(elem instanceof Vertex) {
  //} else if(elem instanceof Face) {
  //} else { throw Error("Unkown Type in verifyElemDefined: " + elem); }

  function isElemInDCEL(dcel: DCEL, elem: Element) {
    assert(elem != null, "elem is null", elem);
    assert(elem.dcel == dcel, "dcel doesn't match elem.dcel", elem);;

    let arr: Element[];
         if(elem instanceof HalfEdge) { arr = dcel.edges; }
    else if(elem instanceof Vertex)   { arr = dcel.verts; }
    else if(elem instanceof Face)     { arr = dcel.faces; }
    else { throw Error("Unkown Type in isElemInDCEL: " + elem); }

    return(arr.indexOf(elem) >= 0);
  }

  function verifyElemDefined(dcel: DCEL, elem: Element) {
    if(elem instanceof HalfEdge) {
      verifyEdgeDefined(dcel, elem);
    } else if(elem instanceof Vertex) {
      verifyVertexDefined(dcel, elem);
    } else if(elem instanceof Face) {
      verifyFaceDefined(dcel, elem);
    } else { throw Error("Unkown Type in verifyElemDefined: " + elem); }
  }

  function verifyEdgeDefined(dcel: DCEL, e: HalfEdge) {
    assert(e.dcel == dcel, "dcel doesn't match e.dcel");;
    //check   prev, next, twin, origin, face
    
    assert(isElemInDCEL(dcel, e.prev)  ,   "prev not in dcel", e);
    assert(isElemInDCEL(dcel, e.next)  ,   "next not in dcel", e);
    assert(isElemInDCEL(dcel, e.twin)  ,   "twin not in dcel", e);
    assert(isElemInDCEL(dcel, e.face)  ,   "face not in dcel", e);
    assert(isElemInDCEL(dcel, e.origin), "origin not in dcel", e);

    assert(e.next.prev == e, "next doesn't link back", e);
    assert(e.prev.next == e, "prev doesn't link back", e);
    assert(e.twin.twin == e, "twin doesn't link back", e);

    assert(e.next.origin == e.twin.origin, "next and twin should have same origin", e);

    assert(e.face == e.next.face, "next doesn't share a face with me", e);

    //check that im connected to origin properly. 
    const target_edge = e.origin.someEdgeAway;
    assert(target_edge != null, "origin should have some edge");
    assert(canReach(e, edge=>edge.twin.next, target_edge!), 
        `should be able reach all edges around origin, can't reach ${target_edge&&target_edge.toString()}`, e);

  }

  function verifyVertexDefined(dcel: DCEL, v: Vertex) {
    assert(v.dcel == dcel, "dcel doesn't match v.dcel");;
    if(v.someEdgeAway != null) {
      assert(isElemInDCEL(dcel, v.someEdgeAway),  "someEdgeAway not in dcel", v);
      assert(v.someEdgeAway.origin == v,          "someEdgeAway doesn't have me as origin", v);
    }
    
    //TODO: edge connectedness properties?
  }
  function verifyFaceDefined(dcel: DCEL, f: Face) {
    assert(f.dcel == dcel, "dcel doesn't match f.dcel", f);;

    if(f.someEdge != null) {
      assert(isElemInDCEL(dcel, f.someEdge),  "someEdge not in dcel", f);
      assert(f.someEdge.face == f, "someEdge doesn't have me as face", f);

      edgeWalkForEach(f.someEdge, e => e.next, e=> {
        assert(f.someEdge!.face == f, `edge ${e.toString()} in my component doesn't have me as face`, f);
      });

      const am_first = dcel.faces.indexOf(f) == 0;
      assert(am_first == f.isInf, "only first face should be isInf", f);
      
      const am_clockwise = isInnerComponent(f.someEdge);
      assert(am_clockwise == f.isInf, "only inf face should have an inner component", f);
    }

  }
  
  export function verifyAll(dcel: DCEL){ 
    // All element's DCEL entries should point back to the same dcel
    // Element itself should be in the DCEL
    // Vertex: someEdge should be null, or refer to an edge in the DCEL
    // Edge: next,prev,twin, origin, face, should all be in the DCEL
    // Face: someEdge should be in the DCEL
    
    dcel.edges.forEach( e => { verifyEdgeDefined(dcel, e); });
    dcel.verts.forEach( v => { verifyVertexDefined(dcel, v); });
    dcel.faces.forEach( f => { verifyFaceDefined(dcel, f); });

  }

}


function test():void {
  let dcel: any;

  /*
  points p1, p2, p3, p4


  dcel.addPoint(p1) // adds point
  dcel.addPoint(p2) // adds point
  dcel.addPoint(p3) // adds point
  dcel.addPoint(p4) // adds point

  dcel.addEdge(p1,p2) 
  // p1 and p2 have no edges, so check all other edges in the map
  // if any others intersect, throw error
  // since no edges, we're good.
  //

  dcel.addEdge(p2,p3)
  //

   */
}




/*  =============================================
 *                   ROADMAP
 
 TODO: Handle multiple components, and holes
TODO: Handle non-convex polygons: currently point in face breaks for non-convex
 TODO: isInf will be just outerComponent == null
       - We'll then need a pointer dcel.outsideFace, which we can update as needed
       - Will simplify things
TODO: Abstract out face:
      - split and merge will let you write subclasses that work nicely
      - Will let us have multiple versions, one voronoi, one general purpose

// === Primitives
at primitive wrappers on face, vertex, etc






// OTHER:
how am I going to do binning?
add intersection/degeneracy checks (for debugging) to things

 */


/*
 TRAVERSAL INVARIANTS? 

 next(e) != e //no edge to itself

 next(e) goes ccw around face
 next(e) goes cw around hole (interior face)

 twin(next(e_toward))) = toward, // goes CW around point
 next(twin(e_toward)) !! WRONG

 next(twin(e_away)) = away, // goes CW around point
 */
