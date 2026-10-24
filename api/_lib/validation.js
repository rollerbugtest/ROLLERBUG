/* ============================================================================
   Contrôle des données reçues du formulaire.

   Le navigateur vérifie déjà la saisie, mais rien de ce qui vient de lui
   n'est digne de confiance : n'importe qui peut envoyer une requête à la
   main. Tout est donc revérifié ici, côté serveur, avant d'atteindre la base.

   La base revérifie ensuite une troisième fois les montants et les dates :
   ces contrôles-ci servent à donner des messages clairs, pas à protéger.
   ========================================================================== */
import { ErreurMetier } from './base.js';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

function texte(valeur, champ, min, max) {
  const v = String(valeur == null ? '' : valeur).trim();
  if (v.length < min || v.length > max) {
    throw new ErreurMetier('CHAMP_INVALIDE', `Le champ « ${champ} » est incomplet.`);
  }
  // Les caractères de contrôle n'ont rien à faire dans un nom : ils servent
  // surtout à casser l'affichage d'un e-mail ou d'un export.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) {
    throw new ErreurMetier('CHAMP_INVALIDE', `Le champ « ${champ} » contient des caractères interdits.`);
  }
  return v;
}

export function offre(corps) {
  const c = corps && typeof corps === 'object' ? corps : {};

  const numero = Number.parseInt(c.numero, 10);
  if (!Number.isInteger(numero) || numero < 0 || numero > 999) {
    throw new ErreurMetier('CHAMP_INVALIDE', "Ce maillot n'existe pas.");
  }

  const montant = Number.parseInt(c.montant, 10);
  if (!Number.isInteger(montant) || montant <= 0 || montant > 100000) {
    throw new ErreurMetier('CHAMP_INVALIDE', "Le montant de l'offre n'est pas valide.");
  }

  const email = texte(c.email, 'adresse e-mail', 5, 180).toLowerCase();
  if (!EMAIL.test(email)) {
    throw new ErreurMetier('CHAMP_INVALIDE', "Cette adresse e-mail ne semble pas valide.");
  }

  // Le téléphone sert à rappeler le gagnant : on accepte large (espaces,
  // points, +33) mais on exige au moins huit chiffres.
  const telephone = texte(c.telephone, 'téléphone', 6, 30);
  if ((telephone.match(/\d/g) || []).length < 8) {
    throw new ErreurMetier('CHAMP_INVALIDE', "Ce numéro de téléphone ne semble pas valide.");
  }

  if (c.reglement !== true && c.reglement !== 'true' && c.reglement !== 'on') {
    throw new ErreurMetier('REGLEMENT_NON_ACCEPTE', "Merci d'accepter le règlement des enchères.");
  }

  return {
    numero,
    montant,
    email,
    telephone,
    prenom: texte(c.prenom, 'prénom', 1, 80),
    nom: texte(c.nom, 'nom', 1, 80)
  };
}

export function confirmation(corps) {
  const c = corps && typeof corps === 'object' ? corps : {};
  const id = String(c.id || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ErreurMetier('CHAMP_INVALIDE', "Ce lien de confirmation n'est pas valide.");
  }
  const code = String(c.code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) {
    throw new ErreurMetier('CODE_FORMAT', "Le code de confirmation comporte six chiffres.");
  }
  return { id, code };
}

/* L'adresse du visiteur, telle que Vercel la transmet. Utilisée uniquement
   pour limiter les abus — jamais affichée, jamais transmise à un tiers. */
export function adresseIp(req) {
  const entete = req.headers['x-forwarded-for'] || '';
  const premiere = String(entete).split(',')[0].trim();
  return /^[0-9a-f:.]{3,45}$/i.test(premiere) ? premiere : null;
}
