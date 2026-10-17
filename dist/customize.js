(() => {
const $=s=>document.querySelector(s),key='maison-dealer-v1';
const defaults={name:'소피아',photo:'',x:50,y:30,zoom:100,voice:false,voiceURI:'',volume:80,rate:95};
let settings={...defaults},photoTicket=0,currentSpeech;
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&typeof saved==='object')settings={...defaults,...saved}}catch{}
const clamp=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
settings.name=typeof settings.name==='string'?settings.name.slice(0,16):defaults.name;
settings.photo=typeof settings.photo==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(settings.photo)&&settings.photo.length<1500000?settings.photo:'';
for(const [k,min,max] of [['x',0,100],['y',0,100],['zoom',100,180],['volume',10,100],['rate',75,120]])settings[k]=clamp(settings[k],min,max,defaults[k]);
settings.voice=settings.voice===true;
const frame=document.createElement('div');frame.className='custom-dealer-frame';
const portrait=document.createElement('img');portrait.alt='';frame.append(portrait);$('.dealer-stage').append(frame);
function apply(){
 $('.scene').classList.toggle('custom-dealer',!!settings.photo);
 portrait.src=settings.photo||'assets/dealer-idle.webp';
 $('#portraitPreview').src=portrait.src;
 for(const image of [portrait,$('#portraitPreview')]){image.style.objectPosition=settings.x+'% '+settings.y+'%';image.style.transform='scale('+settings.zoom/100+')'}
 const tag=$('.dealer-tag');tag.replaceChildren();const light=document.createElement('i');tag.append(light,document.createTextNode(' 딜러 · '+(settings.name.trim()||'소피아')));
}
function persist(){try{localStorage.setItem(key,JSON.stringify(settings));$('#customStatus').textContent='이 브라우저에 저장했습니다.';return true}catch{$('#customStatus').textContent='저장 공간이 부족하거나 저장이 차단됐습니다. 현재 화면에는 적용되지만 새로고침하면 초기화될 수 있어요.';return false}}
function fields(){
 $('#dealerName').value=settings.name;$('#dealerVoice').checked=settings.voice;
 for(const [id,k] of [['portraitX','x'],['portraitY','y'],['portraitZoom','zoom'],['voiceVolume','volume'],['voiceRate','rate']])$('#'+id).value=settings[k];
}
$('#dealerSettings').onclick=()=>{$('#dealerDialog').showModal();fields();voices()};
$('#closeCustom').onclick=()=>{$('#dealerDialog').close();window.dealerVoiceCancel()};
$('#dealerDialog').addEventListener('cancel',()=>window.dealerVoiceCancel());
$('#saveCustom').onclick=()=>{if(persist())$('#dealerDialog').close();window.dealerVoiceCancel()};
$('#dealerName').oninput=()=>{settings.name=$('#dealerName').value;apply();persist()};
for(const [id,k] of [['portraitX','x'],['portraitY','y'],['portraitZoom','zoom'],['voiceVolume','volume'],['voiceRate','rate']])$('#'+id).oninput=()=>{settings[k]=Number($('#'+id).value);apply();persist()};
$('#resetPortrait').onclick=()=>{photoTicket++;settings.photo='';settings.x=50;settings.y=30;settings.zoom=100;$('#dealerPhoto').value='';fields();apply();persist()};
$('#dealerPhoto').onchange=async()=>{
 const ticket=++photoTicket,file=$('#dealerPhoto').files[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){$('#customStatus').textContent='10MB 이하의 JPG, PNG, WebP 사진을 선택해 주세요.';return}
 const url=URL.createObjectURL(file);$('#customStatus').textContent='사진을 준비하고 있습니다…';
 try{
  const image=new Image();image.src=url;await image.decode();if(ticket!==photoTicket)return;
  if(!image.width||!image.height)throw new Error('Invalid image');
  const ratio=Math.min(1,960/Math.max(image.width,image.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  settings.photo=canvas.toDataURL('image/jpeg',.82);settings.x=50;settings.y=30;settings.zoom=100;
  fields();apply();persist();
 }catch{$('#customStatus').textContent='사진을 읽지 못했습니다. 다른 사진을 선택해 주세요.'}finally{URL.revokeObjectURL(url)}
};
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
fields();apply();voices();
})();
