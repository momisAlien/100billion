const {randomUUID,randomInt}=require('node:crypto');
const game=require('../dist/game.js');
const START=10000,MAX=3,LEASE=90000,BET_MS=18000,STEP_MS=1800,INTRO_MS=1200,RESULT_MS=6500;
const sum=b=>b.P+b.B+b.T;
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e};
function shoe(){const d=[];for(let n=0;n<8;n++)for(const suit of ['♠','♥','♦','♣'])for(let r=1;r<=13;r++)d.push({rank:({1:'A',11:'J',12:'Q',13:'K'})[r]||String(r),suit,value:r>=10?0:r});for(let i=d.length-1;i>0;i--){const j=randomInt(i+1);[d[i],d[j]]=[d[j],d[i]]}return d}
function createRoom(){return {schema:2,version:0,players:[],phase:'waiting',deadline:null,round:null,roundNo:0,history:[],shoe:shoe(),seen:[],event:null}}
function begin(room,now){
 const entries=room.players.filter(p=>sum(p.bets)>0).map(p=>({id:p.id,name:p.name,bets:{...p.bets},stake:sum(p.bets)}));
 if(!entries.length){room.phase='waiting';room.deadline=null;room.players.forEach(p=>p.ready=false);return}
 if(room.shoe.length<20)room.shoe=shoe();
 const result=game.round(()=>room.shoe.pop()),steps=game.sequence(result).map(([side,card],i)=>({side,card,at:now+INTRO_MS+i*STEP_MS,revealAt:now+INTRO_MS+i*STEP_MS+1100}));
 room.roundNo++;room.phase='dealing';room.deadline=null;
 room.round={id:room.roundNo,startAt:now,endAt:now+INTRO_MS+steps.length*STEP_MS,result,steps,entries,settled:false};
 room.event={id:randomUUID(),type:'closed',at:now};
}
function advance(room,now){
 // An abandoned tab releases its seat after a grace period. Locked round stakes stay in round.entries.
 room.players=room.players.filter(p=>now-p.lastSeen<=LEASE);
 if(room.phase==='betting'&&room.deadline<=now)begin(room,room.deadline);
 if(room.phase==='dealing'&&room.round.endAt<=now){
  const r=room.round;
  if(!r.settled){
   for(const entry of r.entries){const p=room.players.find(p=>p.id===entry.id);const returned=Math.round(game.returns(entry.bets,r.result.winner));entry.net=returned-entry.stake;if(p){p.balance+=entry.net;p.profit+=entry.net;p.lastNet=entry.net}}
   r.settled=true;room.history.push({id:r.id,winner:r.result.winner,ps:r.result.ps,bs:r.result.bs});room.history=room.history.slice(-120);
  }
  room.phase='result';room.deadline=r.endAt+RESULT_MS;
 }
 if(room.phase==='result'&&room.deadline<=now){room.phase='waiting';room.deadline=null;room.players.forEach(p=>{p.bets={P:0,B:0,T:0};p.ready=false});room.event={id:randomUUID(),type:'collect',at:now}}
}
function action(room,hash,input,now=Date.now()){
 advance(room,now);
 let p=room.players.find(p=>p.hash===hash);
 if(p&&now-p.lastSeen>10000)p.lastSeen=now;
 if(input.type==='sync')return;
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId||''))fail('요청 식별자가 올바르지 않습니다.');
 const key=hash+':'+input.requestId;
 if(room.seen.includes(key))return;
 if(input.type==='join'){
  if(!p){
   if(room.players.length>=MAX)fail('세 자리가 모두 찼습니다. 친구가 퇴장한 뒤 입장해 주세요.',409);
   const name=typeof input.name==='string'?input.name.trim().normalize('NFC'):'';
   if(!name||name.length>16||/[\x00-\x1f<>]/.test(name))fail('닉네임은 1~16자의 일반 문자로 입력해 주세요.');
   p={id:randomUUID(),hash,name,balance:START,profit:0,chipSound:randomInt(2),bets:{P:0,B:0,T:0},ready:false,lastSeen:now,lastNet:null};room.players.push(p);
   room.event={id:randomUUID(),type:'join',name,at:now};
  }
 }else if(input.type==='leave'){
  room.players=room.players.filter(x=>x.hash!==hash);room.event={id:randomUUID(),type:'leave',name:p?.name||'',at:now};
 }else{
  if(!p)fail('입장한 뒤 이용해 주세요.',401);
  if(!['waiting','betting'].includes(room.phase))fail('라운드 진행 중입니다. 다음 베팅을 기다려 주세요.',409);
  if(input.type==='bet'){
   if(p.ready)fail('베팅 완료를 누른 뒤에는 변경할 수 없습니다.',409);
   if(!['P','B','T'].includes(input.side)||![100,500,1000,2500].includes(input.amount))fail('올바른 칩과 베팅 영역을 선택해 주세요.');
   if(sum(p.bets)+input.amount>p.balance)fail('잔액이 부족합니다. 퇴장 후 다시 입장하면 가상 $100을 받습니다.',409);
   p.bets[input.side]+=input.amount;
   if(room.phase==='waiting'){room.phase='betting';room.deadline=now+BET_MS}
   room.event={id:randomUUID(),type:'bet',name:p.name,playerId:p.id,chipSound:p.chipSound??0,side:input.side,amount:input.amount,at:now};
  }else if(input.type==='clear'){
   if(p.ready)fail('완료한 베팅은 취소할 수 없습니다.',409);p.bets={P:0,B:0,T:0};room.event={id:randomUUID(),type:'clear',playerId:p.id,at:now};
  }else if(input.type==='ready'){
   if(room.phase!=='betting')fail('먼저 칩을 올려 베팅을 시작해 주세요.');p.ready=true;
  }else fail('지원하지 않는 동작입니다.');
 }
 // A single occupied seat can start immediately; others may explicitly watch by marking ready with no bet.
 if(room.phase==='betting'){
  if(!room.players.some(x=>sum(x.bets)>0)){room.phase='waiting';room.deadline=null;room.players.forEach(x=>x.ready=false)}
  else if(room.players.every(x=>x.ready))begin(room,now);
 }
 room.seen.push(key);room.seen=room.seen.slice(-180);
}
function view(room,hash,now=Date.now()){
 const me=room.players.find(p=>p.hash===hash),r=room.round;
 const round=r&&['dealing','result'].includes(room.phase)?{
  id:r.id,startAt:r.startAt,endAt:r.endAt,
  steps:r.steps.map(s=>({side:s.side,at:s.at,revealAt:s.revealAt,card:s.revealAt<=now?s.card:null})),
  winner:room.phase==='result'?r.result.winner:null,
  scores:{p:game.score(r.steps.filter(s=>s.side==='p'&&s.revealAt<=now).map(s=>s.card)),b:game.score(r.steps.filter(s=>s.side==='b'&&s.revealAt<=now).map(s=>s.card))},
  net:room.phase==='result'?(r.entries.find(e=>e.id===me?.id)?.net??null):null
 }:null;
 return {version:room.version,serverNow:now,roomName:'MAISON · FRIENDS TABLE',capacity:MAX,phase:room.phase,deadline:room.deadline,roundNo:room.roundNo,round,history:room.history,cardsLeft:room.shoe.length,event:room.event,me:me?.id||null,players:room.players.map(p=>({id:p.id,name:p.name,chipSound:p.chipSound??0,balance:p.balance,available:p.balance-(['waiting','betting','dealing'].includes(room.phase)?sum(p.bets):0),profit:p.profit,bets:p.bets,ready:p.ready,connected:now-p.lastSeen<25000,lastNet:p.lastNet,roundNet:room.phase==='result'?(r.entries.find(e=>e.id===p.id)?.net??null):null}))};
}
module.exports={createRoom,advance,action,view,begin,START,MAX,LEASE,BET_MS,STEP_MS,INTRO_MS,RESULT_MS,sum};
