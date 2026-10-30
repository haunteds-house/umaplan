import {createTrainingModel,combinedScore} from './training.js';
import {baseId,pairNodes,baselineEvaluation,creationChance,summarizeChances,comparePairs} from './core.js';
const tierName=n=>n===3?'gold':n===2?'upgraded':'white';
const rank=s=>s?.rarity===2?3:s?.skillName?.endsWith('◎')?2:1;
// Bounded skill-coverage search, not a training-stat simulator or an exhaustive solver.
export function prepareDecks({plan,supports,ownedSupports,skills,links,characters=[]}) {
 const training=createTrainingModel(plan,characters),weight=Math.min(1,Math.max(0,Number(plan.trainingWeight??25)/100));
 const wanted=plan.wanted,skillMap=new Map(skills.map(s=>[s.skillId,s]));
 const skillIds=wanted.map(id=>links.factorSkills?.[id]??[]);
 const sources=(kind,entityId)=>skillIds.map(ids=>{
  const found=[];for(const id of ids)for(const field of kind==='support'?['supportHints','supportEvents']:['characters','characterEvents'])for(const source of links.skills?.[id]?.[field]??[])if(source.id===entityId)found.push({skillId:id,skillName:skillMap.get(id)?.skillName??`Skill ${id}`,tier:rank(skillMap.get(id)),kind:field,detail:source.detail});
  return found.sort((a,b)=>b.tier-a.tier)[0]??null;
 });
 const target=baseId(plan.nodes[0].cardId),catalog=new Map(supports.map(s=>[s.supportCardId,s]));
 const candidate=(meta,owned,borrowed)=>({id:meta.supportCardId,charaId:meta.charaId,borrowed,level:borrowed?({1:40,2:45,3:50}[meta.rarity]):owned.level??null,limitBreak:borrowed?4:owned.limitBreak??0,rarity:meta.rarity,type:meta.supportCardTypeName,sources:sources('support',meta.supportCardId)});
 const owned=[...new Map(ownedSupports.map(o=>[o.cardId,o])).values()].map(o=>catalog.has(o.cardId)?candidate(catalog.get(o.cardId),o,false):null).filter(c=>c&&c.charaId!==target);
 const borrowed=supports.filter(s=>s.charaId!==target&&(!plan.borrowSSR||s.rarity===3)).map(s=>candidate(s,null,true));
 if(new Set(owned.map(c=>c.charaId)).size<5)throw Error('Deck mode needs at least five owned support characters, excluding the target. Import support_card_data.json or turn deck mode off.');
 const targetSources=plan.nodes[0].cardId?sources('character',plan.nodes[0].cardId):wanted.map(()=>null);
 const seed={cards:[],tiers:targetSources.map(s=>s?.tier??0),quality:0};
 const value=d=>d.tiers.reduce((n,t,i)=>n+(plan.bought?.[wanted[i]]?.inspirationOnly?0:t?10+t:0),0);
 const beamValue=d=>(1-weight)*value(d)/Math.max(1,wanted.length*13)+weight*d.quality/(d.quality+3000);
 const order=(a,b)=>beamValue(b)-beamValue(a)||b.quality-a.quality||a.cards.map(c=>c.id).join(',').localeCompare(b.cards.map(c=>c.id).join(','));
 const extend=(d,c)=>({cards:[...d.cards,c],tiers:d.tiers.map((t,i)=>Math.max(t,c.sources[i]?.tier??0)),quality:d.quality+training.standalone(c)});
 let beam=[seed];
 for(let slot=0;slot<5;slot++){
  const next=new Map();for(const d of beam)for(const c of owned){if(d.cards.some(x=>x.charaId===c.charaId))continue;const x=extend(d,c),key=x.cards.map(c=>c.id).sort((a,b)=>a-b).join(',');if(!next.has(key))next.set(key,x);}
  beam=[...next.values()].sort(order).slice(0,128);
 }
 const profiles=new Map();
 for(const d of beam)for(const c of borrowed){if(d.cards.some(x=>x.charaId===c.charaId))continue;const x=extend(d,c),key=x.tiers.join(',')+'|'+x.cards.map(c=>c.type).sort().join(',');if(!profiles.has(key)||order(x,profiles.get(key))<0)profiles.set(key,x);}
 const decks=[...profiles.values()].sort(order).slice(0,64).map(d=>({...d,targetSources,training:training.evaluate(d.cards)}));
 if(!decks.length)throw Error('No legal five-owned + one-borrowed deck is available for this target.');
 return decks;
}
export function scorePairWithDeck(engine,plan,a,b,base,decks){
 const nodes=pairNodes(plan.nodes[0],a,b),ev=plan.nodes[0].cardId?engine.evaluate(nodes,plan.parentRaceBonus):baselineEvaluation(nodes);
 const odds=new Map(engine.odds(nodes,ev,plan.rolls).map(o=>[o.id,o]));
 let best=null;
 for(const deck of decks){
  const acquisition=[];
  const chances=plan.wanted.map((id,i)=>{
   const o=odds.get(id),inherit=o?.chance??0;
   if(engine.factors.get(id)?.type!==3){acquisition.push({kind:'inheritance',chance:inherit});return inherit;}
   const only=plan.bought?.[id]?.inspirationOnly,available=!only&&deck.tiers[i]>0;
   let source=null;if(available){source=deck.targetSources[i]?.tier===deck.tiers[i]?{...deck.targetSources[i],entityId:plan.nodes[0].cardId}:null;for(const c of deck.cards)if(!source&&c.sources[i]?.tier===deck.tiers[i])source={...c.sources[i],entityId:c.id,borrowed:c.borrowed};}
   acquisition.push(available?{...source,kind:source.kind,conditional:true}:{kind:'inspiration',chance:inherit});
   return creationChance(o?.copies??0,available?tierName(deck.tiers[i]):'white')*(available?1:inherit);
  });
  const score={...base,chances,min:chances.length?Math.min(...chances):0,sum:chances.reduce((s,p)=>s+p,0),...summarizeChances(chances,plan.wanted,engine.links.factorAliases),deck:deck.cards.map(({sources,...c})=>c),acquisition,deckQuality:deck.quality,training:deck.training,combinedScore:combinedScore(chances,deck.training.score,Math.min(1,Math.max(0,Number(plan.trainingWeight??25)/100)))};
  if(!best||comparePairs(score,best)<0||comparePairs(score,best)===0&&score.deckQuality>best.deckQuality)best=score;
 }
 return best;
}
