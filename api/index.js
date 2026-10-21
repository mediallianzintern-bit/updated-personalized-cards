import {cloudApp} from '../server/cloud.js';
let app;
export default function handler(req,res) {
  try { app ??= cloudApp(); return app(req,res); }
  catch (error) { console.error('Cloud configuration:',error.message); res.statusCode=503; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({error:'Deployment setup is incomplete. Contact your administrator.'})); }
}
