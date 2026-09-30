import {factionArt} from './factions.mjs';
export const AGES=[
{id:'frontier',name:'Frontier Age',xp:0,art:'frontier',production:1,fortress:1,maxBuilding:2,workers:0,features:[],description:'Timber halls, thatched roofs and hand tools. Establish your first settlement.'},
{id:'stone',name:'Castle Age',xp:220,art:'building',production:1.15,fortress:1.2,maxBuilding:3,workers:2,features:['archery','masonry'],product:'crown.age.stone',description:'Stone keeps and workshops. +15% production, +20% keep health, two extra workers, archery and fortifications.'},
{id:'imperial',name:'Imperial Age',xp:1500,art:'imperial',production:1.35,fortress:1.5,maxBuilding:5,workers:4,features:['archery','masonry','cavalry','steel','siege'],product:'crown.age.imperial',description:'Grand fortified stone architecture. +35% production, +50% keep health, four extra workers, cavalry, steel and siege.'}
];
export function ageOf(s,paid=[]){return [...AGES].reverse().find(a=>s.xp>=a.xp||paid.includes(a.product)||s.ageUnlocks?.includes(a.id))||AGES[0];}
export const buildingArt=(s,art)=>factionArt(s,ageOf(s).art+'-'+art);

