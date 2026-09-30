// Merge Mine: the first-play coach (Claude). Ryan, 29 Sep 2026: "add a
// tutorial because i fucked it up". One short line at a time, pointing at the
// real thing to press on whatever board the player has, so it works on a new
// game and on a save already under way. Each step ends when the player
// actually does it, never on a timer. Skip is always there; Settings replays it.
//
// Styling hooks for Codex: #coach (the bubble), .tut-target on whatever it
// points at (board cells, an order card, a header button).
import * as M from './logic.mjs';

const KEY = 'mergemine.tutorial';
const $ = (id) => document.getElementById(id);
const cellEl = (i) => document.querySelector(`.cell[data-i="${i}"]`);

// the lowest pair that can merge, so the first merge is an obvious one
function pair(s) {
  let best = null;
  for (let i = 0; i < M.CELLS; i++)
    for (let j = i + 1; j < M.CELLS; j++) {
      const a = s.board[i];
      const b = s.board[j];
      if (M.isItem(a) && M.isItem(b) && a.c !== 'chest' && a.c === b.c && a.l === b.l && a.l < M.maxLevel(a.c) && (!best || a.l < best.l)) best = { i, j, l: a.l };
    }
  return best;
}
const gens = (s) => s.board.map((x, i) => (M.isGen(x) ? i : -1)).filter((i) => i >= 0);
const chest = (s) => s.board.findIndex((x) => M.isItem(x) && x.c === 'chest');

// Each step: what to say and what to point at, from the current state, and
// the event that finishes it. skip(s): the step does not apply to this board.
export const STEPS = [
  {
    done: 'tap',
    show: (s) => ({ text: 'Tap the rock face to dig. Each tap costs one energy and drops a piece.', cells: [M.GEN_CELLS.face].filter((i) => M.isGen(s.board[i])) }),
  },
  {
    done: 'merge',
    show: (s) => {
      const p = pair(s);
      if (p) return { text: `Drag one ${M.itemName(s.board[p.i])} onto the other. Two the same make one better piece.`, cells: [p.i, p.j] };
      return { text: 'Tap the rock face or the tool shed until two pieces match.', cells: gens(s) };
    },
  },
  {
    done: 'fill',
    show: (s) => {
      const k = s.orders.findIndex((o) => M.orderCells(s, o));
      if (k >= 0) return { text: 'That order is ready. Tap Deliver for the coins.', orders: [k] };
      const o = s.orders[0];
      return { text: `The orders up top say what the miners want. ${o.who} wants ${o.want.map((w) => M.itemName(w)).join(' and ')}: merge up to it and the order lights up.`, orders: [0] };
    },
  },
  {
    done: 'open',
    skip: (s) => chest(s) < 0,
    show: (s) => ({ text: 'Crates hold a surprise. Tap the crate once to pick it up, then tap it again to open it.', cells: [chest(s)] }),
  },
  {
    done: 'site',
    show: () => ({ text: 'Coins build the mine. Tap The mine to see your first project.', ids: ['site'] }),
  },
  {
    done: 'ok',
    show: () => ({ text: 'Energy comes back by itself, one every two minutes, even with the game shut. That is it: dig, merge, fill orders, build.', ids: ['energy'], ok: 'Got it' }),
  },
];

export function createTutorial(getState) {
  let step = 0;
  try {
    const v = localStorage.getItem(KEY);
    step = v === 'done' ? STEPS.length : Number(v) || 0;
  } catch {
    step = 0; // no storage: show it; worst case it shows again next launch
  }
  const keep = () => {
    try {
      localStorage.setItem(KEY, step >= STEPS.length ? 'done' : String(step));
    } catch {
      /* no storage: progress through the tutorial is not kept, the game is unaffected */
    }
  };

  const coach = document.createElement('div');
  coach.id = 'coach';
  coach.setAttribute('role', 'status');
  coach.innerHTML = '<p id="coachText"></p><div><button id="coachOk" class="hidden"></button><button id="coachSkip">Skip tutorial</button></div>';
  document.body.append(coach);

  function advance() {
    step++;
    const s = getState();
    while (step < STEPS.length && STEPS[step].skip?.(s)) step++;
    keep();
    paint();
  }
  function finish() {
    step = STEPS.length;
    keep();
    paint();
  }
  $('coachSkip').onclick = finish;
  $('coachOk').onclick = () => STEPS[step]?.done === 'ok' && advance();

  function paint() {
    for (const el of document.querySelectorAll('.tut-target')) el.classList.remove('tut-target');
    const active = step < STEPS.length && document.body.dataset.view === 'play';
    coach.classList.toggle('hidden', !active);
    if (!active) return;
    const s = getState();
    const v = STEPS[step].show(s);
    $('coachText').textContent = v.text;
    $('coachOk').classList.toggle('hidden', !v.ok);
    if (v.ok) $('coachOk').textContent = v.ok;
    for (const i of v.cells || []) cellEl(i)?.classList.add('tut-target');
    for (const k of v.orders || []) document.querySelector(`.order[data-order="${k}"]`)?.classList.add('tut-target');
    for (const id of v.ids || []) $(id)?.classList.add('tut-target');
    // never sit on top of what it is pointing at
    const low = [...document.querySelectorAll('.tut-target')].some((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2 > innerHeight * 0.55;
    });
    coach.classList.toggle('top', low);
  }

  return {
    // main.mjs reports what the player just did
    event(kind) {
      if (step < STEPS.length && STEPS[step].done === kind) advance();
    },
    paint,
    restart() {
      step = 0;
      keep();
      paint();
    },
    get step() {
      return step;
    },
  };
}
