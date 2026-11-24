import {campaignFromSearch,campaignFields} from '../shared/campaign.js';
export function sourceFromSearch(search='') {
  const params=new URLSearchParams(search);
  const raw=(params.get('via')||params.get('utm_medium')||'').toLowerCase();
  if(!raw)return 'direct';
  if(['qr','nfc','link','direct','email-signature','virtual-background'].includes(raw))return raw;
  return 'other';
}
// Campaign context lives only in the tagged URL of the open page: no storage, no visitor identifier.
export function currentCampaign(){return campaignFromSearch(window.location.search)}
export function campaignQuery(campaign=currentCampaign()){
  const params=new URLSearchParams();
  if(campaign)for(const field of campaignFields)if(campaign[field])params.set('utm_'+field,campaign[field]);
  return params.toString();
}
export function sendCardEvent(slug,type,target) {
  const campaign=currentCampaign();
  const body=JSON.stringify({type,eventId:crypto.randomUUID(),source:sourceFromSearch(window.location.search),...(target?{target}: {}),...(campaign?{campaign}:{})});
  // keepalive lets link clicks survive navigation. No cookies, IP addresses or fingerprints are added.
  return fetch(`/api/public/${slug}/events`,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
}
