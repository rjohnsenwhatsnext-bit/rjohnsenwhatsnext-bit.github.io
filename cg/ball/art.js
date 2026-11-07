const sprites = typeof Image !== 'undefined' ? new Image() : null;
if(sprites) sprites.src=new URL('./assets/gameplay-v3.png',import.meta.url).href;
const cuts={ball:[60,69,450,445],rock:[561,164,666,340],spring:[47,684,525,479],portal:[631,549,605,623]};
function sprite(g,name,x,y,w,h){if(!sprites?.complete||!sprites.naturalWidth)return false;const a=cuts[name],k=sprites.naturalWidth/1280;g.drawImage(sprites,a[0]*k,a[1]*k,a[2]*k,a[3]*k,x,y,w,h);return true;}
const garden = typeof Image !== 'undefined' ? new Image() : null;
if (garden) garden.src = new URL('./assets/garden-v2.png', import.meta.url).href;
function backdrop(g,ctx,cave=false) {
  const w=ctx.W||360,h=ctx.H;
  g.fillStyle=cave?'#092e35':'#386f68';g.fillRect(0,0,w,h);
  if(garden?.complete && garden.naturalWidth){
    const k=Math.max(w/garden.width,h/garden.height);
    g.save();if(cave)g.filter='hue-rotate(35deg) brightness(.38) saturate(.8)';
    g.drawImage(garden,(w-garden.width*k)/2,(h-garden.height*k)/2,garden.width*k,garden.height*k);g.restore();
  }
  const shade=g.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#042c3430');shade.addColorStop(.55,'#092b3210');shade.addColorStop(1,'#082c3870');g.fillStyle=shade;g.fillRect(0,0,w,h);
  const t=typeof performance==='undefined'?0:performance.now()/1000;
  for(let i=0;i<24;i++){const x=(i*137.4+Math.sin(t*.25+i)*17)%w,y=(i*91.7-t*(3+i%3)+h*100)%h;g.fillStyle=cave?'#84fff050':'#fff0ae70';g.beginPath();g.arc(x,y,1+i%2*.6,0,Math.PI*2);g.fill();}
}
// Ball's drawing: every tile, the ball, the backgrounds. Plain canvas 2D, in pixels.

// ---- drawing ------------------------------------------------------------------

export function sky(g,ctx){backdrop(g,ctx);}

export function brick(g,x,y,s,gx=0,gy=0,top=true){
  if(sprites?.complete&&sprites.naturalWidth){
    g.fillStyle='#635238';g.fillRect(x,y,s,s);g.save();g.beginPath();g.rect(x,y-3,s,s+3);g.clip();
    if(top){const k=sprites.naturalWidth/1280;g.drawImage(sprites,675*k,187*k,410*k,255*k,x-(gx%2)*s,y-3,s*2,s*1.13);}
    else{const k=sprites.naturalWidth/1280;g.drawImage(sprites,(680+(gx%2)*155)*k,280*k,155*k,145*k,x,y,s,s);}
    g.restore();return;
  }
  const grad=g.createLinearGradient(x,y,x+s,y+s);grad.addColorStop(0,'#aa9370');grad.addColorStop(.25,'#897955');grad.addColorStop(1,'#3d4a3e');g.fillStyle=grad;g.fillRect(x,y,s,s);
  g.fillStyle='#203f3c';g.fillRect(x,y+s-3,s,3);g.fillRect(x+s-2,y,2,s);
  g.strokeStyle='#d7c69a45';g.lineWidth=1;g.strokeRect(x+3,y+3,s-6,s-7);
  for(let i=0;i<7;i++){const n=(gx*17+gy*31+i*13)%41;g.fillStyle=i%2?'#d0bb8c26':'#203a342f';g.fillRect(x+3+n%(s-8),y+5+(n*7)%(s-10),3+i%4,1);}
  if(top){const moss=g.createLinearGradient(0,y,0,y+13);moss.addColorStop(0,'#b7cb76');moss.addColorStop(.4,'#6f9858');moss.addColorStop(1,'#365846');g.fillStyle=moss;g.fillRect(x,y,s,8);for(let i=0;i<6;i++){g.beginPath();g.ellipse(x+i*s/5,y+7,5,3+(i+gx)%3,0,0,Math.PI*2);g.fill();}g.fillStyle='#e7dcb080';g.fillRect(x,y,s,1);}
}

export function stone(g,x,y,s,gx=0,gy=0,top=true){
 const grad=g.createLinearGradient(x,y,x+s,y+s);grad.addColorStop(0,'#507c78');grad.addColorStop(1,'#172d38');g.fillStyle=grad;g.fillRect(x,y,s,s);g.strokeStyle='#80ac9c35';g.lineWidth=2;g.strokeRect(x+2,y+2,s-4,s-4);
 g.strokeStyle='#0c242e';g.beginPath();g.moveTo(x+s*.3,y);g.lineTo(x+s*.5,y+s*.4);g.lineTo(x+s*.3,y+s);g.stroke();
 if(top){g.fillStyle='#80c3b5';g.fillRect(x,y,s,3);if((gx+gy)%3===0){g.fillStyle='#62dacb';g.beginPath();g.moveTo(x+9,y);g.lineTo(x+13,y-9);g.lineTo(x+18,y);g.fill();}}
}

export function caveBack(g,ctx){backdrop(g,ctx,true);}

export function fire(g, x, y, s, t, gx) {
  for (let i = 0; i < 3; i++) {
    const fx = x + s * (0.2 + i * 0.3);
    const h = s * (0.55 + 0.2 * Math.sin(t * 9 + gx + i * 2));
    const grad = g.createLinearGradient(fx, y + s, fx, y + s - h);
    grad.addColorStop(0, '#ff5a1f');
    grad.addColorStop(0.6, '#ffb020');
    grad.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(fx - s * 0.14, y + s);
    g.quadraticCurveTo(fx - s * 0.1, y + s - h * 0.6, fx, y + s - h);
    g.quadraticCurveTo(fx + s * 0.1, y + s - h * 0.6, fx + s * 0.14, y + s);
    g.fill();
  }
}

export function jet(g, x, y, s, t, on) {
  g.fillStyle = '#3f3a36';
  g.fillRect(x + s * 0.25, y + s * 0.7, s * 0.5, s * 0.3);
  g.fillStyle = on ? '#ff5a1f' : '#5a4a3a';
  g.fillRect(x + s * 0.35, y + s * 0.62, s * 0.3, s * 0.1);
  if (!on) return;
  const grad = g.createLinearGradient(0, y + s * 0.65, 0, y - s * 1.6);
  grad.addColorStop(0, 'rgba(255,90,31,0.95)');
  grad.addColorStop(0.5, 'rgba(255,176,32,0.8)');
  grad.addColorStop(1, 'rgba(255,240,150,0)');
  g.fillStyle = grad;
  const wob = Math.sin(t * 20) * 3;
  g.beginPath();
  g.moveTo(x + s * 0.3, y + s * 0.65);
  g.quadraticCurveTo(x + s * 0.5 + wob, y - s * 0.5, x + s * 0.5, y - s * 1.6);
  g.quadraticCurveTo(x + s * 0.5 - wob, y - s * 0.5, x + s * 0.7, y + s * 0.65);
  g.fill();
}

export function spikes(g, x, y, s, ceiling) {
  const steel=g.createLinearGradient(x,0,x+s,0);steel.addColorStop(0,'#304856');steel.addColorStop(.3,'#def3f3');steel.addColorStop(.48,'#698d99');steel.addColorStop(.7,'#f3ffff');steel.addColorStop(1,'#314d5a');g.fillStyle=steel;
  g.strokeStyle = '#4b5563';
  g.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const bx = x + (i * s) / 3;
    g.beginPath();
    if (ceiling) {
      g.moveTo(bx, y);
      g.lineTo(bx + s / 6, y + s * 0.62);
      g.lineTo(bx + s / 3, y);
    } else {
      g.moveTo(bx, y + s);
      g.lineTo(bx + s / 6, y + s * 0.38);
      g.lineTo(bx + s / 3, y + s);
    }
    g.closePath();
    g.fill();
    g.stroke();
  }
}

export function water(g, x, y, s, t, surface) {
  const waterlight=g.createLinearGradient(0,y,0,y+s);waterlight.addColorStop(0,'#66dedfa0');waterlight.addColorStop(1,'#145b97cc');g.fillStyle=waterlight;
  g.fillRect(x, y, s, s);
  if (surface) {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 4; i++) g.fillRect(x + i * 10, y + 2 + Math.sin(t * 3 + x * 0.1 + i) * 2, 6, 2);
  }
}

export function ring(g, cx, cy, taken, back) {
  // an upright hoop the ball rolls through: back half behind the ball, front half over it
  g.save();
  g.shadowColor=taken?'transparent':'#ffc862';g.shadowBlur=taken?0:10;
  g.lineWidth = 5;
  g.strokeStyle = taken ? 'rgba(150,150,150,0.6)' : back ? '#97702c' : '#ffdf88';
  g.beginPath();
  g.ellipse(cx, cy, 7, 19, 0, back ? Math.PI / 2 : -Math.PI / 2, back ? (3 * Math.PI) / 2 : Math.PI / 2);
  g.stroke();
  g.restore();
}

export function ballArt(g, x, y, r, spin, state={}) {
  if(sprites?.complete&&sprites.naturalWidth){
    g.save();g.translate(x,y);const squash=(state.impact||0)*.28,stretch=Math.min(.16,Math.abs(state.vy||0)*.009);
    g.scale((1+squash-stretch*.4)*(state.vx<-.3?-1:1),1-squash+stretch);
    g.rotate(Math.sin(spin*.4)*.045);sprite(g,'ball',-r,-r,r*2,r*2);g.restore();return;
  }
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.ellipse(x, y + r * 0.95, r * 0.8, r * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.15, x, y, r);
  grad.addColorStop(0, '#ff8a7a');
  grad.addColorStop(0.5, '#e0322b');
  grad.addColorStop(1, '#8e1a14');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  // a seam that turns as it rolls
  g.strokeStyle = 'rgba(80,10,8,0.45)';
  g.lineWidth = Math.max(1.5, r * 0.12);
  g.beginPath();
  g.arc(x, y, r * 0.62, spin, spin + Math.PI * 0.7);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath();
  g.ellipse(x - r * 0.38, y - r * 0.45, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function exitDoor(g, x, y, s, open, t) {
  if(sprites?.complete&&sprites.naturalWidth){
    g.save();if(!open)g.filter='saturate(.3) brightness(.55)';
    sprite(g,'portal',x-s*.18,y-s*.65,s*1.36,s*1.65);g.restore();
    if(open){g.save();g.globalAlpha=.22+.1*Math.sin(t*4);g.fillStyle='#c2fff0';g.beginPath();g.ellipse(x+s/2,y+s*.58,s*.24,s*.4,0,0,Math.PI*2);g.fill();g.restore();}return;
  }
  g.fillStyle = open ? '#2fbf71' : '#6b7280';
  g.beginPath();
  g.moveTo(x + 4, y + s);
  g.lineTo(x + 4, y + s * 0.35);
  g.arc(x + s / 2, y + s * 0.35, s / 2 - 4, Math.PI, 0);
  g.lineTo(x + s - 4, y + s);
  g.fill();
  if (open) {
    g.fillStyle = `rgba(200,255,220,${0.5 + 0.3 * Math.sin(t * 6)})`;
    g.fillRect(x + 10, y + s * 0.4, s - 20, s * 0.6);
  } else {
    g.fillStyle = '#374151';
    g.fillRect(x + s / 2 - 1, y + s * 0.3, 2, s * 0.7);
  }
}

export function flag(g, x, y, s, active) {
  g.fillStyle = '#6b4f2a';
  g.fillRect(x + s / 2 - 2, y + 4, 4, s - 4);
  g.fillStyle = active ? '#2fbf71' : '#f5f1e8';
  g.beginPath();
  g.moveTo(x + s / 2 + 2, y + 5);
  g.lineTo(x + s - 4, y + 11);
  g.lineTo(x + s / 2 + 2, y + 17);
  g.fill();
}

export function pump(g, x, y, s) {
  g.fillStyle = '#2f80ed';
  g.fillRect(x + s * 0.3, y + s * 0.35, s * 0.4, s * 0.65);
  g.fillStyle = '#1b4f99';
  g.fillRect(x + s * 0.2, y + s * 0.25, s * 0.6, s * 0.12);
  g.fillRect(x + s * 0.47, y + s * 0.05, s * 0.06, s * 0.22);
  g.fillStyle = '#fff';
  g.font = `900 ${s * 0.3}px system-ui`;
  g.textAlign = 'center';
  g.fillText('+', x + s / 2, y + s * 0.78);
}

export function pin(g, x, y, s) {
  g.strokeStyle = '#d1d5db';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x + s / 2, y + s);
  g.lineTo(x + s / 2, y + s * 0.35);
  g.stroke();
  g.fillStyle = '#e0322b';
  g.beginPath();
  g.arc(x + s / 2, y + s * 0.3, s * 0.13, 0, Math.PI * 2);
  g.fill();
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function wrap(g, text, cx, y, width, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    if (g.measureText(line + w).width > width && line) {
      g.fillText(line.trim(), cx, y);
      y += lh;
      line = '';
    }
    line += w + ' ';
  }
  g.fillText(line.trim(), cx, y);
}

// A ramp: dir 1 rises to the right ('/'), -1 rises to the left ('\').
export function ramp(g, x, y, s, dir, cave) {
  const material=g.createLinearGradient(x,y,x,y+s);material.addColorStop(0,cave?'#79a299':'#acbd7e');material.addColorStop(1,cave?'#233f47':'#4b5942');g.fillStyle=material;
  g.beginPath();
  if (dir > 0) {
    g.moveTo(x, y + s);
    g.lineTo(x + s, y + s);
    g.lineTo(x + s, y);
  } else {
    g.moveTo(x, y);
    g.lineTo(x, y + s);
    g.lineTo(x + s, y + s);
  }
  g.closePath();
  g.fill();
  if(!cave&&sprites?.complete&&sprites.naturalWidth){g.save();g.clip();const k=sprites.naturalWidth/1280;g.drawImage(sprites,680*k,275*k,320*k,170*k,x,y,s,s);g.restore();}
  g.strokeStyle = cave ? '#83c2b1' : '#bed48a';
  g.lineWidth = 3;
  g.beginPath();
  if (dir > 0) {
    g.moveTo(x, y + s);
    g.lineTo(x + s, y);
  } else {
    g.moveTo(x, y);
    g.lineTo(x + s, y + s);
  }
  g.stroke();
}

export function spring(g, x, y, s, squash) {
  if(sprites?.complete&&sprites.naturalWidth){const h=s*(1-squash*.35);sprite(g,'spring',x,y+s-h,s,h);return;}
  g.fillStyle = '#374151';
  g.fillRect(x + 2, y + s * 0.55, s - 4, s * 0.45);
  g.strokeStyle = '#9ca3af';
  g.lineWidth = 3;
  g.beginPath();
  const top = y + s * (0.18 + squash * 0.25);
  for (let i = 0; i <= 4; i++) g.lineTo(x + (i % 2 ? s * 0.3 : s * 0.7), top + ((y + s * 0.55 - top) * i) / 4);
  g.stroke();
  g.fillStyle = '#22c55e';
  g.fillRect(x + 3, top - 5, s - 6, 7);
}

export function crumble(g, x, y, s, life) {
  // life 1 = whole, falls apart towards 0
  g.globalAlpha = Math.max(0.15, life);
  brick(g,x,y,s,Math.floor(x/s),Math.floor(y/s),true);g.fillStyle = '#c5915420';
  g.fillRect(x + 1, y + 1, s - 2, s - 2);
  g.strokeStyle = '#7a5a2f';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + s * 0.2, y + s * 0.1);
  g.lineTo(x + s * 0.45, y + s * 0.5);
  g.lineTo(x + s * 0.3, y + s * 0.9);
  g.moveTo(x + s * 0.7, y + s * 0.15);
  g.lineTo(x + s * 0.55, y + s * 0.55);
  g.lineTo(x + s * 0.8, y + s * 0.85);
  g.stroke();
  g.globalAlpha = 1;
}

export function platform(g, x, y, w, h) {
  const metal=g.createLinearGradient(0,y,0,y+h);metal.addColorStop(0,'#c0b579');metal.addColorStop(.3,'#387976');metal.addColorStop(1,'#173c44');g.fillStyle=metal;
  g.fillRect(x, y, w, h);
  g.fillStyle = '#fbbf24';
  for (let i = 0; i < w; i += 16) g.fillRect(x + i, y, 8, 4);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x, y + h - 3, w, 3);
}

// The floating thumb stick: a base where the thumb landed, a knob where it is now.
export function stick(g, ax, ay, kx, ky) {
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(ax, ay, 46, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.arc(kx, ky, 22, 0, Math.PI * 2);
  g.fill();
}
