/* ============================================================================
   Consentement aux cookies et traceurs.

   Ce que le site dépose réellement, et rien d'autre :

   1. NÉCESSAIRE (pas de consentement requis)
      - sessionStorage « rb-intro » : retient que l'écran d'accueil a été vu,
        pour ne pas le rejouer à chaque section.
      - localStorage « rb-cookies » : ce choix-ci, justement.
      - Session Supabase (jeton de connexion) : déposée uniquement si le
        visiteur crée un compte ou se connecte, à sa demande explicite.
      Ces usages sont exemptés de consentement (article 82 loi Informatique
      et Libertés, lignes directrices CNIL) : ils sont strictement nécessaires
      à un service demandé par l'utilisateur.

   2. RÉSEAUX SOCIAUX (consentement requis)
      - Fil Instagram intégré, fourni par Elfsight. Il charge un script tiers
        et dépose des traceurs. Tant qu'il n'est pas accepté, RIEN n'est
        chargé : à la place, un encart propose de l'autoriser ou d'ouvrir
        Instagram directement.

   Le refus est aussi simple que l'acceptation (deux boutons de même poids),
   le choix est mémorisé 13 mois maximum, et reste modifiable à tout moment
   par « Gérer mes cookies » dans les mentions légales et le pied de page.
   ========================================================================== */
(function () {
  'use strict';

  var CLE = 'rb-cookies';
  var VERSION = 1;
  var DUREE = 13 * 30 * 24 * 60 * 60 * 1000;   // 13 mois, plafond CNIL

  /* ---------- Mémoire ---------- */

  // Le stockage peut être refusé (navigation privée, cookies bloqués). Dans ce
  // cas on ne casse rien : le bandeau réapparaît, et rien de tiers ne charge.
  function lit() {
    try {
      var brut = window.localStorage.getItem(CLE);
      if (!brut) return null;
      var o = JSON.parse(brut);
      if (!o || o.v !== VERSION) return null;
      if (Date.now() - o.date > DUREE) return null;   // périmé : on redemande
      return o;
    } catch (e) { return null; }
  }

  function ecrit(choix) {
    try {
      window.localStorage.setItem(CLE, JSON.stringify({
        v: VERSION, date: Date.now(), choix: choix
      }));
    } catch (e) { /* stockage refusé : le choix ne vaut que pour cette visite */ }
  }

  var courant = lit();
  var choixCourant = courant ? courant.choix : null;

  function accepte(categorie) {
    return !!(choixCourant && choixCourant[categorie]);
  }

  /* ---------- Chargement des contenus tiers ---------- */

  // Un bloc tiers = un conteneur [data-consentement], avec son encart de
  // remplacement et un <template> contenant le vrai contenu. Ajouter un autre
  // service plus tard ne demande que ce même duo dans le HTML.
  function activeBlocs(categorie) {
    var blocs = document.querySelectorAll('[data-consentement="' + categorie + '"]');
    Array.prototype.forEach.call(blocs, function (bloc) {
      if (bloc.dataset.charge === '1') return;
      var modele = bloc.querySelector('template');
      var encart = bloc.querySelector('.consent-encart');
      if (!modele) return;
      bloc.dataset.charge = '1';
      if (encart) encart.remove();
      bloc.appendChild(modele.content.cloneNode(true));

      // Les <script> clonés depuis un <template> ne s'exécutent pas : il faut
      // les recréer pour que le navigateur les charge vraiment.
      Array.prototype.forEach.call(bloc.querySelectorAll('script'), function (vieux) {
        var neuf = document.createElement('script');
        Array.prototype.forEach.call(vieux.attributes, function (a) {
          neuf.setAttribute(a.name, a.value);
        });
        neuf.text = vieux.text;
        vieux.parentNode.replaceChild(neuf, vieux);
      });
    });
  }

  function replaceBlocs(categorie) {
    var blocs = document.querySelectorAll('[data-consentement="' + categorie + '"]');
    Array.prototype.forEach.call(blocs, function (bloc) {
      if (bloc.dataset.charge !== '1') return;
      // Un script tiers déjà exécuté ne se « désexécute » pas : on retire ce
      // qu'il a affiché et on recharge la page pour repartir propre.
      window.location.reload();
    });
  }

  function applique() {
    if (accepte('reseaux')) activeBlocs('reseaux');
  }

  /* ---------- Interface ---------- */

  var bandeau = document.getElementById('cookieBandeau');
  var panneau = document.getElementById('cookiePanneau');
  var interrupteurReseaux = document.getElementById('cookieReseaux');

  function montreBandeau(oui) { if (bandeau) bandeau.hidden = !oui; }

  function ouvrePanneau() {
    if (!panneau) return;
    if (interrupteurReseaux) interrupteurReseaux.checked = accepte('reseaux');
    montreBandeau(false);
    if (typeof panneau.showModal === 'function') panneau.showModal();
    else panneau.setAttribute('open', '');
  }

  function fermePanneau() {
    if (!panneau) return;
    if (typeof panneau.close === 'function') panneau.close();
    else panneau.removeAttribute('open');
    // Pas encore de choix enregistré : le bandeau doit revenir.
    if (!lit()) montreBandeau(true);
  }

  function enregistre(choix) {
    var avant = accepte('reseaux');
    choixCourant = choix;
    ecrit(choix);
    montreBandeau(false);
    fermePanneau();
    if (choix.reseaux) applique();
    else if (avant) replaceBlocs('reseaux');
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-cookie]');
    if (el) {
      ev.preventDefault();
      var action = el.getAttribute('data-cookie');
      if (action === 'tout') enregistre({ reseaux: true });
      else if (action === 'rien') enregistre({ reseaux: false });
      else if (action === 'regler') ouvrePanneau();
      else if (action === 'fermer') fermePanneau();
      else if (action === 'valider') {
        enregistre({ reseaux: !!(interrupteurReseaux && interrupteurReseaux.checked) });
      }
      return;
    }

    // « Autoriser et afficher » posé directement sur un encart de remplacement.
    var direct = ev.target.closest && ev.target.closest('[data-consent-autoriser]');
    if (direct) {
      ev.preventDefault();
      var cat = direct.getAttribute('data-consent-autoriser');
      var maj = {};
      if (choixCourant) { for (var k in choixCourant) maj[k] = choixCourant[k]; }
      maj[cat] = true;
      enregistre(maj);
    }
  });

  if (panneau) {
    panneau.addEventListener('cancel', function (ev) { ev.preventDefault(); fermePanneau(); });
    panneau.addEventListener('click', function (ev) { if (ev.target === panneau) fermePanneau(); });
  }

  /* ---------- Démarrage ---------- */

  if (choixCourant) applique();
  else montreBandeau(true);
})();
