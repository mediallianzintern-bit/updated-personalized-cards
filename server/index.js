import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');
const password = process.env.ADMIN_PASSWORD || '';
if (production && password.length < 12) { console.error('Set ADMIN_PASSWORD to at least 12 characters before running in production.'); process.exit(1); }
const app = createApp({dataDir:process.env.DATA_DIR || path.join(root,'data'),password,production,publicUrl:process.env.PUBLIC_URL || ''});
if (production) {
  app.use(express.static(path.join(root,'dist')));
  app.get('/{*path}', (req,res)=>res.sendFile(path.join(root,'dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({server:{middlewareMode:true,hmr:{host:'127.0.0.1',port:Number(process.env.PORT || 3000)+21678}},appType:'spa'});
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
app.listen(port,host,()=>console.log(`Mediallianz Cards: http://${host}:${port}\n${production ? 'Production mode. HTTPS reverse proxy required.' : 'Local workspace. Changes are saved to disk.'}`));
