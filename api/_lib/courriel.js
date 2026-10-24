/* ============================================================================
   Envoi des e-mails, via Resend.

   Aucune dépendance npm là non plus : une requête HTTP suffit.

   Si RESEND_API_KEY n'est pas configurée, rien n'est envoyé et la fonction le
   dit calmement. C'est voulu : une enchère valide ne doit jamais échouer
   parce que le service d'e-mail est absent ou en panne. Les messages non
   partis restent dans la file en base et seront réexpédiés.
   ========================================================================== */

const CLE = process.env.RESEND_API_KEY;
const EXPEDITEUR = process.env.EMAIL_EXPEDITEUR || 'Roller Bug <onboarding@resend.dev>';
const SITE = process.env.SITE_URL || 'https://rollerbug.vercel.app';

export function configure() { return Boolean(CLE); }

export async function envoyer({ a, sujet, texte, html }) {
  if (!CLE) return { envoye: false, raison: 'RESEND_API_KEY absente' };

  const reponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CLE}` },
    body: JSON.stringify({ from: EXPEDITEUR, to: [a], subject: sujet, text: texte, html })
  });

  if (!reponse.ok) {
    const detail = await reponse.text();
    return { envoye: false, raison: `Resend ${reponse.status} : ${detail.slice(0, 200)}` };
  }
  return { envoye: true };
}

/* --------------------------------------------------------------- gabarits --
   Volontairement sobres : du texte, un bouton, pas d'images distantes. Un
   e-mail chargé d'images finit en indésirables, et celui-ci doit arriver. */

function page(titre, corps, bouton) {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#222;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:30px;">
  <p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c61e6e;">Roller Bug · Octobre Rose</p>
  <h1 style="margin:0 0 18px;font-size:21px;color:#111;">${titre}</h1>
  ${corps}
  ${bouton || ''}
  <p style="margin:26px 0 0;font-size:12px;color:#888;line-height:1.6;">
    Enchères solidaires au profit de la lutte contre le cancer du sein.<br>
    Vos coordonnées servent uniquement à vous recontacter si vous remportez un
    maillot ; elles ne sont jamais affichées sur le site.
  </p>
</div></body></html>`;
}

function lien(url, libelle) {
  return `<p style="margin:22px 0 0;"><a href="${url}" style="display:inline-block;background:#e9539b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">${libelle}</a></p>`;
}

export function gabaritVerification({ prenom, code, numero, joueur, montant }) {
  const sujet = `Votre code de confirmation : ${code}`;
  const texte = `Bonjour ${prenom},

Votre code de confirmation est : ${code}

Il confirme votre offre de ${montant} € sur le maillot n°${numero} (${joueur}).
Ce code est valable 20 minutes et ne sert qu'une fois.

Tant que vous ne l'avez pas saisi, votre offre n'est pas enregistrée.

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`;
  const html = page('Confirmez votre offre',
    `<p style="line-height:1.7;">Bonjour ${prenom},</p>
     <p style="line-height:1.7;">Votre offre de <strong>${montant} €</strong> sur le maillot
     <strong>n°${numero} — ${joueur}</strong> est presque enregistrée. Saisissez ce code sur le site :</p>
     <p style="margin:22px 0;font-size:34px;letter-spacing:9px;font-weight:bold;color:#c61e6e;text-align:center;">${code}</p>
     <p style="line-height:1.7;">Il est valable <strong>20 minutes</strong> et ne sert qu'une fois.
     Tant qu'il n'est pas saisi, votre offre n'est pas prise en compte.</p>
     <p style="line-height:1.7;color:#666;">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`);
  return { sujet, texte, html };
}

export function gabaritConfirmation({ prenom, numero, joueur, montant, cloture }) {
  const sujet = `Votre offre de ${montant} € est enregistrée — maillot n°${numero}`;
  const texte = `Bonjour ${prenom},

Votre offre de ${montant} € sur le maillot n°${numero} (${joueur}) est enregistrée.

Vous serez prévenu par e-mail si quelqu'un passe devant vous.
Clôture des enchères : ${cloture}.

${SITE}/octobre-rose/maillot.html?n=${numero}`;
  const html = page('Votre offre est enregistrée',
    `<p style="line-height:1.7;">Bonjour ${prenom},</p>
     <p style="line-height:1.7;">Votre offre de <strong>${montant} €</strong> sur le maillot
     <strong>n°${numero} — ${joueur}</strong> est enregistrée.</p>
     <p style="line-height:1.7;">Nous vous préviendrons si quelqu'un passe devant vous.
     Les enchères ferment le <strong>${cloture}</strong>.</p>`,
    lien(`${SITE}/octobre-rose/maillot.html?n=${numero}`, 'Voir le maillot'));
  return { sujet, texte, html };
}

export function gabaritSurenchere({ numero, joueur, meilleure, minimum }) {
  const sujet = `Vous avez été dépassé sur le maillot n°${numero}`;
  const texte = `Bonjour,

Quelqu'un vient de passer devant vous sur le maillot n°${numero} (${joueur}).

Meilleure offre actuelle : ${meilleure} €
Pour reprendre la tête : ${minimum} € minimum

${SITE}/octobre-rose/maillot.html?n=${numero}`;
  const html = page('Vous avez été dépassé',
    `<p style="line-height:1.7;">Quelqu'un vient de passer devant vous sur le maillot
     <strong>n°${numero} — ${joueur}</strong>.</p>
     <p style="line-height:1.7;">Meilleure offre actuelle : <strong>${meilleure} €</strong><br>
     Pour reprendre la tête : <strong>${minimum} €</strong> minimum.</p>`,
    lien(`${SITE}/octobre-rose/maillot.html?n=${numero}`, 'Reprendre la tête'));
  return { sujet, texte, html };
}

export function gabaritGagnant({ prenom, numero, joueur, taille, montant, modalites }) {
  const sujet = `Vous remportez le maillot n°${numero} !`;
  const bloc = modalites && modalites.trim()
    ? modalites.trim()
    : "Le club vous recontacte très vite pour le règlement et la remise du maillot.";
  const texte = `Bonjour ${prenom},

Vous remportez le maillot n°${numero} (${joueur}, taille ${taille}) pour ${montant} €.

${bloc}

Merci pour votre participation : votre don soutient la lutte contre le cancer du sein.`;
  const html = page('Vous remportez ce maillot',
    `<p style="line-height:1.7;">Bonjour ${prenom},</p>
     <p style="line-height:1.7;">Vous remportez le maillot <strong>n°${numero} — ${joueur}</strong>
     (taille ${taille}) pour <strong>${montant} €</strong>.</p>
     <p style="line-height:1.7;white-space:pre-line;background:#fdf0f6;border-radius:8px;padding:16px;">${bloc}</p>
     <p style="line-height:1.7;">Merci pour votre participation : votre don soutient la lutte
     contre le cancer du sein.</p>`);
  return { sujet, texte, html };
}

export function gabaritAdmin({ numero, joueur, montant, prenom }) {
  const sujet = `Nouvelle enchère : ${montant} € sur le n°${numero}`;
  const texte = `Nouvelle offre confirmée.

Maillot : n°${numero} (${joueur})
Montant : ${montant} €
Par : ${prenom}

Les coordonnées complètes sont dans l'administration.`;
  const html = page('Nouvelle enchère confirmée',
    `<p style="line-height:1.7;">Maillot <strong>n°${numero} — ${joueur}</strong><br>
     Montant : <strong>${montant} €</strong><br>Par : ${prenom}</p>
     <p style="line-height:1.7;color:#666;">Les coordonnées complètes sont dans l'administration.</p>`);
  return { sujet, texte, html };
}
