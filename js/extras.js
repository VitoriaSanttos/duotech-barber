/* ═══════════════════════════════════════════════
   DuoTech Barber · extras.js  (versão 13)
   O que é do jeito de cada barbearia, no app do cliente:
   - tema claro / escuro (botão de sol e lua no topo)
   - atalhos: prótese capilar, visagismo, cursos, produtos
   - conta "quantas vezes você corta por mês" nos planos
   Liga e desliga por CONFIG.EXTRAS no config.js.
═══════════════════════════════════════════════ */
(function(){
'use strict';

const CHAVE_TEMA = 'tp_tema';
const X = Object.assign({ protese: true, visagismo: false, cursos: false, produtos: true }, window.CONFIG && CONFIG.EXTRAS || {});
let produtos = null;          // lista vinda do estoque (só o que tem preço de venda)
let vezes = 2;                // conta dos planos

function temaAtual(){ try { return localStorage.getItem(CHAVE_TEMA) || 'escuro'; } catch(e){ return 'escuro'; } }
function aplicarTema(t){
  document.documentElement.dataset.tema = t;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'claro' ? '#f4f4f2' : '#0b0b0b');
}
aplicarTema(temaAtual());

const esc = s => DB.esc(s);
const moeda = v => DB.moeda(v);
const T = () => window.TP;
const wa = msg => DB.linkWa(msg, (T() && T().E.P && T().E.P.whatsapp) || CONFIG.BARBEARIA_WA);
const nomeBarb = () => (T() && T().E.P && T().E.P.nome) || 'barbearia';
const acharServ = re => ((T() && T().E.dados && T().E.dados.servicos) || []).filter(s => re.test(s.nome));

/* ── cursos de cada barbearia (CONFIG.CURSOS) ── */
const CURSOS = (window.CONFIG && CONFIG.CURSOS) || [];

/* ─────────────────────────────────────────────
   O QUE APARECE NAS TELAS
───────────────────────────────────────────── */
function botaoTema(){
  const claro = temaAtual() === 'claro';
  return `<button class="atalho" data-x="tema" aria-label="${claro ? 'Usar tema escuro' : 'Usar tema claro'}"><i class="bi bi-${claro ? 'moon-stars' : 'sun'}"></i></button>`;
}

function htmlMais(){
  const itens = [];
  if (X.protese && acharServ(/pr[oó]tese/i).length) itens.push(['protese', 'bi-stars', 'Prótese capilar', 'Avaliação e manutenção']);
  if (X.visagismo) itens.push(['visagismo', 'bi-person-bounding-box', 'Visagismo', 'O corte certo pro seu rosto']);
  if (X.cursos && CURSOS.length) itens.push(['cursos', 'bi-mortarboard', 'Cursos', 'Para barbeiros']);
  if (X.produtos && produtos && produtos.length) itens.push(['produtos', 'bi-bag', 'Produtos', 'Reserve e retire aqui']);
  if (!itens.length) return '';
  return `
  <section class="secao mais">
    <div class="mais-grade">
      ${itens.map(([k, ic, t, s]) => `<button class="mais-item" data-x="${k}"><i class="bi ${ic}"></i><b>${t}</b><span>${s}</span></button>`).join('')}
    </div>
  </section>`;
}

function htmlCalc(){
  const S = (T().E.dados && T().E.dados.servicos) || [];
  const P = (T().E.dados && T().E.dados.planos) || [];
  const corte = S.find(s => /^corte$/i.test(s.nome.trim())) || S.find(s => s.categoria === 'corte');
  const plano = P.find(p => /corte/i.test(p.nome) && /ilimit/i.test(p.nome)) || P.slice().sort((a, b) => b.preco - a.preco)[0];
  if (!corte || !plano) return '';
  const avulso = vezes * Number(corte.preco), mensal = Number(plano.preco), dif = avulso - mensal;
  const barato = P.filter(p => Number(p.preco) < Number(corte.preco) * 1.2).sort((a, b) => a.preco - b.preco)[0];
  const res = dif > 0 ? `Você economiza <b>${moeda(dif)}</b> por mês com o plano.`
    : dif === 0 ? 'Empata com o avulso, e cada corte a mais já é economia.'
    : (barato ? `Com ${vezes} corte${vezes > 1 ? 's' : ''} por mês, o plano <b>${esc(barato.nome)}</b> (${moeda(barato.preco)}) sai melhor.` : 'Com poucos cortes por mês, o avulso ainda compensa.');
  return `
  <div class="calc">
    <b>Quantas vezes você corta por mês?</b>
    <div class="calc-op">${[1, 2, 3, 4].map(n => `<button class="${n === vezes ? 'sel' : ''}" data-x="vezes" data-n="${n}">${n === 4 ? '4+' : n}</button>`).join('')}</div>
    <div class="calc-l"><span>Avulso (${moeda(corte.preco)} cada)</span><span>${moeda(avulso)}</span></div>
    <div class="calc-l"><span>${esc(plano.nome)}</span><span>${moeda(mensal)}</span></div>
    <div class="calc-r ${dif > 0 ? 'ok' : ''}">${res}</div>
  </div>`;
}

/* ─────────────────────────────────────────────
   FOLHAS (sobem de baixo)
───────────────────────────────────────────── */
const fechar = '<button class="fechar" data-fechar aria-label="Fechar"><i class="bi bi-x"></i></button>';

function folhaProtese(){
  const ap = acharServ(/pr[oó]tese/i).find(s => !/manuten/i.test(s.nome));
  const mn = acharServ(/manuten.*pr[oó]tese|pr[oó]tese.*manuten/i)[0];
  const dur = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`;
  T().abrirFolha(`${fechar}
    <h3>Prótese capilar</h3>
    <p>Cabelo de volta, com naturalidade. Feito por quem é especialista no assunto.</p>
    <ol class="passos-x">
      <li><b>Avaliação</b><span>Conversa para escolher fio, cor e formato.</span></li>
      ${ap ? `<li><b>Aplicação · ${moeda(ap.preco)}</b><span>Cerca de ${dur(ap.duracao_min)}, com corte e acabamento.</span></li>` : ''}
      ${mn ? `<li><b>Manutenção · ${moeda(mn.preco)}</b><span>${dur(mn.duracao_min)}. A barbearia avisa quando chegar a hora.</span></li>` : ''}
    </ol>
    <a class="btn btn-ouro btn-largo" target="_blank" rel="noopener" href="${wa('Oi! Vim pelo app e quero agendar uma avaliação de prótese capilar.')}"><i class="bi bi-whatsapp"></i> Quero uma avaliação</a>
    ${mn ? `<button class="btn btn-contorno btn-largo" style="margin-top:10px" data-x="agendar-serv" data-id="${esc(mn.id)}">Já uso: agendar manutenção</button>` : ''}`);
}

function folhaVisagismo(){
  T().abrirFolha(`${fechar}
    <h3>Visagismo</h3>
    <p>O corte e a barba certos para o formato do seu rosto, o seu tipo de fio e o seu estilo de vida.</p>
    <ol class="passos-x">
      <li><b>Conversa</b><span>Sua rotina, o que você gosta e o que não gosta.</span></li>
      <li><b>Leitura do rosto</b><span>Formato, proporções e tipo de fio.</span></li>
      <li><b>Indicação</b><span>Corte e barba pensados para você, anotados na sua ficha.</span></li>
    </ol>
    <a class="btn btn-ouro btn-largo" target="_blank" rel="noopener" href="${wa('Oi! Vim pelo app e quero saber sobre o visagismo.')}"><i class="bi bi-whatsapp"></i> Quero saber mais</a>`);
}

function folhaCursos(){
  T().abrirFolha(`${fechar}
    <h3>Cursos e workshops</h3>
    <p>Para barbeiros que querem aprender com quem está há anos no ramo. Entre na lista e seja avisado quando abrir turma.</p>
    <div class="cursos-x">
      ${CURSOS.map(c => `
      <div class="curso-x">
        <b>${esc(c.nome)}</b>
        ${c.desc ? `<span>${esc(c.desc)}</span>` : ''}
        <small>${esc(c.quando || 'Próxima turma em breve')}</small>
        <a class="btn btn-contorno" target="_blank" rel="noopener" href="${wa(`Oi! Quero entrar na lista do curso "${c.nome}".`)}">Quero ser avisado</a>
      </div>`).join('')}
    </div>`);
}

function folhaProdutos(){
  T().abrirFolha(`${fechar}
    <h3>Produtos</h3>
    <p>Reserve pelo WhatsApp e retire no seu próximo horário.</p>
    <div class="produtos-x">
      ${(produtos || []).map(p => `
      <div class="produto-x">
        <div class="foto">${p.foto_url ? `<img src="${esc(p.foto_url)}" alt="">` : '<i class="bi bi-bag"></i>'}</div>
        <b>${esc(p.nome)}</b>
        <span class="preco">${moeda(p.preco)}</span>
        ${p.disponivel ? `<a class="btn btn-ouro" target="_blank" rel="noopener" href="${wa(`Oi! Quero reservar: ${p.nome}.`)}">Reservar</a>`
                        : '<span class="esgotado">Em falta</span>'}
      </div>`).join('')}
    </div>`);
}

/* ─────────────────────────────────────────────
   CLIQUES
───────────────────────────────────────────── */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-x]'); if (!el || !T()) return;
  const k = el.dataset.x;
  if (k === 'tema') { const novo = temaAtual() === 'claro' ? 'escuro' : 'claro'; try { localStorage.setItem(CHAVE_TEMA, novo); } catch(e){} aplicarTema(novo); T().desenhar(); return; }
  if (k === 'vezes') { vezes = Number(el.dataset.n); const c = document.querySelector('.calc'); if (c) c.outerHTML = htmlCalc(); return; }
  if (k === 'protese') return folhaProtese();
  if (k === 'visagismo') return folhaVisagismo();
  if (k === 'cursos') return folhaCursos();
  if (k === 'produtos') return folhaProdutos();
  if (k === 'agendar-serv') { const E = T().E; E.servico = el.dataset.id; E.cat = 'todos'; T().fecharFolha(); T().irPara('agendar');
    setTimeout(() => { const s = document.getElementById('secDia'); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200); return; }
});

/* produtos: carrega depois que o app abriu */
(function esperar(n){
  if (window.TP && TP.E.dados) {
    if (!X.produtos) return;
    TP.API.produtos().then(lista => { produtos = (lista || []).filter(p => Number(p.preco) > 0); if (produtos.length && TP.E.aba === 'agendar') TP.desenhar(); });
    return;
  }
  if (n < 120) setTimeout(() => esperar(n + 1), 250);
})(0);

window.TPX = { botaoTema, htmlMais, htmlCalc, temaAtual };
})();
