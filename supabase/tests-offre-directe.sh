#!/bin/bash
# Tests de l'offre directe (enchères sans code de vérification), joués
# contre un vrai PostgreSQL. Chaque test repart d'une base propre.
#
#   createdb rbdirect && psql -d rbdirect -c 'create schema auth;
#     create table auth.users (id uuid primary key);'
#   psql -d rbdirect -f supabase/encheres.sql
#   psql -d rbdirect -f supabase/encheres-maillots.sql
#   psql -d rbdirect -f supabase/migration-offre-directe.sql
#   bash supabase/tests-offre-directe.sh
BASE="${1:-rbdirect}"
Q() { psql -q -tA -d "$BASE" -c "$1" 2>&1; }
OK=0; KO=0
verifie() { # libellé, attendu (sous-chaîne), obtenu
  if [[ "$3" == *"$2"* ]]; then printf '  OK   %s\n' "$1"; OK=$((OK+1));
  else printf '  ÉCHEC %s\n       attendu « %s »\n       obtenu « %s »\n' "$1" "$2" "$3"; KO=$((KO+1)); fi
}

reset() {
  psql -q -d "$BASE" >/dev/null <<'SQL'
truncate public.or_encheres, public.or_notifications, public.or_journal
  restart identity cascade;
update public.or_parametres
   set ouverture = now() - interval '1 day',
       cloture   = now() + interval '1 day',
       encheres_activees = true
 where id = 1;
SQL
}
offre() { # numéro, prénom, email, montant, [ip]
  Q "select montant_retenu from public.or_offrir_direct(
       p_numero=>$1, p_prenom=>'$2', p_nom=>'Test', p_email=>'$3',
       p_telephone=>'0600000000', p_montant=>$4, p_reglement=>true,
       p_ip=>${5:-null}::inet)"
}

echo "── L'offre est valide tout de suite ────────────────────────────"
reset
verifie "offre acceptée"                 "30" "$(offre 88 Alice a@ex.fr 30)"
verifie "elle compte immédiatement"      "30" "$(Q "select public.or_meilleure_offre(id) from public.or_maillots where numero=88")"
verifie "aucune offre en attente"        "0"  "$(Q "select count(*) from public.or_encheres where statut='en_attente'")"
verifie "le minimum suivant monte"       "35" "$(Q "select public.or_minimum(id) from public.or_maillots where numero=88")"

echo "── Montants refusés ────────────────────────────────────────────"
reset
offre 88 Alice a@ex.fr 30 >/dev/null
verifie "offre égale refusée"            "MONTANT_INSUFFISANT" "$(offre 88 Bob b@ex.fr 30)"
verifie "offre inférieure refusée"       "MONTANT_INSUFFISANT" "$(offre 88 Bob b@ex.fr 25)"
verifie "hors palier refusée"            "PALIER_NON_RESPECTE" "$(offre 88 Bob b@ex.fr 37)"
verifie "règlement non accepté refusé"   "REGLEMENT_NON_ACCEPTE" \
  "$(Q "select public.or_offrir_direct(88,'X','Y','x@ex.fr','0600000000',40,false,null)")"

echo "── Un seul e-mail : la personne dépassée ───────────────────────"
reset
offre 88 Alice a@ex.fr 30 >/dev/null
verifie "première offre : aucun e-mail"  "0" "$(Q "select count(*) from public.or_notifications")"
offre 88 Bob b@ex.fr 35 >/dev/null
verifie "surenchère : un seul e-mail"    "1" "$(Q "select count(*) from public.or_notifications")"
verifie "et c'est bien une surenchère"   "surenchere" "$(Q "select genre from public.or_notifications")"
verifie "adressée à la personne dépassée" "a@ex.fr"   "$(Q "select destinataire from public.or_notifications")"
verifie "aucune confirmation à l'enchérisseur" "0" \
  "$(Q "select count(*) from public.or_notifications where genre='confirmation'")"
verifie "aucune alerte au bureau"        "0" \
  "$(Q "select count(*) from public.or_notifications where genre='admin'")"

echo "── On ne s'envoie pas d'e-mail à soi-même ──────────────────────"
reset
offre 88 Alice a@ex.fr 30 >/dev/null
offre 88 Alice a@ex.fr 35 >/dev/null
verifie "se surenchérir n'envoie rien"   "0" "$(Q "select count(*) from public.or_notifications")"
reset
offre 88 Alice A@EX.FR 30 >/dev/null
offre 88 Alice a@ex.fr 35 >/dev/null
verifie "la casse de l'adresse ne trompe pas" "0" "$(Q "select count(*) from public.or_notifications")"

echo "── Plafond anti-harcèlement : 25 alertes / adresse / jour ──────"
# Sans code de vérification, on peut saisir l'adresse d'un tiers puis se
# surenchérir en boucle pour la noyer sous les e-mails du club. Deux limites
# s'y opposent. La première, vingt offres par heure et par adresse, borne
# déjà l'attaque DANS l'heure : pour faire dépasser quelqu'un vingt fois, il
# faut avoir enchéri vingt fois en son nom.
reset
offre 88 Alice a@ex.fr 30 >/dev/null
psql -q -d "$BASE" >/dev/null <<'SQL'
do $$
declare i integer; v_mt integer := 35;
begin
  for i in 1..25 loop
    perform public.or_offrir_direct(88,'Mechant','T','m'||i||'@ex.fr','0600000000',v_mt,true,null);
    v_mt := v_mt + 5;
    begin
      perform public.or_offrir_direct(88,'Alice','T','a@ex.fr','0600000000',v_mt,true,null);
      v_mt := v_mt + 5;
    exception when others then null;   -- la limite horaire a parlé
    end;
  end loop;
end $$;
SQL
verifie "limite horaire : au plus 20 alertes dans l'heure" "20" \
  "$(Q "select count(*) from public.or_notifications where destinataire='a@ex.fr' and genre='surenchere'")"

# La seconde limite joue sur la journée, quand l'attaque s'étale sur
# plusieurs heures : on simule ici 25 alertes déjà reçues dans les 24 h.
reset
offre 88 Alice a@ex.fr 30 >/dev/null
psql -q -d "$BASE" >/dev/null <<'SQL'
insert into public.or_notifications (enchere_id, genre, destinataire, cree_le)
select null, 'surenchere', 'a@ex.fr', now() - (i || ' minutes')::interval
  from generate_series(1, 25) as i;
SQL
offre 88 Bob b@ex.fr 35 >/dev/null
verifie "plafond journalier : pas de 26e alerte" "25" \
  "$(Q "select count(*) from public.or_notifications where destinataire='a@ex.fr' and genre='surenchere'")"
verifie "le plafond est tracé au journal" "surenchere_plafonnee" \
  "$(Q "select action from public.or_journal where action='surenchere_plafonnee' limit 1")"
verifie "l'offre de Bob reste valide"    "35" \
  "$(Q "select public.or_meilleure_offre(id) from public.or_maillots where numero=88")"

# Au-delà de 24 h, le compteur repart : un enchérisseur assidu n'est pas
# condamné au silence pour le reste de l'opération.
reset
offre 88 Alice a@ex.fr 30 >/dev/null
psql -q -d "$BASE" >/dev/null <<'SQL'
insert into public.or_notifications (enchere_id, genre, destinataire, cree_le)
select null, 'surenchere', 'a@ex.fr', now() - interval '26 hours'
  from generate_series(1, 25) as i;
SQL
offre 88 Bob b@ex.fr 35 >/dev/null
verifie "alertes d'hier : elles ne comptent plus" "26" \
  "$(Q "select count(*) from public.or_notifications where destinataire='a@ex.fr' and genre='surenchere'")"

echo "── Enchères fermées ────────────────────────────────────────────"
reset
psql -q -d "$BASE" -c "update public.or_parametres set encheres_activees=false" >/dev/null
verifie "interrupteur coupé : refus"     "ENCHERES_FERMEES" "$(offre 88 Alice a@ex.fr 30)"
reset
psql -q -d "$BASE" -c "update public.or_parametres set cloture=now()-interval '1 hour'" >/dev/null
verifie "après la clôture : refus"       "ENCHERES_FERMEES" "$(offre 88 Alice a@ex.fr 30)"
reset
psql -q -d "$BASE" -c "update public.or_parametres set ouverture=now()+interval '1 day', cloture=now()+interval '2 days'" >/dev/null
verifie "avant l'ouverture : refus"      "ENCHERES_FERMEES" "$(offre 88 Alice a@ex.fr 30)"

echo "── Maillot inconnu et limites ──────────────────────────────────"
reset
verifie "numéro inexistant refusé"       "MAILLOT_INCONNU" "$(offre 999 Alice a@ex.fr 30)"
reset
psql -q -d "$BASE" >/dev/null <<'SQL'
do $$
declare i integer; v_mt integer := 30;
begin
  for i in 1..20 loop
    perform public.or_offrir_direct(88,'Spam','T','spam@ex.fr','0600000000',v_mt,true,null);
    v_mt := v_mt + 5;
  end loop;
end $$;
SQL
verifie "20 offres/heure/adresse : la 21e refusée" "TROP_D_OFFRES_EMAIL" \
  "$(offre 88 Spam spam@ex.fr 200)"

echo "── Deux offres simultanées ─────────────────────────────────────"
reset
offre 88 Alice a@ex.fr 30 >/dev/null
# Une session garde la transaction ouverte ; l'autre doit attendre le verrou
# puis se voir refuser son montant, devenu insuffisant.
( psql -q -d "$BASE" >/dev/null 2>&1 <<'SQL'
begin;
select public.or_offrir_direct(88,'Bob','T','b@ex.fr','0600000000',35,true,null);
select pg_sleep(2);
commit;
SQL
) &
sleep 0.5
RESULTAT="$(offre 88 Carole c@ex.fr 35)"
wait
verifie "la seconde est refusée, pas doublée" "MONTANT_INSUFFISANT" "$RESULTAT"
verifie "une seule offre à 35"            "1" \
  "$(Q "select count(*) from public.or_encheres where montant=35 and statut='confirmee'")"

echo "── La clôture fonctionne toujours ──────────────────────────────"
reset
offre 88 Alice a@ex.fr 30 >/dev/null
offre 88 Bob   b@ex.fr 35 >/dev/null
offre 26 Carole c@ex.fr 30 >/dev/null
psql -q -d "$BASE" -c "update public.or_parametres set cloture=now()-interval '1 minute'" >/dev/null
verifie "état terminé"                   "termine" "$(Q "select public.or_etat()")"
Q "select public.or_cloturer('test')" >/dev/null
verifie "deux gagnants notifiés"         "2" \
  "$(Q "select count(*) from public.or_notifications where genre='gagnant'")"
verifie "le gagnant du 88 est bien Bob"  "b@ex.fr" \
  "$(Q "select n.destinataire from public.or_notifications n
         join public.or_encheres e on e.id=n.enchere_id
         join public.or_maillots m on m.id=e.maillot_id
        where n.genre='gagnant' and m.numero=88")"
verifie "un bilan pour le bureau"        "1" \
  "$(Q "select count(*) from public.or_notifications where genre='bilan'")"
Q "select public.or_cloturer('test')" >/dev/null
verifie "clôture rejouée : aucun doublon" "2" \
  "$(Q "select count(*) from public.or_notifications where genre='gagnant'")"

printf '\n═══  %d réussis, %d échoués  ═══\n' "$OK" "$KO"
[ "$KO" -eq 0 ]
