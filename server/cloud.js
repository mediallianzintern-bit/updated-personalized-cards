import {createClient} from '@supabase/supabase-js';
import {createPostgresStore} from './postgres-store.js';
import {createApp} from './app.js';
export function cloudApp(env = process.env) {
  for (const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_SECRET_KEY','ADMIN_PASSWORD','PUBLIC_URL']) if (!env[key]) throw new Error(`Missing ${key}`);
  if (env.ADMIN_PASSWORD.length < 16) throw new Error('ADMIN_PASSWORD must contain at least 16 characters');
  if (new URL(env.PUBLIC_URL).protocol !== 'https:') throw new Error('PUBLIC_URL must use HTTPS');
  const storage = createClient(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from('card-media');
  const app = createApp({store:createPostgresStore(env.DATABASE_URL),password:env.ADMIN_PASSWORD,publicUrl:env.PUBLIC_URL,production:true,media:storage});
  app.set('trust proxy',1);
  return app;
}
