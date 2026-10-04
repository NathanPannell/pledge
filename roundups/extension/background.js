importScripts('config.js');
async function call(path,data){
  const {spareToken}=await chrome.storage.local.get('spareToken');
  if(!spareToken)throw new Error('Open the Spare extension to connect once.');
  const r=await fetch(SPARE_ORIGIN+SPARE_API_PREFIX+path,{method:data?'POST':'GET',credentials:'include',headers:{Authorization:`Bearer ${spareToken}`,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
  const x=await r.json();if(!r.ok)throw new Error(x.error||'Spare is unavailable. Try again.');return x;
}
chrome.runtime.onMessage.addListener((message,sender,send)=>{
  (async()=>{
    const ownPage=sender.id===chrome.runtime.id && (sender.url?.startsWith('chrome-extension://'+chrome.runtime.id+'/') || sender.origin==='chrome-extension://'+chrome.runtime.id);
    const external=!!sender.tab&&!ownPage;
    if(external&&!/^(https:\/\/(openrouter\.ai)\/)/.test(sender.url||''))throw new Error('Unsupported page.');
    if(message.action==='connect'){
      if(external)throw new Error('Use the extension popup to connect.');
      const r=await fetch(SPARE_ORIGIN+SPARE_API_PREFIX+'/api/pair/redeem',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:message.code})});
      const x=await r.json();if(!r.ok)throw new Error(x.error||'Connection failed.');await chrome.storage.local.set({spareToken:x.token});return{connected:true};
    }
    if(message.action==='context'){
      const key=`context:${sender.tab.id}`;
      if(message.provider&&['OpenRouter'].includes(message.provider)){await chrome.storage.session.set({[key]:{provider:message.provider,at:Date.now()}});}
      return(await chrome.storage.session.get(key))[key]||null;
    }
    if(message.action==='state')return call('/api/state');
    if(message.action==='quote'){
      const key=`offer:${sender.tab?.id||'popup'}`,fingerprint=JSON.stringify(message.purchase);
      let saved=(await chrome.storage.session.get(key))[key];
      if(!saved||saved.fingerprint!==fingerprint||Date.now()-saved.at>25*60*1000||(message.newPurchase===true&&!external)){saved={fingerprint,purchaseKey:crypto.randomUUID(),at:Date.now()};await chrome.storage.session.set({[key]:saved});}
      return call('/api/quote',{...message.purchase,purchase_key:saved.purchaseKey});
    }
    if(message.action==='pledge')return call('/api/pledge',{quote_id:message.quoteId});
    // Sandbox testing only: tops pending round-ups up to C$5 to try Stripe checkout.
    if(message.action==='fill'){
      const before=(await call('/api/state')).pending_cents;
      return{...await call('/api/demo/fill',{run_id:crypto.randomUUID()}),before_cents:before};
    }
    if(message.action==='checkout'){
      const x=await call('/api/checkout',{});if(x.url)await chrome.tabs.create({url:x.url});return x;
    }
    if(message.action==='open'){
      if(external)throw new Error('Open Spare from the extension popup.');await chrome.tabs.create({url:SPARE_ORIGIN+SPARE_SETUP_PATH});return{};
    }
    if(message.action==='disconnect'){
      if(external)throw new Error('Use the extension popup.');await call('/api/device/revoke',{});await chrome.storage.local.remove('spareToken');return{};
    }
    throw new Error('Unknown action.');
  })().then(data=>send({ok:true,data})).catch(e=>send({ok:false,error:e.message}));return true;
});
