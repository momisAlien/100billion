(function(root){
const score=h=>h.reduce((n,c)=>n+c.value,0)%10;
function bankerDraw(b,t){return t===null?b<=5:b<=2||(b===3&&t!==8)||(b===4&&t>=2&&t<=7)||(b===5&&t>=4&&t<=7)||(b===6&&t>=6&&t<=7)}
function round(draw){let p=[draw()],b=[draw()];p.push(draw());b.push(draw());let ps=score(p),bs=score(b);if(ps<8&&bs<8){let third=null;if(ps<=5){let c=draw();p.push(c);third=c.value}if(bankerDraw(bs,third))b.push(draw())}ps=score(p);bs=score(b);return {p,b,ps,bs,winner:ps===bs?'T':ps>bs?'P':'B'}}
function returns(bets,w){return w==='T'?bets.P+bets.B+bets.T*9:w==='P'?bets.P*2:bets.B*1.95}
function shoe(){const deck=[];for(let d=0;d<8;d++)for(const suit of ['♠','♥','♦','♣'])for(let r=1;r<=13;r++)deck.push({rank:({1:'A',11:'J',12:'Q',13:'K'})[r]||String(r),suit,value:r>=10?0:r});for(let i=deck.length-1;i>0;i--){const a=new Uint32Array(1);crypto.getRandomValues(a);const j=Math.floor(a[0]/4294967296*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}return deck}
function sequence(r){const steps=[['p',r.p[0]],['b',r.b[0]],['p',r.p[1]],['b',r.b[1]]];if(r.p[2])steps.push(['p',r.p[2]]);if(r.b[2])steps.push(['b',r.b[2]]);return steps}
const api={score,bankerDraw,round,returns,shoe,sequence};if(typeof module!=='undefined')module.exports=api;else root.Baccarat=api;
})(globalThis);
