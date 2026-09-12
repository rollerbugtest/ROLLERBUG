/**
 * Authentification — création de compte et connexion.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  Implémentation SUPABASE (base partagée avec le site)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Remplace l'implémentation locale précédente. Les comptes ne vivent plus
 * sur l'appareil mais dans le projet Supabase du club : un compte créé ici
 * fonctionne sur le site rollerbug, et inversement.
 *
 * Les signatures et les types de retour sont IDENTIQUES à l'ancienne
 * version — `AuthProvider` et les écrans n'ont pas une ligne à changer.
 *
 * Les mots de passe ne transitent jamais par notre code : Supabase les
 * hache côté serveur (bcrypt) et ne les restitue jamais.
 */

import { supabase, supabaseReady } from '@/services/supabase';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  /** ISO-8601 */
  createdAt: string;
}

export type AuthResult = { ok: true; user: AuthUser } | { ok: false; error: string };

export const PASSWORD_MIN = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function notConfigured(): AuthResult {
  return {
    ok: false,
    error: 'Les comptes ne sont pas encore activés. Renseignez Supabase dans le fichier .env.',
  };
}

/** Traduit les messages de Supabase, qui arrivent en anglais. */
function translate(message: string | undefined): string {
  const m = message ?? '';
  if (/Invalid login credentials/i.test(m)) return 'Adresse email ou mot de passe incorrect.';
  if (/already registered/i.test(m)) return 'Un compte existe déjà avec cette adresse email.';
  if (/Password should be at least/i.test(m)) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`;
  }
  if (/Unable to validate email|invalid format/i.test(m)) return 'Cette adresse email n’est pas valide.';
  if (/Email not confirmed/i.test(m)) {
    return 'Votre adresse email n’est pas encore confirmée : ouvrez le mail reçu à l’inscription.';
  }
  if (/rate limit|too many/i.test(m)) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  if (/Network request failed|Failed to fetch/i.test(m)) {
    return 'Connexion impossible. Vérifiez votre connexion internet.';
  }
  return m || 'Une erreur est survenue.';
}

/**
 * Assemble l'utilisateur public à partir du compte Supabase et de sa ligne
 * `profiles`. Si le profil n'est pas lisible (réseau, déclencheur pas encore
 * passé), on renvoie au moins l'identité du compte plutôt que d'échouer.
 */
async function buildUser(authUser: { id: string; email?: string | null }): Promise<AuthUser> {
  const base: AuthUser = {
    id: authUser.id,
    firstName: '',
    lastName: '',
    email: authUser.email ?? '',
    createdAt: new Date().toISOString(),
  };
  if (!supabase) return base;

  try {
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, email, created_at')
      .eq('id', authUser.id)
      .maybeSingle();

    if (data) {
      base.firstName = data.first_name ?? '';
      base.lastName = data.last_name ?? '';
      base.email = data.email ?? base.email;
      base.createdAt = data.created_at ?? base.createdAt;
    }
  } catch {
    /* profil illisible : on garde le socle */
  }
  return base;
}

/* ------------------------------------------------------------------ */
/*  API publique — mêmes signatures que la version locale             */
/* ------------------------------------------------------------------ */

export async function signUp(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  if (!supabaseReady || !supabase) return notConfigured();

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = normalizeEmail(input.email);

  if (!firstName || !lastName) {
    return { ok: false, error: 'Renseignez votre prénom et votre nom.' };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Cette adresse email n’est pas valide.' };
  }
  if (input.password.length < PASSWORD_MIN) {
    return {
      ok: false,
      error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`,
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    // Repris par le déclencheur SQL pour remplir la table profiles.
    options: { data: { first_name: firstName, last_name: lastName } },
  });

  if (error) return { ok: false, error: translate(error.message) };
  if (!data.user) return { ok: false, error: 'Le compte n’a pas pu être créé.' };

  // Si la confirmation par email est activée dans Supabase, il n'y a pas
  // encore de session : le compte existe, mais il faut valider le mail.
  if (!data.session) {
    return {
      ok: false,
      error: 'Compte créé. Ouvrez le mail de confirmation reçu, puis connectez-vous.',
    };
  }

  return { ok: true, user: await buildUser(data.user) };
}

export async function signIn(input: { email: string; password: string }): Promise<AuthResult> {
  if (!supabaseReady || !supabase) return notConfigured();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(input.email),
    password: input.password,
  });

  // Supabase renvoie déjà le même message que le compte soit inconnu ou le
  // mot de passe faux : on n'indique pas si l'adresse est enregistrée.
  if (error) return { ok: false, error: translate(error.message) };
  if (!data.user) return { ok: false, error: 'Adresse email ou mot de passe incorrect.' };

  return { ok: true, user: await buildUser(data.user) };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** Rétablit la session au démarrage de l'application. */
export async function restoreSession(): Promise<AuthUser | null> {
  if (!supabaseReady || !supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return null;
    return await buildUser(data.session.user);
  } catch {
    // Hors ligne : on ne bloque pas le démarrage.
    return null;
  }
}

/** Met à jour l'identité du compte connecté (prénom, nom, email). */
export async function updateAccount(
  userId: string,
  patch: { firstName?: string; lastName?: string; email?: string },
): Promise<AuthResult> {
  if (!supabaseReady || !supabase) return notConfigured();

  const { data: sessionData } = await supabase.auth.getSession();
  const authUser = sessionData.session?.user;
  if (!authUser || authUser.id !== userId) {
    return { ok: false, error: 'Compte introuvable.' };
  }

  const current = await buildUser(authUser);
  const firstName = (patch.firstName ?? current.firstName).trim();
  const lastName = (patch.lastName ?? current.lastName).trim();
  const email = normalizeEmail(patch.email ?? current.email);

  if (!firstName || !lastName) {
    return { ok: false, error: 'Le prénom et le nom sont obligatoires.' };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: 'Cette adresse email n’est pas valide.' };
  }

  // Changer d'adresse touche au compte lui-même : Supabase envoie un mail
  // de confirmation, l'ancienne adresse reste active jusqu'à validation.
  if (email !== current.email) {
    const { error } = await supabase.auth.updateUser({ email });
    if (error) return { ok: false, error: translate(error.message) };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ first_name: firstName, last_name: lastName, email })
    .eq('id', userId);

  if (error) return { ok: false, error: translate(error.message) };

  return { ok: true, user: { ...current, firstName, lastName, email } };
}
