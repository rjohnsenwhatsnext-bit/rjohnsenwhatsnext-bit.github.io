// Roo Dodge: a night run down an outback highway. Roos hop ACROSS the lanes,
// so the lane that is clear now may not be in half a second. Road trains come
// the other way. Jerry cans keep the tank going.

const LANES = [100, 180, 260];
// The ute sits 120 above the bottom of the screen, whatever its height (the
// shell hands a fluid game the real height in ctx.H).
let CAR_Y = 520;
const CAR_W = 34;
const CAR_H = 58;

function rand(a, b) {
  return a + Math.random() * (b - a);
}

export default {
  canRevive: true,

  drawTitle(g, ctx) {
    CAR_Y = ctx.H - 120;
    drawRoad(g, ctx, performance.now() / 8);
    drawLights(g,180); drawCar(g,180); drawRoo(g,{x:83,y:156,lift:3,dir:1}); drawTruck(g,{x:260,y:130,len:125});
  },

  create(ctx) {
    CAR_Y = ctx.H - 120;
    let lane = 1;
    let carX = LANES[1];
    let speed = 260;
    let dist = 0;
    let fuel = 100;
    let scroll = 0;
    let spawnT = 0.8;
    let canT = 3;
    let things = [];
    let shake = 0;
    let swipeX = null;

    function move(d) {
      const next = Math.max(0, Math.min(2, lane + d));
      if (next !== lane) {
        lane = next;
        ctx.sfx(420 + lane * 80, 40);
      }
    }

    function spawn() {
      const r = Math.random();
      if (r < 0.55) {
        const fromLeft = Math.random() < 0.5;
        things.push({
          kind: 'roo',
          x: fromLeft ? 40 : 320,
          y: -30,
          dir: fromLeft ? 1 : -1,
          hopT: rand(0, 0.5),
          hopFrom: fromLeft ? 40 : 320,
          hopTo: fromLeft ? 40 : 320,
          lift: 0,
        });
      } else {
        const l = Math.floor(Math.random() * 3);
        things.push({ kind: 'truck', x: LANES[l], y: -120, len: 110 });
      }
    }

    function hits(t) {
      if (t.kind === 'roo') {
        if (t.lift > 14) return false; // mid hop, clears the bonnet
        return Math.abs(t.x - carX) < CAR_W / 2 + 10 && Math.abs(t.y - CAR_Y) < CAR_H / 2 + 12;
      }
      if (t.kind === 'truck') {
        return Math.abs(t.x - carX) < CAR_W / 2 + 14 && t.y + t.len / 2 > CAR_Y - CAR_H / 2 && t.y - t.len / 2 < CAR_Y + CAR_H / 2;
      }
      return Math.abs(t.x - carX) < 30 && Math.abs(t.y - CAR_Y) < 40;
    }

    return {
      pointerDown(x) {
        swipeX = x;
      },
      pointerUp(x) {
        if (swipeX === null) return;
        const dx = x - swipeX;
        if (Math.abs(dx) > 30) move(dx > 0 ? 1 : -1);
        else move(x < 180 ? -1 : 1);
        swipeX = null;
      },
      key(code, down) {
        if (!down) return;
        if (code === 'ArrowLeft' || code === 'KeyA') move(-1);
        if (code === 'ArrowRight' || code === 'KeyD') move(1);
      },

      revive() {
        things = things.filter((t) => t.y > CAR_Y + 80 || t.y < CAR_Y - 300);
        fuel = Math.max(fuel, 60);
        shake = 0;
      },

      update(dt) {
        CAR_Y = ctx.H - 120;
        speed = Math.min(620, 260 + dist / 40);
        dist += speed * dt;
        scroll += speed * dt;
        fuel -= dt * 3.2;
        carX += (LANES[lane] - carX) * Math.min(1, dt * 14);
        ctx.setScore(dist / 100);

        spawnT -= dt;
        if (spawnT <= 0) {
          spawn();
          spawnT = Math.max(0.42, 1.1 - dist / 30000) * rand(0.8, 1.3);
        }
        canT -= dt;
        if (canT <= 0) {
          things.push({ kind: 'can', x: LANES[Math.floor(Math.random() * 3)], y: -30 });
          canT = rand(4, 7);
        }

        for (const t of things) {
          t.y += speed * dt * (t.kind === 'truck' ? 1.45 : 1);
          if (t.kind === 'roo') {
            t.hopT += dt;
            const period = 0.55;
            if (t.hopT >= period) {
              t.hopT -= period;
              t.hopFrom = t.hopTo;
              t.hopTo = t.hopFrom + t.dir * 46;
            }
            const p = t.hopT / period;
            t.x = t.hopFrom + (t.hopTo - t.hopFrom) * p;
            t.lift = Math.sin(p * Math.PI) * 22;
          }
        }
        for (const t of things) {
          if (!t.gone && hits(t)) {
            if (t.kind === 'can') {
              t.gone = true;
              fuel = Math.min(100, fuel + 35);
              ctx.sfx(880, 90, 'triangle');
              ctx.addScore(0);
            } else {
              shake = 0.4;
              ctx.buzz(120);
              ctx.end(t.kind === 'roo' ? 'Hit a roo' : 'Road train got you');
              return;
            }
          }
        }
        things = things.filter((t) => !t.gone && t.y < ctx.H + 120 && t.x > -40 && t.x < 400);
        if (fuel <= 0) {
          fuel = 0;
          ctx.end('Ran out of fuel');
        }
        if (shake > 0) shake -= dt;
      },

      draw(g) {
        g.save();
        if (shake > 0) g.translate(rand(-4, 4), rand(-4, 4));
        drawRoad(g, ctx, scroll);
        for (const t of things) {
          if (t.kind === 'can') drawCan(g, t);
          if (t.kind === 'truck') drawTruck(g, t);
        }
        drawCar(g, carX);
        for (const t of things) if (t.kind === 'roo') drawRoo(g, t);
        drawLights(g, carX);
        g.restore();
        g.save();
        g.translate(0, ctx.H - 640); // the gauge stays on the bottom edge
        drawFuel(g, fuel);
        g.restore();
      },
    };
  },
};

function drawRoad(g, ctx, scroll) {
  g.fillStyle = '#472b29';
  g.fillRect(0, 0, ctx.W, ctx.H);
  // red dirt verge with scrub
  g.fillStyle = '#694131';
  g.fillRect(0, 0, 60, ctx.H);
  g.fillRect(300, 0, 60, ctx.H);
  g.fillStyle = '#334943';
  for (let i = 0; i < 14; i++) {
    const y = ((i * 97 + scroll * 0.9) % 740) - 50;
    g.beginPath();
    g.arc(i % 2 ? 22 : 338, y, 9 + (i % 3) * 3, 0, Math.PI * 2);
    g.fill();
    const tx=i%2?22:338;
    g.fillStyle='#142e294f';g.beginPath();g.ellipse(tx+5,y+9,17,10,-.4,0,Math.PI*2);g.fill();
    g.strokeStyle='#b69866';g.lineWidth=2;g.beginPath();g.moveTo(tx,y+12);g.lineTo(tx-3,y-2);g.moveTo(tx,y+2);g.lineTo(tx+7,y-5);g.stroke();
    for(let leaf=0;leaf<5;leaf++){const a=leaf*1.26;g.fillStyle=leaf%2?'#526c50':'#3d5947';g.beginPath();g.ellipse(tx+Math.cos(a)*7,y-4+Math.sin(a)*6,8,5,a,0,Math.PI*2);g.fill();}
    g.fillStyle='#334943';
    g.strokeStyle='#bd865050';g.lineWidth=1;g.beginPath();g.moveTo(tx-17,y+30);g.lineTo(tx-8,y+25);g.lineTo(tx+5,y+28);g.stroke();
  }
  g.fillStyle = '#272c38';
  g.fillRect(60, 0, 240, ctx.H);
  g.fillStyle='#ffffff04';for(let i=0;i<30;i++)g.fillRect(70+(i*53)%220,((i*41+scroll)%700)-30,1,11);
  g.fillStyle='#121c2b44';g.fillRect(80,0,38,ctx.H);g.fillRect(163,0,34,ctx.H);g.fillRect(244,0,34,ctx.H);
  for(let i=0;i<7;i++){const y=(i*110+scroll)%770-70;g.fillStyle='#efe0b0';g.fillRect(48,y,4,18);g.fillRect(308,y,4,18);g.fillStyle='#e86a51';g.fillRect(48,y+2,4,5);g.fillRect(308,y+2,4,5);}
  g.fillStyle='#d6a66b';
  const signY=(scroll*.9)%1900-100;
  g.fillRect(23,signY+20,3,34);g.save();g.translate(25,signY);g.rotate(Math.PI/4);g.fillStyle='#ffd16e';g.fillRect(-16,-16,32,32);g.strokeStyle='#362d26';g.lineWidth=2;g.strokeRect(-13,-13,26,26);g.restore();
  g.fillStyle='#362d26';g.font='900 9px system-ui';g.textAlign='center';g.fillText('ROOS',25,signY+3);g.textAlign='left';
  g.fillStyle = '#d9d2c0';
  g.fillRect(62, 0, 3, ctx.H);
  g.fillRect(295, 0, 3, ctx.H);
  g.fillStyle = '#e8c547';
  for (let i = -1; i < 12; i++) {
    const y = (i * 70 + (scroll % 70));
    g.fillRect(138, y, 4, 36);
    g.fillRect(218, y, 4, 36);
  }
}

function drawCar(g,x){
 g.fillStyle='#0006';g.fillRect(x-22,CAR_Y-23,46,64);g.fillStyle='#60d5c0';g.fillRect(x-17,CAR_Y-29,34,58);
 g.fillStyle='#a9f0de';g.fillRect(x-14,CAR_Y-27,28,6);g.fillStyle='#172e45';g.fillRect(x-13,CAR_Y-20,26,12);
 g.fillStyle='#1f504f';g.fillRect(x-14,CAR_Y+4,28,22);g.strokeStyle='#7ee1c7';g.lineWidth=1;
 for(let i=-9;i<=9;i+=6){g.beginPath();g.moveTo(x+i,CAR_Y+7);g.lineTo(x+i,CAR_Y+23);g.stroke();}
 g.fillStyle='#edca83';g.fillRect(x-10,CAR_Y+10,11,10);g.fillStyle='#cf9d5a';g.fillRect(x-5,CAR_Y+11,2,8);
 g.fillStyle='#fff7c5';g.fillRect(x-14,CAR_Y-30,8,4);g.fillRect(x+6,CAR_Y-30,8,4);
 g.fillStyle='#ff755f';g.fillRect(x-14,CAR_Y+26,6,4);g.fillRect(x+8,CAR_Y+26,6,4);
 g.fillStyle='#10151c';for(const side of [-1,1])for(const y of [-20,12])g.fillRect(x+side*17-2,CAR_Y+y,4,12);
}
function drawLights(g,x){
 const grad=g.createLinearGradient(0,CAR_Y-230,0,CAR_Y-25);grad.addColorStop(0,'#fff5b900');grad.addColorStop(1,'#fff5b94a');g.fillStyle=grad;
 for(const side of [-1,1]){g.beginPath();g.moveTo(x+side*11,CAR_Y-28);g.lineTo(x+side*11-68,CAR_Y-235);g.lineTo(x+side*11+68,CAR_Y-235);g.closePath();g.fill();}
}

function drawTruck(g, t) {
  const top = t.y - t.len / 2;
  g.fillStyle = '#c0392b';
  g.fillRect(t.x - 20, t.y + t.len / 2 - 26, 40, 26); // prime mover, facing us
  g.fillStyle = '#fff6c4';
  g.fillRect(t.x - 18, t.y + t.len / 2 - 4, 8, 4);
  g.fillRect(t.x + 10, t.y + t.len / 2 - 4, 8, 4);
  g.fillStyle = '#6b7280';
  g.fillRect(t.x - 22, top, 44, t.len - 30);
  g.fillStyle = '#4b5563';
  for (let y = top + 6; y < top + t.len - 34; y += 14) g.fillRect(t.x - 22, y, 44, 3);
}

function drawRoo(g, t) {
  const y = t.y - t.lift;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(t.x, t.y + 10, 12, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#a8633a';
  g.beginPath();
  g.ellipse(t.x, y, 10, 14, t.dir * 0.3, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(t.x + t.dir * 8, y - 14, 6, 0, Math.PI * 2);
  g.fill();
  g.fillRect(t.x + t.dir * 6 - 2, y - 26, 3, 8);
  g.strokeStyle = '#a8633a';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(t.x - t.dir * 8, y + 6);
  g.lineTo(t.x - t.dir * 22, y + 12);
  g.stroke();
  g.fillStyle = '#fff3a0';
  g.fillRect(t.x + t.dir * 10 - 1, y - 16, 2, 2); // eye shine
}

function drawCan(g, t) {
  g.fillStyle = '#d62d20';
  g.fillRect(t.x - 10, t.y - 14, 20, 28);
  g.fillStyle = '#f5f1e8';
  g.fillRect(t.x - 4, t.y - 18, 8, 5);
  g.strokeStyle = '#7f1d1d';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(t.x - 8, t.y - 10);
  g.lineTo(t.x + 8, t.y + 10);
  g.stroke();
}

function drawFuel(g,fuel){
 g.fillStyle='#111b2aee';g.fillRect(12,586,336,43);g.fillStyle='#d5d9db';g.font='600 10px system-ui';g.textAlign='right';g.fillText('TAP / SWIPE',335,613);g.textAlign='left';
 g.fillStyle='#465060';g.fillRect(23,603,130,9);g.fillStyle=fuel<25?'#ef4444':'#ffd16e';g.fillRect(23,603,130*Math.max(0,fuel)/100,9);
 g.fillStyle='#f5f1e8';g.font='700 10px system-ui';g.fillText('FUEL',163,612);
}
