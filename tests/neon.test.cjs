const {test}=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {NeonDatabase,NeonStore,SETUP}=require('../lib/neon.cjs');
const {transact}=require('../lib/store.cjs');
const {action}=require('../lib/room.cjs');
const {randomUUID}=require('node:crypto');

test('Postgres storage: setup, atomic CAS, room isolation, expiry and shared rate limits',async()=>{
 const pg=new PGlite();
 const database={query:async(q,p)=>(await pg.query(q,p)).rows};
 try{
  await pg.transaction(async tx=>{for(const q of SETUP)await tx.query(q)});
  const a=new NeonStore(database,'room-a'),b=new NeonStore(database,'room-b');
  assert.equal(await a.read(),null);
  const initial=await Promise.all([a.cas(null,'one'),a.cas(null,'two')]);
  assert.equal(initial.filter(Boolean).length,1);
  const old=await a.read();
  const updates=await Promise.all([a.cas(old,'three'),a.cas(old,'four')]);
  assert.equal(updates.filter(Boolean).length,1);
  assert.equal(await a.cas(old,'stale overwrite'),false);
  assert.equal(await b.read(),null);
  const payload="text with 'quotes' and $1; DROP TABLE maison_rooms;";
  assert.equal(await b.cas(null,payload),true);assert.equal(await b.read(),payload);
  await pg.query("UPDATE maison_rooms SET expires_at=now()-interval '1 second' WHERE key='room-a'");
  assert.equal(await a.read(),null);assert.equal(await a.cas('three','stale'),false);
  assert.equal(await a.cas(null,'fresh'),true);
  const limits=await Promise.all(Array.from({length:15},()=>a.limit('same-ip')));
  assert.equal(limits.filter(Boolean).length,12);
  await pg.query("UPDATE maison_limits SET expires_at=now()-interval '1 second'");
  assert.equal(await a.limit('same-ip'),true);
  const room=new NeonStore(database,'actual-room');
  await Promise.all(['a','b','c'].map(hash=>transact(room,r=>action(r,hash,{type:'join',name:hash,requestId:randomUUID()},1000))));
  assert.equal(JSON.parse(await room.read()).players.length,3);
  const request={type:'bet',side:'B',amount:500,requestId:randomUUID()};
  await Promise.all([transact(room,r=>action(r,'a',request,1100)),transact(room,r=>action(r,'a',request,1100))]);
  assert.equal(JSON.parse(await room.read()).players.find(p=>p.hash==='a').bets.B,500);
 }finally{await pg.close()}
});

test('Neon schema initialization shares one transaction and retries after failure',async()=>{
 const db=new NeonDatabase('postgresql://user:password@example.neon.tech/database');
 let calls=0;
 db.sql={query:(q,p)=>({q,p}),transaction:async queries=>{calls++;assert.equal(queries[0].q,SETUP[0]);if(calls===1)throw new Error('temporary failure');return []}};
 await assert.rejects(db.initialize(),/temporary failure/);
 await Promise.all([db.initialize(),db.initialize()]);assert.equal(calls,2);
});
