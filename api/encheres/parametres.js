/* GET /api/encheres/parametres — dates, mise à prix, palier, état.
   C'est l'heure du SERVEUR qui est renvoyée (serveurMaintenant) : le site
   s'en sert pour son compte à rebours, plutôt que de faire confiance à
   l'horloge de l'appareil du visiteur, qui peut être déréglée. */
import { rpc } from '../_lib/base.js';
import { route, json } from '../_lib/reponse.js';

export default route(['GET'], async (req, res) => {
  json(res, 200, await rpc('or_parametres_publics'));
});
