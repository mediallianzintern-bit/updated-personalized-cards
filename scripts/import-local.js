import {postgresConfig} from '../server/postgres-config.js';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
const filename=process.argv[2];
if(!filename)throw new Error('Usage: npm run cloud:import -- /absolute/path/to/database.json');
for(const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_SECRET_KEY'])if(!process.env[key])throw new Error(`Missing ${key}`);
const db=JSON.parse(await fs.readFile(filename,'utf8'));
if(!Array.isArray(db.cards)||!Array.isArray(db.leads)||!Array.isArray(db.events))throw new Error('Invalid backup');
// Local login tokens/rate counters must never be carried into a live environment.
delete db.sessions;delete db.rates;
const pool=new pg.Pool({...postgresConfig(process.env.DATABASE_URL),max:1});
const storage=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}}).storage.from('card-media');
const uploaded=new Map();
async function convert(value){
 if(typeof value==='string'&&/^data:[^;]+;base64,/.test(value)){
  if(uploaded.has(value))return uploaded.get(value);
  const [,mime,base64]=value.match(/^data:([^;]+);base64,(.*)$/s);const id=crypto.randomUUID();
  const {error}=await storage.upload(id,Buffer.from(base64,'base64'),{contentType:mime,upsert:false});if(error)throw error;
  const ref=`/api/media/${id}`;uploaded.set(value,ref);return ref;
 }
 if(Array.isArray(value)){const out=[];for(const item of value)out.push(await convert(item));return out;}
 if(value&&typeof value==='object'){const out={};for(const[k,v]of Object.entries(value))out[k]=await convert(v);return out;}
 return value;
}
const client=await pool.connect();
try{
 await client.query('BEGIN');
 const {rows}=await client.query('SELECT document FROM cards_private.workspace WHERE id=1 FOR UPDATE');
 if(!rows[0]||rows[0].document.cards.length||(rows[0].document.clients||[]).length)throw new Error('Import requires an empty migrated database. Existing cloud data will not be overwritten.');
 const converted=await convert(db);
 await client.query('UPDATE cards_private.workspace SET document=$1::jsonb,updated_at=now() WHERE id=1',[JSON.stringify(converted)]);
 await client.query('COMMIT');console.log(`Imported ${db.cards.length} cards and ${uploaded.size} media objects. Local file unchanged.`);
}catch(error){await client.query('ROLLBACK');if(uploaded.size)await storage.remove([...uploaded.values()].map(v=>v.split('/').pop()));throw error;}
finally{client.release();await pool.end();}
