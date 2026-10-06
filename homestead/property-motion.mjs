// Distance-driven presentation. Heading survives stops; no wall-clock animation.
export class MotionTracks {
 constructor(){this.items=new Map();}
 sample(id,x,y,time){
  let p=this.items.get(id);
  if(!p){p={x,y,time,heading:0,distance:0,moving:false};this.items.set(id,p);return p;}
  const dx=x-p.x,dy=y-p.y,d=Math.hypot(dx,dy);
  p.moving=time>p.time&&d>.00001&&d<4;
  if(p.moving){p.heading=Math.atan2(dy,dx);p.distance+=d;}
  Object.assign(p,{x,y,time});return p;
 }
 prune(ids){for(const id of this.items.keys())if(!ids.has(id))this.items.delete(id);}
}

// Solid models projected through the map camera: the bonnet always leads.
export function drawVehicle(map,kind,x,y,pose={heading:0,distance:0},rider=true){
 if(map.painted?.vehicle(map,kind,x,y,pose))return;
 const c=map.ctx,z=map.zoom,angle=pose.heading,cs=Math.cos(angle),sn=Math.sin(angle);
 const project=(u,v,h=0)=>{const p=map.point(x+u*cs-v*sn,y+u*sn+v*cs);return {x:p.x,y:p.y-h*28*z};};
 const faces=[];
 const box=(u,v,h,l,w,t,col)=>{
  const pts=[[u,v,h],[u+l,v,h],[u+l,v+w,h],[u,v+w,h],[u,v,h+t],[u+l,v,h+t],[u+l,v+w,h+t],[u,v+w,h+t]];
  for(const [indices,tint] of [[[0,1,5,4],.70],[[1,2,6,5],.85],[[2,3,7,6],.75],[[3,0,4,7],.60],[[4,5,6,7],1.12]]){
   const rgb=col.match(/\w\w/g).map(n=>Math.min(255,Math.round(parseInt(n,16)*tint)));
   const points=indices.map(i=>project(...pts[i]));
   const depth=indices.reduce((a,i)=>a+(pts[i][0]*(cs+sn)+pts[i][1]*(cs-sn)+pts[i][2]*2),0)/4;
   faces.push({depth,points,fill:'rgb('+rgb.join(',')+')'});
  }
 };
 const tractor=/Tractor/.test(kind),harvester=/Harvester|header/.test(kind);
 const truck=kind==='truck',camper=kind==='camper',digger=kind==='excavator',bike=kind==='bike';
 const length=harvester?1.9:tractor?1.5:truck?2.15:camper?1.7:digger?1.5:bike?.8:1.35,width=bike?.26:truck?.69:.62;
 const p=project(0,0);c.save();
 if(pose.moving&&map.life?.motion!==false&&map.getState?.().weather!=='Rain')for(let i=0;i<3;i++){
  const phase=(pose.distance*1.6+i/3)%1,q=project(-length/2-.15-phase*.6,(i-1)*.1);
  c.fillStyle='rgba(202,176,132,'+(.13*(1-phase))+')';c.beginPath();c.ellipse(q.x,q.y,(3+phase*5)*z,(1+phase*2)*z,0,0,Math.PI*2);c.fill();
 }
 c.fillStyle='#15251c48';c.beginPath();c.ellipse(p.x,p.y, (truck?33:bike?13:25)*z,(truck?13:bike?5:10)*z,0,0,Math.PI*2);c.fill();
 box(-length/2,-width/2,.13,length,width,.16,'293a3b');
 // Tyres touch the ground. Wheel facets turn only with travelled distance.
 const wheel=(u,v)=>{
  const radius=tractor&&u<0?.3:harvester?.25:bike?.19:.155,thick=.11;
  const ring=(side,r)=>Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return [u+Math.cos(a)*r,side,radius+Math.sin(a)*r];});
  const front=ring(v+thick,radius),back=ring(v,radius);
  const face=(pts,fill)=>faces.push({depth:pts.reduce((sum,q)=>sum+q[0]*(cs+sn)+q[1]*(cs-sn)+q[2]*2,0)/pts.length,points:pts.map(q=>project(...q)),fill});
  face(back,'#1d2926');face(front,'#26322e');
  for(let i=0;i<16;i++)face([back[i],back[(i+1)%16],front[(i+1)%16],front[i]],i%2?'#27322e':'#354039');
  for(const side of [v-.002,v+thick+.002]){
   face(ring(side,radius*.48),'#929e95');face(ring(side,radius*.2),'#465950');
   const spin=pose.distance*9,pts=[project(u+Math.cos(spin)*radius*.4,side,radius+Math.sin(spin)*radius*.4),project(u-Math.cos(spin)*radius*.4,side,radius-Math.sin(spin)*radius*.4)];
   faces.push({depth:u*(cs+sn)+side*(cs-sn)+radius*2+.01,points:pts,fill:null});
  }
 };
 for(const u of [-length*.32,length*.32])for(const v of bike?[-.055]:[-width/2-.09,width/2-.02])wheel(u,v);
 if(bike){
  box(-.25,-.12,.3,.5,.24,.12,'b45935');box(-.16,-.12,.42,.27,.24,.07,'343c36');
  if(rider){box(-.1,-.1,.49,.21,.2,.3,'728b76');box(-.07,-.1,.8,.17,.2,.15,'d9b785');box(-.13,-.16,.94,.3,.32,.035,'b7a077');box(.02,-.19,.54,.23,.07,.07,'d9b785');box(.02,.12,.54,.23,.07,.07,'d9b785');}
 }else if(tractor||harvester){
  const colour=harvester?'cbb052':kind==='bigTractor'?'638957':'598c75';
  box(-.5,-.3,.32,1.05,.6,.22,colour);
  box(-.42,-.27,.55,.5,.54,.48,'456a70');
  box(-.48,-.34,1.03,.63,.68,.07,colour);
  box(.08,-.25,.52,.62,.5,.17,colour);
  box(.58,-.2,.34,.09,.4,.18,'354a41');
  box(.12,.15,.65,.04,.04,.48,'344b44');
  for(const v of [-.22,.16])box(.71,v,.57,.025,.09,.07,'fff1b8');
  if(harvester){
   box(.78,-.7,.13,.35,1.4,.18,'bba15a');
   for(let v=-.65;v<.7;v+=.15)box(.94,v,.12,.28,.045,.07,'4b5744');
   box(-.6,-.28,.65,.6,.56,.3,colour);
  }
  if(pose.implement){
   box(-1.05,-.045,.22,.42,.09,.07,'7e8e78');
   const spray=pose.implement==='sprayer';
   box(-1.4,-.48,.18,.38,.96,.13,spray?'ceb65e':'98754d');
   if(spray){box(-1.4,-.23,.32,.4,.46,.27,'d5c999');box(-1.2,-1,.33,.05,2,.04,'718773');}
   else for(let v=-.4;v<.45;v+=.16)box(-1.5,v,.05,.18,.04,.16,'677365');
  }
 }else if(digger){
  box(-.64,-.42,.03,1.25,.17,.22,'333d35');box(-.64,.25,.03,1.25,.17,.22,'333d35');
  box(-.55,-.3,.3,.85,.6,.3,'d7a443');box(-.43,-.25,.6,.48,.5,.48,'536f6b');box(-.48,-.3,1.08,.58,.6,.07,'e0b152');
  box(.15,-.07,.45,.65,.14,.15,'d3a03a');box(.7,-.07,.17,.15,.14,.38,'d3a03a');box(.7,-.24,.02,.35,.48,.18,'646853');
 }else{
  const cab=truck?.35:camper?.24:.05;
  box(cab,-width/2,.29,length/2-cab,width,.28,truck?'ddd6bd':camper?'dfddcd':'b6c6ba');
  box(cab,-width/2+.03,.57,.48,width-.06,.3,'3f6268');
  box(cab-.035,-width/2-.025,.87,.55,width+.05,.06,truck?'e4ddc5':'cbd6ca');
  box(length/2-.035,-width/2,.33,.05,width,.16,'687c79');
  for(const v of [-width*.38,width*.22])box(length/2+.018,v,.39,.025,.12,.07,'fff0b4');
  for(const v of [-width*.38,width*.22])box(-length/2-.02,v,.3,.025,.12,.06,'b84d37');
  if(truck){
   box(-length/2,-width/2,.3,1.35,width,.15,'9a9e8e');
   for(const v of [-width/2,width/2-.035]){
    for(let h=.52;h<1.1;h+=.14)box(-length/2,v,h,1.35,.035,.045,'c4c7b5');
    for(let u=-length/2;u<.3;u+=.32)box(u,v,.45,.04,.04,.7,'9aa797');
   }
   box(-length/2,-width/2,1.14,1.35,width,.04,'d4d5c1');
  }else if(camper){
   box(-length/2,-width/2,.3,1.02,width,.8,'e4dfc9');
   for(const v of [-width/2-.008,width/2])box(-.65,v,.7,.48,.018,.23,'486d72');
   box(-.68,-.22,1.11,.6,.44,.035,'6d8c97');
  }else{
   box(-length/2,-width/2,.3,.7,width,.05,'798f86');
   for(const v of [-width/2,width/2-.045])box(-length/2,v,.35,.7,.045,.2,'b6c6ba');
   box(-length/2,-width/2,.35,.04,width,.2,'b6c6ba');
  }
 }
 faces.sort((a,b)=>a.depth-b.depth);
 for(const f of faces){if(f.fill)map.polygon(f.points,f.fill,'#233b3526',.45*z);else{c.strokeStyle='#e2dcc7';c.lineWidth=z;c.beginPath();c.moveTo(f.points[0].x,f.points[0].y);c.lineTo(f.points[1].x,f.points[1].y);c.stroke();}}
 c.restore();
}
