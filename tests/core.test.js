import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Engine,decodeSpark,normalizeImport,emptyPlan,emptyNode,placeVeteran,validateTree,sparkProbability,distribution,creationChance,scorePair,pairNodes,baselineEvaluation,desiredChance,comparePairs} from '../core.js';
const load=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const engine=new Engine(load('affinity'),load('factors'),load('races'),load('skill-links'));
const raw=(id,card=100101)=>({trained_chara_id:id,card_id:card,speed:900,rank_score:10000,factor_info_array:[{factor_id:103,level:0}],win_saddle_id_array:[],succession_chara_array:[{position_id:20,card_id:100401,factor_info_array:[{factor_id:3202,level:0}],win_saddle_id_array:[]},{position_id:10,card_id:100301,factor_info_array:[{factor_id:103,level:0}],win_saddle_id_array:[]}]});
test('umadump zero level uses encoded stars; explicit base IDs remain supported',()=>{assert.deepEqual(decodeSpark({factor_id:103,level:0},engine.factors),{id:10,stars:3});assert.deepEqual(decodeSpark({factor_id:10,level:2},engine.factors),{id:10,stars:2});assert.throws(()=>decodeSpark({factor_id:104,level:0},engine.factors));});
test('imports detect contents rather than filename and preserve ancestry positions',()=>{const r=normalizeImport([raw(1)],'trained_char_data.json',engine.factors);assert.equal(r.kind,'veterans');assert.deepEqual(r.data[0].parents.map(p=>p.position),[10,20]);assert.equal(r.data[0].sparks[0].stars,3);assert.equal(r.data[0].stats.speed,900);assert.equal(r.data[0].winsKnown,true);assert.equal('viewer_id' in r.data[0],false);});
test('support levels use extra_data and trainees import independently',()=>{assert.equal(normalizeImport([{support_card_id:30001,extra_data:{level:50},limit_break_count:4}],'x',engine.factors).data[0].level,50);assert.equal(normalizeImport([{card_id:100101,rarity:3,talent_level:5}],'x',engine.factors).kind,'trainees');});
test('invalid, duplicate and empty imports fail before application',()=>{for(const input of [[],[raw(1),raw(1)],[raw(1),{}],{wrong:[]}])assert.throws(()=>normalizeImport(input,'x',engine.factors));});
test('replacement veteran fills ancestry and clears descendants without mutating input',()=>{const p=emptyPlan();p.nodes[7].cardId=100901;const v=normalizeImport([raw(1)],'x',engine.factors).data[0];const result=placeVeteran(p,1,v);assert.equal(result.nodes[3].cardId,100301);assert.equal(result.nodes[4].cardId,100401);assert.equal(result.nodes[7].cardId,0);assert.equal(p.nodes[7].cardId,100901);});
test('character restrictions apply across outfits; cousins may repeat',()=>{const p=emptyPlan();p.nodes[0].cardId=100101;p.nodes[1].cardId=100102;assert.equal(validateTree(p.nodes).length,1);p.nodes[1].cardId=100201;p.nodes[2].cardId=100202;assert.equal(validateTree(p.nodes).length,1);p.nodes[2].cardId=100301;p.nodes[3].cardId=100401;p.nodes[5].cardId=100401;assert.equal(validateTree(p.nodes).length,0);});
test('independent probabilities use two separate rolls rather than adding percentages',()=>{const p=sparkProbability(1,3,0);assert.equal(p,.05);assert.ok(Math.abs(1-distribution([p,p])[0]-.0975)<1e-12);assert.equal(sparkProbability(0,3,100),1);assert.equal(sparkProbability(-1,3,100),null);assert.ok(Math.abs(creationChance(2)-.242)<1e-12);});
test('G1 bonuses deduplicate saddle IDs by group',()=>{const entries=Object.entries(engine.races);const [id,r]=entries[0],same=entries.filter(([i,v])=>v.group===r.group).map(([i])=>Number(i));const a={wins:same},b={wins:[Number(id)]};assert.equal(engine.shared(a,b),3);assert.equal(engine.shared({wins:[999999]},b),0);});
test('unknown compatibility is explicit, incomplete lineage cannot be ranked',()=>{assert.equal(engine.relation(9999,1001),null);const p=emptyPlan();p.nodes[0].cardId=100501;const v=normalizeImport([raw(1),raw(2,100201)],'x',engine.factors).data;const n=pairNodes(p.nodes[0],...v),ev=engine.evaluate(n);assert.equal(ev.complete,true);assert.ok(ev.total>0);assert.equal(scorePair(engine,p,...v).total,ev.total);v[0].parents=[];assert.equal(scorePair(engine,p,...v),null);});
test('parent finder ignores legacy threshold but enforces same-character restriction',()=>{const p=emptyPlan();p.nodes[0].cardId=100501;p.wanted=[320];p.minChance=99;const v=normalizeImport([raw(1),raw(2,100201)],'x',engine.factors).data;assert.ok(scorePair(engine,p,...v));assert.equal(scorePair(engine,p,v[0],{...v[1],cardId:100102}),null);});
test('optional parent-to-parent rule adds once to total and to each parent, not grandparents',()=>{const p=emptyPlan();p.nodes[0].cardId=100501;const v=normalizeImport([raw(1),raw(2,100201)],'x',engine.factors).data;const id=Number(Object.keys(engine.races)[0]);v.forEach(v=>v.wins=[id]);const nodes=pairNodes(p.nodes[0],...v);const off=engine.evaluate(nodes,false),on=engine.evaluate(nodes,true);assert.equal(on.total-off.total,3);assert.equal(on.slots[1]-off.slots[1],3);assert.equal(on.slots[3]-off.slots[3],0);});
test('bundled catalog integrity and dimensions',()=>{assert.ok(load('characters').length>100);assert.ok(load('skills').every(s=>typeof s.activationCondition==='string'));assert.equal(new Set(load('factors').map(f=>f.id)).size,load('factors').length);assert.ok(engine.data.chars.includes(1001));});

test('target-free search never calls affinity or shared-race calculations',()=>{
 const p=emptyPlan();p.wanted=[320];p.parentRaceBonus=true;
 const v=normalizeImport([raw(1),raw(2,100201)],'x',engine.factors).data;
 const e=new Engine(load('affinity'),load('factors'),load('races'),load('skill-links'));
 e.evaluate=()=>{throw Error('No affinity permitted');};e.shared=()=>{throw Error('No race bonus permitted');};
 const r=scorePair(e,p,...v);assert.equal(r.total,0);assert.equal(r.baseline,true);
 assert.ok(Math.abs(r.chances[0]-(1-(1-.03)**4))<1e-12);
 v[0].cardId=999901;v[0].parents=[];assert.ok(scorePair(e,p,...v));
});
test('scenario normal/plus sparks count interchangeably, once per ancestor',()=>{
 const normal=210090,plus=210150,p=emptyPlan();p.nodes[1]={...emptyNode(),cardId:100101,sparks:[{id:plus,stars:3}]};
 let odds=engine.odds(p.nodes,baselineEvaluation(p.nodes),2);const result=id=>odds.find(o=>o.id===id);
 assert.equal(result(normal).copies,1);assert.equal(result(normal).chance,result(plus).chance);
 p.nodes[1].sparks.push({id:normal,stars:3});odds=engine.odds(p.nodes,baselineEvaluation(p.nodes),2);
 assert.equal(result(normal).copies,1);assert.equal(result(plus).copies,1);
 assert.ok(Math.abs(result(normal).chance-(1-.91**2))<1e-12);
});
test('expected gold and inspiration-only learning change career creation probability',()=>{
 const id=210050,p=emptyPlan();p.searchMode='sparkgen';p.wanted=[id];p.nodes[1].sparks=[{id,stars:3}];
 const odds=engine.odds(p.nodes,baselineEvaluation(p.nodes),2);
 p.bought[id]={tier:'gold',inspirationOnly:false};assert.ok(Math.abs(desiredChance(engine,p,id,odds)-.44)<1e-12);
 p.bought[id].inspirationOnly=true;assert.ok(Math.abs(desiredChance(engine,p,id,odds)-.22*(1-.91**2))<1e-12);
 assert.equal(desiredChance(engine,p,id,[]),0);
 p.bought[id].inspirationOnly=false;assert.equal(desiredChance(engine,p,id,[]),.4);
 p.searchMode='inherit';assert.equal(desiredChance(engine,p,id,odds),odds.find(o=>o.id===id).chance);
});
test('affinity-free parent ranking favors the better requested spark assortment',()=>{
 const p=emptyPlan();p.wanted=[320];const v=normalizeImport([raw(1),raw(2,100201),raw(3,100601)],'x',engine.factors).data;
 v[2].sparks.push({id:320,stars:3});const low=scorePair(engine,p,v[0],v[1]),high=scorePair(engine,p,v[0],v[2]);assert.ok(comparePairs(high,low)<0);
});
test('skill links only reference available entities and expose known gold/source relationships',()=>{
 const links=load('skill-links'),skills=new Set(load('skills').map(s=>s.skillId)),chars=new Set(load('characters').map(c=>c.cardId)),supports=new Set(load('supports').map(c=>c.supportCardId));
 for(const [id,row] of Object.entries(links.skills)){assert.ok(skills.has(Number(id)));for(const v of row.variants)assert.ok(skills.has(v));for(const k of ['characters','characterEvents','supportHints','supportEvents'])for(const src of row[k])assert.ok((k.startsWith('support')?supports:chars).has(src.id));}
 assert.ok(links.skills[200452].variants.includes(200451));assert.ok(links.skills[200452].supportHints.length>0);assert.ok(Object.values(links.skills).some(s=>s.supportEvents.length));
 assert.deepEqual(links.factorSkills[210050],links.factorSkills[210250]);
});
