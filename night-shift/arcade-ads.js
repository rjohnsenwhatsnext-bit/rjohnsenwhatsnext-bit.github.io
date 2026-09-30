// AdMob, through @capacitor-community/admob when running as a phone app.
// In a browser there is no AdMob: every call reports "not in the app" rather
// than pretending an ad played, so a reward is never handed out for nothing.

const GOOGLE_TEST = {
  android: {
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
};

// Interstitials: never before this many finished runs, and never closer
// together than this. Rewarded ads are always the player's choice.
const RUNS_BETWEEN_INTERSTITIALS = 3;
const MIN_MS_BETWEEN_INTERSTITIALS = 120000;

// registerPlugin gives the promise based proxy the plugin's API expects.
// Capacitor.Plugins.AdMob is the legacy proxy: on a real Android build its
// addListener returned a plain object and its events never arrived (found by
// the emulator smoke test, 27 Sep 2026).
let adMob = null;
function plugin() {
  const cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return null;
  if (adMob) return adMob;
  if (cap.registerPlugin && cap.isPluginAvailable && cap.isPluginAvailable('AdMob')) adMob = cap.registerPlugin('AdMob');
  else if (cap.Plugins && cap.Plugins.AdMob) adMob = cap.Plugins.AdMob;
  return adMob;
}

function platform() {
  return window.Capacitor && window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : 'web';
}

function unitId(kind) {
  const cfg = (window.ARCADE_ADS && window.ARCADE_ADS[platform()]) || {};
  if (cfg[kind]) return cfg[kind];
  return (GOOGLE_TEST[platform()] || {})[kind] || null;
}

let ready = null;
let lastError = '';
let consentError = '';

// Why Google's consent check failed, if it did; ads still run without it.
export function consentProblem() {
  return consentError;
}
let runsSinceInterstitial = 0;
let lastInterstitialAt = 0;

export function adsError() {
  return lastError;
}

export function adsAvailable() {
  return plugin() !== null;
}

// Consent first (Google's UMP form, shown only where the law requires it),
// then initialise. Resolves true when ads can be requested.
export function initAds() {
  if (ready) return ready;
  const AdMob = plugin();
  if (!AdMob) {
    lastError = 'Ads only run in the phone app.';
    ready = Promise.resolve(false);
    return ready;
  }
  ready = (async () => {
    try {
      await AdMob.initialize({ initializeForTesting: !window.ARCADE_ADS_LIVE });
    } catch (e) {
      lastError = 'Ads could not start: ' + (e && e.message ? e.message : String(e));
      console.error(lastError);
      return false;
    }
    // The consent check is its own step. On the emulator it failed with
    // "Error making request" and, when that was fatal, no ad was ever asked
    // for. Where consent is required and could not be gathered, Google serves
    // only non-personalised ads, so the game carries on and says why.
    try {
      const info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') {
        await AdMob.showConsentForm();
      }
    } catch (e) {
      consentError = 'Consent check failed: ' + (e && e.message ? e.message : String(e));
      console.warn(consentError);
    }
    return true;
  })();
  return ready;
}

// Called at every game over. Shows an interstitial only when both the run
// count and the time gap allow it. Returns what happened, for the caller.
export async function maybeInterstitial() {
  runsSinceInterstitial += 1;
  if (runsSinceInterstitial < RUNS_BETWEEN_INTERSTITIALS) return 'not due';
  if (Date.now() - lastInterstitialAt < MIN_MS_BETWEEN_INTERSTITIALS) return 'too soon';
  if (!(await initAds())) return 'unavailable';
  const AdMob = plugin();
  try {
    await AdMob.prepareInterstitial({ adId: unitId('interstitial') });
    await AdMob.showInterstitial();
    runsSinceInterstitial = 0;
    lastInterstitialAt = Date.now();
    return 'shown';
  } catch (e) {
    lastError = 'No ad this time: ' + (e && e.message ? e.message : String(e));
    console.error(lastError);
    return 'failed';
  }
}

// Rewarded ad. Resolves { rewarded: true } only when AdMob reports the reward,
// otherwise { rewarded: false, reason } so the screen can say why.
export async function showRewarded() {
  if (!(await initAds())) return { rewarded: false, reason: lastError };
  const AdMob = plugin();
  try {
    await AdMob.prepareRewardVideoAd({ adId: unitId('rewarded') });
  } catch (e) {
    lastError = 'No ad available: ' + (e && e.message ? e.message : String(e));
    console.error(lastError);
    return { rewarded: false, reason: lastError };
  }
  // The plugin resolves showRewardVideoAd only when the reward is earned, so a
  // player who closes the ad early would leave it waiting forever. The
  // Dismissed event settles that case; the reward, when earned, arrives first.
  return new Promise((resolve) => {
    let settled = false;
    let handle = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (handle) handle.remove();
      resolve(result);
    };
    Promise.resolve(
      AdMob.addListener('onRewardedVideoAdDismissed', () => {
        setTimeout(() => finish({ rewarded: false, reason: 'The ad closed before the reward.' }), 600);
      }),
    ).then((h) => {
      handle = h;
      if (settled && h) h.remove();
    });
    AdMob.showRewardVideoAd().then(
      () => finish({ rewarded: true }),
      (e) => {
        lastError = 'The ad did not play: ' + (e && e.message ? e.message : String(e));
        console.error(lastError);
        finish({ rewarded: false, reason: lastError });
      },
    );
  });
}
