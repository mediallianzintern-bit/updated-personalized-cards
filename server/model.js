import { z } from 'zod';
import {typographyIds} from '../shared/typography.js';
import {socialPlatforms} from '../shared/profile.js';
const text = (max = 300) => z.string().trim().max(max);
const url = text(2000).refine(v => { if (!v) return true; try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; } }, 'Use a valid http or https URL');
const mediaUrl = z.string().regex(/^\/api\/media\/[a-f0-9-]{36}$/);
const image = z.string().max(3_000_000).refine(v => !v || /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(v), 'Upload a PNG, JPEG, or WebP image').or(mediaUrl);
export const sections = ['about', 'links', 'socials', 'contact','gallery','videos','files'];
export const profileSchema = z.object({
  name: text(100).min(1), title: text(150), company: text(100), slug: text(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens'),
  email: z.union([z.literal(''), z.string().email().max(254)]), phone: text(40), website: url, location: text(200),
  about: text(5000), photo: image, logo: image, cover: image,
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  buttonColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), photoPositionX: z.number().min(0).max(100).default(50), photoPositionY: z.number().min(0).max(100).default(50),
  logoBackground: z.enum(['light','dark','transparent','custom']).default('light'), logoBackgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'), logoSize: z.enum(['small','medium','large']).default('medium'),
  layout: z.enum(['classic', 'portrait', 'minimal', 'signature']), font: z.enum(typographyIds), radius: z.enum(['soft', 'square', 'round']),
  links: z.array(z.object({ id: text(80).min(1), title: text(120).min(1), description: text(250), thumbnail:image.optional(), url: url.refine(Boolean, 'Enter a URL'), icon: z.enum(['globe', 'calendar', 'file', 'video', 'link']), enabled: z.boolean() })).max(30),
  socials: z.array(z.object({ id: text(80).min(1), platform: z.enum(socialPlatforms), url: url.refine(Boolean, 'Enter a URL') })).max(40),
  gallery:z.array(z.object({id:text(80).min(1),title:text(160),image:image.refine(Boolean)})).max(12).optional(),
  videos:z.array(z.object({id:text(80).min(1),title:text(160),url:url.refine(Boolean),thumbnail:image.optional()})).max(12).optional(),
  files:z.array(z.object({id:text(80).min(1),title:text(160).min(1),name:text(160).regex(/^[^/\\]+$/),data:z.string().max(2800000).regex(/^data:(?:application\/(?:pdf|msword|vnd\.ms-powerpoint|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.(?:wordprocessingml\.document|presentationml\.presentation|spreadsheetml\.sheet))|text\/plain);base64,[A-Za-z0-9+/=]+$/).or(mediaUrl)})).max(8).optional(),
  sectionOrder: z.array(z.enum(sections)).min(4).max(7).refine(v => new Set(v).size === v.length && ['about','links','socials','contact'].every(s=>v.includes(s))),
  exchangeFlow: z.enum(['card-first','exchange-first']).default('card-first'),
  exchangeFields: z.object({phone:z.enum(['hidden','optional','required']).default('optional'),company:z.enum(['hidden','optional','required']).default('optional'),message:z.enum(['hidden','optional','required']).default('optional')}).default({}),
  saveLabel: text(40).min(1).default('Save Contact'), exchangeLabel: text(40).min(1).default('Exchange Contact'),
  customCtaEnabled: z.boolean().default(false), customCtaLabel: text(40).default(''), customCtaUrl: url.default(''),
  followUpStyle: z.enum(['classic','minimal','brand']).default('classic'),
  followUpButtonEnabled:z.boolean().default(false), followUpButtonLabel:text(40).default(''), followUpButtonUrl:url.default(''),
  followUpEnabled: z.boolean().default(false), followUpSubject: text(150).default(''), followUpMessage: text(2000).default(''),
  visibleSections: z.array(z.enum(sections)).max(7), exchangeEnabled: z.boolean(), saveEnabled: z.boolean(), showBranding: z.boolean(),
}).superRefine((profile,ctx)=>{
  if(profile.followUpButtonEnabled){
    if(!profile.followUpButtonLabel)ctx.addIssue({code:z.ZodIssueCode.custom,path:['followUpButtonLabel'],message:'Enter an email button label'});
    if(!profile.followUpButtonUrl)ctx.addIssue({code:z.ZodIssueCode.custom,path:['followUpButtonUrl'],message:'Enter an email button URL'});
  }
  if(profile.customCtaEnabled){
    if(!profile.customCtaLabel)ctx.addIssue({code:z.ZodIssueCode.custom,path:['customCtaLabel'],message:'Enter a button label'});
    if(!profile.customCtaUrl)ctx.addIssue({code:z.ZodIssueCode.custom,path:['customCtaUrl'],message:'Enter a destination URL'});
  }
});
export const leadSchema = z.object({ name: text(100).min(1), email: z.string().trim().email().max(254), phone: text(40).default(''), company: text(150).default(''), message: text(2000).default(''), consent: z.literal(true) });
export const seedProfile = {
  name: 'Dr. Prtiesh Patel', title: 'Founder', company: 'Mediallianz', slug: 'pritesh-patel', email: 'ppatel@mediallainz.com', phone: '+91 9892906989', website: 'https://mediallianz.com', location: '',
  about: 'Welcome to my digital card. I’m the founder of Mediallianz. Save my contact details or share yours below—let’s stay connected.',
  photo: '', logo: '', cover: '', accent: '#153b2e', background: '#f4f4ef', layout: 'classic', font: 'sans', radius: 'soft',
  links: [{id: 'website', title: 'Explore Mediallianz', description: 'Visit our company website', url: 'https://mediallianz.com', icon: 'globe', enabled: true}], socials: [],
  sectionOrder: sections, visibleSections: sections, exchangeEnabled: true, saveEnabled: true, showBranding: true,
};
export function vcard(p) {
  const esc = v => String(v || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(p.name)}`, `N:;${esc(p.name)};;;`, `ORG:${esc(p.company)}`, `TITLE:${esc(p.title)}`, `TEL;TYPE=CELL:${esc(p.phone)}`, `EMAIL:${esc(p.email)}`, `URL:${esc(p.website)}`, `ADR;TYPE=WORK:;;${esc(p.location)};;;;`, 'END:VCARD'];
  return lines.join('\r\n') + '\r\n';
}
export function csv(rows) {
  const safe = v => { const s = String(v ?? ''); return '"' + (/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'; };
  return '\uFEFF' + rows.map(row => row.map(safe).join(',')).join('\r\n');
}
