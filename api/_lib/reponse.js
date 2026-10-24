/* ============================================================================
   Enveloppe commune aux routes : méthode, lecture du corps, en-têtes, erreurs.

   Centraliser ça évite qu'une route oublie un contrôle. Toutes les réponses
   passent par ici, donc aucune ne peut renvoyer par mégarde une erreur
   technique brute au navigateur.
   ========================================================================== */
import { ErreurMetier } from './base.js';

export function json(res, code, corps) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Les montants bougent : rien de tout cela ne doit être mis en cache.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(code).end(JSON.stringify(corps));
}

export async function corpsJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;   // Vercel l'a déjà lu
  let brut = '';
  for await (const morceau of req) {
    brut += morceau;
    if (brut.length > 20000) {
      throw new ErreurMetier('CORPS_TROP_GROS', "Requête trop volumineuse.", 413);
    }
  }
  if (!brut) return {};
  try { return JSON.parse(brut); }
  catch { throw new ErreurMetier('CORPS_INVALIDE', "Requête mal formée.", 400); }
}

/* Emballe un gestionnaire : vérifie la méthode, attrape les erreurs, et ne
   laisse jamais filtrer un message technique. */
export function route(methodes, gestionnaire) {
  return async function (req, res) {
    if (!methodes.includes(req.method)) {
      res.setHeader('Allow', methodes.join(', '));
      return json(res, 405, { erreur: 'METHODE', message: 'Méthode non autorisée.' });
    }
    try {
      await gestionnaire(req, res);
    } catch (err) {
      if (err instanceof ErreurMetier) {
        const corps = { erreur: err.code, message: err.message };
        if (err.minimum != null) corps.minimum = err.minimum;
        if (err.palier != null) corps.palier = err.palier;
        return json(res, err.http, corps);
      }
      console.error('[encheres] erreur inattendue :', err);
      return json(res, 500, {
        erreur: 'ERREUR',
        message: "Une erreur est survenue. Merci de réessayer dans un instant."
      });
    }
  };
}
