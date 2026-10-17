const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{randomUUID}=require('node:crypto');
const store=require('../lib/store.cjs');const {PGlite}=require('@electric-sql/pglite');const {NeonStore,SETUP}=require('../lib/neon.cjs');const pg=new PGlite();const database={query:async(q,p)=>(await pg.query(q,p)).rows};
const rooms=new Map();store.getStore=(key='lobby')=>{if(!rooms.has(key))rooms.set(key,new NeonStore(database,key));return rooms.get(key)};
const handler=require('../api/room.js');
test('HTTP random rooms: create retry, keys, isolation, host transfer, capacity, SSE and shared settlement',async()=>{
 await pg.transaction(async tx=>{for(const q of SETUP)await tx.query(q)});
 const server=http.createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const clients=Array.from({length:4},()=>({cookie:''}));
 const call=async(c,data)=>{const res=await fetch(base+'/api/room',{method:data?'POST':'GET',headers:{Cookie:c.cookie,...(data?{'Content-Type':'application/json',Origin:base}:{})},body:data?JSON.stringify(data):undefined});for(const cookie of res.headers.getSetCookie()){const pair=cookie.split(';')[0],key=pair.split('=')[0];c.cookie=c.cookie.split('; ').filter(x=>x&&!x.startsWith(key+'=')).concat(pair).join('; ')}return {status:res.status,data:await res.json()}};
 try{
  await Promise.all(clients.map(c=>call(c)));
  const bad=await call(clients[0],{type:'join',requestId:randomUUID(),name:'A',code:'wrong'});assert.equal(bad.status,400);
  const missing=await call(clients[0],{type:'join',requestId:randomUUID(),name:'A',code:'0000-0000-0000'});assert.equal(missing.status,404);assert.equal((await call(clients[0])).data.me,null);
  const create={type:'create',requestId:randomUUID(),name:'Host'};const created=await call(clients[0],create);assert.equal(created.status,200);const code=created.data.roomCode;assert.match(code,/^[A-F0-9]{12}$/);assert.equal(created.data.hostId,created.data.me);const repeated=await call(clients[0],create);assert.equal(repeated.data.roomCode,code);assert.equal(repeated.data.me,created.data.me);
  const joined=await Promise.all(clients.slice(1,3).map((c,i)=>call(c,{type:'join',requestId:randomUUID(),name:'Friend '+i,code:code.toLowerCase().match(/.{1,4}/g).join('-')})));assert.ok(joined.every(r=>r.status===200));
  assert.equal((await call(clients[3],{type:'join',requestId:randomUUID(),name:'Fourth',code})).status,409);
  const outsider=await call(clients[3]);assert.equal(outsider.data.players,undefined);assert.equal(outsider.data.history,undefined);
  const outsiderPost=await call(clients[3],{type:'leave',requestId:randomUUID()});assert.equal(outsiderPost.data.players,undefined);
  const original=(await call(clients[0])).data;assert.equal(original.players.length,3);assert.equal(original.players.find(p=>p.id===original.me).balance,10000);
  const bet={type:'bet',side:'B',amount:500,requestId:randomUUID()};await call(clients[0],bet);const replay=await call(clients[0],bet);assert.equal(replay.data.players.find(p=>p.id===replay.data.me).bets.B,500);
  const friend=(await call(clients[1])).data;assert.equal(friend.deadline,replay.data.deadline);assert.equal(friend.players.find(p=>p.id===replay.data.me).bets.B,500);
  const stream=await fetch(base+'/api/room?stream=1',{headers:{Cookie:clients[1].cookie}});assert.match(stream.headers.get('content-type'),/text\/event-stream/);const reader=stream.body.getReader();const part=await reader.read();assert.match(new TextDecoder().decode(part.value),/data:/);await reader.cancel();
  const reconnect=(await call(clients[0])).data;assert.equal(reconnect.me,original.me);
  await call(clients[0],{type:'leave',requestId:randomUUID()});const afterHost=(await call(clients[1])).data;assert.notEqual(afterHost.hostId,original.me);assert.ok(afterHost.players.some(p=>p.id===afterHost.hostId));const again=(await call(clients[0],{type:'join',requestId:randomUUID(),name:'Rejoined',code})).data;assert.notEqual(again.me,original.me);assert.equal(again.players.find(p=>p.id===again.me).balance,10000);
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
  const separate=await call(clients[3],{type:'create',requestId:randomUUID(),name:'Other host'});assert.equal(separate.status,200);assert.notEqual(separate.data.roomCode,code);assert.equal(separate.data.players.length,1);assert.equal(separate.data.history.length,0);assert.equal((await call(clients[0])).data.players.length,3);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));await pg.close()}
});
