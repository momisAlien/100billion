const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const money=n=>'$'+(n/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const total=b=>b.P+b.B+b.T;
const director=new DealerDirector();
let snapshot=null,stream=null,online=false,pending=false,chip=100,clockOffset=0;
let stageKey='',lastEvent='',lastRound=null,announced=null,mode='game',lesson=0;
const faces=new Set();
function status(text,error=false){$('#actionStatus').textContent=text;$('#actionStatus').classList.toggle('error',error)}
function setMode(next){mode=next==='rules'?'rules':'game';window.tableSoundsEnabled=mode==='game';if(mode!=='game')window.dealerVoiceCancel?.();$('#gameMode').hidden=mode!=='game';$('#rulesMode').hidden=mode!=='rules';$$('[data-mode]').forEach(b=>{b.classList.toggle('active',b.dataset.mode===mode);if(b.dataset.mode===mode)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});$('#lessonLive').hidden=!snapshot?.me;if(location.hash!=='#'+mode)history.replaceState(null,'','#'+mode)}
$$('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));window.addEventListener('hashchange',()=>setMode(location.hash.slice(1)));setMode(location.hash.slice(1));
function connection(ok){online=ok;$('#connection').textContent=ok?'● 실시간 연결':'○ 재연결 중';$('#connection').classList.toggle('offline',!ok);if(snapshot?.me)seats();controls()}
function controls(){const me=snapshot?.players?.find(p=>p.id===snapshot.me),open=me&&online&&!pending&&['waiting','betting'].includes(snapshot.phase)&&!me.ready;$$('.zone,.chip').forEach(b=>b.disabled=!open);$('#clear').disabled=!open||!total(me.bets);$('#deal').disabled=!open||snapshot.phase!=='betting';$('#deal').textContent=me?.ready?'완료 · 친구 기다리는 중':me&&total(me.bets)?'베팅 완료 →':'이번 판 관전 →';$('#leave').disabled=pending}
function seats(){
 const box=$('#seats');
 for(let i=0;i<3;i++){
  const p=snapshot.players[i];let row=box.children[i];
  if(!row){row=document.createElement('article');box.append(row)}
  const signature=JSON.stringify([p,snapshot.me,snapshot.hostId,snapshot.phase,online]);
  if(row.dataset.signature===signature)continue;
  const oldBets=row.dataset.bets;row.dataset.signature=signature;row.dataset.bets=p?JSON.stringify(p.bets):'';
  row.className='table-seat'+(p?' occupied':' vacant')+(p?.id===snapshot.me?' is-me':'')+(p?.ready?' is-ready':'');
  row.replaceChildren();
  const add=(tag,cls,text,parent=row)=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;parent.append(el);return el};
  const head=add('div','seat-head','');add('span','avatar seat-'+i,p?p.name.slice(0,1):'＋',head);
  const info=add('div','seat-identity','',head);add('strong','',p?p.name:'친구를 기다리는 자리',info);
  add('small','',p?(p.id===snapshot.me?'나 · ':'')+(p.id===snapshot.hostId?'방장':'친구'):'입장 키로 함께하세요',info);
  if(!p){add('p','empty-seat-note','같은 카드, 각자의 베팅');continue}
  const locked=['dealing','result'].includes(snapshot.phase);
  const state=!online?'연결 확인 중':!p.connected?'잠시 자리 비움':snapshot.phase==='result'?'정산 완료':locked?(total(p.bets)?'카드 확인 중':'다음 판 대기'):p.ready?(total(p.bets)?'준비 완료':'이번 판 관전'):total(p.bets)?'베팅 중':'베팅 대기';
  add('span','seat-state',state);
  const bets=add('div','seat-bets','');
  for(const [side,label] of [['P','PLAYER'],['T','TIE'],['B','BANKER']]){
   const cell=add('div','seat-wager '+side+(p.bets[side]?' wagered':''),'',bets);
   add('small','',label,cell);add('b','',p.bets[side]?money(p.bets[side]):'—',cell);
  }
  const footer=add('div','seat-footer','');add('span','', '총 베팅 '+money(total(p.bets)),footer);
  add('span','', '잔액 '+money(p.available),footer);
  if(snapshot.phase==='result')add('div','seat-result'+(p.roundNet>0?' positive':p.roundNet<0?' negative':''),p.roundNet==null?'이번 라운드 관전':'이번 판 '+(p.roundNet>0?'+':'')+money(p.roundNet));
  if(oldBets&&oldBets!==row.dataset.bets&&snapshot.phase==='betting')director.pulse(row,'seat-updated');
 }
 const sums={P:0,T:0,B:0};snapshot.players.forEach(p=>{for(const k of Object.keys(sums))sums[k]+=p.bets[k]});
 $('#tableTotals').textContent='테이블 합계 · P '+money(sums.P)+' / T '+money(sums.T)+' / B '+money(sums.B);
}
function receive(data){
 if(data.me&&snapshot?.me&&data.version<snapshot.version)return;
 if(data.me&&snapshot?.me&&data.version===snapshot.version&&data.serverNow<snapshot.serverNow)return;
 if(!data.me){snapshot=null;stream?.close();stream=null;$('#lobby').hidden=false;$('#tableView').hidden=true;$('#lessonLive').hidden=true;$('#joinStatus').textContent='새 방을 만들거나 친구가 공유한 입장 키로 참여하세요.';return}
 snapshot=data;$('#roomKey').textContent=data.roomCode.match(/.{1,4}/g).join('-');clockOffset=data.serverNow-Date.now();$('#lobby').hidden=true;$('#tableView').hidden=false;$('#lessonLive').hidden=false;connection(true);
 const me=data.players.find(p=>p.id===data.me);$('#seatCount').textContent=data.players.length+' / 3';$('#roomSummary').textContent=data.players.length===1?'혼자서도 바로 시작할 수 있어요. 친구는 언제든 합류할 수 있습니다.':data.players.length+'명이 같은 카드를 함께 보고 있습니다.';
 $('#balance').innerHTML=money(me.available)+' <small>VIRTUAL USD</small>';$('#totalBet').textContent=money(total(me.bets));$('#profit').textContent=(me.profit>0?'+':'')+money(me.profit);$('#profit').style.color=me.profit>=0?'#a1bd95':'#d39085';
 for(const k of ['P','B','T']){$('#bet'+k).textContent=me.bets[k]?money(me.bets[k]):'+';$('[data-bet="'+k+'"]').classList.toggle('placed',me.bets[k]>0);$('#'+k.toLowerCase()+'Count').textContent=data.history.filter(x=>x.winner===k).length}
 $('#rounds').textContent=data.roundNo+' ROUNDS';$('#roundId').textContent='ROUND '+String(data.phase==='waiting'?data.roundNo+1:data.roundNo||1).padStart(2,'0');$('#shoe').textContent=data.cardsLeft+' CARDS';
 $('#road').innerHTML=Array.from({length:48},(_,i)=>{const h=data.history.slice(-48)[i];return '<div>'+(h?'<span class="bead '+h.winner+'">'+h.winner+'</span>':'')+'</div>'}).join('');
 seats();
 const event=data.event;if(event&&event.id!==lastEvent){const prior=lastEvent;lastEvent=event.id;if(prior&&Date.now()+clockOffset-event.at<3500&&['waiting','betting'].includes(data.phase)){
  if(event.type==='bet'){director.pose('betting',event.name+' 님 베팅',1000);director.pulse($('[data-bet="'+event.side+'"]'),'bet-landed');if(event.playerId!==data.me)playEffect('bet',event.chipSound)}
  else if(event.type==='clear'){director.pose('collecting','베팅 반환',1000);playEffect('cancel')}
  else if(event.type==='join')director.pose('betting','새로운 친구가 입장했습니다',1500);
 }}
 renderTimeline();controls();
}
async function getRoom(){const res=await fetch('/api/room',{cache:'no-store'}),data=await res.json();if(!res.ok)throw new Error(data.error);receive(data);return data}
function connectStream(){stream?.close();if(!snapshot?.me)return;stream=new EventSource('/api/room?stream=1');stream.onmessage=e=>{try{receive(JSON.parse(e.data))}catch{connection(false)}};stream.onerror=()=>connection(false);stream.addEventListener('unavailable',()=>{connection(false);status('방 연결이 잠시 끊겼습니다. 재연결되면 이어서 진행합니다.',true)})}
async function send(type,extra={}){
 if(pending)return;pending=true;controls();$('#join').disabled=true;$('#createRoom').disabled=true;
 const payload={type,requestId:crypto.randomUUID(),...extra};
 try{
  let response;
  for(let attempt=0;attempt<2;attempt++){try{response=await fetch('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});break}catch(e){if(attempt)throw e}}
  const data=await response.json();if(!response.ok)throw new Error(data.error||'요청을 처리하지 못했습니다.');receive(data);status('');return data;
 }catch(e){status(e.message||'연결을 확인해 주세요.',true);try{await getRoom()}catch{connection(false)}if(['join','create'].includes(type))$('#joinStatus').textContent=e.message;return null}
 finally{pending=false;$('#join').disabled=false;$('#createRoom').disabled=false;controls()}
}
$('#joinForm').onsubmit=async e=>{e.preventDefault();$('#joinStatus').textContent='자리를 준비하고 있습니다…';const intent=e.submitter?.dataset.intent==='create'?'create':'join';const data=await send(intent,{name:$('#nickname').value,code:$('#roomCode').value});if(data?.me){$('#roomCode').value='';try{localStorage.setItem('maison-nickname',$('#nickname').value)}catch{}connectStream()}};
try{$('#nickname').value=localStorage.getItem('maison-nickname')||''}catch{}
$('#leave').onclick=async()=>{if(!confirm('퇴장하면 현재 잔액을 돌려받을 수 없습니다. 다시 입장하면 가상 $100으로 시작합니다. 퇴장할까요?'))return;const data=await send('leave');if(data&&!data.me){window.dealerVoiceCancel?.();director.pose('idle','베팅 대기');status('');stageKey='';lastRound=null;announced=null}};
$('#invite').onclick=async()=>{try{await navigator.clipboard.writeText('MAISON 입장 키: '+$('#roomKey').textContent+'\n'+location.origin+'/#game');status('입장 키와 사이트 주소를 복사했습니다. 친구에게 보내주세요.')}catch{status('입장 키 '+$('#roomKey').textContent+'와 주소창의 링크를 친구에게 알려주세요.')}};
$$('.chip').forEach(el=>el.onclick=()=>{chip=Number(el.dataset.chip);$$('.chip').forEach(c=>{c.classList.toggle('selected',c===el);c.setAttribute('aria-pressed',String(c===el))});director.pulse(el,'chip-picked');director.pose('betting','칩 선택 · '+money(chip),1200);playEffect('select')});
$$('.zone').forEach(el=>el.onclick=async()=>{const data=await send('bet',{side:el.dataset.bet,amount:chip});if(data){playEffect('bet',data.players.find(p=>p.id===data.me)?.chipSound);director.flyChip($('.chip.selected'),el,chip/100)}});
$('#clear').onclick=async()=>{const me=snapshot?.players.find(p=>p.id===snapshot.me),bets=me?{...me.bets}:null;const data=await send('clear');if(data&&bets)for(const k of ['P','B','T'])if(bets[k])director.flyChip($('[data-bet="'+k+'"]'),$('.chip.selected'),bets[k]/100)};
$('#deal').onclick=async()=>{const data=await send('ready');if(data)status(data.phase==='dealing'?'모두 준비됐습니다. 딜러가 카드를 나눕니다.':'베팅 완료. 친구들의 준비 또는 마감 시간을 기다립니다.')};
function faceHtml(c){return '<b>'+c.rank+'</b><small>'+c.suit+'</small><span class="suit">'+c.suit+'</span><span class="corner">'+c.rank+'<small>'+c.suit+'</small></span>'}
function syncCard(s,i,r,now){
 if(now<s.at+600)return;
 const id='round-card-'+i;let el=document.getElementById(id);
 if(!el){el=document.createElement('div');el.id=id;el.className='playing-card';el.setAttribute('role','img');el.setAttribute('aria-label','뒷면 카드');el.innerHTML='<div class="card-turn"><div class="card-back" aria-hidden="true"><span>♧</span><small>MAISON</small></div><div class="card-face" aria-hidden="true"></div></div>';$('#'+s.side+'Cards').append(el);
  if(now-s.at<1500){const shoe=$('.shoe-prop').getBoundingClientRect(),rect=el.getBoundingClientRect();el.style.setProperty('--deal-x',shoe.left-rect.left+'px');el.style.setProperty('--deal-y',shoe.top-rect.top+'px');el.classList.add('arriving')}
 }
 if(s.card&&now>=s.revealAt&&!el.classList.contains('revealed')){const face=el.querySelector('.card-face');face.classList.toggle('red',['♥','♦'].includes(s.card.suit));face.innerHTML=faceHtml(s.card);el.classList.add('revealed');el.setAttribute('aria-label',s.card.rank+s.card.suit);const key=r.id+':'+i;if(!faces.has(key)&&now-s.revealAt<1800)playEffect('flip');faces.add(key)}
}
function renderTimeline(){
 if(!snapshot?.me)return;const now=Date.now()+clockOffset,r=snapshot.round;
 const phase=snapshot.phase;$('#phaseLabel').textContent={waiting:'베팅 대기',betting:'베팅 진행',dealing:'카드 배분',result:'라운드 결과'}[phase];
 $('#countdown').textContent=phase==='waiting'?'칩을 놓으면 시작합니다':phase==='betting'?Math.max(0,Math.ceil((snapshot.deadline-now)/1000))+'초 후 베팅 마감':phase==='result'?Math.max(0,Math.ceil((snapshot.deadline-now)/1000))+'초 후 다음 라운드':'모두에게 같은 카드가 배분됩니다';
 if(!r){
  if(lastRound!==null){director.clearResult();director.clearCards(false).then(()=>{if(!snapshot?.round){$('#pCards').replaceChildren();$('#bCards').replaceChildren()}});lastRound=null;faces.clear()}
  if(stageKey!==phase){stageKey=phase;if(phase==='betting')window.dealerSpeak?.('betting');if(phase==='waiting')status('');director.pose(phase==='betting'?'betting':'idle',phase==='betting'?'베팅 접수 중':'베팅 대기');$('#pScore').textContent='—';$('#bScore').textContent='—'}
  const me=snapshot.players.find(p=>p.id===snapshot.me);$('#caption').textContent=me.ready?'베팅 완료. 친구를 기다리고 있습니다.':phase==='betting'?'베팅을 추가하거나 완료해 주세요.':'칩을 선택해 새 라운드를 시작해 주세요.';
  return;
 }
 if(lastRound!==r.id){lastRound=r.id;announced=null;faces.clear();director.clearResult();$('#pCards').replaceChildren();$('#bCards').replaceChildren();if(mode==='game')$('.scene').scrollIntoView({behavior:director.reduced.matches?'instant':'smooth',block:'start'})}
 r.steps.forEach((s,i)=>syncCard(s,i,r,now));
 for(const side of ['p','b']){const cards=r.steps.filter(s=>s.side===side&&s.card&&now>=s.revealAt).map(s=>s.card);$('#'+side+'Score').textContent=cards.length?Baccarat.score(cards):'—'}
 if(phase==='result'){
  if(announced!==r.id){announced=r.id;director.announce(r.winner,r.net===null?null:r.net/100);$('.result-banner>span').textContent=r.net===null?'이번 라운드 관전':(r.net>0?'+':'')+money(r.net)+' · VIRTUAL USD';$('[data-bet="'+r.winner+'"]').classList.add('winner');if(r.net>0){director.pulse($('.wallet'),'paid');director.flyChip($('[data-bet="'+r.winner+'"]'),$('.wallet'),r.net/100,true);playEffect('payout')}}
  $('#caption').textContent={P:'플레이어 승리',B:'뱅커 승리',T:'타이 · 무승부'}[r.winner]+' · '+r.scores.p+' : '+r.scores.b;
  $('#result').textContent=$('#caption').textContent+(r.net===null?' · 관전':' / '+(r.net>0?'+':'')+money(r.net));return;
 }
 const active=r.steps.findIndex(s=>now>=s.at&&now<s.at+1800);
 const s=r.steps[active];let key,pose,label,effect;
 if(!s){key=r.id+':closed';pose='closed';label='베팅 마감';effect='closed'}
 else{const drawing=now<s.at+600;key=r.id+':'+active+':'+(drawing?'draw':'deal');pose=drawing?'drawing':s.side==='p'?'deal-player':'deal-banker';label=drawing?'카드를 꺼내고 있습니다':(s.side==='p'?'플레이어':'뱅커')+'에게 배분';effect=drawing?'draw':'slide'}
 if(key!==stageKey){stageKey=key;director.pose(pose,label);playEffect(effect);$('.shoe-prop').classList.toggle('drawing',pose==='drawing')}
 $('#caption').textContent=label;
}
setInterval(renderTimeline,150);
const lessons=[
 {title:'어느 쪽이 이길지 선택하세요.',text:'플레이어, 뱅커, 타이 중 선택해 가상 칩을 올립니다. 플레이어와 뱅커는 카드가 놓이는 두 자리의 이름입니다. 참가자 누구나 같은 쪽에 베팅해도 괜찮아요.',note:'예시에서는 뱅커에 $10을 베팅합니다.',p:[],b:[]},
 {title:'합계의 마지막 숫자가 점수예요.',text:'플레이어는 2 + 3 = 5점, 뱅커는 3 + 2 = 5점입니다. 두 자리 모두 내추럴 8·9가 아니므로 추가 카드 규칙을 확인합니다.',note:'A는 1점. 10과 그림 카드는 0점입니다.',p:['2♠','3♥'],b:['3♣','2♦']},
 {title:'추가 카드는 규칙대로 자동 배분.',text:'플레이어가 5점이라 6을 한 장 더 받습니다. 합계 11 → 1점. 뱅커도 5점이고 플레이어의 세 번째 카드가 6이므로 한 장 더 받습니다. 3을 받아 합계 8점이 됩니다.',note:'뱅커 5점: 플레이어의 세 번째 카드가 4~7이면 추가합니다.',p:['2♠','3♥','6♦'],b:['3♣','2♦','3♠']},
 {title:'뱅커 8점, 플레이어 1점. 뱅커 승리!',text:'뱅커에 베팅한 $10의 순수익은 $9.50입니다. 원금까지 $19.50을 돌려받으므로, $100으로 시작했다면 잔액은 $109.50이 됩니다.',note:'이 화면은 설명용 예시입니다. 실제 공용 방 잔액에는 영향을 주지 않습니다.',p:['2♠','3♥','6♦'],b:['3♣','2♦','3♠']}
];
function renderLesson(){const l=lessons[lesson];$('#lessonTitle').textContent=l.title;$('#lessonText').textContent=l.text;$('#lessonNote').textContent=l.note;$('#lessonStep').textContent='0'+(lesson+1)+' / 04';$('#lessonPrev').disabled=lesson===0;$('#lessonNext').textContent=lesson===3?'처음부터 ↻':'다음 단계 →';$$('[data-step]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.step)===lesson);b.setAttribute('aria-pressed',String(Number(b.dataset.step)===lesson))});for(const side of ['p','b']){$('#lesson'+side.toUpperCase()+'Cards').innerHTML=(l[side].length?l[side]:['?','?']).map(c=>'<span class="lesson-card '+(/[♥♦]/.test(c)?'red':'')+'">'+c+'</span>').join('');$('#lesson'+side.toUpperCase()+'Score').textContent=lesson===0?'—':lesson===1?'5':side==='p'?'1':'8'}$('#lessonResult').textContent=lesson===3?'BANKER WINS · +$9.50':lesson===0?'뱅커에 $10 베팅':'9에 더 가까운 쪽이 승리합니다.'}
$$('[data-step]').forEach(b=>b.onclick=()=>{lesson=Number(b.dataset.step);renderLesson()});$('#lessonPrev').onclick=()=>{lesson=Math.max(0,lesson-1);renderLesson()};$('#lessonNext').onclick=()=>{lesson=(lesson+1)%4;renderLesson()};renderLesson();
getRoom().then(data=>{if(data.me)connectStream()}).catch(e=>{$('#joinStatus').textContent=e.message||'공용 방 서버에 연결할 수 없습니다.';connection(false)});
