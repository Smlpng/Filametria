/* Filametria — Gestão de filamentos manuais, modelos 3D, mesas, impressoras, portes e escalões */
/* ============ FILAMENTOS ============
   Há duas origens, e a diferença entre elas é a razão de quase tudo o que vem
   a seguir:

   · os MEUS (FILS) — {nome, preço/kg, portes} escritos aqui à mão. Vivem no
     estado, nos presets e no Exportar, e são editáveis.
   · os do BOBINA — o inventário verdadeiro (:8100), lido EM DIRETO. Não se
     importam nem se copiam para os presets: o preço, o stock e a cor são
     sempre os de agora, por isso um filamento não pode ser editado aqui — o
     sítio de o mudar é o Bobina.

   O desperdício fica de fora dos dois de propósito: é da casa, não da bobine. */
let FILS=[{n:DEF.fil_nome, kg:DEF.fil_kg, portes:DEF.fil_portes}];


function drawFilTrigger(){
  const b=el('fil_trigger'); if(!b) return;
  const n=el('s_fil_nome').value, f=filInfo(n);
  if(!f){ b.innerHTML=`<span class="ftxt"><b>${tr('fpNenhum')}</b></span><span class="fchev">▾</span>`; return; }
  const imp=contaNaImpressora(f);
  const stock=f.bobina&&f.restante_g!==undefined
    ? `<span class="fst">${f.bobines?kgTxt(f.restante_g)+' · '+tr('fpBobines',{n:f.bobines}):tr('fpSemStock')}</span>`
    : '';
  const noz=imp?`<span class="fnozmark" title="${htmlEsc(tituloNaImpressora(f))}">${NOZZLE}</span>`:'';
  b.innerHTML=`${desenhaFil(f,32)}${noz}<span class="ftxt"><b>${htmlEsc(f.n)}</b>`
    +`<i>${eur(f.kg)}/kg${f.bobina?' · '+tr('fpDoBobina'):''}</i></span>${stock}<span class="fchev">▾</span>`;
}

function drawFils(redesenhaMesas=true){
  const s=el('s_fil_nome'); if(!s) return;
  const keep=s.value;
  const op=f=>`<option value="${htmlEsc(f.n)}">${htmlEsc(rotuloFil(f))}</option>`;
  const meus=FILS.map(op).join('');
  const doBob=todosFils().filter(f=>f.bobina).map(op).join('');
  let html='';
  if(meus) html+=`<optgroup label="${htmlEsc(tr('fpMeus'))}">${meus}</optgroup>`;
  if(doBob) html+=`<optgroup label="Bobina">${doBob}</optgroup>`;
  s.innerHTML = html || '<option value="">— sem filamentos —</option>';
  s.value = filInfo(keep) ? keep : (todosFils()[0] ? todosFils()[0].n : '');
  drawFilTrigger();
  if(redesenhaMesas && el('tbl_mesas') && el('tbl_mesas').querySelector('tbody').children.length) drawMesas();
}
/* escolher um filamento traz os preços dele para os campos */
function aplicaFilamento(){
  sincronizaCamposFil();
  calc(); guardaEstado();
}
/* Os campos de preço seguem o filamento escolhido. Num filamento do Bobina o
  R$/kg é só de leitura: quem manda nele é o inventário, e escrever aqui por
   cima dava um número que desaparecia na leitura seguinte. Os portes ficam
   editáveis porque o Bobina não os conhece. */
function sincronizaCamposFil(){
  const n=el('s_fil_nome').value, f=filInfo(n);
  if(!f) return;
  el('s_fil_kg').value=f.kg; el('s_fil_portes').value=f.portes;
  const doBob=eBobina(n);
  el('s_fil_kg').readOnly=doBob;
  el('s_fil_kg').classList.toggle('lido',doBob);
  const av=el('fil_aviso');
  if(av){
    av.style.display=doBob?'block':'none';
    if(doBob) av.innerHTML=tr('fpLido',{n:htmlEsc(f.n)})
      +(f.vivo?'':' <b>'+htmlEsc(tr('fpDesligado'))+'</b>');
  }
  drawFilTrigger();
}
/* mexer nos preços escreve-os de volta no filamento escolhido, sem redesenhar nada */
function marcaFilamento(){
  const n=el('s_fil_nome').value, f=filInfo(n);
  if(!f) return;
  if(eBobina(n)){                     /* só os portes são deste lado */
    PORTES_BOB[n]=num('s_fil_portes');
    el('s_fil_kg').value=f.kg;
    calc(); guardaEstado(); return;
  }
  f.kg=num('s_fil_kg'); f.portes=num('s_fil_portes');
  const o=[...el('s_fil_nome').options].find(x=>x.value===f.n);
  if(o) o.textContent=rotuloFil(f);
  drawFilTrigger(); guardaEstado();
}
function escolheFil(n){
  if(!filInfo(n)) return;
  el('s_fil_nome').value=n;
  aplicaFilamento();
  if(pickerAberto()) drawPicker();
}
function addFil(nome){
  const n=(typeof nome==='string'?nome:(prompt(tr('fpNomeNovo'),'')||'')).trim();
  if(!n) return;
  const f={n, kg:num('s_fil_kg'), portes:num('s_fil_portes')};
  const i=FILS.findIndex(x=>x.n===n);
  if(i>=0){ if(!confirm(tr('fpJaTens',{n}))) return; FILS[i]=f; }
  else FILS.push(f);
  drawFils(); el('s_fil_nome').value=n; aplicaFilamento();
  if(pickerAberto()) drawPicker();
}
/* Copiar um do Bobina para os meus: o valor de agora, congelado e editável.
   Serve para orçamentar com um preço combinado sem mexer no inventário. */
function copiaBob(n){
  const f=bobFil(n); if(!f) return;
  let nome=n+' '+tr('fpSufixoCopia');
  while(FILS.some(x=>x.n===nome)) nome+=' ·';
  FILS.push({n:nome, kg:+f.kg||0, portes:+f.portes||0});
  drawFils(); el('s_fil_nome').value=nome; aplicaFilamento();
  if(pickerAberto()) drawPicker();
}
/* mudar nome e preços sem depender dos campos avançados — em Modo simples estão escondidos */
function editFil(nome){
  const alvo=typeof nome==='string'?nome:el('s_fil_nome').value;
  if(eBobina(alvo)) return alert(tr('fpEditarBobina'));
  const f=filInfo(alvo);
  if(!f) return;
  const n=(prompt(tr('fpNomeNovo'), f.n)||'').trim();
  if(!n) return;
  const kg=prompt(tr('fpPrecoDe',{n}), f.kg);
  if(kg===null) return;
  const pt=prompt(tr('fpPortesDe',{n}), f.portes);
  if(pt===null) return;
  const numero = v => parseFloat(String(v).replace(',','.'))||0;
  if(n!==f.n){
    if(FILS.some(x=>x!==f&&x.n===n)) return alert(tr('fpNomeOcupado',{n}));
    mesas.forEach(m=>{ if(m[5]) m[5]=m[5].map(v=>v===f.n?n:v); });   /* as mesas seguem o nome novo */
    f.n=n;
  }
  f.kg=numero(kg); f.portes=numero(pt);
  drawFils(); el('s_fil_nome').value=f.n; aplicaFilamento();
  if(pickerAberto()) drawPicker();
}
function delFil(nome){
  const n=typeof nome==='string'?nome:el('s_fil_nome').value;
  if(eBobina(n)) return alert(tr('fpApagarBobina'));
  const i=FILS.findIndex(x=>x.n===n);
  if(i<0) return;
  if(todosFils().length<2) return alert(tr('fpUltimo'));
  const emMesas=mesas.filter(m=>(m[5]||[]).includes(n)).length;
  if(!confirm(tr('fpApagar',{n})+(emMesas?'\n\n'+tr('fpApagarMesas',{n:emMesas}):''))) return;
  FILS.splice(i,1);
  mesas.forEach(m=>{ if(m[5]) m[5]=m[5].filter(v=>v!==n); });
  const resto=todosFils();
  el('s_fil_nome').value=resto.length?resto[0].n:'';
  drawFils(); aplicaFilamento();
  if(pickerAberto()) drawPicker();
}

async function alternaImpressoraFil(f){
  if(!f||!f.bobina||!f.id) return;
  try{
    const r=await fetch('/api/bobina/impressora',{
      method:'POST',
      credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({filamento_id:f.id})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok) throw new Error(d.error||d.erro||r.statusText||'erro');
    await puxaBobina(true);
    drawFils();
    if(pickerAberto()) drawPicker();
  }catch(e){
    alert(tr('fpImpErro',{e:e.message||String(e)}));
  }
}

/* os filamentos que este orcamento usa: o das Definicoes e os das mesas */
function nomesEmUso(){
  const l=[el('s_fil_nome').value, ...mesas.flatMap(m=>m[5]||[])];
  return [...new Set(l.filter(Boolean))];
}


/* ============ MODELAÇÃO 3D (pré-processamento) ============
   Cada modelo é {nome, tempo}. O tempo é uma string como as mesas ("2h30", "2:30", "150"),
   lida pelo parseT. Lista vazia = trabalho sem modelação, e nada disto aparece no orçamento. */
let MODELOS=[];
const normModelo = m => ({n:String(m&&m.n||''), t:String(m&&m.t||'')});
const minutosModelacao = () => MODELOS.reduce((a,m)=>a+parseT(m.t),0);

function drawModelos(){
  const tb=el('tbl_mod').querySelector('tbody'); tb.innerHTML='';
  MODELOS.forEach((mo,i)=>{
    const linha=document.createElement('tr');
    const [tdN,inN]=cell(mo.n,{type:'text',placeholder:tr('modNamePh')});
    inN.addEventListener('input',()=>{ MODELOS[i].n=inN.value; calc(); guardaEstado(); });
    const [tdT,inT]=cell(mo.t,{type:'text',placeholder:'0h00'});
    inT.addEventListener('input',()=>{ MODELOS[i].t=inT.value; calc(); guardaEstado(); });
    const td=document.createElement('td'), b=document.createElement('button');
    b.className='del'; b.textContent='×'; b.title=tr('modDelTitle');
    b.addEventListener('click',()=>{ MODELOS.splice(i,1); drawModelos(); calc(); guardaEstado(); });
    td.appendChild(b);
    linha.appendChild(tdN); linha.appendChild(tdT); linha.appendChild(td); tb.appendChild(linha);
  });
  el('tbl_mod').style.display=MODELOS.length?'':'none';
}
function addModelo(){
  MODELOS.push({n:'', t:''});
  drawModelos(); calc(); guardaEstado();
  const ins=el('tbl_mod').querySelectorAll('tbody input');
  if(ins.length) ins[ins.length-2].focus();          /* cai logo no nome do modelo novo */
}
function delModelo(){
  if(!MODELOS.length) return;
  MODELOS.pop(); drawModelos(); calc(); guardaEstado();
}


/* ============ mesas: [gramas, tempo, custoSlicer, impressora, mostrarNoOrçamento,
   filamentos[], peças, gramasDeCadaFilamento[]] ============ */
let mesas = [[280,'14h58','','',true,[],1,[]],[278,'15h34','','',true,[],1,[]]];
/* normaliza mesas vindas de versões anteriores (3 a 7 colunas);
   peças a null = estado antigo, em que as peças eram um número global — ver migraPecas() */
const normMesa = m => [m[0]??0, m[1]??'', m[2]??'', m[3]??'', m[4]!==false,
                       Array.isArray(m[5])?m[5].map(String):[],
                       Number.isFinite(+m[6]) ? Math.max(0,Math.round(+m[6])) : null,
                       Array.isArray(m[7])?m[7].map(gDado):[]];
/* null = "diz tu", que é diferente de 0 g ("não entrou nada deste") */
const gDado = v => { const x=parseFloat(v); return isFinite(x)&&x>0 ? x : null; };

/* ---- quantos gramas de cada filamento nesta mesa ----
   Numa impressão multi-material o slicer diz quantos gramas foram de cada cor;
   é esse número que se escreve no campo do chip. O que ficar por escrever
   reparte o que sobra por igual — que é o que a app sempre fez quando não havia
   forma de saber. Com um filamento só, leva tudo e não se pergunta nada. */
function repartoMesa(m, fils){
  const tot=parseFloat(m[0])||0, dados=m[7]||[];
  const escrito=fils.map((_,i)=>gDado(dados[i]));
  const somaEscrita=escrito.reduce((a,v)=>a+(v||0),0);
  const auto=escrito.filter(v=>v===null).length;
  const sobra=Math.max(0, tot-somaEscrita);
  return fils.map((f,i)=>({ f, n:f.n, auto:escrito[i]===null,
    g: escrito[i]!==null ? escrito[i] : (auto ? sobra/auto : 0) }));
}
const somaReparto = r => r.reduce((a,x)=>a+x.g,0);
const totalPecas = () => mesas.reduce((a,m)=>a+(m[6]||0),0);
/* estado de uma versão sem peças por mesa: reparte o total antigo pelas mesas */
function migraPecas(o){
  if(!mesas.length || mesas.some(m=>m[6]!==null)){ mesas.forEach(m=>{ if(m[6]===null) m[6]=0; }); return; }
  const tot=Math.max(parseInt(o&&o.j_pecas,10)||0,0) || mesas.length;
  mesas.forEach((m,i)=>{ m[6]=Math.floor(tot/mesas.length)+(i<tot%mesas.length?1:0); });
}

/* as linhas chamam-se `linha` e nunca `tr`: um `const tr` local tapa a função
   tr() de tradução em todo o âmbito, e a chamada mais abaixo rebentava assim
   que houvesse um filamento escrito à mão -- com o arranque a morrer aí, ficava
   tudo o que vem depois por ligar, incluindo as escutas do seletor. */
function drawMesas(){
  const tb=el('tbl_mesas').querySelector('tbody'); tb.innerHTML='';
  mesas.forEach((m,i)=>{
    const linha=document.createElement('tr');
    const specs=[
      [m[0],{type:'number',min:'0',step:'1',placeholder:'0'},null,v=>mesas[i][0]=parseFloat(v)||0],
      [m[1],{type:'text',placeholder:'0h00'},null,v=>mesas[i][1]=v],
      [m[2],{type:'number',min:'0',step:'0.01',placeholder:'auto'},'slic',v=>mesas[i][2]=v],
      [m[6]??0,{type:'number',min:'0',step:'1',placeholder:'0'},null,v=>mesas[i][6]=Math.max(0,parseInt(v,10)||0)],
    ];
    specs.forEach(([v,a,c,set],col)=>{
      const [td,inp]=cell(v,a,c);
      /* mexer nas peças mexe no total, e o escalão de desconto segue-o como sempre seguiu */
      inp.addEventListener('input',()=>{ set(inp.value); col===3?mudaPecas():calc(); guardaEstado(); });
      linha.appendChild(td);
    });
    const td=document.createElement('td'), b=document.createElement('button');
    b.className='del'; b.textContent='×';
    b.addEventListener('click',()=>{ mesas.splice(i,1); drawMesas(); calc(); });
    td.appendChild(b); linha.appendChild(td); tb.appendChild(linha);

    /* segunda linha: que impressora fez esta mesa e se aparece no orçamento */
    const tr2=document.createElement('tr'); tr2.className='msub';
    const td2=document.createElement('td'); td2.colSpan=5;
    const box=document.createElement('div'); box.className='mrow';
    const sel=document.createElement('select');
    sel.innerHTML=opcoesImpressora();
    sel.value=[...sel.options].some(o=>o.value===m[3])?m[3]:'';
    sel.title='Impressora usada nesta mesa';
    sel.addEventListener('change',()=>{ mesas[i][3]=sel.value; calc(); guardaEstado(); });
    const lab=document.createElement('label'); lab.className='mchk';
    lab.title='Mostrar esta impressora no orçamento do cliente';
    const chk=document.createElement('input'); chk.type='checkbox'; chk.checked=m[4]!==false;
    chk.addEventListener('change',()=>{ mesas[i][4]=chk.checked; calc(); guardaEstado(); });
    lab.appendChild(chk); lab.appendChild(document.createTextNode('no orçamento'));
    box.appendChild(sel); box.appendChild(lab);
    td2.appendChild(box);

    /* que filamentos entraram nesta mesa — sem nenhum, vale o das Definições */
    const todos=(m[5]||[]);
    const usados=todos.filter(n=>filInfo(n));
    if(usados.length!==todos.length){   /* limpa nomes que já não existem, e os gramas deles */
      mesas[i][7]=todos.map((n,k)=>[n,(m[7]||[])[k]]).filter(([n])=>filInfo(n)).map(([,g])=>g);
      mesas[i][5]=usados;
    }
    /* os gramas de cada um, para o campo mostrar o que está a valer */
    const repM=()=>repartoMesa(mesas[i], usados.map(filInfo).filter(Boolean));
    const campos=[];
    const refrescaAuto=()=>{
      const r=repM();
      campos.forEach((c,k)=>{ if(c&&r[k]) c.placeholder=Math.round(r[k].g); });
      const r2=repM(), tot=parseFloat(mesas[i][0])||0;
      const escritos=r2.filter(x=>!x.auto).reduce((a,x)=>a+x.g,0);
      const todosEscritos=r2.length>1&&r2.every(x=>!x.auto);
      nota.textContent = r2.length<2 ? ''
        : escritos>tot+0.5 ? tr('mgPassa',{g:Math.round(escritos-tot)})
        : todosEscritos&&escritos<tot-0.5 ? tr('mgFaltam',{g:Math.round(tot-escritos)})
        : '';
      nota.className='mgnota'+(nota.textContent?' on':'');
    };
    const fbox=document.createElement('div'); fbox.className='mfil';
    const nota=document.createElement('span');
    usados.forEach((n,k)=>{
      const f=filInfo(n);
      const imp=contaNaImpressora(f);
      const c=document.createElement('span'); c.className='chipf'+(imp?' imprimindo':'');
      /* o ponto da cor é o do Bobina: numa mesa com três filamentos é o que
         permite ver qual é qual sem ler os nomes todos */
      if(f&&f.bobina){
        const p=document.createElement('i'); p.className='pt';
        p.style.background=corVisivel(f.cor_hex); c.appendChild(p);
      }
      if(imp){
        const noz=document.createElement('i'); noz.className='nozmini';
        noz.title=tituloNaImpressora(f); noz.innerHTML=NOZZLE; c.appendChild(noz);
      }
      c.appendChild(document.createTextNode(n));
      /* o campo dos gramas só aparece com dois materiais ou mais: com um só, os
         gramas da mesa já são os dele e um campo a repetir isso é ruído */
      if(usados.length>1){
        const gi=document.createElement('input');
        gi.type='number'; gi.min='0'; gi.step='1'; gi.className='mg';
        gi.title=tr('mgT'); gi.value=gDado((mesas[i][7]||[])[k])??'';
        gi.addEventListener('input',()=>{
          const arr=(mesas[i][7]||[]).slice();
          while(arr.length<usados.length) arr.push(null);
          arr[k]=gi.value===''?null:Math.max(0,parseFloat(gi.value)||0);
          mesas[i][7]=arr.slice(0,usados.length);
          refrescaAuto(); calc(); guardaEstado();
        });
        campos[k]=gi; c.appendChild(gi);
        const un=document.createElement('i'); un.className='mgu'; un.textContent='g';
        c.appendChild(un);
      }
      const x=document.createElement('button'); x.type='button'; x.textContent='×';
      x.title='Tirar este filamento da mesa';
      x.addEventListener('click',()=>{
        mesas[i][7]=(mesas[i][7]||[]).filter((_,j)=>j!==k);
        mesas[i][5]=usados.filter(v=>v!==n); drawMesas(); calc(); guardaEstado(); });
      c.appendChild(x); fbox.appendChild(c);
    });
    const add=document.createElement('select');
    const livres=todosFils().filter(f=>!usados.includes(f.n));
    const grupo=l=>l.map(f=>`<option value="${htmlEsc(f.n)}">${htmlEsc(rotuloEscolhaFil(f))}</option>`).join('');
    const meusL=livres.filter(f=>!f.bobina), bobL=livres.filter(f=>f.bobina);
    add.title='Filamentos usados nesta mesa';
    add.innerHTML=`<option value="">${usados.length?'+ outro filamento':'↳ o filamento das Definições'}</option>`
      + (meusL.length?`<optgroup label="${htmlEsc(tr('fpMeus'))}">${grupo(meusL)}</optgroup>`:'')
      + (bobL.length?`<optgroup label="Bobina">${grupo(bobL)}</optgroup>`:'');
    add.addEventListener('change',()=>{
      if(!add.value) return;
      mesas[i][7]=[...(mesas[i][7]||[]).slice(0,usados.length), null];
      mesas[i][5]=[...usados,add.value]; drawMesas(); calc(); guardaEstado(); });
    fbox.appendChild(add);
    fbox.appendChild(nota);
    refrescaAuto();
    td2.appendChild(fbox);

    tr2.appendChild(td2); tb.appendChild(tr2);
  });
}
function opcoesImpressora(){
  const g=l=>l.map(m=>`<option value="${m.n}">${m.n}</option>`).join('');
  return '<option value="">↳ a impressora das Definições</option>'
    + PRINTERS.map(x=>`<optgroup label="${x.g}">${g(x.l)}</optgroup>`).join('')
    + (custom.length?`<optgroup label="As minhas">${g(custom)}</optgroup>`:'');
}
function addMesa(){ mesas.push([0,'','',el('s_printer').value||'',true,[],0,[]]); drawMesas(); mudaPecas(); }
/* o total de peças mudou */
function mudaPecas(){
  const s=autoTier(totalPecas());
  if(s) el('j_desc').value=s;
  calc();
}


let favs=['Qidi Plus 4','Elegoo Centauri Carbon','Anycubic Photon Mono 4 (resina)'];
let custom=[];   /* impressoras adicionadas pelo utilizador */
const todasImp = () => [...PRINTERS.flatMap(g=>g.l), ...custom];

function drawPrinters(){
  const s=el('s_printer'), keep=s.value;
  const opt=m=>`<option value="${m.n}">${favs.includes(m.n)?'★ ':''}${m.n} — ${moeda(m.p)}</option>`;
  const favL=todasImp().filter(m=>favs.includes(m.n));
  s.innerHTML='<option value="">Personalizada / valores atuais</option>'
    + (favL.length?`<optgroup label="★ Favoritas">${favL.map(opt).join('')}</optgroup>`:'')
    + PRINTERS.map(g=>`<optgroup label="${g.g}">${g.l.map(opt).join('')}</optgroup>`).join('')
    + (custom.length?`<optgroup label="As minhas">${custom.map(opt).join('')}</optgroup>`:'');
  s.value=[...s.options].some(o=>o.value===keep)?keep:'';
  el('b_fav').style.color = (s.value&&favs.includes(s.value))?'var(--accent)':'';
  if(el('tbl_mesas')&&el('tbl_mesas').querySelector('tbody').children.length) drawMesas();
}

/* ficha de uma impressora: pelo nome, ou os valores em Definições quando o nome é vazio */
function impInfo(nome){
  const m=nome?todasImp().find(x=>x.n===nome):null;
  if(m) return {n:m.n, p:m.p, kw:m.kw, h:m.h};
  return {n:el('s_printer').value||'Impressora das definições',
          p:num('s_imp_preco'), kw:num('s_imp_kw'), h:num('s_imp_vida')};
}
/* custo por hora de impressão dessa máquina: amortização + eletricidade (máquina + PC) */
const horaImp=(info,kwh)=> info.p/Math.max(info.h,1)+(info.kw+num('s_pc_kw'))*kwh;

/* junta as mesas por máquina, somando tempo e guardando que mesas lhe pertencem */
function agrupaMaquinas(lista){
  const out=[];
  lista.forEach(m=>{
    const e=out.find(x=>x.n===m.imp.n);
    if(e){ e.t+=m.t; e.mesas.push(m.i); }
    else out.push({n:m.imp.n, t:m.t, hImp:m.hImp, mesas:[m.i]});
  });
  return out;
}
function aplicaImpressora(){
  const m=todasImp().find(x=>x.n===el('s_printer').value);
  if(m){ el('s_imp_preco').value=m.p; el('s_imp_vida').value=m.h; el('s_imp_kw').value=m.kw; }
  el('b_fav').style.color = favs.includes(el('s_printer').value)?'var(--accent)':'';
  calc();
}
function toggleFav(){
  const n=el('s_printer').value;
  if(!n) return alert('Escolhe primeiro um modelo da lista.');
  favs.includes(n) ? favs.splice(favs.indexOf(n),1) : favs.push(n);
  drawPrinters(); el('s_printer').value=n; aplicaImpressora();
}
function addPrinter(){
  const n=(prompt('Nome da impressora:', el('s_printer').value||'A minha impressora')||'').trim();
  if(!n) return;
  const m={n, p:num('s_imp_preco'), kw:num('s_imp_kw'), h:num('s_imp_vida')};
  const i=custom.findIndex(x=>x.n===n);
  i>=0 ? custom[i]=m : custom.push(m);
  drawPrinters(); el('s_printer').value=n; aplicaImpressora();
}
function delPrinter(){
  const n=el('s_printer').value, i=custom.findIndex(x=>x.n===n);
  if(i<0) return alert('Só podes remover impressoras que tenhas adicionado.');
  if(!confirm(`Remover "${n}"?`)) return;
  custom.splice(i,1);
  const f=favs.indexOf(n); if(f>=0) favs.splice(f,1);
  el('s_printer').value=''; drawPrinters(); calc();
}



/* ============ portes personalizados ============ */
let portes = DEF.portes.map(p=>p.slice());
function drawPortes(){
  const tb=el('tbl_portes').querySelector('tbody'); tb.innerHTML='';
  portes.forEach((p,i)=>{
    const linha=document.createElement('tr');
    [[0,'50'],[1,'0.1']].forEach(([k,step])=>{
      const [td,inp]=cell(p[k],{type:'number',step});
      inp.addEventListener('input',()=>{ portes[i][k]=parseFloat(inp.value)||0; drawPortesSel(); calc(); guardaEstado(); });
      linha.appendChild(td);
    });
    const td=document.createElement('td'), b=document.createElement('button');
    b.className='del'; b.textContent='×';
    b.addEventListener('click',()=>{ portes.splice(i,1); drawPortes(); drawPortesSel(); calc(); });
    td.appendChild(b); linha.appendChild(td); tb.appendChild(linha);
  });
}
function addPorte(){ portes.push([0,0]); drawPortes(); drawPortesSel(); }
function drawPortesSel(){
  const s=el('j_portes'), keep=s.value;
  s.innerHTML='<option value="0">Sem portes / entrega em mão</option>'
    +'<option value="auto">Mais barato disponível</option>'
    + TRANSP.grupos.map(g=>`<optgroup label="${g.g}">`
        + g.s.map(x=>`<option value="${x.id}">${x.n}</option>`).join('')+'</optgroup>').join('')
    +'<optgroup label="Outro"><option value="custom">Tabela personalizada</option>'
    +'<option value="man">Valor manual</option></optgroup>';
  s.value=[...s.options].some(o=>o.value===keep)?keep:'0';
}


/* ============ escalões ============ */
function getTiers(){
  return (el('s_tiers').value||'').split(',').map(t=>{
    const [q,p]=t.split(':').map(Number);
    return (isFinite(q)&&isFinite(p))?[q,p]:null;
  }).filter(Boolean).sort((a,b)=>a[0]-b[0]);
}
function drawTiers(){
  const cur=num('j_desc'), box=el('tiers'); box.innerHTML='';
  [[0,0],...getTiers()].forEach(([q,p])=>{
    const b=document.createElement('button');
    b.textContent=q?q+'u='+p+'%':'0%';
    if(Math.abs(cur-p)<.01) b.className='on';
    b.addEventListener('click',()=>{ el('j_desc').value=p; calc(); });
    box.appendChild(b);
  });
}
function autoTier(n){ let d=0; getTiers().forEach(([q,p])=>{ if(n>=q) d=p; }); return d; }
