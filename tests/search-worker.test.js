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
