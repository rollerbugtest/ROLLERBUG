-- ===========================================================================
--  SUIVI DES ENCHÈRES — le tableau de bord d'Elisa, en attendant mieux
--
--  À utiliser dans le SQL Editor de Supabase, pendant et après l'opération.
--
--  CE FICHIER EST UN MENU, PAS UN SCRIPT. On copie UN bloc à la fois dans
--  l'éditeur, on l'exécute, on lit le résultat. Ne pas tout coller d'un coup.
--
--  Les blocs A à G ne font que LIRE : aucun risque, on peut les relancer
--  autant qu'on veut. Les blocs H et I MODIFIENT la base ; ils sont
--  volontairement mis en commentaire, il faut retirer les « -- » à la main.
--
--  ⚠ Les blocs C, D et H affichent des coordonnées de participants. Ce sont
--  des données personnelles : on ne les recopie pas dans un message, on ne
--  les laisse pas traîner dans un tableur partagé, et on ne les garde pas
--  au-delà de ce qu'annonce l'article 12 du règlement.
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  A. OÙ EN EST-ON ? — le coup d'œil quotidien
-- ---------------------------------------------------------------------------
select public.or_etat()                                   as etat,
       to_char(p.ouverture at time zone 'Europe/Paris',
               'DD/MM/YYYY HH24"h"MI')                    as ouverture,
       to_char(p.cloture   at time zone 'Europe/Paris',
               'DD/MM/YYYY HH24"h"MI')                    as cloture,
       case when p.encheres_activees then 'OUI' else 'NON — rien n''est ouvert'
       end                                                as interrupteur,
       (select count(*) from public.or_encheres
         where statut = 'confirmee')                      as offres,
       (select count(distinct maillot_id) from public.or_encheres
         where statut = 'confirmee')                      as maillots_avec_offre,
       (select count(*) from public.or_notifications
         where envoye_le is null)                         as emails_en_attente
  from public.or_parametres p where p.id = 1;


-- ---------------------------------------------------------------------------
--  B. LES 21 MAILLOTS — où en est chacun, sans aucune donnée personnelle.
--     C'est le bloc à montrer en réunion de bureau.
-- ---------------------------------------------------------------------------
select m.numero,
       m.nom                                        as joueur,
       m.poste,
       m.taille,
       coalesce(public.or_meilleure_offre(m.id), 0) as meilleure_offre,
       public.or_minimum(m.id)                      as prochaine_offre_mini,
       (select count(*) from public.or_encheres e
         where e.maillot_id = m.id and e.statut = 'confirmee') as nb_offres
  from public.or_maillots m
 where m.visible
 order by coalesce(public.or_meilleure_offre(m.id), 0) desc, m.numero;


-- ---------------------------------------------------------------------------
--  C. QUI MÈNE SUR CHAQUE MAILLOT — avec les coordonnées.
--     Pendant les enchères, on n'en a presque jamais besoin : à n'ouvrir
--     que pour vérifier une offre douteuse.
-- ---------------------------------------------------------------------------
select distinct on (m.numero)
       m.numero, m.nom as joueur, e.montant,
       e.prenom, e.nom as nom_enchérisseur, e.email, e.telephone,
       to_char(e.confirmee_le at time zone 'Europe/Paris',
               'DD/MM HH24"h"MI') as depuis
  from public.or_maillots m
  join public.or_encheres e
    on e.maillot_id = m.id and e.statut = 'confirmee'
 order by m.numero, e.montant desc, e.confirmee_le asc;


-- ---------------------------------------------------------------------------
--  D. LES GAGNANTS — après la clôture. C'est la liste à partir de laquelle
--     Elisa contacte, encaisse et remet les maillots.
-- ---------------------------------------------------------------------------
select * from public.or_gagnants() order by numero;


-- ---------------------------------------------------------------------------
--  E. COMBIEN A-T-ON RÉCOLTÉ ? — le total reversé, et le détail par poste.
--     Pendant les enchères, c'est le total provisoire.
-- ---------------------------------------------------------------------------
select count(*)      as maillots_vendus,
       sum(montant)  as total_euros,
       round(avg(montant))      as moyenne,
       min(montant)  as plus_basse,
       max(montant)  as plus_haute
  from public.or_gagnants();


-- ---------------------------------------------------------------------------
--  F. LES E-MAILS — ce qui attend, et surtout ce qui coince.
--     Si « derniere_erreur » est renseignée, l'envoi a échoué : lire le
--     message, c'est en général la clé Resend ou le domaine.
-- ---------------------------------------------------------------------------
select n.genre,
       count(*) filter (where n.envoye_le is not null) as partis,
       count(*) filter (where n.envoye_le is null)     as en_attente
  from public.or_notifications n
 group by n.genre
 order by n.genre;

select n.id, n.genre, n.destinataire, n.tentatives, n.derniere_erreur,
       to_char(n.cree_le at time zone 'Europe/Paris', 'DD/MM HH24"h"MI') as depuis
  from public.or_notifications n
 where n.envoye_le is null
 order by n.cree_le
 limit 50;


-- ---------------------------------------------------------------------------
--  G. LE JOURNAL — ce que le système a fait. À regarder si quelque chose
--     paraît bizarre. « surenchere_plafonnee » signale une adresse qui a
--     atteint ses 25 alertes du jour : à surveiller, c'est le signe d'un
--     maillot très disputé... ou de quelqu'un qui s'amuse.
-- ---------------------------------------------------------------------------
select to_char(quand at time zone 'Europe/Paris', 'DD/MM HH24"h"MI:SS') as horodatage,
       qui, action, objet, details
  from public.or_journal
 order by quand desc
 limit 100;


-- ===========================================================================
--  LES BLOCS SUIVANTS MODIFIENT LA BASE.
--  Retirer les « -- » à la main, et seulement en sachant ce qu'on fait.
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  H. ANNULER UNE OFFRE (article 11 du règlement) — offre manifestement
--     fausse, ou gagnant injoignable. Le maillot revient AUTOMATIQUEMENT à
--     l'offre précédente : il n'y a rien d'autre à faire.
--
--     1) retrouver l'offre à annuler (remplacer 88 par le bon numéro) :
-- ---------------------------------------------------------------------------
-- select e.id, e.montant, e.prenom, e.nom, e.email, e.telephone, e.statut,
--        to_char(e.cree_le at time zone 'Europe/Paris', 'DD/MM HH24"h"MI') as depose
--   from public.or_encheres e
--   join public.or_maillots m on m.id = e.maillot_id
--  where m.numero = 88
--  order by e.montant desc;

--     2) annuler, en collant l'identifiant trouvé ci-dessus et en disant
--        QUI annule et POURQUOI — le journal garde la trace :
-- select public.or_annuler_offre(
--   'COLLER-ICI-L-IDENTIFIANT'::uuid,
--   'Elisa',
--   'Coordonnées injoignables après trois relances');

--     3) en cas d'erreur, on restaure :
-- select public.or_restaurer_offre('COLLER-ICI-L-IDENTIFIANT'::uuid, 'Elisa');


-- ---------------------------------------------------------------------------
--  I. OUVRIR, PROLONGER, FERMER
--
--     Ouvrir les enchères au public. À ne faire qu'après l'essai à blanc et
--     la remise à zéro, et seulement quand le site est publié :
-- ---------------------------------------------------------------------------
-- update public.or_parametres set encheres_activees = true where id = 1;

--     Refermer immédiatement, si quelque chose tourne mal. Les offres déjà
--     déposées sont conservées ; seul le dépôt de nouvelles offres s'arrête :
-- update public.or_parametres set encheres_activees = false where id = 1;

--     Changer les dates (ici : ouverture le 27 octobre à 18h, clôture le
--     2 novembre à 20h, heure de Paris). Le site et le règlement suivent
--     tout seuls, il n'y a rien à modifier ailleurs :
-- update public.or_parametres
--    set ouverture = timestamptz '2026-10-27 18:00:00+01',
--        cloture   = timestamptz '2026-11-02 20:00:00+01'
--  where id = 1;

--     Écrire les modalités de règlement et de remise. CE TEXTE PART TEL QUEL
--     dans les 21 e-mails de gagnant : à relire deux fois, et à remplir
--     AVANT la clôture, sinon les gagnants reçoivent un message incomplet.
-- update public.or_parametres
--    set modalites_reglement = 'Règlement par chèque à l''ordre de … ou en '
--        'espèces, à la remise du maillot à l''Espace Roller, …'
--  where id = 1;


-- ---------------------------------------------------------------------------
--  J. EFFACER LES COORDONNÉES DES PARTICIPANTS QUI N'ONT RIEN REMPORTÉ
--
--     L'article 12 du règlement promet que ces coordonnées sont effacées dès
--     la clôture. Une promesse sans bouton ne se tient pas : voici le bouton.
--
--     Les montants, les dates et le déroulé des enchères sont conservés —
--     c'est la mémoire de l'opération, et elle ne contient alors plus rien
--     de personnel. Seuls le prénom, le nom, l'adresse e-mail, le téléphone
--     et l'adresse IP disparaissent. C'EST DÉFINITIF.
--
--     Comme pour la remise à zéro : par défaut ce bloc n'efface rien et se
--     contente d'annoncer ce qu'il ferait.
-- ---------------------------------------------------------------------------
-- do $$
-- declare
--   -- ⚠⚠⚠  LA SEULE LIGNE À MODIFIER  ⚠⚠⚠
--   v_confirmation text := 'NON';
--   v_a_effacer integer;
--   v_gagnants  integer;
-- begin
--   select count(*) into v_a_effacer
--     from public.or_encheres e
--    where e.email <> 'efface@exemple.invalid'
--      and e.id not in (select distinct on (x.maillot_id) x.id
--                         from public.or_encheres x
--                        where x.statut = 'confirmee'
--                        order by x.maillot_id, x.montant desc, x.confirmee_le asc);
--   select count(*) into v_gagnants from public.or_gagnants();
--
--   if v_confirmation is distinct from 'OUI, EFFACER' then
--     raise exception E'RIEN N''A ÉTÉ EFFACÉ (comportement par défaut).\n'
--       '  coordonnées qui seraient effacées : %\n'
--       '  gagnants préservés                : %\n'
--       'Pour effacer réellement, remplacer NON par OUI, EFFACER.',
--       v_a_effacer, v_gagnants;
--   end if;
--
--   update public.or_encheres e
--      set prenom = '—', nom = 'effacé', email = 'efface@exemple.invalid',
--          telephone = '000000', ip = null
--    where e.email <> 'efface@exemple.invalid'
--      and e.id not in (select distinct on (x.maillot_id) x.id
--                         from public.or_encheres x
--                        where x.statut = 'confirmee'
--                        order by x.maillot_id, x.montant desc, x.confirmee_le asc);
--
--   -- Les e-mails déjà envoyés gardaient l'adresse du destinataire.
--   update public.or_notifications n
--      set destinataire = 'efface@exemple.invalid'
--    where n.destinataire <> 'efface@exemple.invalid'
--      and n.destinataire <> (select p.email_notification
--                               from public.or_parametres p where p.id = 1)
--      and not exists (select 1 from public.or_encheres e
--                       where lower(e.email) = lower(n.destinataire)
--                         and e.email <> 'efface@exemple.invalid');
--
--   raise notice 'Coordonnées de % participants effacées. Les % gagnants sont conservés.',
--     v_a_effacer, v_gagnants;
-- end $$;


-- ---------------------------------------------------------------------------
--  K. EFFACER LES COORDONNÉES DES GAGNANTS
--
--     À passer UNE FOIS TOUS LES MAILLOTS RÉGLÉS ET REMIS, pas avant :
--     après ça, plus personne ne peut être recontacté. C'est la dernière
--     étape de l'opération, et elle aussi est définitive.
-- ---------------------------------------------------------------------------
-- do $$
-- declare
--   v_confirmation text := 'NON';   -- 'OUI, EFFACER' pour exécuter
--   v_nb integer;
-- begin
--   select count(*) into v_nb from public.or_encheres
--    where email <> 'efface@exemple.invalid';
--
--   if v_confirmation is distinct from 'OUI, EFFACER' then
--     raise exception E'RIEN N''A ÉTÉ EFFACÉ.\n'
--       '  coordonnées encore présentes : %\n'
--       'À ne lancer qu''une fois les 21 maillots remis.', v_nb;
--   end if;
--
--   update public.or_encheres
--      set prenom = '—', nom = 'effacé', email = 'efface@exemple.invalid',
--          telephone = '000000', ip = null
--    where email <> 'efface@exemple.invalid';
--
--   update public.or_notifications n
--      set destinataire = 'efface@exemple.invalid'
--    where n.destinataire <> 'efface@exemple.invalid'
--      and n.destinataire <> (select p.email_notification
--                               from public.or_parametres p where p.id = 1);
--
--   raise notice '% coordonnées effacées. L''opération ne conserve plus que des montants.', v_nb;
-- end $$;

-- Contrôle après J ou K : doit afficher 0 coordonnée restante côté participants.
-- select count(*) as coordonnees_restantes
--   from public.or_encheres where email <> 'efface@exemple.invalid';
