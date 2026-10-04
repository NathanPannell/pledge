import assets from './assets.generated.js';
import { cents, roundUp, convertUSD } from './money.js';
import { Ledger } from './ledger.js';
const now=()=>Math.floor(Date.now()/1000),uuid=()=>crypto.randomUUID();
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const providers=new Set(['OpenRouter','Demo']);
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
export async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
async function body(request){
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))fail('Use a JSON request.',415);
  const raw=await request.text();if(raw.length>8192)fail('Request too large.',413);
  try{return JSON.parse(raw);}catch{fail('Invalid request.');}
}
async function identity(request,env,create=false){
  const bearer=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)spare_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  let row;
  if(bearer)row=await env.DB.prepare('SELECT user_id FROM devices WHERE token_hash=? AND expires_at>?').bind(await hash(bearer),now()).first();
  else if(cookie)row=await env.DB.prepare('SELECT user_id FROM auth_sessions WHERE token_hash=? AND expires_at>?').bind(await hash(cookie),now()).first();
  if(row)return{userId:row.user_id};
  if(!create||bearer)fail('Connect Spare again to continue.',401);
  const value=token(),userId=uuid(),expires=now()+86400*365;
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users(id,created_at) VALUES(?,?)').bind(userId,now()),
    env.DB.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(await hash(value),userId,expires),
  ]);
  return{userId,cookie:`spare_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol==='https:'?'; Secure':''}`};
}
function csrf(request,env){
  if(request.headers.get('authorization')?.startsWith('Bearer '))return;
  const origin=request.headers.get('origin');
  if(!origin||![new URL(request.url).origin,env.APP_ORIGIN].includes(origin))fail('Open Spare to make this change.',403);
}
export async function stripe(env,path,params=null,idempotency=null){
  if(!/^(rk|sk)_test_/.test(env.STRIPE_API_KEY||''))fail('Stripe sandbox is not configured.',503);
  const headers={'Authorization':`Bearer ${env.STRIPE_API_KEY}`};
  if(params)headers['Content-Type']='application/x-www-form-urlencoded';
  if(idempotency)headers['Idempotency-Key']=idempotency;
  const response=await(env.STRIPE_FETCH??fetch)(`https://api.stripe.com/v1/${path}`,{method:params?'POST':'GET',headers,body:params?new URLSearchParams(params):undefined,signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok){console.error(JSON.stringify({service:'stripe',status:response.status,code:data.error?.code,type:data.error?.type,param:data.error?.param}));fail('Stripe could not open checkout. Your pledges are safe; try again.',502);}
  return data;
}
export async function verifySession(env,ledger,checkout){
  if(!checkout.stripe_session_id)return checkout;
  const s=await stripe(env,`checkout/sessions/${encodeURIComponent(checkout.stripe_session_id)}?expand[]=payment_intent`);
  const user=await ledger.stmt('SELECT customer_id FROM users WHERE id=?',checkout.user_id).first();
  if(s.livemode!==false||s.currency!=='cad'||s.amount_total!==checkout.amount_cents||s.metadata?.spare_checkout_id!==checkout.id||s.customer!==user.customer_id)fail('Payment details did not match. Your pledges have not been cleared.',409);
  if(s.payment_status==='paid'&&s.status==='complete'&&s.payment_intent?.status==='succeeded'&&s.payment_intent.amount_received===checkout.amount_cents&&s.payment_intent.currency==='cad'){
    await ledger.settle(checkout,now(),`session:${s.id}`);return{...checkout,status:'paid'};
  }
  if(s.status==='expired'){await ledger.expire(checkout);return{...checkout,status:'expired'};}
  return checkout;
}
let cachedRate=null;
async function fx(env){
  if(env.TEST_FX)return{rate:env.TEST_FX,date:'2026-10-02',source:'Bank of Canada daily benchmark'};
  if(cachedRate&&Date.now()-cachedRate.cachedAt<3600000)return cachedRate;
  try{
    const r=await fetch('https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1',{signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw new Error('FX unavailable');
    const x=await r.json(),last=x.observations.at(-1);
    if(!last?.FXUSDCAD?.v||Date.now()-Date.parse(last.d)>7*86400000)throw new Error('Stale FX');
    cachedRate={rate:last.FXUSDCAD.v,date:last.d,source:'Bank of Canada daily benchmark',cachedAt:Date.now()};return cachedRate;
  }catch{fail('Exchange rate unavailable. Enter the CAD total shown by your provider or bank.',503);}
}
async function api(request,env){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(path==='/api/health')return json({ok:true,payments:'sandbox',currency:'CAD',webhook_ready:!!env.STRIPE_WEBHOOK_SECRET});
  if(path==='/api/webhook'&&method==='POST')return webhook(request,env);
  if(path==='/api/pair/redeem'&&method==='POST'){
    const b=await body(request);if(!/^[a-f0-9]{64}$/.test(b.code||''))fail('Invalid connection code.');
    const codeHash=await hash(b.code),deviceToken=token(),t=now();
    const r=await env.DB.batch([
      env.DB.prepare('INSERT INTO devices(token_hash,user_id,expires_at) SELECT ?,user_id,? FROM pair_codes WHERE code_hash=? AND expires_at>? AND used_at IS NULL').bind(await hash(deviceToken),t+86400*90,codeHash,t),
      env.DB.prepare('UPDATE pair_codes SET used_at=? WHERE code_hash=? AND expires_at>? AND used_at IS NULL').bind(t,codeHash,t),
    ]);
    if(r[0].meta.changes!==1)fail('Connection code expired or already used. Get a new one in Spare.',409);
    return json({token:deviceToken});
  }
  const auth=await identity(request,env,path==='/api/state'&&method==='GET');
  const userId=auth.userId,ledger=new Ledger(env.DB);
  const reply=(x,status=200)=>json(x,status,auth.cookie?{'Set-Cookie':auth.cookie}:{});
  if(!['GET','HEAD'].includes(method))csrf(request,env);
  if(path==='/api/state'&&method==='GET'){
    let state=await ledger.state(userId);
    if(state.active?.stripe_session_id){await verifySession(env,ledger,state.active);state=await ledger.state(userId);}
    return reply({...state,active:state.active?{id:state.active.id,status:state.active.status,amount_cents:state.active.amount_cents}:null,sandbox:true});
  }
  if(path==='/api/fx'&&method==='GET')return reply(await fx(env));
  if(path==='/api/quote'&&method==='POST'){
    const b=await body(request);if(!providers.has(b.provider))fail('This provider is not supported yet.');
    if(typeof b.purchase_key!=='string'||!/^[a-zA-Z0-9:_-]{8,180}$/.test(b.purchase_key))fail('Missing purchase reference.');
    let cadCents,usdCents=null,label='CAD total entered by you',source='entered',date=null;
    if(b.cad_total!=null){cadCents=cents(b.cad_total);if(b.observed===true){source='observed';label='CAD total displayed by provider';}}
    else{
      usdCents=cents(b.usd_total);const rate=await fx(env),fee=b.fee_basis_points??250;
      cadCents=convertUSD(usdCents,rate.rate,fee);date=rate.date;source='estimated';label=`1 USD ≈ ${rate.rate} CAD · ${fee/100}% assumed card FX fee`;
    }
    const gift=roundUp(cadCents),id=uuid(),t=now();
    const previous=await ledger.stmt('SELECT * FROM quotes WHERE user_id=? AND purchase_key=?',userId,b.purchase_key).first();
    if(previous&&(previous.cad_cents!==cadCents||previous.provider!==b.provider||previous.source!==source))fail('This purchase already has a different quote. Use its original round-up or a new purchase reference.',409);
    if(!previous){
      const count=await ledger.stmt('SELECT COUNT(*) n FROM quotes WHERE user_id=? AND created_at>?',userId,t-86400).first();
      if(count.n>=200)fail('Too many quotes today. Try again tomorrow.',429);
      await ledger.stmt('INSERT INTO quotes(id,user_id,purchase_key,provider,source,usd_cents,cad_cents,gift_cents,fx_label,fx_date,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,purchase_key) DO NOTHING',id,userId,b.purchase_key,b.provider,source,usdCents,cadCents,gift,label,date,t,t+1800).run();
    }
    const q=await ledger.stmt('SELECT * FROM quotes WHERE user_id=? AND purchase_key=?',userId,b.purchase_key).first();
    if(q.cad_cents!==cadCents||q.provider!==b.provider||q.source!==source)fail('This purchase already has a different quote. Use its original round-up or a new purchase reference.',409);
    return reply({id:q.id,provider:q.provider,source:q.source,cad_cents:q.cad_cents,gift_cents:q.gift_cents,total_cents:q.cad_cents+q.gift_cents,fx_label:q.fx_label,fx_date:q.fx_date,expires_at:q.expires_at});
  }
  if(path==='/api/pledge'&&method==='POST'){
    const b=await body(request);if(typeof b.quote_id!=='string')fail('Choose a round-up first.');
    const r=await ledger.pledge(userId,b.quote_id,now());return reply({created:r.created,pending_cents:r.pending_cents,paid_cents:r.paid_cents,ready:r.pending_cents>=500});
  }
  if(path==='/api/checkout'&&method==='POST'){
    const checkout=await ledger.reserve(userId,now());
    if(checkout.stripe_session_id){
      const verified=await verifySession(env,ledger,checkout);
      if(verified.status==='paid')return reply({paid:true,amount_cents:verified.amount_cents});
      if(verified.status==='expired')fail('That checkout expired. Try again to open a fresh one.',409);
      return reply({id:checkout.id,url:checkout.stripe_url,amount_cents:checkout.amount_cents});
    }
    if(now()-checkout.created_at>1700)fail('Checkout needs reconciliation. Your pledges are preserved; contact the demo team.',409);
    let user=await ledger.stmt('SELECT * FROM users WHERE id=?',userId).first();
    if(!user.customer_id){
      const customer=await stripe(env,'customers',{'metadata[spare_user_id]':userId},`spare-customer:${userId}`);
      await ledger.stmt('UPDATE users SET customer_id=? WHERE id=? AND customer_id IS NULL',customer.id,userId).run();
      user=await ledger.stmt('SELECT * FROM users WHERE id=?',userId).first();
    }
    const origin=env.APP_ORIGIN||url.origin;
    const s=await stripe(env,'checkout/sessions',{
      mode:'payment',customer:user.customer_id,submit_type:'donate','adaptive_pricing[enabled]':'false',
      'payment_method_types[0]':'card','saved_payment_method_options[payment_method_save]':'enabled',
      'line_items[0][price_data][currency]':'cad','line_items[0][price_data][unit_amount]':String(checkout.amount_cents),
      'line_items[0][price_data][product_data][name]':'Spare — donation flow test',
      'line_items[0][price_data][product_data][description]':'Sandbox only. No real donation or tax receipt. Intended future charity: VGH & UBC Hospital Foundation.',
      'line_items[0][quantity]':'1','metadata[spare_checkout_id]':checkout.id,
      'payment_intent_data[metadata][spare_checkout_id]':checkout.id,
      success_url:`${origin}${env.ROUNDUPS_RETURN_PATH||'/'}?checkout=${checkout.id}`,cancel_url:`${origin}${env.ROUNDUPS_RETURN_PATH||'/'}?cancel=${checkout.id}`,expires_at:String(checkout.created_at+3600),
    },`spare-checkout:${checkout.id}`);
    if(s.livemode!==false||s.currency!=='cad'||s.amount_total!==checkout.amount_cents||!s.url?.startsWith('https://checkout.stripe.com/'))fail('Unexpected checkout response.',502);
    await ledger.attach(checkout,s);return reply({id:checkout.id,url:s.url,amount_cents:checkout.amount_cents});
  }
  if(path==='/api/checkout/status'&&method==='GET'){
    const checkout=await ledger.stmt('SELECT * FROM checkouts WHERE id=? AND user_id=?',url.searchParams.get('id'),userId).first();
    if(!checkout)fail('Checkout not found.',404);
    const result=checkout.status==='paid'?checkout:await verifySession(env,ledger,checkout);
    return reply({status:result.status,amount_cents:result.amount_cents,...await ledger.state(userId)});
  }
  if(path==='/api/checkout/cancel'&&method==='POST'){
    const b=await body(request),checkout=await ledger.stmt('SELECT * FROM checkouts WHERE id=? AND user_id=?',b.id,userId).first();
    if(!checkout)fail('Checkout not found.',404);
    let result=await verifySession(env,ledger,checkout);
    if(result.status==='open'){
      await stripe(env,`checkout/sessions/${checkout.stripe_session_id}/expire`,{},`spare-expire:${checkout.id}`);
      result=await verifySession(env,ledger,checkout);
    }
    return reply({status:result.status,amount_cents:result.amount_cents,...await ledger.state(userId)});
  }
  if(path==='/api/pair/code'&&method==='POST'){
    const code=token();await ledger.stmt('INSERT INTO pair_codes(code_hash,user_id,expires_at) VALUES(?,?,?)',await hash(code),userId,now()+300).run();
    return reply({code,expires_in:300});
  }
  if(path==='/api/device/revoke'&&method==='POST'){
    const bearer=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if(!bearer)fail('Use the extension to disconnect.',400);
    await ledger.stmt('DELETE FROM devices WHERE token_hash=? AND user_id=?',await hash(bearer),userId).run();
    return reply({disconnected:true});
  }
  if(path==='/api/demo/near-threshold'&&method==='POST'){
    const b=await body(request);if(!/^[a-f0-9-]{36}$/.test(b.run_id||''))fail('Invalid demo request.');
    const state=await ledger.state(userId);if(state.pending_cents>=500)return reply(state);
    const statements=[],t=now();
    for(let i=0;i<7;i++){
      const id=`demo:${b.run_id}:${i}`;
      statements.push(ledger.stmt("INSERT INTO quotes(id,user_id,purchase_key,provider,source,cad_cents,gift_cents,fx_label,created_at,expires_at) VALUES(?,?,?,'Demo','entered',3233,67,'Demo CAD total',?,?) ON CONFLICT DO NOTHING",id,userId,id,t,t+1800));
      statements.push(ledger.stmt('INSERT INTO pledges(id,quote_id,user_id,gift_cents,created_at) VALUES(?,?,?,67,?) ON CONFLICT DO NOTHING',id,id,userId,t));
    }
    await env.DB.batch(statements);return reply(await ledger.state(userId));
  }
  fail('Not found.',404);
}
async function webhook(request,env){
  if(!env.STRIPE_WEBHOOK_SECRET)fail('Webhook not configured.',503);
  const raw=await request.text();if(raw.length>65536)fail('Event too large.',413);
  const signature=request.headers.get('stripe-signature')||'',t=signature.match(/(?:^|,)t=(\d+)/)?.[1];
  const signatures=[...signature.matchAll(/(?:^|,)v1=([a-f0-9]{64})/g)].map(m=>m[1]);
  if(!t||Math.abs(now()-Number(t))>300||!signatures.length)fail('Invalid signature.',400);
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const expected=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${t}.${raw}`))),b=>b.toString(16).padStart(2,'0')).join('');
  if(!signatures.some(s=>{let diff=0;for(let i=0;i<64;i++)diff|=s.charCodeAt(i)^expected.charCodeAt(i);return diff===0;}))fail('Invalid signature.',400);
  const event=JSON.parse(raw);if(event.livemode!==false)fail('Sandbox events only.',400);
  if(['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.expired'].includes(event.type)){
    const ledger=new Ledger(env.DB),c=await ledger.stmt('SELECT * FROM checkouts WHERE stripe_session_id=?',event.data?.object?.id).first();
    if(c)await verifySession(env,ledger,c);
  }
  return json({received:true});
}
export default{
  async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get('origin');
    const cors=origin?.startsWith('chrome-extension://')?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'}:{};
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    let response;
    try{
      if(url.pathname.startsWith('/api/')){if(!env.DB)fail('Spare storage is unavailable. Please try again.',503);response=await api(request,env);}
      else{
        const asset=assets[url.pathname==='/'?'/index.html':url.pathname];if(!asset)return new Response('Not found',{status:404});
        response=new Response(Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache'}});
      }
    }catch(error){
      if(!error.status)console.error(JSON.stringify({service:'spare',error:'request_failed',type:error.name}));
      response=json({error:error.status?error.message:'Spare could not save this change. Your existing pledges are safe; try again.'},error.status||503);
    }
    const headers=new Headers(response.headers);for(const[k,v]of Object.entries(cors))headers.set(k,v);
    headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','same-origin');
    headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    return new Response(response.body,{status:response.status,headers});
  },
};
