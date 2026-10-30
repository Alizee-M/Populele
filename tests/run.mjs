// Tests sans dépendance : node tests/run.mjs
import { parseChord, shapeFor, notesOf, NOTES, LIBRARY_ROOTS, LIBRARY_SUFFIXES, transposeName } from '../js/chords.js';
import { Populele } from '../js/ble.js';
import { parseSong } from '../js/parser.js';
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('ÉCHEC', m); } };

// Chaque doigté joue uniquement des notes de l'accord et contient la fondamentale
for (const r of LIBRARY_ROOTS) for (const s of LIBRARY_SUFFIXES) {
  const name = r + s, c = parseChord(name), sh = shapeFor(name);
  ok(c && sh, 'pas de doigté pour ' + name);
  if (!sh) continue;
  const pcs = c.intervals.map((i) => (NOTES.indexOf(c.root) + i) % 12);
  const played = notesOf(sh.frets);
  ok(played.every((p) => pcs.includes(p)), name + ' joue une fausse note ' + sh.frets);
  ok(played.includes(NOTES.indexOf(c.root)), name + ' sans fondamentale ' + sh.frets);
}
ok(shapeFor('C').frets.join('') === '0003', 'C');
ok(shapeFor('Lam').frets.join('') === '2000', 'Lam');
ok(shapeFor('Sib').frets.join('') === '3211', 'Sib');
ok(shapeFor('Ré m').frets.join('') === '2210', 'Ré m');
ok(parseChord('la') === null, '"la" minuscule n\'est pas un accord');
ok(parseChord('Hello') === null, 'Hello');
ok(parseChord('G/B').bass === 'B', 'G/B');
ok(transposeName('Am', 2) === 'Bm', 'transpose');

// Trame : C (0003) -> A string case 3 -> LED 2 -> bit 21
const p = new Populele();
const f = Populele.buildFrame(p.ledsForFrets([0, 0, 0, 3]));
ok(f.length === 19 && f[0] === 0xf1, 'en-tête');
ok([...f].map((b) => b.toString(16).padStart(2, '0')).join(' ') === 'f1 00 00 00 00 00 00 00 00 00 20 00 00 00 00 00 00 00 00', 'trame C : ' + [...f].map((b) => b.toString(16)).join(' '));
const g = Populele.buildFrame([{ string: 0, led: 17 }]);
ok(g[1] === 0 && g[2] === 0 && g[3] === 0x40, 'LED 17');

// Parseur
const s1 = parseSong('{title: Test}\n[C]Au clair de la [G]lune\n\n[Refrain]\nAm      F\nmon ami Pierrot');
ok(s1.title === 'Test', 'titre chordpro');
const chords1 = s1.lines.flatMap((l) => (l.segs || []).map((x) => x.chord).filter(Boolean));
ok(chords1.join(' ') === 'C G Am F', 'accords : ' + chords1.join(' '));
ok(s1.lines.some((l) => l.type === 'label' && l.text === 'Refrain'), 'section');
const seg = s1.lines.find((l) => l.segs && l.segs[0].chord === 'Am').segs;
ok(seg[0].text === 'mon ami ' && seg[1].text === 'Pierrot', 'alignement : ' + JSON.stringify(seg));
const s2 = parseSong('la la la\nC G\n');
ok(s2.lines[0].segs.length === 1 && !s2.lines[0].segs[0].chord, 'paroles en minuscules');
console.log(fail ? fail + ' échec(s)' : 'Tous les tests passent');
process.exit(fail ? 1 : 0);
