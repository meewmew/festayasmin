const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const error=(message,status=400)=>json({ok:false,error:message},status);
const encoder=new TextEncoder();
async function signature(text,secret){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(text))),b=>b.toString(16).padStart(2,'0')).join('');}
async function authorized(request,env){
 if(!env.SESSION_SECRET)return false;
 const cookie=request.headers.get('cookie')?.match(/(?:^|; )yas_session=([^;]+)/)?.[1]; if(!cookie)return false;
 const [expires,sig]=cookie.split('.');if(!/^\d+$/.test(expires)||Number(expires)<Date.now())return false;
 return sig===await signature(expires,env.SESSION_SECRET);
}
function sameOrigin(request){const origin=request.headers.get('Origin');return origin===new URL(request.url).origin;}
const pageAliases = new Map([
 ['/','/index.html'],
 ['/confirmar','/confirmar.html'],
 ['/confirmar/','/confirmar.html'],
 ['/yasmin','/admin.html'],
 ['/yasmin/','/admin.html'],
]);

async function serveAssets(request, env, url) {
 if (!env.ASSETS) return error('Os arquivos do convite estão indisponíveis.', 503);
 const path = pageAliases.get(url.pathname) ?? url.pathname;
 const assetUrl = new URL(url);
 assetUrl.pathname = path;
 const assetRequest = new Request(assetUrl, request);
 if (path === '/only-girl.mp3') assetRequest.headers.delete('Range');
 const asset = await env.ASSETS.fetch(assetRequest);
 if (asset.status === 404) {
  return new Response(request.method === 'HEAD' ? null : 'Página não encontrada', { status: 404 });
 }

 const headers = new Headers(asset.headers);
 headers.set('X-Content-Type-Options', 'nosniff');
 headers.set('Referrer-Policy', 'same-origin');
 headers.set('X-Frame-Options', 'SAMEORIGIN');
 if (path.endsWith('.html')) headers.set('Cache-Control', 'no-store');
 if (path === '/admin.html') headers.set('X-Robots-Tag', 'noindex, nofollow');
 if (path === '/only-girl.mp3' && asset.ok) return serveAudio(request, asset, headers);
 const response = new Response(asset.body, { status: asset.status, headers });
 if (request.method === 'GET' && asset.ok && (path === '/index.html' || path === '/confirmar.html')) {
  const imageUrl = new URL('/background.png', url).href;
  return new HTMLRewriter()
   .on('meta[property="og:image"]', { element(element) { element.setAttribute('content', imageUrl); } })
   .transform(response);
 }
 return response;
}

async function serveAudio(request, asset, headers) {
 headers.set('Accept-Ranges', 'bytes');
 const range = request.headers.get('Range')?.match(/^bytes=(\d*)-(\d*)$/);
 if (request.method === 'HEAD' || !range || (!range[1] && !range[2]) || asset.status !== 200) {
  return new Response(asset.body, { status: asset.status, headers });
 }

 // Workers Static Assets returns the complete file even for a byte-range request.
 const audio = new Uint8Array(await asset.arrayBuffer());
 const total = audio.length;
 const start = range[1] ? Number(range[1]) : Math.max(0, total - Number(range[2]));
 const end = range[1] && range[2] ? Math.min(total - 1, Number(range[2])) : total - 1;
 headers.delete('Content-Encoding');
 if (start > end || start >= total) {
  headers.set('Content-Range', 'bytes */' + total);
  headers.set('Content-Length', '0');
  return new Response(null, { status: 416, headers });
 }

 const bytes = audio.subarray(start, end + 1);
 headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + total);
 headers.set('Content-Length', String(bytes.byteLength));
 return new Response(bytes, { status: 206, headers });
}

async function handle(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(path.startsWith('/api/')&&request.method==='POST'&&!sameOrigin(request))return error('Origem inválida.',403);
 if(path==='/api/rsvp'&&request.method==='POST'){
  if(Number(request.headers.get('content-length')||0)>16000)return error('Envie no máximo 20 nomes.',413);
  const raw=await request.text();if(raw.length>16000)return error('Envie no máximo 20 nomes.',413);
  let data;try{data=JSON.parse(raw);}catch{return error('Dados inválidos.');}
  if(!data||typeof data!=='object'||!Array.isArray(data.names)||data.names.length<1||data.names.length>20)return error('Informe de 1 a 20 nomes.');
  if(data.names.some(n=>typeof n!=='string'||n.trim().length<1||n.trim().length>120||/[\x00-\x1f]/.test(n)))return error('Cada nome deve ter de 1 a 120 caracteres.');
  if(typeof data.idempotencyKey!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(data.idempotencyKey))return error('Reabra o formulário e tente novamente.');
  if(!env.DB)return error('A lista está indisponível. Tente novamente em instantes.',503);
  const names=data.names.map(n=>n.trim());
  const existing=await env.DB.prepare('SELECT names_json FROM rsvps WHERE id = ?').bind(data.idempotencyKey).first();
  if(existing){if(existing.names_json!==JSON.stringify(names))return error('Esta confirmação já foi utilizada. Reabra o formulário.',409);return json({ok:true});}
  await env.DB.prepare('INSERT OR IGNORE INTO rsvps (id, names_json, created_at) VALUES (?, ?, ?)').bind(data.idempotencyKey,JSON.stringify(names),new Date().toISOString()).run();
  return json({ok:true},201);
 }
 if(path==='/api/admin/login'&&request.method==='POST'){
  if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return error('Acesso da Yasmin ainda não configurado.',503);
  const raw=await request.text();if(raw.length>1000)return error('Senha inválida.',401);
  let data;try{data=JSON.parse(raw);}catch{return error('Dados inválidos.');}
  // Hash before comparison so length and input contents do not change comparison timing.
  const a=await signature(String(data?.password||''),env.SESSION_SECRET),b=await signature(env.ADMIN_PASSWORD,env.SESSION_SECRET);
  let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  if(diff)return error('Senha incorreta.',401);
  const expires=String(Date.now()+12*60*60*1000),sig=await signature(expires,env.SESSION_SECRET);
  return json({ok:true},200,{'Set-Cookie':`yas_session=${expires}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`});
 }
 if(path==='/api/admin/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':'yas_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
 if(path==='/api/admin/guests'&&request.method==='GET'){
  if(!await authorized(request,env))return error('Entre para ver os convidados.',401);
  if(!env.DB)return error('Lista indisponível.',503);
  const {results}=await env.DB.prepare('SELECT id, names_json, created_at FROM rsvps ORDER BY created_at DESC LIMIT 2000').all();
  return json({ok:true,groups:results.map(r=>({id:r.id,names:JSON.parse(r.names_json),createdAt:r.created_at}))});
 }
 if(path.startsWith('/api/'))return error('Página não encontrada.',404);
 if(!['GET','HEAD'].includes(request.method))return error('Método não permitido.',405);
 return serveAssets(request, env, url);
}

export default {
 async fetch(request, env) {
  try {
   return await handle(request, env);
  } catch (errorCause) {
   console.error('Request failed', errorCause.message);
   return error('Não foi possível salvar agora. Tente novamente.', 503);
  }
 },
};
