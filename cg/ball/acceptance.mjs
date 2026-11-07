import assert from 'node:assert/strict';
import game from './game.js';
const make=(W=360)=>{const data=new Map();return game.create({W,H:780,store:{get:(k,d)=>data.get(k)??d,set:(k,v)=>data.set(k,v)},setScore(){},sfx(){},buzz(){},end(){}});};
// A real route, ordinary steering + one tap. No state mutation or teleporting.
for(const hz of [30,60,120]){
 const g=make();g.pointerDown(55,650,1);g.pointerMove(95,650,true,1);let jumped=false,won=false;
 for(let i=0;i<hz*25;i++){
  const s=g.peek();if(!jumped&&s.ball.x>23.8){g.pointerDown(300,650,2);g.pointerUp(300,650,2);jumped=true;}
  if(s.taken===4&&s.ball.x>44)g.pointerMove(55+40*Math.max(-1,Math.min(1,(47.5-s.ball.x)*2-s.ball.vx*.8)),650,true,1);
  g.update(1/hz);if(g.peek().won){won=true;break;}
 }
 assert.ok(won,`Hills must be beatable with touch at ${hz} Hz`);assert.equal(g.peek().taken,4);assert.equal(g.peek().lives,3);
}
// Widened screen: left-half steering stays steering beyond the old 180px split.
const wide=make(1000);wide.pointerDown(350,650,1);wide.pointerMove(390,650,true,1);for(let i=0;i<50;i++)wide.update(1/60);assert.ok(wide.peek().ball.x>4);assert.equal(wide.peek().ball.fromJump,false);
wide.cancelInput();const vx=wide.peek().ball.vx;for(let i=0;i<20;i++)wide.update(1/60);assert.ok(Math.abs(wide.peek().ball.vx)<Math.abs(vx));
const hold=make();for(let i=0;i<30;i++)hold.update(1/60);hold.key('Space',true);let launches=0,lastVy=0;for(let i=0;i<240;i++){hold.update(1/60);const vy=hold.peek().ball.vy;if(vy< -10&&lastVy>=0)launches++;lastVy=vy;}assert.ok(launches>=3,'hold bounce repeats at landings');hold.key('Space',false);hold.cancelInput();
console.log('Ball acceptance passed: first level collected all four rings and cleared without dying at 30/60/120Hz; wide touch steering, cancel and held bounce.');

for(const hz of [30,60,120]){
 const g=make();for(let i=0;i<hz/2;i++)g.update(1/hz);
 const tap=()=>{g.pointerDown(300,650,2);g.pointerUp(300,650,2);};
 tap();for(let i=0;i<Math.ceil(hz*.15);i++)g.update(1/hz);
 assert.ok(g.peek().ball.vy<0,'first tap starts a bounce');tap();
 let rebounced=false;for(let i=0;i<hz;i++){g.update(1/hz);if(i>hz*.35&&g.peek().ball.vy< -10){rebounced=true;break;}}
 assert.ok(rebounced,`airborne tap must survive until next landing at ${hz}Hz`);
 // A deliberate left-side tap can take 300ms; releasing it must still bounce.
 const left=make();for(let i=0;i<hz/2;i++)left.update(1/hz);
 left.pointerDown(60,650,1);for(let i=0;i<Math.ceil(hz*.3);i++)left.update(1/hz);left.pointerUp(60,650,1);left.update(1/hz);
 assert.ok(left.peek().ball.vy< -10,'longer tap is not silently discarded');
}
console.log('Tap regressions passed: early airborne taps and slower left-side taps at 30/60/120Hz.');
