import React,{useState} from 'react';
import {Field} from './components';

const readFile=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Unable to read file.'));r.readAsDataURL(file)});
export function ExchangeWidgets({value,onChange,onError,preview}){
 const [loading,setLoading]=useState(false);
 async function upload(event,kind){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const allowed=kind==='photo'?['image/jpeg','image/png','image/webp']:['audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/x-m4a'];
  if(!allowed.includes(file.type)){onError('Choose a supported photo or audio file.');return;}
  if(file.size>(kind==='photo'?130000:260000)){onError(kind==='photo'?'Choose a photo under 130 KB.':'Choose a short voice note under 260 KB.');return;}
  try{onChange({...value,[kind]:await readFile(file)});onError('');}catch(e){onError(e.message)}
 }
 function locate(){
  if(preview){onError('Location sharing is available on the published card.');return;}
  if(!navigator.geolocation){onError('Location is unavailable in this browser.');return;}
  setLoading(true);navigator.geolocation.getCurrentPosition(pos=>{onChange({...value,location:{latitude:pos.coords.latitude,longitude:pos.coords.longitude}});setLoading(false)},()=>{onError('Location was not shared. You can continue without it.');setLoading(false)},{timeout:10000,maximumAge:0});
 }
 return <fieldset className="exchange-widgets"><legend>Remember this connection (optional)</legend><Field label="Photo · JPG, PNG or WebP, up to 130 KB"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>upload(e,'photo')}/></Field><Field label="Voice note · MP3, M4A, WAV, OGG or WebM, up to 260 KB"><input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,audio/webm" onChange={e=>upload(e,'voice')}/></Field>{value.photo&&<><img src={value.photo} alt="Photo to share" style={{maxWidth:160,maxHeight:140,objectFit:'contain'}}/><button type="button" onClick={()=>onChange({...value,photo:''})}>Remove photo</button></>}{value.voice&&<><audio controls src={value.voice}/><button type="button" onClick={()=>onChange({...value,voice:''})}>Remove voice note</button></>}<button type="button" className="button" disabled={loading} onClick={locate}>{loading?'Finding location…':value.location?'Update shared location':'Share my location'}</button>{value.location&&<><small>Location added: {value.location.latitude.toFixed(4)}, {value.location.longitude.toFixed(4)}</small><button type="button" onClick={()=>onChange({...value,location:null})}>Remove location</button></>}</fieldset>
}
export function LeadDetails({lead:l}){
 return <div className="lead-extras">{l.customValue&&<p><strong>{l.customLabel||'Additional information'}:</strong> {l.customValue}</p>}{l.photo&&<a href={l.photo} download="connection-photo"><img src={l.photo} alt="Photo shared by contact" style={{maxWidth:200,maxHeight:160,objectFit:'contain'}}/></a>}{l.voice&&<audio controls preload="none" src={l.voice}/ >}{l.location&&<a target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${l.location.latitude},${l.location.longitude}`}>View shared location</a>}<small>{l.consent?'Consent confirmed':'No consent checkbox confirmation recorded'}</small></div>
}
