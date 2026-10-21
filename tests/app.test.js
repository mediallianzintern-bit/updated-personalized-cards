import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../server/app.js';
import { seedProfile, vcard, csv } from '../server/model.js';

async function fixture(t, options={}) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'mediallianz-test-'));
  const app=createApp({dataDir,...options});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(()=>new Promise(resolve=>{server.close(()=>{fs.rmSync(dataDir,{recursive:true,force:true});resolve()})}));
  async function request(route,method='GET',body,headers={}) {return fetch(base+route,{method,headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)})}
  return {request,dataDir,base};
}
test('draft edits remain private until publish and survive reopening the store',async t=>{
  const {request,dataDir}=await fixture(t);
  let res=await request('/api/public/pritesh-patel'); assert.equal((await res.json()).title,'Founder');
  res=await request('/api/admin/cards/founder','PUT',{...seedProfile,title:'Founder & Director'}); assert.equal(res.status,200);
  assert.equal((await (await request('/api/public/pritesh-patel')).json()).title,'Founder');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir,'database.json'))).cards[0].draft.title,'Founder & Director');
  res=await request('/api/admin/cards/founder/publish','POST');assert.equal(res.status,200);
  assert.equal((await (await request('/api/public/pritesh-patel')).json()).title,'Founder & Director');
  const {createStore}=await import('../server/store.js');assert.equal(createStore(dataDir).get().cards[0].published.title,'Founder & Director');
});
test('team cards start as drafts and URLs cannot collide',async t=>{
  const {request}=await fixture(t);let res=await request('/api/admin/cards','POST',{name:'Test Colleague'});assert.equal(res.status,201);const card=await res.json();assert.equal(card.published,null);
  assert.equal((await request(`/api/public/${card.draft.slug}`)).status,404);
  assert.equal((await request(`/api/admin/cards/${card.id}`,'PUT',{...card.draft,slug:'pritesh-patel'})).status,409);
  assert.equal((await request(`/api/admin/cards/${card.id}/publish`,'POST')).status,200);
  assert.equal((await request(`/api/public/${card.draft.slug}`)).status,200);
  await request(`/api/admin/cards/${card.id}/unpublish`,'POST');
  assert.equal((await request(`/api/public/${card.draft.slug}`)).status,404);
});
test('contact exchanges require consent and export safely with correct attribution',async t=>{
  const {request}=await fixture(t);const lead={name:'=Test Contact',email:'test@example.com',phone:'+910000000000',company:'Example, Inc',message:'A "hello"',consent:true};
  assert.equal((await request('/api/public/pritesh-patel/leads','POST',{...lead,consent:false})).status,400);
  assert.equal((await request('/api/public/pritesh-patel/leads','POST',{...lead,email:'wrong'})).status,400);
  assert.equal((await request('/api/public/pritesh-patel/leads','POST',lead)).status,201);
  const leads=await (await request('/api/admin/leads')).json();assert.equal(leads.length,1);assert.equal(leads[0].cardId,'founder');
  const exportText=await (await request('/api/admin/leads.csv')).text();assert.match(exportText,/"'=Test Contact"/);assert.match(exportText,/A ""hello""/);
  const insights=await (await request('/api/admin/insights')).json();assert.equal(insights.leads,1);
});
test('disabled public actions cannot be invoked through their endpoints',async t=>{
  const {request}=await fixture(t);await request('/api/admin/cards/founder','PUT',{...seedProfile,exchangeEnabled:false,saveEnabled:false});await request('/api/admin/cards/founder/publish','POST');
  assert.equal((await request('/api/public/pritesh-patel/leads','POST',{name:'Tester',email:'test@example.com',consent:true})).status,404);
  assert.equal((await request('/api/public/pritesh-patel/contact.vcf')).status,404);
});
test('profile validation rejects unsafe URLs, images, duplicate sections, and invalid identifiers',async t=>{
  const {request}=await fixture(t);
  for(const patch of [{website:'javascript:alert(1)'},{website:'https://'},{photo:'data:image/svg+xml;base64,PHN2Zz4='},{slug:'../../admin'},{sectionOrder:['about','about','links','contact']},{email:'not an email'}]) assert.equal((await request('/api/admin/cards/founder','PUT',{...seedProfile,...patch})).status,400);
  assert.equal((await request('/api/admin/cards/founder','PUT',{...seedProfile,website:'https://example.com'})).status,200);
});
test('password protection, logout, cross-origin writes and DNS rebinding protections',async t=>{
  const {request}=await fixture(t,{password:'a-test-password-long-enough',production:true});
  assert.equal((await request('/api/admin/cards')).status,401);
  assert.equal((await request('/api/admin/leads.csv')).status,401);
  assert.equal((await request('/api/admin/backup')).status,401);
  assert.equal((await request('/api/public/pritesh-patel')).status,200);
  assert.equal((await request('/api/login','POST',{password:'wrong'})).status,401);
  const login=await request('/api/login','POST',{password:'a-test-password-long-enough'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Strict/);
  const headers={Cookie:cookie.split(';')[0]};assert.equal((await request('/api/admin/cards','GET',undefined,headers)).status,200);
  assert.equal((await request('/api/admin/cards','POST',{name:'Attacker'},{...headers,Origin:'https://evil.example'})).status,403);
  await request('/api/logout','POST',undefined,headers);assert.equal((await request('/api/admin/cards','GET',undefined,headers)).status,401);
  const local=await fixture(t); const rebindingStatus=await new Promise((resolve,reject)=>{http.get(local.base+'/api/admin/cards',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode)}).on('error',reject)});assert.equal(rebindingStatus,403);
});
test('analytics count real accepted events without exposing leads publicly',async t=>{
  const {request}=await fixture(t);for(const type of ['view','link'])assert.equal((await request('/api/public/pritesh-patel/events','POST',{type})).status,200);
  assert.equal((await request('/api/public/pritesh-patel/events','POST',{type:'madeup'})).status,400);
  await request('/api/public/pritesh-patel/contact.vcf');
  const data=await (await request('/api/admin/insights')).json();assert.equal(data.views,1);assert.equal(data.saves,1);assert.equal(data.clicks,1);assert.equal(data.days.length,14);
  assert.equal((await request('/api/public/pritesh-patel/leads')).status,404);
});
test('vCard and CSV escape content correctly',()=>{
  const card=vcard({...seedProfile,name:'A;B, C\nInjected'});assert.match(card,/FN:A\\;B\\, C\\nInjected\r\n/);assert.match(card,/TEL;TYPE=CELL:\+91 9892906989/);assert.ok(card.endsWith('END:VCARD\r\n'));
  assert.match(csv([['=1+1','a"b','comma, value']]),/"'=1\+1","a""b","comma, value"/);
});
test('tagged analytics deduplicate delivery IDs and filter cards',async t=>{
 const {request}=await fixture(t);const event={type:'view',source:'qr',eventId:'00000000-0000-4000-8000-000000000001'};
 for(let i=0;i<2;i++)assert.equal((await request('/api/public/pritesh-patel/events','POST',event,{'User-Agent':'iPhone Mobile'})).status,200);
 await request('/api/public/pritesh-patel/contact.vcf?via=nfc');
 const data=await (await request('/api/admin/insights?cardId=founder')).json();assert.equal(data.views,1);assert.equal(data.sources.find(s=>s.source==='qr').views,1);assert.equal(data.recent.find(e=>e.type==='view').device,'mobile');assert.equal(data.recent.find(e=>e.type==='save').source,'nfc');
 assert.equal((await request('/api/public/pritesh-patel/events','POST',{type:'save'})).status,400);
 assert.equal((await (await request('/api/admin/insights?cardId=missing')).json()).views,0);
});
test('wizard creates full customized draft atomically',async t=>{
 const {request}=await fixture(t);const profile={...seedProfile,name:'New Member',slug:'new-member',layout:'signature',buttonColor:'#ff6038',photoPositionX:25};
 const response=await request('/api/admin/cards','POST',{profile});assert.equal(response.status,201);const card=await response.json();assert.equal(card.draft.layout,'signature');assert.equal(card.draft.photoPositionX,25);assert.equal(card.published,null);
 assert.equal((await request('/api/admin/cards','POST',{profile})).status,409);
 assert.equal((await request('/api/admin/cards','POST',{profile:{...profile,slug:'different',email:'invalid'}})).status,400);
 assert.equal((await (await request('/api/admin/cards')).json()).length,2);
});
test('client onboarding isolates accounts and retains full edit and publishing functions',async t=>{
 const {request}=await fixture(t,{password:'admin-password-for-test',production:true});
 assert.equal((await request('/api/client/card')).status,401);
 const signup=async(email)=>{const r=await request('/api/client/register','POST',{profile:{...seedProfile,email,name:email},password:'client-password-long'});assert.equal(r.status,201);return {card:await r.json(),headers:{Cookie:r.headers.get('set-cookie').split(';')[0]}}};
 const a=await signup('a@example.com'),b=await signup('b@example.com');assert.notEqual(a.card.id,b.card.id);
 assert.equal((await request('/api/admin/cards','GET',undefined,a.headers)).status,401);
 assert.equal((await request('/api/client/card','GET',undefined,a.headers)).status,200);
 const edited={...a.card.draft,title:'Director',layout:'signature',buttonColor:'#153b2e',about:'Updated biography'};
 assert.equal((await request('/api/client/card','PUT',edited,a.headers)).status,200);
 assert.equal((await request('/api/client/publish','POST',{},a.headers)).status,200);
 assert.equal((await (await request('/api/public/'+a.card.draft.slug)).json()).title,'Director');
 assert.equal((await (await request('/api/client/card','GET',undefined,b.headers)).json()).draft.title,'Founder');
 assert.equal((await request('/api/client/card','PUT',{...b.card.draft,slug:a.card.draft.slug},b.headers)).status,409);
 await request('/api/public/'+a.card.draft.slug+'/events','POST',{type:'view',source:'qr'});
 assert.equal((await (await request('/api/client/insights','GET',undefined,a.headers)).json()).views,1);
 assert.equal((await (await request('/api/client/insights?period=all&cardId='+a.card.id,'GET',undefined,b.headers)).json()).views,0);
 await request('/api/client/unpublish','POST',{},a.headers);assert.equal((await request('/api/public/'+a.card.draft.slug)).status,404);
 await request('/api/client/logout','POST',{},a.headers);assert.equal((await request('/api/client/card','GET',undefined,a.headers)).status,401);
 const login=await request('/api/client/login','POST',{email:'a@example.com',password:'client-password-long'});assert.equal(login.status,200);
 assert.equal((await request('/api/client/login','POST',{email:'a@example.com',password:'wrong'})).status,401);
});

test('rich card media persists, publishes, and rejects unsafe attachments',async t=>{
 const {request,dataDir}=await fixture(t);
 const image='data:image/png;base64,iVBORw0KGgo=';
 const profile={...seedProfile,logo:image,gallery:[{id:'photo-1',title:'Our office',image}],videos:[{id:'video-1',title:'Introduction',url:'https://www.youtube.com/watch?v=abcdefghijk',thumbnail:image}],files:[{id:'file-1',title:'Brochure',name:'brochure.txt',data:'data:text/plain;base64,SGVsbG8='}],links:seedProfile.links.map(l=>({...l,thumbnail:image})),socials:[{id:'social-1',platform:'LinkedIn Company',url:'https://linkedin.com/company/example'}]};
 assert.equal((await request('/api/admin/cards/founder','PUT',profile)).status,200);
 assert.equal((await request('/api/admin/cards/founder/publish','POST')).status,200);
 const live=await (await request('/api/public/pritesh-patel')).json();
 assert.deepEqual(live.files,profile.files);assert.deepEqual(live.gallery,profile.gallery);assert.deepEqual(live.videos,profile.videos);assert.equal(live.links[0].thumbnail,image);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir,'database.json'))).cards[0].draft.logo,image);
 assert.equal((await request('/api/admin/cards/founder','PUT',{...profile,files:[{...profile.files[0],data:'data:text/html;base64,SGVsbG8='}]})).status,400);
 assert.equal((await request('/api/admin/cards/founder','PUT',{...profile,files:[{...profile.files[0],name:'../../file.txt'}]})).status,400);
});

test('admin deletion removes only the selected card and related data, persists, and allows an empty workspace',async t=>{
 const {request,dataDir}=await fixture(t,{password:'admin-password-for-test'});
 const registration=await request('/api/client/register','POST',{profile:{...seedProfile,email:'delete-test@example.com'},password:'client-password-long'});
 const clientCard=await registration.json(), clientHeaders={Cookie:registration.headers.get('set-cookie').split(';')[0]};
 assert.equal((await request('/api/admin/cards/founder','DELETE')).status,401);
 assert.equal((await request('/api/admin/cards/founder','DELETE',undefined,clientHeaders)).status,401);
 const login=await request('/api/login','POST',{password:'admin-password-for-test'}), headers={Cookie:login.headers.get('set-cookie').split(';')[0]};
 await request('/api/client/publish','POST',{},clientHeaders);
 await request('/api/public/'+clientCard.draft.slug+'/events','POST',{type:'view',source:'qr'});
 await request('/api/public/'+clientCard.draft.slug+'/leads','POST',{name:'Test visitor',email:'visitor@example.com',consent:true});
 assert.equal((await request('/api/admin/cards/'+clientCard.id,'DELETE',undefined,headers)).status,200);
 assert.equal((await request('/api/public/'+clientCard.draft.slug)).status,404);
 assert.equal((await request('/api/client/card','GET',undefined,clientHeaders)).status,404);
 assert.equal((await request('/api/client/publish','POST',{},clientHeaders)).status,404);
 assert.equal((await request('/api/public/pritesh-patel')).status,200);
 const db=JSON.parse(fs.readFileSync(path.join(dataDir,'database.json')));
 assert.equal(db.cards.length,1);assert.equal(db.leads.filter(l=>l.cardId===clientCard.id).length,0);assert.equal(db.events.filter(e=>e.cardId===clientCard.id).length,0);assert.equal(db.clients.length,1);
 assert.equal((await request('/api/admin/cards/'+clientCard.id,'DELETE',undefined,headers)).status,404);
 assert.equal((await request('/api/admin/cards/founder','DELETE',undefined,headers)).status,200);
 assert.deepEqual(await (await request('/api/admin/cards','GET',undefined,headers)).json(),[]);
 assert.equal((await request('/api/admin/cards','POST',{name:'Next card'},headers)).status,201);
});
