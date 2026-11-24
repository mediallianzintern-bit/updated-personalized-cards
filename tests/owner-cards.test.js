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
  return {owner,base,dataDir};
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

test('owners can delete their own extra cards and everything tied to them',async t=>{
  const {owner,base,dataDir}=await fixture(t);
  const a=await owner('a@example.test','a-card'),b=await owner('b@example.test','b-card');
  await a.request(`/api/client/publish?card=${a.first.id}`,'POST');
  const event=await (await a.request(`/api/client/cards/${a.first.id}/duplicate`,'POST',{slug:'a-event'})).json();
  const draft=await (await a.request(`/api/client/cards/${a.first.id}/duplicate`,'POST',{slug:'a-draft'})).json();
  assert.equal((await a.request(`/api/client/publish?card=${event.id}`,'POST')).status,200);
  const short=(await (await a.request(`/api/client/short-links?card=${event.id}`,'POST',{via:'link'})).json()).path;
  assert.equal((await fetch(base+'/api/public/a-event/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Lead',email:'lead@example.com',consent:true})})).status,201);
  await fetch(base+'/api/public/a-event/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'view',source:'link'})});
  // Another owner can neither see nor delete the card.
  assert.equal((await b.request(`/api/client/cards/${event.id}`,'DELETE',{confirm:'a-event'})).status,404);
  // A live card needs its URL typed back.
  let res=await a.request(`/api/client/cards/${event.id}`,'DELETE');
  assert.equal(res.status,400);assert.match((await res.json()).error,/Type a-event/);
  assert.equal((await a.request(`/api/client/cards/${event.id}`,'DELETE',{confirm:'a-card'})).status,400);
  assert.equal((await a.request(`/api/client/cards/${event.id}`,'DELETE',{confirm:' A-Event '})).status,200);
  assert.equal((await fetch(base+'/api/public/a-event')).status,404);
  assert.equal((await fetch(base+short,{redirect:'manual'})).status,404);
  const db=JSON.parse(fs.readFileSync(path.join(dataDir,'database.json')));
  assert.equal(db.cards.some(c=>c.id===event.id),false);
  assert.equal(db.leads.some(l=>l.cardId===event.id),false);
  assert.equal(db.events.some(e=>e.cardId===event.id),false);
  assert.equal(Object.values(db.shortLinks||{}).some(l=>l.cardId===event.id),false);
  // Drafts were never shared, so no confirmation is needed; the other cards keep working.
  assert.equal((await a.request(`/api/client/cards/${draft.id}`,'DELETE')).status,200);
  assert.deepEqual((await (await a.request('/api/client/cards')).json()).map(c=>c.id),[a.first.id]);
  assert.equal((await fetch(base+'/api/public/'+a.first.draft.slug)).status,200);
  // The last card stays, so the account is never left empty.
  res=await a.request(`/api/client/cards/${a.first.id}`,'DELETE',{confirm:a.first.draft.slug});
  assert.equal(res.status,400);assert.match((await res.json()).error,/only card/);
  // The freed URL can be used again.
  assert.equal((await a.request(`/api/client/cards/${a.first.id}/duplicate`,'POST',{slug:'a-event'})).status,201);
});
