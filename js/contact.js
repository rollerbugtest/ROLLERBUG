/* Formulaire de contact — envoi vers la boîte mail du club.

   L'adresse de réception est portée par le formulaire lui-même
   (attributs data-endpoint et data-mailto), et rafraîchie par js/data.js
   à partir de api/club.json quand celui-ci est lisible. Le formulaire
   fonctionne donc aussi bien en ligne qu'ouvert en local.

   Si l'envoi échoue (service indisponible, hors ligne), on ne perd pas le
   message : un lien de secours ouvre le logiciel de messagerie du visiteur
   avec le texte déjà rempli. */
(function () {
  'use strict';

  var form = document.getElementById('contactForm');
  if (!form) return;

  var etat = document.getElementById('contactStatus');
  var bouton = form.querySelector('button[type="submit"]');
  var libelleBouton = bouton ? bouton.textContent : 'Envoyer le message';

  function dit(html, type) {
    if (!etat) return;
    etat.className = 'form-status' + (type ? ' ' + type : '');
    etat.innerHTML = html;
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function champs() {
    return {
      prenom: val('prenom'),
      nom: val('nom'),
      email: val('email'),
      phone: val('phone'),
      sujet: val('sujet'),
      message: val('message')
    };
  }

  // Lien de secours : ouvre le logiciel de messagerie, message déjà écrit.
  function lienMailto(d) {
    var dest = form.getAttribute('data-mailto') || '';
    if (!dest) return '';
    var sujet = 'Site Roller Bug — ' + (d.sujet || 'Message');
    var corps = 'Nom : ' + d.prenom + ' ' + d.nom + '\n' +
                'Email : ' + d.email + '\n' +
                'Téléphone : ' + (d.phone || '—') + '\n' +
                'Sujet : ' + (d.sujet || '—') + '\n\n' + d.message;
    return 'mailto:' + dest +
           '?subject=' + encodeURIComponent(sujet) +
           '&body=' + encodeURIComponent(corps);
  }

  function secours(d, raison) {
    var lien = lienMailto(d);
    var texte = raison + ' ';
    if (lien) {
      texte += '<a href="' + lien + '">Clique ici pour envoyer le message par ta messagerie</a> — ' +
               'rien n\'est perdu, le texte y sera déjà rempli.';
    } else {
      texte += 'Merci de nous écrire directement par e-mail.';
    }
    dit(texte, 'ko');
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (form.reportValidity && !form.reportValidity()) return;

    var d = champs();
    var endpoint = form.getAttribute('data-endpoint') || '';

    // Pas de service d'envoi configuré : on passe directement par la messagerie.
    if (!endpoint) {
      var lien = lienMailto(d);
      if (lien) { window.location.href = lien; dit('Ta messagerie s\'ouvre avec le message pré-rempli.', 'ok'); }
      else dit('Aucune adresse de contact configurée.', 'ko');
      return;
    }

    if (bouton) { bouton.disabled = true; bouton.textContent = 'Envoi en cours…'; }
    dit('');

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        Prénom: d.prenom,
        Nom: d.nom,
        Email: d.email,
        Téléphone: d.phone || '—',
        Sujet: d.sujet || '—',
        Message: d.message,
        _subject: 'Site Roller Bug — ' + (d.sujet || 'Message'),
        _template: 'table',
        _captcha: 'false'
      })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; });
      })
      .then(function (o) {
        var succes = o && (o.success === true || o.success === 'true');
        var message = (o && o.message) ? String(o.message) : '';

        if (succes && /confirm/i.test(message)) {
          // Première utilisation : le service demande une validation au club.
          dit('Message transmis. Le club doit valider une première fois le formulaire ' +
              '(un e-mail de confirmation vient de lui être envoyé) — les messages ' +
              'suivants arriveront directement.', 'ok');
          form.reset();
          return;
        }
        if (succes) {
          form.reset();
          dit('Message envoyé — merci ! Nous te répondons rapidement.', 'ok');
          return;
        }
        throw new Error(message || 'envoi refusé');
      })
      .catch(function (err) {
        secours(d, 'L\'envoi automatique n\'a pas abouti (' + err.message + ').');
      })
      .then(function () {
        if (bouton) { bouton.disabled = false; bouton.textContent = libelleBouton; }
      });
  });
})();
