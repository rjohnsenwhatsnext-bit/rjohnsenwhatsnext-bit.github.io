// Scrap Summit purchases: the cosmetics (A$2.99 each) and Remove ads (A$4.99),
// Ryan, 28 Sep 2026. In the app this exposes globalThis.ScrapSummitBilling,
// the adapter Codex's Outfitter calls (COSMETICS-HANDOVER.md), and runs the
// Remove ads button in Settings. Every purchase is confirmed by the Tovelly
// games server with Google before anything unlocks (arcade-billing.js); the
// server re-checks with Google, so a refund takes the item back.
// In a browser nothing is set up and the Outfitter shows its preview mode.
import { createBilling, billingAvailable } from './arcade-billing.js';
import { bannersAllowed } from './arcade-ads.js';

const SERVER = 'https://api-production-50fc.up.railway.app';
const GAME = 'scrap-summit';
const KEY = 'scrapsummit.player';
const ADS_KEY = 'scrapsummit.adfree'; // only hides a banner early; never unlocks anything
const REMOVE_ADS = 'remove_ads';
const $ = (id) => document.getElementById(id);

const read = (k) => {
  try {
    return JSON.parse(localStorage.getItem(k) || 'null');
  } catch {
    return null;
  }
};
// Without storage the player registers again next launch; purchases still
// come back through Restore, but the player is told why.
let storageProblem = '';
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    storageProblem = 'This phone cannot save your purchases locally (' + (e.message || e) + '). Use Restore purchases after a restart.';
  }
};

// ---- the anonymous player, same shape as Leap Legends
let me = read(KEY);
async function raw(method, path, body) {
  const r = await fetch(SERVER + path, {
    method,
    headers: { 'content-type': 'application/json', ...(me ? { authorization: `Bearer ${me.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({ error: `The server answered ${r.status}` }));
  if (!r.ok) throw Object.assign(new Error(j.error || `The server answered ${r.status}`), { status: r.status });
  return j;
}
let registering = null;
function ensurePlayer() {
  if (me) return Promise.resolve(me);
  registering ??= raw('POST', '/v1/players', { game: GAME, name: 'Climber' })
    .then((p) => {
      me = { id: p.id, token: p.token };
      write(KEY, me);
      return me;
    })
    .finally(() => {
      registering = null;
    });
  return registering;
}
async function signedCall(method, path, body) {
  await ensurePlayer();
  try {
    return await raw(method, path, body);
  } catch (e) {
    if (e.status !== 401) throw e;
    me = null;
    await ensurePlayer();
    return raw(method, path, body);
  }
}

if (billingAvailable()) {
  const store = createBilling({ call: signedCall });
  let adFree = read(ADS_KEY) === true;
  bannersAllowed(!adFree);
  const setAdFree = (v) => {
    adFree = v;
    write(ADS_KEY, v);
    bannersAllowed(!v);
    renderAds();
  };

  const entitlements = async () => {
    const owned = await store.owned();
    const ids = owned.map((p) => p.productId);
    setAdFree(ids.includes(REMOVE_ADS));
    return { verified: true, productIds: ids };
  };

  globalThis.ScrapSummitBilling = {
    listProducts: ({ productIds }) => store.products(productIds),
    getEntitlements: entitlements,
    async purchase({ productId }) {
      const r = await store.buy(productId);
      return { status: r.status };
    },
    async restore() {
      await store.restore();
    },
  };

  // ---- Remove ads, in Settings
  let price = null;
  let adsNote = '';
  let busy = false;
  function renderAds() {
    const b = $('removeAds');
    if (!b) return;
    b.classList.remove('hidden');
    b.disabled = busy || adFree || !price;
    b.textContent = adFree ? 'Ads removed. Thank you.' : price ? `Remove ads · ${price}` : 'Remove ads';
    const note = adsNote || storageProblem;
    $('adsStatus').textContent = note;
    $('adsStatus').classList.toggle('hidden', !note);
  }
  async function act(fn) {
    busy = true;
    renderAds();
    try {
      adsNote = (await fn()) || '';
    } catch (e) {
      adsNote = e.message || String(e);
    } finally {
      busy = false;
      renderAds();
    }
  }
  $('removeAds').onclick = () =>
    act(async () => {
      const r = await store.buy(REMOVE_ADS);
      if (r.status === 'cancelled') return 'Cancelled. Nothing was charged.';
      if (r.status === 'pending') return 'Payment pending. Ads go once Google confirms it.';
      await entitlements();
      return adFree ? '' : 'Paid, but the server has not confirmed it yet. Try Restore purchases in the Outfitter.';
    });

  act(async () => {
    const [p] = await store.products([REMOVE_ADS]);
    price = p?.displayPrice || null;
    await entitlements();
    return price ? '' : 'Google Play does not list Remove ads yet.';
  });
}
