import { assert } from "chai";
// mocha doesn't need to be imported because using mochapack???

// ====== Other imports
import { vec2 } from "gl-matrix";
import { v2ToString } from "../src/util";
//import { left, pseudoAngle, vecAngle, orientPseudoAngle, orientPseudoAngle_unrolled } from "../src/primitives";
import { isInnerComponent, DCEL, HalfEdge, Vertex, Face } from "../src/dcel";





// ================= Util Functions


type Elem = Vertex | HalfEdge | Face;
// Mocha hangs weirdly if you try to compare the actual objects
function assertElemEqual(a: Elem, b: Elem, note="") {
  let str_a = a&&a.toString();
  let str_b = b&&b.toString();
  assert.equal(str_a, str_b, note);
}
function assertElemNotEqual(a: Elem, b: Elem, note="") {
  let str_a = a&&a.toString();
  let str_b = b&&b.toString();
  assert.notEqual(str_a, str_b, note);
}

// =======================================================================
//
//               Tests that don't need a big graph to work with
//
// =======================================================================

describe("dcel", function() {

  describe("initialize", function() {
    const dcel = new DCEL();
    dcel.initializeBox();

    it("should have 4 verts, each with an edge away", function() {
      assert.equal(dcel.verts.length, 4, "length should be 4");
      assert.equal(dcel.verts.length, 4, "length should be 4");
    });

    it("should have 4 edges on an inner ring, 4 on an outer", function() {
    });
  });

  describe("toId", function() {
    const dcel = new DCEL();
    dcel.initializeBox();

    it("should be e00 for first edge", function() {
      assert.equal(dcel.toId(dcel.edges[0]),"e00");
    });
    it("should be v01 for second very", function() {
      assert.equal(dcel.toId(dcel.verts[1]),"v01");
    });
  });

});



// =======================================================================
//
//                     TESTS WITH A HANDMADE DCEL
//
// =======================================================================

describe("dcel with test graph", function() {
  let v: Vertex[] = [];
  let e: HalfEdge[] = [];
  let f: Face[] = [];
  let dcel: DCEL;

  //
  beforeEach(function() {
    // Sets up DCEL as in pic below


    const r = 0.8;

    dcel = new DCEL();
    v=[];
    e=[];
    f = dcel.faces;

    v[0] = new Vertex( r, r, dcel);
    v[1] = new Vertex(-r, r, dcel);
    v[2] = new Vertex(-r,-r, dcel);
    v[3] = new Vertex( r,-r, dcel);
    v[4] = new Vertex(-r, -2*r, dcel); // Out of the box

    for(let i=0;i<6;i++) {e[i] = new HalfEdge(dcel);}

    //add to dcel
    for(let i = 0; i < v.length; i++){dcel.verts.push(v[i]);}
    for(let i = 0; i < e.length; i++){dcel.edges.push(e[i]);}

    // ========= Link verts to edges
    e[1].origin = v[0];
    e[3].origin = e[0].origin = v[1];
    e[2].origin = e[5].origin = v[2];
    e[4].origin = v[3];
    v[0].someEdgeAway = e[1];
    v[1].someEdgeAway = e[0];
    v[2].someEdgeAway = e[2];
    v[3].someEdgeAway = e[4];

    // ======== Link edges to face at inf
    f[0].someEdge = e[0];
    e.forEach(e => e.face = f[0]);
    

    // ============= Link edges to each other
    function twinEdges(e1:HalfEdge, e2: HalfEdge) {
      //connects twin pointers for e1 and e2
      e1.twin = e2; e2.twin = e1; }

    function linkEdges(e1:HalfEdge, e2: HalfEdge) {
      //connects next and prev pointers for e1->e2
      e1.next = e2; e2.prev = e1; }

    twinEdges(e[0],e[1]);
    twinEdges(e[2],e[3]);
    twinEdges(e[4],e[5]);

    linkEdges(e[1],e[3]);
    linkEdges(e[3],e[5]);
    linkEdges(e[5],e[4]);
    linkEdges(e[4],e[2]);
    linkEdges(e[2],e[0]);
    linkEdges(e[0],e[1]);


    //TODO: setup faces
  });


  // ALMOST-BOX SHAPED DCEL
  //                                                |
  //                      e0>                       |
  //             v1 - - - - - - -  v0               |
  //              |      <e1                        |
  //            ^                                   |
  //            e2|e3                               |
  //               v                                |
  //              |                                 |
  //                       e5>                      |
  //             v2 - - - - - - -  v3               |
  //                     <e4                        |
  //                                                |
  //                                                |
  //             v4                                 |


  describe("toString", function() {
    it("should give a text description of the DCEL", function() {
      //console.log(dcel.toString());
      assert.isString(dcel.toString()); //DUMMY TEST
    });
  });

  describe("toStringElem", function() {
    it("should give a long string description of edges", function() {
      const expected = "[e00: o=v01, t=e01, n=e01, p=e02, f=f00]";
      assert.equal(dcel.toStringElem(e[0]), expected);
    });
    it("should give a long string description of vertices", function() {
      const [x, y] = [v[2].v[0], v[2].v[1]]; //x and y coords
      const expected = `[v02: (${x.toFixed(2)},${y.toFixed(2)}), e=e02]`;
      assert.equal(dcel.toStringElem(v[2]), expected);
    });
  });

  describe("getHalfEdgeHittingRay", function() {
    it("should give null if no edges", function() {
      let e_in = dcel.getHalfEdgeHittingRay(v[4],v[2]);
      assertElemEqual(e_in, null);
    });
    it("should give the incoming edge if only 1", function() {
      let e_in = dcel.getHalfEdgeHittingRay(v[3],v[0]);
      assertElemEqual(e_in, e[5]);
    });
    it("should give the edge whose next would the new edge a->b", function() {
      let e_in = dcel.getHalfEdgeHittingRay(v[2],v[0]);
      assertElemEqual(e_in, e[3]);
    });
  });


  describe("insertEdge between existing points", function() {

    let e_new: HalfEdge;
    beforeEach(function() {
      e_new = dcel.insertEdge(v[0], v[3]);
    });

    it("should return an edge directed a to b", function() {
      assertElemEqual(e_new.origin, v[0]);
      assertElemEqual(e_new.next.origin, v[3]);
    });

    it("should have a twin", function() {
      assertElemNotEqual(e_new.twin, e_new);
      assertElemEqual(e_new.twin.twin, e_new);
    });

    it("twin should be directed b to a", function() {
      assertElemEqual(e_new.twin.origin, v[3]);
      assertElemEqual(e_new.twin.next.origin, v[0]);
    });

    it("should work correctly with walking the nodes", function() {
      let start = e_new;
      let count = 0;
      for(let e = start;; e = e.next) {
        assertElemNotEqual(e, start.twin, "shouldn't encounter twin when walking around inside");
        count++;
        if(e.next == start) {break;}
      }
      assert.equal(count, 4, "we should encounter 4 nodes on the inside");

      start = e_new.twin
      count = 0;
      for(let e = start;; e = e.next) {
        assertElemNotEqual(e, start.twin, "shouldn't encounter e_new when walking around outside");
        count++;
        if(e.next == start) {break;}
      }
      assert.equal(count, 4, "we should encounter 4 nodes on the outside");
    });
  });

  describe("insertEdge to point on the outside", function() {
    it("should insert an edge directed a to b where b empty", function() {
      let e_new = dcel.insertEdge(v[2], v[4]);

      assertElemEqual(e_new.origin, v[2], "edge goes a to b");
      assertElemEqual(e_new.next.origin, v[4], "edge goes a to b");

      assertElemEqual(e_new.twin.origin, v[4], "twin goes b to a");
      assertElemEqual(e_new.twin.next.origin, v[2], "edge goes b to a");

      assertElemEqual(v[4].someEdgeAway, e_new.twin, "should add edge to new point");
    });


    it("should also work b to a where b empty", function() {
      let e_new = dcel.insertEdge(v[4], v[2]).twin; //e_new goes towards v[4]

      assertElemEqual(e_new.origin, v[2], "edge goes a to b");
      assertElemEqual(e_new.next.origin, v[4], "edge goes a to b");

      assertElemEqual(e_new.twin.origin, v[4], "twin goes b to a");
      assertElemEqual(e_new.twin.next.origin, v[2], "edge goes b to a");

      assertElemEqual(v[4].someEdgeAway, e_new.twin, "should add edge to new point");
    });
  });




  describe("face methods", function() {
    describe("isInnerComponent", function() {
      it("should work", function(){
        assert.isTrue(isInnerComponent(e[0]), "test graph is innercomp");
      });
      it("should work if we close the graph", function(){
        dcel.insertEdge(v[0],v[3]);
        assert.isFalse(isInnerComponent(e[1]), "closed test graph has outercomp");
        assert.isTrue(isInnerComponent(e[0]), "closed test graph has innercomp");
      });
    });
  });
});
