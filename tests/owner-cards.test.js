import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createApp } from '../server/app.js';
import { seedProfile } from '../server/model.js';

async function fixture(t) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'mediallianz-owner-'));
  const server=await new Promise(resolve=>{const s=createApp({dataDir}).listen(0,'127.0.0.1',()=>resolve(s))});
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(()=>new Promise(resolve=>{server.close(()=>{fs.rmSync(dataDir,{recursive:true,force:true});resolve()})}));
  // Each owner keeps its own session cookie, like a separate browser.
  async function owner(email,slug){
    let cookie='';
    const request=async(route,method='GET',body)=>{const res=await fetch(base+route,{method,headers:{'Content-Type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)});const set=res.headers.get('set-cookie');if(set)cookie=set.split(';')[0];return res};
    const res=await request('/api/client/register','POST',{profile:{...seedProfile,name:email,email,slug},password:crypto.randomUUID()});
    assert.equal(res.status,201);
    return {request,first:await res.json()};
  }
  return {owner};
}

test('owners can hold several cards and every request stays inside their own cards',async t=>{
  const {owner}=await fixture(t);
  const a=await owner('a@example.test','a-card'),b=await owner('b@example.test','b-card');
  await a.request(`/api/client/publish?card=${a.first.id}`,'POST');
  let res=await a.request(`/api/client/cards/${a.first.id}/duplicate`,'POST',{slug:a.first.draft.slug});
  assert.equal(res.status,409);assert.match((await res.json()).error,/live on/);
  res=await a.request(`/api/client/cards/${a.first.id}/duplicate`,'POST',{slug:b.first.draft.slug});
  assert.equal(res.status,409);assert.doesNotMatch((await res.json()).error,/b@example/);
  res=await a.request(`/api/client/cards/${a.first.id}/duplicate`,'POST',{slug:'a-event',name:'A Event'});
  assert.equal(res.status,201);const copy=await res.json();
  assert.equal(copy.published,null);assert.equal(copy.draft.name,'A Event');assert.equal(copy.ownerId,undefined);
  res=await a.request(`/api/client/cards?card=${a.first.id}`,'POST',{slug:'a-fresh',name:'A Fresh'});
  assert.equal(res.status,201);const fresh=await res.json();
  assert.equal(fresh.draft.about,'');assert.deepEqual(fresh.draft.links,[]);assert.equal(fresh.draft.email,'a@example.test');assert.equal(fresh.draft.accent,a.first.draft.accent);
  assert.deepEqual((await (await a.request('/api/client/cards')).json()).map(c=>c.draft.slug),[a.first.draft.slug,'a-event','a-fresh']);
  assert.equal((await (await a.request('/api/client/card')).json()).id,a.first.id);
  res=await a.request(`/api/client/card?card=${copy.id}`,'PUT',{...copy.draft,title:'Event host'});
  assert.equal((await res.json()).draft.title,'Event host');
  assert.equal((await a.request(`/api/client/publish?card=${copy.id}`,'POST')).status,200);
  assert.equal((await (await a.request(`/api/client/card?card=${a.first.id}`)).json()).draft.title,'Founder');
  for(const route of [`/api/client/card?card=${a.first.id}`,`/api/client/leads?card=${a.first.id}`,`/api/client/insights?card=${a.first.id}`])assert.equal((await b.request(route)).status,404);
  assert.equal((await b.request(`/api/client/cards/${a.first.id}/duplicate`,'POST',{slug:'stolen'})).status,404);
  assert.equal((await b.request(`/api/client/publish?card=${copy.id}`,'POST')).status,404);
  assert.equal((await (await b.request('/api/client/cards')).json()).length,1);
  await a.request(`/api/client/cards/${a.first.id}/duplicate`,'POST',{slug:'a-four'});
  await a.request(`/api/client/cards/${a.first.id}/duplicate`,'POST',{slug:'a-five'});
  res=await a.request(`/api/client/cards/${a.first.id}/duplicate`,'POST',{slug:'a-six'});
  assert.equal(res.status,400);assert.match((await res.json()).error,/up to 5/);
});
