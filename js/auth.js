/* ===========================================================================
   Comptes Roller Bug — côté site

   Même système que l'application : un compte créé dans l'app fonctionne ici,
   et inversement, parce que les deux parlent à la même base Supabase.

   L'API publique reprend volontairement les mêmes noms et les mêmes messages
   d'erreur que services/auth.ts dans l'app — de quoi comparer les deux côtés
   sans se perdre.

     RollerBugAuth.signUp({firstName, lastName, email, password})
     RollerBugAuth.signIn({email, password})
     RollerBugAuth.signOut()
     RollerBugAuth.updateAccount({firstName, lastName})
     RollerBugAuth.getUser()                → l'utilisateur connecté ou null
     RollerBugAuth.onChange(fn)             → prévenu à chaque connexion/déconnexion
     RollerBugAuth.getFavorites()           → {teams: [], disciplines: []}
     RollerBugAuth.toggleFavorite(kind, id) → ajoute ou retire un favori

   Toutes les fonctions renvoient {ok:true, ...} ou {ok:false, error:'…'}.
   =========================================================================== */
(function () {
  'use strict';

  var PASSWORD_MIN = 8;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var client = null;
  var utilisateur = null;
  var favoris = { teams: [], disciplines: [] };
  var abonnes = [];
  var pret = false;

  /* ------------------------------------------------------------- outils -- */

  function normaliseEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function prevenir() {
    abonnes.forEach(function (fn) {
      try { fn(utilisateur, favoris); } catch (e) { console.warn('[auth]', e); }
    });
  }

  function configOk() {
    var c = window.ROLLERBUG_CONFIG || {};
    return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY &&
              c.SUPABASE_URL.indexOf('VOTRE-PROJET') === -1 &&
              c.SUPABASE_ANON_KEY.indexOf('VOTRE_CLE') === -1);
  }

  function erreurConfig() {
    return { ok: false, error: 'Les comptes ne sont pas encore activés sur ce site.' };
  }

  // Traduit les messages de Supabase, qui arrivent en anglais.
  function traduire(message) {
    var m = String(message || '');
    if (/Invalid login credentials/i.test(m)) return 'Adresse email ou mot de passe incorrect.';
    if (/User already registered|already been registered/i.test(m)) return 'Un compte existe déjà avec cette adresse email.';
    if (/Password should be at least/i.test(m)) return 'Le mot de passe doit contenir au moins ' + PASSWORD_MIN + ' caractères.';
    if (/Unable to validate email|invalid format/i.test(m)) return 'Cette adresse email n’est pas valide.';
    if (/Email not confirmed/i.test(m)) return 'Ton adresse email n’est pas encore confirmée : ouvre le mail reçu à l’inscription.';
    if (/rate limit|too many/i.test(m)) return 'Trop de tentatives. Réessaie dans quelques minutes.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Connexion impossible. Vérifie ta connexion internet.';
    return m || 'Une erreur est survenue.';
  }

  /* ------------------------------------------------------------ démarrage - */

  function init() {
    if (!configOk() || !window.supabase) { pret = true; prevenir(); return; }

    var c = window.ROLLERBUG_CONFIG;
    client = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    client.auth.getSession().then(function (res) {
      var session = res && res.data ? res.data.session : null;
      return session ? chargeProfil(session.user) : null;
    }).catch(function () { /* hors ligne : on reste déconnecté */ })
      .then(function () { pret = true; prevenir(); });

    client.auth.onAuthStateChange(function (evenement, session) {
      if (evenement === 'SIGNED_OUT' || !session) {
        utilisateur = null;
        favoris = { teams: [], disciplines: [] };
        prevenir();
        return;
      }
      chargeProfil(session.user).then(prevenir);
    });
  }

  function chargeProfil(authUser) {
    if (!authUser) { utilisateur = null; return Promise.resolve(null); }

    // Socle immédiat : même si la suite échoue (réseau coupé, trigger de
    // création du profil pas encore passé), on sait déjà qui est connecté.
    utilisateur = {
      id: authUser.id, firstName: '', lastName: '',
      email: authUser.email, createdAt: null
    };

    return client.from('profiles').select('*').eq('id', authUser.id).maybeSingle()
      .then(function (res) {
        var p = (res && res.data) || {};
        if (p.first_name != null) utilisateur.firstName = p.first_name;
        if (p.last_name != null) utilisateur.lastName = p.last_name;
        if (p.email) utilisateur.email = p.email;
        if (p.created_at) utilisateur.createdAt = p.created_at;
      })
      .catch(function () { /* profil illisible : on garde le socle */ })
      // Un échec sur les favoris ne doit jamais faire perdre l'identité.
      .then(function () { return chargeFavoris(); })
      .catch(function () { return favoris; });
  }

  function chargeFavoris() {
    if (!utilisateur) return Promise.resolve(favoris);
    return client.from('favorites').select('kind, ref_id').eq('user_id', utilisateur.id)
      .then(function (res) {
        var lignes = res.data || [];
        favoris = {
          teams: lignes.filter(function (l) { return l.kind === 'team'; }).map(function (l) { return l.ref_id; }),
          disciplines: lignes.filter(function (l) { return l.kind === 'discipline'; }).map(function (l) { return l.ref_id; })
        };
        return favoris;
      })
      .catch(function () { return favoris; });
  }

  /* -------------------------------------------------------- API publique - */

  function signUp(input) {
    if (!configOk() || !client) return Promise.resolve(erreurConfig());

    var firstName = String(input.firstName || '').trim();
    var lastName = String(input.lastName || '').trim();
    var email = normaliseEmail(input.email);
    var password = String(input.password || '');

    // Mêmes contrôles que l'application, mot pour mot.
    if (!firstName || !lastName) {
      return Promise.resolve({ ok: false, error: 'Renseignez votre prénom et votre nom.' });
    }
    if (!EMAIL_RE.test(email)) {
      return Promise.resolve({ ok: false, error: 'Cette adresse email n’est pas valide.' });
    }
    if (password.length < PASSWORD_MIN) {
      return Promise.resolve({
        ok: false,
        error: 'Le mot de passe doit contenir au moins ' + PASSWORD_MIN + ' caractères.'
      });
    }

    return client.auth.signUp({
      email: email,
      password: password,
      options: { data: { first_name: firstName, last_name: lastName } }
    }).then(function (res) {
      if (res.error) return { ok: false, error: traduire(res.error.message) };
      // Si la confirmation par email est activée, il n'y a pas encore de session.
      if (!res.data.session) {
        return {
          ok: true, pendingConfirmation: true,
          user: { id: res.data.user ? res.data.user.id : '', firstName: firstName, lastName: lastName, email: email }
        };
      }
      return chargeProfil(res.data.user).then(function () {
        prevenir();
        return { ok: true, user: utilisateur };
      });
    }).catch(function (err) {
      return { ok: false, error: traduire(err.message) };
    });
  }

  function signIn(input) {
    if (!configOk() || !client) return Promise.resolve(erreurConfig());
    return client.auth.signInWithPassword({
      email: normaliseEmail(input.email),
      password: String(input.password || '')
    }).then(function (res) {
      if (res.error) return { ok: false, error: traduire(res.error.message) };
      return chargeProfil(res.data.user).then(function () {
        prevenir();
        return { ok: true, user: utilisateur };
      });
    }).catch(function (err) {
      return { ok: false, error: traduire(err.message) };
    });
  }

  function signOut() {
    if (!client) return Promise.resolve();
    return client.auth.signOut().then(function () {
      utilisateur = null;
      favoris = { teams: [], disciplines: [] };
      prevenir();
    });
  }

  function updateAccount(patch) {
    if (!client || !utilisateur) {
      return Promise.resolve({ ok: false, error: 'Vous n’êtes pas connecté.' });
    }
    var firstName = String(patch.firstName != null ? patch.firstName : utilisateur.firstName).trim();
    var lastName = String(patch.lastName != null ? patch.lastName : utilisateur.lastName).trim();
    if (!firstName || !lastName) {
      return Promise.resolve({ ok: false, error: 'Le prénom et le nom sont obligatoires.' });
    }
    return client.from('profiles')
      .update({ first_name: firstName, last_name: lastName })
      .eq('id', utilisateur.id)
      .then(function (res) {
        if (res.error) return { ok: false, error: traduire(res.error.message) };
        utilisateur.firstName = firstName;
        utilisateur.lastName = lastName;
        prevenir();
        return { ok: true, user: utilisateur };
      });
  }

  function resetPassword(email) {
    if (!configOk() || !client) return Promise.resolve(erreurConfig());
    return client.auth.resetPasswordForEmail(normaliseEmail(email), {
      redirectTo: location.origin + location.pathname
    }).then(function (res) {
      if (res.error) return { ok: false, error: traduire(res.error.message) };
      return { ok: true };
    });
  }

  function toggleFavorite(kind, refId) {
    if (!client || !utilisateur) {
      return Promise.resolve({ ok: false, error: 'Vous n’êtes pas connecté.' });
    }
    var liste = kind === 'team' ? favoris.teams : favoris.disciplines;
    var present = liste.indexOf(refId) !== -1;

    var action = present
      ? client.from('favorites').delete()
          .eq('user_id', utilisateur.id).eq('kind', kind).eq('ref_id', refId)
      : client.from('favorites').insert({ user_id: utilisateur.id, kind: kind, ref_id: refId });

    return action.then(function (res) {
      if (res.error) return { ok: false, error: traduire(res.error.message) };
      if (present) liste.splice(liste.indexOf(refId), 1);
      else liste.push(refId);
      prevenir();
      return { ok: true, favorites: favoris };
    });
  }

  window.RollerBugAuth = {
    PASSWORD_MIN: PASSWORD_MIN,
    estConfigure: configOk,
    estPret: function () { return pret; },
    getUser: function () { return utilisateur; },
    getFavorites: function () { return favoris; },
    onChange: function (fn) {
      abonnes.push(fn);
      if (pret) fn(utilisateur, favoris);
      return function () { abonnes = abonnes.filter(function (x) { return x !== fn; }); };
    },
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    updateAccount: updateAccount,
    resetPassword: resetPassword,
    toggleFavorite: toggleFavorite
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
