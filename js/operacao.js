/* ═══════════════════════════════════════════════
   DuoTech Barber · operacao.js
   Telas do dia a dia ligadas ao banco (só fora do ?demo):
   Agenda, Comanda (fechar atendimento), Novo agendamento,
   Clientes e Planos (Pix para conferir).
═══════════════════════════════════════════════ */

if(BANCO.ativo){

const ST = {
  agendado:       {txt:'Agendado',       cor:'cinza'},
  confirmado:     {txt:'Confirmado',     cor:'azul'},
  em_atendimento: {txt:'Na cadeira',     cor:'amarelo'},
  concluido:      {txt:'Fechado',        cor:'verde'},
  faltou:         {txt:'Faltou',         cor:'vermelho'},
  cancelado:      {txt:'Cancelado',      cor:'vermelho'},
};
const _hora = iso => new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const _isoDia = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const _ini = n => (n||'?').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
const _wa = (tel, msg) => DB.linkWa(msg, tel);

/* ─── AGENDA ─── */
let _agendaCache = [];
TELAS_REAIS.agenda = async (params={})=>{
  const dia = params.dia ? new Date(params.dia+'T12:00:00') : new Date();
  const iso = _isoDia(dia);
  window._agendaDia = iso;
  try { _agendaCache = await rpc('painel_agenda', {p_dia: iso}); }
  catch(e){ return `<div class="section-box acao-vazio">${DB.esc(e.message)}</div>`; }
  const ags = _agendaCache, filtro = params.barb || 'todos';
  const conta = s => ags.filter(a=>s.includes(a.status)).length;
  const desloca = n => { const d = new Date(dia); d.setDate(d.getDate()+n); return _isoDia(d); };
  const cols = [...BARBEIROS.map(b=>({id:b.id, nome:b.nome, foto:b.foto_url})), {id:null, nome:'Sem barbeiro'}]
    .filter(c=>filtro==='todos' || c.id===filtro)
    .map(c=>({...c, itens: ags.filter(a=>(a.barbeiro_id||null)===c.id)}))
    .filter(c=>c.id!==null || c.itens.length);
  const titulo = dia.toLocaleDateString('pt-BR',{weekday:'long', day:'numeric', month:'long'});
  return `
<div class="ag-topo">
  <div><h2>${titulo.charAt(0).toUpperCase()+titulo.slice(1)}</h2>
    ${iso!==_isoDia(new Date()) ? `<a class="dash-link" onclick="navegar('agenda')">Voltar para hoje</a>` : ''}</div>
  <div class="ag-nav">
    <button class="btn-topo" onclick="navegar('agenda',{dia:'${desloca(-1)}'})" aria-label="Dia anterior"><i class="bi bi-chevron-left"></i></button>
    <input type="date" value="${iso}" onchange="navegar('agenda',{dia:this.value})" aria-label="Escolher dia">
    <button class="btn-topo" onclick="navegar('agenda',{dia:'${desloca(1)}'})" aria-label="Próximo dia"><i class="bi bi-chevron-right"></i></button>
  </div>
</div>
<div class="ag-acoes">
  <button class="btn-topo" onclick="abrirComanda()"><i class="bi bi-receipt"></i> Nova comanda</button>
  <button class="btn-topo primario" onclick="abrirModalNovoAgendamento('${iso}')"><i class="bi bi-plus-lg"></i> Novo agendamento</button>
</div>
<div class="ag-contadores">
  <div><strong>${ags.filter(a=>a.origem!=='comanda' && a.status!=='cancelado').length}</strong><span>agendamentos</span></div>
  <div><strong>${conta(['em_atendimento','concluido'])}</strong><span><i class="ponto verde"></i> chegaram</span></div>
  <div><strong>${conta(['faltou'])}</strong><span><i class="ponto vermelho"></i> faltaram</span></div>
  <div><strong>${conta(['em_atendimento'])}</strong><span><i class="ponto" style="background:var(--amarelo)"></i> na cadeira</span></div>
  <div><strong>${conta(['concluido'])}</strong><span>fechados</span></div>
</div>
<div class="filtros">
  <button class="filtro-btn ${filtro==='todos'?'ativo':''}" onclick="navegar('agenda',{dia:'${iso}'})">Todos</button>
  ${BARBEIROS.map(b=>`<button class="filtro-btn ${filtro===b.id?'ativo':''}" onclick="navegar('agenda',{dia:'${iso}',barb:'${b.id}'})">${DB.esc(b.nome.split(' ')[0])}</button>`).join('')}
</div>
${!BARBEIROS.length ? `<div class="aviso-exemplo"><i class="bi bi-info-circle"></i> Nenhum barbeiro cadastrado ainda. Peça à DuoTech para cadastrar a equipe.</div>` : ''}
<div class="ag-colunas">
  ${cols.map(c=>`
  <div class="ag-col">
    <div class="ag-col-topo"><div class="acao-av">${c.foto?`<img src="${DB.esc(c.foto)}" alt="">`:_ini(c.nome)}</div>
      <div><strong>${DB.esc(c.nome)}</strong><span>${c.itens.filter(a=>!['cancelado','faltou'].includes(a.status)).length} no dia</span></div></div>
    ${c.itens.length ? c.itens.map(cardAgenda).join('') : `<div class="acao-vazio">Agenda livre.</div>`}
  </div>`).join('')}
</div>`;
};

function cardAgenda(a){
  const s = ST[a.status] || ST.agendado, fechado = ['concluido','cancelado','faltou'].includes(a.status);
  const nome = a.cliente || 'Cliente sem cadastro', primeiro = nome.split(' ')[0];
  const lembrete = `Fala, ${primeiro}! Passando pra lembrar do teu horário hoje às ${_hora(a.inicio)}. Te esperamos!`;
  return `
  <div class="ag-card st-${a.status}">
    <div class="ag-card-topo">
      <strong class="ag-hora">${_hora(a.inicio)}<small> – ${_hora(a.fim)}</small></strong>
      <span class="badge ${s.cor}">${s.txt}</span>
    </div>
    <div class="ag-nome">${DB.esc(nome)} ${a.tem_plano?'<span class="badge accent" title="Tem plano ativo"><i class="bi bi-gem"></i> plano</span>':''} ${a.origem==='link'?'<span class="badge cinza" title="Agendou pelo app">app</span>':''}</div>
    <div class="ag-serv">${DB.esc(a.servico||'')} · ${DB.moeda(Number(a.preco)-Number(a.desconto||0))}</div>
    ${!fechado ? `<div class="ag-btns">
      ${a.status==='agendado' ? `<button onclick="mudarStatus('${a.id}','confirmado')">Confirmar</button>` : ''}
      ${a.status!=='em_atendimento' ? `<button onclick="mudarStatus('${a.id}','em_atendimento')">Chegou</button>` : ''}
      <button class="principal" onclick="abrirComanda('${a.id}')">Fechar comanda</button>
      ${a.whatsapp ? `<a href="${_wa(a.whatsapp, lembrete)}" target="_blank" rel="noopener" title="Lembrar pelo WhatsApp" aria-label="Lembrar pelo WhatsApp"><i class="bi bi-whatsapp"></i></a>` : ''}
      <button class="menos" onclick="mudarStatus('${a.id}','faltou')">Faltou</button>
      <button class="menos" onclick="if(confirm('Cancelar este agendamento?'))mudarStatus('${a.id}','cancelado')">Cancelar</button>
    </div>` : a.status==='concluido' ? `<div class="ag-pago"><i class="bi bi-check2-circle"></i> ${a.forma==='plano'?'Pelo plano':a.forma==='cortesia'?'Cortesia':'Pago'}</div>`
      : `<div class="ag-btns"><button class="menos" onclick="mudarStatus('${a.id}','agendado')">Desfazer</button></div>`}
  </div>`;
}

window.mudarStatus = async (id, status)=>{
  const txt = {confirmado:'Confirmado', em_atendimento:'Cliente na cadeira', faltou:'Marcado como falta', cancelado:'Agendamento cancelado', agendado:'Voltou para agendado'};
  if(await gravar('painel_status', {p_id:id, p_status:status}, txt[status])) navegar('agenda', window._paramsAtual||{});
};

/* ─── NOVO AGENDAMENTO ─── */
window.abrirModalNovoAgendamento = (dia)=>{
  const d = dia || window._agendaDia || _isoDia(new Date());
  _modalCaixa(`
    ${_topoModal('bi-calendar-plus','var(--accent)','Novo agendamento')}
    ${campoCliente('na')}
    <div class="campo"><label for="na-serv">Serviço</label>
      <select id="na-serv">${SERVICOS.map(s=>`<option value="${s.id}">${DB.esc(s.nome)} · ${s.duracao_min} min · ${s.preco_a_partir?'a partir de ':''}${DB.moeda(s.preco)}</option>`).join('')}</select></div>
    <div class="campo"><label for="na-barb">Barbeiro</label>
      <select id="na-barb">${BARBEIROS.map(b=>`<option value="${b.id}">${DB.esc(b.nome)}</option>`).join('')}<option value="">Sem preferência</option></select></div>
    <div class="campo-row">
      <div class="campo"><label for="na-dia">Dia</label><input id="na-dia" type="date" value="${d}"></div>
      <div class="campo"><label for="na-hora">Horário</label><input id="na-hora" type="time" step="300" value="09:00"></div>
    </div>
    <div class="campo"><label for="na-obs">Observação (opcional)</label><input id="na-obs" maxlength="300"></div>
    <button class="btn-modal primario" id="na-btn" onclick="_salvarAgendamento()"><i class="bi bi-check2"></i> Agendar</button>
    <button class="btn-modal secundario" onclick="fecharModal('modal-caixa')">Cancelar</button>`);
  _ligarBuscaCliente('na');
};
window._salvarAgendamento = async ()=>{
  const v = id=>document.getElementById(id).value;
  const btn = document.getElementById('na-btn'); btn.disabled = true;
  const inicio = new Date(`${v('na-dia')}T${v('na-hora')}:00`);
  const r = await gravar('painel_agendar', {p:{servico_id:v('na-serv'), barbeiro_id:v('na-barb')||null, inicio: inicio.toISOString(),
    obs:v('na-obs'), ..._clienteEscolhido('na')}}, 'Agendamento marcado');
  btn.disabled = false;
  if(r){ fecharModal('modal-caixa'); navegar('agenda', {dia: v('na-dia')}); }
};

/* Campo de cliente com busca: escolhe um cadastrado ou digita um novo */
let _clientesBusca = [];
function campoCliente(px, fixo=null){
  if(fixo) return `<div class="campo"><label>Cliente</label><div class="cli-fixo"><strong>${DB.esc(fixo.nome||'Cliente sem cadastro')}</strong></div>
    <input type="hidden" id="${px}-cid" value="${fixo.id||''}"></div>`;
  return `<div class="campo cli-busca"><label for="${px}-cli">Cliente</label>
    <input id="${px}-cli" autocomplete="off" placeholder="Nome ou WhatsApp" maxlength="80">
    <input type="hidden" id="${px}-cid">
    <div class="cli-sug" id="${px}-sug" role="listbox"></div></div>
  <div class="campo" id="${px}-novo" style="display:none"><label for="${px}-wa">WhatsApp do cliente novo (opcional)</label>
    <input id="${px}-wa" inputmode="tel" placeholder="(11) 90000-0000" maxlength="20"></div>`;
}
function _ligarBuscaCliente(px){
  const inp = document.getElementById(`${px}-cli`); if(!inp) return;
  let t;
  inp.addEventListener('input', ()=>{
    document.getElementById(`${px}-cid`).value = '';
    clearTimeout(t); const q = inp.value.trim();
    t = setTimeout(async ()=>{
      const sug = document.getElementById(`${px}-sug`);
      if(q.length < 2){ sug.innerHTML = ''; document.getElementById(`${px}-novo`).style.display = 'none'; return; }
      try { _clientesBusca = await rpc('painel_clientes', {p_busca:q}); } catch(e){ _clientesBusca = []; }
      sug.innerHTML = _clientesBusca.slice(0,6).map((c,i)=>`<button type="button" role="option" onclick="_escolherCliente('${px}',${i})">
        <strong>${DB.esc(c.nome)}</strong><span>${c.whatsapp?DB.esc(c.whatsapp.replace(/^55/,'')):'sem WhatsApp'}${c.plano?` · ${DB.esc(c.plano.nome)}`:''}</span></button>`).join('')
        + `<button type="button" class="cli-novo" onclick="_clienteNovo('${px}')"><i class="bi bi-person-plus"></i> Cadastrar “${DB.esc(q)}” como novo cliente</button>`;
    }, 250);
  });
}
window._escolherCliente = (px, i)=>{
  const c = _clientesBusca[i];
  document.getElementById(`${px}-cli`).value = c.nome; document.getElementById(`${px}-cid`).value = c.id;
  document.getElementById(`${px}-sug`).innerHTML = ''; document.getElementById(`${px}-novo`).style.display = 'none';
  if(px==='cm') _comandaCliente = c;
};
window._clienteNovo = px=>{
  document.getElementById(`${px}-sug`).innerHTML = ''; document.getElementById(`${px}-novo`).style.display = '';
  document.getElementById(`${px}-wa`).focus();
};
function _clienteEscolhido(px){
  const cid = document.getElementById(`${px}-cid`)?.value;
  if(cid) return {cliente_id: cid};
  const nome = document.getElementById(`${px}-cli`)?.value.trim();
  return nome ? {cliente_nome: nome, cliente_whatsapp: document.getElementById(`${px}-wa`)?.value || null} : {};
}

/* ─── COMANDA (fechar atendimento) ─── */
let _comanda = null, _comandaCliente = null;
window.abrirModalPDV = ()=>abrirComanda();
window.abrirComanda = (agId)=>{
  const a = agId ? _agendaCache.find(x=>x.id===agId) : null;
  const serv = a && a.servico_id ? SERVICOS.find(s=>s.id===a.servico_id) : null;
  _comanda = {agendamento_id: a?.id || null, itens: serv ? [{tipo:'servico', id:serv.id, nome:serv.nome, preco:Number(a.preco), qtd:1}] : [],
              forma:'pix', avaliacao:0};
  _comandaCliente = a?.cliente_id ? {id:a.cliente_id, nome:a.cliente} : null;
  _modalCaixa(`
    ${_topoModal('bi-receipt','var(--verde)', a ? `Fechar comanda · ${_hora(a.inicio)}` : 'Nova comanda')}
    ${a ? campoCliente('cm', {id:a.cliente_id, nome:a.cliente}) : campoCliente('cm')}
    <div class="campo"><label for="cm-barb">Barbeiro</label>
      <select id="cm-barb">${BARBEIROS.map(b=>`<option value="${b.id}" ${a&&a.barbeiro_id===b.id?'selected':''}>${DB.esc(b.nome)}</option>`).join('')}<option value="">Sem barbeiro</option></select></div>
    <div class="pdv-box">
      <div class="titulo"><i class="bi bi-scissors"></i> Itens da comanda</div>
      <div id="cm-itens"></div>
      <select id="cm-add" aria-label="Adicionar item" onchange="_addItem(this)">
        <option value="">+ Adicionar serviço ou produto…</option>
        <optgroup label="Serviços">${SERVICOS.map(s=>`<option value="s:${s.id}">${DB.esc(s.nome)} — ${DB.moeda(s.preco)}</option>`).join('')}</optgroup>
        ${BANCO.produtos.length ? `<optgroup label="Produtos">${BANCO.produtos.map(p=>`<option value="p:${p.id}">${DB.esc(p.nome)} — ${DB.moeda(p.preco_venda||0)} (${Number(p.estoque_atual)} em estoque)</option>`).join('')}</optgroup>` : ''}
      </select>
      <div class="pdv-row"><span>Desconto (R$)</span><input id="cm-desc" type="number" min="0" step="0.01" inputmode="decimal" value="0" oninput="_totalComanda()" style="width:100px;text-align:right"></div>
      <div class="pdv-row total"><span style="font-weight:700">Total</span><span class="pv" id="cm-total">R$ 0,00</span></div>
    </div>
    <div style="font-size:.8rem;font-weight:700;margin-bottom:6px">Forma de pagamento</div>
    <div class="pgto-opts cm-formas">
      ${[['pix','bi-qr-code','Pix'],['credito','bi-credit-card','Crédito'],['debito','bi-credit-card-2-back','Débito'],['dinheiro','bi-cash','Dinheiro'],['plano','bi-gem','Plano'],['cortesia','bi-gift','Cortesia']]
        .map(([k,i,t])=>`<button type="button" class="pgto-btn ${k==='pix'?'sel':''}" data-forma="${k}" onclick="_formaComanda('${k}')"><i class="bi ${i}"></i><br>${t}</button>`).join('')}
    </div>
    <div class="text-sm text-muted mt-8" id="cm-aviso"></div>
    <div style="margin:12px 0 4px;text-align:center">
      <div style="font-size:.8rem;font-weight:700;margin-bottom:4px">Como foi o atendimento? (opcional)</div>
      <div class="avaliacao-stars" style="justify-content:center">${[1,2,3,4,5].map(n=>`<span class="star-btn" role="button" aria-label="${n} estrelas" onclick="_estrelas(${n})">★</span>`).join('')}</div>
    </div>
    <button class="btn-modal primario" id="cm-btn" onclick="_fecharComanda()"><i class="bi bi-check2-all"></i> Fechar comanda</button>
    <button class="btn-modal secundario" onclick="fecharModal('modal-caixa')">Cancelar</button>`);
  _ligarBuscaCliente('cm');
  _desenharItens();
};
window._addItem = sel=>{
  const [t, id] = (sel.value||'').split(':'); sel.value = ''; if(!id) return;
  if(t==='s'){ const s = SERVICOS.find(x=>x.id===id); _comanda.itens.push({tipo:'servico', id, nome:s.nome, preco:Number(s.preco), qtd:1}); }
  else { const p = BANCO.produtos.find(x=>x.id===id); _comanda.itens.push({tipo:'produto', id, nome:p.nome, preco:Number(p.preco_venda||0), qtd:1}); }
  _desenharItens();
};
window._precoItem = (i, v)=>{ _comanda.itens[i].preco = Math.max(parseFloat(v)||0, 0); _totalComanda(); };
window._tirarItem = i=>{ _comanda.itens.splice(i,1); _desenharItens(); };
function _desenharItens(){
  document.getElementById('cm-itens').innerHTML = _comanda.itens.length ? _comanda.itens.map((x,i)=>`
    <div class="pdv-row cm-item"><span>${DB.esc(x.nome)}${x.tipo==='produto'?' <small class="text-muted">produto</small>':''}</span>
      <span><input type="number" min="0" step="0.01" value="${x.preco}" aria-label="Preço de ${DB.esc(x.nome)}" onchange="_precoItem(${i},this.value)">
      <button type="button" class="btn-ico" onclick="_tirarItem(${i})" aria-label="Tirar ${DB.esc(x.nome)}"><i class="bi bi-x-lg"></i></button></span></div>`).join('')
    : '<p class="text-sm text-muted">Nenhum item ainda.</p>';
  _totalComanda();
}
function _totalComanda(){
  const bruto = _comanda.itens.reduce((a,x)=>a+x.preco*x.qtd, 0), desc = Math.max(parseFloat(document.getElementById('cm-desc').value)||0, 0);
  const sem = ['plano','cortesia'].includes(_comanda.forma);
  document.getElementById('cm-total').textContent = sem ? `${DB.moeda(0)} (${_comanda.forma==='plano'?'pelo plano':'cortesia'})` : DB.moeda(Math.max(bruto-desc,0));
}
window._formaComanda = f=>{
  _comanda.forma = f;
  document.querySelectorAll('.cm-formas .pgto-btn').forEach(b=>b.classList.toggle('sel', b.dataset.forma===f));
  document.getElementById('cm-aviso').textContent = f==='plano' ? 'Conta um atendimento do plano do cliente. Não gera pontos nem comissão (vai para o Pote).'
    : f==='cortesia' ? 'Não entra no caixa e não gera pontos.' : '';
  _totalComanda();
};
window._estrelas = n=>{ _comanda.avaliacao = n; document.querySelectorAll('#modal-caixa .star-btn').forEach((s,i)=>s.classList.toggle('on', i<n)); };
window._fecharComanda = async ()=>{
  if(!_comanda.itens.length){ DB.toast('Adicione pelo menos um serviço ou produto','erro'); return; }
  const btn = document.getElementById('cm-btn'); btn.disabled = true;
  const r = await gravar('fechar_comanda', {p:{agendamento_id:_comanda.agendamento_id, ..._clienteEscolhido('cm'),
    barbeiro_id: document.getElementById('cm-barb').value || null, itens:_comanda.itens,
    desconto: parseFloat(document.getElementById('cm-desc').value)||0, forma:_comanda.forma, avaliacao:_comanda.avaliacao||null}});
  btn.disabled = false;
  if(r){
    fecharModal('modal-caixa');
    DB.toast(r.total>0 ? `Comanda fechada: ${DB.moeda(r.total)} no caixa` : 'Comanda fechada', 'sucesso');
    await recarregar(['caixa','resumo','base']);
    navegar(window._telaAtual==='caixa' ? 'caixa' : window._telaAtual==='agenda' ? 'agenda' : window._telaAtual||'agenda', window._paramsAtual||{});
  }
};

/* ─── CLIENTES ─── */
TELAS_REAIS.clientes = async (params={})=>{
  let lista = [];
  try { lista = await rpc('painel_clientes', {p_busca: params.q || null}); }
  catch(e){ return `<div class="section-box acao-vazio">${DB.esc(e.message)}</div>`; }
  const planoMaisBarato = PLANOS.length ? Math.min(...PLANOS.map(p=>p.preco)) : 0;
  return `
<div class="section-header">
  <h2>Clientes (${lista.length}${lista.length>=200?'+':''})</h2>
  <div class="acoes"><input type="search" class="busca-cli" placeholder="Buscar por nome ou WhatsApp" value="${DB.esc(params.q||'')}"
    onkeydown="if(event.key==='Enter')navegar('clientes',{q:this.value})" aria-label="Buscar cliente"></div>
</div>
${lista.length ? `<div class="cli-lista">${lista.map(c=>{
  const tel = (c.whatsapp||'').replace(/^55/,''), economia = !c.plano && planoMaisBarato && Number(c.gasto_30d) > planoMaisBarato;
  return `
  <div class="cli-card">
    <div class="acao-av">${_ini(c.nome)}</div>
    <div class="cli-info">
      <strong>${DB.esc(c.nome)}</strong>
      <span>${tel?DB.esc(tel):'sem WhatsApp'} · ${c.visitas} visita${c.visitas==1?'':'s'}${c.ultima?` · última ${new Date(c.ultima).toLocaleDateString('pt-BR')}`:''} · ${c.pontos} pts</span>
      <div class="cli-tags">
        ${c.plano ? `<span class="badge ${c.plano.status==='ativo'?'accent':'amarelo'}"><i class="bi bi-gem"></i> ${DB.esc(c.plano.nome)}${c.plano.status!=='ativo'?' · aguardando Pix':''}</span>` : ''}
        ${economia ? `<span class="badge verde" title="Gastou ${DB.moeda(c.gasto_30d)} em 30 dias">Pagaria menos no plano</span>` : ''}
        ${c.tem_conta ? '<span class="badge cinza">tem conta no app</span>' : ''}
      </div>
    </div>
    <div class="cli-acoes">
      ${tel ? `<a class="acao-whats" href="${_wa(c.whatsapp, `Fala, ${c.nome.split(' ')[0]}! Tudo certo?`)}" target="_blank" rel="noopener" aria-label="WhatsApp de ${DB.esc(c.nome)}"><i class="bi bi-whatsapp"></i></a>` : ''}
      ${c.tem_conta ? `<button class="btn-ico" title="Gerar senha provisória do app" onclick="_senhaCliente('${c.id}','${DB.esc(c.nome).replace(/'/g,'')}','${DB.esc(c.whatsapp||'')}')"><i class="bi bi-key"></i></button>` : ''}
    </div>
  </div>`;}).join('')}</div>` : `<div class="section-box acao-vazio">${params.q?'Nenhum cliente encontrado.':'Nenhum cliente ainda. Eles aparecem aqui quando agendam pelo app ou quando você fecha uma comanda.'}</div>`}`;
};
window._senhaCliente = async (id, nome, wa)=>{
  if(!confirm(`Gerar uma senha provisória para ${nome}? A senha antiga deixa de funcionar.`)) return;
  try {
    const { data, error } = await BANCO.sb.rpc('barbearia_senha_cliente', {p_cliente:id});
    if(error) throw error;
    const msg = `Olá, ${nome.split(' ')[0]}! Sua senha provisória do app é: ${data}. Entre e troque quando quiser.`;
    if(wa) window.open(DB.linkWa(msg, wa), '_blank', 'noopener'); else prompt('Senha provisória (copie e envie ao cliente):', data);
  } catch(e){ DB.toast('Não foi possível gerar a senha agora.','erro'); }
};

/* ─── PLANOS ─── */
TELAS_REAIS.planos = ()=>{
  const r = BANCO.resumo || {}, ass = r.assinantes || {};
  return `
<div class="section-header"><h2>Planos Gold</h2></div>
<p class="text-sm text-muted mb-16">O cliente escolhe o plano no app e paga por <b>Pix</b> direto na conta da barbearia. Quando o Pix cair, confirme aqui: o plano é liberado por 1 mês e a entrada vai para o Financeiro.</p>
${htmlPagamentosPlanos()}
<div class="dash-grid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">
  ${PLANOS.map(p=>`
  <div class="plano-card ${p.mais_vendido?'destaque':''}">
    ${p.mais_vendido?'<div class="plano-tag mais-vendido"><i class="bi bi-fire"></i> Mais vendido</div>':''}
    <div class="plano-nome">${DB.esc(p.nome)}</div>
    <div class="plano-preco">${DB.moeda(p.preco)}<span>/mês</span></div>
    <div class="plano-info"><b>${Number(ass[p.id]||0)}</b> assinante${Number(ass[p.id]||0)===1?'':'s'} ativo${Number(ass[p.id]||0)===1?'':'s'}</div>
    <div class="plano-vagas" style="${p.vagas_restantes==null?'color:var(--muted)':''}">${p.vagas_restantes==null?'Sem limite de vagas':`Restam ${p.vagas_restantes} vagas`}</div>
    <div class="plano-info">${(p.vantagens||[]).map(DB.esc).join(' · ')}</div>
    <div class="plano-acoes"><button class="plano-btn" onclick="copiarLink('planos')"><i class="bi bi-link-45deg"></i> Link</button></div>
  </div>`).join('')}
</div>
<p class="text-sm text-muted">Criar e editar planos pelo painel entra na próxima etapa. Até lá, a DuoTech ajusta pelo banco.</p>`;
};

} /* fim BANCO.ativo */
