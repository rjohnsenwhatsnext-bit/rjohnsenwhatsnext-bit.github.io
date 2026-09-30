// Crown & Conquest ads (Claude). Ryan's codes are a banner and a rewarded unit,
// no interstitial: it is one continuous game (29 Sep 2026). The banner shows on
// the start menu only and never over the kingdom or a battle. The rewarded unit
// has no reward to give yet, so it is not called.
import { initAds, showBanner, hideBanner } from './arcade-ads.js';

const menu = document.getElementById('menu');
const apply = () => (menu && !menu.hidden ? showBanner() : hideBanner());

initAds()
  .then(() => {
    apply();
    if (menu) new MutationObserver(apply).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  })
  .catch((e) => console.warn('Ads unavailable:', e?.message || e));
