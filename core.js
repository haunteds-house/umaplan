// Original implementation. Models and data provenance are documented in SOURCES.md.
export const aptitudes = [
 ['Turf','proper_ground_turf','aptitudeTurf'],['Dirt','proper_ground_dirt','aptitudeDirt'],
 ['Sprint','proper_distance_short','aptitudeShort'],['Mile','proper_distance_mile','aptitudeMile'],
 ['Medium','proper_distance_middle','aptitudeMiddle'],['Long','proper_distance_long','aptitudeLong'],
 ['Front','proper_running_style_nige','aptitudeRunner'],['Pace','proper_running_style_senko','aptitudeLeader'],
 ['Late','proper_running_style_sashi','aptitudeBetweener'],['End','proper_running_style_oikomi','aptitudeChaser']];
export const grades = ['?','G','F','E','D','C','B','A','S'];
export const stats = ['speed','stamina','power','guts','wiz'];
export const categories = ['Stat','Aptitude','Race','Skill','Scenario','Unique'];
export const baseId = card => Math.floor(Number(card)/100);
const arr = x => Array.isArray(x)?x:[];
const positive = x => Number.isSafeInteger(Number(x)) && Number(x)>0;
export function decodeSpark(f, catalog) {
 const encoded=Number(typeof f==='number'?f:f.factor_id), explicit=Number(f.level);
 const id=encoded%10===0 && catalog.has(encoded)?encoded:Math.floor(encoded/10);
 const stars=encoded%10===0?explicit:encoded%10;
 if(!positive(id) || !Number.isInteger(stars) || stars<1 || stars>3) throw Error(`Invalid spark ${encoded}: stars must be 1–3.`);
 return {id,stars};
}
function nodeFromRaw(r,catalog) {
 const factors=arr(r.factor_info_array).map(f=>decodeSpark(f,catalog));
 if(new Set(factors.map(f=>f.id)).size!==factors.length) throw Error('Duplicate spark in one veteran.');
 return {cardId:Number(r.card_id),sparks:factors,wins:arr(r.win_saddle_id_array).map(Number),winsKnown:Array.isArray(r.win_saddle_id_array)};
}
export function normalizeImport(input,filename,catalog) {
 let rows=input;
 if(!Array.isArray(rows)) {
  const root=input?.data??input;
  const candidates=['trained_chara_array','trained_chara_list','trained_chara_data','trained_char_data','card_list','card_data','support_card_list','support_card_data'];
  rows=candidates.map(k=>root?.[k]).find(Array.isArray);
 }
 if(!Array.isArray(rows)) throw Error('Expected a JSON array or a supported API envelope.');
 if(!rows.length) throw Error('This file contains no records; nothing was replaced.');
 if(rows.length>30000) throw Error('Maximum 30,000 records per file.');
 const first=rows[0];
 const kind=first?.trained_chara_id!=null?'veterans':first?.support_card_id!=null?'supports':first?.card_id!=null?'trainees':null;
 if(!kind) throw Error('Cannot recognize this JSON as trainees, support cards, or veterans.');
 const key={veterans:'trained_chara_id',supports:'support_card_id',trainees:'card_id'}[kind];
 const ids=new Set();
 const data=rows.map((r,i)=>{
  if(!r || !positive(r[key]) || (kind!=='supports'&&!positive(r.card_id))) throw Error(`Record ${i+1} is missing a valid ${key} / card_id.`);
  const id=String(r[key]); if(ids.has(id)) throw Error(`Duplicate ${key}: ${id}.`);ids.add(id);
  if(kind==='supports') return {id,cardId:Number(r.support_card_id),level:Number(r.extra_data?.level??r.level)||null,limitBreak:Number(r.limit_break_count)||0,exp:Number(r.exp)||0};
  if(kind==='trainees')return {id,cardId:Number(r.card_id),rarity:Number(r.rarity)||0,talent:Number(r.talent_level)||0};
  const node=nodeFromRaw(r,catalog);
  const parents=arr(r.succession_chara_array).filter(p=>[10,20].includes(Number(p.position_id))).sort((a,b)=>a.position_id-b.position_id).map(p=>({...nodeFromRaw(p,catalog),position:Number(p.position_id)}));
  return {id,...node,parents,scenario:r.scenario_id==null?null:Number(r.scenario_id),stats:Object.fromEntries(stats.map(s=>[s,Number(r[s])||0])),aptitudes:Object.fromEntries(aptitudes.map(([label,key])=>[label,Number(r[key])||0])),rating:Number(r.rank_score)||0,rarity:Number(r.rarity)||0,skills:arr(r.skill_array).map(s=>({id:Number(s.skill_id),level:Number(s.level)||1})),memo:String(r.memo??''),date:String(r.create_time??r.register_time??'')};
 });
 return {kind,data,filename:String(filename),importedAt:new Date().toISOString()};
}
export function emptyNode() { return {cardId:0,sparks:[],wins:[],winsKnown:true,sourceId:null}; }
export function emptyPlan() { return {name:'Untitled lineage',nodes:Array.from({length:15},emptyNode),wanted:[],bought:{},searchMode:'inherit',includeSupports:false,borrowSSR:true,scenario:'auto',autoScenarios:['URA','Aoharu','MANT','GL'],trainingFocus:'balanced',trainingWeight:25,deck:[],rolls:2,parentRaceBonus:false,pins:[false,false]}; }
export function placeVeteran(plan,index,v) {
 const copy=structuredClone(plan); const put=(i,n)=>{if(i<15)copy.nodes[i]={cardId:n.cardId,sparks:structuredClone(n.sparks),wins:[...n.wins],winsKnown:n.winsKnown,sourceId:n.id??null};};
 put(index,v);
 for(let side=0;side<2;side++) {
  const child=index*2+side+1;if(child>=15)continue;
  copy.nodes[child]=emptyNode();
  for(const grand of [child*2+1,child*2+2])if(grand<15)copy.nodes[grand]=emptyNode();
  const p=v.parents?.find(p=>p.position===(side?20:10)); if(p)put(child,p);
 }
 return copy;
}
export function validateTree(nodes) {
 const problems=[];
 nodes.forEach((n,i)=>{
  if(!n.cardId)return;
  const a=nodes[i*2+1],b=nodes[i*2+2];
  if(a?.cardId && baseId(a.cardId)===baseId(n.cardId))problems.push(`Slot ${i+1} and its first parent are the same character.`);
  if(b?.cardId && baseId(b.cardId)===baseId(n.cardId))problems.push(`Slot ${i+1} and its second parent are the same character.`);
  if(a?.cardId && b?.cardId && baseId(a.cardId)===baseId(b.cardId))problems.push(`The two parents of slot ${i+1} are the same character.`);
 });
 return problems;
}
export class Engine {
 constructor(affinity,factors,races,links={}) {
  this.links=links;
  this.data=affinity;this.size=affinity.chars.length;this.index=new Map(affinity.chars.map((id,i)=>[id,i]));
  if(affinity.aff2.length!==this.size**2||affinity.aff3.length!==this.size**3)throw Error('Incomplete compatibility data.');
  this.factors=new Map(factors.map(f=>[Number(f.id),f]));this.races=races;
 }
 relation(...ids) {
  if(ids.some(id=>!id))return 0;
  if(ids.some(id=>!this.index.has(id)))return null;
  if(new Set(ids).size<ids.length)return 0;
  const indexes=ids.map(id=>this.index.get(id));
  return this.data[ids.length===2?'aff2':'aff3'][indexes.reduce((a,i)=>a*this.size+i,0)];
 }
 groups(n) {return new Set(n.wins.map(id=>this.races[id]?.group).filter(x=>x!=null));}
 shared(a,b) {const x=this.groups(a),y=this.groups(b);return [...x].filter(id=>y.has(id)).length*3;}
 evaluate(nodes,parentRaceBonus=false) {
  const n=nodes.slice(0,7),id=i=>baseId(n[i]?.cardId)||0;
  const issues=validateTree(n); let complete=n.every(x=>x?.cardId>0);
  if(!complete)issues.push('Fill the target, both parents, and all four grandparents for complete odds.');
  for(const x of n)if(x.cardId&&!this.index.has(baseId(x.cardId)))issues.push(`Compatibility data unavailable for character ${baseId(x.cardId)}.`);
  if(n.slice(1).some(x=>x.cardId&&!x.winsKnown))issues.push('Some race-win histories are missing; race bonuses may be understated.');
  const rel=(...x)=>this.relation(...x.map(id));
  const pair=rel(1,2)??0, pairRace=parentRaceBonus?this.shared(n[1],n[2]):0;
  const slots=Array(7).fill(0),branches=[];
  for(const p of [1,2]) {
   const g1=2*p+1,g2=g1+1,direct=rel(0,p)??0,t1=rel(0,p,g1)??0,t2=rel(0,p,g2)??0;
   const r1=this.shared(n[p],n[g1]),r2=this.shared(n[p],n[g2]);
   slots[p]=direct+t1+t2+r1+r2+pair+pairRace;slots[g1]=t1+r1;slots[g2]=t2+r2;
   branches.push({direct,triples:t1+t2,race:r1+r2,total:direct+t1+t2+r1+r2});
  }
  const total=branches.reduce((s,b)=>s+b.total,0)+pair+pairRace;
  const invalid=validateTree(n).length>0||n.some(x=>x.cardId&&!this.index.has(baseId(x.cardId)));
  return {total,slots,branches,pair,pairRace,issues,complete:complete&&!invalid};
 }
 odds(nodes,evaluation,rolls=2) {
  const sources=new Map();
  const present=new Set(nodes.slice(1,7).flatMap(n=>n.sparks.map(f=>f.id)));
  for(const id of [...present])for(const alias of this.links.factorAliases?.[id]??[])present.add(alias);
  for(const id of present){
   const meta=this.factors.get(id);if(!meta)continue;
   const aliases=this.links.factorAliases?.[id]??[id];
   nodes.slice(1,7).forEach((n,i)=>{
    // One contribution per ancestor, including when both scenario forms exist.
    const f=n.sparks.find(f=>f.id===id)??n.sparks.filter(f=>aliases.includes(f.id)).sort((a,b)=>b.stars-a.stars)[0];
    if(!f)return;const p=sparkProbability(meta.type,f.stars,evaluation.slots[i+1]);if(p===null)return;
    const a=sources.get(id)??[];a.push({slot:i+1,stars:f.stars,p});sources.set(id,a);
   });
  }
  return [...sources].map(([id,src])=>{
   const ps=src.flatMap(s=>Array(rolls).fill(s.p));const d=distribution(ps);
   return {id,sources:src,copies:src.length,stars:src.reduce((a,s)=>a+s.stars,0),chance:1-d[0],twice:1-d[0]-(d[1]??0),expected:ps.reduce((a,p)=>a+p,0)};
  }).sort((a,b)=>b.chance-a.chance);
 }
}
export function sparkProbability(type,stars,affinity) {
 const base={0:[70,80,90],1:[1,3,5],2:[1,2,3],3:[3,6,9],4:[3,6,9],5:[5,10,15]}[type];
 if(!base||stars<1||stars>3)return null;
 return Math.min(1,Math.max(0,base[stars-1]/100*(1+affinity/100)));
}
export function distribution(probabilities) {
 let d=[1];for(const p of probabilities){const next=Array(d.length+1).fill(0);d.forEach((v,i)=>{next[i]+=v*(1-p);next[i+1]+=v*p;});d=next;}return d;
}
export function creationChance(copies,tier='white') {return Math.min(1,({white:.2,upgraded:.25,gold:.4}[tier]??.2)*1.1**copies);}
export function pairNodes(target,a,b) {
 const n=Array.from({length:7},emptyNode);n[0]=target;n[1]=a;n[2]=b;
 for(const [p,v] of [[1,a],[2,b]])for(let side=0;side<2;side++){const gp=v.parents?.find(x=>x.position===(side?20:10));if(gp)n[p*2+1+side]=gp;}
 return n;
}
export function baselineEvaluation(nodes) {
 return {total:0,slots:Array(7).fill(0),branches:[{direct:0,triples:0,race:0},{direct:0,triples:0,race:0}],pair:0,pairRace:0,complete:!validateTree(nodes).length,issues:['No target: affinity-free baseline. Only recorded ancestor sparks are counted; these are not target-specific career odds.']};
}
export function desiredChance(engine,plan,id,odds) {
 const row=odds.find(o=>o.id===id),inherit=row?.chance??0;
 if(plan.searchMode!=='sparkgen'||engine.factors.get(id)?.type!==3)return inherit;
 const bought=plan.bought?.[id]??{};
 return creationChance(row?.copies??0,bought.inspirationOnly?'white':bought.tier)*(bought.inspirationOnly?inherit:1);
}
// Joint odds are an estimate: marginal probabilities do not establish independence.
// Alias forms describe the same outcome, so do not multiply them twice.
export function summarizeChances(chances,ids=[],aliases={}) {
 if(!chances.length)return {average:null,allChance:null,expectedRuns:null};
 if(chances.some(p=>!Number.isFinite(p)||p<0||p>1))throw Error('Invalid outcome probability.');
 const groups=[];
 chances.forEach((p,i)=>{
  const keys=new Set([ids[i]??`index:${i}`,...(aliases[ids[i]]??[])]);
  const overlaps=groups.filter(g=>[...keys].some(k=>g.keys.has(k)));
  for(const g of overlaps){for(const key of g.keys)keys.add(key);p=Math.min(p,g.p);groups.splice(groups.indexOf(g),1);}
  groups.push({keys,p});
 });
 const allChance=groups.reduce((p,g)=>p*g.p,1);
 return {average:chances.reduce((s,p)=>s+p,0)/chances.length,allChance,expectedRuns:allChance?1/allChance:Infinity};
}
export function scorePair(engine,plan,a,b) {
 if(baseId(a.cardId)===baseId(b.cardId)||[a,b].some(x=>baseId(x.cardId)===baseId(plan.nodes[0].cardId)))return null;
 const nodes=pairNodes(plan.nodes[0],a,b),ev=plan.nodes[0].cardId?engine.evaluate(nodes,plan.parentRaceBonus):baselineEvaluation(nodes);
 if(!ev.complete)return null;
 const odds=engine.odds(nodes,ev,plan.rolls);
 const chances=plan.wanted.map(id=>desiredChance(engine,plan,id,odds));
 return {a:a.id,b:b.id,total:ev.total,baseline:!plan.nodes[0].cardId,min:chances.length?Math.min(...chances):0,sum:chances.reduce((s,c)=>s+c,0),chances,...summarizeChances(chances,plan.wanted,engine.links.factorAliases)};
}
export const comparePairs=(a,b)=>(a.combinedScore!=null&&b.combinedScore!=null?b.combinedScore-a.combinedScore:0)||b.min-a.min||b.sum-a.sum||b.total-a.total||String(a.a).localeCompare(String(b.a))||String(a.b).localeCompare(String(b.b));
