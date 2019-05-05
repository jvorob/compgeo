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

    let e1 = new HalfEdge();
    let e2 = new HalfEdge();
    e1.next = e2;
    e1.prev = e2;
    e1.twin = e2;
    e1.origin = v1;
    v1.someEdgeAway = e1;

    e2.next = e1;
    e2.prev = e1;
    e2.twin = e1;
    e2.origin = v2;
    v2.someEdgeAway = e2;

    this.edges.push(e1);
    this.edges.push(e2);

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
