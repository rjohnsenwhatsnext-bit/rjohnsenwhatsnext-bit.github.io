// Original painted gameplay art. Rules and feature timing live elsewhere.
const art={};
const names=['mine','cart','dynamite','idle','plant',...Array.from({length:4},(_,i)=>'walk-'+i),...Array.from({length:6},(_,i)=>'ore-'+(i+1))];
export const artReady=Promise.all(names.map(name=>new Promise(resolve=>{const im=new Image();im.onload=()=>{art[name]=im;resolve(true)};im.onerror=()=>resolve(false);im.src='assets/'+name+'.webp'})));
function round(g,x,y,w,h,r=8){g.beginPath();g.roundRect(x,y,w,h,r);}
export function createPaint(g){
 const image=(name,x,y,w,h)=>{if(art[name])g.drawImage(art[name],x,y,w,h)};
 return {
 world(L,game,view,t,cart,motion){
  const {W,H,bx,by,bw,cartY:y}=L;
  g.fillStyle='#0b1213';g.fillRect(0,0,W,H);
  if(art.mine){const im=art.mine,s=Math.max(W/im.width,H/im.height);g.drawImage(im,(W-im.width*s)/2,(H-im.height*s)/2,im.width*s,im.height*s)}
  g.fillStyle='#050c0e55';g.fillRect(0,0,W,H);
  const shade=g.createLinearGradient(0,0,0,H);shade.addColorStop(0,'#03090dd9');shade.addColorStop(.3,'#06111411');shade.addColorStop(1,'#020a0ba0');g.fillStyle=shade;g.fillRect(0,0,W,H);
  if(motion){for(let i=0;i<15;i++){const x=(i*127.7+Math.sin(t*.25+i)*14)%W,yy=(i*83-t*(2+i%4)+H*3)%H;g.fillStyle='#ffe3a4'+(i%3===0?'55':'25');g.beginPath();g.arc(x,yy,1+i%2*.5,0,7);g.fill()}}
  // Dark timber-and-brass board surround keeps every empty cell readable.
  g.shadowColor='#000';g.shadowBlur=22;g.fillStyle='#352719';round(g,bx-10,by-10,bw+20,bw+20,10);g.fill();g.shadowBlur=0;
  g.strokeStyle='#b68a4e';g.lineWidth=1.5;g.stroke();g.fillStyle='#171e1c';round(g,bx-5,by-5,bw+10,bw+10,5);g.fill();
  for(const x of [bx-6,bx+bw+6])for(const yy of [by-6,by+bw+6]){g.fillStyle='#d7ad6c';g.beginPath();g.arc(x,yy,2.5,0,7);g.fill()}
  const fill=Math.min(1,game?game.meter/game.meterMax:0),x0=bx+10,x1=bx+bw-10;
  // Track, riveted progress rail and a physically filling cart.
  g.fillStyle='#3e2d20';for(let x=x0;x<x1;x+=20)g.fillRect(x,y+25,10,11);
  g.fillStyle='#737b79';g.fillRect(x0,y+26,x1-x0,2);g.fillRect(x0,y+33,x1-x0,2);
  g.fillStyle='#101919';round(g,x0,y+41,x1-x0,5,2);g.fill();
  if(fill){const grad=g.createLinearGradient(x0,0,x1,0);grad.addColorStop(0,'#8d5928');grad.addColorStop(1,'#ffe09a');g.fillStyle=grad;round(g,x0,y+41,(x1-x0)*fill,5,2);g.fill()}
  const cx=x0+37+(x1-x0-74)*(view==='feature'?1:fill)+cart.x,jig=motion&&fill>.85?Math.sin(t*35):0;
  g.save();g.translate(cx+jig,y);
  if(cart.glow){g.shadowBlur=20;g.shadowColor='#ffb52a'}
  for(let i=0;i<Math.ceil(fill*6);i++)image('dynamite',-27+(i%3)*15,-25-Math.floor(i/3)*9,28,38);
  image('cart',-46,-48,92,92);g.restore();
  g.font='800 10px system-ui';g.textAlign='left';g.fillStyle='#e9d5ac';g.fillText(view==='feature'?'STAND BACK':fill>.85?'ALMOST LOADED':'DYNAMITE CART',x0,y-32);
  g.textAlign='right';g.fillStyle='#f9c969';g.fillText(Math.floor(fill*100)+'%',x1,y-32);
  // Recessed tray compartments aligned with the input hit areas.
  for(let i=0;i<3;i++){g.fillStyle='#0a1619b8';round(g,L.trayX+i*L.trayW/3+4,L.trayY+8,L.trayW/3-8,L.trayH-18,10);g.fill();g.strokeStyle='#a07b4944';g.lineWidth=1;g.stroke()}
  g.textAlign='center';g.font='700 10px system-ui';g.fillStyle='#c8bfa1';g.fillText('DRAG ORE INTO THE MINE',W/2,Math.min(H-16,L.trayY+L.trayH+10));
 },
 brick(x,y,s,k,alpha=1){g.save();g.globalAlpha=alpha;g.fillStyle='#0b1113';round(g,x+1,y+1,s-2,s-2,Math.min(5,s*.1));g.fill();if(art['ore-'+k])image('ore-'+k,x+1,y+1,s-2,s-2);else{g.fillStyle=['','#414b56','#b8784b','#98513d','#bfc7cf','#d8a639','#2aafaf'][k];g.fillRect(x+2,y+2,s-4,s-4)}g.restore()},
 miner(L,miner,t,motion){if(!miner)return;const s=L.cell*1.8,key=miner.state==='plant'?'plant':miner.state==='run'&&motion?'walk-'+Math.floor(t*10)%4:'idle';g.save();g.translate(miner.x,miner.y);g.scale(miner.facing,1);g.fillStyle='#0006';g.beginPath();g.ellipse(0,3,s*.28,s*.055,0,0,7);g.fill();const light=g.createRadialGradient(s*.22,-s*.8,0,s*.22,-s*.8,s*.48);light.addColorStop(0,'#ffe9a52b');light.addColorStop(1,'#ffe9a500');g.fillStyle=light;g.fillRect(-s*.3,-s*1.3,s,s);image(key,-s*.5,-s*.95,s,s);g.restore()},
 sticks(L,sticks,t){for(const stick of sticks){const x=L.bx+(stick.c+.5)*L.cell,y=L.by+(stick.r+.5)*L.cell,s=L.cell*(stick.big?1.05:.83);g.save();g.translate(x,y);g.rotate(-.16);g.shadowColor='#000';g.shadowBlur=7;image('dynamite',-s*.5,-s*.5,s,s);g.shadowBlur=0;if(stick.lit){g.globalCompositeOperation='lighter';const r=3+Math.sin(t*45)*1.3,glow=g.createRadialGradient(s*.12,-s*.42,0,s*.12,-s*.42,15);glow.addColorStop(0,'#fff1aa');glow.addColorStop(.3,'#ffb42caa');glow.addColorStop(1,'#ff6c0000');g.fillStyle=glow;g.fillRect(s*.12-15,-s*.42-15,30,30);g.fillStyle='#fff6bd';g.beginPath();g.arc(s*.12,-s*.42,r,0,7);g.fill()}g.restore()}},
 };
}
