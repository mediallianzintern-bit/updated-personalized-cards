import fs from 'node:fs';

// Supabase's database CA is not in Node's default trust store.
// Source: Supabase Studio ssl:certificate_url (production certificate).
export function postgresConfig(connectionString) {
  const url = new URL(connectionString);
  const supabase = url.hostname.endsWith('.pooler.supabase.com') || /^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname);
  if (!supabase) return { connectionString };
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: {
      ca: fs.readFileSync(new URL('./certs/supabase-ca.crt', import.meta.url), 'utf8'),
      rejectUnauthorized: true,
    },
  };
}
