const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(saved){
 const elements=new Map(),events={},storage=new Map(saved?[['maison-sound',saved]]:[]);let tones=0,context;const buffers=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,v){this.listeners[k]=v}});return elements.get(id)};
 const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),Q:param(),connect(n){return n},disconnect(){},start(){tones++},stop(){}});
 class AudioContext{constructor(){context=this;this.state='suspended';this.currentTime=0;this.destination={};this.sampleRate=44100}async resume(){this.state='running'}async suspend(){this.state='suspended'}createGain(){return node()}createOscillator(){return node()}createBuffer(channels,length){const data=new Float32Array(length);buffers.push(data);return {getChannelData:()=>data}}createBufferSource(){return node()}createBiquadFilter(){return node()}}
 const document={hidden:false,querySelector:el,addEventListener:(k,v)=>events[k]=v};const window={AudioContext};
 vm.runInNewContext(fs.readFileSync(require.resolve('../dist/audio.js'),'utf8'),{document,window,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>1,clearTimeout(){},Math,Float32Array});
 return {el,events,storage,window,document,buffers,get tones(){return tones},get context(){return context}};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('audio starts on room entry, produces music/effects, and remembers explicit mute',async()=>{
 const a=setup();assert.equal(a.tones,0);
 a.el('#createRoom').listeners.click();await flush();assert.equal(a.el('#sound').attrs['aria-pressed'],'true');assert.ok(a.tones>0);
 const before=a.tones;a.window.playEffect('bet');assert.ok(a.tones>before);
 await a.el('#sound').onclick();assert.equal(a.storage.get('maison-sound'),'off');const muted=a.tones;
 a.el('#join').listeners.click();a.window.playEffect('bet');await flush();assert.equal(a.tones,muted);
 await a.el('#sound').onclick();assert.equal(a.storage.get('maison-sound'),'on');assert.ok(a.tones>muted);
 a.document.hidden=true;a.events.visibilitychange();await flush();assert.equal(a.context.state,'suspended');
 a.document.hidden=false;a.events.visibilitychange();await flush();assert.equal(a.context.state,'running');
});
test('saved mute stays silent; refreshed active table can unlock sound with a gesture',async()=>{
 const muted=setup('off');muted.el('#join').listeners.click();await flush();assert.equal(muted.tones,0);
 const active=setup('on');active.events.pointerdown({target:{closest:()=>null}});await flush();assert.ok(active.tones>0);
});

test('chip placement uses three short decaying impacts without clipped samples',async()=>{
 const a=setup();await a.el('#sound').onclick();const before=a.buffers.length;
 a.window.playEffect('bet');const impacts=a.buffers.slice(before);assert.equal(impacts.length,3);
 for(const samples of impacts){assert.equal(samples.length,Math.ceil(44100*.13));assert.ok(samples.every(n=>Number.isFinite(n)&&Math.abs(n)<1));const head=samples.slice(0,441).reduce((sum,n)=>sum+n*n,0);const tail=samples.slice(-441).reduce((sum,n)=>sum+n*n,0);assert.ok(head>tail*100)}
});
