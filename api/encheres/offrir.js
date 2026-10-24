/* ============================================================================
   POST /api/encheres/offrir — dépôt d'une offre.

   L'offre naît EN ATTENTE : elle ne change pas le montant public et ne peut
   pas gagner. Un code à six chiffres part par e-mail ; seule sa saisie la
   rend valide. C'est ce qui empêche d'enchérir avec l'adresse de quelqu'un
   d'autre, ou avec une adresse inventée.

   Le code n'est jamais enregistré en clair : la base ne reçoit que son
   empreinte, comme pour un mot de passe.
   ========================================================================== */
import { randomInt, createHash } from 'node:crypto';
import { rpc } from '../_lib/base.js';
import { route, json, corpsJson } from '../_lib/reponse.js';
import { offre as valider, adresseIp } from '../_lib/validation.js';
import { envoyer, gabaritVerification } from '../_lib/courriel.js';

const SEL = process.env.ENCHERES_SEL || '';

function codeAleatoire() {
  // randomInt s'appuie sur le générateur du système : contrairement à
  // Math.random(), sa suite n'est pas prévisible.
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

function empreinte(code) {
  return createHash('sha256').update(code + SEL).digest('hex');
}

export default route(['POST'], async (req, res) => {
  const donnees = valider(await corpsJson(req));
  const code = codeAleatoire();

  const retour = await rpc('or_deposer_offre', {
    p_numero: donnees.numero,
    p_prenom: donnees.prenom,
    p_nom: donnees.nom,
    p_email: donnees.email,
    p_telephone: donnees.telephone,
    p_montant: donnees.montant,
    p_empreinte: empreinte(code),
    p_reglement: true,
    p_ip: adresseIp(req)
  });

  const ligne = Array.isArray(retour) ? retour[0] : retour;

  // On a besoin du nom du joueur pour l'e-mail ; il n'est pas dans la
  // réponse du dépôt, on le relit dans le catalogue public.
  const catalogue = await rpc('or_catalogue');
  const maillot = (catalogue || []).find((m) => m.numero === donnees.numero) || {};

  const message = gabaritVerification({
    prenom: donnees.prenom,
    code,
    numero: donnees.numero,
    joueur: maillot.nom || '',
    montant: donnees.montant
  });
  const envoi = await envoyer({ a: donnees.email, ...message });

  // Un échec d'envoi ne doit pas faire perdre l'offre : elle existe, elle est
  // en attente, et le visiteur peut demander un nouveau code.
  if (!envoi.envoye) console.error('[encheres] e-mail de code non parti :', envoi.raison);

  json(res, 201, {
    id: ligne.enchere_id,
    minimum: ligne.minimum,
    // Jamais le code, évidemment : il ne voyage que par e-mail.
    courrielEnvoye: envoi.envoye,
    message: envoi.envoye
      ? "Un code à six chiffres vient de vous être envoyé par e-mail."
      : "Votre offre est enregistrée, mais l'e-mail n'a pas pu partir. Contactez le club."
  });
});
