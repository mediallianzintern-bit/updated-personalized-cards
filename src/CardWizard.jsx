import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, X, CheckCircle2, Palette, UserRound } from 'lucide-react';
import { Card, ImageUpload, Modal } from './components';
import './wizard.css';

const palettes = [['#153b2e','#153b2e'],['#111111','#ff6038'],['#1e326d','#f7ba18'],['#ffffff','#111111'],['#385b52','#93cdca'],['#731575','#ff4929'],['#e0f3fb','#566172'],['#304638','#328847']];
const titles = ['Add your name', 'Add the contact info', 'Add your role and company', 'Add a photo', 'Customize your branding'];
const codes = ['+91', '+1', '+44', '+61', '+971', '+65', '+49', '+33', '+81'];
const initialDraft = p => ({name:'',title:'',company:'',slug:'',email:'',phone:'',website:'',location:'',about:'',photo:'',logo:'',cover:'',font:'sans',radius:'soft',links:[],socials:[],sectionOrder:['about','links','socials','contact'],visibleSections:['about','links','socials','contact'],exchangeEnabled:true,saveEnabled:true,showBranding:true,...p,layout:'signature',background:'#ffffff',photoPositionX:p.photoPositionX??50,photoPositionY:p.photoPositionY??50,accent:p.accent||'#111111',buttonColor:p.buttonColor||'#153b2e'});

export default function CardWizard({initialProfile={},onComplete,onCancel,clientMode=false}) {
  const [profile,setProfile] = useState(()=>initialDraft(initialProfile));
  const nameParts = (initialProfile.name || '').trim().split(/\s+/);
  const [firstName,setFirstName] = useState(nameParts.shift() || '');
  const [lastName,setLastName] = useState(nameParts.join(' '));
  const initialCode = codes.find(c=>(initialProfile.phone || '').startsWith(c));
  const [countryCode,setCountryCode] = useState(initialCode || '+91');
  const [phone,setPhone] = useState(initialCode ? initialProfile.phone.slice(initialCode.length).trim() : initialProfile.phone || '');
  const [step,setStep] = useState(0), [busy,setBusy] = useState(false), [error,setError] = useState(''), [dirty,setDirty] = useState(false), [confirmCancel,setConfirmCancel] = useState(false), [saved,setSaved] = useState(null);
  const heading = useRef(null), form = useRef(null), submitting = useRef(false);
  const update = changes => {setProfile(p=>({...p,...changes}));setDirty(true);setError('');};
  useEffect(()=>{heading.current?.focus();},[step,saved]);
  useEffect(()=>{const warn=e=>{if(dirty&&!saved){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty,saved]);
  const changeName = (first,last) => {setFirstName(first);setLastName(last);update({name:[first.trim(),last.trim()].filter(Boolean).join(' ')});};
  const changePhone = (code,value) => {setCountryCode(code);setPhone(value);update({phone:value.trim()?`${code} ${value.trim()}`:''});};
  const cancel = () => {if(busy)return;if(dirty&&!saved)setConfirmCancel(true);else onCancel();};
  const next = () => {
    if(form.current&&!form.current.reportValidity())return;
    if(step===0 && !firstName.trim()){setError('Enter your first name.');return;}
    if(step===0 && profile.name.length>100){setError('Please keep the full name within 100 characters.');return;}
    if(step===1 && phone.trim() && !/^[+\d\s().-]{5,30}$/.test(phone.trim())){setError('Enter a valid phone number using digits, spaces, or dashes.');return;}
    if(step===2 && profile.website){try{const url=new URL(profile.website);if(!['http:','https:'].includes(url.protocol))throw Error();}catch{setError('Enter a full website address, such as https://mediallianz.com.');return;}}
    setError('');setStep(s=>s+1);
  };
  const finish = async () => {
    if(submitting.current)return;
    submitting.current=true;setBusy(true);setError('');
    try {
      const result=await onComplete({...profile,name:profile.name.trim(),email:profile.email.trim(),title:profile.title.trim(),company:profile.company.trim(),website:profile.website.trim()});
      if(!result)throw new Error('The card could not be saved. Please try again.');
      setSaved(result.profile || (result.name ? result : profile));setDirty(false);
    } catch(e){setError(e.message || 'Could not save your card. Please try again.');}
    finally{submitting.current=false;setBusy(false);}
  };
  const field = (label,key,props={}) => <label className="wizard-field"><span>{label}</span><input value={profile[key]} onChange={e=>update({[key]:e.target.value})} {...props}/></label>;
  const previewProfile = {...profile,name:profile.name || 'Your name'};
  if(saved)return <main className="card-wizard wizard-complete"><div className="wizard-success-card"><Card profile={saved} preview/></div><div className="wizard-complete-copy"><span className="wizard-success-icon"><CheckCircle2 size={26}/></span><h1 ref={heading} tabIndex={-1}>{clientMode?'Your card is ready.':'Your draft is saved.'}</h1><p>{clientMode?'Continue to your card to publish, share, or make changes.':'Return to the studio and publish when you’re ready to share.'}</p><button className="wizard-continue" onClick={onCancel}>{clientMode?'Continue to my card':'Back to workspace'}</button></div></main>;
  return <main className="card-wizard">
    <section className="wizard-form-panel" aria-label="Create your business card">
      <header className="wizard-header"><div>{step>0&&<button type="button" className="wizard-icon-button" aria-label="Previous step" disabled={busy} onClick={()=>{setError('');setStep(s=>s-1);}}><ArrowLeft size={23}/></button>}<strong>Create your business card</strong></div><button className="wizard-icon-button" type="button" aria-label="Close card creation" disabled={busy} onClick={cancel}><X size={21}/></button></header>
      <div className="wizard-progress-label"><span>{step<4?`Step ${step+1} of 4`:'Make it yours'}</span><span>{step<4?'Your details':'Branding'}</span></div>
      <div className="wizard-progress" role="progressbar" aria-label="Card setup progress" aria-valuemin={0} aria-valuemax={5} aria-valuenow={step+1} aria-valuetext={step<4?`Step ${step+1} of 4: ${titles[step]}`:'Customize your branding'}><span style={{width:`${(step+1)*20}%`}}/></div>
      <h1 ref={heading} tabIndex={-1}>{titles[step]}</h1>
      <p className="wizard-intro">{['Start with the name you want people to remember.','Make it easy for people to get in touch.','A little context makes every connection better.','Give your card a personal touch. A photo is optional.','Add your company logo and choose your colors.'][step]}</p>
      {step<3&&<form ref={form} onSubmit={e=>{e.preventDefault();next();}} className="wizard-fields">
        {step===0&&<><label className="wizard-field"><span>First name <small>(required)</small><span className="wizard-count">{firstName.length} / 50</span></span><input autoComplete="given-name" required maxLength={50} value={firstName} onChange={e=>changeName(e.target.value,lastName)}/></label><label className="wizard-field"><span>Last name<span className="wizard-count">{lastName.length} / 49</span></span><input autoComplete="family-name" maxLength={49} value={lastName} onChange={e=>changeName(firstName,e.target.value)}/></label></>}
        {step===1&&<>{field('Email (required)','email',{type:'email',required:true,maxLength:254,autoComplete:'email'})}<div className="wizard-phone"><label className="wizard-field"><span>Code</span><select aria-label="Country calling code" value={countryCode} onChange={e=>changePhone(e.target.value,phone)}>{codes.map(c=><option key={c} value={c}>{c==='+91'?'🇮🇳 ':''}{c}</option>)}<option value="">Other (include code)</option></select></label><label className="wizard-field"><span>Phone number</span><input type="tel" autoComplete="tel-national" maxLength={30} value={phone} onChange={e=>changePhone(countryCode,e.target.value)}/></label></div></>}
        {step===2&&<>{field('Job title','title',{maxLength:150,autoComplete:'organization-title'})}{field('Company','company',{maxLength:100,autoComplete:'organization'})}{field('Website','website',{type:'url',maxLength:2000,placeholder:'https://your-company.com',autoComplete:'url'})}</>}
        <button className="wizard-hidden-submit" tabIndex={-1} aria-hidden="true" type="submit">Continue</button>
      </form>}
      {step===3&&<div className="wizard-photo-step"><div className="wizard-photo-frame" style={{background:profile.accent,color:parseInt(profile.accent.slice(1),16)>0xbbbbbb?'#111111':'#ffffff'}}><div className="wizard-photo-crop">{profile.photo?<img src={profile.photo} alt="Your photo framing preview" style={{objectPosition:`${profile.photoPositionX}% ${profile.photoPositionY}%`}}/>:<UserRound size={110} strokeWidth={1}/>}</div><div className="wizard-photo-name"><strong>{profile.name}</strong><span>{profile.title}{profile.company&&<><br/>at {profile.company}</>}</span></div></div><ImageUpload label="Profile photo" value={profile.photo} onChange={photo=>update({photo})} onError={setError}/>{profile.photo&&<div className="wizard-framing"><p>Adjust how your photo fits on the card.</p><label>Horizontal position<input type="range" min="0" max="100" value={profile.photoPositionX} onChange={e=>update({photoPositionX:Number(e.target.value)})}/></label><label>Vertical position<input type="range" min="0" max="100" value={profile.photoPositionY} onChange={e=>update({photoPositionY:Number(e.target.value)})}/></label></div>}</div>}
      {step===4&&<div className="wizard-branding"><h2>Your logo</h2><ImageUpload label="Company logo" value={profile.logo} onChange={logo=>update({logo})} onError={setError}/><p className="wizard-hint">A PNG with a transparent background works best.</p><h2><Palette size={20}/>Profile colors</h2><label className="wizard-color"><span><strong>Primary color</strong><small>Goes on your card</small></span><input aria-label="Primary card color" type="color" value={profile.accent} onChange={e=>update({accent:e.target.value})}/></label><label className="wizard-color"><span><strong>Secondary color</strong><small>Goes on your contact button</small></span><input aria-label="Secondary button color" type="color" value={profile.buttonColor} onChange={e=>update({buttonColor:e.target.value})}/></label><p className="wizard-hint">Or choose a palette</p><div className="wizard-palettes" role="group" aria-label="Color palettes">{palettes.map(([accent,buttonColor],i)=><button key={accent} type="button" aria-label={`Palette ${i+1}: ${accent} and ${buttonColor}`} aria-pressed={profile.accent===accent&&profile.buttonColor===buttonColor} style={{background:`linear-gradient(135deg, ${accent} 50%, ${buttonColor} 50%)`}} onClick={()=>update({accent,buttonColor})}><span>{profile.accent===accent&&profile.buttonColor===buttonColor?<Check size={19}/>:i+1}</span></button>)}</div></div>}
      {error&&<p className="wizard-error" role="alert">{error}</p>}
      <button type="button" className="wizard-continue" disabled={busy} onClick={step===4?finish:next}>{busy?'Saving your card…':step===4?(clientMode?'Continue':'Save my card'):'Continue'}</button>
      {step===3&&!profile.photo&&<button type="button" className="wizard-skip" onClick={next}>Skip photo for now</button>}
      <p className="wizard-footnote">{step===4?(clientMode?'Next, create your account to save your card.':'Your card will be saved to your company workspace.'):'You can edit everything later.'}</p>
    </section>
    <aside className="wizard-preview-panel" aria-label="Live card preview"><div className="wizard-preview-heading"><span className="wizard-live-dot"/> LIVE PREVIEW</div><div className="wizard-preview-card"><Card profile={previewProfile} preview/></div><p>Your next introduction, made personal.</p></aside>
    {confirmCancel&&<Modal title="Leave card creation?" description="Your unsaved card details will be lost." onClose={()=>setConfirmCancel(false)}><div className="wizard-cancel-actions"><button type="button" className="wizard-continue" onClick={()=>setConfirmCancel(false)}>Keep editing</button><button type="button" className="wizard-discard" onClick={onCancel}>Discard and leave</button></div></Modal>}
  </main>;
}
