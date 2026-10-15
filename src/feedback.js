const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
export async function feedback(request,env){
 const reply=(error,status=400)=>Response.json({error},{status,headers});
 if(request.method!=='POST')return reply('Method not allowed',405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return reply('Invalid origin',403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply('JSON required',415);
 try{
  const reader=request.body?.getReader();if(!reader)return reply('Missing body');
  let chunks=[],size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12000){await reader.cancel();return reply('Too large',413)}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const d=JSON.parse(new TextDecoder().decode(bytes));
  if(d.website)return Response.json({ok:true},{headers});
  const message=typeof d.message==='string'?d.message.trim():'';
  const email=typeof d.email==='string'?d.email.trim():'';
  if(!['suggestion','data','bug'].includes(d.category)||message.length<5||message.length>2000||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return reply('Invalid feedback');
  const ip=request.headers.get('CF-Connecting-IP')||'unknown';
  // A daily hash supports rate limiting without retaining raw IP addresses.
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(new Date().toISOString().slice(0,10)+':'+ip));
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const result=await env.FEEDBACK_DB.prepare(`INSERT INTO feedback (category,message,email,resort,language,ip_hash) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM feedback WHERE ip_hash=? AND created_at >= datetime('now','-1 hour')) < 3`).bind(d.category,message,email,typeof d.resort==='string'?d.resort.slice(0,50):'',d.language==='zh'?'zh':'en',hash,hash).run();
  if(!result.meta.changes)return reply('Too many submissions',429);
  return Response.json({ok:true},{status:201,headers});
 }catch(e){if(e instanceof SyntaxError)return reply('Invalid JSON');console.error('Feedback storage failed');return reply('Unable to save feedback',503)}
}
