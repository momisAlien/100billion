(() => {
const $=s=>document.querySelector(s),key='maison-dealer-v2',roster=window.DEALER_ROSTER;
const defaults={character:'sophia',voice:false,voiceURI:'',volume:80,rate:95};
let settings={...defaults},currentSpeech,selection=0,applying=0;
try{const saved=JSON.parse(localStorage.getItem(key)||localStorage.getItem('maison-dealer-v1')||'null');if(saved)for(const k of Object.keys(defaults))if(saved[k]!==undefined)settings[k]=saved[k]}catch{}
if(!roster.some(c=>c.id===settings.character))settings.character='sophia';
settings.voice=settings.voice===true;settings.volume=Math.max(10,Math.min(100,Number(settings.volume)||80));settings.rate=Math.max(75,Math.min(120,Number(settings.rate)||95));
settings.name=roster.find(c=>c.id===settings.character).name;
selection=roster.findIndex(c=>c.id===settings.character);
function persist(){try{localStorage.setItem(key,JSON.stringify(settings));return true}catch{$('#customStatus').textContent='이 브라우저에서 설정 저장이 차단돼 있습니다. 이번 접속 동안 적용됩니다.';return false}}
function fields(){$('#dealerVoice').checked=settings.voice;$('#voiceVolume').value=settings.volume;$('#voiceRate').value=settings.rate}
function picture(el,c){el.style.backgroundImage='url("'+(c.atlas||c.image)+'")';el.classList.toggle('atlas-picture',!!c.atlas)}
function render(){
 const c=roster[selection];picture($('#characterPortrait'),c);$('#characterPortrait').setAttribute('aria-label',c.name+' 딜러 미리보기');
 $('#characterName').textContent=c.name+' · '+c.english;$('#characterTag').textContent=c.tag;$('#characterDescription').textContent=c.description;
 $('#characterNumber').textContent=String(selection+1).padStart(2,'0')+' / '+roster.length;
 $('#chooseDealer').textContent=c.id===settings.character?'선택 중 · '+c.name+'와 플레이 →':c.name+' 딜러 선택 →';
 for(const [i,button] of [...$('#dealerRoster').children].entries()){button.classList.toggle('browsing',i===selection);button.classList.toggle('equipped',roster[i].id===settings.character);button.setAttribute('aria-pressed',String(i===selection))}
}
function move(step){selection=(selection+step+roster.length)%roster.length;render();$('#dealerRoster').children[selection].scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'})}
for(const [i,c] of roster.entries()){
 const button=document.createElement('button');button.className='roster-card';button.setAttribute('aria-label',c.name+' 선택');
 const photo=document.createElement('span');photo.className='roster-photo';picture(photo,c);const name=document.createElement('span');name.textContent=c.name;button.append(photo,name);
 button.onclick=()=>{selection=i;render()};$('#dealerRoster').append(button);
}
async function applyCharacter(id,close=true){
 const request=++applying;$('#chooseDealer').disabled=true;$('#customStatus').textContent='딜러를 준비하고 있습니다…';
 const ok=await director.setCharacter(id);if(request!==applying)return;
 $('#chooseDealer').disabled=false;
 if(!ok){$('#customStatus').textContent='딜러 이미지를 불러오지 못했습니다. 연결을 확인하고 다시 선택해 주세요.';return}
 settings.character=id;settings.name=roster.find(c=>c.id===id).name;
 const tag=$('.dealer-tag');tag.replaceChildren();const light=document.createElement('i');tag.append(light,document.createTextNode(' 딜러 · '+settings.name));
 const saved=persist();if(saved)$('#customStatus').textContent=settings.name+' 딜러를 선택했습니다.';render();
 if(close){$('#dealerDialog').close();window.dealerVoiceCancel()}
}
$('#dealerSettings').onclick=()=>{selection=roster.findIndex(c=>c.id===settings.character);render();fields();voices();$('#dealerDialog').showModal()};
$('#closeCustom').onclick=()=>{$('#dealerDialog').close();window.dealerVoiceCancel()};
$('#dealerDialog').addEventListener('cancel',()=>window.dealerVoiceCancel());
$('#previousDealer').onclick=()=>move(-1);$('#nextDealer').onclick=()=>move(1);
$('#characterCarousel').onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowRight'?1:-1)}};
let touchStart;
$('#characterCarousel').addEventListener('touchstart',e=>{touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});
$('#characterCarousel').addEventListener('touchend',e=>{if(!touchStart)return;const dx=e.changedTouches[0].clientX-touchStart.x,dy=e.changedTouches[0].clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))move(dx<0?1:-1)},{passive:true});
$('#chooseDealer').onclick=()=>applyCharacter(roster[selection].id);
for(const [id,k] of [['voiceVolume','volume'],['voiceRate','rate']])$('#'+id).oninput=()=>{settings[k]=Number($('#'+id).value);persist()};
const synth=window.speechSynthesis,supported=!!synth&&!!window.SpeechSynthesisUtterance;
function voices(){
 const select=$('#voiceChoice');select.replaceChildren();const first=document.createElement('option');first.value='';first.textContent='기기 기본 한국어 음성';select.append(first);
 if(!supported){$('#voiceStatus').textContent='이 브라우저는 음성 안내를 지원하지 않습니다.';for(const id of ['dealerVoice','voiceChoice','testVoice'])$('#'+id).disabled=true;return}
 const list=synth.getVoices().sort((a,b)=>Number(b.lang.startsWith('ko'))-Number(a.lang.startsWith('ko')));
 for(const voice of list){const option=document.createElement('option');option.value=voice.voiceURI;option.textContent=voice.name+' · '+voice.lang;select.append(option)}
 select.value=list.some(v=>v.voiceURI===settings.voiceURI)?settings.voiceURI:'';
 if(!list.length)$('#voiceStatus').textContent='음성 목록을 기다리고 있습니다. 미리 듣기로 기기 기본 음성을 확인하세요.';
 else $('#voiceStatus').textContent='한국어 음성을 위에 표시합니다. 선택한 기기 음성이 베팅 안내와 승패를 읽어줍니다.';
}
window.dealerVoiceCancel=()=>{if(supported)synth.cancel();currentSpeech=null};
const lines={betting:'베팅해 주세요.',closed:'베팅을 마감합니다.',player:'플레이어 승리입니다.',banker:'뱅커 승리입니다.',tie:'타이, 무승부입니다.'};
window.dealerSpeak=(event,test=false)=>{
 if(!supported||document.hidden||(!test&&(!settings.voice||window.tableSoundsEnabled===false||$('#sound').getAttribute('aria-pressed')!=='true')))return;
 window.dealerVoiceCancel();
 const utterance=new window.SpeechSynthesisUtterance(test?'안녕하세요. 딜러 '+(settings.name.trim()||'소피아')+'입니다. 즐거운 게임 되세요.':lines[event]);
 if(!utterance.text)return;
 const list=synth.getVoices(),voice=list.find(v=>v.voiceURI===settings.voiceURI)||list.find(v=>v.lang.startsWith('ko'));
 if(voice)utterance.voice=voice;utterance.lang=voice?.lang||'ko-KR';utterance.volume=settings.volume/100;utterance.rate=settings.rate/100;
 utterance.onerror=e=>{if(!['canceled','interrupted'].includes(e.error))$('#voiceStatus').textContent='음성을 재생하지 못했습니다. 다른 목소리를 선택하거나 브라우저 음성 지원을 확인해 주세요.'};
 currentSpeech=utterance;synth.speak(utterance);
};
$('#dealerVoice').onchange=()=>{settings.voice=$('#dealerVoice').checked;if(!settings.voice)window.dealerVoiceCancel();persist()};
$('#voiceChoice').onchange=()=>{settings.voiceURI=$('#voiceChoice').value;window.dealerVoiceCancel();persist()};
$('#testVoice').onclick=()=>window.dealerSpeak('test',true);
document.addEventListener('visibilitychange',()=>{if(document.hidden)window.dealerVoiceCancel()});
if(supported)synth.addEventListener('voiceschanged',voices);
fields();render();applyCharacter(settings.character,false);voices();
})();
