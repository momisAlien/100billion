const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{randomUUID}=require('node:crypto');
const store=require('../lib/store.cjs');const memory=new store.MemoryStore();store.getStore=()=>memory;
process.env.ROOM_CODE='test-only-room';const handler=require('../api/room.js');
test('HTTP three-client room: code gate, private payload, capacity, SSE, reconnect, replay and re-entry',async()=>{
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const clients=Array.from({length:4},()=>({cookie:''}));
 const call=async(c,data)=>{const res=await fetch(base+'/api/room',{method:data?'POST':'GET',headers:{Cookie:c.cookie,...(data?{'Content-Type':'application/json',Origin:base}:{})},body:data?JSON.stringify(data):undefined});if(res.headers.get('set-cookie'))c.cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,data:await res.json()}};
 try{
  await Promise.all(clients.map(c=>call(c)));
  const bad=await call(clients[0],{type:'join',requestId:randomUUID(),name:'A',code:'wrong'});assert.equal(bad.status,403);
  const joined=await Promise.all(clients.slice(0,3).map((c,i)=>call(c,{type:'join',requestId:randomUUID(),name:'Friend '+i,code:'test-only-room'})));assert.ok(joined.every(r=>r.status===200));
  assert.equal((await call(clients[3],{type:'join',requestId:randomUUID(),name:'Fourth',code:'test-only-room'})).status,409);
  const outsider=await call(clients[3]);assert.equal(outsider.data.players,undefined);assert.equal(outsider.data.history,undefined);
  const outsiderPost=await call(clients[3],{type:'leave',requestId:randomUUID()});assert.equal(outsiderPost.data.players,undefined);
  const original=(await call(clients[0])).data;assert.equal(original.players.length,3);assert.equal(original.players.find(p=>p.id===original.me).balance,10000);
  const bet={type:'bet',side:'B',amount:500,requestId:randomUUID()};await call(clients[0],bet);const replay=await call(clients[0],bet);assert.equal(replay.data.players.find(p=>p.id===replay.data.me).bets.B,500);
  const friend=(await call(clients[1])).data;assert.equal(friend.deadline,replay.data.deadline);assert.equal(friend.players.find(p=>p.id===replay.data.me).bets.B,500);
  const stream=await fetch(base+'/api/room?stream=1',{headers:{Cookie:clients[1].cookie}});assert.match(stream.headers.get('content-type'),/text\/event-stream/);const reader=stream.body.getReader();const part=await reader.read();assert.match(new TextDecoder().decode(part.value),/data:/);await reader.cancel();
  const reconnect=(await call(clients[0])).data;assert.equal(reconnect.me,original.me);
  await call(clients[0],{type:'leave',requestId:randomUUID()});const again=(await call(clients[0],{type:'join',requestId:randomUUID(),name:'Rejoined',code:'test-only-room'})).data;assert.notEqual(again.me,original.me);assert.equal(again.players.find(p=>p.id===again.me).balance,10000);
  const cross=await fetch(base+'/api/room',{method:'POST',headers:{Cookie:clients[0].cookie,Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify({type:'leave',requestId:randomUUID()})});assert.equal(cross.status,403);
  // Run a complete shared round through the actual HTTP API with three independent sessions.
  await Promise.all(clients.slice(0,3).map((c,i)=>call(c,{type:'bet',side:['P','B','T'][i],amount:100,requestId:randomUUID()})));
  await Promise.all(clients.slice(0,3).map(c=>call(c,{type:'ready',requestId:randomUUID()})));
  const started=(await call(clients[0])).data;assert.equal(started.phase,'dealing');assert.ok(started.round.steps.every(s=>s.card===null));
  let done;const deadline=Date.now()+18000;
  do{await new Promise(r=>setTimeout(r,400));done=(await call(clients[0])).data}while(done.phase!=='result'&&Date.now()<deadline);
  assert.equal(done.phase,'result');const results=await Promise.all(clients.slice(0,3).map(c=>call(c)));
  const game=require('../dist/game.js');
  for(let i=0;i<3;i++){const d=results[i].data;assert.equal(d.round.id,done.round.id);assert.equal(d.round.winner,done.round.winner);assert.deepEqual(d.round.steps,done.round.steps);const b={P:0,B:0,T:0};b[['P','B','T'][i]]=100;assert.equal(d.players.find(p=>p.id===d.me).balance,10000-100+Math.round(game.returns(b,d.round.winner)))}
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
