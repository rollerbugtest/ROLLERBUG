/* ============================================================================
   GET|POST /api/encheres/cloturer — la clôture des enchères.

   Rien, dans le site, n'appelait or_cloturer. Les enchères s'arrêtaient bien
   d'elles-mêmes à l'heure dite — la base refuse toute offre au-delà — mais
   les vingt et un gagnants n'étaient jamais prévenus et Elisa ne recevait
   aucun bilan. Les enchères se seraient donc terminées dans le silence.

   Cette route est sans effet tant que l'opération n'est pas terminée, et
   rejouable sans risque : or_notifications porte une contrainte d'unicité
   par offre et un index qui n'autorise qu'un seul bilan au total. Même
   lancée tous les jours, elle ne peut pas envoyer deux fois le même message.

   Elle vide aussi la file d'e-mails au passage : c'est le rattrapage de ce
   qu'un incident d'envoi aurait laissé en chemin, puisque le reste des
   messages part en direct au moment où une offre est confirmée.

   Déclenchée par la tâche planifiée de vercel.json. Vercel joint
   automatiquement CRON_SECRET à ses appels ; sans ce secret la route refuse,
   pour que personne ne puisse provoquer une clôture depuis l'extérieur.

   À PROPOS DE L'HORAIRE — vercel.json ne peut pas porter de commentaire,
   alors l'explication est ici. La tâche est réglée sur « 0 23 * * * ».

     • Les tâches Vercel sont exprimées en UTC. Après le changement d'heure,
       Paris est à UTC+1 : 23h00 UTC, c'est minuit à Paris, soit exactement
       l'heure de clôture du 30 octobre.
     • Le forfait Hobby n'autorise qu'un déclenchement par jour, et à une
       heure près seulement : la tâche part entre 23h00 et 23h59 UTC. Les
       gagnants sont donc prévenus dans l'heure qui suit la clôture, jamais
       avant — la base refuse de clôturer tant que l'heure n'est pas passée.
     • Les jours précédents, la tâche ne fait rien d'autre que vider la file
       d'e-mails. C'est voulu : elle sert aussi de filet quotidien.

   Passer à un déclenchement à la minute près demanderait le forfait Pro.
   ========================================================================== */
import { rpc } from '../_lib/base.js';
import { route, json } from '../_lib/reponse.js';
import { envoyerFile } from './envoyer.js';

export default route(['GET', 'POST'], async (req, res) => {
  const attendu = process.env.CRON_SECRET;
  const recu = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (attendu && recu !== attendu) {
    return json(res, 401, { erreur: 'NON_AUTORISE', message: 'Accès refusé.' });
  }

  const etat = await rpc('or_etat');
  let gagnantsNotifies = null;

  if (etat === 'termine') {
    try {
      gagnantsNotifies = await rpc('or_cloturer', { p_par: 'tache-planifiee' });
    } catch (err) {
      // L'état a pu changer entre la lecture et l'appel : ce n'est pas une
      // panne, il n'y a simplement rien à clôturer.
      if (err && err.code === 'ENCHERES_NON_TERMINEES') gagnantsNotifies = 0;
      else throw err;
    }
  }

  const file = await envoyerFile(30);

  // Aucune adresse e-mail dans la réponse : ces journaux sont lisibles depuis
  // le tableau de bord Vercel.
  json(res, 200, { etat, gagnantsNotifies, file });
});
