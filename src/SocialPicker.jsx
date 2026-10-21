import React,{useState} from 'react';
import {Modal,Button,Field} from './components';
import SocialLogo from './SocialLogo';
import {socialPlatforms} from '../shared/profile';
export default function SocialPicker({onSelect,onClose}) {
 const [search,setSearch]=useState('');
 const matches=socialPlatforms.filter(p=>p.toLowerCase().includes(search.toLowerCase()));
 return <Modal title="Select social media" description="Choose a platform, then add your profile link." onClose={onClose}><Field label="Search social media" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search platforms…"/><div className="social-picker-list">{matches.map(platform=><Button key={platform} onClick={()=>onSelect(platform)}><SocialLogo platform={platform} size={26}/><span>{platform}</span><span aria-hidden="true">＋</span></Button>)}{!matches.length&&<p>No matching platforms.</p>}</div></Modal>;
}
