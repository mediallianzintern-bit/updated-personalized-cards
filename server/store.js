import fs from 'node:fs';
import path from 'node:path';
import { seedProfile } from './model.js';
export function createStore(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, 'database.json');
  let db = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { version: 1, cards: [{ id: 'founder', draft: structuredClone(seedProfile), published: structuredClone(seedProfile), updatedAt: new Date().toISOString(), publishedAt: new Date().toISOString() }], leads: [], events: [] };
  const save = () => { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 }); fs.renameSync(tmp, file); };
  save();
  return { get: () => db, update(fn) { const next = structuredClone(db); const result = fn(next); const prev = db; db = next; try { save(); } catch (e) { db = prev; throw e; } return result; } };
}
