// Worker slots are derived from the existing saved assignments; no duplicate roster.
export const workerKey=(kind,id,index)=>`${kind}:${id??'keep'}:${index}`;
export function workerTargetError(s,target){
  if(!['node','farm'].includes(target?.kind))return'Drop on a tree, stone, gold or farm.';
  const site=target?.kind==='node'?s.nodes.find(n=>n.id===target.id):s.buildings.find(b=>b.id===target?.id&&b.type==='farm');
  if(!site)return'Drop on a tree, stone, gold or farm.';
  if(target.kind==='node'){
    if(site.readyAt)return'This site is recovering.';
    if(site.remaining<=0)return'This site is depleted.';
  }
  if(site.workers>=(target.kind==='node'?3:4))return'This site already has enough workers.';
  return null;
}
export function moveWorker(s,total,source,target){
  if(!source||!Number.isInteger(source.index)||source.index<0)return'Select a worker first.';
  let origin;
  if(source.kind==='node')origin=s.nodes.find(n=>n.id===source.id);
  else if(source.kind==='farm')origin=s.buildings.find(b=>b.id===source.id&&b.type==='farm');
  else if(source.kind!=='idle')return'Select a worker first.';
  const busy=s.nodes.reduce((n,v)=>n+v.workers,0)+s.buildings.reduce((n,v)=>n+v.workers,0);
  if(source.kind==='idle'?source.index>=total-busy:!origin||source.index>=origin.workers)return'That worker has changed jobs. Select them again.';
  if(source.kind===target?.kind&&source.id===target.id)return'This worker is already working here.';
  const error=workerTargetError(s,target);if(error)return error;
  const destination=target.kind==='node'?s.nodes.find(n=>n.id===target.id):s.buildings.find(b=>b.id===target.id);
  // Validate both sides before changing either count, including a fully busy kingdom.
  if(origin)origin.workers--;
  destination.workers++;
  return null;
}
