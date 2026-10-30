// Chansons d'exemple : comptines traditionnelles françaises du domaine public.
// SOURCE : paroles traditionnelles (domaine public) ; accords écrits pour ce projet.

export const DEFAULT_SONGS = [
  {
    id: 'demo-clair-lune',
    title: 'Au clair de la lune',
    artist: 'Traditionnel',
    bpm: 80,
    beats: 4,
    text: `{title: Au clair de la lune}
{artist: Traditionnel}
[C]Au clair de la [G]lune, [C]mon ami Pier[G]rot
[C]Prête-moi ta [G]plume, [C]pour écrire un [G]mot[C]
[G]Ma chandelle est [Dm]morte, [G]je n'ai plus de [C]feu
[C]Ouvre-moi ta [G]porte, [C]pour l'amour de [G]Dieu[C]`,
  },
  {
    id: 'demo-frere-jacques',
    title: 'Frère Jacques',
    artist: 'Traditionnel',
    bpm: 90,
    beats: 4,
    text: `{title: Frère Jacques}
{artist: Traditionnel}
[C]Frère Jacques, [G]frère [C]Jacques
[C]Dormez-vous ? [G]Dormez-[C]vous ?
[C]Sonnez les ma[G]tines, [C]sonnez les ma[G]tines
[C]Ding, ding, [G]dong ! [C]Ding, ding, [G]dong ![C]`,
  },
  {
    id: 'demo-claire-fontaine',
    title: 'À la claire fontaine',
    artist: 'Traditionnel',
    bpm: 85,
    beats: 3,
    text: `{title: À la claire fontaine}
{artist: Traditionnel}
{comment: Exemple au format « accords au-dessus des paroles »}
C                    G
À la claire fontaine, m'en allant promener
C                F         G       C
J'ai trouvé l'eau si belle que je m'y suis baigné

Refrain
C         F        C       G
Il y a longtemps que je t'aime
C      F      G      C
Jamais je ne t'oublierai`,
  },
];
