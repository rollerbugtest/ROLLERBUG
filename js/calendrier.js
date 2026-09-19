/* ============================================================================
   Planning hebdomadaire : filtre par discipline + choix du jour sur mobile.

   Les créneaux sont rendus par js/data.js à partir de api/planning.json : on
   attend donc que les données soient arrivées avant de lire le DOM, sinon on
   filtrerait les éléments de secours, déjà remplacés.

   Deux lectures d'un même contenu, sans rien dupliquer dans le HTML :
   - sur ordinateur, les sept jours côte à côte pour comparer d'un coup d'œil ;
   - sur téléphone, un jour à la fois, choisi dans une barre d'onglets.
   ========================================================================== */
(function () {
  'use strict';

  var MOBILE = window.matchMedia('(max-width: 900px)');
  var disciplineActive = 'all';
  var jourActif = null;

  function tous(sel, racine) {
    return Array.prototype.slice.call((racine || document).querySelectorAll(sel));
  }

  /* ---------- Filtre par discipline ---------- */

  function appliqueFiltre() {
    tous('.cal-slot').forEach(function (slot) {
      slot.hidden = disciplineActive !== 'all' &&
                    slot.getAttribute('data-disc') !== disciplineActive;
    });

    // Un jour vidé par le filtre n'est pas masqué : il affiche un message.
    // Faire disparaître la colonne laisserait croire que le jour n'existe pas.
    tous('.cal-day').forEach(function (jour) {
      var restants = jour.querySelectorAll('.cal-slot:not([hidden])').length;
      var vide = jour.querySelector('.cal-vide');
      if (vide) vide.hidden = restants > 0;
      jour.classList.toggle('sans-creneau', restants === 0);
      var compteur = document.querySelector('.cal-jour-onglet[data-jour="' +
        jour.getAttribute('data-jour') + '"] .cal-jour-nb');
      if (compteur) compteur.textContent = restants;
    });

    tous('.cal-filter').forEach(function (f) {
      var actif = f.getAttribute('data-disc') === disciplineActive;
      f.classList.toggle('active', actif);
      f.setAttribute('aria-pressed', actif ? 'true' : 'false');
    });
  }

  /* ---------- Un jour à la fois, sur téléphone ---------- */

  function appliqueJour() {
    var onglets = tous('.cal-jour-onglet');
    if (!onglets.length) return;

    if (!MOBILE.matches) {
      // Sur ordinateur les sept jours restent affichés : les onglets ne
      // servent plus qu'à faire défiler jusqu'au jour choisi.
      tous('.cal-day').forEach(function (j) { j.hidden = false; });
      onglets.forEach(function (o) {
        o.setAttribute('aria-pressed', 'false');
        o.classList.remove('active');
      });
      return;
    }

    if (!jourActif) jourActif = String(jourDuJour());
    tous('.cal-day').forEach(function (j) {
      j.hidden = j.getAttribute('data-jour') !== jourActif;
    });
    onglets.forEach(function (o) {
      var actif = o.getAttribute('data-jour') === jourActif;
      o.classList.toggle('active', actif);
      o.setAttribute('aria-pressed', actif ? 'true' : 'false');
    });
  }

  // Lundi = 1 … Dimanche = 7, comme dans api/planning.json.
  function jourDuJour() {
    var d = new Date().getDay();
    return d === 0 ? 7 : d;
  }

  /* ---------- Écoute ---------- */

  document.addEventListener('click', function (ev) {
    var f = ev.target.closest && ev.target.closest('.cal-filter');
    if (f) { disciplineActive = f.getAttribute('data-disc'); appliqueFiltre(); return; }

    var o = ev.target.closest && ev.target.closest('.cal-jour-onglet');
    if (o) {
      jourActif = o.getAttribute('data-jour');
      if (MOBILE.matches) appliqueJour();
      else {
        var cible = document.querySelector('.cal-day[data-jour="' + jourActif + '"]');
        if (cible) cible.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  });

  // Flèches gauche/droite entre les onglets de jour, comme dans un vrai
  // groupe d'onglets.
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    var o = ev.target.closest && ev.target.closest('.cal-jour-onglet');
    if (!o) return;
    var onglets = tous('.cal-jour-onglet');
    var i = onglets.indexOf(o) + (ev.key === 'ArrowRight' ? 1 : -1);
    if (i < 0) i = onglets.length - 1;
    if (i >= onglets.length) i = 0;
    ev.preventDefault();
    onglets[i].focus();
  });

  function surChangementDeTaille() { appliqueJour(); }
  if (MOBILE.addEventListener) MOBILE.addEventListener('change', surChangementDeTaille);
  else if (MOBILE.addListener) MOBILE.addListener(surChangementDeTaille);

  function init() {
    if (!document.querySelector('.cal-slot')) return;
    appliqueFiltre();
    appliqueJour();
  }

  // Une fois pour le contenu de secours, puis à nouveau quand js/data.js a
  // remplacé le planning par celui d'api/planning.json.
  document.addEventListener('rollerbug:planning', init);
  (window.rollerbugDataReady || Promise.resolve()).then(init);
  init();
})();
