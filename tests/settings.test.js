import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../server/app.js';
import {seedProfile,profileSchema} from '../server/model.js';

test('older profiles retain optional contact fields and safe logo defaults',()=>{
  const p=profileSchema.parse(seedProfile);
  assert.deepEqual(p.exchangeFields,{phone:'optional',company:'optional',message:'optional'});
  assert.equal(p.exchangeFlow,'card-first');assert.equal(p.logoBackground,'light');assert.equal(p.logoSize,'medium');
  assert.equal(p.customCtaEnabled,false);assert.equal(p.followUpEnabled,false);
});
test('CTA settings reject missing labels, invalid destinations and invalid form rules',()=>{
  for(const patch of [{customCtaEnabled:true},{customCtaEnabled:true,customCtaLabel:'Book',customCtaUrl:'javascript:alert(1)'},{exchangeFields:{phone:'anything'}},{saveLabel:''},{logoBackgroundColor:'red'}]){
    assert.equal(profileSchema.safeParse({...seedProfile,...patch}).success,false);
  }
  assert.equal(profileSchema.safeParse({...seedProfile,customCtaEnabled:true,customCtaLabel:'Book',customCtaUrl:'https://example.com'}).success,true);
});
test('published form enforces required fields and discards hidden values',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'card-settings-'));
  const app=createApp({dataDir});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
  t.after(()=>new Promise(resolve=>server.close(()=>{fs.rmSync(dataDir,{recursive:true,force:true});resolve()})));
  const request=(route,method='GET',body)=>fetch(`http://127.0.0.1:${server.address().port}${route}`,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const profile={...seedProfile,exchangeFields:{phone:'required',company:'hidden',message:'optional'}};
  assert.equal((await request('/api/admin/cards/founder','PUT',profile)).status,200);
  assert.equal((await request('/api/admin/cards/founder/publish','POST')).status,200);
  const lead={name:'Test',email:'test@example.com',consent:true};
  assert.equal((await request('/api/public/pritesh-patel/leads','POST',lead)).status,400);
  assert.equal((await request('/api/public/pritesh-patel/leads','POST',{...lead,phone:'   '})).status,400);
  assert.equal((await request('/api/public/pritesh-patel/leads','POST',{...lead,phone:'123456789',company:{unwanted:'data'}})).status,201);
  const leads=await (await request('/api/admin/leads')).json();
  assert.equal(leads.length,1);assert.equal(leads[0].company,'');assert.equal(leads[0].phone,'123456789');
});

test('exchange options validate submissions and keep visitor details private',async t=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'card-exchange-'));
  const app=createApp({dataDir,password:'test-workspace-password'});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
  t.after(()=>new Promise(resolve=>server.close(()=>{fs.rmSync(dataDir,{recursive:true,force:true});resolve()})));
  let cookie='';
  const request=(route,method='GET',body,authenticated=true)=>fetch(`http://127.0.0.1:${server.address().port}${route}`,{method,headers:{'Content-Type':'application/json',...(authenticated?{cookie}:{})},body:body?JSON.stringify(body):undefined});
  const login=await request('/api/login','POST',{password:'test-workspace-password'});cookie=login.headers.get('set-cookie').split(';')[0];
  let profile={...seedProfile,requireEmail:false,consentEnabled:false,exchangeCustomEnabled:true,exchangeCustomLabel:'Interested in',exchangeCustomRequired:true,exchangeWidgets:true};
  const publish=async()=>{assert.equal((await request('/api/admin/cards/founder','PUT',profile)).status,200);assert.equal((await request('/api/admin/cards/founder/publish','POST')).status,200)};
  await publish();
  const submit=body=>request('/api/public/pritesh-patel/leads','POST',body,false);
  assert.equal((await submit({name:'Alex'})).status,400);
  assert.equal((await submit({name:'Alex',customValue:'Coaching',email:'invalid'})).status,400);
  assert.equal((await submit({name:'Alex',customValue:'Coaching',location:{latitude:91,longitude:0}})).status,400);
  assert.equal((await submit({name:'Alex',customValue:'Coaching',photo:'https://example.com/private'})).status,400);
  const photo='data:image/png;base64,aGVsbG8=';
  assert.equal((await submit({name:'Alex',customValue:'Coaching',photo,location:{latitude:19,longitude:72},consent:true})).status,201);
  const leads=await (await request('/api/admin/leads')).json();
  assert.equal(leads[0].email,'');assert.equal(leads[0].consent,false);assert.equal(leads[0].customLabel,'Interested in');assert.equal(leads[0].photo,photo);
  assert.equal((await request('/api/admin/leads','GET',undefined,false)).status,401);
  assert.equal((await request('/api/client/leads','GET',undefined,false)).status,401);
  assert.equal(JSON.stringify(await (await request('/api/public/pritesh-patel','GET',undefined,false)).json()).includes(photo),false);
  profile={...profile,exchangeWidgets:false,exchangeCustomEnabled:false,requireEmail:true,consentEnabled:true};await publish();
  assert.equal((await submit({name:'Alex',consent:true})).status,400);
  assert.equal((await submit({name:'Alex',email:'alex@example.com'})).status,400);
  assert.equal((await submit({name:'Alex',email:'alex@example.com',consent:true,photo:'discard',customValue:'discard'})).status,201);
  const latest=(await (await request('/api/admin/leads')).json())[0];assert.equal(latest.photo,'');assert.equal(latest.customValue,'');
});
