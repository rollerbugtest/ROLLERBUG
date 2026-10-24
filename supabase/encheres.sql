-- ===========================================================================
--  Roller Bug — Enchères solidaires Octobre Rose
--
--  À exécuter UNE FOIS dans Supabase :
--  projet → SQL Editor → New query → coller ce fichier → Run.
--  Le fichier est écrit pour pouvoir être rejoué sans rien casser.
--
--  Ce qu'il crée :
--    or_parametres  — dates, mise à prix, palier. Une seule ligne.
--    or_maillots    — les 21 maillots.
--    or_encheres    — les offres, avec leurs coordonnées.
--    or_admins      — qui a le droit d'administrer l'opération.
--    or_journal     — trace de toute opération sensible.
--
--  ---------------------------------------------------------------------
--  PRINCIPE DE SÉCURITÉ
--
--  Aucune de ces tables n'est lisible par le navigateur. RLS est activé
--  partout et AUCUNE politique n'autorise anon : même avec la clé publique
--  du site, un visiteur ne peut ni lire une adresse e-mail ni écrire une
--  offre. Tout passe par les fonctions serverless de Vercel, qui utilisent
--  la clé service_role — laquelle ne quitte jamais le serveur.
--
--  C'est volontairement plus strict que nécessaire : il s'agit de noms,
--  d'adresses, de téléphones et d'engagements financiers.
--  ---------------------------------------------------------------------
--
--  LE POINT CRITIQUE : deux personnes qui enchérissent en même temps.
--  or_confirmer_offre() verrouille la ligne du maillot (FOR UPDATE) avant
--  de recalculer la meilleure offre. PostgreSQL met donc la seconde
--  transaction en attente, et elle ne reprend qu'une fois la première
--  écrite — avec la vraie valeur sous les yeux. Deux offres de 55 € ne
--  peuvent pas être acceptées toutes les deux.
-- ===========================================================================

-- ------------------------------------------------------------ paramètres --
-- Une seule ligne, garantie par la contrainte id = 1 : impossible de se
-- retrouver avec deux jeux de dates qui se contredisent.
create table if not exists public.or_parametres (
  id                 smallint    primary key default 1 check (id = 1),
  ouverture          timestamptz not null,
  cloture            timestamptz not null,
  mise_a_prix        integer     not null default 30 check (mise_a_prix > 0),
  palier             integer     not null default 5  check (palier > 0),
  encheres_activees  boolean     not null default false,
  email_notification text        not null,
  titre              text        not null default 'Enchères solidaires — Octobre Rose',
  sous_titre         text        not null default '',
  reglement          text        not null default '',
  -- Ce que le gagnant doit faire : où, quand et comment il règle et récupère
  -- son maillot. Écrit par le club depuis l'administration, jamais deviné —
  -- ce texte part tel quel dans les e-mails de fin d'enchère.
  modalites_reglement text       not null default '',
  maj_le             timestamptz not null default now(),
  constraint or_dates_coherentes check (cloture > ouverture)
);

-- ---------------------------------------------------------------- maillots --
create table if not exists public.or_maillots (
  id                 uuid        primary key default gen_random_uuid(),
  numero             integer     not null unique check (numero between 0 and 999),
  nom                text        not null check (length(btrim(nom)) > 0),
  poste              text        not null check (poste in ('gardien','defenseur','attaquant')),
  taille             text        not null,
  description        text        not null default '',
  photos             jsonb       not null default '[]'::jsonb,
  -- true tant que la photo montrée n'est pas celle de CE maillot-là.
  photo_illustration boolean     not null default true,
  visible            boolean     not null default true,
  -- null = on applique la mise à prix générale des paramètres.
  prix_depart        integer     check (prix_depart is null or prix_depart > 0),
  cree_le            timestamptz not null default now()
);

-- ---------------------------------------------------------------- enchères --
do $$ begin
  create type public.or_statut as enum ('en_attente','confirmee','annulee','expiree');
exception when duplicate_object then null; end $$;

create table if not exists public.or_encheres (
  id             uuid           primary key default gen_random_uuid(),
  maillot_id     uuid           not null references public.or_maillots(id) on delete cascade,

  -- Coordonnées. Jamais exposées : ni vue publique, ni politique RLS.
  prenom         text           not null check (length(btrim(prenom)) between 1 and 80),
  nom            text           not null check (length(btrim(nom))    between 1 and 80),
  email          text           not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  telephone      text           not null check (length(btrim(telephone)) between 6 and 30),

  montant        integer        not null check (montant > 0),
  statut         public.or_statut not null default 'en_attente',

  -- Vérification de l'adresse e-mail. Le code n'est JAMAIS stocké en clair :
  -- seule son empreinte l'est, exactement comme un mot de passe.
  code_empreinte text,
  code_expire_le timestamptz,
  tentatives     smallint       not null default 0 check (tentatives >= 0),

  reglement_accepte boolean     not null default false,

  confirmee_le   timestamptz,
  annulee_le     timestamptz,
  annulee_par    text,
  motif_annulation text,

  ip             inet,
  cree_le        timestamptz    not null default now(),

  -- Une offre confirmée a forcément une date de confirmation, et inversement.
  constraint or_confirmation_coherente
    check ((statut = 'confirmee') = (confirmee_le is not null))
);

-- La requête la plus fréquente : « quelle est la meilleure offre confirmée
-- sur ce maillot ? ». L'index partiel ne porte que sur les lignes utiles.
create index if not exists or_encheres_meilleure
  on public.or_encheres (maillot_id, montant desc)
  where statut = 'confirmee';

create index if not exists or_encheres_email   on public.or_encheres (lower(email));
create index if not exists or_encheres_attente on public.or_encheres (code_expire_le)
  where statut = 'en_attente';

-- ------------------------------------------------------------------ admins --
-- Pas de mot de passe ici : l'identification passe par Supabase Auth. Cette
-- table dit seulement QUI, parmi les comptes existants, est administrateur.
create table if not exists public.or_admins (
  user_id    uuid        primary key references auth.users on delete cascade,
  email      text        not null,
  ajoute_le  timestamptz not null default now()
);

-- ----------------------------------------------------------- notifications --
-- File d'attente des e-mails. On n'envoie pas « au passage » depuis le code
-- métier : on inscrit ce qui est à envoyer, puis un envoyeur dépile. Deux
-- raisons : une panne du service d'e-mail ne doit pas faire échouer une
-- enchère déjà valide, et on peut réessayer sans risquer un doublon.
--
-- La contrainte d'unicité est la protection contre les e-mails en double :
-- un même événement ne peut produire qu'un seul envoi vers une adresse.
create table if not exists public.or_notifications (
  id           bigserial   primary key,
  enchere_id   uuid        references public.or_encheres(id) on delete cascade,
  genre        text        not null check (genre in
                 ('verification','confirmation','surenchere','gagnant','admin','bilan')),
  destinataire text        not null,
  envoye_le    timestamptz,
  tentatives   smallint    not null default 0,
  derniere_erreur text,
  cree_le      timestamptz not null default now(),
  unique (enchere_id, genre, destinataire)
);

-- Rattrapage si la table avait été créée par une version antérieure.
alter table public.or_notifications drop constraint if exists or_notifications_genre_check;
alter table public.or_notifications add  constraint or_notifications_genre_check
  check (genre in ('verification','confirmation','surenchere','gagnant','admin','bilan'));

create index if not exists or_notifications_a_faire
  on public.or_notifications (cree_le)
  where envoye_le is null;

-- Le bilan de clôture n'est rattaché à aucune enchère : son enchere_id est
-- nul, et deux NULL ne se ressemblent jamais pour une contrainte d'unicité.
-- Cet index garantit qu'il n'en partira qu'un seul, même si la clôture est
-- relancée plusieurs fois.
create unique index if not exists or_notifications_un_seul_bilan
  on public.or_notifications ((true)) where genre = 'bilan';

-- ----------------------------------------------------------------- journal --
-- Toute annulation, restauration ou modification de paramètre laisse une
-- trace. Sans ça, impossible de savoir pourquoi une offre a disparu.
create table if not exists public.or_journal (
  id        bigserial   primary key,
  quand     timestamptz not null default now(),
  qui       text        not null,
  action    text        not null,
  objet     text,
  details   jsonb       not null default '{}'::jsonb
);

create index if not exists or_journal_quand on public.or_journal (quand desc);

-- ===========================================================================
--  VERROUILLAGE
--  RLS activé, aucune politique : personne n'entre par la clé publique.
--  service_role (utilisée uniquement par les fonctions serverless) n'est pas
--  soumise à RLS, c'est elle qui travaille.
-- ===========================================================================

alter table public.or_parametres    enable row level security;
alter table public.or_maillots      enable row level security;
alter table public.or_encheres      enable row level security;
alter table public.or_admins        enable row level security;
alter table public.or_journal       enable row level security;
alter table public.or_notifications enable row level security;

alter table public.or_parametres    force row level security;
alter table public.or_maillots      force row level security;
alter table public.or_encheres      force row level security;
alter table public.or_admins        force row level security;
alter table public.or_journal       force row level security;
alter table public.or_notifications force row level security;

revoke all on public.or_parametres, public.or_maillots, public.or_encheres,
              public.or_admins,     public.or_journal, public.or_notifications
  from anon, authenticated;

-- ===========================================================================
--  LOGIQUE MÉTIER
--  Tout ce qui décide est ici, dans la base. Les fonctions serverless ne
--  font que transmettre : elles ne calculent aucun montant et ne jugent
--  aucune date, pour qu'il n'existe qu'UN seul endroit où la règle vit.
-- ===========================================================================

-- Meilleure offre confirmée sur un maillot, ou null s'il n'y en a aucune.
create or replace function public.or_meilleure_offre(p_maillot uuid)
returns integer
language sql stable security definer set search_path = public, pg_temp as $$
  select max(montant) from public.or_encheres
   where maillot_id = p_maillot and statut = 'confirmee';
$$;

-- Montant minimum de la prochaine offre recevable.
--   aucune offre encore  -> prix de départ du maillot (ou mise à prix générale)
--   une offre existante  -> meilleure offre + palier
create or replace function public.or_minimum(p_maillot uuid)
returns integer
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_meilleure integer;
  v_depart    integer;
  v_palier    integer;
begin
  select coalesce(m.prix_depart, p.mise_a_prix), p.palier
    into v_depart, v_palier
    from public.or_maillots m cross join public.or_parametres p
   where m.id = p_maillot;

  if v_depart is null then
    raise exception 'MAILLOT_INCONNU';
  end if;

  v_meilleure := public.or_meilleure_offre(p_maillot);
  if v_meilleure is null then
    return v_depart;
  end if;
  return v_meilleure + v_palier;
end $$;

-- Les enchères sont-elles ouvertes, à cet instant précis ?
-- Le serveur fait foi : l'horloge du visiteur n'est jamais consultée.
create or replace function public.or_etat()
returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p public.or_parametres;
begin
  select * into p from public.or_parametres where id = 1;
  if not found then return 'inactif'; end if;
  if not p.encheres_activees then return 'preparation'; end if;
  if now() <  p.ouverture then return 'avant';   end if;
  if now() >= p.cloture   then return 'termine'; end if;
  return 'encours';
end $$;

-- --------------------------------------------------------------------------
--  Dépôt d'une offre : elle naît EN ATTENTE et ne compte pas encore.
--  Une offre non confirmée ne modifie jamais le montant public et ne peut
--  jamais être déclarée gagnante.
-- --------------------------------------------------------------------------
create or replace function public.or_deposer_offre(
  p_numero      integer,
  p_prenom      text,
  p_nom         text,
  p_email       text,
  p_telephone   text,
  p_montant     integer,
  p_empreinte   text,
  p_validite    interval default interval '20 minutes',
  p_reglement   boolean  default false,
  p_ip          inet     default null
) returns table (enchere_id uuid, minimum integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_maillot uuid;
  v_min     integer;
  v_palier  integer;
begin
  if not p_reglement then
    raise exception 'REGLEMENT_NON_ACCEPTE';
  end if;

  if public.or_etat() <> 'encours' then
    raise exception 'ENCHERES_FERMEES';
  end if;

  select id into v_maillot from public.or_maillots
   where numero = p_numero and visible;
  if v_maillot is null then
    raise exception 'MAILLOT_INCONNU';
  end if;

  -- Garde-fou contre l'inondation du formulaire. Les seuils sont larges :
  -- une personne qui suit trois maillots et se fait doubler plusieurs fois
  -- enchérit légitimement souvent. Il s'agit d'arrêter un robot, pas un
  -- enchérisseur motivé.
  if (select count(*) from public.or_encheres
       where lower(email) = lower(btrim(p_email))
         and cree_le > now() - interval '1 hour') >= 20 then
    raise exception 'TROP_D_OFFRES_EMAIL';
  end if;
  if p_ip is not null and (select count(*) from public.or_encheres
       where ip = p_ip and cree_le > now() - interval '1 hour') >= 40 then
    raise exception 'TROP_D_OFFRES_IP';
  end if;

  -- On verrouille dès le dépôt : le minimum annoncé au visiteur est alors
  -- cohérent avec ce que la base contient au même instant.
  perform 1 from public.or_maillots where id = v_maillot for update;

  v_min := public.or_minimum(v_maillot);
  select palier into v_palier from public.or_parametres where id = 1;

  if p_montant < v_min then
    raise exception 'MONTANT_INSUFFISANT: %', v_min;
  end if;
  -- Au-dessus du minimum, le montant doit rester un multiple du palier :
  -- 55, 60, 65… mais pas 57.
  if ((p_montant - v_min) % v_palier) <> 0 then
    raise exception 'PALIER_NON_RESPECTE: %', v_palier;
  end if;

  insert into public.or_encheres
    (maillot_id, prenom, nom, email, telephone, montant,
     code_empreinte, code_expire_le, reglement_accepte, ip)
  values
    (v_maillot, btrim(p_prenom), btrim(p_nom), lower(btrim(p_email)),
     btrim(p_telephone), p_montant, p_empreinte, now() + p_validite, true, p_ip)
  returning id into enchere_id;

  minimum := v_min;
  return next;
end $$;

-- --------------------------------------------------------------------------
--  Confirmation : LE moment qui compte.
--
--  On revérifie TOUT, parce que le monde a pu bouger pendant que le visiteur
--  allait chercher son e-mail : la clôture a pu tomber, et surtout quelqu'un
--  d'autre a pu surenchérir. Le verrou sur le maillot sérialise les
--  confirmations simultanées.
--
--  ⚠ CETTE FONCTION NE LÈVE PAS D'EXCEPTION pour les refus, et c'est
--  délibéré. Un « raise » annule toute la transaction de la fonction, donc
--  aussi les écritures qui le précèdent : le compteur de tentatives et le
--  passage en « expirée » seraient perdus à chaque refus. Le code à six
--  chiffres deviendrait alors attaquable indéfiniment. Les refus sont donc
--  renvoyés comme un statut, que la route serverless traduit en message.
--
--  Statuts possibles : confirmee, deja_confirmee, code_invalide,
--  code_expire, trop_de_tentatives, surencherie, fermees, inconnue,
--  non_confirmable.
-- --------------------------------------------------------------------------
create or replace function public.or_confirmer_offre(
  p_enchere   uuid,
  p_empreinte text
) returns table (statut text, montant integer, minimum integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  e public.or_encheres;
  v_min integer;
  v_precedent text;
begin
  select * into e from public.or_encheres where id = p_enchere;
  if not found then
    return query select 'inconnue'::text, null::integer, null::integer;
    return;
  end if;

  if e.statut = 'confirmee' then
    -- Lien déjà utilisé : on le dit, sans rien changer ni rien révéler.
    return query select 'deja_confirmee'::text, e.montant, public.or_minimum(e.maillot_id);
    return;
  end if;
  if e.statut <> 'en_attente' then
    return query select 'non_confirmable'::text, e.montant, public.or_minimum(e.maillot_id);
    return;
  end if;

  -- L'ordre compte : on plafonne les tentatives AVANT de regarder le code,
  -- sinon la limite ne servirait à rien.
  if e.tentatives >= 5 then
    return query select 'trop_de_tentatives'::text, e.montant, null::integer;
    return;
  end if;
  if e.code_expire_le is null or now() > e.code_expire_le then
    update public.or_encheres set statut = 'expiree' where id = p_enchere;
    return query select 'code_expire'::text, e.montant, public.or_minimum(e.maillot_id);
    return;
  end if;
  if e.code_empreinte is distinct from p_empreinte then
    update public.or_encheres set tentatives = tentatives + 1 where id = p_enchere;
    return query select 'code_invalide'::text, e.montant, null::integer;
    return;
  end if;

  -- Verrou : à partir d'ici, personne d'autre ne confirme sur ce maillot.
  perform 1 from public.or_maillots where id = e.maillot_id for update;

  if public.or_etat() <> 'encours' then
    return query select 'fermees'::text, e.montant, null::integer;
    return;
  end if;

  v_min := public.or_minimum(e.maillot_id);
  if e.montant < v_min then
    -- Quelqu'un est passé devant pendant la vérification. L'offre n'est pas
    -- perdue par erreur : elle est marquée expirée et le visiteur est invité
    -- à en refaire une, avec le nouveau minimum sous les yeux.
    update public.or_encheres set statut = 'expiree' where id = p_enchere;
    return query select 'surencherie'::text, e.montant, v_min;
    return;
  end if;

  -- Qui menait AVANT cette offre ? À capturer ici : une ligne plus bas, la
  -- nouvelle offre serait sa propre « offre précédente ».
  -- Les colonnes sont préfixées : « statut » et « montant » sont aussi des
  -- paramètres de sortie de cette fonction, et PostgreSQL refuse l'ambiguïté.
  select o.email into v_precedent
    from public.or_encheres o
   where o.maillot_id = e.maillot_id and o.statut = 'confirmee'
   order by o.montant desc, o.confirmee_le asc
   limit 1;

  update public.or_encheres
     set statut = 'confirmee', confirmee_le = now(),
         code_empreinte = null, code_expire_le = null
   where id = p_enchere;

  insert into public.or_journal (qui, action, objet, details)
  values ('systeme', 'offre_confirmee', p_enchere::text,
          jsonb_build_object('montant', e.montant, 'maillot', e.maillot_id));

  -- Les e-mails à envoyer sont inscrits ici, pas envoyés ici : une panne du
  -- service d'e-mail ne doit jamais faire échouer une enchère déjà valide.
  insert into public.or_notifications (enchere_id, genre, destinataire)
  values (p_enchere, 'confirmation', e.email)
  on conflict do nothing;

  insert into public.or_notifications (enchere_id, genre, destinataire)
  select p_enchere, 'admin', p.email_notification
    from public.or_parametres p where p.id = 1
  on conflict do nothing;

  -- La personne dépassée est prévenue — sauf si c'est elle-même qui vient de
  -- monter son offre : on ne s'envoie pas un e-mail à soi.
  if v_precedent is not null and lower(v_precedent) <> lower(e.email) then
    insert into public.or_notifications (enchere_id, genre, destinataire)
    values (p_enchere, 'surenchere', v_precedent)
    on conflict do nothing;
  end if;

  return query select 'confirmee'::text, e.montant, public.or_minimum(e.maillot_id);
end $$;

-- --------------------------------------------------------------------------
--  Administration : annuler puis, le cas échéant, restaurer une offre.
--  Dans les deux cas la meilleure offre se recalcule d'elle-même, puisqu'elle
--  n'est jamais stockée mais toujours déduite des offres confirmées.
-- --------------------------------------------------------------------------
create or replace function public.or_annuler_offre(
  p_enchere uuid, p_par text, p_motif text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare e public.or_encheres;
begin
  select * into e from public.or_encheres where id = p_enchere;
  if not found then raise exception 'OFFRE_INCONNUE'; end if;
  if e.statut = 'annulee' then return; end if;

  update public.or_encheres
     set statut = 'annulee', annulee_le = now(),
         annulee_par = p_par, motif_annulation = p_motif,
         confirmee_le = null
   where id = p_enchere;

  insert into public.or_journal (qui, action, objet, details)
  values (p_par, 'offre_annulee', p_enchere::text,
          jsonb_build_object('montant', e.montant, 'statut_avant', e.statut,
                             'motif', p_motif));
end $$;

create or replace function public.or_restaurer_offre(
  p_enchere uuid, p_par text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare e public.or_encheres;
begin
  select * into e from public.or_encheres where id = p_enchere;
  if not found then raise exception 'OFFRE_INCONNUE'; end if;
  if e.statut <> 'annulee' then raise exception 'OFFRE_NON_ANNULEE'; end if;

  perform 1 from public.or_maillots where id = e.maillot_id for update;

  update public.or_encheres
     set statut = 'confirmee', confirmee_le = coalesce(e.confirmee_le, now()),
         annulee_le = null, annulee_par = null, motif_annulation = null
   where id = p_enchere;

  insert into public.or_journal (qui, action, objet, details)
  values (p_par, 'offre_restauree', p_enchere::text,
          jsonb_build_object('montant', e.montant));
end $$;

-- --------------------------------------------------------------------------
--  Vue publique : ce que le site a le droit de montrer. Montants seulement.
--  Aucune colonne de coordonnées, par construction.
-- --------------------------------------------------------------------------
create or replace view public.or_v_maillots_public as
  select m.id, m.numero, m.nom, m.poste, m.taille, m.description,
         m.photos, m.photo_illustration,
         coalesce(m.prix_depart, p.mise_a_prix) as prix_depart,
         public.or_meilleure_offre(m.id)        as meilleure_offre,
         public.or_minimum(m.id)                as minimum,
         (select count(*) from public.or_encheres e
           where e.maillot_id = m.id and e.statut = 'confirmee') as nb_offres
    from public.or_maillots m
    cross join public.or_parametres p
   where m.visible;

-- ===========================================================================
--  ENVOI DES E-MAILS
--  La base dit QUOI envoyer et À QUI ; la fonction serverless se charge du
--  comment. Elle marque chaque ligne envoyée ou en erreur, ce qui permet de
--  réessayer sans jamais renvoyer deux fois le même message.
-- ===========================================================================

create or replace function public.or_notifications_a_envoyer(p_limite integer default 20)
returns table (
  id              bigint,
  genre           text,
  destinataire    text,
  prenom          text,
  montant         integer,
  numero          integer,
  joueur          text,
  taille          text,
  meilleure_offre integer,
  minimum         integer,
  cloture         timestamptz,
  modalites       text
)
language sql security definer set search_path = public, pg_temp as $$
  -- Jointures externes : le bilan de clôture n'est lié à aucune enchère, il
  -- doit quand même remonter dans la file.
  select n.id, n.genre, n.destinataire,
         e.prenom, e.montant,
         m.numero, m.nom, m.taille,
         public.or_meilleure_offre(m.id),
         public.or_minimum(m.id),
         p.cloture, p.modalites_reglement
    from public.or_notifications n
    left join public.or_encheres e on e.id = n.enchere_id
    left join public.or_maillots  m on m.id = e.maillot_id
    cross join public.or_parametres p
   where n.envoye_le is null
     and n.tentatives < 5          -- au-delà, c'est à un humain de regarder
   order by n.cree_le
   limit p_limite;
$$;

create or replace function public.or_notification_envoyee(p_id bigint)
returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.or_notifications
     set envoye_le = now(), tentatives = tentatives + 1, derniere_erreur = null
   where id = p_id and envoye_le is null;
$$;

create or replace function public.or_notification_echouee(p_id bigint, p_erreur text)
returns void
language sql security definer set search_path = public, pg_temp as $$
  update public.or_notifications
     set tentatives = tentatives + 1, derniere_erreur = left(p_erreur, 500)
   where id = p_id and envoye_le is null;
$$;

-- --------------------------------------------------------------------------
--  Clôture : inscrit l'e-mail de chaque gagnant.
--  Rejouable sans risque — la contrainte d'unicité empêche le doublon, donc
--  relancer la fonction ne réexpédie rien.
-- --------------------------------------------------------------------------
create or replace function public.or_cloturer(p_par text default 'systeme')
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_nb integer;
begin
  if public.or_etat() <> 'termine' then
    raise exception 'ENCHERES_NON_TERMINEES';
  end if;

  with gagnantes as (
    select distinct on (e.maillot_id) e.id, e.email
      from public.or_encheres e
     where e.statut = 'confirmee'
     order by e.maillot_id, e.montant desc, e.confirmee_le asc
  ),
  inserees as (
    insert into public.or_notifications (enchere_id, genre, destinataire)
    select g.id, 'gagnant', g.email from gagnantes g
    on conflict do nothing
    returning 1
  )
  select count(*) into v_nb from inserees;

  -- Le bilan pour le club : la liste complète des gagnants, en un seul
  -- e-mail, pour qu'Elisa n'ait pas à recoller vingt et une notifications.
  insert into public.or_notifications (enchere_id, genre, destinataire)
  select null, 'bilan', p.email_notification
    from public.or_parametres p where p.id = 1
  on conflict do nothing;

  insert into public.or_journal (qui, action, details)
  values (p_par, 'cloture', jsonb_build_object('gagnants_notifies', v_nb));

  return v_nb;
end $$;

-- --------------------------------------------------------------------------
--  Ce que le site a le droit de lire, prêt à servir.
--  Deux fonctions, deux réponses JSON : les routes serveur n'ont plus qu'à
--  les transmettre. Les champs sont énumérés un par un — l'adresse e-mail de
--  notification du club, par exemple, ne doit jamais sortir d'ici.
-- --------------------------------------------------------------------------
create or replace function public.or_catalogue()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(to_jsonb(v) order by v.numero), '[]'::jsonb)
    from public.or_v_maillots_public v;
$$;

create or replace function public.or_parametres_publics()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'actif',             true,
    'encheresActivees',  p.encheres_activees,
    'etat',              public.or_etat(),
    'titre',             p.titre,
    'sousTitre',         p.sous_titre,
    'ouverture',         p.ouverture,
    'cloture',           p.cloture,
    'miseAPrix',         p.mise_a_prix,
    'palier',            p.palier,
    'reglement',         p.reglement,
    'nombreMaillots',    (select count(*) from public.or_maillots where visible),
    'serveurMaintenant', now()
  ) from public.or_parametres p where p.id = 1;
$$;

-- Les gagnants, une fois la clôture passée. Réservé à l'administration.
create or replace function public.or_gagnants()
returns table (numero integer, maillot text, taille text,
               prenom text, nom text, email text, telephone text,
               montant integer, confirmee_le timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select distinct on (m.numero)
         m.numero, m.nom, m.taille,
         e.prenom, e.nom, e.email, e.telephone, e.montant, e.confirmee_le
    from public.or_maillots m
    join public.or_encheres e on e.maillot_id = m.id and e.statut = 'confirmee'
   order by m.numero, e.montant desc, e.confirmee_le asc;
$$;

-- Les fonctions ne sont appelables que par le serveur.
revoke all on function
  public.or_meilleure_offre(uuid), public.or_minimum(uuid), public.or_etat(),
  public.or_deposer_offre(integer,text,text,text,text,integer,text,interval,boolean,inet),
  public.or_confirmer_offre(uuid,text),
  public.or_annuler_offre(uuid,text,text), public.or_restaurer_offre(uuid,text),
  public.or_gagnants(), public.or_cloturer(text),
  public.or_catalogue(), public.or_parametres_publics(),
  public.or_notifications_a_envoyer(integer),
  public.or_notification_envoyee(bigint),
  public.or_notification_echouee(bigint,text)
  from anon, authenticated, public;

revoke all on public.or_v_maillots_public from anon, authenticated;

-- ===========================================================================
--  PARAMÈTRES DE DÉPART
--  Dates à ajuster depuis l'administration. encheres_activees reste à false :
--  rien ne s'ouvre tant que le club ne l'a pas décidé explicitement.
-- ===========================================================================
insert into public.or_parametres
  (id, ouverture, cloture, mise_a_prix, palier, encheres_activees, email_notification)
values
  (1, '2026-10-25 00:00:00+02', '2026-10-30 00:00:00+01', 30, 5, false,
   'elisa.33160@yahoo.fr')
on conflict (id) do nothing;
