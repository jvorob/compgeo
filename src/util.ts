import {vec2} from "gl-matrix"

//
//==========================
// UTILITIES


export function dom(type:string, ...contents: Array<HTMLElement | string>) {
  //Let's you write things like:
  // dom("div", ".border", "#someDiv", "Click here:",
  //   dom("a", "@href=foo.com", "I'm a link")
  // )
  //
  // outputs <div class="border" id="someDiv">Click here: <a href="foo.com">I'm a link</a></div>

  const newElm = document.createElement(type);
  contents.forEach(e => {
    if(e instanceof HTMLElement){
      newElm.appendChild(e);
    } else if(typeof e == "string") {
      if(e[0] == ".") {
        newElm.classList.add(e.slice(1))
      } else if (e[0] == "#") {
        newElm.id = e;
      } else if (e[0] == "@") {
        const match = e.match(/@([^=]+)=(.+)/) //newElm.id = e;
        if(match) {
          console.log(match);
          newElm.setAttribute(match[1], match[2]);
        }else { throw Error("Attributes should be like @key=value, failed to parse: " + e); }
      } else {
        newElm.appendChild(document.createTextNode(e));
      }
    }
  });
  return newElm;
}
(window as any).dom = dom



//generates a random point in the unit square
export function genRandomPoint(): vec2 {
  let testV = vec2.fromValues(Math.random()*2 - 1,Math.random() * 2 - 1);
  if(vec2.len(testV) > 1) { return genRandomPoint(); }
  else {return testV;}
}


export function v2ToString(v: vec2|null) { 
  if(v == null) { return "(null)"; }
  return `(${v[0].toPrecision(3)}, ${v[1].toPrecision(3)})`; }

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


export function min<T>(things: T[], scorer: (thing:T)=>number) {
  if(things.length == 0){ throw Error("min called on empty array"); }

  let best_thing = things[0];
  let best_score = scorer(things[0]);

  for(let i = 1; i < things.length; i++) {
    let score_i = scorer(things[i]);

    if(score_i < best_score) 
      { best_thing = things[i]; best_score = score_i; }
  }

  return best_thing;
}

export function max<T>(things: T[], scorer: (thing:T)=>number) {
  return min(things, (x) => -1 * scorer(x));
}
