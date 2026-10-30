// Interface de l'application. SOURCE : écrit pour ce projet.
import { Populele } from './ble.js';
import { shapeFor, transposeName, parseChord, LIBRARY_ROOTS, LIBRARY_SUFFIXES, frenchRoot, prettyName } from './chords.js';
import { parseSong } from './parser.js';
import { DEFAULT_SONGS } from './songs-default.js';

const $ = (s) => document.querySelector(s);
const uke = new Populele();

// ---------- Stockage ----------
const store = {
  get(key, def) { try { const v = localStorage.getItem('populele.' + key); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  set(key, val) { try { localStorage.setItem('populele.' + key, JSON.stringify(val)); } catch (e) { /* stockage indisponible */ } },
};
let songs = store.get('songs', null) || DEFAULT_SONGS.map((s) => ({ ...s }));
const saveSongs = () => store.set('songs', songs);
Object.assign(uke.settings, store.get('settings', {}));
const saveSettings = () => store.set('settings', uke.settings);

// ---------- Messages ----------
let bannerTimer;
function banner(msg, type = '') {
  const b = $('#banner');
  b.textContent = msg;
  b.className = 'banner ' + type;
  b.hidden = !msg;
  clearTimeout(bannerTimer);
  if (msg) bannerTimer = setTimeout(() => (b.hidden = true), 7000);
}

// ---------- Navigation ----------
let currentView = 'songs';
function show(view, title) {
  for (const v of document.querySelectorAll('.view')) v.hidden = v.id !== 'view-' + view;
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.view === view || (view === 'play' && t.dataset.view === 'songs') || (view === 'edit' && t.dataset.view === 'songs'));
  document.body.classList.toggle('playing', view === 'play');
  if (currentView === 'play' && view !== 'play') stopAuto();
  currentView = view;
  $('#top-title').textContent = title || { songs: 'Mes chansons', chords: 'Accords', settings: 'Réglages', edit: 'Chanson' }[view] || 'Populele';
  window.scrollTo(0, 0);
  if (view === 'songs') { renderSongList(); uke.clear(); }
  if (view === 'chords') showLibChord();
  if (view === 'settings') renderSettings();
}
for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => show(t.dataset.view));

// ---------- Connexion ----------
function updateConn(status, message) {
  const btn = $('#conn-btn');
  btn.className = 'conn conn-' + status;
  $('#conn-label').textContent = status === 'connected' ? 'Connecté' : status === 'connecting' ? (message || 'Connexion…') : 'Connecter';
}
uke.addEventListener('status', (e) => {
  updateConn(e.detail.status, e.detail.message);
  if (e.detail.status === 'disconnected' && e.detail.message) banner(e.detail.message, 'error');
});
uke.addEventListener('log', () => { if (currentView === 'settings') $('#log').textContent = uke.log.join('\n'); });

async function doConnect(showAll) {
  if (!Populele.isSupported()) {
    banner('Le Bluetooth n’est pas disponible ici. Sur iPhone, ouvre cette page dans l’app gratuite « Bluefy ».', 'error');
    return;
  }
  try {
    await uke.connect({ showAll });
    banner('Populele connecté ✔');
    refreshLeds();
  } catch (e) {
    if (e.name === 'NotFoundError') banner('Aucun ukulélé choisi. Vérifie qu’il est allumé, ou essaie « Voir tous les appareils » dans Réglages.');
    else banner(e.message, 'error');
  }
}
$('#conn-btn').addEventListener('click', () => (uke.status === 'connected' ? show('settings') : doConnect(false)));

function refreshLeds() {
  if (currentView === 'play') lightCurrent();
  else if (currentView === 'chords') showLibChord();
}

// ---------- Schéma d'accord ----------
function diagramSVG(frets, scale = 1) {
  const w = 96 * scale, h = 134 * scale;
  const left = 18 * scale, top = 22 * scale, gapX = 20 * scale, gapY = 18 * scale, n = 5;
  const fretted = frets.filter((f) => f > 0);
  const max = fretted.length ? Math.max(...fretted) : 0;
  const base = max <= n ? 1 : Math.min(...fretted);
  let s = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">`;
  const stroke = '#2b2420';
  if (base === 1) s += `<rect x="${left - 1}" y="${top - 4 * scale}" width="${gapX * 3 + 2}" height="${4 * scale}" fill="${stroke}"/>`;
  else s += `<text x="${left - 6 * scale}" y="${top + gapY * 0.65}" font-size="${11 * scale}" text-anchor="end" fill="${stroke}">${base}</text>`;
  for (let i = 0; i <= n; i++) s += `<line x1="${left}" x2="${left + gapX * 3}" y1="${top + i * gapY}" y2="${top + i * gapY}" stroke="${stroke}" stroke-width="1"/>`;
  for (let i = 0; i < 4; i++) s += `<line x1="${left + i * gapX}" x2="${left + i * gapX}" y1="${top}" y2="${top + n * gapY}" stroke="${stroke}" stroke-width="1.2"/>`;
  frets.forEach((f, i) => {
    const x = left + i * gapX;
    if (f === 0) s += `<circle cx="${x}" cy="${top - 11 * scale}" r="${4 * scale}" fill="none" stroke="${stroke}" stroke-width="1.3"/>`;
    else if (f < 0) s += `<text x="${x}" y="${top - 7 * scale}" font-size="${11 * scale}" text-anchor="middle">×</text>`;
    else s += `<circle cx="${x}" cy="${top + (f - base + 0.5) * gapY}" r="${6.5 * scale}" fill="#c2410c"/>`;
  });
  ['G', 'C', 'E', 'A'].forEach((l, i) => (s += `<text x="${left + i * gapX}" y="${top + n * gapY + 14 * scale}" font-size="${10 * scale}" text-anchor="middle" fill="#7a6e66">${l}</text>`));
  return s + '</svg>';
}

// ---------- Liste ----------
function chordsInSong(song) {
  const p = parseSong(song.text);
  const set = [];
  for (const l of p.lines) for (const sg of l.segs || []) if (sg.chord && !set.includes(prettyName(sg.chord))) set.push(prettyName(sg.chord));
  return set;
}
function renderSongList() {
  const q = $('#song-search').value.trim().toLowerCase();
  const ul = $('#song-list');
  ul.innerHTML = '';
  const list = songs
    .filter((s) => !q || (s.title + ' ' + (s.artist || '')).toLowerCase().includes(q))
    .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  if (!list.length) { ul.innerHTML = '<li class="empty">Aucune chanson. Ajoute-en une !</li>'; return; }
  for (const s of list) {
    const li = document.createElement('li');
    li.innerHTML = `<div class="t"></div><div class="a"></div><div class="c"></div>`;
    li.querySelector('.t').textContent = s.title || 'Sans titre';
    li.querySelector('.a').textContent = s.artist || '';
    li.querySelector('.c').textContent = chordsInSong(s).join(' · ');
    li.addEventListener('click', () => openSong(s.id));
    ul.appendChild(li);
  }
}
$('#song-search').addEventListener('input', renderSongList);

// ---------- Édition ----------
let editingId = null;
function editSong(id) {
  editingId = id;
  const s = songs.find((x) => x.id === id) || { title: '', artist: '', text: '' };
  $('#edit-title').value = s.title;
  $('#edit-artist').value = s.artist || '';
  $('#edit-text').value = s.text;
  $('#edit-delete').hidden = !id;
  show('edit', id ? 'Modifier' : 'Nouvelle chanson');
}
$('#add-song').addEventListener('click', () => editSong(null));
$('#edit-cancel').addEventListener('click', () => (editingId ? openSong(editingId) : show('songs')));
$('#edit-save').addEventListener('click', () => {
  const text = $('#edit-text').value;
  const parsed = parseSong(text);
  const title = $('#edit-title').value.trim() || parsed.title || 'Sans titre';
  const artist = $('#edit-artist').value.trim() || parsed.artist || '';
  const nbChords = parsed.lines.reduce((n, l) => n + (l.segs || []).filter((x) => x.chord).length, 0);
  if (!nbChords) { banner('Je ne trouve aucun accord dans ce texte. Vérifie que les accords sont bien sur leur propre ligne ou entre crochets [C].', 'error'); return; }
  if (editingId) Object.assign(songs.find((x) => x.id === editingId), { title, artist, text });
  else { editingId = 's' + Date.now(); songs.push({ id: editingId, title, artist, text, bpm: 90, beats: 4, transpose: 0 }); }
  saveSongs();
  openSong(editingId);
});
$('#edit-delete').addEventListener('click', () => {
  if (!editingId || !confirm('Supprimer cette chanson ?')) return;
  songs = songs.filter((x) => x.id !== editingId);
  saveSongs();
  show('songs');
});

// ---------- Lecture ----------
let song = null, events = [], cur = 0;
function openSong(id) {
  song = songs.find((x) => x.id === id);
  if (!song) return show('songs');
  song.bpm = song.bpm || 90; song.beats = song.beats || 4; song.transpose = song.transpose || 0;
  cur = 0;
  renderPlay();
  show('play', song.title);
  lightCurrent();
}
function renderPlay() {
  const parsed = parseSong(song.text);
  const box = $('#lyrics');
  box.innerHTML = '';
  events = [];
  for (const l of parsed.lines) {
    if (l.type === 'empty') { box.insertAdjacentHTML('beforeend', '<div class="gap"></div>'); continue; }
    if (l.type === 'label') { const d = document.createElement('div'); d.className = 'label'; d.textContent = l.text; box.appendChild(d); continue; }
    const line = document.createElement('div');
    line.className = 'line';
    // Le premier mot reste collé à son accord ; les mots suivants sont séparés
    // pour que la ligne puisse revenir à la ligne entre les mots.
    const pieces = [];
    for (const sg of l.segs) {
      const words = (sg.text || '').match(/\s*\S+\s*|\s+/g) || [''];
      pieces.push({ chord: sg.chord, text: words[0] });
      for (const w of words.slice(1)) pieces.push({ chord: null, text: w });
    }
    for (const sg of pieces) {
      const seg = document.createElement('span');
      seg.className = 'seg';
      const ch = document.createElement('span');
      ch.className = 'ch';
      const tx = document.createElement('span');
      tx.className = 'tx';
      tx.textContent = sg.text || '';
      if (sg.chord) {
        const name = transposeName(sg.chord, song.transpose);
        ch.textContent = prettyName(name);
        const idx = events.length;
        events.push({ name, el: ch });
        ch.addEventListener('click', () => { cur = idx; lightCurrent(); resetBeat(); });
      }
      seg.append(ch, tx);
      line.appendChild(seg);
    }
    box.appendChild(line);
  }
  $('#tr-val').textContent = (song.transpose > 0 ? '+' : '') + song.transpose;
  $('#bpm-val').textContent = song.bpm;
  $('#beats-val').textContent = song.beats;
  renderBeatDots();
}
function lightCurrent() {
  if (!events.length) return;
  cur = Math.max(0, Math.min(cur, events.length - 1));
  events.forEach((e, i) => { e.el.classList.toggle('cur', i === cur); e.el.classList.toggle('done', i < cur); });
  const e = events[cur];
  const sh = shapeFor(e.name);
  $('#cur-name').textContent = prettyName(e.name);
  $('#cur-diagram').innerHTML = sh ? diagramSVG(sh.frets, 0.9) : '<span class="hint">doigté inconnu</span>';
  const nx = events[cur + 1];
  const nsh = nx && shapeFor(nx.name);
  $('#next-name').textContent = nx ? prettyName(nx.name) : 'fin';
  $('#next-diagram').innerHTML = nsh ? diagramSVG(nsh.frets, 0.55) : '';
  if (sh) uke.showFrets(sh.frets); else uke.clear();
  const r = e.el.getBoundingClientRect();
  const nowH = $('.now').getBoundingClientRect().bottom;
  if (r.top < nowH + 10 || r.bottom > window.innerHeight - 170) window.scrollBy({ top: r.top - nowH - 60, behavior: 'smooth' });
}
const step = (d) => { if (!events.length) return; cur = Math.max(0, Math.min(events.length - 1, cur + d)); lightCurrent(); };
$('#next').addEventListener('click', () => { step(1); resetBeat(); });
$('#prev').addEventListener('click', () => { step(-1); resetBeat(); });
function adjust(field, d, min, max) { song[field] = Math.max(min, Math.min(max, song[field] + d)); saveSongs(); }
$('#tr-up').addEventListener('click', () => { adjust('transpose', 1, -11, 11); renderPlay(); lightCurrent(); });
$('#tr-down').addEventListener('click', () => { adjust('transpose', -1, -11, 11); renderPlay(); lightCurrent(); });
$('#bpm-up').addEventListener('click', () => { adjust('bpm', 5, 30, 220); $('#bpm-val').textContent = song.bpm; restartTimer(); });
$('#bpm-down').addEventListener('click', () => { adjust('bpm', -5, 30, 220); $('#bpm-val').textContent = song.bpm; restartTimer(); });
$('#beats-up').addEventListener('click', () => { adjust('beats', 1, 1, 16); $('#beats-val').textContent = song.beats; renderBeatDots(); });
$('#beats-down').addEventListener('click', () => { adjust('beats', -1, 1, 16); $('#beats-val').textContent = song.beats; renderBeatDots(); });
$('#play-edit').addEventListener('click', () => editSong(song.id));
$('#click-on').checked = !!store.get('click', false);
$('#click-on').addEventListener('change', (e) => store.set('click', e.target.checked));

// Défilement automatique + métronome
let timer = null, beat = 0, audio = null, wakeLock = null;
function renderBeatDots() {
  const d = $('#beat-dots');
  d.innerHTML = timer ? '<span></span>'.repeat(song.beats) : '';
}
function tick() {
  const dots = $('#beat-dots').children;
  if (beat >= song.beats) {
    beat = 0;
    if (cur >= events.length - 1) { stopAuto(); return; }
    step(1);
  }
  [...dots].forEach((x, i) => x.classList.toggle('on', i === beat));
  if ($('#click-on').checked && audio) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = beat === 0 ? 1200 : 800;
    g.gain.setValueAtTime(0.25, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.06);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.07);
  }
  beat++;
}
function resetBeat() { beat = 0; if (timer) restartTimer(); }
function restartTimer() { if (!timer) return; clearInterval(timer); timer = setInterval(tick, 60000 / song.bpm); }
async function startAuto() {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch (e) { audio = null; }
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch (e) { wakeLock = null; }
  beat = 0;
  timer = setInterval(tick, 60000 / song.bpm);
  renderBeatDots();
  tick();
  $('#auto').classList.add('on');
  $('#auto').textContent = '⏸ Pause';
}
function stopAuto() {
  clearInterval(timer); timer = null;
  try { wakeLock?.release(); } catch (e) { /* rien */ }
  wakeLock = null;
  $('#auto').classList.remove('on');
  $('#auto').textContent = '▶ Auto';
  if (song) renderBeatDots();
}
$('#auto').addEventListener('click', () => (timer ? stopAuto() : startAuto()));

// ---------- Bibliothèque d'accords ----------
let libRoot = 'C', libSuffix = '';
function renderPickers() {
  const rp = $('#root-picker'), sp = $('#suffix-picker');
  rp.innerHTML = ''; sp.innerHTML = '';
  for (const r of LIBRARY_ROOTS) {
    const b = document.createElement('button');
    b.innerHTML = `${r}<small>${frenchRoot(r)}</small>`;
    b.classList.toggle('sel', r === libRoot);
    b.addEventListener('click', () => { libRoot = r; renderPickers(); showLibChord(); });
    rp.appendChild(b);
  }
  const labels = { '': 'majeur', m: 'mineur', 7: '7', m7: 'm7', maj7: 'maj7', 6: '6', sus2: 'sus2', sus4: 'sus4', dim: 'dim', aug: 'aug', 9: '9', add9: 'add9' };
  for (const s of LIBRARY_SUFFIXES) {
    const b = document.createElement('button');
    b.textContent = labels[s] ?? s;
    b.classList.toggle('sel', s === libSuffix);
    b.addEventListener('click', () => { libSuffix = s; renderPickers(); showLibChord(); });
    sp.appendChild(b);
  }
}
function showLibChord() {
  const name = libRoot + libSuffix;
  const sh = shapeFor(name);
  const c = parseChord(name);
  $('#lib-name').textContent = prettyName(name) + '  ·  ' + frenchRoot(libRoot) + (c.suffix === 'm' ? 'm' : c.suffix);
  $('#lib-diagram').innerHTML = sh ? diagramSVG(sh.frets, 1.25) : '';
  if (sh) uke.showFrets(sh.frets);
}
renderPickers();

// ---------- Réglages ----------
function renderSettings() {
  $('#off-val').textContent = uke.settings.fretOffset;
  $('#rev-strings').checked = uke.settings.reverseStrings;
  $('#rev-frets').checked = uke.settings.reverseFrets;
  $('#log').textContent = uke.log.join('\n') || '(vide)';
}
$('#s-connect').addEventListener('click', () => doConnect(false));
$('#s-connect-all').addEventListener('click', () => doConnect(true));
$('#s-disconnect').addEventListener('click', () => uke.disconnect());
let walkTimer = null;
const stopWalk = () => { clearInterval(walkTimer); walkTimer = null; };
$('#t-all').addEventListener('click', () => { stopWalk(); const l = []; for (let s = 0; s < 4; s++) for (let f = 0; f < 18; f++) l.push({ string: s, led: f }); uke.showLeds(l); });
$('#t-off').addEventListener('click', () => { stopWalk(); uke.clear(); });
$('#t-c').addEventListener('click', () => { stopWalk(); uke.showFrets(shapeFor('C').frets); });
$('#t-walk').addEventListener('click', () => {
  stopWalk();
  let f = 1;
  walkTimer = setInterval(() => {
    if (f > 18) { stopWalk(); uke.clear(); return; }
    uke.showFrets([f, f, f, f]);
    f++;
  }, 400);
});
$('#off-up').addEventListener('click', () => { uke.settings.fretOffset = Math.min(3, uke.settings.fretOffset + 1); saveSettings(); renderSettings(); uke.showFrets(shapeFor('C').frets); });
$('#off-down').addEventListener('click', () => { uke.settings.fretOffset = Math.max(-3, uke.settings.fretOffset - 1); saveSettings(); renderSettings(); uke.showFrets(shapeFor('C').frets); });
$('#rev-strings').addEventListener('change', (e) => { uke.settings.reverseStrings = e.target.checked; saveSettings(); uke.showFrets(shapeFor('C').frets); });
$('#rev-frets').addEventListener('change', (e) => { uke.settings.reverseFrets = e.target.checked; saveSettings(); uke.showFrets(shapeFor('C').frets); });

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) { prompt('Copie ce texte :', t); return false; }
}
$('#copy-log').addEventListener('click', async () => { if (await copyText(uke.log.join('\n'))) banner('Journal copié'); });
$('#export').addEventListener('click', async () => { if (await copyText(JSON.stringify(songs))) banner('Chansons copiées : colle-les dans une note ou un e-mail pour les garder.'); });
$('#import').addEventListener('click', () => {
  const t = prompt('Colle ici la sauvegarde de tes chansons :');
  if (!t) return;
  try {
    const list = JSON.parse(t);
    if (!Array.isArray(list)) throw new Error();
    let added = 0;
    for (const s of list) if (s && s.text && !songs.some((x) => x.id === s.id)) { songs.push(s); added++; }
    saveSongs();
    banner(added + ' chanson(s) restaurée(s)');
  } catch (e) { banner('Ce texte n’est pas une sauvegarde valide.', 'error'); }
});
$('#reset-demo').addEventListener('click', () => {
  for (const d of DEFAULT_SONGS) if (!songs.some((x) => x.id === d.id)) songs.push({ ...d });
  saveSongs();
  banner('Exemples remis');
});

// ---------- Démarrage ----------
if (!Populele.isSupported()) banner('Pour allumer le ukulélé depuis un iPhone, ouvre cette page dans l’app gratuite « Bluefy ». Les chansons restent consultables ici.');
show('songs');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
