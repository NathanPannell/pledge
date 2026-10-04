(function(root){
  function providerFor(url){const u=new URL(url);if(u.hostname==='openrouter.ai'&&(u.pathname.startsWith('/credits')||u.pathname.startsWith('/settings/credits')))return'OpenRouter';return null;}
  function parseTotal(text,usdDefault=false){
    const t=text.replace(/\s+/g,' ').trim();
    if(/-\s*(?:US\$|USD|CA\$|CAD|C\$|\$)/i.test(t))return null;
    const matches=[...t.matchAll(/(?:(US\$|USD|CA\$|CAD|C\$|\$)\s*([0-9][0-9,]*(?:\.\d{1,2})?)(?![\d.,])|([0-9][0-9,]*(?:\.\d{1,2})?)(?![\d.,])\s*(USD|CAD))/gi)];
    if(matches.length!==1)return null;
    const m=matches[0],unit=(m[1]||m[4]).toUpperCase(),raw=m[2]||m[3];
    if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw))return null;
    const value=raw.replaceAll(',','');
    if(unit==='$'&&!usdDefault)return null;
    const currency=['CAD','CA$','C$'].includes(unit)?'CAD':'USD';
    const n=Number(value);if(!Number.isFinite(n)||n<=0||n>1000000)return null;
    return{currency,total:n.toFixed(2)};
  }
  // OpenRouter's credits page shows a "Total available" balance, so only its
  // open Purchase Credits window counts as a checkout. A window that is
  // animating closed (data-closed, data-ending-style) no longer counts.
  function openCheckout(doc){
    return [...doc.querySelectorAll('[role="dialog"], dialog')].find(d=>d.getClientRects().length&&!d.hasAttribute('data-closed')&&!d.hasAttribute('data-ending-style')&&d.ownerDocument.defaultView.getComputedStyle(d).visibility!=='hidden'&&/total due/i.test(d.textContent||''))||null;
  }
  function detect(doc,url,context=null){
    let provider=providerFor(url);const host=new URL(url).hostname;
    if(host==='checkout.stripe.com'){
      if(!context||Date.now()-context.at>10*60*1000)return null;
      const text=doc.body?.innerText||'';
      if(!text.toLowerCase().includes(context.provider.toLowerCase()))return null;
      provider=context.provider;
    }
    if(!provider)return null;
    const scope=host==='openrouter.ai'?openCheckout(doc):doc;
    if(!scope)return null;
    // Only a visible, explicitly labelled final total. Never read payment/card inputs.
    for(const el of scope.querySelectorAll('[data-testid="total-amount"], [data-testid="checkout-total"], .OrderSummary-total, [role="row"], dt, label, p, span, div')){
      if(!el.getClientRects().length||el.closest('#spare-extension-root'))continue;
      const text=(el.innerText||'').trim();
      // The label alone, then the amount: "Total due $10.80", never "Total available $6.67".
      if(text.length>180||! /^(?:total(?: due| amount)?|amount due|payment total|you(?:’|')?ll pay)(?![ \t]*[a-z])/i.test(text))continue;
      // OpenRouter's own credits are USD-denominated; a final Total due on that
      // verified merchant route is USD even when the symbol is printed as '$'.
      const candidate=parseTotal(text,host==='openrouter.ai');
      if(candidate)return{provider,...candidate,timing:/payment (?:successful|complete)|credits (?:added|purchased)/i.test(doc.body.innerText)?'success':'checkout'};
      const adjacent=el.nextElementSibling;
      if(adjacent&&adjacent.getClientRects().length){const q=parseTotal(adjacent.innerText||'',host==='openrouter.ai');if(q)return{provider,...q,timing:'checkout'};}
    }
    return null;
  }
  root.SpareDetector={providerFor,parseTotal,detect,openCheckout};
})(globalThis);
