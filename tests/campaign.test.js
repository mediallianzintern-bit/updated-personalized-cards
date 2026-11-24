import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { buildInsights } from '../server/analytics.js';
import { campaignFromSearch, campaignUrl, campaignValue, normalizeCampaign, outboundUrl, channelLinks } from '../shared/campaign.js';
import { seedProfile } from '../server/model.js';

async function fixture(t) {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'mediallianz-campaign-'));
  const server=await new Promise(resolve=>{const s=createApp({dataDir}).listen(0,'127.0.0.1',()=>resolve(s))});
  const base=`http://127.0.0.1:${server.address().port}`;
  t.after(()=>new Promise(resolve=>{server.close(()=>{fs.rmSync(dataDir,{recursive:true,force:true});resolve()})}));
  const request=(route,method='GET',body)=>fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {request,dataDir};
}
const database=dataDir=>JSON.parse(fs.readFileSync(path.join(dataDir,'database.json')));

test('campaign values are normalised and personal data is dropped',()=>{
  assert.equal(campaignValue('  Workshop Nov 2026 '),'workshop_nov_2026');
  assert.equal(campaignValue('=HYPERLINK("x")'),'hyperlinkx');
  assert.equal(campaignValue('someone@example.com'),'');
  assert.equal(campaignValue('x'.repeat(200)).length,80);
  assert.equal(normalizeCampaign({medium:'social'}),null);
  assert.deepEqual(normalizeCampaign({source:'LinkedIn',junk:'x'}),{source:'linkedin'});
});

test('campaign links are encoded, keep the delivery method and round-trip',()=>{
  const url=campaignUrl('https://cards.mediallianz.com/c/owner','qr',{source:'Toronto Event',medium:'offline',campaign:'Spring & Summer'});
  assert.equal(url,'https://cards.mediallianz.com/c/owner?via=qr&utm_source=toronto_event&utm_medium=offline&utm_campaign=spring_summer');
  assert.equal(campaignUrl('https://cards.mediallianz.com/c/owner','link',null),'https://cards.mediallianz.com/c/owner?via=link');
  assert.deepEqual(campaignFromSearch(new URL(url).search),{source:'toronto_event',medium:'offline',campaign:'spring_summer'});
  assert.equal(campaignFromSearch('?utm_source=a&utm_source=b').source,'a');
  assert.equal(campaignFromSearch('?via=qr'),null);
});

test('insights group tagged events and leads by campaign within scope',()=>{
  const now=new Date().toISOString(),tag={source:'linkedin',medium:'social',campaign:'launch'};
  const db={cards:[{id:'a',draft:{name:'A'}},{id:'b',draft:{name:'B'}}],
    events:[{cardId:'a',type:'view',at:now,campaign:tag},{cardId:'a',type:'view',at:now,campaign:tag},{cardId:'a',type:'link',target:'x',at:now,campaign:tag},{cardId:'a',type:'save',at:now,campaign:tag},{cardId:'a',type:'view',at:now},{cardId:'b',type:'view',at:now,campaign:{source:'other'}}],
    leads:[{cardId:'a',createdAt:now,campaign:tag},{cardId:'a',createdAt:now}]};
  const data=buildInsights(db,'a');
  assert.equal(data.campaigns.length,1);
  assert.deepEqual([data.campaigns[0].views,data.campaigns[0].clicks,data.campaigns[0].saves,data.campaigns[0].leads],[2,1,1,1]);
  assert.deepEqual([data.untagged.views,data.untagged.leads],[1,1]);
  assert.equal(buildInsights(db).campaigns.length,2);
});

test('public events, contact downloads and exchanges carry campaign attribution',async t=>{
  const {request,dataDir}=await fixture(t);
  const campaign={source:'LinkedIn',medium:'social',campaign:'Launch Week'};
  assert.equal((await request('/api/public/pritesh-patel/events','POST',{type:'view',source:'link',campaign})).status,200);
  assert.equal((await request('/api/public/pritesh-patel/events','POST',{type:'view',source:'link',campaign:'not-an-object'})).status,200);
  assert.equal((await request('/api/public/pritesh-patel/contact.vcf?via=qr&utm_source=event&utm_campaign=Expo')).status,200);
  const lead={name:'Campaign Contact',email:'contact@example.com',consent:true};
  assert.equal((await request('/api/public/pritesh-patel/leads','POST',{...lead,campaign:{...campaign,source:'spam@example.com'}})).status,201);
  assert.equal((await request('/api/public/pritesh-patel/leads','POST',{...lead,consent:false,campaign})).status,400);
  const db=database(dataDir);
  assert.deepEqual(db.events[0].campaign,{source:'linkedin',medium:'social',campaign:'launch_week'});
  assert.equal(db.events[1].campaign,undefined);
  assert.deepEqual(db.events[2].campaign,{source:'event',campaign:'expo'});
  assert.equal(db.leads.length,1);
  assert.deepEqual(db.leads[0].campaign,{medium:'social',campaign:'launch_week'});
  const insights=await (await request('/api/admin/insights')).json();
  assert.equal(insights.campaigns.find(r=>r.campaign==='launch_week'&&r.source==='linkedin').views,1);
  const exportText=await (await request('/api/admin/leads.csv')).text();
  assert.match(exportText,/"Campaign","Source","Medium","Received"/);
  assert.match(exportText,/"launch_week","","social"/);
  const card=await (await request('/api/public/pritesh-patel')).json();
  assert.equal(JSON.stringify(card).includes('launch_week'),false);
});

test('outgoing links get card tags without overwriting existing UTMs',()=>{
  assert.equal(outboundUrl('https://mediallianz.com/services?ref=1',{campaign:'Toronto Expo',slug:'priteshpatel'}),'https://mediallianz.com/services?ref=1&utm_source=mediallianz_card&utm_medium=digital_card&utm_campaign=toronto_expo&utm_content=priteshpatel');
  assert.equal(outboundUrl('https://linkedin.com/in/x',{slug:'a'}),'https://linkedin.com/in/x?utm_source=mediallianz_card&utm_medium=digital_card&utm_content=a');
  assert.equal(outboundUrl('https://shop.example/?UTM_source=partner',{campaign:'x'}),'https://shop.example/?UTM_source=partner');
  for(const href of ['mailto:a@example.com','tel:+1555','not a url'])assert.equal(outboundUrl(href,{campaign:'x'}),href);
});

test('saved campaign is normalised, published with the card and off switch is respected',async t=>{
  const {request}=await fixture(t);
  let res=await request('/api/admin/cards/founder','PUT',{...seedProfile,currentCampaign:' Toronto Expo 2026 ',linkTracking:false});
  assert.equal(res.status,200);assert.equal((await res.json()).draft.currentCampaign,'toronto_expo_2026');
  let card=await (await request('/api/public/pritesh-patel')).json();
  assert.equal(card.currentCampaign,undefined);
  assert.equal((await request('/api/admin/cards/founder/publish','POST')).status,200);
  card=await (await request('/api/public/pritesh-patel')).json();
  assert.equal(card.currentCampaign,'toronto_expo_2026');assert.equal(card.linkTracking,false);
  assert.equal(card.followUpMessage,undefined);
});

test('one campaign produces a separate link for every channel',()=>{
  assert.deepEqual(channelLinks('https://cards.mediallianz.com/c/owner',{source:'x'}),[]);
  const links=channelLinks('https://cards.mediallianz.com/c/owner',{campaign:'BNI Toronto',content:'slide'});
  assert.deepEqual(links.map(l=>l.id),['linkedin','instagram','whatsapp','email','event']);
  assert.equal(links[0].url,'https://cards.mediallianz.com/c/owner?via=link&utm_source=linkedin&utm_medium=social&utm_campaign=bni_toronto&utm_content=slide');
  assert.equal(links[4].url,'https://cards.mediallianz.com/c/owner?via=qr&utm_source=event&utm_medium=offline&utm_campaign=bni_toronto&utm_content=slide');
  assert.equal(new Set(links.map(l=>campaignFromSearch(new URL(l.url).search).source)).size,5);
});

test('duplicated cards get their own link and start as drafts',async t=>{
  const {request}=await fixture(t);
  assert.equal((await request('/api/admin/cards/missing/duplicate','POST',{slug:'copy'})).status,404);
  let res=await request('/api/admin/cards/founder/duplicate','POST',{slug:'pritesh-patel'});
  assert.equal(res.status,409);assert.match((await res.json()).error,/live/);
  assert.equal((await request('/api/admin/cards/founder/duplicate','POST',{slug:'Not A Slug!'})).status,400);
  res=await request('/api/admin/cards/founder/duplicate','POST',{slug:'pritesh-patel-2',name:'Pritesh Canada'});
  assert.equal(res.status,201);const copy=await res.json();
  assert.equal(copy.published,null);assert.equal(copy.ownerId,undefined);
  assert.equal(copy.draft.name,'Pritesh Canada');assert.equal(copy.draft.slug,'pritesh-patel-2');
  assert.equal((await request('/api/public/pritesh-patel-2')).status,404);
  assert.equal((await request('/api/admin/cards/founder/duplicate','POST',{slug:'pritesh-patel-2'})).status,409);
  assert.equal((await request(`/api/admin/cards/${copy.id}/publish`,'POST')).status,200);
  assert.equal((await (await request('/api/public/pritesh-patel-2')).json()).name,'Pritesh Canada');
  assert.equal((await (await request('/api/public/pritesh-patel')).json()).name,'Dr. Prtiesh Patel');
});
