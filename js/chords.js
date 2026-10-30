// Dictionnaire d'accords pour ukulélé (accordage standard G C E A).
//
// SOURCE : écrit pour ce projet, pas copié d'une bibliothèque.
//   - Les doigtés de base (majeur, mineur, 7, m7, maj7) sont les positions usuelles
//     de l'ukulélé ; chacune est vérifiée automatiquement par les tests (tests/run.mjs)
//     qui recalculent les notes jouées.
//   - Les autres accords sont calculés par l'algorithme findShape() ci-dessous.

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E', 'E#': 'F', 'B#': 'C' };
const FRENCH = { do: 'C', re: 'D', ré: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' };
export const TUNING = [7, 0, 4, 9]; // G C E A

// Intervalles (demi-tons) par suffixe. Les entrées "optional" peuvent être omises
// quand l'accord a plus de notes que de cordes.
const QUALITIES = [
  [['', 'M', 'maj'], [0, 4, 7]],
  [['m', 'min', '-'], [0, 3, 7]],
  [['7'], [0, 4, 7, 10]],
  [['m7', 'min7', '-7'], [0, 3, 7, 10]],
  [['maj7', 'M7', '7M', 'Δ', 'Δ7', 'ma7'], [0, 4, 7, 11]],
  [['mmaj7', 'mM7', 'm7M', 'm(maj7)'], [0, 3, 7, 11]],
  [['6'], [0, 4, 7, 9]],
  [['m6'], [0, 3, 7, 9]],
  [['sus2', '2'], [0, 2, 7]],
  [['sus4', 'sus', '4'], [0, 5, 7]],
  [['7sus4', '7sus'], [0, 5, 7, 10]],
  [['dim', '°', 'o'], [0, 3, 6]],
  [['dim7', '°7', 'o7'], [0, 3, 6, 9]],
  [['m7b5', 'ø', 'ø7', 'm7(b5)'], [0, 3, 6, 10]],
  [['aug', '+', '5+', '#5'], [0, 4, 8]],
  [['add9', 'add2'], [0, 4, 7, 2]],
  [['madd9'], [0, 3, 7, 2]],
  [['9'], [0, 4, 10, 2, 7]],
  [['m9'], [0, 3, 10, 2, 7]],
  [['maj9', 'M9', '9M'], [0, 4, 11, 2, 7]],
  [['5'], [0, 7]],
];
const QUALITY_MAP = new Map();
for (const [names, iv] of QUALITIES) for (const n of names) QUALITY_MAP.set(n, iv);

// Doigtés usuels [G, C, E, A]
const COMMON = {
  C: { '': [0, 0, 0, 3], m: [0, 3, 3, 3], 7: [0, 0, 0, 1], m7: [3, 3, 3, 3], maj7: [0, 0, 0, 2] },
  'C#': { '': [1, 1, 1, 4], m: [1, 1, 0, 4], 7: [1, 1, 1, 2], m7: [1, 1, 0, 2], maj7: [1, 1, 1, 3] },
  D: { '': [2, 2, 2, 0], m: [2, 2, 1, 0], 7: [2, 2, 2, 3], m7: [2, 2, 1, 3], maj7: [2, 2, 2, 4] },
  'D#': { '': [0, 3, 3, 1], m: [3, 3, 2, 1], 7: [3, 3, 3, 4], m7: [3, 3, 2, 4], maj7: [3, 3, 3, 5] },
  E: { '': [1, 4, 0, 2], m: [0, 4, 3, 2], 7: [1, 2, 0, 2], m7: [0, 2, 0, 2], maj7: [1, 3, 0, 2] },
  F: { '': [2, 0, 1, 0], m: [1, 0, 1, 3], 7: [2, 3, 1, 3], m7: [1, 3, 1, 3], maj7: [2, 4, 1, 3] },
  'F#': { '': [3, 1, 2, 1], m: [2, 1, 2, 0], 7: [3, 4, 2, 4], m7: [2, 4, 2, 4], maj7: [3, 5, 2, 4] },
  G: { '': [0, 2, 3, 2], m: [0, 2, 3, 1], 7: [0, 2, 1, 2], m7: [0, 2, 1, 1], maj7: [0, 2, 2, 2] },
  'G#': { '': [5, 3, 4, 3], m: [4, 3, 4, 2], 7: [1, 3, 2, 3], m7: [1, 3, 2, 2], maj7: [1, 3, 3, 3] },
  A: { '': [2, 1, 0, 0], m: [2, 0, 0, 0], 7: [0, 1, 0, 0], m7: [0, 0, 0, 0], maj7: [1, 1, 0, 0] },
  'A#': { '': [3, 2, 1, 1], m: [3, 1, 1, 1], 7: [1, 2, 1, 1], m7: [1, 1, 1, 1], maj7: [3, 2, 1, 0] },
  B: { '': [4, 3, 2, 2], m: [4, 2, 2, 2], 7: [2, 3, 2, 2], m7: [2, 2, 2, 2], maj7: [3, 3, 2, 2] },
};
const COMMON_KEY = new Map([[[0, 4, 7], ''], [[0, 3, 7], 'm'], [[0, 4, 7, 10], '7'], [[0, 3, 7, 10], 'm7'], [[0, 4, 7, 11], 'maj7']].map(([iv, k]) => [iv.join(','), k]));

// Analyse un nom d'accord. Accepte la notation anglaise (Am7, Bb, F#m)
// et française (Lam, Sib, Do7, Ré m). Renvoie null si ce n'est pas un accord.
export function parseChord(name) {
  if (!name) return null;
  const s = name.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  if (!s) return null;
  // Notation française : majuscule obligatoire (« La », pas « la ») pour ne pas
  // confondre avec les mots des paroles. Si ça échoue (ex. « Faug »), on tente l'anglais.
  const fr = s.match(/^(Do|DO|Ré|RÉ|Re|RE|Mi|MI|Fa|FA|Sol|SOL|La|LA|Si|SI)(#|b)?/);
  if (fr) {
    const r = finishParse(FRENCH[fr[1].toLowerCase()] + (fr[2] || ''), s.slice(fr[0].length));
    if (r) return r;
  }
  const en = s.match(/^([A-G])(#|b)?/);
  if (!en) return null;
  return finishParse(en[1] + (en[2] || ''), s.slice(en[0].length));
}

function finishParse(root, rest) {
  root = FLATS[root] || root;
  if (!NOTES.includes(root)) return null;
  let bass = null;
  const slash = rest.match(/\/([A-G][#b]?|Do|Ré|Re|Mi|Fa|Sol|La|Si)([#b])?$/);
  if (slash) {
    const b = parseChord(slash[1] + (slash[2] || ''));
    if (!b) return null;
    bass = b.root;
    rest = rest.slice(0, slash.index);
  }
  const suffix = rest.replace(/^\s+/, '').replace(/^\((.*)\)$/, '$1');
  const iv = QUALITY_MAP.get(suffix);
  if (!iv) return null;
  return { root, suffix, intervals: iv, bass, name: root + suffix + (bass ? '/' + bass : '') };
}

export function isChord(token) { return parseChord(token) !== null; }

export function transposeName(name, steps) {
  const c = parseChord(name);
  if (!c || !steps) return name;
  const t = (n) => NOTES[(NOTES.indexOf(n) + steps + 120) % 12];
  // on garde les dièses ; on préfère Bb/Eb/Ab pour la lisibilité
  const pretty = (n) => ({ 'A#': 'Bb', 'D#': 'Eb', 'G#': 'Ab' }[n] || n);
  return pretty(t(c.root)) + c.suffix + (c.bass ? '/' + pretty(t(c.bass)) : '');
}

export function prettyName(name) {
  const c = parseChord(name);
  if (!c) return name;
  const pretty = (n) => ({ 'A#': 'Bb', 'D#': 'Eb', 'G#': 'Ab' }[n] || n);
  return pretty(c.root) + c.suffix + (c.bass ? '/' + pretty(c.bass) : '');
}

export function notesOf(frets) {
  return frets.map((f, i) => (f < 0 ? null : (TUNING[i] + f) % 12));
}

// Cherche un doigté jouable : toutes les notes indispensables, écart max 3 cases,
// positions basses privilégiées.
export function findShape(rootIdx, intervals) {
  const pcs = intervals.map((i) => (rootIdx + i) % 12);
  const required = new Set(pcs);
  if (pcs.length > 4) required.delete((rootIdx + 7) % 12); // on peut omettre la quinte
  if (required.size > 4) required.delete(pcs[pcs.length - 1]);
  let best = null;
  const MAX = 12;
  for (let g = 0; g <= MAX; g++) for (let c = 0; c <= MAX; c++) for (let e = 0; e <= MAX; e++) for (let a = 0; a <= MAX; a++) {
    const fr = [g, c, e, a];
    const played = fr.map((f, i) => (TUNING[i] + f) % 12);
    if (!played.every((p) => pcs.includes(p))) continue;
    if (![...required].every((r) => played.includes(r))) continue;
    const fretted = fr.filter((f) => f > 0);
    const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
    if (span > 3) continue;
    const maxF = fretted.length ? Math.max(...fretted) : 0;
    const score = maxF * 3 + span * 2 + fretted.length;
    if (!best || score < best.score) best = { frets: fr, score };
  }
  return best ? best.frets : null;
}

const cache = new Map();
// Renvoie {name, frets:[G,C,E,A]} ou null
export function shapeFor(name) {
  const c = parseChord(name);
  if (!c) return null;
  const key = c.root + '|' + c.intervals.join(',');
  if (!cache.has(key)) {
    const common = COMMON_KEY.get(c.intervals.join(','));
    const frets = common !== undefined ? COMMON[c.root][common] : findShape(NOTES.indexOf(c.root), c.intervals);
    cache.set(key, frets);
  }
  const frets = cache.get(key);
  return frets ? { name: prettyName(name), frets } : null;
}

export const LIBRARY_SUFFIXES = ['', 'm', '7', 'm7', 'maj7', '6', 'sus2', 'sus4', 'dim', 'aug', '9', 'add9'];
export const LIBRARY_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const FR_NAMES = { C: 'Do', 'C#': 'Do#', D: 'Ré', Eb: 'Mib', E: 'Mi', F: 'Fa', 'F#': 'Fa#', G: 'Sol', Ab: 'Lab', A: 'La', Bb: 'Sib', B: 'Si' };
export function frenchRoot(r) { return FR_NAMES[r] || r; }
