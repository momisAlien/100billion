const {randomBytes,createHash}=require('node:crypto');
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
  const who=token(req,res),url=new URL(req.url,'http://localhost');
  const cookieCode=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('maison_table='))?.slice(13);
  let code=/^[A-F0-9]{12}$/.test(cookieCode||'')?cookieCode:null;
  const lobby=()=>({me:null,serverNow:Date.now(),capacity:3});
  const select=key=>{const cookies=res.getHeader('Set-Cookie');res.setHeader('Set-Cookie',[...(Array.isArray(cookies)?cookies:cookies?[cookies]:[]),`maison_table=${key}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.VERCEL?'; Secure':''}`]);code=key};
  const snapshot=async(input={type:'sync'},creating=false)=>{
   if(!code)return lobby();
   const store=getStore(code);
   if(!creating&&!await store.read()){if(input.type==='sync')return lobby();const e=new Error('방을 찾을 수 없습니다. 친구에게 입장 키를 다시 확인해 주세요.');e.status=404;throw e}
   const now=Date.now();const room=await transact(store,r=>{
    if(creating){if(r.creator&&r.creator!==who){const e=new Error('방 생성이 겹쳤습니다. 다시 만들어 주세요.');e.status=409;throw e}r.creator=who}
    action(r,who,input,now);
    if(!r.players.some(p=>p.hash===r.host))r.host=r.players[0]?.hash||null;
   });
   const data=view(room,who,now);
   return data.me?{...data,roomCode:code,hostId:room.players.find(p=>p.hash===room.host)?.id||null}:lobby();
  };
  if(req.method==='POST'){
   const origin=req.headers.origin;if(origin){const host=req.headers['x-forwarded-host']||req.headers.host;if(new URL(origin).host!==host)return json(res,403,{error:'다른 사이트에서 보낸 요청은 허용되지 않습니다.'})}
   if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'JSON 요청이 필요합니다.'});
   const input=await body(req);
   if(['create','join'].includes(input.type)){
    if(!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId||''))return json(res,400,{error:'요청 식별자가 올바르지 않습니다.'});
    const address=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    if(!await getStore().limit(hash(address)))return json(res,429,{error:'입장 시도가 너무 많습니다. 1분 후 다시 시도해 주세요.'});
    const creating=input.type==='create';
    code=creating?hash(who+':'+input.requestId).slice(0,12).toUpperCase():String(input.code||'').replace(/[\s-]/g,'').toUpperCase();
    if(!/^[A-F0-9]{12}$/.test(code))return json(res,400,{error:'친구가 공유한 12자리 입장 키를 입력해 주세요.'});
    const data=await snapshot({...input,type:'join'},creating);select(code);return json(res,200,data);
   }
   if(!code&&input.type!=='leave')return json(res,401,{error:'방을 만들거나 입장한 뒤 이용해 주세요.'});
   return json(res,200,await snapshot(input));
  }
  const first=await snapshot();
  // Only joined members receive room keys and player information.
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
