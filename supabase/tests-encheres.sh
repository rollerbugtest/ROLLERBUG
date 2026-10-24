#!/bin/bash
# Tests des règles d'enchères, joués contre un vrai PostgreSQL 16.
# Chaque test repart d'une base propre : aucun test ne dépend du précédent.
Q() { psql -q -tA -d rbtest -c "$1" 2>&1; }
OK=0; KO=0
verifie() { # libellé, attendu, obtenu
  if [[ "$3" == *"$2"* ]]; then printf '  OK   %s\n' "$1"; OK=$((OK+1));
  else printf '  ÉCHEC %s\n       attendu « %s »\n       obtenu « %s »\n' "$1" "$2" "$3"; KO=$((KO+1)); fi
}

reset() {
  psql -q -d rbtest >/dev/null <<'SQL'
truncate public.or_encheres, public.or_journal restart identity cascade;
delete from public.or_maillots;
insert into public.or_maillots (numero, nom, poste, taille)
values (88,'BEDNAR','gardien','3XL'), (7,'RODZIEWICZ','defenseur','L');
update public.or_parametres
   set ouverture = now() - interval '1 day',
       cloture   = now() + interval '1 day',
       encheres_activees = true
 where id = 1;
SQL
}
id_maillot() { Q "select id from public.or_maillots where numero=$1"; }

echo "── État et minimum ─────────────────────────────────────────────"
reset
verifie "enchères ouvertes"            "encours" "$(Q "select public.or_etat()")"
verifie "minimum initial = mise à prix" "30"     "$(Q "select public.or_minimum('$(id_maillot 88)')")"

reset
psql -q -d rbtest -c "update public.or_parametres set encheres_activees=false" >/dev/null
verifie "interrupteur du club coupé"   "preparation" "$(Q "select public.or_etat()")"

reset
psql -q -d rbtest -c "update public.or_parametres set ouverture=now()+interval '2 days', cloture=now()+interval '3 days'" >/dev/null
verifie "avant l'ouverture"            "avant"   "$(Q "select public.or_etat()")"
verifie "offre refusée avant ouverture" "ENCHERES_FERMEES" \
  "$(Q "select public.or_deposer_offre(88,'Jean','Test','j@ex.fr','0600000000',30,'h',interval '20 min',true)")"

reset
psql -q -d rbtest -c "update public.or_parametres set ouverture=now()-interval '3 days', cloture=now()-interval '1 day'" >/dev/null
verifie "après la clôture"             "termine" "$(Q "select public.or_etat()")"
verifie "offre refusée après clôture"  "ENCHERES_FERMEES" \
  "$(Q "select public.or_deposer_offre(88,'Jean','Test','j@ex.fr','0600000000',30,'h',interval '20 min',true)")"

echo "── Montants ────────────────────────────────────────────────────"
reset
verifie "offre sous la mise à prix refusée" "MONTANT_INSUFFISANT: 30" \
  "$(Q "select public.or_deposer_offre(88,'Jean','Test','j@ex.fr','0600000000',25,'h',interval '20 min',true)")"
verifie "palier non respecté refusé"        "PALIER_NON_RESPECTE: 5" \
  "$(Q "select public.or_deposer_offre(88,'Jean','Test','j@ex.fr','0600000000',32,'h',interval '20 min',true)")"
verifie "règlement non accepté refusé"      "REGLEMENT_NON_ACCEPTE" \
  "$(Q "select public.or_deposer_offre(88,'Jean','Test','j@ex.fr','0600000000',30,'h',interval '20 min',false)")"
verifie "maillot inconnu refusé"            "MAILLOT_INCONNU" \
  "$(Q "select public.or_deposer_offre(999,'Jean','Test','j@ex.fr','0600000000',30,'h',interval '20 min',true)")"
verifie "e-mail invalide refusé"            "violates check constraint" \
  "$(Q "select public.or_deposer_offre(88,'Jean','Test','pas-un-email','0600000000',30,'h',interval '20 min',true)")"

echo "── Une offre en attente ne compte pas ──────────────────────────"
reset
E1=$(Q "select enchere_id from public.or_deposer_offre(88,'Jean','Test','j@ex.fr','0600000000',30,'boncode',interval '20 min',true)")
verifie "offre créée en attente"       "en_attente" "$(Q "select statut from public.or_encheres where id='$E1'")"
verifie "montant public inchangé"      ""           "$(Q "select coalesce(public.or_meilleure_offre('$(id_maillot 88)')::text,'')")"
verifie "minimum toujours 30"          "30"         "$(Q "select public.or_minimum('$(id_maillot 88)')")"

echo "── Vérification du code ────────────────────────────────────────"
verifie "mauvais code refusé"          "code_invalide" "$(Q "select statut from public.or_confirmer_offre('$E1','mauvais')")"
verifie "tentative comptée malgré le refus" "1"        "$(Q "select tentatives from public.or_encheres where id='$E1'")"
for i in 2 3 4 5; do Q "select public.or_confirmer_offre('$E1','mauvais')" >/dev/null; done
verifie "blocage après 5 tentatives"   "trop_de_tentatives" "$(Q "select statut from public.or_confirmer_offre('$E1','boncode')")"

reset
E1=$(Q "select enchere_id from public.or_deposer_offre(88,'Jean','Test','j@ex.fr','0600000000',30,'boncode',interval '20 min',true)")
psql -q -d rbtest -c "update public.or_encheres set code_expire_le = now() - interval '1 minute' where id='$E1'" >/dev/null
verifie "code expiré refusé"           "code_expire" "$(Q "select statut from public.or_confirmer_offre('$E1','boncode')")"
verifie "offre marquée expirée"        "expiree"     "$(Q "select statut from public.or_encheres where id='$E1'")"

echo "── Confirmation et enchaînement ────────────────────────────────"
reset
M88=$(id_maillot 88)
E1=$(Q "select enchere_id from public.or_deposer_offre(88,'Jean','Test','j@ex.fr','0600000000',30,'c1',interval '20 min',true)")
verifie "confirmation acceptée"        "confirmee|30"  "$(Q "select statut||'|'||montant from public.or_confirmer_offre('$E1','c1')")"
verifie "meilleure offre = 30"         "30"            "$(Q "select public.or_meilleure_offre('$M88')")"
verifie "prochain minimum = 35"        "35"            "$(Q "select public.or_minimum('$M88')")"
verifie "lien réutilisé : sans effet"  "deja_confirmee" "$(Q "select statut from public.or_confirmer_offre('$E1','c1')")"
verifie "offre à 30 maintenant refusée" "MONTANT_INSUFFISANT: 35" \
  "$(Q "select public.or_deposer_offre(88,'Lea','Test','l@ex.fr','0600000001',30,'c2',interval '20 min',true)")"
E2=$(Q "select enchere_id from public.or_deposer_offre(88,'Lea','Test','l@ex.fr','0600000001',45,'c2',interval '20 min',true)")
Q "select public.or_confirmer_offre('$E2','c2')" >/dev/null
verifie "surenchère à 45 enregistrée"  "45"            "$(Q "select public.or_meilleure_offre('$M88')")"
verifie "l'autre maillot reste à 30"   "30"            "$(Q "select public.or_minimum('$(id_maillot 7)')")"

echo "── Dépassé pendant la vérification ─────────────────────────────"
reset
M88=$(id_maillot 88)
EA=$(Q "select enchere_id from public.or_deposer_offre(88,'Alice','A','a@ex.fr','0600000001',30,'ca',interval '20 min',true)")
EB=$(Q "select enchere_id from public.or_deposer_offre(88,'Bob','B','b@ex.fr','0600000002',35,'cb',interval '20 min',true)")
Q "select public.or_confirmer_offre('$EB','cb')" >/dev/null   # Bob confirme en premier
verifie "Alice prévenue qu'elle est dépassée" "surencherie|40" \
  "$(Q "select statut||'|'||minimum from public.or_confirmer_offre('$EA','ca')")"
verifie "meilleure offre = celle de Bob"      "35" "$(Q "select public.or_meilleure_offre('$M88')")"

echo "── Deux confirmations SIMULTANÉES ──────────────────────────────"
reset
M88=$(id_maillot 88)
EA=$(Q "select enchere_id from public.or_deposer_offre(88,'Alice','A','a@ex.fr','0600000001',30,'ca',interval '20 min',true)")
EB=$(Q "select enchere_id from public.or_deposer_offre(88,'Bob','B','b@ex.fr','0600000002',30,'cb',interval '20 min',true)")
# Alice ouvre une transaction, confirme, et la garde ouverte 2 s.
psql -q -d rbtest >/tmp/a.log 2>&1 <<SQL &
begin;
select public.or_confirmer_offre('$EA','ca');
select pg_sleep(2);
commit;
SQL
sleep 0.6
RB=$(Q "select statut from public.or_confirmer_offre('$EB','cb')")   # Bob arrive pendant
wait
verifie "Alice confirmée"                    "confirmee" "$(Q "select statut from public.or_encheres where id='$EA'")"
verifie "Bob bloqué puis refusé"             "surencherie" "$RB"
verifie "une seule offre confirmée à 30"     "1" \
  "$(Q "select count(*) from public.or_encheres where maillot_id='$M88' and statut='confirmee'")"

echo "── Annulation et restauration ──────────────────────────────────"
reset
M88=$(id_maillot 88)
E1=$(Q "select enchere_id from public.or_deposer_offre(88,'Jean','T','j@ex.fr','0600000000',30,'c1',interval '20 min',true)")
Q "select public.or_confirmer_offre('$E1','c1')" >/dev/null
E2=$(Q "select enchere_id from public.or_deposer_offre(88,'Lea','T','l@ex.fr','0600000001',50,'c2',interval '20 min',true)")
Q "select public.or_confirmer_offre('$E2','c2')" >/dev/null
verifie "meilleure offre = 50"               "50" "$(Q "select public.or_meilleure_offre('$M88')")"
Q "select public.or_annuler_offre('$E2','elisa','offre frauduleuse')" >/dev/null
verifie "après annulation, retour à 30"      "30" "$(Q "select public.or_meilleure_offre('$M88')")"
verifie "annulation journalisée"             "offre_annulee" "$(Q "select action from public.or_journal where objet='$E2' order by id desc limit 1")"
Q "select public.or_restaurer_offre('$E2','elisa')" >/dev/null
verifie "après restauration, de nouveau 50"  "50" "$(Q "select public.or_meilleure_offre('$M88')")"
verifie "restauration journalisée"           "offre_restauree" "$(Q "select action from public.or_journal where objet='$E2' order by id desc limit 1")"

echo "── Gagnants et confidentialité ─────────────────────────────────"
verifie "gagnant du 88 = Lea à 50"           "88|Lea|50" \
  "$(Q "select numero||'|'||prenom||'|'||montant from public.or_gagnants() where numero=88")"
verifie "vue publique sans coordonnées"      "" \
  "$(Q "select string_agg(column_name,',') from information_schema.columns
        where table_name='or_v_maillots_public'
          and column_name in ('email','telephone','prenom')")"
verifie "vue publique expose le montant"     "50" \
  "$(Q "select meilleure_offre from public.or_v_maillots_public where numero=88")"

echo "── Accès par la clé publique du site ───────────────────────────"
verifie "anon ne lit pas les enchères"       "permission denied" \
  "$(psql -q -tA -d rbtest -c 'set role anon; select count(*) from public.or_encheres;' 2>&1)"
verifie "anon ne lit pas les maillots"       "permission denied" \
  "$(psql -q -tA -d rbtest -c 'set role anon; select count(*) from public.or_maillots;' 2>&1)"
verifie "anon ne peut pas déposer d'offre"   "permission denied" \
  "$(psql -q -tA -d rbtest -c "set role anon; select public.or_deposer_offre(88,'X','Y','x@ex.fr','0600000000',99,'h',interval '20 min',true);" 2>&1)"


echo "── E-mails : qui reçoit quoi ───────────────────────────────────"
reset
M88=$(id_maillot 88)
EA=$(Q "select enchere_id from public.or_deposer_offre(88,'Alice','A','alice@ex.fr','0600000001',30,'ca',interval '20 min',true)")
Q "select public.or_confirmer_offre('$EA','ca')" >/dev/null
verifie "1re offre : confirmation + admin, pas de surenchère" "admin,confirmation" \
  "$(Q "select string_agg(distinct genre,',' order by genre) from public.or_notifications where enchere_id='$EA'")"
verifie "Elisa est bien destinataire"        "elisa.33160@yahoo.fr" \
  "$(Q "select destinataire from public.or_notifications where enchere_id='$EA' and genre='admin'")"

EB=$(Q "select enchere_id from public.or_deposer_offre(88,'Bob','B','bob@ex.fr','0600000002',35,'cb',interval '20 min',true)")
Q "select public.or_confirmer_offre('$EB','cb')" >/dev/null
verifie "Alice prévenue de la surenchère"    "alice@ex.fr" \
  "$(Q "select destinataire from public.or_notifications where enchere_id='$EB' and genre='surenchere'")"
verifie "Bob reçoit sa confirmation"         "bob@ex.fr" \
  "$(Q "select destinataire from public.or_notifications where enchere_id='$EB' and genre='confirmation'")"

# Bob monte sa propre offre : il ne doit pas s'auto-prévenir
EC=$(Q "select enchere_id from public.or_deposer_offre(88,'Bob','B','bob@ex.fr','0600000002',40,'cc',interval '20 min',true)")
Q "select public.or_confirmer_offre('$EC','cc')" >/dev/null
verifie "pas d'auto-surenchère"              "0" \
  "$(Q "select count(*) from public.or_notifications where enchere_id='$EC' and genre='surenchere'")"

verifie "aucun doublon d'e-mail"             "0" \
  "$(Q "select count(*) from (select enchere_id,genre,destinataire from public.or_notifications group by 1,2,3 having count(*)>1) d")"
verifie "file d'envoi alimentée"             "t" \
  "$(Q "select count(*) > 0 from public.or_notifications_a_envoyer(50)")"
verifie "la file porte le maillot et le montant" "88|40" \
  "$(Q "select numero||'|'||montant from public.or_notifications_a_envoyer(50) where genre='confirmation' and destinataire='bob@ex.fr' order by id desc limit 1")"

N1=$(Q "select id from public.or_notifications where enchere_id='$EA' and genre='admin'")
Q "select public.or_notification_echouee($N1,'service indisponible')" >/dev/null
verifie "échec compté, pas envoyé"           "1|service indisponible" \
  "$(Q "select tentatives||'|'||derniere_erreur from public.or_notifications where id=$N1")"
Q "select public.or_notification_envoyee($N1)" >/dev/null
verifie "renvoi réussi : sort de la file"    "0" \
  "$(Q "select count(*) from public.or_notifications_a_envoyer(50) where id=$N1")"
# Un échec puis un succès = 2 essais, c'est normal. Ce qu'on vérifie ici,
# c'est qu'un second « envoyé » ne compte pas un essai de plus : sans ce
# garde-fou, un rejeu de la file renverrait le même e-mail.
AVANT=$(Q "select tentatives from public.or_notifications where id=$N1")
Q "select public.or_notification_envoyee($N1)" >/dev/null
verifie "marquer envoyé deux fois est sans effet" "$AVANT" \
  "$(Q "select tentatives from public.or_notifications where id=$N1")"

echo "── Clôture ─────────────────────────────────────────────────────"
verifie "clôture refusée avant l'heure"      "ENCHERES_NON_TERMINEES" \
  "$(Q "select public.or_cloturer('elisa')")"
psql -q -d rbtest -c "update public.or_parametres set cloture = now() - interval '1 minute'" >/dev/null
verifie "clôture : 1 gagnant notifié"        "1" "$(Q "select public.or_cloturer('elisa')")"
verifie "le gagnant est Bob à 40"            "bob@ex.fr" \
  "$(Q "select destinataire from public.or_notifications where genre='gagnant'")"
verifie "rejouer la clôture ne renotifie pas" "0" "$(Q "select public.or_cloturer('elisa')")"
verifie "clôture journalisée"                "cloture" \
  "$(Q "select action from public.or_journal where action='cloture' limit 1")"
verifie "modalités transmises à l'e-mail"    "t" \
  "$(Q "select modalites is not null from public.or_notifications_a_envoyer(50) where genre='gagnant'")"
verifie "Elisa reçoit le bilan de clôture"   "elisa.33160@yahoo.fr" \
  "$(Q "select destinataire from public.or_notifications where genre='bilan'")"
verifie "un seul bilan, même en rejouant"    "1" \
  "$(Q "select count(*) from public.or_notifications where genre='bilan'")"
verifie "le bilan est dans la file d'envoi"  "1" \
  "$(Q "select count(*) from public.or_notifications_a_envoyer(50) where genre='bilan'")"


echo "── Limitation du nombre d'offres ───────────────────────────────"
reset
for i in $(seq 1 20); do
  Q "select public.or_deposer_offre(88,'Spam','S','spam@ex.fr','0600000000',30,'h',interval '20 min',true,'10.0.0.1')" >/dev/null
done
verifie "21e offre de la même adresse bloquée" "TROP_D_OFFRES_EMAIL" \
  "$(Q "select public.or_deposer_offre(88,'Spam','S','spam@ex.fr','0600000000',30,'h',interval '20 min',true,'10.0.0.1')")"
verifie "une autre adresse passe encore"       "t" \
  "$(Q "select enchere_id is not null from public.or_deposer_offre(88,'Lea','T','lea@ex.fr','0600000001',30,'h',interval '20 min',true,'10.0.0.2')")"
for i in $(seq 1 20); do
  Q "select public.or_deposer_offre(88,'A','B','ip$i@ex.fr','0600000000',30,'h',interval '20 min',true,'10.0.0.1')" >/dev/null
done
verifie "même IP, 40 offres : bloquée"         "TROP_D_OFFRES_IP" \
  "$(Q "select public.or_deposer_offre(88,'C','D','autre@ex.fr','0600000000',30,'h',interval '20 min',true,'10.0.0.1')")"


echo "── Ce que le serveur accepte de publier ────────────────────────"
reset
# On fige la liste exacte des champs. Si quelqu'un ajoute un jour un champ à
# ces fonctions, ce test tombe — c'est exactement le but : rien ne doit
# devenir public par inadvertance.
verifie "champs des paramètres publics" \
  "actif,cloture,encheresActivees,etat,miseAPrix,nombreMaillots,ouverture,palier,reglement,serveurMaintenant,sousTitre,titre" \
  "$(Q "select string_agg(k, ',' order by k) from jsonb_object_keys(public.or_parametres_publics()) k")"
E1=$(Q "select enchere_id from public.or_deposer_offre(88,'Jean','Test','j@ex.fr','0600000000',30,'c1',interval '20 min',true)")
Q "select public.or_confirmer_offre('$E1','c1')" >/dev/null
verifie "champs d'un maillot public" \
  "description,id,meilleure_offre,minimum,nb_offres,nom,numero,photo_illustration,photos,poste,prix_depart,taille" \
  "$(Q "select string_agg(k, ',' order by k) from jsonb_object_keys(public.or_catalogue() -> 0) k")"
verifie "le montant confirmé est publié"   "30" \
  "$(Q "select public.or_catalogue() -> 1 ->> 'meilleure_offre'")"
verifie "aucune adresse dans le catalogue" "f" \
  "$(Q "select public.or_catalogue()::text like '%@%'")"
verifie "aucune adresse dans les paramètres" "f" \
  "$(Q "select public.or_parametres_publics()::text like '%@%'")"

echo
echo "═══  $OK réussis, $KO échoués  ═══"
[ "$KO" -eq 0 ]
