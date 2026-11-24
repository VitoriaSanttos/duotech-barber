/* ═══════════════════════════════════════════════
   DuoTech Barber · profit.js
   PROFIT: quanto realmente sobra em cada serviço,
   produto e plano, e o ponto de equilíbrio do mês.

   Conta de cada item (tudo editável na tela):
     custo variável = insumo + comissão do barbeiro + comissão do gerente
                      + taxa do cartão + taxa fixa + imposto
     contribuição   = venda − custo variável   (o que sobra para pagar as contas fixas)
     margem         = contribuição ÷ venda
   Ponto de equilíbrio = custos fixos ÷ margem média.
   Modo demonstração: premissas e valores ficam no navegador (tp_demo_profit).
   Insumos, custos fixos e assinantes são ESTIMATIVAS para o Thiago ajustar.
═══════════════════════════════════════════════ */

const PROFIT_PADRAO = {
  premissas: {gerente:3, barb_servico:38, barb_produto:15, incide:'venda',  // 'venda' | 'lucro'
              clube:10, cartao:2.5, taxa_fixa:0, imp_servico:7.75, imp_produto:5},
  /* insumo por atendimento (R$) e quantos foram vendidos no mês */
  insumos: {s1:4, s2:6, s3:3, s4:2, s5:1, s6:1, s7:2, s8:1, s9:1, s10:0.5, s11:1, s12:1,
            s13:8, s14:6, s15:3, s16:30, s17:55, s18:25, s19:10, s20:3, s21:28, s22:35, s23:900},
  vendidos: {s1:34, s2:20, s3:5, s4:9, s5:6, s6:2, s7:5, s8:2, s9:11, s10:8, s11:3, s12:3,
             s13:4, s14:6, s15:2, s16:2, s17:0, s18:1, s19:3, s20:2, s21:0, s22:3, s23:1},
  produtos: [
    {id:'pr1', nome:'Pomada efeito matte 70g', venda:45, custo:18, vendidos:14},
    {id:'pr2', nome:'Óleo para barba',         venda:39, custo:14, vendidos:9},
    {id:'pr3', nome:'Shampoo antiqueda',       venda:55, custo:24, vendidos:5},
    {id:'pr4', nome:'Body splash',             venda:60, custo:22, vendidos:4},
    {id:'pr5', nome:'Balm pós-barba',          venda:35, custo:12, vendidos:7},
  ],
  /* planos: assinantes ativos e usos por mês (média) */
  planos: {p1:{assinantes:28, usos:1,   insumo:4}, p2:{assinantes:6,  usos:4, insumo:8},
           p3:{assinantes:14, usos:2.5, insumo:4}, p4:{assinantes:19, usos:3, insumo:10},
           p5:{assinantes:21, usos:3,   insumo:6}, p6:{assinantes:4,  usos:2, insumo:7},
           p7:{assinantes:4,  usos:2,   insumo:3}},
  fixos: [
    {nome:'Aluguel', valor:2800}, {nome:'Luz', valor:450}, {nome:'Água', valor:120},
    {nome:'Internet e telefone', valor:150}, {nome:'Sistema', valor:200},
    {nome:'Contador', valor:400}, {nome:'Pró-labore do dono', valor:2500},
    {nome:'Limpeza e manutenção', valor:300},
  ],
};

function lerProfit(){
  try {
    const s = JSON.parse(localStorage.getItem('tp_demo_profit')||'{}');
    const p = structuredClone(PROFIT_PADRAO);
    if(s.premissas) Object.assign(p.premissas, s.premissas);
    ['insumos','vendidos','planos'].forEach(k=>{ if(s[k]) Object.assign(p[k], s[k]); });
    if(s.produtos) p.produtos = s.produtos;
    if(s.fixos) p.fixos = s.fixos;
    if(s.precos) p.precos = s.precos;
    return p;
  } catch(e){ return structuredClone(PROFIT_PADRAO); }
}
function salvarProfit(p){ try { localStorage.setItem('tp_demo_profit', JSON.stringify(p)); } catch(e){} }

/* ─── CONTAS ─── */
function contaItem(venda, insumo, tipo, pr){
  const barbPct = (tipo==='produto' ? pr.barb_produto : pr.barb_servico)/100;
  const base = pr.incide==='lucro' ? Math.max(venda-insumo,0) : venda;
  const partes = {
    insumo,
    barbeiro: base*barbPct,
    gerente:  base*pr.gerente/100,
    cartao:   venda*pr.cartao/100,
    taxa:     pr.taxa_fixa,
    imposto:  venda*(tipo==='produto' ? pr.imp_produto : pr.imp_servico)/100,
  };
  const custo = Object.values(partes).reduce((a,b)=>a+b,0);
  const contrib = venda - custo;
  return {venda, partes, custo, contrib, margem: venda>0 ? contrib/venda*100 : 0};
}
function contaPlano(plano, cfg, pr){
  const preco = plano.preco;
  const partes = {
    barbeiro: preco*pr.barb_servico/100,
    gerente:  preco*pr.gerente/100,
    clube:    preco*pr.clube/100,
    cartao:   preco*pr.cartao/100,
    imposto:  preco*pr.imp_servico/100,
    insumo:   cfg.usos*cfg.insumo,
  };
  const custo = Object.values(partes).reduce((a,b)=>a+b,0);
  const contrib = preco - custo;
  return {preco, partes, custo, contrib, margem: contrib/preco*100, mensal: contrib*cfg.assinantes};
}
function precoServico(p, s){ return (p.precos && p.precos[s.id]!=null) ? p.precos[s.id] : s.preco; }

function resumoProfit(p){
  const pr = p.premissas;
  const serv = SERVICOS.map(s=>({s, c:contaItem(precoServico(p,s), p.insumos[s.id]||0, 'servico', pr), q:p.vendidos[s.id]||0}));
  const prod = p.produtos.map(x=>({x, c:contaItem(x.venda, x.custo, 'produto', pr), q:x.vendidos||0}));
  const plan = PLANOS.map(pl=>({pl, cfg:p.planos[pl.id], c:contaPlano(pl, p.planos[pl.id], pr)}));
  const soma = (arr, f) => arr.reduce((a,x)=>a+f(x),0);
  const vendaServ = soma(serv,x=>x.c.venda*x.q), contribServ = soma(serv,x=>x.c.contrib*x.q);
  const vendaProd = soma(prod,x=>x.c.venda*x.q), contribProd = soma(prod,x=>x.c.contrib*x.q);
  const vendaPlan = soma(plan,x=>x.c.preco*x.cfg.assinantes), contribPlan = soma(plan,x=>x.c.mensal);
  const qServ = soma(serv,x=>x.q), qProd = soma(prod,x=>x.q);
  const receita = vendaServ+vendaProd+vendaPlan, contrib = contribServ+contribProd+contribPlan;
  const fixos = soma(p.fixos,x=>Number(x.valor)||0);
  const margemMedia = receita>0 ? contrib/receita : 0;
  return {serv, prod, plan, vendaServ, contribServ, vendaProd, contribProd, vendaPlan, contribPlan,
    qServ, qProd, receita, contrib, fixos, margemMedia,
    margemServ: vendaServ ? contribServ/vendaServ*100 : 0, margemProd: vendaProd ? contribProd/vendaProd*100 : 0,
    medioServ: qServ ? contribServ/qServ : 0, medioProd: qProd ? contribProd/qProd : 0,
    equilibrio: margemMedia>0 ? fixos/margemMedia : Infinity, lucro: contrib - fixos};
}

const pct = v => `${v.toLocaleString('pt-BR',{minimumFractionDigits:1, maximumFractionDigits:1})}%`;
const corMargem = m => m < 25 ? 'vermelho' : m < 40 ? 'laranja' : 'verde';

/* ─── TELA ─── */
TELAS.profit = (params={})=>{
  window._paramsProfit = params;
  const aba = params.aba || 'itens';
  const p = lerProfit(), r = resumoProfit(p);
  return `
<div class="dash-ola" style="margin-top:0">
  <h1>Lucro real</h1>
  <p>Quanto realmente sobra em cada serviço, produto e plano, depois de comissão, cartão e imposto.</p>
</div>
<div class="dash-abas">
  <button class="${aba==='itens'?'ativa':''}" onclick="navegar('profit',{aba:'itens'})"><i class="bi bi-calculator"></i> Itens</button>
  <button class="${aba==='equilibrio'?'ativa':''}" onclick="navegar('profit',{aba:'equilibrio'})"><i class="bi bi-bullseye"></i> Ponto de equilíbrio</button>
</div>
${aba==='itens' ? profitItens(p, r, params.sub||'servicos') : profitEquilibrio(p, r)}`;
};

function profitPremissas(pr){
  const campo = (k, rotulo, suf='%') => `
    <label class="pf-campo"><span>${rotulo}</span>
      <div><input type="number" step="0.01" min="0" value="${pr[k]}" data-premissa="${k}">${suf==='R$'?'<b>R$</b>':`<b>${suf}</b>`}</div></label>`;
  return `
<details class="section-box pf-premissas">
  <summary>
    <div><strong>Premissas do cálculo</strong>
    <span>Barbeiro ${pr.barb_servico}% · Gerente ${pr.gerente}% · Cartão ${pr.cartao}% · Imposto ${pr.imp_servico}%</span></div>
    <i class="bi bi-sliders"></i>
  </summary>
  <div class="pf-sub">Comissões</div>
  <div class="pf-grid">
    ${campo('barb_servico','Barbeiro · serviço')}${campo('barb_produto','Barbeiro · produto')}${campo('gerente','Gerente')}
    <label class="pf-campo"><span>Comissão incide sobre</span>
      <div class="pf-seg">
        <button class="${pr.incide==='venda'?'sel':''}" onclick="mudarPremissa('incide','venda')">Venda cheia</button>
        <button class="${pr.incide==='lucro'?'sel':''}" onclick="mudarPremissa('incide','lucro')">Venda − insumo</button>
      </div></label>
  </div>
  <div class="pf-sub">Impostos e taxas</div>
  <div class="pf-grid">
    ${campo('cartao','Cartão')}${campo('taxa_fixa','Taxa fixa por venda','R$')}
    ${campo('imp_servico','Imposto · serviço')}${campo('imp_produto','Imposto · produto')}${campo('clube','Taxa dos planos')}
  </div>
  <p class="text-muted text-sm mt-8">Mude um número e tudo recalcula na hora.</p>
</details>`;
}

function linhaItem(id, nome, c, insumoLbl, tipo){
  const pe = c.partes;
  return `
<details class="pf-item">
  <summary>
    <div class="pf-nome"><i class="bi bi-chevron-down"></i>${DB.esc(nome)}</div>
    <div class="pf-num"><small>venda</small>${DB.moeda(c.venda)}</div>
    <div class="pf-num"><small>sobra</small><strong class="${c.contrib<0?'neg':''}">${DB.moeda(c.contrib)}</strong></div>
    <div class="pf-margem ${corMargem(c.margem)}">${pct(c.margem)}</div>
  </summary>
  <div class="pf-det">
    <div class="pf-edit">
      <label>Preço de venda <input type="number" step="0.01" min="0" value="${c.venda}" data-item="${id}" data-campo="venda" data-tipo="${tipo}"></label>
      <label>${insumoLbl} <input type="number" step="0.01" min="0" value="${pe.insumo}" data-item="${id}" data-campo="insumo" data-tipo="${tipo}"></label>
    </div>
    <div class="pf-barra" title="Para onde vai cada real">
      ${[['insumo',pe.insumo],['barbeiro',pe.barbeiro],['gerente',pe.gerente],['cartao',pe.cartao+pe.taxa],['imposto',pe.imposto],['sobra',Math.max(c.contrib,0)]]
        .map(([k,v])=>`<span class="${k}" style="flex:${Math.max(v,0)}"></span>`).join('')}
    </div>
    <div class="pf-partes">
      <span><i class="pf-dot insumo"></i>${tipo==='produto'?'Custo do produto':'Insumo'} ${DB.moeda(pe.insumo)}</span>
      <span><i class="pf-dot barbeiro"></i>Barbeiro ${DB.moeda(pe.barbeiro)}</span>
      <span><i class="pf-dot gerente"></i>Gerente ${DB.moeda(pe.gerente)}</span>
      <span><i class="pf-dot cartao"></i>Cartão e taxa ${DB.moeda(pe.cartao+pe.taxa)}</span>
      <span><i class="pf-dot imposto"></i>Imposto ${DB.moeda(pe.imposto)}</span>
      <span><i class="pf-dot sobra"></i><b>Sobra ${DB.moeda(c.contrib)}</b></span>
    </div>
  </div>
</details>`;
}

function profitItens(p, r, sub){
  const cats = {};
  r.serv.forEach(x=>{ const k=x.s.categoria; (cats[k] ||= {venda:0, contrib:0, n:0}); cats[k].venda+=x.c.venda*Math.max(x.q,1); cats[k].contrib+=x.c.contrib*Math.max(x.q,1); cats[k].n++; });
  const catLista = Object.entries(cats).map(([k,v])=>({k, nome:CATEGORIAS[k]||k, n:v.n, m:v.venda?v.contrib/v.venda*100:0})).sort((a,b)=>a.m-b.m);
  const menores = [...r.serv].sort((a,b)=>a.c.margem-b.c.margem).slice(0,3);

  return `
<div class="dash-grid">
  ${cardSaude({ico:'bi-scissors', cor:'azul', titulo:'Margem · serviços', valor:pct(r.margemServ), linhas:[['Sobra média por serviço', DB.moeda(r.medioServ)]], info:'Ponderada pelo que foi vendido no mês'})}
  ${cardSaude({ico:'bi-box-seam', cor:'laranja', titulo:'Margem · produtos', valor:pct(r.margemProd), linhas:[['Sobra média por produto', DB.moeda(r.medioProd)]], info:'Ponderada pelo que foi vendido no mês'})}
  ${cardSaude({ico:'bi-gem', cor:'ouro', titulo:'Margem · planos', valor:pct(r.vendaPlan? r.contribPlan/r.vendaPlan*100 : 0), linhas:[['Sobra dos planos no mês', DB.moeda(r.contribPlan)]], link:['Ver planos','profit',{aba:'equilibrio'}]})}
</div>

<div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
  <div class="section-box">
    <h3 class="box-tit"><i class="bi bi-bar-chart"></i> Margem por categoria <span class="text-muted text-sm" style="font-weight:500">da menor para a maior</span></h3>
    ${catLista.map((c,i)=>`
      <div class="pf-cat">
        <div><strong>${c.nome}</strong> <span class="text-muted">${c.n}</span>${i===0?' <span class="badge vermelho">menor</span>':''}</div>
        <div class="pf-cat-barra"><div class="${corMargem(c.m)}" style="width:${Math.max(c.m,0)}%"></div></div>
        <strong class="pf-cat-val">${pct(c.m)}</strong>
      </div>`).join('')}
  </div>
  <div class="section-box">
    <h3 class="box-tit"><i class="bi bi-exclamation-triangle"></i> Atenção nestes serviços</h3>
    <p class="text-muted text-sm mb-16">Os de menor margem. Vale rever o preço ou o insumo.</p>
    ${menores.map(x=>`
      <div class="acao-item" style="padding:10px 0">
        <div class="acao-info"><strong>${x.s.nome}</strong><span>venda ${DB.moeda(x.c.venda)} · sobra ${DB.moeda(x.c.contrib)}</span></div>
        <span class="pf-margem ${corMargem(x.c.margem)}">${pct(x.c.margem)}</span>
      </div>`).join('')}
  </div>
</div>

${profitPremissas(p.premissas)}

<div class="dash-abas" style="max-width:360px">
  <button class="${sub==='servicos'?'ativa':''}" onclick="navegar('profit',{aba:'itens',sub:'servicos'})">Serviços · ${SERVICOS.length}</button>
  <button class="${sub==='produtos'?'ativa':''}" onclick="navegar('profit',{aba:'itens',sub:'produtos'})">Produtos · ${p.produtos.length}</button>
</div>
<div class="section-box pf-lista">
  ${sub==='servicos'
    ? Object.keys(CATEGORIAS).filter(k=>r.serv.some(x=>x.s.categoria===k)).map(k=>`
        <div class="pf-grupo"><strong>${CATEGORIAS[k]}</strong>${(c=>`<span class="pf-margem ${corMargem(c.m)}">${pct(c.m)}</span>`)(catLista.find(c=>c.k===k))}</div>
        ${r.serv.filter(x=>x.s.categoria===k).map(x=>linhaItem(x.s.id, x.s.nome, x.c, 'Insumo por atendimento', 'servico')).join('')}`).join('')
    : r.prod.map(x=>linhaItem(x.x.id, x.x.nome, x.c, 'Custo de compra', 'produto')).join('')}
</div>`;
}

function profitEquilibrio(p, r){
  const atual = r.receita;
  const falta = r.equilibrio - atual;
  const ticketServ = r.qServ ? r.vendaServ/r.qServ : 0;
  const atendFaltam = falta>0 && ticketServ ? Math.ceil(falta/ticketServ) : 0;
  const prog = Math.min(atual/r.equilibrio*100, 100);
  return `
<div class="pf-equi">
  <div>
    <div class="caixa-total-lbl">Para pagar todas as contas do mês, a barbearia precisa faturar</div>
    <div class="caixa-total">${isFinite(r.equilibrio)?DB.moeda(r.equilibrio):'—'}</div>
    <div class="caixa-desde">custos fixos ${DB.moeda(r.fixos)} ÷ margem média ${pct(r.margemMedia*100)}</div>
  </div>
  <div class="pf-equi-dir">
    <div class="pf-equi-barra"><div style="width:${prog}%"></div></div>
    <div class="caixa-desde">Faturamento estimado do mês: <strong style="color:#fff">${DB.moeda(atual)}</strong></div>
    <div class="pf-equi-res ${r.lucro>=0?'ok':'falta'}">
      ${r.lucro>=0
        ? `<i class="bi bi-check-circle-fill"></i> Acima do ponto de equilíbrio. Sobra estimada: <b>${DB.moeda(r.lucro)}</b>`
        : `<i class="bi bi-exclamation-triangle-fill"></i> Faltam <b>${DB.moeda(falta)}</b>, cerca de <b>${atendFaltam} atendimentos</b>`}
    </div>
  </div>
</div>

<div class="grid-2" style="display:grid;grid-template-columns:1.4fr 1fr;gap:16px">
  <div class="section-box">
    <h3 class="box-tit"><i class="bi bi-gem"></i> Quanto sobra em cada plano</h3>
    <p class="text-muted text-sm mb-16">Por assinante: preço − comissão − taxas − imposto − insumo dos usos do mês. Ajuste assinantes e usos.</p>
    <div class="pf-planos">
      <div class="pf-planos-cab"><span>Plano</span><span>Assinantes</span><span>Usos/mês</span><span>Sobra/assinante</span><span>No mês</span></div>
      ${r.plan.map(x=>`
        <div class="pf-planos-lin">
          <span><strong>${x.pl.nome.replace(/^Plano /,'')}</strong><small>${DB.moeda(x.pl.preco)}/mês</small></span>
          <span><input type="number" min="0" step="1" value="${x.cfg.assinantes}" data-plano="${x.pl.id}" data-campo="assinantes"></span>
          <span><input type="number" min="0" step="0.5" value="${x.cfg.usos}" data-plano="${x.pl.id}" data-campo="usos"></span>
          <span class="${x.c.contrib<0?'neg':''}">${DB.moeda(x.c.contrib)} <em class="pf-margem ${corMargem(x.c.margem)}">${pct(x.c.margem)}</em></span>
          <span><strong>${DB.moeda(x.c.mensal)}</strong></span>
        </div>`).join('')}
      <div class="pf-planos-lin total"><span>Total dos planos</span><span>${r.plan.reduce((a,x)=>a+x.cfg.assinantes,0)}</span><span></span><span></span><span><strong>${DB.moeda(r.contribPlan)}</strong></span></div>
    </div>
  </div>
  <div class="section-box">
    <h3 class="box-tit"><i class="bi bi-house"></i> Custos fixos do mês</h3>
    ${p.fixos.map((f,i)=>`
      <div class="pf-fixo"><span>${DB.esc(f.nome)}</span>
        <div><b>R$</b><input type="number" min="0" step="10" value="${f.valor}" data-fixo="${i}"></div></div>`).join('')}
    <div class="pf-fixo total"><span>Total</span><strong>${DB.moeda(r.fixos)}</strong></div>
    <div class="mt-8" style="display:grid;gap:8px">
      <div class="fin-row"><div class="label">Sobra dos serviços</div><div class="val verde">${DB.moeda(r.contribServ)}</div></div>
      <div class="fin-row"><div class="label">Sobra dos produtos</div><div class="val verde">${DB.moeda(r.contribProd)}</div></div>
      <div class="fin-row"><div class="label">Sobra dos planos</div><div class="val verde">${DB.moeda(r.contribPlan)}</div></div>
      <div class="fin-row"><div class="label">− Custos fixos</div><div class="val vermelho">${DB.moeda(r.fixos)}</div></div>
      <div class="fin-row"><div class="label"><strong>Lucro estimado do mês</strong></div><div class="val ${r.lucro>=0?'verde':'vermelho'}">${DB.moeda(r.lucro)}</div></div>
    </div>
  </div>
</div>`;
}

/* ─── EDIÇÃO (recalcula na hora) ─── */
function mudarPremissa(k, v){
  const p = lerProfit(); p.premissas[k] = v; salvarProfit(p);
  _rerenderProfit();
}
function _rerenderProfit(){
  const abertos = [...document.querySelectorAll('#conteudo-principal details')].map(d=>d.open);
  const y = window.scrollY;
  navegar('profit', {...(window._paramsProfit||{}), _semRecarregar:true});
  document.querySelectorAll('#conteudo-principal details').forEach((d,i)=>{ if(abertos[i]) d.open = true; });
  window.scrollTo(0, y);
}
document.addEventListener('change', e=>{
  const el = e.target; if(window._telaAtual!=='profit' || el.tagName!=='INPUT') return;
  const v = Math.max(parseFloat(el.value)||0, 0), p = lerProfit();
  if(el.dataset.premissa){ p.premissas[el.dataset.premissa] = v; }
  else if(el.dataset.item){
    const {item, campo, tipo} = el.dataset;
    if(tipo==='produto'){ const pr = p.produtos.find(x=>x.id===item); pr[campo==='venda'?'venda':'custo'] = v; }
    else if(campo==='venda'){ (p.precos ||= {})[item] = v; }
    else { p.insumos[item] = v; }
  }
  else if(el.dataset.plano){ p.planos[el.dataset.plano][el.dataset.campo] = v; }
  else if(el.dataset.fixo!=null){ p.fixos[+el.dataset.fixo].valor = v; }
  else return;
  salvarProfit(p); _rerenderProfit();
});
