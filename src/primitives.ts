import { vec2 } from "gl-matrix";
import {v2ToString } from "./util";


//might want these different sometime?
export const DIST_EPSILON = 0.00001; //32-bit floats have ~6 decimal digits of precision
export const CALC_EPSILON = 0.00001; //This might be ok as long as we're near the unit square


//given 3 points ABC
//(relative to vector A->B, is C left of it
//shift A to origin (subtract)
//
//then rotate B to +x axis 
//if B = (x,y), multiply by 
//
//   ( x y)
//   (-y x) * (1/x^2+y^2)
//
//look at C-A
//
//if C = (c1,c2)
//scaled and rotated is : (c0-a0) * x + (c1-a1)*y , (c1-a1)*x - (c0-a0)*y
//look at just y coord
//
//this will be positive when AC is rotated +x->+y from AB

export function left(a: vec2, b: vec2, c:vec2) {
  // returns + if c left of a->b (since coords go clockwise)
  return (c[1] - a[1]) * (b[0] - a[0])
    -    (c[0] - a[0]) * (b[1] - a[1]);
}


export function pointsClose(a: vec2, b: vec2) {
  return vec2.dist(a,b) < DIST_EPSILON;
}

export function distPointToLine(pt: vec2, a: vec2, b:vec2){
  // Returns the perpendicular distance of pt to line ab
  // left test gives signed distance, except its multiplied by a factor of len(b-a)
  // need to divide by len(b-a) = sqrt(x^2 + y^2)
  const squaredLen = (b[0]-a[0])*(b[0]-a[0])  +  (b[1]-a[1])*(b[1]-a[1]);
  return Math.abs(left(a,b,pt)) / Math.sqrt(squaredLen);
}

export function distPointToSeg(pt: vec2, a: vec2, b:vec2){
  // Returns the distance of pt to segment ab
  //      a_ line  |      |
  //  pt  |   dist |  pt  |
  //  dst a--------b  dst |
  //      |        |      |
  //      |        b_     |

  const a_ = pointRelToVector(a,b,0,1);
  const b_ = pointRelToVector(b,a,0,1);

  //first check if we're past either endpoint of the line
  if(left(a,a_,pt) > 0) { return vec2.dist(a,pt); }
  if(left(b,b_,pt) > 0) { return vec2.dist(b,pt); }

  //else, we're in the middle section
  return distPointToLine(pt, a, b);
}



export function segmentIntersectLine(s_a: vec2, s_b: vec2, l_a: vec2, l_b: vec2): vec2 | null {
  //if segment intersects line, return the point where it happened
  //else return null including if the endpoints intersect the line
  //
  //may return a point if line intersects endpoint of segment
  //          |           |
  // sa ------+-- sb      |
  //          |           |
  //          | line      |

  const a_left = left(l_a, l_b, s_a);
  const b_left = left(l_a, l_b, s_b);

  if(Math.abs(a_left) < CALC_EPSILON) { return vec2.clone(s_a); }
  if(Math.abs(b_left) < CALC_EPSILON) { return vec2.clone(s_b); }

  //Line properly intersects segment
  if((a_left > 0 && b_left < 0) ||
    (a_left < 0 && b_left > 0))
    { return lineIntersectLine(s_a, s_b, l_a, l_b); }

  return null;
}


export function lineIntersectLine(a: vec2, b: vec2,    c: vec2, d: vec2): vec2 | null {
  // If lines intersect, return point of intersection
  // If degenerate (parallel) return null;
  // l1: two points a and b
  // l2: two points c and d
  //
  // if we transform c,d  such that a->(0,0), b->(1,0)
  // then we want x_intercept(c',d')
  // in the a,b coordinate system, x_interp = t where t = -c'.y / (d'.y-c'.y)
  //

  const c_ = getCoordRelToVector(a,b, c);
  const d_ = getCoordRelToVector(a,b, d);

  const x_intercept_rel_ab = lineIntersectXAxis(c_, d_);
  if(x_intercept_rel_ab == null) { return null; }
  return pointRelToVector(a,b, x_intercept_rel_ab, 0); //transform back to worldspace
}

export function lineIntersectXAxis(a: vec2, b: vec2): number | null {
  //if line intersects x-axis: return x-intercept
  //if parallel to x-axis: return 0
  if(Math.abs(a[1] - b[1]) < CALC_EPSILON) { return null; }
  if(Math.abs(a[0] - b[0]) < CALC_EPSILON) { return a[0]; }

  //x-intercept = a.x - a.y (1/m)
  //where m = (b.y-a.y)/(b.x-a.x)

  const m_recip = (b[0] - a[0]) / (b[1] - a[1]);
  return a[0] - a[1]*m_recip;
}





// returns pseudoangle of a vector x,y
// pseudoangle is [0,4) on angle = [0,2pi)
// throws on 0,0
export function pseudoAngle(x: number, y:number) {
  if(x == 0 && y == 0) { throw Error("pseudoAngle(0,0) is undefined"); }
  //TODO: make this more catchable?


  let p = x / (Math.abs(x) + Math.abs(y)); //-1 to 1 on +y (-1 at +x, 1 at -x)
  if( y >= 0 ) {
    return 1 - p;// (0 at +x, up to 2 at -x)
  } else {
    return p + 3; //2 at -x, up to 4 at +x
  }
}

//as in left(), returns a vector representing the angle difference from AB to AC around A
//(multiplied by x^2 + y^2)
//Translates B and C by -A so both are relative to A
//Rotates (B-A) to x-axis and (C-A) with it
//Now angle from x-axis to C is angle from AB to AC
export function vecAngle(a: vec2, b: vec2, c:vec2) {
  let x = (c[0] - a[0]) * (b[0] - a[0]) 
    +     (c[1] - a[1]) * (b[1] - a[1]);

  let y = (c[1] - a[1]) * (b[0] - a[0])
    -     (c[0] - a[0]) * (b[1] - a[1]);

  //console.log("VECANGLE ====");
  //console.log(a);
  //console.log(b);
  //console.log(c);
  //console.log(x, y);
  //console.log("VECANGLE END ====");
  return vec2.fromValues(x,y);
}

export function orientPseudoAngle(a: vec2, b: vec2, c: vec2) {
  /* Returns oriented pseduoangle from AB to AC around A
   * (a,b,c collinear is 0, 
   * c left of ab is 0,180 
   * c right of ab is 180,360)
   *
   * returns number in range [0,4]
   */
  let v = vecAngle(a,b,c);
  return pseudoAngle(v[0], v[1]);
}

export function orientPseudoAngle_unrolled(a: vec2, b: vec2, c: vec2) {

  // UNROLLED
  //COPIED FROM vecANGLE
  const x = (c[0] - a[0]) * (b[0] - a[0])
    +       (c[1] - a[1]) * (b[1] - a[1]);

  const y = (c[1] - a[1]) * (b[0] - a[0])
    -       (c[0] - a[0]) * (b[1] - a[1]);

  // COPIED FROM pseudoAngle
  let p = x / (Math.abs(x) + Math.abs(y)); //-1 to 1 on +y (-1 at +x, 1 at -x)
  //let p = x / ((x>=0?x:-x) + (y>=0?y:-y)); //-1 to 1 on +y (-1 at +x, 1 at -x)
  if( y >= 0 ) {
    return 1 - p;// (0 at +x, up to 2 at -x)
  } else {
    return p + 3; //2 at -x, up to 4 at +x
  }
}


export function rotate90CCW(a: vec2): vec2 {
  // R:  [0  -1]
  // R:  [1   0]
  //(x,y) => (-y,x)
  return vec2.fromValues(-a[1], a[0]);
}

export function pointRelToVector(a: vec2, b:vec2, forward:number, left:number): vec2 {
  //returns the vector (forward, left) in the coordinate space defined by a and b
  //(0,0) is a 
  //(1,0) is b
  //(0.5,0) is the midpoint
  //
  //(0,1) is 90 deg left of a, at the same distance is b
  //(0,-1) is 90 deg right of b
  //e.g.:
  //
  //                                 |
  //     0,1             b 1,0       |
  //         \         /             |
  //          \     .5,0             |
  //           \    /                |
  //             a                   |
  //            0,0       .5,-.5     |
  //                                 |
  //                                 |

  const v_forward = vec2.fromValues(b[0] - a[0], b[1] - a[1]);
  const v_left    = vec2.fromValues(a[1] - b[1], b[0] - a[0]);// (-y, x)


  const result = vec2.create();
  //result = (f * v_forward + l * v_left) + a
  vec2.scaleAndAdd(result, result, v_forward, forward);
  vec2.scaleAndAdd(result, result, v_left, left);
  vec2.scaleAndAdd(result, result, a, 1);
  return result;
}

export function getCoordRelToVector(rel_a:vec2, rel_b: vec2, v: vec2) {
  // expresses v in coordinate system around rel_a, rel_b
  // v == rel_a: returns (0,0)
  // v == rel_b: returns (1,0)
  // v 90* CCW of rel_b around rel_a: returns (0,1)
  //
  // transform rel_a to origin, then do rotation around b using rotateToUnit
  let v_rel_a = vec2.fromValues(    v[0] - rel_a[0],     v[1] - rel_a[1]);
  let b_rel_a = vec2.fromValues(rel_b[0] - rel_a[0], rel_b[1] - rel_a[1]);

  const v_rel_b_rel_a = rotateToUnit(b_rel_a, v_rel_a);
  //Now v = rel_a goes to 0,0
  //v = rel_B goes to 0,1, so we're done
  return v_rel_b_rel_a;
}

export function rotateToUnit(relTo: vec2, v: vec2) {
  // expresses v in coordinate system around rel_a, rel_b
  // v == rel: returns (1,0)
  // v 90* CCW of rel: returns (0,1)
  //
  //To put relTo at (0,1), multiply by rotation matrix:
  //   ( x y)
  //   (-y x) * (1/x^2+y^2)
  //


  const len_sqr = relTo[0]*relTo[0] + relTo[1]*relTo[1];

  //now transform v
  const v_x = (relTo[0] * v[0] + relTo[1] * v[1]) / len_sqr;
  const v_y = (-relTo[1] * v[0] + relTo[0] * v[1]) / len_sqr;

  return vec2.fromValues(v_x, v_y);
}

// new primitives:
// point intersects line
// point intersects segment
// point in face
//
// point within eps of point
// point within eps of line
// 
