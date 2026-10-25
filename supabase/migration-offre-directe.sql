-- ===========================================================================
--  Offre directe — suppression du code de vérification par e-mail.
--
--  À exécuter dans le SQL Editor de Supabase, APRÈS encheres.sql.
--  Rejouable sans risque : la fonction est remplacée, rien n'est effacé.
--
--  CE QUE CHANGE CETTE MIGRATION
--
--  Jusqu'ici, une offre naissait « en attente » et ne devenait réelle qu'une
--  fois saisi un code à six chiffres reçu par e-mail. Le bureau a choisi de
--  supprimer cette étape pour tenir dans le quota de cent e-mails par jour
--  du forfait gratuit. Une offre est donc désormais valide immédiatement,
--  et un seul e-mail part : l'alerte à la personne dépassée.
--
--  CE QUE CELA COÛTE — à savoir, et à assumer sciemment
--
--  Plus rien ne prouve que l'adresse saisie appartient à la personne qui
--  enchérit. Quelqu'un peut donc enchérir au nom d'un tiers, et le club
--  découvrira à la clôture que le gagnant n'a jamais rien demandé.
--  L'article 11 du règlement (annulation d'une offre, retour à l'offre
--  précédente) devient le seul recours : il servira.
--
--  Deux garde-fous subsistent, et un troisième est ajouté ici :
--    • vingt offres par heure et par adresse ;
--    • quarante offres par heure et par appareil ;
--    • AJOUT : vingt-cinq alertes de surenchère par adresse et par jour.
--      Sans lui, il suffirait de saisir l'adresse de quelqu'un puis de se
--      surenchérir soi-même en boucle pour lui envoyer des dizaines de
--      messages depuis le domaine du club — et faire blacklister ce domaine.
--
--  POUR REVENIR EN ARRIÈRE : rien à défaire ici. or_deposer_offre et
--  or_confirmer_offre sont intactes ; il suffit que api/encheres/offrir.js
--  les rappelle, et de remettre l'étape du code dans la page du maillot.
-- ===========================================================================

create or replace function public.or_offrir_direct(
  p_numero    integer,
  p_prenom    text,
  p_nom       text,
  p_email     text,
  p_telephone text,
  p_montant   integer,
  p_reglement boolean default false,
  p_ip        inet    default null
) returns table (enchere_id uuid, montant_retenu integer, minimum integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_maillot   uuid;
  v_min       integer;
  v_palier    integer;
  v_precedent text;
  v_id        uuid;
  v_email     text := lower(btrim(p_email));
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

  -- Garde-fous contre l'inondation du formulaire. Ils comptent plus qu'avant :
  -- déposer une offre ne coûte plus rien à personne.
  if (select count(*) from public.or_encheres
       where lower(email) = v_email
         and cree_le > now() - interval '1 hour') >= 20 then
    raise exception 'TROP_D_OFFRES_EMAIL';
  end if;
  if p_ip is not null and (select count(*) from public.or_encheres
       where ip = p_ip and cree_le > now() - interval '1 hour') >= 40 then
    raise exception 'TROP_D_OFFRES_IP';
  end if;

  -- Verrou sur le maillot : tout ce qui suit est sérialisé. Deux personnes
  -- qui enchérissent à la même seconde passent l'une après l'autre, et la
  -- seconde se voit refuser son montant s'il est devenu insuffisant.
  perform 1 from public.or_maillots where id = v_maillot for update;

  v_min := public.or_minimum(v_maillot);
  select palier into v_palier from public.or_parametres where id = 1;

  if p_montant < v_min then
    raise exception 'MONTANT_INSUFFISANT: %', v_min;
  end if;
  if ((p_montant - v_min) % v_palier) <> 0 then
    raise exception 'PALIER_NON_RESPECTE: %', v_palier;
  end if;

  -- Qui menait AVANT cette offre ? À lire ici : une ligne plus bas, la
  -- nouvelle offre serait sa propre « offre précédente ».
  select o.email into v_precedent
    from public.or_encheres o
   where o.maillot_id = v_maillot and o.statut = 'confirmee'
   order by o.montant desc, o.confirmee_le asc
   limit 1;

  -- L'offre naît confirmée : il n'y a plus d'étape intermédiaire.
  insert into public.or_encheres
    (maillot_id, prenom, nom, email, telephone, montant,
     statut, confirmee_le, reglement_accepte, ip)
  values
    (v_maillot, btrim(p_prenom), btrim(p_nom), v_email,
     btrim(p_telephone), p_montant, 'confirmee', now(), true, p_ip)
  returning id into v_id;

  insert into public.or_journal (qui, action, objet, details)
  values ('systeme', 'offre_directe', v_id::text,
          jsonb_build_object('montant', p_montant, 'maillot', v_maillot));

  -- Le seul e-mail conservé pendant les enchères. Ni confirmation à
  -- l'enchérisseur, ni alerte au bureau à chaque offre : c'est le choix du
  -- bureau pour tenir dans le quota. Les e-mails de clôture — gagnants et
  -- bilan — ne sont pas concernés et partent toujours.
  if v_precedent is not null and v_precedent <> v_email then
    if (select count(*) from public.or_notifications
         where destinataire = v_precedent
           and genre = 'surenchere'
           and cree_le > now() - interval '24 hours') < 25 then
      insert into public.or_notifications (enchere_id, genre, destinataire)
      values (v_id, 'surenchere', v_precedent)
      on conflict do nothing;
    else
      -- Trace, pour qu'un plafond atteint ne passe pas inaperçu.
      insert into public.or_journal (qui, action, objet, details)
      values ('systeme', 'surenchere_plafonnee', v_id::text,
              jsonb_build_object('raison', '25 alertes en 24 h pour cette adresse'));
    end if;
  end if;

  enchere_id     := v_id;
  montant_retenu := p_montant;
  minimum        := public.or_minimum(v_maillot);
  return next;
end $$;

-- Comme toutes les autres : seule la clé de service, côté serveur, y accède.
revoke all on function public.or_offrir_direct(integer, text, text, text, text, integer, boolean, inet)
  from anon, authenticated, public;

-- Contrôle : doit afficher « or_offrir_direct | 1 ».
select proname, count(*) from pg_proc
 where proname = 'or_offrir_direct'
 group by proname;
