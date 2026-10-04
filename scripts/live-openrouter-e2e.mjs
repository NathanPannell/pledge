import {chromium} from 'playwright';
import {cpSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const origin=process.env.PLEDGE_E2E_ORIGIN||'https://pledge.pauravhp.com';
const root=path.resolve('.local/extension-e2e-'+Date.now());mkdirSync(root,{recursive:true});cpSync('roundups/extension',root,{recursive:true});writeFileSync(`${root}/config.js`, `globalThis.SPARE_ORIGIN=${JSON.stringify(origin)};globalThis.SPARE_API_PREFIX='/roundups';globalThis.SPARE_SETUP_PATH='/roundups/';`);
const manifest=JSON.parse(readFileSync(`${root}/manifest.json`));manifest.host_permissions=[origin+'/*'];writeFileSync(`${root}/manifest.json`,JSON.stringify(manifest));
mkdirSync('test-results',{recursive:true});
const c=await chromium.launchPersistentContext(process.env.PLEDGE_OPENROUTER_PROFILE||'.local/openrouter-browser',{headless:true,channel:'chromium',ignoreDefaultArgs:['--disable-extensions'],args:['--no-sandbox',...(process.env.PLEDGE_E2E_EDGE_IP?[`--host-resolver-rules=MAP ${new URL(origin).hostname} ${process.env.PLEDGE_E2E_EDGE_IP}`]:[]),`--disable-extensions-except=${root}`,`--load-extension=${root}`],viewport:{width:1440,height:1000},recordVideo:{dir:'test-results/live-video',size:{width:1440,height:1000}}});
const report={provider:'OpenRouter',live_provider:true,provider_purchase_submitted:false,backend:origin,extension:origin.startsWith('https:')?'actual MV3 extension with combined API namespace':'actual MV3 extension; localhost endpoint for isolated E2E',checks:[]};
try{
 await c.clearCookies({domain:new URL(origin).hostname});
 const qa=await c.newPage();await qa.goto(origin+'/roundups/');await qa.getByRole('button',{name:'Get a connection code',exact:true}).waitFor();
 const api={};for(const method of ['get','post'])api[method]=async(url,options={})=>{
   const r=await qa.evaluate(async({url,method,data,headers})=>{const response=await fetch(url,{method:method.toUpperCase(),credentials:'include',headers:{...headers,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return{status:response.status,data:await response.json()};},{url,method,data:options.data,headers:options.headers||{}});
   return{status:()=>r.status,json:async()=>r.data};
 };
 if(process.env.PLEDGE_E2E_EDGE_IP)report.test_dns='Cloudflare public DNS address pinned in test browser to avoid host resolver negative cache';
 await new Promise(r=>setTimeout(r,1000));const workers=c.serviceWorkers();console.log(JSON.stringify({workers:await Promise.all(workers.map(async w=>({url:w.url(),origin:await w.evaluate(()=>globalThis.SPARE_ORIGIN).catch(()=>null)})))}));const worker=workers.at(-1)||await c.waitForEvent('serviceworker');const id=new URL(worker.url()).host;await worker.evaluate(()=>{chrome.runtime.onMessage.addListener((m,s)=>{globalThis.lastSender={id:s.id,url:s.url,origin:s.origin,own:chrome.runtime.id,prefix:chrome.runtime.getURL('')};});return chrome.storage.local.clear();});
 const state=await api.get(origin+'/roundups/api/state');assert.equal(state.status(),200);
 const seed=await api.post(origin+'/roundups/api/demo/near-threshold',{headers:{Origin:origin},data:{run_id:crypto.randomUUID()}});assert.equal(seed.status(),200);
 // Explicit test setup: C$4.69 synthetic pledges plus C$0.16; any valid offer reaches C$5.
 const q=await api.post(origin+'/roundups/api/quote',{headers:{Origin:origin},data:{provider:'Demo',cad_total:'29.84',purchase_key:crypto.randomUUID()}}).then(r=>r.json());
 await api.post(origin+'/roundups/api/pledge',{headers:{Origin:origin},data:{quote_id:q.id}});
 const code=await api.post(origin+'/roundups/api/pair/code',{headers:{Origin:origin},data:{}}).then(r=>r.json());
 const popup=await c.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);await popup.locator('#code').fill(code.code);await popup.getByRole('button',{name:'Connect Pledge',exact:true}).click();await popup.locator('#pending').waitFor();report.checks.push('One-time pairing connects the real Chrome extension to the database account');await popup.close();
 const p=await c.newPage();await p.goto('https://openrouter.ai/settings/credits');await p.getByRole('button',{name:'Add Credits',exact:true}).waitFor();await p.waitForTimeout(1000);
 assert.equal(await p.locator('#spare-extension-root').count(),0);report.checks.push('No round-up appears for the account balance');
 await p.getByRole('button',{name:'Add Credits',exact:true}).click();await p.getByText('Total due',{exact:true}).waitFor();await p.locator('#spare-extension-root').waitFor({timeout:15000});
 const inspector=await c.newCDPSession(p);
 async function panelNodes(){
   const {root}=await inspector.send('DOM.getDocument',{depth:-1,pierce:true});
   const flatten=n=>[n,...[...(n.children||[]),...(n.shadowRoots||[])].flatMap(flatten)];
   const nodes=flatten(root),host=nodes.find(n=>(n.attributes||[]).includes('spare-extension-root'));
   if(!host)return null;const inside=flatten(host);const panel=inside.find(n=>(n.attributes||[]).includes('panel')),yes=inside.find(n=>(n.attributes||[]).some(a=>a.split(' ').includes('yes')));
   if(!panel||!yes)return null;
   const {object}=await inspector.send('DOM.resolveNode',{nodeId:panel.nodeId});
   const {result}=await inspector.send('Runtime.callFunctionOn',{objectId:object.objectId,functionDeclaration:'function(){return this.innerText}',returnByValue:true});
   return{text:result.value,yes:yes.nodeId,summary:inside.find(n=>n.nodeName==='SUMMARY')?.nodeId,input:inside.find(n=>n.nodeName==='INPUT')?.nodeId,update:inside.find(n=>(n.attributes||[]).some(a=>a.split(' ').includes('update')))?.nodeId};
 }
 async function waitPanel(needle){for(let i=0;i<60;i++){const n=await panelNodes();if(n?.text.includes(needle))return n;await p.waitForTimeout(250);}throw new Error('Extension panel did not show '+needle);}
 async function clickNode(nodeId){const {model}=await inspector.send('DOM.getBoxModel',{nodeId});const b=model.border;await p.mouse.click((b[0]+b[4])/2,(b[1]+b[5])/2);}
 async function clickYes(){await clickNode((await panelNodes()).yes);}
 async function openCorrection(){const n=await panelNodes();const {object}=await inspector.send('DOM.resolveNode',{nodeId:n.summary});const {result}=await inspector.send('Runtime.callFunctionOn',{objectId:object.objectId,functionDeclaration:'function(){return this.parentElement.open}',returnByValue:true});if(!result.value)await clickNode(n.summary);}
 const nativeTotal=await p.getByText('Total due',{exact:true}).evaluate(e=>e.parentElement.innerText);report.observed_total=nativeTotal.replace(/\s+/g,' ').trim();
 const offer=(await waitPanel('Yes, add')).text;report.offer=offer;
 assert.match(offer,/Yes, add C\$/);assert.match(offer,/Around/);report.checks.push('Visible final merchant Total due triggers a CAD estimate automatically');
 await p.getByText('Total due',{exact:true}).click();await p.keyboard.press('Escape');await p.getByText('Total due',{exact:true}).waitFor({state:'hidden'});await p.locator('#spare-extension-root').waitFor({state:'detached'});
 report.checks.push('Closing Add Credits removes the unapproved offer');
 await p.getByRole('button',{name:'Add Credits',exact:true}).click();await waitPanel('Yes, add');
 const credit=p.locator('input[name=creditAmount]');
 const q10=await api.post(origin+'/roundups/api/quote',{data:{provider:'OpenRouter',usd_total:'10.80',purchase_key:crypto.randomUUID()}}).then(r=>r.json());
 const q20=await api.post(origin+'/roundups/api/quote',{data:{provider:'OpenRouter',usd_total:'21.10',purchase_key:crypto.randomUUID()}}).then(r=>r.json());
 const label=q=>'Yes, add C$'+(q.gift_cents/100).toFixed(2);
 await credit.fill('20');await waitPanel(label(q20));assert.ok((await p.getByText('Total due',{exact:true}).evaluate(e=>e.parentElement.innerText)).includes('21.10'));report.checks.push('Changing credits updates the final quote including service fees, not just the credit amount');
 await credit.fill('10');await waitPanel(label(q10));
 await openCorrection();await clickNode((await panelNodes()).input);await p.keyboard.press('Control+A');await p.keyboard.type('29.99');await clickNode((await panelNodes()).update);const corrected=await waitPanel('Yes, add C$1.01');assert.ok(corrected.text.includes('Make it C$31.00'));report.checks.push('Native CAD correction honors the 15-cent minimum: C$29.99 rounds to C$31.00');
 await openCorrection();await clickNode((await panelNodes()).input);await p.keyboard.press('Control+A');await p.keyboard.type('30.00');await clickNode((await panelNodes()).update);await p.locator('#spare-extension-root').waitFor({state:'detached'});report.checks.push('A whole CAD total removes the unapproved offer');
 await credit.fill('20');await waitPanel(label(q20));await credit.fill('10');await waitPanel(label(q10));
 const mask=[p.getByRole('button',{name:/VISA/i}),p.locator('p,span').filter({hasText:/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i})];
 await p.screenshot({path:'test-results/live-openrouter-offer.png',fullPage:true,mask});
 await clickYes();await waitPanel('Your spare change');
 const after=await api.get(origin+'/roundups/api/state').then(r=>r.json());assert.ok(after.pending_cents>=500);report.pending_after_yes=after.pending_cents;
 report.checks.push('Yes records only the CAD pledge and immediately offers checkout at C$5');
 await p.screenshot({path:'test-results/live-openrouter-threshold.png',fullPage:true,mask});
 const newTab=c.waitForEvent('page');await clickYes();const checkout=await newTab;await checkout.waitForURL('https://checkout.stripe.com/**');await checkout.locator('#email').waitFor();
 assert.equal(await p.getByRole('button',{name:'Purchase',exact:true}).count(),1);report.checks.push('Spare opens a separate Stripe sandbox tab; OpenRouter Purchase is never pressed');
 report.stripe_checkout_opened=true;await checkout.screenshot({path:'test-results/live-openrouter-stripe.png',fullPage:true});
 // Complete only Spare's sandbox payment with Stripe's documented test card.
 await checkout.locator('#email').fill('spare-live-e2e@example.com');await checkout.locator('#cardNumber').fill('4242424242424242');await checkout.locator('#cardExpiry').fill('12/30');await checkout.locator('#cardCvc').fill('123');await checkout.locator('#billingName').fill('Spare Sandbox Test');await checkout.locator('#billingCountry').selectOption('CA');const postal=checkout.locator('#billingPostalCode:visible');if(await postal.count())await postal.fill('V6B 1A1');
 await checkout.locator('button[type="submit"]:visible').click();await checkout.waitForURL(origin+'/roundups/**',{timeout:60000});await checkout.getByText('A little extra.',{exact:false}).waitFor();
 const final=await api.get(origin+'/roundups/api/state').then(r=>r.json());assert.equal(final.pending_cents,0);assert.equal(final.paid_cents,after.pending_cents);report.final_ledger={pending_cents:final.pending_cents,paid_cents:final.paid_cents,currency:'CAD'};report.stripe_test_paid=true;report.checks.push('Stripe verifies the CAD sandbox payment and clears that reserved balance');
 await checkout.screenshot({path:'test-results/live-openrouter-paid.png',fullPage:true});
}catch(e){report.failure=e.message;process.exitCode=1;console.log(JSON.stringify({live_e2e_failure:e.message}));}
finally{writeFileSync('test-results/live-openrouter.json',JSON.stringify(report,null,2));await c.close();}
console.log(JSON.stringify(report));
