// A small cached river surface, mapped into the same camera space as the terrain.
// The mask follows the blue water in the artwork and leaves bridges/rocks solid.
export function riverSurface() {
  const width=768,top=.365,bottom=.505;
  const source=document.createElement('canvas'),mask=document.createElement('canvas'),surface=document.createElement('canvas');
  let image=null,height=0,paint,ready=false;
  const noise=n=>{const x=Math.sin(n*127.1+53.7)*43758.5453;return x-Math.floor(x);};
  const clamp=n=>Math.max(0,Math.min(1,n));
  function prepare(art){
    if(!art.complete||!art.naturalWidth)return false;
    image=art;height=Math.round(width*art.naturalHeight/art.naturalWidth*(bottom-top));
    for(const layer of [source,mask,surface]){layer.width=width;layer.height=height;}
    const base=source.getContext('2d',{willReadFrequently:true});
    base.drawImage(art,0,art.naturalHeight*top,art.naturalWidth,art.naturalHeight*(bottom-top),0,0,width,height);
    const pixels=base.getImageData(0,0,width,height),alpha=mask.getContext('2d').createImageData(width,height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=(y*width+x)*4,r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2],nx=x/width,ny=top+y/height*(bottom-top);
      let strength=clamp((Math.min(g-r,b-r)-3)/17)*clamp((g-28)/30);
      // Stone bridges plus their foundations stay anchored, even at maximum zoom.
      if((nx>.174&&nx<.299)||(nx>.701&&nx<.825))strength=0;
      for(const [rx,ry,ax,ay]of [[.092,.430,.036,.016],[.382,.466,.028,.012],[.94,.397,.024,.012],[.90,.463,.018,.009]]){
        const d=Math.hypot((nx-rx)/ax,(ny-ry)/ay);strength*=clamp((d-1)*3);
      }
      strength*=clamp(y/8)*clamp((height-y-1)/8);
      alpha.data[i]=alpha.data[i+1]=alpha.data[i+2]=255;alpha.data[i+3]=Math.round(strength*220);
    }
    mask.getContext('2d').putImageData(alpha,0,0);paint=surface.getContext('2d');ready=true;return true;
  }
  return {draw(ctx,art,x,y,mapWidth,mapHeight,time,enabled=true){
    if(!enabled)return;
    if((!ready||image!==art)&&!prepare(art))return;
    paint.clearRect(0,0,width,height);
    // Refract the painted river in thin horizontal bands: no new image per frame.
    for(let row=0;row<height;row+=3){
      const shift=Math.sin(row*.12-time*2.1)*2.5+Math.sin(row*.045-time*.85)*2;
      paint.drawImage(source,0,row,width,Math.min(3,height-row),shift,row,width,Math.min(3,height-row));
    }
    paint.lineCap='round';
    // Current streaks drift consistently downstream with softer crossing ripples.
    for(let i=0;i<86;i++){
      const px=((noise(i)*1.15+time*(.018+noise(i+200)*.016))%1.15-.075)*width;
      const py=(.13+noise(i+400)*.73)*height+Math.sin(time*1.6+i)*2.1;
      const len=5+noise(i+700)*19,pulse=.5+.5*Math.sin(time*2+i*1.7);
      paint.strokeStyle=`rgba(185,235,218,${.10+pulse*.26})`;paint.lineWidth=.55+noise(i+300)*.7;
      paint.beginPath();paint.moveTo(px,py);paint.quadraticCurveTo(px+len*.5,py-1.4-pulse,px+len,py);paint.stroke();
    }
    // Small widening ripples suggest eddies between the banks and bridge piers.
    for(let i=0;i<12;i++){
      const phase=(time*.35+noise(i+900))%1,r=3+phase*13;
      paint.strokeStyle=`rgba(210,244,229,${Math.sin(phase*Math.PI)*.24})`;paint.lineWidth=.7;
      paint.beginPath();paint.ellipse(noise(i+950)*width,(.22+noise(i+1000)*.56)*height,r,r*.23,0,.15,Math.PI*1.75);paint.stroke();
    }
    paint.globalCompositeOperation='destination-in';paint.drawImage(mask,0,0);paint.globalCompositeOperation='source-over';
    ctx.drawImage(surface,x,y+mapHeight*top,mapWidth,mapHeight*(bottom-top));
  }};
}
