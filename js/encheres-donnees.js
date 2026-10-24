/* ============================================================================
   Enchères Octobre Rose — accès aux données.

   Un seul endroit pour aller chercher les paramètres de l'opération et la
   liste des maillots, utilisé par le bandeau d'accueil, le catalogue et la
   fiche d'un maillot.

   Deux sources, dans cet ordre :
     1. les routes serveur /api/encheres/… (la base de données fait foi) ;
     2. à défaut, les fichiers api/octobre-rose*.json.

   C'est ce qui permet de mettre la vitrine en ligne aujourd'hui et de
   basculer sur la base plus tard sans retoucher une seule page.

   ⚠ Les montants affichés par ces fichiers sont indicatifs. Dès que les
   enchères sont ouvertes, seule la réponse du serveur fait autorité : aucune
   offre n'est jamais validée avec une valeur venue d'ici.
   ========================================================================== */
(function () {
  'use strict';

  // La racine du site, vue depuis la page courante. Le script est toujours
  // chargé depuis « …/js/encheres-donnees.js » : on remonte d'un cran.
  var script = document.currentScript;
  var RACINE = script ? script.src.replace(/js\/encheres-donnees\.js.*$/, '') : '';

  var cache = {};

  function viaReseau(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' : HTTP ' + r.status);
      return r.json();
    });
  }

  // Les fichiers du site sont de la forme { updatedAt, data } ; les routes
  // serveur répondront directement l'objet utile. On accepte les deux.
  function contenu(enveloppe) {
    return enveloppe && Object.prototype.hasOwnProperty.call(enveloppe, 'data')
      ? enveloppe.data
      : enveloppe;
  }

  // Trois sources, de la plus fiable à la plus dépannage :
  //   1. la route serveur — la base de données fait foi ;
  //   2. le fichier .json — la vitrine, avant que la base existe ;
  //   3. api/octobre-rose-donnees.js, chargé par <script>.
  //
  // La troisième existe pour le double-clic : en file://, le navigateur
  // refuse fetch() sur un fichier local, mais exécute un <script> sans
  // broncher. Sans elle, le catalogue reste vide quand on ouvre le site
  // depuis l'ordinateur au lieu du web.
  function charge(cle, routeApi, fichier, secours) {
    if (cache[cle]) return cache[cle];
    cache[cle] = viaReseau(RACINE + routeApi)
      .catch(function () { return viaReseau(RACINE + fichier + '?v=' + Date.now()); })
      .then(contenu)
      .catch(function (err) {
        var local = window[secours];
        if (local) {
          console.info('[octobre-rose] ' + cle + ' : lecture locale (' + secours + ')');
          return local;
        }
        console.warn('[octobre-rose] ' + cle + ' indisponible', err);
        return null;
      });
    return cache[cle];
  }

  /* ---------------------------------------------------------- utilitaires */

  // 'preparation' : les enchères ne sont pas encore ouvertes au public, quelle
  //                 que soit la date — c'est l'interrupteur du club.
  // 'avant' / 'encours' / 'termine' : déduits des dates.
  function etat(p, maintenant) {
    if (!p || !p.actif) return 'inactif';
    if (!p.encheresActivees) return 'preparation';
    var t = maintenant == null ? Date.now() : maintenant;
    var ouverture = Date.parse(p.ouverture);
    var cloture = Date.parse(p.cloture);
    if (isNaN(ouverture) || isNaN(cloture)) return 'preparation';
    if (t < ouverture) return 'avant';
    if (t < cloture) return 'encours';
    return 'termine';
  }

  function deuxChiffres(n) { return (n < 10 ? '0' : '') + n; }

  function tempsRestant(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var j = Math.floor(s / 86400); s -= j * 86400;
    var h = Math.floor(s / 3600);  s -= h * 3600;
    var m = Math.floor(s / 60);    s -= m * 60;
    if (j > 0) return j + (j > 1 ? ' jours ' : ' jour ') + deuxChiffres(h) + ' h ' + deuxChiffres(m) + ' min';
    if (h > 0) return deuxChiffres(h) + ' h ' + deuxChiffres(m) + ' min ' + deuxChiffres(s) + ' s';
    return deuxChiffres(m) + ' min ' + deuxChiffres(s) + ' s';
  }

  // « 30 € ». Pas de centimes : les paliers sont en euros entiers.
  function euros(n) {
    var v = Number(n);
    if (isNaN(v)) return '';
    return v.toLocaleString('fr-FR') + ' €';
  }

  // Date lisible, toujours exprimée à l'heure de Paris quelle que soit
  // l'heure de l'appareil du visiteur.
  function dateParis(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('fr-FR', {
      timeZone: 'Europe/Paris',
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function esc(valeur) {
    return String(valeur == null ? '' : valeur)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.ROctobreRose = {
    racine: RACINE,
    // Vide le cache pour forcer une relecture. Appelé par le catalogue et la
    // fiche d'un maillot au moment de rafraîchir les montants.
    vider: function (cle) {
      if (cle) delete cache[cle]; else cache = {};
    },
    parametres: function () {
      return charge('parametres', 'api/encheres/parametres',
                    'api/octobre-rose.json', 'OR_PARAMETRES');
    },
    maillots: function () {
      return charge('maillots', 'api/encheres/maillots',
                    'api/octobre-rose-maillots.json', 'OR_MAILLOTS');
    },
    etat: etat,
    tempsRestant: tempsRestant,
    euros: euros,
    dateParis: dateParis,
    esc: esc
  };
})();
