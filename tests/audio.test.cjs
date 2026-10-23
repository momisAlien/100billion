const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(saved){
 const elements=new Map(),events={},storage=new Map(saved?[['maison-sound',saved]]:[]);let tones=0,context;const buffers=[],recordings=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,v){this.listeners[k]=v}});return elements.get(id)};
 const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}});
 const node=()=>({gain:param(),frequency:param(),Q:param(),connect(n){return n},disconnect(){},start(){tones++},stop(){}});
 class AudioContext{constructor(){context=this;this.state='suspended';this.currentTime=0;this.destination={};this.sampleRate=44100}async resume(){this.state='running'}async suspend(){this.state='suspended'}async decodeAudioData(data){return {sample:data}}createGain(){return node()}createOscillator(){return node()}createBuffer(channels,length){const data=new Float32Array(length);buffers.push(data);return {getChannelData:()=>data}}createBufferSource(){const n=node();n.start=()=>{tones++;if(n.buffer?.sample)recordings.push(n.buffer.sample)};return n}createBiquadFilter(){return node()}}
 const document={hidden:false,querySelector:el,addEventListener:(k,v)=>events[k]=v};const window={AudioContext};
 vm.runInNewContext(fs.readFileSync(require.resolve('../dist/audio.js'),'utf8'),{document,window,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>1,clearTimeout(){},Math,Float32Array,fetch:async url=>({ok:true,arrayBuffer:async()=>url})});
 return {el,events,storage,window,document,buffers,recordings,get tones(){return tones},get context(){return context}};
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

test('one assigned recording per bet, consistent across repeated bets and silent when muted',async()=>{
 const a=setup();await a.el('#sound').onclick();await flush();
 a.window.playEffect('bet',0);a.window.playEffect('bet',0);a.window.playEffect('bet',1);
 assert.deepEqual(a.recordings,['assets/audio/chip-1.mp3','assets/audio/chip-1.mp3','assets/audio/chip-2.mp3']);
 await a.el('#sound').onclick();a.window.playEffect('bet',1);assert.equal(a.recordings.length,3);
});
