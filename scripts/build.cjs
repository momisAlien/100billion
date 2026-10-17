const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
for(const file of ['app.js','customize.js','audio.js','director.js','game.js'])new vm.Script(fs.readFileSync(path.join(root,'dist',file),'utf8'),{filename:file});
for(const pose of ['idle','betting','drawing','deal-player','deal-banker','win-player','win-banker','tie','closed','collecting'])if(!fs.existsSync(path.join(root,'dist/assets/dealer-'+pose+'.webp')))throw new Error('Missing dealer pose: '+pose);
console.log('Static client and all 10 dealer images validated. Vercel API: api/room.js');
