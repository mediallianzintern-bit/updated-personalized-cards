import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import {FileTypeParser} from 'file-type';
import {detectCfbf} from '@file-type/cfbf';
import {publicProfile} from './public-profile.js';
import {mediaReference,mediaValues,clientSession,uploadPrincipal} from './media-access.js';
export {mediaReference} from './media-access.js';
const types = new Set(['image/png','image/jpeg','image/webp','application/pdf','text/plain','application/msword','application/vnd.ms-powerpoint','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
const MAX_BYTES = 3_000_000;

export async function validUpload(blob,asset) {
  if (!blob || blob.size !== asset.size || blob.size < 1 || blob.size > MAX_BYTES) return false;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (asset.type === 'text/plain') {
    try {
      const text = new TextDecoder('utf-8',{fatal:true}).decode(bytes);
      return !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text) && !/^\s*(?:<!doctype\s+html|<html|<svg|<script)/i.test(text);
    } catch { return false; }
  }
  try {
    const detected = await new FileTypeParser({customDetectors:[detectCfbf]}).fromBuffer(bytes);
    return detected?.mime === asset.type;
  } catch { return false; }
}

export function mediaRoutes(app,store,storage,adminAuth) {
  app.get('/api/config', (req,res)=>res.json({cloudMedia:Boolean(storage)}));
  if (!storage) return;
  const limit = rateLimit({windowMs:15*60_000,limit:60,standardHeaders:true,legacyHeaders:false});
  const requireOwner = (req,res,next) => {
    req.mediaPrincipal = uploadPrincipal(req,store,adminAuth);
    return req.mediaPrincipal ? next() : res.status(401).json({error:'Sign in before uploading a file.'});
  };
  app.post('/api/media/upload',requireOwner,limit,async (req,res,next)=>{try {
    const {type,size}=req.body || {};
    if (!types.has(type)||!Number.isInteger(size)||size<1||size>MAX_BYTES) return res.status(400).json({error:'Use a supported file smaller than 3 MB.'});
    const assets = Object.values(store.get().mediaAssets || {}).filter(asset => asset.principal === req.mediaPrincipal);
    // Persisted owner quota also applies across different IPs/function instances.
    if (assets.filter(asset => asset.createdAt > Date.now()-3600_000).length >= 80 || assets.length >= 250) return res.status(429).json({error:'Upload limit reached. Contact support to remove unused files.'});
    const id=crypto.randomUUID();
    const {data,error}=await storage.createSignedUploadUrl(id);
    if (error) throw error;
    store.update(db => { (db.mediaAssets ??= {})[id] = {principal:req.mediaPrincipal,type,size,status:'pending',createdAt:Date.now()}; });
    res.json({url:data.signedUrl,reference:`/api/media/${id}`});
  } catch(error){next(error)}});
  app.post('/api/media/complete',requireOwner,limit,async(req,res,next)=>{try {
    const reference = req.body?.reference;
    if (typeof reference !== 'string' || !mediaReference.test(reference)) return res.status(400).json({error:'Invalid upload reference.'});
    const id = reference.split('/').pop(), asset = store.get().mediaAssets?.[id];
    if (!asset || asset.principal !== req.mediaPrincipal) return res.status(404).json({error:'Upload not found.'});
    if (asset.status === 'ready') return res.json({ok:true});
    if (asset.status !== 'pending' || asset.createdAt < Date.now()-3600_000) return res.status(400).json({error:'Upload expired. Upload the file again.'});
    const {data,error} = await storage.download(id);
    if (error) throw error;
    if (!(await validUpload(data,asset))) {
      store.update(db => { db.mediaAssets[id].status = 'rejected'; });
      // The object stays inaccessible. Removal is best effort, not a validation bypass.
      await storage.remove([id]).catch(()=>{});
      return res.status(400).json({error:'The file contents or size do not match its file type. Choose a valid file.'});
    }
    store.update(db => { db.mediaAssets[id].status = 'ready'; });
    res.json({ok:true});
  } catch(error){next(error)}});
  app.get('/api/media/:id', async (req,res,next)=>{try {
    const reference=`/api/media/${req.params.id}`;
    if (!mediaReference.test(reference)) return res.status(404).end();
    const asset = store.get().mediaAssets?.[req.params.id];
    if (asset && asset.status !== 'ready') return res.status(404).end();
    const session = clientSession(req,store);
    const admin = adminAuth(req);
    const allowed=store.get().cards.some(card =>
      (card.published && mediaValues(publicProfile(card.published)).includes(reference)) ||
      ((admin || session?.accountId === card.ownerId && session) && mediaValues(card.draft).includes(reference)));
    if (!allowed) return res.status(404).end();
    const {data,error}=await storage.createSignedUrl(req.params.id,60,req.query.download?{download:String(req.query.download).replace(/[^a-zA-Z0-9 ._-]/g,'_').slice(0,160)}:undefined);
    if (error) throw error;
    res.set('Cache-Control','private, no-store').redirect(data.signedUrl);
  } catch(error){next(error)}});
}

export async function publicImageUrls(profile, storage) {
  if (!storage) return {};
  // Filter here as well so callers cannot accidentally sign hidden section media.
  const safe = publicProfile(profile);
  const refs = [...new Set([
    safe.photo, safe.logo, safe.cover,
    ...safe.links.map(link => link.thumbnail),
    ...safe.gallery.map(item => item.image),
    ...safe.videos.map(item => item.thumbnail),
  ].filter(value => typeof value === 'string' && mediaReference.test(value)))];
  if (!refs.length) return {};
  try {
    const {data, error} = await storage.createSignedUrls(refs.map(ref => ref.split('/').pop()), 60);
    if (error) return {};
    return Object.fromEntries((data || []).filter(item => !item.error && item.signedUrl && refs.includes('/api/media/' + item.path)).map(item => ['/api/media/' + item.path, item.signedUrl]));
  } catch { return {}; }
}
