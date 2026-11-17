/* ═══════════════════════════════════════════════
   DuoTech Barber v3 · config.js
   APENAS chave pública (anon). Nunca coloque
   service_role, sb_secret ou $aact_ aqui.
═══════════════════════════════════════════════ */

window.CONFIG = {
  /* ── Supabase ── cole a URL e a chave ANON do seu projeto */
  SUPABASE_URL: 'https://pdratfjeoickgaoytwox.supabase.co',   // projeto duotech-barber
  SUPABASE_ANON: 'sb_publishable_ITBvbXfvuA9cDLdylILhYQ_iQuIvaM6', // chave PÚBLICA: pode ficar no app

  /* ── Barbearia ── */
  BARBEARIA_NOME: 'Thiago Prado Barbearia',
  BARBEARIA_SLUG: 'thiagoprado',
  BARBEARIA_WA:   '',  // número do WhatsApp da barbearia: 55 + DDD + número, só dígitos

  /* ── Asaas (pagamento de sinal) ── */
  /* A chave Asaas fica SOMENTE em Supabase → Edge Functions → Secrets */
  /* Aqui só o endpoint público do webhook (se usar) */
  ASAAS_WEBHOOK_PATH: '/functions/v1/asaas-webhook',
};

/* Modo demonstração: liga sozinho enquanto o Supabase não estiver
   preenchido acima, ou quando o endereço tiver ?demo */
CONFIG.MODO_DEMO = /SEU_PROJETO|SUA_CHAVE/.test(CONFIG.SUPABASE_URL + CONFIG.SUPABASE_ANON)
  || new URLSearchParams(location.search).has('demo');

/* ── window.DB helpers ── */
window.DB = {
  sb: null, // iniciado em app.js após carregar o SDK Supabase

  esc(str){ return String(str ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) },

  moeda(v){ return 'R$ '+Number(v||0).toLocaleString('pt-BR',
    {minimumFractionDigits:2,maximumFractionDigits:2}) },

  toast(msg, tipo='info', dur=3200){
    const c = document.getElementById('toast-container')
      || Object.assign(document.body.appendChild(document.createElement('div')),
         {id:'toast-container', style:'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:6px;align-items:center'});
    const t = document.createElement('div');
    const cores = {info:'#1565c0',sucesso:'#2e7d32',erro:'#c62828',aviso:'#f57f17'};
    t.style.cssText = `background:${cores[tipo]||'#111'};color:#fff;padding:9px 18px;border-radius:20px;font-size:.82rem;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.18);animation:fadeUp .2s ease`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(()=>t.remove(), dur);
  },

  linkWa(msg, num){ const n = String(num || CONFIG.BARBEARIA_WA || "").replace(/\D/g, ""); return `https://wa.me/${n}?text=${encodeURIComponent(msg)}` },

  dataBR(iso){ if(!iso)return '—'; const [a,m,d]=iso.split('T')[0].split('-'); return `${d}/${m}/${a}` },

  horaBR(iso){ if(!iso)return '—'; return iso.split('T')[1]?.slice(0,5)||iso.slice(0,5) },

  hojeISO(){ return new Date().toISOString().split('T')[0] },

  $(id){ return document.getElementById(id) },
  $$(sel,ctx=document){ return ctx.querySelector(sel) },
};

/* Inject CSS keyframe para toast */
const st = document.createElement('style');
st.textContent = '@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
document.head.appendChild(st);
