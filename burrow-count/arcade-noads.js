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
import { setAdFree, isAdFree, onInterstitialClosed } from './arcade-ads.js';

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
    onInterstitialClosed(offerAfterAd);
  } catch (e) {
    // offline or the server down: keep whatever this phone last knew
    problem = 'The store could not be reached: ' + (e.message || e);
    console.error('[noads] ' + problem);
    paint();
  }
  return true;
}
let started = null;

// The one purchase path, used by the button and by the offer after an ad.
// say(text) is how the result is told to the player.
async function buy(say) {
  if (isAdFree()) return 'owned';
  if (!store) { say(problem || 'The store is still loading. Try again in a moment.'); return 'not ready'; }
  try {
    const r = await store.buy(PRODUCT);
    if (r.status === 'purchased') { grant(true); say('Ads removed. Thank you!'); return 'purchased'; }
    if (r.status === 'pending') { say('Payment pending. Ads go once Google Play confirms it.'); return 'pending'; }
    return r.status || 'cancelled';
  } catch (e) {
    say('Could not remove ads: ' + (e.message || e));
    window.arcade && window.arcade.track && window.arcade.track('buy_failed', { product: PRODUCT, reason: String(e.message || e).slice(0, 200) });
    return 'failed';
  } finally { paint(); }
}

// After an ad between games has closed: one small card offering Remove ads.
// Only when it can really be bought (Play lists it, the store answered) and is
// not owned. It goes away on Not now, on a tap outside, or after a purchase.
let offer = null;
const track = (result) => window.arcade && window.arcade.track && window.arcade.track('noads_offer', { result });
function closeOffer() {
  if (offer) { offer.remove(); offer = null; }
}
function offerAfterAd() {
  if (offer || isAdFree() || !store || problem || !price) return;
  offer = document.createElement('div');
  offer.className = 'arcade-noads-offer';
  offer.setAttribute('role', 'dialog');
  offer.setAttribute('aria-label', 'Remove ads');
  offer.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.45);padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom,0px));box-sizing:border-box;font:16px/1.35 system-ui,sans-serif';
  const card = document.createElement('div');
  card.style.cssText = 'width:100%;max-width:420px;background:#14161f;color:#fff;border-radius:16px;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.5);text-align:center';
  const title = document.createElement('div');
  title.textContent = 'Had enough of ads?';
  title.style.cssText = 'font-weight:800;font-size:19px;margin-bottom:4px';
  const text = document.createElement('div');
  text.textContent = 'Remove them from this game for good. One payment, no banners, no ads between games.';
  text.style.cssText = 'opacity:.82;margin-bottom:14px';
  const yes = document.createElement('button');
  yes.type = 'button';
  yes.textContent = 'Remove ads · ' + price;
  yes.style.cssText = 'display:block;width:100%;border:0;border-radius:12px;padding:14px;font:inherit;font-weight:800;background:#ffd23f;color:#14161f;margin-bottom:8px';
  const no = document.createElement('button');
  no.type = 'button';
  no.textContent = 'Not now';
  no.style.cssText = 'display:block;width:100%;border:0;border-radius:12px;padding:12px;font:inherit;background:transparent;color:#fff;opacity:.75';
  card.append(title, text, yes, no);
  offer.append(card);
  no.addEventListener('click', () => { track('dismissed'); closeOffer(); });
  offer.addEventListener('click', (e) => { if (e.target === offer) { track('dismissed'); closeOffer(); } });
  yes.addEventListener('click', async () => {
    yes.disabled = true; no.disabled = true;
    const result = await buy((said) => { text.textContent = said; });
    track(result);
    if (result === 'purchased' || result === 'pending') setTimeout(closeOffer, 1800);
    else { yes.disabled = false; no.disabled = false; }
  });
  document.body.append(offer);
  track('shown');
}

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
    b.disabled = true;
    await buy(toast);
  });
  started = started || start();
  return b;
}
