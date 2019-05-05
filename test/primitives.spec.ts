import { vec2 } from "gl-matrix";
import { v2ToString } from "../src/util";
import { left, pseudoAngle, vecAngle, orientPseudoAngle, orientPseudoAngle_unrolled } from "../src/primitives";
import { assert } from "chai";


// mocha doesn't need to be imported because using mochapack???

describe('primitives', function() {
  //          +y                     |
  //          ^                      |
  //          |                      |
  //                                 |
  //      q2  yp  q1                 |
  //                                 |
  //      xm  o   xp        -> +x    |
  //                                 |
  //                                 |
  //      q3  ym  q4                 |
  //                                 |
  //                                 |
  //                                 |


  const o  = vec2.fromValues( 0, 0);
  const xm = vec2.fromValues(-1, 0);
  const xp = vec2.fromValues( 1, 0);
  const ym = vec2.fromValues( 0,-1);
  const yp = vec2.fromValues( 0, 1);

  const q1 = vec2.fromValues( 1, 1);
  const q2 = vec2.fromValues(-1, 1);
  const q3 = vec2.fromValues(-1,-1);
  const q4 = vec2.fromValues( 1,-1);


  describe('left', function() {

    it("should return 0 for collinear points", function() {
      assert.equal(left(xm,o,xp), 0);
      assert.equal(left(xp,o,xm), 0);
      assert.equal(left(ym,yp,o), 0);
      assert.equal(left(q2,o,q4), 0);
    });

    it("should return >0 for left points", function() {
      assert.isAbove(left(xm,o,q1), 0);
      assert.isAbove(left(yp,o,q1), 0);
      assert.isAbove(left(q1,q3,xp), 0);
      assert.isAbove(left(q2,xp,q1), 0);
    });
    it("should return <0 for right points", function() {
      assert.isBelow(left(o, xp, q4), 0);
      assert.isBelow(left(o,ym,q3), 0);
      assert.isBelow(left(o,yp,q4), 0);
      assert.isBelow(left(q3,yp,ym), 0);
    });
  });

  describe('pseudoangle', function() {
    it("should return 0 for points on +x", function() {
      assert.equal(pseudoAngle(1,0), 0);
      assert.equal(pseudoAngle(2,0), 0);
      assert.equal(pseudoAngle(100.5,0), 0);
    });

    it("should be 1 for +y", function() {
      assert.equal(pseudoAngle(0,10), 1);
    });
    it("should be 2 for -x", function() {
      assert.equal(pseudoAngle(-37,0), 2);
    });
    it("should be 3 for -y", function() {
      assert.equal(pseudoAngle(0, -0.5), 3);
    });
    it("should be ~4 for just below +x", function() {
      assert.isAbove(pseudoAngle(100, -0.00001), 3.99);
    });
    //TODO: fancier tests for monotonicity?
  });


  describe('vecAngle', function() {
    // given a, b, c
    // vecangle gives you the angle abc represented as a vector at the origin
    // i.e. if a,b,c in line, vecangle will be +x
    // if a c b in line, vecangle will be -x
    // if c 90* left of b, vecangle will be +y
    // if   c    
    //      a b  , then vecangle(a,b,c) will be (-1,1)
    //
    //Also the final vecangle isn't normalized, so is scaled up by
    //x^2 + y^2

    function assertVecEqual(va: vec2, vb:vec2) {
      let msg = `Expected ${v2ToString(va)} to equal ${v2ToString(vb)}`;
      assert(vec2.equals(va,vb), msg);
    }

    let xp2 = vec2.fromValues(2,0);

    it("should be +x when collinear", function() {
      assertVecEqual(vecAngle(xm,o,o), xp);
      assertVecEqual(vecAngle(xp,o,o), xp);
      assertVecEqual(vecAngle(yp,o,o), xp);
    });
    it("should be +y when 90* left turn around a", function() {
      assertVecEqual(vecAngle(xm,o,q2), yp);
      assertVecEqual(vecAngle(o,ym,xp), yp);
    });
    it("should be 1,-1 when 45* right turn around a", function() {
      assertVecEqual(vecAngle(xp,o,yp), q4);
      assertVecEqual(vecAngle(q4,o,q1), vec2.fromValues(2,-2)); 
      //q4 *2, since we're going diagonal so length is sqrt(2)
    });
  });



  describe('orientPseudoAngle', function() {
    it("should be 0 when collinear", function() {
      assert.equal(orientPseudoAngle(xm,o,xp), 0);
      assert.equal(orientPseudoAngle(q1,o,q3), 0);
    });
    it("should be 1 when right-angle left around a", function() {
      assert.equal(orientPseudoAngle(o,q1,q2), 1);
      assert.equal(orientPseudoAngle(ym,xp,xm), 1);
    });
    it("should be 3 when right-angle right around a", function() {
      assert.equal(orientPseudoAngle(o,q1,q4), 3);
      assert.equal(orientPseudoAngle(ym,o,q4), 3);
    });

  });

  describe('orientPseudoAngle_unrolled', function() {
    it("should match orientPseudoAngle for non-degenerate points", function() {
      //try 100 random points
      for(let i = 0; i < 100; i++) {
        const v1 = vec2.fromValues(Math.random(), Math.random());
        const v2 = vec2.fromValues(Math.random(), Math.random());
        const v3 = vec2.fromValues(Math.random(), Math.random());
        //skip degenerate cases
        if(vec2.equals(v1,v2) || vec2.equals(v1,v3)) { continue; }


        const a1 = orientPseudoAngle(v1,v2,v3);
        const a2 = orientPseudoAngle_unrolled(v1,v2,v3);
        const [s1, s2, s3] = [v1,v2,v3].map(v2ToString);
        const msg = `expected angles to match for ${s1} ${s2} ${s3}`;
        assert.closeTo(a1, a2, 0.000001, msg);
      }
    });
  });

});
