const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
class Node {
 constructor(){this.dataset={};this.children=[];this.style={setProperty(){}};this.lastElementChild={textContent:''};this.classes=new Set();this.classList={add:(...x)=>x.forEach(v=>this.classes.add(v)),remove:(...x)=>x.forEach(v=>this.classes.delete(v)),toggle:(x,b)=>b?this.classes.add(x):this.classes.delete(x)};this.attrs={}}
 setAttribute(k,v){this.attrs[k]=v} append(n){this.children.push(n)} prepend(n){this.children.unshift(n)} remove(){this.removed=true}getBoundingClientRect(){return {left:0,top:0,width:56,height:82}}
}
const nodes=new Map(),get=s=>{if(!nodes.has(s))nodes.set(s,new Node());return nodes.get(s)},effects=[];
const context={window:{playEffect:n=>effects.push(n)},document:{createElement:()=>new Node(),querySelector:get,querySelectorAll:s=>s==='.playing-card'?get('#cards').children:[]},matchMedia:()=>({matches:true}),Image:class extends Node{decode(){return Promise.resolve()}},setTimeout,clearTimeout,console};
vm.createContext(context);vm.runInContext(fs.readFileSync('dist/director.js','utf8'),context);
(async()=>{
 const d=new context.window.DealerDirector();d.wait=async()=>{};
 await d.pose('idle','ready');assert.equal(d.current,'idle');
 // A late image load from a previous click cannot override the next action.
 let release;d.ready.betting=new Promise(r=>release=r);
 const stale=d.pose('betting','bet');await d.pose('drawing','draw');release(true);await stale;assert.equal(d.current,'drawing');
 d.ready.betting=Promise.resolve(true);
 for(const side of ['p','b']){
  effects.length=0;const c=await d.revealCard(side,{rank:'A',suit:'♥'},get('#cards'),false);
  assert.equal(d.current,side==='p'?'deal-player':'deal-banker');assert.equal(c.attrs['aria-label'],'♥ A');assert.ok(c.classes.has('revealed'));assert.deepEqual(effects,['draw','slide','flip']);
 }
 for(const [w,p] of [['P','win-player'],['B','win-banker'],['T','tie']]){
  d.announce(w,100);await new Promise(setImmediate);assert.equal(d.current,p);assert.equal(d.scene.dataset.result,w);assert.ok(get('.result-banner').classes.has('show'));clearTimeout(d.returnTimer);
 }
 await d.clearCards(false);assert.equal(d.current,'collecting');assert.ok(get('#cards').children.every(c=>c.removed));
 d.ready.closed=Promise.resolve(false);await d.pose('closed','closed');assert.equal(d.current,'collecting');
 d.clearResult();assert.equal(d.scene.dataset.result,undefined);assert.ok(!get('.result-banner').classes.has('show'));
 for(const pose of Object.keys(d.images))assert.ok(fs.statSync('dist/assets/dealer-'+pose+'.webp').size>1000);

 vm.runInContext(fs.readFileSync('dist/dealers.js','utf8'),context);
 assert.equal(context.window.DEALER_ROSTER.length,10);
 for(const character of context.window.DEALER_ROSTER){
  assert.equal(await d.setCharacter(character.id),true);
  assert.equal(d.character,character.id);
  assert.equal(d.scene.classes.has('character-atlas'),!!character.atlas);
  if(character.atlas)assert.ok(fs.statSync('dist/'+character.atlas).size>1000);
 }
 d.ready.closed=Promise.resolve(true);
 for(const [i,pose] of d.poseOrder.entries()){
  await d.pose(pose,pose);
  assert.equal(d.atlas.style.backgroundPosition,(i%4)*100/3+'% '+Math.floor(i/4)*50+'%');
 }
 let releaseCharacter;d.characterLoads.yuna=new Promise(r=>releaseCharacter=r);
 const pending=d.setCharacter('yuna');await d.setCharacter('sophia');releaseCharacter(true);
 assert.equal(await pending,false);assert.equal(d.character,'sophia');
 d.characterLoads.elena=Promise.resolve(false);
 assert.equal(await d.setCharacter('elena'),false);assert.equal(d.character,'sophia');
 assert.equal(await d.setCharacter('unknown'),false);
 console.log('Passed: all 10 characters, 10 atlas pose coordinates, character loading race and failed character fallback.');
 const game=require('./dist/game.js');
 const a={value:1},b={value:2},c={value:3},e={value:4},f={value:5},g={value:6};
 assert.deepEqual(game.sequence({p:[a,c,f],b:[b,e,g]}),[['p',a],['b',b],['p',c],['b',e],['p',f],['b',g]]);
 assert.deepEqual(game.sequence({p:[a,c],b:[b,e,g]}),[['p',a],['b',b],['p',c],['b',e],['b',g]]);
 console.log('Passed: pose loading race, both dealing directions, card reveal, all three outcomes, cleanup, failed asset recovery, 10 image assets, third-card choreography.');
})().catch(e=>{console.error(e);process.exitCode=1});
