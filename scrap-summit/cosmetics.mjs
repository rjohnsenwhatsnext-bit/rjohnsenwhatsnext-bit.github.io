// Presentation-only catalogue. No physics parameters belong in this module.
export const CHARACTERS=Object.freeze([
 {id:'original',name:'Mack',subtitle:'The original bad idea.',asset:'assets/climber.webp',color:'#9a674c',free:true},
 {id:'rhea',name:'Rhea',subtitle:'Rescue gear. Questionable rescue plan.',asset:'assets/cosmetics/rhea.webp',color:'#d88b47'},
 {id:'flint',name:'Flint',subtitle:'Old gold. Older grudges.',asset:'assets/cosmetics/flint.webp',color:'#a18766'},
 {id:'nova',name:'Nova',subtitle:'Tomorrow’s kit. Today’s terrible idea.',asset:'assets/cosmetics/nova.webp',color:'#429b9f'},
 {id:'bram',name:'Bram',subtitle:'Built like a barrel. Travels in one.',asset:'assets/cosmetics/bram.webp',color:'#5c7968'},
].map(v=>Object.freeze({...v,type:'character',productId:v.free?null:'scrapsummit.character.'+v.id})));
export const TOOLS=Object.freeze([
 {id:'original',name:'Old Reliable',subtitle:'The sledge that started it.',free:true,handle:'#b7844e',metal:'#aabcc4'},
 {id:'icepick',name:'Alpine Pick',subtitle:'Cold steel. Clean lines.',handle:'#379ca8',metal:'#bbebee'},
 {id:'fireaxe',name:'Firebreak',subtitle:'Rescue red. All attitude.',handle:'#a44031',metal:'#e35942'},
 {id:'wrench',name:'Pipe Dream',subtitle:'Industrial-strength optimism.',handle:'#b48539',metal:'#d5ac51'},
 {id:'gold',name:'Midas',subtitle:'A little excess at high altitude.',handle:'#423539',metal:'#edc873'},
 {id:'carbon',name:'Nightfall',subtitle:'Carbon black. Electric violet.',handle:'#544970',metal:'#ac9cd9'},
].map(v=>Object.freeze({...v,type:'tool',asset:v.free?null:'assets/cosmetics/'+v.id+'.webp',productId:v.free?null:'scrapsummit.tool.'+v.id})));
export const ITEMS=Object.freeze([...CHARACTERS,...TOOLS]);
export const PRODUCTS=Object.freeze(ITEMS.filter(v=>v.productId).map(v=>v.productId));
export const safeAppearance=(a={})=>({character:CHARACTERS.some(v=>v.id===a?.character)?a.character:'original',tool:TOOLS.some(v=>v.id===a?.tool)?a.tool:'original'});
const key='scrapsummit.outfit.v1';
export function createWardrobe({storage,billing=null,allowPreview=false,onChange=()=>{}}={}){
 let preferred={character:'original',tool:'original'};try{preferred=safeAppearance(JSON.parse(storage?.getItem(key)||'{}'));}catch{}
 let equipped={...preferred},trial={},owned=new Set(),prices=new Map(),busy=false,status='',available=false;
 const has=item=>item.free||owned.has(item.productId);
 const current=()=>safeAppearance({...equipped,...trial});
 const emit=()=>onChange();
 const normalize=()=>{for(const type of ['character','tool']){const item=ITEMS.find(v=>v.type===type&&v.id===equipped[type]);if(!has(item))equipped[type]='original';}};
 normalize();
 const save=()=>{try{storage?.setItem(key,JSON.stringify(equipped));}catch{status='This device could not remember your outfit.';}};
 async function entitlements(){const result=await billing.getEntitlements();if(result?.verified!==true||!Array.isArray(result.productIds))throw Error('Ownership could not be verified. Try again.');owned=new Set(result.productIds.filter(id=>PRODUCTS.includes(id)));normalize();}
 return {
  current,owns:has,
  get state(){return {busy,status,available,preview:Object.keys(trial).length>0,allowPreview};},
  price:item=>prices.get(item.productId)||'',
  async refresh(){if(busy)return;if(!billing){status=allowPreview?'Try every look in this browser. Purchases open with the mobile store.':'The store is not available yet.';emit();return;}busy=true;emit();try{const products=await billing.listProducts({productIds:PRODUCTS});prices=new Map((Array.isArray(products)?products:[]).filter(p=>PRODUCTS.includes(p.id)&&typeof p.displayPrice==='string'&&p.displayPrice.length>0).map(p=>[p.id,p.displayPrice]));await entitlements();for(const type of ['character','tool']){const wanted=ITEMS.find(v=>v.type===type&&v.id===preferred[type]);if(has(wanted))equipped[type]=wanted.id;}available=true;status='One-time cosmetic unlocks. Same climbing ability.';}catch(e){available=false;status=e.message||'Store unavailable. Try again.';}finally{busy=false;emit();}},
  equip(item){if(busy||!ITEMS.includes(item)||!has(item))return false;equipped[item.type]=item.id;preferred={...equipped};delete trial[item.type];save();emit();return true;},
  preview(item){if(busy||!allowPreview||!ITEMS.includes(item))return false;trial[item.type]=item.id;status='Trying '+item.name+' for this session. Nothing purchased.';emit();return true;},
  clearPreview(){trial={};emit();},
  async buy(item){if(busy||!available||!ITEMS.includes(item)||!item.productId||!prices.has(item.productId)||has(item))return false;busy=true;status='Waiting for the store…';emit();try{const result=await billing.purchase({productId:item.productId});if(result?.status==='cancelled'){status='Purchase cancelled. Nothing changed.';return false;}if(result?.status==='pending'){status='Purchase pending. It will unlock after confirmation.';return false;}if(result?.status!=='purchased')throw Error('The purchase did not complete.');await entitlements();if(!has(item))throw Error('Purchase received; ownership is still being confirmed.');equipped[item.type]=item.id;preferred={...equipped};delete trial[item.type];save();status=item.name+' unlocked and equipped.';return true;}catch(e){status=e.message||'Purchase unavailable. Try again.';return false;}finally{busy=false;emit();}},
  async restore(){if(busy||!billing)return;busy=true;status='Restoring purchases…';emit();try{await billing.restore();await entitlements();status='Purchases restored. Choose an owned item to equip.';}catch(e){status=e.message||'Restore failed. Try again.';}finally{busy=false;emit();}},
 };
}
