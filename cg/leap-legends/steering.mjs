// A stationary press steers by screen half. A drag steers by its direction,
// including reversals within the same half; the player need not cross centre.
export function createSteering() {
  const pointers = new Map();
  const keys = new Set();
  const keyDirection = key => ['ArrowLeft', 'KeyA'].includes(key) ? -1 : ['ArrowRight', 'KeyD'].includes(key) ? 1 : 0;
  return {
    down(id, x, width) { pointers.set(id, { x, travel: 0, direction: x < width / 2 ? -1 : 1 }); },
    move(id, x) {
      const p = pointers.get(id);
      if (!p) return;
      const dx = x - p.x;
      p.x = x;
      if (!dx) return;
      p.travel = Math.sign(dx) === Math.sign(p.travel) ? p.travel + dx : dx;
      if (Math.abs(p.travel) >= 6) p.direction = Math.sign(p.travel);
    },
    up(id) { pointers.delete(id); },
    keyDown(key) { if (!keyDirection(key)) return false; keys.add(key); return true; },
    keyUp(key) { return keys.delete(key); },
    clear() { pointers.clear(); keys.clear(); },
    get direction() {
      if (keys.size) return Math.sign([...keys].reduce((sum, key) => sum + keyDirection(key), 0));
      // The most recently pressed finger controls the direction, rather than
      // cancelling both fingers when changing sides without releasing first.
      return [...pointers.values()].at(-1)?.direction || 0;
    },
  };
}
