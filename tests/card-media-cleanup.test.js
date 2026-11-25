import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createApp } from '../server/app.js';
import { createStore } from '../server/store.js';
import { seedProfile } from '../server/model.js';

const ids = Array.from({length: 5}, (_, i) => `${i + 1}`.repeat(8) + '-0000-4000-8000-000000000000');
const ref = id => `/api/media/${id}`;
const asset = principal => ({principal, type: 'image/png', size: 10, status: 'ready', createdAt: Date.now()});

async function fixture(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mediallianz-media-cleanup-'));
  const store = createStore(dataDir);
  const media = {removed: [], fail: false, async remove(list) { if (this.fail) return {error: new Error('Storage unavailable')}; this.removed.push(...list); return {data: list, error: null}; }};
  const server = await new Promise(resolve => { const s = createApp({store, media}).listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise(resolve => server.close(() => { fs.rmSync(dataDir, {recursive: true, force: true}); resolve(); })));
  const card = (id, draft, published = null, ownerId) => ({id, ...(ownerId ? {ownerId} : {}), draft: {...seedProfile, ...draft}, published: published && {...seedProfile, ...published}, updatedAt: new Date().toISOString(), publishedAt: null});
  return {store, media, base, card};
}

test('deleting a card removes its own stored files but keeps files another card still uses', async t => {
  const {store, media, base, card} = await fixture(t);
  const [own, ownLive, shared, other] = ids;
  store.update(db => {
    db.cards = [
      // Files can sit in the draft, in the live version only (replaced but not yet republished), or in lists.
      card('a', {slug: 'a', photo: ref(own), gallery: [{id: 'g', image: ref(shared), caption: ''}]}, {slug: 'a', logo: ref(ownLive)}),
      card('b', {slug: 'b', cover: ref(shared), photo: ref(other)}),
    ];
    db.mediaAssets = {[own]: asset('admin'), [ownLive]: asset('admin'), [shared]: asset('admin'), [other]: asset('admin')};
  });
  const res = await fetch(`${base}/api/admin/cards/a`, {method: 'DELETE'});
  assert.equal(res.status, 200);
  assert.deepEqual(media.removed.sort(), [own, ownLive].sort());
  assert.deepEqual(Object.keys(store.get().mediaAssets).sort(), [shared, other].sort());
  assert.deepEqual(store.get().cards.map(c => c.id), ['b']);
});

test('a storage outage still deletes the card and keeps the file records for a later cleanup', async t => {
  const {store, media, base, card} = await fixture(t);
  const [, , , , lost] = ids;
  store.update(db => { db.cards = [card('c', {slug: 'c', photo: ref(lost)})]; db.mediaAssets = {[lost]: asset('admin')}; });
  media.fail = true;
  const res = await fetch(`${base}/api/admin/cards/c`, {method: 'DELETE'});
  assert.equal(res.status, 200);
  assert.equal(store.get().cards.length, 0);
  assert.ok(store.get().mediaAssets[lost]);
});

test('owners deleting their own card also remove its files', async t => {
  const {store, media, base, card} = await fixture(t);
  const register = await fetch(`${base}/api/client/register`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({profile: {...seedProfile, email: 'owner@example.test'}, password: crypto.randomUUID()})});
  assert.equal(register.status, 201);
  const cookie = register.headers.get('set-cookie').split(';')[0], first = await register.json();
  const ownerId = store.get().cards.find(c => c.id === first.id).ownerId, [file] = ids;
  store.update(db => { db.cards.push(card('extra', {slug: 'extra', files: [{id: 'f', name: 'Brochure', data: ref(file), type: 'image/png', size: 10}]}, null, ownerId)); db.mediaAssets = {[file]: asset(`client:${ownerId}`)}; });
  const res = await fetch(`${base}/api/client/cards/extra`, {method: 'DELETE', headers: {'Content-Type': 'application/json', cookie}, body: '{}'});
  assert.equal(res.status, 200);
  assert.deepEqual(media.removed, [file]);
  assert.deepEqual(store.get().mediaAssets, {});
});
