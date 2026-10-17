const fs=require('node:fs/promises'),path=require('node:path');
const {createRoom}=require('./room.cjs');
const CAS="local old=redis.call('GET',KEYS[1]); if (old or '')~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2],'EX',604800); return 1";
class MemoryStore{
 constructor(){this.value=null;this.limits=new Map()}
 async read(){return this.value}
 async cas(old,next){if(this.value!==old)return false;this.value=next;return true}
 async limit(key){const now=Date.now(),x=this.limits.get(key);if(!x||x.until<now){this.limits.set(key,{n:1,until:now+60000});return true}return ++x.n<=12}
}
class FileStore extends MemoryStore{
 constructor(file){super();this.file=file;this.loading=null;this.queue=Promise.resolve()}
 async read(){if(!this.loading)this.loading=(async()=>{try{this.value=await fs.readFile(this.file,'utf8')}catch(e){if(e.code!=='ENOENT')throw e}})();await this.loading;return this.value}
 async cas(old,next){const run=this.queue.then(async()=>{if(this.value!==old)return false;await fs.mkdir(path.dirname(this.file),{recursive:true});const tmp=this.file+'.tmp';await fs.writeFile(tmp,next);await fs.rename(tmp,this.file);this.value=next;return true});this.queue=run.catch(()=>{});return run}
}
class RedisStore{
 constructor(url,token,key){this.url=url;this.token=token;this.key=key}
 async command(args){const res=await fetch(this.url,{method:'POST',headers:{Authorization:'Bearer '+this.token,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(4500)});if(!res.ok)throw new Error('공용 방 저장소에 연결할 수 없습니다.');const data=await res.json();if(data.error)throw new Error('공용 방 저장소 요청이 실패했습니다.');return data.result}
 read(){return this.command(['GET',this.key])}
 async cas(old,next){return await this.command(['EVAL',CAS,1,this.key,old||'',next])===1}
 async limit(key){const script="local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],60) end;return n";return await this.command(['EVAL',script,1,this.key+':limit:'+key])<=12}
}
const stores=new Map();
let neonDatabase;
function getStore(code='lobby'){
 if(!/^(lobby|[A-F0-9]{12})$/.test(code))throw new Error('Invalid room key');
 if(stores.has(code))return stores.get(code);
 const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
 const databaseUrl=process.env.DATABASE_URL||process.env.POSTGRES_URL;
 let store;
 if(databaseUrl){const {NeonDatabase,NeonStore}=require('./neon.cjs');neonDatabase??=new NeonDatabase(databaseUrl);store=new NeonStore(neonDatabase,(process.env.ROOM_KEY||'maison:friends:v3')+':'+code)}
 else if(url&&token){if(!url.startsWith('https://'))throw new Error('Redis URL에는 HTTPS 주소가 필요합니다.');store=new RedisStore(url,token,(process.env.ROOM_KEY||'maison:friends:v3')+':'+code)}
 else if(process.env.VERCEL){const e=new Error('실시간 방 저장소가 아직 연결되지 않았습니다. Vercel에서 Neon을 프로젝트에 연결한 뒤 재배포해 주세요.');e.status=503;throw e}
 else store=new FileStore(path.join(__dirname,'../.local/rooms',code+'.json'));
 stores.set(code,store);return store;
}
async function transact(store,mutate){
 for(let retry=0;retry<14;retry++){
  const raw=await store.read(),room=raw?JSON.parse(raw):createRoom();if(room.schema!==2)throw new Error('방 데이터 버전이 맞지 않습니다.');
  const before=JSON.stringify(room);mutate(room);
  if(raw&&before===JSON.stringify(room))return room;
  room.version++;if(await store.cas(raw,JSON.stringify(room)))return room;
  await new Promise(r=>setTimeout(r,Math.min(10*2**retry,120)+Math.random()*15));
 }
 const e=new Error('요청이 겹쳤습니다. 잠시 후 다시 시도해 주세요.');e.status=409;throw e;
}
module.exports={getStore,transact,MemoryStore,RedisStore,FileStore,CAS};
