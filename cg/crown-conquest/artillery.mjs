// Wheel locations are measured in the source painting, so they stay attached at
// every camera scale. Only the spokes rotate; the rim and axle remain fixed.
const rigs={
 'unit-4':[180,171,[[16,112,8,15],[91,147,11,17]]],
 'ironfjord-unit-4':[200,173,[[16,111,9,15],[90,144,11,17]]],
 'sunspire-unit-4':[200,190,[[20,130,9,17],[92,166,12,17]]],
 'industrial-unit-4':[282,193,[[87,106,39,60],[232,91,28,44]]],
 'ironfjord-industrial-unit-4':[274,178,[[150,113,32,46],[219,99,27,41]]],
 'sunspire-industrial-unit-4':[295,183,[[86,100,31,51],[220,93,23,39]]],
 'renaissance-unit-4':[295,200,[[199,127,32,39]]],
 'ironfjord-renaissance-unit-4':[280,184,[[52,106,27,48],[205,105,22,39]]],
 'sunspire-renaissance-unit-4':[254,214,[[157,139,29,48],[48,107,19,41]]]
};
export function drawArtillery(c,im,key,x,y,width,phase,shotAge=Infinity){
 if(!im)return;
 const height=width*im.height/im.width,rig=rigs[key];
 const recoil=shotAge<.28?Math.sin(shotAge/.28*Math.PI)*width*.045:0;
 c.save();c.translate(x-width/2-recoil,y-height);c.drawImage(im,0,0,width,height);
 if(rig){const sx=width/rig[0],sy=height/rig[1];
  for(const [wx,wy,rx,ry]of rig[2]){
   c.save();c.translate(wx*sx,wy*sy);c.scale(rx*sx,ry*sy);
   c.beginPath();c.arc(0,0,1,0,Math.PI*2);c.clip();
   c.fillStyle=key.includes('industrial')?'#333329':'#473b28';c.fillRect(-1,-1,2,2);
   c.rotate(phase);c.strokeStyle=key.includes('industrial')?'#9c9980':'#b39559';c.lineWidth=.11;
   for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a),Math.sin(a));c.stroke();}
   c.fillStyle='#d0b982';c.beginPath();c.arc(0,0,.19,0,Math.PI*2);c.fill();c.restore();
  }
 }
 c.restore();
}
