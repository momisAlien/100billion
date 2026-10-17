const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
try{process.loadEnvFile(path.join(__dirname,'.env'))}catch(e){if(e.code!=='ENOENT')throw e}
const handler=require('./api/room.js'),root=path.resolve(__dirname,'dist'),port=Number(process.env.PORT||4181);
const server=http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/api/room'){await handler(req,res);return}
 let decoded;try{decoded=decodeURIComponent(pathname)}catch{res.writeHead(400);return res.end()}
 const file=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()}
 fs.readFile(file,(e,content)=>{if(e){res.writeHead(404);return res.end('Not found')}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(content)});
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port} · create a room to get an invite key`));
