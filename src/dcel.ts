import { vec2 } from "gl-matrix";
import { left, orientPseudoAngle } from "./primitives";
import { intStrZeroPad } from "./util";

export class DCEL {
  public verts: Vertex[] = [];
  public edges: HalfEdge[] = [];
  public faces: Face[] = [];

  constructor() {
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
      msg = `[${shortcode}]`; //TODO make this better

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
    if(e_away == null) {
      //No edges at point
      return null;
    }

    const first_e_towards = e_away.prev;



    // We want to walk all incoming vectors, and find the one with min angle relative to a->b
    // (immediately left of b)


    let curr_e = first_e_towards; //edge pointing towards Va
    let best_e = curr_e;
    let min_angle = orientPseudoAngle(Va.v, Vb.v, curr_e.origin.v);  //pseudoangle is always 0..4

    //console.log("halfEdgeHitting ray, found some edges, starting at " + curr_e.toString());
    while(true) {
      let e_angle = orientPseudoAngle(Va.v, Vb.v, curr_e.origin.v);
      //get pseudoangle from VaVb ccw towards e
      //falls in range 0-2 is left, 2-4 is right
      //we want the largest pseudoangle


      //console.log("STEP: =======");
      //console.log(`e: ${curr_e.toString()}, ang: ${e_angle} | best:${best_e.toString()}, ${min_angle}`);

      //keep track of min
      if(e_angle <= min_angle) 
      { best_e = curr_e; min_angle = e_angle; }

      //move to next e or terminate
      curr_e = curr_e.next.twin;
      if(curr_e == first_e_towards) 
      { break; }
    } 

    //console.log("DONE!");
    //console.log(`best:${best_e.toString()}, ${min_angle}`);

    return best_e;
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
    // TODO !!!!
    // walk from E_ab. If we run into E_ba before coming around, then faces are connected
    // else need to split

    // ====== Insert into arrays
    this.edges.push(E_ab);
    this.edges.push(E_ba);

    return E_ab;

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
}

export class Face {
  public outerComponent: HalfEdge | null;
  // public readonly innerComponents: HalfEdge[]; //Voronoi diagram won't have holes
  
  //when putting in constructor, make it have a dcel
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




/*

splitEdge(e1, p) //splits edge e1 into two edges around point p




insertEdgeToNewPoint(

insertEdge(p1, p2)
insertEdge(e1, e2) //use origin of edges

insertEdge(p1,p2) {
  //

  e12 = new HEdge(p1);
  e21 = new HEdge(p2);
}

 */


  /*
 TRAVERSAL INVARIANTS

 next(e) != e //no edge to itself

 next(e) goes ccw around face
 next(e) goes cw around hole (interior face)

 twin(next(e_toward))) = toward, // goes CW around point
 next(twin(e_toward)) !! WRONG

 next(twin(e_away)) = away, // goes CW around point
   */
