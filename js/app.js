/* Filametria — Arranque e inicialização da aplicação */
/* ============ arranque ============ */
drawFils(false); drawModelos();
S_NUM.forEach(k=>el('s_'+k).value=DEF[k]);
el('s_auto_kwh').checked=DEF.auto_kwh;
drawTaxPresets();
el('s_tax_preset').value=DEF.tax_preset;
el('s_tax_nome').value=DEF.tax_nome;
el('s_tax_on').checked=DEF.tax_on;
updateTaxFieldState();
el('srch').innerHTML=BENCH.pesquisas.map(([n,u])=>
  `<button onclick="window.open('${u}','_blank')">${n} ↗</button>`).join('');
drawPrinters(); drawMesas(); drawPortes(); drawPortesSel(); toggleAuto();
drawLogo(); drawQRs(); aplicaMarca();
['b_on','q_on','f_on'].forEach(i=>el(i).addEventListener('change',()=>{ aplicaMarca(); calc(); }));
ligaDobras(); ligaSubdobras(); ligaBlocos(); drawPresets();
el('ver').textContent='v'+VERSAO;
el('s_printer').addEventListener('change',aplicaImpressora);
el('s_fil_nome').addEventListener('change',aplicaFilamento);
['s_fil_kg','s_fil_portes'].forEach(i=>el(i).addEventListener('input',marcaFilamento));
el('s_tax_preset').addEventListener('change',aplicarTaxPreset);
el('s_tax_on').addEventListener('change',calc);
el('s_tax_modo').addEventListener('change',()=>{ updateTaxFieldState(); calc(); guardaEstado(); });
el('s_tax_arred').addEventListener('change',()=>{ calc(); guardaEstado(); });
el('j_mostrar_mod').addEventListener('change',calc);
['s_tax_nome','s_tax_rate'].forEach(i=>el(i).addEventListener('input',marcarTaxCustom));
/* o :not(#filpick *) tira a caixa de procura do seletor: escrever lá dentro
   não é mexer no orçamento, e a cada tecla corria um calc() inteiro */
document.querySelectorAll('input:not(#filpick input),select:not(#filpick select)')
  .forEach(i=>i.addEventListener('input',calc));
el('s_auto_kwh').addEventListener('change',toggleAuto);
['s_iva','s_kwh_add'].forEach(i=>el(i).addEventListener('input',applySpot));
/* j_pecas é derivado das mesas: quem mexe no escalão de desconto é mudaPecas() */
document.querySelectorAll('input:not(#filpick input),select:not(#filpick select)').forEach(i=>{
  i.addEventListener('input',guardaEstado); i.addEventListener('change',guardaEstado);
});
ligaPicker();
ligaBobina();
const ultimo=store.get('ultimo',null);
if(ultimo){ try{ repor(ultimo); }catch(_){ calc(); } } else calc();
aplicarIdioma();
ligaInfoPopups();
procurarAtualizacoes(true);
iniciarMemoriaRemota();
