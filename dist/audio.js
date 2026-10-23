(() => {
const $=s=>document.querySelector(s);
let soundOn=false,ctx,master,musicBus,fxBus,timer,note=0,busy=false;
let preferred=true;try{preferred=localStorage.getItem('maison-sound')!=='off'}catch{}
function tone(freq,dur=.25,volume=.08,type='sine',bus=fxBus,delay=0){
  if(!soundOn||!ctx||ctx.state!=='running')return;
  const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime+delay;o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(bus);o.start(t);o.stop(t+dur);o.onended=()=>{o.disconnect();g.disconnect()};
}
function noise(dur,frequency,volume){
  if(!soundOn||!ctx||ctx.state!=='running')return;
  const length=Math.ceil(ctx.sampleRate*dur),buffer=ctx.createBuffer(1,length,ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*(1-i/length);
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=buffer;filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.8;gain.gain.value=volume;source.connect(filter).connect(gain).connect(fxBus);source.start();source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()};
}
// Short resonant impacts, like stacked clay/composite chips (no card-scrape noise).
function chips(count=3){
  if(!soundOn||!ctx||ctx.state!=='running')return;
  for(let n=0;n<count;n++){
    const duration=.13,buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
    const shift=.94+Math.random()*.12;
    for(let i=0;i<data.length;i++){
      const t=i/ctx.sampleRate;
      data[i]=.42*(Math.sin(2*Math.PI*1180*shift*t)*Math.exp(-t*75)+.5*Math.sin(2*Math.PI*2470*shift*t)*Math.exp(-t*105)+.24*Math.sin(2*Math.PI*3910*shift*t)*Math.exp(-t*145))+(Math.random()*2-1)*.11*Math.exp(-t*1200);
    }
    const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;gain.gain.value=.7/(1+n*.25);source.connect(gain).connect(fxBus);source.start(ctx.currentTime+n*.045);source.onended=()=>{source.disconnect();gain.disconnect()};
  }
}
const chipSamples=[null,null];let sampleLoad;
function loadChipSamples(){
 if(!sampleLoad)sampleLoad=Promise.all([1,2].map(async(n)=>{
  try{const response=await fetch('assets/audio/chip-'+n+'.mp3');if(!response.ok)throw Error('Audio unavailable');chipSamples[n-1]=await ctx.decodeAudioData(await response.arrayBuffer())}catch{}
 })).then(()=>{sampleLoad=null});
 return sampleLoad;
}
function recordedChip(variant=0){
 if(!soundOn||!ctx||ctx.state!=='running'||document.hidden)return;
 const buffer=chipSamples[variant===1?1:0];if(!buffer)return;
 const source=ctx.createBufferSource();source.buffer=buffer;source.connect(fxBus);source.start();source.onended=()=>source.disconnect();
}
window.playEffect=function(name,variant){
  if(window.tableSoundsEnabled===false)return;
  const spoken={closed:'closed','player-win':'player','banker-win':'banker',tie:'tie'}[name];if(spoken)window.dealerSpeak?.(spoken);
  switch(name){
    case 'select':chips(1);break;
    case 'bet':recordedChip(variant);break;
    case 'cancel':chips(4);break;
    case 'closed':tone(392,.3,.1);tone(294,.35,.08,'sine',fxBus,.12);break;
    case 'draw':noise(.18,3400,.18);break;
    case 'slide':noise(.26,1500,.2);break;
    case 'flip':noise(.08,4200,.3);tone(250,.08,.045,'triangle');break;
    case 'sweep':noise(.35,2200,.2);break;
    case 'player-win':[523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,.85,.1,'sine',fxBus,i*.13));break;
    case 'banker-win':[392,493.88,587.33,783.99].forEach((f,i)=>tone(f,.85,.1,'sine',fxBus,i*.13));break;
    case 'tie':[440,554.37,659.25].forEach(f=>tone(f,1.2,.07));break;
    case 'payout':chips(6);break;
    case 'error':tone(150,.22,.1,'triangle');break;
    case 'reset':tone(330,.2,.08);tone(660,.5,.08,'sine',fxBus,.15);break;
  }
};
function music(){
  clearTimeout(timer);if(!soundOn||document.hidden)return;
  const chords=[[130.81,164.81,196,246.94],[110,130.81,164.81,196],[87.31,110,130.81,164.81],[98,123.47,146.83,185]],c=chords[Math.floor(note/8)%4];tone(c[note%4]*(note%3===0?2:1),2.4,.065,'sine',musicBus);
  if(note%8===0){c.forEach(f=>tone(f,4,.018,'sine',musicBus));tone(c[0]/2,2.8,.07,'sine',musicBus)}note++;timer=setTimeout(music,520);
}
function renderSound(){
  const active=soundOn&&ctx?.state==='running';
  $('#sound span').textContent=active?'사운드 ON':soundOn?'사운드 재개':'사운드 OFF';
  $('#sound').setAttribute('aria-label',active?'사운드 끄기':'사운드 켜기');
  $('#sound').setAttribute('aria-pressed',String(active));
}
async function setSound(enabled,remember=false){
  if(busy)return;busy=true;
  try{
    if(enabled){
      if(!ctx){
        ctx=new(window.AudioContext||window.webkitAudioContext)();
        master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
        musicBus=ctx.createGain();musicBus.gain.value=.85;musicBus.connect(master);
        fxBus=ctx.createGain();fxBus.connect(master);
        ctx.onstatechange=renderSound;
      }
      await ctx.resume();
      if(ctx.state!=='running')throw new Error('Audio suspended');
    }
    soundOn=enabled;if(!enabled)window.dealerVoiceCancel?.();clearTimeout(timer);
    if(master)master.gain.setTargetAtTime(enabled?.7:0,ctx.currentTime,.08);
    if(remember){preferred=enabled;try{localStorage.setItem('maison-sound',enabled?'on':'off')}catch{}}
    renderSound();
    if(enabled){loadChipSamples();music();tone(980,.12,.12,'triangle')}
  }catch{
    soundOn=false;renderSound();
    $('#sound span').textContent='눌러서 사운드 켜기';
    $('#sound').title='브라우저의 사이트 소리 권한과 기기 음량을 확인해 주세요.';
  }finally{busy=false}
}
$('#sound').onclick=()=>setSound(!(soundOn&&ctx?.state==='running'),true);
// Start inside the user's click gesture, before the asynchronous room request.
for(const id of ['createRoom','join'])$('#'+id).addEventListener('click',()=>{if(preferred&&!soundOn)setSound(true)});
// A refreshed page needs a new gesture; also recover from mobile audio interruptions.
document.addEventListener('pointerdown',e=>{
  if(e.target.closest?.('#sound'))return;
  if(preferred&&!$('#tableView').hidden&&(!ctx||ctx.state!=='running'))setSound(true);
});
document.addEventListener('visibilitychange',()=>{
  if(!ctx)return;
  if(document.hidden){clearTimeout(timer);ctx.suspend().catch(()=>{})}
  else if(soundOn)ctx.resume().then(()=>{renderSound();music()}).catch(renderSound);
});
renderSound();
})();
