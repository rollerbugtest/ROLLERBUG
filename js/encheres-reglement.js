/* ============================================================================
   Règlement des enchères — mise à jour des dates et des montants.

   Le texte du règlement est écrit en dur dans octobre-rose/reglement.html :
   un document qui engage le club doit rester lisible même sans JavaScript.
   Ce script ne fait qu'une chose : si les paramètres de l'opération ont
   changé depuis la rédaction (report de la clôture, mise à prix revue), il
   remplace les quelques valeurs concernées pour que le règlement ne mente
   pas. En cas d'échec, le texte écrit reste affiché tel quel.
   ========================================================================== */
(function () {
  'use strict';

  if (!window.ROctobreRose) return;
  var OR = window.ROctobreRose;

  // Comme OR.dateParis, mais avec l'année : sur un règlement, « vendredi
  // 30 octobre » sans millésime ne vaut rien.
  function dateComplete(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var texte = d.toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    // « 00:00 » → « 00h00 », comme partout ailleurs sur le site.
    return texte.replace(/(\d{2}):(\d{2})/, '$1h$2');
  }

  function remplace(selecteur, valeur) {
    if (!valeur) return;          // jamais remplacer par du vide
    var liste = document.querySelectorAll(selecteur);
    for (var i = 0; i < liste.length; i++) liste[i].textContent = valeur;
  }

  OR.parametres().then(function (p) {
    if (!p) return;
    remplace('[data-or-date="ouverture"]', dateComplete(p.ouverture));
    remplace('[data-or-date="cloture"]', dateComplete(p.cloture));
    remplace('[data-or-montant="miseAPrix"]', OR.euros(p.miseAPrix));
    remplace('[data-or-montant="palier"]', OR.euros(p.palier));
  }).catch(function (e) {
    console.warn('[reglement] paramètres indisponibles, texte écrit conservé', e);
  });
})();
