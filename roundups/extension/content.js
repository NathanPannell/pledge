(async()=>{
  const send=async(message)=>{const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw new Error(r?.error||'Pledge is unavailable.');return r.data;};
  const money=c=>`C$${(c/100).toFixed(2)}`;
  const GOAL=500; // round-ups are given once they reach C$5
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let context=await send({action:'context',provider:SpareDetector.providerFor(location.href)}).catch(()=>null),detected=null,shown=null,observerTimer=null,host=null,phase=null,offerRevision=0;

  // The panel lives in a closed shadow root so the page's styles can't reach it.
  // It uses Pledge's design system: Figtree, navy actions, teal for money given.
  const MARK='<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#19486a"/><path d="M10 7.5v17" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="13.5" r="6" fill="none" stroke="#fff" stroke-width="2.6"/><path class="share" pathLength="1" d="M20.6 9.64A6 6 0 0 1 20.6 17.36" fill="none" stroke="#5fd6c4" stroke-width="2.8" stroke-linecap="round"/></svg>';
  const SPRING='cubic-bezier(.34,1.56,.64,1)',OUT='cubic-bezier(.2,.8,.2,1)';
  const STYLE=`@font-face{font-family:Figtree;src:url('${chrome.runtime.getURL('assets/figtree.woff2')}') format('woff2');font-weight:400 800;font-display:block}
:host{all:initial;position:fixed;z-index:2147483646;right:24px;bottom:24px;width:360px;max-width:calc(100vw - 32px);color:#1d2126;font:400 14px/1.5 Figtree,'Segoe UI',system-ui,sans-serif}
*{box-sizing:border-box}
.panel{position:relative;background:#fff;border:1px solid #e4e1db;border-radius:18px;padding:16px 20px 20px;box-shadow:0 1px 2px rgba(15,34,53,.06),0 4px 12px rgba(15,34,53,.07);transform-origin:bottom right;animation:in .6s ${SPRING} backwards}
@keyframes in{from{opacity:0;transform:translateY(24px) scale(.95)}}
.panel.out{animation:out .25s ease-in forwards}
@keyframes out{to{opacity:0;transform:translateY(16px) scale(.97)}}
.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.brand{display:inline-flex;align-items:center;gap:8px;font-weight:750;font-size:16px;letter-spacing:-.02em}
.brand svg{width:24px;height:24px}
.share{stroke-dasharray:1;stroke-dashoffset:0;animation:draw .9s .3s ${OUT} backwards}
@keyframes draw{from{stroke-dashoffset:1}}
.close{width:34px;height:34px;border:0;border-radius:50%;background:transparent;color:#868b91;font-size:21px;line-height:1;cursor:pointer;transition:transform .35s ${SPRING},background .2s,color .2s}
.close:hover{transform:rotate(90deg);background:#f6f5f2;color:#1d2126}
.body{display:grid;gap:12px}
.body>*{animation:rise .5s ${OUT} backwards;animation-delay:calc(var(--i,0)*60ms)}
@keyframes rise{from{opacity:0;transform:translateY(10px)}}
.eyebrow{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#0e7f72}
h2{margin:0;font-size:22px;line-height:1.15;font-weight:750;letter-spacing:-.02em;color:#1d2126}
.amounts{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.was{color:#868b91;text-decoration:line-through;text-decoration-color:#cfcbc3;font-variant-numeric:tabular-nums}
.now{font-size:34px;font-weight:800;letter-spacing:-.03em;line-height:1;color:#0b5e54;font-variant-numeric:tabular-nums}
.chip{padding:2px 9px;border-radius:999px;background:#e3f2ef;color:#0b5e54;font-weight:750;font-size:12.5px;animation:pop .6s .7s ${SPRING} backwards}
@keyframes pop{from{opacity:0;transform:scale(.5)}}
p{margin:0;color:#555b62;font-size:13.5px;line-height:1.5}
strong{color:#1d2126}
.small{font-size:11.5px;color:#868b91}
button{font:inherit}
.yes{width:100%;min-height:46px;border:0;border-radius:11px;background:#0e7f72;color:#fff;font-weight:700;font-size:14px;cursor:pointer;transition:background .15s,transform .25s ${OUT};touch-action:manipulation}
.yes:hover{background:#0b7a6c;transform:translateY(-1px)}
.yes:active{transform:scale(.97)}
.breathe{animation:rise .5s ${OUT} backwards,breathe 2.8s ease-in-out 1s infinite}
@keyframes breathe{0%,100%{box-shadow:0 0 0 0 rgba(14,127,114,.3)}50%{box-shadow:0 0 0 4px rgba(14,127,114,0)}}
.no{width:100%;min-height:38px;border:0;border-radius:10px;background:transparent;color:#555b62;cursor:pointer;transition:background .2s,color .2s}
.no:hover{background:#f6f5f2;color:#1d2126}
button:disabled{opacity:.6;cursor:wait}
button:focus-visible,input:focus-visible{outline:3px solid rgba(25,72,106,.35);outline-offset:2px}
.jar{display:flex;justify-content:space-between;font-size:12.5px;color:#555b62;font-variant-numeric:tabular-nums}
.bar{position:relative;height:10px;border-radius:999px;background:#ecebe7;overflow:hidden}
.bar i{position:absolute;inset:0 auto 0 0;width:calc(var(--p,0)*100%);border-radius:999px;background:linear-gradient(90deg,#1fa392,#0e7f72);transition:width 1s ${OUT}}
.bar.full i::after{content:'';position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);transform:translateX(-100%);animation:sheen 1.6s .8s ease-in-out infinite}
@keyframes sheen{to{transform:translateX(100%)}}
.bank{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.pig{display:inline-flex}
.pig.hero{justify-self:start;padding-top:12px}
details{font-size:12.5px;color:#555b62;border-top:1px solid #e4e1db;padding-top:2px}
summary{cursor:pointer;padding:8px 0;min-height:36px;list-style:none;display:flex;justify-content:space-between;color:#19486a;font-weight:650}
summary::-webkit-details-marker{display:none}
summary::after{content:'+';color:#868b91;transition:transform .3s ${SPRING}}
details[open] summary::after{transform:rotate(45deg)}
details[open] .fix{animation:rise .4s ${OUT}}
.fix{display:grid;gap:8px;padding-bottom:4px}
label{display:grid;gap:6px;font-size:12.5px;font-weight:600;color:#1d2126}
input{font:inherit;font-size:15px;padding:9px 11px;min-height:42px;width:100%;border:1px solid #cfcbc3;border-radius:10px;color:#1d2126;background:#fff}
input:focus{outline:none;border-color:#19486a;box-shadow:0 0 0 3px rgba(25,72,106,.18)}
.update{width:100%;min-height:40px;border:1px solid #cfcbc3;border-radius:10px;background:#fff;color:#1d2126;cursor:pointer;font-weight:650}
.update:hover{background:#f6f5f2}
.error{color:#b4351f;font-size:12.5px;animation:rise .3s ${OUT}}
.particle{position:absolute;z-index:5;pointer-events:none;border-radius:50%}
.particle svg{display:block;width:100%;height:100%}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.001ms!important}}`;

  function mount(){
    if(host)return host.shadowRoot;
    host=document.createElement('div');host.id='spare-extension-root';document.documentElement.append(host);const root=host.attachShadow({mode:'closed'});
    Object.defineProperty(host,'spareRoot',{value:root});
    const style=document.createElement('style');style.textContent=STYLE;root.append(style);
    const panel=document.createElement('section');panel.className='panel';panel.setAttribute('aria-label','Pledge round-up');root.append(panel);return root;
  }
  function panel(){return host.spareRoot.querySelector('.panel');}
  // The panel slips away before it's removed.
  function close(){
    offerRevision++;const old=host;host=null;phase=null;
    if(!old)return;
    const p=old.spareRoot.querySelector('.panel');
    if(reduce||!p){old.remove();return;}
    p.classList.add('out');setTimeout(()=>old.remove(),260);
  }
  function shell(body){
    mount();panel().innerHTML=`<div class="top"><span class="brand">${MARK}Pledge</span><button class="close" aria-label="Dismiss round-up">×</button></div><div class="body">${body}</div>`;
    [...panel().querySelector('.body').children].forEach((el,i)=>el.style.setProperty('--i',i));
    panel().querySelector('.close').onclick=close;
  }
  function error(e){const p=document.createElement('p');p.className='error';p.setAttribute('role','alert');p.textContent=e.message;panel().querySelector('.body').append(p);}

  // Rolls a money figure from one value to another.
  function tween(el,from,to,ms,delay=0){
    el.textContent=money(from);
    if(reduce||from===to){el.textContent=money(to);return;}
    setTimeout(()=>{const start=performance.now();const step=now=>{const p=Math.min(1,(now-start)/ms);el.textContent=money(Math.round(from+(to-from)*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);setTimeout(()=>{el.textContent=money(to);},ms+150);},delay);
  }
  function fill(bar,from,to){
    bar.style.setProperty('--p',String(Math.min(1,from/GOAL)));
    requestAnimationFrame(()=>requestAnimationFrame(()=>bar.style.setProperty('--p',String(Math.min(1,to/GOAL)))));
    bar.classList.toggle('full',to>=GOAL);
  }
  // The piggy bank that holds your round-ups (piggy.js), in the panel's .pig slot.
  function piggy(size){const p=PledgePiggy.create(size);panel().querySelector('.pig').append(p.el);return p;}
  // Coins drop in, then the total and bar catch up, if the panel still shows this phase.
  function deposit(pig,at,before,after,amount){
    const live=()=>phase===at&&host;
    setTimeout(async()=>{if(!live())return;await pig.add(after/GOAL,3);if(!live())return;
      tween(amount,before,after,900);fill(panel().querySelector('.bar'),before,after);
      setTimeout(()=>{if(live())burst(pig.el);},700);},350);
  }
  // Hearts and dots thrown out from an element inside the panel.
  function burst(from){
    if(reduce)return;const p0=panel(),box=from.getBoundingClientRect(),base=p0.getBoundingClientRect();
    const colors=['#0e7f72','#1fa392','#5fd6c4','#19486a','#e3a43a'];
    for(let i=0;i<14;i++){
      const p=document.createElement('span'),heart=i%3===0,size=heart?12+Math.random()*6:5+Math.random()*4;
      p.className='particle';p.style.left=box.left-base.left+box.width/2+'px';p.style.top=box.top-base.top+box.height/2+'px';p.style.width=p.style.height=size+'px';p.style.color=colors[i%colors.length];
      if(heart)p.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';else p.style.background='currentColor';
      p0.append(p);const a=(Math.PI*2*i)/14+Math.random()*.5,d=40+Math.random()*50;
      p.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:0},{transform:`translate(calc(-50% + ${Math.cos(a)*d*.7}px),calc(-50% + ${Math.sin(a)*d*.7-20}px)) scale(1)`,opacity:1,offset:.35},{transform:`translate(calc(-50% + ${Math.cos(a)*d}px),calc(-50% + ${Math.sin(a)*d+30}px)) scale(.8)`,opacity:0}],{duration:1100+Math.random()*400,easing:'cubic-bezier(.15,.7,.35,1)'}).onfinish=()=>p.remove();
    }
  }

  async function offer(purchase){
    const revision=++offerRevision;phase='offer';if(host)panel().querySelector('.yes')?.setAttribute('disabled','');
    let q;try{q=await send({action:'quote',purchase});}catch(e){if(/connect once/.test(e.message))return;throw e;}
    if(revision!==offerRevision)return;
    if(!q.gift_cents){close();return;}
    const estimated=q.source==='estimated';
    shell(`<span class="eyebrow">Round up for VGH Foundation</span>
      <div class="amounts"><span class="was">${money(q.cad_cents)}</span><span class="now">${money(q.cad_cents)}</span><span class="chip">+${money(q.gift_cents)}</span></div>
      <p>${estimated?'Around':'Make it'} ${money(q.total_cents)}? Add <strong>${money(q.gift_cents)}</strong> to your pending round-ups. Nothing is charged now; you give once they reach C$5.</p>
      <button class="yes">Yes, add ${money(q.gift_cents)}</button>
      <button class="no">No thanks</button>
      <details><summary>${estimated?'Estimated CAD · change total':'Change CAD total'}</summary><div class="fix"><p>${money(q.cad_cents)} ${estimated?'estimated':'entered'} total. ${estimated?'Assumes a 2.5% card FX fee; your actual bank charge can differ.':''}</p><label>Actual CAD total<input inputmode="decimal" value="${(q.cad_cents/100).toFixed(2)}"></label><button class="update">Update amount</button></div></details>
      <p class="small">Sandbox prototype · no real donations.</p>`);
    tween(panel().querySelector('.now'),q.cad_cents,q.total_cents,800,300);
    panel().querySelector('.no').onclick=close;
    panel().querySelector('.update').onclick=async()=>{try{await offer({provider:purchase.provider,cad_total:panel().querySelector('input').value});}catch(e){error(e);}};
    panel().querySelector('.yes').onclick=async()=>{
      const b=panel().querySelector('.yes');b.disabled=true;try{
        const r=await send({action:'pledge',quoteId:q.id});
        if(r.ready)ready(r.pending_cents,q.gift_cents);
        else saved(q.gift_cents,r.pending_cents);
      }catch(e){b.disabled=false;error(e);}
    };
  }
  function saved(gift,pending){
    phase='saved';const before=pending-gift;
    shell(`<span class="pig hero"></span>
      <h2>A little good, saved.</h2>
      <p><strong>+${money(gift)}</strong> added. Nothing taken yet.</p>
      <div class="jar"><span>Round-ups</span><span><strong class="jar-amt">${money(before)}</strong> of ${money(GOAL)}</span></div>
      <div class="bar"><i></i></div>
      <button class="yes">Done</button>`);
    fill(panel().querySelector('.bar'),before,before);
    deposit(piggy(84).fill(before/GOAL,0),'saved',before,pending,panel().querySelector('.jar-amt'));
    panel().querySelector('.yes').onclick=close;
  }
  // Ready to give; when a round-up just took it to C$5, its coins drop in first.
  function ready(total,gift=0){
    phase='ready';const before=total-gift;
    shell(`<span class="eyebrow">Ready to give</span>
      <h2>Your spare change is ready.</h2>
      <div class="bank"><div class="now">${money(before)}</div><span class="pig"></span></div>
      <div class="bar"><i></i></div>
      <p class="small">Stripe opens next. Confirm there.<br>Sandbox only · no real donation.</p>
      <button class="yes breathe">Yes, continue to Stripe</button>
      <button class="no">Later</button>`);
    const pig=piggy(76),now=panel().querySelector('.now');
    if(gift){pig.fill(before/GOAL,0);fill(panel().querySelector('.bar'),before,before);deposit(pig,'ready',before,total,now);}
    else{pig.fill(total/GOAL,1100);tween(now,0,total,900,200);fill(panel().querySelector('.bar'),0,total);}
    panel().querySelector('.no').onclick=close;
    panel().querySelector('.yes').onclick=async()=>{const b=panel().querySelector('.yes');b.disabled=true;try{await send({action:'checkout'});close();}catch(e){b.disabled=false;error(e);}};
  }
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
