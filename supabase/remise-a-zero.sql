-- ===========================================================================
--  Remise à zéro des enchères — à passer APRÈS l'essai à blanc,
--  AVANT l'ouverture au public.
--
--  Efface : les offres, les e-mails en file, le journal.
--  Garde  : les 21 maillots, les paramètres, les administrateurs.
--
--  ⚠ PAR DÉFAUT, CE SCRIPT N'EFFACE RIEN. Exécuté tel quel, il se contente
--  d'annoncer ce qu'il effacerait, puis s'interrompt. Pour effacer vraiment,
--  il faut remplacer NON par OUI, EFFACER à la ligne signalée plus bas.
--
--  Cette lourdeur est volontaire. Lancé par mégarde pendant les vraies
--  enchères, ce script détruirait les offres de tous les participants, et
--  rien ne permettrait de les retrouver.
-- ===========================================================================

do $$
declare
  -- ⚠⚠⚠  LA SEULE LIGNE À MODIFIER  ⚠⚠⚠
  v_confirmation text := 'NON';

  v_offres        integer;
  v_confirmees    integer;
  v_notifications integer;
  v_journal       integer;
  v_etat          text;
begin
  select count(*), count(*) filter (where statut = 'confirmee')
    into v_offres, v_confirmees
    from public.or_encheres;
  select count(*) into v_notifications from public.or_notifications;
  select count(*) into v_journal       from public.or_journal;
  v_etat := public.or_etat();

  if v_confirmation is distinct from 'OUI, EFFACER' then
    -- L'exception annule la transaction : rien n'est touché, et le message
    -- dit exactement ce qui serait perdu.
    raise exception E'RIEN N''A ÉTÉ EFFACÉ (c''est le comportement par défaut).\n'
      '  état des enchères : %\n'
      '  offres déposées   : %\n'
      '  offres confirmées : %\n'
      '  e-mails en file   : %\n'
      '  lignes de journal : %\n'
      'Pour effacer réellement, remplacer NON par OUI, EFFACER en haut du script.',
      v_etat, v_offres, v_confirmees, v_notifications, v_journal;
  end if;

  -- or_notifications référence or_encheres avec « on delete cascade » :
  -- effacer les offres emporte leurs e-mails. Le bilan de clôture, lui,
  -- n'est rattaché à aucune offre et survivrait — d'où le second effacement.
  delete from public.or_encheres;
  delete from public.or_notifications;
  delete from public.or_journal;

  -- Retour en préparation : entre l'essai et la vraie ouverture, le site ne
  -- doit accepter aucune offre. C'est au bureau de rouvrir, sciemment.
  update public.or_parametres set encheres_activees = false where id = 1;

  raise notice 'Remise à zéro faite : % offres, % e-mails et % lignes de journal effacés. Enchères repassées en préparation.',
    v_offres, v_notifications, v_journal;
end $$;

-- Contrôle : 21 maillots, 0 offre, 0 e-mail, 0 journal, état « preparation ».
select (select count(*) from public.or_maillots)      as maillots,
       (select count(*) from public.or_encheres)      as offres,
       (select count(*) from public.or_notifications) as emails,
       (select count(*) from public.or_journal)       as journal,
       public.or_etat()                               as etat;
