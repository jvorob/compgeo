import { vec2 } from "gl-matrix";
import { left, orientPseudoAngle } from "./primitives";

export class DCEL {
  public verts: Vertex[] = [];
  public edges: HalfEdge[] = [];
  public face: Face[] = [];

  constructor() {
  }

  //Sets up DCEL for initial box
  initializeBox() {
    let v1, v2, v3, v4: Vertex;
    let r = 0.8;

    v1 = new Vertex(-r, r);
    v2 = new Vertex( r, r);
    v3 = new Vertex( r,-r);
    v4 = new Vertex(-r,-r);

    this.verts.push(v1);
    this.verts.push(v2);
    this.verts.push(v3);
    this.verts.push(v4);


    this.insertEdge(v1,v2);
    this.insertEdge(v2,v3);
    this.insertEdge(v3,v4);
    this.insertEdge(v4,v1);

    console.log(this.getHalfEdgeHittingRay(v3,v4))
    console.log(this.getHalfEdgeHittingRay(v1,v4))

  }

  getHalfEdgeHittingRay(Va: Vertex, Vb: Vertex): HalfEdge|null {
  // Looks at all half-edges around Va. 
  // Finds the half-edge whose next would be ray Va->Vb
  // If no edges, return null
  // Returns the half-edge pointing at Va
    
    const e_away = Va.someEdgeAway;
    if(e_away == null) {
      //No edges at point
      return null;
    }
    
    const first_e_towards = e_away.prev;


    let e = first_e_towards; //edge pointing towards Va

    let best_e = e;
    let min_angle = 5;  //pseudoangle is always 0..4

    while(true) {
      let e_angle = orientPseudoAngle(Va.v, Vb.v, e.origin.v);
      //get pseudoangle from VaVb ccw towards e
      //falls in range 0-2 is left, 2-4 is right
      //we want the smallest pseudoangle
      
      //keep track of min
      if(e_angle < min_angle) 
        { best_e = e; min_angle = e_angle; }

      //move to next e or terminate
      e = e.next.twin;
      if(e == first_e_towards) 
        { break; }
    } 

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
    let E_ab = new HalfEdge();
    let E_ba = new HalfEdge();

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
        Va.someEdgeAway = E_ab; //Also need to add edge to formerly-empty point
        
      } else { //link things up normally
        linkEdges(new_towards, incoming_edge.next);
        linkEdges(incoming_edge, new_away);
      }
    }

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

  constructor(x: number, y:number) {
    this.v = vec2.fromValues(x,y);
    this.someEdgeAway = null;
  }
}

export class HalfEdge {
  public origin: Vertex;
  public next: HalfEdge;
  public prev: HalfEdge;
  public twin: HalfEdge;

  public face: Face;

  constructor() {
  }
}

export class Face {
  public outerComponent: HalfEdge | null;
  // public readonly innerComponents: HalfEdge[]; //Voronoi diagram won't have holes
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
