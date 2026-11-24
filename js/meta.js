/* ═══════════════════════════════════════════════
   DuoTech Barber · meta.js
   META DO MÊS: a meta dividida em assinaturas, assinaturas
   novas e comandas; acompanhamento por dia, quinzena e mês;
   mix da meta, comparação de períodos, premiação da equipe,
   meta com propósito (doação), Modo TV e imagem para o grupo.

   Regras:
   - Assinaturas previstas = mensalidades ativas − inadimplência − cancelamentos.
   - Meta em comandas = meta geral − assinaturas previstas − assinaturas novas.
   - A meta de cada dia segue o movimento da loja (sexta pede mais que segunda);
     dia fechado (domingo) não pede nada.
   - Calibrar a meta exige motivo e fica no histórico.
   Modo demonstração: configuração em tp_demo_meta; movimento diário é simulado
   e ajustado para bater com o faturamento do Início.
═══════════════════════════════════════════════ */

const PESO_DIA = [0, .75, 1, .9, 1, 1.35, 1.25];   /* dom..sáb: movimento médio de cada dia da semana */
const NOME_DIA = ['dom','seg','ter','qua','qui','sex','sáb'];

function _metaPadrao(){
  return {
    meta: Math.round(DASH_DEMO.faturamento_mes_passado*1.125/100)*100,
    inad:5, churn:3, novas:3500,
    mix:{avulsos:50, extras:30, produtos:20},
    campanhas:{
      q1:{on:false, premio:'', valor:0, para:'equipe'},
      q2:{on:true,  premio:'Churrasco da equipe', valor:400, para:'equipe'},
      mes:{on:false, premio:'', valor:0, para:'cada'},
    },
    proposito:{on:true, causa:'Projeto social da igreja', tipo:'pct', valor:10},
    historico:[],
  };
}
function lerMeta(){
  try { const s = JSON.parse(localStorage.getItem('tp_demo_meta')||'null'); if(!s) return _metaPadrao();
        const p = _metaPadrao(); return {...p, ...s, mix:{...p.mix, ...s.mix}, campanhas:{...p.campanhas, ...s.campanhas}, proposito:{...p.proposito, ...s.proposito}}; }
  catch(e){ return _metaPadrao(); }
}
function salvarMeta(m){ try { localStorage.setItem('tp_demo_meta', JSON.stringify(m)); } catch(e){} }

/* ─── MOVIMENTO DIÁRIO (demo) ─── */
function _rnd(seed){ const x = Math.sin(seed)*10000; return x - Math.floor(x); }
function mensalidadesAtivas(){
  const p = lerProfit();
  return PLANOS.reduce((a,pl)=>a + pl.preco*((p.planos[pl.id]||{}).assinantes||0), 0);
}
function caixaHoje(){
  try { const c = lerCaixa(); const ab = new Date(c.abertura);
        return (c.aberto && ab.toDateString()===new Date().toDateString()) ? resumoCaixa(c).entradas : 0; }
  catch(e){ return 0; }
}
const _serieCache = {};
function serieMes(ano, mes){
  const chave = `${ano}-${mes}`;
  if(_serieCache[chave]) return _serieCache[chave];
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const ndias = new Date(ano, mes+1, 0).getDate();
  const cfg = lerMeta(), M = mensalidadesAtivas();
  const dias = [];
  for(let d=1; d<=ndias; d++){
    const data = new Date(ano, mes, d), dow = data.getDay(), aberto = dow!==0;
    const seed = ano*400 + mes*32 + d;
    dias.push({d, data, dow, aberto, peso: PESO_DIA[dow],
      passado: data < hoje, hoje: data.getTime()===hoje.getTime(),
      comandas: aberto ? 560*PESO_DIA[dow]*(0.8+0.4*_rnd(seed)) : 0,
      assin: d<=28 ? M/28*(1-cfg.inad/100) : 0,
      novas: aberto && _rnd(seed*7)>0.35 ? 120+90*_rnd(seed*3) : 0});
  }
  /* Ajusta o demo para bater com o Início (mês atual) e com o mês passado */
  const ehAtual = ano===hoje.getFullYear() && mes===hoje.getMonth();
  const ehAnterior = new Date(ano, mes+1, 1).getTime() === new Date(hoje.getFullYear(), hoje.getMonth(), 1).getTime();
  const hist = dias.filter(x=>ehAtual ? x.passado : true);
  const alvo = ehAtual ? DASH_DEMO.faturamento_mes - caixaHoje() : ehAnterior ? DASH_DEMO.faturamento_mes_passado : null;
  if(alvo){
    const sc = hist.reduce((a,x)=>a+x.comandas,0), so = hist.reduce((a,x)=>a+x.assin+x.novas,0);
    const k = sc>0 ? Math.min(Math.max((alvo-so)/sc, .3), 3) : 1;
    hist.forEach(x=>x.comandas *= k);
  }
  /* Futuro não tem movimento; hoje vem do caixa */
  dias.forEach(x=>{
    if(ehAtual && !x.passado){ x.comandas = x.hoje ? caixaHoje() : 0; x.novas = 0; x.assin = 0; }
  });
  return _serieCache[chave] = dias;
}

/* ─── CONTAS DA META ─── */
function calcMeta(){
  const cfg = lerMeta(), hoje = new Date();
  const dias = serieMes(hoje.getFullYear(), hoje.getMonth());
  const M = mensalidadesAtivas();
  const previstas = M*(1 - cfg.inad/100 - cfg.churn/100);
  const metaComandas = Math.max(cfg.meta - previstas - cfg.novas, 0);
  const soma = (arr,f)=>arr.reduce((a,x)=>a+f(x),0);
  const assinRec = soma(dias,x=>x.assin), novasRec = soma(dias,x=>x.novas), comandasRec = soma(dias,x=>x.comandas);
  const entrou = assinRec + novasRec + comandasRec;
  const aindaCaem = Math.max(previstas - assinRec, 0);
  const faltaComanda = Math.max(metaComandas - comandasRec, 0);
  const pesoMes = soma(dias,x=>x.peso);
  const restantes = dias.filter(x=>x.aberto && (x.hoje || !x.passado));
  const pesoRest = soma(restantes,x=>x.peso);
  const hojeD = dias.find(x=>x.hoje);
  /* meta de comanda de cada dia, pelo movimento da loja */
  dias.forEach(x=>{ x.meta = metaComandas*x.peso/pesoMes; });
  /* o que falta, redistribuído nos dias que restam */
  const faltaAntesDeHoje = Math.max(metaComandas - soma(dias.filter(x=>x.passado),x=>x.comandas), 0);
  const precisaHoje = hojeD && hojeD.aberto && pesoRest ? faltaAntesDeHoje*hojeD.peso/pesoRest : 0;
  const precisaPorDia = restantes.length ? faltaComanda/restantes.length : 0;
  /* quinzenas */
  const q = hoje.getDate()<=15 ? 1 : 2;
  const qd = dias.filter(x=> q===1 ? x.d<=15 : x.d>15);
  const metaQ = soma(qd,x=>x.meta), realQ = soma(qd,x=>x.comandas);
  const restQ = qd.filter(x=>x.aberto && (x.hoje || !x.passado)).length;
  /* projeção pelo ritmo dos dias já fechados */
  const passados = dias.filter(x=>x.passado && x.aberto);
  const ritmo = soma(passados,x=>x.peso) ? soma(passados,x=>x.comandas)/soma(passados,x=>x.peso) : 0;
  const pesoFuturo = soma(dias.filter(x=>x.aberto && !x.passado && !x.hoje),x=>x.peso);
  const comandasHoje = hojeD ? hojeD.comandas : 0;
  const novasRitmo = passados.length ? novasRec/passados.length*dias.filter(x=>x.aberto).length : cfg.novas;
  const proj = f => soma(dias.filter(x=>x.passado),x=>x.comandas) + Math.max(comandasHoje, ritmo*(hojeD&&hojeD.aberto?hojeD.peso:0)*f) + ritmo*pesoFuturo*f
                    + previstas*(f<1?0.97:1) + novasRitmo*f;
  /* mix: o que entrou de comanda separado em baldes (demo: proporção típica) */
  const mixReal = {avulsos:comandasRec*.55, extras:comandasRec*.27, produtos:comandasRec*.18};
  return {cfg, dias, M, previstas, metaComandas, assinRec, novasRec, comandasRec, entrou, aindaCaem, faltaComanda,
    pct: cfg.meta ? entrou/cfg.meta*100 : 0, precisaHoje, precisaPorDia, restantes:restantes.length, hojeD,
    q, qd, metaQ, realQ, restQ, projReal:proj(1), projOtim:proj(1.1), projPess:proj(.85), mixReal,
    falta: Math.max(cfg.meta - entrou - aindaCaem, 0)};
}

/* ─── TELA ─── */
TELAS.meta = (params={})=>{
  const aba = params.aba || 'acompanhar';
  window._paramsMeta = params;
  const r = calcMeta();
  const mesNome = new Date().toLocaleDateString('pt-BR',{month:'long', year:'numeric'});
  const abas = [['acompanhar','Acompanhar'],['mix','Mix da meta'],['comparar','Comparar'],['premiacao','Premiação'],['configurar','Configurar a meta']];
  return `
<div class="dash-ola" style="margin-top:0">
  <h1>Meta do mês</h1>
  <p>${mesNome.charAt(0).toUpperCase()+mesNome.slice(1)} · a meta dividida em assinaturas e comandas, acompanhada por dia e por quinzena.</p>
</div>
<div class="meta-abas">${abas.map(([k,t])=>`<button class="${aba===k?'ativa':''}" onclick="navegar('meta',{aba:'${k}'})">${t}</button>`).join('')}</div>
${aba==='acompanhar' ? metaAcompanhar(r, params.vista||'quinzena')
 : aba==='mix' ? metaMix(r)
 : aba==='comparar' ? metaComparar(params.preset||'semana')
 : aba==='premiacao' ? metaPremiacao(r)
 : metaConfigurar(r)}`;
};

function heroMeta(r, compacto=false){
  const base = Math.max(r.cfg.meta, r.entrou + r.aindaCaem);
  const w = v => `${Math.max(v,0)/base*100}%`;
  const hoje = new Date();
  return `
<div class="meta-hero">
  <div class="meta-hero-topo">
    <div>
      <div class="meta-eyebrow">${hoje.toLocaleDateString('pt-BR',{month:'long'})} · até ${hoje.toLocaleDateString('pt-BR',{weekday:'short', day:'2-digit', month:'2-digit'})}</div>
      <div class="caixa-total">${DB.moeda(r.entrou)}</div>
      <div class="caixa-desde">entrou no mês, de ${DB.moeda(r.cfg.meta)}</div>
    </div>
    <div class="meta-pct"><strong>${pct(r.pct)}</strong><span>da meta</span></div>
  </div>
  <div class="meta-barra">
    <span class="assin" style="width:${w(r.assinRec)}"></span><span class="cmd" style="width:${w(r.comandasRec)}"></span>
    <span class="novas" style="width:${w(r.novasRec)}"></span><span class="caem" style="width:${w(r.aindaCaem)}"></span>
  </div>
  <div class="meta-leg">
    <span><i class="assin"></i>Assinaturas <b>${DB.moeda(r.assinRec)}</b></span>
    <span><i class="cmd"></i>Comandas <b>${DB.moeda(r.comandasRec)}</b></span>
    <span><i class="novas"></i>Assinaturas novas <b>${DB.moeda(r.novasRec)}</b></span>
    <span><i class="caem"></i>Assinaturas que ainda caem <b>${DB.moeda(r.aindaCaem)}</b></span>
    <span><i class="falta"></i>Ainda precisa de comanda <b>${DB.moeda(r.faltaComanda)}</b></span>
  </div>
  ${compacto ? '' : `
  <div class="meta-hero-rodape">
    <div><small>Precisa hoje</small><strong>${r.hojeD && r.hojeD.aberto ? DB.moeda(r.precisaHoje) : 'loja fechada'}</strong>
      <span>já entrou ${DB.moeda(r.hojeD ? r.hojeD.comandas : 0)} no caixa</span></div>
    <div><small>Média por dia que falta</small><strong>${DB.moeda(r.precisaPorDia)}</strong><span>${r.restantes} dias abertos</span></div>
    <div><small>Projeção do mês</small><strong>${DB.moeda(r.projReal)}</strong><span>entre ${DB.moeda(r.projPess)} e ${DB.moeda(r.projOtim)}</span></div>
  </div>`}
</div>`;
}

function metaAcompanhar(r, vista){
  const f = lerFe(), p = palavraDoDia();
  const dias = vista==='quinzena' ? r.qd : vista==='dia' ? [] : r.dias;
  const maxV = Math.max(...(dias.length?dias:r.dias).map(x=>Math.max(x.comandas, x.meta)), 1);
  const propo = r.cfg.proposito;
  const doacao = propo.on ? (propo.tipo==='pct' ? r.cfg.meta*propo.valor/100 : propo.valor) : 0;
  return `
<div class="meta-acoes">
  <div class="dash-abas" style="margin:0;max-width:320px">
    ${[['dia','Dia'],['quinzena','Quinzena'],['mes','Mês']].map(([k,t])=>`<button class="${vista===k?'ativa':''}" onclick="navegar('meta',{aba:'acompanhar',vista:'${k}'})">${t}</button>`).join('')}
  </div>
  <button class="btn-topo" onclick="abrirModoTV()"><i class="bi bi-tv"></i> Modo TV</button>
  <button class="btn-topo" onclick="abrirCalibrar()"><i class="bi bi-sliders"></i> Calibrar meta</button>
  <button class="btn-topo primario" onclick="imagemMetaGrupo()"><i class="bi bi-image"></i> Imagem para o grupo</button>
</div>
${heroMeta(r)}
${propo.on ? `<div class="meta-proposito"><i class="bi bi-heart-fill"></i><div><strong>Meta com propósito.</strong>
  Batendo a meta, ${DB.moeda(doacao)} vão para <b>${DB.esc(propo.causa)}</b>.${f.fe_ativa?` <span class="text-muted">“${p.ref}”</span>`:''}</div></div>` : ''}

${vista==='dia' ? (()=>{ const h = r.hojeD;
  if(!h || !h.aberto) return `<div class="section-box acao-vazio">Hoje a loja não abre. Descanso também é bênção.</div>`;
  const prog = r.precisaHoje ? Math.min(h.comandas/r.precisaHoje*100,100) : 100;
  return `
<div class="section-box">
  <h3 class="box-tit"><i class="bi bi-sun"></i> Hoje, ${NOME_DIA[h.dow]} ${h.d}</h3>
  <div class="meta-dia">
    <div><small>Meta de comanda hoje</small><strong>${DB.moeda(r.precisaHoje)}</strong><span>${NOME_DIA[h.dow]} pede ${Math.round(h.peso*100)}% de um dia médio</span></div>
    <div><small>Já entrou no caixa</small><strong>${DB.moeda(h.comandas)}</strong><span>${pct(prog)} da meta de hoje</span></div>
    <div><small>Falta hoje</small><strong>${DB.moeda(Math.max(r.precisaHoje-h.comandas,0))}</strong><span>${h.comandas>=r.precisaHoje?'Meta do dia batida!':'cerca de '+Math.ceil(Math.max(r.precisaHoje-h.comandas,0)/DASH_DEMO.ticket_medio)+' atendimentos'}</span></div>
  </div>
  <div class="dash-barra" style="margin-top:14px"><div style="width:${prog}%;background:var(--verde)"></div></div>
</div>`; })() : `
<div class="section-box">
  <h3 class="box-tit"><i class="bi bi-bar-chart"></i> ${vista==='quinzena' ? `${r.q}ª quinzena · comandas` : 'Comandas do mês, dia a dia'}
    ${vista==='quinzena' && r.restQ<=5 && r.restQ>0 ? '<span class="badge vermelho" style="margin-left:auto">Reta final</span>' : ''}</h3>
  ${vista==='quinzena' ? `<p class="text-muted text-sm mb-16">${DB.moeda(r.realQ)} de ${DB.moeda(r.metaQ)} (${pct(r.metaQ?r.realQ/r.metaQ*100:0)}) · ${r.restQ} dias abertos para fechar a quinzena${r.restQ<=5?'. Nos últimos 5 dias o acompanhamento é diário.':''}</p>` : ''}
  <div class="meta-dias">
    ${dias.map(x=>`
      <div class="meta-col ${x.hoje?'hoje':''} ${!x.aberto?'fechado':''}" title="${NOME_DIA[x.dow]} ${x.d}: ${DB.moeda(x.comandas)} de ${DB.moeda(x.meta)}">
        <div class="meta-col-area">
          ${x.aberto?`<div class="meta-col-meta" style="bottom:${x.meta/maxV*100}%"></div>`:''}
          <div class="meta-col-val ${x.comandas>=x.meta&&x.aberto?'bateu':''} ${!x.passado&&!x.hoje?'futuro':''}" style="height:${x.comandas/maxV*100}%"></div>
        </div>
        <span>${x.d}</span><small>${NOME_DIA[x.dow][0]}</small>
      </div>`).join('')}
  </div>
  <div class="legenda mt-8"><span><i class="leg" style="background:var(--verde)"></i> Bateu a meta do dia</span><span><i class="leg" style="background:var(--ink)"></i> Abaixo</span><span><i class="leg" style="background:var(--accent);height:3px"></i> Meta do dia</span><span>Domingo: fechado, sem meta</span></div>
</div>`}`;
}

function metaMix(r){
  const cfg = r.cfg;
  const baldes = [['avulsos','Avulsos','Cortes e barbas fora do plano'],['extras','Extras','Sobrancelha, pigmentação, química e tratamentos'],['produtos','Produtos','Pomadas, óleos, shampoos e bebidas']];
  const linhas = baldes.map(([k,t,d])=>{ const meta = r.metaComandas*cfg.mix[k]/100, real = r.mixReal[k];
    return {k,t,d,meta,real,p: meta ? real/meta*100 : 0}; });
  const puxa = [...linhas].sort((a,b)=>b.p-a.p)[0], segura = [...linhas].sort((a,b)=>a.p-b.p)[0];
  return `
<div class="meta-frase section-box">
  A barbearia fez <b>${DB.moeda(r.comandasRec)}</b> em comanda, <b>${pct(r.metaComandas?r.comandasRec/r.metaComandas*100:0)}</b> da meta de comandas.
  Quem puxa é <b>${puxa.t.toLowerCase()}</b> (${pct(puxa.p)} da sua fatia); quem segura é <b>${segura.t.toLowerCase()}</b> (${pct(segura.p)}).
  Com assinaturas, o total do mês está em <b>${DB.moeda(r.entrou)}</b>.
</div>
<div class="dash-grid">
  ${linhas.map(l=>`
  <div class="dash-card">
    <div class="dash-titulo">${l.t} · ${cfg.mix[l.k]}% da meta de comandas</div>
    <div class="dash-valor">${DB.moeda(l.real)}</div>
    <div class="dash-barra"><div style="width:${Math.min(l.p,100)}%;background:${l.p>=r.pct?'var(--verde)':'var(--amarelo)'}"></div></div>
    <div class="dash-linha"><span>de ${DB.moeda(l.meta)}</span><strong>${pct(l.p)}</strong></div>
    <p class="text-muted text-sm">${l.d}</p>
  </div>`).join('')}
</div>
<p class="text-muted text-sm">A fatia de cada balde se muda em Configurar a meta. Na versão ligada ao banco, cada serviço e produto vai para o seu balde pela categoria.</p>`;
}

/* Comparar dois períodos */
function _valorDia(data){
  const s = serieMes(data.getFullYear(), data.getMonth());
  return s[data.getDate()-1] || {comandas:0, assin:0, novas:0};
}
function _periodo(ini, fim){
  const t = {comandas:0, assin:0, novas:0, dias:0};
  for(let d=new Date(ini); d<=fim; d.setDate(d.getDate()+1)){
    const v = _valorDia(d); t.comandas+=v.comandas; t.assin+=v.assin; t.novas+=v.novas; if(d.getDay()!==0) t.dias++;
  }
  t.total = t.comandas+t.assin+t.novas; return t;
}
function metaComparar(preset){
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const dia = (base, n) => { const d = new Date(base); d.setDate(d.getDate()+n); return d; };
  let A, B, nome;
  if(preset==='semana'){ const seg = dia(hoje, -((hoje.getDay()+6)%7)); A=[seg,hoje]; B=[dia(seg,-7),dia(hoje,-7)]; nome='Semana atual × semana passada (mesmos dias)'; }
  else if(preset==='mes'){ A=[new Date(hoje.getFullYear(),hoje.getMonth(),1),hoje]; B=[new Date(hoje.getFullYear(),hoje.getMonth()-1,1),new Date(hoje.getFullYear(),hoje.getMonth()-1,Math.min(hoje.getDate(),new Date(hoje.getFullYear(),hoje.getMonth(),0).getDate()))]; nome='Mês atual × mês passado (até o mesmo dia)'; }
  else { const ontem = dia(hoje,-1); A=[ontem,ontem]; B=[dia(ontem,-7),dia(ontem,-7)]; nome='Ontem × mesmo dia da semana passada'; }
  const a = _periodo(...A), b = _periodo(...B);
  const fmt = d => d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  const vari = (x,y) => y ? (x-y)/y*100 : 0;
  const linha = (rot, x, y) => { const v = vari(x,y); return `
    <div class="cmp-lin"><span>${rot}</span><strong>${DB.moeda(y)}</strong><strong>${DB.moeda(x)}</strong>
      <span class="dash-badge ${v>=0?'sobe':'desce'}">${v>=0?'+':''}${pct(v)}</span></div>`; };
  return `
<div class="filtros">
  ${[['semana','Semana × semana passada'],['mes','Mês × mês passado'],['ontem','Ontem × semana passada']].map(([k,t])=>`<button class="filtro-btn ${preset===k?'ativo':''}" onclick="navegar('meta',{aba:'comparar',preset:'${k}'})">${t}</button>`).join('')}
</div>
<div class="section-box">
  <h3 class="box-tit"><i class="bi bi-arrow-left-right"></i> ${nome}</h3>
  <div class="cmp-lin cab"><span></span><span><i class="leg" style="background:var(--line2)"></i>Antes · ${fmt(B[0])} a ${fmt(B[1])}</span><span><i class="leg" style="background:var(--accent)"></i>Agora · ${fmt(A[0])} a ${fmt(A[1])}</span><span>Variação</span></div>
  ${linha('Comandas', a.comandas, b.comandas)}
  ${linha('Assinaturas', a.assin, b.assin)}
  ${linha('Assinaturas novas', a.novas, b.novas)}
  ${linha('<b>Total</b>', a.total, b.total)}
  <div class="cmp-barras">
    <div><span>Antes</span><div class="cmp-b"><div style="width:${b.total/Math.max(a.total,b.total,1)*100}%;background:var(--line2)"></div></div><b>${DB.moeda(b.total)}</b></div>
    <div><span>Agora</span><div class="cmp-b"><div style="width:${a.total/Math.max(a.total,b.total,1)*100}%;background:var(--accent)"></div></div><b>${DB.moeda(a.total)}</b></div>
  </div>
  <p class="text-muted text-sm mt-8">Comanda conta pela data de fechamento. Os dois períodos têm ${a.dias} e ${b.dias} dias abertos.</p>
</div>`;
}

function metaPremiacao(r){
  const cfg = r.cfg, nb = BARBEIROS.length;
  const custo = Object.values(cfg.campanhas).reduce((a,c)=>a + (c.on ? (Number(c.valor)||0)*(c.para==='cada'?nb:1) : 0), 0);
  const per = [['q1','1ª quinzena','dias 1 a 15'],['q2','2ª quinzena','dia 16 ao fim'],['mes','Mês inteiro','bateu a meta geral']];
  const pr = cfg.proposito;
  return `
<div class="grid-2" style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px">
  <div class="section-box">
    <h3 class="box-tit"><i class="bi bi-trophy"></i> Premiação da equipe <span class="text-muted text-sm" style="margin-left:auto;font-weight:600">custo se todas baterem: ${DB.moeda(custo)}</span></h3>
    <p class="text-muted text-sm mb-16">O que a equipe ganha se bater a meta de comandas do período. A meta é a desta tela: calibrou, a campanha acompanha.</p>
    ${per.map(([k,t,d])=>{ const c = cfg.campanhas[k]; return `
    <div class="camp ${c.on?'on':''}">
      <div class="camp-topo"><div><strong>${t}</strong><span>${d}</span></div>
        <button class="toggle ${c.on?'on':''}" aria-label="Ligar campanha ${t}" onclick="_metaSet(m=>m.campanhas['${k}'].on=!m.campanhas['${k}'].on)"></button></div>
      ${c.on ? `<div class="campo-row" style="margin-top:10px">
        <div class="campo"><label>Prêmio</label><input value="${DB.esc(c.premio)}" maxlength="60" placeholder="Ex.: churrasco, folga, bônus" onchange="_metaSet(m=>m.campanhas['${k}'].premio=this.value)"></div>
        <div class="campo"><label>Valor (R$)</label><input type="number" min="0" value="${c.valor}" onchange="_metaSet(m=>m.campanhas['${k}'].valor=parseFloat(this.value)||0)"></div>
      </div>
      <div class="pf-seg" style="display:flex;border:1.5px solid var(--line2);border-radius:var(--rs)">
        <button class="${c.para==='equipe'?'sel':''}" onclick="_metaSet(m=>m.campanhas['${k}'].para='equipe')">Para a equipe toda</button>
        <button class="${c.para==='cada'?'sel':''}" onclick="_metaSet(m=>m.campanhas['${k}'].para='cada')">Para cada barbeiro (${nb})</button>
      </div>` : '<p class="text-muted text-sm mt-8">Sem campanha neste período.</p>'}
    </div>`; }).join('')}
  </div>
  <div class="section-box">
    <h3 class="box-tit"><i class="bi bi-heart"></i> Meta com propósito</h3>
    <p class="text-muted text-sm mb-16">Ao bater a meta do mês, parte vai para uma causa. A equipe vê no Modo TV e na imagem do grupo: a meta deixa de ser só número.</p>
    <div class="pref-row"><div class="info"><div class="ptitulo">Ligada</div><div class="psub">Aparece em todo o acompanhamento</div></div>
      <button class="toggle ${pr.on?'on':''}" aria-label="Meta com propósito" onclick="_metaSet(m=>m.proposito.on=!m.proposito.on)"></button></div>
    ${pr.on ? `
    <div class="campo mt-8"><label>Para onde vai</label><input value="${DB.esc(pr.causa)}" maxlength="60" onchange="_metaSet(m=>m.proposito.causa=this.value)"></div>
    <div class="campo-row">
      <div class="campo"><label>Como</label><select onchange="_metaSet(m=>m.proposito.tipo=this.value)">
        <option value="pct" ${pr.tipo==='pct'?'selected':''}>% da meta</option><option value="fixo" ${pr.tipo==='fixo'?'selected':''}>Valor fixo</option></select></div>
      <div class="campo"><label>${pr.tipo==='pct'?'Porcentagem':'Valor (R$)'}</label><input type="number" min="0" value="${pr.valor}" onchange="_metaSet(m=>m.proposito.valor=parseFloat(this.value)||0)"></div>
    </div>
    <div class="cx-palavra"><i class="bi bi-gift"></i><div>Batendo ${DB.moeda(cfg.meta)}, vão <b>${DB.moeda(pr.tipo==='pct'?cfg.meta*pr.valor/100:pr.valor)}</b> para ${DB.esc(pr.causa)}.<br><span class="text-muted">“Mais bem-aventurado é dar que receber.” Atos 20:35</span></div></div>` : ''}
  </div>
</div>`;
}

function metaConfigurar(r){
  const cfg = r.cfg;
  const somaMix = cfg.mix.avulsos+cfg.mix.extras+cfg.mix.produtos;
  const campo = (rot, val, onchg, suf='R$') => `<label class="pf-campo"><span>${rot}</span><div>${suf==='R$'?'<b style="margin:0 6px 0 0">R$</b>':''}<input type="number" min="0" value="${val}" onchange="${onchg}">${suf!=='R$'?`<b>${suf}</b>`:''}</div></label>`;
  return `
<div class="section-box">
  <h3 class="box-tit"><i class="bi bi-sliders"></i> Meta de ${new Date().toLocaleDateString('pt-BR',{month:'long'})} em 4 passos</h3>
  <p class="text-muted text-sm mb-16">Você digita a meta geral. O sistema tira as assinaturas que já vão entrar e mostra quanto precisa vir de comanda.</p>
  <div class="passo"><span>1</span><div><strong>Meta geral</strong><p>Tudo que entra no mês. Mês passado: ${DB.moeda(DASH_DEMO.faturamento_mes_passado)}${cfg.meta?` · ${cfg.meta>=DASH_DEMO.faturamento_mes_passado?'+':''}${pct((cfg.meta/DASH_DEMO.faturamento_mes_passado-1)*100)}`:''}</p>
    <div class="pf-grid">${campo('Meta geral do mês', cfg.meta, "_metaSet(m=>m.meta=parseFloat(this.value)||0,true)")}</div></div></div>
  <div class="passo"><span>2</span><div><strong>Assinaturas previstas: ${DB.moeda(r.previstas)}</strong><p>Mensalidades ativas ${DB.moeda(r.M)} menos inadimplência e cancelamentos.</p>
    <div class="pf-grid">${campo('Inadimplência', cfg.inad, "_metaSet(m=>m.inad=parseFloat(this.value)||0)", '%')}${campo('Cancelamentos (churn)', cfg.churn, "_metaSet(m=>m.churn=parseFloat(this.value)||0)", '%')}</div></div></div>
  <div class="passo"><span>3</span><div><strong>Assinaturas novas</strong><p>Quanto a equipe deve vender de planos novos no mês.</p>
    <div class="pf-grid">${campo('Meta de assinaturas novas', cfg.novas, "_metaSet(m=>m.novas=parseFloat(this.value)||0)")}</div></div></div>
  <div class="passo"><span>4</span><div><strong>Meta em comandas: ${DB.moeda(r.metaComandas)}</strong><p>${pct(cfg.meta?r.metaComandas/cfg.meta*100:0)} da meta. Como ela se divide (precisa somar 100%):</p>
    <div class="pf-grid">${campo('Avulsos', cfg.mix.avulsos, "_metaSet(m=>m.mix.avulsos=parseFloat(this.value)||0)", '%')}${campo('Extras', cfg.mix.extras, "_metaSet(m=>m.mix.extras=parseFloat(this.value)||0)", '%')}${campo('Produtos', cfg.mix.produtos, "_metaSet(m=>m.mix.produtos=parseFloat(this.value)||0)", '%')}</div>
    ${somaMix!==100?`<p class="badge vermelho mt-8" style="text-transform:none">O mix soma ${somaMix}%. Ajuste para 100%.</p>`:''}</div></div>
  <div class="meta-resumo">
    <div><small>Meta geral</small><strong>${DB.moeda(cfg.meta)}</strong></div>
    <div><small>Assinaturas previstas</small><strong>${DB.moeda(r.previstas)}</strong></div>
    <div><small>Assinaturas novas</small><strong>${DB.moeda(cfg.novas)}</strong></div>
    <div><small>Meta em comandas</small><strong style="color:var(--verde)">${DB.moeda(r.metaComandas)}</strong></div>
  </div>
</div>
<div class="section-box">
  <h3 class="box-tit"><i class="bi bi-clock-history"></i> Histórico de alterações</h3>
  ${cfg.historico.length ? cfg.historico.map(h=>`<div class="cx-hist"><div><strong>${DB.moeda(h.de)} → ${DB.moeda(h.para)}</strong><span>${DB.esc(h.motivo)} · ${new Date(h.quando).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</span></div></div>`).join('')
    : '<p class="text-muted text-sm">Nenhuma calibragem neste mês. Alterações no meio do mês pedem motivo e ficam aqui.</p>'}
</div>`;
}

/* ─── EDIÇÃO ─── */
function _metaSet(fn){
  const m = lerMeta(); fn(m); salvarMeta(m);
  Object.keys(_serieCache).forEach(k=>delete _serieCache[k]);
  const y = window.scrollY; navegar('meta', window._paramsMeta||{}); window.scrollTo(0,y);
}

function abrirCalibrar(){
  const r = calcMeta();
  _modalCaixa(`
    ${_topoModal('bi-sliders','var(--accent-d)','Calibrar meta')}
    <p class="text-muted text-sm mb-16">Vale a partir de amanhã: o que já passou não muda. O motivo fica no histórico.</p>
    <div class="campo"><label>Nova meta do mês (R$)</label><input id="cal-meta" type="number" min="0" value="${r.cfg.meta}"></div>
    <div class="campo"><label>Motivo</label><input id="cal-motivo" maxlength="120" placeholder="Ex.: barbeiro novo começou, feriado prolongado"></div>
    <p class="text-muted text-sm">A meta não pode ficar abaixo das assinaturas previstas (${DB.moeda(r.previstas)}).</p>
    <button class="btn-modal primario" onclick="_salvarCalibragem(${r.previstas})"><i class="bi bi-check2"></i> Salvar nova meta</button>
    ${r.cfg.historico.length ? `<button class="btn-modal secundario" onclick="_desfazerCalibragem()"><i class="bi bi-arrow-counterclockwise"></i> Desfazer a última alteração</button>` : ''}
    <button class="btn-modal secundario" onclick="fecharModal('modal-caixa')">Cancelar</button>`);
}
function _salvarCalibragem(previstas){
  const nova = _num('cal-meta'), motivo = document.getElementById('cal-motivo').value.trim();
  if(!motivo){ DB.toast('Escreva o motivo da alteração','erro'); return; }
  if(nova<=0){ DB.toast('A meta não pode ser zero','erro'); return; }
  if(nova<previstas){ DB.toast(`A meta não pode ficar abaixo das assinaturas previstas (${DB.moeda(previstas)})`,'erro'); return; }
  fecharModal('modal-caixa');
  _metaSet(m=>{ m.historico.unshift({quando:new Date().toISOString(), de:m.meta, para:nova, motivo}); m.meta = nova; });
  DB.toast('Meta calibrada','sucesso');
}
function _desfazerCalibragem(){
  fecharModal('modal-caixa');
  _metaSet(m=>{ const h = m.historico.shift(); if(h) m.meta = h.de; });
  DB.toast('Última alteração desfeita','sucesso');
}

/* ─── MODO TV (para a TV da barbearia) ─── */
function abrirModoTV(){
  const r = calcMeta(), f = lerFe(), p = palavraDoDia(), pr = r.cfg.proposito;
  let o = document.getElementById('modo-tv');
  if(!o){ o = document.createElement('div'); o.id='modo-tv'; document.body.appendChild(o); }
  const nome = lerPersonalidade().nome;
  o.innerHTML = `
  <button class="tv-fechar" onclick="fecharModoTV()" aria-label="Fechar Modo TV">×</button>
  <div class="tv-topo"><span>${DB.esc(nome)}</span><span>Meta de ${new Date().toLocaleDateString('pt-BR',{month:'long'})}</span></div>
  <div class="tv-centro">
    <div class="tv-pct">${Math.round(r.pct)}<small>%</small></div>
    <div class="tv-sub">${DB.moeda(r.entrou)} de ${DB.moeda(r.cfg.meta)}</div>
    <div class="tv-barra"><div style="width:${Math.min(r.pct,100)}%"></div></div>
    <div class="tv-nums">
      <div><small>Hoje precisa</small><b>${DB.moeda(r.precisaHoje)}</b></div>
      <div><small>Já entrou hoje</small><b>${DB.moeda(r.hojeD?r.hojeD.comandas:0)}</b></div>
      <div><small>Dias que faltam</small><b>${r.restantes}</b></div>
    </div>
    ${pr.on ? `<div class="tv-prop"><i class="bi bi-heart-fill"></i> Batendo a meta, ${DB.moeda(pr.tipo==='pct'?r.cfg.meta*pr.valor/100:pr.valor)} vão para ${DB.esc(pr.causa)}</div>` : ''}
  </div>
  ${f.fe_ativa ? `<div class="tv-palavra">“${p.texto}” <b>${p.ref}</b></div>` : ''}`;
  o.classList.add('aberto');
  try { o.requestFullscreen && o.requestFullscreen().catch(()=>{}); } catch(e){}
  document.addEventListener('keydown', _escTV);
}
function _escTV(e){ if(e.key==='Escape') fecharModoTV(); }
function fecharModoTV(){
  const o = document.getElementById('modo-tv'); if(o) o.classList.remove('aberto');
  try { document.fullscreenElement && document.exitFullscreen(); } catch(e){}
  document.removeEventListener('keydown', _escTV);
}

/* ─── IMAGEM PARA O GRUPO (WhatsApp da equipe) ─── */
function _quebrar(ctx, texto, larg){
  const pal = texto.split(' '), linhas = []; let l = '';
  pal.forEach(w=>{ const t = l ? l+' '+w : w; if(ctx.measureText(t).width > larg && l){ linhas.push(l); l = w; } else l = t; });
  if(l) linhas.push(l); return linhas;
}
async function imagemMetaGrupo(){
  const r = calcMeta(), f = lerFe(), p = palavraDoDia(), P = lerPersonalidade(), pr = r.cfg.proposito;
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), ouro = P.cor || '#C9A84C', fonte = "'Inter', system-ui, sans-serif";
  x.fillStyle = '#111'; x.fillRect(0,0,W,H);
  const g = x.createRadialGradient(W,0,50,W,0,900); g.addColorStop(0,'rgba(201,168,76,.35)'); g.addColorStop(1,'rgba(201,168,76,0)');
  x.fillStyle = g; x.fillRect(0,0,W,H);
  x.fillStyle = ouro; x.font = `800 34px ${fonte}`; x.fillText(P.nome.toUpperCase(), 80, 120);
  x.fillStyle = 'rgba(255,255,255,.6)'; x.font = `600 34px ${fonte}`;
  x.fillText(`Meta de ${new Date().toLocaleDateString('pt-BR',{month:'long'})} · ${new Date().toLocaleDateString('pt-BR')}`, 80, 172);
  x.fillStyle = '#fff'; x.font = `900 220px ${fonte}`; x.fillText(`${Math.round(r.pct)}%`, 70, 430);
  x.fillStyle = 'rgba(255,255,255,.75)'; x.font = `600 40px ${fonte}`; x.fillText(`${DB.moeda(r.entrou)} de ${DB.moeda(r.cfg.meta)}`, 80, 500);
  x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.roundRect(80,550,920,34,17); x.fill();
  x.fillStyle = ouro; x.beginPath(); x.roundRect(80,550,Math.max(920*Math.min(r.pct,100)/100,34),34,17); x.fill();
  const box = (bx, rot, val) => { x.fillStyle='rgba(255,255,255,.06)'; x.beginPath(); x.roundRect(bx,640,290,170,24); x.fill();
    x.fillStyle='rgba(255,255,255,.6)'; x.font=`600 28px ${fonte}`; x.fillText(rot,bx+28,694);
    x.fillStyle='#fff'; x.font=`800 44px ${fonte}`; x.fillText(val,bx+28,768); };
  box(80,'Hoje precisa', DB.moeda(r.precisaHoje)); box(395,'Falta no mês', DB.moeda(r.faltaComanda)); box(710,'Dias abertos', String(r.restantes));
  let y = 900;
  if(pr.on){ x.fillStyle = ouro; x.font = `700 34px ${fonte}`;
    _quebrar(x, `♥ Batendo a meta, ${DB.moeda(pr.tipo==='pct'?r.cfg.meta*pr.valor/100:pr.valor)} vão para ${pr.causa}`, 920).forEach(l=>{ x.fillText(l,80,y); y+=48; }); y+=20; }
  if(f.fe_ativa){ x.fillStyle = '#fff'; x.font = `italic 600 36px ${fonte}`;
    _quebrar(x, `“${p.texto}”`, 920).slice(0,4).forEach(l=>{ x.fillText(l,80,y); y+=50; });
    x.fillStyle = ouro; x.font = `700 32px ${fonte}`; x.fillText(p.ref, 80, y+10); }
  x.fillStyle = 'rgba(255,255,255,.35)'; x.font = `600 26px ${fonte}`; x.fillText('DuoTech Barber', 80, H-60);
  const blob = await new Promise(res=>c.toBlob(res,'image/png'));
  const arq = new File([blob], `meta-${new Date().toISOString().slice(0,10)}.png`, {type:'image/png'});
  try {
    if(navigator.canShare && navigator.canShare({files:[arq]})){ await navigator.share({files:[arq], title:'Meta do mês'}); return; }
  } catch(e){ if(e && e.name==='AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = arq.name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
  DB.toast('Imagem salva. É só mandar no grupo da equipe.','sucesso');
}
