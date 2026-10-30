import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Engine,emptyPlan,normalizeImport,scorePair,comparePairs} from '../core.js';
import {prepareDecks,scorePairWithDeck} from '../deck.js';
import {trainingWeights,createTrainingModel,combinedScore} from '../training.js';
import {processCards} from '../vendor/tierlist/tierlist-calc.js';
import cards from '../vendor/tierlist/cards.js';
import {getScenario} from '../vendor/tierlist/scenarios.js';
import {cleanSearch,visualQuery,createVeteranSearch} from '../veteran-search.js';
const D=Object.fromEntries(['characters','supports','skills','factors','affinity','races','skill-links'].map(n=>[n,JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)))]));
const engine=new Engine(D.affinity,D.factors,D.races,D['skill-links']);
const owned=[30028,20031,20033,20012,20002,30052,30011].map(cardId=>({cardId,limitBreak:2,level:30}));
const plan=emptyPlan();plan.includeSupports=true;plan.wanted=[Number(D.factors.find(f=>f.text==='Groundwork').id)];plan.scenario='URA';
const options=p=>({plan:p,supports:D.supports,ownedSupports:owned,skills:D.skills,links:D['skill-links'],characters:D.characters});
const raw=(id,card_id)=>({trained_chara_id:id,card_id,factor_info_array:[],win_saddle_id_array:[],succession_chara_array:[]});
const [a,b]=normalizeImport([raw(1,100101),raw(2,100201)],'x',engine.factors).data;
test('vendored calculator preserves upstream numerical regression',()=>{
 const selected=[30078,20027,20041,20012,20015].map(id=>cards.find(c=>c.id===id&&c.limit_break===4));const scenario=getScenario('gl','MANT');
 assert.equal(Math.round(processCards([cards.find(c=>c.id===30028&&c.limit_break===4)],{...scenario.speed,...scenario.general},selected)[0].score),372);
});
test('growth rates enter training multipliers and manual scenarios override automatic choices',()=>{
 const w=trainingWeights({talentSpeed:20,talentStamina:10},'URA');assert.deepEqual(w.umaBonus,[1.2,1.1,1,1,1,1]);
 const p={...plan,autoScenarios:['GL','MANT']};const model=createTrainingModel(p,D.characters);assert.deepEqual(model.scenarios,['URA']);
 const result=model.evaluate(owned.slice(0,6).map(c=>({id:c.cardId,limitBreak:c.limitBreak})));assert.equal(result.scenario,'URA');assert.ok(Number.isFinite(result.score));
 const auto=createTrainingModel({...p,scenario:'auto'},D.characters).evaluate(owned.slice(0,6).map(c=>({id:c.cardId,limitBreak:2})));assert.equal(auto.comparisons.length,2);assert.equal(auto.score,Math.max(...auto.comparisons.map(c=>c.score)));
});
test('decks have exactly five owned and one MLB borrowed, unique characters and no target',()=>{
 const p=structuredClone(plan);p.nodes[0].cardId=100101;const decks=prepareDecks(options(p));assert.ok(decks.length);
 for(const d of decks){assert.equal(d.cards.length,6);assert.equal(d.cards.filter(c=>!c.borrowed).length,5);assert.equal(d.cards.filter(c=>c.borrowed).length,1);assert.equal(d.cards.find(c=>c.borrowed).limitBreak,4);assert.equal(d.cards.find(c=>c.borrowed).rarity,3);assert.equal(new Set(d.cards.map(c=>c.charaId)).size,6);assert.ok(d.cards.every(c=>c.charaId!==1001));assert.ok(d.cards.filter(c=>!c.borrowed).every(c=>c.limitBreak===2));}
 assert.throws(()=>prepareDecks({...options(p),ownedSupports:owned.slice(0,4)}),/at least five/);
});
test('support sources affect spark generation while inspiration-only overrides them',()=>{
 const decks=prepareDecks(options(plan)),base=scorePair(engine,plan,a,b),r=scorePairWithDeck(engine,plan,a,b,base,decks);assert.ok(r.chances[0]>0);assert.equal(r.acquisition[0].conditional,true);assert.ok(r.training.score>0);
 const p=structuredClone(plan);p.bought[p.wanted[0]]={inspirationOnly:true};const forced=scorePairWithDeck(engine,p,a,b,scorePair(engine,p,a,b),decks);assert.equal(forced.chances[0],0);assert.equal(forced.acquisition[0].kind,'inspiration');
 assert.equal(scorePair(engine,plan,a,b).chances[0],0,'disabled deck scoring is unchanged');
});
test('training weight changes combined preference without changing probabilities',()=>{
 assert.ok(combinedScore([.2],5000,1)>combinedScore([.8],1000,1));assert.ok(combinedScore([.8],1000,0)>combinedScore([.2],5000,0));assert.ok(comparePairs({combinedScore:90,min:.1,sum:.1,total:0},{combinedScore:10,min:.9,sum:.9,total:0})<0);
});
test('advanced groups preserve mixed Boolean logic, exclusions and preset independence',()=>{
 const rule=(field,op,value)=>({scope:'',field,op,value,copies:false});const s=cleanSearch({mode:'advanced',advanced:{join:'and',children:[{join:'or',children:[rule('Rating','>=','10000'),rule('Stat Speed','>=','1000')]},{join:'and',not:true,children:[rule('Main Character','=','Special Week')]}]}});
 const search=createVeteranSearch(D,engine),q=visualQuery(s);assert.equal(search.compile(q)({...a,rating:15000}),false);assert.equal(search.compile(q)({...b,rating:15000}),true);assert.equal(search.compile(q)({...b,rating:1}),false);
 const saved=cleanSearch(s);s.advanced.children[0].children[0].value='99999';assert.equal(saved.advanced.children[0].children[0].value,'10000');
 const old=cleanSearch({mode:'advanced',rules:[rule('Rating','>=','2')]});assert.ok(visualQuery(old).includes('Rating >= 2'));
});
test('Pal-heavy collections keep no-Pal alternatives and enforce the cap across owned and borrowed slots',()=>{
 const p={...emptyPlan(),scenario:'GL',trainingWeight:100};
 const input={...options(p),ownedSupports:D.supports.map(s=>({cardId:s.supportCardId,limitBreak:4,level:50}))};
 const types=new Map(cards.filter(c=>c.limit_break===4).map(c=>[c.id,c.type]));
 const count=d=>d.cards.filter(c=>types.get(c.id)===6).length;
 const defaults=prepareDecks(input);assert.ok(defaults.some(d=>count(d)===0));assert.ok(defaults.some(d=>count(d)===1));assert.ok(defaults.every(d=>count(d)<=1));
 const best=defaults.sort((a,b)=>b.training.score-a.training.score)[0];assert.ok(count(best)<=1);assert.equal(best.training.outingDays,count(best)*5);
 const none=prepareDecks({...input,plan:{...p,maxOutingCards:0}});assert.ok(none.length);assert.ok(none.every(d=>count(d)===0));
 const two=prepareDecks({...input,plan:{...p,maxOutingCards:2}});assert.ok(two.some(d=>count(d)===2));assert.ok(two.every(d=>count(d)<=2));
});
test('shared outings reduce a stat card’s gains, not just the Pal candidate’s gains',()=>{
 const candidate=cards.find(c=>c.id===30028&&c.limit_break===4),fixed=[30052,30036,20021,20012,20031].map(id=>cards.find(c=>c.id===id&&c.limit_break===4));
 const weights=trainingWeights(null,'GL');
 const old=processCards([candidate],weights,fixed)[0],shared=processCards([candidate],{...weights,deckOutingDays:15},fixed)[0];
 assert.ok(shared.score<old.score);assert.ok(shared.info.rainbow_gains[0]<old.info.rainbow_gains[0]);
 const model=createTrainingModel({...emptyPlan(),scenario:'GL'},[]).evaluate([candidate,...fixed].map(c=>({id:c.id,limitBreak:4})));
 assert.equal(model.outingDays,15);assert.equal(model.perCard.find(c=>c.id===candidate.id).score,shared.score);
});
test('a restrictive Pal cap reports infeasibility rather than returning a partial or illegal deck',()=>{
 const p={...plan,maxOutingCards:0};
 assert.throws(()=>prepareDecks({...options(p),ownedSupports:[30052,30036,20021,30028,20031].map(cardId=>({cardId,limitBreak:4,level:50}))}),/Pal\/Group limit/);
});
