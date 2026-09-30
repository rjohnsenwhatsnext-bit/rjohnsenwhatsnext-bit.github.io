// Derived from existing route saves: no save reset or new physics.
export function routeProgress(world, save={}) {
 const best=Number.isFinite(save.best)?Math.max(0,save.best):0;
 const won=Number.isFinite(save.summits)&&save.summits>0;
 const badges=world.sections.map((section,i)=>{
  const target=i+1<world.sections.length?world.sections[i+1].from-world.start[1]:world.summit-world.start[1];
  return {name:section.name,target,earned:won||best>=target};
 });
 return {badges,earned:badges.filter(b=>b.earned).length,total:badges.length,won,next:badges.find(b=>!b.earned)||null};
}
export function expeditionTitle(routes){
 const peaks=routes.filter(r=>r.won).length,stamps=routes.reduce((n,r)=>n+r.earned,0);
 return peaks===routes.length&&routes.length>3?'World Summit Legend':peaks>=3?'Three Peaks Legend':stamps>=14?'Alpine Veteran':stamps>=7?'Ridgewalker':stamps>=1?'Trailbreaker':'First Ascent';
}
export function drawGuide(ctx,w,h,world,climb,cam,scale,seconds){
 if(!climb||seconds<=0)return;
 const points=world.route.filter(p=>p.y>climb.body.y-.5&&p.y<climb.body.y+7);
 ctx.save();ctx.lineWidth=2;ctx.setLineDash([4,6]);ctx.strokeStyle='#ffdd83';ctx.beginPath();
 points.forEach((p,i)=>{const x=(p.x-cam.x)*scale+w/2,y=h*.55-(p.y-cam.y)*scale;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();ctx.setLineDash([]);
 for(let i=0;i<points.length;i+=2){const p=points[i],x=(p.x-cam.x)*scale+w/2,y=h*.55-(p.y-cam.y)*scale;ctx.fillStyle=p.kind==='ice'?'#95efff':'#ffdd83';ctx.strokeStyle='#142b37';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.stroke();}
 ctx.restore();
}

export async function forcedAdsAllowed(bridge){
 if(!bridge)return true;
 try{const result=await bridge.getEntitlements();return result?.verified===true&&Array.isArray(result.productIds)&&!result.productIds.includes('remove_ads');}
 catch{return false;}
}
