import {baseId,grades} from './core.js';
const norm=s=>String(s).trim().toLowerCase().replace(/[_\s]+/g,' ').replace(/\s*-\s*/g,'-');
const list=x=>Array.isArray(x)?x:[x];
export const emptySearch=()=>({mode:'basic',text:'',rules:[],join:'and',advanced:null,uql:'',sort:'Rating',target:0});
const cleanRule=r=>({scope:String(r.scope??''),field:String(r.field??'Speed'),op:String(r.op??'>='),value:String(r.value??'3'),copies:!!r.copies});
export function cleanGroup(g,depth=0,budget={left:60}){return {join:g?.join==='or'?'or':'and',not:!!g?.not,children:depth>=5?[]:(Array.isArray(g?.children)?g.children:[]).filter(()=>budget.left-->0).map(c=>Array.isArray(c?.children)?cleanGroup(c,depth+1,budget):cleanRule(c??{}))};}
export function cleanSearch(s={}){const rules=(Array.isArray(s.rules)?s.rules:[]).slice(0,60).map(cleanRule);return {...emptySearch(),mode:['basic','advanced','uql'].includes(s.mode)?s.mode:'basic',text:String(s.text??'').slice(0,300),rules,advanced:s.advanced?cleanGroup(s.advanced):s.mode==='advanced'?cleanGroup({join:s.join,children:rules}):null,join:s.join==='or'?'or':'and',uql:String(s.uql??'').slice(0,12000),sort:String(s.sort??'Rating'),target:Number(s.target)||0};}
const ruleQuery=r=>{const value=x=>Number.isFinite(Number(x))&&x.trim()?Number(x):JSON.stringify(x);return `(${r.scope?r.scope+' ':''}${r.field} ${r.op} ${['in','not in','has all','has any'].includes(r.op)?'('+r.value.split(',').map(x=>value(x.trim())).join(', ')+')':r.copies?Number(r.value)+'x':value(r.value)})`;};
export function groupQuery(g){const children=g.children.map(c=>Array.isArray(c.children)?groupQuery(c):ruleQuery(c)).filter(Boolean);return children.length?`${g.not?'not ':''}(${children.join(` ${g.join} `)})`:'';}
export function visualQuery(s){return s.mode==='advanced'&&s.advanced?groupQuery(s.advanced):s.rules.map(ruleQuery).join(` ${s.join} `);}
export function createVeteranSearch(D,engine){
 const factors=new Map(D.factors.map(f=>[norm(f.text),f]));
 const fields=new Map();
 const add=(names,get)=>names.forEach(n=>fields.set(norm(n),get));
 const nodes=(v,scope)=>scope==='main'?[v]:scope==='gp1'?(v.parents??[]).filter(p=>p.position===10):scope==='gp2'?(v.parents??[]).filter(p=>p.position===20):scope==='gp'?(v.parents??[]):[v,...(v.parents??[])];
 const scopes=[['',''],['Main ','main'],['Parent ','main'],['GP1 ','gp1'],['Left ','gp1'],['GP2 ','gp2'],['Right ','gp2'],['GP ','gp'],['Great parent ','gp']];
 const charName=id=>D.characters.find(c=>c.cardId===id)?.charaName??`Character ${baseId(id)}`;
 for(const [prefix,scope] of scopes){
  if(prefix)add([prefix.trim()],v=>nodes(v,scope).flatMap(n=>n.sparks.map(f=>f.id*10+f.stars)));
  const aggregate=(v,fn)=>scope==='gp'?nodes(v,scope).map(fn):fn({sparks:nodes(v,scope).flatMap(n=>n.sparks??[])});
  for(const f of D.factors)add([prefix+f.text,prefix+'Spark '+f.id],(v,c,mode)=>aggregate(v,n=>n.sparks.filter(x=>x.id===Number(f.id)).reduce((s,x)=>s+(mode==='copies'?1:x.stars),0)));
  for(const [name,types] of [['Blue',[0]],['Pink',[1]],['Red',[1]],['Green',[5]],['White',[2,3,4]],['Common white',[3]],['Scenario white',[4]],['Race white',[2]]]){
   for(const metric of ['stars','count','factors','sparks'])add([prefix+name+' '+metric,prefix+'Total '+name+' '+metric],(v)=>aggregate(v,n=>{const a=n.sparks.filter(x=>types.includes(engine.factors.get(x.id)?.type));return metric==='stars'?a.reduce((s,x)=>s+x.stars,0):metric==='count'?new Set(a.map(x=>x.id)).size:a.map(x=>x.id*10+x.stars);}));
  }
  add([prefix+'Characters',prefix+'Character'],v=>nodes(v,scope).map(n=>n.cardId));
  add([prefix+'Races',prefix+'Race wins'],v=>{const ns=nodes(v,scope||'main');return ns.length&&ns.every(n=>n.winsKnown)?[...new Set(ns.flatMap(n=>n.wins))]:null;});
  add([prefix+'Wins',prefix+'G1 wins',prefix+'Win count'],v=>{const ns=nodes(v,scope||'main');if(!ns.length||ns.some(n=>!n.winsKnown))return null;const count=n=>new Set(n.wins.map(id=>D.races[id]?.group??`unknown:${id}`)).size;return scope==='gp'?ns.map(count):new Set(ns.flatMap(n=>n.wins).map(id=>D.races[id]?.group??`unknown:${id}`)).size;});
  for(const [color,types] of [['blue',[0]],['pink',[1]],['green',[5]],['white',[2,3,4]]]){const raw=scope==='main'?'main':scope==='gp1'?'left':scope==='gp2'?'right':null;if(raw)add([`${raw}_${color}_factors`],v=>{const a=nodes(v,scope).flatMap(n=>n.sparks).filter(f=>types.includes(engine.factors.get(f.id)?.type)).map(f=>f.id*10+f.stars);return color==='white'?a:a[0]??0;});if(!scope)add([color+'_sparks'],v=>nodes(v,'').flatMap(n=>n.sparks).filter(f=>types.includes(engine.factors.get(f.id)?.type)).map(f=>f.id*10+f.stars));}
 }
 const props=[['Rating',v=>v.rating],['parent_rank',v=>v.rating],['Rarity',v=>v.rarity],['Veteran ID',v=>v.id],['Memo',v=>v.memo],['Name',v=>charName(v.cardId)],['Outfit',v=>D.characters.find(c=>c.cardId===v.cardId)?.cardTitle??''],['Date',v=>v.date],['Scenario',v=>v.scenario??null],['Learned skills',v=>v.skills.map(s=>s.id)]];
 for(const [label,key] of [['Speed','speed'],['Stamina','stamina'],['Power','power'],['Guts','guts'],['Wit','wiz']])props.push(['Stat '+label,v=>v.stats?.[key]??null]);
 for(const label of ['Turf','Dirt','Sprint','Mile','Medium','Long','Front','Pace','Late','End'])props.push(['Aptitude '+label,v=>v.aptitudes?.[label]??null]);
 props.push(['Affinity',(v,c)=>{if(!c.target)return null;const target=baseId(c.target),id=baseId(v.cardId);if(target===id)return null;const direct=engine.relation(target,id);if(direct===null)return null;let sum=direct;for(const p of v.parents??[]){const x=engine.relation(target,id,baseId(p.cardId));if(x===null)return null;sum+=x+engine.shared(v,p);}return sum;}]);
 for(const [name,get] of props)add([name,'Main '+name],get);
 const value=(raw,field)=>{
  if(typeof raw!=='string')return raw;
  if(/factors|sparks|^(main|parent|gp|gp1|gp2|left|right)$/i.test(field.trim())){const f=factors.get(norm(raw));if(f)return [1,2,3].map(stars=>Number(f.id)*10+stars);}
  if(/characters?$/i.test(field)){const matches=D.characters.filter(c=>norm(c.charaName)===norm(raw)||norm(c.charaName+' '+c.cardTitle)===norm(raw));if(matches.length)return matches.map(c=>c.cardId);}
  if(/races|race wins/i.test(field)){const a=Object.entries(D.races).filter(([,r])=>norm(r.name)===norm(raw)).map(([id])=>Number(id));if(a.length)return a;}
  if(/learned skills/i.test(field)){const s=D.skills.find(s=>norm(s.skillName)===norm(raw));if(s)return s.skillId;}
  if(/aptitude/i.test(field)&&grades.includes(raw.toUpperCase()))return grades.indexOf(raw.toUpperCase());
  if(/scenario/i.test(field)){const names={ura:1,'ura finals':1,aoharu:2,'aoharu hai':2,'make a new track':3,'grand live':4,'grand masters':5};if(names[norm(raw)])return names[norm(raw)];}
  return raw;
 };
 function compile(source,context={}){
  if(source.length>12000)throw Error('Query exceeds 12,000 characters.');
  context={...context};let tokens=[],i=0;
  const re=/\s+|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\d+(?:\.\d+)?x?\b|>=|<=|!=|<>|==|[=><()+*/%,;\[\]-]|[^\s=><()+*/%,;\[\]-]+/gy;
  // Tokenize without evaluating source as JavaScript.
  re.lastIndex=0;let match;while((match=re.exec(source))){if(match[0].trim())tokens.push(match[0]);}
  if(re.lastIndex!==0)throw Error('Invalid query.');
  let depth=0;for(const t of tokens){if(t==='('||t==='[')depth++;if(t===')'||t===']')depth--;if(depth>50)throw Error('Maximum query nesting is 50.');}
  // Directives may be separated by semicolons or top-level AND.
  let sortField=null;
  for(let j=0,depth=0;j<tokens.length;j++){
   const t=norm(tokens[j]);if(t==='('||t==='[')depth++;if(t===')'||t===']')depth--;
   const target=t==='target',sort=t==='sort'&&norm(tokens[j+1])==='by';
   if(depth||(!target&&!sort)||j>0&&![';','and'].includes(norm(tokens[j-1])))continue;
   let start=j+(sort?2:1);if(tokens[start]==='=')start++;
   let end=start;while(end<tokens.length&&![';','and'].includes(norm(tokens[end])))end++;
   let text=tokens.slice(start,end).join(' ').trim();if(/^['"]/.test(text))text=text.slice(1,-1);
   if(!text)throw Error('Missing directive value.');
   if(target){const c=D.characters.find(c=>norm(c.charaName)===norm(text)||String(c.cardId)===text);if(!c)throw Error('Unknown affinity target.');context.target=c.cardId;}
   else{if(!fields.has(norm(text)))throw Error('Unknown sort field.');sortField=text;}
   if(j>0){tokens.splice(j-1,end-j+1);j-=2;}else{tokens.splice(j,end+(end<tokens.length?1:0));j=-1;}
  }
  tokens=tokens.filter(t=>t!==';');
  const peek=()=>norm(tokens[i]??''),eat=s=>peek()===s?(i++,true):false;
  const expect=s=>{if(!eat(s))throw Error(`Expected ${s}.`);};
  const literal=x=>({get:()=>x,literal:true});
  const fieldAt=()=>{for(let j=Math.min(tokens.length,i+12);j>i;j--){const name=tokens.slice(i,j).join(' ');if(fields.has(norm(name)))return {name,end:j,get:fields.get(norm(name))};}return null;};
  const stops=new Set(['and','or','not','in','between','like','ilike','has','contains','does','=', '==','!=','<>','>','>=','<','<=','(',')','[',']',',',';','+','-','*','/','%','mod']);
  const functions={contains:(a,b)=>list(a).includes(b),has:(a,b)=>list(a).includes(b),overlaps:(a,b)=>list(b).some(x=>list(a).includes(x)),has_all:(a,b)=>list(b).every(x=>list(a).includes(x)),spark_sum:(a,id)=>list(a).filter(x=>Math.floor(x/10)===id).reduce((s,x)=>s+x%10,0),any_spark:(a,min=1,max=3,minCopies=1,maxCopies=3)=>{const counts=new Map();list(a).filter(x=>x%10>=min&&x%10<=max).forEach(x=>counts.set(Math.floor(x/10),(counts.get(Math.floor(x/10))??0)+1));return [...counts.values()].some(n=>n>=minCopies&&n<=maxCopies);}};
  function atom(rhs=false){
   if(eat('(')){const n=expression();expect(')');return n;}
   if(eat('[')){const a=[];if(!eat(']')){do{a.push(atom(true));}while(eat(','));expect(']');}return {get:(v,c)=>a.map(n=>n.get(v,c)),literal:true};}
   const t=tokens[i];if(!t)throw Error('Finish the predicate.');
   if(/^['"]/.test(t)){i++;return literal(t[0]==='"'?JSON.parse(t):t.slice(1,-1).replace(/\\'/g,"'"));}
   if(/^\d+(\.\d+)?x?$/i.test(t)){i++;const n=literal(parseFloat(t));n.copies=/x$/i.test(t);return n;}
   if(tokens[i+1]==='('){i+=2;const fn=functions[t.toLowerCase()];if(!fn)throw Error(`Unsupported function: ${t}`);const args=[];if(!eat(')')){do{args.push(arithmetic());}while(eat(','));expect(')');}return {get:(v,c)=>{const a=args.map(n=>n.get(v,c));return a.some(x=>x==null)?null:fn(...a);}};}
   const field=fieldAt();if(field&&!rhs){i=field.end;return {name:field.name,get:field.get};}
   if(!rhs)throw Error(`Unknown or unavailable field: ${t}`);
   const start=i;while(i<tokens.length&&!stops.has(peek()))i++;
   if(i===start)throw Error('Finish the predicate.');return literal(tokens.slice(start,i).join(' '));
  }
  function unary(rhs){if(eat('-')){const a=unary(rhs);return {get:(v,c)=>-a.get(v,c)};}return atom(rhs);}
  function arithmetic(rhs=false,min=0){let a=unary(rhs);const precedence={'+':1,'-':1,'*':2,'/':2,'%':2,mod:2};while(precedence[peek()]&&precedence[peek()]>=min){const op=peek();i++;const b=arithmetic(rhs,precedence[op]+1),left=a;a={get:(v,c)=>{const x=left.get(v,c),y=b.get(v,c);if(x==null||y==null||Array.isArray(x)||Array.isArray(y))return null;return op==='+'?x+y:op==='-'?x-y:op==='*'?x*y:op==='/'?(y?Math.trunc(x/y):null):y?x%y:null;}};}return a;}
  function compare(a,b,op,v,c){if(['gp','great parent'].includes(norm(a.name??''))){const ns=nodes(v,'gp');return ns.length?ns.some(n=>compare({...a,name:'Main',get:()=>n.sparks.map(f=>f.id*10+f.stars)},b,op,v,c)===true):null;}let x=a.get(v,c,b.copies?'copies':undefined),y=b.get(v,c);if(x==null||y==null||Array.isArray(x)&&!x.length&&/^gp/i.test(a.name??''))return null;const groups=list(y).map(z=>list(value(z,a.name??'')));y=groups.flat();const xs=list(x);
   const eq=(x,y)=>typeof x==='number'||typeof y==='number'?Number(x)===Number(y):String(x)===String(y);
   if(['has','contains','in','='].includes(op))return xs.some(x=>y.some(y=>eq(x,y)));
   if(['!=','not in','not has'].includes(op))return xs.every(x=>y.every(y=>!eq(x,y)));
   if(op==='has all')return groups.every(g=>g.some(y=>xs.some(x=>eq(x,y))));
   if(op==='like'||op==='ilike'){const pattern=String(y[0]).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/%/g,'.*').replace(/_/g,'.');return xs.some(x=>new RegExp('^'+pattern+'$',op==='ilike'?'i':'').test(String(x)));}
   return xs.some(x=>y.some(y=>op==='>'?x>y:op==='>='?x>=y:op==='<'?x<y:x<=y));
  }
  function predicate(){
   if(eat('not')){const a=predicate();return {get:(v,c)=>{const x=a.get(v,c);return x==null?null:!x;}};}
   const a=arithmetic();let op=peek();if(['=','==','!=','<>','>','>=','<','<=','in','between','like','ilike','has','contains','not','does'].includes(op))i++;else return a;
   if(op==='==')op='=';if(op==='<>')op='!=';
   if(op==='does'){expect('not');expect('have');op='not has';}
   if(op==='not'){op='not '+peek();i++;if(!['not in','not has','not like','not ilike'].includes(op))throw Error('Unsupported negated operator.');}
   if(op==='has'||op==='contains'){if(eat('all'))op='has all';else if(eat('any'))op='in';}
   if(op==='between'){const b=arithmetic(true);expect('and');const d=arithmetic(true);return {get:(v,c)=>{const x=compare(a,b,'>=',v,c),y=compare(a,d,'<=',v,c);return x==null||y==null?null:x&&y;}};}
   let b;if(eat('(')){const a=[];do{a.push(arithmetic(true));}while(eat(','));expect(')');b={get:(v,c)=>a.flatMap(n=>list(n.get(v,c)))};}else b=arithmetic(true);
   return {get:(v,c)=>op==='not like'||op==='not ilike'?(()=>{const x=compare(a,b,op.slice(4),v,c);return x==null?null:!x;})():compare(a,b,op,v,c)};
  }
  function conjunction(){let a=predicate();while(eat('and')){const b=predicate(),left=a;a={get:(v,c)=>{const x=left.get(v,c),y=b.get(v,c);return x===false||y===false?false:x==null||y==null?null:x&&y;}};}return a;}
  function expression(){let a=conjunction();while(eat('or')){const b=conjunction(),left=a;a={get:(v,c)=>{const x=left.get(v,c),y=b.get(v,c);return x===true||y===true?true:x==null||y==null?null:x||y;}};}return a;}
  const root=tokens.length?expression():literal(true);if(i<tokens.length)throw Error(`Unexpected token: ${tokens[i]}`);
  if(root.name||root.literal&&root.get()!==true)throw Error('Finish the predicate with a comparison.');
  const fn=v=>root.get(v,context)===true;fn.sort=sortField;fn.context=context;return fn;
 }
 function run(rows,search){const s=cleanSearch(search),query=s.mode==='uql'?s.uql:visualQuery(s);try{const fn=compile(query,{target:s.target});const sort=fields.get(norm(fn.sort??s.sort));if(!sort)throw Error('Unknown sort field.');const words=norm(s.text).split(/\s+/).filter(Boolean);const result=rows.filter(v=>fn(v)&&words.every(w=>norm([charName(v.cardId),v.cardId,v.id,v.memo,D.characters.find(c=>c.cardId===v.cardId)?.cardTitle].join(' ')).includes(w)));result.sort((a,b)=>{const x=sort(a,fn.context),y=sort(b,fn.context);return typeof x==='string'?x.localeCompare(y):Number(y??-Infinity)-Number(x??-Infinity);});return {rows:result,error:null,query};}catch(e){return {rows:[],error:e.message,query};}}
 return {compile,run,characters:D.characters,fields:[...fields.keys()].filter(x=>!x.includes('_')),factors:[...factors.values()]};
}
