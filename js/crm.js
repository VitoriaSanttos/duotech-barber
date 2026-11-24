/* ═══════════════════════════════════════════════
   DuoTech Barber · crm.js  (versão 13)
   Painel: Clientes (CRM) e Campanhas no WhatsApp.
   - Clientes: grupos (assinantes, sumidos, novos, aniversariantes,
     prótese), quanto gasta, de quanto em quanto tempo vem,
     ficha de visagismo e anotações da equipe.
   - Campanhas: escolhe o grupo, ajusta a mensagem e envia um por um
     pelo WhatsApp (cada mensagem abre já escrita).
   Com login usa o banco; sem login mostra exemplos.
═══════════════════════════════════════════════ */
(function(){
'use strict';

const REAL = () => !CONFIG.MODO_DEMO && window.Equipe && Equipe.sb;
const H = s => DB.esc(s);
const DIA = 864e5;
const SUMIDO_DIAS = 45;
let CACHE = null, carregadoEm = 0;
const filtro = { grupo: 'todos', busca: '' };
const camp = { grupo: 'sumidos', textos: {}, enviados: {} };

/* ─────────────────────────────────────────────
   DADOS
───────────────────────────────────────────── */
async function carregar(forcar){
  if (CACHE && !forcar && Date.now() - carregadoEm < 60000) return CACHE;
  CACHE = REAL() ? await carregarBanco() : exemplo();
  carregadoEm = Date.now();
  return CACHE;
}

async function carregarBanco(){
  const sb = await Equipe.sb(), eid = await Equipe.eid();
  const desde = new Date(Date.now() - 400 * DIA).toISOString();
  const [cl, ag, us, pl] = await Promise.all([
    sb.from('clientes').select('id,nome,whatsapp,nascimento,observacoes,ficha,origem,criado_em').eq('empresa_id', eid).order('nome').limit(5000),
    sb.from('agendamentos').select('cliente_id,inicio,preco,desconto,status,servico_nome,pago').eq('empresa_id', eid).gte('inicio', desde).limit(20000),
    sb.from('planos_cliente_usos').select('cliente_id,plano_id,status,proximo_vencimento').eq('empresa_id', eid),
    sb.from('planos_cliente').select('id,nome,preco').eq('empresa_id', eid),
  ]);
  for (const r of [cl, ag, us, pl]) if (r.error) throw r.error;
  const nomePlano = Object.fromEntries((pl.data || []).map(p => [p.id, p]));
  const porCli = {};
  for (const a of ag.data || []) (porCli[a.cliente_id] = porCli[a.cliente_id] || []).push(a);
  const usoPor = {};
  for (const u of us.data || []) if (['ativo', 'aguardando_pagamento', 'atrasado'].includes(u.status)) usoPor[u.cliente_id] = u;
  return (cl.data || []).map(c => montar(c, porCli[c.id] || [], usoPor[c.id], nomePlano));
}

function montar(c, ags, uso, planos){
  const agora = Date.now();
  const feitos = ags.filter(a => a.status === 'concluido').sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  const futuros = ags.filter(a => new Date(a.inicio) > agora && !['cancelado', 'faltou'].includes(a.status)).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  const ultimo = feitos.length ? new Date(feitos[feitos.length - 1].inicio) : null;
  let freq = null;
  if (feitos.length >= 2) freq = Math.round((new Date(feitos[feitos.length - 1].inicio) - new Date(feitos[0].inicio)) / DIA / (feitos.length - 1));
  const anoAtras = agora - 365 * DIA;
  const gasto = feitos.filter(a => new Date(a.inicio) >= anoAtras).reduce((s, a) => s + Math.max(0, Number(a.preco || 0) - Number(a.desconto || 0)), 0);
  const dias = ultimo ? Math.floor((agora - ultimo) / DIA) : null;
  const prot = ags.some(a => /pr[oó]tese/i.test(a.servico_nome || ''));
  const plano = uso ? (planos[uso.plano_id] || {}) : null;
  const nasc = c.nascimento ? new Date(c.nascimento + 'T12:00:00') : null;
  const hoje = new Date();
  const aniv = nasc && nasc.getMonth() === hoje.getMonth();
  const anivHoje = aniv && nasc.getDate() === hoje.getDate();
  const novo = c.criado_em && (agora - new Date(c.criado_em)) < 30 * DIA;
  const sumido = !futuros.length && dias != null && dias > Math.max(SUMIDO_DIAS, (freq || 0) * 2) && feitos.length >= 1;
  const venc = uso && uso.proximo_vencimento ? new Date(uso.proximo_vencimento + 'T12:00:00') : null;
  const grupos = ['todos'];
  if (uso) grupos.push('assinantes');
  if (sumido) grupos.push('sumidos');
  if (novo) grupos.push('novos');
  if (aniv) grupos.push('aniversariantes');
  if (prot) grupos.push('protese');
  return {
    id: c.id, nome: c.nome || 'Cliente', wa: c.whatsapp || '', nascimento: c.nascimento, observacoes: c.observacoes || '',
    ficha: c.ficha || {}, origem: c.origem, desde: c.criado_em, ultimo, dias, freq, gasto, visitas: feitos.length,
    proximo: futuros[0] ? new Date(futuros[0].inicio) : null, plano: plano && plano.nome, usoStatus: uso && uso.status,
    vencimento: venc, anivHoje, grupos,
    hist: feitos.slice(-5).reverse().map(a => ({ s: a.servico_nome, d: new Date(a.inicio) })),
  };
}

function exemplo(){
  const d = n => new Date(Date.now() - n * DIA);
  const base = [
    ['Rafael Souza', '16999994821', 13, 21, 1920, 'Corte Ilimitado Gold', ['assinantes'], 'Prefere sábado de manhã.', { rosto: 'Oval', fio: 'Ondulado, grosso', corte: 'Degradê médio', barba: 'Contorno baixo' }],
    ['Marcos Vieira', '16999991190', 0, 28, 3240, null, ['protese'], 'Sempre com o Thiago. Avisar 2 dias antes da manutenção.', { corte: 'Prótese: fio liso castanho' }],
    ['Diego Ramos', '16999997702', 62, 35, 410, null, ['sumidos'], '', {}],
    ['Pedro Henrique', '16999993345', 21, 28, 560, null, [], 'Vem com o pai.', {}],
    ['André Lima', '16999998810', 9, 14, 2100, 'Corte e Barba Ilimitado Gold', ['assinantes', 'aniversariantes'], '', { barba: 'Cheia desenhada' }],
    ['Gustavo Prado', '16999992209', 47, 21, 780, null, ['sumidos'], '', {}],
    ['Felipe Costa', '16999996631', 5, null, 160, null, ['novos'], 'Veio pelo Instagram.', {}],
  ];
  return base.map(([nome, wa, dias, freq, gasto, plano, g, obs, ficha], i) => ({
    id: 'ex' + i, nome, wa, nascimento: null, observacoes: obs, ficha, origem: 'link', desde: d(400), ultimo: d(dias), dias, freq, gasto,
    visitas: Math.max(1, Math.round(365 / (freq || 365))), proximo: null, plano, usoStatus: plano ? 'ativo' : null,
    vencimento: plano ? new Date(Date.now() + (i + 2) * DIA) : null, anivHoje: g.includes('aniversariantes'), grupos: ['todos', ...g],
    hist: [{ s: 'Corte', d: d(dias) }],
  }));
}

/* ─────────────────────────────────────────────
   AJUDANTES
───────────────────────────────────────────── */
const GRUPOS = [
  ['todos', 'Todos'], ['assinantes', 'Assinantes'], ['sumidos', 'Sumidos'], ['novos', 'Novos'],
  ['aniversariantes', 'Aniversariantes do mês'], ['protese', 'Prótese'],
];
const dataC = d => d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';
const haDias = n => n == null ? 'nunca veio' : n === 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`;
const frq = n => n == null ? '—' : n <= 9 ? `${n} dias` : `${Math.round(n / 7)} semana${Math.round(n / 7) > 1 ? 's' : ''}`;
const fone = w => { let n = String(w || '').replace(/\D/g, ''); if (n.length > 11 && n.startsWith('55')) n = n.slice(2);
  return n.length >= 10 ? `(${n.slice(0, 2)}) ${n.slice(2, -4)}-${n.slice(-4)}` : (w || ''); };
const primeiro = n => String(n || '').trim().split(/\s+/)[0];
const iniciais = n => String(n || '').split(/\s+/).filter(p => p && !/^(d[aeo]s?)$/i.test(p)).slice(0, 2).map(p => p[0]).join('').toUpperCase();
function etiqueta(c){
  if (c.grupos.includes('sumidos')) return '<span class="badge vermelho">Sumido</span>';
  if (c.plano) return `<span class="badge accent">${c.usoStatus === 'ativo' ? 'Assinante' : 'Plano pendente'}</span>`;
  if (c.grupos.includes('protese')) return '<span class="badge azul">Prótese</span>';
  if (c.grupos.includes('novos')) return '<span class="badge verde">Novo</span>';
  return '<span class="badge cinza">Ativo</span>';
}

/* ─────────────────────────────────────────────
   TELA CLIENTES (CRM)
───────────────────────────────────────────── */
TELAS.clientes = async () => {
  let lista;
  try { lista = await carregar(); }
  catch(e){ return `<div class="crm-aviso">Não deu para carregar os clientes agora. <a href="#" onclick="navegar('clientes');return false">Tentar de novo</a></div>`; }
  const contar = g => lista.filter(c => c.grupos.includes(g)).length;
  const q = filtro.busca.toLowerCase().replace(/\D/g, '') || null;
  const termo = filtro.busca.toLowerCase().trim();
  const vis = lista.filter(c => c.grupos.includes(filtro.grupo))
    .filter(c => !termo || c.nome.toLowerCase().includes(termo) || (q && c.wa.includes(q)))
    .sort((a, b) => filtro.grupo === 'sumidos' ? (b.dias || 0) - (a.dias || 0) : b.gasto - a.gasto);
  const gastoAno = lista.reduce((s, c) => s + c.gasto, 0);
  return `
  ${REAL() ? '' : '<div class="crm-aviso">Exemplo: entre com a conta da barbearia para ver os clientes de verdade.</div>'}
  <div class="crm-kpis">
    <div class="stat-card"><div class="label">Clientes</div><div class="valor">${lista.length}</div><div class="sub">${contar('novos')} novos nos últimos 30 dias</div></div>
    <div class="stat-card"><div class="label">Assinantes</div><div class="valor">${contar('assinantes')}</div><div class="sub">com plano ativo ou pendente</div></div>
    <div class="stat-card ${contar('sumidos') ? 'destaque' : ''}"><div class="label">Sumidos</div><div class="valor">${contar('sumidos')}</div><div class="sub">sem vir há mais de ${SUMIDO_DIAS} dias</div></div>
    <div class="stat-card"><div class="label">Gasto no último ano</div><div class="valor">${DB.moeda(gastoAno)}</div><div class="sub">atendimentos concluídos</div></div>
  </div>
  <div class="section-header crm-cab">
    <div class="filtros" style="margin:0">
      ${GRUPOS.map(([k, t]) => `<button class="filtro-btn ${filtro.grupo === k ? 'ativo' : ''}" onclick="CRM.grupo('${k}')">${t} <b>${contar(k)}</b></button>`).join('')}
    </div>
    <div class="acoes">
      <input type="search" class="crm-busca" placeholder="Buscar por nome ou WhatsApp" value="${H(filtro.busca)}" oninput="CRM.buscar(this.value)" aria-label="Buscar cliente">
      <button class="btn-topo primario" onclick="CRM.novo()"><i class="bi bi-person-plus"></i> Novo cliente</button>
      ${filtro.grupo !== 'todos' ? `<button class="btn-topo primario" onclick="CRM.campanha('${filtro.grupo}')"><i class="bi bi-whatsapp"></i> Chamar este grupo</button>` : ''}
    </div>
  </div>
  ${vis.length ? `
  <table class="tabela resp crm-tabela">
    <thead><tr><th>Cliente</th><th>Último atendimento</th><th>Vem a cada</th><th>Gasto no ano</th><th>Situação</th><th></th></tr></thead>
    <tbody>
    ${vis.map(c => `<tr onclick="CRM.abrir('${c.id}')" style="cursor:pointer">
      <td data-label="Cliente"><div style="display:flex;align-items:center;gap:10px">
        <div class="cliente-foto">${H(iniciais(c.nome))}</div>
        <div><div style="font-weight:600">${H(c.nome)}${c.anivHoje ? ' <i class="bi bi-cake2" title="Aniversário hoje" style="color:var(--accent)"></i>' : ''}</div><div class="text-muted" style="font-size:.74rem">${H(fone(c.wa))}</div></div>
      </div></td>
      <td data-label="Último">${haDias(c.dias)}${c.proximo ? `<div class="text-muted" style="font-size:.72rem">volta ${dataC(c.proximo)}</div>` : ''}</td>
      <td data-label="Vem a cada">${frq(c.freq)}</td>
      <td data-label="Gasto no ano" style="font-weight:700">${DB.moeda(c.gasto)}</td>
      <td data-label="Situação">${etiqueta(c)}</td>
      <td data-label="Ações"><div class="acoes"><button class="btn-ico" title="WhatsApp" aria-label="WhatsApp de ${H(c.nome)}" onclick="event.stopPropagation();window.open(DB.linkWa('Oi, ${H(primeiro(c.nome).replace(/['"\\]/g, ''))}!', '${H(c.wa)}'))"><i class="bi bi-whatsapp"></i></button></div></td>
    </tr>`).join('')}
    </tbody>
  </table>` : `<div class="crm-vazio">Ninguém neste grupo${termo ? ' com essa busca' : ''}.</div>`}
  ${htmlModalFicha()}`;
};

function htmlModalFicha(){
  return `<div class="overlay" id="modal-ficha"><div class="modal crm-modal">
    <div class="modal-topo"><h3 id="fichaTitulo">Cliente</h3><button class="btn-fechar" onclick="fecharModal('modal-ficha')" aria-label="Fechar">×</button></div>
    <div id="fichaCorpo"></div></div></div>`;
}

const CAMPOS = [['rosto', 'Formato do rosto', 'Oval, quadrado, redondo…'], ['fio', 'Tipo de fio', 'Liso, ondulado, cacheado…'],
                ['corte', 'Corte indicado', 'Ex.: degradê médio'], ['barba', 'Barba', 'Ex.: contorno baixo']];

function abrir(id){
  const c = (CACHE || []).find(x => x.id === id); if (!c) return;
  document.getElementById('fichaTitulo').textContent = c.nome;
  const f = c.ficha || {};
  document.getElementById('fichaCorpo').innerHTML = `
    <div class="crm-ficha-topo">
      <span>${H(fone(c.wa))}</span>
      ${c.desde ? `<span>cliente desde ${new Date(c.desde).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</span>` : ''}
      ${c.plano ? `<span class="badge accent">${H(c.plano)}</span>` : ''}
    </div>
    <div class="crm-mini">
      <div><small>Gasto no ano</small><b>${DB.moeda(c.gasto)}</b></div>
      <div><small>Vem a cada</small><b>${frq(c.freq)}</b></div>
      <div><small>Último</small><b>${haDias(c.dias)}</b></div>
    </div>
    <div class="crm-ficha-campos">
      <div class="campo"><label for="f_nome">Nome</label><input id="f_nome" maxlength="80" value="${H(c.nome)}"></div>
      <div class="campo"><label for="f_wa">WhatsApp</label><input id="f_wa" type="tel" inputmode="numeric" value="${H(fone(c.wa))}"></div>
      <div class="campo"><label for="f_nasc">Aniversário</label><input id="f_nasc" type="date" value="${H(c.nascimento || '')}"></div>
    </div>
    <h4 class="crm-h">Ficha de visagismo</h4>
    <div class="crm-ficha-campos">
      ${CAMPOS.map(([k, t, ph]) => `<div class="campo"><label for="f_${k}">${t}</label><input id="f_${k}" maxlength="80" placeholder="${ph}" value="${H(f[k] || '')}"></div>`).join('')}
    </div>
    <div class="campo"><label for="f_recado">Recado do barbeiro para o cliente</label><input id="f_recado" maxlength="160" placeholder="Ex.: voltar a cada 3 semanas" value="${H(f.recado || '')}"></div>
    <div class="campo"><label for="f_obs">Anotações da equipe (só a barbearia vê)</label><textarea id="f_obs" rows="3" maxlength="600" placeholder="Ex.: prefere sábado de manhã">${H(c.observacoes)}</textarea></div>
    ${c.hist.length ? `<h4 class="crm-h">Últimos atendimentos</h4><ul class="crm-hist">${c.hist.map(h => `<li><span>${H(h.s)}</span><span>${dataC(h.d)}</span></li>`).join('')}</ul>` : ''}
    <div class="crm-botoes">
      <button class="btn-modal secundario" onclick="window.open(DB.linkWa('Oi, ${H(primeiro(c.nome).replace(/['"\\]/g, ''))}!', '${H(c.wa)}'))"><i class="bi bi-whatsapp"></i> WhatsApp</button>
      <button class="btn-modal primario" id="fichaSalvar" onclick="CRM.salvar('${c.id}')">Salvar ficha</button>
    </div>`;
  _abrirModal('modal-ficha');
}

async function salvar(id){
  const c = (CACHE || []).find(x => x.id === id); if (!c) return;
  const ficha = {}; for (const [k] of CAMPOS.concat([['recado']])) { const v = document.getElementById('f_' + k).value.trim(); if (v) ficha[k] = v; }
  const obs = document.getElementById('f_obs').value.trim();
  const nome = document.getElementById('f_nome').value.trim(), wa = soDigitos(document.getElementById('f_wa').value), nasc = document.getElementById('f_nasc').value || null;
  if (nome.length < 2) { DB.toast('Digite o nome do cliente.', 'aviso'); return; }
  if (wa && (wa.length < 10 || wa.length > 11)) { DB.toast('WhatsApp com DDD: 10 ou 11 números.', 'aviso'); return; }
  const btn = document.getElementById('fichaSalvar'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    if (REAL()) {
      const { error } = await (await Equipe.sb()).from('clientes').update({ ficha, observacoes: obs || null, nome, whatsapp: wa || null, nascimento: nasc }).eq('id', id);
      if (error) throw error;
    }
    c.ficha = ficha; c.observacoes = obs; c.nome = nome; c.wa = wa; c.nascimento = nasc;
    fecharModal('modal-ficha'); DB.toast(REAL() ? 'Ficha salva!' : 'Exemplo: no painel de verdade a ficha fica salva.', 'sucesso');
  } catch(e){ DB.toast(/duplicate|unique/i.test(String(e && e.message)) ? 'Já existe outro cliente com esse WhatsApp.' : 'Não deu para salvar. Tente de novo.', 'erro'); btn.disabled = false; btn.textContent = 'Salvar ficha'; }
  navegar('clientes');
}

const soDigitos = v => { let n = String(v || '').replace(/\D/g, ''); if (n.length > 11 && n.startsWith('55')) n = n.slice(2); return n; };
function novo(){
  document.getElementById('fichaTitulo').textContent = 'Novo cliente';
  document.getElementById('fichaCorpo').innerHTML = `
    <form onsubmit="CRM.criar(event)" novalidate>
      <div class="campo"><label for="n_nome">Nome *</label><input id="n_nome" maxlength="80" autocomplete="off"></div>
      <div class="crm-ficha-campos">
        <div class="campo"><label for="n_wa">WhatsApp com DDD</label><input id="n_wa" type="tel" inputmode="numeric" placeholder="(16) 99999-9999"></div>
        <div class="campo"><label for="n_nasc">Aniversário</label><input id="n_nasc" type="date"></div>
      </div>
      <div class="campo"><label for="n_obs">Anotações (opcional)</label><textarea id="n_obs" rows="2" maxlength="600"></textarea></div>
      <button class="btn-modal primario" type="submit" id="n_salvar">Cadastrar cliente</button>
    </form>`;
  _abrirModal('modal-ficha');
  setTimeout(() => document.getElementById('n_nome').focus(), 60);
}
async function criar(ev){
  ev.preventDefault();
  const nome = document.getElementById('n_nome').value.trim(), wa = soDigitos(document.getElementById('n_wa').value);
  const nasc = document.getElementById('n_nasc').value || null, obs = document.getElementById('n_obs').value.trim() || null;
  if (nome.length < 2) { DB.toast('Digite o nome do cliente.', 'aviso'); return; }
  if (wa && (wa.length < 10 || wa.length > 11)) { DB.toast('WhatsApp com DDD: 10 ou 11 números.', 'aviso'); return; }
  const b = document.getElementById('n_salvar'); b.disabled = true; b.textContent = 'Salvando…';
  try {
    if (REAL()) {
      const sb = await Equipe.sb(), eid = await Equipe.eid();
      const { error } = await sb.from('clientes').insert({ empresa_id: eid, nome, whatsapp: wa || null, nascimento: nasc, observacoes: obs, origem: 'balcao' });
      if (error) throw error;
      await carregar(true);
    } else CACHE.unshift({ ...exemplo()[0], id: 'ex' + Date.now(), nome, wa, nascimento: nasc, observacoes: obs || '', ficha: {}, ultimo: null, dias: null, freq: null, gasto: 0, visitas: 0, plano: null, usoStatus: null, vencimento: null, anivHoje: false, grupos: ['todos', 'novos'], hist: [] });
    fecharModal('modal-ficha'); DB.toast('Cliente cadastrado!', 'sucesso'); filtro.grupo = 'todos'; navegar('clientes');
  } catch(e){
    DB.toast(/duplicate|unique/i.test(String(e && e.message)) ? 'Já existe um cliente com esse WhatsApp.' : 'Não deu para cadastrar. Tente de novo.', 'erro');
    b.disabled = false; b.textContent = 'Cadastrar cliente';
  }
}

/* ─────────────────────────────────────────────
   TELA CAMPANHAS
───────────────────────────────────────────── */
const nomeBarb = () => (CONFIG.BARBEARIA_NOME || 'a barbearia');
const CAMPANHAS = {
  sumidos: { t: 'Sumidos há mais de 45 dias', d: 'Vinham e pararam de vir', filtro: c => c.grupos.includes('sumidos'),
    msg: () => `Fala, {nome}! Aqui é da ${nomeBarb()}. Faz tempo que você não aparece, sentimos sua falta! Tem horário livre essa semana, quer que eu reserve um pra você?` },
  aniversariantes: { t: 'Aniversariantes do mês', d: 'Um parabéns com um mimo', filtro: c => c.grupos.includes('aniversariantes'),
    msg: () => `Parabéns, {nome}! Toda a equipe da ${nomeBarb()} te deseja um ótimo aniversário. Seu próximo corte tem um presente nosso, é só agendar!` },
  vencendo: { t: 'Plano vencendo em 7 dias', d: 'Assinantes com mensalidade chegando', filtro: c => c.vencimento && (c.vencimento - Date.now()) < 7 * DIA,
    msg: () => `Oi, {nome}! Sua mensalidade do plano vence nos próximos dias. O Pix está no app, é só copiar e pagar. Qualquer dúvida, fala com a gente!` },
  protese: { t: 'Clientes de prótese', d: 'Lembrete de manutenção', filtro: c => c.grupos.includes('protese') && !c.proximo,
    msg: () => `Oi, {nome}! Tá chegando a hora da manutenção da sua prótese capilar. Quer garantir seu horário? Responde aqui que a gente reserva.` },
  novos: { t: 'Clientes novos', d: 'Chegaram nos últimos 30 dias', filtro: c => c.grupos.includes('novos'),
    msg: () => `Oi, {nome}! Obrigado por escolher a ${nomeBarb()}. Já conhece nossos planos? Com 2 cortes no mês o plano já vale a pena.` },
};

TELAS.campanhas = async () => {
  let lista;
  try { lista = await carregar(); }
  catch(e){ return `<div class="crm-aviso">Não deu para carregar os clientes agora. <a href="#" onclick="navegar('campanhas');return false">Tentar de novo</a></div>`; }
  const g = CAMPANHAS[camp.grupo] ? camp.grupo : 'sumidos';
  const C = CAMPANHAS[g];
  const pessoas = lista.filter(C.filtro).filter(c => String(c.wa).replace(/\D/g, '').length >= 10);
  const texto = camp.textos[g] ?? C.msg();
  const exNome = pessoas[0] ? primeiro(pessoas[0].nome) : 'Lucas';
  const enviados = pessoas.filter(p => camp.enviados[g + ':' + p.id]).length;
  return `
  ${REAL() ? '' : '<div class="crm-aviso">Exemplo: entre com a conta da barbearia para ver os clientes de verdade.</div>'}
  <p class="text-muted" style="margin-bottom:14px">Escolha quem chamar, ajuste a mensagem e envie. O nome de cada cliente entra sozinho.</p>
  <div class="crm-camp">
    <div class="crm-col">
      <h4 class="crm-h">1 · Para quem</h4>
      ${Object.entries(CAMPANHAS).map(([k, v]) => `<button class="crm-grupo ${k === g ? 'sel' : ''}" onclick="CRM.campanha('${k}')">
        <span><b>${v.t}</b><small>${v.d}</small></span><span class="crm-conta">${lista.filter(v.filtro).length}</span></button>`).join('')}
    </div>
    <div class="crm-col crm-card">
      <h4 class="crm-h">2 · Mensagem</h4>
      <div class="campo"><label for="campTexto">Texto (use {nome} para o nome do cliente)</label>
        <textarea id="campTexto" rows="6" oninput="CRM.texto(this.value)">${H(texto)}</textarea></div>
      <div class="crm-previa"><small>Como o ${H(exNome)} vai receber</small><div id="campPrevia">${H(texto.split('{nome}').join(exNome))}</div></div>
      <p class="text-muted" style="font-size:.74rem;margin-top:8px">Cada mensagem abre no WhatsApp da barbearia já escrita, é só tocar em enviar.</p>
    </div>
    <div class="crm-col crm-card">
      <h4 class="crm-h" style="display:flex;justify-content:space-between"><span>3 · Enviar</span><span style="color:var(--verde)">${enviados} de ${pessoas.length}</span></h4>
      ${pessoas.length ? pessoas.slice(0, 200).map(p => {
        const ok = camp.enviados[g + ':' + p.id];
        return `<div class="crm-pessoa"><span><b>${H(p.nome)}</b><small>${p.dias != null ? 'último ' + haDias(p.dias) : ''}${p.vencimento ? ' · vence ' + dataC(p.vencimento) : ''}</small></span>
          <button class="crm-enviar ${ok ? 'ok' : ''}" onclick="CRM.enviar('${g}','${p.id}')">${ok ? 'Enviado ✓' : 'Enviar'}</button></div>`;
      }).join('') : '<div class="crm-vazio" style="padding:20px 0">Ninguém neste grupo agora.</div>'}
    </div>
  </div>`;
};

function enviar(g, id){
  const p = (CACHE || []).find(x => x.id === id); if (!p) return;
  const C = CAMPANHAS[g]; const texto = (camp.textos[g] ?? C.msg()).split('{nome}').join(primeiro(p.nome));
  window.open(DB.linkWa(texto, p.wa), '_blank');
  camp.enviados[g + ':' + id] = true; navegar('campanhas');
}

/* ─────────────────────────────────────────────
   LIGAÇÕES
───────────────────────────────────────────── */
let tBusca = null;
window.CRM = {
  grupo(g){ filtro.grupo = g; navegar('clientes'); },
  buscar(v){ filtro.busca = v; clearTimeout(tBusca); tBusca = setTimeout(() => { navegar('clientes'); const i = document.querySelector('.crm-busca'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 350); },
  abrir, salvar, enviar, novo, criar,
  campanha(g){ camp.grupo = ({ assinantes: 'vencendo', todos: 'sumidos' })[g] || g; navegar('campanhas'); },
  texto(v){ camp.textos[camp.grupo] = v; const pv = document.getElementById('campPrevia'); const lista = (CACHE || []).filter(CAMPANHAS[camp.grupo].filtro);
    if (pv) pv.textContent = v.split('{nome}').join(lista[0] ? primeiro(lista[0].nome) : 'Lucas'); },
};
if (typeof TITULOS !== 'undefined') { TITULOS.clientes = 'Clientes'; TITULOS.campanhas = 'Campanhas no WhatsApp'; }
})();
