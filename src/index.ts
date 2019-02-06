import { beep } from "./test";
import { MyCanvas } from "./lib";
import { vec2 } from "gl-matrix";

let globalCanvas: MyCanvas;
console.log("Loaded main");

//show some debug points
initCanvas("canvas");
//testFun();
testGiftWrap();


//generates a random point in the unit square
function genRandomPoint(): vec2 {
  let testV = vec2.fromValues(Math.random()*2 - 1,Math.random() * 2 - 1);
  if(vec2.len(testV) > 1) { return genRandomPoint(); }
  else {return testV;}
}

function initCanvas(htmlid: string) {
  let el: HTMLCanvasElement = document.getElementById(htmlid) as HTMLCanvasElement;
  globalCanvas = new MyCanvas(el);
}

export function testFun() {
  let canv = globalCanvas;



  //=======================
  // Assorted tests
  
  let center = genRandomPoint();
  //let center = vec2.fromValues(0,0);
  let dir = genRandomPoint();
  let test = genRandomPoint();
  canv.putPoint(center, 8, "black");
  canv.putPoint(dir, 4, "black");


  //const labelling = "rightleft";
  let labelling = "angle";
  for(let i = 0; i < 200; i++) {
      let p = genRandomPoint();
      let style = "black";

      if(labelling == "rightleft") {
        style="red"
        let rightness = right(center,dir,p);
        if(rightness > 0) {
            style = "blue"; //`rgb(0,125,${Math.floor(rightness * 340)})`;
            //console.log(style);
        }
      } else if(labelling == "angle") {
        let angle = orientPseudoAngle(center, dir, p);
        if(angle > 2) {
          style = `rgb(${Math.floor((angle-2) / 2 * 255)},0,0)`;
        } else {
          style = `rgb(0,0,${Math.floor((2 - angle) / 2 * 255)})`;
        }
      }
      canv.putPoint(p, 2, style);
  }

}


function testGiftWrap() {
  let points: vec2[] = [];
  for(let i = 0; i < 60; i++) {
    points.push(genRandomPoint());
  }

  let pointsCopy = points.slice();

  console.time("giftwrap");
  let hull = giftWrap(pointsCopy);
  (console as any).timeEnd("giftwrap");

  // ======== DRAW POINTS
  points.forEach(v => globalCanvas.putPoint(v, 2, "red"));
  hull.forEach(  v => globalCanvas.putPoint(v, 2));
  for(let i = 1; i < hull.length; i++) {
    globalCanvas.putLine(hull[i-1], hull[i]);
  }
}

//==========================
// UTILITIES

function v2ToString(v: vec2) { return `(${v[0].toPrecision(3)}, ${v[1].toPrecision(3)})`; }
function pointListToString(v: vec2[]) {
  return `List (n=${v.length}):\n` + v.map(v2ToString).join("\n") + ";";
}


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
//since we have +x right and +y down, this will actually be a right operator
function right(a: vec2, b: vec2, c:vec2) {
 return (c[1] - a[1]) * (b[0] - a[0])  - 
        (c[0] - a[0]) * (b[1] - a[1]);
}

//as in right(), returns a vector representing the angle difference from AB to AC
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

// returns pseudoangle of a vector x,y
// pseudoangle is [0,4) on angle = [0,2pi)
function pseudoAngle(x: number, y:number) {
  let p = x / (Math.abs(x) + Math.abs(y)); //-1 to 1 on +y (-1 at +x, 1 at -x)
  if( y >= 0 ) {
    return 1 - p;// (0 at +x, up to 2 at -x)
  } else {
    return p + 3; //2 at -x, up to 4 at +x
  }
}

function orientPseudoAngle(a: vec2, b: vec2, c: vec2) {
  //let v = vecAngle(a,b,c);
  //return pseudoAngle(x, y);
  
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


function giftWrap(points: vec2[]) {
  // step 1: find top rightmost point to start with
  // step 2: tangent is right, find smallest angle point w/r to +x
  // step n: now we have 2 points
  
  //sort first by y, then x
  points.sort((a,b) => {
    if(a[0] != b[0]) {
      //big is bottom
      return a[1] - b[1]
    } else {
      // big is left
      return -1*(a[0] - b[0]);
    }
  })

  //grab top-rightmost
  let start = points.shift();


  let last
  //console.log(points);


  // takes the last two points, 
  // takes the vector from last2 to last1,
  // finds the next closest by angle turning i-wards (CW) around last1
  // TODO: throws if points on wrong side
  // pops found point and returns it
  function wrapNext(last2: vec2, last1: vec2) {
    //orientpseudoangle wants the vector pointing forward from the center point
    let tangent = vec2.create();
    vec2.subtract(tangent, last1, last2); //diff
    vec2.add(tangent, tangent, last1); //tangent is last2 reflected across last1

    //sort remaining points by angle from tangent
    //TODO: extract min instead of sorting
    //console.log("WRAPNEXT");

    let bestAngle = 999;
    let bestInd = -1;
    for(let i = 0; i < points.length; i++) {
      const angle = orientPseudoAngle(last1, tangent, points[i]);
      if(angle < bestAngle) {
        bestAngle = angle;
        bestInd = i;
      }
    }

    //console.log(v2ToString(last2), v2ToString(last1));
    //console.log(pointListToString(points));

    //first point is just right of the tangent
    let [nextPoint] = points.splice(bestInd, 1); //take out 1
    return nextPoint;
  }

  //======== Start with just our start point, tangent coming in from the left
  //
  let hull = [start];
  //TODO: improve robustness for large points
  //start as if we'd come in from the left
  let preStart = vec2.fromValues( start[0] - 1, start[1])
  hull.push(wrapNext(preStart, start));

  // ===== loop grabbing more points
  let goingDown = true; //make sure we dont go around multiple times
  while(true) {
    //console.log("Hull points: " + pointListToString(hull));

    //test end condition: out of points
    if(points.length == 0) { 
      console.log("END: Out of points");
      hull.push(start);
      break; }

    const secondLast = hull[hull.length - 2];
    const last = hull[hull.length - 1];

    let nextPoint = wrapNext(secondLast, last);
    //console.log("Next Point: " + v2ToString(nextPoint));

    // === TEST CLOSURE
    //if last->next is right of last->start
    if(right(last, start, nextPoint) > 0) {
      //close the hull TODO TEMP
      hull.push(start);
      points.push(nextPoint); //put it back, we didnt use it TODO
      console.log("CLOSED!");
      break;
    }
    
    // === TEST SLOPE
    let diff = vec2.create();
    vec2.sub(diff, nextPoint, last);
    //is diff sloping down?
    if(goingDown && diff[1] < 0) {
      console.log("HIT INFLECTION: going back up");
      goingDown = false;
    }
    if(!goingDown && diff[1] >= 0){
      console.log("END: sloping down");
      points.push(nextPoint); //put it back, we didnt use it TODO
      break;
    }


    hull.push(nextPoint);
  }

  return hull;
}
