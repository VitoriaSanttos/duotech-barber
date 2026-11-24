/* ═══════════════════════════════════════════════
   DuoTech Barber · banco.js
   Liga o PAINEL ao Supabase (quando não está em ?demo).

   Como funciona:
   1. Carrega a biblioteca do Supabase e pede login (e-mail e senha).
   2. Lê tudo o que as telas precisam por funções do banco
      (painel_eu, painel_resumo, caixa_atual, meta_ler...).
   3. Preenche as mesmas listas que o modo demonstração usa
      (SERVICOS, PLANOS, BARBEIROS, DASH_DEMO...) e troca as funções
      de ler/gravar das telas por versões que gravam no banco.
   Todas as gravações passam por funções do banco que conferem se
   quem chama é da barbearia (sql/barber-v4-painel.sql).
═══════════════════════════════════════════════ */

const BANCO = {
  ativo: !CONFIG.MODO_DEMO,
  sb: null,
  eu: null,            // {perfil, empresa, config, unidade_id, liberada}
  resumo: null,        // painel_resumo()
  caixa: null,         // caixa_atual()
  meta: null,          // meta_ler(mes)
  academia: [],        // aulas concluídas
  produtos: [],
  servicosDb: [],
  _pronto: null,
};

const SUPABASE_SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

/* Chama uma função do banco. Erro de rede/permissão → mensagem amigável.
   Funções que devolvem {"erro": "..."} → lança Error com a mensagem pronta. */
async function rpc(nome, args){
  const { data, error } = await BANCO.sb.rpc(nome, args || {});
  if(error){
    console.error(nome, error);
    if(/JWT|jwt|401|not authenticated/i.test(error.message||'')){ await sairDoPainel(true); }
    throw new Error(error.message && !/^[A-Z0-9]{5}$/.test(error.code||'') ? error.message : 'Não foi possível falar com o banco. Tente de novo.');
  }
  if(data && typeof data === 'object' && !Array.isArray(data) && data.erro) throw new Error(data.erro);
  return data;
}
/* Gravação com aviso: devolve true/false e mostra o erro na tela */
const _pendentes = new Set();
async function gravar(nome, args, okMsg){
  const p = rpc(nome, args); _pendentes.add(p);
  try { const r = await p; if(okMsg) DB.toast(okMsg, 'sucesso'); return r || true; }
  catch(e){ DB.toast(e.message, 'erro', 4500); return false; }
  finally { _pendentes.delete(p); }
}

function _carregarSdk(){
  if(window.supabase) return Promise.resolve();
  return new Promise((ok, falha)=>{
    const s = document.createElement('script'); s.src = SUPABASE_SDK; s.crossOrigin = 'anonymous';
    s.onload = ok; s.onerror = ()=>falha(new Error('Sem internet para carregar o sistema. Confira a conexão e recarregue.'));
    document.head.appendChild(s);
  });
}

/* ─── LOGIN ─── */
function _telaLogin(msg=''){
  let o = document.getElementById('login-painel');
  if(!o){ o = document.createElement('div'); o.id = 'login-painel'; document.body.appendChild(o); }
  const P = PERSONALIDADE_PADRAO;
  o.innerHTML = `
  <form class="login-box" onsubmit="event.preventDefault();_entrar()">
    <div class="login-logo">${COROA_SVG(56, P.cor)}</div>
    <h1>${DB.esc(CONFIG.BARBEARIA_NOME || 'Painel da barbearia')}</h1>
    <p class="text-muted text-sm">Entre com o e-mail e a senha da barbearia.</p>
    <div class="campo"><label for="lg-email">E-mail</label><input id="lg-email" type="email" autocomplete="username" required></div>
    <div class="campo"><label for="lg-senha">Senha</label><input id="lg-senha" type="password" autocomplete="current-password" required minlength="6"></div>
    <div class="login-erro" id="lg-erro" role="alert">${DB.esc(msg)}</div>
    <button class="btn-modal primario" id="lg-btn" type="submit">Entrar</button>
    <p class="text-muted text-sm mt-8">Esqueceu a senha? Fale com a DuoTech.</p>
  </form>`;
  o.classList.add('aberto');
  setTimeout(()=>document.getElementById('lg-email')?.focus(), 50);
}
async function _entrar(){
  const email = document.getElementById('lg-email').value.trim(), senha = document.getElementById('lg-senha').value;
  const btn = document.getElementById('lg-btn'), err = document.getElementById('lg-erro');
  btn.disabled = true; btn.textContent = 'Entrando…'; err.textContent = '';
  const { error } = await BANCO.sb.auth.signInWithPassword({ email, password: senha });
  if(error){
    err.textContent = /invalid/i.test(error.message) ? 'E-mail ou senha não conferem.' : 'Não foi possível entrar agora. Tente de novo.';
    btn.disabled = false; btn.textContent = 'Entrar'; return;
  }
  try { await _iniciarSessao(); document.getElementById('login-painel').classList.remove('aberto'); }
  catch(e){ err.textContent = e.message; btn.disabled = false; btn.textContent = 'Entrar'; await BANCO.sb.auth.signOut(); }
}
async function sairDoPainel(expirou=false){
  try { await BANCO.sb.auth.signOut(); } catch(e){}
  location.hash = ''; if(expirou) sessionStorage.setItem('painel_msg', 'Sua sessão expirou. Entre de novo.');
  location.reload();
}

/* ─── CARREGAR DADOS ─── */
function _mesAtual(){ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }

async function _iniciarSessao(){
  const eu = await rpc('painel_eu');
  BANCO.eu = eu;
  if(!eu.liberada) DB.toast('O acesso da barbearia está pendente de pagamento. Fale com a DuoTech.', 'aviso', 8000);
  await recarregar(['base','resumo','caixa','meta','academia']);
  _aplicarEmpresa();
  _resolverPronto();
}

/* Recarrega partes: base (serviços, planos, barbeiros, produtos), resumo, caixa, meta, academia */
async function recarregar(partes=['resumo']){
  if(_pendentes.size) await Promise.allSettled([..._pendentes]);
  const sb = BANCO.sb, emp = BANCO.eu.empresa.id, tarefas = [];
  if(partes.includes('base')) tarefas.push((async()=>{
    const [s, p, b, pr] = await Promise.all([
      sb.from('servicos').select('id,nome,categoria,duracao_min,preco,preco_a_partir,destaque,insumo,ordem').eq('empresa_id', emp).eq('ativo', true).order('ordem'),
      sb.from('planos_cliente').select('id,nome,descricao,preco,cortes_mes,vagas_total,mais_vendido,vigencia,vantagens,termos_url,ordem').eq('empresa_id', emp).eq('ativo', true).order('ordem'),
      sb.from('perfis').select('id,nome,tipo,especialidade,foto_url,comissao_pct,aparece_no_link').eq('empresa_id', emp).eq('ativo', true).order('nome'),
      sb.from('produtos').select('id,nome,categoria,estoque_atual,estoque_minimo,preco_custo,preco_venda').eq('empresa_id', emp).eq('ativo', true).order('nome'),
    ]);
    for(const r of [s,p,b,pr]) if(r.error) throw new Error('Não foi possível ler os cadastros. Confira se o SQL da versão 4 foi rodado.');
    BANCO.servicosDb = s.data; BANCO.produtos = pr.data;
    _trocar(SERVICOS, s.data.map(x=>({...x, preco:Number(x.preco), insumo:Number(x.insumo||0)})));
    _trocar(BARBEIROS, b.data.filter(x=>x.aparece_no_link || x.tipo==='barbeiro').map(x=>({...x,
      iniciais: x.nome.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()})));
    BANCO.planosDb = p.data;
  })());
  if(partes.includes('resumo')) tarefas.push(rpc('painel_resumo').then(r=>{ BANCO.resumo = r; }));
  if(partes.includes('caixa'))  tarefas.push(rpc('caixa_atual').then(r=>{ BANCO.caixa = r; }));
  if(partes.includes('meta'))   tarefas.push(rpc('meta_ler', {p_mes:_mesAtual()}).then(r=>{ BANCO.meta = r; }));
  if(partes.includes('academia')) tarefas.push(rpc('academia_ler').then(r=>{ BANCO.academia = r || []; }));
  if(partes.includes('eu')) tarefas.push(rpc('painel_eu').then(r=>{ BANCO.eu = r; }));
  await Promise.all(tarefas);
  _montarDash();
}
function _trocar(arr, novos){ arr.length = 0; novos.forEach(x=>arr.push(x)); }
function _limparObj(o){ Object.keys(o).forEach(k=>delete o[k]); }

/* Personalidade e cores vêm da barbearia */
function _aplicarEmpresa(){
  const e = BANCO.eu.empresa;
  Object.assign(PERSONALIDADE_PADRAO, {
    nome: e.nome, slogan: e.slogan || '', boas_vindas: e.boas_vindas || '', tom_voz: e.tom_voz || 'descontraido',
    clube_nome: e.clube_nome || 'Clube de pontos', especialidade: e.especialidade || '', cor: e.cor_principal || '#C9A84C',
    whatsapp: e.whatsapp || '', instagram: e.instagram || '', pontos_por_real: Number(e.pontos_por_real || 1),
    pix_tipo: e.pix_tipo || '', pix_chave: e.pix_chave || '', pix_nome: e.pix_nome || '', pix_cidade: e.pix_cidade || '',
  });
  document.documentElement.style.setProperty('--accent', PERSONALIDADE_PADRAO.cor);
  document.querySelectorAll('.logo-nome').forEach(x=>x.textContent = e.nome);
  document.querySelectorAll('.logo-sub').forEach(x=>x.textContent = /barbearia/i.test(e.nome) ? 'Painel' : 'Barbearia');
  const u = document.querySelector('.sidebar-user');
  if(u) u.innerHTML = `<div class="user-avatar">${DB.esc(BANCO.eu.perfil.nome.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase())}</div>
    <div class="user-info"><strong>${DB.esc(BANCO.eu.perfil.nome)}</strong><br>
    <a href="#" onclick="event.preventDefault();sairDoPainel()" style="color:var(--accent);text-decoration:none">Sair</a></div>`;
  CONFIG.BARBEARIA_WA = e.whatsapp || CONFIG.BARBEARIA_WA;
  const topo = document.querySelector('.topo-acoes');
  if(topo && !document.getElementById('btn-sair-cel')) topo.insertAdjacentHTML('beforeend',
    `<button class="btn-topo so-cel" id="btn-sair-cel" onclick="if(confirm('Sair do painel?'))sairDoPainel()" title="Sair" aria-label="Sair do painel"><i class="bi bi-box-arrow-right"></i></button>`);
}

/* Números do Início, Meta e Lucro real a partir do resumo do banco */
function _montarDash(){
  const r = BANCO.resumo; if(!r) return;
  const n = v => Number(v || 0);
  const quando = iso => { const d = new Date(iso), h = new Date();
    const dias = Math.floor((new Date(h.toDateString()) - new Date(d.toDateString()))/86400000);
    return dias===0 ? `hoje, ${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}` : dias===1 ? 'ontem' : d.toLocaleDateString('pt-BR'); };
  const nomeMes = m => new Date(m+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'short'}).replace('.','').replace(/^./, c=>c.toUpperCase());
  _limparObj(DASH_DEMO);
  Object.assign(DASH_DEMO, {
    faturamento_mes: n(r.faturamento_mes), faturamento_mes_passado: n(r.faturamento_mes_passado), acumulado_ano: n(r.acumulado_ano),
    ocupacao: n(r.ocupacao), meta_ocupacao: n(r.meta_ocupacao) || 65,
    planos_ativos: n(r.planos_ativos), planos_vendidos_mes: n(r.planos_vendidos_mes), planos_cancelados_mes: n(r.planos_cancelados_mes),
    ticket_medio: n(r.atendimentos_mes) ? n(r.faturamento_mes) / n(r.atendimentos_mes) : 0,
    comandas_abertas: n(r.comandas_abertas), comandas_outros_dias: n(r.comandas_outros_dias),
    meses: (r.meses||[]).map(m=>({mes:nomeMes(m.mes), fat:n(m.fat), novos:n(m.novos), voltaram:Math.max(n(m.clientes)-n(m.novos),0),
                                  ticket: n(m.atend) ? n(m.fat)/n(m.atend) : 0})),
    pix_conferir: (r.pix_conferir||[]).map(x=>({id:x.id, nome:x.nome, plano:x.plano, valor:n(x.valor), quando:quando(x.quando), disse_que_pagou:x.disse_que_pagou, novo:x.novo})),
    mensalidade_aberta: (r.mensalidade_aberta||[]).map(x=>({id:x.id, nome:x.nome, plano:x.plano, dias:n(x.dias), tel:(x.tel||'').replace(/^55/,'')})),
    estoque_minimo: (r.estoque_minimo||[]).map(x=>({nome:x.nome, atual:n(x.atual), min:n(x.min)})),
    contratos_pendentes: [],
  });
  /* mapa de ocupação: chaves "dow-hora" (0=dom) → linhas Seg..Dom, colunas 07h..19h */
  const hm = r.heatmap || {};
  const ordem = [1,2,3,4,5,6,0];
  _trocar(OCUPACAO_DEMO, ordem.map(dow=>[...Array(13)].map((_,i)=>{ const v = hm[`${dow}-${i+7}`]; return v==null ? null : n(v); })));
  /* pedidos de oração */
  _trocar(PEDIDOS_ORACAO_DEMO, (r.pedidos_oracao||[]).map(x=>({id:x.id, nome:x.nome||'Cliente', anonimo:x.anonimo, quando:quando(x.quando), texto:x.texto, orado:x.orado})));
  /* planos com vagas restantes */
  if(BANCO.planosDb) _trocar(PLANOS, BANCO.planosDb.map(p=>({...p, preco:n(p.preco), vantagens:p.vantagens||[],
    vagas_restantes: p.vagas_total==null ? null : Math.max(p.vagas_total - n((r.assinantes||{})[p.id]), 0)})));
}

/* ─── TROCA DAS FUNÇÕES DE LER/GRAVAR DAS TELAS ─── */
function _instalar(){
  /* Fé e pedidos de oração */
  lerFe = ()=>({fe_ativa:true, fe_app_cliente:true, fe_lembrete:true, fe_fila:true, fe_dizimo:false, ...(BANCO.eu?.config?.fe||{})});
  salvarFe = f=>{ BANCO.eu.config.fe = {...f}; gravar('painel_salvar_config', {p_fe:f}); };
  pedidosOrados = ()=>PEDIDOS_ORACAO_DEMO.filter(x=>x.orado).map(x=>x.id);
  marcarOrado = id=>{ const p = PEDIDOS_ORACAO_DEMO.find(x=>x.id===id); if(p) p.orado = true;
    gravar('oracao_orei', {p_id:id, p_orado:true}); };
  lerPersonalidade = ()=>({...PERSONALIDADE_PADRAO});

  /* Pix dos planos (Início e Planos) */
  lerPedidosPlanos = ()=>Object.fromEntries((BANCO.resumo?.pix_conferir||[]).map(x=>[x.id, {
    status: x.novo ? 'aguardando_pagamento' : 'ativo', pagamento_informado_em: x.disse_que_pagou ? x.quando : null,
    nome: x.plano, cliente_nome: x.nome, preco: Number(x.valor)}]));
  confirmarPixPlano = async id=>{
    const r = await gravar('barbearia_confirmar_pagamento_plano', {p_assinatura:id});
    if(r){ DB.toast(`Plano liberado até ${DB.dataBR(r.proximo_vencimento)}`, 'sucesso'); await recarregar(['resumo']); navegar(window._telaAtual||'inicio', window._paramsAtual||{}); }
  };

  /* Caixa */
  lerCaixa = ()=>{
    const c = BANCO.caixa || {aberto:false, movs:[], historico:[]};
    return { aberto: c.aberto, abertura: c.caixa?.aberto_em || new Date().toISOString(), troco_inicial: Number(c.caixa?.troco||0),
      movs: [...(c.movs||[])].reverse().map(m=>({...m, valor:Number(m.valor), cat: m.origem==='manual' ? m.cat : null})),
      historico: (c.historico||[]).map(h=>({data:h.data, total:Number(h.total||0), esperado:Number(h.esperado||0), contado:Number(h.contado||0)})) };
  };
  salvarCaixa = ()=>{};
  _salvarMov = async tipo=>{
    const valor = _num('cx-valor'), cat = document.getElementById('cx-cat').value;
    const desc = document.getElementById('cx-desc').value.trim() || cat, forma = document.getElementById('cx-forma').value;
    if(valor<=0){ DB.toast('Informe o valor','erro'); return; }
    if(await gravar('caixa_lancar', {p_tipo:tipo, p_categoria:cat, p_descricao:desc, p_forma:forma, p_valor:valor},
       `${tipo==='entrada'?'Entrada':'Saída'} de ${DB.moeda(valor)} registrada`)){
      fecharModal('modal-caixa'); await recarregar(['caixa','resumo']); navegar('caixa'); }
  };
  _confirmarAbertura = async ()=>{
    if(await gravar('caixa_abrir', {p_troco:_num('cx-troco')}, 'Caixa aberto. Bom trabalho!')){
      fecharModal('modal-caixa'); await recarregar(['caixa']); navegar('caixa'); }
  };
  _confirmarFechamento = async ()=>{
    if(!document.getElementById('cx-contado').value){ DB.toast('Conte o dinheiro da gaveta e informe o valor','erro'); return; }
    if(await gravar('caixa_fechar', {p_contado:_num('cx-contado'), p_obs:null}, 'Caixa fechado. Deus abençoe o descanso!')){
      fecharModal('modal-caixa'); await recarregar(['caixa','resumo']); navegar('caixa'); }
  };
  caixaHoje = ()=>{ const c = BANCO.caixa; if(!c?.aberto) return 0; return Number(c.resumo?.entradas||0); };

  /* Meta do mês */
  const _metaPad = _metaPadrao;
  lerMeta = ()=>{
    const p = _metaPad(), s = BANCO.meta?.dados || {};
    return {...p, ...s, mix:{...p.mix, ...(s.mix||{})}, campanhas:{...p.campanhas, ...(s.campanhas||{})},
            proposito:{...p.proposito, ...(s.proposito||{})}, historico: BANCO.meta?.historico || []};
  };
  salvarMeta = m=>{ const d = {...m}; delete d.historico; BANCO.meta = {...(BANCO.meta||{}), dados:d}; gravar('meta_salvar', {p_mes:_mesAtual(), p_dados:d}); };
  _salvarCalibragem = async previstas=>{
    const nova = _num('cal-meta'), motivo = document.getElementById('cal-motivo').value.trim();
    if(nova < previstas){ DB.toast(`A meta não pode ficar abaixo das assinaturas previstas (${DB.moeda(previstas)})`,'erro'); return; }
    if(!lerMeta().meta || !BANCO.meta?.dados) await rpc('meta_salvar', {p_mes:_mesAtual(), p_dados:(({historico, ...d})=>d)(lerMeta())}).catch(()=>{});
    if(await gravar('meta_calibrar', {p_mes:_mesAtual(), p_meta:nova, p_motivo:motivo}, 'Meta calibrada')){
      fecharModal('modal-caixa'); await recarregar(['meta']); navegar('meta', window._paramsMeta||{}); }
  };
  _desfazerCalibragem = async ()=>{
    if(await gravar('meta_desfazer', {p_mes:_mesAtual()}, 'Última alteração desfeita')){
      fecharModal('modal-caixa'); await recarregar(['meta']); navegar('meta', window._paramsMeta||{}); }
  };
  mensalidadesAtivas = ()=>Number(BANCO.resumo?.mensalidades_ativas||0);
  mixDoMes = ()=>{ const m = BANCO.resumo?.mix_mes || {}; return {avulsos:Number(m.avulsos||0), extras:Number(m.extras||0), produtos:Number(m.produtos||0)}; };
  serieMes = (ano, mes)=>{
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const ndias = new Date(ano, mes+1, 0).getDate(), hor = BANCO.eu.empresa.horarios || {};
    const porDia = Object.fromEntries((BANCO.resumo?.dias||[]).map(x=>[x.data, x]));
    return [...Array(ndias)].map((_,i)=>{
      const d = i+1, data = new Date(ano, mes, d), dow = data.getDay();
      const iso = `${ano}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`, v = porDia[iso] || {};
      const aberto = Array.isArray(hor[String(dow)]) && hor[String(dow)].length > 0;
      return {d, data, dow, aberto, peso: aberto ? (PESO_DIA[dow] || 1) : 0, passado: data < hoje, hoje: data.getTime()===hoje.getTime(),
              comandas:Number(v.comandas||0), assin:Number(v.assin||0), novas:Number(v.novas||0)};
    });
  };

  /* Lucro real: premissas e custos fixos na config; preço/insumo nos serviços; custo nos produtos */
  const _profitPad = ()=>structuredClone(PROFIT_PADRAO);
  lerProfit = ()=>{
    const pad = _profitPad(), cfg = BANCO.eu?.config?.profit || {}, r = BANCO.resumo || {}, vend = r.vendidos_30d || {};
    return {
      premissas: {...pad.premissas, ...(cfg.premissas||{})},
      insumos: Object.fromEntries(SERVICOS.map(s=>[s.id, Number(s.insumo||0)])),
      vendidos: Object.fromEntries(SERVICOS.map(s=>[s.id, Number(vend[s.id]||0)])),
      precos: Object.fromEntries(SERVICOS.map(s=>[s.id, Number(s.preco)])),
      produtos: BANCO.produtos.map(x=>({id:x.id, nome:x.nome, venda:Number(x.preco_venda||0), custo:Number(x.preco_custo||0), vendidos:Number(vend[x.id]||0)})),
      planos: Object.fromEntries(PLANOS.map(pl=>[pl.id, {assinantes:Number((r.assinantes||{})[pl.id]||0),
        usos:Number(cfg.planos?.[pl.id]?.usos ?? (pl.cortes_mes>0 ? pl.cortes_mes : 3)), insumo:Number(cfg.planos?.[pl.id]?.insumo ?? 5)}])),
      fixos: cfg.fixos || [{nome:'Aluguel',valor:0},{nome:'Luz',valor:0},{nome:'Água',valor:0},{nome:'Internet e telefone',valor:0},
                           {nome:'Sistema',valor:0},{nome:'Contador',valor:0},{nome:'Pró-labore do dono',valor:0},{nome:'Limpeza e manutenção',valor:0}],
    };
  };
  salvarProfit = p=>{
    const antes = lerProfit();
    const planos = Object.fromEntries(Object.entries(p.planos).map(([k,v])=>[k, {usos:v.usos, insumo:v.insumo}]));
    const profit = {premissas:p.premissas, fixos:p.fixos, planos};
    BANCO.eu.config.profit = profit;
    gravar('painel_salvar_config', {p_profit:profit});
    const serv = SERVICOS.filter(s=>p.insumos[s.id]!==antes.insumos[s.id] || (p.precos&&p.precos[s.id]!==antes.precos[s.id]))
      .map(s=>({id:s.id, insumo:p.insumos[s.id], preco:(p.precos||{})[s.id] ?? s.preco}));
    const prod = p.produtos.filter(x=>{ const a = antes.produtos.find(y=>y.id===x.id); return a && (a.venda!==x.venda || a.custo!==x.custo); })
      .map(x=>({id:x.id, venda:x.venda, custo:x.custo}));
    serv.forEach(s=>{ const o = SERVICOS.find(x=>x.id===s.id); o.insumo = s.insumo; o.preco = s.preco; });
    prod.forEach(x=>{ const o = BANCO.produtos.find(y=>y.id===x.id); o.preco_venda = x.venda; o.preco_custo = x.custo; });
    if(serv.length || prod.length) gravar('painel_salvar_custos', {p:{servicos:serv, produtos:prod}});
  };

  /* Academia: concluídas no banco; favoritos e presença ficam no aparelho */
  const _acadLocal = lerAcad;
  lerAcad = ()=>({..._acadLocal(), assistidas: Object.fromEntries((BANCO.academia||[]).map(a=>[a, true]))});
  salvarAcad = a=>{
    const antes = new Set(BANCO.academia||[]), agora = Object.keys(a.assistidas).filter(k=>a.assistidas[k]);
    agora.filter(k=>!antes.has(k)).forEach(k=>gravar('academia_concluir', {p_aula:k, p_feito:true}));
    [...antes].filter(k=>!a.assistidas[k]).forEach(k=>gravar('academia_concluir', {p_aula:k, p_feito:false}));
    BANCO.academia = agora;
    try { localStorage.setItem('tp_demo_academia', JSON.stringify({favoritos:a.favoritos, presenca:a.presenca})); } catch(e){}
  };
  _enviarParceiro = async ()=>{
    const v = id=>document.getElementById(id).value.trim();
    if(await gravar('academia_quero_ser_parceiro', {p_nome:v('pc-nome'), p_whatsapp:v('pc-whats'), p_area:v('pc-cat'), p_ideia:v('pc-ideia')}, 'Recebemos a sua ideia. Obrigado!'))
      fecharModal('modal-caixa');
  };

  /* Telas: esperam o login e, quando precisam, dados frescos */
  const frescas = {inicio:['resumo'], caixa:['caixa'], meta:['resumo','meta'], profit:['resumo'], proposito:['resumo'], planos:['resumo']};
  Object.keys(TELAS).forEach(nome=>{
    const original = TELAS[nome];
    TELAS[nome] = async (params={})=>{
      await BANCO._pronto;
      window._paramsAtual = params;
      if(frescas[nome] && !params._semRecarregar) { try { await recarregar(frescas[nome]); } catch(e){ DB.toast(e.message,'erro',5000); } }
      if(TELAS_REAIS[nome]) return TELAS_REAIS[nome](params);
      return AINDA_EXEMPLO.includes(nome) ? avisoExemplo() + original(params) : original(params);
    };
  });
}

/* Telas que ainda mostram exemplos (próxima etapa) */
const TELAS_REAIS = {};
const AINDA_EXEMPLO = ['fila','financeiro','comissoes','estoque','fidelidade','personalizar','config'];
function avisoExemplo(){ return `<div class="aviso-exemplo"><i class="bi bi-info-circle"></i> Esta tela ainda mostra <b>exemplos</b>. Ela será ligada ao banco na próxima etapa.</div>`; }

/* ─── INÍCIO ─── */
if(BANCO.ativo){
  BANCO._pronto = new Promise(ok=>{ BANCO._resolverPronto = ok; });
  window._resolverPronto = ()=>BANCO._resolverPronto();
  _instalar();
  document.addEventListener('DOMContentLoaded', async ()=>{
    try {
      await _carregarSdk();
      BANCO.sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON,
        { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'duotech-painel' } });
      const { data } = await BANCO.sb.auth.getSession();
      if(data?.session){
        try { await _iniciarSessao(); return; }
        catch(e){ await BANCO.sb.auth.signOut(); _telaLogin(e.message); return; }
      }
      const msg = sessionStorage.getItem('painel_msg') || ''; sessionStorage.removeItem('painel_msg');
      _telaLogin(msg);
    } catch(e){ _telaLogin(e.message); }
  });
}
