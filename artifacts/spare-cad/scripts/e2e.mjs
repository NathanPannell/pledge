import { chromium } from '/tmp/spare-browser/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results={started:new Date().toISOString(),checks:[],stripe:{paid:false}};
try{
 const desktop=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'test-results/video',size:{width:1440,height:1000}}});
 const page=await desktop.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4175');await page.getByRole('button',{name:/Yes, add/}).waitFor();
 await page.screenshot({path:'test-results/desktop-offer.png',fullPage:true});
 await page.getByRole('button',{name:'C$29.99',exact:true}).click();await page.getByRole('button',{name:'Yes, add C$1.01',exact:true}).waitFor();
 await page.getByRole('button',{name:'Yes, add C$1.01',exact:true}).click();await page.getByText('A little good, saved.',{exact:true}).waitFor();
 assert.equal((await page.request.get('http://localhost:4175/api/state').then(r=>r.json())).pending_cents,101);
 results.checks.push('C$29.99 produces C$1.01; one Yes records an unfunded pledge');
 await page.reload();await page.getByRole('button',{name:/Yes, add/}).waitFor();assert.equal((await page.request.get('http://localhost:4175/api/state').then(r=>r.json())).pending_cents,101);results.checks.push('Pledges survive reload');
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const phone=await mobile.newPage();await phone.goto('http://localhost:4175');await phone.getByRole('button',{name:/Yes, add/}).waitFor();await phone.screenshot({path:'test-results/mobile-offer.png',fullPage:true});
 assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await phone.getByRole('button',{name:'C$29.85',exact:true}).click();await phone.getByRole('button',{name:'Yes, add C$0.15',exact:true}).waitFor();results.checks.push('390px mobile layout fits and the C$0.15 boundary works');
 // Use the fresh phone account so the demo threshold is deterministic: C$4.69 + C$0.67.
 await phone.getByRole('button',{name:'Try the C$5 checkout',exact:true}).click();await phone.getByRole('button',{name:'Yes, add C$0.67',exact:true}).waitFor();await phone.getByRole('button',{name:'Yes, add C$0.67',exact:true}).click();await phone.getByRole('button',{name:'Yes, continue to Stripe',exact:true}).waitFor();await phone.screenshot({path:'test-results/mobile-ready.png',fullPage:true});
 const balance=await phone.request.get('http://localhost:4175/api/state').then(r=>r.json());assert.equal(balance.pending_cents,536);
 await phone.getByRole('button',{name:'Yes, continue to Stripe',exact:true}).click();
 await phone.waitForURL('https://checkout.stripe.com/**',{timeout:30000});await phone.waitForTimeout(3500);
 results.checks.push('C$5.36 threshold opens actual Stripe-hosted sandbox Checkout');
 await phone.screenshot({path:'test-results/stripe-checkout.png',fullPage:true});
 console.log(JSON.stringify({stage:'stripe_checkout',inputSelectors:await phone.locator('input:visible').evaluateAll(xs=>xs.map(x=>({id:x.id,name:x.name,type:x.type,placeholder:x.placeholder}))),buttonLabels:await phone.getByRole('button').allTextContents()}));
 await phone.locator('#email').fill('spare-e2e@example.com');
 await phone.locator('#cardNumber').fill('4242424242424242');await phone.locator('#cardExpiry').fill('12/30');await phone.locator('#cardCvc').fill('123');
 if(await phone.locator('#billingName').count())await phone.locator('#billingName').fill('Spare Sandbox Test');
 if(await phone.locator('#billingCountry').count())await phone.locator('#billingCountry').selectOption('CA');
 if(await phone.locator('#billingPostalCode:visible').count())await phone.locator('#billingPostalCode').fill('V6B 1A1');
 const submit=phone.locator('button[type="submit"]:visible');await submit.click();
 await phone.waitForURL('http://localhost:4175/**',{timeout:60000});await phone.getByText('A little extra.',{exact:false}).waitFor({timeout:20000});
 await phone.screenshot({path:'test-results/mobile-paid.png',fullPage:true});
 const final=await phone.request.get('http://localhost:4175/api/state').then(r=>r.json());assert.equal(final.pending_cents,0);assert.equal(final.paid_cents,536);assert.equal(final.active,null);
 results.stripe={paid:true,currency:'CAD',amount_cents:536,pending_after:0,paid_after:536};results.checks.push('Stripe confirms test payment; server clears exactly C$5.36');
 await phone.reload();await phone.getByRole('button',{name:/Yes, add/}).waitFor();const repeat=await phone.request.get('http://localhost:4175/api/state').then(r=>r.json());assert.equal(repeat.paid_cents,536);results.checks.push('Payment completion survives reload without double settlement');
 assert.equal(errors.length,0);results.browser_errors=errors;await mobile.close();await desktop.close();
}catch(e){results.failure=e.message;console.log(JSON.stringify({e2e_failure:e.message}));process.exitCode=1;}
finally{writeFileSync('test-results/e2e.json',JSON.stringify(results,null,2));await browser.close();}
console.log(JSON.stringify(results));
