export const title='Sky Stack',hook='How high can you go?',cta='Tovelly Studios',footer='More games on our channel',bpm=120;
export async function prepare(page){
 await page.route('**/game.js',async route=>{const r=await route.fetch();let s=await r.text();s=s.replace('export default {','const game = {');s+='\nexport default {...game,create(ctx){const instance=game.create(ctx);window.__reelInspect=()=>instance.inspect();return instance;}};';await route.fulfill({response:r,body:s});});
}
export async function play(p,{until,wait,cue}){
 await wait(800);await p.getByRole('button',{name:'Play',exact:true}).click();let last=0;
 while(Date.now()<until){const s=await p.evaluate(()=>window.__reelInspect?.());if(!s)throw Error('Missing read-only inspection');if(s.count>last){cue(s.streak?'clear':'place');last=s.count;}if(s.phase==='ended')break;
 if(s.phase==='moving'&&Math.abs(s.moving.x-s.top.x)<3){await p.keyboard.press('Space');}
 await wait(22);
 }
 console.log('Floors built:',last);await wait(600);
}
