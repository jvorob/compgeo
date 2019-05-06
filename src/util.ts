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

export function  intStrZeroPad(n: number, width:number) {
  //Zero pad up to width 32;
  const nstr = n.toFixed(0); //take integer portion to string
  const pad_amount = Math.max(0, width - nstr.length);
  if(pad_amount > 32) {
    throw Error("intStrZeroPad doesn't work past 32 zeroes"); //TODO fix this 
  }
  const zeroes = "00000000000000000000000000000000";
  return zeroes.slice(0,pad_amount) + nstr;
}
