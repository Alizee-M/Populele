# Populele – mes chansons

Petite application web pour le **Populele 1** (ukulélé connecté à 72 LEDs), qui remplace l'app PopuMusic.
Elle permet de jouer **n'importe quelle chanson** : on colle les accords et paroles copiés depuis un site, et les
doigtés s'allument sur le manche au fil de la chanson.

👉 **Adresse de l'app : https://alizee-m.github.io/Populele/**

## Utilisation sur iPhone

Safari et Chrome sur iPhone ne donnent pas accès au Bluetooth aux sites web. Il faut passer par **Bluefy**
(navigateur gratuit sur l'App Store, qui ajoute le Web Bluetooth).

1. Installer **Bluefy – Web BLE Browser** depuis l'App Store.
2. Fermer complètement l'app PopuMusic (sinon elle garde la connexion).
3. Allumer le Populele (appui long 4–5 s sur le bouton).
4. Dans Bluefy, ouvrir l'adresse ci-dessus, puis toucher **Connecter** et choisir le ukulélé.
   Si la liste est vide : Réglages › **Voir tous les appareils**.
5. Premier essai : Réglages › **Accord de Do (C)**. Seule la 3ᵉ case de la corde de La (la plus aiguë, en bas)
   doit s'allumer. Si ce n'est pas le cas, ajuster le **Calibrage**.

Sur Android, l'app marche directement dans Chrome.

## Fonctions

- **Chansons** : ajout par copier-coller, deux formats reconnus :
  - accords au-dessus des paroles (format des sites d'accords) ;
  - ChordPro : `[C]Au clair de la [G]lune`.
  - Les accords en notation française (Do, Ré, Lam, Sib7…) sont reconnus.
- **Lecture** : l'accord en cours s'allume sur le manche, avec le schéma à l'écran et l'accord suivant.
  Bouton « Suivant », ou défilement **Auto** au tempo choisi (avec bip de métronome en option).
  Changement de tonalité (transposition) et toucher un accord dans les paroles pour y sauter.
- **Accords** : bibliothèque des 12 notes × 12 types d'accords, allumés sur le manche.
- **Réglages** : connexion, tests des LEDs, calibrage, sauvegarde/restauration des chansons, journal Bluetooth.

Les chansons sont enregistrées dans le navigateur du téléphone (pensez à faire « Sauvegarder » de temps en temps).

## Sources et crédits

| Élément | Source | Utilisation |
|---|---|---|
| Protocole Bluetooth des LEDs (trame `F1` + 4×3 octets + 6 octets, caractéristique `0000dc86-…`, ordre des cordes G C E A, puce Dialog DA14580 / service `fef5`) | [serdrad0x/Hackulele](https://github.com/serdrad0x/Hackulele) — fichiers `ABOUT.md` (section *Bluetooth data*) et `bluez.py`, commit `880859c` (avril 2019), licence **Apache 2.0** | Protocole réimplémenté en JavaScript dans `js/ble.js` ; aucun code copié |
| Format ChordPro | [Spécification ChordPro](https://www.chordpro.org/chordpro/) (format ouvert) | Lecture des directives `{title:}`, `{artist:}`, `{comment:}` et des accords `[C]` dans `js/parser.js` |
| Web Bluetooth | [Spécification W3C Web Bluetooth](https://webbluetoothcg.github.io/web-bluetooth/) | API utilisée dans `js/ble.js` |
| Bluefy | [Bluefy – Web BLE Browser](https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055) (App Store) | Navigateur conseillé sur iPhone (non inclus) |
| Doigtés d'accords | Positions usuelles du ukulélé + algorithme de recherche écrit pour ce projet | `js/chords.js`, vérifiés par `tests/run.mjs` |
| Chansons d'exemple | Comptines traditionnelles françaises, domaine public ; accords écrits pour ce projet | `js/songs-default.js` |

Tout le reste du code (interface, parseur, métronome) a été écrit pour ce projet.

## Développement

Aucune dépendance, aucun build : ce sont des fichiers statiques.

```bash
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
node tests/run.mjs            # tests : doigtés, trames Bluetooth, parseur
```

Fichiers :
- `js/ble.js` – connexion Bluetooth et construction des trames LED
- `js/chords.js` – reconnaissance des noms d'accords et doigtés
- `js/parser.js` – lecture des chansons collées
- `js/app.js` – interface
- `sw.js` – cache hors-ligne

## Limites connues

- Testé uniquement avec un faux appareil Bluetooth : le premier essai sur le vrai Populele peut demander un
  ajustement du calibrage. En cas de souci de connexion, copier le **journal Bluetooth** (Réglages) et l'ouvrir en issue.
- Les LEDs ne gèrent que allumé/éteint (pas de luminosité) via Bluetooth.
- Le Populele 2 (56 LEDs) utilise probablement un autre protocole et n'est pas pris en charge.
