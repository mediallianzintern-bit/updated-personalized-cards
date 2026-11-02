import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createApp} from '../server/app.js';
import {profileSchema,seedProfile} from '../server/model.js';
import {publicProfile} from '../server/public-profile.js';
import {validUpload} from '../server/media.js';
import {withoutProfileMedia} from '../shared/profile.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const ref = () => '/api/media/'+crypto.randomUUID();
async function fixture(t) {
 let state={cards:[],clients:[],events:[],leads:[]};
 const store={get:()=>state,update(fn){const copy=structuredClone(state);fn(copy);state=copy}};
 const objects=new Map();let signed=0;
 const media={async createSignedUploadUrl(id){signed++;return {data:{signedUrl:'https://storage.test/'+id}}},
  async createSignedUrl(id){return {data:{signedUrl:'https://storage.test/'+id}}},
  async createSignedUrls(ids){return {data:ids.map(path=>({path,signedUrl:'https://storage.test/'+path}))}},
  async download(id){return {data:objects.get(id)}},async remove(ids){ids.forEach(id=>objects.delete(id));return {}}};
 async function start(password='a-strong-admin-test-password') {
  const app=createApp({store,media,password});
  const server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject)});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return async(path,method='GET',body,cookie)=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,redirect:'manual',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 }
 const request=await start();
 async function register(email) {
  const response=await request('/api/client/register','POST',{profile:{...seedProfile,email},password:'a-strong-client-password'});
  assert.equal(response.status,201);return {cookie:response.headers.get('set-cookie').split(';')[0],card:await response.json()};
 }
 async function upload(cookie,type='image/png',bytes=png) {
  const response=await request('/api/media/upload','POST',{type,size:bytes.length},cookie);
  assert.equal(response.status,200);const result=await response.json();objects.set(result.reference.split('/').pop(),new Blob([bytes],{type}));return result.reference;
 }
 return {store,objects,start,request,register,upload,signed:()=>signed};
}

test('uploads require authentication, ownership and content verification before attachment',async t=>{
 const f=await fixture(t),{request}=f;
 assert.equal((await request('/api/media/upload','POST',{type:'image/png',size:png.length})).status,401);
 assert.equal(f.signed(),0);
 const a=await f.register('a@example.com'),b=await f.register('b@example.com');
 const image=await f.upload(a.cookie);
 assert.equal((await request('/api/client/card','PUT',{...a.card.draft,photo:image},a.cookie)).status,400);
 assert.equal((await request('/api/media/complete','POST',{reference:image},b.cookie)).status,404);
 assert.equal((await request('/api/media/complete','POST',{reference:image},a.cookie)).status,200);
 assert.equal((await request('/api/client/card','PUT',{...a.card.draft,photo:image},a.cookie)).status,200);
 assert.equal((await request('/api/client/card','PUT',{...b.card.draft,photo:image},b.cookie)).status,400);
 assert.equal((await request(image)).status,404);
 assert.equal((await request(image,'GET',undefined,a.cookie)).status,302);
 assert.equal((await request(image,'GET',undefined,b.cookie)).status,404);
 await request('/api/client/publish','POST',{},a.cookie);
 assert.equal((await request(image)).status,302);
 await request('/api/client/unpublish','POST',{},a.cookie);
 assert.equal((await request(image)).status,404);
 const bad=await f.upload(a.cookie,'image/png',Buffer.from('<html>not a PNG</html>'));
 assert.equal((await request('/api/media/complete','POST',{reference:bad},a.cookie)).status,400);
 assert.equal((await request('/api/client/card','PUT',{...a.card.draft,photo:bad},a.cookie)).status,400);
 assert.equal((await request(bad,'GET',undefined,a.cookie)).status,404);
});

test('registration cannot claim other media or bypass cloud validation with inline images',async t=>{
 const f=await fixture(t);const a=await f.register('a@example.com');const image=await f.upload(a.cookie);
 for (const photo of [image,'data:image/png;base64,'+png.toString('base64')]) {
  const response=await f.request('/api/client/register','POST',{profile:{...seedProfile,email:'new@example.com',photo},password:'a-strong-client-password'});
  assert.equal(response.status,400);
 }
 assert.equal(f.store.get().clients.length,1);
});

test('hidden sections, disabled links and editor settings are absent from public JSON, vCard and media routes',async t=>{
 const f=await fixture(t);const visibleImage=ref(),hiddenImage=ref(),hiddenFile=ref(),disabledImage=ref();
 const profile=profileSchema.parse({...seedProfile,photo:visibleImage,about:'PRIVATE-BIO',followUpSubject:'PRIVATE-SUBJECT',followUpMessage:'PRIVATE-MESSAGE',followUpButtonUrl:'https://private.test',visibleSections:['contact','links'],
  links:[{id:'disabled',title:'PRIVATE-LINK',description:'',thumbnail:disabledImage,url:'https://private.test',icon:'link',enabled:false}],
  gallery:[{id:'g',title:'PRIVATE-GALLERY',image:hiddenImage}],files:[{id:'f',title:'PRIVATE-FILE',name:'private.pdf',data:hiddenFile}]});
 f.store.update(db=>db.cards.push({id:'legacy',draft:profile,published:profile}));
 let response=await f.request('/api/public/'+profile.slug);assert.equal(response.status,200);
 let data=await response.json();assert.ok(!JSON.stringify(data).includes('PRIVATE'));assert.ok(!Object.keys(data).some(key=>key.startsWith('followUp')));
 assert.deepEqual(Object.keys(data.imageUrls),[visibleImage]);
 for (const image of [hiddenImage,hiddenFile,disabledImage]) assert.equal((await f.request(image)).status,404);
 assert.equal((await f.request(visibleImage)).status,302);
 f.store.update(db=>{db.cards[0].published.visibleSections=[]});
 response=await f.request('/api/public/'+profile.slug);data=await response.json();assert.equal(data.email,'');assert.equal(data.phone,'');
 const vcf=await (await f.request('/api/public/'+profile.slug+'/contact.vcf')).text();assert.ok(!vcf.includes(profile.email));assert.ok(!vcf.includes(profile.phone));
 const safe=publicProfile({...profile,unexpectedSecret:'never-public'});assert.equal(safe.unexpectedSecret,undefined);
});

test('legacy references stay editable on their card but cannot be copied into another card',async t=>{
 const f=await fixture(t);const a=await f.register('a@example.com'),b=await f.register('b@example.com'),image=ref();
 f.store.update(db=>{db.cards.find(card=>card.id===a.card.id).draft.photo=image});
 assert.equal((await f.request('/api/client/card','PUT',{...a.card.draft,photo:image,title:'Updated'},a.cookie)).status,200);
 assert.equal((await f.request('/api/client/card','PUT',{...b.card.draft,photo:image},b.cookie)).status,400);
});

test('administrator sessions are invalidated by changing the configured password',async t=>{
 const f=await fixture(t);const result=await f.request('/api/login','POST',{password:'a-strong-admin-test-password'});
 assert.equal(result.status,200);const cookie=result.headers.get('set-cookie').split(';')[0];
 assert.equal((await f.request('/api/admin/cards','GET',undefined,cookie)).status,200);
 const rotated=await f.start('replacement-admin-test-password');
 assert.equal((await rotated('/api/admin/cards','GET',undefined,cookie)).status,401);
 assert.equal((await rotated('/api/login','POST',{password:'a-strong-admin-test-password'})).status,401);
 assert.equal((await rotated('/api/login','POST',{password:'replacement-admin-test-password'})).status,200);
});

test('owner upload quotas persist and expired sessions cannot sign uploads',async t=>{
 const f=await fixture(t);const a=await f.register('a@example.com');
 f.store.update(db=>{db.mediaAssets=Object.fromEntries(Array.from({length:80},()=>[crypto.randomUUID(),{principal:'client:'+db.clients[0].id,createdAt:Date.now(),status:'pending'}]))});
 assert.equal((await f.request('/api/media/upload','POST',{type:'image/png',size:png.length},a.cookie)).status,429);
 f.store.update(db=>{for(const value of Object.values(db.sessions.client))value.expires=0});
 assert.equal((await f.request('/api/media/upload','POST',{type:'image/png',size:png.length},a.cookie)).status,401);
});

test('file verification checks actual length, binary type and unsafe text',async()=>{
 assert.equal(await validUpload(new Blob([png]),{size:png.length,type:'image/png'}),true);
 assert.equal(await validUpload(new Blob([png]),{size:png.length-1,type:'image/png'}),false);
 assert.equal(await validUpload(new Blob([png]),{size:png.length,type:'application/pdf'}),false);
 for (const value of ['<html>bad</html>','<svg></svg>','\x00binary']) assert.equal(await validUpload(new Blob([value]),{size:Buffer.byteLength(value),type:'text/plain'}),false);
 assert.equal(await validUpload(new Blob(['Hello']),{size:5,type:'text/plain'}),true);
});

test('signup staging retains text while excluding files until authentication',()=>{
 const p={...seedProfile,photo:'data:image/png;base64,AA==',gallery:[{id:'g',image:ref()}],files:[{id:'f',data:ref()}],links:[{id:'l',url:'https://example.com',thumbnail:ref()}]};
 const safe=withoutProfileMedia(p);assert.equal(safe.name,p.name);assert.equal(safe.photo,'');assert.deepEqual(safe.gallery,[]);assert.deepEqual(safe.files,[]);assert.equal(safe.links[0].thumbnail,'');assert.ok(p.photo);
});
