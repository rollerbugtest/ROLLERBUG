/* ============================================================================
   Accès à la base depuis les fonctions serverless.

   Aucune dépendance npm : Node 18+ fournit fetch(), et Supabase expose les
   fonctions SQL en HTTP (PostgREST). Le site reste donc un site statique sans
   étape de construction — rien à installer, rien à compiler, rien qui puisse
   casser le déploiement existant.

   ⚠ SUPABASE_SERVICE_KEY ne sort JAMAIS d'ici. Elle contourne toutes les
   protections de la base : elle vit dans les variables d'environnement
   Vercel, elle n'apparaît dans aucun fichier du dossier js/, et aucune
   réponse de ce module ne la renvoie au navigateur.
   ========================================================================== */

const URL_BASE = process.env.SUPABASE_URL;
const CLE = process.env.SUPABASE_SERVICE_KEY;

// Erreur métier : son message est prévu pour être montré au visiteur.
export class ErreurMetier extends Error {
  constructor(code, message, http = 400, extra = {}) {
    super(message);
    this.code = code;
    this.http = http;
    Object.assign(this, extra);
  }
}

export function configuree() {
  return Boolean(URL_BASE && CLE);
}

/* Appelle une fonction SQL. Tout passe par là : les routes ne composent
   jamais de SQL elles-mêmes, donc aucune injection n'est possible. */
export async function rpc(fonction, parametres = {}) {
  if (!configuree()) {
    throw new ErreurMetier('NON_CONFIGURE',
      "Les enchères ne sont pas encore raccordées à la base.", 503);
  }

  const reponse = await fetch(`${URL_BASE}/rest/v1/rpc/${fonction}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: CLE,
      Authorization: `Bearer ${CLE}`
    },
    body: JSON.stringify(parametres)
  });

  const texte = await reponse.text();
  let corps = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { corps = texte; }

  if (!reponse.ok) {
    // Les exceptions levées par le SQL arrivent ici sous la forme
    // « MONTANT_INSUFFISANT: 35 ». On les retraduit en message lisible.
    const brut = (corps && (corps.message || corps.hint)) || String(corps || '');
    throw traduire(brut, reponse.status);
  }
  return corps;
}

/* Les messages d'erreur montrés au visiteur. Ils disent quoi faire, sans
   jamais révéler l'existence ou non d'une adresse e-mail. */
const MESSAGES = {
  ENCHERES_FERMEES: "Les enchères ne sont pas ouvertes en ce moment.",
  MAILLOT_INCONNU: "Ce maillot n'existe pas dans le catalogue.",
  REGLEMENT_NON_ACCEPTE: "Merci d'accepter le règlement des enchères.",
  TROP_D_OFFRES_EMAIL: "Beaucoup d'offres ont été envoyées depuis cette adresse. Merci de réessayer dans une heure.",
  TROP_D_OFFRES_IP: "Beaucoup d'offres ont été envoyées depuis cet appareil. Merci de réessayer dans une heure.",
  ENCHERES_NON_TERMINEES: "Les enchères ne sont pas encore terminées."
};

export function traduire(brut, http = 400) {
  const texte = String(brut || '');
  const code = texte.split(':')[0].trim().replace(/^.*\b([A-Z_]{4,})\b.*$/, '$1');
  const valeur = texte.includes(':') ? texte.split(':').pop().trim() : null;

  if (code === 'MONTANT_INSUFFISANT') {
    return new ErreurMetier(code,
      `La prochaine offre doit être d'au moins ${valeur} €.`, 409,
      { minimum: Number(valeur) });
  }
  if (code === 'PALIER_NON_RESPECTE') {
    return new ErreurMetier(code,
      `Les offres vont de ${valeur} € en ${valeur} €.`, 400,
      { palier: Number(valeur) });
  }
  if (MESSAGES[code]) return new ErreurMetier(code, MESSAGES[code], 409);

  // Inconnue : on ne montre rien du détail technique au visiteur, mais on
  // le garde dans les journaux du serveur pour pouvoir comprendre.
  console.error('[encheres] erreur base :', texte);
  return new ErreurMetier('ERREUR',
    "Une erreur est survenue. Merci de réessayer dans un instant.", http);
}
