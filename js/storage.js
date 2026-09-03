/* Filametria — Armazenamento local, presets, exportação/importação e memória remota */
/* ============ guardar / carregar ============ */
function collect(){
  const o={portes,mesas,hist,banda:bandaEscolhida,printer:el('s_printer').value,auto_kwh:el('s_auto_kwh').checked,
           tax_on:el('s_tax_on').checked,tax_preset:el('s_tax_preset').value,tax_nome:el('s_tax_nome').value,
           tax_modo:el('s_tax_modo').value,tax_arred:el('s_tax_arred').value};
  S_NUM.forEach(k=>o[k]=el('s_'+k).value);
  o.fils=FILS.map(f=>({...f}));
  o.portes_bob={...PORTES_BOB};
  /* Os do Bobina que ESTE orcamento usa, como estavam na ultima leitura. Um
     orcamento nao pode mudar de valor -- nem perder um filamento das mesas --
     so porque o Bobina esta em baixo ou porque se abriu noutra maquina. */
  o.bob_usados=nomesEmUso().filter(eBobina).map(n=>({...bobFil(n)}));
  o.modelos=MODELOS.map(m=>({...m}));
  /* as baixas andam com o orçamento: é o que evita repetir mesa já lançada,
     e é de onde sai o desfazer */
  o.baixas=BAIXAS; o.baixa_adiada=BAIXA_ADIADA;
  o.data_manual=DATA_MANUAL;
  o.marca={on:el('b_on').checked, qr:el('q_on').checked, nota_on:el('f_on').checked,
           logo:LOGO, qrs:QRS.map(q=>({...q}))};
  B_TXT.forEach(k=>o.marca[k]=el('b_'+k).value);
  return o;
}
function apply(o){
  /* os filamentos primeiro: o s_fil_nome é um select e precisa das opções antes do valor */
  PORTES_BOB=(o.portes_bob&&typeof o.portes_bob==='object')?{...o.portes_bob}:{};
  BOB_SNAP=Array.isArray(o.bob_usados)?o.bob_usados.filter(f=>f&&f.n):[];
  if(Array.isArray(o.fils)&&o.fils.length)
    FILS=o.fils.map(f=>({n:String(f.n||''), kg:+f.kg||0, portes:+f.portes||0})).filter(f=>f.n);
  else if(o.fil_nome && !filInfo(o.fil_nome))   /* estado de uma versão sem gestor de filamentos */
    FILS.push({n:String(o.fil_nome), kg:+o.fil_kg||0, portes:+o.fil_portes||0});
  drawFils(false);
  S_NUM.forEach(k=>{ if(o[k]!==undefined) el('s_'+k).value=o[k]; });
  if(!filInfo(el('s_fil_nome').value) && FILS.length) el('s_fil_nome').value=FILS[0].n;
  if(o.auto_kwh!==undefined){ el('s_auto_kwh').checked=!!o.auto_kwh; toggleAuto(); }
  if(o.tax_on!==undefined) el('s_tax_on').checked=!!o.tax_on;
  if(o.tax_preset!==undefined) el('s_tax_preset').value=o.tax_preset;
  if(o.tax_modo!==undefined) el('s_tax_modo').value=o.tax_modo;
  if(o.tax_arred!==undefined) el('s_tax_arred').value=o.tax_arred;
  if(Array.isArray(o.modelos)){ MODELOS=o.modelos.map(normModelo); drawModelos(); }
  BAIXAS=Array.isArray(o.baixas)
    ? o.baixas.filter(b=>b&&b.chave&&Array.isArray(b.consumos))
    : ((o.baixa&&o.baixa.chave&&Array.isArray(o.baixa.consumos))?[{...o.baixa, mesa:0}]:[]);
  BAIXA_ADIADA=!!o.baixa_adiada;
  if(o.data_manual!==undefined) DATA_MANUAL=!!o.data_manual;
  aplicaDataPrecos(false);   /* a meio do apply() ainda não há estado para gravar */
  if(o.tax_nome!==undefined) el('s_tax_nome').value=o.tax_nome;
  updateTaxFieldState();
  if(o.portes){ portes=o.portes; drawPortes(); drawPortesSel(); }
  if(o.mesas){ mesas=o.mesas.map(normMesa); migraPecas(o); drawMesas(); }
  if(o.hist) hist=o.hist;
  if(o.banda) bandaEscolhida=o.banda;
  if(o.printer!==undefined) el('s_printer').value=o.printer;
  if(o.marca){
    B_TXT.forEach(k=>{ if(o.marca[k]!==undefined) el('b_'+k).value=o.marca[k]; });
    el('b_on').checked=!!o.marca.on;
    el('q_on').checked=!!o.marca.qr;
    if(o.marca.nota_on!==undefined) el('f_on').checked=!!o.marca.nota_on;
    LOGO=o.marca.logo||'';
    if(Array.isArray(o.marca.qrs)) QRS=o.marca.qrs.map(q=>({t:q.t||'',u:q.u||'',img:q.img||''}));
    drawLogo(); drawQRs(); aplicaMarca();
  }
}
function exportSettings(){
  const b=new Blob([JSON.stringify(collect(),null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b); a.download='definicoes-impressao3d.json'; a.click();
}
function importSettings(e){
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{ apply(JSON.parse(r.result)); calc(); guardaEstado(); }catch(_){ alert(tr('invalidFile')); } };
  r.readAsText(f); e.target.value='';
}
function resetJob(){
  el('j_cliente').value=''; el('j_projeto').value=''; el('j_pecas').value=1;
  BLOCOS={mod:true, imp:true, pos:true}; aplicaBlocos();
  mesas=[[0,'','',el('s_printer').value||'',true,[],1,[]]]; drawMesas();
  MODELOS=[]; drawModelos();
  ['j_manual','j_pol','j_pint','j_desc','j_promo'].forEach(i=>el(i).value=0);
  ['r_g','r_t','r_e'].forEach(i=>el(i).value=''); el('r_usar').checked=true;
  BAIXAS=[]; BAIXA_ADIADA=false;   /* trabalho novo, baixas novas */
  el('j_portes').value='0'; calc(); guardaEstado();
}


function estado(){
  const o=collect();
  o.favs=favs; o.custom=custom; o.simples=SIMPLES; o.fechados=[...FECHADOS]; o.idioma=IDIOMA;
  o.blocos={...BLOCOS};
  o.preset=el('p_sel').value;
  ['j_cliente','j_projeto','j_pecas','j_manual','j_pol','j_pint','j_desc','j_promo','j_portes','j_portes_man',
   'r_g','r_t','r_e'].forEach(i=>o[i]=el(i).value);
  ['j_ajusta','j_round','r_usar','j_mostrar_maq','j_mostrar_mod'].forEach(i=>o[i]=el(i).checked);
  return o;
}
function repor(o){
  if(o.idioma && I18N[o.idioma]) IDIOMA=o.idioma;
  apply(o);
  if(o.favs) favs=o.favs;
  if(o.custom) custom=o.custom;
  drawPrinters(); if(o.printer!==undefined) el('s_printer').value=o.printer;
  ['j_cliente','j_projeto','j_pecas','j_manual','j_pol','j_pint','j_desc','j_promo','j_portes','j_portes_man',
   'r_g','r_t','r_e'].forEach(i=>{ if(o[i]!==undefined) el(i).value=o[i]; });
  ['j_ajusta','j_round','r_usar','j_mostrar_maq','j_mostrar_mod'].forEach(i=>{ if(o[i]!==undefined) el(i).checked=o[i]; });
  /* estados guardados antes da 1.8.0 traziam "Projeto — Cliente" num campo só */
  if(o.j_projeto===undefined && (o.j_cliente||'').includes(' — ')){
    const [proj,...resto]=o.j_cliente.split(' — ');
    el('j_projeto').value=proj.trim(); el('j_cliente').value=resto.join(' — ').trim();
  }
  if(o.fechados){ FECHADOS=new Set(o.fechados); aplicaFechados(); }
  if(o.simples!==undefined){ SIMPLES=o.simples; aplicaSimples(); }
  if(o.blocos) BLOCOS={mod:true,imp:true,pos:true,...o.blocos};
  aplicaBlocos();
  calc();
  aplicarIdioma();
  /* depois do aplicarIdioma, que redesenha a lista de presets */
  if(o.preset && presets()[o.preset]) el('p_sel').value=o.preset;
}
let guardaT;
function guardaEstado(){
  clearTimeout(guardaT);
  guardaT=setTimeout(()=>{
    store.set('ultimo',estado());
    agendarMemoriaRemota();
  },400);
}


/* ---- memória remota por utilizador ---- */
const MEM={user:null,updated_at:null,online:false};
let memT;
function pacoteMemoria(){
  return {
    versao:VERSAO,
    idioma:IDIOMA,
    ultimo:estado(),
    presets:presets(),
  };
}
function estadoMemoria(msg){
  const b=el('b_memoria'), label=el('mem_user_label'), st=el('mem_status');
  if(b){
    b.textContent=MEM.user?tr('bMemoriaUser',{user:MEM.user}):tr('bMemoria');
    b.classList.toggle('memuser',!!MEM.user);
  }
  if(label) label.textContent=MEM.user?tr('memSession',{user:MEM.user}):tr('memLocal');
  if(st && msg) st.textContent=msg;
}
function mostrarMemoria(on=1){
  el('mem').style.display=on?'flex':'none';
  estadoMemoria();
}
async function apiMemoria(path,opt={}){
  const headers=Object.assign({'Content-Type':'application/json'},opt.headers||{});
  const r=await fetch('/api/'+path,Object.assign({credentials:'same-origin',headers},opt));
  const data=await r.json().catch(()=>({ok:false,error:'Resposta inválida'}));
  if(!r.ok || data.ok===false) throw new Error(data.error||('Erro '+r.status));
  return data;
}
function aplicarMemoriaRemota(payload){
  if(!payload) return false;
  if(payload.presets) store.set('presets',payload.presets);
  if(payload.idioma && I18N[payload.idioma]){ IDIOMA=payload.idioma; store.set('idioma',IDIOMA); }
  drawPresets();
  if(payload.ultimo) repor(payload.ultimo);
  return true;
}
async function iniciarMemoriaRemota(){
  try{
    const data=await apiMemoria('auth/me',{method:'GET'});
    MEM.online=true;
    MEM.user=data.user?data.user.username:null;
    estadoMemoria(MEM.user?tr('memRemoteOn'):tr('memServerAvailable'));
    if(MEM.user) await carregarMemoriaRemota(true);
  }catch(_){
    MEM.online=false;
    estadoMemoria(tr('memLocalOnly'));
  }
}
async function entrarMemoria(){
  const username=el('mem_user').value.trim(), password=el('mem_pass').value;
  if(!username||!password) return estadoMemoria(tr('memFill'));
  try{
    const data=await apiMemoria('auth/login',{method:'POST',body:JSON.stringify({username,password})});
    MEM.user=data.user.username; el('mem_pass').value='';
    const carregou=await carregarMemoriaRemota(true);
    if(!carregou) await guardarMemoriaRemota(false);
    estadoMemoria(tr('memSessionStarted',{user:MEM.user}));
  }catch(e){ estadoMemoria(e.message); }
}
async function criarMemoria(){
  const username=el('mem_user').value.trim(), password=el('mem_pass').value;
  if(!username||!password) return estadoMemoria(tr('memFill'));
  try{
    const data=await apiMemoria('auth/register',{method:'POST',body:JSON.stringify({username,password})});
    MEM.user=data.user.username; el('mem_pass').value='';
    await guardarMemoriaRemota(false);
    estadoMemoria(tr('memUserCreated',{user:MEM.user}));
  }catch(e){ estadoMemoria(e.message); }
}
async function sairMemoria(){
  try{ await apiMemoria('auth/logout',{method:'POST',body:'{}'}); }catch(_){}
  MEM.user=null; MEM.updated_at=null; estadoMemoria(tr('memSessionEnded'));
}
async function carregarMemoriaRemota(silencioso){
  if(!MEM.user){ if(!silencioso) estadoMemoria(tr('memLoginLoad')); return false; }
  try{
    const data=await apiMemoria('state',{method:'GET'});
    MEM.updated_at=data.updated_at||null;
    const ok=aplicarMemoriaRemota(data.state);
    estadoMemoria(ok?tr('memLoaded',{user:MEM.user}):tr('memEmpty',{user:MEM.user}));
    return ok;
  }catch(e){ if(!silencioso) estadoMemoria(e.message); return false; }
}
function agendarMemoriaRemota(){
  if(!MEM.user) return;
  clearTimeout(memT);
  memT=setTimeout(()=>guardarMemoriaRemota(false),1600);
}
async function guardarMemoriaRemota(manual){
  if(!MEM.user){
    if(manual) estadoMemoria(tr('memLoginSave'));
    return false;
  }
  try{
    const data=await apiMemoria('state',{method:'PUT',body:JSON.stringify({state:pacoteMemoria()})});
    MEM.updated_at=data.updated_at;
    estadoMemoria(manual?tr('memSavedNow'):tr('memSavedAuto'));
    return true;
  }catch(e){ if(manual) estadoMemoria(e.message); return false; }
}


/* ---- presets ---- */
function presets(){ return store.get('presets',{}); }
/* redesenhar a lista não pode perder a escolha: isto corre também ao mudar de idioma
   e no fim de cada repor(), e sem o keep o preset carregado desaparecia do dropdown
   — o que deixava o 🗑 sem nada para apagar */
function drawPresets(){
  const s=el('p_sel'), keep=s.value, ks=Object.keys(presets()).sort();
  s.innerHTML='<option value="">'+tr('presetsEmpty')+'</option>'
    +ks.map(k=>`<option>${htmlEsc(k)}</option>`).join('');
  s.value=ks.includes(keep)?keep:'';
}
function guardarPreset(){
  const n=(prompt(tr('presetPrompt'))||'').trim();
  if(!n) return;
  const p=presets(); p[n]=estado(); p[n].preset=n;
  if(!store.set('presets',p)) return alert(tr('presetNoSave'));
  drawPresets(); el('p_sel').value=n; agendarMemoriaRemota();
}
function carregarPreset(){
  const n=el('p_sel').value; if(!n) return;
  const p=presets()[n]; if(p) repor(p);
  el('p_sel').value=n;                     /* o preset carregado é o que fica à vista */
}
function apagarPreset(){
  const n=el('p_sel').value;
  if(!n) return alert(tr('presetPickFirst'));
  if(!confirm(tr('presetDelete',{name:n}))) return;
  const p=presets(); delete p[n]; store.set('presets',p);
  el('p_sel').value=''; drawPresets(); agendarMemoriaRemota();
}
