/* ═══════════════════════════════════════════════
   DuoTech Barber v3 · cliente.js
   Página do cliente: Agendar · Planos Gold · Clube · Conta

   Dois modos:
   - DEMONSTRAÇÃO (CONFIG.MODO_DEMO): tudo fica salvo no próprio
     navegador, para mostrar ao cliente sem banco.
   - REAL: conversa com o Supabase pelas funções do arquivo
     sql/barber-v3-thiago-prado.sql (link_publico, cliente_entrar…)

   Login do cliente igual ao DuoTech Beauty: WhatsApp + senha.
═══════════════════════════════════════════════ */
(function(){
'use strict';

const esc = DB.esc, moeda = DB.moeda;
const $ = s => document.querySelector(s);
const SLUG = CONFIG.BARBEARIA_SLUG;
const FUSO = 'America/Sao_Paulo';
const CHAVE_CONTA = 'barber_conta_' + SLUG;

/* ─────────────────────────────────────────────
   1. CAMADA DE DADOS
───────────────────────────────────────────── */
const API = CONFIG.MODO_DEMO ? criarApiDemo() : criarApiReal();

function criarApiReal(){
  let sb = null;
  async function cliente(){
    if (sb) return sb;
    await new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = ok; s.onerror = () => falha(new Error('Sem internet?'));
      document.head.appendChild(s);
    });
    sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON, { auth: { persistSession: false } });
    return sb;
  }
  async function rpc(nome, args){
    const c = await cliente();
    const { data, error } = await c.rpc(nome, args);
    if (error) throw new Error('Não deu certo agora. Tente de novo em instantes.');
    return data;
  }
  return {
    carregar: () => rpc('link_publico', { p_slug: SLUG }),
    site: () => rpc('site_barbearia', { p_host: location.hostname, p_slug: SLUG }),
    horarios: async (servico, dia, barbeiro) => {
      const r = await rpc('link_horarios', { p_slug: SLUG, p_servico: servico, p_data: dia, p_barbeiro: barbeiro || null });
      return (r || []).map(String);
    },
    cadastrar: (d) => rpc('cliente_cadastrar', { p_slug: SLUG, p_nome: d.nome, p_whatsapp: d.wa, p_senha: d.senha, p_nascimento: d.nasc || null }),
    entrar: (wa, senha) => rpc('cliente_entrar', { p_slug: SLUG, p_whatsapp: wa, p_senha: senha }),
    sair: (token) => rpc('cliente_sair', { p_token: token }).catch(() => {}),
    painel: (token) => rpc('cliente_painel', { p_slug: SLUG, p_token: token }),
    agendar: (token, servico, inicio, barbeiro) => rpc('link_agendar', { p_slug: SLUG, p_token: token, p_servico: servico, p_inicio: inicio, p_barbeiro: barbeiro || null }),
    agendarRapido: (d) => rpc('link_agendar_rapido', { p_slug: SLUG, p_nome: d.nome, p_whatsapp: d.wa, p_servico: d.servico, p_inicio: d.inicio, p_barbeiro: d.barbeiro || null }),
    resgatar: (token, rec) => rpc('cliente_resgatar', { p_slug: SLUG, p_token: token, p_recompensa: rec }),
    assinar: (token, plano) => rpc('cliente_assinar_plano', { p_slug: SLUG, p_token: token, p_plano: plano }),
    informarPagamento: (token) => rpc('cliente_informar_pagamento_plano', { p_slug: SLUG, p_token: token }),
    produtos: () => rpc('link_produtos', { p_slug: SLUG }).catch(() => []),
  };
}

function criarApiDemo(){
  const ler = (k, v) => { try { return JSON.parse(localStorage.getItem('tp_demo_' + k)) ?? v; } catch(e){ return v; } };
  const gravar = (k, v) => { try { localStorage.setItem('tp_demo_' + k, JSON.stringify(v)); } catch(e){} };
  const fone = w => { let n = String(w || '').replace(/\D/g, ''); if (n.length > 11 && n.startsWith('55')) n = n.slice(2); return n; };
  const agora = () => new Date().toISOString();

  // conta de EXEMPLO para mostrar o clube com pontos (fica claro que é exemplo)
  function garantirExemplo(){
    const cl = ler('clientes', []);
    if (!cl.find(c => c.id === 'exemplo')) {
      cl.push({ id: 'exemplo', nome: 'Cliente Exemplo', wa: '11900000000', senha: '123456' });
      gravar('clientes', cl);
      const pts = ler('pontos', {});
      const d = n => new Date(Date.now() - n * 864e5).toISOString();
      pts.exemplo = [
        { pontos: 150, tipo: 'atendimento', descricao: 'Corte + Barba a vapor', criado_em: d(3) },
        { pontos: 90,  tipo: 'atendimento', descricao: 'Corte', criado_em: d(18) },
        { pontos: 195, tipo: 'atendimento', descricao: 'Manutenção Prótese Capilar', criado_em: d(33) },
        { pontos: 160, tipo: 'atendimento', descricao: 'Luzes', criado_em: d(47) },
        { pontos: 90,  tipo: 'atendimento', descricao: 'Corte', criado_em: d(61) },
        { pontos: 55,  tipo: 'atendimento', descricao: 'Pezinho + Risquinho', criado_em: d(75) },
      ];
      gravar('pontos', pts);
    }
  }
  garantirExemplo();

  const quem = token => ler('clientes', []).find(c => 'demo-' + c.id === token);
  const saldo = id => (ler('pontos', {})[id] || []).reduce((s, m) => s + m.pontos, 0);
  const ocupado = (iso, barb) => {           // horários "já ocupados" de mentira + os marcados na demo
    const k = (iso + (barb || '')).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    if (k % 4 === 0) return true;
    return ler('agend', []).some(a => a.inicio === iso && (!barb || a.barbeiro === barb));
  };

  return {
    async carregar(){
      const P = lerPersonalidade(), fotos = lerFotos();
      return {
        empresa: { nome: P.nome + ' ' + P.tipo, slogan: P.slogan, boas_vindas: P.boas_vindas, tom_voz: P.tom_voz,
          clube_nome: P.clube_nome, especialidade: P.especialidade, cor_principal: P.cor, whatsapp: P.whatsapp,
          instagram: P.instagram, pontos_ativo: true, pontos_por_real: P.pontos_por_real,
          horarios: {"1":[["09:00","20:00"]],"2":[["09:00","20:00"]],"3":[["09:00","20:00"]],"4":[["09:00","20:00"]],"5":[["09:00","20:00"]],"6":[["09:00","18:00"]]},
          dias_abertos_link: 30,
          pix_tipo: P.pix_tipo, pix_chave: P.pix_chave, pix_nome: P.pix_nome || (P.nome + ' ' + P.tipo), pix_cidade: P.pix_cidade },
        servicos: SERVICOS, planos: PLANOS, recompensas: RECOMPENSAS,
        barbeiros: obterBarbeiros().filter(b=>b.ativo !== false && b.aparece_no_link !== false).map(b => ({ ...b, foto_url: b.foto_url || fotos[b.id] || null })),
      };
    },
    async horarios(servicoId, dia, barbeiro){
      const s = SERVICOS.find(x => x.id === servicoId); if (!s) return [];
      const [a, m, d] = dia.split('-').map(Number);
      const dow = new Date(a, m - 1, d).getDay();
      const turno = ({1:[9,20],2:[9,20],3:[9,20],4:[9,20],5:[9,20],6:[9,18]})[dow];
      if (!turno) return [];
      const lista = [], minimo = Date.now() + 60 * 6e4;
      for (let t = turno[0] * 60; t + s.duracao_min <= turno[1] * 60; t += 30) {
        const dt = new Date(a, m - 1, d, Math.floor(t / 60), t % 60);
        if (dt.getTime() < minimo) continue;
        const iso = dt.toISOString();
        if (!ocupado(iso, barbeiro)) lista.push(iso);
      }
      return lista;
    },
    async agendarRapido(d){                       // sem conta: só nome e WhatsApp
      const wa = fone(d.wa);
      if ((d.nome || '').trim().length < 2) return { erro: 'Digite seu nome.' };
      if (wa.length < 10 || wa.length > 11) return { erro: 'Digite seu WhatsApp com DDD.' };
      const cl = ler('clientes', []); let c = cl.find(x => x.wa === wa);
      if (!c) { c = { id: 'c' + Date.now(), nome: d.nome.trim(), wa, senha: null }; cl.push(c); gravar('clientes', cl); }
      return this.agendar('demo-' + c.id, d.servico, d.inicio, d.barbeiro);
    },
    async cadastrar(d){
      const wa = fone(d.wa);
      if ((d.nome || '').trim().length < 2) return { erro: 'Digite seu nome.' };
      if (wa.length < 10 || wa.length > 11) return { erro: 'WhatsApp inválido. Use DDD + número.' };
      if ((d.senha || '').length < 6) return { erro: 'A senha precisa ter pelo menos 6 caracteres.' };
      const cl = ler('clientes', []);
      if (cl.find(c => c.wa === wa)) return { erro: 'Esse WhatsApp já tem conta. Toque em "Já tenho conta" e entre com sua senha.' };
      const c = { id: 'c' + Date.now(), nome: d.nome.trim(), wa, senha: d.senha, nasc: d.nasc || null };
      cl.push(c); gravar('clientes', cl);
      return { token: 'demo-' + c.id, nome: c.nome };
    },
    async entrar(wa, senha){
      const c = ler('clientes', []).find(x => x.wa === fone(wa));
      if (!c || c.senha !== senha) return { erro: 'WhatsApp ou senha incorretos. Primeira vez? Toque em "Criar conta".' };
      return { token: 'demo-' + c.id, nome: c.nome };
    },
    async sair(){},
    async painel(token){
      const c = quem(token); if (!c) return { erro: 'Entre de novo na sua conta.', sair: true };
      const ext = (ler('pontos', {})[c.id] || []).slice().sort((x, y) => y.criado_em.localeCompare(x.criado_em));
      return {
        cliente: { nome: c.nome, whatsapp: c.wa },
        saldo: saldo(c.id), extrato: ext.slice(0, 20),
        resgates: ler('resgates', []).filter(r => r.cliente === c.id).reverse(),
        plano: ler('planos', {})[c.id] || null,
        proximos: ler('agend', []).filter(a => a.cliente === c.id && a.inicio >= agora()).sort((x, y) => x.inicio.localeCompare(y.inicio)),
      };
    },
    async agendar(token, servicoId, inicio, barbeiro){
      const c = quem(token); if (!c) return { erro: 'Entre na sua conta para agendar.', sair: true };
      const s = SERVICOS.find(x => x.id === servicoId);
      const ag = ler('agend', []);
      if (ag.filter(a => a.cliente === c.id && a.inicio >= agora()).length >= 3)
        return { erro: 'Você já tem 3 horários marcados. Fale com a barbearia para marcar mais.' };
      if (ocupado(inicio, barbeiro)) return { erro: 'Esse horário acabou de ser ocupado. Escolha outro.' };
      const equipeAtiva = obterBarbeiros().filter(x=>x.ativo !== false && x.aparece_no_link !== false);
      if (barbeiro && !equipeAtiva.some(x => x.id === barbeiro)) return { erro: 'Esse profissional não está mais disponível. Escolha outro.' };
      const b = equipeAtiva.find(x => x.id === barbeiro) || equipeAtiva[0];
      if(!b) return { erro: 'No momento não há profissionais disponíveis para agendamento.' };
      ag.push({ cliente: c.id, servico: s.nome, inicio, barbeiro: b.id, barbeiro_nome: b.nome, status: 'agendado' });
      gravar('agend', ag);
      return { ok: true, servico: s.nome, inicio, barbeiro: b.nome };
    },
    async resgatar(token, recId){
      const c = quem(token); if (!c) return { erro: 'Entre na sua conta primeiro.', sair: true };
      const r = RECOMPENSAS.find(x => x.id === recId); const sd = saldo(c.id);
      if (sd < r.pontos) return { erro: `Faltam ${r.pontos - sd} pontos para este prêmio.` };
      const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const codigo = Array.from({ length: 6 }, () => letras[Math.floor(Math.random() * 32)]).join('');
      const pts = ler('pontos', {}); (pts[c.id] = pts[c.id] || []).push({ pontos: -r.pontos, tipo: 'resgate', descricao: r.nome, criado_em: agora() });
      gravar('pontos', pts);
      const rs = ler('resgates', []); rs.push({ cliente: c.id, nome: r.nome, pontos: r.pontos, codigo, status: 'pendente', criado_em: agora() });
      gravar('resgates', rs);
      return { ok: true, codigo, saldo: sd - r.pontos };
    },
    async assinar(token, planoId){
      const c = quem(token); if (!c) return { erro: 'Entre na sua conta para escolher um plano.', sair: true };
      const pl = ler('planos', {});
      if (pl[c.id]) return { erro: 'Você já tem um plano ativo ou aguardando pagamento.' };
      const p = PLANOS.find(x => x.id === planoId);
      if (p.vagas_restantes === 0) return { erro: 'As vagas deste plano acabaram.' };
      pl[c.id] = { id: 'a' + Date.now(), nome: p.nome, preco: p.preco, status: 'aguardando_pagamento',
                   cliente_nome: c.nome, proximo_vencimento: null, pagamento_informado_em: null };
      gravar('planos', pl);
      return { ok: true, plano: p.nome, preco: p.preco, assinatura_id: pl[c.id].id };
    },
    async informarPagamento(token){
      const c = quem(token); if (!c) return { erro: 'Entre de novo na sua conta.', sair: true };
      const pl = ler('planos', {}); if (!pl[c.id]) return { erro: 'Você não tem plano para pagar.' };
      pl[c.id].pagamento_informado_em = agora(); gravar('planos', pl);
      return { ok: true };
    },
    async produtos(){
      try { return (JSON.parse(localStorage.getItem('tp_demo_estoque') || '[]') || []).filter(p => Number(p.venda) > 0)
        .map(p => ({ nome: p.nome, categoria: p.categoria, preco: Number(p.venda), foto_url: p.foto || null, disponivel: Number(p.qtd) > 0 })); }
      catch(e){ return []; }
    },
  };
}

/* ─────────────────────────────────────────────
   2. ESTADO
───────────────────────────────────────────── */
const E = {
  dados: null, P: null, F: FALAS.descontraido,
  aba: 'agendar',
  conta: lerConta(), painel: null,
  barbeiro: null, servico: null, cat: 'todos', dia: null, hora: null, horas: null,
  depoisDoLogin: null,
};
function lerConta(){ try { return JSON.parse(localStorage.getItem(CHAVE_CONTA)); } catch(e){ return null; } }
function salvarConta(c){ try { c ? localStorage.setItem(CHAVE_CONTA, JSON.stringify(c)) : localStorage.removeItem(CHAVE_CONTA); } catch(e){} E.conta = c; }

/* ─────────────────────────────────────────────
   3. AJUDANTES
───────────────────────────────────────────── */
function toast(msg){
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}
const primeiroNome = n => String(n || '').trim().split(/\s+/)[0] || '';
const iniciais = n => esc(String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase());
const hojeLocal = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
const isoDia = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hora = iso => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
const dataLonga = iso => new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: 'long' });
const dataCurta = iso => new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: '2-digit' });
const precoTxt = s => (s.preco_a_partir ? 'a partir de ' : '') + moeda(s.preco);
const mascaraWa = v => { const n = v.replace(/\D/g, '').slice(0, 11); if (n.length <= 2) return n; if (n.length <= 7) return `(${n.slice(0,2)}) ${n.slice(2)}`; return `(${n.slice(0,2)}) ${n.slice(2, n.length - 4)}-${n.slice(-4)}`; };

/* ─────────────────────────────────────────────
   4. TOPO COM A PERSONALIDADE DA BARBEARIA
───────────────────────────────────────────── */
function htmlTopo(){
  const P = E.P;
  const ig = P.instagram ? String(P.instagram).replace(/^@/, '') : '';
  return `
  ${CONFIG.MODO_DEMO ? '<div class="faixa-demo">DEMONSTRAÇÃO · nada aqui é enviado para a barbearia</div>' : ''}
  <header class="capa">
    <div class="coroa ${P.logo ? 'tem-logo' : ''}">${P.logo ? `<img class="logo-capa" src="${esc(P.logo)}" alt="Logo ${esc(P.nome)}" onerror="this.replaceWith(document.createRange().createContextualFragment(COROA_SVG(68,'${esc(P.cor)}')))">` : COROA_SVG(68, P.cor)}</div>
    <h1 class="${P.logo ? 'so-leitor' : ''}">${esc(P.nome)}</h1>
    <div class="tipo ${P.logo ? 'so-leitor' : ''}">${esc(P.tipo)}</div>
    ${P.slogan ? `<p class="slogan">“${esc(P.slogan)}”</p>` : ''}
    ${P.especialidade ? `<div class="selo"><i class="bi bi-gem"></i>${esc(P.especialidade)}</div>` : ''}
    <div class="atalhos">
      <a class="atalho" href="${DB.linkWa('Oi! Vim pelo app da barbearia.', P.whatsapp)}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="bi bi-whatsapp"></i></a>
      ${ig ? `<a class="atalho" href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener" aria-label="Instagram"><i class="bi bi-instagram"></i></a>` : ''}
      ${P.endereco ? `<a class="atalho" href="https://maps.google.com/?q=${encodeURIComponent(P.endereco)}" target="_blank" rel="noopener" aria-label="Como chegar"><i class="bi bi-geo-alt"></i></a>` : ''}
      ${window.TPX ? window.TPX.botaoTema() : ''}
    </div>
  </header>
  <div class="saudacao">
    <div class="txt">
      <div class="ola">${E.conta ? esc(E.F.ola(primeiroNome(E.conta.nome))) : esc(E.F.olaAnon)}</div>
      <div class="sub">${esc(String(P.boas_vindas || '').replace(E.F.olaAnon, '').trim())}</div>
    </div>
    ${E.conta && E.painel ? `<button class="pts" data-ir="clube"><i class="bi bi-star-fill"></i>${E.painel.saldo} pts</button>` : ''}
  </div>
  ${E.painel && precisaPagar(E.painel.plano) ? `<button class="faixa-pagar" data-acao="pagar-plano">
     <i class="bi bi-qr-code"></i><span><b>${esc(E.painel.plano.nome)}</b>${esc(situacaoPlano(E.painel.plano))}</span><i class="bi bi-chevron-right"></i></button>` : ''}`;
}

/* ─────────────────────────────────────────────
   5. ABA AGENDAR
───────────────────────────────────────────── */
function htmlAgendar(){
  const D = E.dados, F = E.F;
  const cats = ['todos', ...new Set(D.servicos.map(s => s.categoria))];
  const lista = D.servicos.filter(s => E.cat === 'todos' || s.categoria === E.cat);
  const temBarbeiros = D.barbeiros.length > 0;
  let n = 0; const num = () => String(++n).padStart(2, '0');

  return `
  ${window.TPX ? window.TPX.htmlMais() : ''}
  ${temBarbeiros ? `
  <section class="secao">
    <div class="passo"><span class="num">${num()}</span><h2>${esc(F.passo1)}</h2><span class="linha"></span></div>
    <div class="barbeiros">
      <button class="barbeiro ${E.barbeiro === null ? 'sel' : ''}" data-barb="">
        <div class="foto"><i class="bi bi-shuffle" style="font-size:1.3rem"></i></div>
        <div class="nome">Sem preferência</div><div class="esp">Quem estiver livre</div>
      </button>
      ${D.barbeiros.map(b => `
      <button class="barbeiro ${E.barbeiro === b.id ? 'sel' : ''}" data-barb="${esc(b.id)}">
        <div class="foto">${b.foto_url ? `<img src="${esc(b.foto_url)}" alt="Foto de ${esc(b.nome)}">` : iniciais(b.nome)}</div>
        <div class="nome">${esc(b.nome)}</div>
        ${b.especialidade ? `<div class="esp">${esc(b.especialidade)}</div>` : ''}
      </button>`).join('')}
    </div>
  </section>` : ''}

  <section class="secao">
    <div class="passo"><span class="num">${num()}</span><h2>${esc(F.passo2)}</h2><span class="linha"></span></div>
    <div class="chips">
      ${cats.map(c => `<button class="chip ${E.cat === c ? 'sel' : ''}" data-cat="${esc(c)}">${c === 'todos' ? 'Todos' : esc(CATEGORIAS[c] || c)}</button>`).join('')}
    </div>
    <div class="servicos">
      ${lista.map(s => `
      <button class="servico ${E.servico === s.id ? 'sel' : ''}" data-serv="${esc(s.id)}">
        <span class="marca"><i class="bi bi-check-lg"></i></span>
        <span class="info">
          <span class="n">${esc(s.nome)}${s.destaque ? '<span class="tag-alta">Em alta</span>' : ''}</span>
          <span class="d">${s.duracao_min} min${s.descricao ? ' · ' + esc(s.descricao) : ''}</span>
        </span>
        <span class="p">${s.preco_a_partir ? '<small>a partir de</small>' : ''}${moeda(s.preco)}</span>
      </button>`).join('')}
    </div>
  </section>

  ${E.servico ? `
  <section class="secao" id="secDia">
    <div class="passo"><span class="num">${num()}</span><h2>${esc(F.passo3)}</h2><span class="linha"></span></div>
    <div class="dias">${htmlDias()}</div>
    <div id="horas">${htmlHoras()}</div>
  </section>` : ''}
  <div style="height:${E.servico ? 110 : 20}px"></div>
  ${E.servico ? htmlBarra() : ''}`;
}

function htmlDias(){
  const hor = E.dados.empresa.horarios || {};
  const total = Math.min(Number(E.dados.empresa.dias_abertos_link) || 30, 21);
  const h = hojeLocal(), out = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(h.getFullYear(), h.getMonth(), h.getDate() + i);
    const iso = isoDia(d), aberto = (hor[String(d.getDay())] || []).length > 0;
    const sem = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    out.push(`<button class="dia ${E.dia === iso ? 'sel' : ''} ${aberto ? '' : 'fechado'}" data-dia="${iso}" ${aberto ? '' : 'disabled'}>
      <div class="sem">${esc(sem)}</div><div class="num">${d.getDate()}</div></button>`);
  }
  return out.join('');
}
function htmlHoras(){
  if (!E.dia) return '<div class="vazio">Escolha um dia acima.</div>';
  if (E.horas === null) return '<div class="vazio">Procurando horários livres…</div>';
  if (!E.horas.length) return `<div class="vazio">${esc(E.F.semHorario)}</div>`;
  return `<div class="horas">${E.horas.map(iso => `<button class="hora ${E.hora === iso ? 'sel' : ''}" data-hora="${esc(iso)}">${hora(iso)}</button>`).join('')}</div>`;
}
function htmlBarra(){
  const s = E.dados.servicos.find(x => x.id === E.servico);
  const b = E.dados.barbeiros.find(x => x.id === E.barbeiro);
  const quando = E.hora ? `${new Date(E.hora).toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit' })} · ${hora(E.hora)}` : 'escolha dia e horário';
  return `<div class="barra"><div class="barra-in">
    <div class="resumo"><b>${esc(s.nome)} · ${precoTxt(s)}</b>${esc(quando)}${b ? ' · ' + esc(b.nome.split(' ')[0]) : ''}</div>
    <button class="btn btn-preto" data-acao="confirmar" ${E.hora ? '' : 'disabled'}>${esc(E.F.cta)}</button>
  </div></div>`;
}

async function carregarHoras(){
  E.horas = null; E.hora = null; atualizarHoras();
  const pedido = E.dia + E.servico + E.barbeiro;
  try {
    const h = await API.horarios(E.servico, E.dia, E.barbeiro);
    if (pedido === E.dia + E.servico + E.barbeiro) { E.horas = h; atualizarHoras(); }
  } catch(e){ E.horas = []; atualizarHoras(); toast(e.message); }
}
function atualizarHoras(){
  const el = $('#horas'); if (el) el.innerHTML = htmlHoras();
  const barra = document.querySelector('.barra'); if (barra) barra.outerHTML = htmlBarra();
}

async function confirmarAgendamento(){
  if (!E.conta) { abrirDadosRapidos(); return; }               // sem conta: só nome e WhatsApp
  const r = await API.agendar(E.conta.token, E.servico, E.hora, E.barbeiro).catch(e => ({ erro: e.message }));
  if (r && r.sair) { salvarConta(null); abrirDadosRapidos(); return; }
  if (!r || r.erro) { toast(r ? r.erro : 'Não deu certo.'); carregarHoras(); return; }
  await mostrarAgendado(r, E.conta.nome);
}

/* agendar sem conta: a barbearia só precisa do nome e do WhatsApp */
const lerDados = () => { try { return JSON.parse(localStorage.getItem('barber_dados') || '{}'); } catch(e){ return {}; } };
function abrirDadosRapidos(){
  const d = lerDados();
  abrirFolha(`<button class="fechar" data-fechar aria-label="Fechar"><i class="bi bi-x"></i></button>
    <h3>Seus dados</h3>
    <p style="margin-bottom:14px;color:var(--texto2)">É só para a barbearia saber quem vem. Não precisa criar conta.</p>
    <form id="formRapido" novalidate>
      <div class="erro" id="erroRapido"></div>
      <div class="campo"><label for="rNome">Seu nome</label><input id="rNome" autocomplete="name" maxlength="80" value="${esc(d.nome || '')}"></div>
      <div class="campo"><label for="rWa">Seu WhatsApp</label><input id="rWa" type="tel" inputmode="numeric" autocomplete="tel" placeholder="(16) 99999-9999" value="${esc(d.wa ? mascaraWa(d.wa) : '')}"></div>
      <button class="btn btn-preto btn-largo" type="submit"><i class="bi bi-check-lg"></i> Confirmar horário</button>
    </form>
    ${E.dados.empresa.pontos_ativo ? `<p class="aviso">Quer juntar pontos no ${esc(E.P.clube_nome)}? <a class="link-btn" href="#" data-acao="login">Crie sua conta</a></p>` : ''}`);
}
async function enviarRapido(form){
  const erro = form.querySelector('#erroRapido'), btn = form.querySelector('button[type=submit]');
  const nome = form.querySelector('#rNome').value.trim(), wa = form.querySelector('#rWa').value;
  erro.classList.remove('on');
  if (nome.length < 2) { erro.textContent = 'Digite seu nome.'; erro.classList.add('on'); return; }
  if (String(wa).replace(/\D/g, '').length < 10) { erro.textContent = 'Digite seu WhatsApp com DDD.'; erro.classList.add('on'); return; }
  btn.disabled = true;
  const r = await API.agendarRapido({ nome, wa, servico: E.servico, inicio: E.hora, barbeiro: E.barbeiro }).catch(e => ({ erro: e.message }));
  btn.disabled = false;
  if (!r || r.erro) { erro.textContent = r ? r.erro : 'Não deu certo.'; erro.classList.add('on'); if (r && /ocupado/i.test(r.erro)) carregarHoras(); return; }
  try { localStorage.setItem('barber_dados', JSON.stringify({ nome, wa: String(wa).replace(/\D/g, '') })); } catch(e){}
  await mostrarAgendado(r, nome);
}
async function mostrarAgendado(r, nome){
  const s = E.dados.servicos.find(x => x.id === E.servico);
  const msg = `Oi! Acabei de agendar pelo app: ${r.servico}${r.barbeiro ? ' com ' + r.barbeiro : ''}, ${dataLonga(r.inicio)} às ${hora(r.inicio)}. Nome: ${nome}`;
  abrirFolha(`
    <div class="sucesso">
      <div class="grande"><i class="bi bi-check-circle-fill"></i></div>
      <h3>${esc(E.F.confirmado)}</h3>
      <p><b>${esc(r.servico)}</b>${r.barbeiro ? ' com ' + esc(r.barbeiro) : ''}<br>${esc(dataLonga(r.inicio))} às ${hora(r.inicio)}</p>
      ${s && s.preco_a_partir ? '<p class="aviso">O valor final é combinado na cadeira.</p>' : ''}
      ${E.dados.empresa.pontos_ativo ? `<p class="aviso"><i class="bi bi-star-fill" style="color:var(--ouro)"></i> Esse atendimento vale pontos no ${esc(E.P.clube_nome)}.</p>` : ''}
      ${E.P.whatsapp ? `<p class="aviso" style="margin-top:14px">Seu horário já está reservado. Toque abaixo para mandar a confirmação no WhatsApp da barbearia.</p>
      <a class="btn btn-wa btn-largo" style="margin-top:8px" target="_blank" rel="noopener" href="${DB.linkWa(msg, E.P.whatsapp)}">
         <i class="bi bi-whatsapp"></i> Confirmar no WhatsApp</a>` : ''}
      <button class="btn btn-borda btn-largo" style="margin-top:8px" data-fechar>Fechar</button>
    </div>`);
  E.servico = null; E.dia = null; E.hora = null; E.horas = null;
  await atualizarPainel(); desenhar();
}

/* ─────────────────────────────────────────────
   6. ABA PLANOS GOLD
───────────────────────────────────────────── */
function htmlPlanos(){
  const planos = E.dados.planos;
  return `
  <h2 class="titulo-aba">${EH_THIAGO ? 'Planos Gold' : 'Planos'}</h2>
  <p class="sub-aba">Pague por mês e venha quantas vezes o plano permitir.</p>
  ${window.TPX ? window.TPX.htmlCalc() : ''}
  ${E.painel && E.painel.plano ? `<div class="lista" style="border:2px solid var(--ouro)"><h4>Seu plano</h4>${htmlMeuPlano(E.painel.plano)}</div>` : ''}
  <div class="planos">
  ${planos.map(p => {
    const esgotado = p.vagas_restantes === 0;
    return `
    <article class="plano ${p.mais_vendido ? 'top' : ''}">
      ${p.mais_vendido ? '<div class="fita"><i class="bi bi-fire"></i>Mais vendido</div>' : ''}
      <i class="bi bi-gem gold"></i>
      <h3>${esc(p.nome)}</h3>
      <div class="vig">Tempo de vigência: <b>${esc(p.vigencia || 'Indeterminado')}</b></div>
      <div class="preco">${moeda(p.preco)}</div>
      <div class="mes">Por mês</div>
      ${p.vagas_restantes != null ? `<div class="vagas"><i class="bi bi-exclamation-circle"></i>${esgotado ? 'Vagas esgotadas' : `Resta${p.vagas_restantes > 1 ? 'm' : ''} ${p.vagas_restantes} vaga${p.vagas_restantes > 1 ? 's' : ''} para esse plano.`}</div>` : ''}
      <div class="links">
        ${(p.vantagens || []).length ? `<button class="lk" data-vant="${esc(p.id)}">Confira as vantagens <i class="bi bi-arrow-right"></i></button>
        <ul class="vant" id="vant-${esc(p.id)}">${p.vantagens.map(v => `<li><i class="bi bi-check2-circle"></i>${esc(v)}</li>`).join('')}</ul>` : ''}
        ${p.termos_url ? `<a class="lk" href="${esc(p.termos_url)}" target="_blank" rel="noopener">Termos de uso <i class="bi bi-file-earmark-pdf"></i></a>`
                       : `<span class="lk" style="color:var(--fraco);font-weight:500;font-size:.8rem">Termos de uso: peça na barbearia</span>`}
      </div>
      <button class="btn ${p.mais_vendido ? 'btn-ouro' : 'btn-preto'} btn-largo" data-plano="${esc(p.id)}" ${esgotado ? 'disabled' : ''}>${esc(E.F.planoCta)}</button>
    </article>`;
  }).join('')}
  </div>`;
}

async function assinarPlano(id){
  if (!E.conta) { E.depoisDoLogin = () => assinarPlano(id); abrirLogin(E.F.pedirLogin); return; }
  const p = E.dados.planos.find(x => x.id === id);
  abrirFolha(`
    <button class="fechar" data-fechar aria-label="Fechar"><i class="bi bi-x"></i></button>
    <h3>${esc(p.nome)}</h3>
    <p><b style="font-size:1.4rem;color:var(--texto)">${moeda(p.preco)}</b> por mês · vigência ${esc((p.vigencia || 'indeterminada').toLowerCase())}</p>
    <ul style="list-style:none;margin:14px 0">${(p.vantagens || []).map(v => `<li style="padding:4px 0"><i class="bi bi-check2-circle" style="color:var(--ouro)"></i> ${esc(v)}</li>`).join('')}</ul>
    <p class="aviso" style="text-align:left"><i class="bi bi-qr-code"></i> Pagamento por <b>Pix</b>, todo mês. O plano começa a valer assim que a barbearia confirmar o Pix.</p>
    <button class="btn btn-preto btn-largo" style="margin-top:14px" data-acao="assinar-ok" data-id="${esc(p.id)}">Continuar para o Pix</button>`);
}
/* Pix do plano: QR Code + copia e cola com a chave da barbearia */
function temPix(){ const e = E.dados.empresa; return !!(e.pix_chave && e.pix_tipo); }
function codigoPix(valor, ref){
  const e = E.dados.empresa;
  return PIX.payload({ tipo: e.pix_tipo, chave: e.pix_chave, nome: e.pix_nome || e.nome, cidade: e.pix_cidade || 'BRASIL',
                       valor, txid: 'PLANO' + String(ref || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12), descricao: 'Plano' });
}
function abrirPix(plano){
  // plano: { id, nome, preco, status }
  const renovar = plano.status === 'ativo';
  if (!temPix()) {
    abrirFolha(`
      <button class="fechar" data-fechar aria-label="Fechar"><i class="bi bi-x"></i></button>
      <h3>${renovar ? 'Pagar mensalidade' : 'Pagamento do plano'}</h3>
      <p>${esc(plano.nome)} · <b>${moeda(plano.preco)}</b></p>
      <p class="aviso" style="text-align:left;margin-top:10px">A barbearia ainda não cadastrou a chave Pix no app. Peça pelo WhatsApp:</p>
      <a class="btn btn-wa btn-largo" style="margin-top:12px" target="_blank" rel="noopener"
         href="${DB.linkWa(`Oi! Quero pagar o ${plano.nome} (${moeda(plano.preco)}). Pode me mandar o Pix? Nome: ${E.conta.nome}`, E.P.whatsapp)}">
         <i class="bi bi-whatsapp"></i> Pedir o Pix</a>`);
    return;
  }
  const cod = codigoPix(plano.preco, plano.id);
  const qr = PIX.qrSvg(cod);
  abrirFolha(`
    <button class="fechar" data-fechar aria-label="Fechar"><i class="bi bi-x"></i></button>
    <h3>${renovar ? 'Pagar mensalidade' : 'Pague com Pix'}</h3>
    <p>${esc(plano.nome)}</p>
    <div class="pix-valor">${moeda(plano.preco)}</div>
    ${qr ? `<div class="pix-qr">${qr}</div>` : ''}
    <div class="pix-passos">
      <div><b>1.</b> Abra o app do seu banco e escolha <b>Pix</b>.</div>
      <div><b>2.</b> ${qr ? 'Leia o QR Code ou use o ' : 'Use o '}<b>Pix copia e cola</b>.</div>
      <div><b>3.</b> Depois de pagar, toque em <b>Já paguei</b>.</div>
    </div>
    <div class="pix-cola"><code id="pixCod">${esc(cod)}</code></div>
    <button class="btn btn-ouro btn-largo" data-acao="copiar-pix"><i class="bi bi-copy"></i> Copiar código Pix</button>
    <p class="aviso" style="margin:8px 0 0">Recebedor: <b>${esc(E.dados.empresa.pix_nome || E.dados.empresa.nome)}</b></p>
    <button class="btn btn-preto btn-largo" style="margin-top:12px" data-acao="ja-paguei" data-nome="${esc(plano.nome)}" data-preco="${plano.preco}">
      <i class="bi bi-check2-circle"></i> Já paguei</button>`);
}
async function jaPaguei(nome, preco){
  const r = await API.informarPagamento(E.conta.token).catch(e => ({ erro: e.message }));
  if (!r || r.erro) { toast(r ? r.erro : 'Não deu certo.'); return; }
  abrirFolha(`
    <div class="sucesso">
      <div class="grande"><i class="bi bi-hourglass-split"></i></div>
      <h3>Pagamento enviado!</h3>
      <p>Assim que a barbearia ver o Pix na conta, seu plano é liberado.</p>
      <a class="btn btn-wa btn-largo" style="margin-top:16px" target="_blank" rel="noopener"
         href="${DB.linkWa(`Oi! Paguei o Pix do ${nome} (${moeda(preco)}). Nome: ${E.conta.nome}. Vou mandar o comprovante aqui.`, E.P.whatsapp)}">
         <i class="bi bi-whatsapp"></i> Mandar comprovante</a>
      <button class="btn btn-borda btn-largo" style="margin-top:8px" data-fechar>Fechar</button>
    </div>`);
  await atualizarPainel(); desenhar();
}
/* situação do plano em palavras */
function situacaoPlano(pl){
  if (!pl) return '';
  if (pl.status === 'aguardando_pagamento')
    return pl.pagamento_informado_em ? 'Pagamento enviado · aguardando a barbearia confirmar' : 'Aguardando pagamento do Pix';
  if (pl.status === 'ativo' && pl.proximo_vencimento) {
    const dias = Math.round((new Date(pl.proximo_vencimento + 'T12:00:00') - hojeLocal()) / 864e5);
    const data = new Date(pl.proximo_vencimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    if (pl.pagamento_informado_em) return `Ativo · mensalidade enviada, aguardando confirmação`;
    if (dias < 0) return `Mensalidade vencida em ${data}`;
    if (dias <= 5) return `Ativo · mensalidade vence ${dias === 0 ? 'hoje' : 'em ' + data}`;
    return `Ativo até ${data}`;
  }
  return pl.status === 'ativo' ? 'Ativo' : pl.status;
}
function precisaPagar(pl){
  if (!pl || pl.pagamento_informado_em) return false;
  if (pl.status === 'aguardando_pagamento') return true;
  if (pl.status === 'ativo' && pl.proximo_vencimento)
    return (new Date(pl.proximo_vencimento + 'T12:00:00') - hojeLocal()) / 864e5 <= 5;
  return false;
}
function htmlMeuPlano(pl){
  return `<div class="item"><div class="ic"><i class="bi bi-gem"></i></div><div class="tx"><b>${esc(pl.nome)}</b>
    <span>${esc(situacaoPlano(pl))}</span></div>
    ${precisaPagar(pl) ? `<button class="btn btn-ouro" data-acao="pagar-plano"><i class="bi bi-qr-code"></i> Pix</button>` : ''}</div>`;
}

async function confirmarPlano(id){
  const r = await API.assinar(E.conta.token, id).catch(e => ({ erro: e.message }));
  if (r && r.sair) { salvarConta(null); fecharFolha(); E.depoisDoLogin = () => assinarPlano(id); abrirLogin(r.erro); return; }
  if (!r || r.erro) { toast(r ? r.erro : 'Não deu certo.'); return; }
  await atualizarPainel(); desenhar();
  abrirPix({ id: r.assinatura_id, nome: r.plano, preco: r.preco, status: 'aguardando_pagamento' });
}

/* ─────────────────────────────────────────────
   7. ABA CLUBE DE PONTOS
───────────────────────────────────────────── */
function htmlClube(){
  const P = E.P, recs = E.dados.recompensas, logado = !!(E.conta && E.painel);
  const saldo = logado ? E.painel.saldo : 0;
  const prox = recs.find(r => r.pontos > saldo);
  const ppr = Number(E.dados.empresa.pontos_por_real || 1);
  return `
  <h2 class="titulo-aba">${esc(P.clube_nome)}</h2>
  <p class="sub-aba">${esc(E.F.clubeConvite)}</p>
  <div class="cartao">
    <div class="marca-dagua">${P.simbolo ? `<img src="${esc(P.simbolo)}" alt="" style="height:170px;width:auto">` : COROA_SVG(150, 'transparent', P.cor)}</div>
    <div class="topo-c">
      <div><div class="clube">${esc(P.clube_nome)}</div><div class="membro">${logado ? esc(E.painel.cliente.nome) : 'Seu nome aqui'}</div></div>
      ${P.simbolo ? `<img src="${esc(P.simbolo)}" alt="" style="height:44px;width:auto">` : COROA_SVG(34, P.cor)}
    </div>
    <div class="saldo">${saldo}<small>PONTOS</small></div>
    <div class="regra">Cada ${moeda(1 / ppr).replace(',00', '')} em serviços = 1 ponto</div>
  </div>
  ${logado ? `
    ${prox ? `<div class="progresso"><div class="rot"><span>Próximo: ${esc(prox.nome)}</span><span>faltam ${prox.pontos - saldo}</span></div>
      <div class="trilho"><div style="width:${Math.min(100, Math.round(saldo / prox.pontos * 100))}%"></div></div></div>`
           : recs.length ? `<div class="progresso"><div class="rot"><span>Você já pode trocar qualquer prêmio!</span></div><div class="trilho"><div style="width:100%"></div></div></div>` : ''}
  ` : `
    <div class="caixa" style="text-align:center">
      <p style="margin-bottom:12px">Crie sua conta e cada atendimento já começa a virar ponto.</p>
      <button class="btn btn-preto btn-largo" data-acao="login">Entrar ou criar conta</button>
    </div>`}
  <div class="lista">
    <h4>Prêmios</h4>
    ${recs.length ? recs.map(r => `
    <div class="item">
      <div class="ic"><i class="bi bi-gift"></i></div>
      <div class="tx"><b>${esc(r.nome)}</b><span>${r.pontos} pontos</span></div>
      ${logado ? (saldo >= r.pontos ? `<button class="btn btn-ouro" data-trocar="${esc(r.id)}">Trocar</button>` : `<span class="pts" style="color:var(--fraco);font-weight:600;font-size:.74rem">faltam ${r.pontos - saldo}</span>`) : ''}
    </div>`).join('') : '<div class="item"><div class="tx"><span>A barbearia ainda não cadastrou prêmios.</span></div></div>'}
  </div>
  ${logado && E.painel.resgates.length ? `
  <div class="lista"><h4>Meus prêmios</h4>
    ${E.painel.resgates.map(r => `<div class="item"><div class="ic"><i class="bi bi-ticket-perforated"></i></div>
      <div class="tx"><b>${esc(r.nome)}</b><span>${r.status === 'pendente' ? 'Mostre o código no balcão' : r.status === 'usado' ? 'Usado' : 'Cancelado'}</span></div>
      <span class="codigo">${esc(r.codigo)}</span></div>`).join('')}
  </div>` : ''}
  ${logado && E.painel.extrato.length ? `
  <div class="lista"><h4>Extrato</h4>
    ${E.painel.extrato.map(m => `<div class="item"><div class="ic"><i class="bi ${m.pontos > 0 ? 'bi-scissors' : 'bi-gift'}"></i></div>
      <div class="tx"><b>${esc(m.descricao || m.tipo)}</b><span>${dataCurta(m.criado_em)}</span></div>
      <span class="pts ${m.pontos > 0 ? 'mais' : 'menos'}">${m.pontos > 0 ? '+' : ''}${m.pontos}</span></div>`).join('')}
  </div>` : ''}
  ${logado ? '<p class="aviso" style="padding:0 20px">Os pontos entram quando o atendimento é finalizado e pago na barbearia.</p>' : ''}`;
}

async function trocar(id){
  const r = E.dados.recompensas.find(x => x.id === id);
  abrirFolha(`
    <button class="fechar" data-fechar aria-label="Fechar"><i class="bi bi-x"></i></button>
    <h3>Trocar pontos</h3>
    <p>Trocar <b>${r.pontos} pontos</b> por <b>${esc(r.nome)}</b>?</p>
    <button class="btn btn-ouro btn-largo" style="margin-top:16px" data-acao="trocar-ok" data-id="${esc(id)}">Sim, quero trocar</button>`);
}
async function confirmarTroca(id){
  const r = await API.resgatar(E.conta.token, id).catch(e => ({ erro: e.message }));
  if (r && r.sair) { salvarConta(null); fecharFolha(); abrirLogin(r.erro); return; }
  if (!r || r.erro) { toast(r ? r.erro : 'Não deu certo.'); fecharFolha(); return; }
  abrirFolha(`
    <div class="sucesso">
      <div class="grande"><i class="bi bi-gift-fill"></i></div>
      <h3>Prêmio garantido!</h3>
      <p>Mostra esse código no balcão:</p>
      <div class="cod">${esc(r.codigo)}</div>
      <p class="aviso">Ele fica salvo em "Meus prêmios". Saldo agora: ${r.saldo} pontos.</p>
      <button class="btn btn-borda btn-largo" style="margin-top:12px" data-fechar>Fechar</button>
    </div>`);
  await atualizarPainel(); desenhar();
}

/* ─────────────────────────────────────────────
   8. ABA CONTA (login igual ao Beauty)
───────────────────────────────────────────── */
function htmlFormLogin(modo, msg){
  return `
  ${msg ? `<p style="margin-bottom:14px">${esc(msg)}</p>` : ''}
  <div class="alternar">
    <button data-modo="entrar" class="${modo === 'entrar' ? 'sel' : ''}">Já tenho conta</button>
    <button data-modo="criar" class="${modo === 'criar' ? 'sel' : ''}">Criar conta</button>
  </div>
  <form id="formConta" novalidate data-modo="${modo}">
    <div class="erro" id="erroConta"></div>
    ${modo === 'criar' ? `<div class="campo"><label for="cNome">Seu nome</label><input id="cNome" autocomplete="name" required maxlength="80"></div>` : ''}
    <div class="campo"><label for="cWa">WhatsApp</label><input id="cWa" type="tel" inputmode="numeric" autocomplete="tel" placeholder="(16) 99999-9999" required></div>
    <div class="campo"><label for="cSenha">Senha</label><input id="cSenha" type="password" autocomplete="${modo === 'criar' ? 'new-password' : 'current-password'}" minlength="6" required>
      ${modo === 'criar' ? '<small>Mínimo 6 caracteres.</small>' : ''}</div>
    ${modo === 'criar' ? `<div class="campo"><label for="cNasc">Aniversário <span style="font-weight:500">(opcional)</span></label><input id="cNasc" type="date"></div>` : ''}
    <button class="btn btn-preto btn-largo" type="submit">${modo === 'criar' ? 'Criar minha conta' : 'Entrar'}</button>
  </form>
  ${modo === 'entrar' ? `<p class="aviso">Esqueceu a senha? <a class="link-btn" target="_blank" rel="noopener" href="${DB.linkWa('Oi! Esqueci minha senha do app da barbearia. Pode me mandar uma nova?', E.P.whatsapp)}">Pedir pelo WhatsApp</a></p>` : ''}
  ${CONFIG.MODO_DEMO && modo === 'entrar' ? `<p class="aviso">Demonstração: entre com a conta de exemplo<br>WhatsApp <b>(11) 90000-0000</b> · senha <b>123456</b></p>` : ''}`;
}

function htmlConta(){
  if (!E.conta) return `<h2 class="titulo-aba">Minha conta</h2>
    <p class="sub-aba">Com a conta você agenda mais rápido, vê seus horários e junta pontos.</p>
    <div class="caixa" id="caixaConta">${(E.msgLogin = '', htmlFormLogin('entrar'))}</div>`;
  const p = E.painel;
  return `
  <h2 class="titulo-aba">Minha conta</h2>
  <div class="lista">
    <h4>Meus próximos horários</h4>
    ${p && p.proximos.length ? p.proximos.map(a => `<div class="item"><div class="ic"><i class="bi bi-calendar-check"></i></div>
      <div class="tx"><b>${esc(a.servico)}</b><span>${esc(dataLonga(a.inicio))} · ${hora(a.inicio)}${a.barbeiro || a.barbeiro_nome ? ' · ' + esc(a.barbeiro || a.barbeiro_nome) : ''}</span></div></div>`).join('')
      : `<div class="item"><div class="tx"><span>Nenhum horário marcado.</span></div><button class="btn btn-preto" data-ir="agendar">Agendar</button></div>`}
  </div>
  <div class="lista">
    <h4>Meu plano</h4>
    ${p && p.plano ? htmlMeuPlano(p.plano)
      : `<div class="item"><div class="tx"><span>Você ainda não tem plano.</span></div><button class="btn btn-borda" data-ir="planos">Ver planos</button></div>`}
  </div>
  <div class="lista">
    <h4>Dados</h4>
    <div class="item"><div class="ic"><i class="bi bi-person"></i></div><div class="tx"><b>${esc(E.conta.nome)}</b><span>${p ? esc(mascaraWa(p.cliente.whatsapp || '')) : ''}</span></div></div>
  </div>
  <div style="padding:6px 16px 20px"><button class="btn btn-borda btn-largo" data-acao="sair"><i class="bi bi-box-arrow-right"></i> Sair</button></div>`;
}

function abrirLogin(msg){
  E.msgLogin = msg || '';
  abrirFolha(`<button class="fechar" data-fechar aria-label="Fechar"><i class="bi bi-x"></i></button>
    <h3>Entre na sua conta</h3><div id="caixaConta">${htmlFormLogin('criar', msg)}</div>`);
}

async function enviarConta(form){
  const modo = form.dataset.modo, erro = form.querySelector('#erroConta');
  const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
  const wa = form.querySelector('#cWa').value, senha = form.querySelector('#cSenha').value;
  const r = await (modo === 'criar'
      ? API.cadastrar({ nome: form.querySelector('#cNome').value, wa, senha, nasc: form.querySelector('#cNasc').value })
      : API.entrar(wa, senha)).catch(e => ({ erro: e.message }));
  btn.disabled = false;
  if (!r || r.erro) { erro.textContent = r ? r.erro : 'Não deu certo.'; erro.classList.add('on'); return; }
  salvarConta({ token: r.token, nome: r.nome });
  await atualizarPainel();
  fecharFolha();
  const depois = E.depoisDoLogin; E.depoisDoLogin = null;
  if (!depois) toast(E.F.ola(primeiroNome(r.nome)));
  desenhar();
  if (depois) depois();
}

async function atualizarPainel(){
  if (!E.conta) { E.painel = null; return; }
  const p = await API.painel(E.conta.token).catch(() => null);
  if (p && p.sair) { salvarConta(null); E.painel = null; return; }
  if (p && !p.erro) E.painel = p;
}

/* ─────────────────────────────────────────────
   9. FOLHA (modal de baixo)
───────────────────────────────────────────── */
function abrirFolha(html){ $('#folha').innerHTML = html; $('#fundoFolha').classList.add('on'); }
function fecharFolha(){ $('#fundoFolha').classList.remove('on'); }

/* ─────────────────────────────────────────────
   10. DESENHAR + CLIQUES
───────────────────────────────────────────── */
function desenhar(){
  const corpo = { agendar: htmlAgendar, planos: htmlPlanos, clube: htmlClube, conta: htmlConta }[E.aba]();
  $('#pagina').innerHTML = htmlTopo() + corpo +
    `<div class="rodape">${esc(E.P.nome)} ${esc(E.P.tipo)} · feito com DuoTech Barber</div>`;
  document.querySelectorAll('.aba').forEach(a => a.classList.toggle('ativa', a.dataset.aba === E.aba));
}
function irPara(aba){ E.aba = aba; desenhar(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
window.TP = { E, API, desenhar, irPara, abrirFolha, fecharFolha, toast, esc, moeda };

document.addEventListener('click', async ev => {
  const el = ev.target.closest('button, [data-fechar]'); if (!el) return;
  if (ev.target === $('#fundoFolha')) { fecharFolha(); return; }
  const d = el.dataset;
  if ('fechar' in d) { fecharFolha(); return; }
  if (d.aba) { irPara(d.aba); return; }
  if (d.ir) { fecharFolha(); irPara(d.ir); return; }
  if ('barb' in d) { E.barbeiro = d.barb || null; desenhar(); if (E.dia) carregarHoras(); return; }
  if (d.cat) { E.cat = d.cat; desenhar(); return; }
  if (d.serv) {
    E.servico = E.servico === d.serv ? null : d.serv; desenhar();
    if (E.servico) {
      if (E.dia) carregarHoras();
      setTimeout(() => { const s = $('#secDia'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
    }
    return;
  }
  if (d.dia) { E.dia = d.dia; document.querySelectorAll('.dia').forEach(x => x.classList.toggle('sel', x.dataset.dia === d.dia)); carregarHoras(); return; }
  if (d.hora) { E.hora = d.hora; atualizarHoras(); return; }
  if (d.vant) { el.classList.toggle('aberto'); $('#vant-' + CSS.escape(d.vant)).classList.toggle('aberta'); return; }
  if (d.plano) { assinarPlano(d.plano); return; }
  if (d.trocar) { trocar(d.trocar); return; }
  if (d.modo) { el.closest('#caixaConta').innerHTML = htmlFormLogin(d.modo, E.msgLogin); return; }
  switch (d.acao) {
    case 'confirmar': el.disabled = true; await confirmarAgendamento(); el.disabled = false; break;
    case 'assinar-ok': el.disabled = true; await confirmarPlano(d.id); break;
    case 'trocar-ok': el.disabled = true; await confirmarTroca(d.id); break;
    case 'login': abrirLogin(); break;
    case 'pagar-plano': abrirPix(E.painel.plano); break;
    case 'copiar-pix': {
      const t = $('#pixCod').textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(
        () => { el.innerHTML = '<i class="bi bi-check2"></i> Código copiado!'; },
        () => { const r = document.createRange(); r.selectNodeContents($('#pixCod')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Segure e copie o código'); });
      break;
    }
    case 'ja-paguei': el.disabled = true; await jaPaguei(d.nome, Number(d.preco)); break;
    case 'sair': await API.sair(E.conta.token); salvarConta(null); E.painel = null; desenhar(); toast('Até a próxima!'); break;
  }
});
$('#fundoFolha').addEventListener('click', ev => { if (ev.target.id === 'fundoFolha') fecharFolha(); });
document.addEventListener('submit', ev => {
  if (ev.target.id === 'formConta') { ev.preventDefault(); enviarConta(ev.target); }
  if (ev.target.id === 'formRapido') { ev.preventDefault(); enviarRapido(ev.target); }
});
document.addEventListener('input', ev => { if (ev.target.id === 'cWa' || ev.target.id === 'rWa') ev.target.value = mascaraWa(ev.target.value); });

/* ─────────────────────────────────────────────
   11. INÍCIO
───────────────────────────────────────────── */
(async function iniciar(){
  try {
    const site = API.site ? await API.site().catch(() => null) : null;     // telas ligadas pela DuoTech
    const mod = (site && site.modulos) || {};
    if (site && site.liberada === false) throw new Error('O agendamento online está pausado no momento. Fale com a barbearia pelo WhatsApp.');
    if (mod.link === false) throw new Error('O agendamento online não está disponível. Fale com a barbearia pelo WhatsApp.');
    const dados = await API.carregar();
    if (!dados || dados.erro) throw new Error(dados ? dados.erro : 'Barbearia não encontrada.');
    E.dados = dados;
    const emp = dados.empresa;
    // personalidade: o que vem do banco (ou do painel, na demonstração)
    const nomeCompleto = String(emp.nome || '');
    const m = nomeCompleto.match(/^(.*?)\s+(Barbearia|Barber\s*Shop|Barbershop)$/i);
    const jaDiz = /barbearia|barber/i.test(nomeCompleto);             // "Barbearia do Zeca" não repete "Barbearia"
    E.P = {
      nome: m ? m[1] : nomeCompleto, tipo: m ? m[2] : (jaDiz ? '' : 'Barbearia'),
      slogan: emp.slogan, boas_vindas: emp.boas_vindas, tom_voz: emp.tom_voz || 'descontraido',
      clube_nome: emp.clube_nome || 'Clube de pontos', especialidade: emp.especialidade,
      cor: emp.cor_principal || '#C9A84C', whatsapp: emp.whatsapp || CONFIG.BARBEARIA_WA,
      instagram: emp.instagram, endereco: emp.endereco,
      logo: emp.logo_url || (CONFIG.MODO_DEMO ? lerLogo() : '') || CONFIG.LOGO || '',
      simbolo: CONFIG.SIMBOLO || '',
    };
    E.F = FALAS[E.P.tom_voz] || FALAS.descontraido;
    document.documentElement.style.setProperty('--ouro', E.P.cor);
    document.title = `${nomeCompleto} · Agende seu horário`;
    if (!dados.empresa.pontos_ativo) document.querySelector('[data-aba="clube"]').style.display = 'none';
    if (!dados.planos.length || mod.planos === false) document.querySelector('[data-aba="planos"]').style.display = 'none';
    if (mod.fidelidade === false) document.querySelector('[data-aba="clube"]').style.display = 'none';
    const aba = new URLSearchParams(location.search).get('aba');
    if (['agendar','planos','clube','conta'].includes(aba)) E.aba = aba;
    if (mod.planos === false && E.aba === 'planos') E.aba = 'agendar';
    if (mod.fidelidade === false && E.aba === 'clube') E.aba = 'agendar';
    await atualizarPainel();
    desenhar();
  } catch(e) {
    $('#pagina').innerHTML = `<div style="padding:60px 24px;text-align:center"><h2 style="font-family:var(--letreiro);text-transform:uppercase">Ops</h2>
      <p style="color:var(--texto2);margin-top:8px">${esc(e.message)}</p></div>`;
  }
})();

})();
