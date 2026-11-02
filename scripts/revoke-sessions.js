import pg from 'pg';
import {postgresConfig} from '../server/postgres-config.js';

if (!process.argv.includes('--confirm')) {
  console.error('This signs out every administrator and card owner. Run with --confirm after credential rotation.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Load the updated private .env file.');
  process.exit(1);
}
const pool = new pg.Pool({...postgresConfig(process.env.DATABASE_URL),max:1,connectionTimeoutMillis:10_000});
try {
  const result = await pool.query("UPDATE cards_private.workspace SET document = jsonb_set(document, '{sessions}', '{}'::jsonb, true), updated_at = now() WHERE id = 1");
  if (result.rowCount !== 1) throw new Error('Missing workspace');
  console.log('All workspace sessions revoked. Cards and contacts were preserved.');
} catch {
  console.error('Session revocation failed. Verify the updated database credentials and connectivity.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
