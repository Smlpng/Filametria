/* Filametria — Orçamento do cliente, visualização de impressão/PDF, marca e gerador de QR Code */
/* ============ QR codes ============
   Codificador próprio — modo byte, correção M, versões 1 a 10 (até 213 bytes).
   Não há dependências externas: o orçamento tem de imprimir bem sem rede. */
const QR=(()=>{
  const EXP=new Array(256), LOG=new Array(256);
  for(let i=0,x=1;i<256;i++){ EXP[i]=x; LOG[x]=i; x<<=1; if(x&256) x^=0x11d; }
  const mul=(a,b)=> (a===0||b===0)?0:EXP[(LOG[a]+LOG[b])%255];

  /* [nº de codewords de correção por bloco, blocos curtos, dados por bloco curto, blocos longos, dados por bloco longo] */
  const EC_M=[[10,1,16,0,0],[16,1,28,0,0],[26,1,44,0,0],[18,2,32,0,0],[24,2,43,0,0],
              [16,4,27,0,0],[18,4,31,0,0],[22,2,38,2,39],[22,3,36,2,37],[26,4,43,1,44]];
  const ALIGN=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
  const MASKS=[
    (r,c)=>(r+c)%2===0, (r,c)=>r%2===0, (r,c)=>c%3===0, (r,c)=>(r+c)%3===0,
    (r,c)=>((r>>1)+Math.floor(c/3))%2===0, (r,c)=>(r*c)%2+(r*c)%3===0,
    (r,c)=>(((r*c)%2)+((r*c)%3))%2===0, (r,c)=>(((r+c)%2)+((r*c)%3))%2===0
  ];

  /* divisor de Reed-Solomon de grau `n`, coeficientes por ordem decrescente sem o termo dominante */
  function divisor(n){
    const d=new Array(n).fill(0); d[n-1]=1;
    let root=1;
    for(let i=0;i<n;i++){
      for(let j=0;j<n;j++){ d[j]=mul(d[j],root); if(j+1<n) d[j]^=d[j+1]; }
      root=mul(root,2);
    }
    return d;
  }
  function resto(dados,div){
    const r=new Array(div.length).fill(0);
    for(const b of dados){
      const f=b^r.shift(); r.push(0);
      div.forEach((c,i)=>r[i]^=mul(c,f));
    }
    return r;
  }

  function matrix(texto){
    const bytes=[...new TextEncoder().encode(String(texto||''))];
    /* versão mais pequena que chega */
    let v=0;
    for(let i=1;i<=10;i++){
      const [ec,b1,d1,b2,d2]=EC_M[i-1];
      const dataCw=b1*d1+b2*d2, cont=(i<10)?8:16;
      if(dataCw*8-(4+cont) >= bytes.length*8){ v=i; break; }
    }
    if(!v) return null;                       /* texto grande de mais para v10-M */

    const [ecLen,b1,d1,b2,d2]=EC_M[v-1];
    const dataCw=b1*d1+b2*d2, cont=(v<10)?8:16;

    /* bitstream: modo 0100 + contagem + dados + terminador + padding */
    const bits=[];
    const push=(val,n)=>{ for(let i=n-1;i>=0;i--) bits.push((val>>>i)&1); };
    push(4,4); push(bytes.length,cont); bytes.forEach(b=>push(b,8));
    for(let i=0;i<4&&bits.length<dataCw*8;i++) bits.push(0);
    while(bits.length%8) bits.push(0);
    const cw=[]; for(let i=0;i<bits.length;i+=8){ let b=0; for(let j=0;j<8;j++) b=(b<<1)|bits[i+j]; cw.push(b); }
    for(let i=0;cw.length<dataCw;i++) cw.push(i%2?0x11:0xEC);

    /* divide em blocos, calcula correção e intercala */
    const div=divisor(ecLen), blocos=[], ecs=[];
    let p=0;
    for(let i=0;i<b1+b2;i++){
      const n=i<b1?d1:d2, bloco=cw.slice(p,p+n); p+=n;
      blocos.push(bloco); ecs.push(resto(bloco,div));
    }
    const final=[];
    for(let i=0;i<Math.max(d1,d2);i++) blocos.forEach(b=>{ if(i<b.length) final.push(b[i]); });
    for(let i=0;i<ecLen;i++) ecs.forEach(e=>final.push(e[i]));

    /* --- desenho --- */
    const n=17+4*v;
    const m=Array.from({length:n},()=>new Array(n).fill(0));
    const fn=Array.from({length:n},()=>new Array(n).fill(false));
    const set=(r,c,val)=>{ if(r>=0&&r<n&&c>=0&&c<n){ m[r][c]=val?1:0; fn[r][c]=true; } };

    const finder=(r0,c0)=>{
      for(let r=-1;r<=7;r++) for(let c=-1;c<=7;c++){
        const d=Math.max(Math.abs(r-3),Math.abs(c-3));
        set(r0+r,c0+c,d!==2&&d<=3);
      }
    };
    finder(0,0); finder(0,n-7); finder(n-7,0);
    for(let i=8;i<n-8;i++){ set(6,i,i%2===0); set(i,6,i%2===0); }
    const al=ALIGN[v-1];
    al.forEach(r=>al.forEach(c=>{
      if((r===6&&c===6)||(r===6&&c===n-7)||(r===n-7&&c===6)) return;
      for(let dr=-2;dr<=2;dr++) for(let dc=-2;dc<=2;dc++)
        set(r+dr,c+dc,Math.max(Math.abs(dr),Math.abs(dc))!==1);
    }));
    set(n-8,8,1);                                   /* módulo sempre escuro */
    /* reserva das zonas de formato */
    for(let i=0;i<9;i++){ if(!fn[8][i])fn[8][i]=true; if(!fn[i][8])fn[i][8]=true; }
    for(let i=0;i<8;i++){ fn[8][n-1-i]=true; fn[n-1-i][8]=true; }
    /* informação de versão (v7+) */
    if(v>=7){
      let rem=v; for(let i=0;i<12;i++) rem=(rem<<1)^(((rem>>>11)&1)*0x1F25);
      const vb=(v<<12)|rem;
      for(let i=0;i<18;i++){
        const b=(vb>>>i)&1, a=Math.floor(i/3), c=i%3;
        set(n-11+c,a,b); set(a,n-11+c,b);
      }
    }

    /* colocação dos dados em ziguezague */
    let bi=0;
    const bit=()=>{ const b=bi<final.length*8?(final[bi>>3]>>>(7-(bi&7)))&1:0; bi++; return b; };
    for(let right=n-1;right>=1;right-=2){
      if(right===6) right=5;
      for(let vert=0;vert<n;vert++){
        for(let j=0;j<2;j++){
          const c=right-j, cima=((right+1)&2)===0, r=cima?n-1-vert:vert;
          if(!fn[r][c]) m[r][c]=bit();
        }
      }
    }

    /* escolhe a máscara com menor penalização */
    let melhor=null, melhorP=Infinity;
    for(let k=0;k<8;k++){
      const t=m.map(r=>r.slice());
      for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(!fn[r][c]&&MASKS[k](r,c)) t[r][c]^=1;
      formato(t,fn,k,n);
      const p=penal(t,n);
      if(p<melhorP){ melhorP=p; melhor=t; }
    }
    return melhor;
  }

  /* 15 bits de formato (nível M + máscara), gravados nas duas cópias. Coordenadas em [linha][coluna]. */
  function formato(t,fn,mask,n){
    const d=(0b00<<3)|mask;
    let rem=d;
    for(let i=0;i<10;i++) rem=(rem<<1)^(((rem>>>9)&1)*0x537);
    const b=(((d<<10)|rem)^0x5412), g=i=>(b>>>i)&1;
    for(let i=0;i<=5;i++) t[i][8]=g(i);
    t[7][8]=g(6); t[8][8]=g(7); t[8][7]=g(8);
    for(let i=9;i<15;i++) t[8][14-i]=g(i);
    for(let i=0;i<8;i++)  t[8][n-1-i]=g(i);
    for(let i=8;i<15;i++) t[n-15+i][8]=g(i);
    t[n-8][8]=1;
  }

  function penal(t,n){
    let p=0;
    const corrida=linha=>{
      let r=0, cor=-1, out=0;
      for(const v of linha){ if(v===cor) r++; else { if(r>=5) out+=3+(r-5); cor=v; r=1; } }
      if(r>=5) out+=3+(r-5);
      return out;
    };
    for(let i=0;i<n;i++){ p+=corrida(t[i]); p+=corrida(t.map(r=>r[i])); }
    for(let r=0;r<n-1;r++) for(let c=0;c<n-1;c++)
      if(t[r][c]===t[r][c+1]&&t[r][c]===t[r+1][c]&&t[r][c]===t[r+1][c+1]) p+=3;
    const alvo=[1,0,1,1,1,0,1,0,0,0,0], alvoR=[0,0,0,0,1,0,1,1,1,0,1];
    const bate=(arr,i,pat)=>pat.every((v,k)=>arr[i+k]===v);
    for(let i=0;i<n;i++){
      const lin=t[i], col=t.map(r=>r[i]);
      for(let j=0;j+11<=n;j++){
        if(bate(lin,j,alvo)||bate(lin,j,alvoR)) p+=40;
        if(bate(col,j,alvo)||bate(col,j,alvoR)) p+=40;
      }
    }
    let escuros=0; t.forEach(r=>r.forEach(v=>escuros+=v));
    p+=(Math.ceil(Math.abs(escuros*20-n*n*10)/(n*n))-1)*10;
    return p;
  }

  return {matrix};
})();

/* SVG de um QR — inline, para imprimir sem depender de rede */
function qrSVG(texto,px){
  const m=QR.matrix(texto);
  if(!m) return '';
  const n=m.length, q=2, t=n+q*2;
  let d='';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(m[r][c]) d+=`M${c+q} ${r+q}h1v1h-1z`;
  return `<svg viewBox="0 0 ${t} ${t}"${px?` width="${px}" height="${px}"`:''} shape-rendering="crispEdges" `
    +`xmlns="http://www.w3.org/2000/svg"><rect width="${t}" height="${t}" fill="#fff"/>`
    +`<path d="${d}" fill="#111"/></svg>`;
}


/* ============ marca da empresa + QR codes ============ */
const B_TXT=['nome','slogan','nif','contacto','morada','site','msg','nota'];
let LOGO='';                                  /* dataURI do logótipo, já reduzido */
let QRS=[{t:'Filametria', u:'https://filametria.com.br', img:''}];

/* reduz a imagem antes de a guardar — um dataURI grande enche o localStorage e mata os presets */
function reduzImagem(file,maxLado,cb){
  const r=new FileReader();
  r.onload=()=>{
    if(file.type==='image/svg+xml') return cb(r.result);
    const im=new Image();
    im.onload=()=>{
      const s=Math.min(1,maxLado/Math.max(im.width,im.height));
      const c=document.createElement('canvas');
      c.width=Math.max(1,Math.round(im.width*s)); c.height=Math.max(1,Math.round(im.height*s));
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      cb(c.toDataURL('image/png'));
    };
    im.onerror=()=>cb(null);
    im.src=r.result;
  };
  r.readAsDataURL(file);
}
function carregarLogo(e){
  const f=e.target.files[0]; e.target.value='';
  if(!f) return;
  reduzImagem(f,480,d=>{
    if(!d) return alert('Não consegui ler essa imagem.');
    LOGO=d; drawLogo(); calc(); guardaEstado();
  });
}
function removerLogo(){ LOGO=''; drawLogo(); calc(); guardaEstado(); }
function drawLogo(){
  el('b_logo_v').style.display=LOGO?'block':'none';
  if(LOGO) el('b_logo_v').src=LOGO;
  el('b_logo_t').textContent=LOGO
    ? 'Logótipo carregado — aparece no topo do orçamento e viaja dentro do template.'
    : 'Sem logótipo. PNG ou JPEG — é reduzido automaticamente e guardado dentro do template.';
}

function drawQRs(){
  const box=el('qrLista'); box.innerHTML='';
  QRS.forEach((q,i)=>{
    const d=document.createElement('div'); d.className='qritem';
    const vis=document.createElement('div'); vis.className='qv';
    vis.innerHTML = q.img ? `<img src="${q.img}" alt="">` : (qrSVG(q.u)||'<span style="font-size:9px;color:#900">endereço longo de mais</span>');
    const campos=document.createElement('div'); campos.className='qf';
    const t=document.createElement('input'); t.value=q.t; t.placeholder='Legenda (ex.: Site)';
    const u=document.createElement('input'); u.value=q.u; u.placeholder='https://…';
    u.disabled=!!q.img;
    t.addEventListener('input',()=>{ QRS[i].t=t.value; calc(); guardaEstado(); });
    u.addEventListener('input',()=>{ QRS[i].u=u.value; vis.innerHTML=qrSVG(u.value)||''; calc(); guardaEstado(); });
    campos.appendChild(t); campos.appendChild(u);
    const bts=document.createElement('div'); bts.className='qb';
    const bImg=document.createElement('button'); bImg.className='ghost'; bImg.textContent='Imagem…';
    bImg.title='Substituir este QR por um PNG ou JPEG teu';
    const fi=document.createElement('input'); fi.type='file'; fi.accept='image/png,image/jpeg,image/webp'; fi.style.display='none';
    fi.addEventListener('change',()=>{
      const f=fi.files[0]; fi.value=''; if(!f) return;
      reduzImagem(f,400,dd=>{ if(!dd) return alert('Não consegui ler essa imagem.');
        QRS[i].img=dd; drawQRs(); calc(); guardaEstado(); });
    });
    bImg.addEventListener('click',()=>fi.click());
    const bRep=document.createElement('button'); bRep.className='ghost'; bRep.textContent=q.img?'Repor QR':'Remover';
    bRep.title=q.img?'Voltar ao QR gerado do endereço':'Tirar esta entrada do rodapé';
    bRep.addEventListener('click',()=>{
      if(QRS[i].img) QRS[i].img=''; else QRS.splice(i,1);
      drawQRs(); calc(); guardaEstado();
    });
    bts.appendChild(bImg); bts.appendChild(bRep); bts.appendChild(fi);
    d.appendChild(vis); d.appendChild(campos); d.appendChild(bts);
    box.appendChild(d);
  });
  if(!QRS.length) box.innerHTML='<div class="hint">Sem QR codes. Carrega em adicionar para pôr um endereço ou uma imagem tua.</div>';
}
function addQR(){ QRS.push({t:'',u:'https://',img:''}); drawQRs(); calc(); guardaEstado(); }

function aplicaMarca(){
  document.body.classList.toggle('marca-off',!el('b_on').checked);
  document.body.classList.toggle('qr-off',!el('q_on').checked);
  document.body.classList.toggle('nota-off',!el('f_on').checked);
}


function preview(on=true){
  /* antes de mostrar o orçamento, perguntar se aquilo já foi impresso: é o
     momento em que se sabe, e a pergunta reabre isto conforme a resposta */
  if(on && perguntaBaixa()) return;
  el('printable').classList.toggle('show',on);
  document.body.style.overflow=on?'hidden':'';
  if(on && !document.getElementById('pvprint')){
    const b=document.createElement('button');
    b.id='pvprint'; b.textContent='🖨 Imprimir / PDF';
    b.style.cssText='position:fixed;top:16px;right:120px;z-index:100;background:#ff9f2e;color:#1a1206;border:none;padding:10px 16px;border-radius:10px;font-weight:700;cursor:pointer';
    b.onclick=()=>window.print();
    document.body.appendChild(b);
  }
  const p=document.getElementById('pvprint'); if(p) p.style.display=on?'block':'none';
}

/* ============ orçamento do cliente — limpo, sem margens à vista ============ */
function buildPrint(x){
  const desconto=x.desc+x.promo-Math.min(x.arred,0)*0; /* arredondamento entra em separado */
  const esc=htmlEsc;
  const tax=x.tax||{on:false,active:false,nome:tr('taxGeneric'),rate:0,base:x.total,valor:0,total:x.total};
  const rows=[];
  if(x.modelacao>0.004)
    rows.push([tr('modLine',{n:x.nModelos}),
               x.modDet && x.modDet.length
                 ? x.modDet.map(m=>`${esc(m.n||tr('modNamePh'))}${m.t>0?` · ${hm(m.t)}`:''}`).join(' · ')
                 : `${hm(x.modMin)} ${tr('modWork')}`,
               x.modelacao]);
  /* sem mesas não há impressão nenhuma para faturar — nem linha, nem ficha técnica */
  if(x.temImp)
    rows.push([`Impressão 3D — ${x.pecas} peça(s)`,
               `${x.material} · ${Math.round(x.gTot)} g de material · ${hm(x.mTot)} de impressão`
               + (x.nMesas>1?` · ${x.nMesas} ciclos de máquina`:''),
               x.impressao]);
  if(x.temAcab)
    rows.push(['Acabamento e montagem',
               [x.detAcab?x.detAcab.charAt(0).toUpperCase()+x.detAcab.slice(1):'',
                x.temImp?`preparação e verificação de ${x.nMesas} impressão(ões)`:'',
                x.minutosAcab>0?`${x.minutosAcab} min de trabalho manual`:''
               ].filter(Boolean).join(' · '),
               x.acabamento]);
  if(x.portes>0) rows.push(['Portes de envio', x.transp, x.portes]);
  const descTot=x.desc+x.promo+(x.arred<0?-x.arred:0);
  const html=rows.map(r=>`<tr><td><b>${r[0]}</b>${r[1]?`<div class="d">${r[1]}</div>`:''}</td><td>${eur(semImposto(r[2],tax))}</td></tr>`).join('')
    +(descTot>0.004?`<tr class="disc"><td><b>Desconto</b></td><td>−${eur(semImposto(descTot,tax))}</td></tr>`:'')
    +(x.arred>0.004?`<tr><td><b>Ajuste</b></td><td>${eur(semImposto(x.arred,tax))}</td></tr>`:'');
  const taxName=esc(tax.nome), taxRate=pct(tax.rate);
  const taxHtml=tax.on
    ? (tax.active
      ? `<tr class="subtot"><td><b>${tr('taxSubtotal',{name:taxName})}</b></td><td>${eur(tax.base)}</td></tr>
         <tr class="tax"><td><b>${tr(tax.inc!==false?'taxIncluded':'taxAdded',{name:taxName,rate:taxRate})}</b></td><td>${eur(tax.valor)}</td></tr>`
      : `<tr class="tax"><td><b>${tr('taxFree',{name:taxName})}</b></td><td>${eur(0)}</td></tr>`)
    : '';

  const v=k=>el('b_'+k).value.trim();

  /* ---- cabeçalho da empresa (opcional) ---- */
  let empresa='';
  if(el('b_on').checked){
    const contactos=[v('morada'),v('contacto'),v('site'),v('nif')?'NIF '+v('nif'):''].filter(Boolean).map(esc).join('\n');
    const ident=[
      LOGO?`<img class="lg" src="${LOGO}" alt="">`:'',
      (v('nome')||v('slogan'))
        ? `<div>${v('nome')?`<div class="en">${esc(v('nome'))}</div>`:''}
             ${v('slogan')?`<div class="es">${esc(v('slogan'))}</div>`:''}</div>`
        : ''
    ].filter(Boolean).join('');
    if(ident||contactos)
      empresa=`<div class="emp"><div class="ei">${ident}</div><div class="ec">${contactos}</div></div>`;
  }

  /* ---- máquinas usadas (opcional, por mesa) ---- */
  const maq=(x.maquinas&&x.maquinas.length)
    ? `<div class="maq"><b>Produzido em:</b> ${x.maquinas.map(q=>
        `${esc(q.n)}${q.mesas.length>1||x.nMesas>1?` (${q.mesas.length} ${q.mesas.length>1?'mesas':'mesa'} · ${hm(q.t)})`:''}`
      ).join(' · ')}</div>` : '';

  /* ---- filamentos por mesa (só quando o trabalho leva mais do que um) ---- */
  const fil=(x.filPorMesa&&x.filPorMesa.length)
    ? `<div class="maq"><b>Filamento:</b> ${x.filPorMesa.map(m=>
        `mesa ${m.i} — ${m.f.map(esc).join(' + ')}`).join(' · ')}</div>` : '';

  /* ---- mensagem ao cliente ---- */
  const msg=(el('b_on').checked&&v('msg')) ? `<div class="msg">${esc(v('msg'))}</div>` : '';

  /* ---- nota de validade: texto livre e desligável ---- */
  const nota=(el('f_on').checked&&v('nota')) ? `${esc(v('nota'))}<br>` : '';

  /* ---- QR codes / imagens ---- */
  const qrs=(el('q_on').checked&&QRS.length)
    ? `<div class="qrs">${QRS.map(q=>{
        const im=q.img?`<img src="${q.img}" alt="">`:qrSVG(q.u,58);
        return im?`<div class="q">${im}${q.t?esc(q.t):''}</div>`:'';
      }).join('')}</div>` : '';

  /* ---- marcas da assinatura: inline, para o PDF sair igual sem depender de ficheiros ----
     os ids dos clip paths levam sufixo próprio para não colidirem com os do cabeçalho da app */
  const fmini=`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Filametria">
      <defs>
        <clipPath id="fBodyQ"><path d="M32 33 L48.97 16.03 A24 24 0 1 1 25.79 9.82 Z"/></clipPath>
        <clipPath id="fWedgeQ"><path d="M32.67 30.49 L26.46 7.31 A24 24 0 0 1 49.64 13.52 Z"/></clipPath>
      </defs>
      <g clip-path="url(#fBodyQ)">
        <path d="M32 33 L48.97 16.03 A24 24 0 1 1 25.79 9.82 Z" fill="#111" opacity=".10"/>
        <g stroke="#111" stroke-width="1.7" opacity=".42">
          <path d="M0 13h64M0 19h64M0 25h64M0 31h64M0 37h64M0 43h64M0 49h64M0 55h64"/>
        </g>
      </g>
      <path d="M32 33 L48.97 16.03 A24 24 0 1 1 25.79 9.82 Z" fill="none" stroke="#111" stroke-width="2.6" stroke-linejoin="round"/>
      <g clip-path="url(#fWedgeQ)">
        <path d="M32.67 30.49 L26.46 7.31 A24 24 0 0 1 49.64 13.52 Z" fill="#ff9f2e"/>
        <g stroke="#a34f00" stroke-width="1.5" opacity=".3"><path d="M0 11h64M0 17h64M0 23h64M0 29h64"/></g>
      </g>
      <path d="M32.67 30.49 L26.46 7.31 A24 24 0 0 1 49.64 13.52 Z" fill="none" stroke="#ff8a1f" stroke-width="2.6" stroke-linejoin="round"/>
      <circle cx="32" cy="33" r="2.9" fill="#111"/>
    </svg>`;

  const dlx=`<b style="font-size:13px;letter-spacing:0.5px">Filametria</b>`;

  const projeto=(el('j_projeto').value||'').trim();
  const spec = x.temImp
    ? `<div class="spec">
      <div><span>Material</span><b>${esc(x.material)}</b></div>
      <div><span>Quantidade</span><b>${x.pecas} peça(s)</b></div>
      <div><span>Peso total</span><b>${Math.round(x.gTot)} g</b></div>
      <div><span>Tempo de impressão</span><b>${hm(x.mTot)}</b></div>
    </div>` : '';
  /* o prazo sai do tempo de máquina: sem impressão não há prazo de produção a citar */
  const prazo = x.temImp
    ? `Prazo de produção estimado: ${Math.max(1,Math.ceil(x.mTot/60/8))} dia(s) útil(eis) de impressão${x.portes>0?', mais o tempo de transporte':''}.<br>
    Peso e tempo indicados são estimativas do fatiamento e podem variar ligeiramente na produção.`
    : (x.portes>0?'Prazo de entrega conforme o serviço de transporte escolhido.':'');
  el('printable').innerHTML=`<div class="pq">
    ${empresa}
    <div class="hd">
      <div class="ttl"><div><h1>Orçamento</h1><div class="s">Impressão 3D · fabrico por encomenda</div></div></div>
      <div class="dt">${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</div>
    </div>
    <div class="cli">Para: <b>${esc(el('j_cliente').value)||'—'}</b>${projeto?` · Projeto: <b>${esc(projeto)}</b>`:''}</div>
    ${spec}
    <table>${html}${taxHtml}<tr class="tot"><td>Total</td><td>${eur(x.total)}</td></tr></table>
    ${x.pecas>1?`<div class="pu">${eur(x.total/x.pecas)} por peça</div>`:''}
    ${maq}
    ${fil}
    ${msg}
    ${nota||prazo?`<div class="foot">${nota}${prazo}</div>`:''}
    <div class="sig">
      <div class="st">
        <div class="pw">Orçamento gerado com ${fmini} <b style="letter-spacing:0">Filametria</b> · powered by ${dlx}</div>
        <i>Filametria — Soluções em impressão 3D, protótipos, produtos próprios e fabrico aditivo por encomenda.</i>
      </div>
      ${qrs}
    </div>
  </div>`;

}
