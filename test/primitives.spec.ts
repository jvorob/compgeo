import { vec2 } from "gl-matrix";
import { left } from "../src/primitives";
import { assert } from "chai";

// mocha doesn't need to be imported because using mochapack???

describe('left', () => {
  it("should return 0 for collinear points", () => {

    const a = vec2.fromValues(0,0);
    const b = vec2.fromValues(1,0);
    const c = vec2.fromValues(2,0);

    const cl = vec2.fromValues(2,1);
    const cr = vec2.fromValues(2,-1);


    assert(left(a,b,c) == 0);
  });
  it("should return >0 for left points", () => {

    const a = vec2.fromValues(0,0);
    const b = vec2.fromValues(1,0);
    const c = vec2.fromValues(2,0);

    const cl = vec2.fromValues(2,1);
    const cr = vec2.fromValues(2,-1);


    assert(left(a,b,cl) > 0);
  });
  it("should return <0 for right points", () => {

    const a = vec2.fromValues(0,0);
    const b = vec2.fromValues(1,0);
    const c = vec2.fromValues(2,0);

    const cl = vec2.fromValues(2,1);
    const cr = vec2.fromValues(2,-1);


    assert(left(a,b,cr) < 0);
  });
});
