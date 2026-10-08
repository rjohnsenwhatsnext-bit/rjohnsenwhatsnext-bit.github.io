// Outback Tiles: pure rules (no DOM, no clock, deterministic for a seed).
//
// TICK: the game is turn based. One tick is one call to step(), which handles
// exactly one player input. Nothing happens between ticks.
//
// INPUT shape (one of these per step; anything else is ignored):
//   { pick: tileId }        select a free tile; a second pick tries the pair
//   { undo: true }          put the last cleared pair back (uses an undo)
//   { shuffle: true }       redeal the faces of the tiles left (uses a shuffle)
//   { hint: true }          mark one matching free pair in state.hint (uses a hint)
//   { grant: 'undo' | 'shuffle' | 'hint' }   add one of that help, for the
//                           frontend to send after a rewarded ad was watched
//
// LEVEL data (see levels.mjs): { objective, limit, faces, shuffles, undos, layers }
//   objective 'clear'    clear every tile
//   objective 'target'   clear `limit` pairs
//   objective 'mistakes' clear every tile with at most `limit` wrong pairs
//   objective 'turns'    clear every tile within `limit` pair attempts
//   layers: [{ w, h, dx, dy, holes }] rectangles of tiles, later layers sit on top.
//   Tiles are 2 x 2 in half units; dx and dy are in half units, so an odd offset
//   rests a tile across two below.
//
// Chapter 2 additions (both optional, chapter 1 levels are unchanged):
//   objective 'gold'   faces 0 to gold-1 are gold nuggets (level.gold = how many
//                      faces); the level is won once no gold tile is left, even if
//                      plain tiles remain. state.gold holds the count, goldLeft(s)
//                      the gold tiles still in play.
//   level.hints        hints the player starts with (default 0)
//
// Every deal is built by removing free pairs from the full layout one at a time
// and giving each pair one face, so the layout can always be cleared in that
// order. A shuffle deals the tiles left the same way, so it stays winnable.
//
// events (state.events) lists what the last step did, for the frontend:
//   {type:'select'|'deselect'|'match'|'mismatch'|'blocked'|'undo'|'shuffle'|'hint'|'refused'|'grant', ...}

function rnd(s) {
  s.rs = (s.rs + 0x6D2B79F5) >>> 0;
  let t = s.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function layoutTiles(level) {
  const tiles = [];
  level.layers.forEach((layer, z) => {
    const holes = new Set((layer.holes || []).map(([c, r]) => `${c},${r}`));
    for (let r = 0; r < layer.h; r++) {
      for (let c = 0; c < layer.w; c++) {
        if (holes.has(`${c},${r}`)) continue;
        tiles.push({ id: tiles.length, x: (layer.dx || 0) + c * 2, y: (layer.dy || 0) + r * 2, z, face: 0, alive: true });
      }
    }
  });
  return tiles;
}

// free = nothing on top, and at least one side open
export function isFreeIn(tiles, alive, i) {
  if (!alive[i]) return false;
  const t = tiles[i];
  let left = false, right = false;
  for (let j = 0; j < tiles.length; j++) {
    if (j === i || !alive[j]) continue;
    const o = tiles[j], dx = o.x - t.x, dy = o.y - t.y;
    if (Math.abs(dy) >= 2) continue;
    if (o.z > t.z && Math.abs(dx) < 2) return false;
    if (o.z === t.z) {
      if (dx < 0 && dx > -4) left = true;
      if (dx > 0 && dx < 4) right = true;
    }
  }
  return !(left && right);
}

const aliveOf = (s) => s.tiles.map((t) => t.alive);

export const freeTiles = (s) => {
  const alive = aliveOf(s);
  return s.tiles.filter((t, i) => isFreeIn(s.tiles, alive, i)).map((t) => t.id);
};

// every matching pair of free tiles, as [idA, idB]
export function matchingPairs(s) {
  const free = freeTiles(s), out = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (s.tiles[free[i]].face === s.tiles[free[j]].face) out.push([free[i], free[j]]);
    }
  }
  return out;
}

export const matchesAvailable = (s) => matchingPairs(s).length;

// give faces to the tiles in `ids`, building the clearing order in reverse
function deal(s, ids) {
  const n = s.faces;
  for (let attempt = 0; attempt < 200; attempt++) {
    const left = new Set(ids), order = [];
    let ok = true;
    while (left.size) {
      const alive = s.tiles.map((t, i) => left.has(i));
      const free = ids.filter((i) => isFreeIn(s.tiles, alive, i));
      if (free.length < 2) { ok = false; break; }
      const a = free.splice(Math.floor(rnd(s) * free.length), 1)[0];
      const b = free[Math.floor(rnd(s) * free.length)];
      left.delete(a);
      left.delete(b);
      order.push([a, b]);
    }
    if (!ok) continue;
    const perm = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd(s) * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    order.forEach(([a, b], k) => { s.tiles[a].face = s.tiles[b].face = perm[k % n]; });
    return;
  }
  throw new Error('layout could not be dealt');
}

export function newGame(level, seed = 1) {
  const tiles = layoutTiles(level);
  if (tiles.length % 2) throw new Error(`level ${level.id} has an odd number of tiles`);
  const s = {
    levelId: level.id, seed, rs: Math.imul(seed | 0, 0x9E3779B1) >>> 0,
    objective: level.objective, limit: level.limit || 0, faces: level.faces,
    tiles, picked: null, hint: null, history: [],
    pairsTotal: tiles.length / 2, pairsLeft: tiles.length / 2, pairsCleared: 0,
    turns: 0, mistakes: 0, tick: 0,
    undosLeft: level.undos ?? 0, shufflesLeft: level.shuffles ?? 0, hintsLeft: level.hints ?? 0,
    gold: level.gold ?? 0,
    events: [],
  };
  deal(s, tiles.map((t) => t.id));
  return s;
}

// why a run is lost, or null
export function cause(s) {
  if (isWon(s)) return null;
  if (s.objective === 'mistakes' && s.mistakes > s.limit) return 'mistakes';
  if (s.objective === 'turns' && s.turns >= s.limit) return 'turns';
  if (matchesAvailable(s) === 0 && s.shufflesLeft === 0) return 'stuck';
  return null;
}

export const goldLeft = (s) => s.tiles.filter((t) => t.alive && t.face < s.gold).length;

const isWon = (s) => {
  if (s.objective === 'target') return s.pairsCleared >= s.limit;
  if (s.objective === 'gold') return goldLeft(s) === 0;
  return s.pairsLeft === 0;
};

export function status(s) {
  if (isWon(s)) return 'won';
  return cause(s) ? 'lost' : 'playing';
}

function pick(s, id) {
  const t = s.tiles[id];
  s.hint = null;
  if (!t || !t.alive || !isFreeIn(s.tiles, aliveOf(s), id)) { s.events.push({ type: 'blocked', id }); return; }
  if (s.picked === null) { s.picked = id; s.events.push({ type: 'select', id }); return; }
  if (s.picked === id) { s.picked = null; s.events.push({ type: 'deselect', id }); return; }
  const a = s.picked;
  s.picked = null;
  s.turns++;
  if (s.tiles[a].face === t.face) {
    s.tiles[a].alive = t.alive = false;
    s.history.push([a, id]);
    s.pairsCleared++;
    s.pairsLeft--;
    s.events.push({ type: 'match', a, b: id, face: t.face });
  } else {
    s.mistakes++;
    s.events.push({ type: 'mismatch', a, b: id });
  }
}

function undo(s) {
  if (s.undosLeft <= 0 || !s.history.length) { s.events.push({ type: 'refused', what: 'undo' }); return; }
  const [a, b] = s.history.pop();
  s.tiles[a].alive = s.tiles[b].alive = true;
  s.undosLeft--;
  s.pairsCleared--;
  s.pairsLeft++;
  s.picked = null;
  s.hint = null;
  s.events.push({ type: 'undo', a, b });
}

function shuffle(s) {
  if (s.shufflesLeft <= 0) { s.events.push({ type: 'refused', what: 'shuffle' }); return; }
  s.shufflesLeft--;
  deal(s, s.tiles.filter((t) => t.alive).map((t) => t.id));
  s.history = []; // undo would bring back tiles with faces from before the redeal
  s.picked = null;
  s.hint = null;
  s.events.push({ type: 'shuffle' });
}

function hint(s) {
  const pairs = matchingPairs(s);
  if (s.hintsLeft <= 0 || !pairs.length) { s.events.push({ type: 'refused', what: 'hint' }); return; }
  s.hintsLeft--;
  s.hint = pairs[0];
  s.events.push({ type: 'hint', pair: pairs[0] });
}

export function step(s, input = {}) {
  s.tick++;
  s.events = [];
  if (input.grant) {
    const key = { undo: 'undosLeft', shuffle: 'shufflesLeft', hint: 'hintsLeft' }[input.grant];
    if (key) { s[key]++; s.events.push({ type: 'grant', what: input.grant }); }
    return s;
  }
  if (status(s) !== 'playing') return s;
  if (input.pick !== undefined) pick(s, input.pick);
  else if (input.undo) undo(s);
  else if (input.shuffle) shuffle(s);
  else if (input.hint) hint(s);
  return s;
}
