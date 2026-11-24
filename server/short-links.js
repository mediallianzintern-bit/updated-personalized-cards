import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import {campaignUrl, normalizeCampaign} from '../shared/campaign.js';

// Short links point at a card ID, not a slug, so they keep working if the card URL changes later.
const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
const vias = ['link', 'qr', 'nfc', 'email-signature', 'virtual-background'];
const MAX_PER_CARD = 200;
export const shortCode = /^[a-z0-9]{7}$/;

export function createShortLink(store, cardId, body = {}) {
  const via = vias.includes(body.via) ? body.via : 'link';
  const campaign = normalizeCampaign(body.campaign);
  const links = store.get().shortLinks || {};
  const same = Object.entries(links).find(([, l]) => l.cardId === cardId && l.via === via && JSON.stringify(l.campaign || null) === JSON.stringify(campaign));
  if (same) return {code: same[0], created: false};
  if (Object.values(links).filter(l => l.cardId === cardId).length >= MAX_PER_CARD) return {error: 'This card has reached its short link limit.'};
  let code;
  do code = Array.from({length: 7}, () => alphabet[crypto.randomInt(alphabet.length)]).join(''); while (links[code]);
  store.update(db => { (db.shortLinks ??= {})[code] = {cardId, via, ...(campaign ? {campaign} : {}), createdAt: new Date().toISOString()}; });
  return {code, created: true};
}

export function shortLinkTarget(db, code) {
  const link = shortCode.test(code) && db.shortLinks?.[code];
  const card = link && db.cards.find(c => c.id === link.cardId);
  if (!card) return null;
  const url = new URL(campaignUrl(`http://card.invalid/c/${card.published?.slug || card.draft.slug}`, link.via, link.campaign));
  return url.pathname + url.search;
}

export function shortLinkRoutes(app, store) {
  if (store.middleware) app.use('/s', store.middleware);
  app.get('/s/:code', rateLimit({windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false}), (req, res) => {
    const target = shortLinkTarget(store.get(), req.params.code);
    if (!target) return res.status(404).type('text/plain').send('This link is not available.');
    res.set('Cache-Control', 'no-store').redirect(302, target);
  });
}
