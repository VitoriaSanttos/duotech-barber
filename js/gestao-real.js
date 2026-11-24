/* ═══════════════════════════════════════════════
   DuoTech Barber · gestao-real.js  (versão 14)
   Liga ao banco as telas da versão 14 (Início, Palavra do dia,
   Caixa, Meta do mês, Lucro real, Academia) e o Pix dos Planos.
   Usa o MESMO login da v13 (js/equipe.js → Equipe.sb()).
   Precisa do sql/barber-v14-gestao.sql rodado no Supabase.
   No modo demonstração este arquivo não faz nada.

   Como funciona: lê tudo por funções do banco (painel_config,
   painel_resumo, caixa_atual, meta_ler, academia_ler...), preenche as
   mesmas listas do modo demonstração e troca as funções de ler/gravar
   das telas por versões que gravam no banco.
   Barbeiro com login: vê a Palavra do dia, o caixa e a Academia; números,
   Meta e Lucro real só o administrador.
═══════════════════════════════════════════════ */
(function(){
'use strict';
if (CONFIG.MODO_DEMO) return;

const G = window.GESTAO = { carregado:false, admin:false, cfg:null, resumo:null, caixa:null, meta:null,
                            academia:[], produtos:[], planosDb:[], semV14:false };
const mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const n = v => Number(v || 0);

/* ─── chamadas ao banco ─── */
async function rpc(nome, args){
  const c = await Equipe.sb();
  const { data, error } = await c.rpc(nome, args || {});
  if (error) {
    console.error(nome, error);
    if (/could not find the function|does not exist|PGRST202/i.test(error.message || '') || error.code === 'PGRST202') {
      G.semV14 = true; throw new Error('Falta rodar o SQL da versão 14 no Supabase.');
    }
    throw new Error(window.erroEquipe ? erroEquipe(error) : 'Não foi possível falar com o banco.');
  }
  if (data && typeof data === 'object' && !Array.isArray(data) && data.erro) throw new Error(data.erro);
  return data;
}
const pendentes = new Set();
async function gravar(nome, args, okMsg){
  const p = rpc(nome, args); pendentes.add(p);
  try { const r = await p; if (okMsg) DB.toast(okMsg, 'sucesso'); return r || true; }
  catch(e){ DB.toast(e.message, 'erro', 5000); return false; }
  finally { pendentes.delete(p); }
}
window.gravarGestao = gravar;

const trocar = (arr, novos) => { arr.length = 0; novos.forEach(x => arr.push(x)); };
const limpar = o => Object.keys(o).forEach(k => delete o[k]);

/* ─── carregar ─── */
async function base(){
  const c = await Equipe.sb(), eid = await Equipe.eid();
  const [s, p, pr] = await Promise.all([
    c.from('servicos').select('id,nome,categoria,duracao_min,preco,preco_a_partir,destaque,insumo,ordem').eq('empresa_id', eid).eq('ativo', true).order('ordem'),
    c.from('planos_cliente').select('id,nome,descricao,preco,cortes_mes,vagas_total,mais_vendido,vigencia,vantagens,termos_url,ordem').eq('empresa_id', eid).eq('ativo', true).order('ordem'),
    c.from('produtos').select('id,nome,categoria,estoque_atual,estoque_minimo,preco_custo,preco_venda').eq('empresa_id', eid).eq('ativo', true).order('nome'),
  ]);
  if (s.error && /insumo/.test(s.error.message || '')) { G.semV14 = true; throw new Error('Falta rodar o SQL da versão 14 no Supabase.'); }
  for (const r of [s, p, pr]) if (r.error) throw new Error('Não foi possível ler os cadastros.');
  trocar(SERVICOS, s.data.map(x => ({...x, preco:n(x.preco), insumo:n(x.insumo)})));
  G.planosDb = p.data; G.produtos = pr.data;
}
async function recarregar(partes){
  if (pendentes.size) await Promise.allSettled([...pendentes]);
  const t = [];
  if (partes.includes('config'))   t.push(rpc('painel_config').then(r => { G.cfg = r.config || {}; G.admin = !!r.admin; G.horarios = r.horarios || {}; }));
  if (partes.includes('base'))     t.push(base());
  if (partes.includes('caixa'))    t.push(rpc('caixa_atual').then(r => { G.caixa = r; }));
  if (partes.includes('meta'))     t.push(rpc('meta_ler', {p_mes: mesAtual()}).then(r => { G.meta = r; }));
  if (partes.includes('academia')) t.push(rpc('academia_ler').then(r => { G.academia = r || []; }));
  if (partes.includes('planos'))   t.push(rpc('barbearia_planos_pendentes').then(r => { G.pendentes = r || []; }));
  await Promise.all(t);
  if (partes.includes('resumo') && G.admin) G.resumo = await rpc('painel_resumo');
  montar();
}
window.recarregarGestao = recarregar;
async function garantir(){
  if (G.carregado) return;
  await recarregar(['config','base','caixa','meta','academia']);
  if (G.admin) G.resumo = await rpc('painel_resumo');
  montar();
  G.carregado = true;
  esconderSoAdmin();
}
function esconderSoAdmin(){
  ['meta','profit'].forEach(t => document.querySelectorAll(`[data-nav="${t}"]`).forEach(el => { (el.closest('li') || el).hidden = !G.admin; }));
  const lbl = document.getElementById('lblInteligencia'); if (lbl) lbl.hidden = !G.admin;
}

/* números do Início, Meta e Lucro real a partir do resumo */
function montar(){
  const quando = iso => { const d = new Date(iso), h = new Date();
    const dias = Math.floor((new Date(h.toDateString()) - new Date(d.toDateString())) / 864e5);
    return dias === 0 ? `hoje, ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : dias === 1 ? 'ontem' : d.toLocaleDateString('pt-BR'); };
  const r = G.resumo;
  const ass = (r && r.assinantes) || {};
  trocar(PLANOS, (G.planosDb || []).map(p => ({...p, preco:n(p.preco), vantagens:p.vantagens || [],
    vagas_restantes: p.vagas_total == null ? null : Math.max(p.vagas_total - n(ass[p.id]), 0)})));
  if (!r) return;
  const nomeMes = m => new Date(m + '-15T12:00:00').toLocaleDateString('pt-BR',{month:'short'}).replace('.','').replace(/^./, c => c.toUpperCase());
  limpar(DASH_DEMO);
  Object.assign(DASH_DEMO, {
    faturamento_mes:n(r.faturamento_mes), faturamento_mes_passado:n(r.faturamento_mes_passado), acumulado_ano:n(r.acumulado_ano),
    ocupacao:n(r.ocupacao), meta_ocupacao:n(r.meta_ocupacao) || 65,
    planos_ativos:n(r.planos_ativos), planos_vendidos_mes:n(r.planos_vendidos_mes), planos_cancelados_mes:n(r.planos_cancelados_mes),
    ticket_medio: n(r.atendimentos_mes) ? n(r.faturamento_mes) / n(r.atendimentos_mes) : 0,
    comandas_abertas:n(r.comandas_abertas), comandas_outros_dias:n(r.comandas_outros_dias),
    meses:(r.meses || []).map(m => ({mes:nomeMes(m.mes), fat:n(m.fat), novos:n(m.novos), voltaram:Math.max(n(m.clientes) - n(m.novos), 0),
                                     ticket: n(m.atend) ? n(m.fat) / n(m.atend) : 0})),
    pix_conferir:(r.pix_conferir || []).map(x => ({id:x.id, nome:x.nome, plano:x.plano, valor:n(x.valor), quando:quando(x.quando), disse_que_pagou:x.disse_que_pagou, novo:x.novo})),
    mensalidade_aberta:(r.mensalidade_aberta || []).map(x => ({id:x.id, nome:x.nome, plano:x.plano, dias:n(x.dias), tel:x.tel || ''})),
    estoque_minimo:(r.estoque_minimo || []).map(x => ({nome:x.nome, atual:n(x.atual), min:n(x.min)})),
    contratos_pendentes:[],
  });
  const hm = r.heatmap || {};
  trocar(OCUPACAO_DEMO, [1,2,3,4,5,6,0].map(dow => [...Array(13)].map((_, i) => { const v = hm[`${dow}-${i+7}`]; return v == null ? null : n(v); })));
}

/* ─── troca das funções de ler e gravar das telas ─── */
function instalar(){
  /* fé */
  lerFe = () => ({fe_ativa:true, fe_lembrete:true, fe_dizimo:false, ...((G.cfg || {}).fe || {})});
  salvarFe = f => { if (!G.admin) { DB.toast('Só o administrador muda onde a fé aparece.', 'aviso'); return; }
    G.cfg = {...(G.cfg || {}), fe:{...f}}; gravar('painel_salvar_config', {p_fe:f}); };

  /* Pix dos planos (Início e tela Planos) */
  lerPedidosPlanos = () => Object.fromEntries((G.pendentes || []).map(x => [x.id, {
    status:x.status, pagamento_informado_em:x.pagamento_informado_em, nome:x.plano, cliente_nome:x.cliente,
    preco:n(x.preco), proximo_vencimento:x.proximo_vencimento}]));
  confirmarPixPlano = async id => {
    const r = await gravar('barbearia_confirmar_pagamento_plano', {p_assinatura:id});
    if (r) { DB.toast(`Plano liberado até ${DB.dataBR(r.proximo_vencimento)}`, 'sucesso');
      await recarregar(['planos','resumo']); navegar(window._telaAtual || 'inicio', window._paramsAtual || {}); }
  };

  /* caixa */
  lerCaixa = () => {
    const c = G.caixa || {aberto:false, movs:[], historico:[]};
    return { aberto:c.aberto, abertura:(c.caixa && c.caixa.aberto_em) || new Date().toISOString(), troco_inicial:n(c.caixa && c.caixa.troco),
      movs:[...(c.movs || [])].reverse().map(m => ({...m, valor:n(m.valor), origem:m.comanda ? 'comanda' : 'manual',
        forma:{cartao_credito:'credito', cartao_debito:'debito'}[m.forma] || m.forma, cat:m.comanda ? null : m.cat})),
      historico:(c.historico || []).map(h => ({data:h.data, total:n(h.total), esperado:n(h.esperado), contado:n(h.contado)})) };
  };
  salvarCaixa = () => {};
  const formaBanco = f => ({credito:'cartao_credito', debito:'cartao_debito'}[f] || f);
  _salvarMov = async tipo => {
    const valor = _num('cx-valor'), cat = document.getElementById('cx-cat').value;
    const desc = document.getElementById('cx-desc').value.trim() || cat, forma = formaBanco(document.getElementById('cx-forma').value);
    if (valor <= 0) { DB.toast('Informe o valor', 'erro'); return; }
    if (await gravar('caixa_lancar', {p_tipo:tipo, p_categoria:cat, p_descricao:desc, p_forma:forma, p_valor:valor},
        `${tipo === 'entrada' ? 'Entrada' : 'Saída'} de ${DB.moeda(valor)} registrada`)) {
      fecharModal('modal-caixa'); await recarregar(['caixa']); navegar('caixa', {_semRecarregar:true}); }
  };
  _confirmarAbertura = async () => {
    if (await gravar('caixa_abrir', {p_troco:_num('cx-troco')}, 'Caixa aberto. Bom trabalho!')) {
      fecharModal('modal-caixa'); await recarregar(['caixa']); navegar('caixa', {_semRecarregar:true}); }
  };
  _confirmarFechamento = async () => {
    if (!document.getElementById('cx-contado').value) { DB.toast('Conte o dinheiro da gaveta e informe o valor', 'erro'); return; }
    if (await gravar('caixa_fechar', {p_contado:_num('cx-contado'), p_obs:null}, 'Caixa fechado. Deus abençoe o descanso!')) {
      fecharModal('modal-caixa'); await recarregar(['caixa']); navegar('caixa', {_semRecarregar:true}); }
  };
  caixaHoje = () => { const c = G.caixa; return c && c.aberto ? n(c.resumo && c.resumo.entradas) : 0; };

  /* Meta do mês */
  const metaPad = _metaPadrao;
  lerMeta = () => {
    const p = metaPad(), s = (G.meta && G.meta.dados) || {};
    return {...p, ...s, mix:{...p.mix, ...(s.mix || {})}, campanhas:{...p.campanhas, ...(s.campanhas || {})},
            proposito:{...p.proposito, ...(s.proposito || {})}, historico:(G.meta && G.meta.historico) || []};
  };
  salvarMeta = m => { const d = {...m}; delete d.historico; G.meta = {...(G.meta || {}), dados:d}; gravar('meta_salvar', {p_mes:mesAtual(), p_dados:d}); };
  _salvarCalibragem = async previstas => {
    const nova = _num('cal-meta'), motivo = document.getElementById('cal-motivo').value.trim();
    if (!motivo) { DB.toast('Escreva o motivo da alteração', 'erro'); return; }
    if (nova < previstas) { DB.toast(`A meta não pode ficar abaixo das assinaturas previstas (${DB.moeda(previstas)})`, 'erro'); return; }
    if (!(G.meta && G.meta.dados)) await rpc('meta_salvar', {p_mes:mesAtual(), p_dados:(({historico, ...d}) => d)(lerMeta())}).catch(() => {});
    if (await gravar('meta_calibrar', {p_mes:mesAtual(), p_meta:nova, p_motivo:motivo}, 'Meta calibrada')) {
      fecharModal('modal-caixa'); await recarregar(['meta']); navegar('meta', {...(window._paramsMeta || {}), _semRecarregar:true}); }
  };
  _desfazerCalibragem = async () => {
    if (await gravar('meta_desfazer', {p_mes:mesAtual()}, 'Última alteração desfeita')) {
      fecharModal('modal-caixa'); await recarregar(['meta']); navegar('meta', {...(window._paramsMeta || {}), _semRecarregar:true}); }
  };
  mensalidadesAtivas = () => n(G.resumo && G.resumo.mensalidades_ativas);
  mixDoMes = () => { const m = (G.resumo && G.resumo.mix_mes) || {}; return {avulsos:n(m.avulsos), extras:n(m.extras), produtos:n(m.produtos)}; };
  serieMes = (ano, mes) => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const ndias = new Date(ano, mes+1, 0).getDate(), hor = G.horarios || {};
    const porDia = Object.fromEntries(((G.resumo && G.resumo.dias) || []).map(x => [x.data, x]));
    return [...Array(ndias)].map((_, i) => {
      const d = i+1, data = new Date(ano, mes, d), dow = data.getDay();
      const iso = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, v = porDia[iso] || {};
      const aberto = Array.isArray(hor[String(dow)]) && hor[String(dow)].length > 0;
      return {d, data, dow, aberto, peso: aberto ? (PESO_DIA[dow] || 1) : 0, passado: data < hoje, hoje: data.getTime() === hoje.getTime(),
              comandas:n(v.comandas), assin:n(v.assin), novas:n(v.novas)};
    });
  };

  /* Lucro real */
  lerProfit = () => {
    const pad = structuredClone(PROFIT_PADRAO), cfg = (G.cfg && G.cfg.profit) || {}, r = G.resumo || {}, vend = r.vendidos_30d || {};
    return {
      premissas:{...pad.premissas, ...(cfg.premissas || {})},
      insumos:Object.fromEntries(SERVICOS.map(s => [s.id, n(s.insumo)])),
      vendidos:Object.fromEntries(SERVICOS.map(s => [s.id, n(vend[s.id])])),
      precos:Object.fromEntries(SERVICOS.map(s => [s.id, n(s.preco)])),
      produtos:(G.produtos || []).map(x => ({id:x.id, nome:x.nome, venda:n(x.preco_venda), custo:n(x.preco_custo), vendidos:n(vend[x.id])})),
      planos:Object.fromEntries(PLANOS.map(pl => [pl.id, {assinantes:n((r.assinantes || {})[pl.id]),
        usos:n(cfg.planos && cfg.planos[pl.id] && cfg.planos[pl.id].usos != null ? cfg.planos[pl.id].usos : (pl.cortes_mes > 0 ? pl.cortes_mes : 3)),
        insumo:n(cfg.planos && cfg.planos[pl.id] && cfg.planos[pl.id].insumo != null ? cfg.planos[pl.id].insumo : 5)}])),
      fixos: cfg.fixos || ['Aluguel','Luz','Água','Internet e telefone','Sistema','Contador','Pró-labore do dono','Limpeza e manutenção'].map(nome => ({nome, valor:0})),
    };
  };
  salvarProfit = p => {
    const antes = lerProfit();
    const planos = Object.fromEntries(Object.entries(p.planos).map(([k, v]) => [k, {usos:v.usos, insumo:v.insumo}]));
    const profit = {premissas:p.premissas, fixos:p.fixos, planos};
    G.cfg = {...(G.cfg || {}), profit};
    gravar('painel_salvar_config', {p_profit:profit});
    const serv = SERVICOS.filter(s => p.insumos[s.id] !== antes.insumos[s.id] || (p.precos && p.precos[s.id] !== antes.precos[s.id]))
      .map(s => ({id:s.id, insumo:p.insumos[s.id], preco:(p.precos || {})[s.id] ?? s.preco}));
    const prod = p.produtos.filter(x => { const a = antes.produtos.find(y => y.id === x.id); return a && (a.venda !== x.venda || a.custo !== x.custo); })
      .map(x => ({id:x.id, venda:x.venda, custo:x.custo}));
    serv.forEach(s => { const o = SERVICOS.find(x => x.id === s.id); o.insumo = s.insumo; o.preco = s.preco; });
    prod.forEach(x => { const o = G.produtos.find(y => y.id === x.id); o.preco_venda = x.venda; o.preco_custo = x.custo; });
    if (serv.length || prod.length) gravar('painel_salvar_custos', {p:{servicos:serv, produtos:prod}});
  };

  /* Academia: aulas concluídas no banco; favoritos e presença no aparelho */
  const acadLocal = lerAcad;
  lerAcad = () => ({...acadLocal(), assistidas:Object.fromEntries((G.academia || []).map(a => [a, true]))});
  salvarAcad = a => {
    const antes = new Set(G.academia || []), agora = Object.keys(a.assistidas).filter(k => a.assistidas[k]);
    agora.filter(k => !antes.has(k)).forEach(k => gravar('academia_concluir', {p_aula:k, p_feito:true}));
    [...antes].filter(k => !a.assistidas[k]).forEach(k => gravar('academia_concluir', {p_aula:k, p_feito:false}));
    G.academia = agora;
    try { localStorage.setItem('tp_demo_academia', JSON.stringify({favoritos:a.favoritos, presenca:a.presenca})); } catch(e){}
  };
  _enviarParceiro = async () => {
    const v = id => document.getElementById(id).value.trim();
    if (await gravar('academia_quero_ser_parceiro', {p_nome:v('pc-nome'), p_whatsapp:v('pc-whats'), p_area:v('pc-cat'), p_ideia:v('pc-ideia')}, 'Recebemos a sua ideia. Obrigado!'))
      fecharModal('modal-caixa');
  };

  /* telas: esperam os dados; algumas releem o banco ao abrir */
  const frescas = {inicio:['resumo','planos'], proposito:['config'], caixa:['caixa'], meta:['resumo','meta'],
                   profit:['resumo','base'], planos:['planos']};
  const soAdmin = {meta:'a Meta do mês', profit:'o Lucro real'};
  ['inicio','proposito','caixa','meta','profit','academia','planos'].forEach(nome => {
    const original = TELAS[nome]; if (!original) return;
    TELAS[nome] = async (params = {}) => {
      try {
        await garantir();
        window._paramsAtual = params;
        if (frescas[nome] && !params._semRecarregar) await recarregar(frescas[nome]);
      } catch(e){
        return `<div class="aviso-exemplo"><i class="bi bi-exclamation-triangle"></i> ${DB.esc(e.message)}</div>`;
      }
      if (soAdmin[nome] && !G.admin) return `<div class="section-box acao-vazio"><i class="bi bi-lock"></i> Só o administrador vê ${soAdmin[nome]}.</div>`;
      if (nome === 'inicio' && !G.admin) return inicioEquipe();
      return original(params);
    };
  });
}

/* Início de quem é da equipe (barbeiro com login): Palavra do dia e atalhos, sem os números */
function inicioEquipe(){
  const data = new Date().toLocaleDateString('pt-BR',{weekday:'long', day:'numeric', month:'long'});
  return `${bannerFe()}
<div class="dash-ola"><h1>${saudacao()}, ${DB.esc(DONO_NOME())}</h1><p>${data.charAt(0).toUpperCase() + data.slice(1)}</p></div>
<div class="acao-grid">
  ${blocoAcao({ico:'bi-calendar3', cor:'azul', titulo:'Sua agenda', sub:'horários de hoje e da semana', qtd:'',
    itens:[itemAcao('<i class="bi bi-calendar-check"></i>', 'Ver os horários de hoje', 'confirme, marque a chegada e feche a comanda',
      `<button class="acao-btn verde" onclick="navegar('agenda')">Abrir</button>`)],
    rodape:`<a onclick="navegar('caixa')">Caixa do dia <i class="bi bi-chevron-right"></i></a>`})}
</div>
<p class="text-muted text-sm">Os números da barbearia ficam com o administrador.</p>`;
}

instalar();
})();
