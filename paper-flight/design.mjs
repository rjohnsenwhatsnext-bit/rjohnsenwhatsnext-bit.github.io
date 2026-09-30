import {createSheet,fold,flip,openCrease,addClip} from './physics/paper.mjs';
import {withElevators} from './physics/recipes.mjs';
export const blank=()=>createSheet({width:.297,length:.21});
const C=.1485,roll=.022,L=.21,keel=.016;
export const guide=[
{name:'Give the nose some weight',text:'Fold the top strip down. This adds weight at the leading edge without adding any paper.',line:[[-.02,.188],[.32,.188]],run:s=>fold(s,{a:[-.02,.188],b:[.32,.188],move:[C,.209]})},
{name:'Roll the leading edge again',text:'Another fold keeps the nose firm and brings the weight forward.',line:[[-.02,.166],[.32,.166]],run:s=>fold(s,{a:[-.02,.166],b:[.32,.166],move:[C,.187]})},
{name:'One last nose fold',text:'The third roll makes a sturdy leading edge for a broad-wing glider.',line:[[-.02,.144],[.32,.144]],run:s=>fold(s,{a:[-.02,.144],b:[.32,.144],move:[C,.165]})},
{name:'Make the centre crease',text:'Fold the left half over the right. This becomes the body you hold.',line:[[C,-.02],[C,.23]],run:s=>fold(s,{a:[C,-.02],b:[C,.23],move:[.01,.05]})},
{name:'Fold the first wing',text:'Leave a small keel under the wing. Only this half of the paper moves.',line:[[C+keel,-.02],[C+keel,.23]],run:s=>fold(s,{a:[C+keel,-.02],b:[C+keel,.23],move:[C+keel+.04,.05],layers:{flap:3}})},
{name:'Fold the other wing underneath',text:'The opposite half folds the other way. Both wings need to match.',line:[[C+keel,-.02],[C+keel,.23]],run:s=>fold(s,{a:[C+keel,-.02],b:[C+keel,.23],move:[C+keel+.04,.05],kind:'mountain',layers:{notFlap:3}})},
{name:'Open the wings',text:'Lift each wing to 90°, then open the centre crease 10°. Now it is a three-dimensional aeroplane.',run:s=>openCrease(openCrease(openCrease(s,4,90),5,90),3,10)},
{name:'Turn up the tail tips',text:'A little tail bend helps it glide. Too much can make it climb, stall or strike a doorway. Tune this after a test flight.',run:s=>withElevators(s,4,{wings:[4,5]})}
];
export function apply(s,op){if(op.type==='guide'){if(!guide[op.index])throw Error('Unknown tutorial step');return guide[op.index].run(s);}if(op.type==='fold'){if(s.folds.length>=24)throw Error('This sheet has reached 24 creases. Undo a fold to keep experimenting.');if(![...op.a,...op.b,...op.move].every(x=>Number.isFinite(x)&&Math.abs(x)<2))throw Error('Invalid fold');return fold(s,op);}if(op.type==='open')return openCrease(s,op.index,op.angle);if(op.type==='flip')return flip(s);if(op.type==='trim')return openCrease(openCrease(s,6,180-op.angle),7,180+op.angle);if(op.type==='clip')return addClip(s,[s.width/2,s.length-.018],.0005);throw Error('Unknown paper operation');}
export function replay(ops){if(!Array.isArray(ops)||ops.length>100)throw Error('Invalid saved design');return ops.reduce(apply,blank());}
