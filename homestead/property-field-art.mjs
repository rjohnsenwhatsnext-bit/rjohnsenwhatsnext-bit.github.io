// Crop rows follow the map projection and grow from their actual simulation age.
export function drawField(map,s,b,time,motion){
 const c=map.ctx,z=map.zoom,w=b.w||3,h=b.h||3;
 map.rectShape(b.x,b.y,w,h,b.stage==='bare'?'#97714d':'#71543d','#c6a977');
 const growth=b.stage==='ready'?1:b.stage==='growing'?Math.max(.05,Math.min(1,(s.time-b.sownAt)/(b.ready-b.sownAt))):0;
 for(let row=0;row<h*3;row++){
  const y=b.y+(row+.5)/3,a=map.point(b.x+.12,y),end=map.point(b.x+w-.12,y);
  c.strokeStyle=row%2?'#483b2e66':'#b08c6044';c.lineWidth=2*z;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(end.x,end.y);c.stroke();
  if(!growth)continue;
  for(let col=0;col<w*4;col++){
   const x=b.x+(col+.5)/4,p=map.point(x,y),seed=(col*13+row*7)%11;
   const cane=b.path==='cane',vegetable=b.path==='vegetables';
   const height=(cane?23:vegetable?7:13)*growth*z;
   const sway=motion?Math.sin(time*.001+seed)*growth*z*.65:0;
   c.strokeStyle=b.stage==='ready'&&!vegetable?(cane?'#83964c':'#dbbd65'):'#57783e';c.lineWidth=(cane?1.8:1.2)*z;
   c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+sway,p.y-height);c.moveTo(p.x+sway,p.y-height*.65);c.lineTo(p.x-3*z,p.y-height*.82);c.moveTo(p.x+sway,p.y-height*.5);c.lineTo(p.x+3*z,p.y-height*.72);c.stroke();
   if(vegetable){c.fillStyle='#698d45';c.beginPath();c.ellipse(p.x,p.y-2*z,4*growth*z,2.6*growth*z,-.3,0,Math.PI*2);c.fill();if(b.stage==='ready'&&b.crop==='pumpkins'){c.fillStyle='#d58d3e';c.beginPath();c.ellipse(p.x+z,p.y-2*z,2.3*z,1.8*z,0,0,Math.PI*2);c.fill();}}
   else if(growth>.6&&!cane){c.fillStyle=b.stage==='ready'?'#eed084':'#a3ad55';c.beginPath();c.ellipse(p.x+sway,p.y-height,1.2*z,3*growth*z,.15,0,Math.PI*2);c.fill();}
  }
 }
 if(map.activeBuilding===b.id||b.stage==='ready')map.label(b.x+w/2,b.y+h/2,b.stage==='ready'?'Ready to harvest':b.stage==='growing'?Math.round(growth*100)+'% grown':b.stage==='worked'?'Ready to sow':'Bare soil',b.stage==='ready');
}
