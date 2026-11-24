import SocialLogo from './SocialLogo';
import React, {useEffect,useState} from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ArrowUpRight, Check, Link as LinkIcon, Mail, MessageCircle, Share2, Image as ImageIcon, Wallet, Code, Megaphone, ChevronDown, Scissors } from 'lucide-react';
import { Modal, Button } from './components';
import { cardUrl } from './lib';
import { emailSignature, virtualBackground, saveBlob } from './share-assets';
import { campaignPresets, campaignUrl, normalizeCampaign, channelLinks } from '../shared/campaign.js';
import './share-assets.css';
const emptyTags={source:'',medium:'',campaign:'',content:'',term:''};
function ChannelLinks({links,slug,notify,onError,shortFor,onShorten}) {
  const [copied,setCopied]=useState(''),[busy,setBusy]=useState('');
  const shown=link=>shortFor(link)||link.url;
  async function shorten(link){setBusy(link.id);try{await onShorten(link)}catch(e){onError(e.message)}finally{setBusy('')}}
  async function copy(id,text,label){try{await navigator.clipboard.writeText(text);setCopied(id);notify?.(label)}catch{onError('Copy is unavailable. Select and copy the link instead.')}}
  async function downloadQr(link){try{const a=document.createElement('a');a.href=await QRCode.toDataURL(shown(link),{width:800,margin:3,errorCorrectionLevel:'M',color:{dark:'#153b2e',light:'#ffffff'}});a.download=`${slug}-${link.id}-qr.png`;a.click()}catch{onError('Could not generate the QR code.')}}
  return <div className="channel-links"><h4>Ready-to-share links for this campaign</h4><p>One link per channel, so Insights shows which one worked.</p>
    <ul>{links.map(link=><li key={link.id}><span><strong>{link.label}</strong><input aria-label={`${link.label} link`} value={shown(link)} readOnly onFocus={e=>e.target.select()}/></span>
      {onShorten&&!shortFor(link)&&<button type="button" className="channel-action" disabled={busy===link.id} aria-label={`Shorten ${link.label} link`} onClick={()=>shorten(link)}><Scissors size={15}/>{busy===link.id?'…':'Shorten'}</button>}
      {link.via==='qr'?<button type="button" className="channel-action" onClick={()=>downloadQr(link)}><Download size={15}/>QR</button>:<button type="button" className="channel-action" aria-label={`Copy ${link.label} link`} onClick={()=>copy(link.id,shown(link),`${link.label} link copied.`)}>{copied===link.id?<Check size={15}/>:<Copy size={15}/>}Copy</button>}</li>)}</ul>
    <button type="button" className="channel-copy-all" onClick={()=>copy('all',links.map(l=>`${l.label}: ${shown(l)}`).join('\n'),'All campaign links copied.')}>{copied==='all'?<Check size={15}/>:<Copy size={15}/>}Copy all {links.length} links</button></div>;
}
function CampaignBuilder({tags,setTags,open,setOpen,base,slug,notify,onError,shortFor,onShorten}) {
  const [advanced,setAdvanced]=useState(Boolean(tags.content||tags.term)),active=normalizeCampaign(tags),channels=channelLinks(base,active);
  const field=(key,label,placeholder)=><label className="campaign-field"><span>{label}</span><input value={tags[key]} maxLength={80} placeholder={placeholder} onChange={e=>setTags(v=>({...v,[key]:e.target.value}))}/></label>;
  return <section className="campaign-builder"><button type="button" className="campaign-toggle" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Megaphone size={17}/><span><strong>Track a campaign</strong><small>{active?`Tagging: ${[active.campaign,active.source].filter(Boolean).join(' · ')}`:'Optional · see which post, email or event brings visitors'}</small></span><ChevronDown size={17} className={open?'is-open':''}/></button>
    {open&&<div className="campaign-body"><div className="campaign-presets" role="group" aria-label="Campaign presets">{campaignPresets.map(p=><button type="button" key={p.id} className={tags.source===p.source&&tags.medium===p.medium?'selected':''} onClick={()=>setTags(v=>({...v,source:p.source,medium:p.medium}))}>{p.label}</button>)}</div>
    <div className="campaign-grid">{field('campaign','Campaign','e.g. workshop_nov_2026')}{field('source','Source','e.g. linkedin')}{field('medium','Medium','e.g. social')}</div>
    <button type="button" className="text-button" aria-expanded={advanced} onClick={()=>setAdvanced(v=>!v)}>{advanced?'Hide advanced':'Advanced'}</button>
    {advanced&&<div className="campaign-grid">{field('content','Content','e.g. banner_a')}{field('term','Term','e.g. business_cards')}</div>}
    <p>{active?'The QR code, links, email signature and virtual background below now carry this campaign.':'Add a campaign name or source to tag the links below.'} Spaces become underscores and letters are lowercased. Never put names, emails or phone numbers in tags.</p>
    {channels.length>0&&<ChannelLinks links={channels} slug={slug} notify={notify} onError={onError} shortFor={link=>shortFor(link.via||'link',{...active,source:link.source,medium:link.medium})} onShorten={onShorten&&(link=>onShorten(link.via||'link',{...active,source:link.source,medium:link.medium}))}/>}
    {active&&<button type="button" className="text-button" onClick={()=>setTags(emptyTags)}>Clear campaign</button>}</div>}</section>;
}
export default function Share({profile,publicUrl='',onClose,notify,campaigns=false,shorten}) {
  // The card's saved campaign is the starting point, so event QR codes need no retyping.
  const [tags,setTags]=useState(()=>({...emptyTags,campaign:campaigns&&profile.currentCampaign||''})),[campaignOpen,setCampaignOpen]=useState(false),active=campaigns?normalizeCampaign(tags):null;
  const [qr,setQr]=useState(''),[error,setError]=useState(''),[copied,setCopied]=useState(false),[channel,setChannel]=useState('link'),[busy,setBusy]=useState(false),[signatureOpen,setSignatureOpen]=useState(false);
  const base=cardUrl(profile.slug,publicUrl),tagged=via=>campaignUrl(base,via,active),url=tagged(channel),qrUrl=tagged('qr'),linkUrl=tagged('link'),local=/localhost|127\.0\.0\.1/.test(base);
  const signature=emailSignature(profile,tagged('email-signature')),message=`Connect with ${profile.name}: ${linkUrl}`;
  useEffect(()=>{let alive=true;QRCode.toDataURL(qrUrl,{width:800,margin:3,errorCorrectionLevel:'M',color:{dark:'#153b2e',light:'#ffffff'}}).then(v=>{if(alive)setQr(v)}).catch(()=>{if(alive)setError('Could not generate the QR code.')});return()=>{alive=false}},[qrUrl]);
  // Short links are created once per channel and campaign; the server returns the existing one when asked again.
  const [shorts,setShorts]=useState({}),[shortBusy,setShortBusy]=useState(false);
  const shortKey=(via,campaign)=>via+'|'+JSON.stringify(normalizeCampaign(campaign)||null);
  const shortFor=(via,campaign)=>shorts[shortKey(via,campaign)];
  async function makeShort(via,campaign){const key=shortKey(via,campaign);if(shorts[key])return shorts[key];const {path}=await shorten({via,campaign:normalizeCampaign(campaign)});const short=new URL(path,base).href;setShorts(v=>({...v,[key]:short}));return short}
  const shown=shortFor(channel,active)||url;
  async function shortenMain(){setShortBusy(true);setError('');try{const short=await makeShort(channel,active);await navigator.clipboard.writeText(short).catch(()=>{});setCopied(true);notify?.('Short link created and copied.')}catch(e){setError(e.message)}finally{setShortBusy(false)}}
  useEffect(()=>setCopied(false),[shown]);
  async function copy(){try{await navigator.clipboard.writeText(shown);setCopied(true);notify?.('Tagged card link copied.')}catch{setError('Copy is unavailable. Select and copy the link below.')}}
  async function background(){setBusy(true);setError('');try{saveBlob(await virtualBackground(profile,tagged('virtual-background')),`${profile.slug}${active?.campaign?'-'+active.campaign:''}-background.png`);notify?.('Virtual background downloaded.')}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function copySignature(){setError('');try{if(navigator.clipboard?.write && window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([signature],{type:'text/html'}),'text/plain':new Blob([message],{type:'text/plain'})})]);notify?.('Email signature copied. Paste into your email signature settings.')}else{await navigator.clipboard.writeText(signature);notify?.('Signature HTML copied. Paste into an HTML signature editor.')}}catch{setError('Clipboard access is unavailable. Download the HTML signature instead.')}}
  async function nativeShare(){try{if(navigator.share){await navigator.share({title:profile.name,text:`Connect with ${profile.name}`,url:linkUrl})}else{await navigator.clipboard.writeText(linkUrl);notify?.('Card link copied. Paste into the app of your choice.')}}catch(e){if(e.name!=='AbortError')setError('Sharing is unavailable. Copy the card link instead.')}}
  return <Modal title="Share your card." description={`Every introduction leads back to ${profile.name}.`} onClose={onClose}>
    <div className="share-brand">{profile.logo&&<img src={profile.logo} alt={`${profile.company} logo`}/>}<div><strong>{profile.name}</strong><span>{profile.company}</span></div></div>
    {campaigns&&<CampaignBuilder tags={tags} setTags={setTags} open={campaignOpen} setOpen={setCampaignOpen} base={base} slug={profile.slug} notify={notify} onError={setError} shortFor={shortFor} onShorten={shorten&&makeShort}/>}
    <div className="qr-panel">{qr?<img src={qr} alt={`QR code for ${profile.name}’s card`}/>:<p>Generating QR code…</p>}<strong>Scan to connect</strong><span>{active?`This QR code reports opens under “QR” and campaign “${active.campaign||active.source}”.`:'This QR code reports opens under “QR”.'}</span></div>
    <div className="share-channels" aria-label="Sharing channel">{[['link','Share link'],['qr','QR link'],['nfc','NFC link']].map(([key,label])=><button key={key} className={channel===key?'selected':''} aria-pressed={channel===key} onClick={()=>setChannel(key)}>{label}</button>)}</div>
    <div className="copy-input"><LinkIcon size={16}/><input aria-label="Shareable card link" value={shown} readOnly onFocus={e=>e.target.select()}/><button className="icon-button" onClick={copy} aria-label="Copy card link">{copied?<Check size={17}/>:<Copy size={17}/>}</button></div>
    {shorten&&!shortFor(channel,active)&&<button type="button" className="text-button shorten-link" disabled={shortBusy} onClick={shortenMain}><Scissors size={15}/>{shortBusy?'Shortening…':'Shorten this link'}</button>}
    <p className="share-source-note">{channel==='nfc'?'Write this URL to your NFC card using a tag writer. Opens will be labelled NFC.':'The source tag helps Insights separate QR, NFC, and shared-link opens.'} Forwarded links retain their tag; this measures page opens, not physical scans.</p>
    {local&&<p className="local-notice">Local preview link. Deploy this workspace and set PUBLIC_URL before sharing with other devices or printing QR codes.</p>}
    <div className="modal-actions"><Button onClick={()=>{const a=document.createElement('a');a.download=`${profile.slug}${active?.campaign?'-'+active.campaign:''}-qr.png`;a.href=qr;a.click()}} disabled={!qr}><Download size={16}/>Download QR</Button><a className="button primary" href={url} target="_blank" rel="noopener noreferrer">Open card<ArrowUpRight size={16}/></a></div>
    <section className="share-tools"><h3>Share your profile</h3><p>Choose an app to prepare a message. You choose the recipient and send it.</p><div className="share-app-grid">
      <a href={`mailto:?subject=${encodeURIComponent(`${profile.name} — business card`)}&body=${encodeURIComponent(message)}`}><Mail size={17}/>Email</a>
      <a href={`sms:?body=${encodeURIComponent(message)}`}><MessageCircle size={17}/>Text message</a>
      <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><SocialLogo platform="WhatsApp" size={20}/>WhatsApp</a>
      <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><SocialLogo platform="X" size={20}/>X</a>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(linkUrl)}`} target="_blank" rel="noopener noreferrer"><SocialLogo platform="LinkedIn" size={20}/>LinkedIn</a>
      <button onClick={nativeShare}><Share2 size={17}/>Another way</button>
    </div></section>
    <section className="share-tools"><h3>Bring your card everywhere</h3><Button onClick={background} disabled={busy}><ImageIcon size={17}/>{busy?'Creating background…':'Download virtual background'}</Button><p>A 1920 × 1080 PNG with your name, company logo and a scannable QR code for video calls.</p><Button onClick={()=>setSignatureOpen(v=>!v)} aria-expanded={signatureOpen}><Mail size={17}/>{signatureOpen?'Hide email signature':'Create email signature'}</Button>
    {signatureOpen&&<div className="signature-tools"><div className="signature-preview" dangerouslySetInnerHTML={{__html:signature}}/><div className="share-app-grid"><Button onClick={copySignature}><Copy size={16}/>Copy signature</Button><Button onClick={()=>saveBlob(new Blob([`<!doctype html><meta charset="utf-8"><title>Email signature</title>${signature}`],{type:'text/html'}),`${profile.slug}-signature.html`)}><Code size={16}/>Download HTML</Button></div><p>Paste into your email app’s signature settings. Some email apps remove embedded images; use a publicly hosted logo for best compatibility.</p></div>}
    </section>
    <div className="wallet-availability"><Wallet size={20}/><div><strong>Apple Wallet & Google Wallet</strong><p>Wallet passes are not connected yet. Your company must configure wallet issuer credentials before signed passes can be added. You can download the QR code now.</p></div></div>
    {error&&<p className="error" role="alert">{error}</p>}
  </Modal>;
}
