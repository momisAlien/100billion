const assert=require('node:assert/strict'),g=require('./dist/game.js');
assert.equal(g.score([{value:9},{value:8}]),7);
for(let b=0;b<8;b++)for(let t=0;t<10;t++){const table=[[0,1,2,3,4,5,6,7,8,9],[0,1,2,3,4,5,6,7,8,9],[0,1,2,3,4,5,6,7,8,9],[0,1,2,3,4,5,6,7,9],[2,3,4,5,6,7],[4,5,6,7],[6,7],[]];assert.equal(g.bankerDraw(b,t),table[b].includes(t))}
function run(vals){let n=0;const r=g.round(()=>({value:vals[n++]}));return {...r,n}}
assert.equal(run([4,2,4,3]).n,4);assert.equal(run([3,3,3,3]).n,4);assert.equal(run([2,1,3,2,8]).b.length,2);assert.equal(run([2,2,3,4,7,3]).b.length,3);
assert.equal(g.returns({P:100,B:200,T:50},'T'),750);assert.equal(g.returns({P:0,B:100,T:0},'B'),195);
assert.equal(g.shoe().length,416);for(let i=0;i<1000;i++){const d=g.shoe(),r=g.round(()=>d.pop());assert.ok(r.ps>=0&&r.ps<=9&&r.bs>=0&&r.bs<=9);assert.ok(r.p.length<=3&&r.b.length<=3)}console.log('Passed: third-card matrix, naturals, payouts, 1,000 simulated rounds.');
