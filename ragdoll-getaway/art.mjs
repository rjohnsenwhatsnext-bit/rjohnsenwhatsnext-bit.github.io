const palettes={bank:['#172743','#314b66','#68809a','#e8be85'],street:['#30254f','#725b82','#ba8089','#f4b978'],museum:['#142e39','#2c5961','#81a898','#d4d8af'],train:['#242343','#525078','#9d84a0','#f5c096']};
export function makeRenderer(canvas){const c=canvas.getContext('2d');let w=1,h=1,scale=1,camera=0;const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function resize(){w=canvas.clientWidth;h=canvas.clientHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);c.setTransform(d,0,0,d,0,0);scale=Math.max(.8,Math.min(1.3,h/710));}resize();
 const line=(x,y,X,Y,color,width=2)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke();};
 function box(x,y,W,H,color,r=0){c.fillStyle=color;c.beginPath();c.roundRect(x,y,W,H,r);c.fill();}
 function text(t,x,y,size,color='#fff7df',align='left'){c.fillStyle=color;c.font=`900 ${size}px system-ui`;c.textAlign=align;c.fillText(t,x,y);}
 function circle(x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
 function doll(d,t,face=1,large=false){const p=d.torso; c.lineCap='round';
  const dark='#111a31',suit=d.robot?'#657f98':'#ef7463',light=d.robot?'#9de4ed':'#ffcd91';
  // Every limb uses its actual connected Matter body, including during a tumble.
  d.legs.forEach((b,i)=>{c.save();c.translate(b.position.x,b.position.y);c.rotate(b.angle);box(-8,-20,16,37,d.robot?'#506278':'#364866',6);box(-9,10,21,12,dark,4);c.restore();});
  c.save();c.translate(p.position.x,p.position.y);c.rotate(p.angle);box(-17,-23,34,46,dark,8);box(-14,-21,28,41,d.flash?'#fff':'#ef7463',7);if(d.robot)box(-14,-21,28,41,suit,7);box(-14,4,28,9,d.robot?'#364b65':'#fff4d0');if(!d.robot){box(-20,-13,10,31,'#a17956',4);box(-6,-6,12,12,'#fac856',3);}else circle(0,-8,5,'#77f1ee');c.restore();
  d.arms.forEach(b=>{c.save();c.translate(b.position.x,b.position.y);c.rotate(b.angle);box(-7,-17,14,32,suit,6);circle(0,14,7,light);c.restore();});
  const head=d.head;c.save();c.translate(head.position.x,head.position.y);c.rotate(head.angle);circle(0,0,17,dark);circle(0,0,14,light);if(d.robot){box(-15,-9,30,18,'#334862',6);box(-10,-3,20,4,d.flash?'#fff':'#ff8178',2);line(-10,-15,-15,-24,'#8fd5df',3);circle(-15,-25,3,'#ffce63');}else{box(-15,-6,30,12,dark,4);box(face===1?-6:-11,-3,5,4,'#fff9df',2);box(face===1?5:0,-3,5,4,'#fff9df',2);c.fillStyle='#73d9c5';c.beginPath();c.ellipse(-3,-14,15,6,-.1,Math.PI,Math.PI*2);c.fill();line(-6,10,5,10,'#9c5c41',2);}c.restore();
  if(!d.dead){c.save();c.translate(p.position.x+face*19,p.position.y-9);if(face<0)c.scale(-1,1);box(0,-8,32,15,dark,4);box(2,-7,26,10,d.robot?'#9eb8cb':'#ffcf54',3);box(11,5,7,13,dark,2);box(29,-5,6,8,'#95f6e4',2);if(t-d.lastShot<4){c.fillStyle='#ffe97e';c.beginPath();c.moveTo(36,-8);c.lineTo(53,0);c.lineTo(36,8);c.fill();}c.restore();}
 }
 function draw(s,mode='play'){
  c.clearRect(0,0,w,h);const pal=palettes[s.level.theme];const grad=c.createLinearGradient(0,0,0,h);grad.addColorStop(0,pal[0]);grad.addColorStop(1,pal[2]);c.fillStyle=grad;c.fillRect(0,0,w,h);
  const target=Math.max(0,Math.min(s.level.length-w/scale+230,s.player.torso.position.x-w/scale*.32));camera+=(target-camera)*(reduce?1:.12);
  circle(w*.78,h*.26,52*scale,pal[3]);circle(w*.78+18*scale,h*.26-8*scale,45*scale,pal[0]);
  for(let i=-1;i<18;i++){const x=i*150-(camera*.22%150);const bh=100+(i*73%160+160)%160;box(x,h*.72-bh,132,bh,pal[1],3);for(let j=0;j<4;j++)for(let k=0;k<3;k++)if((i+j+k)%3!==0)box(x+17+k*32,h*.72-bh+18+j*28,13,10,'#f5c58e26',2);}
  // World viewport: ground stays above the thumb controls at every aspect ratio.
  const offsetY=h-(h<500?110:140)-560*scale;
  c.save();c.translate(-camera*scale,offsetY);c.scale(scale,scale);
  const first=Math.floor(camera/420)*420;
  for(let x=first-420;x<camera+w/scale+500;x+=420){box(x,245,390,315,pal[1],8);box(x+12,259,366,289,pal[2],3);box(x+20,270,350,36,pal[0],4);text(s.level.theme==='bank'?'LUCKY STAR BANK':s.level.theme==='museum'?'MUSEUM OF BAD IDEAS':s.level.theme==='train'?'MIDNIGHT EXPRESS':'DOWNTOWN',x+195,295,14,'#ffe4bd','center');for(let j=0;j<3;j++){box(x+27+j*117,320,100,192,'#172b43',4);box(x+32+j*117,324,90,6,'#ffffff14');line(x+77+j*117,326,x+77+j*117,510,'#7e9a9f',3);line(x+30+j*117,410,x+124+j*117,410,'#7e9a9f',3);}box(x+12,534,366,26,pal[0]);}
  for(const b of s.platforms){const a=b.bounds;box(a.min.x,560,a.max.x-a.min.x,160,'#172236');box(a.min.x,560,a.max.x-a.min.x,13,'#abc0c0');box(a.min.x,574,a.max.x-a.min.x,8,'#526b78');for(let x=Math.max(a.min.x,first-200);x<Math.min(a.max.x,camera+w/scale+200);x+=70)line(x,600,x+40,600,'#ffffff12',3);}
  for(const[a,b]of s.level.gaps){for(const x of[a-37,b]){box(x,550,36,10,'#ffc857');for(let j=0;j<3;j++)line(x+j*12,550,x+j*12+7,560,'#253249',5);}text('JUMP',a-24,538,11,'#ffd264','right');}
  for(const e of s.level.extras)if(e.type==='spring'){box(e.x-35,548,70,12,'#ee7caf',5);for(let j=0;j<4;j++)line(e.x-27+j*16,547,e.x-20+j*16,536,'#ffd0e5',3);text('BOING',e.x,524,10,'#ffd0e5','center');}
  for(const rope of s.ropes){let a={x:rope[0].position.x,y:180};for(const b of rope){line(a.x,a.y,b.position.x,b.position.y,'#e3c995',5);a=b.position;}circle(a.x,a.y,12,'#ffcf54');text('GRAB',a.x,a.y-24,10,'#ffecb5','center');}
  for(const q of s.props){if(q.broken)continue;const {x,y}=q.body.position;
   if(q.type==='crate'){box(x-23,y-25,46,50,'#1a273c',3);box(x-20,y-22,40,44,'#c28c55',2);line(x-17,y-18,x+17,y+18,'#f2bc76',6);line(x+17,y-18,x-17,y+18,'#97603f',5);}
   if(q.type==='glass'){box(x-12,y-60,24,120,'#13263c',2);box(x-8,y-56,16,110,'#a7eff355');line(x-5,y+15,x+6,y-14,'#d4ffff',2);line(x-5,y+37,x+6,y+8,'#d4ffff',2);}
   if(q.type==='barrel'){box(x-23,y-26,46,52,'#e78341',9);box(x-24,y-15,48,6,'#7e4939',2);box(x-24,y+12,48,6,'#7e4939',2);text('!',x,y+9,27,'#fff4bd','center');}
  }
  for(const l of s.loot)if(!l.taken){const y=l.y+(reduce?0:Math.sin(s.tick*.05+l.x)*4);circle(l.x,y,24,'#ffda5a12');box(l.x-12,y-11,24,22,'#f6c65a',5);line(l.x-6,y-12,l.x-6,y-18,'#ffeda0',3);line(l.x-6,y-18,l.x+6,y-18,'#ffeda0',3);line(l.x+6,y-18,l.x+6,y-12,'#ffeda0',3);text('$',l.x,y+6,15,'#67472f','center');}
  const vx=s.level.length-80;box(vx-65,469,120,66,'#222b40',11);box(vx-62,472,114,59,'#ffc857',10);box(vx+9,482,30,23,'#366d81',4);box(vx-54,484,52,22,'#eaaa40',3);box(vx+43,507,16,6,'#fff5c4',3);circle(vx-35,535,17,'#162036');circle(vx+33,535,17,'#162036');circle(vx-35,535,8,'#a4b6bc');circle(vx+33,535,8,'#a4b6bc');text('GETAWAY',vx,449,13,'#ffdc69','center');text('↓',vx,469,20,'#ffdc69','center');
  for(const d of s.guards){doll(d,s.tick,s.player.torso.position.x>d.torso.position.x?1:-1);if(!d.dead&&d.alertAt&&s.tick-d.lastShot>110)text('!',d.torso.position.x,d.torso.position.y-65,22,'#ffbd76','center');}
  if(!s.invincible||s.tick%10<7)doll(s.player,s.tick,s.face);
  for(const b of s.bullets){line(b.x-b.vx*.65,b.y-b.vy*.65,b.x,b.y,b.enemy?'#ff857d':'#fff1a0',b.enemy?5:4);circle(b.x,b.y,3,b.enemy?'#ffb8a1':'#fff9cd');}
  for(const q of s.particles){c.globalAlpha=q.life/45;box(q.x,q.y,5,5,q.color,1);}c.globalAlpha=1;
  c.restore();
  if(mode==='menu'){
   // Original hero illustration, built from the same doll art at a readable scale.
   c.save();const k=w<600?2.7:4.1;c.translate(w<600?w*.77:w*.76,h*.60);c.rotate(.22);c.scale(k,k);const fake={torso:{position:{x:0,y:0},angle:-.2},head:{position:{x:-4,y:-35},angle:.12},arms:[{position:{x:-29,y:0},angle:.6},{position:{x:29,y:-5},angle:-.8}],legs:[{position:{x:-15,y:37},angle:.3},{position:{x:19,y:38},angle:-.5}],lastShot:-100};doll(fake,0,1,true);c.restore();
  }
 }
 return {draw,resize,reset:()=>camera=0};
}
