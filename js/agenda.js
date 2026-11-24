/* ═══════════════════════════════════════════════
   DuoTech Barber v3 · agenda.js
   Agenda do painel com 4 jeitos de ver:
   Dia (colunas por barbeiro) · Semana · Mês · Lista

   Nesta versão a agenda usa dados de DEMONSTRAÇÃO (gerados para o
   mês atual) + os horários marcados no app do cliente em modo demo.
   Ligar ao banco é a próxima etapa: basta trocar agendaCarregar().
═══════════════════════════════════════════════ */
(function(){
'use strict';

const AG = { vista: 'dia', data: new Date(), barbeiro: '' };
let HORA_INI = 8, HORA_FIM = 20; const PASSO = 30;     // grade de 30 em 30 min (abre mais se tiver horário fora)
const ALTURA_SLOT = 34;                                 // px por 30 min na visão Dia
const DIAS_SEM = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const esc = DB.esc;

/* ── datas ── */
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const somaDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const inicioSemana = d => somaDias(d, -d.getDay());           // domingo
const mesmoDia = (a, b) => iso(a) === iso(b);
const hhmm = min => `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;

/* ── dados de demonstração (sempre os mesmos para o mesmo dia) ── */
const NOMES = ['Lucas F.','Rafael S.','Carlos M.','André L.','Bruno T.','Diego R.','Felipe A.','Gustavo P.','Henrique C.','Igor N.',
               'João V.','Mateus B.','Murilo G.','Otávio D.','Paulo H.','Renan K.','Samuel O.','Tiago E.','Vinícius Q.','Wesley J.'];
function sorteio(semente){ let x = semente >>> 0 || 1; return () => (x = (x * 1664525 + 1013904223) >>> 0) / 4294967296; }
let cacheDia = {};
window.agendaInvalidar = () => { cacheDia = {}; };   // chamado quando a equipe muda
function agendaDoDia(d){
  const k = iso(d), ck = k + '|' + obterBarbeiros().filter(b=>b.ativo !== false).map(b=>b.id).join(',');
  if (cacheDia[ck]) return cacheDia[ck];
  const lista = [];
  if (d.getDay() !== 0) {                                   // domingo fechado
    const r = sorteio(Number(k.replace(/-/g, '')));
    const fim = d.getDay() === 6 ? 18 : HORA_FIM;
    obterBarbeiros().filter(b=>b.ativo !== false).forEach((b, bi) => {
      let t = HORA_INI * 60 + Math.floor(r() * 3) * PASSO;
      while (t < fim * 60 - 30) {
        if (r() < 0.55) {
          const s = SERVICOS[Math.floor(Math.pow(r(), 2.2) * SERVICOS.length)];
          const dur = Math.min(s.duracao_min, 120);
          if (t + dur > fim * 60) break;
          const hoje = new Date(); hoje.setHours(0,0,0,0);
          const passado = d < hoje;
          const st = passado ? (r() < 0.9 ? 'concluido' : 'faltou') : (r() < 0.75 ? 'confirmado' : 'agendado');
          lista.push({ id: k + '-' + bi + '-' + t, data: k, ini: t, fim: t + dur, cliente: NOMES[Math.floor(r() * NOMES.length)],
                       servico: s.nome, valor: s.preco, barbeiro: b.id, status: st, origem: r() < 0.6 ? 'link' : 'balcao',
                       sinal: r() < 0.25 });
          t += Math.ceil(dur / PASSO) * PASSO;
        } else t += PASSO;
      }
    });
  }
  // horários marcados no app do cliente (modo demonstração)
  try {
    (JSON.parse(localStorage.getItem('tp_demo_agend') || '[]')).forEach((a, i) => {
      const dt = new Date(a.inicio); if (iso(dt) !== k) return;
      const s = SERVICOS.find(x => x.nome === a.servico) || { duracao_min: 30, preco: 0 };
      const ini = dt.getHours() * 60 + dt.getMinutes();
      lista.push({ id: 'app-' + i, data: k, ini, fim: ini + s.duracao_min, cliente: 'Cliente do app', servico: a.servico,
                   valor: s.preco, barbeiro: a.barbeiro, status: 'agendado', origem: 'link', sinal: false, doApp: true });
    });
  } catch(e){}
  lista.sort((a, b) => a.ini - b.ini);
  return (cacheDia[ck] = lista);
}
const REAL = () => !CONFIG.MODO_DEMO && window.AGENDA_REAL;
function agendaCarregar(de, ate){              // [de, ate] inclusive
  const out = [];
  if (REAL()) {                                // painel com login: horários do banco
    const a = iso(de), b = iso(ate);
    out.push(...window.AGENDA_REAL.itens.filter(x => x.data >= a && x.data <= b));
  } else
  for (let d = new Date(de); d <= ate; d = somaDias(d, 1)) out.push(...agendaDoDia(d));
  return AG.barbeiro ? out.filter(a => a.barbeiro === AG.barbeiro) : out;
}

/* ── aparência ── */
const COR_STATUS = { agendado:'amarelo', confirmado:'verde', em_atendimento:'verde', concluido:'cinza', faltou:'vermelho', cancelado:'vermelho' };
const NOME_STATUS = { agendado:'Agendado', confirmado:'Confirmado', em_atendimento:'Em atendimento', concluido:'Concluído', faltou:'Faltou', cancelado:'Cancelado' };
window.AGENDA_NOME_STATUS = NOME_STATUS;
const nomeBarb = id => (obterBarbeiros().find(b => b.id === id) || { nome: '—' }).nome;
const iniciaisBarb = id => (obterBarbeiros().find(b => b.id === id) || { iniciais: '?' }).iniciais;
const fotoBarb = id => (obterBarbeiros().find(b => b.id === id) || {}).foto_url || '';

function tituloPeriodo(){
  const d = AG.data;
  if (AG.vista === 'dia') return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  if (AG.vista === 'semana' || AG.vista === 'lista') {
    const a = inicioSemana(d), b = somaDias(a, 6);
    return `${a.getDate()} ${MESES[a.getMonth()].slice(0,3)} – ${b.getDate()} ${MESES[b.getMonth()].slice(0,3)} ${b.getFullYear()}`;
  }
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function htmlBarra(){
  const vistas = [['dia','Dia','bi-calendar-day'],['semana','Semana','bi-calendar-week'],['mes','Mês','bi-calendar3'],['lista','Lista','bi-list-ul']];
  return `
  <div class="ag-barra">
    <div class="ag-nav">
      <button class="btn-topo" onclick="agendaMover(-1)" aria-label="Anterior"><i class="bi bi-chevron-left"></i></button>
      <button class="btn-topo" onclick="agendaHoje()">Hoje</button>
      <button class="btn-topo" onclick="agendaMover(1)" aria-label="Próximo"><i class="bi bi-chevron-right"></i></button>
      <h2 class="ag-titulo">${esc(tituloPeriodo())}</h2>
    </div>
    <div class="ag-vistas" role="tablist">
      ${vistas.map(([v,t,i]) => `<button role="tab" class="${AG.vista===v?'ativo':''}" onclick="agendaVista('${v}')"><i class="bi ${i}"></i>${t}</button>`).join('')}
    </div>
  </div>
  <div class="filtros">
    <button class="filtro-btn ${AG.barbeiro===''?'ativo':''}" onclick="agendaBarbeiro('')">Todos</button>
    ${obterBarbeiros().filter(b=>b.ativo !== false).map(b => `<button class="filtro-btn ${AG.barbeiro===b.id?'ativo':''}" onclick="agendaBarbeiro('${b.id}')">${esc(b.nome.split(' ')[0])}</button>`).join('')}
    <button class="btn-topo primario" style="margin-left:auto" onclick="abrirModalNovoAgendamento()"><i class="bi bi-plus-lg"></i> Novo</button>
  </div>`;
}

function htmlResumo(lista){
  const ativos = lista.filter(a => a.status !== 'cancelado' && a.status !== 'faltou');
  const total = ativos.reduce((s, a) => s + a.valor, 0);
  return `<div class="ag-resumo"><span><b>${ativos.length}</b> atendimento${ativos.length===1?'':'s'}</span>
    <span><b>${DB.moeda(total)}</b> previsto</span>
    <span><b>${lista.filter(a=>a.origem==='link').length}</b> pelo app</span></div>`;
}

/* ── DIA: uma coluna por barbeiro ── */
function vistaDia(){
  const d = AG.data, lista = agendaCarregar(d, d);
  let cols = AG.barbeiro ? obterBarbeiros().filter(b => b.id === AG.barbeiro) : obterBarbeiros().filter(b=>b.ativo !== false);
  const ids = cols.map(b => b.id);
  if (!AG.barbeiro && lista.some(a => !ids.includes(a.barbeiro))) cols = [...cols, { id: '__sem', nome: 'Sem profissional', iniciais: '?' }];
  if (!cols.length) cols = [{ id: '__sem', nome: 'Agenda', iniciais: '·' }];
  const colDe = a => ids.includes(a.barbeiro) ? a.barbeiro : '__sem';
  HORA_INI = Math.min(8, ...lista.map(a => Math.floor(a.ini / 60)));
  HORA_FIM = Math.max(20, ...lista.map(a => Math.ceil(a.fim / 60)));
  const slots = (HORA_FIM - HORA_INI) * 60 / PASSO;
  const agora = new Date(), minAgora = agora.getHours() * 60 + agora.getMinutes();
  const linhaAgora = mesmoDia(d, agora) && minAgora >= HORA_INI*60 && minAgora <= HORA_FIM*60
    ? `<div class="ag-agora" style="top:${(minAgora - HORA_INI*60) / PASSO * ALTURA_SLOT}px"></div>` : '';
  return htmlResumo(lista) + `
  <div class="ag-dia-wrap"><div class="ag-dia" style="grid-template-columns:56px repeat(${cols.length}, minmax(170px, 1fr))">
    <div class="ag-cab ag-cab-hora"></div>
    ${cols.map(b => `<div class="ag-cab"><div class="ag-av">${fotoBarb(b.id) ? `<img src="${fotoBarb(b.id)}" alt="">` : esc(b.iniciais)}</div>
       <div><b>${esc(b.nome)}</b><small>${lista.filter(a=>colDe(a)===b.id).length} horários</small></div></div>`).join('')}
    <div class="ag-horas" style="height:${slots*ALTURA_SLOT}px">
      ${Array.from({length: slots}, (_, i) => i % 2 === 0 ? `<div style="top:${i*ALTURA_SLOT}px">${hhmm(HORA_INI*60 + i*PASSO)}</div>` : '').join('')}
    </div>
    ${cols.map(b => `<div class="ag-col" style="height:${slots*ALTURA_SLOT}px">
      ${lista.filter(a => colDe(a) === b.id).map(a => `
        <button class="ag-ev ${COR_STATUS[a.status]} ${(a.fim-a.ini) <= PASSO ? 'curto' : ''}" style="top:${(a.ini-HORA_INI*60)/PASSO*ALTURA_SLOT}px;height:${Math.max((a.fim-a.ini)/PASSO*ALTURA_SLOT-3, 28)}px"
          onclick="agendaAbrir('${esc(a.id)}')" title="${esc(a.cliente)} · ${esc(a.servico)}">
          <b>${hhmm(a.ini)} ${esc(a.cliente)}</b><span>${esc(a.servico)}</span>
          ${a.doApp ? '<i class="bi bi-phone ag-app" title="Marcado pelo app"></i>' : ''}
        </button>`).join('')}
      ${linhaAgora}
    </div>`).join('')}
  </div></div>`;
}

/* ── SEMANA ── */
function vistaSemana(){
  const a = inicioSemana(AG.data), b = somaDias(a, 6), lista = agendaCarregar(a, b);
  return htmlResumo(lista) + `<div class="ag-semana">
    ${Array.from({length: 7}, (_, i) => {
      const d = somaDias(a, i), doDia = lista.filter(x => x.data === iso(d));
      return `<div class="ag-sem-dia ${mesmoDia(d, new Date()) ? 'hoje' : ''}">
        <button class="ag-sem-cab" onclick="agendaIrDia('${iso(d)}')"><span>${DIAS_SEM[i]}</span><b>${d.getDate()}</b></button>
        ${d.getDay() === 0 && !doDia.length ? '<div class="ag-fechado">Fechado</div>' : ''}
        ${doDia.map(x => `<button class="ag-mini ${COR_STATUS[x.status]}" onclick="agendaAbrir('${esc(x.id)}')">
            <b>${hhmm(x.ini)}</b> ${esc(x.cliente)}<span>${esc(x.servico)} · ${esc(iniciaisBarb(x.barbeiro))}</span></button>`).join('')}
      </div>`;
    }).join('')}
  </div>`;
}

/* ── MÊS ── */
function vistaMes(){
  const d = AG.data, primeiro = new Date(d.getFullYear(), d.getMonth(), 1);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const ini = inicioSemana(primeiro), semanas = Math.ceil((primeiro.getDay() + ultimo.getDate()) / 7);
  const lista = agendaCarregar(primeiro, ultimo);
  return htmlResumo(lista) + `<div class="ag-mes">
    ${DIAS_SEM.map(s => `<div class="ag-mes-cab">${s}</div>`).join('')}
    ${Array.from({length: semanas * 7}, (_, i) => {
      const dia = somaDias(ini, i), fora = dia.getMonth() !== d.getMonth();
      const doDia = fora ? [] : lista.filter(x => x.data === iso(dia));
      const total = doDia.filter(x => x.status !== 'faltou').reduce((s, x) => s + x.valor, 0);
      return `<button class="ag-mes-dia ${fora ? 'fora' : ''} ${mesmoDia(dia, new Date()) ? 'hoje' : ''}" ${fora ? 'disabled' : `onclick="agendaIrDia('${iso(dia)}')"`}>
        <span class="n">${dia.getDate()}</span>
        ${doDia.length ? `<span class="qtd">${doDia.length} <i class="bi bi-scissors"></i></span>
          <span class="val">${DB.moeda(total).replace(',00','')}</span>
          <span class="pontos">${doDia.slice(0, 6).map(x => `<i class="${COR_STATUS[x.status]}"></i>`).join('')}</span>` : ''}
      </button>`;
    }).join('')}
  </div>`;
}

/* ── LISTA ── */
function vistaLista(){
  const a = inicioSemana(AG.data), b = somaDias(a, 6), lista = agendaCarregar(a, b);
  const dias = [...new Set(lista.map(x => x.data))];
  return htmlResumo(lista) + (dias.length ? dias.map(k => {
    const d = new Date(k + 'T12:00:00'), doDia = lista.filter(x => x.data === k);
    return `<div class="ag-lista-dia">
      <div class="ag-lista-cab">${esc(d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }))}
        <span>${doDia.length} · ${DB.moeda(doDia.reduce((s, x) => s + x.valor, 0))}</span></div>
      <table class="tabela resp"><tbody>
      ${doDia.map(x => `<tr onclick="agendaAbrir('${esc(x.id)}')" style="cursor:pointer">
        <td data-label="Horário" class="td-hora">${hhmm(x.ini)}–${hhmm(x.fim)}</td>
        <td data-label="Cliente"><b>${esc(x.cliente)}</b>${x.doApp ? ' <i class="bi bi-phone" title="Marcado pelo app"></i>' : ''}<div class="text-muted" style="font-size:.74rem">${esc(x.servico)}</div></td>
        <td data-label="Profissional">${esc(nomeBarb(x.barbeiro))}</td>
        <td data-label="Valor" style="font-weight:700">${DB.moeda(x.valor)}</td>
        <td data-label="Origem">${x.origem === 'link' ? '<span class="badge azul">App</span>' : '<span class="badge cinza">Balcão</span>'}</td>
        <td data-label="Status"><span class="badge ${COR_STATUS[x.status]}">${NOME_STATUS[x.status]}</span></td>
      </tr>`).join('')}
      </tbody></table></div>`;
  }).join('') : '<div class="section-box text-muted">Nenhum horário nesta semana.</div>');
}

/* ── tela ── */
function periodo(){
  const d = AG.data;
  if (AG.vista === 'dia') return [d, d];
  if (AG.vista === 'mes') return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth() + 1, 0)];
  const a = inicioSemana(d); return [a, somaDias(a, 6)];
}
function desenhar(){
  const corpo = { dia: vistaDia, semana: vistaSemana, mes: vistaMes, lista: vistaLista }[AG.vista]();
  return htmlBarra() + `<div class="ag-corpo">${corpo}</div>
    <p class="text-sm text-muted mt-8">${REAL() ? 'Horários do banco de dados. Os marcados pelo app do cliente aparecem com <i class="bi bi-phone"></i>. <a href="#" onclick="navegar(\'agenda\');return false">Atualizar</a>'
      : 'Dados de demonstração. Os horários marcados no app do cliente (modo demonstração) aparecem com <i class="bi bi-phone"></i>.'}</p>`;
}
TELAS.agenda = () => {
  if (!REAL()) return desenhar();
  const [de, ate] = periodo();
  return window.AGENDA_REAL.carregar(de, ate).then(desenhar).catch(e =>
    `<div class="section-box"><b>Não consegui carregar a agenda.</b><p class="text-sm text-muted mt-8">${esc(e.message || e)}</p>
     <button class="btn-topo mt-8" onclick="navegar('agenda')">Tentar de novo</button></div>`);
};
window.agendaAbrir = id => (REAL() ? window.AGENDA_REAL.abrir(id) : abrirModalVerAgendamento());
TELAS.agendaDepois = () => {
  // na visão Dia, rola até perto da hora atual
  const w = document.querySelector('.ag-dia-wrap'); if (!w) return;
  const h = new Date().getHours(); if (h > HORA_INI) w.scrollTop = Math.max(0, (h - HORA_INI - 1) * 2 * ALTURA_SLOT);
};

const redesenhar = () => navegar('agenda');
window.agendaVista = v => { AG.vista = v; try { localStorage.setItem('tp_agenda_vista', v); } catch(e){} redesenhar(); };
window.agendaHoje = () => { AG.data = new Date(); redesenhar(); };
window.agendaMover = n => {
  const d = AG.data;
  AG.data = AG.vista === 'dia' ? somaDias(d, n) : AG.vista === 'mes' ? new Date(d.getFullYear(), d.getMonth() + n, 1) : somaDias(d, 7 * n);
  redesenhar();
};
window.agendaIrDia = k => { AG.data = new Date(k + 'T12:00:00'); AG.vista = 'dia'; redesenhar(); };
window.agendaBarbeiro = id => { AG.barbeiro = id; redesenhar(); };
try { const v = localStorage.getItem('tp_agenda_vista'); if (['dia','semana','mes','lista'].includes(v)) AG.vista = v; } catch(e){}
})();
