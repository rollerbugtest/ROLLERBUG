/* Interface des comptes : bouton dans l'en-tête + fenêtre connexion /
   création de compte / profil. S'appuie entièrement sur js/auth.js. */
(function () {
  'use strict';

  var bouton, dlg, corps, onglets;
  var vue = 'connexion';   // connexion | inscription | profil

  function e(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  function initiales(u) {
    var a = (u.firstName || u.email || '?').charAt(0);
    var b = (u.lastName || '').charAt(0);
    return (a + b).toUpperCase();
  }

  /* ------------------------------------------------------------- en-tête - */

  function majBouton(u) {
    if (!bouton) return;
    if (u) {
      bouton.textContent = initiales(u);
      bouton.classList.add('connecte');
      bouton.setAttribute('aria-label', 'Mon compte — ' + (u.firstName || u.email));
      bouton.title = (u.firstName + ' ' + u.lastName).trim() || u.email;
    } else {
      bouton.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>' +
        '<circle cx="12" cy="7" r="4"></circle></svg>';
      bouton.classList.remove('connecte');
      bouton.setAttribute('aria-label', 'Se connecter');
      bouton.title = 'Mon compte';
    }
  }

  /* -------------------------------------------------------------- rendus - */

  function message(texte, type) {
    var p = document.getElementById('compteMsg');
    if (!p) return;
    p.className = 'compte-msg' + (type ? ' ' + type : '');
    p.textContent = texte || '';
  }

  function champ(id, label, type, ph, autocomplete) {
    var wrap = e('div', 'fg');
    var l = e('label', null, label); l.setAttribute('for', id);
    var i = e('input'); i.id = id; i.type = type; i.placeholder = ph || '';
    if (autocomplete) i.autocomplete = autocomplete;
    wrap.appendChild(l); wrap.appendChild(i);
    return wrap;
  }

  function occupe(oui, libelle) {
    var b = corps.querySelector('button[type="submit"]');
    if (!b) return;
    b.disabled = oui;
    b.textContent = oui ? 'Un instant…' : libelle;
  }

  function dessine() {
    corps.innerHTML = '';
    var u = window.RollerBugAuth.getUser();

    // ------------------------------------------------------------- profil --
    if (u) {
      onglets.hidden = true;
      var titre = e('h3', 'compte-titre', 'Bonjour ' + (u.firstName || '') + ' 👋');
      corps.appendChild(titre);
      corps.appendChild(e('p', 'compte-sous', u.email));

      var form = e('form', 'compte-form');
      var ligne = e('div', 'form-row');
      ligne.appendChild(champ('cPrenom', 'Prénom', 'text', '', 'given-name'));
      ligne.appendChild(champ('cNom', 'Nom', 'text', '', 'family-name'));
      form.appendChild(ligne);

      var valider = e('button', 'btn btn-primary', 'Enregistrer');
      valider.type = 'submit'; valider.style.width = '100%';
      form.appendChild(valider);
      corps.appendChild(form);

      document.getElementById('cPrenom').value = u.firstName || '';
      document.getElementById('cNom').value = u.lastName || '';

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        occupe(true);
        window.RollerBugAuth.updateAccount({
          firstName: document.getElementById('cPrenom').value,
          lastName: document.getElementById('cNom').value
        }).then(function (r) {
          occupe(false, 'Enregistrer');
          message(r.ok ? 'Modifications enregistrées.' : r.error, r.ok ? 'ok' : 'ko');
        });
      });

      var fav = window.RollerBugAuth.getFavorites();
      var total = fav.teams.length + fav.disciplines.length;
      corps.appendChild(e('p', 'compte-sous',
        total ? total + ' favori(s) synchronisé(s) avec l’application.'
              : 'Aucun favori pour l’instant — ajoute des équipes depuis l’application, tu les retrouveras ici.'));

      var deco = e('button', 'btn btn-ghost', 'Se déconnecter');
      deco.style.width = '100%';
      deco.addEventListener('click', function () {
        window.RollerBugAuth.signOut().then(function () {
          vue = 'connexion'; message(''); dessine();
        });
      });
      corps.appendChild(deco);
      return;
    }

    // -------------------------------------------------- connexion / création
    onglets.hidden = false;
    Array.prototype.forEach.call(onglets.children, function (b) {
      b.classList.toggle('on', b.dataset.vue === vue);
      b.setAttribute('aria-selected', b.dataset.vue === vue ? 'true' : 'false');
    });

    var f = e('form', 'compte-form');

    if (vue === 'inscription') {
      var r = e('div', 'form-row');
      r.appendChild(champ('cPrenom', 'Prénom', 'text', 'Jean', 'given-name'));
      r.appendChild(champ('cNom', 'Nom', 'text', 'Dupont', 'family-name'));
      f.appendChild(r);
    }

    f.appendChild(champ('cEmail', 'Email', 'email', 'jean.dupont@email.fr', 'email'));
    f.appendChild(champ('cMdp', 'Mot de passe', 'password', '',
                        vue === 'inscription' ? 'new-password' : 'current-password'));

    if (vue === 'inscription') {
      f.appendChild(e('p', 'compte-aide',
        'Au moins ' + window.RollerBugAuth.PASSWORD_MIN + ' caractères.'));
    }

    var envoi = e('button', 'btn btn-primary',
                  vue === 'inscription' ? 'Créer mon compte' : 'Se connecter');
    envoi.type = 'submit'; envoi.style.width = '100%';
    f.appendChild(envoi);

    if (vue === 'connexion') {
      var oubli = e('button', 'compte-lien', 'Mot de passe oublié ?');
      oubli.type = 'button';
      oubli.addEventListener('click', function () {
        var mail = document.getElementById('cEmail').value;
        if (!mail) { message('Saisis d’abord ton adresse email.', 'ko'); return; }
        window.RollerBugAuth.resetPassword(mail).then(function (r) {
          message(r.ok ? 'Un lien de réinitialisation vient d’être envoyé à ' + mail + '.' : r.error,
                  r.ok ? 'ok' : 'ko');
        });
      });
      f.appendChild(oubli);
    }

    corps.appendChild(f);

    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      message('');
      var libelle = envoi.textContent;
      occupe(true);

      var suite;
      if (vue === 'inscription') {
        suite = window.RollerBugAuth.signUp({
          firstName: document.getElementById('cPrenom').value,
          lastName: document.getElementById('cNom').value,
          email: document.getElementById('cEmail').value,
          password: document.getElementById('cMdp').value
        });
      } else {
        suite = window.RollerBugAuth.signIn({
          email: document.getElementById('cEmail').value,
          password: document.getElementById('cMdp').value
        });
      }

      suite.then(function (r) {
        occupe(false, libelle);
        if (!r.ok) { message(r.error, 'ko'); return; }
        if (r.pendingConfirmation) {
          message('Compte créé. Ouvre le mail de confirmation reçu à cette adresse, ' +
                  'puis reviens te connecter.', 'ok');
          return;
        }
        message('');
        dessine();
      });
    });
  }

  /* --------------------------------------------------------- construction - */

  function construit() {
    bouton = document.getElementById('accountBtn');
    dlg = document.getElementById('compteDlg');
    if (!bouton || !dlg) return;

    corps = document.getElementById('compteCorps');
    onglets = document.getElementById('compteOnglets');

    Array.prototype.forEach.call(onglets.children, function (b) {
      b.addEventListener('click', function () {
        vue = b.dataset.vue; message(''); dessine();
      });
    });

    bouton.addEventListener('click', function () {
      if (!window.RollerBugAuth.estConfigure()) {
        message('Les comptes ne sont pas encore activés sur ce site.', 'ko');
      }
      dessine();
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    });

    dlg.addEventListener('click', function (ev) {
      if (ev.target === dlg) dlg.close();   // clic sur le fond
    });
    var fermer = document.getElementById('compteFermer');
    if (fermer) fermer.addEventListener('click', function () { dlg.close(); });

    window.RollerBugAuth.onChange(function (u) {
      majBouton(u);
      // Préremplit le formulaire de contact quand on est connecté.
      if (u) {
        var champs = { prenom: u.firstName, nom: u.lastName, email: u.email };
        Object.keys(champs).forEach(function (id) {
          var el = document.getElementById(id);
          if (el && !el.value && champs[id]) el.value = champs[id];
        });
      }
      if (dlg.open) dessine();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', construit);
  else construit();
})();
