import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresStore} from '../server/postgres-store.js';
import {createApp} from '../server/app.js';
import {seedProfile} from '../server/model.js';

async function fixture(t){
 const db=new PGlite();
 await db.exec('create schema cards_private; create table cards_private.workspace(id int primary key, document jsonb, updated_at timestamptz default now());');
 await db.query('insert into cards_private.workspace values(1,$1,now())',[JSON.stringify({cards:[],clients:[],events:[],leads:[]})]);
 let tail=Promise.resolve(),failCommit=false;
 const pool={async connect(){let unlock;const prior=tail;tail=new Promise(r=>unlock=r);await prior;return {async query(sql,args){if(sql==='COMMIT'&&failCommit){failCommit=false;throw new Error('Simulated connection failure');}return db.query(sql,args)},release:unlock}},async end(){}};
 async function start(){const app=createApp({store:createPostgresStore('',{pool}),password:'secure-admin-password',production:false});const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});t.after(()=>new Promise(r=>server.close(r)));return async(route,method='GET',body,cookie)=>fetch(`http://127.0.0.1:${server.address().port}${route}`,{method,headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)})}
 t.after(()=>db.close());
 return {start,db,fail(){failCommit=true}};
}
test('cloud sessions persist across instances; concurrent edits survive and client analytics remain isolated',async t=>{
 const f=await fixture(t),a=await f.start(),b=await f.start();
 const login=await a('/api/login','POST',{password:'secure-admin-password'});const admin=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await b('/api/admin/cards','GET',undefined,admin)).status,200);
 const results=await Promise.all([a('/api/admin/cards','POST',{name:'One'},admin),b('/api/admin/cards','POST',{name:'Two'},admin)]);
 assert.deepEqual(results.map(r=>r.status),[201,201]);
 assert.equal((await(await b('/api/admin/cards','GET',undefined,admin)).json()).length,2);
 const registered=await a('/api/client/register','POST',{profile:{...seedProfile,email:'cloud@example.com'},password:'client-password-long'});
 assert.equal(registered.status,201);const client=registered.headers.get('set-cookie').split(';')[0];const owned=await registered.json();
 assert.equal((await b('/api/client/card','GET',undefined,client)).status,200);
 assert.equal((await b('/api/admin/cards','GET',undefined,client)).status,401);
 assert.equal((await b('/api/client/insights?cardId=someone-else','GET',undefined,client)).status,200);
 const row=(await f.db.query('select document from cards_private.workspace')).rows[0].document;
 assert.ok(!JSON.stringify(row.sessions).includes(client.split('=')[1]));
 await b('/api/client/logout','POST',{},client);
 assert.equal((await a('/api/client/card','GET',undefined,client)).status,401);
 await b(`/api/admin/cards/${owned.id}`,'DELETE',undefined,admin);
 assert.equal((await a('/api/public/'+owned.draft.slug)).status,404);
});
test('cloud commit failures return failure, clear login cookies and roll back writes',async t=>{
 const f=await fixture(t),a=await f.start();f.fail();
 const login=await a('/api/login','POST',{password:'secure-admin-password'});
 assert.equal(login.status,503);assert.equal(login.headers.get('set-cookie'),null);
 assert.equal((await f.db.query('select document from cards_private.workspace')).rows[0].document.sessions,undefined);
});
test('cloud schema denies direct browser roles and media references only resolve when authorized',async t=>{
 const {readFile}=await import('node:fs/promises');const sql=await readFile(new URL('../supabase/migrations/001_workspace.sql',import.meta.url),'utf8');
 assert.match(sql,/enable row level security/);assert.match(sql,/revoke all on cards_private.workspace from public, anon, authenticated/);
 const f=await fixture(t);const media={async createSignedUrl(){return {data:{signedUrl:'https://example.com/signed'}}}};
 const app=createApp({store:createPostgresStore('',{pool:{async connect(){return {query:(...args)=>f.db.query(...args),release(){}}}}}),password:'secure-admin-password',media});
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s))});t.after(()=>new Promise(r=>server.close(r)));
 const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
 const ref='/api/media/'+id;
 await f.db.query('update cards_private.workspace set document=$1',[JSON.stringify({cards:[{id:'test',draft:{...seedProfile,logo:ref},published:null}],events:[],leads:[]})]);
 const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(base+ref,{redirect:'manual'})).status,404);
 await f.db.query('update cards_private.workspace set document=$1',[JSON.stringify({cards:[{id:'test',draft:seedProfile,published:{...seedProfile,logo:ref}}],events:[],leads:[]})]);
 assert.equal((await fetch(base+ref,{redirect:'manual'})).status,302);
});
