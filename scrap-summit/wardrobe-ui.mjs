import {CHARACTERS,TOOLS,ITEMS,createWardrobe,safeAppearance} from './cosmetics.mjs';
import {drawClimber,artReady} from './draw.mjs';
const $=id=>document.getElementById(id);
export function initWardrobe({open,close}){
 const native=Boolean(globalThis.Capacitor?.isNativePlatform?.());
 let storage;try{storage=localStorage;}catch{}
 let tab='character',selected=CHARACTERS[0];
 const wardrobe=createWardrobe({storage,billing:native?globalThis.ScrapSummitBilling:null,allowPreview:!native,onChange:render});
 function preview(){const cv=$('outfitPreview'),g=cv.getContext('2d');g.clearRect(0,0,cv.width,cv.height);const a=safeAppearance({...wardrobe.current(),[selected.type]:selected.id});drawClimber(g,{body:{x:0,y:0},head:{ox:1.45,oy:.35},t:0},(x,y)=>[158+x*112,228-y*112],112,{appearance:a,reduced:true});}
 function render(){
  const s=wardrobe.state,a=wardrobe.current(),owned=wardrobe.owns(selected),active=a[selected.type]===selected.id;
  $('shopName').textContent=selected.name;$('shopDescription').textContent=selected.subtitle;
  $('shopStatus').textContent=s.status;$('outfitLabel').textContent=s.preview?'Preview outfit · resets on reload':'';
  const avatar=CHARACTERS.find(v=>v.id===a.character);document.querySelector('.menu-climber img').src=avatar.asset;document.querySelector('.menu-climber img').alt=avatar.name+' climbing character';
  $('shopOwned').textContent=selected.free?'Included':owned?'Owned':'Cosmetic unlock';
  $('equipCosmetic').textContent=owned?(active?'Equipped':'Equip'):(active&&s.preview?'Trying this look':'Try this look');
  $('equipCosmetic').disabled=s.busy||(owned&&active)||(!owned&&!s.allowPreview);$('equipCosmetic').classList.toggle('hidden',!owned&&!s.allowPreview);
  $('buyCosmetic').classList.toggle('hidden',owned);$('buyCosmetic').disabled=s.busy||!s.available||!wardrobe.price(selected);$('buyCosmetic').textContent=s.available&&wardrobe.price(selected)?'Unlock · '+wardrobe.price(selected):'Purchases coming soon';
  $('restoreCosmetics').disabled=s.busy||!s.available;$('resetPreview').classList.toggle('hidden',!s.preview);$('resetPreview').disabled=s.busy;
  for(const type of ['character','tool'])$('tab-'+type).setAttribute('aria-selected',String(tab===type));
  const focus=document.activeElement?.dataset?.item;const list=tab==='character'?CHARACTERS:TOOLS,grid=$('cosmeticGrid');grid.replaceChildren();
  for(const item of list){const btn=document.createElement('button');btn.className='cosmetic-card'+(selected===item?' selected':'');btn.dataset.item=item.type+':'+item.id;btn.setAttribute('aria-pressed',String(selected===item));btn.disabled=s.busy;
   const img=document.createElement('img');img.src=item.asset||(item.type==='tool'?'assets/cosmetics/hammer.webp':'assets/climber.webp');img.alt='';img.className=item.type;
   const name=document.createElement('strong');name.textContent=item.name;const label=document.createElement('small');label.textContent=a[item.type]===item.id?(wardrobe.owns(item)?'Equipped':'Trying'):wardrobe.owns(item)?'Owned':wardrobe.price(item)||'Preview';btn.append(img,name,label);btn.onclick=()=>{selected=item;render();};grid.append(btn);
  }
  if(focus)grid.querySelector('[data-item="'+focus+'"]')?.focus({preventScroll:true});
  preview();
 }
 const show=()=>{selected=ITEMS.find(v=>v.type===tab&&v.id===wardrobe.current()[tab]);open('shop');render();wardrobe.refresh();};
 $('openShop').onclick=show;$('settingsShop').onclick=()=>{close('settings');show();};$('closeShop').onclick=()=>close('shop');
 $('tab-character').onclick=()=>{tab='character';selected=CHARACTERS.find(v=>v.id===wardrobe.current().character);render();};
 $('tab-tool').onclick=()=>{tab='tool';selected=TOOLS.find(v=>v.id===wardrobe.current().tool);render();};
 for(const type of ['character','tool'])$('tab-'+type).onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'character':e.key==='End'?'tool':type==='character'?'tool':'character';$('tab-'+next).click();$('tab-'+next).focus();}};
 $('equipCosmetic').onclick=()=>{wardrobe.owns(selected)?wardrobe.equip(selected):wardrobe.preview(selected);};
 $('buyCosmetic').onclick=()=>wardrobe.buy(selected);$('restoreCosmetics').onclick=()=>wardrobe.restore();$('resetPreview').onclick=()=>wardrobe.clearPreview();
 artReady.then(render);render();if(native)wardrobe.refresh();return wardrobe;
}
