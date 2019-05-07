import { vec2 } from "gl-matrix";
import { left, orientPseudoAngle, distPointToSeg } from "./primitives";
import { min, max, intStrZeroPad } from "./util";


// ======= Utility methods
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

      if(v1[1] < v2[1] ||  // if v1 leftward of v2, return -1 (left is smaller)
        (v1[1] == v2[1] && v1[0] <= v2[0])) //if x-cor tied, use ycor
          {return -1}
      else {return 1};
    }

    const leftmostVert_edgeAway = edgeWalkMin(edge, stepNext, compareMinLeftmost);
  
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

  toId(elem: Vertex | HalfEdge | Face): string {
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
      msg = `[${shortcode}:${infStr} e=${this.toId(elem.someEdge)}]`;

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

  insertEdge(Va: Vertex, Vb: Vertex) {
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

    function spliceEdgesAround(V: Vertex, incoming_edge: HalfEdge,
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
    spliceEdgesAround(Va, Ea, E_ab, E_ba); //v, e, new_away, new_towards
    spliceEdgesAround(Vb, Eb, E_ba, E_ab);

    // =============== FIX UP FACES =============
    
    // ===  Set face on new edges
    
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
      Face.splitAt(E_ab);
    }

    // ====== Insert into arrays
    this.edges.push(E_ab);
    this.edges.push(E_ba);

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
}

export class Face {
  public someEdge: HalfEdge | null;
  // public readonly innerComponents: HalfEdge[]; //Voronoi diagram won't have holes, dont need this
  public readonly isInf: boolean; //Set to true on the face at infinity

  constructor(public dcel: DCEL, isInf = false) {
    this.isInf = isInf;
  }

  public toString() {
    return this.dcel.toStringElem(this);
  }

  containsPoint(pt: vec2) {
    // If face left of all edges or on edges
    let allleft = true;
    edgeWalkForEach(this.someEdge, e=>e.next, e=> {
      const [v1, v2] = e.getPoints();
      if(left(v1, v2, pt) < 0) { allleft = false; } //if right of line
    });

    return allleft;
  }

  static splitAt(edge: HalfEdge) {
    // Splits face into two faces and assign to edges
    

    let face_ab: Face;
    let face_ba: Face;

    let new_face = new Face(edge.dcel);
    edge.dcel.faces.push(new_face);
    
    // ============= Figure out which face should be on which half_edge
    if(edge.face.isInf) { //if one face is inf, need to assign it appropriately
      const ab_inner = isInnerComponent(edge);
      const ba_inner = isInnerComponent(edge.twin);

      if(ab_inner && ba_inner){
        //cant both be same
        throw(Error("splitting the face at inf cant make two inner or outer"));

      } else if (ab_inner) { // ab innner means ab gets inf face
        face_ab = edge.face;
        face_ba = new_face;
      } else { //ba_inner
        face_ab = new_face;
        face_ba = edge.face;
      }
    } else {

      face_ab = edge.face;
      face_ba = new_face;
    }

    //Assign edges to faces
    face_ab.someEdge = edge;
    face_ba.someEdge = edge.twin;
    //Assign face to edges
    edgeWalkForEach(edge,      e=>e.next, e=>{e.face = face_ab});
    edgeWalkForEach(edge.twin, e=>e.next, e=>{e.face = face_ba});
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




/* ROADMAP

// === Primitives

Point intersects face (give back inside, edge, or vertex)
Point intersects edge?
Line intersects edge? (at vert or interior?)
Line intersects face (at vert, edge, or interior?)

splitEdge(e1, p) //splits edge e1 into two edges around point p

//for ui we want:
getFeatureAtPosition([x,y], epsilon=0.01)
where epsilon is the distance within which we need to be to click on a vert/edge



// === Elsewhere:
client-side, draw half-edges, faces, verts, etc
client-side, select feature by mouse position

//UI
client-side, show debug info in box
click in new points/edges
etc

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
