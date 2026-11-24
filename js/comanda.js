/* ═══════════════════════════════════════════════
   DuoTech Barber · comanda.js  (versão 14)
   Comanda completa ligada ao banco (função barbearia_comanda):
   serviços + produtos com preço editável, desconto, Pix, cartão,
   dinheiro, plano ou cortesia. Grava de uma vez: agenda, financeiro
   (entra no Caixa aberto), comissão, pontos, estoque e uso do plano.
   - Botão "Fechar Atendimento" do topo → comanda de balcão.
   - Agenda → abrir um horário → "Comanda com produtos".
   No modo demonstração continua a janela antiga (js/modais.js).
═══════════════════════════════════════════════ */
(function(){
'use strict';
if (CONFIG.MODO_DEMO) return;
const esc = DB.esc;
const FORMAS_CM = [['pix','bi-qr-code','Pix'],['cartao_credito','bi-credit-card','Crédito'],['cartao_debito','bi-credit-card-2-back','Débito'],
                   ['dinheiro','bi-cash','Dinheiro'],['plano','bi-gem','Plano'],['cortesia','bi-gift','Cortesia']];
let cm = null, clientes = null;

async function listaClientes(){
  if (clientes) return clientes;
  const c = await Equipe.sb(), eid = await Equipe.eid();
  const { data } = await c.from('clientes').select('id,nome,whatsapp').eq('empresa_id', eid).order('nome').limit(3000);
  return (clientes = data || []);
}
const fone = t => String(t || '').replace(/\D/g, '');

async function abrir(ag){
  try { await window.recarregarGestao(['base','caixa']); } catch(e){ DB.toast(e.message, 'erro', 5000); return; }
  const G = window.GESTAO;
  const serv = ag && ag.servico_id ? SERVICOS.find(s => s.id === ag.servico_id) : null;
  cm = { agendamento_id: ag ? ag.id : null, cliente: ag && ag.cliente_id ? {id:ag.cliente_id, nome:(ag.clientes && ag.clientes.nome) || 'Cliente'} : null,
         itens: serv ? [{tipo:'servico', id:serv.id, nome:serv.nome, preco:Number(ag.preco ?? serv.preco), qtd:1}] : [], forma:'pix' };
  const barbs = obterBarbeiros().filter(b => b.ativo !== false);
  const caixaFechado = !(G.caixa && G.caixa.aberto);
  _modalCaixa(`
    ${_topoModal('bi-receipt', 'var(--verde)', ag ? 'Comanda do horário' : 'Nova comanda')}
    ${caixaFechado ? `<div class="aviso-exemplo"><i class="bi bi-info-circle"></i> O caixa está fechado. A comanda é registrada, mas só entra na conferência da gaveta com o caixa aberto.</div>` : ''}
    ${cm.cliente ? `<div class="campo"><label>Cliente</label><div class="cli-fixo"><strong>${esc(cm.cliente.nome)}</strong></div></div>` : `
    <div class="campo cli-busca"><label for="cm-cli">Cliente</label>
      <input id="cm-cli" autocomplete="off" placeholder="Nome ou WhatsApp (opcional)" maxlength="80">
      <div class="cli-sug" id="cm-sug" role="listbox"></div></div>
    <div class="campo" id="cm-novo" hidden><label for="cm-wa">WhatsApp do cliente novo (opcional)</label>
      <input id="cm-wa" type="tel" inputmode="numeric" placeholder="(16) 90000-0000" maxlength="20"></div>`}
    <div class="campo"><label for="cm-barb">Profissional</label>
      <select id="cm-barb">${barbs.map(b => `<option value="${esc(b.id)}" ${ag && ag.barbeiro_id === b.id ? 'selected' : ''}>${esc(b.nome)}</option>`).join('')}<option value="">Sem profissional</option></select></div>
    <div class="pdv-box">
      <div class="titulo"><i class="bi bi-scissors"></i> Itens da comanda</div>
      <div id="cm-itens"></div>
      <select id="cm-add" aria-label="Adicionar item" onchange="COMANDA.add(this)">
        <option value="">+ Adicionar serviço ou produto…</option>
        <optgroup label="Serviços">${SERVICOS.map(s => `<option value="s:${esc(s.id)}">${esc(s.nome)} — ${DB.moeda(s.preco)}</option>`).join('')}</optgroup>
        ${(G.produtos || []).length ? `<optgroup label="Produtos">${G.produtos.map(p => `<option value="p:${esc(p.id)}">${esc(p.nome)} — ${DB.moeda(p.preco_venda || 0)} (${Number(p.estoque_atual)} em estoque)</option>`).join('')}</optgroup>` : ''}
      </select>
      <div class="pdv-row"><span>Desconto (R$)</span><input id="cm-desc" type="number" min="0" step="0.01" inputmode="decimal" value="0" oninput="COMANDA.total()" style="width:100px;text-align:right"></div>
      <div class="pdv-row total"><span style="font-weight:700">Total</span><span class="pv" id="cm-total">R$ 0,00</span></div>
    </div>
    <div style="font-size:.8rem;font-weight:700;margin-bottom:6px">Forma de pagamento</div>
    <div class="pgto-opts cm-formas">${FORMAS_CM.map(([k, i, t]) => `<button type="button" class="pgto-btn ${k === 'pix' ? 'sel' : ''}" data-forma="${k}" onclick="COMANDA.forma('${k}')"><i class="bi ${i}"></i><br>${t}</button>`).join('')}</div>
    <div class="text-sm text-muted mt-8" id="cm-aviso"></div>
    <button class="btn-modal primario" id="cm-btn" onclick="COMANDA.fechar()"><i class="bi bi-check2-all"></i> Fechar comanda</button>
    <button class="btn-modal secundario" onclick="fecharModal('modal-caixa')">Cancelar</button>`);
  desenhar();
  const inp = document.getElementById('cm-cli');
  if (inp) {
    let t;
    inp.addEventListener('input', () => { clearTimeout(t); cm.cliente = null; t = setTimeout(async () => {
      const q = inp.value.trim().toLowerCase(), sug = document.getElementById('cm-sug');
      if (q.length < 2) { sug.innerHTML = ''; document.getElementById('cm-novo').hidden = true; return; }
      const lista = (await listaClientes()).filter(c => c.nome.toLowerCase().includes(q) || (fone(q) && fone(c.whatsapp).includes(fone(q)))).slice(0, 6);
      COMANDA._sug = lista;
      sug.innerHTML = lista.map((c, i) => `<button type="button" role="option" onclick="COMANDA.escolher(${i})"><strong>${esc(c.nome)}</strong><span>${esc(c.whatsapp || 'sem WhatsApp')}</span></button>`).join('')
        + `<button type="button" class="cli-novo" onclick="COMANDA.novo()"><i class="bi bi-person-plus"></i> Cadastrar “${esc(inp.value.trim())}” como cliente novo</button>`;
    }, 200); });
  }
}
function desenhar(){
  document.getElementById('cm-itens').innerHTML = cm.itens.length ? cm.itens.map((x, i) => `
    <div class="pdv-row cm-item"><span>${esc(x.nome)}${x.tipo === 'produto' ? ' <small class="text-muted">produto</small>' : ''}</span>
      <span><input type="number" min="0" step="0.01" value="${x.preco}" aria-label="Preço de ${esc(x.nome)}" onchange="COMANDA.preco(${i},this.value)">
      <button type="button" class="btn-ico" onclick="COMANDA.tirar(${i})" aria-label="Tirar ${esc(x.nome)}"><i class="bi bi-x-lg"></i></button></span></div>`).join('')
    : '<p class="text-sm text-muted">Nenhum item ainda.</p>';
  total();
}
function total(){
  const bruto = cm.itens.reduce((a, x) => a + x.preco * x.qtd, 0), desc = Math.max(parseFloat(document.getElementById('cm-desc').value) || 0, 0);
  const sem = ['plano','cortesia'].includes(cm.forma);
  document.getElementById('cm-total').textContent = sem ? `${DB.moeda(0)} (${cm.forma === 'plano' ? 'pelo plano' : 'cortesia'})` : DB.moeda(Math.max(bruto - desc, 0));
}

window.COMANDA = {
  _sug: [],
  add(sel){
    const [t, id] = (sel.value || '').split(':'); sel.value = ''; if (!id) return;
    if (t === 's') { const s = SERVICOS.find(x => x.id === id); cm.itens.push({tipo:'servico', id, nome:s.nome, preco:Number(s.preco), qtd:1}); }
    else { const p = window.GESTAO.produtos.find(x => x.id === id); cm.itens.push({tipo:'produto', id, nome:p.nome, preco:Number(p.preco_venda || 0), qtd:1}); }
    desenhar();
  },
  preco(i, v){ cm.itens[i].preco = Math.max(parseFloat(v) || 0, 0); total(); },
  tirar(i){ cm.itens.splice(i, 1); desenhar(); },
  total,
  forma(f){
    cm.forma = f;
    document.querySelectorAll('.cm-formas .pgto-btn').forEach(b => b.classList.toggle('sel', b.dataset.forma === f));
    document.getElementById('cm-aviso').textContent = f === 'plano' ? 'Conta um atendimento do plano do cliente. Não gera pontos nem comissão.'
      : f === 'cortesia' ? 'Não entra no caixa e não gera pontos.' : '';
    total();
  },
  escolher(i){ const c = COMANDA._sug[i]; cm.cliente = c; document.getElementById('cm-cli').value = c.nome;
    document.getElementById('cm-sug').innerHTML = ''; document.getElementById('cm-novo').hidden = true; },
  novo(){ document.getElementById('cm-sug').innerHTML = ''; document.getElementById('cm-novo').hidden = false; document.getElementById('cm-wa').focus(); },
  async fechar(){
    if (!cm.itens.length) { DB.toast('Adicione pelo menos um serviço ou produto', 'erro'); return; }
    const btn = document.getElementById('cm-btn'); btn.disabled = true;
    const nome = document.getElementById('cm-cli') ? document.getElementById('cm-cli').value.trim() : '';
    const p = { agendamento_id: cm.agendamento_id, barbeiro_id: document.getElementById('cm-barb').value || null,
      itens: cm.itens, desconto: parseFloat(document.getElementById('cm-desc').value) || 0, forma: cm.forma };
    if (cm.cliente) p.cliente_id = cm.cliente.id;
    else if (nome) { p.cliente_nome = nome; p.cliente_whatsapp = (document.getElementById('cm-wa') || {}).value || null; clientes = null; }
    const r = await window.gravarGestao('barbearia_comanda', {p});
    btn.disabled = false;
    if (!r) return;
    fecharModal('modal-caixa');
    DB.toast(r.total > 0 ? `Comanda fechada: ${DB.moeda(r.total)}${r.pontos ? ` · ${r.pontos} pontos` : ''}` : 'Comanda fechada', 'sucesso');
    if (window.agendaInvalidar) window.agendaInvalidar();
    try { await window.recarregarGestao(['caixa','base']); } catch(e){}
    navegar(window._telaAtual || 'inicio', window._paramsAtual || {});
  },
};

/* topo "Fechar Atendimento" → comanda de balcão */
window.abrirModalPDV = () => abrir(null);
/* Agenda → abrir um horário → "Comanda com produtos" */
window.abrirComandaAgendamento = id => {
  const x = window.AGENDA_REAL && AGENDA_REAL.porId && AGENDA_REAL.porId[id];
  abrir(x ? x.raw : null);
};
})();
