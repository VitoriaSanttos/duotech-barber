/* ═══════════════════════════════════════════════
   DuoTech Barber · equipe.js
   Gerenciamento de profissionais (tela Configurações).

   • Modo demonstração: grava no navegador (localStorage).
   • Modo real: login Supabase Auth + tabela `profissionais`
     (RLS: acesso_empresa(empresa_id)). O link público lê a mesma
     tabela pela função link_publico() — só aparecem os profissionais
     com ativo = true E aparece_no_link = true.
   Nenhuma chave secreta aqui: só a chave pública (anon) do config.js.
═══════════════════════════════════════════════ */
(function(){
'use strict';

const esc = DB.esc;
const REAL = () => !CONFIG.MODO_DEMO;

/* ───────── Supabase (só modo real) ───────── */
let sb = null, empresaId = null;
function carregarSDK(){
  return new Promise((ok, falha) => {
    if (window.supabase) return ok();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload = ok; s.onerror = () => falha(new Error('Não consegui carregar o Supabase. Verifique a internet.'));
    document.head.appendChild(s);
  });
}
async function cliente(){
  if (sb) return sb;
  await carregarSDK();
  sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON,
    { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'duotech-barber-painel' } });
  return sb;
}
async function obterEmpresaId(){
  if (empresaId) return empresaId;
  const c = await cliente();
  const { data, error } = await c.from('empresas').select('id').eq('slug', CONFIG.BARBEARIA_SLUG).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Sua conta não tem acesso a esta barbearia.');
  return (empresaId = data.id);
}
const paraItem = r => ({
  id: r.id, nome: r.nome, especialidade: r.especialidade || '', foto_url: r.foto_url || null,
  comissao_pct: Number(r.comissao_pct || 0), aparece_no_link: r.aparece_no_link !== false,
  ativo: r.ativo !== false, ordem: r.ordem || 0, iniciais: iniciaisProfissional(r.nome),
});
function traduzErro(e){
  const m = String(e && (e.message || e.error_description) || e || '');
  if (/row-level security|permission denied/i.test(m)) return 'Sem permissão para alterar a equipe com esta conta.';
  if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor.';
  return m || 'Erro inesperado.';
}

/* ───────── Telas ligadas e situação (definidas no painel da DuoTech) ───────── */
async function aplicarBarbearia(c){
  const { data: mb, error } = await c.rpc('minha_barbearia');
  if (error || !mb) return;                     // conta DuoTech, ou SQL da plataforma ainda não rodado
  window.BARBEARIA = mb;
  const mod = mb.modulos || {};
  Object.keys(mod).filter(k => mod[k] === false).forEach(k =>
    document.querySelectorAll(`[data-nav="${k}"]`).forEach(el => { (el.closest('li') || el).hidden = true; }));
  if (mb.liberada === false && !document.getElementById('suspenso')) {
    document.body.insertAdjacentHTML('beforeend', `<div class="suspenso" id="suspenso"><div class="suspenso-caixa">
      <i class="bi bi-pause-circle" style="font-size:2.4rem;color:var(--accent)"></i>
      <h1>Sistema pausado</h1>
      <p>O acesso da ${esc(mb.nome)} está pausado${mb.situacao === 'teste' ? ' porque o teste grátis terminou' : ''}.
        Fale com a DuoTech para liberar. Seus dados continuam guardados.</p>
      <button class="btn-modal primario" style="margin-top:14px" onclick="sairPainel()">Sair</button></div></div>`);
  }
}
window.telaLigada = t => !(window.BARBEARIA && (window.BARBEARIA.modulos || {})[t] === false);

/* ───────── Operações (mesma interface nos dois modos) ───────── */
const Equipe = {
  podeEditar: true,           // no modo real vem do perfil (admin sem profissional_id)
  async carregar(){
    if (REAL()) {
      const c = await cliente(), eid = await obterEmpresaId();
      await aplicarBarbearia(c);
      const { data: u } = await c.auth.getUser();
      const { data: perfil } = await c.from('perfis').select('tipo,profissional_id,ativo,nome,email').eq('id', u.user.id).maybeSingle();
      if (window.mostrarUsuario) mostrarUsuario((perfil && perfil.nome) || u.user.email,
        !perfil ? 'Equipe' : perfil.tipo === 'super' ? 'DuoTech' : perfil.profissional_id ? 'Barbeiro' : 'Administrador');
      Equipe.podeEditar = !!perfil && perfil.ativo !== false && (perfil.tipo === 'super' || (perfil.tipo === 'admin' && !perfil.profissional_id));
      const { data, error } = await c.from('profissionais').select('*').eq('empresa_id', eid)
        .order('ordem', { ascending: true }).order('nome', { ascending: true });
      if (error) throw error;
      window.EQUIPE = data.map(paraItem);
      await Equipe.carregarPersonalidade().catch(() => {});
    } else {
      window.EQUIPE = null;           // demonstração lê do localStorage
    }
    if (window.agendaInvalidar) window.agendaInvalidar();
    return obterBarbeiros();
  },
  async salvar(dados, id){
    if (REAL()) {
      const c = await cliente(), eid = await obterEmpresaId();
      const campos = { nome: dados.nome, especialidade: dados.especialidade || null, comissao_pct: dados.comissao_pct,
        ativo: dados.ativo, aparece_no_link: dados.aparece_no_link };
      if (dados.foto_url !== undefined) campos.foto_url = dados.foto_url;
      if (id) {
        const { error } = await c.from('profissionais').update(campos).eq('id', id).eq('empresa_id', eid);
        if (error) throw error;
      } else {
        campos.empresa_id = eid;
        campos.ordem = Math.max(0, ...obterBarbeiros().map(b => b.ordem || 0)) + 1;
        const { error } = await c.from('profissionais').insert(campos);
        if (error) throw error;
      }
    } else {
      const lista = lerEquipeLocal();
      const anterior = lista.find(b => b.id === id);
      const item = { ...(anterior || {}), ...dados, id: id || ('prof_' + Date.now()) };
      if (dados.foto_url === undefined) item.foto_url = anterior ? anterior.foto_url : null;
      item.iniciais = iniciaisProfissional(item.nome);
      if (!salvarBarbeiros(id ? lista.map(b => b.id === id ? item : b) : [...lista, item]))
        throw new Error('Armazenamento do navegador cheio. Use uma foto menor.');
    }
    return Equipe.carregar();
  },
  async excluir(id){
    if (REAL()) {
      const c = await cliente(), eid = await obterEmpresaId();
      const { error } = await c.from('profissionais').delete().eq('id', id).eq('empresa_id', eid);
      if (error) throw error;
    } else {
      salvarBarbeiros(lerEquipeLocal().filter(b => b.id !== id));
      salvarFoto(id, null);
    }
    return Equipe.carregar();
  },
};
window.Equipe = Equipe;
Equipe.sb = cliente;            // usado pela agenda ligada ao banco (js/agenda-real.js)
Equipe.eid = obterEmpresaId;

/* ───────── Personalidade (frase da casa etc.) ↔ tabela empresas ───────── */
/* O app do cliente lê estes campos pela função link_publico(). */
const nuloSeVazio = v => (String(v ?? '').trim() === '' ? null : String(v).trim());
Equipe.carregarPersonalidade = async function(){
  if (!REAL()) return;
  const c = await cliente(), eid = await obterEmpresaId();
  const { data, error } = await c.from('empresas').select(
    'nome,logo_url,slogan,boas_vindas,especialidade,tom_voz,clube_nome,cor_principal,whatsapp,instagram,pontos_por_real,pix_tipo,pix_chave,pix_nome,pix_cidade').eq('id', eid).maybeSingle();
  if (error || !data) return;
  salvarLogo(data.logo_url || null); aplicarLogoPainel();                 // logo e nome vêm do banco
  if (data.nome && !EH_THIAGO) {
    const curto = String(data.nome).replace(/^\s*barbearia\s+(d[oae]s?\s+)?/i, '').replace(/\s+barbearia\s*$/i, '').trim() || data.nome;
    document.querySelectorAll('.logo-nome').forEach(e => e.textContent = curto);
    document.title = 'Painel · ' + data.nome;
  }
  const P = lerPersonalidade();
  const nova = { ...P, slogan: data.slogan ?? P.slogan, boas_vindas: data.boas_vindas ?? P.boas_vindas,
    especialidade: data.especialidade ?? P.especialidade, tom_voz: data.tom_voz || P.tom_voz,
    clube_nome: data.clube_nome || P.clube_nome, cor: data.cor_principal || P.cor,
    whatsapp: data.whatsapp || '', instagram: data.instagram || '', pontos_por_real: Number(data.pontos_por_real) || 1,
    pix_tipo: data.pix_tipo || '', pix_chave: data.pix_chave || '', pix_nome: data.pix_nome || '', pix_cidade: data.pix_cidade || '' };
  salvarPersonalidade(nova);
  document.documentElement.style.setProperty('--accent', nova.cor);
};
Equipe.gravarPersonalidade = async function(P){
  if (!REAL()) return;
  if (!Equipe.podeEditar) throw new Error('Só o administrador altera a personalidade da barbearia.');
  const c = await cliente(), eid = await obterEmpresaId();
  const { error } = await c.from('empresas').update({
    slogan: nuloSeVazio(P.slogan), boas_vindas: nuloSeVazio(P.boas_vindas), especialidade: nuloSeVazio(P.especialidade),
    tom_voz: P.tom_voz, clube_nome: P.clube_nome, cor_principal: P.cor,
    whatsapp: nuloSeVazio(P.whatsapp), instagram: nuloSeVazio(String(P.instagram || '').replace(/^@/, '')),
    pontos_por_real: Number(P.pontos_por_real) || 1,
    pix_tipo: nuloSeVazio(P.pix_tipo), pix_chave: nuloSeVazio(P.pix_chave),
    pix_nome: nuloSeVazio(P.pix_nome) && String(P.pix_nome).slice(0, 25), pix_cidade: nuloSeVazio(P.pix_cidade) && String(P.pix_cidade).slice(0, 15),
  }).eq('id', eid);
  if (error) throw error;
};
Equipe.gravarLogo = async function(dataUrl){            // null = volta para a marca padrão
  if (!REAL()) return;
  if (!Equipe.podeEditar) throw new Error('Só o administrador troca a logo.');
  const c = await cliente(), eid = await obterEmpresaId();
  const { error } = await c.from('empresas').update({ logo_url: dataUrl || null }).eq('id', eid);
  if (error) throw error;
};
window.erroEquipe = traduzErro;

/* ───────── Login do painel (só modo real) ───────── */
Equipe.iniciar = async function(){
  if (!REAL()) { await Equipe.carregar(); return true; }
  const c = await cliente();
  const { data } = await c.auth.getSession();
  if (!data.session) return false;
  try { await Equipe.carregar(); }
  catch(e){                                  // conta sem acesso a esta barbearia: volta para o login
    await c.auth.signOut().catch(() => {});
    throw new Error(traduzErro(e));
  }
  return true;
};
window.entrarPainel = async function(ev){
  ev.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const btn = document.getElementById('login-btn'), erro = document.getElementById('login-erro');
  erro.textContent = ''; btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    const c = await cliente();
    const { error } = await c.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
    try { await Equipe.carregar(); }
    catch(e2){ await c.auth.signOut().catch(() => {}); throw e2; }   // sem acesso: não fica logado
    document.getElementById('login-painel').hidden = true;
    document.getElementById('login-senha').value = '';
    mostrarSair();
    navegar('inicio');
  } catch(e){ erro.textContent = traduzErro(e); }
  btn.disabled = false; btn.textContent = 'Entrar';
};
window.sairPainel = async function(){
  try { const c = await cliente(); await c.auth.signOut(); } catch(e){}
  window.EQUIPE = null; empresaId = null;
  location.reload();
};
function mostrarSair(){ document.querySelectorAll('[data-sair]').forEach(e => e.hidden = !REAL()); }
window.mostrarSairPainel = mostrarSair;

/* ───────── Tela: Configurações → Equipe ───────── */
function cardProfissional(b){
  const off = b.ativo === false;
  return `
  <article class="profissional-card ${off ? 'inativo' : ''}">
    <div class="profissional-topo">
      <div class="profissional-avatar">${b.foto_url ? `<img src="${esc(b.foto_url)}" alt="Foto de ${esc(b.nome)}">` : `<span>${esc(b.iniciais || iniciaisProfissional(b.nome))}</span>`}</div>
      <div class="profissional-dados">
        <strong>${esc(b.nome)}</strong>
        <span>${esc(b.especialidade || 'Sem especialidade informada')}</span>
        <div class="profissional-tags">
          <span class="badge ${off ? 'cinza' : 'verde'}">${off ? 'Inativo' : 'Ativo'}</span>
          <span class="badge ${b.aparece_no_link !== false ? 'azul' : 'cinza'}"><i class="bi ${b.aparece_no_link !== false ? 'bi-phone' : 'bi-eye-slash'}"></i> ${b.aparece_no_link !== false ? 'No app' : 'Fora do app'}</span>
          <span class="badge accent">${Number(b.comissao_pct || 0)}% comissão</span>
        </div>
      </div>
    </div>
    ${Equipe.podeEditar ? `<div class="profissional-acoes">
      <button class="plano-btn" onclick="abrirFormProfissional('${esc(b.id)}')"><i class="bi bi-pencil"></i> Editar</button>
      <button class="plano-btn" onclick="alternarProfissional('${esc(b.id)}')"><i class="bi ${off ? 'bi-toggle-off' : 'bi-toggle-on'}"></i> ${off ? 'Ativar' : 'Desativar'}</button>
      <button class="plano-btn perigo" onclick="excluirProfissional('${esc(b.id)}')" aria-label="Excluir ${esc(b.nome)}"><i class="bi bi-trash"></i> Excluir</button>
    </div>` : ''}
  </article>`;
}
TELAS.config = () => {
  const equipe = obterBarbeiros();
  const ativos = equipe.filter(b => b.ativo !== false).length;
  const noApp = equipe.filter(b => b.ativo !== false && b.aparece_no_link !== false).length;
  return `
<div class="section-header config-heading">
  <div><h2>Equipe de profissionais</h2>
    <p class="text-sm text-muted">${equipe.length} cadastrado${equipe.length === 1 ? '' : 's'} · ${ativos} ativo${ativos === 1 ? '' : 's'} · ${noApp} aparece${noApp === 1 ? '' : 'm'} no app dos clientes</p></div>
  ${Equipe.podeEditar ? '<button class="btn-topo primario btn-cadastrar" onclick="abrirFormProfissional()"><i class="bi bi-plus-lg"></i> Cadastrar profissional</button>' : ''}
</div>
${Equipe.podeEditar ? '' : '<p class="text-sm mb-16" style="background:var(--accent-m);border-radius:8px;padding:10px 12px"><i class="bi bi-lock"></i> Só o administrador pode cadastrar, editar ou excluir profissionais. Você pode apenas ver a equipe.</p>'}
<div class="config-profissionais">
  ${equipe.map(cardProfissional).join('')}
  ${equipe.length === 0 ? '<div class="empty-state">Nenhum profissional cadastrado. Toque em “Cadastrar profissional”.</div>' : ''}
</div>
<div class="section-box">
  <h3 style="font-size:.9rem;font-weight:700;margin-bottom:6px">Como funciona</h3>
  <p class="text-sm text-muted">Profissional cadastrado aqui aparece na agenda e nas comissões, <b>sem precisar de login no painel</b>.
  Para aparecer no app de agendamento do cliente, ele precisa estar <b>ativo</b> e com a opção “Exibir no app” marcada.
  ${REAL() ? 'Os dados ficam no Supabase e são os mesmos em qualquer celular ou computador.' : '<b>Modo demonstração:</b> os dados ficam só neste navegador.'}</p>
</div>`;
};

/* ───────── Formulário (folha que sobe de baixo no celular) ───────── */
let foto = { mudou: false, valor: null };      // estado da foto no formulário aberto
function htmlForm(){
  return `
  <div class="overlay" id="modal-profissional">
    <div class="modal">
      <div class="modal-topo">
        <h3 id="prof-form-titulo"><i class="bi bi-person-plus" style="color:var(--accent)"></i> Cadastrar profissional</h3>
        <button class="btn-fechar" onclick="fecharModal('modal-profissional')" aria-label="Fechar">×</button>
      </div>
      <form id="form-profissional" onsubmit="salvarProfissional(event)" novalidate>
        <input type="hidden" id="prof-id">
        <div class="prof-foto-linha">
          <div class="profissional-avatar grande" id="prof-foto-prev"></div>
          <div class="prof-foto-botoes">
            <label class="plano-btn" style="cursor:pointer"><i class="bi bi-camera"></i> <span id="prof-foto-txt">Escolher foto</span>
              <input type="file" accept="image/*" hidden onchange="escolherFotoProfissional(this)"></label>
            <button type="button" class="plano-btn" id="prof-foto-rem" onclick="removerFotoProfissional()" hidden><i class="bi bi-x-lg"></i> Remover</button>
          </div>
        </div>
        <div class="campo"><label for="prof-nome">Nome do profissional *</label>
          <input id="prof-nome" type="text" maxlength="100" placeholder="Ex.: João Silva" autocomplete="off"></div>
        <div class="campo"><label for="prof-especialidade">Especialidade</label>
          <input id="prof-especialidade" type="text" maxlength="100" placeholder="Ex.: Corte e barba"></div>
        <div class="campo"><label for="prof-comissao">Percentual de comissão (%)</label>
          <input id="prof-comissao" type="number" inputmode="decimal" min="0" max="100" step="0.01" value="0"></div>
        <label class="prof-check"><input id="prof-ativo" type="checkbox" checked>
          <span><b>Profissional ativo</b><small>Desativado, ele some da agenda e do app, mas o cadastro fica guardado.</small></span></label>
        <label class="prof-check"><input id="prof-link" type="checkbox" checked>
          <span><b>Exibir no app de agendamento</b><small>O cliente poderá escolher este profissional ao marcar horário.</small></span></label>
        <button type="submit" class="btn-modal primario" id="prof-salvar">Salvar profissional</button>
        <button type="button" class="btn-modal secundario" onclick="fecharModal('modal-profissional')">Cancelar</button>
      </form>
    </div>
  </div>`;
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modais-container')?.insertAdjacentHTML('beforeend', htmlForm());
});

function pintarFoto(nome){
  const prev = document.getElementById('prof-foto-prev');
  const url = foto.valor;
  prev.innerHTML = url ? `<img src="${esc(url)}" alt="Foto">` : `<span>${esc(iniciaisProfissional(nome || ''))}</span>`;
  document.getElementById('prof-foto-rem').hidden = !url;
  document.getElementById('prof-foto-txt').textContent = url ? 'Trocar foto' : 'Escolher foto';
}
window.abrirFormProfissional = function(id){
  if (!Equipe.podeEditar) { DB.toast('Só o administrador altera a equipe.', 'aviso'); return; }
  const b = id ? obterBarbeiros().find(x => x.id === id) : null;
  if (id && !b) return;
  document.getElementById('prof-id').value = b ? b.id : '';
  document.getElementById('prof-nome').value = b ? b.nome : '';
  document.getElementById('prof-especialidade').value = b ? (b.especialidade || '') : '';
  document.getElementById('prof-comissao').value = b ? Number(b.comissao_pct || 0) : 0;
  document.getElementById('prof-ativo').checked = b ? b.ativo !== false : true;
  document.getElementById('prof-link').checked = b ? b.aparece_no_link !== false : true;
  document.getElementById('prof-form-titulo').innerHTML = `<i class="bi ${b ? 'bi-pencil' : 'bi-person-plus'}" style="color:var(--accent)"></i> ${b ? 'Editar profissional' : 'Cadastrar profissional'}`;
  foto = { mudou: false, valor: b ? b.foto_url : null };
  pintarFoto(b ? b.nome : '');
  _abrirModal('modal-profissional');
  if (!b) setTimeout(() => document.getElementById('prof-nome').focus(), 50);
};
document.addEventListener('input', e => {
  if (e.target.id === 'prof-nome' && !foto.valor) pintarFoto(e.target.value);
});
window.escolherFotoProfissional = function(input){
  const arq = input.files && input.files[0]; input.value = '';
  if (!arq) return;
  if (!/^image\//.test(arq.type)) { DB.toast('Escolha um arquivo de imagem.', 'aviso'); return; }
  const url = URL.createObjectURL(arq), img = new Image();
  img.onload = () => {
    const lado = 256, c = document.createElement('canvas'); c.width = c.height = lado;
    const m = Math.min(img.width, img.height);
    c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
    URL.revokeObjectURL(url);
    foto = { mudou: true, valor: c.toDataURL('image/jpeg', .82) };
    pintarFoto(document.getElementById('prof-nome').value);
  };
  img.onerror = () => { URL.revokeObjectURL(url); DB.toast('Não consegui abrir essa imagem.', 'erro'); };
  img.src = url;
};
window.removerFotoProfissional = function(){
  foto = { mudou: true, valor: null };
  pintarFoto(document.getElementById('prof-nome').value);
};
window.salvarProfissional = async function(ev){
  ev.preventDefault();
  const id = document.getElementById('prof-id').value;
  const nome = document.getElementById('prof-nome').value.trim();
  const comissao = Number(String(document.getElementById('prof-comissao').value).replace(',', '.') || 0);
  if (!nome) { DB.toast('Informe o nome do profissional.', 'aviso'); document.getElementById('prof-nome').focus(); return; }
  if (!Number.isFinite(comissao) || comissao < 0 || comissao > 100) { DB.toast('A comissão deve estar entre 0 e 100%.', 'aviso'); return; }
  const dados = { nome, especialidade: document.getElementById('prof-especialidade').value.trim(),
    comissao_pct: Math.round(comissao * 100) / 100,
    ativo: document.getElementById('prof-ativo').checked, aparece_no_link: document.getElementById('prof-link').checked };
  if (foto.mudou) dados.foto_url = foto.valor;
  const btn = document.getElementById('prof-salvar'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    await Equipe.salvar(dados, id || null);
    fecharModal('modal-profissional');
    DB.toast(id ? 'Profissional atualizado!' : 'Profissional cadastrado!', 'sucesso');
    navegar('config');
  } catch(e){ DB.toast(traduzErro(e), 'erro', 5000); }
  btn.disabled = false; btn.textContent = 'Salvar profissional';
};
window.alternarProfissional = async function(id){
  const b = obterBarbeiros().find(x => x.id === id); if (!b) return;
  try {
    await Equipe.salvar({ nome: b.nome, especialidade: b.especialidade, comissao_pct: b.comissao_pct,
      aparece_no_link: b.aparece_no_link !== false, ativo: b.ativo === false }, id);
    DB.toast(b.ativo === false ? `${b.nome} ativado.` : `${b.nome} desativado.`, 'sucesso');
    navegar('config');
  } catch(e){ DB.toast(traduzErro(e), 'erro', 5000); }
};
window.excluirProfissional = async function(id){
  const b = obterBarbeiros().find(x => x.id === id); if (!b) return;
  const aviso = REAL() ? '\n\nOs agendamentos antigos dele continuam, mas ficam sem profissional. Se for só uma pausa, prefira “Desativar”.' : '';
  if (!confirm(`Excluir ${b.nome} da equipe?${aviso}`)) return;
  try { await Equipe.excluir(id); DB.toast('Profissional excluído.', 'sucesso'); navegar('config'); }
  catch(e){ DB.toast(traduzErro(e), 'erro', 5000); }
};
})();
