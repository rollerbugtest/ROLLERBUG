-- ===========================================================================
--  Les 21 maillots Octobre Rose 2026.
--
--  À exécuter APRÈS supabase/encheres.sql, dans le SQL Editor de Supabase.
--  Rejouable sans risque : un maillot déjà présent est mis à jour, pas
--  dupliqué, et aucune enchère n'est touchée.
--
--  Source : la liste transmise par le bureau (3 gardiens, 8 défenseurs,
--  10 attaquants). Nom, numéro et taille ne doivent pas être modifiés ici
--  sans l'accord du club.
-- ===========================================================================

insert into public.or_maillots
  (numero, nom, poste, taille, description, photos, photo_illustration)
values
  (88, 'BEDNAR', 'gardien', '3XL', 'Maillot Octobre Rose du Roller Bug, floqué BEDNAR au dos, numéro 88, taille 3XL. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (26, 'CHAMON', 'gardien', '3XL', 'Maillot Octobre Rose du Roller Bug, floqué CHAMON au dos, numéro 26, taille 3XL. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (29, 'MOLINA', 'gardien', '3XL', 'Maillot Octobre Rose du Roller Bug, floqué MOLINA au dos, numéro 29, taille 3XL. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (9, 'GRASSET', 'defenseur', 'L', 'Maillot Octobre Rose du Roller Bug, floqué GRASSET au dos, numéro 9, taille L. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (10, 'PHILIPPO', 'defenseur', 'M', 'Maillot Octobre Rose du Roller Bug, floqué PHILIPPO au dos, numéro 10, taille M. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (8, 'ROBLIN ZEMPE', 'defenseur', 'M', 'Maillot Octobre Rose du Roller Bug, floqué ROBLIN ZEMPE au dos, numéro 8, taille M. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (97, 'SABLEAU-FICHTER', 'defenseur', 'L', 'Maillot Octobre Rose du Roller Bug, floqué SABLEAU-FICHTER au dos, numéro 97, taille L. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (16, 'TRIMOUILLE', 'defenseur', 'L', 'Maillot Octobre Rose du Roller Bug, floqué TRIMOUILLE au dos, numéro 16, taille L. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (91, 'AUTON', 'defenseur', 'XL', 'Maillot Octobre Rose du Roller Bug, floqué AUTON au dos, numéro 91, taille XL. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (83, 'NEAUD', 'defenseur', 'M', 'Maillot Octobre Rose du Roller Bug, floqué NEAUD au dos, numéro 83, taille M. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (7, 'RODZIEWICZ', 'defenseur', 'L', 'Maillot Octobre Rose du Roller Bug, floqué RODZIEWICZ au dos, numéro 7, taille L. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (72, 'BRUCHE', 'attaquant', 'L', 'Maillot Octobre Rose du Roller Bug, floqué BRUCHE au dos, numéro 72, taille L. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (20, 'MASSON', 'attaquant', 'M', 'Maillot Octobre Rose du Roller Bug, floqué MASSON au dos, numéro 20, taille M. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (24, 'DURY', 'attaquant', 'L', 'Maillot Octobre Rose du Roller Bug, floqué DURY au dos, numéro 24, taille L. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (14, 'LAMBERT', 'attaquant', 'L', 'Maillot Octobre Rose du Roller Bug, floqué LAMBERT au dos, numéro 14, taille L. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (22, 'GERARDIN', 'attaquant', 'L', 'Maillot Octobre Rose du Roller Bug, floqué GERARDIN au dos, numéro 22, taille L. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (95, 'MORENO', 'attaquant', 'M', 'Maillot Octobre Rose du Roller Bug, floqué MORENO au dos, numéro 95, taille M. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (32, 'FAURITE', 'attaquant', 'M', 'Maillot Octobre Rose du Roller Bug, floqué FAURITE au dos, numéro 32, taille M. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (19, 'PEROT', 'attaquant', 'M', 'Maillot Octobre Rose du Roller Bug, floqué PEROT au dos, numéro 19, taille M. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (56, 'KOTZUBA', 'attaquant', 'M', 'Maillot Octobre Rose du Roller Bug, floqué KOTZUBA au dos, numéro 56, taille M. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true),
  (12, 'MAHUTEAUX', 'attaquant', 'M', 'Maillot Octobre Rose du Roller Bug, floqué MAHUTEAUX au dos, numéro 12, taille M. Pièce unique portée par l''équipe.', '["images/octobre-rose/maillot-exemple.webp"]'::jsonb, true)
on conflict (numero) do update
  set nom                = excluded.nom,
      poste              = excluded.poste,
      taille             = excluded.taille,
      description        = excluded.description,
      photos             = excluded.photos,
      photo_illustration = excluded.photo_illustration;

-- Contrôle : doit afficher 21, et 3 / 8 / 10.
select count(*) as total,
       count(*) filter (where poste = 'gardien')   as gardiens,
       count(*) filter (where poste = 'defenseur') as defenseurs,
       count(*) filter (where poste = 'attaquant') as attaquants
  from public.or_maillots;
