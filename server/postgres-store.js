import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';

export function createPostgresStore(connectionString, { pool: suppliedPool } = {}) {
  const pool = suppliedPool || new pg.Pool({ connectionString, max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
  const context = new AsyncLocalStorage();
  const current = () => { const state = context.getStore(); if (!state) throw new Error('Database access outside request transaction'); return state; };
  const store = {
    get: () => current().db,
    update(fn) { const state = current(); const next = structuredClone(state.db); const result = fn(next); state.db = next; state.dirty = true; return result; },
    async close() { await pool.end(); },
    middleware: async (req, res, next) => {
      let client;
      const end = res.end.bind(res);
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query("SET LOCAL statement_timeout = '15000'");
        // Lock before reading: registrations, edits and analytics cannot overwrite
        // another function instance's changes. Keep the 200-card workspace bounded.
        const { rows } = await client.query('SELECT document FROM cards_private.workspace WHERE id = 1 FOR UPDATE');
        if (!rows[0]) throw new Error('Run the database migration before starting the app');
        const state = { db: rows[0].document, dirty: false };
        let ending = false;
        res.end = function(chunk, encoding, callback) {
          if (ending) return res;
          ending = true;
          (async () => {
            try {
              if (res.statusCode >= 500) await client.query('ROLLBACK');
              else {
                if (state.dirty) await client.query('UPDATE cards_private.workspace SET document = $1::jsonb, updated_at = now() WHERE id = 1', [JSON.stringify(state.db)]);
                await client.query('COMMIT');
              }
              end(chunk, encoding, callback);
            } catch {
              await client.query('ROLLBACK').catch(() => {});
              res.removeHeader('Set-Cookie'); res.removeHeader('Content-Length'); res.removeHeader('Content-Disposition');
              res.statusCode = 503; res.setHeader('Content-Type','application/json');
              end(JSON.stringify({error:'Database unavailable. Please try again.'}));
            } finally { client.release(); }
          })();
          return res;
        };
        res.once('close', () => { if (!ending) { ending = true; client.query('ROLLBACK').finally(() => client.release()).catch(() => {}); } });
        context.run(state, next);
      } catch {
        if (client) { await client.query('ROLLBACK').catch(() => {}); client.release(); }
        res.status(503).json({error:'Database unavailable. Check the deployment configuration.'});
      }
    },
  };
  return store;
}
