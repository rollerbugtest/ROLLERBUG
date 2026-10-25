/* Tests des routes serveur, avec Supabase et Resend simulés.
   La logique SQL est déjà testée contre un vrai PostgreSQL ; ici on vérifie
   la couche HTTP : contrôle des saisies, traduction des erreurs, et surtout
   qu'aucun secret ni aucune donnée personnelle ne sorte dans une réponse. */
process.env.SUPABASE_URL = 'https://faux.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'CLE-SECRETE-A-NE-JAMAIS-DIVULGUER';
process.env.RESEND_API_KEY = 'CLE-RESEND-SECRETE';
process.env.ENCHERES_SEL = 'sel-de-test';
process.env.CRON_SECRET = 'secret-cron';

let OK = 0, KO = 0;
const verifie = (nom, attendu, obtenu) => {
  const a = JSON.stringify(attendu), b = JSON.stringify(obtenu);
  if (a === b) { console.log('  OK   ' + nom); OK++; }
  else { console.log(`  ÉCHEC ${nom}\n       attendu ${a}\n       obtenu ${b}`); KO++; }
};

// ---------------------------------------------------------- faux serveurs
let rpcAppels = [];
let rpcReponses = {};
let courriels = [];
let resendEchoue = false;

global.fetch = async (url, options) => {
  const corps = options?.body ? JSON.parse(options.body) : {};
  if (String(url).includes('api.resend.com')) {
    if (resendEchoue) return { ok: false, status: 500, text: async () => 'panne simulée' };
    courriels.push({ a: corps.to[0], sujet: corps.subject, texte: corps.text });
    return { ok: true, status: 200, text: async () => '{}' };
  }
  const fonction = String(url).split('/rpc/')[1];
  rpcAppels.push({ fonction, corps, entetes: options.headers });
  const r = rpcReponses[fonction];
  if (typeof r === 'function') return r(corps);
  return { ok: true, status: 200, text: async () => JSON.stringify(r ?? null) };
};

function fausseReponse() {
  const res = {
    code: 0, entetes: {}, corps: null,
    setHeader(k, v) { this.entetes[k] = v; },
    status(c) { this.code = c; return this; },
    end(t) { this.corps = t ? JSON.parse(t) : null; }
  };
  return res;
}
const req = (methode, corps, entetes = {}) => ({ method: methode, body: corps, headers: entetes });

const { default: parametres } = await import('/home/claude/rb/api/encheres/parametres.js');
const { default: maillots }   = await import('/home/claude/rb/api/encheres/maillots.js');
const { default: offrir }     = await import('/home/claude/rb/api/encheres/offrir.js');
const { default: confirmer }  = await import('/home/claude/rb/api/encheres/confirmer.js');
const { default: envoyer }    = await import('/home/claude/rb/api/encheres/envoyer.js');
const { default: cloturer }   = await import('/home/claude/rb/api/encheres/cloturer.js');

const reset = () => { rpcAppels = []; courriels = []; resendEchoue = false; rpcReponses = {}; };

console.log('── Lecture publique ────────────────────────────────────────────');
reset();
rpcReponses.or_parametres_publics = { etat: 'encours', palier: 5, miseAPrix: 30 };
let res = fausseReponse();
await parametres(req('GET'), res);
verifie('paramètres servis', 200, res.code);
verifie('pas de mise en cache', 'no-store', res.entetes['Cache-Control']);
res = fausseReponse();
await parametres(req('POST'), res);
verifie('POST refusé sur une lecture', 405, res.code);

reset();
rpcReponses.or_catalogue = [{ numero: 88, nom: 'BEDNAR', poste: 'gardien', taille: '3XL',
  description: '', photos: [], photo_illustration: true, prix_depart: 30,
  meilleure_offre: 45, minimum: 50, nb_offres: 2 }];
res = fausseReponse();
await maillots(req('GET'), res);
verifie('un maillot renvoyé', 1, res.corps.length);
verifie('poste traduit', 'Gardien', res.corps[0].posteLibelle);
verifie('meilleure offre publiée', 45, res.corps[0].meilleureOffre);
verifie('aucune coordonnée', false,
  /email|telephone|prenom/i.test(JSON.stringify(res.corps)));

console.log('── Contrôle du formulaire ──────────────────────────────────────');
const BONNE = { numero: 88, prenom: 'Jean', nom: 'Test', email: 'jean@exemple.fr',
                telephone: '06 12 84 64 19', montant: 35, reglement: true };
const refus = async (modif, attendu) => {
  reset();
  rpcReponses.or_offrir_direct = [{ enchere_id: 'x', montant_retenu: 35, minimum: 40 }];
  const r = fausseReponse();
  await offrir(req('POST', { ...BONNE, ...modif }), r);
  return [r.code, r.corps.erreur, attendu];
};
verifie('e-mail invalide refusé', 'CHAMP_INVALIDE', (await refus({ email: 'pasbon' }))[1]);
verifie('téléphone trop court refusé', 'CHAMP_INVALIDE', (await refus({ telephone: '123' }))[1]);
verifie('prénom vide refusé', 'CHAMP_INVALIDE', (await refus({ prenom: '   ' }))[1]);
verifie('montant négatif refusé', 'CHAMP_INVALIDE', (await refus({ montant: -5 }))[1]);
verifie('règlement non coché refusé', 'REGLEMENT_NON_ACCEPTE', (await refus({ reglement: false }))[1]);
verifie('refus = code 400', 400, (await refus({ email: 'pasbon' }))[0]);

console.log('── Dépôt d’une offre (sans code de vérification) ───────────────');
reset();
rpcReponses.or_offrir_direct = [
  { enchere_id: '11111111-2222-3333-4444-555555555555', montant_retenu: 35, minimum: 40 }];
res = fausseReponse();
await offrir(req('POST', BONNE, { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }), res);
verifie('offre créée', 201, res.code);
verifie('identifiant rendu', '11111111-2222-3333-4444-555555555555', res.corps.id);
verifie('montant retenu rendu', 35, res.corps.montant);
verifie('minimum suivant rendu', 40, res.corps.minimum);
const depot = rpcAppels.find((a) => a.fonction === 'or_offrir_direct');
verifie('c’est bien l’offre directe qui est appelée', true, Boolean(depot));
verifie('plus aucune empreinte de code envoyée', undefined, depot.corps.p_empreinte);
verifie('IP du visiteur transmise', '203.0.113.9', depot.corps.p_ip);
verifie('aucun e-mail à l’enchérisseur', 0, courriels.length);
verifie('aucun code à six chiffres dans la réponse', false,
  /\b\d{6}\b/.test(JSON.stringify(res.corps)));
verifie('l’ancienne route de dépôt n’est plus appelée', false,
  rpcAppels.some((a) => a.fonction === 'or_deposer_offre'));
verifie('la file d’e-mails est bien vidée au passage', true,
  rpcAppels.some((a) => a.fonction === 'or_notifications_a_envoyer'));

// Quand quelqu'un est dépassé, son alerte part immédiatement — et c'est le
// seul e-mail de toute l'opération en dehors de la clôture.
reset();
rpcReponses.or_offrir_direct = [
  { enchere_id: '22222222-3333-4444-5555-666666666666', montant_retenu: 40, minimum: 45 }];
rpcReponses.or_notifications_a_envoyer = [
  { id: 4, genre: 'surenchere', destinataire: 'depasse@ex.fr', numero: 88,
    joueur: 'BEDNAR', meilleure_offre: 40, minimum: 45 }];
rpcReponses.or_notification_envoyee = null;
res = fausseReponse();
await offrir(req('POST', BONNE), res);
verifie('un seul e-mail parti', 1, courriels.length);
verifie('il va à la personne dépassée', 'depasse@ex.fr', courriels[0].a);
verifie('il annonce le nouveau minimum', true, courriels[0].texte.includes('45 €'));
verifie('l’offre aboutit quand même', 201, res.code);

console.log('── Les secrets ne fuient jamais ────────────────────────────────');
const toutCeQuiSort = JSON.stringify(res.corps) + JSON.stringify(courriels);
verifie('clé Supabase absente des réponses', false, toutCeQuiSort.includes('CLE-SECRETE'));
verifie('clé Resend absente des réponses', false, toutCeQuiSort.includes('CLE-RESEND'));
verifie('sel absent des réponses', false, toutCeQuiSort.includes('sel-de-test'));
verifie('la clé part bien vers Supabase', true,
  depot.entetes.apikey === 'CLE-SECRETE-A-NE-JAMAIS-DIVULGUER');

console.log('── Erreurs de la base traduites ────────────────────────────────');
const erreurBase = async (message) => {
  reset();
  rpcReponses.or_offrir_direct = async () => ({ ok: false, status: 400,
    text: async () => JSON.stringify({ message }) });
  const r = fausseReponse();
  await offrir(req('POST', BONNE), r);
  return r;
};
let r = await erreurBase('MONTANT_INSUFFISANT: 40');
verifie('montant insuffisant : message chiffré', "La prochaine offre doit être d'au moins 40 €.", r.corps.message);
verifie('montant insuffisant : minimum rendu', 40, r.corps.minimum);
r = await erreurBase('ENCHERES_FERMEES');
verifie('enchères fermées', 'Les enchères ne sont pas ouvertes en ce moment.', r.corps.message);
r = await erreurBase('TROP_D_OFFRES_EMAIL');
verifie('inondation bloquée', 'TROP_D_OFFRES_EMAIL', r.corps.erreur);
r = await erreurBase('relation "or_encheres" does not exist at character 42');
verifie('erreur technique masquée', 'ERREUR', r.corps.erreur);
verifie('aucun détail technique montré', false, /relation|character/.test(r.corps.message));

console.log('── Confirmation ────────────────────────────────────────────────');
const confirme = async (statut, extra = {}) => {
  reset();
  rpcReponses.or_confirmer_offre = [{ statut, montant: 35, minimum: 40, ...extra }];
  rpcReponses.or_notifications_a_envoyer = [];
  const r = fausseReponse();
  await confirmer(req('POST', { id: '11111111-2222-3333-4444-555555555555', code: '123456' }), r);
  return r;
};
verifie('confirmée', 200, (await confirme('confirmee')).code);
verifie('mauvais code', 400, (await confirme('code_invalide')).code);
verifie('code expiré', 410, (await confirme('code_expire')).code);
verifie('trop d’essais', 429, (await confirme('trop_de_tentatives')).code);
r = await confirme('surencherie');
verifie('dépassé : code 409', 409, r.code);
verifie('dépassé : nouveau minimum annoncé', 40, r.corps.minimum);
reset();
rpcReponses.or_confirmer_offre = [{ statut: 'confirmee' }];
r = fausseReponse();
await confirmer(req('POST', { id: 'pas-un-uuid', code: '123456' }), r);
verifie('identifiant bidon refusé', 'CHAMP_INVALIDE', r.corps.erreur);
r = fausseReponse();
await confirmer(req('POST', { id: '11111111-2222-3333-4444-555555555555', code: '12' }), r);
verifie('code trop court refusé', 'CODE_FORMAT', r.corps.erreur);

console.log('── File d’e-mails ──────────────────────────────────────────────');
reset();
rpcReponses.or_notifications_a_envoyer = [
  { id: 1, genre: 'confirmation', destinataire: 'a@ex.fr', prenom: 'Alice', montant: 35,
    numero: 88, joueur: 'BEDNAR', taille: '3XL', cloture: '2026-10-30T00:00:00+01:00' },
  { id: 2, genre: 'surenchere', destinataire: 'b@ex.fr', numero: 88, joueur: 'BEDNAR',
    meilleure_offre: 35, minimum: 40 },
  { id: 3, genre: 'gagnant', destinataire: 'c@ex.fr', prenom: 'Chloé', montant: 55,
    numero: 88, joueur: 'BEDNAR', taille: '3XL', modalites: 'Règlement à l’Espace Roller.' }
];
rpcReponses.or_notification_envoyee = null;
res = fausseReponse();
await envoyer(req('GET', null, { authorization: 'Bearer secret-cron' }), res);
verifie('trois e-mails partis', { examines: 3, partis: 3, echecs: 0 }, res.corps);
verifie('surenchère annonce le minimum', true, courriels[1].texte.includes('40 €'));
verifie('gagnant reçoit les modalités du club', true,
  courriels[2].texte.includes('Règlement à l’Espace Roller.'));
verifie('chaque e-mail marqué envoyé', 3,
  rpcAppels.filter((a) => a.fonction === 'or_notification_envoyee').length);

reset();
resendEchoue = true;
rpcReponses.or_notifications_a_envoyer = [
  { id: 9, genre: 'admin', destinataire: 'elisa@ex.fr', prenom: 'Jean', montant: 35,
    numero: 88, joueur: 'BEDNAR' }];
rpcReponses.or_notification_echouee = null;
res = fausseReponse();
await envoyer(req('GET', null, { authorization: 'Bearer secret-cron' }), res);
verifie('panne Resend : échec compté, pas d’envoi', { examines: 1, partis: 0, echecs: 1 }, res.corps);
verifie('échec remonté à la base', 1,
  rpcAppels.filter((a) => a.fonction === 'or_notification_echouee').length);

reset();
res = fausseReponse();
await envoyer(req('GET', null, {}), res);
verifie('file protégée sans le secret', 401, res.code);

console.log('── Clôture ─────────────────────────────────────────────────────');
reset();
res = fausseReponse();
await cloturer(req('GET', null, {}), res);
verifie('clôture protégée sans le secret', 401, res.code);

// Avant l'heure, la route ne doit surtout rien clôturer : une clôture
// prématurée enverrait vingt et un e-mails de gagnant pour rien.
reset();
rpcReponses.or_etat = 'encours';
rpcReponses.or_notifications_a_envoyer = [];
res = fausseReponse();
await cloturer(req('GET', null, { authorization: 'Bearer secret-cron' }), res);
verifie('enchères en cours : aucune clôture', 0,
  rpcAppels.filter((a) => a.fonction === 'or_cloturer').length);
verifie('mais la file est tout de même vidée', 1,
  rpcAppels.filter((a) => a.fonction === 'or_notifications_a_envoyer').length);
verifie('réponse honnête sur l’état', 'encours', res.corps.etat);

// Après l'heure : les gagnants sont mis en file et les e-mails partent.
reset();
rpcReponses.or_etat = 'termine';
rpcReponses.or_cloturer = 21;
rpcReponses.or_notifications_a_envoyer = [
  { id: 7, genre: 'gagnant', destinataire: 'c@ex.fr', prenom: 'Chloé', montant: 55,
    numero: 88, joueur: 'BEDNAR', taille: '3XL', modalites: 'À retirer au club.' }];
rpcReponses.or_notification_envoyee = null;
res = fausseReponse();
await cloturer(req('POST', null, { authorization: 'Bearer secret-cron' }), res);
verifie('clôture appelée une seule fois', 1,
  rpcAppels.filter((a) => a.fonction === 'or_cloturer').length);
verifie('vingt et un gagnants mis en file', 21, res.corps.gagnantsNotifies);
verifie('le gagnant reçoit bien son e-mail', 1, courriels.length);

// La base refuse de clôturer si l'heure n'est pas tout à fait passée. Ce
// n'est pas une panne : la tâche doit repartir sans bruit le lendemain.
reset();
rpcReponses.or_etat = 'termine';
rpcReponses.or_cloturer = () => ({
  ok: false, status: 409,
  text: async () => JSON.stringify({ message: 'ENCHERES_NON_TERMINEES' })
});
rpcReponses.or_notifications_a_envoyer = [];
res = fausseReponse();
await cloturer(req('GET', null, { authorization: 'Bearer secret-cron' }), res);
verifie('refus de la base : pas une erreur 500', 200, res.code);
verifie('et la file est quand même traitée', 1,
  rpcAppels.filter((a) => a.fonction === 'or_notifications_a_envoyer').length);

// Les journaux Vercel sont lisibles par qui a accès au projet : rien de
// personnel ne doit figurer dans la réponse de la tâche.
reset();
rpcReponses.or_etat = 'termine';
rpcReponses.or_cloturer = 2;
rpcReponses.or_notifications_a_envoyer = [
  { id: 8, genre: 'gagnant', destinataire: 'secrete@ex.fr', prenom: 'Zoé', montant: 60,
    numero: 26, joueur: 'CHAMON', taille: '3XL', modalites: '' }];
rpcReponses.or_notification_envoyee = null;
res = fausseReponse();
await cloturer(req('GET', null, { authorization: 'Bearer secret-cron' }), res);
verifie('aucune adresse e-mail dans la réponse', false,
  JSON.stringify(res.corps).includes('secrete@ex.fr'));
verifie('aucune clé dans la réponse', false,
  JSON.stringify(res.corps).includes('CLE-SECRETE-A-NE-JAMAIS-DIVULGUER'));

console.log('\n═══  ' + OK + ' réussis, ' + KO + ' échoués  ═══');
process.exit(KO ? 1 : 0);
