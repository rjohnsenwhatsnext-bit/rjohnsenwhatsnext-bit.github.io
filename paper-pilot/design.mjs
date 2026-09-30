import {createSheet,fold,flip,openCrease,addClip,flatFacets,build} from './physics/paper.mjs';
import {model,analyse,simulate,RIDER} from './physics/flight.mjs';
import {openField,scenarios} from './physics/scenarios.mjs';
// A4 upright: the nose is the top edge, the tail the bottom
export const blank=()=>createSheet();
export function apply(s,op){if(op.type==='fold'){if(s.folds.length>=24)throw Error('This sheet has reached 24 creases. Fly it, or fold a new sheet.');if(![...op.a,...op.b,...op.move].every(x=>Number.isFinite(x)&&Math.abs(x)<2))throw Error('Invalid fold');return fold(s,op);}if(op.type==='open')return openCrease(s,op.index,op.angle);if(op.type==='flip')return flip(s);if(op.type==='trim')return openCrease(openCrease(s,6,180-op.angle),7,180+op.angle);if(op.type==='ready')return ready(s,op.wings,op.tail??6);if(op.type==='clip')return addClip(s,[s.width/2,s.length-.018],.0005);throw Error('Unknown paper operation');}
export function replay(ops){if(!Array.isArray(ops)||ops.length>100)throw Error('Invalid saved design');return ops.reduce(apply,blank());}

// Fly: pick it up by the keel and the wings drop open. The last fold made on
// each side is that side's wing: open both square to the body, then pinch
// the back of each wing up 6 degrees (measured: a dart glides 5 to 1 there,
// 4.4 at 4 degrees, and dives flat), as anyone does before a
// throw. Everything else stays as the player folded it.
export function ready(s,wings,tail=6){
  let t=s;
  // 10 degrees past square: the wings sit in a shallow V (dihedral), which
  // rolls a dropped wing back level instead of letting it spiral
  for(const k of wings)if(t.folds[k])t=openCrease(t,k,100);
  if(!tail)return t;
  const depth=.03;
  for(const k of wings){
    if(!t.folds[k])continue;
    const flat=flatFacets(t),ymin=Math.min(...flat.flatMap(f=>f.poly.map(p=>p[1])));
    const f=flat.find(f=>t.facets[f.index].moved[k]&&f.poly.some(p=>p[1]<ymin+depth-1e-4));
    if(!f)continue;
    const pts=f.poly.filter(p=>p[1]<ymin+depth),m=[pts.reduce((a,p)=>a+p[0],0)/pts.length,ymin+.002];
    t=fold(t,{a:[-1,ymin+depth],b:[1,ymin+depth],move:m,layers:{flap:k}});
    // mirror wings: up is short of flat on one, past flat on the other
    t=openCrease(t,t.folds.length-1,t.folds[k].kind==='valley'?180-tail:180+tail);
  }
  return t;
}

// Lining up, the way real paper settles when you fold edge to edge (Ryan, 28
// Sep 2026: "its not going to be enjoyable if it just spirals to the ground
// every time"). A thumb cannot fold two wings to the millimetre, and a wing
// crease two degrees off spirals the plane in. So a drag that comes close to
// something worth lining up with snaps onto it:
//   1. the grabbed spot lands on a corner of the paper, or on its centre line
//   2. the crease lies on an existing crease (the second wing on the first)
//   3. otherwise a nearly straight or 45 degree crease comes straight
// Returns the fold line, where the grabbed spot lands, and what it snapped to.
const SNAP_DIST=.008,SNAP_ANGLE=6*Math.PI/180;
const mirror=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy);return [2*(a[0]+dx*t)-p[0],2*(a[1]+dy*t)-p[1]];};
const angleGap=(u,v)=>{const d=Math.abs(Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]));return Math.min(d,Math.PI-d);};
export function snapFold(sheet,p0,p1){
  let q=p1,snap=null;
  const all=flatFacets(sheet).flatMap(f=>f.poly),xs=all.map(p=>p[0]);
  const corners=[];for(const p of all)if(!corners.some(c=>Math.hypot(c[0]-p[0],c[1]-p[1])<1e-4))corners.push(p);
  let best=SNAP_DIST;
  for(const c of corners){const d=Math.hypot(c[0]-q[0],c[1]-q[1]);if(d<best&&Math.hypot(c[0]-p0[0],c[1]-p0[1])>SNAP_DIST){best=d;q=c;snap='corner';}}
  if(!snap){const mid=(Math.min(...xs)+Math.max(...xs))/2;if(Math.abs(q[0]-mid)<SNAP_DIST){q=[mid,q[1]];snap='centre';}}
  const m=[(p0[0]+q[0])/2,(p0[1]+q[1])/2],dir=[-(q[1]-p0[1]),q[0]-p0[0]];
  let a=m,b=[m[0]+dir[0],m[1]+dir[1]];
  if(!snap){
    // an existing crease close to this one, nearly parallel: fold right on it
    let bestC=null,bestD=SNAP_DIST;
    for(const f of sheet.folds){const u=[f.b[0]-f.a[0],f.b[1]-f.a[1]],l=Math.hypot(...u);if(l<1e-6||angleGap(u,dir)>SNAP_ANGLE)continue;const d=Math.abs((m[0]-f.a[0])*u[1]-(m[1]-f.a[1])*u[0])/l;if(d<bestD){bestD=d;bestC=f;}}
    if(bestC){a=bestC.a;b=bestC.b;q=mirror(p0,a,b);snap='crease';}
  }
  if(!snap){
    const ang=Math.atan2(dir[1],dir[0]),step=Math.PI/4,r=Math.round(ang/step)*step;
    if(Math.abs(ang-r)<SNAP_ANGLE){const u=[Math.cos(r),Math.sin(r)];a=[m[0]-u[0]*.5,m[1]-u[1]*.5];b=[m[0]+u[0]*.5,m[1]+u[1]*.5];q=mirror(p0,a,b);snap='straight';}
  }
  return {a,b,p1:q,snap};
}

// Trim it like a person does before the real throw: bend the tail a little,
// test it, keep what glides furthest (Ryan: "make it so it actually glides
// better"). The static estimate from analyse() picked the wrong bend for
// plain folds (5.8 m where a slight down bend flies 18 m), so each bend is
// test flown in still air from the stair top. Returns the tail bend and the
// speed it glides best at, which the throw is measured against.
const TEST_AIR={...openField,launch:{position:[0,scenarios.mansion.launch.position[1],0],speedRange:[1,14]}};
export function trimFor(s,wings){
  let best={tail:6,speed:4,distance:-1};
  for(const tail of [-6,-3,0,3,6,9,12]){
    let pl;try{pl=model(build(ready(s,wings,tail)));}catch{continue;} // a bend this paper cannot take: try the next
    const a=analyse(pl),speed=Math.min(8,Math.max(2.5,(a.glideSpeed||3.5)*1.2));
    const d=simulate(pl,{speed,pitch:0,yaw:0},TEST_AIR,{rider:RIDER}).result.distance; // with the pilot aboard, standing still
    if(d>best.distance)best={tail,speed,distance:d};
  }
  return best;
}
