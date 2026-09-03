/* Filametria — Integração com o ecossistema Bobina (inventário, picker e baixa) */
/* Os portes são a única coisa que o Bobina não sabe (não regista o que se paga
   de envio), por isso ficam deste lado, por nome de filamento. */
let PORTES_BOB={};

/* ---- ligação viva ao Bobina ----
   O pedido passa pelo server.py do Filametria porque entre portas o browser batia
   em CORS e o cookie de sessão não passava — ver /api/bobina/filamentos. */
const BOB={fils:[], resumo:null, em:0, ok:false, erro:'', lido:0, puxando:false, precos_em:''};

/* ---- "Preços revistos em" ----
   Era um campo à mão que ninguém se lembrava de mexer, e que por isso envelhecia
   a mentir — e o aviso de preços velhos dependia dele. Quem anda mesmo a rever
   preços é o tracker do Bobina, por isso a data passa a vir de lá. O ✎ destrava
   para escrever à mão (e fica destravado, senão a leitura seguinte apagava o que
   se escreveu); o ⟲ devolve-a ao automático. */
let DATA_MANUAL=false;
function aplicaDataPrecos(guardar=true){
  const i=el('s_data'); if(!i) return;
  const tem=!!BOB.precos_em, auto=tem&&!DATA_MANUAL;
  i.readOnly=auto;
  i.classList.toggle('lido',auto);
  if(auto && i.value!==BOB.precos_em){
    i.value=BOB.precos_em; calc();
    if(guardar) guardaEstado();
  }
  const b=el('b_data_man');
  if(b){
    b.style.display=tem?'':'none';
    b.textContent=DATA_MANUAL?'⟲':'✎';
    b.title=tr(DATA_MANUAL?'dtVoltarT':'dtManualT');
  }
  const h=el('data_hint');
  if(h) h.innerHTML=!tem?'':tr(DATA_MANUAL?'dtManual':'dtAuto',{d:BOB.precos_em});
}
function destravaData(){ DATA_MANUAL=!DATA_MANUAL; aplicaDataPrecos(); guardaEstado(); }
const BOB_INTERVALO=45000;
/* A última leitura dos filamentos que ESTE orçamento usa, guardada com ele.
   Um orçamento não pode mudar de valor — nem perder um filamento das mesas —
   só porque o Bobina está em baixo ou porque se abriu noutra máquina. */
let BOB_SNAP=[];

const bobVivo  = n => BOB.fils.find(f=>f.n===n)||null;
const bobGuard = n => BOB_SNAP.find(f=>f.n===n)||null;
function bobFil(n){
  const f=bobVivo(n)||bobGuard(n);
  if(!f) return null;
  f.bobina=true; f.vivo=!!bobVivo(n); f.portes=+PORTES_BOB[n]||0;
  return f;
}
/* os meus primeiro: um filamento escrito à mão com o mesmo nome ganha ao do
   Bobina, senão não havia como corrigir um preço para um orçamento */
const filInfo = n => FILS.find(f=>f.n===n) || bobFil(n);
const eBobina = n => !FILS.some(f=>f.n===n) && !!bobFil(n);
function todosFils(){
  const meus=FILS.map(f=>f.n);
  const vivos=BOB.fils.filter(b=>!meus.includes(b.n));
  const guardados=BOB_SNAP.filter(b=>!meus.includes(b.n)&&!vivos.some(x=>x.n===b.n));
  return [...FILS, ...vivos.map(b=>bobFil(b.n)), ...guardados.map(b=>bobFil(b.n))];
}
const rotuloFil = f => `${rotuloEscolhaFil(f)} — R$ ${(+f.kg||0).toFixed(2).replace('.',',')}/kg`;
/* o filamento das Definições: o que vale para as mesas que não escolhem nenhum */
const filDefault = () => filInfo(el('s_fil_nome').value)
  || {n:el('s_fil_nome').value||'Filamento', kg:num('s_fil_kg'), portes:num('s_fil_portes')};

async function puxaBobina(forcar=false){
  if(BOB.puxando) return;
  /* o focus e o visibilitychange disparam os dois ao voltar à janela */
  if(!forcar && Date.now()-BOB.lido<3000) return;
  BOB.puxando=true;
  try{
    const r=await fetch('/api/bobina/filamentos',{credentials:'same-origin'});
    const d=await r.json();
    if(!d.ok) throw new Error(d.error||'sem resposta do Bobina');
    const antes=impressaoBob();
    BOB.fils=(d.filamentos||[]).filter(f=>f&&f.n);
    BOB.resumo=d.resumo||null; BOB.em=d.em||0; BOB.ok=true; BOB.erro='';
    BOB.precos_em=d.precos_em||'';
    store.set('bobina',{fils:BOB.fils,resumo:BOB.resumo,em:BOB.em,precos_em:BOB.precos_em});
    aplicaDataPrecos();
    if(impressaoBob()!==antes){
      drawFils(); sincronizaCamposFil(); calc();
      if(pickerAberto()) drawPicker();
    }
  }catch(e){
    BOB.ok=false; BOB.erro=e.message||String(e);
  }finally{
    BOB.lido=Date.now(); BOB.puxando=false;
    estadoBobina(); drawFilTrigger();
  }
}
/* só o que mexe com o orçamento e com o que se vê nos cartões */
const impressaoBob = () => JSON.stringify(BOB.fils.map(f=>[
  f.n,f.kg,f.restante_g,f.bobines,f.cor_hex,f.na_impressora,
  (f.lista_bobines||[]).map(b=>[b.id,b.restante_g,b.na_impressora])
]));

function ligaBobina(){
  const c=store.get('bobina',null);       /* a última leitura, para a app abrir já com dados */
  if(c && Array.isArray(c.fils)){
    BOB.fils=c.fils; BOB.resumo=c.resumo||null; BOB.em=c.em||0; BOB.precos_em=c.precos_em||'';
    aplicaDataPrecos();
  }
  drawFils(); estadoBobina();
  puxaBobina(true);
  setInterval(()=>{ if(document.visibilityState==='visible') puxaBobina(); }, BOB_INTERVALO);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible') puxaBobina(); });
  window.addEventListener('focus',()=>puxaBobina());
}
const kgTxt = g => g>=1000 ? (g/1000).toFixed(g%1000?2:0).replace('.',',')+' kg' : Math.round(g)+' g';
function haQuanto(ms){
  const s=Math.max(0,Math.round((Date.now()-ms)/1000));
  if(s<10) return tr('bobAgora');
  if(s<90) return tr('bobHaSeg',{n:s});
  const m=Math.round(s/60);
  return m<90 ? tr('bobHaMin',{n:m}) : tr('bobHaHoras',{n:Math.round(m/60)});
}
/* a barra de estado da ligação, no seletor e por baixo do botão */
function estadoBobina(){
  const c=el('bob_live'); if(!c) return;
  const r=BOB.resumo;
  const ok=BOB.ok;
  c.className='fplive '+(ok?'on':(BOB.fils.length?'velho':'off'));
  const conta=r
    ? tr('bobResumo',{f:r.filamentos, b:r.bobines, kg:kgTxt(r.total_g)})
    : tr('bobSemDados');
  c.innerHTML='<i class="dot"></i><span>'+htmlEsc(
      ok ? conta+' · '+haQuanto(BOB.lido)
         : (BOB.fils.length ? tr('bobOffline',{quando:haQuanto(BOB.lido)}) : tr('bobSemLigacao'))
    )+'</span>';
  c.title=BOB.erro||tr('bobTitulo');
}

/* ---- a bobine desenhada ----
   O mesmo traço da app do Bobina: aro, filamento enrolado com a folga por onde
   sai a ponta, e o núcleo. A COR vem já resolvida da ponte (lexicon.cor_hex do
   lado de lá) — aqui não há léxico nenhum, de propósito. */
const COR_NEUTRA='#8892a0';
const hex2rgb = h => { const n=parseInt(String(h).slice(1),16); return [n>>16&255,n>>8&255,n&255]; };
const rgb2hex = ([r,g,b]) => '#'+[r,g,b]
  .map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
function rgb2hsl([r,g,b]){
  r/=255; g/=255; b/=255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn;
  let h=0; const l=(mx+mn)/2;
  const sat=d===0?0:d/(1-Math.abs(2*l-1));
  if(d!==0){
    if(mx===r) h=((g-b)/d)%6; else if(mx===g) h=(b-r)/d+2; else h=(r-g)/d+4;
    h*=60; if(h<0) h+=360;
  }
  return [h,sat,l];
}
function hsl2rgb([h,s,l]){
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  const t = h<60?[c,x,0] : h<120?[x,c,0] : h<180?[0,c,x]
          : h<240?[0,x,c] : h<300?[x,0,c] : [c,0,x];
  return t.map(v=>(v+m)*255);
}
const luz = hex => { const [r,g,b]=hex2rgb(hex).map(v=>{
    v/=255; return v<=0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); });
  return 0.2126*r+0.7152*g+0.0722*b; };
/* Um preto #141414 não se distingue no painel escuro. O traço sobe de
   luminosidade o suficiente para existir; o ENCHIMENTO fica com a cor
   verdadeira — é o filamento. Cópia exata do visivel() do Bobina: as duas apps
   têm de desenhar a mesma bobine. */
function corVisivel(hex){
  if(!/^#[0-9a-f]{6}$/i.test(hex||'')) return COR_NEUTRA;
  let [h,s,l]=rgb2hsl(hex2rgb(hex));
  const y=luz(hex);
  if(y<0.05) l=Math.max(l,0.32);
  else if(y<0.16) l=Math.max(l,0.40);
  if(y>0.88) l=Math.min(l,0.85);
  return rgb2hex(hsl2rgb([h,s,l]));
}
function bobineSVG(cor,tam,transp){
  const c=/^#[0-9a-f]{6}$/i.test(cor||'')?cor:COR_NEUTRA, linha=corVisivel(c);
  return `<svg class="bob" viewBox="0 0 48 48" width="${tam}" height="${tam}" aria-hidden="true">
    <circle cx="24" cy="24" r="20.5" fill="none" stroke="${linha}" stroke-width="1.8" opacity=".75"/>
    <path d="M35.69 30.75 A13.5 13.5 0 1 1 35.69 17.25" fill="none" stroke="${c}"
          stroke-width="7.5" stroke-linecap="round" opacity="${transp?'.45':'.95'}"/>
    <path d="M35.69 17.25 c 4 -1.5, 6.5 2, 3.6 4.8" fill="none" stroke="${linha}"
          stroke-width="2" stroke-linecap="round"/>
    <circle cx="24" cy="24" r="6" fill="none" stroke="${linha}" stroke-width="1.8"/>
  </svg>`;
}
/* A barra de stock muda de cor a partir dos 50%: âmbar em baixo, vermelho a
   chegar ao fim. Acima de metade fica no laranja da casa -- duas cores só, que
   uma barra aos arco-íris não diz nada a ninguém. O mesmo degrau existe no
   Bobina (lá parte do roxo), para a mesma bobine ter a mesma cara nas duas. */
const LIMIAR_BARRA=0.5;
const misturaHex=(a,b,t)=>{ const A=hex2rgb(a),B=hex2rgb(b);
  return rgb2hex(A.map((v,i)=>v+(B[i]-v)*t)); };
function corBarra(fracao){
  if(!(fracao<LIMIAR_BARRA)) return '';
  const t=Math.max(0,Math.min(1,(LIMIAR_BARRA-fracao)/LIMIAR_BARRA));
  return `background:linear-gradient(90deg,${misturaHex('#ff9f2e','#b91c1c',t)},`
    +`${misturaHex('#ffc46b','#ef4444',t)})`;
}
const desenhaFil = (f,tam=34) => f&&f.bobina
  ? bobineSVG(f.cor_hex,tam,f.transparente)
  : bobineSVG(COR_NEUTRA,tam,false);
/* O mesmo bico do Bobina: é o estado "esta bobine/filamento está montado na
   impressora". O desenho usa currentColor; o verde vem das classes. */
const NOZZLE = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"
  style="vertical-align:-3px">
  <path d="M12 2v3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  <rect x="6" y="5.5" width="12" height="6.5" rx="1.4" fill="currentColor"/>
  <path d="M8.6 12h6.8l-2.2 5.2h-2.4z" fill="currentColor"/>
  <circle cx="12" cy="20" r="1.5" fill="currentColor" opacity=".55"/></svg>`;
const contaNaImpressora = f => f&&f.bobina
  ? (+f.na_impressora||0) || (f.lista_bobines||[]).filter(b=>+b.na_impressora).length
  : 0;
const tituloNaImpressora = f => contaNaImpressora(f)>1
  ? tr('fpImpTituloN',{n:contaNaImpressora(f)})
  : tr('fpImpTitulo');
const rotuloEscolhaFil = f => f.n + (contaNaImpressora(f) ? ' · '+tr('fpNaImpressora') : '');

/* ---- o botão que abre o seletor ---- */

/* ---- o seletor ---- */
let FP={q:'',mat:'',stock:false,veu:false,reflexo:true};
const pickerAberto = () => el('filpick') && el('filpick').style.display==='flex';
function abrePicker(){
  const p=el('filpick'); if(!p) return;
  p.style.display='flex';
  drawPicker();
  puxaBobina(true);
  setTimeout(()=>{ const q=el('fp_q'); if(q) q.focus(); },40);
}
function fechaPicker(){ const p=el('filpick'); if(p) p.style.display='none'; }
function filtraPicker(){ FP.q=el('fp_q').value.trim().toLowerCase(); drawPicker(); }
function chipPicker(m){ FP.mat=FP.mat===m?'':m; drawPicker(); }
function togglaStock(){ FP.stock=!FP.stock; drawPicker(); }
/* Realçar quem tem tudo por abrir é aparência: fica no browser, como o idioma,
   e não no orçamento nem nos presets. */
function toggleRealce(k){ FP[k]=!FP[k]; store.set('fp_'+k,FP[k]); desenhaRealces(); drawPicker(); }
function desenhaRealces(){
  const c=el('fp_realces'); if(!c) return;
  c.innerHTML=[['veu','fpVeu','fpVeuT'],['reflexo','fpReflexo','fpReflexoT']].map(([k,t,tt])=>
    `<button class="frealce${FP[k]?' on':''}" data-r="${k}" title="${htmlEsc(tr(tt))}">✦ ${htmlEsc(tr(t))}</button>`
  ).join('');
}

const semAcentos = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function casaFiltro(f){
  if(FP.mat && semAcentos(f.material||'')!==semAcentos(FP.mat)) return false;
  if(FP.stock && !(f.bobines>0)) return false;
  if(!FP.q) return true;
  return semAcentos([f.n,f.marca,f.material,f.cor,(f.locais||[]).join(' '),f.loja].join(' '))
    .includes(semAcentos(FP.q));
}

/* Os cartões falam por índice (data-i) e não pelo nome do filamento: o htmlEsc
   daqui não escapa aspas, e um nome com uma plica dentro de um onclick partia
   o cartão todo. FP.lista é a ordem que está no ecrã. */
function cartaoFil(f,i,escolhido){
  const meu=!f.bobina;
  const imp=contaNaImpressora(f);
  const tag = meu ? tr('fpTagMeu')
    : f.origem_preco==='compras' ? tr('fpTagPago')
    : f.origem_preco==='lojas'   ? tr('fpTagLoja') : tr('fpTagSemPreco');
  const cheio = f.capacidade_g>0 ? Math.max(0,Math.min(1,f.restante_g/f.capacidade_g)) : 0;
  /* basta uma bobine aberta para deixar de estar por abrir -- é isso que a
     marca quer dizer, e não "tem algumas seladas" */
  const porAbrir = f.bobina && f.bobines>0 && f.selados===f.bobines && (FP.veu||FP.reflexo);
  const realce = porAbrir ? ' porabrir'+(FP.veu?' veu':'')+(FP.reflexo?' reflexo':'') : '';
  const marcaImp = imp ? ' imprimindo' : '';
  const stock = !f.bobina ? ''
    : f.bobines
      ? `<div class="fbar"><i style="width:${(cheio*100).toFixed(0)}%;${corBarra(cheio)}"></i></div>
         <div class="fmeta">${htmlEsc(kgTxt(f.restante_g))} · ${htmlEsc(tr('fpBobines',{n:f.bobines}))}`
        + (f.locais&&f.locais.length?`<em title="${htmlEsc(f.locais.join(' · '))}">${htmlEsc(f.locais[0])}</em>`:'')
        + `</div>`
      : `<div class="fmeta fzero">${htmlEsc(tr('fpSemStock'))}`
        + (f.preco_loja_kg?' · '+htmlEsc(tr('fpNaLoja',{loja:f.loja||'—',preco:eur(f.preco_loja_kg)})):'')
        + `</div>`;
  const acoes = meu
    ? `<button class="fbtn" data-a="editar" title="${htmlEsc(tr('fpEditar'))}">✎</button>`
      + `<button class="fbtn" data-a="apagar" title="${htmlEsc(tr('fpApagarT'))}">×</button>`
    : `<button class="fbtn fnoz${imp?' on':''}" data-a="impressora" title="${htmlEsc(imp?tr('fpImpDesativar'):tr('fpImpAtivar'))}">${NOZZLE}</button>`
      + `<button class="fbtn" data-a="copiar" title="${htmlEsc(tr('fpCopiarT'))}">⧉</button>`;
  const titulo = f.bobina && (f.material||f.cor)
    ? `<b>${htmlEsc([f.material,f.cor].filter(Boolean).join(' '))}</b>`
      + (f.marca?`<span class="fmarca">${htmlEsc(f.marca)}</span>`:'')
    : `<b>${htmlEsc(f.n)}</b>`;
  return `<div class="fcard${escolhido?' sel':''}${f.bobina&&!f.bobines?' vazio':''}${realce}${marcaImp}"
      data-i="${i}" tabindex="0" role="button" title="${htmlEsc(f.n)}">
    <div class="fbob">${desenhaFil(f,42)}</div>
    <div class="fcorpo">
      <div class="ftit">${titulo}</div>
      <div class="fpreco"><b>${eur(f.kg)}</b><span>/kg</span><i class="ftag">${htmlEsc(tag)}</i></div>
      ${stock}
    </div>
    <div class="facoes">${acoes}</div>
  </div>`;
}
function drawPicker(){
  const cx=el('fp_corpo'); if(!cx) return;
  const escolhido=el('s_fil_nome').value;
  const todos=todosFils();
  const mats=[...new Set(todos.filter(f=>f.bobina&&f.material).map(f=>f.material))].sort();
  el('fp_chips').innerHTML=mats.map((m,i)=>
      `<button class="fchip${FP.mat===m?' on':''}" data-m="${i}">${htmlEsc(m)}</button>`).join('')
    + `<button class="fchip${FP.stock?' on':''}" data-m="stock">${htmlEsc(tr('fpSoStock'))}</button>`;
  FP.mats=mats;

  /* com stock primeiro: é o que se pode mesmo imprimir hoje */
  const doBob=todos.filter(f=>f.bobina&&casaFiltro(f))
    .sort((a,b)=>(b.bobines>0)-(a.bobines>0) || a.n.localeCompare(b.n,'pt'));
  const meus=todos.filter(f=>!f.bobina&&casaFiltro(f));
  FP.lista=[...doBob,...meus];
  const vazio=`<div class="fvazio">${htmlEsc(tr('fpNada'))}</div>`;
  cx.innerHTML=
     `<div class="fsec"><h4>Bobina <span>${htmlEsc(tr('fpEmDireto'))}</span></h4>`
    + `<div class="fgrid">${doBob.map((f,i)=>cartaoFil(f,i,f.n===escolhido)).join('')||vazio}</div></div>`
    + `<div class="fsec"><h4>${htmlEsc(tr('fpMeus'))} <span>${htmlEsc(tr('fpMeusSub'))}</span></h4>`
    + `<div class="fgrid">${meus.map((f,i)=>cartaoFil(f,doBob.length+i,f.n===escolhido)).join('')}`
    + `<button class="fcard fnovo" data-novo="1">＋ ${htmlEsc(tr('fpNovo'))}</button></div></div>`;
  estadoBobina();
}
/* uma escuta só, montada no arranque */
function ligaPicker(){
  const p=el('filpick'); if(!p) return;
  FP.veu=store.get('fp_veu',false); FP.reflexo=store.get('fp_reflexo',true);
  desenhaRealces();
  el('fp_realces').addEventListener('click',e=>{
    const b=e.target.closest('.frealce'); if(b) toggleRealce(b.dataset.r);
  });
  p.addEventListener('click',e=>{ if(e.target===p) fechaPicker(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&pickerAberto()) fechaPicker(); });
  el('fp_chips').addEventListener('click',e=>{
    const b=e.target.closest('.fchip'); if(!b) return;
    if(b.dataset.m==='stock') togglaStock(); else chipPicker(FP.mats[+b.dataset.m]);
  });
  el('fp_corpo').addEventListener('click',e=>{
    if(e.target.closest('[data-novo]')) return addFil();
    const cartao=e.target.closest('.fcard[data-i]'); if(!cartao) return;
    const f=FP.lista[+cartao.dataset.i]; if(!f) return;
    const b=e.target.closest('.fbtn');
    if(b){
      e.stopPropagation();
      if(b.dataset.a==='editar') editFil(f.n);
      else if(b.dataset.a==='apagar') delFil(f.n);
      else if(b.dataset.a==='copiar') copiaBob(f.n);
      else if(b.dataset.a==='impressora') alternaImpressoraFil(f);
      return;
    }
    escolheFil(f.n); fechaPicker();
  });
  el('fp_corpo').addEventListener('keydown',e=>{
    if(e.key!=='Enter'&&e.key!==' ') return;
    const cartao=e.target.closest('.fcard[data-i]'); if(!cartao) return;
    e.preventDefault();
    const f=FP.lista[+cartao.dataset.i];
    if(f){ escolheFil(f.n); fechaPicker(); }
  });
}

/* ---- o que o trabalho gasta de cada filamento ----
   Segue o reparto da mesa: os gramas escritos à mão em cada material, e o resto
   por igual pelos que ficaram em branco. O desperdício conta — sai da bobine na
   mesma. É este número que vai dar baixa ao Bobina, por isso é o mesmo que o
   aviso de stock usa: um só sítio a contar, para não dizerem coisas diferentes. */
function gastoPorFilamento(det,fDesp){
  const m={};
  det.forEach(d=>{
    if(!d.g) return;
    const rep=d.rep&&d.rep.length ? d.rep
      : (d.fils||[]).map(n=>({n, g:d.g/Math.max(d.fils.length,1)}));
    rep.forEach(x=>{ if(x.g>0) m[x.n]=(m[x.n]||0)+x.g*fDesp; });
  });
  return m;
}
/* Só avisa do que o Bobina sabe mesmo: um filamento escrito à mão aqui não tem
   stock nenhum associado, e um do Bobina lido de uma leitura velha também não
   serve para dizer "não chega". */
function avisoStock(det,fDesp){
  if(!BOB.ok) return '';
  const gasto=gastoPorFilamento(det,fDesp);
  const faltam=[];
  Object.keys(gasto).forEach(n=>{
    const f=bobVivo(n); if(!f) return;
    if(FILS.some(x=>x.n===n)) return;          /* foi substituído por um meu */
    if(gasto[n]>f.restante_g+0.5)
      faltam.push({n, precisa:gasto[n], tem:f.restante_g, bobines:f.bobines});
  });
  if(!faltam.length) return '';
  return `<div class="warn">⚠️ ${htmlEsc(tr('fpFaltaTitulo'))}`
    + faltam.map(x=>`<div style="margin-top:4px">· <b>${htmlEsc(x.n)}</b> — `
        + htmlEsc(tr('fpFaltaLinha',{precisa:kgTxt(x.precisa), tem:kgTxt(x.tem),
                                     falta:kgTxt(x.precisa-x.tem)}))+`</div>`).join('')
    + `</div>`;
}

/* ============ dar baixa no Bobina ============
   Orçamentar não gasta filamento nenhum — só imprimir gasta. Por isso a baixa é
   um acto à parte, com botão seu e uma pergunta ao abrir o orçamento do cliente,
   e nunca acontece sozinha. Quem tem o inventário é o Bobina: daqui só sai
   quantos gramas saíram de que bobine.

   Três decisões que não são óbvias:
   - a CHAVE nasce quando o diálogo abre e vive enquanto ele estiver aberto. Dois
     cliques no botão, ou um retry porque a rede falhou a meio, dão a mesma baixa
     uma vez só — é o que o Bobina garante por essa chave. Fechar e reabrir gera
     outra, porque aí é mesmo outra impressão.
   - a bobine escolhida é um PALPITE que se troca à mão: o Bobina sabe quanto
     resta em cada uma, não sabe qual delas está na garagem.
   - o que ficou dado guarda-se com o orçamento, com o desfazer à mão. */
let BAIXAS=[];           /* baixas deste trabalho, uma por mesa */
let BAIXA_ADIADA=false;  /* respondeu "ainda não": não voltar a perguntar */
const BX={mesas:[], mesa:null, linhas:[], chave:'', depois:false, ligado:false};

const novaChave = () => 'filametria-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
const estadoBob = e => tr({selado:'bxSelado', aberto:'bxAberto', vazio:'bxVazio'}[e]||'bxAberto');

function baixaDaMesa(i){
  return BAIXAS.find(b=>+b.mesa===+i) || BAIXAS.find(b=>!b.mesa);
}
function totalBaixa(B){
  return (B&&B.consumos||[]).reduce((a,c)=>a+(+c.gramas||0),0);
}
function quandoBaixa(B){
  return new Date(B.em).toLocaleString(IDIOMA==='en'?'en-GB':'pt-BR',
                                      {dateStyle:'short', timeStyle:'short'});
}

/* o que uma mesa gasta de cada filamento QUE O BOBINA CONHECE.
   Um filamento escrito à mão aqui não tem bobine nenhuma lá — não há baixa que
   dar. Sem ligação viva também não se dá baixa nenhuma: uma leitura velha não
   sabe o que está em casa agora, e isto escreve no inventário. */
function itensBobinaDeDet(det){
  if(!BOB.ok || !det || !det.length) return [];
  const gasto=gastoPorFilamento(det, LAST.fDesp||1);
  return Object.keys(gasto).map(n=>{
    if(FILS.some(x=>x.n===n)) return null;      /* substituído por um meu */
    const f=bobVivo(n);
    if(!f || !(f.lista_bobines||[]).length) return null;
    return {n, f, g:gasto[n]};
  }).filter(x=>x && x.g>0.5);
}
function mesasBobina(){
  if(!BOB.ok || !LAST.det) return [];
  return LAST.det.map(d=>{
    const itens=itensBobinaDeDet([d]);
    return {i:d.i, det:d, itens, total:itens.reduce((a,x)=>a+x.g,0)};
  }).filter(M=>M.itens.length);
}
function mesasPendentes(){
  return mesasBobina().filter(M=>!baixaDaMesa(M.i));
}
/* agregado das mesas ainda por dar baixa: só serve para o botão e a pergunta */
function gastoBobina(){
  const m={};
  mesasPendentes().forEach(M=>M.itens.forEach(x=>{
    if(!m[x.n]) m[x.n]={n:x.n, f:x.f, g:0};
    m[x.n].g+=x.g;
  }));
  return Object.values(m).filter(x=>x.g>0.5);
}

/* "820 g · aberta · Oficina › Estante A · 2026-03-01" — o que chega para saber
   qual é a bobine sem ir lá acima confirmar */
function rotuloBobine(b){
  const p=[kgTxt(b.restante_g), estadoBob(b.estado)];
  if(b.na_impressora) p.push(tr('bxMontada'));
  if(b.etiqueta) p.push(b.etiqueta);
  if(b.local) p.push(b.local);
  else if(b.caixa) p.push(tr('bxNaCaixa'));
  if(b.comprado_em) p.push(b.comprado_em);
  return p.join(' · ');
}

/* Qual bobine gastar, por omissão, por esta ordem:
   1) a que está montada na impressora — o Bobina manda isso desde a 1.13, e é a
      melhor pista de qual imprimiu;
   2) sem nenhuma montada, a que menos tem mas ainda chega, preferindo uma já
      aberta — acaba-se o que está começado antes de estragar uma selada;
   3) se nenhuma chega sozinha, gasta-se de várias: primeiro as montadas, depois
      da mais antiga em diante. É só um palpite — o diálogo deixa trocar tudo. */
function bobinesSugeridas(f,g){
  const bs=(f.lista_bobines||[]).filter(b=>(+b.restante_g||0)>0);
  if(!bs.length) return [];
  const porRestante=l=>[...l].sort((a,b)=>a.restante_g-b.restante_g);
  const chega=l=>porRestante(l.filter(b=>b.restante_g+0.5>=g));
  const montadas=bs.filter(b=>b.na_impressora);
  const m=chega(montadas)[0];
  if(m) return [{id:m.id, g}];
  if(!montadas.length){
    const chegam=chega(bs);
    const aberta=chegam.find(b=>b.estado==='aberto');
    if(aberta) return [{id:aberta.id, g}];
    if(chegam.length) return [{id:chegam[0].id, g}];
  }
  const velhas=[...bs].filter(b=>!b.na_impressora).sort((a,b)=>
    String(a.comprado_em||'9999').localeCompare(String(b.comprado_em||'9999')) || a.id-b.id);
  const out=[]; let falta=g;
  [...porRestante(montadas), ...velhas].forEach(b=>{
    if(falta<=0.5) return;
    const q=Math.min(b.restante_g, falta);
    out.push({id:b.id, g:q}); falta-=q;
  });
  /* nem juntando todas chega: o resto fica na última e o aviso di-lo */
  if(falta>0.5 && out.length) out[out.length-1].g+=falta;
  return out;
}

function preparaBaixaMesa(mesa){
  const M=mesasBobina().find(x=>+x.i===+mesa);
  if(!M || baixaDaMesa(M.i)) return;
  BX.mesa=M.i;
  BX.linhas=M.itens.map(x=>({n:x.n, f:x.f, total:x.g, alocs:bobinesSugeridas(x.f, x.g)}));
  BX.chave=novaChave();
  el('bx_erro').textContent='';
  drawBaixa();
}

function abreBaixa(){
  BX.mesas=mesasBobina();
  BX.mesa=null; BX.linhas=[]; BX.chave='';
  if(!BX.mesas.length && !BAIXAS.length) return;
  el('bx_erro').textContent='';
  el('baixa').style.display='flex';
  ligaBaixa(); drawBaixa();
}
function fechaBaixa(){
  el('baixa').style.display='none';
  if(!BX.depois) return;
  BX.depois=false;
  /* veio da pergunta: fechar sem dar baixa vale por "ainda não". Sem isto a
     pergunta reaparecia aqui mesmo e não havia como chegar ao orçamento sem
     dar baixa de alguma coisa. */
  if(mesasPendentes().length){ BAIXA_ADIADA=true; guardaEstado(); }
  preview(true);
}

function renderLinhasBaixa(M){
  const gasto=gastoPorFilamento([M.det], LAST.fDesp||1);
  const fora=Object.keys(gasto).filter(n=>!BX.linhas.some(L=>L.n===n) && gasto[n]>0.5);
  return BX.linhas.map((L,i)=>{
    const bs=L.f.lista_bobines||[];
    const alocs=L.alocs.map((a,j)=>{
      const b=bs.find(x=>x.id===+a.id);
      const demais=b && (+a.g)>(b.restante_g+0.5);
      return `<div class="bxal">
        <select data-l="${i}" data-a="${j}" data-c="b">${bs.map(x=>
          `<option value="${x.id}"${x.id===+a.id?' selected':''}>${htmlEsc(rotuloBobine(x))}</option>`
        ).join('')}</select>
        <span class="suffix bxg"><input type="number" min="0" step="1" value="${Math.round(a.g)}"
              data-l="${i}" data-a="${j}" data-c="g"><i>g</i></span>
        <button type="button" class="del" data-l="${i}" data-a="${j}" data-c="x"
                title="${htmlEsc(tr('bxTirar'))}"${L.alocs.length<2?' style="visibility:hidden"':''}>×</button>
        ${demais?`<div class="bxav">⚠️ ${htmlEsc(tr('bxSoTem',{g:kgTxt(b.restante_g)}))}</div>`:''}
      </div>`;
    }).join('');
    return `<div class="bxlin">
      <div class="bxhd">${desenhaFil(L.f,28)}
        <div class="bxnome"><b>${htmlEsc(L.n)}</b>
          <i>${htmlEsc(tr('bxEmCasa',{g:kgTxt(L.f.restante_g||0), n:L.f.bobines||0}))}</i></div>
        <span class="bxtot">${htmlEsc(kgTxt(L.total))}</span></div>
      ${alocs || `<div class="bxav">${htmlEsc(tr('bxSemBobines'))}</div>`}
      <div class="bxpe2">
        <button type="button" class="ghost" data-l="${i}" data-c="+">${htmlEsc(tr('bxOutra'))}</button>
        <span id="bxdif${i}"></span>
      </div></div>`;
  }).join('')
   + (fora.length?`<div class="bxfora">${htmlEsc(tr('bxFora',{f:fora.join(', ')}))}</div>`:'')
   + `<div class="bxpe2"><button type="button" class="primary" data-c="dar">
        ${htmlEsc(tr('bxDarMesa',{m:M.i}))}</button></div>`;
}

function drawBaixa(){
  const c=el('bx_corpo'); if(!c) return;
  BX.mesas=mesasBobina();
  if(BX.mesa && baixaDaMesa(BX.mesa)){ BX.mesa=null; BX.linhas=[]; BX.chave=''; }
  if(!BX.mesas.length){
    c.innerHTML=`<div class="bxvazio">${htmlEsc(tr('bxSemPendentes'))}</div>`;
    return;
  }
  c.innerHTML=BX.mesas.map(M=>{
    const feita=baixaDaMesa(M.i), aberta=BX.mesa===M.i && !feita;
    const info=tr('bxMesaInfo',{g:kgTxt(M.total), n:M.itens.length});
    const acao=feita
      ? `<button type="button" class="ghost" data-c="anular" data-m="${M.i}">${htmlEsc(tr('bxAnular'))}</button>`
      : `<button type="button" class="${aberta?'ghost':'primary'}" data-c="abrir" data-m="${M.i}">
           ${htmlEsc(tr(aberta?'bxEditarMesa':'bxDarMesa',{m:M.i}))}</button>`;
    return `<div class="bxmesa${feita?' done':''}">
      <div class="bxmhd">
        <div class="bxmmeta"><b>${htmlEsc(tr('bxMesa',{m:M.i}))}</b><i>${htmlEsc(info)}</i></div>
        <div class="bxmacao">${acao}</div>
      </div>
      ${feita?`<div class="bxmdone">✔ ${htmlEsc(tr('bxDadaMesa',{m:M.i,g:kgTxt(totalBaixa(feita)),quando:quandoBaixa(feita)}))}</div>`:''}
      ${aberta?`<div class="bxmdet">${renderLinhasBaixa(M)}</div>`:''}
    </div>`;
  }).join('');
  notaBaixa();
}

/* o "faltam/sobram" mexe a cada tecla, e redesenhar aqui tirava o cursor do campo */
function notaBaixa(){
  BX.linhas.forEach((L,i)=>{
    const s=el('bxdif'+i); if(!s) return;
    const soma=L.alocs.reduce((a,x)=>a+(+x.g||0),0), dif=L.total-soma;
    s.textContent = Math.abs(dif)>0.5
      ? (dif>0 ? tr('bxFaltam',{g:kgTxt(dif)}) : tr('bxSobram',{g:kgTxt(-dif)})) : '';
    s.className = s.textContent?'bxdif':'';
  });
}

function ligaBaixa(){
  const c=el('bx_corpo'); if(!c||BX.ligado) return;
  BX.ligado=true;
  c.addEventListener('change',e=>{
    const t=e.target; if(!t.dataset||t.dataset.c!=='b') return;
    BX.linhas[+t.dataset.l].alocs[+t.dataset.a].id=+t.value; drawBaixa();
  });
  c.addEventListener('input',e=>{
    const t=e.target; if(!t.dataset||t.dataset.c!=='g') return;
    BX.linhas[+t.dataset.l].alocs[+t.dataset.a].g=Math.max(0,parseFloat(t.value)||0);
    notaBaixa();
  });
  c.addEventListener('click',e=>{
    const b=e.target.closest('button[data-c]'); if(!b) return;
    if(b.dataset.c==='abrir') return preparaBaixaMesa(+b.dataset.m);
    if(b.dataset.c==='anular') return anulaBaixa(+b.dataset.m);
    if(b.dataset.c==='dar') return confirmaBaixa(b);
    const L=BX.linhas[+b.dataset.l]; if(!L) return;
    if(b.dataset.c==='x'){ L.alocs.splice(+b.dataset.a,1); drawBaixa(); }
    else if(b.dataset.c==='+'){
      const usadas=L.alocs.map(a=>+a.id);
      const bs=L.f.lista_bobines||[];
      const livre=bs.find(x=>!usadas.includes(x.id))||bs[0];
      if(!livre) return;
      const soma=L.alocs.reduce((a,x)=>a+(+x.g||0),0);
      L.alocs.push({id:livre.id, g:Math.max(0,L.total-soma)});
      drawBaixa();
    }
  });
}

async function confirmaBaixa(botao){
  if(!BX.mesa || baixaDaMesa(BX.mesa)) return;
  const consumos=[];
  BX.linhas.forEach(L=>L.alocs.forEach(a=>{
    const g=Math.round((+a.g||0)*10)/10;
    if(a.id&&g>0) consumos.push({bobine_id:+a.id, gramas:g, n:L.n});
  }));
  if(!consumos.length){ el('bx_erro').textContent=tr('bxSemNada'); return; }
  const b=botao||el('bx_ok'), txt=b.textContent;
  b.disabled=true; b.textContent=tr('bxAEnviar'); el('bx_erro').textContent='';
  try{
    const r=await fetch('/api/bobina/gastar',{method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chave:BX.chave, ref:nomeTrabalho(), consumos})});
    const d=await r.json();
    if(!r.ok||d.error) throw new Error(d.error||('erro '+r.status));
    BAIXAS=BAIXAS.filter(x=>+x.mesa!==+BX.mesa && x.mesa);
    BAIXAS.push({mesa:BX.mesa, chave:BX.chave, em:Date.now(), consumos, avisos:d.avisos||[]});
    BAIXA_ADIADA=false;
    guardaEstado();
    BX.mesa=null; BX.linhas=[]; BX.chave='';
    await puxaBobina(true);
    desenhaBotaoBaixa();
    drawBaixa();
    if((d.avisos||[]).length) alert(tr('bxAvisos')+'\n\n· '+d.avisos.join('\n· '));
  }catch(e){
    el('bx_erro').textContent=tr('bxErro',{e:(e&&e.message)||e});
  }finally{ b.disabled=false; b.textContent=txt; }
}

async function anulaBaixa(mesa){
  const B=mesa!==undefined ? baixaDaMesa(mesa) : BAIXAS[0];
  if(!B) return;
  if(!confirm(tr('bxAnularConf'))) return;
  try{
    const r=await fetch('/api/bobina/gastar/anular',{method:'POST', credentials:'same-origin',
      headers:{'Content-Type':'application/json'}, body:JSON.stringify({chave:B.chave})});
    const d=await r.json();
    if(!r.ok||d.error) throw new Error(d.error||('erro '+r.status));
    BAIXAS=BAIXAS.filter(x=>x!==B);
    guardaEstado(); await puxaBobina(true); desenhaBotaoBaixa(); drawBaixa();
    if((d.mexidas||[]).length) alert(tr('bxMexidas'));
  }catch(e){ alert(tr('bxErro',{e:(e&&e.message)||e})); }
}

function desenhaBotaoBaixa(){
  const box=el('baixa_box'); if(!box) return;
  const pend=mesasPendentes();
  const tot=pend.reduce((a,M)=>a+M.total,0);
  box.style.display=(pend.length||BAIXAS.length)?'':'none';
  const bt=el('b_baixa');
  if(bt){
    bt.textContent='📉 '+(pend.length?tr('bxBotao',{g:kgTxt(tot)}):tr('bxBotaoVer'));
    bt.disabled=!(pend.length||BAIXAS.length);
  }
  const nota=el('baixa_nota');
  if(!nota) return;
  nota.innerHTML=BAIXAS.map(B=>{
    const k=B.mesa ? tr('bxDadaMesa',{m:B.mesa,g:kgTxt(totalBaixa(B)),quando:quandoBaixa(B)})
                   : tr('bxDada',{g:kgTxt(totalBaixa(B)),quando:quandoBaixa(B)});
    return '✔ '+htmlEsc(k)+' — <a href="#" onclick="anulaBaixa('+(B.mesa||0)+');return false">'
      +htmlEsc(tr('bxAnular'))+'</a>';
  }).join('<br>');
}

/* A pergunta ao abrir o orçamento do cliente. Só aparece havendo mesmo o que dar
   baixa, e só uma vez por trabalho: quem responde "ainda não" não quer isto a
   perguntar de cada vez que espreita o orçamento. */
function perguntaBaixa(){
  if(BAIXA_ADIADA) return false;
  const pend=mesasPendentes();
  if(!pend.length) return false;
  el('bxq_txt').textContent=tr('bxqTxt',{
    g:kgTxt(pend.reduce((a,M)=>a+M.total,0)), n:pend.length});
  el('bxq').style.display='flex';
  return true;
}
function respondeBaixa(sim){
  el('bxq').style.display='none';
  if(sim){ BX.depois=true; abreBaixa(); }
  else { BAIXA_ADIADA=true; guardaEstado(); preview(true); }
}
