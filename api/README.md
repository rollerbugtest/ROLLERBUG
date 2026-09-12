# Les données du club

Ce dossier contient **tout le contenu modifiable** du club.

Le site web **et** l'application mobile (iPhone + Android) lisent ces mêmes
fichiers. Modifier un fichier ici met donc à jour les trois en même temps,
sans republier l'application et sans passer par Apple ou Google.

---

## Quel fichier pour quoi

| Fichier | Ce qu'il contient | Où ça s'affiche |
| --- | --- | --- |
| `planning.json` | Tous les créneaux de la semaine + la note de bas de page | Site : Planning · App : onglet Planning et accueil |
| `teams.json` | Équipes hockey, encadrement, philosophie de formation | Site : Hockey · App : onglet Hockey, fiches équipe |
| `news.json` | Actualités et rendez-vous récurrents | Site : Actualités · App : accueil et liste Actualités |
| `events.json` | Événements datés (portes ouvertes, reprise…) | App : carte « Prochain événement » |
| `matches.json` | Matchs et résultats | App : onglet Matchs, fiches équipe |
| `inscriptions.json` | Saison, tarifs, conditions, dossiers PDF, dates de rentrée | Site : Inscriptions · App : page Inscriptions |
| `club.json` | Adresse, téléphone, email, réseaux sociaux, histoire, chiffres, infrastructures | Site : Le Club et Contact · App : onglet Club et page Contact |
| `bureau.json` | Membres du bureau | Site : Le Bureau · App : page Le bureau |
| `disciplines.json` | Les 7 disciplines et leurs tarifs | Site : Disciplines · App : page Disciplines |

---

## Comment modifier un fichier

### Tant que le site est sur l'ordinateur (pas encore en ligne)

1. Ouvrez le fichier (par exemple `api/planning.json`) avec un éditeur de
   texte — le Bloc-notes suffit, Notepad++ ou VS Code sont plus confortables.
2. Modifiez, enregistrez, rechargez la page du site : le changement est là.
3. Pour que l'application mobile parte avec le même contenu au prochain
   build, lancez dans le dossier `roller-bug-app` :

   ```bash
   npm run sync:data
   ```

   (Le mode d'emploi complet est dans le `README.md` de l'application, §16.)

### Une fois le site publié sur GitHub

1. Sur GitHub, ouvrez le fichier (par exemple `api/planning.json`).
2. Cliquez sur le **crayon** en haut à droite.
3. Modifiez ce que vous voulez.
4. En bas, cliquez sur **Commit changes**.
5. Attendez **1 à 2 minutes** : GitHub republie le site automatiquement.
6. Rechargez le site, et rouvrez l'application (ou tirez vers le bas pour
   rafraîchir). Le changement est là.

---

## Les trois règles à respecter

Un JSON est un format strict. Une virgule oubliée et le fichier devient
illisible — le site et l'application reviennent alors automatiquement à la
dernière version valide, mais votre modification ne s'affichera pas.

**1. Ne changez que ce qui est après les deux-points.**

```json
"category": "Hockey U11",
             ^^^^^^^^^^^ ceci, oui
 ^^^^^^^^^^ cela, non
```

**2. Gardez les guillemets droits `"` et les virgules.**

Chaque ligne d'une liste se termine par une virgule, **sauf la dernière**.

```json
{
  "start": "17:45",
  "end": "19:00",
  "category": "Hockey U11"     ← pas de virgule sur la dernière ligne
}
```

**3. Vérifiez avant d'enregistrer.**

Collez le contenu sur <https://jsonlint.com> et cliquez sur « Validate ».
S'il affiche « Valid JSON » en vert, vous pouvez enregistrer sans crainte.

> GitHub signale aussi les erreurs : si des lignes se soulignent en rouge
> dans l'éditeur, il y a un problème — ne validez pas.

---

## Cas courants

### Changer un horaire

Dans `api/planning.json`, trouvez le créneau et modifiez `start` et `end`.
Les heures s'écrivent sur 24 h, avec deux chiffres : `"17:45"`, pas `"17h45"`
ni `"5:45"`.

### Ajouter un créneau

Copiez un bloc entier `{ … }` existant, collez-le, ajoutez une virgule entre
les deux, puis modifiez les valeurs. Attention à `id`, qui doit rester
**unique** dans le fichier.

```json
{
  "weekday": 3,
  "start": "19:00",
  "end": "20:15",
  "category": "Gardiens",
  "meta": "Toutes catégories",
  "discipline": "hockey",
  "audience": "tous",
  "teamId": "gardiens",
  "id": "t-3-1900-gardiens",
  "location": "Espace Roller — Stade Robert Monseau",
  "address": "29 rue William Chaumet, 33160 Saint-Médard-en-Jalles"
}
```

- `weekday` : 1 = lundi, 2 = mardi … 7 = dimanche
- `discipline` : `hockey`, `patinage`, `baby`, `freestyle` — c'est ce qui donne
  la couleur du créneau et le fait apparaître dans les filtres
- `audience` : `enfants`, `jeunes`, `adultes`, `feminines`, `tous`
- `teamId` : facultatif, relie le créneau à une équipe de `teams.json`

### Publier un match

`matches.json` est volontairement vide : le club ne publiait pas ses
rencontres. Dès que vous en ajoutez une, elle apparaît sur l'accueil de
l'application (carte « Prochain match »), dans l'onglet Matchs et sur la
fiche de l'équipe.

```json
{
  "id": "n1-2026-09-20",
  "teamId": "n1",
  "competition": "Nationale 1",
  "date": "2026-09-20T20:00:00+02:00",
  "home": true,
  "opponent": "Nom de l'équipe adverse",
  "location": "Stade Robert Monseau",
  "address": "29 rue William Chaumet, 33160 Saint-Médard-en-Jalles",
  "scoreHome": null,
  "scoreAway": null,
  "status": "scheduled",
  "result": null
}
```

Le bloc va **entre les crochets** `[ ]` de `"data"`. Après le match :
`"status": "played"`, puis renseignez `scoreHome` et `scoreAway`.

Format de la date : `AAAA-MM-JJTHH:MM:SS+02:00` (`+02:00` en été,
`+01:00` en hiver).

### Annoncer une date de rentrée

Dans `inscriptions.json`, remplacez `"Date à confirmer"` par la vraie date
dans `openDoors`. Dans `events.json`, renseignez aussi le champ `date` au
format `"2026-09-05T17:30:00+02:00"` : le bouton « Ajouter au calendrier »
apparaît alors dans l'application.

### Modifier un tarif

Dans `teams.json` pour une équipe, dans `disciplines.json` pour une
discipline, dans `inscriptions.json` pour le tableau récapitulatif.
Le tarif est un texte libre : `"245 €"`, `"Inclus"`, `"Nous contacter"`.

---

## Le champ `updatedAt`

Chaque fichier commence par une date :

```json
{
  "updatedAt": "2026-08-23",
  "data": { … }
}
```

Elle n'est pas obligatoire, mais la tenir à jour permet de repérer d'un coup
d'œil quel fichier n'a pas été revu depuis longtemps. Format `AAAA-MM-JJ`.

---

## En cas de problème

**Le site n'affiche plus rien dans une section** — le JSON est probablement
invalide. Sur GitHub, ouvrez l'historique du fichier (onglet *History*),
choisissez la version précédente et cliquez sur *Revert*.

**L'application affiche encore l'ancienne information** — tirez la page vers
le bas pour forcer le rafraîchissement. L'application garde une copie locale
pendant 12 h pour rester utilisable hors ligne.

**Rien ne change même après plusieurs minutes** — vérifiez sur GitHub, onglet
*Actions*, que la publication du site s'est bien terminée (coche verte).
