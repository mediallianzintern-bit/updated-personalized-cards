import { z } from 'zod';
export const sources = ['qr', 'nfc', 'link', 'direct', 'email-signature', 'virtual-background', 'other'];
export const eventSchema = z.object({
  type: z.enum(['view','link','share']),
  eventId: z.string().uuid().optional(),
  source: z.enum(sources).default('direct'),
  target: z.string().max(100).optional(),
});
export function deviceType(userAgent='') {
  if (!userAgent) return 'unknown';
  if (/ipad|tablet|android(?!.*mobile)/i.test(userAgent)) return 'tablet';
  if (/mobile|iphone|ipod/i.test(userAgent)) return 'mobile';
  if (/windows|macintosh|linux|cros/i.test(userAgent)) return 'desktop';
  return 'unknown';
}
export function sourceType(value) {return sources.includes(value) ? value : 'direct';}
export function buildInsights(db, cardId, period='30') {
  period=['7','30','all'].includes(String(period))?String(period):'30';
  const now=Date.now(),cutoff=period==='all'?0:now-Number(period)*86400_000;
  const events=db.events.filter(e=>Date.parse(e.at)>=cutoff&&Date.parse(e.at)<=now&&(!cardId||e.cardId===cardId));
  const leads=db.leads.filter(l=>Date.parse(l.createdAt)>=cutoff&&Date.parse(l.createdAt)<=now&&(!cardId||l.cardId===cardId));
  const views=events.filter(e=>e.type==='view'),clickEvents=events.filter(e=>e.type==='link');
  const breakdown={social:[],link:[],other:[]};
  const counts=new Map();
  for(const e of clickEvents){
    const card=db.cards.find(c=>c.id===e.cardId),profiles=[card?.published,card?.draft].filter(Boolean);
    const raw=e.target||'Unspecified link';
    let category='other',label=raw,target=raw;
    const social=profiles.flatMap(p=>p.socials||[]).find(s=>s.platform===raw||'social:'+s.platform===raw||'social:'+s.id===raw);
    const link=profiles.flatMap(p=>p.links||[]).find(l=>l.id===raw||'link:'+l.id===raw);
    if(raw.startsWith('social:')||social){category='social';label=social?.platform||raw.slice(7);target='social:'+label;}
    else if(raw.startsWith('link:')||link){category='link';label=link?.title||raw.slice(5);target='link:'+(link?.id||raw.slice(5));}
    else {for(const kind of ['gallery','video','file'])if(raw.startsWith(kind+':')){const field=kind==='gallery'?'gallery':kind+'s';const item=profiles.flatMap(p=>p[field]||[]).find(v=>v.id===raw.slice(kind.length+1));label=item?.title||`${kind[0].toUpperCase()+kind.slice(1)} interaction`;}}
    const key=JSON.stringify([e.cardId,category,target]);
    const row=counts.get(key)||{cardId:e.cardId,name:card?.draft.name||'Card',target,label,category,clicks:0};row.clicks++;counts.set(key,row);
  }
  for(const row of counts.values())breakdown[row.category].push(row);
  for(const group of Object.values(breakdown))group.sort((a,b)=>b.clicks-a.clicks||a.label.localeCompare(b.label));
  const chartDays=period==='7'?7:14;
  return { period,views:views.length,saves:events.filter(e=>e.type==='save').length,clicks:clickEvents.length,shares:events.filter(e=>e.type==='share').length,leads:leads.length,
    sources:[...sources,'unknown'].map(source=>({source,views:views.filter(e=>(e.source||'unknown')===source).length})),
    socialClicks:breakdown.social,linkClicks:breakdown.link,otherClicks:breakdown.other,
    days:Array.from({length:chartDays},(_,i)=>{const date=new Date(now-(chartDays-1-i)*86400_000).toISOString().slice(0,10);return {date,views:views.filter(e=>e.at.startsWith(date)).length}}),
    cards:db.cards.filter(c=>!cardId||c.id===cardId).map(c=>({id:c.id,name:c.draft.name,views:views.filter(e=>e.cardId===c.id).length,leads:leads.filter(l=>l.cardId===c.id).length})),
    recent:[...events].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,50).map(e=>({...e,name:db.cards.find(c=>c.id===e.cardId)?.draft.name||'Team card',source:e.source||'unknown',device:e.device||'unknown'})),
    updatedAt:new Date(now).toISOString(),
  };
}
