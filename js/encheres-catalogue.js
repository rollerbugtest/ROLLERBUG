/* ============================================================================
   Catalogue des maillots Octobre Rose.

   Recherche par numéro ou par nom, tri, et rafraîchissement automatique des
   montants. Les cartes sont construites à partir des données ; aucune n'est
   écrite en dur, et ajouter ou retirer un maillot ne demande que de modifier
   la source de données.

   Tant qu'un maillot n'a pas de photo, la carte affiche son numéro sur fond
   rose plutôt qu'une image d'illustration : mieux vaut un emplacement franc
   qu'une photo qui n'est pas celle du maillot vendu.
   ========================================================================== */
(function () {
  'use strict';

  var grille = document.getElementById('orGrille');
  if (!grille || !window.ROctobreRose) return;

  var OR = window.ROctobreRose;
  var esc = OR.esc;

  var champRecherche = document.getElementById('orRecherche');
  var champTri = document.getElementById('orTri');
  var compteur = document.getElementById('orCompte');
  var vide = document.getElementById('orVide');

  var maillots = [];
  var parametres = null;

  // Toutes les 30 s, et à chaque retour sur l'onglet : les montants bougent
  // pendant les enchères, la page ne doit pas rester sur une valeur périmée.
  var RAFRAICHISSEMENT = 30000;
  var minuteur = null;

  /* ------------------------------------------------------------- rendu --- */

  function meilleure(m) {
    // meilleureOffre vient du serveur dès que les enchères sont ouvertes ;
    // avant ça, seul le prix de départ existe.
    return typeof m.meilleureOffre === 'number' ? m.meilleureOffre : null;
  }

  function carte(m) {
    var offre = meilleure(m);
    var libelle = offre === null ? 'Mise à prix' : 'Meilleure offre';
    var valeur = OR.euros(offre === null ? m.prixDepart : offre);

    var photo = Array.isArray(m.photos) && m.photos.length ? m.photos[0] : '';
    var visuel;
    if (photo) {
      // Une photo commune aux 21 maillots est annoncée comme telle : le
      // visiteur doit savoir qu'il voit le modèle, pas le maillot floqué.
      var legende = m.photoIllustration
        ? '<span class="or-maillot-attente">Photo d’illustration</span>' : '';
      var alt = m.photoIllustration
        ? 'Modèle du maillot Octobre Rose du Roller Bug'
        : 'Maillot numéro ' + m.numero + ', ' + m.nom;
      visuel = '<div class="or-maillot-visuel" style="background-image:url(&quot;' +
        esc(OR.racine + photo) + '&quot;);" role="img" aria-label="' + esc(alt) + '">' +
        legende + '</div>';
    } else {
      visuel = '<div class="or-maillot-visuel">' +
        '<span class="or-maillot-numero" aria-hidden="true">' + esc(m.numero) + '</span>' +
        '<span class="or-maillot-attente">Photo à venir</span></div>';
    }

    return '<a class="or-maillot" href="maillot.html?n=' + encodeURIComponent(m.numero) + '">' +
      visuel +
      '<div class="or-maillot-corps">' +
        '<span class="or-maillot-poste">' + esc(m.posteLibelle) + '</span>' +
        '<h3 class="or-maillot-nom">' + esc(m.nom) + '</h3>' +
        '<span class="or-maillot-meta">N° ' + esc(m.numero) + ' · Taille ' + esc(m.taille) + '</span>' +
        '<div class="or-maillot-prix">' +
          '<span class="or-maillot-prix-libelle">' + libelle + '</span>' +
          '<span class="or-maillot-prix-valeur">' + valeur + '</span>' +
        '</div>' +
        '<span class="or-maillot-action">Voir le maillot</span>' +
      '</div></a>';
  }

  /* --------------------------------------------------- filtrage et tri --- */

  function normalise(texte) {
    // Sans accents ni casse : « pérot » doit trouver PEROT.
    return String(texte || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function filtre() {
    var q = normalise(champRecherche ? champRecherche.value.trim() : '')
      .replace(/^n[°o]?\s*/, '').replace(/^#/, '');
    var liste = maillots.filter(function (m) {
      if (m.visible === false) return false;
      if (!q) return true;
      return String(m.numero).indexOf(q) === 0 || normalise(m.nom).indexOf(q) !== -1;
    });

    // Par défaut : ordre alphabétique des joueurs, comme demandé par le
    // bureau. Le tri par numéro reste disponible dans la liste déroulante.
    var tri = champTri ? champTri.value : 'nom';
    liste.sort(function (a, b) {
      var va = meilleure(a) === null ? a.prixDepart : meilleure(a);
      var vb = meilleure(b) === null ? b.prixDepart : meilleure(b);
      if (tri === 'offre-desc') return vb - va || a.numero - b.numero;
      if (tri === 'offre-asc')  return va - vb || a.numero - b.numero;
      if (tri === 'numero')     return a.numero - b.numero;
      // « fr » pour que les accents et les noms composés se rangent
      // comme dans un annuaire français.
      return a.nom.localeCompare(b.nom, 'fr') || a.numero - b.numero;
    });

    grille.innerHTML = liste.map(carte).join('');
    if (compteur) {
      compteur.textContent = liste.length + (liste.length > 1 ? ' maillots' : ' maillot');
    }
    if (vide) vide.hidden = liste.length > 0;
  }

  /* -------------------------------------------------------- chargement --- */

  function charge(premier) {
    return Promise.all([OR.maillots(), OR.parametres()]).then(function (res) {
      if (!res[0]) return;
      maillots = res[0];
      parametres = res[1];
      filtre();
      if (premier) annonceEtat();
    });
  }

  // Le statut de l'opération, affiché une fois au-dessus de la grille.
  function annonceEtat() {
    var el = document.getElementById('orStatut');
    if (!el || !parametres) return;
    var e = OR.etat(parametres);
    var textes = {
      preparation: 'Catalogue en ligne — l’ouverture des enchères sera annoncée très prochainement.',
      avant: 'Les enchères ouvrent le ' + OR.dateParis(parametres.ouverture) + '.',
      encours: 'Enchères en cours — clôture le ' + OR.dateParis(parametres.cloture) + '.',
      termine: 'Les enchères sont terminées. Merci à toutes et à tous.'
    };
    el.innerHTML = '<span class="or-badge">' + esc(textes[e] || '') + '</span>';
  }

  function rafraichit() {
    // On ne redemande les données que si la page est visible : inutile de
    // solliciter le serveur pour un onglet en arrière-plan.
    if (document.hidden) return;
    OR.vider();            // sinon on relirait la réponse déjà en cache
    charge(false);
  }

  if (champRecherche) champRecherche.addEventListener('input', filtre);
  if (champTri) champTri.addEventListener('change', filtre);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) rafraichit();
  });

  charge(true).then(function () {
    minuteur = setInterval(rafraichit, RAFRAICHISSEMENT);
  });
})();
