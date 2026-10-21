import crypto from 'node:crypto';
// Only token digests are stored. The browser receives the opaque bearer token.
export function persistentSessions(store, namespace) {
  const digest = token => crypto.createHash('sha256').update(String(token)).digest('hex');
  return {
    get(token) { return store.get().sessions?.[namespace]?.[digest(token)]; },
    set(token, value) { store.update(db => {
      const entries = (db.sessions ??= {})[namespace] ??= {};
      for (const [key, item] of Object.entries(entries)) if ((item.expires ?? item) < Date.now()) delete entries[key];
      entries[digest(token)] = value;
    }); },
    delete(token) { store.update(db => { if (db.sessions?.[namespace]) delete db.sessions[namespace][digest(token)]; }); },
    *[Symbol.iterator]() { /* Expiry cleanup is performed during set(). */ },
  };
}
