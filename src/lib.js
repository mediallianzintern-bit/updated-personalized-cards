import {prepareCloudBody} from './cloud-media.js';
export async function api(path, options = {}) {
  if (typeof options.body === 'string') options = {...options,body:await prepareCloudBody(options.body)};
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}). Please try again.`);
  return data;
}
export const initials = name => name.replace(/^dr\.?\s*/i, '').split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase();
export const uid = () => crypto.randomUUID();
export const download = (content, filename, type) => { const url = URL.createObjectURL(new Blob([content], {type})); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); };
export const cardUrl = (slug, base = '') => `${base.replace(/\/$/,'') || window.location.origin}/c/${slug}`;
export const readableDate = value => new Date(value).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'});
