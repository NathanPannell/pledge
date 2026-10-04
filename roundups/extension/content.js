(async()=>{
  const send=async(message)=>{const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw new Error(r?.error||'Spare is unavailable.');return r.data;};
  const money=c=>`C$${(c/100).toFixed(2)}`;
  let context=await send({action:'context',provider:SpareDetector.providerFor(location.href)}).catch(()=>null),detected=null,shown=null,observerTimer=null,host=null,phase=null,offerRevision=0;
  function mount(){
    if(host)return host.shadowRoot;
    host=document.createElement('div');host.id='spare-extension-root';document.documentElement.append(host);const root=host.attachShadow({mode:'closed'});
    Object.defineProperty(host,'spareRoot',{value:root});
    const style=document.createElement('style');style.textContent=`@font-face{font-family:'DM Sans';src:url('${chrome.runtime.getURL('assets/dm-sans.woff2')}');font-weight:100 900;font-display:swap}@font-face{font-family:Newsreader;src:url('${chrome.runtime.getURL('assets/newsreader.woff2')}');font-weight:200 800;font-display:swap}:host{all:initial;position:fixed;z-index:2147483646;right:24px;bottom:24px;width:360px;max-width:calc(100vw - 32px);color:#182235;font-family:'DM Sans',sans-serif}*{box-sizing:border-box}.panel{background:#fff;padding:24px;border-radius:14px;box-shadow:0 10px 55px #17243c35,0 2px 8px #17243c15}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.brand{font-size:22px;font-weight:750;letter-spacing:-.03em}.dot{color:#e94732}h2{font:500 30px/1.12 Newsreader,Georgia,serif;letter-spacing:-.025em;margin:0}p{font-size:13px;line-height:1.6;color:#586378;margin:14px 0}strong{color:#182235}button{font:600 13px 'DM Sans',sans-serif;border:0;cursor:pointer;min-height:44px;border-radius:8px;touch-action:manipulation}.yes{width:100%;min-height:48px;padding:12px;margin-top:8px;background:#264dce;color:white}.yes:hover{background:#173baf}.quiet{width:100%;background:transparent;color:#586378;font-weight:400}.close{width:44px;background:transparent;color:#586378;font-size:23px}.small{font-size:11px}button:focus-visible,input:focus-visible{outline:3px solid #264dce;outline-offset:3px}button:disabled{opacity:.65;cursor:wait}.error{color:#9e3028}details{font-size:11px;color:#586378;margin-top:12px}summary{cursor:pointer;padding:10px 0;text-align:center;min-height:44px}input{font-size:16px;padding:10px;min-height:44px;width:100%;border:1px solid #bec8d8;border-radius:7px}label{display:block;font-size:12px;margin:12px 0}svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}`;root.append(style);
    const panel=document.createElement('section');panel.className='panel';panel.setAttribute('aria-label','Spare CAD round-up');root.append(panel);return root;
  }
  function panel(){return host.spareRoot.querySelector('.panel');}
  function close(){offerRevision++;host?.remove();host=null;phase=null;}
  function shell(body){mount();panel().innerHTML=`<div class="top"><span class="brand">spare<span class="dot">.</span></span><button class="close" aria-label="Dismiss round-up">×</button></div>${body}`;panel().querySelector('.close').onclick=close;}
  function error(e){const p=document.createElement('p');p.className='error';p.setAttribute('role','alert');p.textContent=e.message;panel().append(p);}
  async function offer(purchase){
    const revision=++offerRevision;phase='offer';if(host)panel().querySelector('.yes')?.setAttribute('disabled','');
    let q;try{q=await send({action:'quote',purchase});}catch(e){if(/connect once/.test(e.message))return;throw e;}
    if(revision!==offerRevision)return;
    if(!q.gift_cents){close();return;}
    const estimated=q.source==='estimated';
    shell(`<h2>${estimated?'Around':'Make it'} ${money(q.total_cents)}?</h2><p>Add <strong>${money(q.gift_cents)}</strong> to your pending<br>round-ups for <strong>VGH Foundation.</strong></p><p class="small">Nothing charged now. Donate when you reach C$5.<br>Sandbox prototype · no real donations.</p><button class="yes">Yes, add ${money(q.gift_cents)}</button><button class="quiet">No thanks</button><details><summary>${estimated?'Estimated CAD · change total':'Change CAD total'}</summary><p>${money(q.cad_cents)} ${estimated?'estimated':'entered'} total. ${estimated?'Assumes a 2.5% card FX fee; your actual bank charge can differ.':''}</p><label>Actual CAD total<input inputmode="decimal" value="${(q.cad_cents/100).toFixed(2)}"></label><button class="quiet update">Update amount</button></details>`);
    panel().querySelector('.quiet').onclick=close;
    panel().querySelector('.update').onclick=async()=>{try{await offer({provider:purchase.provider,cad_total:panel().querySelector('input').value});}catch(e){error(e);}};
    panel().querySelector('.yes').onclick=async()=>{
      const b=panel().querySelector('.yes');b.disabled=true;try{
        const r=await send({action:'pledge',quoteId:q.id});
        if(r.ready)ready(r.pending_cents);
        else{phase='saved';shell(`<h2>A little good, saved.</h2><p><strong>${money(q.gift_cents)}</strong> added.<br>${money(r.pending_cents)} pending · no money taken.</p><button class="yes">Done</button>`);panel().querySelector('.yes').onclick=close;}
      }catch(e){b.disabled=false;error(e);}
    };
  }
  function ready(total){phase='ready';shell(`<h2>Your spare change<br>is ready.</h2><p><strong>${money(total)}</strong> in pending round-ups.</p><p class="small">Stripe opens next. Confirm there.<br>Sandbox only · no real donation.</p><button class="yes">Yes, continue to Stripe</button><button class="quiet">Later</button>`);panel().querySelector('.quiet').onclick=close;panel().querySelector('.yes').onclick=async()=>{const b=panel().querySelector('.yes');b.disabled=true;try{await send({action:'checkout'});close();}catch(e){b.disabled=false;error(e);}};}
  async function scan(){
    const p=SpareDetector.detect(document,location.href,context);if(!p){if(phase==='offer')close();shown=null;return;}
    if(SpareDetector.providerFor(location.href))context=await send({action:'context',provider:p.provider}).catch(()=>context);
    const fingerprint=JSON.stringify(p);if(fingerprint===shown)return;shown=fingerprint;detected=p;
    const purchase={provider:p.provider,...(p.currency==='CAD'?{cad_total:p.total,observed:true}:{usd_total:p.total})};
    try{await offer(purchase);}catch(e){if(host)error(e);}
  }
  await scan();
  new MutationObserver(()=>{clearTimeout(observerTimer);observerTimer=setTimeout(scan,350);}).observe(document.body,{subtree:true,childList:true,characterData:true});
})();
