import {postgresConfig} from '../server/postgres-config.js';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
for(const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_SECRET_KEY','ADMIN_PASSWORD','PUBLIC_URL'])if(!process.env[key])throw new Error(`Missing ${key}`);
if(process.env.ADMIN_PASSWORD.length<16)throw new Error('ADMIN_PASSWORD must be at least 16 characters');
if(new URL(process.env.PUBLIC_URL).protocol!=='https:')throw new Error('PUBLIC_URL must use HTTPS');
const pool=new pg.Pool({...postgresConfig(process.env.DATABASE_URL),max:1,connectionTimeoutMillis:10000});
try{
 const {rows}=await pool.query('select jsonb_array_length(document->\'cards\') as count from cards_private.workspace where id=1');
 if(!rows.length)throw new Error('Run the SQL migration first');
 console.log(`Database connected; ${rows[0].count} cards present.`);
 const storage=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}}).storage;
 const {data,error}=await storage.getBucket('card-media');if(error)throw error;
 if(data.public)throw new Error('card-media must be a private bucket');
 console.log('Private media bucket connected. Cloud credentials verified.');
}finally{await pool.end()}
