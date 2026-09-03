/* Filametria — Interface, painéis colapsáveis (dobras), modo simples, blocos de trabalho, atualizações e PWA */
/* ---- modo simples e painéis dobráveis ---- */
let SIMPLES=false, FECHADOS=new Set();
function aplicaSimples(){
  document.body.classList.toggle('simples',SIMPLES);
  el('b_simples').textContent=SIMPLES?tr('bCompleto'):tr('bSimples');
  el('b_simples').classList.toggle('primary',SIMPLES);
}
function toggleSimples(){ SIMPLES=!SIMPLES; aplicaSimples(); guardaEstado(); }
/* subtítulos dobráveis: cada h3 passa a ser dono de tudo o que vem a seguir
   até ao h3 seguinte, embrulhado num .subsec para poder desaparecer de uma vez */
function ligaSubdobras(){
  document.querySelectorAll('.card').forEach(c=>{
    c.querySelectorAll(':scope > h3').forEach((h,i)=>{
      const id=c.id+'/'+i;
      h.dataset.sub=id;
      /* class="fechada" no HTML = nasce dobrada. Só conta em instalação nova:
         quem já usou a app traz o seu FECHADOS e o repor() substitui este por inteiro. */
      if(h.classList.contains('fechada')) FECHADOS.add(id);
      const corpo=document.createElement('div');
      corpo.className='subsec'+(h.classList.contains('avancado')?' avancado':'');
      let n=h.nextElementSibling;
      while(n && n.tagName!=='H3'){ const seg=n.nextElementSibling; corpo.appendChild(n); n=seg; }
      h.after(corpo);
      h.title=tr('foldTitle');
      h.insertAdjacentHTML('beforeend','<span class="chev">▾</span>');
      h.addEventListener('click',()=>{
        FECHADOS.has(id)?FECHADOS.delete(id):FECHADOS.add(id);
        aplicaFechados(); guardaEstado();
      });
    });
  });
  aplicaFechados();
}
function aplicaFechados(){
  document.querySelectorAll('.card').forEach(c=>c.classList.toggle('fechado',FECHADOS.has(c.id)));
  document.querySelectorAll('.card h3[data-sub]').forEach(h=>h.classList.toggle('dobrado',FECHADOS.has(h.dataset.sub)));
  atualizaBotaoDobrar();
}
/* ---- blocos de trabalho ---- */
function blocoH3s(){ return [...document.querySelectorAll('.card h3[data-bloco]')]; }
function ligaBlocos(){
  blocoH3s().forEach(h=>{
    const k=h.dataset.bloco;
    const bts=document.createElement('span'); bts.className='blocobts';
    const t=document.createElement('button');  t.className='bl-t';
    const so=document.createElement('button'); so.className='bl-s';
    /* o h3 inteiro dobra ao clique: estes botões não podem deixar o clique subir */
    t.addEventListener('click',e=>{ e.stopPropagation();
      BLOCOS[k]=!BLOCOS[k]; aplicaBlocos(); calc(); guardaEstado(); });
    so.addEventListener('click',e=>{ e.stopPropagation(); soBloco(k); });
    bts.append(t,so);
    h.insertBefore(bts, h.querySelector('.chev'));
  });
  aplicaBlocos();
}
/* "só isto": este fica ligado e os outros saem; carregar outra vez devolve tudo */
function soBloco(k){
  const ja = BLOCOS[k] && Object.keys(BLOCOS).every(o=>o===k||!BLOCOS[o]);
  Object.keys(BLOCOS).forEach(o=>{ BLOCOS[o] = ja ? true : o===k; });
  aplicaBlocos(); calc(); guardaEstado();
}
function aplicaBlocos(){
  blocoH3s().forEach(h=>{
    const on=BLOCOS[h.dataset.bloco]!==false;
    h.classList.toggle('bloco-off',!on);
    const t=h.querySelector('.bl-t'), so=h.querySelector('.bl-s');
    if(t){ t.textContent=on?'☑':'☐'; t.title=tr(on?'blocoOnT':'blocoOffT'); t.setAttribute('aria-pressed',on); }
    if(so){ so.textContent=tr('blocoSolo'); so.title=tr('blocoSoloT'); }
  });
}

const subtitulos = () => [...document.querySelectorAll('.card h3[data-sub]')];
/* um só botão: fecha tudo enquanto houver secções abertas, senão abre tudo */
function dobrarTudo(){
  const subs=subtitulos(), abertas=subs.filter(h=>!FECHADOS.has(h.dataset.sub));
  if(abertas.length) abertas.forEach(h=>FECHADOS.add(h.dataset.sub));
  else subs.forEach(h=>FECHADOS.delete(h.dataset.sub));
  aplicaFechados(); guardaEstado();
}
function atualizaBotaoDobrar(){
  const b=el('b_dobrar'); if(!b) return;
  const subs=subtitulos(), tudoFechado=subs.length>0&&subs.every(h=>FECHADOS.has(h.dataset.sub));
  b.textContent=tr(tudoFechado?'bAbrirSec':'bFecharSec');
}
function ligaDobras(){
  document.querySelectorAll('.card').forEach((c,i)=>{
    if(!c.id) c.id='card'+i;
    const h=c.querySelector('h2'); if(!h) return;
    h.style.cursor='pointer'; h.title=tr('foldTitle');
    h.insertAdjacentHTML('beforeend','<span class="chev">▾</span>');
    h.addEventListener('click',()=>{
      FECHADOS.has(c.id)?FECHADOS.delete(c.id):FECHADOS.add(c.id);
      aplicaFechados(); guardaEstado();
    });
  });
}


/* ---- atualização dos dados de mercado ---- */
let DADOS_URL='dados.json';
async function procurarAtualizacoes(silencioso){
  const box=el('upd');
  if(location.protocol==='file:'){
    if(!silencioso) box.innerHTML='<span class="st">'+tr('updateFileMode')+'</span>';
    return;
  }
  if(!silencioso) box.innerHTML='<span class="st">'+tr('updateChecking')+'</span>';
  try{
    const r=await fetch(DADOS_URL+'?t='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error(r.status);
    const d=await r.json();
    if(d.bench) Object.assign(BENCH,d.bench);
    if(d.transp) Object.assign(TRANSP,d.transp);
    if(d.printers){ PRINTERS.length=0; PRINTERS.push(...d.printers); drawPrinters(); }
    drawPortesSel(); calc();
    box.innerHTML='<span class="st">'+tr('updateDone',{date:d.data||'?'})+'</span>';
  }catch(e){
    if(!silencioso) box.innerHTML='<span class="st">'+tr('updateNone')+'</span>';
  }
}


/* ---- instalação como aplicação (PWA) ---- */
let promptInstalar=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault(); promptInstalar=e; el('b_instalar').style.display='';
});
window.addEventListener('appinstalled',()=>{ promptInstalar=null; el('b_instalar').style.display='none'; });
async function instalarApp(){
  if(!promptInstalar) return alert(tr('installUnavailable'));
  promptInstalar.prompt(); await promptInstalar.userChoice;
  promptInstalar=null; el('b_instalar').style.display='none';
}
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
