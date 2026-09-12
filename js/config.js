/* Identifiants Supabase — la base commune à l'application et au site.

   À REMPLIR UNE FOIS :
   supabase.com → ton projet → Project Settings → API
     • « Project URL »        → SUPABASE_URL
     • « anon public » key    → SUPABASE_ANON_KEY

   Ces deux valeurs sont FAITES pour être publiques : elles figurent dans le
   code de toutes les applications Supabase du monde. Ce qui protège les
   données, c'est le verrouillage RLS posé par supabase/schema.sql, pas le
   secret de cette clé.

   ⚠️ Ne jamais mettre ici la clé « service_role » : celle-là contourne toutes
   les protections. Elle ne sort jamais d'un serveur. */
window.ROLLERBUG_CONFIG = {
  SUPABASE_URL: 'https://VOTRE-PROJET.supabase.co',
  SUPABASE_ANON_KEY: 'VOTRE_CLE_ANON_PUBLIC'
};
