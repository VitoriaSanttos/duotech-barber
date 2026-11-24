/* ═══════════════════════════════════════════════
   DuoTech Barber · inicio.js  (versão 14)
   Início novo (Saúde do negócio, Precisa de ação hoje, Crescimento,
   ocupação por horário) e a tela Propósito (Palavra do dia).
   Substitui o TELAS.inicio antigo do app.js.
═══════════════════════════════════════════════ */

/* ─── TELA: INÍCIO (painel do dono) ───
   Estrutura: Palavra do dia / Momento da equipe (topo),
   saudação, abas Hoje e Crescimento, Saúde do negócio
   e Precisa de ação hoje. Números: DASH_DEMO (dados-demo.js). */
const brl = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
/* primeiro nome de quem está usando o painel */
const DONO_NOME = ()=>String(document.getElementById('userNome')?.textContent || lerPersonalidade().nome || '').trim().split(/\s+/)[0] || 'tudo bem';

function saudacao(){
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function linkWhats(tel, texto){
  const num = (tel||'').replace(/\D/g,'');
  return `https://wa.me/${num ? '55'+num : ''}?text=${encodeURIComponent(texto)}`;
}

function bannerFe(){
  const f = lerFe();
  if(!f.fe_ativa) return '';
  const p = palavraDoDia();
  const feito = momentoFeito();
  const abre = new Date(); abre.setHours(8,0,0,0);
  const textoCompartilhar = `📖 Palavra do dia\n\n"${p.texto}"\n${p.ref}\n\n${p.reflexao}`;
  return `
<div class="fe-carrossel" id="fe-carrossel">
  <div class="fe-slide">
    <div class="fe-tag"><i class="bi bi-book"></i> Palavra do dia</div>
    <blockquote class="fe-verso">“${p.texto}”</blockquote>
    <div class="fe-ref">${p.ref}</div>
    <p class="fe-reflexao">${p.reflexao}</p>
    <div class="fe-acoes">
      <a class="fe-btn claro" href="${linkWhats('', textoCompartilhar)}" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i> Mandar para a equipe</a>
      <button class="fe-btn" onclick="navegar('proposito')">Ver a palavra da semana</button>
    </div>
  </div>
  <div class="fe-slide">
    <div class="fe-tag"><i class="bi bi-people"></i> Momento da equipe</div>
    <div class="fe-momento-titulo">Antes de abrir a agenda</div>
    <p class="fe-reflexao">Junte a equipe por 2 minutos. Leiam a palavra de hoje e orem juntos:</p>
    <blockquote class="fe-oracao">${p.oracao}</blockquote>
    <div class="fe-acoes">
      ${feito
        ? `<span class="fe-feito"><i class="bi bi-check-circle-fill"></i> Equipe orou junto hoje</span>`
        : `<button class="fe-btn claro" onclick="marcarMomento();navegar('inicio')"><i class="bi bi-check2"></i> Oramos juntos</button>`}
      <span class="fe-abre">${new Date() < abre ? 'Agenda abre às 08:00' : 'Agenda aberta'}</span>
    </div>
  </div>
</div>
<div class="fe-dots" id="fe-dots"><span class="ativo"></span><span></span></div>`;
}

function cardSaude({ico, cor, titulo, valor, linhas=[], barra=null, badges='', link=null, info=''}){
  return `
<div class="dash-card">
  <div class="dash-card-topo">
    <div class="dash-ico ${cor}"><i class="bi ${ico}"></i></div>
    ${badges}
    ${info ? `<i class="bi bi-info-circle dash-info" title="${info}"></i>` : ''}
  </div>
  <div class="dash-titulo">${titulo}</div>
  <div class="dash-valor">${valor}</div>
  ${barra!==null ? `<div class="dash-barra"><div style="width:${Math.min(barra.atual/barra.total*100,100)}%"></div><span class="dash-meta" style="left:${barra.meta}%"></span></div>` : ''}
  ${linhas.map(l=>`<div class="dash-linha"><span>${l[0]}</span><strong>${l[1]}</strong></div>`).join('')}
  ${link ? `<a class="dash-link" onclick='navegar(${JSON.stringify(link[1])}, ${JSON.stringify(link[2]||{})})'>${link[0]} <i class="bi bi-chevron-right"></i></a>` : ''}
</div>`;
}

function blocoAcao({ico, cor, titulo, sub, qtd, itens, rodape, alerta=false}){
  return `
<div class="acao-box ${alerta?'alerta':''}">
  <div class="acao-topo">
    <div class="dash-ico ${cor}"><i class="bi ${ico}"></i></div>
    <div class="acao-tit"><strong>${titulo}</strong><span>${sub}</span></div>
    <div class="acao-qtd ${cor}">${qtd}</div>
  </div>
  ${itens.length ? itens.join('') : `<div class="acao-vazio"><i class="bi bi-check2-circle"></i> Tudo em dia por aqui.</div>`}
  ${rodape ? `<div class="acao-rodape">${rodape}</div>` : ''}
</div>`;
}

function itemAcao(iniciais, nome, sub, direita){
  return `<div class="acao-item"><div class="acao-av">${iniciais}</div><div class="acao-info"><strong>${nome}</strong><span>${sub}</span></div>${direita}</div>`;
}
const ini = n => n.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();

function abaHoje(){
  const d = DASH_DEMO, f = lerFe(), p = PERSONALIDADE_PADRAO;
  /* variação contra o mês passado (sem mês passado, não há o que comparar) */
  const dif = d.faturamento_mes_passado > 0 ? (d.faturamento_mes - d.faturamento_mes_passado) / d.faturamento_mes_passado * 100 : null;

  return `
<div class="dash-secao"><span class="ponto azul"></span><strong>Saúde do negócio</strong><span>como você está agora</span></div>
<div class="dash-grid">
  ${cardSaude({ico:'bi-currency-dollar', cor:'verde', titulo:'Faturamento do mês', valor:brl(d.faturamento_mes),
     linhas:[['Mês passado', brl(d.faturamento_mes_passado)], ['Acumulado no ano', brl(d.acumulado_ano)]],
     badges: dif===null ? '' : `<span class="dash-badge ${dif>=0?'sobe':'desce'}"><i class="bi bi-arrow-${dif>=0?'up':'down'}"></i> ${Math.abs(dif).toFixed(1).replace('.',',')}%</span>`,
     info:'Mês até hoje, comparado com o mês passado inteiro'})}
  ${cardSaude({ico:'bi-calendar-check', cor:'azul', titulo:'Ocupação da agenda', valor:`${d.ocupacao.toLocaleString('pt-BR')}%`,
     barra:{atual:d.ocupacao, total:100, meta:d.meta_ocupacao},
     linhas:[['Meta', `${d.meta_ocupacao}%`]], link:['Ver por horário','inicio',{aba:'crescimento'}],
     info:'Horas agendadas divididas pelas horas abertas dos barbeiros'})}
  ${cardSaude({ico:'bi-gem', cor:'ouro', titulo:'Planos ativos', valor:d.planos_ativos,
     badges:`<span class="dash-badges"><span class="dash-badge sobe"><i class="bi bi-arrow-up"></i> ${d.planos_vendidos_mes}</span><span class="dash-badge desce"><i class="bi bi-arrow-down"></i> ${d.planos_cancelados_mes}</span></span>`,
     linhas:[['Vendidos · cancelados no mês', `${d.planos_vendidos_mes} · ${d.planos_cancelados_mes}`]], link:['Ver planos','planos']})}
  ${cardSaude({ico:'bi-tag', cor:'laranja', titulo:'Ticket médio', valor:brl(d.ticket_medio),
     linhas:[['Geral', 'plano + avulso']], info:'Quanto cada cliente deixa, em média, por visita'})}
  ${cardSaude({ico:'bi-receipt', cor:'cinza', titulo:'Comandas abertas', valor:d.comandas_abertas,
     linhas:[['De outros dias', d.comandas_outros_dias]], link:['Ver caixa','caixa']})}
</div>

<div class="dash-secao"><span class="ponto vermelho"></span><strong>Precisa de ação hoje</strong><span>dinheiro parado e pendências, resolva direto daqui</span></div>
<div class="acao-grid">
  ${blocoAcao({ico:'bi-qr-code', cor:'ouro', titulo:'Pix de plano para conferir', sub:'cliente pediu o plano, confira se o Pix caiu',
     qtd:d.pix_conferir.length,
     itens:d.pix_conferir.map(x=>itemAcao(ini(x.nome), DB.esc(x.nome), `${DB.esc(x.plano)} · ${brl(x.valor)} · ${x.quando}${x.disse_que_pagou?' · <b>disse que pagou</b>':''}`,
       (x.id ? `<button class="acao-btn verde" onclick="confirmarPixPlano('${x.id}')">Pix recebido</button>` : `<button class="acao-btn verde" onclick="DB.toast('Plano de ${DB.esc(x.nome)} ativado','sucesso')">Pix recebido</button>`))),
     rodape:`<a onclick="navegar('planos')">Ver todos <i class="bi bi-chevron-right"></i></a>`})}

  ${blocoAcao({ico:'bi-hourglass-split', cor:'laranja', titulo:'Mensalidade em aberto', sub:'plano venceu e o Pix ainda não chegou',
     qtd:d.mensalidade_aberta.length,
     itens:d.mensalidade_aberta.map(x=>itemAcao(ini(x.nome), DB.esc(x.nome), `${DB.esc(x.plano)} · ${x.dias} dia${x.dias>1?'s':''} em atraso`,
       `<a class="acao-whats" target="_blank" rel="noopener" title="Lembrar pelo WhatsApp" href="${linkWhats(x.tel,
         `Fala, ${x.nome.split(' ')[0]}! Tudo certo? Passando pra lembrar que a mensalidade do ${x.plano} venceu. Quando puder, é só pagar pelo app que teu plano continua ativo. Deus abençoe!`)}"><i class="bi bi-whatsapp"></i></a>`)),
     rodape:`<a onclick="navegar('planos')">Ver inadimplentes <i class="bi bi-chevron-right"></i></a>`})}


  ${blocoAcao({ico:'bi-box-seam', cor:'vermelho', titulo:'Estoque mínimo', sub:'repõe antes de faltar na venda', alerta:true,
     qtd:d.estoque_minimo.length,
     itens:d.estoque_minimo.slice(0,3).map(x=>itemAcao('<i class="bi bi-box"></i>', DB.esc(x.nome), `atual ${x.atual} · mínimo ${x.min}`,
       `<span class="badge vermelho">repor</span>`)),
     rodape:`${d.estoque_minimo.length>3?`<span>+${d.estoque_minimo.length-3} outros</span>`:''}<a onclick="navegar('estoque')">Ver produtos <i class="bi bi-chevron-right"></i></a>`})}

  ${!CONFIG.MODO_DEMO ? '' : blocoAcao({ico:'bi-file-earmark-text', cor:'azul', titulo:'Contratos dos barbeiros', sub:'sem contrato ou vencendo em até 60 dias',
     qtd:d.contratos_pendentes.length,
     itens:d.contratos_pendentes.map(x=>itemAcao(ini(x.nome), x.nome, x.situacao, `<span class="badge vermelho">Pendente</span>`)),
     rodape:`<a onclick="navegar('comissoes')">Ver barbeiros <i class="bi bi-chevron-right"></i></a>`})}
</div>`;
}

function abaCrescimento(){
  const m = DASH_DEMO.meses;
  const maxFat = Math.max(...m.map(x=>x.fat));
  const maxCli = Math.max(...m.map(x=>x.novos+x.voltaram));
  const ult = m[m.length-1], pen = m[m.length-2];
  const retencao = ult.voltaram/(ult.voltaram+ult.novos)*100;
  return `
<div class="dash-secao"><span class="ponto verde"></span><strong>Crescimento</strong><span>últimos 6 meses</span></div>
<div class="dash-grid dois">
  <div class="fin-graf">
    <h3>Faturamento por mês</h3>
    <div class="barras" style="height:140px">
      ${m.map((x,i)=>`<div class="barra-wrap">
        <div class="barra-val">${(x.fat/1000).toFixed(1).replace('.',',')}k</div>
        <div class="barra" style="height:${x.fat/maxFat*110}px;${i===m.length-1?'opacity:.55':''}"></div>
        <div class="barra-label">${x.mes}</div></div>`).join('')}
    </div>
    <p class="text-muted text-sm mt-8">${ult.mes} ainda não fechou.</p>
  </div>
  <div class="fin-graf">
    <h3>Clientes atendidos</h3>
    <div class="barras empilhada" style="height:140px">
      ${m.map(x=>`<div class="barra-wrap">
        <div class="barra-val">${x.novos+x.voltaram}</div>
        <div class="barra-pilha" style="height:${(x.novos+x.voltaram)/maxCli*110}px">
          <div class="barra novos" style="height:${x.novos/(x.novos+x.voltaram)*100}%"></div>
          <div class="barra voltaram" style="flex:1"></div>
        </div>
        <div class="barra-label">${x.mes}</div></div>`).join('')}
    </div>
    <div class="legenda mt-8"><span><i class="leg voltaram"></i> Voltaram</span><span><i class="leg novos"></i> Novos</span></div>
  </div>
</div>
${mapaOcupacao()}
<div class="cards-row">
  <div class="stat-card"><div class="label">Clientes que voltam</div><div class="valor">${retencao.toFixed(0)}%</div><div class="sub">dos atendidos em ${ult.mes} já eram clientes</div></div>
  <div class="stat-card"><div class="label">Clientes novos</div><div class="valor">${ult.novos}</div><div class="sub">${pen.novos} em ${pen.mes}</div></div>
  <div class="stat-card"><div class="label">Ticket médio</div><div class="valor">${brl(ult.ticket)}</div><div class="sub">era ${brl(m[0].ticket)} em ${m[0].mes}</div></div>
  <div class="stat-card"><div class="label">Planos no mês</div><div class="valor">+${DASH_DEMO.planos_vendidos_mes - DASH_DEMO.planos_cancelados_mes}</div><div class="sub">${DASH_DEMO.planos_vendidos_mes} vendidos, ${DASH_DEMO.planos_cancelados_mes} cancelados</div></div>
</div>`;
}

/* Ocupação por dia e hora (últimos 30 dias). Demo: OCUPACAO_DEMO */
function mapaOcupacao(){
  const dias = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const horas = [...Array(13)].map((_,i)=>i+7);
  const faixa = v => v===null ? 'fechado' : v<=20?'f1':v<=40?'f2':v<=60?'f3':v<=80?'f4':'f5';
  const lista = [];
  dias.forEach((d,di)=>horas.forEach((h,hi)=>{ const v=OCUPACAO_DEMO[di][hi]; if(v!==null) lista.push({d,h,v}); }));
  const top = [...lista].sort((a,b)=>b.v-a.v).slice(0,3);
  const vazios = [...lista].sort((a,b)=>a.v-b.v).slice(0,3);
  return `
<div class="section-box">
  <h3 class="box-tit"><i class="bi bi-grid-3x3-gap"></i> Ocupação por horário <span class="text-muted text-sm" style="font-weight:500">últimos 30 dias</span></h3>
  <div class="heat-leg">${['0–20%','21–40%','41–60%','61–80%','81–100%'].map((t,i)=>`<span><i class="heat f${i+1}"></i>${t}</span>`).join('')}<span><i class="heat fechado"></i>fechado</span></div>
  <div class="heat-wrap">
    <div class="heat-grid" style="grid-template-columns:42px repeat(${dias.length},1fr)">
      <div></div>${dias.map(d=>`<div class="heat-dia">${d}</div>`).join('')}
      ${horas.map((h,hi)=>`<div class="heat-hora">${String(h).padStart(2,'0')}h</div>${dias.map((d,di)=>{
        const v=OCUPACAO_DEMO[di][hi];
        return `<div class="heat ${faixa(v)}" title="${d} ${h}h: ${v===null?'fechado':v+'%'}"></div>`;}).join('')}`).join('')}
    </div>
    <div class="heat-dicas">
      <div><strong><i class="bi bi-fire"></i> Horários mais cheios</strong>${top.map(x=>`<span>${x.d} ${x.h}h · ${x.v}%</span>`).join('')}
        <p>Bom horário para cobrar mais caro ou reservar para quem tem plano.</p></div>
      <div><strong><i class="bi bi-snow"></i> Horários mais vazios</strong>${vazios.map(x=>`<span>${x.d} ${x.h}h · ${x.v}%</span>`).join('')}
        <p>Bom horário para uma promoção no WhatsApp ou para atender a fila.</p></div>
    </div>
  </div>
</div>`;
}

TELAS.inicio = (params={})=>{
  const aba = params.aba || 'hoje';
  const data = new Date().toLocaleDateString('pt-BR',{weekday:'long', day:'numeric', month:'long', year:'numeric'});
  return `
${bannerFe()}
<div class="dash-ola">
  <h1>${saudacao()}, ${DB.esc(DONO_NOME())}</h1>
  <p>${data.charAt(0).toUpperCase()+data.slice(1)} · visão geral da barbearia</p>
</div>
<div class="dash-abas">
  <button class="${aba==='hoje'?'ativa':''}" onclick="navegar('inicio',{aba:'hoje'})"><i class="bi bi-clock"></i> Hoje</button>
  <button class="${aba==='crescimento'?'ativa':''}" onclick="navegar('inicio',{aba:'crescimento'})"><i class="bi bi-graph-up-arrow"></i> Crescimento</button>
</div>
${aba==='hoje' ? abaHoje() : abaCrescimento()}`;
};

/* ─── TELA: PROPÓSITO (fé) ─── */
TELAS.proposito = ()=>{
  const f = lerFe();
  const semana = [...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()+i); return {d, p:palavraDoDia(d)}; });
  const tog = (chave, titulo, sub) => `
    <div class="pref-row"><div class="info"><div class="ptitulo">${titulo}</div><div class="psub">${sub}</div></div>
    <button class="toggle ${f[chave]?'on':''}" onclick="const x=lerFe();x['${chave}']=!x['${chave}'];salvarFe(x);navegar('proposito')" aria-label="${titulo}"></button></div>`;
  return `
<div class="grid-2" style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px">
  <div>
    <div class="section-box">
      <h3 class="box-tit"><i class="bi bi-book"></i> Palavra da semana</h3>
      ${semana.map(({d,p},i)=>`
        <div class="palavra-linha">
          <div class="palavra-dia">${i===0?'Hoje':d.toLocaleDateString('pt-BR',{weekday:'short', day:'numeric'})}</div>
          <div><strong>${p.ref}</strong><div class="text-muted text-sm">${p.texto}</div></div>
        </div>`).join('')}
    </div>
  </div>
  <div>
    <div class="section-box">
      <h3 class="box-tit"><i class="bi bi-toggles"></i> Onde a fé aparece</h3>
      ${tog('fe_ativa','Propósito ligado','Palavra do dia e momento da equipe no painel')}
      ${tog('fe_lembrete','No lembrete do WhatsApp','O botão "Lembrete" da Agenda manda a palavra do dia junto')}
      ${tog('fe_dizimo','Lembrete do dízimo','Ao fechar o caixa, mostra 10% do saldo do dia (só para o dono)')}
    </div>
    <div class="section-box">
      <h3 class="box-tit"><i class="bi bi-whatsapp"></i> Prévia do lembrete</h3>
      <div class="whats-previa">
        Fala, Lucas! Teu horário com o Thiago é amanhã às 10:00. Te esperamos!<br><br>
        ${f.fe_lembrete ? `📖 <i>“${palavraDoDia().texto}”</i><br>${palavraDoDia().ref}` : '<span class="text-muted">(sem versículo)</span>'}
      </div>
    </div>
  </div>
</div>`;
};


/* carrossel da Palavra do dia: as bolinhas acompanham o slide */
TELAS.inicioDepois = ()=>{
  const car = document.getElementById('fe-carrossel'); if(!car) return;
  const dots = document.querySelectorAll('#fe-dots span');
  car.addEventListener('scroll', ()=>{
    const i = Math.round(car.scrollLeft / car.clientWidth);
    dots.forEach((d,j)=>d.classList.toggle('ativo', i===j));
  }, {passive:true});
  dots.forEach((d,j)=>d.addEventListener('click', ()=>car.scrollTo({left:j*car.clientWidth, behavior:'smooth'})));
};
Object.assign(TITULOS, {inicio:'Início', proposito:'Palavra do dia', caixa:'Caixa', meta:'Meta do mês', profit:'Lucro real', academia:'Academia'});
