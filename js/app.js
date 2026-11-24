/* ═══════════════════════════════════════════════
   DuoTech Barber v3 · app.js
   Roteador + todas as TELAS do painel admin
   e do link público de agendamento
═══════════════════════════════════════════════ */

/* Dados de demonstração: js/dados-demo.js (SERVICOS, PLANOS, BARBEIROS, RECOMPENSAS) */

/* ─── ROTEADOR ─── */
const TELAS = {};

function navegar(tela, params={}){
  document.querySelectorAll('[data-nav]').forEach(a=>{
    a.classList.toggle('ativo', a.dataset.nav===tela);
  });
  const cp = document.getElementById('conteudo-principal');
  if(!cp) return;
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
  estoque:'Estoque', caixa:'Caixa', fidelidade:'Clube de pontos', planos:'Planos',
  link:'App do cliente', personalizar:'Personalidade', config:'Configurações',
  proposito:'Propósito',
};

function afterRender(tela){
  /* Carrossel da Palavra do dia: bolinhas acompanham o slide */
  const car = document.getElementById('fe-carrossel');
  if(car){
    const dots = document.querySelectorAll('#fe-dots span');
    car.addEventListener('scroll', ()=>{
      const i = Math.round(car.scrollLeft / car.clientWidth);
      dots.forEach((d,j)=>d.classList.toggle('ativo', i===j));
    }, {passive:true});
    dots.forEach((d,j)=>d.addEventListener('click', ()=>car.scrollTo({left:j*car.clientWidth, behavior:'smooth'})));
  }
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

/* ─── TELA: INÍCIO (painel do dono) ───
   Estrutura: Palavra do dia / Momento da equipe (topo),
   saudação, abas Hoje e Crescimento, Saúde do negócio
   e Precisa de ação hoje. Números: DASH_DEMO (dados-demo.js). */
const brl = v => v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const DONO = 'Thiago';

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
      <button class="fe-btn" onclick="navegar('proposito')">Ver pedidos de oração</button>
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
  const dif = (d.faturamento_mes - d.faturamento_mes_passado) / d.faturamento_mes_passado * 100;
  const orados = pedidosOrados();
  const pedidos = PEDIDOS_ORACAO_DEMO.filter(x=>!orados.includes(x.id));

  return `
<div class="dash-secao"><span class="ponto azul"></span><strong>Saúde do negócio</strong><span>como você está agora</span></div>
<div class="dash-grid">
  ${cardSaude({ico:'bi-currency-dollar', cor:'verde', titulo:'Faturamento do mês', valor:brl(d.faturamento_mes),
     linhas:[['Mês passado', brl(d.faturamento_mes_passado)], ['Acumulado no ano', brl(d.acumulado_ano)]],
     badges:`<span class="dash-badge ${dif>=0?'sobe':'desce'}"><i class="bi bi-arrow-${dif>=0?'up':'down'}"></i> ${Math.abs(dif).toFixed(1).replace('.',',')}%</span>`,
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
     itens:d.pix_conferir.map(x=>itemAcao(ini(x.nome), x.nome, `${x.plano} · ${brl(x.valor)} · ${x.quando}${x.disse_que_pagou?' · <b>disse que pagou</b>':''}`,
       `<button class="acao-btn verde" onclick="DB.toast('Plano de ${x.nome} ativado','sucesso')">Pix recebido</button>`)),
     rodape:`<a onclick="navegar('planos')">Ver todos <i class="bi bi-chevron-right"></i></a>`})}

  ${blocoAcao({ico:'bi-hourglass-split', cor:'laranja', titulo:'Mensalidade em aberto', sub:'plano venceu e o Pix ainda não chegou',
     qtd:d.mensalidade_aberta.length,
     itens:d.mensalidade_aberta.map(x=>itemAcao(ini(x.nome), x.nome, `${x.plano} · ${x.dias} dia${x.dias>1?'s':''} em atraso`,
       `<a class="acao-whats" target="_blank" rel="noopener" title="Lembrar pelo WhatsApp" href="${linkWhats(x.tel,
         `Fala, ${x.nome.split(' ')[0]}! Tudo certo? Passando pra lembrar que a mensalidade do ${x.plano} venceu. Quando puder, é só pagar pelo app que teu plano continua ativo. Deus abençoe!`)}"><i class="bi bi-whatsapp"></i></a>`)),
     rodape:`<a onclick="navegar('planos')">Ver inadimplentes <i class="bi bi-chevron-right"></i></a>`})}

  ${f.fe_ativa ? blocoAcao({ico:'bi-heart', cor:'roxo', titulo:'Pedidos de oração', sub:'clientes pediram oração pelo app, em particular',
     qtd:pedidos.length,
     itens:pedidos.slice(0,3).map(x=>itemAcao(x.anonimo?'<i class="bi bi-person"></i>':ini(x.nome), x.anonimo?'Anônimo':x.nome, x.texto,
       `<button class="acao-btn roxo" onclick="marcarOrado('${x.id}');navegar('inicio')">Orei</button>`)),
     rodape:`<a onclick="navegar('proposito')">Ver todos <i class="bi bi-chevron-right"></i></a>`}) : ''}

  ${blocoAcao({ico:'bi-box-seam', cor:'vermelho', titulo:'Estoque mínimo', sub:'repõe antes de faltar na venda', alerta:true,
     qtd:d.estoque_minimo.length,
     itens:d.estoque_minimo.slice(0,3).map(x=>itemAcao('<i class="bi bi-box"></i>', x.nome, `atual ${x.atual} · mínimo ${x.min}`,
       `<span class="badge vermelho">repor</span>`)),
     rodape:`${d.estoque_minimo.length>3?`<span>+${d.estoque_minimo.length-3} outros</span>`:''}<a onclick="navegar('estoque')">Ver produtos <i class="bi bi-chevron-right"></i></a>`})}

  ${blocoAcao({ico:'bi-file-earmark-text', cor:'azul', titulo:'Contratos dos barbeiros', sub:'sem contrato ou vencendo em até 60 dias',
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
  <h1>${saudacao()}, ${DONO}</h1>
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
  const orados = pedidosOrados();
  const semana = [...Array(7)].map((_,i)=>{ const d=new Date(); d.setDate(d.getDate()+i); return {d, p:palavraDoDia(d)}; });
  const tog = (chave, titulo, sub) => `
    <div class="pref-row"><div class="info"><div class="ptitulo">${titulo}</div><div class="psub">${sub}</div></div>
    <button class="toggle ${f[chave]?'on':''}" onclick="const x=lerFe();x['${chave}']=!x['${chave}'];salvarFe(x);navegar('proposito')" aria-label="${titulo}"></button></div>`;
  return `
<div class="grid-2" style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px">
  <div>
    <div class="section-box">
      <h3 class="box-tit"><i class="bi bi-heart"></i> Pedidos de oração</h3>
      <p class="text-muted text-sm mb-16">O cliente escreve pelo app, em particular. Só a equipe vê. Ele escolhe se quer aparecer com o nome.</p>
      ${PEDIDOS_ORACAO_DEMO.map(x=>`
        <div class="oracao-item ${orados.includes(x.id)?'orado':''}">
          <div class="oracao-topo"><strong>${x.anonimo?'Anônimo':x.nome}</strong><span>${x.quando}</span></div>
          <p>${x.texto}</p>
          ${orados.includes(x.id)
            ? `<span class="badge verde"><i class="bi bi-check2"></i> Equipe orou</span>`
            : `<button class="acao-btn roxo" onclick="marcarOrado('${x.id}');navegar('proposito')">Orei por esse pedido</button>`}
        </div>`).join('')}
    </div>
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
      ${tog('fe_ativa','Propósito ligado','Palavra do dia, momento da equipe e pedidos de oração no painel')}
      ${tog('fe_app_cliente','No app do cliente','Versículo do dia e botão de pedir oração')}
      ${tog('fe_lembrete','No lembrete do WhatsApp','O lembrete do horário vai com a palavra do dia')}
      ${tog('fe_fila','Na fila de espera','Devocional curto para o cliente ler enquanto espera')}
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

/* ─── TELA: AGENDA ─── */
TELAS.agenda = ()=>{
  const horas = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
                 '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
                 '16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30'];
  const ags = {
    '10:00':{nome:'Lucas Ferreira',serv:'Corte + Barba',val:150,status:'confirmado',sinal:true,barb:'Thiago'},
    '10:30':{nome:'Rafael Souza',  serv:'Pigmentação Barba',val:40,status:'confirmado',sinal:false,barb:'Marcus'},
    '11:00':{nome:'Carlos Mendes', serv:'Protese Capilar',  val:195,status:'sinal',   sinal:true, barb:'Thiago'},
    '14:00':{nome:'André Lima',    serv:'Corte Raspado',    val:50, status:'aguardando',sinal:false,barb:'Pedro'},
    '16:00':{nome:'Thiago B.',     serv:'Luzes',            val:160,status:'confirmado',sinal:true,barb:'Thiago'},
  };
  return `
<div class="section-header">
  <h2>Agenda · ${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'})}</h2>
  <div class="acoes">
    <button class="btn-topo" onclick="navegar('agenda')"><i class="bi bi-chevron-left"></i></button>
    <button class="btn-topo" onclick="navegar('agenda')"><i class="bi bi-chevron-right"></i></button>
    <button class="btn-topo primario" onclick="abrirModalNovoAgendamento()"><i class="bi bi-plus-lg"></i> Novo</button>
  </div>
</div>
<div class="filtros">
  ${BARBEIROS.map(b=>`<button class="filtro-btn">${b.nome.split(' ')[0]}</button>`).join('')}
  <button class="filtro-btn ativo">Todos</button>
</div>
<div class="section-box" style="padding:0;overflow:hidden">
  <div class="agenda-grid">
    ${horas.map(h=>{
      const ag = ags[h];
      return `
        <div class="agenda-hora">${h}</div>
        <div class="agenda-slot-wrap">
          ${ag?`<div class="agd-card ${ag.status}" onclick="abrirModalVerAgendamento()">
            <div class="agd-info">
              <div class="nome">${ag.nome}</div>
              <div class="servico">${ag.serv} · ${ag.barb}</div>
            </div>
            <div class="agd-side">
              <div class="valor">${DB.moeda(ag.val)}</div>
              <div class="badges">
                <span class="badge ${ag.status==='confirmado'?'verde':ag.status==='aguardando'?'amarelo':ag.status==='sinal'?'azul':'vermelho'}">${ag.status}</span>
                ${ag.sinal?'<span class="dot-sinal" title="Sinal pago"></span>':''}
              </div>
            </div>
          </div>`:''}
        </div>`;
    }).join('')}
  </div>
</div>`;
};

/* ─── TELA: FILA ─── */
TELAS.fila = ()=>`
<div class="section-header">
  <h2>Fila de Espera</h2>
  <button class="btn-topo primario" onclick="abrirModalFila()"><i class="bi bi-person-plus"></i> Adicionar</button>
</div>
<div class="fila-lista">
  ${[
    {n:1,nome:'Marcos Pereira', serv:'Corte',              barb:'Thiago', tempo:'Aguardando'},
    {n:2,nome:'João Tavares',   serv:'Barba a vapor',       barb:'Marcus', tempo:'~12 min'},
    {n:3,nome:'Felipe Rocha',   serv:'Corte + Risquinho',  barb:'Pedro',  tempo:'~22 min'},
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
    {nome:'Thiago Barbosa',  tel:'(11) 99999-0005',visits:3, total:270, plano:'—'},
  ];
  return `
<div class="section-header">
  <h2>Clientes (${lista.length})</h2>
  <div class="acoes">
    <input type="search" placeholder="Buscar cliente…" style="border:1.5px solid var(--line2);border-radius:var(--rs);padding:7px 12px;font-size:.82rem;width:200px">
  </div>
</div>
<table class="tabela">
  <thead><tr>
    <th>Cliente</th><th>Telefone</th><th>Visitas</th><th>Total gasto</th><th>Plano</th><th></th>
  </tr></thead>
  <tbody>
  ${lista.map(c=>`<tr>
    <td><div style="display:flex;align-items:center;gap:10px">
      <div class="cliente-foto">${c.nome.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
      <span style="font-weight:600">${c.nome}</span>
    </div></td>
    <td>${c.tel}</td>
    <td>${c.visits}x</td>
    <td style="font-weight:700;color:var(--verde)">${DB.moeda(c.total)}</td>
    <td>${c.plano!=='—'?`<span class="badge accent">${c.plano}</span>`:c.plano}</td>
    <td><div class="acoes">
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
<div class="grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
  <div class="section-box">
    <h3 style="font-size:.88rem;font-weight:700;margin-bottom:12px">Lançamentos recentes</h3>
    ${[
      {desc:'Corte + Barba · Lucas F.',   val:+150, tipo:'entrada', data:'hoje'},
      {desc:'Comissão Thiago Prado',       val:-30,  tipo:'saida',   data:'hoje'},
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
  <select style="border:1.5px solid var(--line2);border-radius:var(--rs);padding:6px 10px;font-size:.8rem">
    <option>Novembro 2026</option><option>Outubro 2026</option>
  </select>
</div>
${BARBEIROS.map((b,i)=>{
  const ats=[32,24,18][i]||10, fat=[4800,2400,1200][i]||900, com=fat*0.2;
  return `
  <div class="barb-row">
    <div class="topo-barb">
      <div class="barb-foto">${b.iniciais}</div>
      <div>
        <div class="barb-nome">${b.nome}</div>
        <div class="barb-cargo">${DB.esc(b.especialidade)}</div>
      </div>
    </div>
    <div class="barb-stats">
      <div class="barb-stat"><div class="bsv">${ats}</div><div class="bsl">Atendimentos</div></div>
      <div class="barb-stat"><div class="bsv">${DB.moeda(fat)}</div><div class="bsl">Faturado</div></div>
      <div class="barb-stat"><div class="bsv" style="color:var(--verde)">${DB.moeda(com)}</div><div class="bsl">Comissão (20%)</div></div>
    </div>
  </div>`;
}).join('')}`;

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
  <h2>Planos Gold</h2>
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
      ['bi-person-circle','Tem conta própria','Entra com WhatsApp e senha, igual ao DuoTech Beauty. Vê os próximos horários e o plano.'],
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
  const cores = [['#C9A84C','Ouro TP'],['#111111','Preto'],['#B08D57','Bronze'],['#8C1C13','Vinho'],['#1F4E79','Azul petróleo'],['#2E5E3E','Verde garrafa']];
  const tons = [['descontraido','Descontraído','"Fala, parceiro! Garante tua cadeira."'],
                ['classico','Clássico','"Seja bem-vindo. Reservar horário."'],
                ['premium','Premium','"Seja bem-vindo à casa. Reservar experiência."']];
  return `
<div class="section-header"><h2>Personalidade da barbearia</h2>
  <button class="btn-topo primario" onclick="salvarTelaPersonalidade()"><i class="bi bi-check-lg"></i> Salvar</button></div>
<p class="text-sm text-muted mb-16">Tudo aqui aparece no app do cliente. Cada barbearia tem o seu jeito.</p>
${CONFIG.MODO_DEMO ? '' : '<p class="text-sm mb-16" style="background:var(--accent-m);border-radius:8px;padding:10px 12px"><i class="bi bi-info-circle"></i> Nesta versão, o que você salva aqui vale para a <b>demonstração</b>. No app de verdade, estes dados vão pelo arquivo <b>sql/dados-da-barbearia.sql</b>.</p>'}
<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px" class="grid-2">
  <div class="section-box">
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
function salvarTelaPersonalidade(){
  const v = id => document.getElementById(id).value.trim();
  const tom = (document.querySelector('input[name=pTom]:checked')||{}).value || 'descontraido';
  const cor = (document.querySelector('.cor-btn.ativa')||{}).dataset?.cor || '#C9A84C';
  salvarPersonalidade({ nome:v('pNome')||'Minha', tipo:v('pTipo')||'Barbearia', slogan:v('pSlogan'), boas_vindas:v('pBoas'),
    especialidade:v('pEsp'), whatsapp:v('pWa').replace(/\D/g,''), instagram:v('pIg').replace(/^@/,''),
    tom_voz:tom, cor, clube_nome:v('pClube')||'Clube de pontos', pontos_por_real:Number(v('pPpr'))||1,
    pix_tipo:v('pPixTipo'), pix_chave:v('pPixChave'), pix_nome:v('pPixNome'), pix_cidade:v('pPixCidade') });
  if(v('pPixChave') && !v('pPixTipo')){ DB.toast('Escolha o tipo da chave Pix','aviso'); return; }
  document.documentElement.style.setProperty('--accent', cor);
  DB.toast('Personalidade salva! Veja no app do cliente.','sucesso');
}

/* ─── TELA: CONFIG ─── */
TELAS.config = ()=>{
  const fotos = lerFotos();
  return `
<div class="section-box mb-16">
  <h3 style="font-size:.9rem;font-weight:700;margin-bottom:4px">Profissionais</h3>
  <p class="text-sm text-muted mb-8">A foto aparece no app do cliente na hora de escolher o barbeiro.</p>
  ${BARBEIROS.map(b=>`
    <div class="pref-row">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="barb-foto" style="width:52px;height:52px;background:#111;color:var(--accent)">${fotos[b.id]?`<img src="${fotos[b.id]}" alt="" style="width:100%;height:100%;object-fit:cover">`:b.iniciais}</div>
        <div><div class="ptitulo">${DB.esc(b.nome)}</div><div class="psub">${DB.esc(b.especialidade)}</div></div>
      </div>
      <div style="display:flex;gap:6px">
        <label class="plano-btn" style="cursor:pointer"><i class="bi bi-camera"></i> ${fotos[b.id]?'Trocar':'Pôr'} foto
          <input type="file" accept="image/*" hidden onchange="trocarFotoBarbeiro('${b.id}', this.files[0])"></label>
        ${fotos[b.id]?`<button class="btn-ico" title="Tirar foto" onclick="salvarFoto('${b.id}', null);navegar('config')"><i class="bi bi-trash"></i></button>`:''}
      </div>
    </div>`).join('')}
</div>
<div class="section-box">
  <h3 style="font-size:.9rem;font-weight:700;margin-bottom:6px">Banco de dados</h3>
  <p class="text-sm text-muted">${CONFIG.MODO_DEMO ? 'Modo demonstração: os dados ficam só neste navegador.' : 'O <b>app do cliente</b> já usa o banco de verdade.'}
    Este painel ainda mostra dados de demonstração; ligar cada tela ao banco é a próxima etapa.
    Até lá, WhatsApp, Instagram, frase e chave Pix da barbearia são gravados pelo arquivo <b>sql/dados-da-barbearia.sql</b>.</p>
</div>`;
};
function trocarFotoBarbeiro(id, arq){
  if(!arq) return;
  const img = new Image(), url = URL.createObjectURL(arq);
  img.onload = ()=>{
    const lado = 256, c = document.createElement('canvas'); c.width = c.height = lado;
    const m = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width-m)/2, (img.height-m)/2, m, m, 0, 0, lado, lado);
    URL.revokeObjectURL(url);
    if(salvarFoto(id, c.toDataURL('image/jpeg', .82))){ DB.toast('Foto salva!','sucesso'); navegar('config'); }
    else DB.toast('Não coube no navegador. Tente uma foto menor.','erro');
  };
  img.onerror = ()=>DB.toast('Não consegui abrir essa imagem','erro');
  img.src = url;
}


/* ─── INICIALIZAÇÃO ─── */
document.addEventListener('DOMContentLoaded', ()=>{
  /* Cliques de navegação */
  document.querySelectorAll('[data-nav]').forEach(a=>{
    a.addEventListener('click', e=>{ e.preventDefault(); navegar(a.dataset.nav); });
  });
  /* Cor e nome escolhidos em Personalidade */
  const P = lerPersonalidade();
  document.documentElement.style.setProperty('--accent', P.cor);
  document.querySelectorAll('.logo-nome').forEach(e=>e.textContent=P.nome);
  document.querySelectorAll('.logo-sub').forEach(e=>e.textContent=P.tipo);
  /* Tela inicial */
  navegar('inicio');
});
