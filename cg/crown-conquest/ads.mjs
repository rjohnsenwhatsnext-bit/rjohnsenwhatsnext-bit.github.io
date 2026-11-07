// Crown & Conquest ads (Claude). Ryan's codes are a banner and a rewarded unit,
// no interstitial: it is one continuous game (29 Sep 2026). The banner shows on
// the start menu only and never over the kingdom or a battle. The rewarded unit
// pays for what the Treasury lists (rewards.mjs); main.mjs reaches it through
// window.crownAds, so the game still runs where this file cannot load.
import { initAds, showBanner, hideBanner, showRewarded, adsAvailable, hasUnit } from './arcade-ads.js';
import { mountRemoveAds } from './arcade-noads.js';

const menu = document.getElementById('menu');
const apply = () => (menu && !menu.hidden ? showBanner() : hideBanner());

initAds()
  .then(() => {
    apply();
    if (menu) new MutationObserver(apply).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  })
  .catch((e) => console.warn('Ads unavailable:', e?.message || e));

// Remove ads, A$4.99 (shell/noads.js), on the main menu. Only in the app.
mountRemoveAds(null, { before: 'menuFriends' });

window.crownAds = { ready: () => adsAvailable() && hasUnit('rewarded'), showRewarded };
