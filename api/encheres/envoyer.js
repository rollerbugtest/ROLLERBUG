/* ============================================================================
   L'envoyeur : il dépile la file d'e-mails tenue par la base.

   Appelé à deux moments :
     • juste après une confirmation d'offre, pour que les messages partent
       tout de suite ;
     • par une tâche planifiée Vercel, qui rattrape ce qui n'est pas parti.

   Chaque message est marqué envoyé ou en échec. Un e-mail déjà marqué envoyé
   ne repart jamais, même si la tâche tourne dix fois.

   La route GET est protégée par CRON_SECRET : sans ça, n'importe qui
   pourrait la déclencher en boucle.
   ========================================================================== */
import { rpc } from '../_lib/base.js';
import { route, json } from '../_lib/reponse.js';
import {
  envoyer, gabaritConfirmation, gabaritSurenchere,
  gabaritGagnant, gabaritAdmin
} from '../_lib/courriel.js';

function dateFr(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric',
    month: 'long', hour: '2-digit', minute: '2-digit'
  });
}

function composer(n) {
  const commun = { numero: n.numero, joueur: n.joueur, montant: n.montant, prenom: n.prenom };
  switch (n.genre) {
    case 'confirmation':
      return gabaritConfirmation({ ...commun, cloture: dateFr(n.cloture) });
    case 'surenchere':
      return gabaritSurenchere({
        numero: n.numero, joueur: n.joueur,
        meilleure: n.meilleure_offre, minimum: n.minimum
      });
    case 'gagnant':
      return gabaritGagnant({ ...commun, taille: n.taille, modalites: n.modalites });
    case 'admin':
      return gabaritAdmin(commun);
    case 'bilan':
      return {
        sujet: 'Enchères Octobre Rose : clôture',
        texte: "Les enchères sont terminées. La liste des gagnants et leurs "
             + "coordonnées sont dans l'administration du site.",
        html: '<p>Les enchères sont terminées. La liste des gagnants et leurs '
            + "coordonnées sont dans l'administration du site.</p>"
      };
    default:
      return null;
  }
}

/* Dépile la file. Renvoie un petit bilan, sans aucune adresse e-mail. */
export async function envoyerFile(limite = 20) {
  const file = await rpc('or_notifications_a_envoyer', { p_limite: limite });
  let partis = 0;
  let echecs = 0;

  for (const n of file || []) {
    const message = composer(n);
    if (!message) continue;
    const resultat = await envoyer({ a: n.destinataire, ...message });
    if (resultat.envoye) {
      await rpc('or_notification_envoyee', { p_id: n.id });
      partis += 1;
    } else {
      await rpc('or_notification_echouee', { p_id: n.id, p_erreur: resultat.raison });
      echecs += 1;
    }
  }
  return { examines: (file || []).length, partis, echecs };
}

export default route(['GET', 'POST'], async (req, res) => {
  const attendu = process.env.CRON_SECRET;
  const recu = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (attendu && recu !== attendu) {
    return json(res, 401, { erreur: 'NON_AUTORISE', message: 'Accès refusé.' });
  }
  json(res, 200, await envoyerFile(30));
});
