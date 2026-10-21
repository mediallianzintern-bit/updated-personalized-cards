import crypto from 'node:crypto';
import {persistentSessions} from './sessions.js';
import {promisify} from 'node:util';
import rateLimit from 'express-rate-limit';
import {profileSchema} from './model.js';
import {buildInsights} from './analytics.js';
const scrypt=promisify(crypto.scrypt);
export function clientRoutes(app,store,{production}) {
 const sessions=persistentSessions(store,'client');
 const cookie=req=>req.headers.cookie?.match(/(?:^|;\s*)client_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 const session=req=>{const s=sessions.get(cookie(req));return s&&s.expires>Date.now()?s:null};
 const login=(res,accountId)=>{for(const [key,s] of sessions)if(s.expires<Date.now())sessions.delete(key);const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{accountId,expires:Date.now()+12*3600_000});res.cookie('client_session',token,{httpOnly:true,sameSite:'strict',secure:production,maxAge:12*3600_000});};
 const safe=c=>({id:c.id,draft:c.draft,published:c.published});
 const limit=rateLimit({windowMs:15*60_000,limit:10,standardHeaders:true,legacyHeaders:false});
 app.post('/api/client/register',limit,async(req,res,next)=>{try{
  const parsed=profileSchema.safeParse(req.body.profile);const password=req.body.password;
  if(!parsed.success||!parsed.data.email||typeof password!=='string'||password.length<12||password.length>128)return res.status(400).json({error:'Enter valid card details, an email, and a password of 12–128 characters.'});
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
 app.use('/api/client',(req,res,next)=>{const s=session(req);if(!s)return res.status(401).json({error:'Sign in to your card account.'});req.clientCard=store.get().cards.find(c=>c.ownerId===s.accountId);if(!req.clientCard)return res.status(404).json({error:'Your card was removed by your administrator. Contact your provider for help.'});next()});
 app.get('/api/client/card',(req,res)=>res.json(safe(req.clientCard)));
 app.put('/api/client/card',(req,res)=>{const parsed=profileSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({error:'Check the card fields and try again.'});if(store.get().cards.some(c=>c.id!==req.clientCard.id&&(c.draft.slug===parsed.data.slug||c.published?.slug===parsed.data.slug)))return res.status(409).json({error:'That card URL is already in use.'});store.update(db=>{const c=db.cards.find(c=>c.id===req.clientCard.id);c.draft=parsed.data;c.updatedAt=new Date().toISOString()});res.json(safe(store.get().cards.find(c=>c.id===req.clientCard.id)))});
 app.post('/api/client/publish',(req,res)=>{store.update(db=>{const c=db.cards.find(c=>c.id===req.clientCard.id);c.published=structuredClone(c.draft);c.publishedAt=new Date().toISOString()});res.json(safe(store.get().cards.find(c=>c.id===req.clientCard.id)))});
 app.post('/api/client/unpublish',(req,res)=>{store.update(db=>{const c=db.cards.find(c=>c.id===req.clientCard.id);c.published=null;c.publishedAt=null});res.json(safe(store.get().cards.find(c=>c.id===req.clientCard.id)))});
 app.get('/api/client/insights',(req,res)=>res.json(buildInsights(store.get(),req.clientCard.id,req.query.period)));
 app.get('/api/client/leads',(req,res)=>res.json(store.get().leads.filter(l=>l.cardId===req.clientCard.id)));
}
