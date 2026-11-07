const W = 360, H = 640, FLOOR = 25;
const palettes = ['#fc8d80', '#ffb080', '#ffd28e', '#f3e2ad', '#97dace', '#87b9d5', '#b3a1d9'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function block(g, x, y, w, color, windows = true) {
  g.fillStyle = '#11152c55'; g.fillRect(x + 7, y + 7, w, FLOOR);
  g.fillStyle = color; g.fillRect(x, y, w, FLOOR);
  g.fillStyle = '#ffffff35'; g.fillRect(x, y, w, 4);
  g.fillStyle = '#161e3b44'; g.fillRect(x + w - 5, y + 4, 5, FLOOR - 4);
  if (windows) {
    for (let wx = x + 9; wx < x + w - 10; wx += 17) {
      g.fillStyle = '#20264599'; g.fillRect(wx, y + 9, 7, 10);
      g.fillStyle = '#fff0ba'; g.fillRect(wx + 1, y + 10, 2, 7);
    }
  }
}

function sky(g, time, height = 0) {
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#293052'); grad.addColorStop(.55, '#956782'); grad.addColorStop(1, '#edac92');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffe7b8'; g.beginPath(); g.arc(279, 151 - Math.min(40, height * .1), 38, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fbe0be30';
  for (let i = 0; i < 6; i++) {
    const x = ((i * 91 + time * 3) % 480) - 90;
    g.fillRect(x, 118 + i * 46, 70 + i * 6, 3);
    g.fillRect(x + 18, 124 + i * 46, 53, 2);
  }
  for (let layer = 0; layer < 3; layer++) {
    g.fillStyle = ['#68566f', '#45465f', '#2d344e'][layer];
    for (let i = 0; i < 10; i++) {
      const bh = 40 + ((i * 47 + layer * 37) % 115);
      const y = H - bh + height * (.025 + layer * .025);
      const x = i * 42 - layer * 13;
      g.fillRect(x, y, 32, bh + 100);
      g.fillRect(x + 8, y - 7, 15, 8);
      if (layer === 2) {
        g.fillStyle = '#efc58955';
        for (let wy = y + 12; wy < H; wy += 15) { g.fillRect(x + 6, wy, 4, 6); g.fillRect(x + 21, wy, 4, 6); }
        g.fillStyle = '#2d344e';
      }
    }
  }
  g.strokeStyle = '#30354f'; g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const bx = (time * 12 + i * 110) % 440 - 40, by = 220 + Math.sin(time * .7 + i) * 12 + i * 25;
    g.beginPath(); g.moveTo(bx - 5, by); g.lineTo(bx, by + 3); g.lineTo(bx + 5, by); g.stroke();
  }
}

export default {
  canRevive: true,
  drawTitle(g) {
    sky(g, performance.now() / 1000);
    for (let i = 0; i < 10; i++) block(g, 88 + Math.sin(i * .8) * 7, 580 - i * FLOOR, 176 - i * 3, palettes[i % palettes.length]);
  },
  create(ctx) {
    const tower = [{ x: 100, y: 555, w: 160, color: '#97dace' }];
    let moving, phase = 'moving', count = 0, streak = 0, camera = 0, time = 0;
    let chunks = [], sparks = [], banner = 'TAP TO DROP', bannerTime = 3, perfectFlash = 0, lastSafe;
    function next() {
      const top = tower.at(-1);
      const left = count % 2 === 0;
      moving = { x: left ? 18 : W - 18 - top.w, y: top.y - 100, w: top.w, vx: (left ? 1 : -1) * Math.min(225, 95 + count * 7), vy: 0, color: palettes[count % palettes.length] };
      phase = 'moving';
    }
    function drop() {
      if (phase !== 'moving') return;
      lastSafe = { ...tower.at(-1) };
      phase = 'falling'; moving.vy = 70; ctx.sfx(320, 45, 'sine');
    }
    function lose() { phase = 'ended'; ctx.end('One floor too far'); }
    function land() {
      const top = tower.at(-1), delta = moving.x - top.x;
      let left = Math.max(moving.x, top.x), right = Math.min(moving.x + moving.w, top.x + top.w);
      if (right <= left) { chunks.push({ ...moving, vx: Math.sign(delta) * 80, vy: 80, angle: 0 }); lose(); return; }
      const perfect = Math.abs(delta) <= 5;
      if (perfect) {
        left = top.x; right = top.x + top.w; streak++;
        banner = streak > 1 ? `PERFECT ×${streak}` : 'PERFECT!'; bannerTime = 1.4; perfectFlash = .35;
        if (streak % 3 === 0) { left = Math.max(18, left - 4); right = Math.min(342, right + 4); banner = 'WIDTH RECOVERED'; }
        ctx.sfx(540 + Math.min(streak, 8) * 65, 120, 'triangle'); ctx.buzz(15);
        for (let i = 0; i < 16; i++) sparks.push({ x: (left + right) / 2, y: top.y - FLOOR, vx: Math.cos(i) * 70, vy: -40 - i * 9, life: 1 });
      } else {
        streak = 0; ctx.sfx(220, 70, 'triangle');
        if (moving.x < left) chunks.push({ x: moving.x, y: top.y - FLOOR, w: left - moving.x, color: moving.color, vx: -65, vy: 30, angle: 0 });
        if (moving.x + moving.w > right) chunks.push({ x: right, y: top.y - FLOOR, w: moving.x + moving.w - right, color: moving.color, vx: 65, vy: 30, angle: 0 });
        banner = `${Math.round(right - left)}m WIDE`; bannerTime = 1;
      }
      tower.push({ x: left, y: top.y - FLOOR, w: right - left, color: moving.color });
      count++; ctx.setScore(count); next();
    }
    next();
    return {
      pointerDown: drop,
      key(code, down) { if (down && (code === 'Space' || code === 'Enter')) drop(); },
      revive() {
        if (phase !== 'ended') return;
        const top = tower.at(-1); top.w = Math.max(top.w, 65); top.x = clamp(lastSafe?.x ?? top.x, 18, 342 - top.w);
        chunks = []; streak = 0; banner = 'SECOND CHANCE'; bannerTime = 2; next();
      },
      inspect() { return { phase, count, streak, moving: { ...moving }, top: { ...tower.at(-1) }, camera }; },
      update(dt) {
        time += dt; bannerTime -= dt; perfectFlash = Math.max(0, perfectFlash - dt);
        camera += (Math.max(0, 355 - tower.at(-1).y) - camera) * Math.min(1, dt * 4);
        if (phase === 'moving') {
          moving.x += moving.vx * dt;
          if (moving.x <= 18) { moving.x = 18; moving.vx = Math.abs(moving.vx); }
          if (moving.x + moving.w >= 342) { moving.x = 342 - moving.w; moving.vx = -Math.abs(moving.vx); }
        } else if (phase === 'falling') {
          moving.vy += 1250 * dt; moving.y += moving.vy * dt;
          if (moving.y >= tower.at(-1).y - FLOOR) { moving.y = tower.at(-1).y - FLOOR; land(); }
        }
        for (const c of chunks) { c.vy += 500 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.angle += c.vx * dt / 90; }
        chunks = chunks.filter(c => c.y + camera < H + 100);
        for (const p of sparks) { p.life -= dt; p.vy += 160 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
        sparks = sparks.filter(p => p.life > 0);
      },
      draw(g) {
        sky(g, time, camera);
        g.save(); g.translate(0, camera);
        const top = tower.at(-1);
        if (phase === 'moving') {
          g.fillStyle = '#ffe8b214'; g.fillRect(top.x, moving.y, top.w, top.y - moving.y);
          g.setLineDash([4, 6]); g.strokeStyle = '#ffe8b260'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(top.x, moving.y); g.lineTo(top.x, top.y); g.moveTo(top.x + top.w, moving.y); g.lineTo(top.x + top.w, top.y); g.stroke(); g.setLineDash([]);
        }
        for (const floor of tower) if (floor.y + camera < H + 40) block(g, floor.x, floor.y, floor.w, floor.color);
        for (const c of chunks) { g.save(); g.translate(c.x + c.w / 2, c.y); g.rotate(c.angle); block(g, -c.w / 2, 0, c.w, c.color, false); g.restore(); }
        if (phase !== 'ended') {
          if (phase === 'moving') {
            g.strokeStyle = '#ffe7bba0'; g.lineWidth = 1.5;
            g.beginPath(); g.moveTo(moving.x + moving.w * .25, -camera); g.lineTo(moving.x + moving.w * .25, moving.y); g.moveTo(moving.x + moving.w * .75, -camera); g.lineTo(moving.x + moving.w * .75, moving.y); g.stroke();
          }
          block(g, moving.x, moving.y, moving.w, moving.color);
        }
        for (const p of sparks) { g.globalAlpha = p.life; g.fillStyle = '#fff0bd'; g.fillRect(p.x, p.y, 3, 6); } g.globalAlpha = 1;
        g.restore();
        g.textAlign = 'center'; g.font = '700 11px system-ui'; g.fillStyle = '#fff0d3a0'; g.fillText('FLOORS ABOVE THE ORDINARY', 180, 81);
        if (bannerTime > 0) { g.fillStyle = perfectFlash ? '#fff4c6' : '#fff0d3'; g.font = '800 18px system-ui'; g.fillText(banner, 180, 125); }
        g.fillStyle = '#181c36b0'; g.fillRect(70, 595, 220, 28); g.fillStyle = '#ffe6b9'; g.font = '600 11px system-ui'; g.fillText(phase === 'falling' ? 'LOOKING GOOD…' : 'TAP ANYWHERE TO DROP', 180, 613); g.textAlign = 'left';
      },
    };
  },
};
