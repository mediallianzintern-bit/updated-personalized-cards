import SocialLogo from './SocialLogo';
import React, {useEffect,useState} from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ArrowUpRight, Check, Link as LinkIcon, Mail, MessageCircle, Share2, Image as ImageIcon, Wallet, Code } from 'lucide-react';
import { Modal, Button } from './components';
import { cardUrl } from './lib';
import { emailSignature, virtualBackground, saveBlob } from './share-assets';
import './share-assets.css';
export default function Share({profile,publicUrl='',onClose,notify}) {
  const [qr,setQr]=useState(''),[error,setError]=useState(''),[copied,setCopied]=useState(false),[channel,setChannel]=useState('link'),[busy,setBusy]=useState(false),[signatureOpen,setSignatureOpen]=useState(false);
  const base=cardUrl(profile.slug,publicUrl),url=`${base}?via=${channel}`,qrUrl=`${base}?via=qr`,linkUrl=`${base}?via=link`,local=/localhost|127\.0\.0\.1/.test(base);
  const signature=emailSignature(profile,`${base}?via=email-signature`),message=`Connect with ${profile.name}: ${linkUrl}`;
  useEffect(()=>{let alive=true;QRCode.toDataURL(qrUrl,{width:800,margin:3,errorCorrectionLevel:'M',color:{dark:'#153b2e',light:'#ffffff'}}).then(v=>{if(alive)setQr(v)}).catch(()=>{if(alive)setError('Could not generate the QR code.')});return()=>{alive=false}},[qrUrl]);
  useEffect(()=>setCopied(false),[channel]);
  async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);notify?.('Tagged card link copied.')}catch{setError('Copy is unavailable. Select and copy the link below.')}}
  async function background(){setBusy(true);setError('');try{saveBlob(await virtualBackground(profile,`${base}?via=virtual-background`),`${profile.slug}-background.png`);notify?.('Virtual background downloaded.')}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function copySignature(){setError('');try{if(navigator.clipboard?.write && window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([signature],{type:'text/html'}),'text/plain':new Blob([message],{type:'text/plain'})})]);notify?.('Email signature copied. Paste into your email signature settings.')}else{await navigator.clipboard.writeText(signature);notify?.('Signature HTML copied. Paste into an HTML signature editor.')}}catch{setError('Clipboard access is unavailable. Download the HTML signature instead.')}}
  async function nativeShare(){try{if(navigator.share){await navigator.share({title:profile.name,text:`Connect with ${profile.name}`,url:linkUrl})}else{await navigator.clipboard.writeText(linkUrl);notify?.('Card link copied. Paste into the app of your choice.')}}catch(e){if(e.name!=='AbortError')setError('Sharing is unavailable. Copy the card link instead.')}}
  return <Modal title="Share your card." description={`Every introduction leads back to ${profile.name}.`} onClose={onClose}>
    <div className="share-brand">{profile.logo&&<img src={profile.logo} alt={`${profile.company} logo`}/>}<div><strong>{profile.name}</strong><span>{profile.company}</span></div></div>
    <div className="qr-panel">{qr?<img src={qr} alt={`QR code for ${profile.name}’s card`}/>:<p>Generating QR code…</p>}<strong>Scan to connect</strong><span>This QR code reports opens under “QR”.</span></div>
    <div className="share-channels" aria-label="Sharing channel">{[['link','Share link'],['qr','QR link'],['nfc','NFC link']].map(([key,label])=><button key={key} className={channel===key?'selected':''} aria-pressed={channel===key} onClick={()=>setChannel(key)}>{label}</button>)}</div>
    <div className="copy-input"><LinkIcon size={16}/><input aria-label="Shareable card link" value={url} readOnly onFocus={e=>e.target.select()}/><button className="icon-button" onClick={copy} aria-label="Copy card link">{copied?<Check size={17}/>:<Copy size={17}/>}</button></div>
    <p className="share-source-note">{channel==='nfc'?'Write this URL to your NFC card using a tag writer. Opens will be labelled NFC.':'The source tag helps Insights separate QR, NFC, and shared-link opens.'} Forwarded links retain their tag; this measures page opens, not physical scans.</p>
    {local&&<p className="local-notice">Local preview link. Deploy this workspace and set PUBLIC_URL before sharing with other devices or printing QR codes.</p>}
    <div className="modal-actions"><Button onClick={()=>{const a=document.createElement('a');a.download=`${profile.slug}-qr.png`;a.href=qr;a.click()}} disabled={!qr}><Download size={16}/>Download QR</Button><a className="button primary" href={url} target="_blank" rel="noopener noreferrer">Open card<ArrowUpRight size={16}/></a></div>
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
