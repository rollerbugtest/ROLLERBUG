/* ============================================================================
   Sous-menus du menu principal.

   Le survol et le focus sont gérés en CSS (:hover / :focus-within) : le
   sous-menu reste donc ouvert quand la souris descend du titre vers les liens,
   sans une ligne de JavaScript. Ce script ne s'occupe que de ce que le CSS ne
   sait pas faire : le clic sur la flèche, l'accordéon mobile, la touche Échap
   et le clic à l'extérieur.

   Chaque rubrique garde son lien : la flèche est un bouton séparé, si bien
   qu'un appui sur « Le club » emmène toujours à la section, y compris sur
   téléphone.
   ========================================================================== */
(function () {
  'use strict';

  var BUREAU = window.matchMedia('(min-width: 1201px)');

  function rubriques() {
    return Array.prototype.slice.call(document.querySelectorAll('.a-sous-menu'));
  }

  function ferme(li) {
    li.classList.remove('ouvert');
    var fleche = li.querySelector('.nav-fleche');
    if (fleche) fleche.setAttribute('aria-expanded', 'false');
  }

  // Le CSS ouvre le panneau au survol et au focus. Après Échap, la souris ou
  // le focus sont souvent encore sur la rubrique : sans ce verrou, le panneau
  // se rouvrirait aussitôt. Il saute dès qu'on s'en éloigne.
  function verrouille(li) {
    if (!li) return;
    li.classList.add('echap');
    var libere = function (ev) {
      // Ramener le focus du bouton vers le titre déclenche un « focusout » sur
      // la rubrique alors qu'on n'en est pas sorti : on l'ignore.
      if (ev && ev.type === 'focusout' && ev.relatedTarget && li.contains(ev.relatedTarget)) return;
      li.classList.remove('echap');
      li.removeEventListener('mouseleave', libere);
      li.removeEventListener('focusout', libere);
    };
    li.addEventListener('mouseleave', libere);
    li.addEventListener('focusout', libere);
  }

  function fermeTout(sauf) {
    rubriques().forEach(function (li) { if (li !== sauf) ferme(li); });
  }

  function bascule(li) {
    li.classList.remove('echap');
    var ouvert = li.classList.toggle('ouvert');
    var fleche = li.querySelector('.nav-fleche');
    if (fleche) fleche.setAttribute('aria-expanded', String(ouvert));
    // Sur ordinateur une seule rubrique à la fois ; en accordéon mobile on
    // laisse plusieurs sections dépliées, c'est plus confortable au pouce.
    if (ouvert && BUREAU.matches) fermeTout(li);
    return ouvert;
  }

  document.addEventListener('click', function (ev) {
    var fleche = ev.target.closest && ev.target.closest('.nav-fleche');
    if (fleche) {
      ev.preventDefault();
      ev.stopPropagation();
      bascule(fleche.closest('.a-sous-menu'));
      return;
    }
    // Un lien de sous-menu referme la rubrique ; un clic ailleurs aussi.
    if (ev.target.closest && ev.target.closest('.sous-menu a')) { fermeTout(); return; }
    if (!(ev.target.closest && ev.target.closest('.a-sous-menu'))) fermeTout();
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      var ouverte = document.querySelector('.a-sous-menu.ouvert');
      var dansUnSousMenu = ev.target.closest && ev.target.closest('.a-sous-menu');
      fermeTout();
      // On rend le focus au titre de la rubrique qu'on vient de refermer,
      // sinon le curseur clavier se retrouve dans le vide.
      var cible = dansUnSousMenu || ouverte;
      if (cible) {
        verrouille(cible);
        var lien = cible.querySelector(':scope > a');
        if (lien && cible.contains(document.activeElement)) lien.focus();
      }
      return;
    }

    // Flèche bas sur le titre : ouvre et descend dans le sous-menu.
    if (ev.key === 'ArrowDown') {
      var li = ev.target.closest && ev.target.closest('.a-sous-menu');
      if (!li || !li.contains(document.activeElement)) return;
      var estLeTitre = ev.target === li.querySelector(':scope > a') ||
                       ev.target === li.querySelector('.nav-fleche');
      if (!estLeTitre) return;
      ev.preventDefault();
      if (!li.classList.contains('ouvert')) bascule(li);
      var premier = li.querySelector('.sous-menu a');
      if (premier) premier.focus();
    }
  });

  // En repassant de mobile à ordinateur, on repart d'un menu propre : les
  // accordéons laissés ouverts deviendraient des panneaux flottants figés.
  function surChangementDeTaille() { fermeTout(); }
  if (BUREAU.addEventListener) BUREAU.addEventListener('change', surChangementDeTaille);
  else if (BUREAU.addListener) BUREAU.addListener(surChangementDeTaille);

  // Le sous-menu des disciplines est reconstruit par js/data.js : les nouveaux
  // liens doivent refermer le menu mobile comme les autres.
  document.addEventListener('rollerbug:menu', function () {
    var nav = document.getElementById('mainNav');
    if (!nav) return;
    nav.querySelectorAll('.sous-menu a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); });
    });
  });
})();
