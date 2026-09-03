/* Filametria — Constantes, utilitários, dados de referência e definições */
/* ============ armazenamento local ============ */
const VERSAO='1.15.0';
const store={
  get(k,d){ try{ const v=localStorage.getItem('filametria:'+k); return v?JSON.parse(v):d; }catch(_){ return d; } },
  set(k,v){ try{ localStorage.setItem('filametria:'+k,JSON.stringify(v)); return true; }catch(_){ return false; } },
  del(k){ try{ localStorage.removeItem('filametria:'+k); }catch(_){} }
};

function parseT(v){
  v=(v||'').toString().trim().toLowerCase().replace(',','.');
  if(!v) return 0;
  let m=v.match(/^(\d+(?:\.\d+)?)\s*[h:]\s*(\d+)?\s*m?$/);
  if(m) return parseFloat(m[1])*60+(parseFloat(m[2])||0);
  return parseFloat(v)||0;
}
const hm = min => Math.floor(min/60)+'h'+String(Math.round(min%60)).padStart(2,'0')+'m';

function cell(val,attrs,cls){
  const td=document.createElement('td'), inp=document.createElement('input');
  Object.assign(inp,attrs); if(cls) inp.className=cls; inp.value=val;
  td.appendChild(inp); return [td,inp];
}

/* ============ valores iniciais ============ */
const DEF = {
  data:'2026-08-11', fil_nome:'PLA+ Reprap',
  kwh:0.2377, kwh_add:0.078, iva:23, auto_kwh:false,
  tax_rate:0, tax_on:true, tax_nome:'Imposto', tax_preset:'BR_CUSTOM',
  fil_kg:17.56, fil_portes:3.50, desp:1.25, mmat:3.50, modh:35,
  imp_preco:250, imp_vida:5000, imp_kw:0.12, pc_kw:0.08, pc_kw2:0.15,
  fer_preco:200, fer_vida:7500, fer_kw:0.10, tinta_l:30, tinta_ml:1,
  emb_peso:150, emb_custo:0.50, prep_min:0, base_mesa:0,
  base:1, taxa_maq:0, mao:25, polh:30, pinth:35, tiers:'3:5, 10:10, 15:15',
  mmat:3.50, mimp:0, mmao:0, margem:10, mmin:20,
  dev_mat:0, dev_t:0,
  portes:[[250,0],[500,0],[1000,0],[2000,0],[5000,0]]
};
const S_NUM = ['data','fil_nome','kwh','kwh_add','iva','tax_rate','fil_kg','fil_portes','desp','mmat',
  'imp_preco','imp_vida','imp_kw','pc_kw','pc_kw2','fer_preco','fer_vida','fer_kw',
  'tinta_l','tinta_ml','emb_peso','emb_custo','prep_min','base','base_mesa','taxa_maq','mao','polh','pinth','modh','tiers',
  'mimp','mmao','margem','mmin','dev_mat','dev_t'];

const MOEDA_LOCALE='pt-BR';
const MOEDA_CODIGO='BRL';
const moeda = n => (isFinite(n)?n:0).toLocaleString(MOEDA_LOCALE,{style:'currency',currency:MOEDA_CODIGO});
const eur = moeda;
const num = id => parseFloat(document.getElementById(id).value)||0;
const el  = id => document.getElementById(id);
const pct = n => (isFinite(n)?n:0).toLocaleString(MOEDA_LOCALE,{maximumFractionDigits:2});
const htmlEsc = s => String(s||'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
const TAX_PRESETS=[
  {id:'PT_23', label:{pt:'Portugal — IVA 23%', en:'Portugal — VAT 23%'}, nome:'IVA', rate:23},
  {id:'PT_13', label:{pt:'Portugal — IVA reduzido 13%', en:'Portugal — reduced VAT 13%'}, nome:'IVA', rate:13},
  {id:'PT_6',  label:{pt:'Portugal — IVA reduzido 6%', en:'Portugal — reduced VAT 6%'}, nome:'IVA', rate:6},
  {id:'ES_21', label:{pt:'Espanha — IVA 21%', en:'Spain — VAT 21%'}, nome:'IVA', rate:21},
  {id:'FR_20', label:{pt:'França — TVA 20%', en:'France — TVA 20%'}, nome:'TVA', rate:20},
  {id:'DE_19', label:{pt:'Alemanha — MwSt. 19%', en:'Germany — MwSt. 19%'}, nome:'MwSt.', rate:19},
  {id:'IT_22', label:{pt:'Itália — IVA 22%', en:'Italy — VAT 22%'}, nome:'IVA', rate:22},
  {id:'NL_21', label:{pt:'Países Baixos — btw 21%', en:'Netherlands — btw 21%'}, nome:'btw', rate:21},
  {id:'UK_20', label:{pt:'Reino Unido — VAT 20%', en:'United Kingdom — VAT 20%'}, nome:'VAT', rate:20},
  {id:'BR_CUSTOM', label:{pt:'Brasil — personalizado', en:'Brazil — custom'}, nome:'Imposto', rate:0, custom:true}
];
function taxPreset(id){ return TAX_PRESETS.find(p=>p.id===id)||TAX_PRESETS[0]; }
function taxPresetLabel(p){
  const l=p.label;
  return typeof l==='object' ? (l[IDIOMA]||l.pt) : l;
}
function drawTaxPresets(){
  const sel=el('s_tax_preset'); if(!sel) return;
  const current=sel.value||DEF.tax_preset;
  sel.innerHTML=TAX_PRESETS.map(p=>`<option value="${p.id}">${taxPresetLabel(p)}</option>`).join('');
  sel.value=TAX_PRESETS.some(p=>p.id===current)?current:'CUSTOM';
  updateTaxFieldState();
}
function updateTaxFieldState(){
  const sel=el('s_tax_preset'); if(!sel) return;
  const custom=sel.value==='CUSTOM';
  el('s_tax_nome').disabled=!custom;
  el('s_tax_rate').disabled=!custom;
  /* escolher onde cai o arredondamento só faz sentido com o imposto por cima:
     no modo incluído o teu preço e o total do cliente são o mesmo número */
  const linha=el('rowTaxArred');
  if(linha) linha.style.display = el('s_tax_modo').value==='acrescentado' ? '' : 'none';
}
function aplicarTaxPreset(){
  const p=taxPreset(el('s_tax_preset').value);
  if(!p.custom){
    el('s_tax_nome').value=p.nome;
    el('s_tax_rate').value=p.rate;
  }
  updateTaxFieldState();
  calc(); guardaEstado();
}
function marcarTaxCustom(){
  const sel=el('s_tax_preset');
  if(sel && sel.value!=='CUSTOM') sel.value='CUSTOM';
  updateTaxFieldState();
}
/* Duas maneiras de o imposto entrar no preço:
   incluído     — o total calculado é o que o cliente paga e o imposto sai de dentro dele,
                  por isso come da tua receita (o imposto vem antes do teu lucro);
   acrescentado — o total calculado é o teu preço limpo e o imposto vai por cima,
                  por isso a tua receita não muda e é o cliente que o paga. */
function impostoFaturacao(total){
  const on=el('s_tax_on') ? el('s_tax_on').checked : false;
  const rate=Math.max(0,num('s_tax_rate'));
  const nome=((el('s_tax_nome')&&el('s_tax_nome').value)||tr('taxGeneric')).trim()||tr('taxGeneric');
  const inc=!(el('s_tax_modo') && el('s_tax_modo').value==='acrescentado');
  const active=on&&rate>0;
  const base=active&&inc ? total/(1+rate/100) : total;
  const valor=active ? (inc ? total-base : total*rate/100) : 0;
  return {on,active,inc,nome,rate,base,valor,total:base+valor};
}
/* com o imposto acrescentado, as rubricas já estão sem imposto e não há nada a tirar */
function semImposto(v,tax){
  return tax&&tax.active&&tax.inc!==false ? v/(1+tax.rate/100) : v;
}


/* ============ IMPRESSORAS ============
   Preços de referência de retalho na UE, agosto de 2026, IVA incluído.
   kW = consumo médio em impressão (não o pico). Vida útil = horas antes de manutenção pesada.
   Os valores são um ponto de partida — todos os campos ficam editáveis. */
const PRINTERS=[
  {g:'FDM — entrada', l:[
    {n:'Elegoo Centauri Carbon',      p:299,  kw:0.15, h:4000},
    {n:'Creality Ender 3 / V2 / S1',  p:199,  kw:0.12, h:4000},
    {n:'Elegoo Neptune 4 Pro',        p:259,  kw:0.13, h:4000},
    {n:'Bambu Lab A1 mini',           p:249,  kw:0.10, h:4000},
    {n:'Bambu Lab A1',                p:359,  kw:0.13, h:4000}
  ]},
  {g:'FDM — fechadas / CoreXY', l:[
    {n:'Qidi Plus 4',                 p:699,  kw:0.30, h:5000},
    {n:'Qidi Q1 Pro',                 p:449,  kw:0.25, h:5000},
    {n:'Creality K1C',                p:449,  kw:0.20, h:4000},
    {n:'Bambu Lab P1S',               p:599,  kw:0.15, h:5000},
    {n:'Creality K2 Plus',            p:999,  kw:0.22, h:5000},
    {n:'Bambu Lab X1 Carbon',         p:1199, kw:0.18, h:5000},
    {n:'Prusa MK4S',                  p:999,  kw:0.12, h:6000},
    {n:'Prusa CORE One',              p:1199, kw:0.15, h:6000}
  ]},
  {g:'Resina (LCD)', l:[
    {n:'Anycubic Photon Mono 4 (resina)', p:239, kw:0.05, h:2000},
    {n:'Elegoo Mars 5 Ultra',         p:249,  kw:0.05, h:2000},
    {n:'Anycubic Photon Mono M7',     p:329,  kw:0.06, h:2000},
    {n:'Elegoo Saturn 4 Ultra',       p:399,  kw:0.07, h:2000}
  ]}
];

/* ============ TRANSPORTADORAS ============
  Preços de referência. Escalões: [peso máx em g, preço em R$].
   CTT: tarifário de particulares em vigor desde 2 de fevereiro de 2026.
   InPost: tabela pública de Locker / Ponto Pack. */
const TRANSP={
  atualizado:'2026-08-11',
  grupos:[
    {g:'Portugal continental', s:[
      {id:'ctt_reg', n:'CTT Correio Registado', d:'pacote postal até 2 kg · ~1 dia útil · com assinatura',
       e:[[100,4.60],[500,5.40],[2000,8.93]]},
      {id:'ctt_t1', n:'CTT Encomenda Postal T1', d:'trajeto curto · ~3 dias · levantamento em loja',
       e:[[2000,8.25],[5000,10.50],[10000,15.55]]},
      {id:'ctt_t1d', n:'CTT Encomenda Postal T1 + domicílio', d:'trajeto curto · entrega na morada',
       e:[[2000,11.20],[5000,13.45],[10000,18.90]]},
      {id:'ctt_t2', n:'CTT Encomenda Postal T2', d:'trajeto longo · ~3 dias · levantamento em loja',
       e:[[2000,9.60],[5000,12.10],[10000,17.60]]},
      {id:'ctt_t2d', n:'CTT Encomenda Postal T2 + domicílio', d:'trajeto longo · entrega na morada',
       e:[[2000,12.55],[5000,15.05],[10000,20.95]]},
      {id:'inpost_pt', n:'InPost Locker / Ponto Pack', d:'~2 dias úteis · seguro R$ 25 incluído',
       e:[[500,4.76],[1000,5.42],[2000,5.89],[3000,6.46],[5000,7.08],[7000,7.27],[9000,8.18],
          [10000,9.65],[15000,12.01],[20000,19.69],[25000,31.27],[30000,34.27]]}
    ]},
    {g:'Ilhas (via aérea)', s:[
      {id:'ctt_mad', n:'CTT Continente ↔ Madeira', d:'~5 dias úteis',
       e:[[2000,11.80],[3000,16.15],[4000,17.15],[5000,17.85],[6000,23.50],[7000,26.40],[8000,28.40],[9000,29.25],[10000,29.90]]},
      {id:'ctt_aco', n:'CTT Continente ↔ Açores', d:'~7-15 dias úteis',
       e:[[2000,12.85],[3000,16.70],[4000,16.90],[5000,18.00],[6000,23.70],[7000,27.00],[8000,29.10],[9000,29.95],[10000,30.35]]}
    ]},
    {g:'Europa (InPost)', s:[
      {id:'ip_es', n:'InPost Espanha', d:'~4 dias úteis',
       e:[[500,5.12],[1000,5.81],[2000,6.64],[3000,7.57],[5000,9.04],[7000,12.03],[9000,12.83],[10000,17.59],[15000,22.04],[20000,26.59],[25000,36.55],[30000,39.55]]},
      {id:'ip_it', n:'InPost Itália', d:'~6 dias úteis',
       e:[[500,10.75],[1000,11.72],[2000,12.42],[3000,13.80],[5000,16.56],[7000,20.14],[9000,20.58],[10000,22.32],[15000,24.35],[20000,39.98],[25000,43.47]]},
      {id:'ip_fr', n:'InPost França', d:'~5 dias úteis',
       e:[[500,11.32],[1000,12.37],[2000,13.10],[3000,14.59],[5000,17.56],[7000,21.41],[9000,21.09],[10000,23.77],[15000,25.95],[20000,28.01],[25000,37.53],[30000,40.53]]},
      {id:'ip_be', n:'InPost Bélgica', d:'~5 dias úteis',
       e:[[500,12.54],[1000,13.58],[2000,14.33],[3000,15.81],[5000,18.77],[7000,22.60],[9000,23.08],[10000,24.95],[15000,32.25],[20000,36.36],[25000,39.31],[30000,42.31]]},
      {id:'ip_de', n:'InPost Alemanha', d:'~6 dias úteis · só Ponto Pack',
       e:[[500,12.63],[1000,12.63],[2000,13.23],[3000,13.84],[5000,14.45],[7000,27.20],[9000,30.12],[10000,33.03],[15000,41.32],[20000,47.13],[25000,58.74]]},
      {id:'ip_lu', n:'InPost Luxemburgo', d:'~6 dias úteis',
       e:[[500,13.27],[1000,14.32],[2000,15.06],[3000,16.54],[5000,19.51],[7000,23.31],[9000,23.79],[10000,25.66],[15000,32.37],[20000,36.47],[25000,39.42],[30000,42.42]]},
      {id:'ip_nl', n:'InPost Holanda', d:'~6 dias úteis',
       e:[[500,14.50],[1000,15.73],[2000,16.60],[3000,18.00],[5000,21.96],[7000,25.50],[9000,27.38],[10000,28.44],[15000,33.08],[20000,37.18],[25000,40.12],[30000,43.12]]},
      {id:'ip_pl', n:'InPost Polónia', d:'~6 dias úteis',
       e:[[500,14.85],[1000,15.77],[2000,16.25],[3000,18.05],[5000,24.11],[7000,27.56],[9000,27.22],[10000,27.45],[15000,35.09],[20000,38.39],[25000,45.65]]}
    ]}
  ]
};
const servicoPorId=id=>{ for(const g of TRANSP.grupos){ const s=g.s.find(x=>x.id===id); if(s) return s; } return null; };
function precoServico(s, gramas){
  const t=s.e.find(([max])=>gramas<=max);
  return t?t[1]:null;   /* null = acima do limite do serviço */
}

/* ============ BENCHMARK DE MERCADO ============
   Valores recolhidos em agosto de 2026. Envelhecem sozinhos pela inflação prevista
   (Banco de Portugal, Boletim Económico de junho de 2026). Fontes no rodapé do painel. */
const BENCH={
  recolha:'2026-08-01',
  inflacao:{2026:3.1, 2027:2.3}, inflDefault:2.0,
  bandas:[
    {id:'hobby', nome:'Hobby',        lo:0.75, hi:1.50, desc:'amigos, PLA simples'},
    {id:'seller',nome:'Vendedor',     lo:2.00, hi:4.00, desc:'Etsy, encomendas repetíveis'},
    {id:'pro',   nome:'Profissional', lo:5.00, hi:8.00, desc:'clientes, urgências'}
  ],
  minimo:[10,15],
  pecaPT:{lo:15, med:35, hi:80},
  pesquisas:[
    ['Impressão 3D Portugal','https://impressao3dportugal.pt/servico-de-impressao-3d/'],
    ['Mauser 3D','https://3d.mauser.pt/'],
    ['Atelier 3D','https://www.atelier3d.pt/'],
    ['3D Xpresso','https://3dxpresso.pt/'],
    ['Pesquisar mais','https://www.google.com/search?q=servi%C3%A7o+impress%C3%A3o+3D+or%C3%A7amento+online+portugal']
  ]
};
