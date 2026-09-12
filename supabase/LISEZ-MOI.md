# Comptes partagés — application ↔ site

Aujourd'hui, les comptes de l'application vivent **sur le téléphone**
(`AsyncStorage`), et le site n'en a pas. Deux appareils qui ne se parlent pas
ne peuvent pas partager de comptes : il faut un endroit commun. C'est le rôle
de **Supabase** — base de données hébergée avec gestion des comptes intégrée,
offre gratuite largement suffisante pour un club.

Une fois en place : un compte créé dans l'app fonctionne sur le site, et
inversement. Le profil et les favoris suivent.

---

## 1. Créer le projet (5 min)

1. Aller sur **supabase.com**, créer un compte, puis *New project*.
2. Nom : `rollerbug`. Région : **Europe (Frankfurt ou Paris)** — plus proche
   des licenciés, donc plus rapide, et les données restent en Europe.
3. Choisir un mot de passe de base de données et **le garder** (il ne sert
   pas au quotidien, mais il est irrécupérable).
4. Attendre la fin de la création (~2 min).

## 2. Créer les tables

Dans le projet : **SQL Editor → New query**, coller tout le contenu de
`supabase/schema.sql`, puis **Run**. Le message « Success » suffit.

Ça crée deux tables — `profiles` (prénom, nom, email) et `favorites`
(équipes et disciplines suivies) — et les verrouille : chaque compte ne peut
lire et modifier que ses propres lignes.

## 3. Récupérer les deux identifiants

**Project Settings → API** :

| Étiquette dans Supabase | Où la coller |
|---|---|
| Project URL | `js/config.js` (site) et `.env` (app) |
| Clé `anon` `public` | `js/config.js` (site) et `.env` (app) |

⚠️ La clé **`service_role`** ne doit JAMAIS sortir d'un serveur : elle
contourne toutes les protections. On n'utilise que la clé `anon`, qui est
faite pour être publique.

### Côté site

Ouvrir `js/config.js` et remplacer les deux valeurs d'exemple.

### Côté application

Créer (ou compléter) le fichier `.env` à la racine de `roller-bug-app` :

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 4. Brancher l'application

```bash
cd roller-bug-app
npm install @supabase/supabase-js react-native-url-polyfill
```

Puis copier les deux fichiers fournis :

- `app-supabase/services/supabase.ts` → `services/supabase.ts` (nouveau)
- `app-supabase/services/auth.ts` → **remplace** `services/auth.ts`

Garde une copie de l'ancien `auth.ts` le temps de vérifier. Les signatures
sont identiques : `AuthProvider` et les écrans `connexion.tsx` /
`inscription.tsx` / `compte.tsx` n'ont **rien** à changer.

Relancer : `npx expo start -c` (le `-c` vide le cache, nécessaire après un
changement de `.env`).

## 5. Vérifier

1. Créer un compte **dans l'application**.
2. Ouvrir le site, cliquer sur l'icône de compte en haut à droite, se
   connecter avec les mêmes identifiants → le prénom doit s'afficher.
3. Modifier le prénom sur le site, relancer l'app → le changement est là.

---

## Confirmation par email

Par défaut, Supabase envoie un mail de confirmation à l'inscription et le
compte n'est utilisable qu'après validation. C'est plus sûr, mais ça ajoute
une étape, et les mails de l'offre gratuite partent depuis un serveur partagé
(quelques envois par heure, parfois en indésirables).

Pour un club, deux options dans **Authentication → Providers → Email** :

- **laisser activé** — recommandé si le site est public, évite les faux comptes ;
- **désactiver « Confirm email »** — inscription immédiate, plus simple pour
  démarrer et pour tester.

Les deux côtés (app et site) gèrent déjà les deux cas et affichent le bon
message.

## Ce qui n'est pas encore branché

Les **favoris** : le site sait déjà les lire et les écrire (table
`favorites`). Côté app, ils sont encore rangés dans `AsyncStorage` par
`context/AppProvider.tsx` — il reste à les faire passer par Supabase quand un
compte est connecté, en gardant le stockage local comme repli hors ligne.
C'est l'étape suivante.

Le **contenu du club** (planning, équipes, actualités) continue de vivre dans
`api/*.json` et se modifie par le panel. Le basculer aussi dans Supabase
permettrait de l'éditer depuis l'app — mais rien ne presse, le panel fait
déjà le travail.
