import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { copyCardMedia } from '../server/media.js';
import { seedProfile } from '../server/model.js';

async function fixture(t) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'mediallianz-short-'));
  const server=await new Promise(resolve=>{const s=createApp({dataDir}).listen(0,'127.0.0.1',()=>resolve(s))});
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(()=>new Promise(resolve=>{server.close(()=>{fs.rmSync(dataDir,{recursive:true,force:true});resolve()})}));
  const request=(route,method='GET',body)=>fetch(base+route,{method,redirect:'manual',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {request};
}

test('short links redirect to the tagged card, are reused and follow URL changes',async t=>{
  const {request}=await fixture(t);
  const body={via:'qr',campaign:{source:'Event',medium:'offline',campaign:'BNI Toronto'}};
  let res=await request('/api/admin/cards/founder/short-links','POST',body);
  assert.equal(res.status,201);const {path:short}=await res.json();
  assert.match(short,/^\/s\/[a-z0-9]{7}$/);
  res=await request('/api/admin/cards/founder/short-links','POST',body);
  assert.equal(res.status,200);assert.equal((await res.json()).path,short);
  const other=await (await request('/api/admin/cards/founder/short-links','POST',{...body,via:'link'})).json();
  assert.notEqual(other.path,short);
  res=await request(short);
  assert.equal(res.status,302);
  assert.equal(res.headers.get('location'),'/c/pritesh-patel?via=qr&utm_source=event&utm_medium=offline&utm_campaign=bni_toronto');
  await request('/api/admin/cards/founder','PUT',{...seedProfile,slug:'pritesh-canada'});
  await request('/api/admin/cards/founder/publish','POST');
  assert.match((await request(short)).headers.get('location'),/^\/c\/pritesh-canada\?via=qr/);
  assert.equal((await request('/s/zzzzzzz')).status,404);
  assert.equal((await request('/s/../api')).status,404);
  assert.equal((await request('/api/admin/cards/missing/short-links','POST',body)).status,404);
  await request('/api/admin/cards/founder','DELETE');
  assert.equal((await request(short)).status,404);
});

test('short links need a signed-in admin or card owner',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'mediallianz-short-auth-'));
  const server=await new Promise(resolve=>{const s=createApp({dataDir,password:'a-long-admin-password'}).listen(0,'127.0.0.1',()=>resolve(s))});
  t.after(()=>new Promise(resolve=>server.close(()=>{fs.rmSync(dataDir,{recursive:true,force:true});resolve()})));
  const base=`http://127.0.0.1:${server.address().port}`,post=route=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal((await post('/api/admin/cards/founder/short-links')).status,401);
  assert.equal((await post('/api/client/short-links')).status,401);
});

test('duplicating copies stored files to new objects and rewrites every reference',async()=>{
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'],ref=id=>`/api/media/${id}`;
  const copied=[],removed=[];
  const storage={async copy(from,to){copied.push([from,to]);return {error:null}},async remove(list){removed.push(...list);return {}}};
  const store={get:()=>({mediaAssets:{[ids[0]]:{principal:'client:a',type:'image/png',size:10,status:'ready'}}})};
  const profile={...seedProfile,photo:ref(ids[0]),logo:ref(ids[0]),cover:'data:image/png;base64,AA==',gallery:[{id:'g',title:'',image:ref(ids[1])}]};
  const result=await copyCardMedia(profile,store,storage);
  assert.equal(copied.length,2);
  assert.equal(result.profile.photo,result.profile.logo);
  assert.notEqual(result.profile.photo,profile.photo);
  assert.equal(result.profile.cover,profile.cover);
  assert.equal(profile.photo,ref(ids[0]));
  const newId=result.profile.photo.split('/').pop();
  assert.deepEqual({...result.assets[newId],createdAt:0},{principal:'admin',type:'image/png',size:10,status:'ready',createdAt:0,copiedFrom:ids[0]});
  assert.equal(result.assets[result.profile.gallery[0].image.split('/').pop()].copiedFrom,ids[1]);
  const failing={async copy(from){return {error:from===ids[1]?new Error('x'):null}},async remove(list){removed.push(...list);return {}}};
  assert.equal(await copyCardMedia(profile,store,failing),null);
  assert.equal(removed.length,1);
  assert.deepEqual((await copyCardMedia(seedProfile,store,storage)).assets,{});
});
