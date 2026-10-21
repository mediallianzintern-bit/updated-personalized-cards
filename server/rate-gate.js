import crypto from 'node:crypto';
// Shared database-backed limits work across Vercel instances.
export function rateGate(store) {
  return (req,res,next)=>{
    const route=req.originalUrl.split('?')[0];
    const sensitive=['/api/login','/api/client/login','/api/client/register'].includes(route);
    const upload=route==='/api/media/upload';
    const window=sensitive||upload?900000:60000;
    const limit=sensitive?10:upload?20:180;
    const now=Date.now(), group=sensitive?'auth':upload?'upload':'general';
    const key=crypto.createHash('sha256').update(`${group}:${req.ip}`).digest('hex');
    let blocked=false;
    store.update(db=>{
      const rates=db.rates??={};
      for(const [id,r] of Object.entries(rates)) if(r.until<=now) delete rates[id];
      const record=rates[key]??={count:0,until:now+window};
      blocked=++record.count>limit;
    });
    if(blocked)return res.set('Retry-After',String(Math.ceil(window/1000))).status(429).json({error:'Too many requests. Please try again later.'});
    next();
  };
}
