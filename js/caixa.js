/* ═══════════════════════════════════════════════
   DuoTech Barber · caixa.js
   CAIXA do dia: abrir, entradas, saídas, fechar com
   conferência do dinheiro da gaveta e histórico.
   Modo demonstração: tudo fica no navegador (tp_demo_caixa).
   Cada atendimento fechado (Fechar Atendimento) entra aqui.
═══════════════════════════════════════════════ */

const FORMAS = {dinheiro:'Dinheiro', pix:'Pix', credito:'Crédito', debito:'Débito'};
const CAT_ENTRADA = ['Venda avulsa','Reforço de troco','Outros'];
const CAT_SAIDA   = ['Despesa da casa','Compra de produto','Vale de barbeiro','Retirada do dono','Outros'];

function _hora(d=new Date()){ return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }

function _caixaDemo(){
  const hoje = new Date(); hoje.setHours(8,2,0,0);
  const dia = n => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString(); };
  return {
    aberto:true, abertura:hoje.toISOString(), troco_inicial:150,
    movs:[
      {id:1, tipo:'entrada', origem:'comanda', desc:'Lucas F. · Corte + Barba a vapor',  forma:'pix',      valor:150, hora:'09:05'},
      {id:2, tipo:'entrada', origem:'comanda', desc:'Rafael S. · Pigmentação de barba',   forma:'dinheiro', valor:40,  hora:'09:50'},
      {id:3, tipo:'saida',   origem:'manual',  desc:'Café, água e copos',                forma:'dinheiro', valor:32,  hora:'10:10', cat:'Despesa da casa'},
      {id:4, tipo:'entrada', origem:'comanda', desc:'Carlos M. · Manutenção de prótese', forma:'credito',  valor:195, hora:'11:40'},
      {id:5, tipo:'entrada', origem:'comanda', desc:'André L. · Corte raspado + pomada', forma:'debito',   valor:95,  hora:'12:20'},
      {id:6, tipo:'entrada', origem:'manual',  desc:'Pomada efeito matte',               forma:'dinheiro', valor:45,  hora:'13:05', cat:'Venda avulsa'},
    ],
    historico:[
      {data:dia(1), total:1184, esperado:412, contado:412},
      {data:dia(2), total:980,  esperado:236, contado:230},
      {data:dia(3), total:1320, esperado:505, contado:505},
      {data:dia(5), total:870,  esperado:190, contado:200},
    ],
  };
}

function lerCaixa(){
  try { const c = JSON.parse(localStorage.getItem('tp_demo_caixa')||'null'); return c || _caixaDemo(); }
  catch(e){ return _caixaDemo(); }
}
function salvarCaixa(c){ try { localStorage.setItem('tp_demo_caixa', JSON.stringify(c)); } catch(e){} }

function resumoCaixa(c){
  const r = {dinheiro:c.troco_inicial||0, pix:0, credito:0, debito:0, entradas:0, saidas:0};
  c.movs.forEach(m=>{
    const s = m.tipo==='entrada' ? 1 : -1;
    r[m.forma] = (r[m.forma]||0) + s*m.valor;
    if(m.tipo==='entrada') r.entradas += m.valor; else r.saidas += m.valor;
  });
  r.saldo = r.entradas - r.saidas;
  return r;
}

/* Chamado pelo Fechar Atendimento (modais.js) */
function registrarNoCaixa(desc, forma, valor){
  const c = lerCaixa();
  if(!c.aberto){ DB.toast('O caixa está fechado. Abra o caixa para registrar.','aviso'); return false; }
  c.movs.push({id:Date.now(), tipo:'entrada', origem:'comanda', desc, forma, valor, hora:_hora()});
  salvarCaixa(c);
  return true;
}

/* ─── TELA ─── */
TELAS.caixa = ()=>{
  const c = lerCaixa(), r = resumoCaixa(c), f = lerFe();
  const abertura = new Date(c.abertura);
  const movs = [...c.movs].reverse();

  const topo = c.aberto ? `
  <div class="caixa-topo">
    <div>
      <span class="caixa-status aberto"><span></span> Caixa aberto</span>
      <div class="caixa-desde">desde ${abertura.toLocaleDateString('pt-BR',{weekday:'long'})}, ${_hora(abertura)} · troco inicial ${DB.moeda(c.troco_inicial)}</div>
      <div class="caixa-total-lbl">Entrou hoje</div>
      <div class="caixa-total">${DB.moeda(r.entradas)}</div>
      <div class="caixa-desde">saíram ${DB.moeda(r.saidas)} · saldo do dia ${DB.moeda(r.saldo)}</div>
    </div>
    <div class="caixa-botoes">
      <button class="cx-btn verde" onclick="abrirMovCaixa('entrada')"><i class="bi bi-plus-lg"></i> Nova entrada</button>
      <button class="cx-btn vermelho" onclick="abrirMovCaixa('saida')"><i class="bi bi-dash-lg"></i> Nova saída</button>
      <button class="cx-btn escuro" onclick="abrirFecharCaixa()"><i class="bi bi-lock"></i> Fechar caixa</button>
    </div>
  </div>` : `
  <div class="caixa-topo fechado">
    <div>
      <span class="caixa-status"><span></span> Caixa fechado</span>
      <div class="caixa-desde">Abra o caixa para começar a registrar os atendimentos de hoje.</div>
    </div>
    <div class="caixa-botoes">
      <button class="cx-btn verde" onclick="abrirAbrirCaixa()"><i class="bi bi-unlock"></i> Abrir caixa</button>
    </div>
  </div>`;

  return `
${topo}
${c.aberto ? `
<div class="caixa-formas">
  <div class="cx-forma destaque"><i class="bi bi-cash-stack"></i><span>Dinheiro na gaveta</span><strong>${DB.moeda(r.dinheiro)}</strong><small>com o troco</small></div>
  <div class="cx-forma"><i class="bi bi-qr-code"></i><span>Pix</span><strong>${DB.moeda(r.pix)}</strong></div>
  <div class="cx-forma"><i class="bi bi-credit-card"></i><span>Crédito</span><strong>${DB.moeda(r.credito)}</strong></div>
  <div class="cx-forma"><i class="bi bi-credit-card-2-back"></i><span>Débito</span><strong>${DB.moeda(r.debito)}</strong></div>
</div>` : ''}

<div class="grid-2" style="display:grid;grid-template-columns:1.5fr 1fr;gap:16px">
  <div class="section-box">
    <h3 class="box-tit"><i class="bi bi-list-ul"></i> Movimentações de hoje <span class="badge cinza" style="margin-left:auto">${c.movs.length}</span></h3>
    ${movs.length ? movs.map(m=>`
      <div class="cx-mov">
        <div class="cx-mov-ico ${m.tipo}"><i class="bi ${m.tipo==='entrada'?(m.origem==='comanda'?'bi-receipt':'bi-arrow-down-left'):'bi-arrow-up-right'}"></i></div>
        <div class="cx-mov-info">
          <strong>${DB.esc(m.desc)}</strong>
          <span>${m.hora} · ${FORMAS[m.forma]}${m.cat?` · ${DB.esc(m.cat)}`:m.origem==='comanda'?' · comanda':''}</span>
        </div>
        <div class="cx-mov-val ${m.tipo}">${m.tipo==='entrada'?'+':'−'} ${DB.moeda(m.valor)}</div>
      </div>`).join('') : `<div class="acao-vazio">Nenhuma movimentação ainda.</div>`}
  </div>
  <div class="section-box">
    <h3 class="box-tit"><i class="bi bi-clock-history"></i> Caixas anteriores</h3>
    ${c.historico.slice(0,7).map(h=>{
      const dif = Math.round((h.contado - h.esperado)*100)/100;
      const d = new Date(h.data);
      return `
      <div class="cx-hist">
        <div><strong>${(t=>t.charAt(0).toUpperCase()+t.slice(1))(d.toLocaleDateString('pt-BR',{weekday:'long', day:'numeric', month:'short'}))}</strong>
          <span>entrou ${DB.moeda(h.total)}</span></div>
        ${dif===0 ? `<span class="badge verde">Bateu</span>`
          : dif<0 ? `<span class="badge vermelho">Faltou ${DB.moeda(-dif)}</span>`
          : `<span class="badge amarelo">Sobrou ${DB.moeda(dif)}</span>`}
      </div>`;}).join('')}
    <p class="text-muted text-sm mt-8">"Bateu" quer dizer que o dinheiro contado na gaveta foi igual ao que o sistema esperava.</p>
  </div>
</div>`;
};

/* ─── MODAIS DO CAIXA ─── */
function _modalCaixa(html){
  let o = document.getElementById('modal-caixa');
  if(!o){
    o = document.createElement('div'); o.className='overlay'; o.id='modal-caixa';
    document.getElementById('modais-container').appendChild(o);
  }
  o.innerHTML = `<div class="modal">${html}</div>`;
  _abrirModal('modal-caixa');
}
function _topoModal(ico, cor, titulo){
  return `<div class="modal-topo"><h3><i class="bi ${ico}" style="color:${cor}"></i> ${titulo}</h3>
    <button class="btn-fechar" onclick="fecharModal('modal-caixa')">×</button></div>`;
}
function _num(id){ return parseFloat(String(document.getElementById(id)?.value||'0').replace(',','.')) || 0; }

function abrirMovCaixa(tipo){
  const ent = tipo==='entrada';
  _modalCaixa(`
    ${_topoModal(ent?'bi-plus-circle':'bi-dash-circle', ent?'var(--verde)':'var(--vermelho)', ent?'Nova entrada':'Nova saída')}
    <div class="campo"><label>Tipo</label>
      <select id="cx-cat">${(ent?CAT_ENTRADA:CAT_SAIDA).map(x=>`<option>${x}</option>`).join('')}</select></div>
    <div class="campo"><label>Descrição</label>
      <input id="cx-desc" placeholder="${ent?'Ex.: venda de pomada':'Ex.: conta de luz, vale do Marcus'}" maxlength="80"></div>
    <div class="campo-row">
      <div class="campo"><label>Valor (R$)</label><input id="cx-valor" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></div>
      <div class="campo"><label>${ent?'Recebido em':'Saiu do'}</label>
        <select id="cx-forma">${Object.entries(FORMAS).filter(([k])=>ent||k==='dinheiro'||k==='pix').map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
    </div>
    <button class="btn-modal primario" onclick="_salvarMov('${tipo}')"><i class="bi bi-check2"></i> Registrar ${ent?'entrada':'saída'}</button>
    <button class="btn-modal secundario" onclick="fecharModal('modal-caixa')">Cancelar</button>`);
}
function _salvarMov(tipo){
  const valor = _num('cx-valor');
  const cat = document.getElementById('cx-cat').value;
  const desc = document.getElementById('cx-desc').value.trim() || cat;
  if(valor<=0){ DB.toast('Informe o valor','erro'); return; }
  const c = lerCaixa();
  c.movs.push({id:Date.now(), tipo, origem:'manual', desc, cat, forma:document.getElementById('cx-forma').value, valor, hora:_hora()});
  salvarCaixa(c);
  fecharModal('modal-caixa');
  DB.toast(`${tipo==='entrada'?'Entrada':'Saída'} de ${DB.moeda(valor)} registrada`,'sucesso');
  navegar('caixa');
}

function abrirAbrirCaixa(){
  const p = palavraDoDia(), f = lerFe();
  _modalCaixa(`
    ${_topoModal('bi-unlock','var(--verde)','Abrir caixa')}
    ${f.fe_ativa ? `<div class="cx-palavra"><i class="bi bi-book"></i> <div><i>“${p.texto}”</i><br><strong>${p.ref}</strong></div></div>` : ''}
    <div class="campo"><label>Quanto tem de troco na gaveta?</label>
      <input id="cx-troco" type="number" min="0" step="0.01" inputmode="decimal" value="150"></div>
    <button class="btn-modal primario" onclick="_confirmarAbertura()"><i class="bi bi-unlock"></i> Abrir caixa</button>
    <button class="btn-modal secundario" onclick="fecharModal('modal-caixa')">Cancelar</button>`);
}
function _confirmarAbertura(){
  const c = lerCaixa();
  Object.assign(c, {aberto:true, abertura:new Date().toISOString(), troco_inicial:_num('cx-troco'), movs:[]});
  salvarCaixa(c); fecharModal('modal-caixa');
  DB.toast('Caixa aberto. Bom trabalho!','sucesso'); navegar('caixa');
}

function abrirFecharCaixa(){
  const c = lerCaixa(), r = resumoCaixa(c), f = lerFe();
  _modalCaixa(`
    ${_topoModal('bi-lock','var(--ink)','Fechar caixa')}
    <div class="pdv-box" style="background:var(--bg2);border-color:var(--line)">
      <div class="pdv-row"><span>Entrou hoje</span><span class="pv">${DB.moeda(r.entradas)}</span></div>
      <div class="pdv-row"><span>Saiu hoje</span><span class="pv">${DB.moeda(r.saidas)}</span></div>
      <div class="pdv-row"><span>Pix</span><span class="pv">${DB.moeda(r.pix)}</span></div>
      <div class="pdv-row"><span>Cartão (crédito + débito)</span><span class="pv">${DB.moeda(r.credito + r.debito)}</span></div>
      <div class="pdv-row total"><span style="font-weight:700">Deve ter em dinheiro na gaveta</span><span class="pv">${DB.moeda(r.dinheiro)}</span></div>
    </div>
    <div class="campo"><label>Conte o dinheiro da gaveta. Quanto tem?</label>
      <input id="cx-contado" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" oninput="_difCaixa(${r.dinheiro})"></div>
    <div id="cx-dif" class="cx-dif"></div>
    ${f.fe_ativa ? `<div class="cx-palavra"><i class="bi bi-heart"></i><div>
      <strong>Gratidão pelo dia.</strong> “Tudo vem de ti, e do que é teu to damos.” <span class="text-muted">1 Crônicas 29:14</span>
      ${f.fe_dizimo && r.saldo>0 ? `<div class="cx-dizimo">Lembrete do dízimo: 10% do saldo de hoje é <strong>${DB.moeda(r.saldo*0.1)}</strong>.</div>` : ''}
    </div></div>` : ''}
    <button class="btn-modal primario" onclick="_confirmarFechamento()"><i class="bi bi-lock"></i> Fechar caixa</button>
    <button class="btn-modal secundario" onclick="fecharModal('modal-caixa')">Cancelar</button>`);
}
function _difCaixa(esperado){
  const contado = _num('cx-contado'), dif = contado - esperado, el = document.getElementById('cx-dif');
  if(!document.getElementById('cx-contado').value){ el.innerHTML=''; return; }
  el.className = 'cx-dif ' + (Math.abs(dif)<0.005 ? 'ok' : dif<0 ? 'falta' : 'sobra');
  el.innerHTML = Math.abs(dif)<0.005 ? '<i class="bi bi-check-circle-fill"></i> Bateu certinho.'
    : dif<0 ? `<i class="bi bi-exclamation-triangle-fill"></i> Está faltando ${DB.moeda(-dif)}.`
    : `<i class="bi bi-info-circle-fill"></i> Está sobrando ${DB.moeda(dif)}.`;
}
function _confirmarFechamento(){
  if(!document.getElementById('cx-contado').value){ DB.toast('Conte o dinheiro da gaveta e informe o valor','erro'); return; }
  const c = lerCaixa(), r = resumoCaixa(c);
  c.historico.unshift({data:new Date().toISOString(), total:r.entradas, esperado:r.dinheiro, contado:_num('cx-contado')});
  c.aberto = false;
  salvarCaixa(c); fecharModal('modal-caixa');
  DB.toast('Caixa fechado. Deus abençoe o descanso!','sucesso'); navegar('caixa');
}
