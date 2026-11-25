import {createShortLink} from './short-links.js';
import {copyCard,deleteCard} from './card-copy.js';
import crypto from 'node:crypto';
import {profileMediaAllowed} from './media-access.js';
import {persistentSessions} from './sessions.js';
import {promisify} from 'node:util';
import rateLimit from 'express-rate-limit';
import {profileSchema} from './model.js';
import {buildInsights} from './analytics.js';
const scrypt=promisify(crypto.scrypt);
export function clientRoutes(app,store,{production,cloudMedia=false,media=null}) {
 const sessions=persistentSessions(store,'client');
 const cookie=req=>req.headers.cookie?.match(/(?:^|;\s*)client_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 const session=req=>{const s=sessions.get(cookie(req));return s&&s.expires>Date.now()?s:null};
 const login=(res,accountId)=>{for(const [key,s] of sessions)if(s.expires<Date.now())sessions.delete(key);const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{accountId,expires:Date.now()+12*3600_000});res.cookie('client_session',token,{httpOnly:true,sameSite:'strict',secure:production,maxAge:12*3600_000});};
 const safe=c=>({id:c.id,draft:c.draft,published:c.published});
 const limit=rateLimit({windowMs:15*60_000,limit:10,standardHeaders:true,legacyHeaders:false});
 app.post('/api/client/register',limit,async(req,res,next)=>{try{
  const parsed=profileSchema.safeParse(req.body.profile);const password=req.body.password;
  if(!parsed.success||!parsed.data.email||typeof password!=='string'||password.length<12||password.length>128)return res.status(400).json({error:'Enter valid card details, an email, and a password of 12–128 characters.'});
  if(!profileMediaAllowed(parsed.data,{store,cloud:cloudMedia}))return res.status(400).json({error:'Create your account before uploading files.'});
  const email=parsed.data.email.toLowerCase();
  const salt=crypto.randomBytes(16).toString('hex');const hash=(await scrypt(password,salt,64)).toString('hex');
  // Check after hashing as another registration may have completed while awaiting scrypt.
  if((store.get().clients||[]).some(a=>a.email===email))return res.status(409).json({error:'An account already uses this email. Sign in instead.'});
  if(store.get().cards.length>=200)return res.status(400).json({error:'Client capacity reached. Contact your provider.'});
  const id=crypto.randomUUID();const profile={...parsed.data,slug:'card-'+crypto.randomBytes(10).toString('hex')};const account={id,email,salt,hash};
  const card={id:crypto.randomUUID(),ownerId:id,draft:profile,published:null,publishedAt:null,updatedAt:new Date().toISOString()};
  store.update(db=>{(db.clients??=[]).push(account);db.cards.push(card)});login(res,id);res.status(201).json(safe(card));
 }catch(e){next(e)}});
 app.post('/api/client/login',limit,async(req,res,next)=>{try{
  const email=String(req.body.email||'').trim().toLowerCase(),password=req.body.password;
  if(typeof password!=='string'||password.length>128)return res.status(401).json({error:'Email or password is incorrect.'});
  const account=(store.get().clients||[]).find(a=>a.email===email);
  const hash=await scrypt(password,account?.salt||'dummy-login-salt',64);
  if(!account||!crypto.timingSafeEqual(hash,Buffer.from(account.hash,'hex')))return res.status(401).json({error:'Email or password is incorrect.'});
  login(res,account.id);res.json({ok:true});
 }catch(e){next(e)}});
 app.post('/api/client/logout',(req,res)=>{sessions.delete(cookie(req));res.clearCookie('client_session');res.json({ok:true})});
 // An owner may hold several cards; ?card= picks one of their own, and requests without it use their first card.
 app.use('/api/client',(req,res,next)=>{const s=session(req);if(!s)return res.status(401).json({error:'Sign in to your card account.'});req.clientAccountId=s.accountId;req.clientCards=store.get().cards.filter(c=>c.ownerId===s.accountId);if(!req.clientCards.length)return res.status(404).json({error:'Your card was removed by your administrator. Contact your provider for help.'});const wanted=typeof req.query.card==='string'?req.query.card:'';req.clientCard=wanted?req.clientCards.find(c=>c.id===wanted):req.clientCards[0];if(!req.clientCard)return res.status(404).json({error:'Card not found.'});next()});
 app.get('/api/client/cards',(req,res)=>res.json(req.clientCards.map(safe)));
 app.post('/api/client/cards',async(req,res,next)=>{try{const account=(store.get().clients||[]).find(a=>a.id===req.clientAccountId);const result=await copyCard({store,media,source:req.clientCard,name:req.body.name,slug:req.body.slug,ownerId:req.clientAccountId,principal:`client:${req.clientAccountId}`,blank:true,email:account?.email});res.status(result.status).json(result.status===201?safe(result.body):result.body)}catch(e){next(e)}});
 app.post('/api/client/cards/:id/duplicate',async(req,res,next)=>{try{const source=req.clientCards.find(c=>c.id===req.params.id);if(!source)return res.status(404).json({error:'Card not found.'});const result=await copyCard({store,media,source,name:req.body.name,slug:req.body.slug,ownerId:req.clientAccountId,principal:`client:${req.clientAccountId}`});res.status(result.status).json(result.status===201?safe(result.body):result.body)}catch(e){next(e)}});
 // Owners keep at least one card so their account stays usable. A live card needs its URL typed back,
 // because deleting it breaks every printed QR code and shared link for that card.
 app.delete('/api/client/cards/:id',async(req,res,next)=>{try{const card=req.clientCards.find(c=>c.id===req.params.id);if(!card)return res.status(404).json({error:'Card not found.'});if(req.clientCards.length<=1)return res.status(400).json({error:'This is your only card. Keep at least one card, or contact your provider to close your account.'});if(card.published&&String(req.body?.confirm||'').trim().toLowerCase()!==card.published.slug)return res.status(400).json({error:`Type ${card.published.slug} to confirm deleting this live card.`});await deleteCard(store,media,card.id);res.json({ok:true})}catch(e){next(e)}});
 app.get('/api/client/card',(req,res)=>res.json(safe(req.clientCard)));
 app.put('/api/client/card',(req,res)=>{const parsed=profileSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Check the card fields and try again.'});if(!profileMediaAllowed(parsed.data,{store,card:req.clientCard,principal:`client:${req.clientCard.ownerId}`,cloud:cloudMedia}))return res.status(400).json({error:'Use verified files uploaded for your own card.'});if(store.get().cards.some(c=>c.id!==req.clientCard.id&&(c.draft.slug===parsed.data.slug||c.published?.slug===parsed.data.slug)))return res.status(409).json({error:'That card URL is already in use.'});store.update(db=>{const c=db.cards.find(c=>c.id===req.clientCard.id);c.draft=parsed.data;c.updatedAt=new Date().toISOString()});res.json(safe(store.get().cards.find(c=>c.id===req.clientCard.id)))});
 app.post('/api/client/publish',(req,res)=>{if(!profileMediaAllowed(req.clientCard.draft,{store,card:req.clientCard,principal:`client:${req.clientCard.ownerId}`,cloud:cloudMedia}))return res.status(400).json({error:'The card contains unverified files.'});store.update(db=>{const c=db.cards.find(c=>c.id===req.clientCard.id);c.published=structuredClone(c.draft);c.publishedAt=new Date().toISOString()});res.json(safe(store.get().cards.find(c=>c.id===req.clientCard.id)))});
 app.post('/api/client/unpublish',(req,res)=>{store.update(db=>{const c=db.cards.find(c=>c.id===req.clientCard.id);c.published=null;c.publishedAt=null});res.json(safe(store.get().cards.find(c=>c.id===req.clientCard.id)))});
 app.post('/api/client/short-links',(req,res)=>{const result=createShortLink(store,req.clientCard.id,req.body);if(result.error)return res.status(400).json({error:result.error});res.status(result.created?201:200).json({path:`/s/${result.code}`})});
 app.get('/api/client/insights',(req,res)=>res.json(buildInsights(store.get(),req.clientCard.id,req.query.period)));
 app.get('/api/client/leads',(req,res)=>res.json(store.get().leads.filter(l=>l.cardId===req.clientCard.id)));
}
