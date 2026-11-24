/* ═══════════════════════════════════════════════
   DuoTech Barber · cadastros.js  (versão 13)
   Painel → Cadastros: tudo o que a barbearia cadastra e muda sozinha.
   - Serviços (novo, preço, duração, aparece no app, destaque)
   - Planos (assinatura mensal)
   - Prêmios do clube de pontos
   - Endereço e horário de funcionamento
   - Produtos ficam no Estoque (com foto); Clientes no CRM.
   Com login grava no banco; sem login é só exemplo.
═══════════════════════════════════════════════ */
(function(){
'use strict';

const REAL = () => !CONFIG.MODO_DEMO && window.Equipe && Equipe.sb;
const H = s => DB.esc(s);
const pode = () => !REAL() || Equipe.podeEditar !== false;
const CAT = { corte: 'Corte', barba: 'Barba', combo: 'Combo', coloracao: 'Coloração', tratamento: 'Tratamento', estetica: 'Estética', premium: 'Premium', outros: 'Outros' };
const SEM = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
let aba = 'servicos';
let D = null;                 // { servicos, planos, premios, empresa }
let editando = null;          // { tipo, item }
let apagar = null;            // confirmação de remover (2 toques)

/* ─────────────────────────────────────────────
   DADOS
───────────────────────────────────────────── */
async function carregar(){
  if (!REAL()) return D || (D = exemplo());
  const sb = await Equipe.sb(), eid = await Equipe.eid();
  const [s, p, r, e] = await Promise.all([
    sb.from('servicos').select('*').eq('empresa_id', eid).eq('ativo', true).order('categoria').order('ordem').order('nome'),
    sb.from('planos_cliente').select('*').eq('empresa_id', eid).eq('ativo', true).order('ordem').order('preco'),
    sb.from('recompensas').select('*').eq('empresa_id', eid).eq('ativo', true).order('pontos'),
    sb.from('empresas').select('endereco,cidade,horarios,intervalo_agenda').eq('id', eid).maybeSingle(),
  ]);
  for (const x of [s, p, r, e]) if (x.error) throw x.error;
  return (D = { servicos: s.data || [], planos: p.data || [], premios: r.data || [], empresa: e.data || {} });
}
function exemplo(){
  const id = () => 'ex' + Math.random().toString(36).slice(2, 8);
  return {
    servicos: [['Corte', 'corte', 40, 90], ['Barba a vapor', 'barba', 30, 60], ['Corte Infantil', 'corte', 30, 80], ['Prótese Capilar', 'premium', 180, 1900]]
      .map(([nome, categoria, duracao_min, preco]) => ({ id: id(), nome, categoria, duracao_min, preco, aparece_no_link: true, destaque: false, preco_a_partir: false, descricao: '' })),
    planos: [{ id: id(), nome: 'Plano Corte Ilimitado Gold', preco: 160, vantagens: ['Cortes ilimitados no mês'], vigencia: 'Indeterminado', mais_vendido: true, vagas_total: null, descricao: '' }],
    premios: [{ id: id(), nome: 'Corte grátis', pontos: 500, descricao: '' }],
    empresa: { endereco: 'Rua 4, nº 717 - Centro', cidade: 'Orlândia - SP', horarios: { 1: [['09:00', '20:00']], 2: [['09:00', '20:00']], 3: [['09:00', '20:00']], 4: [['09:00', '20:00']], 5: [['09:00', '20:00']], 6: [['09:00', '18:00']] }, intervalo_agenda: 10 },
  };
}
async function gravar(tabela, campos, id){
  if (!REAL()) {
    const lista = { servicos: D.servicos, planos_cliente: D.planos, recompensas: D.premios }[tabela];
    if (id) Object.assign(lista.find(x => x.id === id), campos); else lista.push({ id: 'ex' + Date.now(), ...campos });
    return;
  }
  const sb = await Equipe.sb(), eid = await Equipe.eid();
  const r = id ? await sb.from(tabela).update(campos).eq('id', id).eq('empresa_id', eid)
               : await sb.from(tabela).insert({ ...campos, empresa_id: eid });
  if (r.error) throw r.error;
}
async function desativar(tabela, id){
  if (!REAL()) { for (const k of ['servicos', 'planos', 'premios']) D[k] = D[k].filter(x => x.id !== id); return; }
  const sb = await Equipe.sb(), eid = await Equipe.eid();
  const { error } = await sb.from(tabela).update({ ativo: false }).eq('id', id).eq('empresa_id', eid);
  if (error) throw error;
}
const erroTxt = e => /permission|policy|row-level/i.test(String(e && e.message)) ? 'Só o administrador pode mudar os cadastros.' : 'Não deu para salvar. Confira os campos e tente de novo.';
const num = v => Number(String(v ?? '').replace(/\./g, '').replace(',', '.'));
const precoBR = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─────────────────────────────────────────────
   TELA
───────────────────────────────────────────── */
TELAS.cadastros = async () => {
  try { await carregar(); }
  catch(e){ return `<div class="crm-aviso">Não deu para carregar os cadastros. <a href="#" onclick="navegar('cadastros');return false">Tentar de novo</a></div>`; }
  const ABAS = [['servicos', 'Serviços', D.servicos.length], ['planos', 'Planos', D.planos.length], ['premios', 'Prêmios do clube', D.premios.length], ['horario', 'Endereço e horário'], ['produtos', 'Produtos']];
  const corpo = { servicos: htmlServicos, planos: htmlPlanos, premios: htmlPremios, horario: htmlHorario, produtos: htmlProdutos }[aba]();
  return `
  ${REAL() ? '' : '<div class="crm-aviso">Exemplo: entre com a conta da barbearia para mudar os cadastros de verdade.</div>'}
  ${pode() ? '' : '<div class="crm-aviso">Só o administrador pode mudar os cadastros. Você está vendo como fica.</div>'}
  <div class="filtros">${ABAS.map(([k, t, n]) => `<button class="filtro-btn ${aba === k ? 'ativo' : ''}" onclick="CAD.aba('${k}')">${t}${n != null ? ` <b>${n}</b>` : ''}</button>`).join('')}</div>
  ${corpo}
  <div class="overlay" id="modal-cad"><div class="modal crm-modal"><div class="modal-topo"><h3 id="cadTitulo"></h3>
    <button class="btn-fechar" onclick="fecharModal('modal-cad')" aria-label="Fechar">×</button></div><form id="cadForm" onsubmit="CAD.salvar(event)" novalidate></form></div></div>`;
};

function cab(titulo, sub, botao){
  return `<div class="section-header cad-cab"><div><h2>${titulo}</h2>${sub ? `<p class="text-muted" style="font-size:.78rem;margin-top:2px">${sub}</p>` : ''}</div>
    ${botao && pode() ? `<div class="acoes"><button class="btn-topo primario" onclick="${botao[1]}"><i class="bi bi-plus-lg"></i> ${botao[0]}</button></div>` : ''}</div>`;
}
const vazio = t => `<div class="crm-vazio">${t}</div>`;
const btnApagar = (tipo, id) => pode() ? `<button class="btn-ico ${apagar === id ? 'perigo' : ''}" title="Remover" aria-label="Remover" onclick="event.stopPropagation();CAD.remover('${tipo}','${id}')">${apagar === id ? 'Confirmar?' : '<i class="bi bi-trash"></i>'}</button>` : '';

function htmlServicos(){
  const grupos = {};
  for (const s of D.servicos) (grupos[s.categoria] = grupos[s.categoria] || []).push(s);
  return cab('Serviços', 'Mude o preço direto na lista e toque em Salvar. O app do cliente atualiza na hora.', ['Novo serviço', "CAD.novo('servico')"]) +
    (D.servicos.length ? Object.keys(CAT).filter(k => grupos[k]).map(k => `
    <h4 class="crm-h" style="margin-top:14px">${CAT[k]}</h4>
    <table class="tabela resp cad-tabela"><tbody>
    ${grupos[k].map(s => `<tr>
      <td data-label="Serviço"><b>${H(s.nome)}</b>${s.destaque ? ' <span class="badge accent">Em alta</span>' : ''}${s.aparece_no_link === false ? ' <span class="badge cinza">Só no balcão</span>' : ''}
        <div class="text-muted" style="font-size:.74rem">${s.duracao_min} min${s.descricao ? ' · ' + H(s.descricao) : ''}</div></td>
      <td data-label="Preço"><div class="cad-preco">${s.preco_a_partir ? '<small>a partir de</small>' : ''}<span>R$</span>
        <input inputmode="decimal" value="${precoBR(s.preco)}" aria-label="Preço de ${H(s.nome)}" ${pode() ? '' : 'disabled'} oninput="this.closest('tr').querySelector('.cad-ok').hidden=false">
        <button class="btn-topo primario cad-ok" hidden onclick="CAD.preco('${s.id}', this)">Salvar</button></div></td>
      <td data-label="Ações"><div class="acoes">${pode() ? `<button class="btn-ico" title="Editar" aria-label="Editar ${H(s.nome)}" onclick="CAD.editar('servico','${s.id}')"><i class="bi bi-pencil"></i></button>` : ''}${btnApagar('servico', s.id)}</div></td>
    </tr>`).join('')}
    </tbody></table>`).join('') : vazio('Nenhum serviço ainda. Toque em "Novo serviço".'));
}

function htmlPlanos(){
  return cab('Planos de assinatura', 'O cliente vê e assina pelo app; a mensalidade é paga no Pix.', ['Novo plano', "CAD.novo('plano')"]) +
    (D.planos.length ? `<div class="cad-cards">${D.planos.map(p => `
      <div class="cad-card ${p.mais_vendido ? 'top' : ''}">
        ${p.mais_vendido ? '<span class="badge accent">Mais vendido</span>' : ''}
        <b>${H(p.nome)}</b>
        <span class="cad-valor">${DB.moeda(p.preco)}<small>/mês</small></span>
        <ul>${(p.vantagens || []).map(v => `<li>${H(v)}</li>`).join('')}</ul>
        ${p.vagas_total ? `<small class="text-muted">${p.vagas_total} vagas</small>` : ''}
        <div class="acoes">${pode() ? `<button class="btn-topo" onclick="CAD.editar('plano','${p.id}')"><i class="bi bi-pencil"></i> Editar</button>` : ''}${btnApagar('plano', p.id)}</div>
      </div>`).join('')}</div>` : vazio('Nenhum plano ainda. Toque em "Novo plano".'));
}

function htmlPremios(){
  return cab('Prêmios do clube de pontos', 'O cliente junta pontos a cada atendimento e troca por estes prêmios.', ['Novo prêmio', "CAD.novo('premio')"]) +
    (D.premios.length ? `<table class="tabela resp"><tbody>${D.premios.map(r => `<tr>
      <td data-label="Prêmio"><b>${H(r.nome)}</b>${r.descricao ? `<div class="text-muted" style="font-size:.74rem">${H(r.descricao)}</div>` : ''}</td>
      <td data-label="Pontos"><span class="badge accent">${r.pontos} pontos</span></td>
      <td data-label="Ações"><div class="acoes">${pode() ? `<button class="btn-ico" title="Editar" aria-label="Editar ${H(r.nome)}" onclick="CAD.editar('premio','${r.id}')"><i class="bi bi-pencil"></i></button>` : ''}${btnApagar('premio', r.id)}</div></td>
    </tr>`).join('')}</tbody></table>` : vazio('Nenhum prêmio ainda. Toque em "Novo prêmio".'));
}

function htmlHorario(){
  const e = D.empresa || {}, hr = e.horarios || {};
  return cab('Endereço e horário de funcionamento', 'Aparece no app, no site e no link da bio. O app só oferece horários dentro do funcionamento.') + `
  <form class="section-box cad-horario" onsubmit="CAD.salvarHorario(event)" novalidate>
    <div class="cad-2">
      <div class="campo"><label for="hEnd">Endereço</label><input id="hEnd" maxlength="120" value="${H(e.endereco || '')}" placeholder="Rua 4, nº 717 - Centro" ${pode() ? '' : 'disabled'}></div>
      <div class="campo"><label for="hCid">Cidade</label><input id="hCid" maxlength="60" value="${H(e.cidade || '')}" placeholder="Orlândia - SP" ${pode() ? '' : 'disabled'}></div>
    </div>
    <div class="cad-dias">
    ${[1, 2, 3, 4, 5, 6, 0].map(i => {
      const f = hr[String(i)] || [], aberto = f.length > 0;
      const ini = aberto ? f[0][0] : '09:00', fim = aberto ? f[f.length - 1][1] : '19:00';
      const pausa = f.length > 1 ? [f[0][1], f[1][0]] : ['', ''];
      return `<div class="cad-dia ${aberto ? '' : 'fechado'}" data-dia="${i}">
        <label class="cad-sw"><input type="checkbox" ${aberto ? 'checked' : ''} ${pode() ? '' : 'disabled'} onchange="this.closest('.cad-dia').classList.toggle('fechado', !this.checked)"><span>${SEM[i]}</span></label>
        <div class="cad-horas ${aberto ? '' : ''}">
          <input type="time" value="${ini}" aria-label="${SEM[i]}: abre" ${pode() ? '' : 'disabled'}> às <input type="time" value="${fim}" aria-label="${SEM[i]}: fecha" ${pode() ? '' : 'disabled'}>
          <span class="cad-pausa">almoço <input type="time" value="${pausa[0]}" aria-label="${SEM[i]}: saída do almoço" ${pode() ? '' : 'disabled'}> às <input type="time" value="${pausa[1]}" aria-label="${SEM[i]}: volta do almoço" ${pode() ? '' : 'disabled'}></span>
        </div>
        <span class="cad-fechado-txt">Fechado</span>
      </div>`;
    }).join('')}
    </div>
    ${pode() ? '<button class="btn-modal primario" type="submit" id="hSalvar" style="max-width:260px">Salvar endereço e horário</button>' : ''}
  </form>`;
}

function htmlProdutos(){
  return cab('Produtos') + `<div class="section-box">
    <p style="font-size:.86rem;margin-bottom:12px">Os produtos ficam no <b>Estoque</b>, com foto. Os que têm <b>preço de venda</b> aparecem no app do cliente para reservar.</p>
    <button class="btn-topo primario" onclick="navegar('estoque')"><i class="bi bi-box-seam"></i> Abrir o Estoque</button></div>`;
}

/* ─────────────────────────────────────────────
   FORMULÁRIOS
───────────────────────────────────────────── */
const campo = (id, rot, val, extra = '') => `<div class="campo"><label for="${id}">${rot}</label><input id="${id}" value="${H(val ?? '')}" ${extra}></div>`;
const caixa = (id, rot, marcado) => `<label class="cad-check"><input type="checkbox" id="${id}" ${marcado ? 'checked' : ''}> ${rot}</label>`;

function abrirForm(tipo, item){
  editando = { tipo, item };
  const x = item || {};
  let titulo, html;
  if (tipo === 'servico') {
    titulo = item ? 'Editar serviço' : 'Novo serviço';
    html = campo('cNome', 'Nome do serviço *', x.nome, 'maxlength="60" placeholder="Ex.: Corte degradê"') + `
      <div class="cad-2">
        <div class="campo"><label for="cCat">Tipo</label><select id="cCat">${Object.entries(CAT).map(([k, t]) => `<option value="${k}" ${x.categoria === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        ${campo('cDur', 'Duração (minutos) *', x.duracao_min ?? 30, 'type="number" min="5" max="600" step="5" inputmode="numeric"')}
      </div>
      <div class="cad-2">${campo('cPreco', 'Preço (R$) *', x.preco != null ? precoBR(x.preco) : '', 'inputmode="decimal" placeholder="0,00"')}
        <div class="campo"><label>&nbsp;</label>${caixa('cAPartir', 'Mostrar "a partir de"', x.preco_a_partir)}</div></div>
      ${campo('cDesc', 'Descrição curta (opcional)', x.descricao, 'maxlength="80" placeholder="Ex.: com toalha quente"')}
      ${caixa('cLink', 'Aparece no app do cliente', x.aparece_no_link !== false)}
      ${caixa('cDest', 'Destaque "Em alta"', x.destaque)}`;
  } else if (tipo === 'plano') {
    titulo = item ? 'Editar plano' : 'Novo plano';
    html = campo('cNome', 'Nome do plano *', x.nome, 'maxlength="60" placeholder="Ex.: Corte Ilimitado"') + `
      <div class="cad-2">${campo('cPreco', 'Preço por mês (R$) *', x.preco != null ? precoBR(x.preco) : '', 'inputmode="decimal" placeholder="0,00"')}
        ${campo('cVagas', 'Vagas (deixe vazio = sem limite)', x.vagas_total ?? '', 'type="number" min="1" inputmode="numeric"')}</div>
      <div class="campo"><label for="cVant">O que inclui (uma linha por item)</label><textarea id="cVant" rows="4" maxlength="600" placeholder="Cortes ilimitados no mês&#10;De segunda a quarta">${H((x.vantagens || []).join('\n'))}</textarea></div>
      ${campo('cVig', 'Vigência', x.vigencia || 'Indeterminado', 'maxlength="40"')}
      ${caixa('cTop', 'Marcar como "Mais vendido"', x.mais_vendido)}`;
  } else {
    titulo = item ? 'Editar prêmio' : 'Novo prêmio';
    html = campo('cNome', 'Prêmio *', x.nome, 'maxlength="60" placeholder="Ex.: Corte grátis"') +
      campo('cPts', 'Pontos para trocar *', x.pontos ?? '', 'type="number" min="1" inputmode="numeric"') +
      campo('cDesc', 'Descrição (opcional)', x.descricao, 'maxlength="80"');
  }
  document.getElementById('cadTitulo').textContent = titulo;
  document.getElementById('cadForm').innerHTML = `<div class="erro-form" id="cadErro" hidden></div>${html}
    <button class="btn-modal primario" type="submit" id="cadSalvar">Salvar</button>`;
  _abrirModal('modal-cad');
  setTimeout(() => { const n = document.getElementById('cNome'); if (n && !item) n.focus(); }, 60);
}

async function salvar(ev){
  ev.preventDefault();
  const { tipo, item } = editando || {};
  const v = id => (document.getElementById(id) || {}).value || '';
  const ck = id => !!(document.getElementById(id) || {}).checked;
  const err = t => { const e = document.getElementById('cadErro'); e.textContent = t; e.hidden = false; };
  let tabela, campos;
  if (tipo === 'servico') {
    const preco = num(v('cPreco')), dur = parseInt(v('cDur'), 10);
    if (v('cNome').trim().length < 2) return err('Digite o nome do serviço.');
    if (!(preco >= 0) || v('cPreco').trim() === '') return err('Digite o preço (ex.: 45,00).');
    if (!(dur >= 5 && dur <= 600)) return err('A duração vai de 5 a 600 minutos.');
    tabela = 'servicos';
    campos = { nome: v('cNome').trim(), categoria: v('cCat'), duracao_min: dur, preco, preco_a_partir: ck('cAPartir'),
      descricao: v('cDesc').trim() || null, aparece_no_link: ck('cLink'), destaque: ck('cDest') };
  } else if (tipo === 'plano') {
    const preco = num(v('cPreco')), vagas = v('cVagas').trim() ? parseInt(v('cVagas'), 10) : null;
    if (v('cNome').trim().length < 2) return err('Digite o nome do plano.');
    if (!(preco > 0)) return err('Digite o preço por mês (ex.: 160,00).');
    tabela = 'planos_cliente';
    campos = { nome: v('cNome').trim(), preco, vagas_total: vagas > 0 ? vagas : null, vigencia: v('cVig').trim() || 'Indeterminado',
      vantagens: v('cVant').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12), mais_vendido: ck('cTop') };
  } else {
    const pts = parseInt(v('cPts'), 10);
    if (v('cNome').trim().length < 2) return err('Digite o nome do prêmio.');
    if (!(pts > 0)) return err('Digite quantos pontos o prêmio custa.');
    tabela = 'recompensas';
    campos = { nome: v('cNome').trim(), pontos: pts, descricao: v('cDesc').trim() || null };
  }
  const b = document.getElementById('cadSalvar'); b.disabled = true; b.textContent = 'Salvando…';
  try {
    await gravar(tabela, campos, item && item.id);
    fecharModal('modal-cad'); DB.toast(item ? 'Alteração salva!' : 'Cadastrado!', 'sucesso'); navegar('cadastros');
  } catch(e){ err(erroTxt(e)); b.disabled = false; b.textContent = 'Salvar'; }
}

async function salvarPreco(id, btn){
  const inp = btn.parentElement.querySelector('input'); const preco = num(inp.value);
  if (!(preco >= 0) || inp.value.trim() === '') { DB.toast('Digite o preço (ex.: 45,00).', 'aviso'); return; }
  btn.disabled = true; btn.textContent = '…';
  try { await gravar('servicos', { preco }, id); DB.toast('Preço atualizado!', 'sucesso'); navegar('cadastros'); }
  catch(e){ DB.toast(erroTxt(e), 'erro'); btn.disabled = false; btn.textContent = 'Salvar'; }
}

async function salvarHorario(ev){
  ev.preventDefault();
  const horarios = {};
  for (const el of document.querySelectorAll('.cad-dia')) {
    const [ab, ini, fim, p1, p2] = el.querySelectorAll('input');
    if (!ab.checked) continue;
    if (!ini.value || !fim.value || ini.value >= fim.value) { DB.toast(`Confira o horário de ${SEM[el.dataset.dia]}.`, 'aviso'); return; }
    if (p1.value && p2.value && p1.value > ini.value && p2.value < fim.value && p1.value < p2.value) horarios[el.dataset.dia] = [[ini.value, p1.value], [p2.value, fim.value]];
    else horarios[el.dataset.dia] = [[ini.value, fim.value]];
  }
  const endereco = document.getElementById('hEnd').value.trim() || null, cidade = document.getElementById('hCid').value.trim() || null;
  const b = document.getElementById('hSalvar'); b.disabled = true; b.textContent = 'Salvando…';
  try {
    if (REAL()) {
      const sb = await Equipe.sb(), eid = await Equipe.eid();
      const { error } = await sb.from('empresas').update({ horarios, endereco, cidade }).eq('id', eid);
      if (error) throw error;
    } else Object.assign(D.empresa, { horarios, endereco, cidade });
    DB.toast('Endereço e horário salvos!', 'sucesso'); navegar('cadastros');
  } catch(e){ DB.toast(erroTxt(e), 'erro'); b.disabled = false; b.textContent = 'Salvar endereço e horário'; }
}

async function remover(tipo, id){
  if (apagar !== id) { apagar = id; navegar('cadastros'); setTimeout(() => { if (apagar === id) { apagar = null; } }, 5000); return; }
  apagar = null;
  try { await desativar({ servico: 'servicos', plano: 'planos_cliente', premio: 'recompensas' }[tipo], id); DB.toast('Removido. O histórico continua guardado.', 'sucesso'); navegar('cadastros'); }
  catch(e){ DB.toast(erroTxt(e), 'erro'); }
}

const lista = t => ({ servico: D.servicos, plano: D.planos, premio: D.premios })[t];
window.CAD = {
  aba(k){ aba = k; apagar = null; navegar('cadastros'); },
  novo(t){ abrirForm(t, null); },
  editar(t, id){ abrirForm(t, lista(t).find(x => x.id === id)); },
  salvar, preco: salvarPreco, salvarHorario, remover,
};
if (typeof TITULOS !== 'undefined') TITULOS.cadastros = 'Cadastros';
})();
