import {WORLD,BLOCK,ROAD,KINDS} from './sim.mjs';
import {terrain,terrainReady,PERSPECTIVE} from './terrain.mjs';
const sprites={},shadows={};
const buildingKeys=['cottage-green','cottage-red','cottage-blue','cottage-yellow','shop','bank','bakery','depot','workshop','sawmill','garage','forge'];
const newKeys=['barrel','rope','toolbox','bricks','pallet','barrow','pump','minecart','caravan','van','excavator','stall'];
const loading=[...Object.keys(KINDS),'hole','rival',...buildingKeys].map(k=>{const im=new Image();im.src=new URL('./assets/'+(newKeys.includes(k)||buildingKeys.includes(k)?'v2/':'')+k+'.webp',import.meta.url);sprites[k]=im;return im.decode().then(()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#18292a';g.fillRect(0,0,c.width,c.height);shadows[k]=c;}).catch(()=>{});});
export const ready=Promise.all([terrainReady,...loading]);
const skinFor=o=>{let n=(Math.imul(Math.round(o.x*100),73856093)^Math.imul(Math.round(o.y*100),19349663))>>>0;n=Math.imul(n^(n>>>16),0x85ebca6b);n=(n^(n>>>13))>>>0;const shops=(Math.floor(o.x/30)+Math.floor(o.y/30)*3)%5===0;return o.k==='house'?buildingKeys[(shops?4:0)+n%4]:o.k==='shed'?buildingKeys[8+n%4]:o.k;};
const tall=new Set(['house','shed','pub','church','tower','headframe','tree','stall','tank']);
let cam=null,zoom=12;const rings=[],dust=[],debris=[];let rumble=0;
export function resetDraw(){cam=null;dust.length=rings.length=debris.length=0;rumble=0;}
export function effect(event,g,localId=0){
 const o=event.type==='eat'?g.objs[event.obj]:g.holes[event.hole];if(!o)return;const me=g.holes[localId];if(Math.hypot(o.x-me.x,o.y-me.y)>32+me.r*3)return;
 rings.push({x:o.x,y:o.y,r:o.r,t:0});if(rings.length>60)rings.shift();
 if(event.type==='swallow'||o.r>1.2)rumble=Math.min(7,o.r);
 const count=Math.min(25,Math.ceil(o.r*4+5));
 for(let i=0;i<count;i++){const a=i*2.399;dust.push({x:o.x,y:o.y,a,r:o.r,t:0});debris.push({x:o.x,y:o.y,a,r:o.r,t:0,size:.035+(i%4)*.025,color:['#74533a','#d8ba7e','#5e6c5d','#d5c4a0'][i%4]});}
 if(dust.length>180)dust.splice(0,dust.length-180);if(debris.length>180)debris.splice(0,debris.length-180);
}
export function render(ctx,W,H,dpr,g,meId,dt,falling,floaters,{reduced=false,pull=null,input={dx:0,dy:0},paused=false}={}){
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#aa936d';ctx.fillRect(0,0,W,H);if(!g)return;
 const me=g.holes[meId],want=Math.min(W,H)/(18+me.r*4.4);if(!cam){cam={x:me.x,y:me.y};zoom=want;}const lerp=Math.min(1,dt*7);cam.x+=(me.x-cam.x)*lerp;cam.y+=(me.y-cam.y)*lerp;zoom+=(want-zoom)*Math.min(1,dt*3);
 const ed=paused?0:dt;rumble*=Math.max(0,1-ed*10);ctx.save();if(!reduced&&!paused&&rumble>.1)ctx.translate(Math.sin(g.t*83)*rumble*.32,Math.cos(g.t*71)*rumble*.25);
 const sx=x=>W/2+(x-cam.x)*zoom,sy=y=>H/2+(y-cam.y)*zoom*PERSPECTIVE;
 terrain(ctx,W,H,cam,zoom);
 // Pit mouths sit in the ground; oversized buildings remain above their rims.
 for(const h of [...g.holes].sort((a,b)=>a.r-b.r)){
 if(h.out>0)continue;const x=sx(h.x),y=sy(h.y),r=h.r*zoom;if(x< -r||y< -r||x>W+r||y>H+r)continue;
 const im=sprites.hole;
 // Fracture rays are fixed to each crater; layered ellipses read as deep rock walls.
 ctx.strokeStyle='#533c277a';ctx.lineWidth=Math.max(.7,r*.023);
 for(let j=0;j<9;j++){const a=j*2.399+h.id*.73,rr=r*(1.15+(j%3)*.08);ctx.beginPath();ctx.moveTo(x+Math.cos(a)*r*.9,y+Math.sin(a)*r*.74);ctx.lineTo(x+Math.cos(a+.05)*rr,y+Math.sin(a+.05)*rr*.82);ctx.lineTo(x+Math.cos(a)*rr*1.13,y+Math.sin(a)*rr*.94);ctx.stroke();}
 ctx.fillStyle='#32241b';ctx.beginPath();ctx.ellipse(x,y,r*1.12,r*.92,0,0,7);ctx.fill();
 if(im.complete&&im.naturalWidth)ctx.drawImage(im,x-r*1.22,y-r*1.05,r*2.44,r*2.1);
 ctx.save();ctx.beginPath();ctx.ellipse(x,y,r*.88,r*.71,0,0,7);ctx.clip();const depth=ctx.createRadialGradient(x,y+r*.22,r*.02,x,y,r*.95);depth.addColorStop(0,'#010406');depth.addColorStop(.53,'#080d10');depth.addColorStop(.82,'#33271f');depth.addColorStop(1,'#725333');ctx.fillStyle=depth;ctx.fillRect(x-r,y-r,r*2,r*2);
 for(let j=0;j<4;j++){ctx.strokeStyle=`rgba(166,121,68,${.15-j*.025})`;ctx.lineWidth=Math.max(.5,r*.022);ctx.beginPath();ctx.ellipse(x,y+r*.05*j,r*(.83-j*.1),r*(.66-j*.08),0,Math.PI,Math.PI*2);ctx.stroke();}
 ctx.restore();ctx.strokeStyle=h.id===meId?'#ffcf73b0':h.bot?'#adbd9d55':'#6ce8dcb0';ctx.lineWidth=Math.max(1.2,r*.032);ctx.beginPath();ctx.ellipse(x,y,r*1.06,r*.87,0,0,7);ctx.stroke();
 if(!reduced&&Math.abs(h.vx)+Math.abs(h.vy)>1){ctx.fillStyle='#d5b47c9c';for(let j=0;j<8;j++){const a=j*.785+g.t*.8,rr=r*(.96+.09*Math.sin(g.t*4+j));ctx.beginPath();ctx.arc(x+Math.cos(a)*rr,y+Math.sin(a)*rr*.82,Math.max(.7,r*.015),0,7);ctx.fill();}}

 }
 const halfW=W/zoom/2+15,halfH=H/(zoom*PERSPECTIVE)/2+15;
 const visible=g.objs.filter(o=>o.alive&&Math.abs(o.x-cam.x)<halfW&&Math.abs(o.y-cam.y)<halfH).sort((a,b)=>a.y-b.y);
 const thing=(o,x,y,r,alpha=1,angle=0)=>{const key=skinFor(o),im=sprites[key];if(!im?.naturalWidth)return;const high=tall.has(o.k),width=r*(high?2.16:2),height=width,top=high?-r*1.45:-r;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;
 if(shadows[key]){ctx.save();ctx.globalAlpha=alpha*.26;ctx.transform(1,.08,-.48,.5,r*.52,r*.28);ctx.drawImage(shadows[key],-width/2,top,width,height);ctx.restore();}
 ctx.drawImage(im,-width/2,top,width,height);
 // Subtle chimney smoke is presentation only and stops while paused.
 if(!reduced&&high&&['house','shed','pub'].includes(o.k)&&r>18){const phase=(o.x*.7+o.y*.3)%4;for(let j=0;j<3;j++){const q=((g.t*.3+j*.8+phase)%2.8)/2.8;ctx.globalAlpha=alpha*(1-q)*.12;ctx.fillStyle='#e9dec6';ctx.beginPath();ctx.ellipse(-r*.34+q*r*.28,top+r*.1-q*r*.55,r*(.055+q*.10),r*(.035+q*.08),-.3,0,7);ctx.fill();}}
 ctx.restore();};
 for(const o of visible)thing(o,sx(o.x),sy(o.y),o.r*zoom);
 for(let i=falling.length-1;i>=0;i--){const f=falling[i];f.t+=ed;if(f.t>=.55){falling.splice(i,1);continue;}const k=1-f.t/.55,hh=g.holes[f.holeId]||f.hole,x=hh.x+(f.o.x-hh.x)*k,y=hh.y+(f.o.y-hh.y)*k;ctx.save();ctx.beginPath();ctx.ellipse(sx(hh.x),sy(hh.y),hh.r*zoom*1.13,hh.r*zoom*.86,0,0,7);ctx.clip();thing(f.o,sx(x),sy(y)+f.t*zoom*2.2,f.o.r*zoom*(.18+.82*k),k,reduced?0:(1-k)*.85);ctx.restore();}
 if(!reduced){for(let i=debris.length-1;i>=0;i--){const p=debris[i];p.t+=ed;if(p.t>.7){debris.splice(i,1);continue;}const k=p.t/.7,x=sx(p.x+Math.cos(p.a)*p.r*k*.55),y=sy(p.y+Math.sin(p.a)*p.r*k*.55)-Math.sin(k*Math.PI)*zoom*(p.r*.2+.2);ctx.save();ctx.translate(x,y);ctx.rotate(p.a+p.t*5);ctx.globalAlpha=1-k;ctx.fillStyle=p.color;const size=Math.max(1,p.size*zoom*(1+p.r*.2));ctx.fillRect(-size,-size,size*2,size*1.3);ctx.restore();}for(let i=dust.length-1;i>=0;i--){const p=dust[i];p.t+=ed;if(p.t>1){dust.splice(i,1);continue;}ctx.globalAlpha=(1-p.t)*.3;ctx.fillStyle='#ecd3a4';ctx.beginPath();ctx.arc(sx(p.x+Math.cos(p.a)*p.t*p.r),sy(p.y+Math.sin(p.a)*p.t*p.r),zoom*(.15+p.t*.5),0,7);ctx.fill();}ctx.globalAlpha=1;for(let i=rings.length-1;i>=0;i--){const p=rings[i];p.t+=ed;if(p.t>.5){rings.splice(i,1);continue;}ctx.strokeStyle=`rgba(255,222,145,${(.5-p.t)*.6})`;ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(sx(p.x),sy(p.y),(p.r+p.t*2)*zoom,(p.r+p.t*2)*zoom*.85,0,0,7);ctx.stroke();}}else{dust.length=rings.length=debris.length=0;}
 for(const h of g.holes){if(h.out>0)continue;const x=sx(h.x),y=sy(h.y)-h.r*zoom-11;if(x< -30||x>W+30||y<0||y>H)continue;ctx.textAlign='center';ctx.font='800 11px system-ui';ctx.strokeStyle='#152720';ctx.lineWidth=3;ctx.strokeText(h.id===meId?'YOU':h.name,x,y);ctx.fillStyle=h.id===meId?'#ffe0a1':'#f4f1db';ctx.fillText(h.id===meId?'YOU':h.name,x,y);}
 for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];f.t+=ed;if(f.t>1){floaters.splice(i,1);continue;}ctx.globalAlpha=1-f.t;ctx.textAlign='center';ctx.font='800 18px Georgia';ctx.strokeStyle='#152720';ctx.lineWidth=3;ctx.strokeText(f.text,sx(f.x),sy(f.y)-f.t*38);ctx.fillStyle='#fff1ba';ctx.fillText(f.text,sx(f.x),sy(f.y)-f.t*38);}ctx.globalAlpha=1;
 // Compass arrows give distant rivals a presence without covering the town.
 for(const h of g.holes.filter(h=>h.id!==meId&&!h.bot&&h.out<=0)){const x=sx(h.x),y=sy(h.y);if(x<20||x>W-20||y<90||y>H-60){const a=Math.atan2(y-H/2,x-W/2),xx=Math.max(22,Math.min(W-22,x)),yy=Math.max(100,Math.min(H-90,y));ctx.save();ctx.translate(xx,yy);ctx.rotate(a);ctx.fillStyle='#63e6da';ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-5,-6);ctx.lineTo(-5,6);ctx.fill();ctx.restore();}}
 ctx.restore();if(pull){ctx.strokeStyle='#fff0bd60';ctx.lineWidth=2;ctx.beginPath();ctx.arc(pull.x,pull.y,32,0,7);ctx.stroke();ctx.fillStyle='#ffe1a48c';ctx.beginPath();ctx.arc(pull.x+input.dx*23,pull.y+input.dy*23,10,0,7);ctx.fill();}
}
