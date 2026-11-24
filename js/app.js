/* ═══════════════════════════════════════════════
   DuoTech Barber v3 · app.js
   Roteador + todas as TELAS do painel admin
   e do link público de agendamento
═══════════════════════════════════════════════ */

/* Dados de demonstração: js/dados-demo.js (SERVICOS, PLANOS, BARBEIROS, RECOMPENSAS) */

/* ─── ROTEADOR ─── */
const TELAS = {};
/* nome de alguém da equipe desta barbearia (para os exemplos das telas) */
const NB = (i, completo) => { const l = obterBarbeiros().filter(b => b.ativo !== false);
  const n = l.length ? l[i % l.length].nome : 'Barbeiro'; return completo ? n : n.split(' ')[0]; };

function navegar(tela, params={}){
  document.querySelectorAll('[data-nav]').forEach(a=>{
    a.classList.toggle('ativo', a.dataset.nav===tela);
  });
  const noMais = ['clientes','comissoes','estoque','fidelidade','planos','link','personalizar','config'].includes(tela);
  document.querySelectorAll('[data-mais]').forEach(a=>a.classList.toggle('ativo', noMais));
  fecharModal('menu-mais');
  window.scrollTo(0,0);
  const cp = document.getElementById('conteudo-principal');
  if(!cp) return;
  if (window.telaLigada && !telaLigada(tela)) tela = 'inicio';
  const fn = TELAS[tela];
  if(!fn){ cp.innerHTML='<p style="padding:24px;color:var(--muted)">Tela não encontrada.</p>'; return; }
  const html = fn(params);
  if(html instanceof Promise){ cp.innerHTML=''; html.then(h=>{ cp.innerHTML=h; afterRender(tela); }); }
  else{ cp.innerHTML=html; afterRender(tela); }
  window._telaAtual = tela;
  document.getElementById('titulo-topo').textContent = TITULOS[tela]||'';
}

const TITULOS = {
  inicio:'Início', agenda:'Agenda', fila:'Fila de Espera',
  clientes:'Clientes', financeiro:'Financeiro', comissoes:'Comissões',
  estoque:'Estoque', fidelidade:'Clube de pontos', planos:'Planos',
  link:'App do cliente', personalizar:'Personalidade', config:'Configurações',
};

function afterRender(tela){
  if(typeof TELAS[tela+'Depois']==='function') TELAS[tela+'Depois']();
  /* Ativa filtros de categoria no link público */
  document.querySelectorAll('[data-filtro-cat]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-filtro-cat]').forEach(b=>b.classList.remove('ativo'));
      btn.classList.add('ativo');
      const cat = btn.dataset.filtroCat;
      document.querySelectorAll('[data-categoria]').forEach(item=>{
        item.style.display = (cat==='todos'||item.dataset.categoria===cat) ? '' : 'none';
      });
    });
  });
  /* Stars no PDV */
  document.querySelectorAll('.star-btn').forEach((s,i,arr)=>{
    s.addEventListener('click',()=>{
      arr.forEach((x,j)=>x.classList.toggle('on', j<=i));
    });
  });
}

/* ─── TELA: INÍCIO ─── */
TELAS.inicio = ()=>`
<div class="cards-row">
  <div class="stat-card destaque">
    <div class="ico"><i class="bi bi-calendar-check"></i></div>
    <div class="label">Hoje</div>
    <div class="valor">12</div>
    <div class="sub">agendamentos</div>
  </div>
  <div class="stat-card verde">
    <div class="ico"><i class="bi bi-currency-dollar"></i></div>
    <div class="label">Faturamento hoje</div>
    <div class="valor">R$&nbsp;980</div>
    <div class="sub">+18% vs ontem</div>
  </div>
  <div class="stat-card">
    <div class="ico"><i class="bi bi-people"></i></div>
    <div class="label">Clientes novos</div>
    <div class="valor">3</div>
    <div class="sub">esta semana</div>
  </div>
  <div class="stat-card">
    <div class="ico"><i class="bi bi-trophy"></i></div>
    <div class="label">Planos ativos</div>
    <div class="valor">47</div>
    <div class="sub">+2 este mês</div>
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="grid-2">
  <div class="section-box">
    <h3 style="font-size:.88rem;font-weight:700;margin-bottom:14px">Próximos agendamentos</h3>
    ${[
      {hora:'10:00',nome:'Lucas Ferreira',   serv:'Corte + Barba',     barb:NB(0)},
      {hora:'10:30',nome:'Rafael Souza',     serv:'Pigmentação Barba', barb:NB(1)},
      {hora:'11:00',nome:'Carlos Mendes',    serv:'Protese Capilar',   barb:NB(0)},
      {hora:'11:30',nome:'André Lima',       serv:'Corte Raspado',     barb:NB(2)},
    ].map(a=>`
      <div class="agd-card confirmado mb-8" onclick="abrirModalVerAgendamento()">
        <div class="agd-info">
          <div class="nome">${a.nome}</div>
          <div class="servico">${a.serv} · ${a.barb}</div>
        </div>
        <div class="agd-side">
          <div>${a.hora}</div>
          <div class="badges"><span class="badge verde">Confirmado</span></div>
        </div>
      </div>`).join('')}
  </div>
  <div class="section-box">
    <h3 style="font-size:.88rem;font-weight:700;margin-bottom:14px">Fila de espera</h3>
    ${[
      {n:1,nome:'Marcos P.',serv:'Corte',tempo:'5 min'},
      {n:2,nome:'João T.',  serv:'Barba',tempo:'12 min'},
      {n:3,nome:'Felipe R.',serv:'Corte + Risquinho',tempo:'18 min'},
    ].map(f=>`
      <div class="fila-item" style="margin-bottom:8px">
        <div class="fila-num ${f.n===1?'primeiro':''}">${f.n}</div>
        <div class="fila-info"><div class="nome">${f.nome}</div><div class="servico">${f.serv}</div></div>
        <div class="fila-tempo">${f.tempo}</div>
      </div>`).join('')}
    <button class="btn-modal secundario mt-8" onclick="navegar('fila')">Ver fila completa</button>
  </div>
</div>`;

/* ─── TELA: AGENDA → js/agenda.js (Dia, Semana, Mês, Lista) ─── */

/* ─── TELA: FILA ─── */
TELAS.fila = ()=>`
<div class="section-header">
  <h2>Fila de Espera</h2>
  <button class="btn-topo primario" onclick="abrirModalFila()"><i class="bi bi-person-plus"></i> Adicionar</button>
</div>
<div class="fila-lista">
  ${[
    {n:1,nome:'Marcos Pereira', serv:'Corte',              barb:NB(0), tempo:'Aguardando'},
    {n:2,nome:'João Tavares',   serv:'Barba a vapor',       barb:NB(1), tempo:'~12 min'},
    {n:3,nome:'Felipe Rocha',   serv:'Corte + Risquinho',  barb:NB(2),  tempo:'~22 min'},
  ].map(f=>`
    <div class="fila-item">
      <div class="fila-num ${f.n===1?'primeiro':''}">${f.n}</div>
      <div class="fila-info">
        <div class="nome">${f.nome}</div>
        <div class="servico">${f.serv} · ${f.barb}</div>
      </div>
      <div style="text-align:right">
        <div class="fila-tempo">${f.tempo}</div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="fila-btn" onclick="DB.toast('Chamado!','sucesso')">Chamar</button>
          <button class="btn-ico" onclick="DB.toast('Removido da fila','aviso')"><i class="bi bi-x"></i></button>
        </div>
      </div>
    </div>`).join('')}
</div>
<div class="section-box mt-8">
  <div style="text-align:center;padding:12px 0">
    <div style="font-size:2rem;font-weight:900;color:var(--accent)">3</div>
    <div style="font-size:.82rem;color:var(--muted)">pessoas aguardando · tempo médio 18 min</div>
  </div>
</div>`;

/* ─── TELA: CLIENTES ─── */
TELAS.clientes = ()=>{
  const lista=[
    {nome:'Lucas Ferreira',  tel:'(11) 99999-0001',visits:12,total:1240,plano:'Corte Ilimitado'},
    {nome:'Rafael Souza',    tel:'(11) 99999-0002',visits:8, total:680, plano:'—'},
    {nome:'Carlos Mendes',   tel:'(11) 99999-0003',visits:5, total:980, plano:'Premium'},
    {nome:'André Lima',      tel:'(11) 99999-0004',visits:21,total:2100,plano:'Corte Ilimitado'},
    {nome:'Bruno Barbosa',  tel:'(11) 99999-0005',visits:3, total:270, plano:'—'},
  ];
  return `
<div class="section-header">
  <h2>Clientes (${lista.length})</h2>
  <div class="acoes">
    <input type="search" placeholder="Buscar cliente…" style="border:1.5px solid var(--line2);border-radius:var(--rs);padding:7px 12px;font-size:.82rem;width:200px">
  </div>
</div>
<table class="tabela resp">
  <thead><tr>
    <th>Cliente</th><th>Telefone</th><th>Visitas</th><th>Total gasto</th><th>Plano</th><th></th>
  </tr></thead>
  <tbody>
  ${lista.map(c=>`<tr>
    <td data-label="Cliente"><div style="display:flex;align-items:center;gap:10px">
      <div class="cliente-foto">${c.nome.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
      <span style="font-weight:600">${c.nome}</span>
    </div></td>
    <td data-label="Telefone">${c.tel}</td>
    <td data-label="Visitas">${c.visits}x</td>
    <td data-label="Total gasto" style="font-weight:700;color:var(--verde)">${DB.moeda(c.total)}</td>
    <td data-label="Plano">${c.plano!=='—'?`<span class="badge accent">${c.plano}</span>`:c.plano}</td>
    <td data-label="Ações"><div class="acoes">
      <button class="btn-ico" title="WhatsApp" onclick="window.open(DB.linkWa('Olá ${c.nome}!'))"><i class="bi bi-whatsapp"></i></button>
      <button class="btn-ico" title="Ver histórico"><i class="bi bi-clock-history"></i></button>
    </div></td>
  </tr>`).join('')}
  </tbody>
</table>`;
};

/* ─── TELA: FINANCEIRO ─── */
TELAS.financeiro = ()=>`
<div class="cards-row">
  <div class="stat-card verde">
    <div class="ico"><i class="bi bi-graph-up-arrow"></i></div>
    <div class="label">Faturamento mês</div>
    <div class="valor">R$&nbsp;18.420</div>
    <div class="sub">+12% vs mês anterior</div>
  </div>
  <div class="stat-card">
    <div class="ico"><i class="bi bi-credit-card"></i></div>
    <div class="label">Ticket médio</div>
    <div class="valor">R$&nbsp;87</div>
    <div class="sub">212 atendimentos</div>
  </div>
  <div class="stat-card">
    <div class="ico"><i class="bi bi-star-fill"></i></div>
    <div class="label">Planos (recorrente)</div>
    <div class="valor">R$&nbsp;3.760</div>
    <div class="sub">47 assinantes</div>
  </div>
  <div class="stat-card vermelho">
    <div class="ico"><i class="bi bi-arrow-down-circle"></i></div>
    <div class="label">Comissões pagas</div>
    <div class="valor">R$&nbsp;3.684</div>
    <div class="sub">20% do faturamento</div>
  </div>
</div>
<div class="fin-graf">
  <h3>Faturamento diário — novembro 2026</h3>
  <div class="barras">
    ${[420,680,540,790,1100,980,860,740,650,820,970,1050,890,760,1200,1080,920,840,990,780,850,920,1140,960,870,780,1030,950,880,760].slice(0,30).map((v,i)=>`
    <div class="barra-wrap">
      <div class="barra-val">${v>=1000?Math.round(v/100)/10+'k':v}</div>
      <div class="barra" style="height:${Math.round(v/1200*96)}px;${i===new Date().getDate()-1?'background:var(--ink)':''}"></div>
      <div class="barra-label">${i+1}</div>
    </div>`).join('')}
  </div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="grid-2">
  <div class="section-box">
    <h3 style="font-size:.88rem;font-weight:700;margin-bottom:12px">Lançamentos recentes</h3>
    ${[
      {desc:'Corte + Barba · Lucas F.',   val:+150, tipo:'entrada', data:'hoje'},
      {desc:'Comissão ' + NB(0, true),       val:-30,  tipo:'saida',   data:'hoje'},
      {desc:'Protese Capilar · Carlos M.', val:+195, tipo:'entrada', data:'hoje'},
      {desc:'Produto · Pomada 300g',       val:-85,  tipo:'saida',   data:'ontem'},
      {desc:'Plano Ilimitado · André L.',  val:+160, tipo:'entrada', data:'ontem'},
    ].map(l=>`
      <div class="fin-row">
        <div class="label">${l.desc}<small>${l.data}</small></div>
        <div class="val ${l.val>0?'verde':'vermelho'}">${l.val>0?'+':''}${DB.moeda(Math.abs(l.val))}</div>
      </div>`).join('')}
  </div>
  <div class="section-box">
    <h3 style="font-size:.88rem;font-weight:700;margin-bottom:12px">Por forma de pagamento</h3>
    ${[
      {forma:'Pix',         val:9800,  pct:53},
      {forma:'Crédito',     val:4200,  pct:23},
      {forma:'Débito',      val:2800,  pct:15},
      {forma:'Dinheiro',    val:1620,  pct:9},
    ].map(p=>`
      <div class="fin-row">
        <div class="label">${p.forma}</div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:80px;height:6px;background:var(--line2);border-radius:3px;overflow:hidden">
            <div style="width:${p.pct}%;height:100%;background:var(--accent)"></div>
          </div>
          <div class="val verde">${DB.moeda(p.val)}</div>
        </div>
      </div>`).join('')}
  </div>
</div>`;

/* ─── TELA: COMISSÕES ─── */
TELAS.comissoes = ()=>`
<div class="section-header">
  <h2>Comissões</h2>
  <select style="border:1.5px solid var(--line2);border-radius:var(--rs);padding:8px 10px;font-size:.8rem">
    <option>Novembro 2026</option><option>Outubro 2026</option>
  </select>
</div>
<p class="text-sm text-muted mb-16">Valores de demonstração. O percentual de cada profissional é definido em <a href="#" onclick="event.preventDefault();navegar('config')">Configurações</a>.</p>
${obterBarbeiros().filter(b=>b.ativo !== false).map((b,i)=>{
  const ats=[32,24,18][i]||10, fat=[4800,2400,1200][i]||900, pct=Number(b.comissao_pct||0), com=fat*pct/100;
  return `
  <div class="barb-row">
    <div class="topo-barb">
      <div class="barb-foto">${b.foto_url?`<img src="${DB.esc(b.foto_url)}" alt="" style="width:100%;height:100%;object-fit:cover">`:DB.esc(b.iniciais||iniciaisProfissional(b.nome))}</div>
      <div>
        <div class="barb-nome">${DB.esc(b.nome)}</div>
        <div class="barb-cargo">${DB.esc(b.especialidade||'')}</div>
      </div>
    </div>
    <div class="barb-stats">
      <div class="barb-stat"><div class="bsv">${ats}</div><div class="bsl">Atendimentos</div></div>
      <div class="barb-stat"><div class="bsv">${DB.moeda(fat)}</div><div class="bsl">Faturado</div></div>
      <div class="barb-stat"><div class="bsv" style="color:var(--verde)">${DB.moeda(com)}</div><div class="bsl">Comissão (${pct}%)</div></div>
    </div>
  </div>`;
}).join('') || '<div class="empty-state">Nenhum profissional ativo.</div>'}`;

/* ─── TELA: ESTOQUE ─── */
TELAS.estoque = ()=>`
<div class="section-header">
  <h2>Estoque</h2>
  <button class="btn-topo primario"><i class="bi bi-plus-lg"></i> Adicionar</button>
</div>
<div class="section-box">
  ${[
    {ico:'🧴',nome:'Pomada Modeladora 300g',  cat:'Produtos',   qtd:8, min:3},
    {ico:'✂️',nome:'Lâmina Gillette Fusion',  cat:'Descartáveis',qtd:2,min:5},
    {ico:'🧼',nome:'Shampoo Anticaspa 1L',    cat:'Produtos',   qtd:12,min:4},
    {ico:'🪒',nome:'Gilete Descartável (cx)',  cat:'Descartáveis',qtd:1,min:3},
    {ico:'💊',nome:'Álcool 70% 500ml',         cat:'Higiene',    qtd:6, min:2},
    {ico:'🧻',nome:'Papel Lençol (rolo)',       cat:'Higiene',    qtd:4, min:5},
  ].map(e=>`
    <div class="estoque-item">
      <div class="estoque-ico">${e.ico}</div>
      <div class="estoque-info">
        <div class="en">${e.nome}</div>
        <div class="ec">${e.cat}</div>
      </div>
      <div>
        <div class="estoque-qtd ${e.qtd<=e.min?'baixo':''}">${e.qtd} un</div>
        ${e.qtd<=e.min?'<span class="badge vermelho" style="font-size:.6rem">Repor</span>':''}
      </div>
      <button class="btn-ico"><i class="bi bi-pencil"></i></button>
    </div>`).join('')}
</div>`;

/* ─── TELA: CLUBE DE PONTOS (igual ao Beauty) ─── */
TELAS.fidelidade = ()=>{
  const P = lerPersonalidade();
  const ranking = [  // EXEMPLO de demonstração
    {nome:'Cliente Exemplo', pts:740}, {nome:'André L. (exemplo)', pts:610},
    {nome:'Rafael S. (exemplo)', pts:420}, {nome:'Carlos M. (exemplo)', pts:315}, {nome:'Lucas F. (exemplo)', pts:180},
  ];
  return `
<div class="section-header"><h2>${DB.esc(P.clube_nome)}</h2></div>
<div class="section-box mb-16" style="background:var(--ink);color:#fff">
  <div style="font-size:.75rem;color:rgba(255,255,255,.6)">Regra</div>
  <div style="font-size:1rem;font-weight:700">Cada ${DB.moeda(1/(Number(P.pontos_por_real)||1))} em serviços = 1 ponto</div>
  <div style="font-size:.75rem;color:rgba(255,255,255,.55);margin-top:4px">Os pontos entram sozinhos quando o atendimento é finalizado e pago. Plano mensal e cortesia não geram pontos.</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" class="grid-2">
  <div class="section-box">
    <h3 style="font-size:.88rem;font-weight:700;margin-bottom:10px">Dar baixa em prêmio</h3>
    <p class="text-sm text-muted mb-8">O cliente mostra o código que aparece no app dele.</p>
    <div class="campo"><input id="codResgate" placeholder="Ex.: LX2TZP" maxlength="8" style="text-transform:uppercase;letter-spacing:.15em;font-weight:800"></div>
    <button class="btn-modal primario" onclick="darBaixaResgate()">Confirmar prêmio entregue</button>
    <div class="sep"></div>
    <h3 style="font-size:.88rem;font-weight:700;margin-bottom:10px">Quem tem mais pontos</h3>
    ${ranking.map((r,i)=>`<div class="fin-row"><div class="label">${i+1}. ${DB.esc(r.nome)}</div><div class="val" style="color:var(--accent-d)">${r.pts} pts</div></div>`).join('')}
  </div>
  <div class="section-box">
    <h3 style="font-size:.88rem;font-weight:700;margin-bottom:10px">Prêmios</h3>
    ${RECOMPENSAS.map(r=>`<div class="estoque-item"><div class="estoque-ico"><i class="bi bi-gift"></i></div>
      <div class="estoque-info"><div class="en">${DB.esc(r.nome)}</div><div class="ec">≈ ${DB.moeda(r.pontos/(Number(P.pontos_por_real)||1))} em serviços</div></div>
      <div class="estoque-qtd">${r.pontos} pts</div></div>`).join('')}
    <button class="btn-modal secundario mt-8" onclick="DB.toast('Na versão com banco, o prêmio é salvo na tabela recompensas','info')">+ Novo prêmio</button>
  </div>
</div>`;
};
function darBaixaResgate(){
  const c = (document.getElementById('codResgate').value||'').trim().toUpperCase();
  if(c.length < 6){ DB.toast('Digite o código de 6 letras','erro'); return; }
  let rs = []; try { rs = JSON.parse(localStorage.getItem('tp_demo_resgates')||'[]'); } catch(e){}
  const r = rs.find(x=>x.codigo===c && x.status==='pendente');
  if(!r){ DB.toast('Código não encontrado ou já usado','erro'); return; }
  r.status='usado'; localStorage.setItem('tp_demo_resgates', JSON.stringify(rs));
  DB.toast(`Prêmio entregue: ${r.nome}`,'sucesso');
  document.getElementById('codResgate').value='';
}

/* ─── TELA: PLANOS ─── */
TELAS.planos = ()=>`
<div class="section-header">
  <h2>${EH_THIAGO ? 'Planos Gold' : 'Planos'}</h2>
  <button class="btn-topo primario" onclick="DB.toast('Na versão com banco, o plano é salvo na tabela planos_cliente','info')"><i class="bi bi-plus-lg"></i> Novo plano</button>
</div>
<p class="text-sm text-muted mb-16">O cliente escolhe o plano no app e paga por <b>Pix</b> direto na conta da barbearia. Quando o Pix cair, confirme aqui: o plano é liberado por 1 mês e a entrada vai para o Financeiro.</p>
${htmlPagamentosPlanos()}
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px">
  ${PLANOS.map(p=>`
  <div class="plano-card ${p.mais_vendido?'destaque':''}">
    ${p.mais_vendido?'<div class="plano-tag mais-vendido"><i class="bi bi-fire"></i> Mais vendido</div>':''}
    <div class="plano-nome">${DB.esc(p.nome)}</div>
    <div class="plano-info">Vigência: <b>${DB.esc(p.vigencia)}</b></div>
    <div class="plano-preco">${DB.moeda(p.preco)}<span>/mês</span></div>
    <div class="plano-vagas" style="${p.vagas_restantes==null?'color:var(--muted)':''}">${p.vagas_restantes==null?'Sem limite de vagas':`Restam ${p.vagas_restantes} vagas`}</div>
    <div class="plano-info">${(p.vantagens||[]).map(DB.esc).join(' · ')}</div>
    <div class="plano-acoes">
      <button class="plano-btn"><i class="bi bi-pencil"></i> Editar</button>
      <button class="plano-btn" onclick="copiarLink('planos')"><i class="bi bi-link-45deg"></i> Link</button>
      <span class="badge verde" style="margin-left:auto">Ativo</span>
    </div>
  </div>`).join('')}
</div>`;

function lerPedidosPlanos(){ try { return JSON.parse(localStorage.getItem('tp_demo_planos')||'{}'); } catch(e){ return {}; } }
function htmlPagamentosPlanos(){
  const P = lerPersonalidade();
  const hoje = DB.hojeISO();
  const lista = Object.entries(lerPedidosPlanos()).map(([cid,p])=>({cid,...p}))
    .filter(p=>p.status==='aguardando_pagamento' || p.pagamento_informado_em || (p.proximo_vencimento && p.proximo_vencimento <= hoje));
  return `
<div class="section-box mb-16">
  <h3 style="font-size:.9rem;font-weight:700;margin-bottom:6px">Pix para conferir</h3>
  ${!P.pix_chave ? `<p class="text-sm mb-8" style="color:var(--vermelho)"><i class="bi bi-exclamation-triangle"></i> Cadastre a chave Pix em <a href="#" onclick="event.preventDefault();navegar('personalizar')">Personalidade</a> para o app mostrar o QR Code.</p>` : ''}
  ${lista.length ? lista.map(p=>`
    <div class="fin-row">
      <div class="label">${DB.esc(p.cliente_nome||'Cliente')} · ${DB.esc(p.nome)}
        <small>${p.status==='aguardando_pagamento' ? 'Primeira mensalidade' : 'Renovação'} · ${p.pagamento_informado_em ? '<b style="color:var(--verde)">cliente disse que pagou</b>' : 'ainda não pagou'}</small></div>
      <div style="display:flex;align-items:center;gap:10px">
        <div class="val">${DB.moeda(p.preco)}</div>
        <button class="fila-btn" onclick="confirmarPixPlano('${DB.esc(p.cid)}')"><i class="bi bi-check2"></i> Pix recebido</button>
      </div>
    </div>`).join('') : '<p class="text-sm text-muted">Nenhum Pix de plano para conferir agora.</p>'}
  <p class="text-sm text-muted mt-8">Confira no app do banco se o valor caiu antes de confirmar.</p>
</div>`;
}
function confirmarPixPlano(cid){
  const todos = lerPedidosPlanos(), p = todos[cid]; if(!p) return;
  const hoje = DB.hojeISO();
  if(p.ultimo_pagamento === hoje){ DB.toast('Pagamento de hoje já foi confirmado','aviso'); return; }
  const base = p.status==='aguardando_pagamento' || !p.proximo_vencimento || p.proximo_vencimento < hoje ? hoje : p.proximo_vencimento;
  const d = new Date(base+'T12:00:00'); d.setMonth(d.getMonth()+1);
  Object.assign(p, { status:'ativo', proximo_vencimento: d.toISOString().slice(0,10), ultimo_pagamento: hoje, pagamento_informado_em: null });
  localStorage.setItem('tp_demo_planos', JSON.stringify(todos));
  DB.toast(`Plano liberado até ${DB.dataBR(p.proximo_vencimento)}`,'sucesso');
  navegar('planos');
}

/* ─── TELA: LINK DO CLIENTE (prévia do app que o cliente usa) ─── */
function linkCliente(aba){
  const base = location.href.replace(/[^/]*([?#].*)?$/, '') + 'agendar.html';
  return aba ? `${base}?aba=${aba}` : base;
}
function copiarLink(aba){
  const l = linkCliente(aba);
  (navigator.clipboard ? navigator.clipboard.writeText(l) : Promise.reject()).then(
    ()=>DB.toast('Link copiado!','sucesso'), ()=>prompt('Copie o link:', l));
}
TELAS.link = ()=>`
<div class="section-header">
  <h2>App do cliente</h2>
  <div class="acoes">
    <button class="btn-topo" onclick="copiarLink()"><i class="bi bi-copy"></i> Copiar link</button>
    <a class="btn-topo primario" href="agendar.html" target="_blank" style="text-decoration:none"><i class="bi bi-box-arrow-up-right"></i> Abrir</a>
  </div>
</div>
<div style="display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:20px;align-items:start" class="grid-link">
  <div class="section-box">
    <h3 style="font-size:.9rem;font-weight:700;margin-bottom:10px">O que o cliente faz no app</h3>
    ${[
      ['bi-scissors','Agenda sozinho','Escolhe o barbeiro (com foto), o serviço e o horário livre.'],
      ['bi-gem','Escolhe um Plano Gold','Vê preço, vigência, vagas restantes e vantagens. O pedido chega para você confirmar o pagamento.'],
      ['bi-star-fill','Junta pontos','Cada atendimento pago vira ponto. Ele troca por prêmio e mostra o código no balcão.'],
      ['bi-person-circle','Tem conta própria','Entra com WhatsApp e senha. Vê os próximos horários e o plano.'],
    ].map(([i,t,d])=>`<div class="pref-row"><div class="flex-row"><i class="bi ${i}" style="color:var(--accent);font-size:1.2rem"></i>
      <div class="info"><div class="ptitulo">${t}</div><div class="psub">${d}</div></div></div></div>`).join('')}
    <div class="sep"></div>
    <p class="text-sm text-muted">Para mudar o jeito que o app fala, a frase e a cor, vá em <a href="#" data-nav="personalizar" onclick="event.preventDefault();navegar('personalizar')">Personalidade</a>.
    Fotos dos barbeiros ficam em <a href="#" onclick="event.preventDefault();navegar('config')">Configurações</a>.</p>
  </div>
  <div style="border:10px solid #111;border-radius:36px;overflow:hidden;height:760px;box-shadow:var(--shadow-md);background:#111">
    <iframe src="agendar.html" title="Prévia do app do cliente" style="width:100%;height:100%;border:0;background:#fff" id="previaApp"></iframe>
  </div>
</div>`;

/* ─── TELA: PERSONALIDADE ─── */
TELAS.personalizar = ()=>{
  const P = lerPersonalidade();
  const cores = [['#C9A84C','Ouro'],['#111111','Preto'],['#B08D57','Bronze'],['#8C1C13','Vinho'],['#1F4E79','Azul petróleo'],['#2E5E3E','Verde garrafa']];
  const tons = [['descontraido','Descontraído','"Fala, parceiro! Garante tua cadeira."'],
                ['classico','Clássico','"Seja bem-vindo. Reservar horário."'],
                ['premium','Premium','"Seja bem-vindo à casa. Reservar experiência."']];
  return `
<div class="section-header"><h2>Personalidade da barbearia</h2>
  <button class="btn-topo primario" onclick="salvarTelaPersonalidade()"><i class="bi bi-check-lg"></i> Salvar</button></div>
<p class="text-sm text-muted mb-16">Tudo aqui aparece no app do cliente. Cada barbearia tem o seu jeito.</p>
${CONFIG.MODO_DEMO ? '' : '<p class="text-sm mb-16" style="background:var(--accent-m);border-radius:8px;padding:10px 12px"><i class="bi bi-cloud-check"></i> Ao salvar, as mudanças vão para o banco e aparecem no app de agendamento dos clientes. O nome do letreiro e o texto "embaixo do nome" valem só para o painel.</p>'}
<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px" class="grid-2">
  <div class="section-box">
    <h3 style="font-size:.9rem;font-weight:700;margin-bottom:12px">Logo</h3>
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:6px">
      <div class="logo-prev" id="logoPrev">${(lerLogo() || CONFIG.LOGO) ? `<img src="${lerLogo() || CONFIG.LOGO}" alt="Logo">` : COROA_SVG(80, P.cor)}</div>
      <div>
        <p class="text-sm text-muted mb-8">Aparece no topo do painel e no app do cliente. Use PNG com fundo transparente, se tiver.</p>
        <label class="btn-topo primario" style="display:inline-flex;cursor:pointer"><i class="bi bi-upload"></i> ${lerLogo() ? 'Trocar logo' : 'Enviar logo'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onchange="enviarLogo(this.files[0])"></label>
        ${lerLogo() ? `<button class="btn-topo" style="margin-top:6px" onclick="voltarLogoPadrao()"><i class="bi bi-arrow-counterclockwise"></i> Voltar para a logo padrão</button>` : ''}
      </div>
    </div>
    <div class="sep"></div>
    <h3 style="font-size:.9rem;font-weight:700;margin-bottom:12px">Identidade</h3>
    <div class="campo-row">
      <div class="campo"><label>Nome no letreiro</label><input id="pNome" value="${DB.esc(P.nome)}" maxlength="30"></div>
      <div class="campo"><label>Embaixo do nome</label><input id="pTipo" value="${DB.esc(P.tipo)}" maxlength="20"></div>
    </div>
    <div class="campo"><label>Frase da casa</label><input id="pSlogan" value="${DB.esc(P.slogan)}" maxlength="60"></div>
    <div class="campo"><label>Recado de boas-vindas</label><input id="pBoas" value="${DB.esc(P.boas_vindas)}" maxlength="90"></div>
    <div class="campo"><label>Especialidade em destaque</label><input id="pEsp" value="${DB.esc(P.especialidade)}" maxlength="50"></div>
    <div class="campo-row">
      <div class="campo"><label>WhatsApp (com DDD)</label><input id="pWa" value="${DB.esc(P.whatsapp)}" inputmode="numeric" placeholder="5516999999999"></div>
      <div class="campo"><label>Instagram</label><input id="pIg" value="${DB.esc(P.instagram)}" placeholder="@suabarbearia"></div>
    </div>
    <div class="sep"></div>
    <h3 style="font-size:.9rem;font-weight:700;margin-bottom:4px"><i class="bi bi-qr-code" style="color:var(--accent)"></i> Pix para receber os planos</h3>
    <p class="text-sm text-muted mb-8">O cliente paga direto na conta da barbearia. O app monta o QR Code e o copia e cola com o valor do plano.</p>
    <div class="campo-row">
      <div class="campo"><label>Tipo de chave</label><select id="pPixTipo">
        ${[['','Escolha'],['cpf','CPF'],['cnpj','CNPJ'],['telefone','Celular'],['email','E-mail'],['aleatoria','Chave aleatória']]
          .map(([v,t])=>`<option value="${v}" ${P.pix_tipo===v?'selected':''}>${t}</option>`).join('')}</select></div>
      <div class="campo"><label>Chave Pix</label><input id="pPixChave" value="${DB.esc(P.pix_chave)}" autocomplete="off"></div>
    </div>
    <div class="campo-row">
      <div class="campo"><label>Nome de quem recebe</label><input id="pPixNome" value="${DB.esc(P.pix_nome)}" placeholder="Como está no banco" maxlength="25"></div>
      <div class="campo"><label>Cidade</label><input id="pPixCidade" value="${DB.esc(P.pix_cidade)}" maxlength="15"></div>
    </div>
  </div>
  <div class="section-box">
    <h3 style="font-size:.9rem;font-weight:700;margin-bottom:12px">Jeito de falar com o cliente</h3>
    ${tons.map(([v,t,ex])=>`<label class="pref-row" style="cursor:pointer">
      <div class="info"><div class="ptitulo">${t}</div><div class="psub">${ex}</div></div>
      <input type="radio" name="pTom" value="${v}" ${P.tom_voz===v?'checked':''} style="width:20px;height:20px;accent-color:var(--ink)"></label>`).join('')}
    <div class="sep"></div>
    <h3 style="font-size:.9rem;font-weight:700;margin-bottom:8px">Cor de destaque</h3>
    <div class="cor-grade">${cores.map(([c,n])=>`<button class="cor-btn ${P.cor.toLowerCase()===c.toLowerCase()?'ativa':''}" style="background:${c}" title="${n}" data-cor="${c}"
      onclick="document.querySelectorAll('.cor-btn').forEach(b=>b.classList.remove('ativa'));this.classList.add('ativa')"></button>`).join('')}</div>
    <div class="sep"></div>
    <h3 style="font-size:.9rem;font-weight:700;margin-bottom:8px">Clube de pontos</h3>
    <div class="campo-row">
      <div class="campo"><label>Nome do clube</label><input id="pClube" value="${DB.esc(P.clube_nome)}" maxlength="30"></div>
      <div class="campo"><label>Pontos por R$ 1</label><input id="pPpr" type="number" min="0.1" step="0.1" value="${Number(P.pontos_por_real)||1}"></div>
    </div>
  </div>
</div>`;
};
function enviarLogo(arq){
  if(!arq) return;
  if(!/^image\//.test(arq.type)){ DB.toast('Escolha um arquivo de imagem','erro'); return; }
  if(arq.size > 8*1024*1024){ DB.toast('Imagem muito grande (máx. 8 MB)','erro'); return; }
  const url = URL.createObjectURL(arq), img = new Image();
  img.onload = ()=>{
    // reduz para no máximo 400px, mantendo a transparência (PNG)
    const max = 360, k = Math.min(1, max / Math.max(img.width || max, img.height || max));
    const c = document.createElement('canvas');
    c.width = Math.round((img.width || max) * k); c.height = Math.round((img.height || max) * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    let d = c.toDataURL('image/webp', 0.9); if(!/^data:image\/webp/.test(d)) d = c.toDataURL('image/png');   // webp é menor (mantém o fundo transparente)
    if(d.length > 380000){ DB.toast('Logo muito pesada. Tente uma imagem mais simples.','erro'); return; }
    Promise.resolve(window.Equipe && Equipe.gravarLogo ? Equipe.gravarLogo(d) : null).then(()=>{
      if(salvarLogo(d)){ aplicarLogoPainel(); DB.toast('Logo salva!','sucesso'); navegar('personalizar'); }
      else DB.toast('Não coube no navegador. Tente uma imagem menor.','erro');
    }).catch(e=>DB.toast((window.erroEquipe ? erroEquipe(e) : e.message),'erro',5000));
  };
  img.onerror = ()=>{ URL.revokeObjectURL(url); DB.toast('Não consegui abrir essa imagem','erro'); };
  img.src = url;
}
function voltarLogoPadrao(){
  Promise.resolve(window.Equipe && Equipe.gravarLogo ? Equipe.gravarLogo(null) : null)
    .then(()=>{ salvarLogo(null); aplicarLogoPainel(); navegar('personalizar'); })
    .catch(e=>DB.toast((window.erroEquipe ? erroEquipe(e) : e.message),'erro',5000));
}
async function salvarTelaPersonalidade(){
  const v = id => document.getElementById(id).value.trim();
  const tom = (document.querySelector('input[name=pTom]:checked')||{}).value || 'descontraido';
  const cor = (document.querySelector('.cor-btn.ativa')||{}).dataset?.cor || '#C9A84C';
  if(v('pPixChave') && !v('pPixTipo')){ DB.toast('Escolha o tipo da chave Pix','aviso'); return; }
  const P = { nome:v('pNome')||'Minha', tipo:v('pTipo')||'Barbearia', slogan:v('pSlogan'), boas_vindas:v('pBoas'),
    especialidade:v('pEsp'), whatsapp:v('pWa').replace(/\D/g,''), instagram:v('pIg').replace(/^@/,''),
    tom_voz:tom, cor, clube_nome:v('pClube')||'Clube de pontos', pontos_por_real:Number(v('pPpr'))||1,
    pix_tipo:v('pPixTipo'), pix_chave:v('pPixChave'), pix_nome:v('pPixNome'), pix_cidade:v('pPixCidade') };
  try { await Equipe.gravarPersonalidade(P); }          // modo real: grava no Supabase (o app do cliente lê de lá)
  catch(e){ DB.toast(window.erroEquipe ? erroEquipe(e) : (e.message||'Não foi possível salvar.'),'erro',5000); return; }
  salvarPersonalidade(P);
  document.documentElement.style.setProperty('--accent', cor);
  DB.toast('Salvo! O app de agendamento já mostra as mudanças.','sucesso');
}

/* ─── TELA: CONFIG (equipe) → js/equipe.js ─── */

/* quem está usando o painel (embaixo do menu lateral) */
function mostrarUsuario(nome, cargo){
  const n = String(nome || '').trim() || 'Administrador';
  const ini = n.split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
  const a = document.getElementById('userAvatar'), u = document.getElementById('userNome'), c = document.getElementById('userCargo');
  if (a) a.textContent = ini; if (u) u.textContent = n; if (c) c.textContent = cargo || 'Administrador';
}

/* ─── INICIALIZAÇÃO ─── */
document.addEventListener('DOMContentLoaded', async ()=>{
  /* Cliques de navegação */
  document.querySelectorAll('[data-nav]').forEach(a=>{
    a.addEventListener('click', e=>{ e.preventDefault(); navegar(a.dataset.nav); });
  });
  /* Cor e nome escolhidos em Personalidade */
  const P = lerPersonalidade();
  document.documentElement.style.setProperty('--accent', P.cor);
  document.querySelectorAll('.logo-nome').forEach(e=>e.textContent=P.nome);
  document.querySelectorAll('.logo-sub').forEach(e=>e.textContent=P.tipo);
  const sv = document.querySelector('#sidebarLogo .logo-svg');
  if (sv && !EH_THIAGO) sv.outerHTML = COROA_SVG(80, P.cor).replace('<svg ', '<svg class="logo-svg" ');
  aplicarLogoPainel();
  document.title = 'Painel · ' + (CONFIG.BARBEARIA_NOME || 'Barbearia');
  mostrarUsuario(P.nome, 'Administrador');
  const lm = document.getElementById('loginMarca');
  if (lm) lm.innerHTML = CONFIG.SIMBOLO ? `<img src="${DB.esc(CONFIG.SIMBOLO)}" alt="" class="login-logo">` : COROA_SVG(56, P.cor);
  if (lm && !CONFIG.MODO_DEMO && !CONFIG.SIMBOLO && window.Equipe && Equipe.sb)     // logo da barbearia na tela de login
    Equipe.sb().then(c => c.rpc('site_barbearia', { p_host: location.hostname, p_slug: CONFIG.BARBEARIA_SLUG }))
      .then(r => { const u = r && r.data && r.data.logo_url; if (u && /^(data:image\/|https:\/\/|\/)/.test(u)) lm.innerHTML = `<img src="${DB.esc(u)}" alt="" class="login-logo">`; }).catch(() => {});
  /* Modo real: exige login antes de mostrar o painel */
  let logado = true;
  try { logado = await Equipe.iniciar(); }
  catch(e){ logado = false; DB.toast(e.message || 'Não foi possível conectar.','erro',5000); }
  if(!logado){ document.getElementById('login-painel').hidden = false; return; }
  mostrarSairPainel();
  navegar('inicio');
});
