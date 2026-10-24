/* ============================================================================
   POST /api/encheres/confirmer — saisie du code reçu par e-mail.

   C'est ici que l'offre devient réelle. La base revérifie tout au moment de
   la confirmation, pas au moment du dépôt : les enchères ont pu fermer, et
   surtout quelqu'un a pu passer devant pendant que le visiteur allait
   chercher son e-mail. Chaque refus a son message, pour que la personne
   sache quoi faire plutôt que de se retrouver devant un échec muet.
   ========================================================================== */
import { createHash } from 'node:crypto';
import { rpc } from '../_lib/base.js';
import { route, json, corpsJson } from '../_lib/reponse.js';
import { confirmation as valider } from '../_lib/validation.js';
import { envoyerFile } from './envoyer.js';

const SEL = process.env.ENCHERES_SEL || '';

const REPONSES = {
  confirmee: { http: 200, message: "Votre offre est enregistrée. Merci !" },
  deja_confirmee: { http: 200, message: "Cette offre était déjà confirmée." },
  code_invalide: { http: 400, message: "Ce code ne correspond pas. Vérifiez l'e-mail reçu." },
  code_expire: { http: 410, message: "Ce code a expiré. Merci de refaire une offre." },
  trop_de_tentatives: { http: 429, message: "Trop d'essais. Merci de refaire une offre." },
  fermees: { http: 409, message: "Les enchères sont fermées : cette offre ne peut plus être validée." },
  inconnue: { http: 404, message: "Cette offre est introuvable." },
  non_confirmable: { http: 409, message: "Cette offre n'est plus valable. Merci d'en refaire une." }
};

export default route(['POST'], async (req, res) => {
  const { id, code } = valider(await corpsJson(req));

  const retour = await rpc('or_confirmer_offre', {
    p_enchere: id,
    p_empreinte: createHash('sha256').update(code + SEL).digest('hex')
  });
  const ligne = (Array.isArray(retour) ? retour[0] : retour) || {};
  const statut = ligne.statut || 'inconnue';

  if (statut === 'surencherie') {
    return json(res, 409, {
      erreur: 'SURENCHERIE',
      minimum: ligne.minimum,
      message: `Quelqu'un est passé devant vous pendant la vérification. ` +
               `La prochaine offre doit être d'au moins ${ligne.minimum} €.`
    });
  }

  const r = REPONSES[statut] || REPONSES.inconnue;

  // Les e-mails partent maintenant : confirmation à l'enchérisseur, alerte à
  // la personne dépassée, notification au club. Si l'envoi échoue, les
  // messages restent en file et repartiront — l'offre, elle, est acquise.
  if (statut === 'confirmee') {
    try { await envoyerFile(10); }
    catch (err) { console.error('[encheres] file d’e-mails :', err); }
  }

  json(res, r.http, {
    statut,
    montant: ligne.montant,
    minimum: ligne.minimum,
    message: r.message
  });
});
