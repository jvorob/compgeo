import {vec2} from "gl-matrix"

//
//==========================
// UTILITIES


//generates a random point in the unit square
export function genRandomPoint(): vec2 {
  let testV = vec2.fromValues(Math.random()*2 - 1,Math.random() * 2 - 1);
  if(vec2.len(testV) > 1) { return genRandomPoint(); }
  else {return testV;}
}


export function v2ToString(v: vec2) { return `(${v[0].toPrecision(3)}, ${v[1].toPrecision(3)})`; }
function pointListToString(v: vec2[]) {
  return `List (n=${v.length}):\n` + v.map(v2ToString).join("\n") + ";";
}
