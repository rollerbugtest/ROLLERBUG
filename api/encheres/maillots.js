/* GET /api/encheres/maillots — les 21 maillots et leur meilleure offre.
   Aucune coordonnée : la fonction SQL n'expose que des montants. */
import { rpc } from '../_lib/base.js';
import { route, json } from '../_lib/reponse.js';

export default route(['GET'], async (req, res) => {
  const liste = await rpc('or_catalogue');

  // Les noms de champs de la base sont remis au format du site, pour que les
  // pages lisent la même chose qu'elles viennent du serveur ou des .json.
  json(res, 200, (liste || []).map((m) => ({
    id: 'maillot-' + m.numero,
    numero: m.numero,
    nom: m.nom,
    poste: m.poste,
    posteLibelle: { gardien: 'Gardien', defenseur: 'Défenseur', attaquant: 'Attaquant' }[m.poste] || '',
    taille: m.taille,
    description: m.description,
    photos: m.photos || [],
    photoIllustration: m.photo_illustration,
    prixDepart: m.prix_depart,
    meilleureOffre: m.meilleure_offre,
    minimum: m.minimum,
    nbOffres: m.nb_offres,
    visible: true
  })));
});
