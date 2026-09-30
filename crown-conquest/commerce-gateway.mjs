import {PRODUCTS} from './catalog.mjs';
// Future backend adapter. This module does NOT enable the current local demo's shop.
// Claude must move the entire economy to server authority before wiring it to UI.
export function commerceGateway({request}){
 if(typeof request!=='function')throw new TypeError('An authenticated transport is required.');
 const known=new Set(PRODUCTS.map(p=>p.id));
 function receipt(r){if(!r||!['pending','cancelled','verified'].includes(r.status))throw new Error('Invalid purchase response.');if(r.status!=='verified')return {status:r.status};if(typeof r.transactionId!=='string'||!r.transactionId||!Number.isInteger(r.revision)||!r.profile||!Array.isArray(r.entitlements)||!Array.isArray(r.rewards))throw new Error('Verified purchase requires an authoritative profile and receipt.');return r;}
 return{
 async products(){const r=await request('/v1/games/crown-conquest/products',{method:'GET'});if(r?.authoritativeEconomy!==true||!Array.isArray(r.products))throw new Error('The paid economy is not ready.');return r.products.filter(p=>known.has(p.id)&&typeof p.displayPrice==='string'&&p.displayPrice.length>0);},
 async verify({productId,platform,purchaseToken,idempotencyKey}){if(!known.has(productId)||!['google','apple','web'].includes(platform)||!purchaseToken||!idempotencyKey)throw new Error('A store receipt and idempotency key are required.');return receipt(await request('/v1/games/crown-conquest/purchases',{method:'POST',body:{productId,platform,purchaseToken,idempotencyKey}}));},
 async restore(){const r=await request('/v1/games/crown-conquest/restore',{method:'POST',body:{}});if(!r?.profile||!Number.isInteger(r.revision)||!Array.isArray(r.entitlements))throw new Error('Restore requires an authoritative profile.');return r;}
 };
}
