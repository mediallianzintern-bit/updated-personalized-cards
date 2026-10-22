import express from 'express';
import {mediaRoutes,publicImageUrls} from './media.js';
import {rateGate} from './rate-gate.js';
import {persistentSessions} from './sessions.js';
import {clientRoutes} from './clients.js';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import { createStore } from './store.js';
import { eventSchema, deviceType, sourceType, buildInsights } from './analytics.js';
import { profileSchema, leadSchema, seedProfile, vcard, csv } from './model.js';

export function createApp({ dataDir, password = '', production = false, publicUrl = '', store: providedStore, media = null }) {
  const app = express();
  const store = providedStore || createStore(dataDir);
  const sessions = persistentSessions(store, 'admin');
  function recordEvent(req, cardId, event) {
    if (event.eventId && store.get().events.some(e=>e.eventId===event.eventId&&e.cardId===cardId)) return;
    store.update(db=>{db.events.push({...event,cardId,device:deviceType(req.get('user-agent')),at:new Date().toISOString()});db.events=db.events.slice(-50000)});
  }
  const local = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
  const auth = req => {
    if (!password && !production && local(req)) return true;
    const token = req.headers.cookie?.match(/(?:^|;\s*)cards_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    return token && (sessions.get(token) || 0) > Date.now();
  };
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' });
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    // Reject cross-origin writes, including same-machine websites attempting to use local admin access.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
      const origin = req.get('origin');
      if (origin) { try { if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Origin mismatch.' }); } catch { return res.status(403).json({ error: 'Invalid origin.' }); } }
    }
    // Prevent DNS rebinding from exposing the development workspace.
    if (!production && !password && !['localhost', '127.0.0.1', '[::1]'].includes(req.hostname)) return res.status(403).json({ error: 'Local development only.' });
    next();
  });
  app.use(express.json({ limit: '12mb' }));
  if (store.middleware) { app.use('/api', store.middleware); app.use('/api', rateGate(store)); }
  mediaRoutes(app,store,media,auth);
  app.get('/api/session', (req, res) => res.json({ authenticated: Boolean(auth(req)), localMode: !password && !production, publicUrl }));
  app.post('/api/login', rateLimit({windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false}), (req, res) => {
    const candidate = crypto.createHash('sha256').update(String(req.body.password || '')).digest();
    const expected = crypto.createHash('sha256').update(password).digest();
    if (!password || !crypto.timingSafeEqual(candidate, expected)) return res.status(401).json({ error: 'Incorrect password.' });
    for (const [key, expiry] of sessions) if (expiry < Date.now()) sessions.delete(key);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + 12 * 3600_000);
    res.cookie('cards_session', token, { httpOnly: true, sameSite: 'strict', secure: production, maxAge: 12 * 3600_000 });
    res.json({ ok: true });
  });
  app.post('/api/logout', (req, res) => { const token = req.headers.cookie?.match(/cards_session=([a-f0-9]{64})/)?.[1]; sessions.delete(token); res.clearCookie('cards_session'); res.json({ok:true}); });
  const publicCard = req => store.get().cards.find(c => c.published?.slug === req.params.slug);
  const limiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
  app.use('/api/public', limiter);
  app.get('/api/public/:slug', async (req, res) => { const c = publicCard(req); if (!c) return res.status(404).json({ error: 'This card is not available.' }); const imageUrls = await publicImageUrls(c.published, media); res.json({...c.published, imageUrls}); });
  app.get('/api/public/:slug/contact.vcf', (req, res) => {
    const c = publicCard(req); if (!c || !c.published.saveEnabled) return res.status(404).json({ error: 'Contact download is unavailable.' });
    recordEvent(req,c.id,{type:'save',source:sourceType(req.query.via)});
    res.set({ 'Content-Type': 'text/vcard; charset=utf-8', 'Content-Disposition': `attachment; filename="${c.published.slug}.vcf"` }).send(vcard(c.published));
  });
  app.post('/api/public/:slug/leads', rateLimit({windowMs: 3600_000, limit: 15, standardHeaders:true, legacyHeaders:false}), (req, res) => {
    const c = publicCard(req); if (!c || !c.published.exchangeEnabled) return res.status(404).json({ error: 'Contact exchange is unavailable.' });
    const parsed = leadSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: 'Enter a valid name and email, and agree to share your details.' });
    store.update(db => db.leads.unshift({ id: crypto.randomUUID(), cardId: c.id, ...parsed.data, createdAt: new Date().toISOString() }));
    res.status(201).json({ ok: true });
  });
  app.post('/api/public/:slug/events', (req, res) => {
    const c = publicCard(req); if (!c) return res.status(404).end();
    const parsed=eventSchema.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({error:'Invalid analytics event.'});
    recordEvent(req,c.id,parsed.data);
    res.json({ ok: true });
  });
  clientRoutes(app,store,{production});
  app.use('/api/admin', (req, res, next) => auth(req) ? next() : res.status(401).json({ error: 'Please sign in.' }));
  app.get('/api/admin/cards', (req, res) => res.json(store.get().cards));
  app.post('/api/admin/cards', (req, res) => {
    const parsed = profileSchema.safeParse(req.body.profile || { ...seedProfile, name: String(req.body.name || '').trim(), title: '', email: '', phone: '', about: '', slug: 'team-' + crypto.randomBytes(4).toString('hex') });
    if (!parsed.success) return res.status(400).json({error:'Enter a team member’s name.'});
    if (store.get().cards.some(c=>c.draft.slug===parsed.data.slug||c.published?.slug===parsed.data.slug))return res.status(409).json({error:'That card URL is already in use.'});
    const card = { id: crypto.randomUUID(), draft: parsed.data, published: null, updatedAt: new Date().toISOString(), publishedAt: null };
    if (store.get().cards.length >= 200) return res.status(400).json({error:'This workspace supports up to 200 cards.'});
    store.update(db => db.cards.push(card)); res.status(201).json(card);
  });
  app.delete('/api/admin/cards/:id', (req,res)=>{
    const card=store.get().cards.find(c=>c.id===req.params.id);
    if(!card)return res.status(404).json({error:'Card not found.'});
    store.update(db=>{
      db.cards=db.cards.filter(c=>c.id!==card.id);
      db.leads=db.leads.filter(l=>l.cardId!==card.id);
      db.events=db.events.filter(e=>e.cardId!==card.id);
    });
    res.json({ok:true});
  });
  app.put('/api/admin/cards/:id', (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') });
    const c = store.get().cards.find(c => c.id === req.params.id); if (!c) return res.status(404).json({ error: 'Card not found.' });
    if (store.get().cards.some(other => other.id !== c.id && (other.draft.slug === parsed.data.slug || other.published?.slug === parsed.data.slug))) return res.status(409).json({error:'That card URL is already in use.'});
    store.update(db => { const card = db.cards.find(v => v.id === c.id); card.draft = parsed.data; card.updatedAt = new Date().toISOString(); });
    res.json(store.get().cards.find(v => v.id === c.id));
  });
  app.post('/api/admin/cards/:id/publish', (req, res) => {
    const c = store.get().cards.find(c => c.id === req.params.id); if (!c) return res.status(404).json({error:'Card not found.'});
    if (store.get().cards.some(o => o.id !== c.id && o.published?.slug === c.draft.slug)) return res.status(409).json({error:'That card URL is already published.'});
    store.update(db => { const card = db.cards.find(v => v.id === c.id); card.published = structuredClone(card.draft); card.publishedAt = new Date().toISOString(); });
    res.json(store.get().cards.find(v => v.id === c.id));
  });
  app.post('/api/admin/cards/:id/unpublish', (req, res) => {
    if (!store.get().cards.some(c => c.id === req.params.id)) return res.status(404).json({error:'Card not found.'});
    store.update(db => { const c = db.cards.find(c => c.id === req.params.id); c.published = null; c.publishedAt = null; }); res.json({ok:true});
  });
  app.get('/api/admin/leads', (req, res) => res.json(store.get().leads));
  app.get('/api/admin/leads.csv', (req, res) => res.type('text/csv').attachment('mediallianz-contacts.csv').send(csv([['Name','Email','Phone','Company','Message','Card','Received'], ...store.get().leads.map(l => [l.name,l.email,l.phone,l.company,l.message,store.get().cards.find(c=>c.id===l.cardId)?.draft.name || '',l.createdAt])])));
  app.get('/api/admin/insights', (req, res) => {
    res.json(buildInsights(store.get(), typeof req.query.cardId==='string' ? req.query.cardId : undefined,req.query.period));
  });
  app.get('/api/admin/backup', (req, res) => res.attachment('mediallianz-backup.json').json(store.get()));
  app.use('/api', (req, res) => res.status(404).json({error:'Endpoint not found.'}));
  app.use((err, req, res, next) => { if (res.headersSent) return next(err); console.error(err.message); res.status(err.status === 413 ? 413 : err.status === 400 ? 400 : 500).json({error:err.status===413 ? 'Images are too large. Use smaller files.' : err.status===400 ? 'Invalid request.' : 'Unable to save changes. Please try again.'}); });
  return app;
}
