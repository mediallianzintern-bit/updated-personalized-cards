let configuration;

export async function prepareCloudBody(body) {
  const uploaded = new Map(); // Never reuse an upload across signed-in accounts.
  if (!body.includes('data:')) return body;
  configuration ??= fetch('/api/config').then(async response => {
    if (!response.ok) throw new Error('Unable to check upload settings. Please try again.');
    return response.json();
  }).catch(error => { configuration = null; throw error; });
  if (!(await configuration).cloudMedia) return body;
  async function visit(value) {
    if (typeof value === 'string' && /^data:[^;]+;base64,/.test(value)) {
      if (uploaded.has(value)) return uploaded.get(value);
      const blob=await fetch(value).then(r=>r.blob());
      const response=await fetch('/api/media/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:blob.type,size:blob.size})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'Unable to prepare upload.');
      const upload=await fetch(result.url,{method:'PUT',headers:{'Content-Type':blob.type,'x-upsert':'false'},body:blob});
      if(!upload.ok)throw new Error('File upload failed. Please try again.');
      const completion=await fetch('/api/media/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference:result.reference})});
      if(!completion.ok){const failure=await completion.json().catch(()=>({}));throw new Error(failure.error||'Unable to verify the uploaded file.');}
      uploaded.set(value,result.reference);return result.reference;
    }
    if(Array.isArray(value)){const out=[];for(const item of value)out.push(await visit(item));return out;}
    if(value&&typeof value==='object'){const out={};for(const [key,item]of Object.entries(value))out[key]=await visit(item);return out;}
    return value;
  }
  return JSON.stringify(await visit(JSON.parse(body)));
}
