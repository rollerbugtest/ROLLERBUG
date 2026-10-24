/* ============================================================================
   Fiche d'un maillot.

   Une seule page HTML pour les 21 maillots : le numéro vient de l'URL
   (maillot.html?n=88) et tout le reste des données. Il n'y a donc pas
   21 fichiers à maintenir, et ajouter un maillot ne demande aucune page
   supplémentaire.

   Tant que les enchères ne sont pas ouvertes, la zone d'offre explique l'état
   de l'opération au lieu d'afficher un formulaire qui ne mènerait nulle part.
   Le formulaire et sa vérification par e-mail arrivent avec les routes
   serveur : aucune offre ne sera jamais validée par ce fichier, qui ne fait
   qu'afficher ce que le serveur a dit.
   ========================================================================== */
(function () {
  'use strict';

  var zone = document.getElementById('orFiche');
  if (!zone || !window.ROctobreRose) return;

  var OR = window.ROctobreRose;
  var esc = OR.esc;
  var horloge = null;
  var parametres = null;
  var maillot = null;
  // Conservé entre deux rendus : sans ça, le rafraîchissement des montants
  // qui suit la confirmation effacerait le « c'est enregistré » sous les yeux
  // de la personne.
  var confirmationReussie = null;

  function numeroDemande() {
    var n = new URLSearchParams(window.location.search).get('n');
    return n === null ? null : String(n).trim();
  }

  /* ------------------------------------------------------------- rendu --- */

  function introuvable() {
    zone.innerHTML = '<div class="or-fiche-introuvable">' +
      '<p>Ce maillot n’existe pas dans le catalogue.</p>' +
      '<p style="margin-top:14px;"><a class="btn-rose" href="index.html">Voir tous les maillots</a></p>' +
      '</div>';
    document.title = 'Maillot introuvable — Enchères Octobre Rose';
  }

  /* ------------------------------------------------------- formulaire --- */

  // Le formulaire est écrit ici plutôt que dans la page : il n'a de sens que
  // pendant les enchères, et son montant minimum change à chaque offre.
  function formulaire(m, minimum) {
    var palier = parametres ? parametres.palier : 5;
    return '<form class="or-form" id="orForm" hidden novalidate>' +
      '<div class="or-form-lignes">' +
        champ('orPrenom', 'Prénom', 'text', 'given-name', true) +
        champ('orNom', 'Nom', 'text', 'family-name', true) +
        champ('orEmail', 'Adresse e-mail', 'email', 'email', true) +
        champ('orTel', 'Téléphone', 'tel', 'tel', true) +
        '<div class="or-form-champ or-form-champ--large">' +
          '<label for="orMontant">Votre offre, en euros</label>' +
          '<input type="number" id="orMontant" name="montant" inputmode="numeric" ' +
            'min="' + minimum + '" step="' + palier + '" value="' + minimum + '" required>' +
          '<span class="or-form-aide">Minimum ' + OR.euros(minimum) +
            ', puis de ' + palier + ' en ' + palier + ' €.</span>' +
        '</div>' +
        '<label class="or-form-case">' +
          '<input type="checkbox" id="orReglement" required>' +
          '<span>J’accepte le règlement des enchères. Mes coordonnées servent ' +
          'uniquement au club pour me recontacter si je remporte ce maillot ; ' +
          'elles ne sont jamais affichées sur le site.</span>' +
        '</label>' +
      '</div>' +
      '<div class="or-actions">' +
        '<button type="submit" class="btn-rose" id="orEnvoyer">Envoyer mon offre</button>' +
      '</div>' +
      '<div class="or-message" id="orMessage" hidden role="status" aria-live="polite"></div>' +
      '</form>' +

      // Deuxième temps : le code reçu par e-mail. Tant qu'il n'est pas saisi,
      // l'offre n'existe pas pour les autres visiteurs.
      '<form class="or-form" id="orFormCode" hidden novalidate>' +
        '<p class="or-fiche-minimum" id="orCodeIntro"></p>' +
        '<div class="or-form-champ">' +
          '<label for="orCode">Code à six chiffres</label>' +
          '<input class="or-code" type="text" id="orCode" inputmode="numeric" ' +
            'autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" required>' +
        '</div>' +
        '<div class="or-actions">' +
          '<button type="submit" class="btn-rose" id="orValider">Valider mon offre</button>' +
        '</div>' +
        '<div class="or-message" id="orMessageCode" hidden role="status" aria-live="polite"></div>' +
      '</form>' +
      '<div class="or-message" id="orMessageFinal" hidden role="status" aria-live="polite"></div>';
  }

  function champ(id, libelle, type, autocomplete, requis) {
    return '<div class="or-form-champ">' +
      '<label for="' + id + '">' + libelle + '</label>' +
      '<input type="' + type + '" id="' + id + '" autocomplete="' + autocomplete + '"' +
      (requis ? ' required' : '') + '></div>';
  }

  function zoneOffre(m, etat) {
    var offre = typeof m.meilleureOffre === 'number' ? m.meilleureOffre : null;
    var libelle = offre === null ? 'Mise à prix' : 'Meilleure offre';
    var montant = offre === null ? m.prixDepart : offre;
    var minimum = offre === null ? m.prixDepart : offre + (parametres ? parametres.palier : 5);

    var html = '<div class="or-fiche-offre">' +
      '<span class="or-fiche-offre-libelle">' + libelle + '</span>' +
      '<span class="or-fiche-offre-valeur">' + OR.euros(montant) + '</span>';

    if (etat === 'encours') {
      html += '<p class="or-fiche-minimum" id="orMinimum">Prochaine offre minimum : ' +
        OR.euros(minimum) + '</p>' +
        '<div class="or-compteur" id="orCompteur"></div>' +
        '<div class="or-actions"><button type="button" class="btn-rose" id="orOuvrirForm">' +
        'Enchérir sur ce maillot</button></div>' +
        formulaire(m, minimum);
    } else if (etat === 'avant') {
      html += '<p class="or-fiche-minimum">Première offre possible : ' +
        OR.euros(m.prixDepart) + '</p>' +
        '<div class="or-compteur" id="orCompteur"></div>';
    } else if (etat === 'termine') {
      html += '<p class="or-fiche-minimum">Les enchères sont terminées. ' +
        'Le club recontacte directement la personne qui a remporté ce maillot.</p>';
    } else {
      html += '<p class="or-fiche-minimum">Les enchères ne sont pas encore ouvertes. ' +
        'La date d’ouverture sera annoncée sur la page d’accueil et sur nos réseaux.</p>' +
        '<div class="or-compteur"><span class="or-badge">Ouverture prochainement</span></div>';
    }

    return html + '</div>';
  }

  function rendre(m, p) {
    var etat = OR.etat(p);
    var photo = Array.isArray(m.photos) && m.photos.length ? m.photos[0] : '';

    var visuel;
    if (photo) {
      var alt = m.photoIllustration
        ? 'Modèle du maillot Octobre Rose du Roller Bug'
        : 'Maillot numéro ' + m.numero + ', ' + m.nom;
      visuel = '<div class="or-fiche-visuel" style="background-image:url(&quot;' +
        esc(OR.racine + photo) + '&quot;);" role="img" aria-label="' + esc(alt) + '">' +
        (m.photoIllustration
          ? '<span class="or-fiche-attente">Photo d’illustration</span>' : '') +
        '</div>';
    } else {
      visuel = '<div class="or-fiche-visuel">' +
        '<span class="or-fiche-numero" aria-hidden="true">' + esc(m.numero) + '</span>' +
        '<span class="or-fiche-attente">Photo à venir</span></div>';
    }

    // Le modèle recto-verso : il montre où vont le nom et le numéro. Le « 89 »
    // qu'il porte est celui du gabarit du fabricant, on le dit noir sur blanc.
    var modele = m.photoIllustration
      ? '<figure class="or-modele">' +
          '<img src="' + esc(OR.racine + 'images/octobre-rose/maillot-modele.webp') +
          '" alt="Le maillot Octobre Rose du Roller Bug, vu de face et de dos" loading="lazy">' +
          '<figcaption>Le modèle, recto-verso. Le maillot mis en vente porte ' +
          esc(m.nom) + ' et le numéro ' + esc(m.numero) + ' — le « 89 » visible ' +
          'ici est celui du gabarit du fabricant.</figcaption>' +
        '</figure>'
      : '';

    zone.innerHTML = '<div class="or-fiche">' + visuel + '<div>' +
      '<span class="or-fiche-poste">' + esc(m.posteLibelle) + '</span>' +
      '<h1 class="or-fiche-nom">' + esc(m.nom) + '</h1>' +
      '<p class="or-fiche-meta">Numéro ' + esc(m.numero) + ' · Taille ' + esc(m.taille) + '</p>' +
      '<p class="or-fiche-description">' + esc(m.description) + '</p>' +
      zoneOffre(m, etat) +
      '<p style="margin-top:22px;"><a class="or-retour" href="index.html">← Tous les maillots</a></p>' +
      '</div></div>' + modele;

    document.title = m.nom + ' n°' + m.numero + ' — Enchères Octobre Rose';
    majCompteur();
    brancheFormulaire(m);

    if (confirmationReussie) {
      var actions = document.getElementById('orOuvrirForm');
      if (actions && actions.parentNode) actions.parentNode.hidden = true;
      affiche('orMessageFinal', confirmationReussie, 'ok');
    }
  }

  /* ------------------------------------------- envoi et confirmation --- */

  var offreEnCours = null;   // identifiant rendu par le serveur

  function affiche(idZone, texte, genre) {
    var el = document.getElementById(idZone);
    if (!el) return;
    el.textContent = texte;
    el.className = 'or-message' + (genre ? ' or-message--' + genre : '');
    el.hidden = !texte;
  }

  function occupe(bouton, oui, libelle) {
    if (!bouton) return;
    bouton.disabled = oui;
    bouton.textContent = oui ? 'Un instant…' : libelle;
  }

  // Une seule porte vers le serveur : toute réponse non JSON ou tout échec
  // réseau ressort ici avec un message compréhensible.
  function appelServeur(chemin, donnees) {
    return fetch(OR.racine + chemin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(donnees)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (corps) {
        return { ok: r.ok, corps: corps || {} };
      });
    }).catch(function () {
      return { ok: false, corps: { message: 'Connexion impossible. Vérifiez votre réseau.' } };
    });
  }

  function brancheFormulaire(m) {
    var ouvrir = document.getElementById('orOuvrirForm');
    var form = document.getElementById('orForm');
    var formCode = document.getElementById('orFormCode');
    if (!ouvrir || !form) return;

    ouvrir.addEventListener('click', function () {
      form.hidden = false;
      ouvrir.parentNode.hidden = true;
      var premier = document.getElementById('orPrenom');
      if (premier) premier.focus();
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var bouton = document.getElementById('orEnvoyer');
      var donnees = {
        numero: m.numero,
        prenom: val('orPrenom'), nom: val('orNom'),
        email: val('orEmail'), telephone: val('orTel'),
        montant: parseInt(val('orMontant'), 10),
        reglement: document.getElementById('orReglement').checked
      };

      // Contrôle d'abord ici pour répondre tout de suite ; le serveur
      // revérifie tout de toute façon.
      if (!donnees.prenom || !donnees.nom || !donnees.email || !donnees.telephone) {
        return affiche('orMessage', 'Merci de remplir tous les champs.', 'erreur');
      }
      if (!donnees.reglement) {
        return affiche('orMessage', 'Merci d’accepter le règlement des enchères.', 'erreur');
      }

      occupe(bouton, true);
      affiche('orMessage', '', null);
      appelServeur('api/encheres/offrir', donnees).then(function (r) {
        occupe(bouton, false, 'Envoyer mon offre');
        if (!r.ok) {
          affiche('orMessage', r.corps.message || 'Votre offre n’a pas pu être envoyée.', 'erreur');
          // Dépassé entre-temps : on remet le bon minimum dans le champ.
          if (r.corps.minimum) majMinimum(r.corps.minimum);
          return;
        }
        offreEnCours = r.corps.id;
        form.hidden = true;
        formCode.hidden = false;
        document.getElementById('orCodeIntro').textContent =
          'Un code à six chiffres vient d’être envoyé à ' + donnees.email +
          '. Votre offre ne sera enregistrée qu’une fois ce code saisi.';
        document.getElementById('orCode').focus();
      });
    });

    formCode.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var bouton = document.getElementById('orValider');
      var code = val('orCode').replace(/\s/g, '');
      if (!/^\d{6}$/.test(code)) {
        return affiche('orMessageCode', 'Le code comporte six chiffres.', 'erreur');
      }
      occupe(bouton, true);
      affiche('orMessageCode', '', null);
      appelServeur('api/encheres/confirmer', { id: offreEnCours, code: code })
        .then(function (r) {
          occupe(bouton, false, 'Valider mon offre');
          if (!r.ok) {
            affiche('orMessageCode', r.corps.message || 'Code refusé.', 'erreur');
            if (r.corps.minimum) majMinimum(r.corps.minimum);
            return;
          }
          formCode.hidden = true;
          confirmationReussie = r.corps.message || 'Votre offre est enregistrée.';
          affiche('orMessageFinal', confirmationReussie, 'ok');
          // Le montant affiché doit refléter l'offre à l'instant même. Le
          // formulaire étant refermé, le re-rendu complet est sans danger,
          // et il réaffiche le message grâce à confirmationReussie.
          OR.vider(); charge();
        });
    });
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function majMinimum(minimum) {
    var champMontant = document.getElementById('orMontant');
    if (champMontant) {
      champMontant.min = minimum;
      champMontant.value = minimum;
    }
    var ligne = document.getElementById('orMinimum');
    if (ligne) ligne.textContent = 'Prochaine offre minimum : ' + OR.euros(minimum);
  }

  /* -------------------------------------------------- compte à rebours --- */

  function majCompteur() {
    var el = document.getElementById('orCompteur');
    if (!el || !parametres) { arreteHorloge(); return; }
    var e = OR.etat(parametres);
    if (e !== 'avant' && e !== 'encours') { arreteHorloge(); return; }
    var cible = Date.parse(e === 'avant' ? parametres.ouverture : parametres.cloture);
    el.innerHTML = '<span class="or-compteur-libelle">' +
      (e === 'avant' ? 'Ouverture dans' : 'Clôture dans') + '</span>' +
      '<span class="or-compteur-valeur">' + OR.tempsRestant(cible - Date.now()) + '</span>';
    if (!horloge) horloge = setInterval(majCompteur, 1000);
  }

  function arreteHorloge() { if (horloge) { clearInterval(horloge); horloge = null; } }

  /* -------------------------------------------------------- chargement --- */

  // Un formulaire ouvert ne doit JAMAIS être rebâti sous les doigts du
  // visiteur : il perdrait sa saisie en pleine frappe. Dans ce cas on se
  // contente de rafraîchir les montants affichés.
  function formOuvert() {
    var f = document.getElementById('orForm');
    var c = document.getElementById('orFormCode');
    return (f && !f.hidden) || (c && !c.hidden);
  }

  function rafraichirMontants(m) {
    var offre = typeof m.meilleureOffre === 'number' ? m.meilleureOffre : null;
    var valeur = document.querySelector('.or-fiche-offre-valeur');
    var libelle = document.querySelector('.or-fiche-offre-libelle');
    if (valeur) valeur.textContent = OR.euros(offre === null ? m.prixDepart : offre);
    if (libelle) libelle.textContent = offre === null ? 'Mise à prix' : 'Meilleure offre';

    var minimum = offre === null
      ? m.prixDepart
      : offre + (parametres ? parametres.palier : 5);
    var ligne = document.getElementById('orMinimum');
    if (ligne) ligne.textContent = 'Prochaine offre minimum : ' + OR.euros(minimum);
    // On relève le plancher du champ, mais on ne touche pas à ce que la
    // personne a tapé : le serveur tranchera, avec un message clair.
    var champMontant = document.getElementById('orMontant');
    if (champMontant) champMontant.min = minimum;
  }

  function charge() {
    return Promise.all([OR.maillots(), OR.parametres()]).then(function (res) {
      var liste = res[0];
      parametres = res[1];
      if (!liste) return;
      var n = numeroDemande();
      var trouve = liste.filter(function (m) {
        return String(m.numero) === n && m.visible !== false;
      })[0];
      if (!trouve) { introuvable(); return; }
      maillot = trouve;
      if (formOuvert()) { rafraichirMontants(trouve); majCompteur(); return; }
      rendre(trouve, parametres);
    });
  }

  // Les montants évoluent pendant les enchères : on relit régulièrement, mais
  // jamais quand l'onglet est en arrière-plan.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { arreteHorloge(); return; }
    OR.vider(); charge();
  });

  charge().then(function () {
    setInterval(function () {
      if (document.hidden) return;
      OR.vider(); charge();
    }, 30000);
  });
})();
