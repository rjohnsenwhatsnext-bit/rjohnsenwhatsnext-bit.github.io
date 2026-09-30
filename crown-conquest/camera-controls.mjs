// Keep the world point beneath the two-finger midpoint fixed while zooming.
export function bindCameraGestures(canvas,camera,{enabled,onTap,onPress,onDrag,onDrop,onCancel}) {
  const fingers=new Map();let previous=null,blockedTap=false,origin=null,held=false;
  const position=e=>({x:e.clientX,y:e.clientY});
  const pair=()=>{const [a,b]=[...fingers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};};
  function zoom(factor,from,to=from){const before=camera.zoom;camera.zoom=Math.max(.55,Math.min(2.5,before*factor));const ratio=camera.zoom/before;camera.x=to.x-innerWidth/2-(from.x-innerWidth/2-camera.x)*ratio;camera.y=to.y-innerHeight/2-(from.y-innerHeight/2-camera.y)*ratio;}
  canvas.addEventListener('pointerdown',e=>{if(!enabled()||(e.pointerType==='mouse'&&e.button!==0))return;canvas.setPointerCapture(e.pointerId);fingers.set(e.pointerId,position(e));if(fingers.size===1){origin=position(e);blockedTap=false;held=!!onPress?.(e.clientX,e.clientY);}else{if(held)onCancel?.();held=false;blockedTap=true;previous=pair();}});
  canvas.addEventListener('pointermove',e=>{if(!fingers.has(e.pointerId))return;const old=fingers.get(e.pointerId);fingers.set(e.pointerId,position(e));if(!enabled()){if(held)onCancel?.();held=false;blockedTap=true;return;}if(fingers.size>=2){const next=pair();if(previous)zoom(next.d/previous.d,previous,next);previous=next;blockedTap=true;}else{if(Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>8)blockedTap=true;if(blockedTap){if(held)onDrag?.(e.clientX,e.clientY);else{camera.x+=e.clientX-old.x;camera.y+=e.clientY-old.y;}}}});
  function end(e,cancelled){if(!fingers.has(e.pointerId))return;const tap=!cancelled&&!blockedTap&&fingers.size===1&&enabled();if(held){if(cancelled||!enabled())onCancel?.();else onDrop?.(e.clientX,e.clientY,blockedTap);}const consumed=held;held=false;fingers.delete(e.pointerId);previous=fingers.size>=2?pair():null;if(fingers.size){blockedTap=true;origin=[...fingers.values()][0];}if(tap&&!consumed)onTap(e.clientX,e.clientY);}
  canvas.addEventListener('pointerup',e=>end(e,false));
  canvas.addEventListener('pointercancel',e=>end(e,true));
  canvas.addEventListener('lostpointercapture',e=>end(e,true));
  canvas.addEventListener('wheel',e=>{if(!enabled())return;e.preventDefault();zoom(Math.exp(-e.deltaY*.0015),position(e));},{passive:false});
}
