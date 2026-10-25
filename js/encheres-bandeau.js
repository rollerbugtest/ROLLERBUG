/* ============================================================================
   Bandeau « Enchères solidaires — Octobre Rose » de la page d'accueil.

   Quatre états, choisis par le serveur puis vérifiés à chaque seconde :

     préparation  le catalogue est visible, les enchères pas encore ouvertes
     avant        compte à rebours jusqu'à l'ouverture
     en cours     compte à rebours jusqu'à la clôture
     terminé      plus aucune offre possible

   Le HTML écrit en dur dans index.html reste affiché tant que les données ne
   sont pas arrivées : si le réseau échoue, le visiteur voit le bandeau de
   secours plutôt qu'un trou dans la page.
   ========================================================================== */
(function () {
  'use strict';

  var zone = document.getElementById('bandeauOctobreRose');
  if (!zone || !window.ROctobreRose) return;

  var OR = window.ROctobreRose;
  var esc = OR.esc;
  var horloge = null;
  var parametres = null;

  /* ------------------------------------------------------------- rendu --- */

  function bloc(libelle, valeur) {
    return '<div class="or-info">' +
      '<span class="or-info-libelle">' + esc(libelle) + '</span>' +
      '<span class="or-info-valeur">' + esc(valeur) + '</span>' +
      '</div>';
  }

  function rendre(p) {
    var e = OR.etat(p);
    if (e === 'inactif') { zone.hidden = true; return; }
    zone.hidden = false;

    var visuel = p.visuel
      ? ' style="background-image:url(&quot;' + esc(OR.racine + p.visuel) + '&quot;);"'
      : '';

    // Les informations pratiques ne sont affichées que lorsqu'elles ont un
    // sens : annoncer une clôture avant d'avoir fixé l'ouverture n'en a pas.
    var infos = bloc('Maillots', p.nombreMaillots + ' pièces uniques') +
      bloc('Mise à prix', OR.euros(p.miseAPrix)) +
      bloc('Palier', '+ ' + OR.euros(p.palier));
    if (e !== 'preparation') {
      infos += bloc('Ouverture', OR.dateParis(p.ouverture)) +
        bloc('Clôture', OR.dateParis(p.cloture));
    }

    var actions = '';
    if (e === 'termine') {
      actions = '<a class="btn-rose-fantome" href="' + esc(p.lienCatalogue) + '">Voir les résultats</a>';
    } else {
      actions = '<a class="btn-rose" href="' + esc(p.lienCatalogue) + '">' +
        esc(p.libelleCatalogue || 'Découvrir les maillots') + '</a>';
      if (p.lienSecondaire) {
        actions += '<a class="btn-rose-fantome" href="' + esc(p.lienSecondaire) + '">' +
          esc(p.libelleSecondaire || 'Nous contacter') + '</a>';
      }
    }

    var sousTitre = e === 'preparation' && p.messagePreparation
      ? p.sousTitre + ' ' + p.messagePreparation
      : p.sousTitre;

    zone.innerHTML =
      '<div class="or-carte" data-etat="' + e + '">' +
        '<div class="or-visuel"' + visuel + ' role="img" aria-label="' +
          esc(p.visuelAlt || 'Octobre Rose') + '"></div>' +
        '<div class="or-corps">' +
          '<span class="or-surtitre">' + esc(p.surtitre || 'Opération solidaire') + '</span>' +
          '<h2 class="or-titre" id="orTitre">' + esc(p.titre) + '</h2>' +
          '<p class="or-soustitre">' + esc(sousTitre) + '</p>' +
          '<div class="or-infos">' + infos + '</div>' +
          '<div class="or-compteur" id="orCompteur"></div>' +
          '<div class="or-actions">' + actions + '</div>' +
        '</div>' +
      '</div>';

    majCompteur();
    lanceHorloge();
  }

  /* -------------------------------------------------- compte à rebours --- */

  function majCompteur() {
    var el = document.getElementById('orCompteur');
    if (!el || !parametres) return;

    var e = OR.etat(parametres);
    var carte = zone.querySelector('.or-carte');
    if (carte) carte.setAttribute('data-etat', e);

    if (e === 'preparation') {
      el.innerHTML = '<span class="or-badge">Ouverture prochainement</span>';
      arreteHorloge();
      return;
    }
    if (e === 'termine') {
      el.innerHTML = '<span class="or-compteur-libelle">Enchères</span>' +
        '<span class="or-compteur-valeur">Terminées</span>';
      arreteHorloge();
      return;
    }

    var cible = Date.parse(e === 'avant' ? parametres.ouverture : parametres.cloture);
    el.innerHTML = '<span class="or-compteur-libelle">' +
      (e === 'avant' ? 'Ouverture dans' : 'Clôture dans') + '</span>' +
      '<span class="or-compteur-valeur">' + OR.tempsRestant(cible - OR.maintenant()) + '</span>';
  }

  function lanceHorloge() { if (!horloge) horloge = setInterval(majCompteur, 1000); }
  function arreteHorloge() { if (horloge) { clearInterval(horloge); horloge = null; } }

  // Inutile de faire tourner une horloge dans un onglet que personne ne
  // regarde ; au retour, on remet l'affichage à jour immédiatement.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { arreteHorloge(); return; }
    majCompteur();
    if (parametres && ['avant', 'encours'].indexOf(OR.etat(parametres)) !== -1) lanceHorloge();
  });

  /* -------------------------------------------------------- chargement --- */

  OR.parametres().then(function (p) {
    if (!p) return;              // réseau en panne : le secours reste affiché
    parametres = p;
    rendre(p);
  });
})();
