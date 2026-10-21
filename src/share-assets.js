import QRCode from 'qrcode';

export const escapeHtml = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeImage = value => /^data:image\/(png|jpeg|webp);base64,/i.test(value || '') || /^https:\/\//i.test(value || '') ? value : '';
export function emailSignature(profile, url) {
  const logo = /^\/api\/media\/[a-f0-9-]{36}$/.test(profile.logo || '') ? new URL(profile.logo,url).href : safeImage(profile.logo);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;color:#153b2e"><tr><td style="border-left:4px solid #153b2e;padding:12px 18px">${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(profile.company)} logo" style="max-width:160px;max-height:60px;display:block;margin-bottom:12px">` : ''}<strong style="font-size:20px">${escapeHtml(profile.name)}</strong><br><span>${escapeHtml([profile.title, profile.company].filter(Boolean).join(' · '))}</span><br><span>${escapeHtml(profile.email)}</span><br><span>${escapeHtml(profile.phone)}</span><br><a href="${escapeHtml(url)}" style="color:#153b2e;display:inline-block;margin-top:12px">View my business card →</a></td></tr></table>`;
}
function loadImage(src) {
  return new Promise((resolve,reject) => { const image = new Image(); image.crossOrigin = 'anonymous'; image.onload=()=>resolve(image); image.onerror=()=>reject(new Error('Could not load company logo for export. Please upload a PNG, JPG or WebP logo.')); image.src=src; });
}
function drawFit(ctx,image,x,y,w,h) { const ratio=Math.min(w/image.width,h/image.height);ctx.drawImage(image,x+(w-image.width*ratio)/2,y+(h-image.height*ratio)/2,image.width*ratio,image.height*ratio); }
export async function virtualBackground(profile, url) {
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;const ctx=canvas.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,1920,1080);gradient.addColorStop(0,'#153b2e');gradient.addColorStop(1,'#2c5c46');ctx.fillStyle=gradient;ctx.fillRect(0,0,1920,1080);
  ctx.fillStyle='#ffffff0c';ctx.beginPath();ctx.arc(260,800,600,0,2*Math.PI);ctx.fill();
  ctx.fillStyle='#e4edce';ctx.font='bold 42px Arial';ctx.fillText((profile.company||'Let’s connect').slice(0,60),100,120,1300);
  ctx.fillStyle='#fff';ctx.font='bold 54px Arial';ctx.fillText(profile.name,100,880,1300);ctx.font='30px Arial';ctx.fillStyle='#dbe7da';ctx.fillText(profile.title||'',100,935,1300);
  ctx.fillStyle='#fff';ctx.fillRect(1450,650,370,340);
  const qr=await loadImage(await QRCode.toDataURL(url,{width:300,margin:2,errorCorrectionLevel:'M'}));ctx.drawImage(qr,1490,665,290,290);ctx.fillStyle='#153b2e';ctx.font='bold 22px Arial';ctx.fillText('SCAN TO CONNECT',1513,977);
  if(profile.logo){const logo=await loadImage(profile.logo);ctx.fillStyle='#fff';ctx.fillRect(1460,65,360,130);drawFit(ctx,logo,1480,80,320,100);}
  return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Unable to export background.')),'image/png')}catch{reject(new Error('This remote logo cannot be exported. Upload a local logo and try again.'))}});
}
export function saveBlob(blob, filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
