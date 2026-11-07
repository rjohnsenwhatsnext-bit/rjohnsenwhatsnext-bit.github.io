import {factionArt,unitArt,factionOf} from './factions.mjs';
import {structureArt} from './ages.mjs';
import {drawArtillery} from './artillery.mjs';
import {riverX} from './raid.mjs';
const random=n=>{const v=Math.sin(n*91.7+31.4)*43567;return v-Math.floor(v);};
let groundTexture=null,waterTexture=null;
function textures(terrain,waterArt){
 if(!groundTexture&&terrain.complete&&terrain.naturalWidth){groundTexture=document.createElement('canvas');groundTexture.width=2048;groundTexture.height=1707;const g=groundTexture.getContext('2d'),tile=256;for(let y=0;y<7;y++)for(let x=0;x<8;x++){g.save();g.translate(x*tile+(x%2?tile:0),y*tile+(y%2?tile:0));g.scale(x%2?-1:1,y%2?-1:1);g.drawImage(terrain,terrain.width*.36,terrain.height*.25,terrain.width*.35,terrain.height*.11,0,0,tile,tile);g.restore();}g.fillStyle='#30562a22';g.fillRect(0,0,2048,1707);}
 if(!waterTexture&&waterArt?.complete&&waterArt.naturalWidth){waterTexture=document.createElement('canvas');waterTexture.width=180;waterTexture.height=64;waterTexture.getContext('2d').drawImage(waterArt,waterArt.width*.43,waterArt.height*.41,waterArt.width*.23,waterArt.height*.03,0,0,180,64);}
}
export function raidScene(c,s,{side=0,w,h,camera,assets,terrain,waterArt,sprite,walker,bar,motion=true}){
 const scale=Math.min(w/90,h/150)*camera.zoom,ox=w/2-s.world.home.x*scale+camera.x,oy=h/2-s.world.home.y*scale+camera.y;
 const point=(x,y)=>({x:ox+x*scale,y:oy+y*scale});
 const visible=(x,y,pad=140)=>x>-pad&&x<w+pad&&y>-pad&&y<h+pad;
 c.fillStyle='#293e28';c.fillRect(0,0,w,h);
 textures(terrain,waterArt);if(groundTexture)c.drawImage(groundTexture,ox,oy,s.world.width*scale,s.world.height*scale);
 c.save();c.translate(ox,oy);c.scale(scale,scale);
 // Settlement approaches connect through the nearest bridge, giving the map geography.
 c.lineCap='round';
 for(const b of s.structures.filter(b=>b.kind==='keep')){const home=s.world.home;let points=[home];if((home.x<riverX(home.y))!==(b.x<riverX(b.y))){const y=s.world.bridges.reduce((a,y)=>Math.abs(y-b.y)<Math.abs(a-b.y)?y:a);points.push({x:riverX(y)-13,y},{x:riverX(y)+13,y});}points.push(b);c.beginPath();c.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))c.lineTo(p.x,p.y);c.strokeStyle='#8b795144';c.lineWidth=5;c.stroke();c.strokeStyle='#c3ad7633';c.lineWidth=2;c.stroke();}
 c.beginPath();for(let y=0;y<=300;y+=2)y?c.lineTo(riverX(y),y):c.moveTo(riverX(y),y);
 c.strokeStyle='#304939';c.lineWidth=18;c.stroke();c.strokeStyle='#9caa7a';c.lineWidth=14;c.stroke();c.strokeStyle='#558d8b';c.lineWidth=11;c.stroke();c.strokeStyle='#315e69';c.lineWidth=7;c.stroke();
 if(waterTexture){c.save();c.beginPath();for(let y=0;y<=300;y+=2)y?c.lineTo(riverX(y)-5+Math.sin(y*.7)*.3,y):c.moveTo(riverX(y)-5,y);for(let y=300;y>=0;y-=2)c.lineTo(riverX(y)+5+Math.sin(y*.55)*.4,y);c.closePath();c.clip();const pattern=c.createPattern(waterTexture,'repeat');pattern.setTransform(new DOMMatrix().scale(.11,.14));c.fillStyle=pattern;c.fillRect(180,0,45,300);c.restore();}

 for(let i=0;i<150;i++){const y=(i*13.7+(motion?s.time*2:0))%300,x=riverX(y)+(random(i)-.5)*8;c.strokeStyle=`rgba(199,238,218,${.13+random(i+10)*.3})`;c.lineWidth=.15;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-.5,y+1,x,y+2);c.stroke();}
 for(const y of s.world.bridges){const x=riverX(y);c.fillStyle='#393b2b';c.fillRect(x-10,y-3.8,20,7.6);c.fillStyle='#a28c63';c.fillRect(x-10,y-3,20,6);c.strokeStyle='#d0b984';c.lineWidth=.3;for(let i=-9;i<=9;i+=2){c.beginPath();c.moveTo(x+i,y-3);c.lineTo(x+i,y+3);c.stroke();}}
 c.restore();
 const objects=[...s.structures.map(b=>({y:b.y,building:b})),...s.units.filter(u=>u.hp>0).map(u=>({y:u.y,unit:u}))];
 for(let i=0;i<110;i++){const x=8+random(i+80)*344,y=8+random(i+400)*284;if(Math.abs(x-riverX(y))<18||Math.hypot(x-165,y-160)<25||s.structures.some(b=>Math.hypot(b.x-x,b.y-y)<18))continue;objects.push({y,tree:{x,y,i}});}
 for(const o of objects.sort((a,b)=>a.y-b.y)){
  if(o.tree){const p=point(o.tree.x,o.tree.y);if(visible(p.x,p.y))sprite('land-0',p.x,p.y,14*scale);continue;}
  if(o.building){const b=o.building,p=point(b.x,b.y);if(!visible(p.x,p.y))continue;const key=structureArt(b.profile,b.age,b.art),im=assets[key],width=(b.size||(b.kind==='keep'?26:b.kind==='bell'?13:20))*scale;
   drawStructure(c,b,im,p.x,p.y,width,s.time,scale,motion);
   if(b.hp>0){bar(p.x,p.y+3*scale,width*.65,b.hp/b.max,b.side===side);if((s.selected?.[side]??s.selectedTarget)===b.id){c.strokeStyle='#ffd581';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y,width*.55,width*.2,0,0,Math.PI*2);c.stroke();}}
   if(b.kind==='keep'&&scale>1.5){c.font=`600 ${Math.max(10,2.5*scale)}px Georgia`;c.textAlign='center';c.fillStyle='#10271edb';c.fillRect(p.x-21*scale,p.y+5*scale,42*scale,5*scale);c.fillStyle=b.hp<=0?'#e4cf92':factionOf(b.profile).color;c.fillText(b.hp<=0?'Captured: '+b.name:b.name,p.x,p.y+9*scale);c.textAlign='start';}
  }else{const u=o.unit,p=point(u.x,u.y);if(!visible(p.x,p.y,55))continue;const key=unitArt(u.profile,u.stats.art);c.fillStyle=u.side===side?'#62c7a855':'#da685555';c.beginPath();c.ellipse(p.x,p.y,2.8*scale,1.3*scale,0,0,7);c.fill();if(u.type==='siege')drawArtillery(c,assets[key],key,p.x,p.y,9*scale,u.phase,s.time-(u.lastShot??-100));else walker(key,p.x,p.y,5.5*scale,u.phase,u.moving&&!s.paused,u.direction||1);if(u.hp<u.max)bar(p.x,p.y-8*scale,5*scale,u.hp/u.max,u.side===side);}
 }
 // a friend battle has the two cities instead of an expedition camp
 if(s.siege!=='duel'){const camp=point(165,160);sprite(factionArt(s.profiles[0],'frontier-0'),camp.x,camp.y,23*scale);c.fillStyle='#ffe5a4';c.font=`${Math.max(11,3*scale)}px Georgia`;c.textAlign='center';c.fillText('Your expedition camp',camp.x,camp.y+5*scale);c.textAlign='start';}
 for(const p of s.projectiles){const t=p.elapsed/p.duration,a=point(p.x,p.y),b=point(p.tx,p.ty),x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t-(p.siege?Math.sin(t*Math.PI)*10*scale:3*scale);c.fillStyle=p.siege?'#171c18':'#ffe2a1';c.beginPath();c.arc(x,y,(p.siege?.75:.35)*scale,0,7);c.fill();}
 for(const e of s.effects){const p=point(e.x,e.y),age=s.time-e.start;c.save();c.globalAlpha=Math.max(0,1-age/(e.siege?1.1:.25));for(let i=0;i<(e.siege?9:2);i++){const a=i*2.4;c.fillStyle=i%3?'#b1a588':'#f8cc79';c.beginPath();c.ellipse(p.x+Math.cos(a)*age*8*scale,p.y+Math.sin(a)*age*4*scale-age*2*scale,(.5+age*2)*scale,(.4+age)*scale,0,0,7);c.fill();}c.restore();}
 const dest=point(s.orders[0].x,s.orders[0].y);c.strokeStyle='#f5d481';c.lineWidth=2;c.beginPath();c.ellipse(dest.x,dest.y,8,4,0,0,7);c.stroke();
 return {scale,ox,oy};
}
function drawStructure(c,b,im,x,y,width,time,scale,motion){
 if(!im)return;const height=width*im.height/im.width,dead=b.hp<=0,age=dead?Math.max(0,time-b.downAt):0;
 if(dead){
  c.save();c.translate(x,y);c.fillStyle='#302f2566';c.beginPath();c.ellipse(0,0,width*.45,width*.15,0,0,7);c.fill();c.filter='saturate(.4) brightness(.65)';c.drawImage(im,0,im.height*.72,im.width,im.height*.28,-width*.45,-height*.08,width*.9,height*.15);for(let i=0;i<24;i++){const rx=(random(i+b.x)-.5)*width*.85,ry=(random(i+b.y)-.5)*width*.26;c.save();c.translate(rx,ry);c.rotate((random(i+9)-.5)*1.3);c.drawImage(im,random(i+44)*im.width*.7,im.height*(.4+random(i+7)*.4),im.width*.2,im.height*.13,-width*.07,-width*.04,width*.14,width*.08);c.restore();}c.filter='none';c.restore();
  const t=motion?Math.min(1,age/1.8):1;
  if(t<1){c.save();c.translate(x,y);if(b.kind==='bell'){c.rotate(b.fall*t*t*1.48);c.globalAlpha=1-Math.max(0,(t-.8)*5);c.drawImage(im,-width/2,-height,width,height);}else{for(let i=0;i<5;i++){c.save();c.translate((i-2)*width/5,0);c.rotate((i-2)*t*.18);c.globalAlpha=1-t*t;c.drawImage(im,i*im.width/5,0,im.width/5,im.height,-width/10,-height*(1-t),width/5,height*(1-t*.7));c.restore();}}c.restore();}
  if(age<3&&motion){c.save();c.globalAlpha=(1-age/3)*.55;for(let i=0;i<12;i++){c.fillStyle='#c7b591';c.beginPath();c.ellipse(x+(random(i+b.x)-.5)*(width+age*12*scale),y-age*(1+random(i))*2*scale,(2+age*2)*scale,(1+age)*scale,0,0,7);c.fill();}c.restore();}return;
 }
 const shake=motion&&time-(b.hitAt??-100)<.15?Math.sin(time*95)*scale:0;c.drawImage(im,x-width/2+shake,y-height,width,height);
 if(b.kind==='bell'){const bx=x,by=y-height*.63;c.fillStyle='#d0aa51';c.beginPath();c.moveTo(bx-1.2*scale,by);c.quadraticCurveTo(bx-1.3*scale,by-3*scale,bx,by-3*scale);c.quadraticCurveTo(bx+1.3*scale,by-3*scale,bx+1.2*scale,by);c.lineTo(bx+1.6*scale,by+.6*scale);c.lineTo(bx-1.6*scale,by+.6*scale);c.fill();}
 if(b.hp/b.max<.65){c.strokeStyle='#252922bb';c.lineWidth=1.2*scale;c.beginPath();c.moveTo(x,y-height*.5);c.lineTo(x-2*scale,y-height*.35);c.lineTo(x+scale,y-height*.27);c.lineTo(x-2*scale,y-height*.1);c.stroke();for(let i=0;i<4;i++){const t=motion?(time*.3+i*.27)%1:.5;c.fillStyle=`rgba(46,42,34,${(1-t)*.35})`;c.beginPath();c.ellipse(x+(i-1.5)*2*scale+t*4*scale,y-height*.6-t*12*scale,(1+t*3)*scale,(1+t*4)*scale,0,0,7);c.fill();}}
 if(b.hp/b.max<.3){for(let i=0;i<3;i++){const flame=(motion?Math.sin(time*13+i):0)+3;c.fillStyle=i%2?'#ffdc71':'#ec8736';c.beginPath();c.moveTo(x+(i-1)*3*scale,y);c.quadraticCurveTo(x+(i-1)*3*scale-2*scale,y-3*scale,x+(i-1)*3*scale,y-flame*scale);c.quadraticCurveTo(x+(i-1)*3*scale+2*scale,y-2*scale,x+(i-1)*3*scale+scale,y);c.fill();}}
}
