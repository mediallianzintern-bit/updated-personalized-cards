import FollowUpEditor from './FollowUpEditor';
import React, {useState,useRef,useEffect} from 'react';
import {Field,Toggle,ExchangeForm,Button} from './components';
import {ArrowLeft,ChevronRight,Eye,Link,Contact,Mail,Phone,Plus,CheckCircle,LayoutGrid,MousePointer,Globe,ExternalLink} from 'lucide-react';
import {cardUrl} from './lib';
import './card-settings.css';
function SettingToggle({icon:Icon,...props}){return <div className="settings-toggle"><Icon size={21} aria-hidden="true"/><Toggle {...props}/></div>}
function MenuRow({icon:Icon,title,description,onClick}){return <button type="button" className="settings-menu-row" onClick={onClick}><Icon size={21} aria-hidden="true"/><span><strong>{title}</strong>{description&&<small>{description}</small>}</span><ChevronRight size={20} aria-hidden="true"/></button>}
const titles={link:'Profile link',flow:'Interaction flow',form:'Exchange form',email:'Follow-up email',actions:'Customize call to action',publication:'Publication status'};
export default function CardSettings({profile:p,setProfile,publicUrl,published,onShare,onUnpublish}) {
  const [preview,setPreview]=useState(false),[page,setPage]=useState('');
  const heading=useRef(null),initial=useRef(true);
  useEffect(()=>{if(initial.current){initial.current=false;return;}heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'nearest'});},[page]);
  const set=(key,value)=>setProfile(current=>({...current,[key]:value}));
  return <div className="card-settings settings-clean">
    {page?<><div className="settings-toolbar"><button type="button" className="settings-back" onClick={()=>setPage('')}><ArrowLeft size={20}/>Settings</button>{page==='form'&&<Button onClick={()=>setPreview(true)}><Eye size={17}/>Preview form</Button>}</div><h2 ref={heading} tabIndex={-1}>{titles[page]}</h2></>:<>
      <h2 ref={heading} tabIndex={-1}>Settings</h2><p className="settings-intro">Make your card work your way.</p>
      <div className="settings-menu-group"><MenuRow icon={Link} title="Profile link" description={cardUrl(p.slug,publicUrl)} onClick={()=>setPage('link')}/></div>
      <div className="settings-menu-group"><h3>Contact capture</h3><p>Control how people connect with you.</p><MenuRow icon={Contact} title="Interaction flow" onClick={()=>setPage('flow')}/><MenuRow icon={LayoutGrid} title="Exchange contact form" onClick={()=>setPage('form')}/><MenuRow icon={Mail} title="Follow-up email" description="Prepare your message · sender not connected" onClick={()=>setPage('email')}/></div>
      <div className="settings-menu-group"><MenuRow icon={MousePointer} title="Customize call to action" onClick={()=>setPage('actions')}/></div>
      <div className="settings-menu-group"><SettingToggle icon={Globe} label="Show card branding" checked={p.showBranding} onChange={value=>set('showBranding',value)}/><MenuRow icon={ExternalLink} title="Publication status" description={published?'Your card is live':'Draft · not published'} onClick={()=>setPage('publication')}/></div>
    </>}
    {page==='link'&&<div className="settings-panel"><p>Customize the link to your public card.</p><Field label="Card URL" hint="Changing this link means old links and QR codes will need updating."><div className="slug-input"><span>/c/</span><input aria-label="Card URL" value={p.slug} onChange={e=>set('slug',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}/></div></Field><p className="settings-link">{cardUrl(p.slug,publicUrl)}</p><Button onClick={onShare}>Share published card</Button></div>}
    {page==='flow'&&<div className="settings-panel"><SettingToggle icon={Contact} label="Exchange contact" description="Let visitors share their details with you." checked={p.exchangeEnabled} onChange={v=>set('exchangeEnabled',v)}/><Field label="When someone opens your card" hint="Visitors can always close the form to view your card."><select value={p.exchangeFlow||'card-first'} disabled={!p.exchangeEnabled} onChange={e=>set('exchangeFlow',e.target.value)}><option value="card-first">Show my card first</option><option value="exchange-first">Open the exchange form first</option></select></Field></div>}
    {page==='form'&&<div className="settings-panel settings-exchange">
      <SettingToggle icon={Mail} description="Make email required to submit the form." label="Require email" checked={p.requireEmail!==false} onChange={v=>set('requireEmail',v)}/>
      <SettingToggle icon={Phone} description="Make a phone number required to submit the form." label="Require phone number" checked={p.exchangeFields?.phone==='required'} onChange={v=>set('exchangeFields',{...p.exchangeFields,phone:v?'required':'optional'})}/>
      <SettingToggle icon={Plus} label="Custom field" description="Ask visitors one additional question." checked={p.exchangeCustomEnabled??false} onChange={v=>set('exchangeCustomEnabled',v)}/>
      {p.exchangeCustomEnabled&&<><Field label="Custom field label" value={p.exchangeCustomLabel??'Additional information'} maxLength={100} required onChange={e=>set('exchangeCustomLabel',e.target.value)}/><Toggle label="Require custom field" checked={p.exchangeCustomRequired??false} onChange={v=>set('exchangeCustomRequired',v)}/></>}
      <SettingToggle icon={CheckCircle} label="Consent checkbox" description="Require visitors to confirm that you may contact them." checked={p.consentEnabled!==false} onChange={v=>set('consentEnabled',v)}/>
      <SettingToggle icon={LayoutGrid} label="Exchange detail widgets" description="Let visitors optionally share a photo, voice note or location." checked={p.exchangeWidgets??false} onChange={v=>set('exchangeWidgets',v)}/>
<details className="settings-more"><summary>More form fields</summary><p>Full name is always required. Choose which other details to collect.</p>      <div className="form-grid">{[['phone','Phone number'],['company','Company'],['message','Message']].map(([key,label])=><Field key={key} label={label}><select value={p.exchangeFields?.[key]||'optional'} onChange={e=>set('exchangeFields',{...p.exchangeFields,[key]:e.target.value})}><option value="optional">Optional</option><option value="required">Required</option><option value="hidden">Hidden</option></select></Field>)}</div>
</details>
    </div>}
    {page==='actions'&&<div className="settings-panel">      <Toggle label="Save contact" description="Allow visitors to download your contact details." checked={p.saveEnabled} onChange={value=>set('saveEnabled',value)}/>
      <div className="form-grid"><Field label="Save contact button" value={p.saveLabel??'Save Contact'} maxLength={40} required onChange={e=>set('saveLabel',e.target.value)}/><Field label="Exchange contact button" value={p.exchangeLabel??'Exchange Contact'} maxLength={40} required onChange={e=>set('exchangeLabel',e.target.value)}/></div>
      <Toggle label="Custom action button" description="Add a booking, website or other link." checked={p.customCtaEnabled??false} onChange={value=>set('customCtaEnabled',value)}/>
      {p.customCtaEnabled&&<div className="form-grid"><Field label="Button label" value={p.customCtaLabel||''} maxLength={40} required placeholder="Book a meeting" onChange={e=>set('customCtaLabel',e.target.value)}/><Field label="Destination URL" type="url" value={p.customCtaUrl||''} maxLength={2000} required placeholder="https://" onChange={e=>set('customCtaUrl',e.target.value)}/></div>}
</div>}
    {page==='email'&&<FollowUpEditor profile={p} setProfile={setProfile}/>}
    {page==='publication'&&<div className="settings-panel"><p>{published?'Your card is live. Taking it offline keeps your draft and connections.':'Your card is a draft. Use Publish changes to make it available.'}</p>{published&&<Button onClick={onUnpublish}>Take card offline</Button>}</div>}
    {preview&&<ExchangeForm profile={p} preview onClose={()=>setPreview(false)}/>}
  </div>;
}
