import FollowUpEditor from './FollowUpEditor';
import React, {useState} from 'react';
import {Field,Toggle,ExchangeForm} from './components';

export default function CardSettings({profile:p,setProfile}) {
  const [preview,setPreview]=useState(false);
  const set=(key,value)=>setProfile(current=>({...current,[key]:value}));
  return <div className="card-settings">
    <section className="editor-section">
      <div className="section-title"><div><h3>Contact capture</h3><p>Choose how visitors connect with you.</p></div></div>
      <Toggle label="Exchange contact" description="Let visitors share their details with you." checked={p.exchangeEnabled} onChange={value=>set('exchangeEnabled',value)}/>
      <Field label="Interaction flow" hint="Visitors can always close the form and view your card.">
        <select value={p.exchangeFlow||'card-first'} onChange={e=>set('exchangeFlow',e.target.value)} disabled={!p.exchangeEnabled}>
          <option value="card-first">Show my card first</option><option value="exchange-first">Open the exchange form first</option>
        </select>
      </Field>
      <h4>Exchange contact form</h4><button type="button" className="button" onClick={()=>setPreview(true)}>Preview form</button>
      <Toggle label="Require email" checked={p.requireEmail!==false} onChange={v=>set('requireEmail',v)}/>
      <Toggle label="Require phone number" checked={p.exchangeFields?.phone==='required'} onChange={v=>set('exchangeFields',{...p.exchangeFields,phone:v?'required':'optional'})}/>
      <Toggle label="Custom field" description="Ask visitors one additional question." checked={p.exchangeCustomEnabled??false} onChange={v=>set('exchangeCustomEnabled',v)}/>
      {p.exchangeCustomEnabled&&<><Field label="Custom field label" value={p.exchangeCustomLabel??'Additional information'} maxLength={100} required onChange={e=>set('exchangeCustomLabel',e.target.value)}/><Toggle label="Require custom field" checked={p.exchangeCustomRequired??false} onChange={v=>set('exchangeCustomRequired',v)}/></>}
      <Toggle label="Consent checkbox" description="Require visitors to confirm that you may contact them." checked={p.consentEnabled!==false} onChange={v=>set('consentEnabled',v)}/>
      <Toggle label="Exchange detail widgets" description="Let visitors optionally share a photo, voice note or location." checked={p.exchangeWidgets??false} onChange={v=>set('exchangeWidgets',v)}/>
      <p className="muted">Full name is always required. Attachments are visible only in your workspace.</p>
      <div className="form-grid">{[['phone','Phone number'],['company','Company'],['message','Message']].map(([key,label])=><Field key={key} label={label}><select value={p.exchangeFields?.[key]||'optional'} onChange={e=>set('exchangeFields',{...p.exchangeFields,[key]:e.target.value})}><option value="optional">Optional</option><option value="required">Required</option><option value="hidden">Hidden</option></select></Field>)}</div>
    </section>
    <section className="editor-section">
      <div className="section-title"><div><h3>Calls to action</h3><p>Personalize the buttons on your card.</p></div></div>
      <Toggle label="Save contact" description="Allow visitors to download your contact details." checked={p.saveEnabled} onChange={value=>set('saveEnabled',value)}/>
      <div className="form-grid"><Field label="Save contact button" value={p.saveLabel??'Save Contact'} maxLength={40} required onChange={e=>set('saveLabel',e.target.value)}/><Field label="Exchange contact button" value={p.exchangeLabel??'Exchange Contact'} maxLength={40} required onChange={e=>set('exchangeLabel',e.target.value)}/></div>
      <Toggle label="Custom action button" description="Add a booking, website or other link." checked={p.customCtaEnabled??false} onChange={value=>set('customCtaEnabled',value)}/>
      {p.customCtaEnabled&&<div className="form-grid"><Field label="Button label" value={p.customCtaLabel||''} maxLength={40} required placeholder="Book a meeting" onChange={e=>set('customCtaLabel',e.target.value)}/><Field label="Destination URL" type="url" value={p.customCtaUrl||''} maxLength={2000} required placeholder="https://" onChange={e=>set('customCtaUrl',e.target.value)}/></div>}
    </section>
    <FollowUpEditor profile={p} setProfile={setProfile}/>
    <section className="editor-section"><div className="section-title"><div><h3>Branding</h3><p>Control the footer shown on your public card.</p></div></div><Toggle label="Show card branding" checked={p.showBranding} onChange={value=>set('showBranding',value)}/></section>
    {preview&&<ExchangeForm profile={p} preview onClose={()=>setPreview(false)}/>}
  </div>;
}
