export function sourceFromSearch(search='') {
  const params=new URLSearchParams(search);
  const raw=(params.get('via')||params.get('utm_medium')||'').toLowerCase();
  if(!raw)return 'direct';
  if(['qr','nfc','link','direct','email-signature','virtual-background'].includes(raw))return raw;
  return 'other';
}
export function sendCardEvent(slug,type,target) {
  const body=JSON.stringify({type,eventId:crypto.randomUUID(),source:sourceFromSearch(window.location.search),...(target?{target}: {})});
  // keepalive lets link clicks survive navigation. No cookies, IP addresses or fingerprints are added.
  return fetch(`/api/public/${slug}/events`,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
}
