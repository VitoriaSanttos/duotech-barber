/* ═══════════════════════════════════════════════
   agenda-real.js · Agenda ligada ao banco (painel com login)

   • Lê os horários da tabela `agendamentos` (inclusive os marcados
     pelo app do cliente, que aparecem com o ícone de celular).
   • Novo agendamento: acha ou cadastra o cliente pelo WhatsApp e grava.
   • Abrir um horário: confirmar, concluir (com forma de pagamento),
     faltou, cancelar, remarcar e lembrete no WhatsApp.
   Os pontos do clube entram sozinhos quando o horário é concluído
   e pago (regra que já está no banco).
   No modo demonstração este arquivo não faz nada.
═══════════════════════════════════════════════ */
(function(){
'use strict';
if (CONFIG.MODO_DEMO) return;

const esc = DB.esc;
const R = { itens: [], porId: {}, clientes: null, servicosOk: false };
window.AGENDA_REAL = R;

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hhmm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const soNumeros = t => String(t || '').replace(/\D/g, '');
const fone = t => { const n = soNumeros(t); return n.length > 11 && n.startsWith('55') ? n.slice(2) : n; };   // igual ao banco
const foneBonito = t => { const n = fone(t);
  return n.length === 11 ? `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}` : n; };
const linkWa = (w, msg) => `https://wa.me/55${fone(w)}?text=${encodeURIComponent(msg)}`;
const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao_credito: 'Crédito', cartao_debito: 'Débito', plano: 'Plano', cortesia: 'Cortesia' };

function traduz(e){
  const m = String(e && (e.message || e.details) || e || '');
  if (/agend_sem_conflito_barbeiro|exclusion|23P01/i.test(m + (e && e.code))) return 'Esse profissional já tem horário nesse período. Escolha outro horário ou outro profissional.';
  if (/fim > inicio|check constraint/i.test(m)) return 'Confira o horário.';
  return window.erroEquipe ? window.erroEquipe(e) : m;
}
async function conexao(){ return [await Equipe.sb(), await Equipe.eid()]; }

/* ───── serviços de verdade (para o Novo agendamento) ───── */
async function carregarServicos(){
  if (R.servicosOk) return;
  const [c, eid] = await conexao();
  const { data, error } = await c.from('servicos').select('*').eq('empresa_id', eid).eq('ativo', true).order('ordem').order('nome');
  if (error) throw error;
  if (data && data.length) { SERVICOS.length = 0; data.forEach(s => SERVICOS.push({ ...s, preco: Number(s.preco), duracao_min: Number(s.duracao_min) || 30 })); }
  R.servicosOk = true;
}

/* ───── horários do período ───── */
R.carregar = async function(de, ate){
  const [c, eid] = await conexao();
  await carregarServicos().catch(() => {});
  const ini = new Date(de.getFullYear(), de.getMonth(), de.getDate());
  const fim = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate() + 1);
  const { data, error } = await c.from('agendamentos')
    .select('id,inicio,fim,status,origem,preco,desconto,servico_nome,servico_id,barbeiro_id,cliente_id,observacoes,forma_pagamento,pago,clientes(nome,whatsapp)')
    .eq('empresa_id', eid).gte('inicio', ini.toISOString()).lt('inicio', fim.toISOString())
    .neq('status', 'cancelado').order('inicio');
  if (error) throw error;
  R.itens = (data || []).map(a => {
    const i = new Date(a.inicio), f = new Date(a.fim);
    const minIni = i.getHours() * 60 + i.getMinutes();
    return { id: a.id, data: iso(i), ini: minIni, fim: Math.max(minIni + 15, mesmoDiaMin(i, f)),
      cliente: (a.clientes && a.clientes.nome) || 'Cliente', whatsapp: (a.clientes && a.clientes.whatsapp) || '',
      servico: a.servico_nome || 'Serviço', valor: Math.max(Number(a.preco) - Number(a.desconto || 0), 0),
      barbeiro: a.barbeiro_id || '', status: a.status, origem: a.origem, doApp: a.origem === 'link', raw: a };
  });
  R.porId = Object.fromEntries(R.itens.map(x => [x.id, x]));
};
const mesmoDiaMin = (i, f) => iso(i) === iso(f) ? f.getHours() * 60 + f.getMinutes() : 24 * 60;

/* ───── janela própria (não mexe nas janelas de demonstração) ───── */
function janela(id, html){
  let o = document.getElementById(id);
  if (!o) { o = document.createElement('div'); o.className = 'overlay'; o.id = id; document.body.appendChild(o); }
  o.innerHTML = `<div class="modal">${html}</div>`;
  _abrirModal(id);
  return o;
}
const topo = (id, titulo) => `<div class="modal-topo"><h3>${titulo}</h3><button class="btn-fechar" onclick="fecharModal('${id}')" aria-label="Fechar">×</button></div>`;
const nomeProf = id => (obterBarbeiros().find(b => b.id === id) || {}).nome || 'Sem profissional';
const recarregar = () => { if (window._telaAtual === 'agenda') navegar('agenda'); };

/* ───── abrir um horário ───── */
R.abrir = function(id){
  const x = R.porId[id]; if (!x) return;
  const a = x.raw, i = new Date(a.inicio);
  const quando = i.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) + ' · ' + hhmm(i);
  const st = (window.AGENDA_NOME_STATUS || {})[a.status] || a.status;
  const aberto = ['agendado', 'confirmado', 'em_atendimento'].includes(a.status);
  const nome1 = x.cliente.split(' ')[0];
  const lembrete = `Olá, ${nome1}! Lembrete do seu horário: ${x.servico}, ${quando}${a.barbeiro_id ? ' com ' + nomeProf(a.barbeiro_id) : ''}. Até lá!`;
  janela('modal-ag-real', `${topo('modal-ag-real', '<i class="bi bi-calendar-event" style="color:var(--accent)"></i> Agendamento')}
    <div style="background:var(--bg2);border-radius:var(--r);padding:14px;margin-bottom:12px">
      <div style="font-size:1.1rem;font-weight:800">${esc(x.cliente)}</div>
      <div style="font-size:.82rem;color:var(--muted);margin-top:2px">${esc(quando)} · ${esc(nomeProf(a.barbeiro_id))}</div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        <span class="badge ${{agendado:'amarelo',confirmado:'verde',em_atendimento:'verde',concluido:'cinza',faltou:'vermelho'}[a.status] || 'cinza'}">${esc(st)}</span>
        ${x.doApp ? '<span class="badge azul"><i class="bi bi-phone"></i> Marcado pelo app</span>' : '<span class="badge cinza">Balcão</span>'}
        ${a.pago ? `<span class="badge verde">Pago · ${esc(FORMAS[a.forma_pagamento] || a.forma_pagamento || '')}</span>` : ''}
      </div>
    </div>
    <div class="section-box" style="margin-bottom:12px">
      <div style="font-size:.88rem;font-weight:700">${esc(x.servico)}</div>
      <div style="font-size:.86rem;color:var(--verde);font-weight:700;margin-top:4px">${DB.moeda(x.valor)}</div>
      ${x.whatsapp ? `<div class="text-sm text-muted" style="margin-top:6px"><i class="bi bi-whatsapp"></i> ${esc(foneBonito(x.whatsapp))}</div>` : ''}
      ${a.observacoes ? `<div class="text-sm" style="margin-top:6px">${esc(a.observacoes)}</div>` : ''}
    </div>
    ${aberto ? `
      <button class="btn-modal primario" onclick="AGENDA_REAL.concluir('${a.id}')"><i class="bi bi-check2-all"></i> Concluir atendimento</button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        ${a.status === 'agendado' ? `<button class="btn-modal secundario" onclick="AGENDA_REAL.status('${a.id}','confirmado')"><i class="bi bi-check-lg"></i> Confirmar</button>` : ''}
        <button class="btn-modal secundario" onclick="AGENDA_REAL.remarcar('${a.id}')"><i class="bi bi-arrow-repeat"></i> Remarcar</button>
        ${x.whatsapp ? `<a class="btn-modal secundario" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="${esc(linkWa(x.whatsapp, lembrete))}"><i class="bi bi-whatsapp"></i> Lembrete</a>` : ''}
        <button class="btn-modal secundario" onclick="AGENDA_REAL.status('${a.id}','faltou')"><i class="bi bi-person-x"></i> Faltou</button>
      </div>
      <button class="btn-modal secundario" id="btnCancelarAg" style="margin-top:8px;color:var(--vermelho);border-color:var(--vermelho)" onclick="AGENDA_REAL.cancelar('${a.id}', this)"><i class="bi bi-x-circle"></i> Cancelar horário</button>`
    : `<p class="text-sm text-muted">Este horário já foi ${a.status === 'faltou' ? 'marcado como falta' : 'concluído'}.</p>`}`);
};

R.status = async function(id, st){
  try {
    const { error } = await (await Equipe.sb()).from('agendamentos').update({ status: st }).eq('id', id);
    if (error) throw error;
    fecharModal('modal-ag-real');
    DB.toast({ confirmado: 'Horário confirmado', faltou: 'Marcado como falta' }[st] || 'Salvo', 'sucesso'); recarregar();
  } catch(e){ DB.toast(traduz(e), 'erro', 5000); }
};
R.cancelar = async function(id, btn){
  if (!btn.dataset.ok) { btn.dataset.ok = '1'; btn.innerHTML = 'Toque de novo para cancelar'; setTimeout(() => { delete btn.dataset.ok; btn.innerHTML = '<i class="bi bi-x-circle"></i> Cancelar horário'; }, 3500); return; }
  try {
    const { error } = await (await Equipe.sb()).from('agendamentos').update({ status: 'cancelado', cancelado_por: 'barbearia' }).eq('id', id);
    if (error) throw error;
    fecharModal('modal-ag-real'); DB.toast('Horário cancelado', 'sucesso'); recarregar();
  } catch(e){ DB.toast(traduz(e), 'erro', 5000); }
};

/* concluir: valor final e forma de pagamento */
R.concluir = function(id){
  const x = R.porId[id]; if (!x) return;
  janela('modal-ag-real', `${topo('modal-ag-real', '<i class="bi bi-receipt" style="color:var(--verde)"></i> Concluir atendimento')}
    <div class="text-sm" style="margin-bottom:10px"><b>${esc(x.cliente)}</b> · ${esc(x.servico)}</div>
    <div class="campo"><label for="cValor">Valor cobrado (R$)</label>
      <input id="cValor" inputmode="decimal" value="${String(x.valor.toFixed(2)).replace('.', ',')}"></div>
    <div class="campo"><label for="cForma">Forma de pagamento</label>
      <select id="cForma">${Object.entries(FORMAS).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></div>
    <p class="text-sm text-muted">Pago em dinheiro, Pix ou cartão: o cliente ganha os pontos do clube. Plano e cortesia não dão pontos.</p>
    <button class="btn-modal primario" id="cOk" onclick="AGENDA_REAL.confirmarConclusao('${id}')"><i class="bi bi-check2-all"></i> Concluir</button>`);
};
R.confirmarConclusao = async function(id){
  const x = R.porId[id], btn = document.getElementById('cOk');
  const valor = Number(String(document.getElementById('cValor').value).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(valor) || valor < 0) return DB.toast('Confira o valor.', 'aviso');
  btn.disabled = true;
  try {
    const { error } = await (await Equipe.sb()).from('agendamentos').update({
      status: 'concluido', pago: true, forma_pagamento: document.getElementById('cForma').value,
      preco: valor, desconto: 0 }).eq('id', id);
    if (error) throw error;
    fecharModal('modal-ag-real'); DB.toast(`Atendimento concluído · ${DB.moeda(valor)}`, 'sucesso'); recarregar();
  } catch(e){ DB.toast(traduz(e), 'erro', 5000); btn.disabled = false; }
};

/* remarcar: dia, hora e profissional */
const opcoesProf = sel => '<option value="">Sem preferência</option>' +
  obterBarbeiros().filter(b => b.ativo !== false).map(b => `<option value="${esc(b.id)}" ${b.id === sel ? 'selected' : ''}>${esc(b.nome)}</option>`).join('');
R.remarcar = function(id){
  const x = R.porId[id]; if (!x) return;
  const i = new Date(x.raw.inicio);
  janela('modal-ag-real', `${topo('modal-ag-real', '<i class="bi bi-arrow-repeat" style="color:var(--accent)"></i> Remarcar')}
    <div class="text-sm" style="margin-bottom:10px"><b>${esc(x.cliente)}</b> · ${esc(x.servico)}</div>
    <div class="campo-row">
      <div class="campo"><label for="rDia">Dia</label><input id="rDia" type="date" value="${iso(i)}"></div>
      <div class="campo"><label for="rHora">Horário</label><input id="rHora" type="time" step="300" value="${hhmm(i)}"></div>
    </div>
    <div class="campo"><label for="rProf">Profissional</label><select id="rProf">${opcoesProf(x.raw.barbeiro_id)}</select></div>
    <button class="btn-modal primario" id="rOk" onclick="AGENDA_REAL.salvarRemarcar('${id}')"><i class="bi bi-check-lg"></i> Salvar</button>`);
};
R.salvarRemarcar = async function(id){
  const x = R.porId[id], btn = document.getElementById('rOk');
  const dia = document.getElementById('rDia').value, hora = document.getElementById('rHora').value;
  if (!dia || !hora) return DB.toast('Escolha dia e horário.', 'aviso');
  const dur = new Date(x.raw.fim) - new Date(x.raw.inicio);
  const ini = new Date(`${dia}T${hora}:00`), fim = new Date(ini.getTime() + dur);
  btn.disabled = true;
  try {
    const { error } = await (await Equipe.sb()).from('agendamentos').update({
      inicio: ini.toISOString(), fim: fim.toISOString(), barbeiro_id: document.getElementById('rProf').value || null }).eq('id', id);
    if (error) throw error;
    fecharModal('modal-ag-real'); DB.toast('Horário remarcado', 'sucesso'); recarregar();
  } catch(e){ DB.toast(traduz(e), 'erro', 5000); btn.disabled = false; }
};

/* ───── novo agendamento ───── */
async function listaClientes(){
  if (R.clientes) return R.clientes;
  const [c, eid] = await conexao();
  const { data, error } = await c.from('clientes').select('id,nome,whatsapp').eq('empresa_id', eid).order('nome').limit(3000);
  if (error) throw error;
  return (R.clientes = data || []);
}
window.abrirModalNovoAgendamento = async function(){
  let cls = [];
  try { await carregarServicos(); cls = await listaClientes(); } catch(e){ DB.toast(traduz(e), 'erro'); }
  const agora = new Date(); agora.setMinutes(Math.ceil((agora.getMinutes() + 1) / 15) * 15, 0, 0);
  janela('modal-novo-real', `${topo('modal-novo-real', '<i class="bi bi-calendar-plus" style="color:var(--accent)"></i> Novo agendamento')}
    <div class="campo"><label for="nCli">Cliente</label>
      <input id="nCli" list="nCliLista" autocomplete="off" placeholder="Nome (ou escolha da lista)">
      <datalist id="nCliLista">${cls.map(c => `<option value="${esc(c.nome)}">${c.whatsapp ? esc(foneBonito(c.whatsapp)) : ''}</option>`).join('')}</datalist></div>
    <div class="campo"><label for="nWa">WhatsApp do cliente <span class="text-muted">(opcional)</span></label>
      <input id="nWa" type="tel" inputmode="numeric" placeholder="(16) 99999-9999"></div>
    <div class="campo"><label for="nServ">Serviço</label>
      <select id="nServ">${SERVICOS.map(s => `<option value="${esc(s.id)}">${esc(s.nome)} — ${s.duracao_min} min · ${DB.moeda(s.preco)}</option>`).join('')}</select></div>
    <div class="campo"><label for="nProf">Profissional</label><select id="nProf">${opcoesProf((obterBarbeiros().find(b => b.ativo !== false) || {}).id)}</select></div>
    <div class="campo-row">
      <div class="campo"><label for="nDia">Dia</label><input id="nDia" type="date" value="${iso(agora)}"></div>
      <div class="campo"><label for="nHora">Horário</label><input id="nHora" type="time" step="300" value="${hhmm(agora)}"></div>
    </div>
    <div class="campo"><label for="nObs">Observação <span class="text-muted">(opcional)</span></label><input id="nObs" maxlength="300"></div>
    <button class="btn-modal primario" id="nOk" onclick="AGENDA_REAL.salvarNovo()"><i class="bi bi-check-lg"></i> Salvar agendamento</button>`);
  const cli = document.getElementById('nCli');
  cli.addEventListener('change', () => { const c = cls.find(x => x.nome === cli.value); if (c && c.whatsapp && !document.getElementById('nWa').value) document.getElementById('nWa').value = foneBonito(c.whatsapp); });
};
async function acharOuCriarCliente(nome, wa){
  const [c, eid] = await conexao(), cls = await listaClientes();
  const n = fone(wa);
  let achado = n ? cls.find(x => fone(x.whatsapp) === n) : cls.find(x => x.nome.trim().toLowerCase() === nome.toLowerCase() && !x.whatsapp);
  if (!achado && n) {                                   // pode ter sido criado pelo app agora há pouco
    const { data } = await c.from('clientes').select('id,nome,whatsapp').eq('empresa_id', eid).eq('whatsapp', n).maybeSingle();
    achado = data;
  }
  if (achado) return achado.id;
  const { data, error } = await c.from('clientes').insert({ empresa_id: eid, nome: nome.slice(0, 80), whatsapp: n || null, origem: 'balcao' }).select('id,nome,whatsapp').single();
  if (error) throw error;
  cls.push(data);
  return data.id;
}
R.salvarNovo = async function(){
  const nome = document.getElementById('nCli').value.trim();
  const s = SERVICOS.find(x => String(x.id) === document.getElementById('nServ').value);
  const dia = document.getElementById('nDia').value, hora = document.getElementById('nHora').value;
  if (nome.length < 2) return DB.toast('Digite o nome do cliente.', 'aviso');
  if (!s || !s.id || String(s.id).length < 30) return DB.toast('Escolha um serviço cadastrado.', 'aviso');
  if (!dia || !hora) return DB.toast('Escolha dia e horário.', 'aviso');
  const btn = document.getElementById('nOk'); btn.disabled = true;
  try {
    const [c, eid] = await conexao();
    const cliente_id = await acharOuCriarCliente(nome, document.getElementById('nWa').value);
    const ini = new Date(`${dia}T${hora}:00`), fim = new Date(ini.getTime() + (s.duracao_min || 30) * 60000);
    const { error } = await c.from('agendamentos').insert({ empresa_id: eid, cliente_id, servico_id: s.id, servico_nome: s.nome,
      barbeiro_id: document.getElementById('nProf').value || null, inicio: ini.toISOString(), fim: fim.toISOString(),
      preco: s.preco, origem: 'balcao', status: 'agendado', observacoes: document.getElementById('nObs').value.trim() || null });
    if (error) throw error;
    fecharModal('modal-novo-real'); DB.toast('Agendamento salvo', 'sucesso');
    if (window._telaAtual === 'agenda') navegar('agenda'); else navegar('agenda');
  } catch(e){ DB.toast(traduz(e), 'erro', 6000); btn.disabled = false; }
};
})();
