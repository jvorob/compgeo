import { vec2 } from "gl-matrix";


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
 return (c[1] - a[1]) * (b[0] - a[0])  - 
        (c[0] - a[0]) * (b[1] - a[1]);
}




// returns pseudoangle of a vector x,y
// pseudoangle is [0,4) on angle = [0,2pi)
export function pseudoAngle(x: number, y:number) {
  let p = x / (Math.abs(x) + Math.abs(y)); //-1 to 1 on +y (-1 at +x, 1 at -x)
  if( y >= 0 ) {
    return 1 - p;// (0 at +x, up to 2 at -x)
  } else {
    return p + 3; //2 at -x, up to 4 at +x
  }
}

//as in left(), returns a vector representing the angle difference from AB to AC
//(multiplied by x^2 + y^2)
function vecAngle(a: vec2, b: vec2, c:vec2) {
  let x = (c[0] - a[0]) * (b[0] - a[0]) +
          (c[1] - a[1]) * (b[1] - a[1]);

  let y = (c[1] - a[1]) * (b[0] - a[0]) - 
          (c[0] - a[0]) * (b[1] - a[1]);

  //console.log("VECANGLE ====");
  //console.log(a);
  //console.log(b);
  //console.log(c);
  //console.log(x, y);
  //console.log("VECANGLE END ====");
  return vec2.fromValues(x,y);
}

export function orientPseudoAngle(a: vec2, b: vec2, c: vec2) {
  /* Returns oriented pseduoangle from AB to AC 
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
  const x = (c[0] - a[0]) * (b[0] - a[0]) +
          (c[1] - a[1]) * (b[1] - a[1]);

  const y = (c[1] - a[1]) * (b[0] - a[0]) - 
          (c[0] - a[0]) * (b[1] - a[1]);

  // COPIED FROM pseudoAngle
  let p = x / (Math.abs(x) + Math.abs(y)); //-1 to 1 on +y (-1 at +x, 1 at -x)
  //let p = x / ((x>=0?x:-x) + (y>=0?y:-y)); //-1 to 1 on +y (-1 at +x, 1 at -x)
  if( y >= 0 ) {
    return 1 - p;// (0 at +x, up to 2 at -x)
  } else {
    return p + 3; //2 at -x, up to 4 at +x
  }
}
