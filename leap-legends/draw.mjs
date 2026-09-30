// Presentation only. Never mutates the seeded run or consumes its events.
import { WIDTH } from './sim.mjs';
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const sky = new Image(), sprites = new Image();
sky.src = new URL('./assets/sky.webp', import.meta.url);
sprites.src = new URL('./assets/sprites.webp', import.meta.url);
export const artReady = Promise.all([sky.decode().catch(() => {}), sprites.decode().catch(() => {})]);
const names = ['hopper','sprout','blaze','frost','nova','king','ghost','legend','comet','titan','zenith'];
export const AVATAR_LOOK = Object.fromEntries(names.map((id, i) => [id, { index: i, body: ['#ffc84e','#6ad65d','#ff704c','#a5eaff','#bc9fff','#ff83b4','#b5ffe5','#ffc661','#72e6d5','#b2bdcd','#ffe6a8'][i] }]));
// Measured atlas rectangles; the platform top is aligned to the collision line.
const cells = [
 [25,8,278,304],[339,20,279,294],[649,10,277,302],[963,10,277,302],
 [23,316,284,304],[337,327,284,293],[648,328,285,294],[963,318,283,310],
 [7,624,323,310],[336,625,287,307],[641,620,301,317],[978,649,253,276],
 [15,990,297,218],[325,959,302,245],[631,997,305,212],[993,933,225,318]
];
function sprite(g, index, x, y, w, h) {
 if (!sprites.complete || !sprites.naturalWidth) return false;
 g.drawImage(sprites, ...cells[index], x, y, w, h); return true;
}
function ellipse(g,x,y,rx,ry,color) {g.fillStyle=color;g.beginPath();g.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);g.fill();}
function star(g,x,y,r,color) {g.fillStyle=color;g.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.42:r;g.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}g.closePath();g.fill();}
export function drawAvatar(g,id,x,y,r,{squash=0,look=0,shield=0,t=0}={}) {
 const a=AVATAR_LOOK[id]||AVATAR_LOOK.hopper;
 g.save();g.translate(x,y);g.rotate(look*.07);g.scale(1+squash*.22,1-squash*.22);
 if(['nova','comet','zenith','legend'].includes(id)) {
  const glow=g.createRadialGradient(0,0,r*.1,0,0,r*1.65);glow.addColorStop(0,a.body+'66');glow.addColorStop(1,a.body+'00');g.fillStyle=glow;g.fillRect(-r*1.7,-r*1.7,r*3.4,r*3.4);
  for(let i=0;i<3;i++){const q=t*.8+i*TAU/3;star(g,Math.cos(q)*r*1.2,Math.sin(q)*r*1.2,r*.09,'#fff7cc');}
 }
 if(!sprite(g,a.index,-r*1.38,-r*1.55,r*2.76,r*2.85)) {
  const fill=g.createRadialGradient(-r*.4,-r*.5,r*.1,0,0,r);fill.addColorStop(0,'#fff4b1');fill.addColorStop(1,a.body);ellipse(g,0,0,r,r,fill);
  for(const s of [-1,1]){ellipse(g,s*r*.3,-r*.2,r*.2,r*.28,'#fff');ellipse(g,s*r*.3+look*r*.05,-r*.17,r*.1,r*.17,'#153c43');}
 }
 g.restore();
 if(shield){g.save();g.strokeStyle='#bafaff';g.lineWidth=2;g.shadowColor='#64e9ff';g.shadowBlur=15;g.beginPath();g.arc(x,y,r*1.7,0,TAU);g.stroke();g.restore();}
}

export function drawGear(g,id){
 g.save();g.clearRect(0,0,80,80);g.translate(40,40);
 const glow=g.createRadialGradient(-8,-12,2,0,0,39);glow.addColorStop(0,'#e7e8b842');glow.addColorStop(1,'#77c3d000');ellipse(g,0,0,39,39,glow);
 g.lineJoin='round';g.lineCap='round';
 if(id==='rocket')sprite(g,15,-21,-35,42,66);
 else if(id==='shield'){const f=g.createLinearGradient(-20,-25,22,30);f.addColorStop(0,'#defdff');f.addColorStop(.5,'#57c3d4');f.addColorStop(1,'#286575');g.fillStyle=f;g.strokeStyle='#e1f8dd';g.lineWidth=3;g.beginPath();g.moveTo(0,-29);g.lineTo(24,-20);g.lineTo(19,10);g.quadraticCurveTo(12,25,0,31);g.quadraticCurveTo(-12,25,-19,10);g.lineTo(-24,-20);g.closePath();g.fill();g.stroke();star(g,0,-1,13,'#fff0ba');}
 else if(id==='magnet'){g.lineWidth=17;g.strokeStyle='#f18f75';g.beginPath();g.arc(0,-4,20,0,Math.PI);g.stroke();g.strokeStyle='#dcebea';for(const x of [-20,20]){g.beginPath();g.moveTo(x,-5);g.lineTo(x,-21);g.stroke();}star(g,0,-23,7,'#ffe5a3');}
 else {g.strokeStyle='#b7d4d3';g.lineWidth=3;for(const x of [-15,15]){g.beginPath();g.moveTo(x-7,13);for(let i=0;i<5;i++)g.lineTo(x+(i%2?7:-7),13+i*3);g.stroke();g.fillStyle='#e5af62';g.beginPath();g.roundRect(x-10,-23,19,30,5);g.fill();g.fillStyle='#ffdd93';g.beginPath();g.roundRect(x-11,-4,26,14,5);g.fill();g.fillStyle='#7e5543';g.fillRect(x-11,7,26,4);}}
 g.restore();
}

// Wide screens keep a phone's vertical gameplay range; the scene fills the viewport.
export function viewport(w,h){const k=Math.min(w/WIDTH,h/18);return {k,left:(w-WIDTH*k)/2};}
const SKY=[[0,'#44abc0','#c6ebdf'],[150,'#4784b6','#c0e0ed'],[300,'#734764','#efbd94'],[450,'#252a57','#806ca5'],[600,'#090f29','#293663']];
function mix(a,b,t){return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');}
function skyAt(y){for(let i=0;i<SKY.length-1;i++){const[a,c,d]=SKY[i],[b,e,f]=SKY[i+1];if(y<b)return[mix(c,e,clamp((y-a)/(b-a))),mix(d,f,clamp((y-a)/(b-a)))];}return SKY.at(-1).slice(1);}
function background(g,w,h,cam,t,reduced){
 const [top,bottom]=skyAt(cam);const bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,top);bg.addColorStop(1,bottom);g.fillStyle=bg;g.fillRect(0,0,w,h);
 if(sky.complete&&sky.naturalWidth){g.save();g.globalAlpha=1-clamp(cam/650)*.96;const scale=Math.max(w/sky.width,h/sky.height)*1.05;g.drawImage(sky,(w-sky.width*scale)/2,(h-sky.height*scale)/2+(reduced?0:Math.sin(cam*.013)*h*.024),sky.width*scale,sky.height*scale);g.restore();}
 const night=clamp((cam-280)/300);
 if(night){g.save();g.globalAlpha=night;for(let i=0;i<72;i++){const sx=(i*97.33)%w,sy=((i*173.7+cam*.12)%h+h)%h;ellipse(g,sx,sy, i%7===0?1.8:.8,i%7===0?1.8:.8,'#fff8dc');}const moon=g.createRadialGradient(w*.8,h*.17,0,w*.8,h*.17,w*.13);moon.addColorStop(0,'#b7dfff66');moon.addColorStop(1,'#a4caff00');g.fillStyle=moon;g.fillRect(w*.65,0,w*.35,h*.4);g.restore();}
 if(!reduced){g.save();g.globalAlpha=.35;for(let i=0;i<12;i++){const x=(i*179+t*(2+i%3))%(w+20),y=((i*113+cam*.9+t*4)%(h+20));ellipse(g,x,y,1.6,2.8,'#fff8c5');}g.restore();}
}
function platform(g,x,y,pw,kind,spring){
 const idx=kind==='moving'?13:kind==='crumble'?14:12;
 const depth=Math.min(pw*.43,44);
 if(!sprite(g,idx,x-pw/2,y-4,pw,depth)) {g.fillStyle=kind==='moving'?'#73dcff':kind==='crumble'?'#ce9060':'#8ccb58';g.beginPath();g.roundRect(x-pw/2,y,pw,12,5);g.fill();}
 if(kind==='moving'){g.save();g.strokeStyle='#e2fcff';g.lineWidth=1.7;for(const s of [-1,1]){g.beginPath();g.moveTo(x+s*pw*.29,y+9);g.lineTo(x+s*pw*.36,y+12);g.lineTo(x+s*pw*.29,y+15);g.stroke();}g.restore();}
 if(spring){g.save();g.translate(x,y-4);g.lineWidth=2.5;g.strokeStyle='#305962';g.beginPath();g.moveTo(-7,0);for(let i=0;i<5;i++)g.lineTo(i%2?7:-7,-i*3);g.stroke();g.fillStyle='#ffe4ad';g.fillRect(-11,-15,22,5);g.fillStyle='#e96c3f';g.fillRect(-11,-14,22,3);g.restore();}
}
const effects=new WeakMap();
function stateFor(run){let s=effects.get(run);if(!s){s={seen:0,particles:[],bounce:-10,near:-10,nearIds:new WeakSet()};effects.set(run,s);}return s;}
function updateEffects(run,s){
 const p=run.player;
 while(s.seen<run.events.length){const e=run.events[s.seen++];if(['bounce','spring','revive'].includes(e.type))s.bounce=run.t;
  const n=e.type==='coin'?12:e.type==='spring'?14:e.type==='bounce'?6:e.type==='shield'?18:e.type==='crumble'?9:0;
  for(let i=0;i<n;i++){const a=i*2.399; s.particles.push({x:p.x,y:p.y-.3,t:run.t,vx:Math.cos(a)*(1+i%3),vy:Math.sin(a)*2+1,life:e.type==='coin'?.65:.4,color:e.type==='coin'?'#ffe176':e.type==='crumble'?'#d99a63':e.type==='shield'?'#a3fbff':'#e8ffc3'});}
  if(e.type==='coin')s.coin=run.t;
 }
 s.particles=s.particles.filter(p=>run.t-p.t<p.life);
 for(const z of run.hazards){if(z.hit||s.nearIds.has(z))continue;const d=Math.hypot(z.x-p.x,z.y-p.y);if(d>.81&&d<1.25){s.nearIds.add(z);s.near=run.t;}}
}
function storm(g,w,h,sy,t,reduced){
 if(sy>h+90)return;
 const top=Math.max(-100,sy-22), fill=g.createLinearGradient(0,top,0,Math.max(top+1,h));fill.addColorStop(0,'#604f8780');fill.addColorStop(.3,'#392e59f5');fill.addColorStop(1,'#171c32');g.fillStyle=fill;g.fillRect(0,top,w,h-top);
 for(let layer=0;layer<3;layer++){const off=reduced?0:Math.sin(t*(.5+layer*.1))*17;for(let x=-80;x<w+90;x+=64){const y=sy+layer*21+Math.sin(x*.016+layer)*14;const glow=g.createRadialGradient(x+off,y-12,4,x+off,y,67);glow.addColorStop(0,layer===0?'#b09ac9':'#706486');glow.addColorStop(.45,layer===0?'#675b8b':'#403953');glow.addColorStop(1,'#292b4500');ellipse(g,x+off,y,76,49,glow);}}
 if(!reduced){g.save();g.globalAlpha=.18+.2*Math.sin(t*1.5)**2;g.strokeStyle='#e0c0ff';g.lineWidth=2;g.shadowColor='#ba7cff';g.shadowBlur=10;for(let i=0;i<3;i++){const x=w*(.16+i*.32);g.beginPath();g.moveTo(x,sy+9);g.lineTo(x+14,sy+31);g.lineTo(x+4,sy+40);g.lineTo(x+22,sy+61);g.stroke();}g.restore();}
}
export function drawWorld(g,w,h,run,{avatar='hopper',t=0,dir=0,reduced=false}={}){
 const cam=run?run.camera:0,{k,left}=viewport(w,h),X=x=>left+x*k,Y=y=>h-(y-cam)*k-h*.1;
 background(g,w,h,cam,t,reduced);
 if(!run)return;
 const s=stateFor(run);updateEffects(run,s);
 if(left>8){g.strokeStyle='#f5f4d735';g.setLineDash([3,14]);g.beginPath();g.moveTo(left,70);g.lineTo(left,h);g.moveTo(w-left,70);g.lineTo(w-left,h);g.stroke();g.setLineDash([]);}
 for(const p of run.platforms){if(p.gone)continue;const y=Y(p.y);if(y< -60||y>h+40)continue;platform(g,X(p.x),y,p.w*k,p.kind,p.spring);}
 for(const c of run.coins){const y=Y(c.y);if(y< -30||y>h+30)continue;const r=.3*k;g.save();g.translate(X(c.x),y);g.scale(reduced?1:.7+.3*Math.abs(Math.sin(t*2+c.x)),1);if(!sprite(g,11,-r,-r,r*2,r*2))ellipse(g,0,0,r,r,'#ffd568');g.restore();}
 for(const p of run.pickups){const y=Y(p.y);if(y< -50||y>h+50)continue;sprite(g,15,X(p.x)-k*.32,y-k*.55,k*.64,k*.94);}
 for(const z of run.hazards){if(z.hit)continue;const y=Y(z.y);if(y< -40||y>h+40)continue;const r=z.r*k;g.save();g.translate(X(z.x),y);g.rotate(reduced?0:t*.6);const fill=g.createRadialGradient(-r*.3,-r*.4,0,0,0,r*1.15);fill.addColorStop(0,'#ffbdb2');fill.addColorStop(.5,'#cd5378');fill.addColorStop(1,'#512d56');g.fillStyle=fill;g.strokeStyle='#602948';g.lineWidth=1.5;g.beginPath();for(let i=0;i<24;i++){const a=i*TAU/24,rr=i%2?r*.72:r*1.12;g.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}g.closePath();g.fill();g.stroke();g.rotate(reduced?0:-t*.6);ellipse(g,-r*.28,-r*.06,r*.17,r*.2,'#fff3ce');ellipse(g,r*.28,-r*.06,r*.17,r*.2,'#fff3ce');ellipse(g,-r*.25,-r*.02,r*.07,r*.12,'#442444');ellipse(g,r*.25,-r*.02,r*.07,r*.12,'#442444');g.restore();}
 // The storm is tied to the lethal height, not the moving camera bottom.
 storm(g,w,h,Y(run.chase-.3),t,reduced);
 if(!reduced)for(const p of s.particles){const age=run.t-p.t;g.save();g.globalAlpha=1-age/p.life;star(g,X(p.x+p.vx*age),Y(p.y+p.vy*age-2*age*age),Math.max(1,k*.065),p.color);g.restore();}
 const p=run.player,py=Y(p.y),age=run.t-s.bounce;
 const squash=reduced?0:(age<.16?Math.sin(age/.16*Math.PI)*.9:clamp(p.vy/30,-.3,.3)*-.5);
 if(p.rocket>0){const plume=g.createLinearGradient(0,py,0,py+k*1.8);plume.addColorStop(0,'#fff5b5');plume.addColorStop(.4,'#ffb248');plume.addColorStop(1,'#ff684000');ellipse(g,X(p.x),py+k*.9,k*.25,k*(reduced?.8:.85+Math.sin(t*20)*.08),plume);}
 g.save();if(p.invulnerable>0)g.globalAlpha=.7+.3*Math.sin(t*8)**2;
 for(const off of [0,-WIDTH,WIDTH]){const x=X(p.x+off);if(x<left-24||x>w-left+24)continue;drawAvatar(g,avatar,x,py,.42*k,{squash,look:dir,shield:p.shield,t:reduced?0:t});}g.restore();
 if(!reduced&&run.t-s.coin<.6){g.save();g.globalAlpha=1-(run.t-s.coin)/.6;g.font='800 17px system-ui';g.textAlign='center';g.fillStyle='#fff2a9';g.strokeStyle='#3b5b50';g.lineWidth=3;const cy=py-k*.9-(run.t-s.coin)*25;g.strokeText('+1',X(p.x),cy);g.fillText('+1',X(p.x),cy);g.restore();}
 if(!reduced&&run.t-s.near<.45){g.save();g.globalAlpha=(1-(run.t-s.near)/.45)*.55;g.strokeStyle='#ffe9b3';g.lineWidth=2;g.beginPath();g.arc(X(p.x),py,k*.75,0,TAU);g.stroke();g.restore();}
}
