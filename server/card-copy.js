import crypto from 'node:crypto';
import {profileSchema} from './model.js';
import {profileMediaAllowed,mediaValues,mediaReference} from './media-access.js';
import {copyCardMedia} from './media.js';

export const MAX_CARDS = 200;
export const MAX_OWNER_CARDS = 5;

// Personal content is cleared for a fresh card; the brand (logo, colours, layout, company) carries over.
function starterProfile(source, email) {
  return {...source, title: '', email: email || '', phone: '', website: '', location: '', about: '', photo: '', cover: '',
    links: [], socials: [], gallery: [], videos: [], files: [], currentCampaign: '', followUpEnabled: false};
}

// Removes a card with its contacts, analytics and short links. Callers check ownership first.
function removeCard(db, cardId, files) {
  db.cards = db.cards.filter(c => c.id !== cardId);
  db.leads = db.leads.filter(l => l.cardId !== cardId);
  db.events = db.events.filter(e => e.cardId !== cardId);
  if (db.shortLinks) for (const [code, link] of Object.entries(db.shortLinks)) if (link.cardId === cardId) delete db.shortLinks[code];
  for (const id of files) delete db.mediaAssets?.[id];
}

// Stored files only this card uses. Another card can point at the same file (an admin may reuse an upload,
// and cards made before copying existed share files), so those files stay.
export function cardOnlyMedia(db, cardId) {
  const ids = card => [...mediaValues(card.draft), ...mediaValues(card.published)].filter(v => mediaReference.test(v)).map(v => v.split('/').pop());
  const card = db.cards.find(c => c.id === cardId);
  if (!card) return [];
  const others = new Set(db.cards.filter(c => c.id !== cardId).flatMap(ids));
  return [...new Set(ids(card))].filter(id => !others.has(id));
}

// Files are removed before the database change commits. If the commit then fails, the card stays with
// missing images and deleting it again finishes the job; the reverse order could leave files nobody can find.
// A storage failure never blocks the delete: the file records are kept so the files can be cleaned up later.
export async function deleteCard(store, media, cardId) {
  let files = cardOnlyMedia(store.get(), cardId);
  if (media && files.length) {
    const {error} = await media.remove(files).catch(error => ({error}));
    if (error) { console.error('Card files could not be removed from storage:', error.message || error); files = []; }
  }
  store.update(db => removeCard(db, cardId, files));
}

// A new card always starts as an unpublished draft with its own URL, so the original's live link and QR keep working.
// Owners only learn about conflicts with their own cards; other customers' card names stay private.
export async function copyCard({store, media, source, name, slug, ownerId, principal, blank = false, email}) {
  const cards = store.get().cards;
  if (cards.length >= MAX_CARDS) return {status: 400, body: {error: 'This workspace supports up to 200 cards.'}};
  if (ownerId && cards.filter(c => c.ownerId === ownerId).length >= MAX_OWNER_CARDS) return {status: 400, body: {error: `You can have up to ${MAX_OWNER_CARDS} cards. Contact your provider for more.`}};
  const base = blank ? starterProfile(source.draft, email) : structuredClone(source.draft);
  const parsed = profileSchema.safeParse({...base, name: String(name || '').trim() || source.draft.name, slug: String(slug || '').trim().toLowerCase()});
  if (!parsed.success) return {status: 400, body: {error: parsed.error.issues.some(i => i.path[0] === 'slug') ? 'Use lowercase letters, numbers and hyphens for the card URL.' : 'This card could not be created.'}};
  const taken = cards.find(c => c.draft.slug === parsed.data.slug || c.published?.slug === parsed.data.slug);
  if (taken) {
    const visible = !ownerId || taken.ownerId === ownerId, live = taken.published?.slug === parsed.data.slug;
    return {status: 409, body: {error: visible && live ? `That card URL is live on ${taken.published.name}’s card. Choose a different URL.` : 'That card URL is already in use. Choose a different URL.'}};
  }
  if (!profileMediaAllowed(parsed.data, {store, card: source, principal, cloud: Boolean(media)})) return {status: 400, body: {error: 'The original card contains unverified files.'}};
  // Stored files are copied to new objects so editing or deleting either card never affects the other's images.
  const copies = await copyCardMedia(parsed.data, store, media, principal);
  if (!copies) return {status: 502, body: {error: 'The images could not be copied. Try again.'}};
  const card = {id: crypto.randomUUID(), ...(ownerId ? {ownerId} : {}), draft: copies.profile, published: null, updatedAt: new Date().toISOString(), publishedAt: null};
  store.update(db => { db.cards.push(card); Object.assign(db.mediaAssets ??= {}, copies.assets); });
  return {status: 201, body: card};
}
