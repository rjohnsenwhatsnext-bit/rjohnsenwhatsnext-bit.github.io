// Who beats whom, and what each faction is good at (Ryan, 25 Oct 2026: play like a small Age of
// Empires, not a numbers check). Before this every unit simply had bigger or smaller numbers, so
// the biggest pile of anything won and the three factions were the same army in different clothes.
//
// The triangle: swordsmen hold off knights, knights ride down archers and catapults, archers shoot
// down swordsmen. Catapults smash massed infantry but are helpless against cavalry.
export const COUNTERS = {
  sword: { knight: 2.5, archer: 0.85 }, // knights have twice the health and cost two and a half times as much
  archer: { sword: 1.5, knight: 0.7 },
  knight: { archer: 1.75, siege: 2, sword: 0.65 },
  siege: { sword: 1.3, knight: 0.6 },
  commander: {},
};

// One trait per faction, shown when choosing a faction and in the Army panel.
export const TRAITS = {
  verdant: { name: 'Royal Stables', text: 'Knights have 20% more health.', hp: { knight: 1.2 } },
  ironfjord: { name: 'Shieldwall', text: 'Swordsmen have 20% more health and take 30% less damage from archers.', hp: { sword: 1.2 }, guard: { sword: { archer: 0.7 } } },
  sunspire: { name: 'Desert Bowmen', text: 'Archers hit 20% harder and shoot further.', attack: { archer: 1.2 }, range: { archer: 3 } },
};

// a unit's health and range for its faction
export const traitHealth = (faction, type) => TRAITS[faction]?.hp?.[type] ?? 1;
export const traitRange = (faction, type) => TRAITS[faction]?.range?.[type] ?? 0;

// damage multiplier for one hit; a building or keep target has no unit type, so only the
// attacker's own faction bonus applies to it
export function hitMultiplier(attacker, attackerFaction, target, targetFaction) {
  const own = TRAITS[attackerFaction]?.attack?.[attacker] ?? 1;
  if (!target) return own;
  return own * (COUNTERS[attacker]?.[target] ?? 1) * (TRAITS[targetFaction]?.guard?.[target]?.[attacker] ?? 1);
}

// short line for the Army panel
const NAMES = { sword: 'swordsmen', archer: 'archers', knight: 'knights', siege: 'catapults' };
export function counterText(type) {
  const c = COUNTERS[type] || {};
  const strong = Object.keys(c).filter((k) => c[k] > 1).map((k) => NAMES[k]);
  const weak = Object.keys(COUNTERS).filter((k) => (COUNTERS[k][type] ?? 1) > 1).map((k) => NAMES[k]);
  return [strong.length ? 'Strong against ' + strong.join(' and ') : '', weak.length ? 'weak to ' + weak.join(' and ') : ''].filter(Boolean).join(', ');
}
