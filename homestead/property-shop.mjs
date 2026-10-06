export const SHOP_PRODUCTS=Object.freeze([
 {id:'homestead_cash_10000',category:'funds',name:'A little head start',amount:'10,000',description:'Farm dollars for fencing, livestock, buildings or your next land purchase.',detail:'Adds 10,000 farm dollars. Spend them through the usual property controls. Can be bought again.',type:'Repeatable cash pack'},
 {id:'homestead_cash_50000',category:'funds',name:'Room to grow',amount:'50,000',description:'Put bigger plans into motion across your property.',detail:'Adds 50,000 farm dollars. Land adjacency, building placement and job requirements still apply. Can be bought again.',type:'Repeatable cash pack'},
 {id:'homestead_cash_150000',category:'funds',name:'Station ambitions',amount:'150,000',description:'A substantial boost for land, infrastructure and machinery.',detail:'Adds 150,000 farm dollars. It does not complete jobs or unlock later crop stages. Can be bought again.',type:'Repeatable cash pack'},
 {id:'homestead_outback_estate',category:'exclusive',name:'Outback estate',art:'estate',description:'Your own sandstone residence with deep verandahs and a country garden.',detail:'Paid-only home style. Includes one construction on a clear 3 × 3 site you own. Choose the spot; your worker builds it. No extra land included.',type:'Permanent exclusive'},
 {id:'homestead_outback_tractor',category:'exclusive',name:'Outback 4WD',art:'tractor',description:'Premium equipment with a real advantage in the paddock.',detail:'Paid-only tractor. Uses 30% less tractor field-work time than the standard big 4WD. Uses existing compatible implements, bought separately. Crop growth and harvesting times are unchanged.',type:'Permanent exclusive'}
]);
export function createShopController(adapter=null){
 let busy=false,offers=new Map(),available=false;
 return {
  get busy(){return busy;},get available(){return available;},offer(id){return offers.get(id);},
  async refresh(){
   available=false;offers.clear();if(!adapter)return;
   const snapshot=await adapter.snapshot();
   if(snapshot?.available!==true||!Array.isArray(snapshot.products))return;
   for(const p of snapshot.products)if(SHOP_PRODUCTS.some(x=>x.id===p.id)&&typeof p.displayPrice==='string'&&p.displayPrice.trim())offers.set(p.id,{displayPrice:p.displayPrice,owned:p.owned===true});
   available=offers.size>0;
  },
  async purchase(id){
   if(busy)throw Error('A purchase is already being checked.');
   const offer=offers.get(id);
   if(!available||!offer||offer.owned)throw Error('This item is not available to buy.');
   busy=true;try{const result=await adapter.purchase(id);if(!['cancelled','pending','delivered'].includes(result?.status))throw Error('Purchase could not be confirmed. Use Restore purchases before trying again.');if(result.status==='delivered'&&!(typeof result.deliveryId==='string'&&result.deliveryId))throw Error('Delivery could not be confirmed. Use Restore purchases.');return result;}finally{busy=false;}
  },
  async restore(){if(busy)throw Error('A purchase is already being checked.');if(!adapter||!available)throw Error('Restore will be available in the released app.');busy=true;try{const r=await adapter.restore();if(!['restored','pending'].includes(r?.status))throw Error('Restore could not be confirmed. Try again when connected.');return r;}finally{busy=false;}}
 };
}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountFarmShop({dialog,adapter=null,onDelivered=()=>{}}){
 const controller=createShopController(adapter);let category='all',selected=null,lastFocus=null;
 const status=dialog.querySelector('[data-shop-status]'),grid=dialog.querySelector('[data-shop-grid]'),detail=dialog.querySelector('[data-shop-detail]');
 const notify=text=>{status.textContent=text;};
 function render(){
  grid.innerHTML=SHOP_PRODUCTS.filter(p=>category==='all'||p.category===category).map(p=>`<article class="shop-card ${p.art?'shop-feature':''}"><div class="shop-art ${p.art||'funds'}" aria-hidden="true">${p.amount?`<span>FARM DOLLARS</span><strong>${p.amount}</strong>`:''}</div><div class="shop-copy"><small>${p.type}</small><h3>${p.name}</h3><p>${p.description}</p><button data-shop-item="${p.id}">${controller.offer(p.id)?.owned?'Owned':'View pack'}</button></div></article>`).join('');
  for(const el of grid.querySelectorAll('.shop-art.estate,.shop-art.tractor')){
   const canvas=document.createElement('canvas');canvas.width=300;canvas.height=210;el.append(canvas);const image=new Image();image.onload=()=>{
    const estate=el.classList.contains('estate'),sx=estate?0:Math.round(image.width*.59),sw=estate?Math.round(image.width*.59):image.width-sx,scale=Math.min(280/sw,190/image.height),w=sw*scale,h=image.height*scale;
    canvas.getContext('2d').drawImage(image,sx,0,sw,image.height,(300-w)/2,(210-h)/2,w,h);
   };image.src='assets/shop-exclusives-v1.png';
  }
  dialog.querySelector('[data-shop-restore]').disabled=!controller.available||controller.busy;
 }
 function showDetail(p){selected=p;grid.hidden=true;detail.hidden=false;const offer=controller.offer(p.id);detail.innerHTML=`<button data-shop-back>← All packs</button><p class="eyebrow">${p.type}</p><h3>${p.name}</h3><p>${p.detail}</p><p class="shop-terms">${p.amount?'Farm dollars are in-game currency, not real money.':'One-time purchase. This item is exclusive to the paid shop.'}</p><button class="primary" data-shop-buy ${!offer||offer.owned||controller.busy?'disabled':''}>${offer?.owned?'Owned':offer?'Buy · '+escape(offer.displayPrice):'Coming soon'}</button><p class="shop-terms">${offer?'Your device’s store will ask you to confirm the payment.':'Purchases are not open in this preview. No payment will be taken.'}</p>`;detail.querySelector('[data-shop-back]').focus();}
 async function refresh(){try{await controller.refresh();notify(controller.available?'Optional purchases · real money':'Shop preview · purchases are not open yet');}catch{notify('The store could not connect. Try again later.');}render();}
 dialog.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-shop-close')){if(!controller.busy)dialog.close();return;}
  if(b.dataset.shopCategory){category=b.dataset.shopCategory;selected=null;detail.hidden=true;grid.hidden=false;dialog.querySelectorAll('[data-shop-category]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));render();return;}
  if(b.dataset.shopItem){showDetail(SHOP_PRODUCTS.find(p=>p.id===b.dataset.shopItem));return;}
  if(b.hasAttribute('data-shop-back')){selected=null;detail.hidden=true;grid.hidden=false;render();grid.querySelector('button')?.focus();return;}
  if(b.hasAttribute('data-shop-buy')||b.hasAttribute('data-shop-restore')){
   if(controller.busy)return;b.disabled=true;notify('Checking with your store…');
   try{
    const r=b.hasAttribute('data-shop-buy')?await controller.purchase(selected.id):await controller.restore();
    if(r.status==='delivered'){await onDelivered();await refresh();notify('Purchase delivered to your property.');}
    else if(r.status==='restored'){await onDelivered();await refresh();notify('Purchases restored.');}
    else notify(r.status==='pending'?'Payment is pending. Your items will arrive once confirmed.':'Purchase cancelled. Nothing was added.');
   }catch(error){notify(error.message);}
   render();if(selected)showDetail(selected);
  }
 });
 dialog.addEventListener('cancel',e=>{if(controller.busy)e.preventDefault();});dialog.addEventListener('close',()=>lastFocus?.focus());
 return {async open(){lastFocus=document.activeElement;selected=null;detail.hidden=true;grid.hidden=false;dialog.showModal();render();await refresh();}};
}
