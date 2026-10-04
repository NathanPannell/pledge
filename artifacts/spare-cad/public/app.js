const $=s=>document.querySelector(s);
const content=$('#content'),error=$('#error');
const money=c=>`C$${(c/100).toFixed(2)}`,clean=c=>`C$${(c/100).toLocaleString('en-CA',{maximumFractionDigits:2})}`;
let quote=null,state={pending_cents:0,paid_cents:0,history:[]},step='offer',busy=false,current={provider:'OpenRouter',usd_total:'22.40',purchase_key:crypto.randomUUID()};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,data){
  const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
  const x=await r.json();if(!r.ok)throw new Error(x.error||'Please try again.');return x;
}
function showError(e){error.textContent=e.message;error.hidden=false;if(!quote&&step==='offer'){content.innerHTML='<h2 id="prompt-title">Use your CAD total.</h2><p class="description">Enter the final amount shown by your provider or bank.</p><form class="edit-total" id="edit-total"><label>CAD total<input name="cad" inputmode="decimal" required placeholder="32.33"></label><button class="text-button">Continue</button></form>';}}
async function run(fn){if(busy)return;busy=true;error.hidden=true;document.querySelectorAll('.primary').forEach(b=>b.disabled=true);try{await fn();}catch(e){showError(e);}finally{busy=false;document.querySelectorAll('.primary').forEach(b=>b.disabled=false);}}
function ledger(){
  $('#balance').textContent=money(state.pending_cents);$('#pay-pending').hidden=state.pending_cents<500;
  $('#history').innerHTML=(state.history||[]).map(h=>`<div><span>${escape(h.provider)} · ${h.paid_at?'Paid in test':'Pending'}</span><strong>${money(h.gift_cents)}</strong></div>`).join('');
}
function render(){
  ledger();$('#dismiss').hidden=step==='complete';
  if(step==='offer'&&quote){
    if(!quote.gift_cents){content.innerHTML=`<h2 id="prompt-title">Already a clean number.</h2><p class="description">${money(quote.cad_cents)} needs no round-up.</p><button class="quiet" data-action="dismiss">Done</button>`;return;}
    const estimated=quote.source==='estimated';
    content.innerHTML=`<h2 id="prompt-title">${estimated?'Around':'Make it'} ${clean(quote.total_cents)}?</h2><p class="description">Add <strong>${money(quote.gift_cents)}</strong> to your pending<br>round-ups for <strong>VGH Foundation.</strong></p><p class="small">Nothing charged now. Donate when you reach C$5.</p><button class="primary" data-action="yes">Yes, add ${money(quote.gift_cents)}</button><button class="quiet" data-action="dismiss">No thanks</button><details class="details"><summary>${estimated?'Estimated CAD · change total':'How this works'}</summary><p>${money(quote.cad_cents)} purchase + ${money(quote.gift_cents)} pledge = ${money(quote.total_cents)}.</p><p>${escape(quote.fx_label)}${quote.fx_date?` · ${escape(quote.fx_date)}`:''}. ${estimated?'Your bank’s actual CAD charge can differ. This is an estimate.':''}</p><form class="edit-total" id="edit-total"><label>Actual CAD total<input name="cad" inputmode="decimal" value="${(quote.cad_cents/100).toFixed(2)}" required></label><button class="text-button">Update</button></form><p>If the next-dollar gap is below C$0.15, we use the following dollar. These are unfunded pledges; this demo makes no real donations.</p></details><p class="balance-line">${money(state.pending_cents)} pending · no money taken</p>`;
  }else if(step==='added')content.innerHTML=`<div class="success-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"/></svg></div><h2 id="prompt-title">A little good, saved.</h2><p class="description"><strong>${money(quote.gift_cents)}</strong> added. You now have<br><strong>${money(state.pending_cents)}</strong> in pending round-ups.</p><p class="small">No money taken. We’ll ask again at C$5.</p><button class="primary" data-action="dismiss">Done</button>`;
  else if(step==='ready')content.innerHTML=`<h2 id="prompt-title">Your spare change<br>is ready.</h2><div class="payment-row"><span>Pending round-ups</span><strong>${money(state.active?.amount_cents||state.pending_cents)}</strong></div><p class="description">Send it toward a little good?</p><p class="small">Stripe opens next. You confirm the payment there.<br>Sandbox only · no real donation or tax receipt.</p><button class="primary" data-action="checkout">Yes, continue to Stripe</button><button class="quiet" data-action="dismiss">Later</button>`;
  else if(step==='complete')content.innerHTML=`<div class="success-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"/></svg></div><h2 id="prompt-title">A little extra.<br>A little good.</h2><p class="description">Your <strong>${money(state.last_paid||0)}</strong> test payment is confirmed.</p><p class="small">Only those paid round-ups were cleared.<br>No real donation was made.</p><button class="primary" data-action="dismiss">Done</button>`;
  else if(step==='dismissed')content.innerHTML=`<h2 id="prompt-title">Back to your idea.</h2><p class="description">${money(state.pending_cents)} pending. Nothing charged.</p><button class="quiet" data-action="replay">Show round-up again</button>`;
  else if(step==='checking')content.innerHTML=`<h2 id="prompt-title">Checking your payment.</h2><p class="description">We’re confirming with Stripe before clearing any round-ups.</p><button class="quiet" data-action="check">Check again</button>`;
}
async function getQuote(next){current=next;quote=await api('/api/quote',next);step='offer';$('#receipt-cad').textContent=money(quote.cad_cents);$('#receipt-cad-label').textContent=quote.source==='estimated'?'Estimated CAD total':'CAD total';$('#receipt-provider').textContent=quote.provider;$('#receipt-usd').textContent=next.usd_total?`US$${next.usd_total}`:'Example CAD receipt';render();}
async function checkPayment(id){const r=await api(`/api/checkout/status?id=${encodeURIComponent(id)}`);state={...state,...r};if(r.status==='paid'){state.last_paid=r.amount_cents;step='complete';history.replaceState(null,'','/');}else step='checking';render();}
content.addEventListener('click',e=>{const action=e.target.closest('[data-action]')?.dataset.action;run(async()=>{
  if(action==='yes'){const r=await api('/api/pledge',{quote_id:quote.id});state={...state,...r};step=r.ready?'ready':'added';render();content.querySelector('button')?.focus({preventScroll:true});}
  else if(action==='checkout'){const r=await api('/api/checkout',{});if(r.paid){state=await api('/api/state');state.last_paid=r.amount_cents;step='complete';render();}else location.assign(r.url);}
  else if(action==='dismiss'){step='dismissed';render();}
  else if(action==='replay'){step='offer';render();}
  else if(action==='check')await checkPayment(new URL(location.href).searchParams.get('checkout'));
});});
content.addEventListener('submit',e=>{if(e.target.id!=='edit-total')return;e.preventDefault();const value=new FormData(e.target).get('cad');run(()=>getQuote({provider:current.provider,cad_total:value,purchase_key:crypto.randomUUID()}));});
$('#dismiss').onclick=()=>{if(!busy){step='dismissed';render();}};
document.querySelectorAll('[data-cad]').forEach(b=>b.onclick=()=>run(()=>getQuote({provider:'OpenRouter',cad_total:b.dataset.cad,purchase_key:crypto.randomUUID()})));
$('#replay').onclick=()=>run(()=>getQuote({...current,purchase_key:crypto.randomUUID()}));
$('#near-threshold').onclick=()=>run(async()=>{state=await api('/api/demo/near-threshold',{run_id:crypto.randomUUID()});if(state.pending_cents>=500){step='ready';render();}else await getQuote({provider:'OpenRouter',cad_total:'32.33',purchase_key:crypto.randomUUID()});});
$('#pay-pending').onclick=()=>{step='ready';render();$('#prompt').scrollIntoView({behavior:'smooth',block:'center'});};
$('#install').onclick=()=>$('#extension-dialog').showModal();$('#close-extension').onclick=()=>$('#extension-dialog').close();
$('#pair').onclick=()=>run(async()=>{const r=await api('/api/pair/code',{});$('#pair-code').value=r.code;$('#pair-code').hidden=false;$('#copy-code').hidden=false;});
$('#copy-code').onclick=()=>run(async()=>{await navigator.clipboard.writeText($('#pair-code').value);$('#copy-code').textContent='Copied';});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#extension-dialog').open&&!busy){step='dismissed';render();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)run(async()=>{state=await api('/api/state');ledger();});});
run(async()=>{state=await api('/api/state');const params=new URL(location.href).searchParams;
  if(params.has('checkout')||params.has('cancel')){$('#receipt-cad').textContent=state.history.length?money(state.history[0].cad_cents):'Example purchase';$('#receipt-cad-label').textContent='Last example CAD total';}
  if(params.has('checkout')){step='checking';render();await checkPayment(params.get('checkout'));}
  else if(params.has('cancel')){const r=await api('/api/checkout/cancel',{id:params.get('cancel')});state={...state,...r};history.replaceState(null,'','/');step=r.status==='paid'?'complete':'ready';state.last_paid=r.amount_cents;render();}
  else await getQuote(current);
});
