const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {getStore,transact}=require('../lib/store.cjs');
const {action,view}=require('../lib/room.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const COOKIE='maison_room';
function token(req,res){
 let value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
 if(!/^[a-f0-9]{64}$/.test(value||'')){value=randomBytes(32).toString('hex');res.setHeader('Set-Cookie',`${COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.VERCEL?'; Secure':''}`)}
 return hash(value);
}
async function body(req){
 if(req.body){if(typeof req.body==='object')return req.body;return JSON.parse(req.body)}
 let text='';for await(const chunk of req){text+=chunk;if(text.length>4096){const e=new Error('요청이 너무 큽니다.');e.status=413;throw e}}return JSON.parse(text||'{}');
}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data))}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 let closed=false;res.on('close',()=>{closed=true});
 try{
  if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return json(res,405,{error:'지원하지 않는 요청입니다.'})}
  if(process.env.VERCEL&&!process.env.ROOM_CODE)return json(res,503,{error:'Vercel에 ROOM_CODE를 설정해 주세요.'});
  const store=getStore(),who=token(req,res),url=new URL(req.url,'http://localhost');
  const snapshot=async(input={type:'sync'})=>{const now=Date.now();const room=await transact(store,r=>action(r,who,input,now));const data={...view(room,who,now),local:!process.env.VERCEL&&!process.env.UPSTASH_REDIS_REST_URL};return data.me?data:{me:null,serverNow:now,local:data.local,occupancy:data.players.length,capacity:3}};
  if(req.method==='POST'){
   const origin=req.headers.origin;if(origin){const host=req.headers['x-forwarded-host']||req.headers.host;if(new URL(origin).host!==host)return json(res,403,{error:'다른 사이트에서 보낸 요청은 허용되지 않습니다.'})}
   if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'JSON 요청이 필요합니다.'});
   const input=await body(req);
   if(input.type==='join'){
    const address=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    if(!await store.limit(hash(address)))return json(res,429,{error:'입장 시도가 너무 많습니다. 1분 후 다시 시도해 주세요.'});
    const expected=process.env.ROOM_CODE||'MAISON3';
    if(typeof input.code!=='string'||!timingSafeEqual(Buffer.from(hash(input.code)),Buffer.from(hash(expected))))return json(res,403,{error:'입장 코드가 맞지 않습니다.'});
   }
   return json(res,200,await snapshot(input));
  }
  const first=await snapshot();
  // The lounge and private names are only visible after a successful code-protected join.
  if(!first.me)return json(res,200,first);
  if(url.searchParams.get('stream')!=='1')return json(res,200,first);
  res.setHeader('Content-Type','text/event-stream; charset=utf-8');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();
  res.write('retry: 1200\n\n');const until=Date.now()+24000;let current=first;
  while(!closed&&Date.now()<until){
   res.write('data: '+JSON.stringify(current)+'\n\n');
   if(!current.me)break;
   await wait(current.phase==='dealing'?350:1000);if(closed)break;current=await snapshot();
  }
  if(!closed)res.end();
 }catch(e){
  const status=e.status||503;
  if(res.headersSent){if(!closed){res.write('event: unavailable\ndata: {}\n\n');res.end()}return}
  json(res,status,{error:e instanceof SyntaxError?'요청 형식이 올바르지 않습니다.':e.status?e.message:'공용 방에 연결할 수 없습니다. 서버 설정 또는 연결 상태를 확인해 주세요.'});
 }
};
