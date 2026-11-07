// Leap Legends purchases.
// In the app: Google Play, every purchase confirmed by the games server before
// anything is granted (arcade-billing.js). Only ON_SALE can be bought; the
// rest say "Coming soon" until Ryan prices them (29 Sep 2026: remove ads at
// A$4.99 now, the gem packs, lives, pass and VIP once there are players).
// In a browser: the web preview, where everything is free and says so.
import { PRODUCTS } from './economy.mjs';
import { createBilling, billingAvailable } from './arcade-billing.js';
import { signedCall } from './net.mjs';

export const ON_SALE = ['remove_ads'];
const native = () => Boolean(globalThis.Capacitor?.isNativePlatform?.());
const store = createBilling({ call: signedCall, consumables: ['gems_small', 'gems_medium', 'gems_large', 'lives_refill', 'piggy_bank'] });
const prices = new Map();

export const billing = {
  status: '', // why the store is not working, shown in the shop
  mode: () => (!native() ? 'preview' : billingAvailable() ? 'store' : 'unavailable'),
  label(id) {
    const mode = this.mode();
    if (mode === 'preview') return 'Free in preview';
    if (mode === 'unavailable' || !ON_SALE.includes(id)) return 'Coming soon';
    return prices.get(id) || 'Loading price';
  },
  canBuy(id) {
    return this.mode() === 'preview' || (this.mode() === 'store' && ON_SALE.includes(id) && prices.has(id));
  },
  // prices from Play, then everything the server has verified for this player
  async start() {
    if (this.mode() !== 'store') return [];
    try {
      for (const p of await store.products(ON_SALE)) prices.set(p.id, p.displayPrice);
      const missing = ON_SALE.filter((id) => !prices.has(id));
      this.status = missing.length ? `Google Play does not list ${missing.join(', ')} yet.` : '';
      return await store.owned();
    } catch (e) {
      this.status = 'The store could not be reached: ' + (e.message || e);
      throw e;
    }
  },
  // -> { status: 'purchased', token, preview? } | { status: 'pending' } | { status: 'cancelled' }
  async buy(id) {
    if (!PRODUCTS[id]) throw new Error('Unknown product');
    if (this.mode() === 'preview') return { status: 'purchased', token: `preview-${id}-${Date.now()}`, preview: true };
    if (!this.canBuy(id)) throw new Error(this.status || 'That is not on sale yet');
    return store.buy(id);
  },
  async restore() {
    if (this.mode() !== 'store') throw new Error('Restoring needs the app from Google Play');
    await store.restore();
    return store.owned();
  },
};
