import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {emptyPlan,emptyNode} from '../core.js';
const load=n=>JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)));
const messages=[];
globalThis.self={postMessage:m=>messages.push(m)};
await import('../search-worker.js');
test('worker searches without a target, applies pins, and rejects invalid pinned slots',()=>{
 const plan=emptyPlan();plan.wanted=[210090];plan.searchMode='sparkgen';plan.bought[210090]={tier:'white',inspirationOnly:true};
 const veteran=(id,cardId,stars)=>({...emptyNode(),id,cardId,sparks:[{id:210150,stars}],parents:[]});
 const veterans=[veteran('1',100101,1),veteran('2',100201,2),veteran('3',100301,3)];
 const data={affinity:load('affinity'),factors:load('factors'),races:load('races'),links:load('skill-links'),plan,veterans};
 self.onmessage({data});let result=messages.at(-1);assert.equal(result.type,'done');assert.equal(result.matched,3);assert.deepEqual([result.top[0].a,result.top[0].b],['2','3']);assert.equal(result.top[0].baseline,true);
 plan.pins[0]=true;plan.nodes[1].sourceId='1';self.onmessage({data});result=messages.at(-1);assert.equal(result.matched,2);assert.ok(result.top.every(p=>p.a==='1'));
 plan.nodes[1].sourceId=null;self.onmessage({data});assert.equal(messages.at(-1).type,'error');
});
test('deck worker returns scenario-scored six-card results and rejects insufficient owned cards',()=>{
 const plan=emptyPlan();plan.includeSupports=true;plan.scenario='URA';plan.wanted=[Number(load('factors').find(f=>f.text==='Groundwork').id)];
 const veterans=[100101,100201].map((cardId,i)=>({...emptyNode(),id:String(i+1),cardId,parents:[]}));
 const data={affinity:load('affinity'),factors:load('factors'),races:load('races'),links:load('skill-links'),skills:load('skills'),characters:load('characters'),supports:load('supports'),ownedSupports:[30028,20031,20033,20012,20002,30052].map(cardId=>({cardId,limitBreak:4,level:50})),plan,veterans};
 self.onmessage({data});const r=messages.at(-1);assert.equal(r.type,'done');assert.equal(r.top.length,1);assert.equal(r.top[0].deck.length,6);assert.equal(r.top[0].training.scenario,'URA');assert.ok(Number.isFinite(r.top[0].combinedScore));
 data.ownedSupports=[];self.onmessage({data});assert.equal(messages.at(-1).type,'error');assert.match(messages.at(-1).message,/at least five/);
});
