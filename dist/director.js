/* Authored dealer poses and card/chip choreography. */
class DealerDirector {
  constructor() {
    this.scene=document.querySelector('.scene');
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.character='sophia';this.characterTicket=0;this.characterLoads={};this.poseOrder=['idle','betting','drawing','deal-player','deal-banker','win-player','win-banker','tie','closed','collecting'];this.ticket=0;this.returnTimer=null;this.current='idle';this.ready={};this.images={};
    this.stage=document.createElement('div');this.stage.className='dealer-stage';
    this.stage.setAttribute('aria-hidden','true');this.scene.prepend(this.stage);
    for(const pose of ['idle','betting','drawing','deal-player','deal-banker','win-player','win-banker','tie','closed','collecting']){
      const image=new Image();image.className='dealer-frame'+(pose==='idle'?' visible':'');image.alt='';
      image.src='assets/dealer-'+pose+'.webp';this.stage.append(image);this.images[pose]=image;
      this.ready[pose]=image.decode().then(()=>true).catch(()=>false);
    }
    this.atlas=document.createElement('div');this.atlas.className='dealer-atlas';this.stage.append(this.atlas);
    this.phase=document.createElement('div');this.phase.className='phase-indicator';
    this.phase.innerHTML='<i></i><span>베팅 대기</span>';this.scene.append(this.phase);this.scene.dataset.pose='idle';
  }
  async setCharacter(id){
    const character=(window.DEALER_ROSTER||[]).find(c=>c.id===id);if(!character)return false;
    const ticket=++this.characterTicket;
    if(character.atlas){
      if(!this.characterLoads[id]){const image=new Image();image.src=character.atlas;this.characterLoads[id]=image.decode().then(()=>true).catch(()=>{delete this.characterLoads[id];return false})}
      if(!await this.characterLoads[id]||ticket!==this.characterTicket)return false;
      this.atlas.style.backgroundImage='url("'+character.atlas+'")';
    }
    this.character=id;this.scene.classList.toggle('character-atlas',!!character.atlas);this.renderAtlas(this.current);return true;
  }
  renderAtlas(name){const i=Math.max(0,this.poseOrder.indexOf(name));this.atlas.style.backgroundPosition=(i%4)*100/3+'% '+Math.floor(i/4)*50+'%'}
  async pose(name,label,returnAfter=0){
    clearTimeout(this.returnTimer);const ticket=++this.ticket;this.phase.lastElementChild.textContent=label;
    const loaded=await Promise.race([this.ready[name],new Promise(resolve=>setTimeout(()=>resolve(false),2500))]);if(ticket!==this.ticket)return;
    if(loaded){for(const [key,image] of Object.entries(this.images))image.classList.toggle('visible',key===name);this.current=name;this.scene.dataset.pose=name;this.renderAtlas(name)}
    if(returnAfter)this.returnTimer=setTimeout(()=>this.pose('idle','베팅 대기'),returnAfter);
  }
  duration(ms,fast){return this.reduced.matches?30:fast?Math.round(ms*.48):ms}
  wait(ms,fast=false){return new Promise(resolve=>setTimeout(resolve,this.duration(ms,fast)))}
  pulse(el,cls='pulse'){el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),850)}
  async flyChip(from,to,amount,payout=false){
    if(!from||!to||this.reduced.matches)return;
    const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),el=document.createElement('div');
    el.className='flying-chip'+(payout?' payout-chip':'');el.textContent=amount>=1000?Math.round(amount/100)/10+'K':amount;el.setAttribute('aria-hidden','true');
    el.style.left=a.left+a.width/2-18+'px';el.style.top=a.top+a.height/2-18+'px';document.body.append(el);
    const dx=b.left+b.width/2-a.left-a.width/2,dy=b.top+b.height/2-a.top-a.height/2;
    try{await el.animate([{transform:'translate(0,0) scale(.7)',opacity:0},{transform:`translate(${dx*.45}px,${dy*.5-55}px) scale(1.1) rotate(80deg)`,opacity:1,offset:.5},{transform:`translate(${dx}px,${dy}px) scale(.65) rotate(160deg)`,opacity:1}],{duration:payout?700:460,easing:'cubic-bezier(.2,.6,.4,1)'}).finished}catch{}finally{el.remove()}
  }
  async revealCard(side,card,container,fast){
    const player=side==='p';await this.pose('drawing','카드 드로우');
    document.querySelector('.shoe-prop').classList.add('drawing');window.playEffect('draw');await this.wait(460,fast);
    await this.pose(player?'deal-player':'deal-banker',player?'플레이어에게 배분':'뱅커에게 배분');
    const el=document.createElement('div'),red=['♥','♦'].includes(card.suit);el.className='playing-card';el.setAttribute('aria-label','뒷면 카드');
    el.innerHTML='<div class="card-turn"><div class="card-back"><span>♧</span><small>MAISON</small></div><div class="card-face '+(red?'red':'')+'"><b>'+card.rank+'</b><small>'+card.suit+'</small><span class="suit">'+card.suit+'</span><span class="corner">'+card.rank+'<small>'+card.suit+'</small></span></div></div>';
    container.append(el);const shoe=document.querySelector('.shoe-prop').getBoundingClientRect(),dest=el.getBoundingClientRect();
    el.style.setProperty('--deal-x',shoe.left-dest.left+'px');el.style.setProperty('--deal-y',shoe.top-dest.top+'px');el.classList.add('arriving');window.playEffect('slide');
    await this.wait(480,fast);el.classList.add('revealed');el.setAttribute('aria-label',card.suit+' '+card.rank);window.playEffect('flip');
    document.querySelector('.shoe-prop').classList.remove('drawing');await this.wait(440,fast);return el;
  }
  async clearCards(fast){
    const cards=[...document.querySelectorAll('.playing-card')];if(!cards.length)return;
    await this.pose('collecting','카드 회수');cards.forEach((c,i)=>{c.style.setProperty('--collect-delay',i*35+'ms');c.classList.add('collecting')});
    window.playEffect('sweep');await this.wait(640,fast);cards.forEach(c=>c.remove());
  }
  announce(winner,net){
    this.pose({P:'win-player',B:'win-banker',T:'tie'}[winner],{P:'플레이어 승리',B:'뱅커 승리',T:'무승부'}[winner]);this.scene.dataset.result=winner;
    const banner=document.querySelector('.result-banner');banner.innerHTML='<small>ROUND COMPLETE</small><strong>'+({P:'PLAYER WINS',B:'BANKER WINS',T:'TIE GAME'})[winner]+'</strong><span>'+(net===null?'관전':(net>0?'+':'')+net.toLocaleString('ko-KR')+' VIRTUAL USD')+'</span>';banner.classList.add('show');
    window.playEffect(winner==='T'?'tie':winner==='P'?'player-win':'banker-win');
    document.querySelectorAll(winner==='T'?'.hand':(winner==='P'?'.hand:first-child':'.hand:last-child')).forEach(h=>h.classList.add('winning-hand'));
  }
  clearResult(){document.querySelector('.result-banner').classList.remove('show');delete this.scene.dataset.result;document.querySelectorAll('.winning-hand,.winner').forEach(e=>e.classList.remove('winning-hand','winner'))}
}
window.DealerDirector=DealerDirector;
