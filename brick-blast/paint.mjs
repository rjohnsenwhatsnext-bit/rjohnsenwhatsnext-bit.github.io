// Original painted gameplay art. Rules and feature timing live elsewhere.
const art={};
const names=['mine','cart','dynamite','idle','plant','blast-v2',...Array.from({length:4},(_,i)=>'walk-'+i),...Array.from({length:6},(_,i)=>'ore-'+(i+1))];
export const artReady=Promise.all(names.map(name=>new Promise(resolve=>{const im=new Image();im.onload=()=>{art[name]=im;resolve(true)};im.onerror=()=>resolve(false);im.src='assets/'+name+'.webp'})));
function round(g,x,y,w,h,r=8){g.beginPath();g.roundRect(x,y,w,h,r);}
export function createPaint(g){
 const image=(name,x,y,w,h)=>{if(art[name])g.drawImage(art[name],x,y,w,h)};
 let lightT=0,animate=true;
 return {
 world(L,game,view,t,cart,motion,flash=0){
  const {W,H,bx,by,bw,cartY:y}=L;
  lightT=t;animate=motion;
  g.fillStyle='#0b1213';g.fillRect(0,0,W,H);
  if(art.mine){const im=art.mine,s=Math.max(W/im.width,H/im.height);g.drawImage(im,(W-im.width*s)/2,(H-im.height*s)/2,im.width*s,im.height*s)}
  g.fillStyle='#050c0e35';g.fillRect(0,0,W,H);
  const shade=g.createLinearGradient(0,0,0,H);shade.addColorStop(0,'#03090dd9');shade.addColorStop(.3,'#06111411');shade.addColorStop(1,'#020a0ba0');g.fillStyle=shade;g.fillRect(0,0,W,H);
  const lamp=g.createRadialGradient(W*.28,Math.max(64,by-145),8,W*.28,Math.max(64,by-145),Math.max(W*.82,330));
  lamp.addColorStop(0,`rgba(255,185,89,${.14+flash*.2})`);lamp.addColorStop(.45,'rgba(175,101,47,.045)');lamp.addColorStop(1,'rgba(25,35,35,0)');g.fillStyle=lamp;g.fillRect(0,0,W,H);
  if(motion){for(let i=0;i<24;i++){const x=(i*127.7+Math.sin(t*.25+i)*14)%W,yy=(i*83-t*(3+i%4)+H*3)%H;g.fillStyle='#ffe3a4'+(i%3===0?'66':'28');g.beginPath();g.arc(x,yy,.65+i%3*.42,0,7);g.fill()}}
  // Iron, timber and brass frame with a recessed stone cutting bed.
  g.shadowColor='#000';g.shadowBlur=25;const timber=g.createLinearGradient(0,by-12,0,by+bw+12);timber.addColorStop(0,'#654529');timber.addColorStop(.16,'#2a201a');timber.addColorStop(.8,'#352618');timber.addColorStop(1,'#79502a');g.fillStyle=timber;round(g,bx-12,by-12,bw+24,bw+24,11);g.fill();g.shadowBlur=0;
  g.strokeStyle='#c39b5f';g.lineWidth=2;g.stroke();g.strokeStyle='#221a13';g.lineWidth=3;round(g,bx-7,by-7,bw+14,bw+14,7);g.stroke();g.fillStyle='#101b1c';round(g,bx-4,by-4,bw+8,bw+8,4);g.fill();
  for(const x of [bx-7,bx+bw+7])for(const yy of [by-7,by+bw+7]){g.fillStyle='#d7ad6c';g.beginPath();g.arc(x,yy,3,0,7);g.fill();g.fillStyle='#5d3e23';g.fillRect(x-1,yy-.5,2,1)}
  const fill=Math.min(1,game?game.meter/game.meterMax:0),x0=bx+10,x1=bx+bw-10;
  // Track, riveted progress rail and a physically filling cart.
  g.fillStyle='#3e2d20';for(let x=x0;x<x1;x+=20){g.fillRect(x,y+25,10,11);g.fillStyle='#7d5633';g.fillRect(x,y+25,10,2);g.fillStyle='#3e2d20'}
  g.fillStyle='#252827';g.fillRect(x0,y+28,x1-x0,9);g.fillStyle='#a3aaa2';g.fillRect(x0,y+26,x1-x0,2);g.fillStyle='#737b79';g.fillRect(x0,y+33,x1-x0,2);
  g.fillStyle='#101919';round(g,x0,y+41,x1-x0,5,2);g.fill();
  if(fill){const grad=g.createLinearGradient(x0,0,x1,0);grad.addColorStop(0,'#8d5928');grad.addColorStop(1,'#ffe09a');g.fillStyle=grad;round(g,x0,y+41,(x1-x0)*fill,5,2);g.fill()}
  const cx=x0+37+(x1-x0-74)*(view==='feature'?1:fill)+cart.x,jig=motion&&fill>.85?Math.sin(t*27)*1.2:0;
  g.save();g.translate(cx+jig,y+(motion?Math.sin(t*2.4)*.4:0));
  g.fillStyle='#0008';g.beginPath();g.ellipse(0,34,43,8,0,0,7);g.fill();
  if(cart.glow){g.shadowBlur=26;g.shadowColor='#ffb52a'}
  for(let i=0;i<Math.ceil(fill*6);i++)image('dynamite',-27+(i%3)*15,-25-Math.floor(i/3)*9,28,38);
  image('cart',-46,-48,92,92);g.restore();
  g.font='800 10px system-ui';g.textAlign='left';g.fillStyle='#e9d5ac';g.fillText(view==='feature'?'STAND BACK':fill>.85?'ALMOST LOADED':'DYNAMITE CART',x0,y-32);
  g.textAlign='right';g.fillStyle='#f9c969';g.fillText(Math.floor(fill*100)+'%',x1,y-32);
  // Recessed tray compartments aligned with the input hit areas.
  for(let i=0;i<3;i++){const tx=L.trayX+i*L.trayW/3+4,tw=L.trayW/3-8,ty=L.trayY+8,th=L.trayH-18;g.fillStyle='#071114d8';round(g,tx,ty,tw,th,10);g.fill();g.strokeStyle='#aa855858';g.lineWidth=1.5;g.stroke();g.fillStyle='#c49a5150';g.fillRect(tx+8,ty+5,tw-16,1);g.fillStyle='#20333644';g.fillRect(tx+8,ty+th-8,tw-16,2)}
  g.textAlign='center';g.font='700 10px system-ui';g.fillStyle='#c8bfa1';g.fillText('DRAG ORE INTO THE MINE',W/2,Math.min(H-16,L.trayY+L.trayH+10));
 },
 brick(x,y,s,k,alpha=1){g.save();g.globalAlpha=alpha;g.fillStyle='#030a0bbd';round(g,x+2,y+3,s-2,s-2,Math.min(5,s*.1));g.fill();if(art['ore-'+k])image('ore-'+k,x+1,y+1,s-2,s-2);else{g.fillStyle=['','#414b56','#b8784b','#98513d','#bfc7cf','#d8a639','#2aafaf'][k];g.fillRect(x+2,y+2,s-4,s-4)}if(k>=4&&alpha>.9&&animate){const sweep=(lightT*.18+k*.21+x*.003)%1,shine=g.createLinearGradient(x+s*(sweep-.32),y,x+s*(sweep+.16),y+s*.35);shine.addColorStop(0,'#ffffff00');shine.addColorStop(.5,k===6?'#b1fdff40':'#fff7d72c');shine.addColorStop(1,'#ffffff00');g.globalCompositeOperation='screen';g.fillStyle=shine;g.fillRect(x+3,y+3,s-6,s-6)}g.restore()},
 blast(x,y,size,alpha,rotation=0){if(!art['blast-v2'])return;g.save();g.translate(x,y);g.rotate(rotation);g.globalAlpha=alpha;image('blast-v2',-size/2,-size/2,size,size);g.restore()},
 miner(L,miner,t,motion){if(!miner)return;const s=L.cell*1.8,key=miner.state==='plant'?'plant':miner.state==='run'&&motion?'walk-'+Math.floor(t*10)%4:'idle';g.save();g.translate(miner.x,miner.y);g.scale(miner.facing,1);g.fillStyle='#0006';g.beginPath();g.ellipse(0,3,s*.28,s*.055,0,0,7);g.fill();const light=g.createRadialGradient(s*.22,-s*.8,0,s*.22,-s*.8,s*.48);light.addColorStop(0,'#ffe9a52b');light.addColorStop(1,'#ffe9a500');g.fillStyle=light;g.fillRect(-s*.3,-s*1.3,s,s);image(key,-s*.5,-s*.95,s,s);g.restore()},
 sticks(L,sticks,t){for(const stick of sticks){const x=L.bx+(stick.c+.5)*L.cell,y=L.by+(stick.r+.5)*L.cell,s=L.cell*(stick.big?1.05:.83);g.save();g.translate(x,y);g.rotate(-.16);g.shadowColor='#000';g.shadowBlur=7;image('dynamite',-s*.5,-s*.5,s,s);g.shadowBlur=0;if(stick.lit){g.globalCompositeOperation='lighter';const fx=s*.12,fy=-s*.42,r=3+Math.sin(t*45)*1.3,glow=g.createRadialGradient(fx,fy,0,fx,fy,18);glow.addColorStop(0,'#fff8d5');glow.addColorStop(.25,'#ffb42ccc');glow.addColorStop(1,'#ff6c0000');g.fillStyle=glow;g.fillRect(fx-18,fy-18,36,36);g.fillStyle='#fff6bd';g.beginPath();g.arc(fx,fy,r,0,7);g.fill();for(let i=0;i<4;i++){const a=t*(12+i*3)+i*1.7,d=5+(t*(18+i*4)%11);g.strokeStyle=i%2?'#ff8618':'#ffe198';g.lineWidth=1;g.beginPath();g.moveTo(fx,fy);g.lineTo(fx+Math.cos(a)*d,fy+Math.sin(a)*d);g.stroke()}}g.restore()}},
 };
}
