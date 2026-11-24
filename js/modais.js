/* ═══════════════════════════════════════════════
   DuoTech Barber v3 · modais.js
   Todos os modais: Novo Agendamento, PDV,
   Ver Agendamento, Adicionar na Fila
═══════════════════════════════════════════════ */

/* ─── HELPERS DE MODAL ─── */
function _abrirModal(id){
  const o = document.getElementById(id);
  if(o){ o.classList.add('aberto'); document.body.style.overflow='hidden'; }
}
function fecharModal(id){
  const o = document.getElementById(id);
  if(o){ o.classList.remove('aberto'); document.body.style.overflow=''; }
}
/* Fechar ao clicar fora */
document.addEventListener('click', e=>{
  if(e.target.classList.contains('overlay')){
    e.target.classList.remove('aberto');
    document.body.style.overflow='';
  }
});

/* ─── INJETAR MODAIS NO DOM ─── */
document.addEventListener('DOMContentLoaded', ()=>{
  const mc = document.getElementById('modais-container');
  if(!mc) return;
  mc.innerHTML = `
    ${_htmlModalNovoAgendamento()}
    ${_htmlModalPDV()}
    ${_htmlModalVerAgendamento()}
    ${_htmlModalFila()}
    ${_htmlModalSatisfacao()}
  `;
  /* Eventos dos modais após inserção */
  _bindModalNovoAgendamento();
  _bindModalPDV();
  /* Estrelas de avaliação dentro dos modais */
  mc.querySelectorAll('.avaliacao-stars').forEach(grupo=>{
    const estrelas=[...grupo.querySelectorAll('.star-btn')];
    estrelas.forEach((s,i)=>s.addEventListener('click',()=>estrelas.forEach((x,j)=>x.classList.toggle('on',j<=i))));
  });
});

/* ═══════════════════════════════════════════════
   MODAL 1: NOVO AGENDAMENTO
═══════════════════════════════════════════════ */
function _htmlModalNovoAgendamento(){
  return `
  <div class="overlay" id="modal-novo-agendamento">
    <div class="modal">
      <div class="modal-topo">
        <h3><i class="bi bi-calendar-plus" style="color:var(--accent)"></i> Novo Agendamento</h3>
        <button class="btn-fechar" onclick="fecharModal('modal-novo-agendamento')">×</button>
      </div>

      <div class="campo">
        <label>Cliente</label>
        <input id="agd-cliente" placeholder="Nome do cliente" list="lista-clientes">
        <datalist id="lista-clientes">
          <option value="Lucas Ferreira">
          <option value="Rafael Souza">
          <option value="Carlos Mendes">
          <option value="André Lima">
        </datalist>
      </div>
      <div class="campo">
        <label>Telefone / WhatsApp</label>
        <input id="agd-tel" type="tel" placeholder="(11) 99999-9999">
      </div>
      <div class="campo-row">
        <div class="campo">
          <label>Data</label>
          <input id="agd-data" type="date">
        </div>
        <div class="campo">
          <label>Horário</label>
          <select id="agd-hora">
            ${['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
               '12:00','13:00','14:00','14:30','15:00','15:30','16:00','16:30',
               '17:00','17:30','18:00','18:30','19:00'].map(h=>`<option>${h}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="campo">
        <label>Profissional</label>
        <select id="agd-barbeiro">
          <option value="">Sem preferência</option>
        </select>
      </div>
      <div class="campo">
        <label>Serviço(s)</label>
        <select id="agd-servico">
          ${SERVICOS.map(s=>`<option value="${s.id}" data-preco="${s.preco}">${s.nome} — ${s.preco_a_partir?'a partir de ':''}${DB.moeda(s.preco)}</option>`).join('')}
        </select>
      </div>

      <!-- Sinal Pix -->
      <div class="sinal-box">
        <div class="titulo"><i class="bi bi-qr-code"></i> Sinal de confirmação (Pix)</div>
        <div class="sinal-opts">
          <div class="sinal-opt" data-sinal="0" onclick="_selecionarSinal(this,0)">
            <div class="sv">Sem sinal</div><div class="sd">Gratuito</div>
          </div>
          <div class="sinal-opt sel" data-sinal="30" onclick="_selecionarSinal(this,30)">
            <div class="sv">R$&nbsp;30</div><div class="sd">~30% do valor</div>
          </div>
          <div class="sinal-opt" data-sinal="50" onclick="_selecionarSinal(this,50)">
            <div class="sv">R$&nbsp;50</div><div class="sd">~50% do valor</div>
          </div>
          <div class="sinal-opt" data-sinal="custom" onclick="_selecionarSinal(this,'custom')">
            <div class="sv">Outro</div><div class="sd">Personalizar</div>
          </div>
        </div>
        <input id="sinal-custom" type="number" placeholder="Valor do sinal (R$)" style="display:none;margin-top:8px;width:100%;border:1.5px solid var(--line2);border-radius:var(--rs);padding:8px 12px;font-size:.82rem">
        <div id="sinal-status" style="font-size:.72rem;color:var(--azul);margin-top:6px">Sinal de R$ 30 será cobrado via Pix (Asaas)</div>
      </div>

      <div class="campo">
        <label>Observações</label>
        <textarea id="agd-obs" rows="2" placeholder="Preferências, alergias, observações…"></textarea>
      </div>

      <button class="btn-modal primario" id="btn-confirmar-agd" onclick="_confirmarAgendamento()">
        <i class="bi bi-check-lg"></i> Confirmar agendamento
      </button>
      <button class="btn-modal secundario" onclick="fecharModal('modal-novo-agendamento')">Cancelar</button>
    </div>
  </div>`;
}
/* Preenche os selects de profissional com a equipe ATIVA (Configurações) */
function _preencherProfissionais(selId){
  const sel = document.getElementById(selId); if(!sel) return;
  const atual = sel.value;
  sel.innerHTML = '<option value="">Sem preferência</option>' +
    obterBarbeiros().filter(b=>b.ativo !== false).map(b=>`<option value="${DB.esc(b.id)}">${DB.esc(b.nome)}</option>`).join('');
  if([...sel.options].some(o=>o.value===atual)) sel.value = atual;
}
function abrirModalNovoAgendamento(){
  _preencherProfissionais('agd-barbeiro');
  /* Pré-preenche data de hoje */
  const inp = document.getElementById('agd-data');
  if(inp && !inp.value) inp.value = DB.hojeISO();
  _abrirModal('modal-novo-agendamento');
}
function _selecionarSinal(el, val){
  document.querySelectorAll('.sinal-opt').forEach(o=>o.classList.remove('sel'));
  el.classList.add('sel');
  const ci = document.getElementById('sinal-custom');
  const st = document.getElementById('sinal-status');
  if(val==='custom'){
    ci.style.display='block';
    st.textContent='Digite o valor do sinal.';
  } else {
    ci.style.display='none';
    st.textContent = val===0
      ? 'Sem cobrança de sinal — agendamento gratuito.'
      : `Sinal de ${DB.moeda(val)} será cobrado via Pix (Asaas)`;
  }
}
function _confirmarAgendamento(){
  const c = document.getElementById('agd-cliente')?.value?.trim();
  const d = document.getElementById('agd-data')?.value;
  const h = document.getElementById('agd-hora')?.value;
  if(!c||!d||!h){ DB.toast('Preencha cliente, data e horário','erro'); return; }
  DB.toast(`Agendamento de ${c} às ${h} confirmado!`,'sucesso');
  fecharModal('modal-novo-agendamento');
}
function _bindModalNovoAgendamento(){
  /* Nada extra por enquanto — binds feitos inline */
}

/* ═══════════════════════════════════════════════
   MODAL 2: PDV — FECHAR ATENDIMENTO
═══════════════════════════════════════════════ */
function _htmlModalPDV(){
  return `
  <div class="overlay" id="modal-pdv">
    <div class="modal">
      <div class="modal-topo">
        <h3><i class="bi bi-receipt" style="color:var(--verde)"></i> Fechar Atendimento</h3>
        <button class="btn-fechar" onclick="fecharModal('modal-pdv')">×</button>
      </div>

      <div style="font-size:.85rem;font-weight:700;margin-bottom:8px" id="pdv-cliente-nome">Lucas Ferreira</div>

      <!-- Itens do atendimento -->
      <div class="pdv-box">
        <div class="titulo"><i class="bi bi-scissors"></i> Serviços realizados</div>
        <div id="pdv-itens">
          <div class="pdv-row"><span>Corte</span><span class="pv">R$ 90,00</span></div>
          <div class="pdv-row"><span>Barba a vapor</span><span class="pv">R$ 60,00</span></div>
          <div class="pdv-row"><span>Risquinho</span><span class="pv">R$ 10,00</span></div>
        </div>
        <!-- Adicionar serviço extra -->
        <select id="pdv-add-serv" style="width:100%;margin-top:8px;border:1.5px solid var(--line2);border-radius:var(--rs);padding:7px 10px;font-size:.8rem">
          <option value="">+ Adicionar serviço extra…</option>
          ${SERVICOS.map(s=>`<option value="${s.id}" data-preco="${s.preco}">${s.nome} — ${DB.moeda(s.preco)}</option>`).join('')}
        </select>
        <div class="pdv-row total">
          <span style="font-weight:700">Total</span>
          <span class="pv" id="pdv-total">R$ 160,00</span>
        </div>
      </div>

      <!-- Desconto -->
      <div class="campo-row" style="margin-bottom:12px">
        <div class="campo">
          <label>Desconto (R$)</label>
          <input id="pdv-desconto" type="number" placeholder="0,00" min="0" oninput="_recalcPDV()">
        </div>
        <div class="campo">
          <label>Já pagou de sinal</label>
          <input id="pdv-sinal-pago" type="number" placeholder="0,00" value="30" readonly style="background:var(--bg2)">
        </div>
      </div>

      <!-- Forma de pagamento -->
      <div style="font-size:.8rem;font-weight:700;margin-bottom:6px">Forma de pagamento</div>
      <div class="pgto-opts">
        <button class="pgto-btn sel" onclick="_selPgto(this)"><i class="bi bi-qr-code"></i><br>Pix</button>
        <button class="pgto-btn" onclick="_selPgto(this)"><i class="bi bi-credit-card"></i><br>Crédito</button>
        <button class="pgto-btn" onclick="_selPgto(this)"><i class="bi bi-credit-card-2-back"></i><br>Débito</button>
        <button class="pgto-btn" onclick="_selPgto(this)"><i class="bi bi-cash"></i><br>Dinheiro</button>
      </div>

      <!-- Pesquisa de satisfação -->
      <div style="margin:14px 0 6px;text-align:center">
        <div style="font-size:.8rem;font-weight:700;margin-bottom:6px">Como foi o atendimento?</div>
        <div class="avaliacao-stars" style="justify-content:center">
          <span class="star-btn" title="1">★</span>
          <span class="star-btn" title="2">★</span>
          <span class="star-btn on" title="3">★</span>
          <span class="star-btn on" title="4">★</span>
          <span class="star-btn on" title="5">★</span>
        </div>
      </div>

      <button class="btn-modal primario" onclick="_finalizarAtendimento()">
        <i class="bi bi-check2-all"></i> Finalizar e registrar
      </button>
      <button class="btn-modal secundario" onclick="fecharModal('modal-pdv')">Cancelar</button>
    </div>
  </div>`;
}
function abrirModalPDV(nome='Cliente'){
  document.getElementById('pdv-cliente-nome').textContent = nome;
  _abrirModal('modal-pdv');
}
function _selPgto(el){
  document.querySelectorAll('.pgto-btn').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel');
}
function _recalcPDV(){
  const base = 160;
  const desc = parseFloat(document.getElementById('pdv-desconto')?.value||0);
  const sinal = parseFloat(document.getElementById('pdv-sinal-pago')?.value||0);
  const restante = Math.max(0, base - desc - sinal);
  document.getElementById('pdv-total').textContent = DB.moeda(restante) + ' (restante)';
}
function _finalizarAtendimento(){
  DB.toast('Atendimento finalizado! 🎉','sucesso');
  fecharModal('modal-pdv');
}
function _bindModalPDV(){
  const sel = document.getElementById('pdv-add-serv');
  if(!sel) return;
  sel.addEventListener('change', ()=>{
    if(!sel.value) return;
    const opt = sel.options[sel.selectedIndex];
    const preco = parseFloat(opt.dataset.preco||0);
    const itens = document.getElementById('pdv-itens');
    const row = document.createElement('div');
    row.className='pdv-row';
    row.innerHTML=`<span>${opt.text.split('—')[0].trim()}</span><span class="pv">${DB.moeda(preco)}</span>`;
    itens.appendChild(row);
    sel.value='';
    DB.toast(`${opt.text.split('—')[0].trim()} adicionado`,'sucesso');
    _recalcPDV();
  });
}

/* ═══════════════════════════════════════════════
   MODAL 3: VER AGENDAMENTO
═══════════════════════════════════════════════ */
function _htmlModalVerAgendamento(){
  return `
  <div class="overlay" id="modal-ver-agendamento">
    <div class="modal">
      <div class="modal-topo">
        <h3><i class="bi bi-calendar-event" style="color:var(--accent)"></i> Agendamento</h3>
        <button class="btn-fechar" onclick="fecharModal('modal-ver-agendamento')">×</button>
      </div>

      <div style="background:var(--bg2);border-radius:var(--r);padding:14px;margin-bottom:14px">
        <div style="font-size:1.1rem;font-weight:800;margin-bottom:2px">Lucas Ferreira</div>
        <div style="font-size:.8rem;color:var(--muted)">📅 Hoje · 10:00 · Thiago Prado</div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <span class="badge verde">Confirmado</span>
          <span class="badge azul"><i class="bi bi-qr-code"></i> Sinal pago R$ 30</span>
        </div>
      </div>

      <div class="section-box" style="margin-bottom:12px">
        <div style="font-size:.8rem;color:var(--muted);margin-bottom:6px">Serviços</div>
        <div style="font-size:.88rem;font-weight:700">Corte + Barba a vapor</div>
        <div style="font-size:.82rem;color:var(--verde);font-weight:700;margin-top:4px">R$ 150,00</div>
      </div>

      <div class="campo-row">
        <div class="campo">
          <label>Telefone</label>
          <div style="padding:9px 12px;border:1.5px solid var(--line2);border-radius:var(--rs);font-size:.82rem">(11) 99999-0001</div>
        </div>
        <div class="campo">
          <label>Status do sinal</label>
          <div style="padding:9px 12px;border:1.5px solid var(--azul);border-radius:var(--rs);font-size:.82rem;color:var(--azul);font-weight:700">Pago ✓</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
        <button class="btn-modal primario" style="flex:1" onclick="fecharModal('modal-ver-agendamento');abrirModalPDV('Lucas Ferreira')">
          <i class="bi bi-receipt"></i> Fechar atendimento
        </button>
        <button class="btn-modal secundario" style="flex:1" onclick="window.open(DB.linkWa('Olá Lucas, lembrete do seu agendamento hoje às 10:00 na Thiago Prado Barbearia!'))">
          <i class="bi bi-whatsapp"></i> Lembrete WA
        </button>
      </div>
      <button class="btn-modal secundario" style="margin-top:8px;color:var(--vermelho);border-color:var(--vermelho)" onclick="DB.toast('Agendamento cancelado','erro');fecharModal('modal-ver-agendamento')">
        <i class="bi bi-x-circle"></i> Cancelar agendamento
      </button>
    </div>
  </div>`;
}
function abrirModalVerAgendamento(){
  _abrirModal('modal-ver-agendamento');
}

/* ═══════════════════════════════════════════════
   MODAL 4: ADICIONAR NA FILA
═══════════════════════════════════════════════ */
function _htmlModalFila(){
  return `
  <div class="overlay" id="modal-fila">
    <div class="modal">
      <div class="modal-topo">
        <h3><i class="bi bi-person-plus" style="color:var(--accent)"></i> Adicionar na Fila</h3>
        <button class="btn-fechar" onclick="fecharModal('modal-fila')">×</button>
      </div>
      <div class="campo">
        <label>Nome do cliente</label>
        <input id="fila-nome" placeholder="Nome (obrigatório)">
      </div>
      <div class="campo">
        <label>Serviço</label>
        <select id="fila-servico">
          ${SERVICOS.map(s=>`<option value="${s.id}">${s.nome}</option>`).join('')}
        </select>
      </div>
      <div class="campo">
        <label>Profissional preferido</label>
        <select id="fila-barbeiro">
          <option value="">Sem preferência</option>
        </select>
      </div>
      <button class="btn-modal primario" onclick="_adicionarFila()">
        <i class="bi bi-plus-lg"></i> Entrar na fila
      </button>
      <button class="btn-modal secundario" onclick="fecharModal('modal-fila')">Cancelar</button>
    </div>
  </div>`;
}
function abrirModalFila(){
  _preencherProfissionais('fila-barbeiro');
  _abrirModal('modal-fila');
}
function _adicionarFila(){
  const nome = document.getElementById('fila-nome')?.value?.trim();
  if(!nome){ DB.toast('Informe o nome do cliente','erro'); return; }
  DB.toast(`${nome} adicionado na fila ✓`,'sucesso');
  fecharModal('modal-fila');
  document.getElementById('fila-nome').value='';
}

/* ═══════════════════════════════════════════════
   MODAL 5: PESQUISA DE SATISFAÇÃO
═══════════════════════════════════════════════ */
function _htmlModalSatisfacao(){
  return `
  <div class="overlay" id="modal-satisfacao">
    <div class="modal">
      <div class="modal-topo">
        <h3><i class="bi bi-star-half" style="color:var(--accent)"></i> Como foi?</h3>
        <button class="btn-fechar" onclick="fecharModal('modal-satisfacao')">×</button>
      </div>
      <div style="text-align:center;padding:8px 0 16px">
        <div style="font-size:.95rem;font-weight:700;margin-bottom:4px">Avalie o seu atendimento</div>
        <div style="font-size:.8rem;color:var(--muted)">Sua opinião melhora o nosso serviço</div>
        <div class="avaliacao-stars" id="stars-satisfacao" style="font-size:2.2rem;margin:14px 0">
          <span class="star-btn" title="1">★</span>
          <span class="star-btn" title="2">★</span>
          <span class="star-btn" title="3">★</span>
          <span class="star-btn" title="4">★</span>
          <span class="star-btn" title="5">★</span>
        </div>
      </div>
      <div class="campo">
        <label>Comentário (opcional)</label>
        <textarea rows="3" placeholder="O que você achou do atendimento?"></textarea>
      </div>
      <button class="btn-modal primario" onclick="DB.toast('Avaliação enviada! Obrigado 🙏','sucesso');fecharModal('modal-satisfacao')">
        Enviar avaliação
      </button>
    </div>
  </div>`;
}
function abrirModalSatisfacao(){
  _abrirModal('modal-satisfacao');
}
