// Fiver: screens, keyboard, saving, ads. The rules are logic.mjs.
import { LEVELS, dayNumber, answerFor, isWord, score, clueBreak, shareText, record } from './logic.mjs';
import { initAds, maybeInterstitial, showBanner } from './arcade-ads.js';

const $ = (id) => document.getElementById(id);
const KEY = 'fiver.v1';
const words = await (await fetch('words.json')).json();

// saved: per level, today's board and the stats
function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null') || {};
  } catch (e) {
    console.warn('Save unreadable, starting fresh:', e.message);
    return {};
  }
}
let S = { level: 'easy', clueRule: false, boards: {}, stats: {}, seenHelp: false, ...load() };
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
  } catch {
    toast('Progress cannot save on this device');
  }
}

let day = dayNumber();
let current = '';
let busy = false;
let playing = false;
const board = () => {
  const b = S.boards[S.level];
  if (b && b.day === day) return b;
  S.boards[S.level] = { day, rows: [], done: false, won: false, extra: 0 };
  return S.boards[S.level];
};
const L = () => LEVELS[S.level];
const answer = () => answerFor(words, S.level, day);

let toastT;
function toast(msg, ms = 1600) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), ms);
}

// ---- drawing
function draw() {
  const b = board();
  const { letters, tries } = L();
  const rows = tries + b.extra;
  const size = Math.max(16,Math.min(62, Math.floor((Math.min(innerWidth, 500) - 24 - 6 * (letters - 1)) / letters), Math.floor(($('board').parentElement.clientHeight - 44 - 6 * (rows - 1)) / rows)));
  const el = $('board');
  el.innerHTML = '';
  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div');
    row.className = 'rowb' + (r===b.rows.length&&!b.done?' current':'');
    row.setAttribute('role','group');row.setAttribute('aria-label',`Guess ${r+1}`);
    row.style.gridTemplateColumns = `repeat(${letters}, ${size}px)`;
    const done = b.rows[r];
    const word = done ? done.word : r === b.rows.length && !b.done ? current : '';
    for (let i = 0; i < letters; i++) {
      const t = document.createElement('div');
      t.className = 'tile' + (word[i] ? ' filled' : '') + (done ? ` ${done.marks[i]}` : '');
      t.style.fontSize = `${Math.round(size * 0.46)}px`;
      t.textContent = word[i] || '';
      t.setAttribute('aria-label',word[i] ? word[i].toUpperCase()+(done?', '+({hit:'correct position',near:'another position',miss:'not in the word'}[done.marks[i]]):'') : 'Empty');
      row.append(t);
    }
    el.append(row);
  }
  // keyboard colours: the best seen for each letter
  const best = {};
  const rank = { miss: 1, near: 2, hit: 3 };
  for (const { word, marks } of b.rows) for (let i = 0; i < word.length; i++) if ((rank[marks[i]] || 0) > (rank[best[word[i]]] || 0)) best[word[i]] = marks[i];
  for (const k of document.querySelectorAll('.key[data-k]')) k.className = 'key' + (k.dataset.k.length > 1 ? ' wide' : '') + (best[k.dataset.k] ? ` ${best[k.dataset.k]}` : '');
  for (const btn of document.querySelectorAll('#levels button')) {
    const lb = S.boards[btn.dataset.level];
    btn.classList.toggle('on', btn.dataset.level === S.level);
    btn.classList.toggle('done', Boolean(lb && lb.day === day && lb.done));
    btn.disabled=busy;btn.setAttribute('aria-pressed',String(btn.dataset.level===S.level));
  }
  $('homeBtn').disabled=busy;
  $('dailyLabel').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'long'});
  const completed=Object.values(S.boards).filter(x=>x.day===day&&x.done).length;
  $('dailyProgress').textContent=`${completed} / 3 complete`;
  $('puzzleStatus').textContent=b.done?(b.won?'Beautifully done. See you tomorrow.':'A fresh word awaits tomorrow.'):`${letters} letters · Guess ${b.rows.length+1} of ${rows}`;
}

function buildKeyboard() {
  const rows = ['qwertyuiop', 'asdfghjkl', ['enter', ...'zxcvbnm', 'back']];
  for (const r of rows) {
    const row = document.createElement('div');
    row.className = 'krow';
    for (const k of r) {
      const b = document.createElement('button');
      b.className = 'key' + (k.length > 1 ? ' wide' : '');
      b.dataset.k = k;
      b.textContent = k === 'back' ? '⌫' : k;
      b.setAttribute('aria-label',k==='back'?'Delete letter':k==='enter'?'Submit guess':k.toUpperCase());
      b.onclick = () => press(k);
      row.append(b);
    }
    $('keyboard').append(row);
  }
}

// ---- typing and guessing
function press(k) {
  const b = board();
  if (!playing || busy || b.done || document.querySelector('dialog[open]')) return;
  if (k === 'back') current = current.slice(0, -1);
  else if (k === 'enter') return submit();
  else if (/^[a-z]$/.test(k) && current.length < L().letters) current += k;
  draw();
}
function shake(msg) {
  toast(msg);
  const rows = $('board').children;
  const row = rows[board().rows.length];
  row?.classList.add('shake');
  setTimeout(() => row?.classList.remove('shake'), 400);
}
async function submit() {
  const b = board();
  const { letters, tries } = L();
  if (current.length < letters) return shake('Not enough letters');
  if (!isWord(words, current)) return shake('Not in the word list');
  if (S.clueRule) {
    const why = clueBreak(current, b.rows);
    if (why) return shake(why);
  }
  const marks = score(current, answer());
  b.rows.push({ word: current, marks });
  current = '';
  busy = true;
  draw();
  const tiles = $('board').children[b.rows.length - 1].children;
  [...tiles].forEach((t, i) => {
    t.style.animationDelay = `${i * 90}ms`;
    t.classList.add('flip');
  });
  await new Promise((r) => setTimeout(r, 90 * letters + 400));
  busy = false;
  const won = marks.every((m) => m === 'hit');
  if (won || b.rows.length >= tries + b.extra) finish(won);
  else {save();draw();}
}
function finish(won) {
  const b = board();
  b.done = true;
  b.won = won;
  S.stats[S.level] = record(S.stats[S.level], { day, won, tries: b.rows.length });
  save();
  draw();
  if (won) toast(['Genius', 'Brilliant', 'Great', 'Nice', 'Phew', 'Just'][Math.min(5, b.rows.length - 1)]);
  const finishedLevel=S.level;
  setTimeout(() => {if(playing&&S.level===finishedLevel&&!document.querySelector('dialog[open]'))showResult(true)}, won ? 900 : 300);
}

// ---- result, stats, share
function showResult(fresh) {
  const b = board();
  const st = S.stats[S.level] || { played: 0, won: 0, streak: 0, best: 0, dist: {} };
  $('resultTitle').textContent = !b.done ? `${L().name} statistics` : b.won ? `Solved in ${b.rows.length}` : 'Not today';
  $('resultWord').textContent = b.done ? answer() : '';
  $('stats').innerHTML = [
    [st.played, 'Played'],
    [st.played ? Math.round((st.won / st.played) * 100) : 0, 'Win %'],
    [st.streak, 'Streak'],
    [st.best, 'Best'],
  ]
    .map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`)
    .join('');
  const max = Math.max(1, ...Object.values(st.dist || {}));
  $('dist').innerHTML = Array.from({ length: L().tries }, (_, i) => i + 1)
    .map((n) => `<div>${n}<i class="${b.won && b.rows.length === n ? 'now' : ''}" style="width:${Math.max(8, ((st.dist?.[n] || 0) / max) * 100)}%">${st.dist?.[n] || 0}</i></div>`)
    .join('');
  $('share').classList.toggle('hidden', !b.done);
  $('result').showModal();
  if (fresh && b.done) setTimeout(() => maybeInterstitial().catch((e) => console.warn('Interstitial not shown:', e?.message || e)), 1500);
}
function tick() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const ms = next - now;
  $('nextIn').textContent = `Next words in ${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  if (dayNumber() !== day) {
    day = dayNumber();
    current = '';
    draw();
  }
}
$('share').onclick = async () => {
  const b = board();
  const text = shareText(S.level, day, b.rows.map((r) => r.marks), b.won) ;
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard');
    }
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Could not share: ' + e.message);
  }
};
$('closeResult').onclick = () => $('result').close();
$('statsBtn').onclick = () => showResult(false);
$('helpBtn').onclick = () => $('help').showModal();
$('closeHelp').onclick = () => {
  S.seenHelp = true;
  save();
  $('help').close();
};
$('settingsBtn').onclick = () => {
  $('clueRule').checked = S.clueRule;
  $('settings').showModal();
};
$('clueRule').onchange = () => {
  if (board().rows.length && !board().done) {
    $('clueRule').checked = S.clueRule;
    return toast('Change it before your first guess');
  }
  S.clueRule = $('clueRule').checked;
  save();
};
$('closeSettings').onclick = () => $('settings').close();
$('playFiver').onclick=()=>{
  playing=true;document.body.dataset.view='play';
  document.documentElement.requestFullscreen?.().catch(()=>{});
  draw();
};
$('homeBtn').onclick=()=>{if(busy)return;playing=false;document.body.dataset.view='menu';};
$('menuHelp').onclick=()=>$('help').showModal();
$('menuSettings').onclick=()=>$('settingsBtn').click();
for (const btn of document.querySelectorAll('#levels button'))
  btn.onclick = () => {
    if(busy)return;
    S.level = btn.dataset.level;
    current = '';
    save();
    draw();
  };
addEventListener('keydown', (e) => {
  if (!playing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('dialog[open]')) return;
  if(e.key==='Enter'||e.key==='Backspace'||/^[a-zA-Z]$/.test(e.key))e.preventDefault();
  if (e.key === 'Enter') press('enter');
  else if (e.key === 'Backspace') press('back');
  else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
});
addEventListener('resize', draw);
new ResizeObserver(()=>draw()).observe($('board').parentElement);

buildKeyboard();
draw();
setInterval(tick, 30000);
tick();
// Ryan: "fiver doesnt need anything pay to win": no extra tries, just a banner
initAds()
  .then(() => showBanner())
  .catch((e) => console.warn('Ads unavailable:', e?.message || e));
// Help is available on the main menu and in play; no modal blocks first entry.
