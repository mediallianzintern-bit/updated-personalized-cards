import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/lib.js';

// Owner saves name the card being edited (?card=<id>). New images in the body must still be
// uploaded first and replaced with a stored-file reference, or the server rejects the save.
test('owner saves upload new images first, even when the URL names a card', async t => {
  const realFetch = globalThis.fetch, calls = [];
  const reference = '/api/media/11111111-1111-4111-8111-111111111111';
  const json = body => new Response(JSON.stringify(body), {status: 200, headers: {'Content-Type': 'application/json'}});
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith('data:')) return realFetch(url);
    calls.push([String(url), options.body]);
    if (url === '/api/config') return json({cloudMedia: true});
    if (url === '/api/media/upload') return json({url: 'https://storage.example/upload', reference});
    if (url === 'https://storage.example/upload') return new Response(null, {status: 200});
    return json({ok: true});
  };
  t.after(() => { globalThis.fetch = realFetch; });
  const photo = 'data:image/png;base64,' + Buffer.from('fake image').toString('base64');
  await api('/api/client/card?card=abc', {method: 'PUT', body: JSON.stringify({name: 'Owner', photo})});
  const save = calls.find(([url]) => url === '/api/client/card?card=abc');
  assert.ok(calls.some(([url]) => url === '/api/media/complete'));
  assert.equal(JSON.parse(save[1]).photo, reference);
});
