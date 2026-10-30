// Lecture des chansons collées par l'utilisatrice.
//
// SOURCE : écrit pour ce projet. Formats pris en charge :
//   - ChordPro (format ouvert, spécification : https://www.chordpro.org/chordpro/)
//     ex. « [C]Au clair de la [G]lune », directives {title:}, {artist:}, {comment:}
//   - « accords au-dessus des paroles », le format des sites d'accords
//     (ligne d'accords puis ligne de paroles, alignées par colonne)

import { isChord } from './chords.js';

const NON_CHORD_OK = /^(\||\/|-|x\d+|\(x\d+\)|\d+x|N\.?C\.?|%|\.+|:?\|\|?:?)$/i;

function isChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  let n = 0;
  for (const t of tokens) {
    const clean = t.replace(/^\(|\)$/g, '');
    if (isChord(clean)) n++;
    else if (!NON_CHORD_OK.test(t)) return false;
  }
  return n > 0;
}

function chordPositions(line) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line))) {
    const clean = m[0].replace(/^\(|\)$/g, '');
    if (isChord(clean)) out.push({ col: m.index, chord: clean });
  }
  return out;
}

function mergeChordsLyrics(chordLine, lyric) {
  const pos = chordPositions(chordLine);
  const segs = [];
  if (pos[0].col > 0) segs.push({ chord: null, text: lyric.slice(0, pos[0].col) });
  pos.forEach((p, i) => {
    const end = i + 1 < pos.length ? pos[i + 1].col : undefined;
    let text = lyric.slice(p.col, end);
    if (!text) text = ' ';
    segs.push({ chord: p.chord, text });
  });
  if (segs[0] && segs[0].chord === null && !segs[0].text.trim()) segs.shift();
  return segs;
}

function parseChordProLine(line) {
  const segs = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let cur = { chord: null, text: '' };
  let m;
  while ((m = re.exec(line))) {
    cur.text += line.slice(last, m.index);
    if (cur.chord || cur.text) segs.push(cur);
    cur = { chord: m[1].trim(), text: '' };
    last = re.lastIndex;
  }
  cur.text += line.slice(last);
  if (cur.chord || cur.text) segs.push(cur);
  return segs;
}

const SECTION = /^\s*\[([^\]]+)\]\s*:?\s*$/;
const SECTION_WORDS = /^\s*(couplet|refrain|pont|intro|outro|verse|chorus|bridge|pre-?chorus|solo|fin|coda|interlude)\b.*:?\s*$/i;

export function parseSong(text) {
  const song = { title: '', artist: '', lines: [] };
  const raw = (text || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    const t = line.trim();
    if (!t) { song.lines.push({ type: 'empty' }); continue; }

    const dir = t.match(/^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i);
    if (dir) {
      const key = dir[1].toLowerCase();
      const val = dir[2] || '';
      if (key === 'title' || key === 't') song.title = val;
      else if (['artist', 'subtitle', 'st', 'composer'].includes(key)) song.artist = song.artist || val;
      else if (['comment', 'c', 'ci', 'comment_italic'].includes(key)) song.lines.push({ type: 'label', text: val });
      else if (['soc', 'start_of_chorus'].includes(key)) song.lines.push({ type: 'label', text: val || 'Refrain' });
      else if (['sov', 'start_of_verse'].includes(key) && val) song.lines.push({ type: 'label', text: val });
      continue;
    }

    const sec = t.match(SECTION);
    if (sec && !isChord(sec[1].trim())) { song.lines.push({ type: 'label', text: sec[1].trim() }); continue; }

    // ChordPro : [Accord] dans le texte
    if (/\[[^\]]+\]/.test(line) && [...line.matchAll(/\[([^\]]+)\]/g)].every((m) => isChord(m[1].trim()))) {
      song.lines.push({ type: 'lyrics', segs: parseChordProLine(line) });
      continue;
    }

    if (isChordLine(line)) {
      const next = raw[i + 1];
      if (next !== undefined && next.trim() && !isChordLine(next) && !SECTION.test(next) && !/^\{/.test(next.trim()) && !/\[[^\]]+\]/.test(next)) {
        song.lines.push({ type: 'lyrics', segs: mergeChordsLyrics(line, next) });
        i++;
      } else {
        song.lines.push({ type: 'lyrics', segs: chordPositions(line).map((p) => ({ chord: p.chord, text: ' ' })) });
      }
      continue;
    }

    if (SECTION_WORDS.test(t) && t.length < 30) { song.lines.push({ type: 'label', text: t.replace(/:$/, '') }); continue; }
    song.lines.push({ type: 'lyrics', segs: [{ chord: null, text: line }] });
  }
  // supprime les lignes vides en double
  song.lines = song.lines.filter((l, i, a) => !(l.type === 'empty' && (i === 0 || a[i - 1].type === 'empty')));
  return song;
}
