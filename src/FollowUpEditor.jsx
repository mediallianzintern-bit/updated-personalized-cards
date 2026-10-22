import React, {useState} from 'react';
import {Field,Toggle} from './components';
import {cardUrl} from './lib';
import {defaultFollowUpSubject,defaultFollowUpMessage,previewFollowUp} from '../shared/follow-up';
import './follow-up.css';

export default function FollowUpEditor({profile:p,setProfile}) {
  const [tab,setTab]=useState('templates');
  const set=(key,value)=>setProfile(v=>({...v,[key]:value}));
  const enable=value=>setProfile(v=>({...v,followUpEnabled:value,...(value?{followUpSubject:v.followUpSubject||defaultFollowUpSubject,followUpMessage:v.followUpMessage||defaultFollowUpMessage}:{})}));
  return <section className="editor-section follow-up-editor">
    <div className="section-title"><div><h3>Follow-up email</h3><p>A personal note for your next connection.</p></div></div>
    <p className="notice" role="note">Template only · Sender not connected. Automatic emails and test sends are unavailable until sender setup is complete.</p>
    <Toggle label="Prepare follow-up template" description="Save your design and message now; connect a sender later." checked={p.followUpEnabled??false} onChange={enable}/>
    {p.followUpEnabled&&<>
      <div className="follow-up-tabs" role="tablist" aria-label="Email editor">{[['templates','Templates'],['message','Message'],['button','Custom button']].map(([id,label])=><button type="button" role="tab" aria-selected={tab===id} aria-controls={`follow-up-${id}`} id={`follow-up-tab-${id}`} key={id} onClick={()=>setTab(id)}>{label}</button>)}</div>
      <div role="tabpanel" id={`follow-up-${tab}`} aria-labelledby={`follow-up-tab-${tab}`} className="follow-up-panel">
        {tab==='templates'&&<div className="follow-up-styles">{[['classic','Classic','Warm stationery'],['minimal','Minimal','Simple and clean'],['brand','Brand','Your brand colour']].map(([id,label,description])=><button type="button" aria-pressed={(p.followUpStyle||'classic')===id} key={id} onClick={()=>set('followUpStyle',id)}><strong>{label}</strong><small>{description}</small></button>)}</div>}
        {tab==='message'&&<><Field label="Email subject" value={p.followUpSubject||''} maxLength={150} onChange={e=>set('followUpSubject',e.target.value)}/><Field label="Email message"><textarea value={p.followUpMessage||''} rows={9} maxLength={2000} onChange={e=>set('followUpMessage',e.target.value)}/></Field><p className="follow-up-help">Personalize with {'{contact_first_name}'}, {'{sender_name}'} or {'{company}'}. Preview uses Alex as an example recipient.</p></>}
        {tab==='button'&&<><Toggle label="Email custom button" description="Add a booking or website link to this email." checked={p.followUpButtonEnabled??false} onChange={v=>set('followUpButtonEnabled',v)}/>{p.followUpButtonEnabled&&<><Field label="Email button label" maxLength={40} value={p.followUpButtonLabel||''} onChange={e=>set('followUpButtonLabel',e.target.value)} placeholder="Book a meeting"/><Field label="Email button URL" type="url" maxLength={2000} value={p.followUpButtonUrl||''} onChange={e=>set('followUpButtonUrl',e.target.value)} placeholder="https://"/></>}</>}
      </div>
      <p className="follow-up-preview-label">EMAIL PREVIEW · EXAMPLE RECIPIENT</p>
      <div className={`follow-up-preview follow-up-${p.followUpStyle||'classic'}`} style={{'--email-accent':p.accent}}>
        <article>
          <div className="follow-up-mini-card">{p.photo&&<img className="follow-up-photo" src={p.photo} alt="Profile portrait"/>}<div><strong>{p.name||'Your name'}</strong><span>{p.title}</span><span>{p.company}</span>{p.logo&&<img className="follow-up-logo" src={p.logo} alt="Company logo"/>}</div></div>
          <a href={cardUrl(p.slug)} target="_blank" rel="noopener noreferrer">View my profile ↗</a>
          <h4>{previewFollowUp(p.followUpSubject||'',p)||'Your email subject'}</h4>
          <p className="follow-up-message">{previewFollowUp(p.followUpMessage||'',p)||'Your message will appear here.'}</p>
          {p.followUpButtonEnabled&&<span className="follow-up-button-preview">{p.followUpButtonLabel||'Your button'}</span>}
          <div className="follow-up-signoff">{p.email&&<span>Email: {p.email}</span>}{p.phone&&<span>Phone: {p.phone}</span>}</div>
        </article>
      </div>
      <p className="follow-up-help">Use Save changes to save this template with your card. No email will be sent.</p>
    </>}
  </section>;
}
