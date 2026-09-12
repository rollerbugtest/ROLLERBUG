-- ===========================================================================
--  Roller Bug — base commune à l'application et au site
--
--  À exécuter UNE FOIS dans Supabase :
--  projet → SQL Editor → New query → coller ce fichier → Run.
--
--  Ce que ça crée :
--    • profiles   — prénom / nom / email de chaque compte
--    • favorites  — équipes et disciplines suivies
--  Les mots de passe ne sont PAS ici : Supabase les gère dans auth.users,
--  hachés, et personne (pas même toi) ne peut les lire.
--
--  Sécurité : chaque table est verrouillée par « Row Level Security ».
--  Un compte connecté ne voit et ne modifie QUE ses propres lignes, même si
--  quelqu'un récupère la clé publique du site — elle est faite pour être
--  publique, c'est RLS qui protège les données.
-- ===========================================================================

-- ---------------------------------------------------------------- profils --
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  first_name  text        not null default '',
  last_name   text        not null default '',
  email       text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profil visible par son propriétaire" on public.profiles;
create policy "profil visible par son propriétaire"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profil modifiable par son propriétaire" on public.profiles;
create policy "profil modifiable par son propriétaire"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profil créable par son propriétaire" on public.profiles;
create policy "profil créable par son propriétaire"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---------------------------------------------------------------- favoris --
--  Une ligne par favori. « kind » distingue une équipe d'une discipline,
--  « ref_id » reprend l'identifiant utilisé dans api/teams.json et
--  api/disciplines.json (u13, n1, freestyle…), pour que l'app et le site
--  désignent exactement la même chose.
create table if not exists public.favorites (
  user_id     uuid        not null references auth.users on delete cascade,
  kind        text        not null check (kind in ('team', 'discipline')),
  ref_id      text        not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, kind, ref_id)
);

alter table public.favorites enable row level security;

drop policy if exists "favoris lisibles par leur propriétaire" on public.favorites;
create policy "favoris lisibles par leur propriétaire"
  on public.favorites for select
  using (auth.uid() = user_id);

drop policy if exists "favoris ajoutables par leur propriétaire" on public.favorites;
create policy "favoris ajoutables par leur propriétaire"
  on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "favoris supprimables par leur propriétaire" on public.favorites;
create policy "favoris supprimables par leur propriétaire"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- ------------------------------------------- création automatique du profil --
--  À l'inscription, Supabase crée la ligne dans auth.users ; ce déclencheur
--  crée la ligne correspondante dans profiles, en reprenant le prénom et le
--  nom transmis à l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------- horodatage des updates --
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
