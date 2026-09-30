// Swing Line: swing up a shaft of rings ahead of rising lava.
// Hold to grab the nearest ring and reel in; let go to fling. Reeling in is
// the only way to gain speed (a shorter rope spins faster, angular momentum
// kept), so the skill is when to hold, how long, and when to let go.
// It gets meaner with height: faster lava, wider gaps, then moving rings,
// then rings that crumble a second after you grab them.

const W = 360;
const G = 900; // gravity, px/s^2
const REACH = 190; // furthest ring you can grab
const REEL = 110; // rope shortening while held, px/s
const MIN_ROPE = 46;
const PUMP = 420; // holding also drives the swing along its direction, like kicking on a playground swing
const R = 11; // player radius

function rand(a, b) {
  return a + Math.random() * (b - a);
}

// Difficulty by height climbed (px). Everything ramps from here.
function tier(h) {
  const m = h / 10;
  return {
    gapY: Math.min(175, 118 + m * 0.35),
    gapX: Math.min(210, 120 + m * 0.5),
    moving: m > 60 ? Math.min(0.55, 0.15 + (m - 60) / 400) : 0,
    crumbling: m > 140 ? Math.min(0.4, 0.1 + (m - 140) / 500) : 0,
    lava: Math.min(150, 34 + m * 0.22),
  };
}

function makeRing(prev, h) {
  const t = tier(h);
  const y = prev.y - rand(t.gapY * 0.8, t.gapY);
  let x = prev.x + rand(-t.gapX, t.gapX);
  x = Math.max(40, Math.min(W - 40, x));
  if (Math.abs(x - prev.x) < 45) x = prev.x + (x < W / 2 ? 70 : -70);
  const roll = Math.random();
  const kind = roll < t.crumbling ? 'crumble' : roll < t.crumbling + t.moving ? 'move' : 'fixed';
  return { x, y, baseX: x, kind, phase: rand(0, Math.PI * 2), span: rand(40, 80), life: 1, broken: false, grabbedAt: 0 };
}

export default {
  canRevive: true,

  drawTitle(g, ctx) {
    const t = performance.now() / 1000;
    backdrop(g, ctx, 0, t);
    const ax = 180, ay = ctx.H * 0.36, L = 120, a = Math.sin(t * 1.6) * 0.9;
    const px = ax + Math.sin(a) * L, py = ay + Math.cos(a) * L;
    ring(g, ax, ay, 'fixed', 1, true, t);
    ring(g, 90, ay - 150, 'fixed', 1, false, t);
    ring(g, 280, ay - 260, 'move', 1, false, t);
    rope(g, px, py, ax, ay);
    player(g, px, py, t);
    lava(g, ctx, ctx.H - 70, t);
  },

  create(ctx) {
    let p, v, rings, attached, ropeLen, cam, lavaY, best, holding, trail, parts, height, startY, dead, shake, flash;

    function reset() {
      startY = ctx.H - 180;
      // start mid swing, off to one side, so there is something to work with
      p = { x: W / 2 - 80, y: startY - 30 };
      v = { x: 260, y: 0 };
      rings = [{ x: W / 2, y: startY - 110, baseX: W / 2, kind: 'fixed', phase: 0, span: 0, life: 1, broken: false, grabbedAt: 0 }];
      for (let i = 0; i < 12; i++) rings.push(makeRing(rings[rings.length - 1], 0));
      attached = rings[0];
      ropeLen = 110;
      cam = 0;
      lavaY = ctx.H + 140;
      best = 0;
      holding = false;
      trail = [];
      parts = [];
      height = 0;
      dead = false;
      shake = 0;
      flash = 0;
    }
    reset();

    function target() {
      let bestRing = null;
      let bestScore = Infinity;
      for (const r of rings) {
        if (r.broken) continue;
        const d = Math.hypot(r.x - p.x, r.y - p.y);
        if (d > REACH || d < 18) continue;
        // prefer rings above you and close
        const score = d + (r.y > p.y ? 120 : 0);
        if (score < bestScore) {
          bestScore = score;
          bestRing = r;
        }
      }
      return bestRing;
    }

    function next() {
      let n = null;
      for (const r of rings) if (!r.broken && r !== attached && r.y < (attached ? attached.y : p.y) && (!n || r.y > n.y)) n = r;
      return n;
    }

    function burst(x, y, color, n = 10, speed = 160) {
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(speed * 0.3, speed);
        parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.7), color });
      }
    }

    function grab() {
      holding = true;
      if (attached || dead) return;
      const r = target();
      if (!r) {
        ctx.sfx(160, 50, 'triangle', 0.03);
        return;
      }
      attached = r;
      ropeLen = Math.max(MIN_ROPE, Math.hypot(r.x - p.x, r.y - p.y));
      if (r.kind === 'crumble' && !r.grabbedAt) r.grabbedAt = performance.now();
      ctx.sfx(520 + Math.min(400, height / 8), 60, 'triangle');
      ctx.buzz(10);
      burst(r.x, r.y, '#ffe29b', 8, 120);
    }

    function release() {
      holding = false;
      if (!attached) return;
      attached = null;
      ctx.sfx(330, 40, 'sine', 0.04);
    }

    function die(why) {
      if (dead) return;
      dead = true;
      shake = 0.5;
      flash = 1;
      burst(p.x, p.y, '#ff7a45', 26, 260);
      ctx.buzz(120);
      ctx.end(why);
    }

    return {
      // read only, for tests and tuning
      peek() {
        return { p: { ...p }, v: { ...v }, attached: attached ? { x: attached.x, y: attached.y } : null, next: next() ? { x: next().x, y: next().y } : null, lavaY, best };
      },
      pointerDown: grab,
      pointerUp: release,
      key(code, down) {
        if (code !== 'Space' && code !== 'Enter' && code !== 'ArrowUp') return;
        if (down && !holding) grab();
        if (!down) release();
      },

      revive() {
        dead = false;
        lavaY = Math.max(lavaY, p.y + ctx.H * 0.75);
        // back onto the nearest standing ring below the screen middle
        let r = null;
        for (const q of rings) if (!q.broken && q.y > p.y - 300 && (!r || Math.abs(q.y - p.y) < Math.abs(r.y - p.y))) r = q;
        if (r) {
          p = { x: r.x, y: r.y + 90 };
          v = { x: 0, y: 0 };
          attached = r;
          r.kind = 'fixed';
          r.grabbedAt = 0;
          ropeLen = 90;
        }
        shake = 0;
      },

      update(dt) {
        if (dead) return;
        const steps = 3;
        const h = dt / steps;
        for (let s = 0; s < steps; s++) {
          // moving rings slide; crumbling rings give way a second after the grab
          const now = performance.now();
          for (const r of rings) {
            if (r.kind === 'move') r.x = r.baseX + Math.sin(now / 700 + r.phase) * r.span;
            if (r.kind === 'crumble' && r.grabbedAt && !r.broken) {
              r.life = 1 - (now - r.grabbedAt) / 1000;
              if (r.life <= 0) {
                r.broken = true;
                burst(r.x, r.y, '#b58cff', 12, 140);
                ctx.sfx(120, 120, 'sawtooth', 0.04);
                if (attached === r) attached = null;
              }
            }
          }

          v.y += G * h;
          if (attached && holding) ropeLen = Math.max(MIN_ROPE, ropeLen - REEL * h);
          p.x += v.x * h;
          p.y += v.y * h;

          if (attached) {
            const dx = p.x - attached.x;
            const dy = p.y - attached.y;
            const d = Math.hypot(dx, dy) || 1;
            const nx = dx / d;
            const ny = dy / d;
            // rigid rope: hold the length, keep only the swing across it
            p.x = attached.x + nx * ropeLen;
            p.y = attached.y + ny * ropeLen;
            const radial = v.x * nx + v.y * ny;
            v.x -= radial * nx;
            v.y -= radial * ny;
            // reeling in keeps angular momentum, so the swing speeds up
            if (holding && d > ropeLen + 0.01) {
              const k = d / ropeLen;
              v.x *= Math.min(1.08, k);
              v.y *= Math.min(1.08, k);
            }
            // pumping: push along the swing's current direction (toward the
            // next ring when nearly still)
            if (holding) {
              let tx = -ny;
              let ty = nx;
              let dir = Math.sign(v.x * tx + v.y * ty);
              if (!dir) dir = next() && next().x < p.x ? -Math.sign(tx) || 1 : Math.sign(tx) || 1;
              v.x += tx * dir * PUMP * h;
              v.y += ty * dir * PUMP * h;
            }
          }

          // shaft walls
          if (p.x < R) {
            p.x = R;
            v.x = Math.abs(v.x) * 0.55;
          }
          if (p.x > W - R) {
            p.x = W - R;
            v.x = -Math.abs(v.x) * 0.55;
          }
        }
        const speed = Math.hypot(v.x, v.y);
        if (speed > 1300) {
          v.x *= 1300 / speed;
          v.y *= 1300 / speed;
        }

        height = Math.max(0, startY - p.y);
        if (height > best) best = height;
        ctx.setScore(best / 10);

        // camera follows upward, never down
        const want = p.y - ctx.H * 0.55;
        if (want < cam) cam += (want - cam) * Math.min(1, dt * 5);

        // lava rises, faster the higher you are; it never falls too far behind
        const t = tier(best);
        lavaY -= t.lava * dt;
        lavaY = Math.min(lavaY, cam + ctx.H + 160);
        if (p.y + R > lavaY) die('The lava caught you');
        if (p.y - cam > ctx.H + 60) die('Fell into the dark');

        // more rings above, drop the ones far below
        while (rings[rings.length - 1].y > cam - 400) rings.push(makeRing(rings[rings.length - 1], best));
        rings = rings.filter((r) => r.y < lavaY + 200 || r === attached);

        trail.push({ x: p.x, y: p.y });
        if (trail.length > 14) trail.shift();
        for (const q of parts) {
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.vy += 500 * dt;
          q.life -= dt;
        }
        parts = parts.filter((q) => q.life > 0);
        if (shake > 0) shake -= dt;
        if (flash > 0) flash -= dt * 3;
      },

      draw(g) {
        const t = performance.now() / 1000;
        g.save();
        if (shake > 0) g.translate(rand(-5, 5) * shake, rand(-5, 5) * shake);
        backdrop(g, ctx, cam, t);
        g.save();
        g.translate(0, -cam);
        const aim = !attached && !dead ? target() : null;
        if (aim) {
          g.strokeStyle = 'rgba(255,226,155,0.28)';
          g.setLineDash([6, 8]);
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(aim.x, aim.y);
          g.stroke();
          g.setLineDash([]);
        }
        for (const r of rings) if (!r.broken && r.y > cam - 40 && r.y < cam + ctx.H + 40) ring(g, r.x, r.y, r.kind, r.life, r === aim || r === attached, t);
        if (attached) rope(g, p.x, p.y, attached.x, attached.y);
        for (let i = 0; i < trail.length; i++) {
          const q = trail[i];
          g.fillStyle = `rgba(130,255,224,${(i / trail.length) * 0.35})`;
          g.beginPath();
          g.arc(q.x, q.y, R * (i / trail.length), 0, Math.PI * 2);
          g.fill();
        }
        if (!dead) player(g, p.x, p.y, t);
        for (const q of parts) {
          g.globalAlpha = Math.max(0, q.life * 1.6);
          g.fillStyle = q.color;
          g.fillRect(q.x - 2, q.y - 2, 4, 4);
        }
        g.globalAlpha = 1;
        g.restore();
        lava(g, ctx, lavaY - cam, t);
        // how close the lava is, on the left edge
        const gap = Math.max(0, lavaY - p.y);
        const warn = Math.max(0, Math.min(1, 1 - gap / 420));
        if (warn > 0) {
          g.fillStyle = `rgba(255,90,40,${warn * 0.35})`;
          g.fillRect(0, 0, W, ctx.H);
        }
        if (flash > 0) {
          g.fillStyle = `rgba(255,255,255,${flash * 0.5})`;
          g.fillRect(0, 0, W, ctx.H);
        }
        g.restore();
        // height marker, bottom left above the lava glow
        g.fillStyle = 'rgba(245,241,232,0.75)';
        g.font = '700 12px system-ui';
        g.textAlign = 'left';
        const tr = tier(best);
        const stage = tr.crumbling ? 'CRUMBLING RINGS' : tr.moving ? 'MOVING RINGS' : 'CLIMB';
        g.fillText(stage, 14, ctx.H - 16);
      },
    };
  },
};

function backdrop(g, ctx, cam, t) {
  // the shaft darkens and cools the higher you go
  const depth = Math.min(1, -cam / 20000);
  const sky = g.createLinearGradient(0, 0, 0, ctx.H);
  sky.addColorStop(0, mix('#1a1540', '#05060f', depth));
  sky.addColorStop(1, mix('#3a1f3f', '#101030', depth));
  g.fillStyle = sky;
  g.fillRect(0, 0, W, ctx.H);
  // parallax rock ribs on both walls
  for (let layer = 0; layer < 2; layer++) {
    const speed = layer ? 0.5 : 0.25;
    g.fillStyle = layer ? 'rgba(20,16,40,0.9)' : 'rgba(40,30,70,0.6)';
    const step = layer ? 90 : 140;
    const off = (-cam * speed) % step;
    for (let y = -step + off; y < ctx.H + step; y += step) {
      const w = layer ? 26 : 40;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w + 10 * Math.sin(y * 0.05), y + step / 2);
      g.lineTo(0, y + step);
      g.fill();
      g.beginPath();
      g.moveTo(W, y + step / 2);
      g.lineTo(W - w - 10 * Math.cos(y * 0.05), y + step);
      g.lineTo(W, y + step * 1.5);
      g.fill();
    }
  }
  // drifting embers
  for (let i = 0; i < 22; i++) {
    const x = (i * 97.3 + Math.sin(t * 0.7 + i) * 12) % W;
    const y = (((i * 173.1 - cam * 0.6 - t * 30 * (1 + (i % 3))) % ctx.H) + ctx.H) % ctx.H;
    g.fillStyle = i % 4 ? 'rgba(255,170,90,0.35)' : 'rgba(255,226,155,0.6)';
    g.fillRect(x, y, 2, 2);
  }
}

function mix(a, b, k) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`;
}

function ring(g, x, y, kind, life, lit, t) {
  const col = kind === 'crumble' ? '#b58cff' : kind === 'move' ? '#82ffe0' : '#ffe29b';
  g.save();
  if (lit) {
    g.shadowColor = col;
    g.shadowBlur = 18;
  }
  g.globalAlpha = kind === 'crumble' ? 0.35 + 0.65 * Math.max(0, life) : 1;
  g.strokeStyle = col;
  g.lineWidth = lit ? 6 : 4;
  g.beginPath();
  g.arc(x, y, 12 + (lit ? Math.sin(t * 10) * 1.5 : 0), 0, Math.PI * 2);
  g.stroke();
  if (kind === 'crumble' && life < 1) {
    g.strokeStyle = '#2a1840';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 8, y - 6);
    g.lineTo(x + 2, y + 1);
    g.lineTo(x - 3, y + 9);
    g.stroke();
  }
  if (kind === 'move') {
    g.fillStyle = col;
    g.fillRect(x - 22, y - 1, 6, 2);
    g.fillRect(x + 16, y - 1, 6, 2);
  }
  g.restore();
}

function rope(g, x1, y1, x2, y2) {
  g.strokeStyle = '#f5f1e8';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

function player(g, x, y, t) {
  g.save();
  g.shadowColor = '#82ffe0';
  g.shadowBlur = 16;
  g.fillStyle = '#82ffe0';
  g.beginPath();
  g.arc(x, y, R, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.fillStyle = '#0b1026';
  const blink = Math.sin(t * 3) > 0.97 ? 1 : 3;
  g.fillRect(x - 5, y - 3, 3, blink);
  g.fillRect(x + 2, y - 3, 3, blink);
}

function lava(g, ctx, top, t) {
  if (top > ctx.H + 40) return;
  const grad = g.createLinearGradient(0, top - 60, 0, top + 40);
  grad.addColorStop(0, 'rgba(255,90,40,0)');
  grad.addColorStop(0.6, 'rgba(255,90,40,0.55)');
  grad.addColorStop(1, 'rgba(255,140,60,0.95)');
  g.fillStyle = grad;
  g.fillRect(0, top - 60, W, 100);
  g.fillStyle = '#ff5a28';
  g.beginPath();
  g.moveTo(0, ctx.H + 10);
  for (let x = 0; x <= W; x += 12) g.lineTo(x, top + Math.sin(x * 0.05 + t * 3) * 5 + Math.sin(x * 0.13 - t * 2) * 3);
  g.lineTo(W, ctx.H + 10);
  g.fill();
  g.fillStyle = '#ffb347';
  for (let i = 0; i < 6; i++) {
    const bx = (i * 67 + t * 20) % W;
    g.beginPath();
    g.arc(bx, top + 14 + Math.sin(t * 4 + i) * 4, 3, 0, Math.PI * 2);
    g.fill();
  }
}
