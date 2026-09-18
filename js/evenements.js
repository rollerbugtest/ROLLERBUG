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
    // Les affiches très larges sont montrées en entier plutôt que rognées.
    elBanniere.style.backgroundSize =
      carte.getAttribute('data-banniere-fit') === 'contain' ? 'contain' : 'cover';
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

  /* ------------------------------------------------------------------
     Compte à rebours sous chaque carte.

     Une seule horloge pour toutes les cartes plutôt qu'un minuteur par
     événement, et elle s'arrête quand l'onglet passe en arrière-plan :
     inutile de faire tourner ça dans un onglet que personne ne regarde.
     ------------------------------------------------------------------ */
  var horloge = null;

  function deuxChiffres(n) { return (n < 10 ? '0' : '') + n; }

  function texteRestant(ms) {
    var s = Math.floor(ms / 1000);
    var j = Math.floor(s / 86400); s -= j * 86400;
    var h = Math.floor(s / 3600);  s -= h * 3600;
    var m = Math.floor(s / 60);    s -= m * 60;
    if (j > 0) return j + (j > 1 ? ' jours ' : ' jour ') + deuxChiffres(h) + ' h ' + deuxChiffres(m) + ' min';
    if (h > 0) return deuxChiffres(h) + ' h ' + deuxChiffres(m) + ' min ' + deuxChiffres(s) + ' s';
    return deuxChiffres(m) + ' min ' + deuxChiffres(s) + ' s';
  }

  function majCompteurs() {
    var compteurs = document.querySelectorAll('.event-timer[data-debut]');
    if (!compteurs.length) { arreteHorloge(); return; }
    var maintenant = Date.now();
    var encoreUnQuiTourne = false;

    Array.prototype.forEach.call(compteurs, function (el) {
      var debut = Date.parse(el.getAttribute('data-debut'));
      var fin = Date.parse(el.getAttribute('data-fin') || '') || debut;
      if (isNaN(debut)) { el.hidden = true; return; }

      if (maintenant < debut) {
        el.className = 'event-timer';
        el.innerHTML = '<span class="event-timer-libelle">Commence dans</span>' +
          '<span class="event-timer-valeur">' + texteRestant(debut - maintenant) + '</span>';
        encoreUnQuiTourne = true;
      } else if (maintenant < fin) {
        el.className = 'event-timer event-timer--encours';
        el.innerHTML = '<span class="event-timer-valeur">C\'est en ce moment</span>';
        encoreUnQuiTourne = true;
      } else {
        el.className = 'event-timer event-timer--passe';
        el.innerHTML = '<span class="event-timer-valeur">Événement terminé</span>';
      }
    });

    if (!encoreUnQuiTourne) arreteHorloge();
  }

  function lanceHorloge() {
    majCompteurs();
    if (!horloge) horloge = setInterval(majCompteurs, 1000);
  }

  function arreteHorloge() {
    if (horloge) { clearInterval(horloge); horloge = null; }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) arreteHorloge(); else lanceHorloge();
  });

  // Au chargement pour le contenu de secours, puis à nouveau quand data.js a
  // remplacé les cartes par celles d'api/events.json.
  lanceHorloge();
  document.addEventListener('rollerbug:evenements', lanceHorloge);

  dlg.addEventListener('close', function () {
    if (declencheur) { declencheur.focus(); declencheur = null; }
  });
})();
