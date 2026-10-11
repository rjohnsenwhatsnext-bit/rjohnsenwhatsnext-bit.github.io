// "More from Tovelly" (Claude, 29 Sep 2026; Ryan's playbook addition 4).
// A shelf of our other games that are live on Google Play. Which games are
// live comes from the server's shared "arcade" settings (promo.live, a list of
// slugs), so a game joins every shelf the day its review clears, with no app
// update. Until then the shelf stays hidden: nothing points at a store page
// that does not exist yet.
const SERVER = 'https://api-production-50fc.up.railway.app';
const ART = 'https://rjohnsenwhatsnext-bit.github.io'; // the games preview (moved off Vercel 30 Sep 2026)
const PREFIX = 'au.com.tovelly.';

let live = null;
async function liveGames() {
  if (live) return live;
  live = fetch(`${SERVER}/v1/config?game=arcade`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('settings ' + r.status))))
    .then((j) => (Array.isArray(j.config?.promo?.live) ? j.config.promo.live : []))
    .catch((e) => {
      console.warn('More games unavailable:', e.message);
      live = null; // try again next time the shelf is shown
      return [];
    });
  return live;
}

// games: [{ slug, title, idSuffix }] from the server list
// el: an empty element; filled with cards, or hidden when there is nothing live
export async function renderMoreGames(el) {
  const me = globalThis.ARCADE_GAME?.slug;
  const list = (await liveGames()).filter((g) => g && g.slug && g.slug !== me).slice(0, 6);
  el.hidden = list.length === 0;
  el.innerHTML = list.length
    ? `<p class="more-title">More from Tovelly</p><div class="more-row">${list
        .map((g) => `<a class="more-game" href="https://play.google.com/store/apps/details?id=${PREFIX}${encodeURIComponent(g.idSuffix)}" data-slug="${encodeURIComponent(g.slug)}" target="_blank" rel="noopener"><img src="${ART}/${encodeURIComponent(g.slug)}.png" alt="" loading="lazy"><span>${String(g.title).replace(/[<>&"]/g, '')}</span></a>`)
        .join('')}</div>`
    : '';
  for (const a of el.querySelectorAll('.more-game')) a.addEventListener('click', () => globalThis.arcade?.track?.('promo_tap', { to: a.dataset.slug }));
}
