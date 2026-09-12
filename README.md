# Site Roller Bug

Site vitrine du club de roller de Saint-Médard-en-Jalles.
Site statique — aucune compilation, aucune dépendance à installer.

## Structure

```
index.html              Structure de la page (toutes les sections)
css/style.css               Tout le style
js/stars.js                 Animation du fond étoilé (canvas)
js/nav.js                   Menu mobile (hamburger)
js/intro.js                 Écran d'accueil à l'arrivée sur le site
js/page-transition.js       Rideau de transition entre sections
js/calendrier.js            Filtrage du planning par discipline
js/scroll-progress.js       Barre de suivi verticale + lien de menu actif
js/animations.js            Apparitions au scroll, compteurs, parallaxe, survols
images/logo.webp            Logo du club
```

Pour travailler dessus : ouvrir `rollerbug.html` dans un navigateur. C'est tout.

## Sections de la page

`#actualites` · `#club` · `#disciplines` · `#hockey` · `#inscriptions` · `#bureau` · `#contact`

Ces identifiants servent à trois endroits — si vous en renommez un, pensez aux trois :

1. les liens du menu (`<nav id="mainNav">`)
2. les `data-target` des points de la barre de suivi
3. les liens du bandeau d'actualités

## À mettre à jour régulièrement

**Bandeau d'actualités** (`#actualites`, classe `.news-band`) — 5 rendez-vous du club.
Les dates sont écrites en dur dans le HTML, à revoir à chaque saison. Deux sont
encore à confirmer :

| Événement | État |
|---|---|
| Forum des associations | Ven. 05 sept. ✅ |
| Portes ouvertes | Sam. 06 sept. ✅ |
| Disco roller | « Toute la saison » — à préciser si dates fixes |
| Match à domicile | renvoie vers le calendrier Rolskanet ✅ |
| Fête du sport | **date à confirmer** |

**Tarifs et créneaux hockey** (`#hockey`) — à vérifier chaque saison.

**Planning hebdomadaire** (`#calendrier`) — 32 créneaux répartis sur 7 jours,
filtrables par discipline. Les données viennent de la page « Horaires et
tarifs » des deux dossiers d'inscription PDF.

> ⚠️ **Attention aux doublons.** Les horaires hockey figurent à **deux
> endroits** : le planning `#calendrier` et le tableau détaillé `#hockey`.
> Un changement de créneau doit être répercuté dans les deux, sinon le site
> se contredit. Les deux divergent actuellement — voir plus bas.

Pour ajouter un créneau, copiez un bloc `.cal-slot` dans le bon jour :

```html
<div class="cal-slot" data-disc="hockey">
  <div class="cal-time">17h45 – 19h00</div>
  <div class="cal-cat">Hockey U11</div>
  <div class="cal-meta">Enfants · 2016–2017</div>
</div>
```

`data-disc` accepte `patinage`, `baby`, `freestyle` ou `hockey` — c'est lui qui
donne la couleur et qui fait fonctionner les filtres. Rangez le bloc dans
l'ordre chronologique du jour : rien ne trie automatiquement.

**Photos du bureau** (`images/bureau/`) — un fichier par membre, nommé d'après
la personne :

| Fichier | Membre |
|---|---|
| `reaux-muriel.webp` | Réaux Muriel |
| `lamelot-emma.webp` | Lamelot Emma |
| `molina-ludovic.webp` | Molina Ludovic |
| `dalmeida-elisabeth.webp` | D'Almeida Elisabeth |
| `bajule-vanessa.webp` | Bajule Vanessa |
| `bajule-ludovic.webp` | Bajule Ludovic |
| `cruaud-laurine.webp` | Cruaud Laurine |
| `malaval-frederic.webp` | Malaval Frédéric |
| `colle-franck.webp` | Collé Franck |
| `dayries-laetitia.webp` | Dayries Laetitia |
| `julien-pervalet.webp` | Julien Pervalet |

Ce sont pour l'instant des **vignettes provisoires** (le logo du club sur fond
sombre). Pour mettre une vraie photo : remplacez le fichier en gardant
exactement le même nom — rien à modifier dans le HTML.

Conseils pour les photos : **cadrage carré** (elles s'affichent dans un cercle
de 88 px), 400 × 400 px suffisent largement, format `.webp` de préférence
(sinon changez l'extension dans le HTML). Le visage doit être centré : le CSS
utilise `object-fit: cover`, donc une photo rectangulaire sera recadrée au
centre.

**Dossiers d'inscription** (`dossier-inscriptions/`) — deux PDF téléchargeables
depuis la section Inscriptions :

```
dossier-inscriptions/dossier-inscription-adultes.pdf
dossier-inscriptions/dossier-inscription-enfants.pdf
```

Les noms **ne contiennent pas l'année** volontairement. Pour changer de saison,
remplacez les deux fichiers en gardant exactement les mêmes noms : les boutons
continuent de marcher, aucun HTML à modifier.

> ⚠️ Les PDF actuellement en ligne sont ceux de la **saison 2025/2026**, alors
> que la section affiche désormais 2026–2027. Pensez à les remplacer par les
> versions de la nouvelle saison.

## Points en attente

**HelloAsso** — bouton d'adhésion en ligne préparé mais désactivé.
Il est en commentaire dans `#inscriptions`, juste sous le bouton
« Nous contacter pour un essai ». Pour l'activer : créer le compte
association, récupérer l'URL publique de la campagne d'adhésion, la coller
à la place de `URL_HELLOASSO_A_REMPLIR`, puis retirer les balises de commentaire.

**Instagram** — déjà en place. Widget Elfsight connecté à `@rollerbug_stmedard`,
dans `#actualites`. Le contenu vient du compte en direct : il n'est pas modifiable
depuis le code du site. Pour changer ce qui s'affiche (posts, légendes, hashtags
comme le `#yummy` repéré), passer par le tableau de bord sur `apps.elfsight.com`.

**Hébergement** — OVH. Le site est statique : un simple dépôt des fichiers par
FTP suffit, en conservant l'arborescence ci-dessus (`css/`, `js/`, `images/`
à côté du HTML). Prévoir une préproduction (bac à sable) pour valider avant
mise en ligne.

## Comment marchent les animations

Le `<head>` pose **deux** classes sur `<html>`, avant le premier rendu :

| Classe | Posée quand | Ce qu'elle autorise |
|---|---|---|
| `js` | JavaScript actif | fondus d'apparition, écran d'accueil, rideau |
| `motion-full` | le visiteur accepte le mouvement | déplacements, parallaxe, inclinaison des cartes, compteurs, balayages |

Ce découpage en deux niveaux est important. Une première version coupait
**tout** dès que le système demandait de réduire les animations — le site
paraissait alors complètement figé. Or « réduire le mouvement » ne veut pas
dire « supprimer toute animation » : ce sont les grands déplacements, la
parallaxe et les boucles automatiques qui gênent, pas un fondu.

Donc en mouvement réduit, le site garde ses fondus, son écran d'accueil et
ses transitions (en fondu au lieu de coulissé). Il reste vivant.

Sans JavaScript, aucune des deux classes n'est posée : la page s'affiche
complètement, rien n'est masqué. **Aucun contenu ne peut rester bloqué
invisible** — c'est le piège classique de ce genre de système.

> **Pour voir le site avec toutes les animations** : sur Windows,
> *Paramètres → Accessibilité → Effets visuels → Effets d'animation*.
> Si ce réglage est sur Désactivé, le navigateur demande le mode réduit
> et vous ne verrez que les fondus.

Ce qui est animé :

| Effet | Où |
|---|---|
| Apparition en fondu + cascade | toutes les sections, au scroll |
| Compteurs chiffrés | stats du hero et de la section Club |
| Reflet balayant | titre « ROLLER BUG » |
| Header qui se compacte | au-delà de 40 px de scroll |
| Parallaxe | filigrane du logo en fond |
| Inclinaison 3D au survol | cartes (disciplines, bureau, actus…) |
| Boutons aimantés | tous les `.btn` |
| Lien de menu surligné | section en cours de lecture |

Les effets de survol (inclinaison, aimantation) ne s'activent que sur souris
fine — ils sont inutiles et gênants au doigt.

### Écran d'accueil et transitions

À l'arrivée sur le site, un écran affiche le logo et une barre qui se remplit,
puis se lève comme un rideau. L'intro complète (~1,2 s) ne joue qu'**une fois
par session** : en rechargeant, on a une version courte (~0,3 s), pour ne pas
faire attendre quelqu'un qui revient.

Au clic sur un lien du menu (ou un point de la barre de suivi), un rideau
monte, le saut vers la section se fait caché, puis le rideau repart vers le
haut. C'est ce qui donne la sensation de changer de page.

Deux sécurités importantes :

- Les deux rideaux sont en `display:none` par défaut. Ils ne s'affichent que
  si la classe `js` est présente — donc **jamais** sans JavaScript ni en
  « animations réduites ». Un rideau ne peut pas rester coincé devant le site.
- `intro.js` a un minuteur de sécurité : passé 2,6 s, le rideau se lève de
  force, même si une image traîne ou qu'une ressource bloque.

L'ordre des balises `<script>` compte : `intro.js` publie `rollerbugReady`
(la promesse que les autres attendent pour ne pas jouer leurs animations
derrière le rideau) et `page-transition.js` publie `rollerbugGoTo`.

### Si vous ajoutez de vraies pages

Le site tient aujourd'hui en un seul fichier : les liens du menu sont des
ancres vers des sections. Si vous créez un jour de vraies pages séparées,
le plus simple est d'ajouter dans le CSS :

```css
@view-transition { navigation: auto; }
```

Le navigateur enchaîne alors les pages en fondu, nativement. Il faudra
retirer l'interception des clics dans `page-transition.js` pour les liens
qui ne sont plus des ancres.

### Si vous ajoutez une section

La liste des éléments qui apparaissent au scroll existe **en deux endroits**
qui doivent rester identiques :

- `css/style.css`, bloc « Apparition au scroll »
- `js/animations.js`, constante `REVEAL`

Ajouter un sélecteur dans l'un sans l'autre casse l'effet (élément qui reste
invisible, ou qui apparaît sans animation). Un commentaire le rappelle dans
les deux fichiers.

## Bon à savoir

- Le menu passe en hamburger sous 820 px.
- La barre de suivi verticale est masquée sous 1100 px (pas la place).
- `prefers-reduced-motion` coupe toutes les animations — c'est voulu.
- Le formulaire de contact n'envoie rien pour l'instant (`onsubmit` bloqué).
  Il faudra le brancher sur un service d'envoi ou une adresse mail.
