/* ═══════════════════════════════════════════════
   DuoTech Barber · academia.js
   ACADEMIA: cursos de parceiros (barbeiros e empresários),
   trilha de fé (Cristo na barbearia), encontro ao vivo e
   "Como configurar" o DuoTech, com botão que abre a tela certa.

   Tipos de aula:
     video      → vídeo do parceiro (YouTube/Vimeo, campo video = id do YouTube)
     devocional → texto: versículo, reflexão e oração (vem de PALAVRAS, fe.js)
     guia       → passo a passo do sistema, com atalho para a tela
   Cursos de parceiros e mentores abaixo são EXEMPLOS de vitrine.
   Progresso no modo demonstração: tp_demo_academia.
═══════════════════════════════════════════════ */

const ACAD_CATEGORIAS = {
  fe:       {nome:'Fé e propósito',      ico:'bi-book',          cores:['#2b2410','#c9a84c']},
  config:   {nome:'Como configurar',     ico:'bi-gear',          cores:['#0f1c2e','#3d7bd6']},
  gestao:   {nome:'Gestão e lucro',      ico:'bi-graph-up-arrow',cores:['#10241a','#2e9e5b']},
  tecnica:  {nome:'Técnica',             ico:'bi-scissors',      cores:['#241018','#c2416b']},
  atend:    {nome:'Atendimento',         ico:'bi-emoji-smile',   cores:['#1d1430','#7c5cd6']},
};

const _guia = (titulo, dur, tela, passos) => ({titulo, dur, tipo:'guia', tela, passos});
const _aula = (titulo, dur) => ({titulo, dur, tipo:'video', video:''});

const CURSOS = [
  {id:'c-config', categoria:'config', titulo:'Primeiros passos no DuoTech', sub:'Deixe a barbearia pronta em uma tarde', mentor:'Equipe DuoTech', aulas:[
    _guia('A cara da sua barbearia', '4 min', 'personalizar', [
      'Abra Configurar > Personalidade.',
      'Escreva o nome no letreiro, a frase da casa e o recado de boas-vindas.',
      'Escolha o jeito de falar: Descontraído, Clássico ou Premium. Ele muda o app do cliente inteiro.',
      'Confira a prévia do app do cliente antes de salvar.']),
    _guia('Chave Pix da barbearia', '3 min', 'personalizar', [
      'Em Personalidade, preencha o tipo da chave, a chave, o nome de quem recebe e a cidade.',
      'Sem chave cadastrada, o app manda o cliente pedir o Pix no WhatsApp.',
      'Faça um Pix de teste de R$ 1,00 antes de divulgar.']),
    _guia('Equipe e fotos', '3 min', 'config', [
      'Abra Configurar > Configurações (Equipe de profissionais).',
      'Coloque a foto de cada barbeiro. Ela aparece no app do cliente.',
      'Confira a especialidade de cada um.']),
    _guia('Planos Gold', '5 min', 'cadastros', [
      'Abra Gestão > Cadastros > Planos.',
      'Revise preço, vagas e o selo de "Mais vendido". O Pix dos planos se confere em Programa > Planos Gold.',
      'Em Lucro real, confira quanto sobra em cada plano antes de mudar o preço.']),
    _guia('Link do app do cliente', '2 min', 'link', [
      'Abra Programa > App do cliente.',
      'Copie o link e coloque na bio do Instagram e na mensagem automática do WhatsApp.']),
    _guia('Abrir e fechar o caixa', '4 min', 'caixa', [
      'Toda manhã: Operação > Caixa > Abrir caixa, com o troco da gaveta.',
      'Cada Fechar Atendimento entra no caixa sozinho. Despesas e vales entram em Nova saída.',
      'No fim do dia: conte o dinheiro da gaveta e feche. O sistema mostra se bateu.']),
    _guia('Meta do mês', '5 min', 'meta', [
      'Abra Inteligência > Meta do mês > Configurar a meta.',
      'Digite a meta geral. O sistema tira as assinaturas e mostra quanto precisa vir de comanda.',
      'Ligue a premiação da equipe e, se quiser, a Meta com propósito.',
      'Use o Modo TV na TV da barbearia e mande a imagem no grupo da equipe.']),
    _guia('Ligar a fé no sistema', '3 min', 'proposito', [
      'Abra Propósito > Palavra do dia.',
      'Ligue ou desligue a Palavra do dia e o Momento da equipe no painel.',
      'Escolha se o lembrete do WhatsApp vai com a palavra do dia e se o fechamento do caixa lembra o dízimo.']),
  ]},
  {id:'c-fe', categoria:'fe', titulo:'Cristo na cadeira', sub:'7 devocionais de 5 minutos para começar o dia', mentor:'Equipe DuoTech', aulas:
    PALAVRAS.slice(0,7).map((p,i)=>({titulo:`Dia ${i+1} · ${p.ref}`, dur:'5 min', tipo:'devocional', palavra:p}))},
  {id:'c-fe2', categoria:'fe', titulo:'Barbearia com propósito', sub:'Liderar a equipe com princípios do Reino', mentor:'Mentor parceiro (exemplo)', aulas:[
    _aula('Por que a sua barbearia existe', '18 min'), _aula('Liderar servindo', '22 min'),
    _aula('Dinheiro, dízimo e generosidade no negócio', '25 min'), _aula('Como falar de fé sem constranger o cliente', '16 min')]},
  {id:'c-gestao', categoria:'gestao', titulo:'Lucro de verdade', sub:'Preço, margem e ponto de equilíbrio sem planilha', mentor:'Mentor parceiro (exemplo)', aulas:[
    _aula('Quanto sobra em cada corte', '14 min'), _aula('Precificar planos sem perder dinheiro', '21 min'),
    _aula('Meta do mês que a equipe entende', '17 min'), _aula('Custos fixos: o que cortar e o que não cortar', '19 min')]},
  {id:'c-tecnica', categoria:'tecnica', titulo:'Prótese capilar do zero', sub:'Da avaliação à manutenção', mentor:'Thiago Prado (exemplo)', aulas:[
    _aula('Avaliação e indicação', '20 min'), _aula('Medidas e molde', '26 min'), _aula('Aplicação passo a passo', '38 min'),
    _aula('Manutenção e retorno do cliente', '22 min'), _aula('Como cobrar e vender o tratamento', '15 min')]},
  {id:'c-atend', categoria:'atend', titulo:'Atendimento que fideliza', sub:'Da recepção ao pós-venda', mentor:'Mentor parceiro (exemplo)', aulas:[
    _aula('Os primeiros 30 segundos', '12 min'), _aula('Vender plano sem empurrar', '18 min'), _aula('Recuperar o cliente que sumiu', '15 min')]},
].map(c=>({...c, aulas:c.aulas.map((a,i)=>({...a, id:`${c.id}-${i+1}`}))}));

/* Encontro ao vivo semanal (terça, 08:00) */
const AO_VIVO = {titulo:'Café com Propósito', sub:'Devocional e conversa de negócios para barbeiros', dia:2, hora:8, mentor:'Equipe DuoTech'};

function lerAcad(){ try { return {assistidas:{}, favoritos:[], presenca:'', ...JSON.parse(localStorage.getItem('tp_demo_academia')||'{}')}; } catch(e){ return {assistidas:{}, favoritos:[], presenca:''}; } }
function salvarAcad(a){ try { localStorage.setItem('tp_demo_academia', JSON.stringify(a)); } catch(e){} }
function progressoCurso(c, a=lerAcad()){ const f = c.aulas.filter(x=>a.assistidas[x.id]).length; return {feitas:f, pct: Math.round(f/c.aulas.length*100)}; }
function proximoAoVivo(){
  const d = new Date(); d.setHours(AO_VIVO.hora,0,0,0);
  let n = (AO_VIVO.dia - d.getDay() + 7) % 7; if(n===0 && new Date() > d) n = 7;
  d.setDate(d.getDate()+n); return d;
}

function capaCurso(c, grande=false){
  const cat = ACAD_CATEGORIAS[c.categoria];
  return `<div class="acad-capa ${grande?'grande':''}" style="--c1:${cat.cores[0]};--c2:${cat.cores[1]}">
    <span class="acad-capa-cat"><i class="bi ${cat.ico}"></i> ${cat.nome}</span>
    <strong>${c.titulo}</strong>
    <span class="acad-capa-n">${c.aulas.length} ${c.aulas[0].tipo==='devocional'?'devocionais':c.aulas[0].tipo==='guia'?'guias':'aulas'}</span>
  </div>`;
}
function cardCurso(c){
  const a = lerAcad(), p = progressoCurso(c, a), fav = a.favoritos.includes(c.id);
  return `<div class="acad-card" onclick="navegar('academia',{curso:'${c.id}'})" role="button" tabindex="0">
    ${capaCurso(c)}
    <button class="acad-fav ${fav?'on':''}" aria-label="Favoritar" onclick="event.stopPropagation();_acadFav('${c.id}')"><i class="bi ${fav?'bi-heart-fill':'bi-heart'}"></i></button>
    <div class="acad-card-info"><strong>${c.titulo}</strong><span>${c.mentor}</span>
      ${p.feitas ? `<div class="acad-prog"><div style="width:${p.pct}%"></div></div><small>${p.pct}% concluído</small>` : `<small class="text-muted">${c.sub}</small>`}</div>
  </div>`;
}
const linhaCursos = (titulo, lista, ico='') => lista.length ? `
  <div class="acad-linha-tit">${ico?`<i class="bi ${ico}"></i>`:''}<strong>${titulo}</strong></div>
  <div class="acad-linha">${lista.map(cardCurso).join('')}</div>` : '';

/* ─── TELA ─── */
TELAS.academia = (params={})=>{
  window._paramsAcad = params;
  if(params.curso) return telaCurso(params);
  const a = lerAcad(), f = lerFe(), busca = (params.q||'').toLowerCase();
  const prox = proximoAoVivo(), conf = a.presenca === prox.toISOString();
  const emAndamento = CURSOS.filter(c=>{ const p = progressoCurso(c,a); return p.feitas>0 && p.pct<100; });
  const filtrados = busca ? CURSOS.filter(c=>(c.titulo+' '+c.sub+' '+c.mentor+' '+c.aulas.map(x=>x.titulo).join(' ')).toLowerCase().includes(busca)) : null;
  const cats = params.cat ? [params.cat] : Object.keys(ACAD_CATEGORIAS);
  const visiveis = c => f.fe_ativa || c.categoria!=='fe';
  return `
<div class="acad-busca"><i class="bi bi-search"></i>
  <input type="search" placeholder="Buscar curso, aula ou assunto" value="${DB.esc(params.q||'')}" onkeydown="if(event.key==='Enter')navegar('academia',{q:this.value})">
</div>

${!busca ? `<div class="acad-live">
  <div class="acad-live-tag"><span></span> Próximo ao vivo · ${prox.toLocaleDateString('pt-BR',{weekday:'long', day:'2-digit', month:'2-digit'})} · ${String(AO_VIVO.hora).padStart(2,'0')}:00</div>
  <h2>${AO_VIVO.titulo}</h2>
  <p>${AO_VIVO.sub}</p>
  <div class="acad-live-cont">Começa em <strong id="acad-cont">${_contagem(prox)}</strong></div>
  <div class="fe-acoes">
    <button class="fe-btn ${conf?'':'claro'}" onclick="_acadPresenca('${prox.toISOString()}')">${conf?'<i class="bi bi-check2"></i> Presença confirmada':'Confirmar presença'}</button>
    <button class="fe-btn" onclick="DB.toast('O link da sala aparece aqui 10 minutos antes de começar','info')">Ver sala</button>
  </div>
</div>` : ''}

${busca ? `<div class="acad-linha-tit"><strong>${filtrados.length} resultado${filtrados.length===1?'':'s'} para “${DB.esc(params.q)}”</strong><a onclick="navegar('academia')">limpar</a></div>
  <div class="acad-grade">${filtrados.map(cardCurso).join('') || '<p class="text-muted">Nada encontrado. Tente outra palavra.</p>'}</div>` : `
${linhaCursos('Continuar assistindo', emAndamento.filter(visiveis), 'bi-clock-history')}
<div class="acad-linha-tit"><strong>Categorias</strong></div>
<div class="acad-cats">
  ${Object.entries(ACAD_CATEGORIAS).filter(([k])=>f.fe_ativa||k!=='fe').map(([k,c])=>`
    <button class="acad-cat ${params.cat===k?'ativa':''}" style="--c1:${c.cores[0]};--c2:${c.cores[1]}" onclick="navegar('academia',${params.cat===k?'{}':`{cat:'${k}'}`})"><i class="bi ${c.ico}"></i>${c.nome}</button>`).join('')}
</div>
${cats.map(k=>linhaCursos(ACAD_CATEGORIAS[k].nome, CURSOS.filter(c=>c.categoria===k && visiveis(c)))).join('')}
<div class="acad-parceiro">
  <div><strong>Você é barbeiro ou empresário e quer ensinar aqui?</strong>
  <p>Mande a sua ideia de curso. A equipe DuoTech avalia, grava junto e publica para as barbearias da rede.</p></div>
  <button class="btn-topo primario" onclick="abrirParceiro()"><i class="bi bi-camera-video"></i> Quero ser parceiro</button>
</div>`}`;
};

function telaCurso(params){
  const c = CURSOS.find(x=>x.id===params.curso);
  if(!c) return '<p class="text-muted">Curso não encontrado.</p>';
  const a = lerAcad(), p = progressoCurso(c, a);
  const aula = c.aulas.find(x=>x.id===params.aula) || c.aulas.find(x=>!a.assistidas[x.id]) || c.aulas[0];
  const idx = c.aulas.indexOf(aula), prox = c.aulas[idx+1];
  let corpo = '';
  if(aula.tipo==='video') corpo = aula.video
    ? `<div class="acad-video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(aula.video)}" title="${DB.esc(aula.titulo)}" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`
    : `<div class="acad-video vazio"><i class="bi bi-play-circle"></i><span>O vídeo desta aula entra quando o parceiro publicar.</span></div>`;
  else if(aula.tipo==='devocional') corpo = `
    <div class="acad-devo">
      <blockquote>“${aula.palavra.texto}”</blockquote><div class="fe-ref">${aula.palavra.ref}</div>
      <h4>Para pensar</h4><p>${aula.palavra.reflexao}</p>
      <h4>Para praticar hoje</h4><p>Escolha um cliente de hoje e atenda pensando nesta palavra. Antes de fechar o caixa, lembre como foi.</p>
      <h4>Oração</h4><p class="acad-oracao">${aula.palavra.oracao}</p>
    </div>`;
  else corpo = `
    <div class="acad-guia">
      <ol>${aula.passos.map(x=>`<li>${x}</li>`).join('')}</ol>
      <button class="btn-topo primario" onclick="navegar('${aula.tela}')"><i class="bi bi-box-arrow-up-right"></i> Abrir ${TITULOS[aula.tela]||'a tela'}</button>
    </div>`;
  return `
<a class="acad-voltar" onclick="navegar('academia')"><i class="bi bi-chevron-left"></i> Academia</a>
<div class="acad-curso">
  <div class="acad-curso-main">
    ${capaCurso(c, true)}
    <div class="acad-aula-tit"><small>Aula ${idx+1} de ${c.aulas.length} · ${aula.dur}</small><h2>${aula.titulo}</h2></div>
    ${corpo}
    <div class="acad-aula-acoes">
      <button class="btn-topo ${a.assistidas[aula.id]?'':'primario'}" onclick="_acadConcluir('${c.id}','${aula.id}',${prox?`'${prox.id}'`:'null'})">
        ${a.assistidas[aula.id] ? '<i class="bi bi-check2-circle"></i> Concluída' : '<i class="bi bi-check2"></i> Marcar como concluída'}</button>
      ${prox ? `<button class="btn-topo" onclick="navegar('academia',{curso:'${c.id}',aula:'${prox.id}'})">Próxima aula <i class="bi bi-chevron-right"></i></button>` : ''}
    </div>
  </div>
  <aside class="section-box acad-aulas">
    <strong>${c.titulo}</strong><span class="text-muted text-sm">${c.mentor}</span>
    <div class="acad-prog" style="margin:10px 0 4px"><div style="width:${p.pct}%"></div></div><small class="text-muted">${p.feitas} de ${c.aulas.length} concluídas</small>
    <div class="mt-8">${c.aulas.map((x,i)=>`
      <button class="acad-aula ${x.id===aula.id?'atual':''}" onclick="navegar('academia',{curso:'${c.id}',aula:'${x.id}'})">
        <span class="acad-aula-n ${a.assistidas[x.id]?'ok':''}">${a.assistidas[x.id]?'<i class="bi bi-check"></i>':i+1}</span>
        <span>${x.titulo}<small>${x.dur}</small></span></button>`).join('')}</div>
  </aside>
</div>`;
}

/* ─── AÇÕES ─── */
function _contagem(d){
  const s = Math.max(0, Math.floor((d - new Date())/1000));
  const dd = Math.floor(s/86400), hh = Math.floor(s%86400/3600), mm = Math.floor(s%3600/60), ss = s%60;
  return `${dd?dd+'d ':''}${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
setInterval(()=>{ const el = document.getElementById('acad-cont'); if(el) el.textContent = _contagem(proximoAoVivo()); }, 1000);

function _acadFav(id){ const a = lerAcad(); a.favoritos = a.favoritos.includes(id) ? a.favoritos.filter(x=>x!==id) : [...a.favoritos, id]; salvarAcad(a); navegar('academia', window._paramsAcad||{}); }
function _acadPresenca(iso){ const a = lerAcad(); a.presenca = a.presenca===iso ? '' : iso; salvarAcad(a);
  DB.toast(a.presenca ? 'Presença confirmada. Te esperamos!' : 'Presença desmarcada', a.presenca?'sucesso':'info'); navegar('academia', window._paramsAcad||{}); }
function _acadConcluir(curso, aula, prox){
  const a = lerAcad(); a.assistidas[aula] = !a.assistidas[aula]; salvarAcad(a);
  const c = CURSOS.find(x=>x.id===curso);
  if(a.assistidas[aula] && progressoCurso(c,a).pct===100) DB.toast('Curso concluído! Parabéns.','sucesso');
  navegar('academia', a.assistidas[aula] && prox ? {curso, aula:prox} : {curso, aula});
  window.scrollTo(0,0);
}

function abrirParceiro(){
  _modalCaixa(`
    ${_topoModal('bi-camera-video','var(--accent-d)','Quero ser parceiro')}
    <p class="text-muted text-sm mb-16">Conte quem você é e o que quer ensinar. A equipe DuoTech entra em contato.</p>
    <div class="campo"><label>Seu nome</label><input id="pc-nome" maxlength="60"></div>
    <div class="campo"><label>WhatsApp</label><input id="pc-whats" inputmode="tel" maxlength="20" placeholder="(11) 90000-0000"></div>
    <div class="campo"><label>Área</label><select id="pc-cat">${Object.entries(ACAD_CATEGORIAS).filter(([k])=>k!=='config').map(([k,c])=>`<option value="${k}">${c.nome}</option>`).join('')}</select></div>
    <div class="campo"><label>Ideia do curso</label><textarea id="pc-ideia" rows="3" maxlength="400" placeholder="Ex.: degradê navalhado em 5 aulas"></textarea></div>
    <button class="btn-modal primario" onclick="_enviarParceiro()"><i class="bi bi-send"></i> Enviar</button>
    <button class="btn-modal secundario" onclick="fecharModal('modal-caixa')">Cancelar</button>`);
}
function _enviarParceiro(){
  const nome = document.getElementById('pc-nome').value.trim(), whats = document.getElementById('pc-whats').value.trim(), ideia = document.getElementById('pc-ideia').value.trim();
  if(!nome || !whats || !ideia){ DB.toast('Preencha nome, WhatsApp e a ideia do curso','erro'); return; }
  try { const l = JSON.parse(localStorage.getItem('tp_demo_parceiros')||'[]'); l.push({nome, whats, cat:document.getElementById('pc-cat').value, ideia, quando:new Date().toISOString()}); localStorage.setItem('tp_demo_parceiros', JSON.stringify(l)); } catch(e){}
  fecharModal('modal-caixa'); DB.toast('Recebemos a sua ideia. Obrigado!','sucesso');
}
