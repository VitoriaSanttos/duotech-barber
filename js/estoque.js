/* ═══════════════════════════════════════════════
   estoque.js · Estoque com foto de cada produto
   • Painel com login: lê e grava a tabela `produtos` do banco
     (cada barbearia só vê os dela).
   • Modo demonstração: guarda no navegador.
   A foto é reduzida no celular (máx. 360px) e guardada junto do produto.
═══════════════════════════════════════════════ */
(function(){
'use strict';
const esc = DB.esc;
const REAL = () => !CONFIG.MODO_DEMO && window.Equipe && Equipe.sb;
const CATEGORIAS = ['Produtos', 'Descartáveis', 'Higiene', 'Bebidas', 'Revenda', 'Outros'];
const UNIDADES = ['un', 'cx', 'pct', 'ml', 'L', 'g', 'kg', 'rolo'];
const num = v => { const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const qtdTxt = (v, u) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} ${esc(u || 'un')}`;

/* ───── onde ficam os produtos ───── */
const DEMO_INICIAL = [
  { nome: 'Pomada Modeladora 300g', categoria: 'Produtos', estoque_atual: 8, estoque_minimo: 3 },
  { nome: 'Lâmina Gillette Fusion', categoria: 'Descartáveis', estoque_atual: 2, estoque_minimo: 5 },
  { nome: 'Shampoo Anticaspa 1L', categoria: 'Produtos', estoque_atual: 12, estoque_minimo: 4 },
  { nome: 'Gilete Descartável (cx)', categoria: 'Descartáveis', unidade: 'cx', estoque_atual: 1, estoque_minimo: 3 },
  { nome: 'Álcool 70% 500ml', categoria: 'Higiene', estoque_atual: 6, estoque_minimo: 2 },
  { nome: 'Papel Lençol (rolo)', categoria: 'Higiene', unidade: 'rolo', estoque_atual: 4, estoque_minimo: 5 },
].map((p, i) => ({ id: 'p' + (i + 1), unidade: 'un', foto_url: null, preco_custo: null, preco_venda: null, ...p }));
const lerDemo = () => { try { const l = JSON.parse(localStorage.getItem('tp_demo_estoque') || 'null'); return Array.isArray(l) ? l : DEMO_INICIAL.slice(); } catch(e){ return DEMO_INICIAL.slice(); } };
const gravarDemo = l => { try { localStorage.setItem('tp_demo_estoque', JSON.stringify(l)); return true; } catch(e){ return false; } };

const Estoque = {
  lista: [],
  async carregar(){
    if (!REAL()) return (Estoque.lista = lerDemo());
    const c = await Equipe.sb(), eid = await Equipe.eid();
    const { data, error } = await c.from('produtos').select('*').eq('empresa_id', eid).eq('ativo', true).order('nome');
    if (error) throw error;
    return (Estoque.lista = data || []);
  },
  async salvar(dados, id){
    if (!REAL()) {
      const l = lerDemo();
      const nova = id ? l.map(p => p.id === id ? { ...p, ...dados } : p) : [...l, { id: 'p' + Date.now(), ...dados }];
      if (!gravarDemo(nova)) throw new Error('Não coube no navegador. Use uma foto menor.');
      return;
    }
    const c = await Equipe.sb(), eid = await Equipe.eid();
    const r = id ? await c.from('produtos').update(dados).eq('id', id).eq('empresa_id', eid)
                 : await c.from('produtos').insert({ ...dados, empresa_id: eid });
    if (r.error) throw r.error;
  },
  async excluir(id){
    if (!REAL()) { gravarDemo(lerDemo().filter(p => p.id !== id)); return; }
    const c = await Equipe.sb(), eid = await Equipe.eid();
    const { error } = await c.from('produtos').delete().eq('id', id).eq('empresa_id', eid);
    if (error) throw error;
  },
};
window.Estoque = Estoque;
const erro = e => (window.erroEquipe ? erroEquipe(e) : (e && e.message) || 'Não deu certo.');

/* ───── tela ───── */
const foto = (p, grande) => p.foto_url
  ? `<img src="${esc(p.foto_url)}" alt="" ${grande ? '' : 'loading="lazy"'}>`
  : `<i class="bi bi-box-seam"></i>`;
function linha(p){
  const baixo = Number(p.estoque_atual) <= Number(p.estoque_minimo || 0);
  return `<div class="estoque-item">
    <button class="estoque-foto" onclick="abrirProduto('${esc(p.id)}')" aria-label="Editar ${esc(p.nome)}">${foto(p)}</button>
    <div class="estoque-info">
      <div class="en">${esc(p.nome)}</div>
      <div class="ec">${esc(p.categoria || 'Outros')}${p.preco_venda ? ' · venda ' + DB.moeda(p.preco_venda) : ''}</div>
    </div>
    <div class="estoque-lado">
      <div class="estoque-qtd ${baixo ? 'baixo' : ''}">${qtdTxt(p.estoque_atual, p.unidade)}</div>
      ${baixo ? '<span class="badge vermelho" style="font-size:.6rem">Repor</span>' : ''}
    </div>
    <div class="estoque-acoes">
      <button class="btn-ico" onclick="mudarEstoque('${esc(p.id)}',-1)" aria-label="Tirar 1"><i class="bi bi-dash-lg"></i></button>
      <button class="btn-ico" onclick="mudarEstoque('${esc(p.id)}',1)" aria-label="Pôr 1"><i class="bi bi-plus-lg"></i></button>
      <button class="btn-ico" onclick="abrirProduto('${esc(p.id)}')" aria-label="Editar"><i class="bi bi-pencil"></i></button>
    </div>
  </div>`;
}
TELAS.estoque = async () => {
  let lista;
  try { lista = await Estoque.carregar(); }
  catch(e){ return `<div class="section-box"><b>Não consegui carregar o estoque.</b><p class="text-sm text-muted mt-8">${esc(erro(e))}</p>
    <button class="btn-topo mt-8" onclick="navegar('estoque')">Tentar de novo</button></div>`; }
  const repor = lista.filter(p => Number(p.estoque_atual) <= Number(p.estoque_minimo || 0)).length;
  return `
  <div class="section-header">
    <div><h2>Estoque</h2><p class="text-sm text-muted">${lista.length} produto${lista.length === 1 ? '' : 's'}${repor ? ` · <b style="color:var(--vermelho)">${repor} para repor</b>` : ''}</p></div>
    <button class="btn-topo primario" onclick="abrirProduto()"><i class="bi bi-plus-lg"></i> Adicionar</button>
  </div>
  <div class="section-box">
    ${lista.length ? lista.map(linha).join('')
      : `<div class="empty-state">Nenhum produto ainda. Toque em <b>Adicionar</b> e cadastre com foto.</div>`}
  </div>
  ${REAL() ? '' : '<p class="text-sm text-muted mt-8">Modo demonstração: os produtos ficam só neste navegador.</p>'}`;
};

/* ───── formulário ───── */
let fotoNova = { mudou: false, valor: null };
function htmlForm(){
  return `<div class="overlay" id="modal-produto"><div class="modal">
    <div class="modal-topo"><h3 id="prodTitulo">Adicionar produto</h3>
      <button class="btn-fechar" onclick="fecharModal('modal-produto')" aria-label="Fechar">×</button></div>
    <form id="formProduto" onsubmit="salvarProduto(event)" novalidate>
      <input type="hidden" id="prodId">
      <div class="prod-foto-linha">
        <div class="prod-foto-prev" id="prodFoto"></div>
        <div class="prod-foto-botoes">
          <label class="plano-btn" style="cursor:pointer"><i class="bi bi-camera"></i> <span id="prodFotoTxt">Pôr foto</span>
            <input type="file" accept="image/*" hidden onchange="escolherFotoProduto(this)"></label>
          <button type="button" class="plano-btn" id="prodFotoTirar" onclick="tirarFotoProduto()" hidden><i class="bi bi-x-lg"></i> Tirar foto</button>
          <small class="text-muted">Pode tirar com a câmera do celular.</small>
        </div>
      </div>
      <div class="campo"><label for="prodNome">Nome do produto *</label><input id="prodNome" maxlength="80" placeholder="Ex.: Pomada Modeladora 300g"></div>
      <div class="campo-row">
        <div class="campo"><label for="prodCat">Categoria</label><input id="prodCat" list="prodCats" maxlength="30" placeholder="Produtos">
          <datalist id="prodCats">${CATEGORIAS.map(c => `<option value="${c}">`).join('')}</datalist></div>
        <div class="campo"><label for="prodUn">Unidade</label><select id="prodUn">${UNIDADES.map(u => `<option value="${u}">${u}</option>`).join('')}</select></div>
      </div>
      <div class="campo-row">
        <div class="campo"><label for="prodQtd">Quantidade agora</label><input id="prodQtd" inputmode="decimal" placeholder="0"></div>
        <div class="campo"><label for="prodMin">Avisar quando chegar em</label><input id="prodMin" inputmode="decimal" placeholder="0"></div>
      </div>
      <div class="campo-row">
        <div class="campo"><label for="prodCusto">Preço de custo (R$)</label><input id="prodCusto" inputmode="decimal" placeholder="opcional"></div>
        <div class="campo"><label for="prodVenda">Preço de venda (R$)</label><input id="prodVenda" inputmode="decimal" placeholder="opcional"></div>
      </div>
      <button type="submit" class="btn-modal primario" id="prodSalvar">Salvar produto</button>
      <button type="button" class="btn-modal secundario" id="prodExcluir" onclick="excluirProduto(this)" hidden style="color:var(--vermelho);border-color:var(--vermelho)"><i class="bi bi-trash"></i> Excluir produto</button>
    </form></div></div>`;
}
document.addEventListener('DOMContentLoaded', () => {
  (document.getElementById('modais-container') || document.body).insertAdjacentHTML('beforeend', htmlForm());
});
const $ = id => document.getElementById(id);
const br = v => v == null || v === '' ? '' : String(Number(v)).replace('.', ',');
function pintarFoto(){
  $('prodFoto').innerHTML = fotoNova.valor ? `<img src="${esc(fotoNova.valor)}" alt="">` : '<i class="bi bi-box-seam"></i>';
  $('prodFotoTxt').textContent = fotoNova.valor ? 'Trocar foto' : 'Pôr foto';
  $('prodFotoTirar').hidden = !fotoNova.valor;
}
window.abrirProduto = function(id){
  const p = id ? Estoque.lista.find(x => x.id === id) : null;
  if (id && !p) return;
  $('prodId').value = p ? p.id : '';
  $('prodTitulo').textContent = p ? 'Editar produto' : 'Adicionar produto';
  $('prodNome').value = p ? p.nome : '';
  $('prodCat').value = p ? (p.categoria || '') : '';
  $('prodUn').value = p && UNIDADES.includes(p.unidade) ? p.unidade : 'un';
  $('prodQtd').value = p ? br(p.estoque_atual) : '';
  $('prodMin').value = p ? br(p.estoque_minimo) : '';
  $('prodCusto').value = p ? br(p.preco_custo) : '';
  $('prodVenda').value = p ? br(p.preco_venda) : '';
  $('prodExcluir').hidden = !p;
  fotoNova = { mudou: false, valor: p ? p.foto_url : null };
  pintarFoto();
  _abrirModal('modal-produto');
  if (!p) setTimeout(() => $('prodNome').focus(), 60);
};
window.escolherFotoProduto = function(input){
  const arq = input.files && input.files[0]; input.value = '';
  if (!arq) return;
  if (!/^image\//.test(arq.type)) return DB.toast('Escolha um arquivo de imagem.', 'aviso');
  const url = URL.createObjectURL(arq), img = new Image();
  img.onload = () => {
    const k = Math.min(1, 360 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    let d = c.toDataURL('image/webp', 0.82); if (!/^data:image\/webp/.test(d)) d = c.toDataURL('image/jpeg', 0.82);
    fotoNova = { mudou: true, valor: d }; pintarFoto();
  };
  img.onerror = () => { URL.revokeObjectURL(url); DB.toast('Não consegui abrir essa imagem.', 'erro'); };
  img.src = url;
};
window.tirarFotoProduto = function(){ fotoNova = { mudou: true, valor: null }; pintarFoto(); };
window.salvarProduto = async function(ev){
  ev.preventDefault();
  const nome = $('prodNome').value.trim();
  if (nome.length < 2) { DB.toast('Digite o nome do produto.', 'aviso'); $('prodNome').focus(); return; }
  const dados = { nome, categoria: $('prodCat').value.trim() || 'Outros', unidade: $('prodUn').value,
    estoque_atual: Math.max(0, num($('prodQtd').value) || 0), estoque_minimo: Math.max(0, num($('prodMin').value) || 0),
    preco_custo: num($('prodCusto').value), preco_venda: num($('prodVenda').value) };
  if (fotoNova.mudou) dados.foto_url = fotoNova.valor;
  const btn = $('prodSalvar'); btn.disabled = true; btn.textContent = 'Salvando…';
  try {
    const id = $('prodId').value || null;
    await Estoque.salvar(dados, id);
    fecharModal('modal-produto'); DB.toast(id ? 'Produto atualizado!' : 'Produto cadastrado!', 'sucesso'); navegar('estoque');
  } catch(e){ DB.toast(erro(e), 'erro', 5000); }
  btn.disabled = false; btn.textContent = 'Salvar produto';
};
window.excluirProduto = async function(btn){
  if (!btn.dataset.ok) { btn.dataset.ok = '1'; btn.innerHTML = 'Toque de novo para excluir'; setTimeout(() => { delete btn.dataset.ok; btn.innerHTML = '<i class="bi bi-trash"></i> Excluir produto'; }, 3500); return; }
  try { await Estoque.excluir($('prodId').value); fecharModal('modal-produto'); DB.toast('Produto excluído.', 'sucesso'); navegar('estoque'); }
  catch(e){ DB.toast(erro(e), 'erro', 5000); }
};
window.mudarEstoque = async function(id, d){
  const p = Estoque.lista.find(x => x.id === id); if (!p) return;
  const novo = Math.max(0, Number(p.estoque_atual || 0) + d);
  try { await Estoque.salvar({ estoque_atual: novo }, id); navegar('estoque'); }
  catch(e){ DB.toast(erro(e), 'erro', 5000); }
};
})();
