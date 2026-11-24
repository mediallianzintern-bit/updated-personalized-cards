// Campaign (UTM) tags are visitor-supplied labels: normalise them, never trust them as proof of a click.
export const campaignFields = ['source', 'medium', 'campaign', 'content', 'term'];
export const campaignPresets = [
  {id: 'linkedin', label: 'LinkedIn post', source: 'linkedin', medium: 'social'},
  {id: 'instagram', label: 'Instagram', source: 'instagram', medium: 'social'},
  {id: 'whatsapp', label: 'WhatsApp', source: 'whatsapp', medium: 'messaging'},
  {id: 'email', label: 'Email', source: 'newsletter', medium: 'email'},
  {id: 'event', label: 'Event QR', source: 'event', medium: 'offline', via: 'qr'},
];
const MAX_LENGTH = 80;
export function campaignValue(value) {
  const raw = String(value ?? '').trim();
  // Personal data does not belong in campaign tags; drop anything that looks like an email address.
  if (!raw || raw.includes('@')) return '';
  return raw.toLowerCase().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_.+-]/gu, '').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, MAX_LENGTH);
}
// Returns only approved, non-empty fields, or null when the input carries no source or campaign.
export function normalizeCampaign(input) {
  if (!input || typeof input !== 'object') return null;
  const campaign = {};
  for (const field of campaignFields) { const value = campaignValue(input[field]); if (value) campaign[field] = value; }
  return campaign.source || campaign.campaign ? campaign : null;
}
export function campaignFromSearch(search = '') {
  const params = new URLSearchParams(search);
  return normalizeCampaign(Object.fromEntries(campaignFields.map(field => [field, params.get('utm_' + field)])));
}
export function campaignUrl(base, via, campaign) {
  const url = new URL(base);
  if (via) url.searchParams.set('via', via);
  const tags = normalizeCampaign(campaign);
  if (tags) for (const field of campaignFields) if (tags[field]) url.searchParams.set('utm_' + field, tags[field]);
  return url.href;
}
// One link per preset channel for the same campaign, so each channel reports separately.
export function channelLinks(base, campaign) {
  const name = campaignValue(campaign?.campaign);
  if (!name) return [];
  return campaignPresets.map(preset => ({...preset, url: campaignUrl(base, preset.via || 'link', {...campaign, source: preset.source, medium: preset.medium})}));
}
export function campaignKey(campaign) {
  return campaign ? [campaign.campaign || '', campaign.source || '', campaign.medium || ''].join('|') : '';
}
// Outgoing links from a published card. Existing UTM tags on the destination always win.
export const outboundSource = 'mediallianz_card';
export const outboundMedium = 'digital_card';
export function outboundUrl(href, {campaign = '', slug = ''} = {}) {
  let url;
  try { url = new URL(href); } catch { return href; }
  if (!['http:', 'https:'].includes(url.protocol)) return href;
  if ([...url.searchParams.keys()].some(key => key.toLowerCase().startsWith('utm_'))) return href;
  url.searchParams.set('utm_source', outboundSource);
  url.searchParams.set('utm_medium', outboundMedium);
  const name = campaignValue(campaign);
  if (name) url.searchParams.set('utm_campaign', name);
  const content = campaignValue(slug);
  if (content) url.searchParams.set('utm_content', content);
  return url.href;
}
