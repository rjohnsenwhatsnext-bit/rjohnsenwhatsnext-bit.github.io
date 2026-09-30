// The frame every game runs in: title screen, score, pause, game over, the
// rewarded continue and the interstitial between runs. A game only draws and
// plays; see games/README.md for the contract.

import { initAds, maybeInterstitial, showRewarded, adsAvailable } from './ads.js';

export const W = 360;
export const H = 640;

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      console.error('Could not read saved ' + key + ': ' + e.message);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Could not save ' + key + ': ' + e.message);
    }
  },
};

let audio = null;
function tone(freq, ms = 80, type = 'square', vol = 0.06) {
  if (store.get('arcade.mute', false)) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + ms / 1000);
  } catch (e) {
    console.error('Sound failed: ' + e.message);
  }
}

function buzz(ms = 20) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'onclick') n.addEventListener('click', v);
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const c of children) n.append(c);
  return n;
}

export function runGame(game, meta) {
  const bestKey = 'arcade.' + meta.slug + '.best';
  document.title = meta.title;
  document.documentElement.dataset.game = meta.slug;
  document.documentElement.style.setProperty('--accent', meta.accent || '#fbb617');
  document.documentElement.style.setProperty('--bg', meta.background || '#101418');

  const root = document.getElementById('app');
  const canvas = el('canvas');
  canvas.setAttribute('aria-label', meta.title + ' play area. ' + meta.howToPlay);
  canvas.setAttribute('role', 'img');
  const hud = el('div', { class: 'hud' });
  const scoreEl = el('div', { class: 'score', text: '0' });
  const pauseBtn = el('button', { class: 'icon', 'aria-label': 'Pause', text: 'II' });
  hud.append(scoreEl, pauseBtn);
  const overlay = el('div', { class: 'overlay' });
  // Full screen, Ryan 28 Sep 2026: "games need to be full screen with buttons
  // you press ... not like you're looking through a window". The stage fills
  // everything above the button bar. The game's 360x640 world is scaled to the
  // stage's width (or height, if the screen is wide); a "fluid" game is handed
  // the real height in ctx.H and draws it all, any other game is anchored and
  // the spare strip is painted in the colour of the game's own edge.
  const stage = el('div', { class: 'stage' }, [canvas, hud, overlay]);
  const controls = el('div', { class: 'controls' });
  root.append(stage, controls);
  const anchor = meta.anchor || 'center';
  const fluid = Boolean(meta.fluid);

  const g = canvas.getContext('2d');
  let scale = 1;
  let dpr = 1;
  let VW = W;
  let VH = H;
  let offX = 0;
  let offY = 0;
  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const r = stage.getBoundingClientRect();
    const sw = Math.max(1, r.width);
    const sh = Math.max(1, r.height);
    if (sh / sw >= H / W) {
      scale = sw / W;
      VW = W;
      VH = sh / scale;
      offX = 0;
      offY = fluid ? 0 : anchor === 'bottom' ? VH - H : anchor === 'top' ? 0 : (VH - H) / 2;
    } else {
      scale = sh / H;
      VH = H;
      VW = sw / scale;
      offX = (VW - W) / 2;
      offY = 0;
    }
    canvas.style.width = sw + 'px';
    canvas.style.height = sh + 'px';
    canvas.width = Math.round(sw * dpr);
    canvas.height = Math.round(sh * dpr);
  }
  window.addEventListener('resize', fit);

  // The colours just inside each edge of the game's own picture, re-read
  // every half second, so the spare strips match whatever the game is showing.
  const probe = document.createElement('canvas');
  probe.width = probe.height = 1;
  const pg = probe.getContext('2d', { willReadFrequently: true });
  const edge = { top: meta.background || '#101418', bottom: meta.background || '#101418', left: meta.background || '#101418', right: meta.background || '#101418' };
  let sampledAt = 0;
  function sampleEdges() {
    const k = scale * dpr;
    const band = 6;
    const read = (x, y, w, h) => {
      if (w <= 0 || h <= 0) return null;
      pg.clearRect(0, 0, 1, 1);
      pg.drawImage(canvas, x * k, y * k, w * k, h * k, 0, 0, 1, 1);
      const d = pg.getImageData(0, 0, 1, 1).data;
      return `rgb(${d[0]},${d[1]},${d[2]})`;
    };
    if (offY > 0) {
      edge.top = read(offX, offY, W, band) || edge.top;
      edge.bottom = read(offX, offY + H - band, W, band) || edge.bottom;
    }
  }
  function paint(draw) {
    g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    if (!fluid) {
      g.fillStyle = edge.top;
      g.fillRect(0, 0, VW, offY + 1);
      g.fillStyle = edge.bottom;
      g.fillRect(0, offY + H - 1, VW, VH - offY - H + 1);
      g.fillStyle = edge.left;
      g.fillRect(0, 0, offX + 1, VH);
      g.fillStyle = edge.right;
      g.fillRect(offX + W - 1, 0, VW - offX - W + 1, VH);
    }
    g.save();
    g.translate(offX, offY);
    draw();
    g.restore();
    // Side strips continue the game's own edge, row by row, so a sky gradient
    // carries on to the screen edge instead of stopping at a flat band.
    if (offX > 0.5) {
      const k = scale * dpr;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(canvas, Math.ceil(offX * k) + 1, 0, 1, canvas.height, 0, 0, Math.ceil(offX * k) + 1, canvas.height);
      const rightStart = Math.floor((offX + W) * k) - 2;
      g.drawImage(canvas, rightStart, 0, 1, canvas.height, rightStart + 1, 0, canvas.width - rightStart - 1, canvas.height);
      g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    }
    const now = performance.now();
    if (!fluid && offY > 0 && now - sampledAt > 500) {
      sampledAt = now;
      try {
        sampleEdges();
      } catch (e) {
        console.error('Could not read the edge colours: ' + e.message);
        sampledAt = Infinity;
      }
    }
  }

  // Real buttons, from game.json "controls": [{ "label": "DROP", "key": "Space" }].
  // Each press is the key the game already listens for.
  for (const c of meta.controls || []) {
    const b = el('button', { class: 'control' + (c.wide ? ' wide' : ''), 'aria-label': c.aria || c.label, text: c.label });
    const press = (down) => (e) => {
      e.preventDefault();
      b.classList.toggle('down', down);
      if (state === 'playing' && instance && instance.key) instance.key(c.key, down);
    };
    b.addEventListener('pointerdown', press(true));
    b.addEventListener('pointerup', press(false));
    b.addEventListener('pointercancel', press(false));
    b.addEventListener('pointerleave', (e) => b.classList.contains('down') && press(false)(e));
    controls.append(b);
  }
  controls.hidden = !(meta.controls || []).length;
  fit();

  let state = 'title'; // title | playing | paused | over
  let score = 0;
  let revived = false;
  let instance = null;

  const ctx = {
    W,
    // A fluid game gets the whole stage height; the rest keep their 640.
    get H() {
      return fluid ? VH : H;
    },
    sfx: tone,
    buzz,
    setScore(n) {
      score = Math.floor(n);
      scoreEl.textContent = String(score);
    },
    addScore(n) {
      ctx.setScore(score + n);
    },
    // why: optional heading for the game over panel, e.g. 'Ran out of fuel'
    end(why) {
      if (state === 'playing') gameOver(why);
    },
    store,
  };

  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale - offX, y: (e.clientY - r.top) / scale - offY };
  }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (state !== 'playing' || !instance.pointerDown) return;
    const p = toLocal(e);
    instance.pointerDown(p.x, p.y);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (state !== 'playing' || !instance.pointerMove) return;
    const p = toLocal(e);
    instance.pointerMove(p.x, p.y, e.buttons > 0 || e.pointerType === 'touch');
  });
  window.addEventListener('pointerup', (e) => {
    if (state !== 'playing' || !instance.pointerUp) return;
    const p = toLocal(e);
    instance.pointerUp(p.x, p.y);
  });
  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code) && e.target === document.body) e.preventDefault();
    if (e.repeat) return;
    if (state === 'playing' && instance.key) instance.key(e.code, true);
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  });
  window.addEventListener('keyup', (e) => {
    if (state === 'playing' && instance.key) instance.key(e.code, false);
  });
  pauseBtn.addEventListener('click', togglePause);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') togglePause();
  });

  function show(...nodes) {
    overlay.replaceChildren(...nodes);
    overlay.hidden = nodes.length === 0;
  }

  function muteButton() {
    const b = el('button', { class: 'ghost' });
    const label = () => (b.textContent = store.get('arcade.mute', false) ? 'Sound off' : 'Sound on');
    label();
    b.addEventListener('click', () => {
      store.set('arcade.mute', !store.get('arcade.mute', false));
      label();
    });
    return b;
  }

  function titleScreen() {
    state = 'title';
    hud.hidden = true;
    const best = store.get(bestKey, 0);
    show(
      el('div', { class: 'panel' }, [
        el('p', { class: 'edition', text: 'TOVELLY / POCKET ARCADE' }),
        el('h1', { text: meta.title }),
        el('p', { class: 'tag', text: meta.tagline }),
        el('p', { class: 'how', text: meta.howToPlay }),
        best ? el('p', { class: 'best', text: 'Best ' + best }) : '',
        el('button', { class: 'primary', text: 'Play', onclick: start }),
        muteButton(),
      ]),
    );
    drawIdle();
  }

  function start() {
    score = 0;
    revived = false;
    scoreEl.textContent = '0';
    instance = game.create(ctx);
    state = 'playing';
    hud.hidden = false;
    show();
    tone(660, 60);
    last = performance.now();
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      show(
        el('div', { class: 'panel' }, [
          el('h2', { text: 'Paused' }),
          el('button', { class: 'primary', text: 'Resume', onclick: resume }),
          muteButton(),
          el('button', { class: 'ghost', text: 'Quit to title', onclick: titleScreen }),
        ]),
      );
    } else if (state === 'paused') {
      resume();
    }
  }

  function resume() {
    state = 'playing';
    show();
    last = performance.now();
  }

  async function gameOver(why) {
    state = 'over';
    hud.hidden = true;
    tone(180, 300, 'sawtooth');
    buzz(80);
    const prev = store.get(bestKey, 0);
    const isBest = score > prev;
    if (isBest) store.set(bestKey, score);

    const note = el('p', { class: 'note' });
    const buttons = [];
    if (game.canRevive && !revived && adsAvailable()) {
      const cont = el('button', { class: 'primary', text: meta.reviveLabel || 'Watch an ad to keep going' });
      cont.addEventListener('click', async () => {
        cont.disabled = true;
        cont.textContent = 'Loading ad...';
        const r = await showRewarded();
        if (r.rewarded) {
          revived = true;
          instance.revive();
          state = 'playing';
          hud.hidden = false;
          show();
          last = performance.now();
        } else {
          cont.remove();
          note.textContent = r.reason;
        }
      });
      buttons.push(cont);
    }
    buttons.push(
      el('button', { class: buttons.length ? 'ghost' : 'primary', text: 'Play again', onclick: start }),
      el('button', { class: 'ghost', text: 'Title', onclick: titleScreen }),
    );
    show(
      el('div', { class: 'panel' }, [
        el('h2', { text: why || meta.overTitle || 'Game over' }),
        el('p', { class: 'big', text: String(score) }),
        el('p', { class: 'best', text: isBest ? 'New best!' : 'Best ' + Math.max(prev, score) }),
        ...buttons,
        note,
      ]),
    );
    const shown = await maybeInterstitial();
    if (shown === 'failed') console.error('Interstitial skipped at game over.');
  }

  function drawIdle() {
    paint(() => {
      if (game.drawTitle) game.drawTitle(g, ctx);
      else {
        g.fillStyle = meta.background || '#101418';
        g.fillRect(0, 0, W, ctx.H);
      }
    });
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'playing') {
      instance.update(dt);
    }
    if (state === 'playing' || state === 'paused' || state === 'over') {
      paint(() => instance.draw(g));
    } else {
      drawIdle();
    }
    requestAnimationFrame(frame);
  }

  initAds();
  titleScreen();
  requestAnimationFrame(frame);
}
