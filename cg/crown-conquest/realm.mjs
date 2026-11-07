// Crown & Conquest: the Realm screens (Claude, 13 Oct 2026). Daily rewards and
// quests, friends, the weekly league and the album, plus the war chest reveal.
// The rules are in engage.mjs and server/friends.mjs; this file only draws
// them and passes taps on. main.mjs hands in what it owns (the kingdom, the
// sheet, sound, saving, starting a battle) as ctx.
import { FLAGS, SKINS } from './catalog.mjs';
import { factionOf } from './factions.mjs';
import { AGES } from './ages.mjs';
import { safeProfile } from './battle.mjs';
import { guideView, advanceGuide, STREAK, streakView, claimStreak, questView, claimQuest, eventView, claimEvent, albumView, claimAlbum, weekWins, chestsToPity, PITY } from './engage.mjs';
import { social } from './social.mjs';

const CSS = `
.rl-guide{position:fixed;left:12px;right:12px;top:calc(124px + env(safe-area-inset-top));z-index:5;background:#13281ff2;border:1px solid #d8b46a;border-radius:14px;padding:10px 14px;color:#f1ead6;font:14px/1.35 system-ui,sans-serif;box-shadow:0 6px 22px #0008;text-align:left}
.rl-guide b{display:block;font-size:15px}.rl-guide small{opacity:.75}.rl-guide em{font-style:normal;color:#d8b46a;font-size:11px;letter-spacing:1px}
.rl-more{margin-top:16px;border-top:1px solid #ffffff22;padding-top:4px}
.more-title{margin:12px 0 8px;font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.7}
.more-row{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px}
.more-game{flex:0 0 72px;color:inherit;text-decoration:none;font-size:11px;text-align:center}
.more-game img{width:64px;height:64px;border-radius:14px;display:block;margin:0 auto 4px}
.rl-row{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin:10px 0}
.rl-box{border:1px solid #ffffff22;border-radius:9px;padding:7px 2px;text-align:center;font-size:11px;line-height:1.25;opacity:.6}
.rl-box b{display:block;font-size:15px}
.rl-box.got{opacity:1;background:#d8b46a22;border-color:#d8b46a88}
.rl-box.now{opacity:1;border-color:#d8b46a;box-shadow:0 0 0 2px #d8b46a55;animation:rl-pulse 1.4s ease-in-out infinite}
.rl-bar{height:7px;border-radius:4px;background:#ffffff1c;overflow:hidden;margin:6px 0}
.rl-bar i{display:block;height:100%;background:#d8b46a}
.rl-line{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:8px 0}
.rl-line>div{flex:1;min-width:0}
.rl-code{font-size:30px;letter-spacing:5px;text-align:center;margin:6px 0;font-family:Georgia,serif}
.rl-flags{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:8px 0}
.rl-flags span{font-size:26px;text-align:center;padding:5px 0;border-radius:8px;background:#ffffff0f}
.rl-flags span.no{filter:grayscale(1);opacity:.28}
.rl-me{background:#d8b46a22;border-radius:6px}
.rl-chest{font-size:96px;text-align:center;margin:26px 0 8px;animation:rl-shake .16s linear infinite}
.rl-chest.open{animation:rl-pop .5s ease-out both}
.rl-glow{border-radius:14px;padding:16px;text-align:center;animation:rl-pop .5s ease-out both}
.rl-Common{background:#ffffff14}.rl-Rare{background:#3f7fd655;box-shadow:0 0 26px #3f7fd6aa}
.rl-Epic{background:#8e4fd666;box-shadow:0 0 34px #a56bffcc}.rl-Legendary{background:#d8a13a66;box-shadow:0 0 44px #ffd15cdd}
@keyframes rl-shake{0%{transform:rotate(-5deg)}50%{transform:rotate(5deg) scale(1.05)}100%{transform:rotate(-5deg)}}
@keyframes rl-pop{0%{transform:scale(.5);opacity:0}70%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes rl-pulse{50%{box-shadow:0 0 0 5px #d8b46a22}}
@media (prefers-reduced-motion:reduce){.rl-chest,.rl-chest.open,.rl-glow,.rl-box.now{animation:none}}
`;

export function createRealm(ctx) {
  const { show, bind, toast, save, chime, esc } = ctx;
  document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));
  const town = () => ctx.town();
  const day = () => new Date().toLocaleDateString('en-CA');
  let tab = 'daily';
  let friends = null; // the last answer from the server, or { ok:false, error }
  let league = null;
  let busy = false;

  const tabs = () => `<div class="tabs">${[['daily', 'Daily'], ['friends', 'Friends'], ['league', 'League'], ['album', 'Album']].map(([k, t]) => `<button data-realm="${k}" class="${tab === k ? 'active' : ''}">${t}</button>`).join('')}</div>`;
  const bar = (have, need) => `<div class="rl-bar"><i style="width:${Math.round((have / need) * 100)}%"></i></div>`;

  function open(to = tab) {
    tab = to;
    const html = tab === 'daily' ? daily() : tab === 'friends' ? friendsHtml() : tab === 'league' ? leagueHtml() : album();
    show('Your realm', tabs() + html + '<div id="moreGames" class="rl-more" hidden></div>', 'realm');
    document.querySelectorAll('[data-realm]').forEach((b) => (b.onclick = () => open(b.dataset.realm)));
    moreGames();
    wire();
    if (tab === 'friends' && !friends) loadFriends();
    if (tab === 'league' && !league) loadLeague();
  }
  // "More from Tovelly": our other games that are live on Play (shell/promo.js, copied in
  // by the build as arcade-promo.js; the list comes from the server). Loaded on demand so
  // the unbuilt web folder still runs without it. With no list the shelf stays hidden.
  function moreGames() {
    const el = document.getElementById('moreGames');
    if (!el) return;
    import('./arcade-promo.js')
      .then((m) => m.renderMoreGames(el))
      .catch((e) => console.warn('More from Tovelly is not in this build: ' + e.message));
  }
  const given = (text) => {
    save();
    chime();
    open();
    toast(text);
  };

  // ---- daily: streak, quests, weekend
  function daily() {
    const t = town();
    const s = streakView(t, day());
    const boxes = STREAK.map((r, i) => `<div class="rl-box ${i < s.box || (s.claimed && i === s.box) ? 'got' : i === s.box ? 'now' : ''}"><b>${i + 1}</b>${esc(r.text)}</div>`).join('');
    const quests = questView(t, day());
    const ev = eventView(t, day());
    return `<h3>Day ${s.count} in a row</h3><div class="rl-row">${boxes}</div>
${s.claimed ? '<p class="note">Collected. Come back tomorrow for the next box. Miss a day and it starts again at 1.</p>' : `${s.lost ? `<p class="note">Your ${s.lost} day run ended. A new one starts today.</p>` : ''}<button id="rlStreak" class="primary" style="width:100%">Collect today: ${esc(STREAK[s.box].text)}</button>`}
<h3 style="margin-top:22px">Today's quests</h3>
${quests.map((q) => `<div class="rl-line"><div><b>${esc(q.text)}</b> <small>${q.have} of ${q.need} · ${esc(q.reward)}</small>${bar(q.have, q.need)}</div>${q.claimed ? '<button disabled>Done</button>' : `<button data-quest="${q.id}" ${q.done ? 'class="primary"' : 'disabled'}>Collect</button>`}</div>`).join('')}
<p class="note">${t.engage.quests.bonus ? 'All three done: bonus war chest collected.' : 'Finish all three for a bonus war chest. New quests every day.'}</p>
${ev ? `<h3 style="margin-top:22px">Weekend tournament</h3><div class="card"><div style="font-size:46px;text-align:center;color:${ev.flag.color}">${ev.flag.symbol}</div><h3>${esc(ev.flag.name)} flag</h3><p>Win ${ev.need} battles before Sunday ends. This flag cannot be earned any other way. ${ev.daysLeft === 1 ? 'Last day.' : ev.daysLeft + ' days left.'}</p>${bar(ev.have, ev.need)}${ev.claimed ? '<button disabled>Won</button>' : `<button id="rlEvent" ${ev.done ? 'class="primary"' : 'disabled'}>${ev.done ? 'Claim your prize' : ev.have + ' of ' + ev.need + ' wins'}</button>`}</div>` : '<p class="note" style="margin-top:22px">The weekend tournament opens on Friday, with a flag you cannot get any other way.</p>'}`;
  }

  // ---- friends
  const kingdomLine = (p) => {
    const k = safeProfile(p || {});
    const troops = Object.values(k.army).reduce((a, b) => a + b, 0);
    return `${esc(factionOf(k).name)} · ${esc(AGES.find((a) => a.id === k.age)?.name || '')} · ${troops} troops${Number.isFinite(p?.level) ? ' · level ' + Math.floor(p.level) : ''}`;
  };
  function friendsHtml() {
    if (!friends) return '<p>Finding your friends…</p>';
    if (!friends.ok) return `<p class="danger">${esc(friends.error)}</p><button id="rlRetry">Try again</button>`;
    return `<p>Your friend code</p><div class="rl-code">${esc(friends.code)}</div>
<div class="row"><button id="rlShare">Share my code</button><button id="rlCopy">Copy</button></div>
<p style="margin-top:16px">Add a mate by their code</p><input id="rlCode" maxlength="12" placeholder="Eight letters and numbers" autocapitalize="characters" autocomplete="off">
<button id="rlAdd" class="primary" style="width:100%;margin-top:10px">Send friend request</button>
${friends.sent ? `<p class="note">${friends.sent} request${friends.sent === 1 ? '' : 's'} waiting for an answer.</p>` : ''}
${friends.requests.length ? `<h3 style="margin-top:20px">Wants to be your friend</h3>${friends.requests.map((r) => `<div class="rl-line"><div><b>${esc(r.name)}</b></div><button data-accept="${esc(r.id)}" class="primary">Accept</button><button data-decline="${esc(r.id)}">No</button></div>`).join('')}` : ''}
<h3 style="margin-top:20px">Friends (${friends.friends.length} of ${friends.limit})</h3>
${friends.friends.length ? friends.friends.map((f) => `<article class="card" style="margin:10px 0"><h3>${esc(f.profile?.name || f.name)}</h3><p>${f.profile ? kingdomLine(f.profile) : 'They have not opened their kingdom since you became friends.'}</p><div class="row"><button data-fight="${esc(f.id)}" class="primary" ${f.profile ? '' : 'disabled'}>Battle their kingdom</button><button data-unfriend="${esc(f.id)}">Remove</button></div></article>`).join('') : '<p class="note">No friends yet. Send your code to a mate, or enter theirs. Once they accept, you see their whole kingdom and can battle it any time, even when they are not playing.</p>'}
<p class="note">A friend battle is practice: nobody loses troops or resources. To play live against each other, use Battle a friend under World.</p>`;
  }
  async function loadFriends() {
    await syncKingdom(true);
    friends = await social.friends();
    if (friends.ok) localStorage.setItem('crown-social', '1');
    if (tab === 'friends' && ctx.panel() === 'realm') open();
  }
  async function friendAct(run, done) {
    if (busy) return;
    busy = true;
    const r = await run();
    busy = false;
    if (!r.ok) return toast(r.error);
    friends = null;
    open('friends');
    toast(done(r));
  }

  // The kingdom a friend sees. Sent when it has changed; `force` on opening Friends.
  let sentKingdom = '';
  async function syncKingdom(force = false) {
    if (!force && localStorage.getItem('crown-social') !== '1') return;
    const profile = ctx.profile();
    const text = JSON.stringify(profile);
    if (text === sentKingdom) return;
    const r = await social.saveKingdom(profile);
    if (!r.ok) return void (force && toast('Your kingdom was not shared with friends: ' + r.error));
    sentKingdom = text;
    const named = await social.setName(profile.name);
    if (!named.ok && force) toast('Your kingdom name was not updated for friends: ' + named.error);
  }

  // ---- league
  function leagueHtml() {
    const wins = weekWins(town(), day());
    if (!league) return '<p>Fetching this week\'s league…</p>';
    if (!league.ok) return `<p class="danger">${esc(league.error)}</p><button id="rlRetry">Try again</button>`;
    const days = Math.max(1, Math.ceil(league.endsIn / 86400000));
    const head = `<span class="badge">${esc(String(league.league).toUpperCase())} LEAGUE · ${days} DAY${days === 1 ? '' : 'S'} LEFT</span><p>Kingdoms are ranked by battles won this week, campaign and frontier. You have <b>${wins}</b>.</p>`;
    if (!league.joined) return head + '<p class="note">Win one battle this week to join a group of up to 30 kingdoms. The top of each group moves up a league on Monday.</p>';
    return `${head}<table style="width:100%;border-collapse:collapse">${league.group.map((g) => `<tr class="${g.me ? 'rl-me' : ''}"><td style="padding:6px">${g.rank}</td><td style="padding:6px">${esc(g.name === 'Climber' ? 'A kingdom' : g.name)}${g.me ? ' (you)' : ''}</td><td style="padding:6px;text-align:right">${g.best}</td></tr>`).join('')}</table>
<p class="note">${league.promote ? `Top ${league.promote} move up on Monday.` : 'More kingdoms need to win a battle before anyone moves up.'}${league.relegate ? ` Bottom ${league.relegate} move down.` : ''}</p>`;
  }
  async function loadLeague() {
    await syncKingdom(true);
    league = await social.league(weekWins(town(), day()));
    if (tab === 'league' && ctx.panel() === 'realm') open();
  }

  // ---- album
  function album() {
    const t = town();
    const a = albumView(t);
    return `<h3>Flags · ${a.flags.have} of ${a.flags.of}</h3><div class="rl-flags">${FLAGS.map((f) => `<span class="${t.flags.includes(f.id) ? '' : 'no'}" style="color:${f.color}" title="${esc(f.name)}">${f.symbol}</span>`).join('')}</div>
<h3>Citadel skins · ${a.skins.have} of ${a.skins.of}</h3><p>${SKINS.map((k) => (t.skins.includes(k.id) ? `<b>${esc(k.name)}</b>` : `<span style="opacity:.4">${esc(k.name)}</span>`)).join(' · ')}</p>
<h3 style="margin-top:20px">Collector's rewards</h3>
${a.goals.map((g) => `<div class="rl-line"><div><b>${g.need} ${g.kind}</b> <small>${g.have} of ${g.need} · ${g.chests} war chest${g.chests === 1 ? '' : 's'}</small>${bar(g.have, g.need)}</div>${g.claimed ? '<button disabled>Done</button>' : `<button data-album="${g.id}" ${g.done ? 'class="primary"' : 'disabled'}>Collect</button>`}</div>`).join('')}
<p class="note">Flags and skins come from war chests, the Treasury, the 7 day reward and weekend tournaments.</p>`;
  }

  function wire() {
    const t = town();
    bind('rlStreak', () => {
      const r = claimStreak(t, day(), Math.random());
      if (r) {
        window.arcade?.track('streak', { day: r.count });
        given('Day ' + r.count + ': ' + r.text);
      }
    });
    document.querySelectorAll('[data-quest]').forEach((b) => (b.onclick = () => {
      const r = claimQuest(t, day(), b.dataset.quest);
      if (r) given(r.bonus ? 'All three quests done: a bonus war chest is in the Treasury.' : 'Quest reward collected.');
    }));
    bind('rlEvent', () => {
      const r = claimEvent(t, day());
      if (r) given('Tournament won: ' + r.text);
    });
    document.querySelectorAll('[data-album]').forEach((b) => (b.onclick = () => {
      const r = claimAlbum(t, b.dataset.album);
      if (r) given(r.chests + ' war chest' + (r.chests === 1 ? '' : 's') + ' added to the Treasury.');
    }));
    bind('rlRetry', () => {
      if (tab === 'friends') friends = null;
      else league = null;
      open();
    });
    bind('rlCopy', async () => {
      try {
        await navigator.clipboard.writeText(friends.code);
        toast('Code copied.');
      } catch {
        toast('Copying is not allowed here. Your code is ' + friends.code);
      }
    });
    bind('rlShare', async () => {
      const text = 'Add me in Crown & Conquest. My friend code is ' + friends.code;
      try {
        if (navigator.share) await navigator.share({ text });
        else {
          await navigator.clipboard.writeText(text);
          toast('Invite copied. Paste it to your mate.');
        }
      } catch (e) {
        if (e?.name !== 'AbortError') toast('Sharing is not available here. Your code is ' + friends.code);
      }
    });
    bind('rlAdd', () => friendAct(() => social.request(document.getElementById('rlCode').value), (r) => (r.state === 'friends' ? 'You and ' + r.name + ' are now friends.' : 'Request sent to ' + r.name + '. They need to accept.')));
    document.querySelectorAll('[data-accept]').forEach((b) => (b.onclick = () => friendAct(() => social.respond(b.dataset.accept, true), () => 'Friend added.')));
    document.querySelectorAll('[data-decline]').forEach((b) => (b.onclick = () => friendAct(() => social.respond(b.dataset.decline, false), () => 'Request declined.')));
    document.querySelectorAll('[data-unfriend]').forEach((b) => (b.onclick = () => friendAct(() => social.remove(b.dataset.unfriend), () => 'Removed from your friends.')));
    document.querySelectorAll('[data-fight]').forEach((b) => (b.onclick = () => {
      const f = friends.friends.find((v) => v.id === b.dataset.fight);
      if (f?.profile) ctx.fight({ ...f.profile, name: f.profile.name || f.name });
    }));
  }

  // ---- the war chest reveal: the roll is already made; this only shows it
  function chestShow(reward, after) {
    const left = chestsToPity(town());
    show('War chest', `<div class="rl-chest" id="rlChest">♜</div><p id="rlChestText" style="text-align:center">Breaking the seal…</p>`, 'chest');
    setTimeout(() => {
      if (ctx.panel() !== 'chest') return;
      chime();
      document.getElementById('content').innerHTML = `<div class="rl-chest open">♛</div><div class="rl-glow rl-${esc(reward.rarity)}"><span class="badge">${esc(reward.rarity.toUpperCase())}</span><h3>${esc(reward.name)}</h3></div>
<p class="note" style="margin-top:14px">An Epic or better is guaranteed at least every ${PITY} chests. ${left === PITY ? 'The count starts again now.' : left + ' to go at most.'}</p>
<button id="rlChestBack" class="primary" style="width:100%">${town().chests > 0 ? 'Back to the Treasury · ' + town().chests + ' more' : 'Back to the Treasury'}</button>`;
      bind('rlChestBack', after);
    }, 1300);
  }

  // ---- the first steps banner, above the menu bar while the kingdom is on screen
  const guide = Object.assign(document.createElement('button'), { className: 'rl-guide', hidden: true });
  guide.onclick = () => {
    const v = guideView(town());
    if (!v) return;
    if (v.go === 'land') toast('Tap any tree on the map and a worker heads straight there. Or tap a worker, then tap where it should go.');
    else ctx.go[v.go]();
  };
  document.body.append(guide);
  function showGuide(visible) {
    const paid = visible ? advanceGuide(town()) : null;
    if (paid) {
      save();
      chime();
      window.arcade?.track('guide', { step: town().engage.guide });
      toast(paid.finished ? 'First steps complete: 100 of each resource and a war chest. The kingdom is yours.' : 'Done. 100 of each resource for you.');
    }
    const v = visible ? guideView(town()) : null;
    guide.hidden = !v;
    if (v) guide.innerHTML = `<em>FIRST STEPS · ${v.step} OF ${v.of}</em><b>${esc(v.text)}</b><small>${esc(v.why)} Each step pays 100 of every resource.</small>`;
  }

  // called about once a second by main.mjs; `kingdom` is true while the town is on screen
  let shownFor = '';
  let lastSync = 0;
  function tick(idle, kingdom) {
    showGuide(kingdom);
    const now = Date.now();
    if (now - lastSync > 60000) {
      lastSync = now;
      void syncKingdom();
    }
    // the daily screen waits until the first steps are finished: one thing at a time
    if (!idle || shownFor === day() || guideView(town())) return;
    shownFor = day();
    if (!streakView(town(), day()).claimed) open('daily');
  }

  return { open, tick, chestShow };
}
