/* ============================================================================
   Fiches d'événements.

   Chaque carte de la section « Événements & stages » porte sa fiche complète
   avec elle : les informations courtes dans des attributs data-*, le texte
   long dans un bloc .event-detail masqué. Ce script se contente de recopier
   tout ça dans la boîte de dialogue au moment du clic.

   Conséquence utile : ça marche à l'identique que la page ait été remplie par
   api/events.json ou qu'elle affiche le contenu de secours écrit en dur dans
   index.html — donc aussi quand le site est ouvert par double-clic, là où le
   navigateur refuse de lire les fichiers JSON.
   ========================================================================== */
(function () {
  'use strict';

  var dlg = document.getElementById('eventDlg');
  if (!dlg) return;

  var elBanniere = document.getElementById('eventDlgBanniere');
  var elIco      = document.getElementById('eventDlgIco');
  var elTitre    = document.getElementById('eventDlgTitre');
  var elDate     = document.getElementById('eventDlgDate');
  var elLieu     = document.getElementById('eventDlgLieu');
  var elTexte    = document.getElementById('eventDlgTexte');
  var elPdf      = document.getElementById('eventDlgPdf');
  var fermer     = document.getElementById('eventDlgFermer');

  var declencheur = null;

  function ouvre(carte) {
    declencheur = carte;

    var banniere = carte.getAttribute('data-banniere');
    elBanniere.style.backgroundImage = banniere
      ? 'url("' + banniere + '"), var(--event-degrade)'
      : 'var(--event-degrade)';
    elIco.textContent = carte.getAttribute('data-ico') || '📅';

    elTitre.textContent = carte.getAttribute('data-titre') || '';
    elDate.textContent  = carte.getAttribute('data-date') || '';
    elDate.hidden       = !elDate.textContent;

    var lieu = carte.getAttribute('data-lieu') || '';
    elLieu.textContent = lieu;
    elLieu.hidden = !lieu;

    var detail = carte.querySelector('.event-detail');
    elTexte.innerHTML = detail ? detail.innerHTML : '';

    // Le document n'est proposé que si l'événement en a un.
    var pdf = carte.getAttribute('data-pdf');
    if (pdf) {
      elPdf.href = pdf;
      elPdf.textContent = carte.getAttribute('data-pdf-label') || 'Télécharger le document (PDF)';
      elPdf.hidden = false;
    } else {
      elPdf.removeAttribute('href');
      elPdf.hidden = true;
    }

    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    // Le focus part sur le bouton de fermeture : au clavier, Échap et Tab
    // restent immédiatement accessibles.
    if (fermer) fermer.focus();
  }

  function ferme() {
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  document.addEventListener('click', function (ev) {
    var carte = ev.target.closest && ev.target.closest('.event-card');
    if (carte) { ouvre(carte); return; }
    if (ev.target === fermer) ferme();
  });

  // Clavier : Entrée ou Espace sur une carte, comme un vrai bouton.
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
    var carte = ev.target.closest && ev.target.closest('.event-card');
    if (!carte) return;
    ev.preventDefault();
    ouvre(carte);
  });

  // Clic sur le fond sombre : on referme, comme partout ailleurs sur le site.
  dlg.addEventListener('click', function (ev) {
    if (ev.target === dlg) ferme();
  });

  dlg.addEventListener('close', function () {
    if (declencheur) { declencheur.focus(); declencheur = null; }
  });
})();
