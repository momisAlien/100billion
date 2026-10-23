const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const R=require('../lib/room.cjs'),{MemoryStore,transact}=require('../lib/store.cjs');
const req=(type,rest={})=>({type,requestId:randomUUID(),...rest});
const join=(r,h,name=h,t=1000)=>R.action(r,h,req('join',{name}),t);
function rig(r,values){r.shoe=Array.from({length:40},()=>({rank:'K',suit:'♠',value:0}));for(const v of values.toReversed())r.shoe.push({rank:String(v),suit:'♥',value:v})}
test('three simultaneous seats, fourth rejected, rejoin does not mint more dollars',async()=>{
 const s=new MemoryStore();await Promise.all(['a','b','c'].map(h=>transact(s,r=>join(r,h))));
 await assert.rejects(transact(s,r=>join(r,'d')),/세 자리/);
 await transact(s,r=>join(r,'a','changed'));const r=JSON.parse(await s.read());assert.equal(r.players.length,3);assert.equal(r.players[0].balance,10000);
});
test('duplicate requests and concurrent wagers debit at most once',async()=>{
 const s=new MemoryStore();await transact(s,r=>join(r,'a'));const bet=req('bet',{side:'B',amount:1000});
 await Promise.all(Array.from({length:5},()=>transact(s,r=>R.action(r,'a',bet,2000))));
 const r=JSON.parse(await s.read());assert.equal(r.players[0].bets.B,1000);assert.equal(R.view(r,'a',2000).players[0].available,9000);
});
test('solo immediate start, hidden cards, banker commission, exactly one settlement',()=>{
 const r=R.createRoom();join(r,'a');rig(r,[2,4,3,5]);R.action(r,'a',req('bet',{side:'B',amount:1000}),2000);R.action(r,'a',req('ready'),2100);
 assert.equal(r.phase,'dealing');const hidden=R.view(r,'a',2100);assert.ok(hidden.round.steps.every(s=>s.card===null));assert.equal(hidden.round.winner,null);assert.ok(!JSON.stringify(hidden).includes('"hash"'));assert.ok(!('shoe' in hidden));
 R.advance(r,r.round.endAt);assert.equal(r.players[0].balance,10950);assert.equal(r.phase,'result');R.advance(r,r.round.endAt+1);assert.equal(r.players[0].balance,10950);assert.equal(r.history.length,1);
});
test('tie returns player and banker stakes, pays tie 8:1',()=>{
 const r=R.createRoom();join(r,'a');rig(r,[4,4,4,4]);for(const side of ['P','T'])R.action(r,'a',req('bet',{side,amount:100}),2000);R.action(r,'a',req('ready'),2100);R.advance(r,r.round.endAt);assert.equal(r.players[0].balance,10800);
});
test('mid-round join sees same round but cannot bet until next round',()=>{
 const r=R.createRoom();join(r,'a');R.action(r,'a',req('bet',{side:'P',amount:100}),2000);R.action(r,'a',req('ready'),2100);join(r,'b','B',2200);assert.equal(r.players[1].balance,10000);assert.equal(R.view(r,'a',2200).round.id,R.view(r,'b',2200).round.id);
 assert.throws(()=>R.action(r,'b',req('bet',{side:'P',amount:100}),2300),/라운드 진행/);
 R.advance(r,r.round.endAt+R.RESULT_MS+1);assert.equal(r.phase,'waiting');R.action(r,'b',req('bet',{side:'P',amount:100}),r.round.endAt+R.RESULT_MS+2);assert.equal(r.players[1].bets.P,100);
});
test('shared deadline, immutable ready bet, reconnect and explicit leave/re-entry',()=>{
 const r=R.createRoom();join(r,'a');join(r,'b');R.action(r,'a',req('bet',{side:'P',amount:2500}),2000);R.action(r,'a',req('ready'),2100);assert.equal(r.phase,'betting');assert.throws(()=>R.action(r,'a',req('clear'),2200),/완료한/);
 const id=r.players[0].id;join(r,'a','Again',3000);assert.equal(r.players[0].id,id);assert.equal(r.players[0].bets.P,2500);
 R.action(r,'a',req('leave'),4000);join(r,'a','New',4100);const a=r.players.find(p=>p.hash==='a');assert.notEqual(a.id,id);assert.equal(a.balance,10000);assert.equal(R.sum(a.bets),0);
});
test('countdown starts without ready, stale seats expire and invalid stakes cannot overdraft',()=>{
 const r=R.createRoom();join(r,'a');join(r,'b');assert.throws(()=>R.action(r,'a',req('bet',{side:'P',amount:-100}),2000),/올바른/);for(let i=0;i<4;i++)R.action(r,'a',req('bet',{side:'P',amount:2500}),2000);assert.throws(()=>R.action(r,'a',req('bet',{side:'P',amount:100}),2100),/잔액/);R.advance(r,2000+R.BET_MS);assert.equal(r.phase,'dealing');R.advance(r,1000+R.LEASE+1);assert.equal(r.players.length,0);
});
test('departed locked bet cannot be credited to a newly entered $100 seat',()=>{
 const r=R.createRoom();join(r,'a');rig(r,[4,2,5,3]);R.action(r,'a',req('bet',{side:'P',amount:1000}),2000);R.action(r,'a',req('ready'),2100);R.action(r,'a',req('leave'),2200);join(r,'a','New',2300);R.advance(r,r.round.endAt);assert.equal(r.players[0].balance,10000);
});

test('all three viewers share wagers, readiness, cards and per-seat round results',()=>{
 const r=R.createRoom();for(const h of ['a','b','c'])join(r,h);rig(r,[2,4,3,5]);
 for(const [h,side] of [['a','P'],['b','B'],['c','T']])R.action(r,h,req('bet',{side,amount:1000}),2000);
 R.action(r,'a',req('ready'),2100);
 const views=['a','b','c'].map(h=>R.view(r,h,2100));
 for(const v of views){assert.deepEqual(v.players.map(p=>p.bets),[{P:1000,B:0,T:0},{P:0,B:1000,T:0},{P:0,B:0,T:1000}]);assert.equal(v.players[0].ready,true);assert.ok(v.players.every(p=>p.roundNet===null));}
 for(const h of ['b','c'])R.action(r,h,req('ready'),2200);
 R.advance(r,r.round.endAt);
 const results=['a','b','c'].map(h=>R.view(r,h,r.round.endAt));
 for(const v of results){assert.deepEqual(v.players.map(p=>p.roundNet),[-1000,950,-1000]);assert.deepEqual(v.round.steps,results[0].round.steps);assert.equal(v.round.winner,'B');}
 R.action(r,'c',req('leave'),r.round.endAt+1);join(r,'d','new friend',r.round.endAt+2);
 assert.equal(R.view(r,'d',r.round.endAt+2).players.find(p=>p.name==='new friend').roundNet,null);
});

test('chip sound is assigned once per player and shared in snapshots and bet events',()=>{
 const r=R.createRoom();join(r,'a');join(r,'b');const assigned=r.players[0].chipSound;assert.ok([0,1].includes(assigned));
 for(let i=0;i<3;i++){R.action(r,'a',req('bet',{side:'P',amount:100}),2000+i);assert.equal(r.event.chipSound,assigned);assert.equal(R.view(r,'b',2000+i).players[0].chipSound,assigned)}
 join(r,'a','again',2100);assert.equal(r.players[0].chipSound,assigned);
});

test('opposite P/B bets rejected, same side increments and clear permits switching',()=>{
 for(const [first,other] of [['P','B'],['B','P']]){const r=R.createRoom();join(r,'a');R.action(r,'a',req('bet',{side:first,amount:500}),2000);assert.throws(()=>R.action(r,'a',req('bet',{side:other,amount:100}),2001),/동시에/);assert.equal(r.players[0].bets[other],0);R.action(r,'a',req('bet',{side:first,amount:500}),2002);assert.equal(r.players[0].bets[first],1000);R.action(r,'a',req('clear'),2003);R.action(r,'a',req('bet',{side:other,amount:100}),2004);assert.equal(r.players[0].bets[other],100)}
});
