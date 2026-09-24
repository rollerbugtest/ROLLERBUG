/* ============================================================================
   Données partagées site ↔ application mobile.

   Le contenu du club vit dans api/*.json. Ce script les charge et remplace
   les sections correspondantes de la page. L'application mobile lit
   EXACTEMENT les mêmes fichiers : modifier un JSON met à jour le site,
   l'iPhone et l'Android en même temps.

   Sécurité d'affichage : le HTML écrit en dur dans index.html reste en place
   tant que les données ne sont pas arrivées. Si le réseau échoue, le visiteur
   voit la dernière version connue plutôt qu'une page vide.

   Ce script publie window.rollerbugDataReady, une promesse que calendrier.js
   et animations.js attendent avant de s'initialiser — sinon ils travailleraient
   sur des éléments déjà remplacés.
   ========================================================================== */
(function () {
  'use strict';

  var API = 'api/';

  var FICHIERS = [
    'club', 'disciplines', 'planning', 'teams',
    'news', 'events', 'bureau', 'communication', 'inscriptions', 'matches'
  ];

  /* ---------- Utilitaires ---------- */

  // Échappe tout ce qui vient du JSON : une apostrophe ou un « & » dans un
  // nom d'équipe ne doit jamais casser la page.
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function set(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  // « 17:45 » → « 17h45 », la notation utilisée partout sur le site.
  function heure(hhmm) {
    return String(hhmm || '').replace(':', 'h');
  }

  var JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  /* ---------- Rendus ---------- */

  function rendreActualites(news) {
    if (!Array.isArray(news) || !news.length) return;
    set('newsBand', news.map(function (item) {
      var entete = function (fleche) {
        return '<span class="news-entete">' +
          '<span class="news-date">' + esc(item.dateLabel) + '</span>' +
          (fleche ? '<span class="news-fleche" aria-hidden="true">' + fleche + '</span>' : '') +
          '</span>';
      };
      var corps = '<h3 class="news-title">' + esc(item.title) + '</h3>' +
        '<span class="news-place">' + esc(item.place || '') + '</span>';

      // Plusieurs rencontres pour une même équipe : la carte n'est plus un
      // lien unique, elle porte un bouton par rencontre.
      if (Array.isArray(item.links) && item.links.length > 1) {
        return '<article class="news-item news-item--multi">' + entete('') + corps +
          '<span class="news-liens">' + item.links.map(function (l) {
            return '<a class="news-lien" href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
              esc(l.label) + '<span aria-hidden="true">↗</span>' +
              '<span class="sr-only"> (ouvre un nouvel onglet)</span></a>';
          }).join('') + '</span></article>';
      }

      // url absente  -> renvoie aux inscriptions ;
      // url en « # »  -> ancre interne de la page ;
      // url complète  -> site extérieur, ouvert dans un nouvel onglet.
      var brut = item.url || (item.links && item.links[0] && item.links[0].url) || '#inscriptions';
      var externe = brut.charAt(0) !== '#';
      return '<a class="news-item' + (externe ? ' news-item--externe' : '') +
        '" href="' + esc(brut) + '"' + (externe ? ' target="_blank" rel="noopener"' : '') + '>' +
        entete(externe ? '↗' : '→') + corps +
        (externe ? '<span class="sr-only"> (ouvre un nouvel onglet)</span>' : '') +
        '</a>';
    }).join(''));
  }

  function rendreDisciplines(list) {
    if (!Array.isArray(list) || !list.length) return;
    set('discGrid', list.map(function (d) {
      return '<div class="disc-card glass">' +
        '<div class="disc-ico">' + esc(d.icon) + '</div>' +
        '<h3>' + esc(d.name) + '</h3>' +
        '<p>' + esc(d.description) + '</p>' +
        '<div class="disc-tarif">' + esc(d.price) + '</div>' +
        '</div>';
    }).join(''));
  }

  function rendreEvenements(events) {
    if (!Array.isArray(events) || !events.length) return;
    set('eventsGrid', events.map(carteEvenement).join(''));
    document.dispatchEvent(new CustomEvent('rollerbug:evenements'));
  }

  function rendrePlanning(planning) {
    if (!planning || !Array.isArray(planning.slots) || !planning.slots.length) return;

    var jours = '';
    var onglets = '';
    for (var jour = 1; jour <= 7; jour++) {
      var creneaux = planning.slots
        .filter(function (s) { return s.weekday === jour; })
        .sort(function (a, b) { return a.start.localeCompare(b.start); });

      onglets += '<button type="button" class="cal-jour-onglet" data-jour="' + jour + '"' +
        ' aria-pressed="false"><span class="cal-jour-nom">' + JOURS[jour] + '</span>' +
        '<span class="cal-jour-nb">' + creneaux.length + '</span></button>';

      jours += '<div class="cal-day" data-jour="' + jour + '">' +
        '<h3 class="cal-day-name">' + JOURS[jour] + '</h3>' +
        '<div class="cal-day-liste">' +
        creneaux.map(function (s) {
          return '<article class="cal-slot" data-disc="' + esc(s.discipline) + '">' +
            '<div class="cal-time"><span class="cal-h">' + heure(s.start) + '</span>' +
              '<span class="cal-h-fin">' + heure(s.end) + '</span></div>' +
            '<div class="cal-corps">' +
              '<h4 class="cal-cat">' + esc(s.category) + '</h4>' +
              (s.meta ? '<p class="cal-meta">' + esc(s.meta) + '</p>' : '') +
            '</div></article>';
        }).join('') +
        '<p class="cal-vide" hidden>Aucun cours de cette discipline ce jour-là.</p>' +
        '</div></div>';
    }

    set('calWeek', jours);
    set('calJours', onglets);
    if (planning.note) set('calNote', esc(planning.note));
    document.dispatchEvent(new CustomEvent('rollerbug:planning'));
  }

  function rendreHockey(bloc) {
    if (!bloc) return;

    if (Array.isArray(bloc.teams) && bloc.teams.length) {
      // Mêmes regroupements que la version d'origine du site.
      var GROUPES = [
        { titre: 'Loisirs adultes', niveaux: ['loisir'] },
        { titre: 'École de hockey (jeunes)', niveaux: ['ecole', 'jeunes', 'gardiens'] },
        { titre: 'Compétition seniors', niveaux: ['national', 'feminin'] }
      ];

      var html = GROUPES.map(function (groupe) {
        var equipes = bloc.teams.filter(function (t) {
          return groupe.niveaux.indexOf(t.level) !== -1;
        });
        if (!equipes.length) return '';

        return '<div class="team-block-title">' + esc(groupe.titre) + '</div>' +
          equipes.map(function (t) {
            var prix = esc(t.price);
            var classe = /inclus/i.test(t.price) ? 'tp muted' : 'tp';
            // Le prénom du coach s'affiche ici, dans la section hockey —
            // volontairement absent du planning hebdomadaire.
            var coach = (Array.isArray(t.coaches) && t.coaches.length)
              ? '<span class="tc">' + esc(t.coaches.join(' & ')) + '</span>'
              : '';
            return '<div class="team-row">' +
              '<div class="tn">' + esc(t.name) + coach + '</div>' +
              '<div class="ts">' + esc(t.schedule) + '</div>' +
              '<div class="' + classe + '">' + prix + '</div>' +
              '</div>';
          }).join('');
      }).join('');

      set('teamList', html);
    }

    // Grille tarifaire de la section hockey : deux colonnes loisir /
    // compétition, par tranche d'âge, plus le cours supplémentaire.
    if (bloc.tarifs && Array.isArray(bloc.tarifs.grilles)) {
      var t = bloc.tarifs;
      var grilles = t.grilles.map(function (g) {
        return '<div class="tarif-carte tarif-' +
          (/comp/i.test(g.titre) ? 'competition' : 'loisir') + '">' +
          '<h4 class="tarif-titre">' + esc(g.titre) + '</h4>' +
          '<ul class="tarif-lignes">' + g.lignes.map(function (l) {
            return '<li><span class="tarif-cat">' + esc(l.label) +
              (l.annees ? '<span class="tarif-annees">' + esc(l.annees) + '</span>' : '') +
              '</span><span class="tarif-prix">' + esc(l.prix) + '</span></li>';
          }).join('') + '</ul></div>';
      }).join('');

      var sup = t.supplement
        ? '<p class="tarif-sup"><span>' + esc(t.supplement.label) + '</span>' +
          '<strong>' + esc(t.supplement.prix) + '</strong></p>'
        : '';
      var note = t.note ? '<p class="tarif-note">' + esc(t.note) + '</p>' : '';

      set('hockeyTarifs', '<div class="tarif-grilles">' + grilles + '</div>' + sup + note);
    }

    if (Array.isArray(bloc.coaches) && bloc.coaches.length) {
      set('coachesGrid', bloc.coaches.map(function (c) {
        return '<div class="coach glass">' +
          '<div class="coach-name">' + esc(c.name) + '</div>' +
          '<div class="coach-role">' + esc(c.role) + '</div>' +
          '</div>';
      }).join(''));
    }

    if (Array.isArray(bloc.philosophy) && bloc.philosophy.length) {
      set('philosophyList', bloc.philosophy.map(function (p) {
        return '<li><strong>' + esc(p.title) + '</strong> — ' + esc(p.text) + '</li>';
      }).join(''));
    }
  }

  function rendreInscriptions(insc) {
    if (!insc) return;

    if (Array.isArray(insc.openDoors) && insc.openDoors.length) {
      set('datesBox', insc.openDoors.map(function (d, i) {
        var style = i === insc.openDoors.length - 1 ? ' style="margin-top:10px"' : '';
        return '<p' + style + '><strong>' + esc(d.label) + '</strong> — ' + esc(d.detail) + '</p>';
      }).join(''));
    }

    if (Array.isArray(insc.howToRegister) && insc.howToRegister.length) {
      set('howToList', insc.howToRegister.map(function (l) {
        return '<li>' + esc(l) + '</li>';
      }).join(''));
    }

    if (Array.isArray(insc.documents) && insc.documents.length) {
      set('docLinks', insc.documents.map(function (doc) {
        return '<a href="' + esc(doc.url) + '" target="_blank" rel="noopener" class="btn btn-ghost">' +
          esc(doc.title) + '</a>';
      }).join(''));
    }
  }

  // Initiales affichées tant qu'une personne n'a pas fourni sa photo.
  function initiales(m) {
    var source = (m.firstName || '') + ' ' + (m.lastName || '');
    if (!source.trim()) source = m.name || '';
    return source.trim().split(/\s+/).slice(0, 2)
      .map(function (mot) { return mot.charAt(0).toUpperCase(); }).join('');
  }

  function nomComplet(m) {
    if (m.firstName || m.lastName) {
      return ((m.firstName || '') + ' ' + (m.lastName || '')).trim();
    }
    return m.name || '';
  }

  function carteMembre(m) {
    // photo:"" dans le JSON = pas encore de portrait, on montre les initiales.
    var photo = Object.prototype.hasOwnProperty.call(m, 'photo')
      ? m.photo
      : ('images/bureau/' + m.id + '.webp');
    var nom = nomComplet(m);
    var vignette = photo
      ? '<img class="bureau-photo" src="' + esc(photo) + '" alt="' + esc(nom) +
        '" loading="lazy" width="400" height="400" data-initiales="' + esc(initiales(m)) + '">'
      : '<div class="bureau-photo bureau-photo--vide" aria-hidden="true">' + esc(initiales(m)) + '</div>';
    return '<div class="bureau-card glass">' + vignette +
      '<div class="bureau-name">' + esc(nom) + '</div>' +
      '<div class="bureau-role">' + esc(m.role) + '</div>' +
      '</div>';
  }

  function rendreBureau(membres) {
    if (!Array.isArray(membres) || !membres.length) return;
    set('bureauGrid', membres.map(carteMembre).join(''));
  }

  function rendreCommunication(membres) {
    if (!Array.isArray(membres) || !membres.length) return;
    set('commGrid', membres.map(carteMembre).join(''));
  }

  // Un portrait manquant ne doit jamais laisser une icône d'image cassée :
  // on retombe sur les initiales. En phase de capture, car « error » ne
  // remonte pas jusqu'au document autrement.
  document.addEventListener('error', function (ev) {
    var img = ev.target;
    if (!img || img.tagName !== 'IMG' || img.className.indexOf('bureau-photo') === -1) return;
    var repli = document.createElement('div');
    repli.className = 'bureau-photo bureau-photo--vide';
    repli.setAttribute('aria-hidden', 'true');
    repli.textContent = img.getAttribute('data-initiales') ||
      (img.getAttribute('alt') || '').trim().split(/\s+/).slice(0, 2)
        .map(function (mot) { return mot.charAt(0).toUpperCase(); }).join('');
    if (img.parentNode) img.parentNode.replaceChild(repli, img);
  }, true);

  /* ---------- Chargement ---------- */

  function charger(nom) {
    // Horodatage : évite qu'un navigateur ressorte une version périmée du
    // cache alors que le club vient de mettre le fichier à jour.
    return fetch(API + nom + '.json?v=' + Date.now(), { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error(nom + ' : HTTP ' + r.status);
        return r.json();
      })
      .then(function (enveloppe) {
        // Les fichiers sont de la forme { updatedAt, data }.
        return enveloppe && Object.prototype.hasOwnProperty.call(enveloppe, 'data')
          ? enveloppe.data
          : enveloppe;
      })
      .catch(function (err) {
        console.warn('[data] ' + nom + ' indisponible, contenu de secours conservé', err);
        return null;
      });
  }

  var promesse = Promise.all(FICHIERS.map(charger)).then(function (resultats) {
    var d = {};
    FICHIERS.forEach(function (nom, i) { d[nom] = resultats[i]; });

    // Chaque rendu est indépendant : un fichier manquant ne doit pas
    // empêcher les autres sections de se mettre à jour.
    try { rendreClub(d.club); } catch (e) { console.warn('[data] club', e); }
    try { rendreDisciplines(d.disciplines); } catch (e) { console.warn('[data] disciplines', e); }
    try { rendreEvenements(d.events); } catch (e) { console.warn('[data] events', e); }
    try { rendrePlanning(d.planning); } catch (e) { console.warn('[data] planning', e); }
    try { rendreHockey(d.teams); } catch (e) { console.warn('[data] teams', e); }
    try { rendreActualites(d.news); } catch (e) { console.warn('[data] news', e); }
    try { rendreInscriptions(d.inscriptions); } catch (e) { console.warn('[data] inscriptions', e); }
    try { rendreBureau(d.bureau); } catch (e) { console.warn('[data] bureau', e); }
    try { rendreCommunication(d.communication); } catch (e) { console.warn('[data] communication', e); }

    window.rollerbugData = d;
    document.dispatchEvent(new CustomEvent('rollerbug:data'));
    return d;
  });

  // Les scripts chargés après celui-ci attendent cette promesse.
  window.rollerbugDataReady = promesse;
})();
