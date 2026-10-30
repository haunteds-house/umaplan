import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Engine,normalizeImport,summarizeChances,scorePair,emptyPlan} from '../core.js';
import {createVeteranSearch,emptySearch,cleanSearch,visualQuery} from '../veteran-search.js';
const D=Object.fromEntries(['characters','skills','factors','races','affinity','skill-links'].map(n=>[n,JSON.parse(fs.readFileSync(new URL('../data/'+n+'.json',import.meta.url)))]));
const engine=new Engine(D.affinity,D.factors,D.races,D['skill-links']),service=createVeteranSearch(D,engine);
const ground=Number(D.factors.find(f=>f.text==='Groundwork').id);
const raw={trained_chara_id:1,card_id:100101,scenario_id:2,speed:1000,proper_ground_turf:8,rank_score:15000,memo:'mile and sprint',factor_info_array:[{factor_id:103},{factor_id:ground*10+3}],win_saddle_id_array:[],succession_chara_array:[{position_id:10,card_id:100301,factor_info_array:[{factor_id:102},{factor_id:ground*10+2}],win_saddle_id_array:[]},{position_id:20,card_id:100401,factor_info_array:[{factor_id:103}],win_saddle_id_array:[]}]};
const v=normalizeImport([raw],'x',engine.factors).data[0],match=q=>service.compile(q)(v);
test('scoped spark totals, copies, GP existential matching and arithmetic',()=>{
 for(const q of ['Speed = 8','Main Speed = 3','GP1 Speed = 2','GP2 Speed = 3','GP Speed = 3','Groundwork = 2x','Speed + Stamina = 8','Speed / 3 = 2','Wins % 2 = 0'])assert.equal(match(q),true,q);
 assert.equal(match('GP Speed >= 5'),false);assert.equal(match('Groundwork >= 6'),false);
});
test('boolean grouping, text, arrays and roster fields',()=>{
 for(const q of ['(Speed >= 8 or Stamina >= 6) and Rating >= 10000','not (Main Speed = 2)','Stat Speed >= 1000 and Aptitude Turf = "S"','Memo ilike "%mile%"','Memo = "mile and sprint"','Characters in ("Special Week", "Maruzensky")','Main has Groundwork','Main has all (Speed, Groundwork)','Scenario = Aoharu','Rating between 10000 and 20000'])assert.equal(match(q),true,q);
 assert.equal(match('Characters not in ("Special Week")'),false);
});
test('raw spark queries and functions',()=>{
 for(const q of ['contains(blue_sparks,103)','spark_sum(blue_sparks,10) = 8','any_spark(blue_sparks,3,3,2,3)','main_blue_factors = 103','White count = 1','White stars = 5'])assert.equal(match(q),true,q);
 assert.equal(match('any_spark(blue_sparks,3,3,3,3)'),false);
});
test('directives, unknown values, sorting and missing race information',()=>{
 assert.equal(match('target = Maruzensky; Speed >= 3; sort by = Rating'),true);
 assert.equal(match('Speed >= 3 and sort by = Rating and target = Maruzensky'),true);
 assert.equal(service.compile('not (Wins > 0)')({...v,winsKnown:false}),false);
 const rows=service.run([{...v,id:'2',rating:1},v],{...emptySearch(),mode:'uql',uql:'sort by = Rating'});assert.equal(rows.rows[0].id,'1');assert.equal(v.scenario,2);
});
test('invalid or remote-only queries fail explicitly even with empty collections',()=>{
 for(const q of ['Main Speed =','Rating >=','Followers > 3','optional_white(1)','alert(1)','Characters in (','Speed = 3 and','Rating','3','target = Missing','sort by = Missing'])assert.ok(service.run([],{...emptySearch(),mode:'uql',uql:q}).error,q);
});
test('visual rules and presets round-trip without shared mutable rules',()=>{
 const s={...emptySearch(),rules:[{scope:'Main',field:'Speed',op:'=',value:'3',copies:false},{scope:'',field:'Groundwork',op:'>=',value:'2',copies:true}]};
 assert.equal(service.compile(visualQuery(s))(v),true);const preset=cleanSearch(s);s.rules[0].value='1';assert.equal(preset.rules[0].value,'3');assert.deepEqual(cleanSearch(JSON.parse(JSON.stringify(preset))),preset);
});
test('average and all-in-one-run estimates are different, with explicit empty/zero cases',()=>{
 assert.deepEqual(summarizeChances([.5,.5]),{average:.5,allChance:.25,expectedRuns:4});
 assert.deepEqual(summarizeChances([]),{average:null,allChance:null,expectedRuns:null});
 assert.deepEqual(summarizeChances([.8,0]),{average:.4,allChance:0,expectedRuns:Infinity});
 assert.equal(summarizeChances([1,1]).expectedRuns,1);assert.equal(summarizeChances([.2]).expectedRuns,5);
 assert.throws(()=>summarizeChances([NaN]));
});
test('aliases share one joint outcome, and real pair scores expose summaries',()=>{
 assert.deepEqual(summarizeChances([.5,.5],[1,2],{1:[1,2],2:[1,2]}),{average:.5,allChance:.5,expectedRuns:2});
 const p=emptyPlan();p.wanted=[10,ground];const b={...v,id:'2',cardId:100201};const r=scorePair(engine,p,v,b);
 assert.equal(r.average,r.sum/2);assert.equal(r.allChance,r.chances[0]*r.chances[1]);assert.equal(r.expectedRuns,1/r.allChance);
});
test('Category101 is normalized to Special',()=>{assert.ok(!D.skills.some(s=>s.skillCategory==='Category101'));assert.equal(D.skills.find(s=>s.skillId===1000011).skillCategory,'Special');});
