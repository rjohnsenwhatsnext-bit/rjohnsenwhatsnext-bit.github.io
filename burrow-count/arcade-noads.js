// Remove ads, for any game (Ryan, 5 Oct 2026: every game gets it, A$4.99).
//
//   import { mountRemoveAds } from './arcade-noads.js';
//   mountRemoveAds(document.getElementById('done'), { before: 'closeDone', toast });
//
// Puts a "Remove ads" button where the game asks. Buying goes through Google
// Play and the Tovelly games server (arcade-billing.js), which checks it with
// Google before anything changes; the player is the one the tracker already
// registered (window.arcade.call). Bought, there are no banners and no ads
// between games (setAdFree in arcade-ads.js). Rewarded ads stay: the player
// chooses those for a reward.
//
// Each launch asks the server what this player owns, so a reinstall or a new
// phone with the same Google account gets it back, and a refund takes it away.
// A note on the phone only hides ads early while that answer is on its way.
// In a browser there is no store, so the button does not appear.
// Shell games (game.js on shell/) import it as it is, beside ads.js and
// billing.js. For a game with its own folder the build copies it as
// arcade-noads.js with these two imports renamed to arcade-billing.js and
// arcade-ads.js, so it shares the one ads module the game itself uses.
import { createBilling, billingAvailable } from './arcade-billing.js';
import { setAdFree, isAdFree } from './arcade-ads.js';

const PRODUCT = 'remove_ads';
const game = (window.ARCADE_GAME && window.ARCADE_GAME.idSuffix) || 'game';
const NOTE = game + '.adfree';
const buttons = new Set();
let price = '';
let problem = '';
let store = null;

function note(on) {
  try { on ? localStorage.setItem(NOTE, '1') : localStorage.removeItem(NOTE); }
  catch (e) { console.error('[noads] the phone would not note Remove ads (' + e.message + '); it is checked with the server each launch instead.'); }
}
function noted() {
  try { return localStorage.getItem(NOTE) === '1'; } catch { return false; }
}
function grant(on) {
  setAdFree(on);
  note(on);
  paint();
}
function paint() {
  for (const b of buttons) {
    if (!b.isConnected) { buttons.delete(b); continue; } // a screen that was rebuilt
    if (isAdFree()) { b.textContent = 'Ads removed. Thank you!'; b.disabled = true; }
    else if (problem) { b.textContent = 'Remove ads'; b.disabled = false; b.title = problem; }
    else { b.textContent = price ? `Remove ads · ${price}` : 'Remove ads'; b.disabled = false; b.title = ''; }
  }
}

// early, so a player who paid never sees a banner flash up at launch
if (noted()) setAdFree(true);

async function start() {
  if (!billingAvailable() || !window.arcade || !window.arcade.call) return false;
  store = createBilling({ call: window.arcade.call });
  try {
    const [listed] = await store.products([PRODUCT]);
    price = (listed && listed.displayPrice) || '';
    if (!listed) problem = 'Google Play does not list Remove ads for this game yet.';
    // the server's word on what this player owns, both ways
    let owned = await store.owned();
    if (!owned.some((p) => p.productId === PRODUCT)) {
      // a reinstall or a new phone is a new player to the server: ask Play
      // what this Google account holds, which hands it to the server
      await store.restore();
      owned = await store.owned();
    }
    grant(owned.some((p) => p.productId === PRODUCT));
  } catch (e) {
    // offline or the server down: keep whatever this phone last knew
    problem = 'The store could not be reached: ' + (e.message || e);
    console.error('[noads] ' + problem);
    paint();
  }
  return true;
}
let started = null;

// Puts the button in `parent` (before the element with id `before`, if given).
// With no parent, it goes beside `before`, in whatever holds it.
// `toast(text)` is the game's own way of saying something; optional.
export function mountRemoveAds(parent, { before, toast, className = '' } = {}) {
  const anchor = before ? (typeof before === 'string' ? document.getElementById(before) : before) : null;
  parent = parent || (anchor && anchor.parentNode);
  if (!parent || !billingAvailable()) return null;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = ('arcade-noads ' + className).trim();
  if (anchor && anchor.parentNode === parent) parent.insertBefore(b, anchor);
  else parent.appendChild(b);
  buttons.add(b);
  paint();
  // a game with no message of its own: say it on the button for a few seconds
  toast = toast || ((text) => { b.textContent = text; b.disabled = true; setTimeout(paint, 3500); });
  b.addEventListener('click', async () => {
    if (isAdFree()) return;
    if (!store) { toast(problem || 'The store is still loading. Try again in a moment.'); return; }
    b.disabled = true;
    try {
      const r = await store.buy(PRODUCT);
      if (r.status === 'purchased') { grant(true); toast('Ads removed. Thank you!'); }
      else if (r.status === 'pending') toast('Payment pending. Ads go once Google Play confirms it.');
    } catch (e) {
      toast('Could not remove ads: ' + (e.message || e));
      window.arcade && window.arcade.track && window.arcade.track('buy_failed', { product: PRODUCT, reason: String(e.message || e).slice(0, 200) });
    } finally { paint(); }
  });
  started = started || start();
  return b;
}
