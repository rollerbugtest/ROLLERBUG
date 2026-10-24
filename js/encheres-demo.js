/* ============================================================================
   MODE DÉMONSTRATION — essai local des enchères, sans serveur ni base.

   ⚠ CE FICHIER NE FAIT STRICTEMENT RIEN EN LIGNE.
   Il s'arrête à la première ligne si la page n'est pas ouverte en file://
   ou depuis localhost. Sur rollerbug.vercel.app il est inerte : il ne peut
   donc pas fabriquer de fausse enchère sur le vrai site.

   À quoi il sert : par double-clic, il n'y a pas de fonctions serveur. Ce
   script prend leur place pour que le parcours complet soit visible —
   formulaire, code à six chiffres, montant qui monte, minimum recalculé.

   Ce qui est simulé, et qu'il faut garder en tête :
     • les montants vivent dans l'onglet, pas dans une base ;
     • le code n'est pas envoyé par e-mail, il s'affiche dans le bandeau ;
     • rien n'est conservé : fermer l'onglet remet tout à zéro.

   Avant l'ouverture réelle des enchères, retirer les deux balises <script>
   qui appellent ce fichier dans octobre-rose/index.html et maillot.html.
   ========================================================================== */
(function () {
  'use strict';

  var local = location.protocol === 'file:' ||
    ['localhost', '127.0.0.1', '[::1]', ''].indexOf(location.hostname) !== -1;
  if (!local) return;

  /* ------------------------------------------------- état de la démo --- */

  var CLE = 'rb-demo-encheres';
  var offres = {};      // numéro de maillot -> meilleure offre
  var attente = {};     // identifiant d'offre -> { numero, montant, code }

  try {
    var garde = sessionStorage.getItem(CLE);
    if (garde) offres = JSON.parse(garde) || {};
  } catch (e) { /* stockage indisponible : on reste en mémoire */ }

  function enregistre() {
    try { sessionStorage.setItem(CLE, JSON.stringify(offres)); } catch (e) {}
  }

  var PALIER = 5;
  var MISE_A_PRIX = 30;

  function minimum(numero) {
    var m = offres[numero];
    return m == null ? MISE_A_PRIX : m + PALIER;
  }

  /* --------------------------------------------------- faux serveur --- */

  function reponse(code, corps) {
    return Promise.resolve({
      ok: code < 400,
      status: code,
      json: function () { return Promise.resolve(corps); },
      text: function () { return Promise.resolve(JSON.stringify(corps)); }
    });
  }

  function parametres() {
    var maintenant = Date.now();
    var base = window.OR_PARAMETRES || {};
    var copie = {};
    for (var k in base) if (Object.prototype.hasOwnProperty.call(base, k)) copie[k] = base[k];
    // C'est ici que la démo « change la date » : ouverture hier, clôture
    // dans cinq jours, enchères activées. Le fichier api/octobre-rose.json,
    // lui, n'est pas touché — le vrai site garde ses vraies dates.
    copie.encheresActivees = true;
    copie.etat = 'encours';
    copie.ouverture = new Date(maintenant - 24 * 3600 * 1000).toISOString();
    copie.cloture = new Date(maintenant + 5 * 24 * 3600 * 1000).toISOString();
    copie.miseAPrix = MISE_A_PRIX;
    copie.palier = PALIER;
    return copie;
  }

  function maillots() {
    return (window.OR_MAILLOTS || []).map(function (m) {
      var copie = {};
      for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) copie[k] = m[k];
      copie.meilleureOffre = offres[m.numero] == null ? null : offres[m.numero];
      copie.minimum = minimum(m.numero);
      return copie;
    });
  }

  function deposer(corps) {
    var min = minimum(corps.numero);
    if (!corps.montant || corps.montant < min) {
      return reponse(409, {
        erreur: 'MONTANT_INSUFFISANT', minimum: min,
        message: "La prochaine offre doit être d'au moins " + min + " €."
      });
    }
    if ((corps.montant - min) % PALIER !== 0) {
      return reponse(400, {
        erreur: 'PALIER_NON_RESPECTE', palier: PALIER,
        message: 'Les offres vont de ' + PALIER + ' en ' + PALIER + ' €.'
      });
    }
    var code = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    var id = 'demo-' + Date.now();
    attente[id] = { numero: corps.numero, montant: corps.montant, code: code };
    annonceCode(code, corps.email);
    return reponse(201, { id: id, minimum: min, courrielEnvoye: true });
  }

  function confirmer(corps) {
    var o = attente[corps.id];
    if (!o) return reponse(404, { statut: 'inconnue', message: 'Offre introuvable.' });
    if (corps.code !== o.code) {
      return reponse(400, {
        statut: 'code_invalide',
        message: "Ce code ne correspond pas. En démonstration, il est écrit dans le bandeau rose."
      });
    }
    var min = minimum(o.numero);
    if (o.montant < min) {
      return reponse(409, {
        erreur: 'SURENCHERIE', minimum: min,
        message: "Quelqu'un est passé devant vous. La prochaine offre doit être d'au moins " + min + " €."
      });
    }
    offres[o.numero] = o.montant;
    enregistre();
    delete attente[corps.id];
    cacheCode();
    return reponse(200, {
      statut: 'confirmee', montant: o.montant,
      message: 'Votre offre est enregistrée. Merci ! (démonstration)'
    });
  }

  /* ------------------------------------- interception des appels --- */

  var vraiFetch = window.fetch ? window.fetch.bind(window) : null;

  window.fetch = function (url, options) {
    var chemin = String(url);
    if (chemin.indexOf('api/encheres/') === -1) {
      return vraiFetch ? vraiFetch(url, options) : Promise.reject(new Error('fetch indisponible'));
    }
    var corps = {};
    try { corps = options && options.body ? JSON.parse(options.body) : {}; } catch (e) {}

    if (chemin.indexOf('parametres') !== -1) return reponse(200, parametres());
    if (chemin.indexOf('maillots') !== -1) return reponse(200, maillots());
    if (chemin.indexOf('offrir') !== -1) return deposer(corps);
    if (chemin.indexOf('confirmer') !== -1) return confirmer(corps);
    return reponse(404, { message: 'Route inconnue en démonstration.' });
  };

  /* ------------------------------------------------------ bandeau --- */

  var bandeau, zoneCode;

  function construitBandeau() {
    bandeau = document.createElement('div');
    bandeau.setAttribute('role', 'status');
    bandeau.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:200;' +
      'background:#c61e6e;color:#fff;padding:11px 16px;font-family:monospace;' +
      'font-size:13px;line-height:1.5;text-align:center;' +
      'box-shadow:0 -4px 20px rgba(0,0,0,.4);';
    bandeau.innerHTML =
      '<strong>MODE DÉMONSTRATION</strong> — aucune offre réelle, aucun e-mail envoyé. ' +
      'Les montants ne vivent que dans cet onglet. ' +
      '<span id="orDemoCode"></span> ' +
      '<button type="button" id="orDemoRaz" style="margin-left:10px;background:#fff;' +
      'color:#c61e6e;border:0;border-radius:6px;padding:4px 10px;font-family:monospace;' +
      'font-size:12px;cursor:pointer;">Remettre à zéro</button>';
    document.body.appendChild(bandeau);
    // De la place sous le bandeau, pour ne rien masquer en bas de page.
    document.body.style.paddingBottom = '64px';
    zoneCode = document.getElementById('orDemoCode');
    document.getElementById('orDemoRaz').addEventListener('click', function () {
      offres = {}; attente = {}; enregistre(); location.reload();
    });
  }

  function annonceCode(code, email) {
    if (!zoneCode) return;
    zoneCode.innerHTML = '<br><strong style="font-size:16px;letter-spacing:3px;">' +
      'Code à saisir : ' + code + '</strong>' +
      '<span style="opacity:.8;"> — en vrai, il partirait par e-mail à ' +
      String(email || '').replace(/[<>&"]/g, '') + '</span>';
  }

  function cacheCode() { if (zoneCode) zoneCode.innerHTML = ''; }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', construitBandeau);
  } else {
    construitBandeau();
  }

  console.info('[octobre-rose] mode démonstration actif — aucune donnée réelle.');
})();
