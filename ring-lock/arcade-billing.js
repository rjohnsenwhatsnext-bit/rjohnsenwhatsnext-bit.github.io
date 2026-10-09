// Google Play purchases, through @capgo/native-purchases in the phone app.
// Nothing is granted on the phone's word. Every purchase goes to the Tovelly
// games server, which asks Google whether it is real, acknowledges it and
// records it against the player. Only the server acknowledges: a purchase the
// server never confirmed is refunded by Google after three days, so a player
// is never charged for something the game did not give them.
//
// In a browser there is no store. available() is false and every call says
// so; a game decides for itself what a web preview does.

let np = null;
function plugin() {
  const cap = globalThis.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
  if (np) return np;
  if (cap.registerPlugin && cap.isPluginAvailable && cap.isPluginAvailable('NativePurchases')) np = cap.registerPlugin('NativePurchases');
  return np;
}
function need() {
  const p = plugin();
  if (!p) throw new Error('Purchases need the app from Google Play');
  return p;
}

export const billingAvailable = () => Boolean(plugin());

// call(method, path, body) is the game's signed-in request to the games server.
// consumables are product ids that can be bought again (none are on sale yet).
export function createBilling({ call, consumables = [] }) {
  const consumable = new Set(consumables);

  // the server's word on one purchase; a consumable is used up only after it
  async function confirm(t) {
    if (!t.purchaseToken) throw new Error('The store gave no purchase token');
    const r = await call('POST', '/v1/purchases', { productId: t.productIdentifier, purchaseToken: t.purchaseToken, kind: 'product' });
    const ok = r.granted || (r.already && r.state === 'purchased');
    if (ok && consumable.has(t.productIdentifier)) await need().consumePurchase({ purchaseToken: t.purchaseToken });
    return { ...r, ok, productId: t.productIdentifier, token: t.purchaseToken };
  }

  // what Play says this Google account owns right now
  async function playOwns() {
    const { purchases } = await need().getPurchases({ productType: 'inapp' });
    return (purchases || []).filter((t) => t.purchaseState === '1' && t.purchaseToken);
  }

  return {
    available: billingAvailable,

    // prices as Play shows them in the player's currency: [{ id, displayPrice }]
    async products(ids) {
      const { products } = await need().getProducts({ productIdentifiers: ids, productType: 'inapp' });
      return (products || []).map((x) => ({ id: x.identifier, displayPrice: x.priceString }));
    },

    // -> { status: 'purchased', token } | { status: 'pending' } | { status: 'cancelled' }
    async buy(productId) {
      const p = need();
      let t;
      try {
        t = await p.purchaseProduct({ productIdentifier: productId, productType: 'inapp', autoAcknowledgePurchases: false, isConsumable: false });
      } catch (e) {
        const msg = String(e?.message || e);
        if (/pending/i.test(msg)) return { status: 'pending' };
        if (!/not purchased/i.test(msg)) throw e;
        // The plugin says "not purchased" both for a cancel and for "you
        // already own this" (a reinstall). Play knows which: an owned one is
        // confirmed like a new purchase.
        const mine = (await playOwns()).find((x) => x.productIdentifier === productId);
        if (!mine) return { status: 'cancelled' };
        t = mine;
      }
      const r = await confirm(t);
      if (r.ok) return { status: 'purchased', token: r.token };
      if (r.state === 'pending') return { status: 'pending' };
      throw new Error(`Google says this purchase is ${r.state}. Nothing was unlocked.`);
    },

    // send everything Play says this account owns to the server again (a new
    // phone, a reinstall, a purchase confirmed while the game was closed)
    async restore() {
      const out = [];
      for (const t of await playOwns()) out.push(await confirm(t));
      return out;
    },

    // what the server has verified for this player: [{ productId, token, state }]
    async owned() {
      const r = await call('GET', '/v1/purchases');
      return r.purchases;
    },
  };
}
