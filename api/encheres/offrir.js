/* ============================================================================
   POST /api/encheres/offrir — dépôt d'une offre.

   Depuis la décision du bureau de supprimer le code de vérification, l'offre
   est valide dès sa réception : plus d'étape intermédiaire, plus d'e-mail de
   code, plus de confirmation à l'enchérisseur. Un seul message part, et
   seulement s'il y a quelqu'un à prévenir — l'alerte à la personne qui vient
   d'être dépassée. C'est ce qui permet de tenir dans les cent e-mails par
   jour du forfait gratuit.

   ⚠ Conséquence assumée : plus rien ne prouve que l'adresse saisie appartient
   à la personne qui enchérit. Les garde-fous vivent dans la base — limite par
   adresse, limite par appareil, plafond d'alertes par destinataire — et non
   ici : une protection posée dans la page serait contournée en trois clics.
   ========================================================================== */
import { rpc } from '../_lib/base.js';
import { route, json, corpsJson } from '../_lib/reponse.js';
import { offre as valider, adresseIp } from '../_lib/validation.js';
import { envoyerFile } from './envoyer.js';

export default route(['POST'], async (req, res) => {
  const donnees = valider(await corpsJson(req));

  const retour = await rpc('or_offrir_direct', {
    p_numero: donnees.numero,
    p_prenom: donnees.prenom,
    p_nom: donnees.nom,
    p_email: donnees.email,
    p_telephone: donnees.telephone,
    p_montant: donnees.montant,
    p_reglement: true,
    p_ip: adresseIp(req)
  });

  const ligne = (Array.isArray(retour) ? retour[0] : retour) || {};

  // L'alerte à la personne dépassée part tout de suite. Un échec d'envoi ne
  // doit pas faire perdre l'offre : elle est acquise, le message reste en
  // file et la tâche quotidienne le reprendra.
  try { await envoyerFile(10); }
  catch (err) { console.error('[encheres] file d’e-mails :', err); }

  json(res, 201, {
    id: ligne.enchere_id,
    montant: ligne.montant_retenu,
    minimum: ligne.minimum,
    message: 'Votre offre est enregistrée. Merci !'
  });
});
