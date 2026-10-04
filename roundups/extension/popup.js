const main=document.querySelector('#content'),error=document.querySelector('#error');
async function send(message){const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw new Error(r?.error||'Please try again.');return r.data;}
const money=c=>`C$${(c/100).toFixed(2)}`;
async function connected(){const s=await send({action:'state'});main.innerHTML=`<h1>A little good,<br>as you go.</h1><p><strong>${money(s.pending_cents)}</strong> in pending round-ups.<br>No money taken.</p>${s.pending_cents>=500?'<button id="pay">Continue to Stripe</button>':''}<button id="open" class="quiet">Open Spare</button><button id="disconnect" class="quiet">Disconnect this browser</button><p class="small">OpenRouter · checkout detection verified.<br>Sandbox prototype · no real donations.</p>`;main.querySelector('#open').onclick=()=>send({action:'open'});main.querySelector('#disconnect').onclick=async()=>{await send({action:'disconnect'});setup();};const b=main.querySelector('#pay');if(b)b.onclick=async()=>{try{b.disabled=true;await send({action:'checkout'});}catch(e){error.textContent=e.message;error.hidden=false;}finally{b.disabled=false;}};}
function setup(){main.innerHTML='<h1>Connect once.</h1><p>Get a connection code from Spare, then paste it here.</p><button id="open" class="quiet">Open Spare to get a code</button><form><label for="code">Connection code</label><input id="code" autocomplete="off" required><button>Connect Spare</button></form><p class="small">No bank connection. No card details.<br>Sandbox only.</p>';main.querySelector('#open').onclick=()=>send({action:'open'});main.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;try{await send({action:'connect',code:main.querySelector('#code').value.trim()});await connected();}catch(e){error.textContent=e.message;error.hidden=false;}finally{b.disabled=false;}};}
const showError=e=>{error.textContent=e.message;error.hidden=false;};
const originalConnected=connected;
connected=async()=>{
 await originalConnected();
 const details=document.createElement('details');details.innerHTML='<summary>Enter a CAD total</summary><p class="small">Use this when the checkout’s final amount isn’t readable.</p><form id="manual"><label for="cad">Final CAD total</label><input id="cad" inputmode="decimal" placeholder="32.33" required><button>Find my round-up</button></form>';
 main.append(details);details.querySelector('form').onsubmit=async e=>{
   e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;
   try{const q=await send({action:'quote',newPurchase:true,purchase:{provider:'Demo',cad_total:details.querySelector('input').value}});
     if(!q.gift_cents){main.innerHTML='<h1>Already a clean number.</h1><p>No round-up needed.</p><button id="done">Done</button>';main.querySelector('#done').onclick=connected;return;}
     main.innerHTML=`<h1>Make it ${money(q.total_cents)}?</h1><p>Add <strong>${money(q.gift_cents)}</strong> to pending round-ups for VGH Foundation.</p><p class="small">Nothing charged now. Sandbox only.</p><button id="yes">Yes, add ${money(q.gift_cents)}</button><button class="quiet" id="no">No thanks</button>`;
     main.querySelector('#no').onclick=connected;main.querySelector('#yes').onclick=async()=>{const yes=main.querySelector('#yes');yes.disabled=true;try{await send({action:'pledge',quoteId:q.id});await connected();}catch(e){showError(e);yes.disabled=false;}};
   }catch(e){showError(e);}finally{b.disabled=false;}
 };
};
(async()=>{const s=await chrome.storage.local.get('spareToken');if(!s.spareToken)setup();else try{await connected();}catch(e){showError(e);setup();}})();
