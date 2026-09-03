/* Filametria — Motor de cálculo, benchmarks de mercado, eletricidade, histórico e retificação */
/* ============ eletricidade automática (OMIE / mercado PT) ============ */
let spot=null;
const OMIE_URL='https://www.omie.es/pt/market-results/daily/daily-market/daily-hourly-price';
async function fetchSpot(){
  const box=el('live');
  /* Um ficheiro aberto com file:// tem origem "null" e o browser recusa qualquer pedido
     para fora, mesmo que o servidor autorize. Não há volta a dar sem servir por http(s). */
  if(location.protocol==='file:'){
    spot=null;
    box.innerHTML='<span class="st">A atualização automática precisa que a página seja servida por <b>http(s)</b>. '
      +'Aberta directamente do disco (<code>file://</code>) o browser bloqueia o pedido — passa a funcionar '
      +'assim que publicares em GitHub Pages ou correres um servidor local.</span> '
      +`<button style="margin-top:8px" onclick="window.open('${OMIE_URL}','_blank')">Ver preço de mercado ↗</button>`;
    return;
  }
  box.innerHTML='<span class="st">A obter o preço de mercado…</span>';
  /* Primeiro pelo servidor do Filametria. A API do mercado responde com
     Access-Control-Allow-Origin fixo no domínio dela, por isso um pedido feito pelo
     browser leva sempre com CORS — esteja a ligação boa ou não. Do servidor não há CORS. */
  try{
    const r=await fetch('api/spot',{cache:'no-store'});
    if(r.ok){
      const d=await r.json();
      if(d.ok && isFinite(d.media_mwh)){ spot=d.media_mwh/1000; applySpot(); return; }   // preço/MWh → preço/kWh
    }
  }catch(_){ /* sem servidor: fica a tentativa direta */ }
  /* servida como página estática ainda vale a pena tentar, caso a API um dia abra o CORS */
  try{
    const r=await fetch('https://api.energy-charts.info/price?bzn=PT',{cache:'no-store'});
    const d=await r.json();
    const p=(d.price||[]).filter(x=>typeof x==='number');
    if(!p.length) throw new Error('sem dados');
    spot=p.reduce((a,b)=>a+b,0)/p.length/1000;
    applySpot();
  }catch(e){
    spot=null;
    box.innerHTML='<span class="st">⚠️ Não deu para ler o preço de mercado. A API só autoriza pedidos do site dela, '
      +'por isso o browser sozinho é bloqueado — a atualização automática precisa do <b>servidor do Filametria</b> a correr. '
      +'O valor manual continua a ser usado.</span> '
      +`<button style="margin-top:8px" onclick="fetchSpot()">Tentar de novo</button>`;
  }
}
function applySpot(){
  if(spot===null) return;
  const final = spot*(1+num('s_iva')/100)+num('s_kwh_add');
  el('s_kwh').value=final.toFixed(4);
  el('live').innerHTML=`<span class="st">Mercado (média 24h): </span><span class="px">R$ ${spot.toFixed(4).replace('.',',')}/kWh</span>
    <span class="st"> + imposto ${num('s_iva')}% + R$ ${num('s_kwh_add').toFixed(3).replace('.',',')} de taxas → </span>
    <span class="px">R$ ${final.toFixed(4).replace('.',',')}/kWh</span>
    <span class="st"> · atualizado ${new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</span>`;
  calc();
}
function toggleAuto(){
  const on=el('s_auto_kwh').checked;
  el('s_kwh').disabled=on; el('s_kwh_add').disabled=!on; el('s_iva').disabled=!on;
  if(on) fetchSpot();
  else { el('live').innerHTML='<span class="st">Modo manual — liga o automático se tiveres tarifa indexada.</span>'; calc(); }
}


/* ============ CÁLCULO ============ */
/* blocos de trabalho — dá para orçamentar só modelação, só impressão ou só acabamento */
let BLOCOS={mod:true, imp:true, pos:true};

function calc(){
  const kwh=num('s_kwh');
  /* blocos desligados não entram no cálculo nem no orçamento do cliente */
  const bMod=BLOCOS.mod, bImp=BLOCOS.imp, bPos=BLOCOS.pos;
  const mesasAtivas = bImp ? mesas : [];

  /* custos unitários derivados */
  const fDesp        = 1+num('s_desp')/100;
  const filDef       = filDefault();
  const kgRealDe     = f => (f.kg+f.portes)*fDesp;         /* R$/kg posto na máquina */
  const custoKgReal  = kgRealDe(filDef);
  const precoKgCli   = custoKgReal*(1+num('s_mmat')/100);
  const hImpressaoDef= horaImp(impInfo(''),kwh);
  const hManualReal  = num('s_fer_preco')/Math.max(num('s_fer_vida'),1)+(num('s_pc_kw2')+num('s_fer_kw'))*kwh;
  const hPinturaReal = hManualReal+num('s_tinta_l')/1000*num('s_tinta_ml');
  /* fator que corrige a estimativa do slicer (o slicer só conta o preço da bobine) */
  const ajusta = el('j_ajusta').checked;
  const fAjDe = f => ajusta ? ((f.kg+f.portes)/Math.max(f.kg,.0001))*fDesp : 1;
  const fAj = fAjDe(filDef);
  /* os filamentos de uma mesa; sem escolha nenhuma, o das Definições */
  const filsDaMesa = m => { const l=(m[5]||[]).map(filInfo).filter(Boolean); return l.length?l:[filDef]; };

  /* mesas — estimativa do slicer, cada uma com a sua máquina e os seus filamentos */
  let gEst=0,mEst=0,cEst=0,nSlic=0;
  const det=[];   /* detalhe por mesa, para o rateio e o painel de posicionamento */
  const mistura=[];  /* mesas com vários filamentos e sem custo do slicer: preço médio */
  mesasAtivas.forEach((m,i)=>{
    const g=parseFloat(m[0])||0, t=parseT(m[1]), s=parseFloat(m[2]);
    const fs=filsDaMesa(m);
    /* o preço da mesa é a média dos R$/kg PESADA pelos gramas de cada material.
       Enquanto ninguém escrever os gramas, o reparto é por igual e isto dá
       exactamente a média simples de antes — só muda para quem os escreve. */
    const rep=repartoMesa(m, fs);
    const gRep=somaReparto(rep);
    const pesada = calcula => gRep>0 ? rep.reduce((a,x)=>a+calcula(x.f)*x.g,0)/gRep
                                     : fs.reduce((a,f)=>a+calcula(f),0)/fs.length;
    const kgM  = pesada(kgRealDe);
    const fAjM = pesada(fAjDe);
    const temSlic = isFinite(s)&&s>0;
    const cm = temSlic ? s*fAjM : g/1000*kgM;
    if(temSlic) nSlic++;
    else if(fs.length>1 && g>0 && rep.filter(x=>x.auto).length>1) mistura.push(i+1);
    gEst+=g; mEst+=t; cEst+=cm;
    const info=impInfo(m[3]||'');
    det.push({i:i+1, g, t, cm, kgM, fAjM, pecas:m[6]||0, fils:fs.map(f=>f.n),
              rep:rep.map(x=>({n:x.n, g:x.g, auto:x.auto})),
              imp:info, hImp:horaImp(info,kwh), mostrar:m[4]!==false});
  });
  /* para a retificação: médias ponderadas pelo peso de cada mesa */
  const gSoma=det.reduce((a,m)=>a+m.g,0);
  const custoKgMedio = gSoma>0 ? det.reduce((a,m)=>a+m.kgM*m.g,0)/gSoma : custoKgReal;
  const fAjMedio     = gSoma>0 ? det.reduce((a,m)=>a+m.fAjM*m.g,0)/gSoma : fAj;
  const filsEmUso    = [...new Set(det.flatMap(m=>m.fils))];
  const mBruto=det.reduce((a,m)=>a+m.t,0);              /* tempo somado, antes de desvios e retificação */
  const maquinas=agrupaMaquinas(det);                   /* máquinas distintas em uso */

  el('d_set').innerHTML=
    `<div><span>Filamento — custo real${filsEmUso.length>1?' ('+htmlEsc(filDef.n)+')':''}</span><b>${eur(custoKgReal)}/kg</b></div>`
    + (filsEmUso.length>1
        ? filsEmUso.filter(n=>n!==filDef.n).map(n=>{ const f=filInfo(n)||filDef;
            return `<div style="font-size:11px;opacity:.85"><span>· ${htmlEsc(n)}</span><b>${eur(kgRealDe(f))}/kg</b></div>`;
          }).join('')
        : '')
    + `<div><span>Filamento — faturado</span><b>${eur(precoKgCli)}/kg</b></div>
     <div><span>Correção da estimativa do slicer</span><b>× ${fAj.toFixed(4)}</b></div>
     <div class="sep"><span>Hora de impressão${maquinas.length>1?' — média ponderada':''}</span>
       <b>${eur(mBruto>0?det.reduce((a,m)=>a+m.t*m.hImp,0)/mBruto:hImpressaoDef)}/h</b></div>`
    + (maquinas.length>1
        ? maquinas.map(q=>`<div style="font-size:11px;opacity:.85"><span>· ${q.n} — ${hm(q.t)}</span><b>${eur(q.hImp)}/h</b></div>`).join('')
        : '')
    + `<div><span>Hora de pós-processamento</span><b>${eur(hManualReal)}/h</b></div>
       <div><span>Hora de pintura</span><b>${eur(hPinturaReal)}/h</b></div>`;
  /* desvio típico aprendido */
  cEst*=(1+num('s_dev_mat')/100);
  mEst*=(1+num('s_dev_t')/100);

  /* retificação com valores reais */
  const rG=parseFloat(el('r_g').value), rT=parseT(el('r_t').value), rE=parseFloat(el('r_e').value);
  const usarReal=el('r_usar').checked;
  let gTot=gEst, mTot=mEst, cMat=cEst;
  if(usarReal){
    if(isFinite(rG)&&rG>0) gTot=rG;
    if(rT>0) mTot=rT;
    if(isFinite(rE)&&rE>0) cMat=rE*fAjMedio;
    else if(isFinite(rG)&&rG>0&&!nSlic) cMat=rG/1000*custoKgMedio;
  }
  renderRetif({gEst,mEst,cEst,rG,rT,rE});

  /* as peças são de cada mesa; o campo lá em cima é só o total somado */
  const pecasTot = bImp ? totalPecas() : 0;
  el('j_pecas').value=pecasTot;
  /* pecas é a contagem real — pode ser 0; pecasDiv só serve de divisor seguro */
  const hTot=mTot/60, pecas=pecasTot, pecasDiv=Math.max(pecasTot,1);
  const pMat=cMat*(1+num('s_mmat')/100);
  const cMatMesas=det.reduce((a,m)=>a+m.cm,0);
  const fMatMesa=cMatMesas>0 ? cMat/cMatMesas : 1;

  const usou = usarReal&&((isFinite(rG)&&rG>0)||rT>0||(isFinite(rE)&&rE>0));
  el('d_mesas').innerHTML=
    `<div><span>${pecasTot} peça(s) em ${mesasAtivas.length} mesa(s) · peso total</span><b>${Math.round(gTot).toLocaleString(MOEDA_LOCALE)} g</b></div>
     <div><span>Tempo total de impressão</span><b>${hm(mTot)} · ${hTot.toFixed(1)} h</b></div>
     <div class="sep"><span>Base de material${usou?' — retificada':(nSlic?' — '+nSlic+' pelo slicer':' — por peso')}</span><b>${eur(cMat)}</b></div>`
    + (maquinas.length>1
        ? `<div><span>${maquinas.length} impressoras neste trabalho</span><b>${maquinas.map(q=>q.n).join(' · ')}</b></div>`
        : '')
    + (filsEmUso.length>1
        ? `<div><span>${filsEmUso.length} filamentos neste trabalho</span><b>${filsEmUso.map(htmlEsc).join(' · ')}</b></div>`
        : '');

  const minM=bPos?num('j_manual'):0, minP=bPos?num('j_pol'):0, minT=bPos?num('j_pint'):0;

  /* preço ao cliente — cada rubrica com a sua margem parcial */
  /* Regra de três: se o tempo final (desvio típico ou retificação) difere da soma das mesas,
     todas as mesas escalam na mesma proporção e cada uma continua a pagar a hora da sua máquina. */
  const fTempo = mBruto>0 ? mTot/mBruto : 0;
  det.forEach(m=>m.hReal=m.t*fTempo/60);
  const cImpBase = mBruto>0 ? det.reduce((a,m)=>a+m.hReal*m.hImp,0) : hTot*hImpressaoDef;
  const hImpMedia = hTot>0 ? cImpBase/hTot : hImpressaoDef;
  const taxaMaq=num('s_taxa_maq');
  const fImp=1+num('s_mimp')/100;
  det.forEach(m=>m.rate = taxaMaq>0?taxaMaq:m.hImp*fImp);
  const pImp= taxaMaq>0 ? hTot*taxaMaq : cImpBase*fImp;
  const pBase=num('s_base')*pecasTot + num('s_base_mesa')*mesasAtivas.length;
  const fMao=1+num('s_mmao')/100;
  const nMesas=mesasAtivas.length;
  const prepMin=num('s_prep_min');
  const pPrep=nMesas*prepMin/60*num('s_mao')*fMao;     /* preparação: fixa por mesa */
  const pMan=minM/60*num('s_mao')*fMao, pPol=minP/60*num('s_polh')*fMao, pPin=minT/60*num('s_pinth')*fMao;
  const pAcab=pPrep+pMan+pPol+pPin;
  /* modelação 3D: trabalho de uma vez, à tarifa própria e com a margem de mão de obra.
     Fora do desconto por quantidade de propósito — desenha-se uma vez, imprimam-se 1 ou 100. */
  const minMod=bMod?minutosModelacao():0, hMod=minMod/60;
  const pMod=hMod*num('s_modh')*fMao;
  const cMod=hMod*num('s_pc_kw2')*kwh;                 /* o custo real é o PC ligado */
  const pMarg=(pMat+pImp+pBase)*num('s_margem')/100;
  const pPrint=pMat+pImp+pBase+pPrep+pMarg;            /* só impressão: sem modelação, portes nem acabamento manual */
  const desc=(pBase+pPrep+pMan+pPol+pPin)*num('j_desc')/100;
  const promo=(pMat+pImp)*num('j_promo')/100;

  /* ---- portes ---- */
  const sel=el('j_portes').value;
  /* só se expede o que se imprimiu: sem mesas não há peso nem embalagem para cobrar.
     O valor manual continua disponível, para quem devolve peças de um trabalho de acabamento. */
  const temFisico = nMesas>0 || sel==='man';
  const gEnvio=gTot+(temFisico?num('s_emb_peso'):0);   // peças + embalagem
  const custoEmb=temFisico?num('s_emb_custo'):0;
  el('j_portes_man').disabled = sel!=='man';
  let pPortes=0, notaPortes='';

  const todos=TRANSP.grupos.flatMap(g=>g.s.map(s=>({...s, grupo:g.g, p:precoServico(s,gEnvio)})))
                           .filter(s=>s.p!==null).sort((a,b)=>a.p-b.p);
  if(!temFisico){ notaPortes='Sem peças impressas — nada a expedir. Escolhe <b>Valor manual</b> se mesmo assim houver envio.'; }
  else if(sel==='0'){ notaPortes='Entrega em mão — sem custo de transporte.'; }
  else if(sel==='man'){ pPortes=num('j_portes_man')+custoEmb; notaPortes='Valor introduzido à mão.'; }
  else if(sel==='custom'){
    const t=portes.filter(p=>gEnvio<=p[0]).sort((a,b)=>a[0]-b[0])[0];
    pPortes=(t?t[1]:(portes.length?portes[portes.length-1][1]:0))+custoEmb;
    notaPortes='Tabela personalizada.';
  }
  else if(sel==='auto'){
    if(todos.length){ pPortes=todos[0].p+custoEmb; notaPortes=`Mais barato: <b>${todos[0].n}</b> · ${todos[0].d}`; }
    else notaPortes='Nenhum serviço cobre este peso.';
  } else {
    const s=servicoPorId(sel), p=s?precoServico(s,gEnvio):null;
    if(p===null){ notaPortes=`<b style="color:var(--bad)">${s?s.n:'Serviço'}</b> não aceita ${(gEnvio/1000).toFixed(2)} kg. Escolhe outro.`; }
    else { pPortes=p+custoEmb; notaPortes=s.d; }
  }
  const nomeT=nomeTrabalho();
  el('d_trabalho').innerHTML = nomeT
    ? `<div><span>Etiqueta do trabalho</span><b>${htmlEsc(nomeT)}</b></div>`
    : '';
  el('d_portes').innerHTML=
    `<div><span>Peso a expedir (peças + embalagem)</span><b>${Math.round(gEnvio).toLocaleString(MOEDA_LOCALE)} g</b></div>`
    + (custoEmb>0&&pPortes>0?`<div><span>Transporte + embalagem</span><b>${eur(pPortes-custoEmb)} + ${eur(custoEmb)}</b></div>`:'')
    + (notaPortes?`<div class="sep"><span>${notaPortes}</span><b>${eur(pPortes)}</b></div>`:'')
    + (todos.length&&sel!=='0'&&sel!=='man'
        ? `<div style="margin-top:6px;font-size:11px;opacity:.8"><span>Alternativas: ${
            todos.slice(0,3).map(s=>`${s.n} ${eur(s.p)}`).join(' · ')}</span></div>`:'');

  const bruto=pMod+pMat+pImp+pBase+pPrep+pMan+pPol+pPin+pMarg-desc-promo+pPortes;
  let total=el('j_round').checked?Math.floor(bruto*2)/2:bruto;
  /* com o imposto por cima há dois números para arredondar: o teu preço ou o que o
     cliente paga. Arredondar o segundo obriga a recuar o primeiro pela taxa. */
  if(el('j_round').checked && el('s_tax_modo').value==='acrescentado'
     && el('s_tax_arred').value==='total'){
    const t=impostoFaturacao(bruto);
    if(t.active) total=Math.floor(bruto*(1+t.rate/100)*2)/2/(1+t.rate/100);
  }
  const arred=total-bruto;
  const tax=impostoFaturacao(total);
  const totalCliente=tax.total;      /* com imposto acrescentado, é mais alto do que o total calculado */
  const taxNome=htmlEsc(tax.nome);
  const taxRate=pct(tax.rate);

  /* custo real */
  const cPrep=nMesas*prepMin/60*hManualReal;
  const cImp=cImpBase, cMan=minM/60*hManualReal, cPol=minP/60*hManualReal, cPin=minT/60*hPinturaReal;
  const custo=cMat+cImp+cPrep+cMan+cPol+cPin+cMod+pPortes;
  const receita=tax.base;
  const lucro=receita-custo, marg=receita?lucro/receita*100:0;

  /* leitura das margens parciais */
  el('m_res').innerHTML=
    `Material <b>+${eur(pMat-cMat)}</b> · Impressão <b>+${eur(pImp-cImp)}</b> · Acabamento <b>+${eur(pAcab-cPrep-cMan-cPol-cPin)}</b>`
    + (pMod>0?` · Modelação <b>+${eur(pMod-cMod)}</b>`:'')+`<br>
     Margem final <b>+${eur(pMarg)}</b>${tax.active?' · '+taxNome+' <b>'+eur(tax.valor)+'</b>':''} → lucro total <b>${eur(lucro)}</b> (<b>${marg.toFixed(1)} %</b>)`;

  /* render */
  /* 4.º campo: esconder de vez — a rubrica não pertence a este orçamento */
  const semImp = nMesas===0;
  const L=[
    [tr('modLine',{n:MODELOS.length})+' — '+hm(minMod), pMod, minMod===0, !bMod],
    ['Material — '+gTot+' g'+(nSlic?'<span class="tag">SLICER</span>':''), pMat, false, semImp],
    ['Impressão — '+hm(mTot)+(taxaMaq>0?' @ '+moeda(taxaMaq)+'/h':''), pImp, false, semImp],
    ['Base — '+pecas+' peça(s)'+(num('s_base_mesa')>0?' + '+nMesas+' mesa(s)':''), pBase, false, semImp],
    ['Preparação — '+nMesas+' mesa(s) × '+prepMin+' min', pPrep, prepMin===0, semImp],
    ['Trabalho manual — '+minM+' min', pMan, minM===0, !bPos],
    ['Polimento — '+minP+' min', pPol, minP===0, !bPos],
    ['Pintura — '+minT+' min', pPin, minT===0, !bPos],
    ['Margem de lucro '+num('s_margem')+'%', pMarg, false, semImp],
    ['Portes de envio', pPortes, pPortes===0, !temFisico],
  ];
  let html=L.filter(r=>!r[3])
            .map(([t,v,mu])=>`<div class="li${mu?' muted':''}"><span>${t}</span><b>${eur(v)}</b></div>`).join('');
  if(desc>0)  html+=`<div class="li neg"><span>Desconto ${num('j_desc')}%</span><b>−${eur(desc)}</b></div>`;
  if(promo>0) html+=`<div class="li neg"><span>Promoção ${num('j_promo')}%</span><b>−${eur(promo)}</b></div>`;
  if(Math.abs(arred)>.004) html+=`<div class="li neg"><span>Arredondamento</span><b>${eur(arred)}</b></div>`;
  if(tax.on){
    if(tax.active){
      html+=`<div class="li muted"><span>${tr('taxSubtotal',{name:taxNome})}</span><b>${eur(tax.base)}</b></div>`;
      html+=`<div class="li muted"><span>${tr(tax.inc?'taxIncluded':'taxAdded',{name:taxNome,rate:taxRate})}</span><b>${eur(tax.valor)}</b></div>`;
    } else {
      html+=`<div class="li muted"><span>${tr('taxFree',{name:taxNome})}</span><b>${eur(0)}</b></div>`;
    }
  }
  html+=`<div class="li strong"><span>Total</span><b>${eur(totalCliente)}</b></div>`;
  el('o_linhas').innerHTML=html;
  el('o_total').textContent=eur(totalCliente);
  el('o_unit').innerHTML=[pecas>1?eur(totalCliente/pecas)+' / peça':'', nMesas>1||pecas>1?eur(totalCliente/nMesas)+' / mesa':'']
    .filter(Boolean).join(' &nbsp;·&nbsp; ');

  el('k_custo').textContent=eur(custo);
  el('k_lucro').textContent=eur(lucro);
  el('k_lucro').className='v '+(lucro>=0?'good':'bad');
  const mMin=num('s_mmin');
  el('k_margem').textContent=marg.toFixed(1)+' %';
  el('k_margem').className='v '+(marg>=mMin?'good':marg>=mMin*0.6?'blue':'bad');

  const segs=[['Material',cMat,'#5aa9ff'],['Energia + máquina',cImp,'#8b6bff'],
              ['Outros custos',cPrep+cMan+cPol+cPin+cMod+pPortes,'#ff6b6b'],
              [taxNome,tax.valor,'#ffbd55'],['Lucro',Math.max(lucro,0),'#3ecf8e']];
  const tt=segs.reduce((s,x)=>s+x[1],0)||1;
  el('bar').innerHTML=segs.map(s=>`<i style="width:${s[1]/tt*100}%;background:${s[2]}"></i>`).join('');
  el('leg').innerHTML=segs.map(s=>`<span><s style="background:${s[2]}"></s>${s[0]} ${(s[1]/tt*100).toFixed(0)}%</span>`).join('');

  el('d_custo').innerHTML=
    `<div><span>Filamento</span><b>${eur(cMat)}</b></div>
     <div><span>Eletricidade + amortização</span><b>${eur(cImp)}</b></div>
     ${minMod>0?`<div><span>${tr('modLine',{n:MODELOS.length})} — ${hm(minMod)}</span><b>${eur(cMod)}</b></div>`:''}
     <div><span>Preparação + pós-processamento</span><b>${eur(cPrep+cMan+cPol+cPin)}</b></div>
     <div><span>Portes</span><b>${eur(pPortes)}</b></div>
     ${tax.active?`<div><span>${tr('taxIncluded',{name:taxNome,rate:taxRate})}</span><b>${eur(tax.valor)}</b></div>`:''}
     <div class="sep"><span>Custo total</span><b>${eur(custo)}</b></div>
     ${tax.active?`<div><span>${tr('taxNetRevenue')}</span><b>${eur(receita)}</b></div>`:''}
     ${pecas>0?`<div><span>Ponto de equilíbrio</span><b>${eur(custo/pecasDiv)}/peça</b></div>`:''}`;

  const d=el('s_data').value, dias=d?Math.floor((Date.now()-new Date(d))/864e5):999;
  /* média de preços: só avisa quando ela chega mesmo a pesar no custo */
  const avisoMix = mistura.length
    ? `<div class="warn">⚠️ ${mistura.length>1?'Mesas':'Mesa'} ${mistura.join(', ')} com mais do que um filamento
       e sem os gramas de cada um — o material foi repartido <b>por igual</b>. Escreve os gramas de cada
       material no campo ao lado do nome (o slicer dá-tos) e o custo, o aviso de stock e a baixa no
       Bobina passam a ser exactos.</div>`
    : '';
  const avisoBlocos = (!bMod&&!bImp&&!bPos)
    ? `<div class="warn">⚠️ Estão desligados todos os blocos de trabalho — não há nada para orçamentar.</div>`
    : '';
  /* o inventário do Bobina é de agora: dá para dizer, aqui, que o trabalho não cabe */
  const avisoFalta = avisoStock(det,fDesp);
  el('stale').innerHTML = avisoBlocos + avisoFalta + avisoMix + (lucro<0
    ? `<div class="warn">⚠️ Este orçamento dá prejuízo de ${eur(-lucro)}.</div>`
    : marg<mMin
    ? `<div class="warn">⚠️ Margem de ${marg.toFixed(1)}% — abaixo do teu mínimo de ${mMin}%. Sobe a margem final ou reduz o desconto.</div>`
    : (dias>90 ? `<div class="warn">⚠️ Definições sem revisão há <b>${dias} dias</b>. Confirma o preço do filamento antes de enviar.</div>` : ''));

  /* a régua horária é do tempo de máquina: modelação e acabamento saem de fora */
  LAST={pMat,pImp,pBase,pPrep,pAcab,pMod,pMarg,pPrint,desc,promo,arred,pPortes,total,tax,hTot,pecas,
        det, fDesp,   /* o detalhe fica à mão: é dele que sai a baixa no Bobina */
        taxa: hTot>0?pImp/hTot:0};
  desenhaBotaoBaixa();
  marketPanel({total,pPrint,pMat,pImp,pAcab,pMod,pPortes,pBase,pPrep,desc,hTot,pecas,det,nMesas,fMatMesa,
    basePeca:num('s_base'), baseMesa:num('s_base_mesa'), margemFinal:num('s_margem')/100,
    pPrepMesa:nMesas?pPrep/nMesas:0, taxaCobrada: taxaMaq>0?taxaMaq:hImpMedia*fImp});

  el('d_mod').innerHTML = minMod>0
    ? `<div><span>${MODELOS.length} modelo(s) · ${hm(minMod)} de modelação</span><b>${eur(pMod)}</b></div>`
      + `<div><span>À tarifa de ${eur(num('s_modh'))}/h${num('s_mmao')>0?` + ${num('s_mmao')}% de margem`:''}</span>`
      + `<b>${eur(pMod/Math.max(hMod,.0001))}/h</b></div>`
    : '';

  drawTiers();
  buildPrint({
    impressao: pMat+pImp+pBase+pMarg,
    modelacao: pMod, nModelos: MODELOS.length, modMin: minMod,
    modDet: el('j_mostrar_mod').checked
      ? MODELOS.map(m=>({n:(m.n||'').trim(), t:parseT(m.t)})).filter(m=>m.n||m.t>0)
      : [],
    acabamento: pAcab,
    portes:pPortes, desc, promo, arred, total:totalCliente, tax, pecas, gTot, mTot, nMesas,
    temImp: nMesas>0, temAcab: pAcab>0,
    /* só as mesas com o visto entram — uma máquina que também fez mesas escondidas
       não pode levar o tempo dessas para o orçamento */
    maquinas: el('j_mostrar_maq').checked ? agrupaMaquinas(det.filter(m=>m.mostrar)) : [],
    material: filsEmUso.length ? filsEmUso.join(' · ') : (el('s_fil_nome').value||'PLA'),
    /* detalhe por mesa só quando há mais do que um filamento — senão é ruído */
    filPorMesa: filsEmUso.length>1 ? det.filter(m=>m.mostrar).map(m=>({i:m.i, f:m.fils})) : [],
    minutosAcab: minM+minP+minT, prepMin,
    detAcab: [minM>0?'montagem':'',minP>0?'polimento':'',minT>0?'pintura':'']
             .filter(Boolean).join(', '),
    transp: (()=>{ const s=servicoPorId(el('j_portes').value); return s?s.n+' · '+s.d:''; })()
  });
}


let bandaEscolhida='seller';

/* fator de inflação acumulada desde a recolha até hoje */
function driftInflacao(){
  const d0=new Date(BENCH.recolha), hoje=new Date();
  let f=1, y=d0.getFullYear(), pos=d0;
  while(pos<hoje){
    const fimAno=new Date(y+1,0,1);
    const ate=fimAno<hoje?fimAno:hoje;
    const fracao=(ate-pos)/(365.25*864e5);
    f*= Math.pow(1+(BENCH.inflacao[y]??BENCH.inflDefault)/100, fracao);
    pos=fimAno; y++;
    if(y>2100) break;
  }
  return f;
}
function bandasAtuais(){
  const f=driftInflacao();
  return {f, bandas:BENCH.bandas.map(b=>({...b,lo:b.lo*f,hi:b.hi*f})),
          peca:{lo:BENCH.pecaPT.lo*f, med:BENCH.pecaPT.med*f, hi:BENCH.pecaPT.hi*f},
          minimo:BENCH.minimo.map(x=>x*f)};
}

/* desenha uma régua com bandas e marca a posição */
function gauge(pre, valor, segs, fmt){
  const tot=Math.max(segs[segs.length-1].ate,.0001);
  el(pre+'t').innerHTML=segs.map(s=>
    `<i style="width:${Math.max(0,(s.ate-(s.de||0))/tot*100)}%;background:${s.cor}"></i>`).join('');
  el(pre+'k').innerHTML=segs.map(s=>
    `<span style="width:${Math.max(0,(s.ate-(s.de||0))/tot*100)}%">${s.rot}</span>`).join('');
  const pct=Math.max(0,Math.min(100, valor/tot*100));
  const p=el(pre+'p');
  p.style.left=pct+'%';
  p.className='pin'+(valor<segs[0].ate||valor>tot?' out':'');
  p.querySelector('b').textContent=fmt(valor);
}

function marketPanel(x){
  const B=bandasAtuais();
  const horas=x.hTot, pecas=x.pecas;
  const printTotal=isFinite(x.pPrint)?x.pPrint:Math.max(0,x.total-(x.pMod||0)-x.pPortes);

  /* taxa horária de máquina: a rubrica de impressão por hora, sem modelação nem portes */
  const taxa = horas>0 ? (x.pImp||0)/horas : 0;
  const porPeca = pecas>0 ? printTotal/pecas : 0;   /* só impressão; modelação é do trabalho, não da peça */

  el('g1v').textContent = horas>0 ? moeda(taxa)+'/h' : '—';
  el('g2v').textContent = pecas>0 ? eur(porPeca) : '—';

  const topo=B.bandas[2].hi*1.25;
  gauge('g1', taxa, [
    {de:0, ate:B.bandas[0].lo, rot:'abaixo', cor:'#ff6b6b'},
    {de:B.bandas[0].lo, ate:B.bandas[0].hi, rot:'hobby', cor:'#5aa9ff'},
    {de:B.bandas[0].hi, ate:B.bandas[1].lo, rot:'', cor:'#2a323e'},
    {de:B.bandas[1].lo, ate:B.bandas[1].hi, rot:'vendedor', cor:'#3ecf8e'},
    {de:B.bandas[1].hi, ate:B.bandas[2].lo, rot:'', cor:'#2a323e'},
    {de:B.bandas[2].lo, ate:B.bandas[2].hi, rot:'pro', cor:'#8b6bff'},
    {de:B.bandas[2].hi, ate:topo, rot:'premium', cor:'#ff9f2e'}
  ], v=>moeda(v)+'/h');

  gauge('g2', porPeca, [
    {de:0, ate:B.peca.lo, rot:'abaixo', cor:'#ff6b6b'},
    {de:B.peca.lo, ate:B.peca.med, rot:'baixo', cor:'#5aa9ff'},
    {de:B.peca.med, ate:B.peca.hi, rot:'mediano', cor:'#3ecf8e'},
    {de:B.peca.hi, ate:B.peca.hi*1.9, rot:'alto', cor:'#ff9f2e'}
  ], v=>eur(v));

  /* ---- rateio por mesa ---- */
  /* cada mesa mostra só a parte de impressão: material, máquina, base, preparação e margem final.
     Modelação, acabamento manual, portes, descontos globais e arredondamentos não entram aqui. */
  const margem=x.margemFinal||0, basePeca=x.basePeca||0, baseMesa=x.baseMesa||0;
  const mesasP=x.det.map(m=>{
    const matC=m.cm*(x.fMatMesa||1)*(1+num('s_mmat')/100);
    const maqC=(m.hReal||0)*(m.rate??x.taxaCobrada??taxa);
    const baseC=basePeca*(m.pecas||0)+baseMesa;
    const prepC=x.pPrepMesa||0;
    const margC=(matC+maqC+baseC)*margem;
    const preco=matC+maqC+baseC+prepC+margC;
    return {...m, preco, matC, maqC, baseC, prepC, margC,
      eurH: m.hReal>0 ? maqC/m.hReal : 0};
  });
  const somaMesas=mesasP.reduce((a,m)=>a+m.preco,0);
  const porMesa=x.nMesas? somaMesas/x.nMesas : 0;
  const horasMedias=x.hTot/Math.max(x.nMesas,1);
  const matMedio=mesasP.reduce((a,m)=>a+m.matC,0)/Math.max(x.nMesas,1);
  const baseMedio=mesasP.reduce((a,m)=>a+m.baseC,0)/Math.max(x.nMesas,1);
  const prepMedio=mesasP.reduce((a,m)=>a+m.prepC,0)/Math.max(x.nMesas,1);

  /* a banda por mesa é derivada, não inventada: é a banda horária aplicada
     à duração média destas mesas, mais o material e a preparação dessa mesa */
  const mesaBanda=r=>{
    const bruto=matMedio + baseMedio + horasMedias*r;
    return bruto*(1+margem) + prepMedio;
  };
  el('g3v').textContent=eur(porMesa);
  gauge('g3', porMesa, [
    {de:0, ate:mesaBanda(B.bandas[0].lo), rot:'abaixo', cor:'#ff6b6b'},
    {de:mesaBanda(B.bandas[0].lo), ate:mesaBanda(B.bandas[0].hi), rot:'hobby', cor:'#5aa9ff'},
    {de:mesaBanda(B.bandas[0].hi), ate:mesaBanda(B.bandas[1].lo), rot:'', cor:'#2a323e'},
    {de:mesaBanda(B.bandas[1].lo), ate:mesaBanda(B.bandas[1].hi), rot:'vendedor', cor:'#3ecf8e'},
    {de:mesaBanda(B.bandas[1].hi), ate:mesaBanda(B.bandas[2].lo), rot:'', cor:'#2a323e'},
    {de:mesaBanda(B.bandas[2].lo), ate:mesaBanda(B.bandas[2].hi), rot:'pro', cor:'#8b6bff'},
    {de:mesaBanda(B.bandas[2].hi), ate:mesaBanda(B.bandas[2].hi*1.25), rot:'premium', cor:'#ff9f2e'}
  ], v=>eur(v));

  const tb=el('rateio'); tb.innerHTML='';
  mesasP.forEach(m=>{
    const cor=m.eurH>=B.bandas[1].lo?'var(--good)':m.eurH>=B.bandas[0].lo?'var(--blue)':'var(--bad)';
    tb.insertAdjacentHTML('beforeend',
      `<tr><td>${m.i}</td><td style="color:var(--dim)">${m.imp?m.imp.n:'—'}</td>
       <td>${Math.round(m.g)} g</td><td>${hm(m.t)}</td>
       <td>${eur(m.matC)}</td><td>${eur(m.preco)}</td>
      <td style="color:${cor}">${m.hReal>0?moeda(m.eurH)+'/h':'—'}</td></tr>`);
  });

  /* densidade: quanto a preparação fixa pesa por peça */
  const pecasPorMesa=pecas/Math.max(x.nMesas,1);
  const prepPorPeca=x.pPrepMesa/Math.max(pecasPorMesa,0.0001);
  el('d_mesa_eff').innerHTML=
    `<div><span>${x.nMesas} mesa(s) · ${pecasPorMesa.toFixed(1)} peça(s) por mesa</span><b>${eur(porMesa)} por mesa</b></div>
     <div><span>Preço por mesa conta só impressão</span><b>sem modelação nem portes</b></div>
     <div><span>Preparação fixa diluída em cada peça</span><b>${eur(prepPorPeca)}</b></div>
     ${x.pPrepMesa<=0?'<div class="sep"><span style="color:var(--accent2)">Não estás a cobrar preparação por mesa. Define os minutos em Definições → O que cobras: é o trabalho fixo de cada impressão, independente de quantas peças lá caibam.</span><b></b></div>':''}
     <div class="sep"><span>${pecasPorMesa<2
        ? 'Mesas pouco cheias — a preparação fixa está a ser paga por poucas peças. Juntar encomendas na mesma mesa baixa o custo por peça sem baixar o teu ganho.'
        : `Se duplicasses as peças por mesa, a preparação por peça caía para ${eur(prepPorPeca/2)}.`}</span><b></b></div>`;

  /* escolha de patamar + alvo */
  el('bands').innerHTML=B.bandas.map(b=>
    `<button data-b="${b.id}" class="${bandaEscolhida===b.id?'on':''}">${b.nome}
      <small>${moeda(b.lo)}–${moeda(b.hi)}/h · ${b.desc}</small></button>`).join('');
  [...el('bands').children].forEach(b=>b.addEventListener('click',()=>{ bandaEscolhida=b.dataset.b; calc(); }));

  const alvoB=B.bandas.find(b=>b.id===bandaEscolhida);
  const A=(alvoB.lo+alvoB.hi)/2;

  /* alvo do painel de mercado: só impressão. O botão continua a mexer na hora de
     máquina cobrada, que é a alavanca que posiciona trabalhos longos. */
  const alvoPrint=r=>(x.pMat+horas*r+x.pBase)*(1+margem)+(x.pPrep||0);
  if(horas>0 && 1+margem>0){
    ALVO_HORA=A;
    ALVO=alvoPrint(ALVO_HORA);
    if(ALVO<B.minimo[0]){
      ALVO_HORA=Math.max(0,((B.minimo[0]-(x.pPrep||0))/(1+margem)-x.pMat-x.pBase)/horas);
      ALVO=alvoPrint(ALVO_HORA);
    }
  } else { ALVO_HORA=A; ALVO=Math.max(B.minimo[0], printTotal); }
  const tol=el('j_round').checked?0.55:0.05;   /* o arredondamento aos 0,50 pode limar um degrau */

  const dif=ALVO-printTotal, pct=printTotal? dif/printTotal*100 : 0;
  el('t_val').textContent=eur(ALVO);
  el('t_txt').innerHTML = Math.abs(dif)<tol
    ? `Estás dentro do patamar <b style="color:var(--good)">${alvoB.nome}</b>. Nada a mudar.`
    : `A ${moeda(ALVO_HORA)}/h de máquina — o meio do patamar <b>${alvoB.nome}</b>.
       ${dif>0?`<span style="color:var(--accent2)">${eur(dif)} acima</span>`:`<span style="color:var(--good)">${eur(-dif)} abaixo</span>`}
       do teu preço de impressão (${pct>0?'+':''}${pct.toFixed(0)}%).
       ${horas>0?'Aplicar define a hora de máquina cobrada.':'Aplicar ajusta a margem final.'}`;
  el("t_btn").style.display=Math.abs(dif)<tol?"none":"block";

  /* concorrentes */
  const cs=['c1','c2','c3','c4'].map(i=>parseFloat(el(i).value)).filter(v=>isFinite(v)&&v>0).sort((a,b)=>a-b);
  if(cs.length){
    const med=cs.length%2?cs[(cs.length-1)/2]:(cs[cs.length/2-1]+cs[cs.length/2])/2;
    const pos=x.total<cs[0]?'o mais barato de todos':x.total>cs[cs.length-1]?'o mais caro de todos'
      :x.total<med?'abaixo da mediana':'acima da mediana';
    el('d_conc').innerHTML=
      `<div><span>${cs.length} orçamento(s) · mín · mediana · máx</span><b>${eur(cs[0])} · ${eur(med)} · ${eur(cs[cs.length-1])}</b></div>
       <div class="sep"><span>O teu preço (${eur(x.total)}) é</span><b>${pos}</b></div>
       <div><span>Para igualar a mediana</span><b>${med>x.total?'+':''}${eur(med-x.total)}</b></div>`;
  } else el('d_conc').innerHTML='<div><span>Cola pelo menos um orçamento de concorrente.</span></div>';

  /* histórico */
  renderHist(taxa);

  el('src').innerHTML=
    `Benchmark recolhido em agosto de 2026, corrigido em <b>+${((B.f-1)*100).toFixed(1)}%</b> pela inflação prevista
     (Banco de Portugal: 3,1% em 2026, 2,3% em 2027).
     Taxas horárias de máquina e mão de obra: <a href="https://layermath.com/blog/3d-printing-hourly-rate" target="_blank">LayerMath, jun 2026</a>.
    Referência de preço por peça: <a href="https://www.zaask.pt/quanto-custa/impressao-3d" target="_blank">Zaask</a> (faixa de referência R$ 15–80, mediana R$ 35).
     Encomenda mínima de referência: ${eur(B.minimo[0])}–${eur(B.minimo[1])}.`;
}

let ALVO=0, ALVO_HORA=0, LAST={};
function aplicarAlvo(){
  /* sem uma conta feita não há alvo nenhum: sem isto, um clique antes do
     primeiro calc() escrevia NaN no campo e limpava-o. */
  if(!isFinite(ALVO)||ALVO<=0) return;
  /* a alavanca certa é a hora de máquina, não a margem final:
     é o tempo de impressora que os trabalhos longos consomem. */
  if(LAST.hTot>0){
    el('s_taxa_maq').value=Math.round(ALVO_HORA*100)/100;
  } else {
    const base=LAST.pMat+LAST.pImp+LAST.pBase;
    if(!isFinite(base)||base<=0) return;
    const marg=Math.round(((ALVO-(LAST.pPrep||0)-base)/base)*1000)/10;
    if(!isFinite(marg)) return;
    el('s_margem').value=marg;
  }
  calc();
  /* escrever .value por JS não dispara o 'input', e é aí que está pendurado o
     guardaEstado(): sem esta chamada o patamar aplicado perdia-se ao recarregar */
  guardaEstado();
}

/* cliente e projeto são campos separados; a etiqueta do trabalho é a junção
   formatada — "Projeto — Cliente", ou só o que estiver preenchido */
function nomeTrabalho(){
  const c=(el('j_cliente').value||'').trim(), p=(el('j_projeto').value||'').trim();
  return c&&p ? p+' — '+c : (c||p||'');
}


/* ============ histórico ============ */
let hist=[];
function registarHist(){
  hist.unshift({d:new Date().toISOString().slice(0,10), c:nomeTrabalho()||'—',
    t:LAST.total, h:LAST.taxa, e:parseInt(el('h_estado').value)});
  calc();
}
function limparHist(){ if(confirm('Apagar todo o histórico?')){ hist=[]; calc(); } }
function renderHist(taxaAtual){
  const tb=el('h_body'); tb.innerHTML='';
  hist.slice(0,12).forEach((r,i)=>{
    const linha=document.createElement('tr');
    const lbl={1:['Aceite','ok'],0:['Recusado','no'],2:['Pendente','']}[r.e];
    linha.innerHTML=`<td>${r.d}</td><td>${r.c}</td><td>${eur(r.t)}</td>
      <td>${(r.h||0).toFixed(2).replace('.',',')}</td><td class="${lbl[1]}">${lbl[0]}</td>`;
    const td=document.createElement('td'), b=document.createElement('button');
    b.className='del'; b.textContent='×';
    b.addEventListener('click',()=>{ hist.splice(i,1); calc(); });
    td.appendChild(b); linha.appendChild(td); tb.appendChild(linha);
  });
  const ok=hist.filter(r=>r.e===1).map(r=>r.h).filter(v=>isFinite(v)).sort((a,b)=>a-b);
  const no=hist.filter(r=>r.e===0).map(r=>r.h).filter(v=>isFinite(v)).sort((a,b)=>a-b);
  if(!hist.length){ el('d_hist').innerHTML='<div><span>Sem registos. Regista os orçamentos e a app aprende a tua banda de preço aceite.</span></div>'; return; }
  const tx=v=>moeda(v)+'/h';
  let h=`<div><span>${hist.length} registo(s) · ${ok.length} aceite(s) · ${no.length} recusado(s)</span><b>${hist.length?Math.round(ok.length/Math.max(ok.length+no.length,1)*100):0} % de sucesso</b></div>`;
  if(ok.length) h+=`<div class="sep"><span>Banda aceite (R$/h de máquina)</span><b>${tx(ok[0])} – ${tx(ok[ok.length-1])}</b></div>`;
  if(no.length) h+=`<div><span>Recusas começam em</span><b>${tx(no[0])}</b></div>`;
  if(ok.length&&isFinite(taxaAtual)){
    const dentro=taxaAtual>=ok[0]&&taxaAtual<=ok[ok.length-1];
    h+=`<div><span>Este orçamento</span><b style="color:${dentro?'var(--good)':'var(--accent2)'}">${dentro?'dentro da tua banda aceite':'fora da banda aceite'}</b></div>`;
  }
  el('d_hist').innerHTML=h;
}


/* ============ retificação ============ */
let ultimoDesvio={mat:null,t:null};
function renderRetif(x){
  const linhas=[]; let alerta=false;
  ultimoDesvio={mat:null,t:null};
  const d=(real,est)=>est>0?((real-est)/est*100):null;

  const dG=(isFinite(x.rG)&&x.rG>0)?d(x.rG,x.gEst):null;
  const dT=(x.rT>0)?d(x.rT,x.mEst):null;
  const dE=(isFinite(x.rE)&&x.rE>0)?d(x.rE*1,x.cEst):null;

  const fmt=v=>{
    const c=Math.abs(v)>10?'var(--bad)':Math.abs(v)>3?'var(--accent2)':'var(--good)';
    return `<b style="color:${c}">${v>0?'+':''}${v.toFixed(1)} %</b>`;
  };
  if(dG!==null){ linhas.push(`<div><span>Peso · ${Math.round(x.gEst)} g → ${x.rG} g</span>${fmt(dG)}</div>`); if(Math.abs(dG)>5)alerta=true; }
  if(dT!==null){ linhas.push(`<div><span>Tempo · ${hm(x.mEst)} → ${hm(x.rT)}</span>${fmt(dT)}</div>`); if(Math.abs(dT)>5)alerta=true; }
  if(dE!==null){ linhas.push(`<div><span>Custo · ${eur(x.cEst)} → ${eur(x.rE)}</span>${fmt(dE)}</div>`); if(Math.abs(dE)>5)alerta=true; }

  el('d_retif').innerHTML = linhas.length
    ? linhas.join('')+(alerta?`<div class="sep" style="color:var(--accent2)"><span>Discrepância significativa — vale a pena retificar.</span></div>`:'')
    : `<div><span>Preenche o que souberes depois da impressão. Só os campos preenchidos substituem a estimativa.</span></div>`;

  ultimoDesvio.mat = (dE!==null?dE:dG);
  ultimoDesvio.t   = dT;
  el('btn_aprender').style.display = (alerta&&(ultimoDesvio.mat!==null||ultimoDesvio.t!==null))?'block':'none';
  el('btn_aprender').textContent = 'Aplicar este desvio a futuras estimativas'
    + (ultimoDesvio.mat!==null?` (material ${ultimoDesvio.mat>0?'+':''}${ultimoDesvio.mat.toFixed(1)}%)`:'');
}
function aprenderDesvio(){
  /* média entre o desvio já guardado e o novo — suaviza em vez de saltar */
  if(ultimoDesvio.mat!==null) el('s_dev_mat').value=((num('s_dev_mat')+ultimoDesvio.mat)/2).toFixed(1);
  if(ultimoDesvio.t!==null)   el('s_dev_t').value  =((num('s_dev_t')+ultimoDesvio.t)/2).toFixed(1);
  el('r_usar').checked=false;
  calc();
}
