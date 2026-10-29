import {Engine,scorePair,comparePairs,baseId} from './core.js';
self.onmessage=({data})=>{
 try {
 const {affinity,factors,races,plan,veterans}=data,engine=new Engine(affinity,factors,races);
 const eligible=veterans.filter(v=>baseId(v.cardId)!==baseId(plan.nodes[0].cardId));
 const locked=plan.pins.map((pin,i)=>pin?plan.nodes[i+1].sourceId:null);
 if(locked.some((id,i)=>plan.pins[i]&&!id))throw Error('Pinned parents must be imported veterans.');
 const left=locked[0]?eligible.filter(v=>v.id===locked[0]):eligible;
 const right=locked[1]?eligible.filter(v=>v.id===locked[1]):eligible;
 let checked=0,matched=0;const top=[];const total=left.length*right.length;
 for(let i=0;i<left.length;i++)for(let j=0;j<right.length;j++){
  checked++;
  if(left[i].id===right[j].id||(!locked[0]&&!locked[1]&&j<=i))continue;
  const score=scorePair(engine,plan,left[i],right[j]);
  if(score){matched++;top.push(score);top.sort(comparePairs);if(top.length>40)top.pop();}
  if(checked%2000===0)self.postMessage({type:'progress',checked,total});
 }
 self.postMessage({type:'done',top,checked,matched});
 }catch(e){self.postMessage({type:'error',message:e.message});}
};
