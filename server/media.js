import crypto from 'node:crypto';
const types = new Set(['image/png','image/jpeg','image/webp','application/pdf','text/plain','application/msword','application/vnd.ms-powerpoint','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
export const mediaReference = /^\/api\/media\/[a-f0-9-]{36}$/;
export function mediaRoutes(app,store,storage,adminAuth) {
  app.get('/api/config', (req,res)=>res.json({cloudMedia:Boolean(storage)}));
  if (!storage) return;
  app.post('/api/media/upload', async (req,res,next)=>{try {
    const {type,size}=req.body;
    if (!types.has(type)||!Number.isInteger(size)||size<1||size>3000000) return res.status(400).json({error:'Use a supported file smaller than 3 MB.'});
    const id=crypto.randomUUID();
    const {data,error}=await storage.createSignedUploadUrl(id);
    if (error) throw error;
    res.json({url:data.signedUrl,reference:`/api/media/${id}`});
  } catch(error){next(error)}});
  app.get('/api/media/:id', async (req,res,next)=>{try {
    const reference=`/api/media/${req.params.id}`;
    if (!mediaReference.test(reference)) return res.status(404).end();
    const has = profile => profile && JSON.stringify(profile).includes(JSON.stringify(reference));
    const token=req.headers.cookie?.match(/(?:^|;\s*)client_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    const session=token&&store.get().sessions?.client?.[crypto.createHash('sha256').update(token).digest('hex')];
    const allowed=store.get().cards.some(c=>has(c.published)||((adminAuth(req)||(session?.expires>Date.now()&&session.accountId===c.ownerId))&&has(c.draft)));
    if (!allowed) return res.status(404).end();
    const {data,error}=await storage.createSignedUrl(req.params.id,60,req.query.download?{download:String(req.query.download).replace(/[^a-zA-Z0-9 ._-]/g,'_').slice(0,160)}:undefined);
    if (error) throw error;
    res.set('Cache-Control','private, no-store').redirect(data.signedUrl);
  } catch(error){next(error)}});
}

// Only sign images from the already-authorized published profile. Keep stored
// references unchanged so editing and future URL refreshes remain stable.
export async function publicImageUrls(profile, storage) {
  if (!storage) return {};
  const refs = [...new Set([
    profile.photo, profile.logo, profile.cover,
    ...(profile.links || []).filter(link => link.enabled).map(link => link.thumbnail),
    ...(profile.gallery || []).map(item => item.image),
    ...(profile.videos || []).map(item => item.thumbnail),
  ].filter(value => typeof value === 'string' && mediaReference.test(value)))];
  if (!refs.length) return {};
  try {
    const {data, error} = await storage.createSignedUrls(refs.map(ref => ref.split('/').pop()), 60);
    if (error) return {};
    return Object.fromEntries((data || []).filter(item => !item.error && item.signedUrl && refs.includes('/api/media/' + item.path)).map(item => ['/api/media/' + item.path, item.signedUrl]));
  } catch { return {}; } // Existing authorized image endpoint remains the fallback.
}
