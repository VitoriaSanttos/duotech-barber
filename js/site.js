/* ═══════════════════════════════════════════════
   DuoTech Barber · site.js
   Site de apresentação (site.html) e link da bio (bio.html).
   Serviços, planos, equipe, endereço e horários vêm do sistema:
   o que a barbearia muda no painel aparece aqui sozinho.
═══════════════════════════════════════════════ */
(function(){
'use strict';
const esc = DB.esc, moeda = DB.moeda;
const $ = s => document.querySelector(s);
const SEM = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

async function carregar(){
  if (CONFIG.MODO_DEMO) return null;
  await new Promise((ok, falha) => {
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload = ok; s.onerror = falha; document.head.appendChild(s);
  });
  const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc('link_publico', { p_slug: CONFIG.BARBEARIA_SLUG });
  if (error || !data || data.erro) return null;
  return data;
}

const dur = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}` : `${m} min`;
const preco = s => (s.preco_a_partir ? 'a partir de ' : '') + moeda(s.preco).replace(',00', '');
const wa = (msg, num) => DB.linkWa(msg, num || CONFIG.BARBEARIA_WA);

function encher(d){
  const emp = d.empresa || {};
  const num = emp.whatsapp || CONFIG.BARBEARIA_WA;
  document.querySelectorAll('[data-wa]').forEach(a => { a.href = wa(a.dataset.wa || 'Oi! Vim pelo site da barbearia.', num); });
  document.querySelectorAll('[data-endereco]').forEach(el => { if (emp.endereco) el.textContent = emp.endereco.replace(/\s*-\s*Centro$/i, ' · Centro'); });
  document.querySelectorAll('[data-cidade]').forEach(el => { if (emp.cidade) el.textContent = emp.cidade; });
  const ig = String(emp.instagram || '').replace(/^@/, '');
  document.querySelectorAll('[data-ig]').forEach(a => { if (ig) { a.href = 'https://www.instagram.com/' + encodeURIComponent(ig) + '/'; a.textContent = '@' + ig; } else a.remove(); });
  const q = encodeURIComponent([emp.endereco, emp.cidade].filter(Boolean).join(', '));
  document.querySelectorAll('[data-mapa]').forEach(el => { if (q) el.innerHTML = `<iframe title="Mapa" loading="lazy" src="https://www.google.com/maps?q=${q}&output=embed"></iframe>`; });
  document.querySelectorAll('[data-chegar]').forEach(a => { if (q) a.href = 'https://www.google.com/maps/search/?api=1&query=' + q; });

  // serviços (sem os de prótese, que têm seção própria)
  const sv = $('[data-s="servicos"]');
  if (sv) sv.innerHTML = (d.servicos || []).filter(s => !/pr[oó]tese/i.test(s.nome))
    .map(s => `<div class="serv"><b>${esc(s.nome)}</b><i></i><span>${dur(s.duracao_min)}</span><em>${preco(s)}</em></div>`).join('');

  // prótese
  const ap = (d.servicos || []).find(s => /pr[oó]tese/i.test(s.nome) && !/manuten/i.test(s.nome));
  const mn = (d.servicos || []).find(s => /pr[oó]tese/i.test(s.nome) && /manuten/i.test(s.nome));
  const pp = $('[data-s="protese-precos"]');
  if (pp) pp.innerHTML = [ap && `<span>Aplicação<b>${preco(ap)}</b></span>`, mn && `<span>Manutenção<b>${preco(mn)}</b></span>`].filter(Boolean).join('');
  if (!ap && !mn) document.querySelectorAll('[data-so-protese]').forEach(el => el.remove());

  // planos: os 3 mais em conta, com o mais vendido no meio
  const pl = (d.planos || []).slice().sort((a, b) => a.preco - b.preco);
  const top = pl.find(p => p.mais_vendido) || pl.find(p => /corte/i.test(p.nome) && /ilimit/i.test(p.nome)) || pl[1];
  const tres = [pl[0], top, pl.find(p => p !== pl[0] && p !== top && /barba/i.test(p.nome)) || pl.find(p => p !== pl[0] && p !== top)].filter(Boolean);
  const gp = $('[data-s="planos"]');
  if (gp) gp.innerHTML = tres.map(p => `
    <div class="plano ${p === top ? 'top' : ''}">
      ${p === top ? '<span class="fita">MAIS ESCOLHIDO</span>' : ''}
      <span class="n">${esc(p.nome.replace(/^Plano\s+/i, '').replace(/\s+Gold$/i, ''))}</span>
      <span class="v">${moeda(p.preco).replace(',00', '')}<small>/mês</small></span>
      <ul>${(p.vantagens || []).slice(0, 3).map(v => `<li>${esc(v)}</li>`).join('')}</ul>
    </div>`).join('');
  if (!pl.length) document.querySelectorAll('[data-so-planos]').forEach(el => el.remove());

  // equipe
  const eq = $('[data-s="equipe"]');
  if (eq) eq.innerHTML = (d.barbeiros || []).map(b => `
    <div class="barb"><div class="f">${b.foto_url ? `<img src="${esc(b.foto_url)}" alt="Foto de ${esc(b.nome)}">` : esc(b.nome.trim()[0] || '')}</div>
      <div class="t"><b>${esc(b.nome)}</b><span>${esc(b.especialidade || 'Barbeiro')}</span></div></div>`).join('');

  // horários
  const hr = $('[data-s="horarios"]'), H = emp.horarios || {};
  if (hr) hr.innerHTML = [1, 2, 3, 4, 5, 6, 0].map(i => {
    const f = H[String(i)] || [];
    return `<li><span>${SEM[i]}</span><span>${f.length ? f.map(([a, b]) => `${a} às ${b}`).join(' · ') : 'Fechado'}</span></li>`;
  }).join('');

  // menor plano (link da bio)
  document.querySelectorAll('[data-menor-plano]').forEach(el => { if (top) el.textContent = `${top.nome.replace(/^Plano\s+/i, '').replace(/\s+Gold$/i, '')} por ${moeda(top.preco).replace(',00', '')}/mês`; });
}

carregar().then(d => { if (d) encher(d); }).catch(() => {});
document.querySelectorAll('[data-ano]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
