/* ═══════════════════════════════════════════════
   DuoTech Barber v3 · dados-demo.js
   Dados da Thiago Prado Barbearia para o MODO DEMONSTRAÇÃO
   (quando o Supabase ainda não está ligado). Os mesmos dados
   estão no SQL. Pessoas e números de clientes são EXEMPLOS.
═══════════════════════════════════════════════ */

/* Categorias (mesmos códigos do banco) */
const CATEGORIAS = {
  corte: 'Corte', barba: 'Barba', estetica: 'Estética', coloracao: 'Coloração',
  tratamento: 'Tratamentos', premium: 'Premium', combo: 'Combo', outros: 'Outros',
};

/* 23 serviços */
const SERVICOS = [
  {id:'s1', nome:'Corte',                      categoria:'corte',      duracao_min:40,  preco:90,   destaque:true},
  {id:'s2', nome:'Barba a vapor',              categoria:'barba',      duracao_min:30,  preco:60,   destaque:true},
  {id:'s3', nome:'Corte Infantil',             categoria:'corte',      duracao_min:30,  preco:80},
  {id:'s4', nome:'Corte Raspado',              categoria:'corte',      duracao_min:20,  preco:50},
  {id:'s5', nome:'Pezinho',                    categoria:'corte',      duracao_min:15,  preco:50},
  {id:'s6', nome:'Só as Pontinhas',            categoria:'corte',      duracao_min:20,  preco:30},
  {id:'s7', nome:'Cavanhaque',                 categoria:'barba',      duracao_min:20,  preco:35},
  {id:'s8', nome:'Bigode',                     categoria:'barba',      duracao_min:15,  preco:25,   preco_a_partir:true},
  {id:'s9', nome:'Sobrancelhas',               categoria:'estetica',   duracao_min:15,  preco:25},
  {id:'s10',nome:'Risquinho',                  categoria:'estetica',   duracao_min:10,  preco:10},
  {id:'s11',nome:'Depilação Orelha',           categoria:'estetica',   duracao_min:10,  preco:25},
  {id:'s12',nome:'Depilação Nariz',            categoria:'estetica',   duracao_min:10,  preco:25},
  {id:'s13',nome:'Pigmentação Cabelo',         categoria:'coloracao',  duracao_min:40,  preco:90},
  {id:'s14',nome:'Pigmentação Barba',          categoria:'coloracao',  duracao_min:30,  preco:40},
  {id:'s15',nome:'Pigmentação Sobrancelhas',   categoria:'coloracao',  duracao_min:15,  preco:15},
  {id:'s16',nome:'Luzes',                      categoria:'coloracao',  duracao_min:120, preco:160,  preco_a_partir:true},
  {id:'s17',nome:'Platinado Global',           categoria:'coloracao',  duracao_min:180, preco:260,  preco_a_partir:true},
  {id:'s18',nome:'Alisamento',                 categoria:'coloracao',  duracao_min:90,  preco:95,   preco_a_partir:true},
  {id:'s19',nome:'Hidratação dos Fios',        categoria:'tratamento', duracao_min:30,  preco:45},
  {id:'s20',nome:'Penteado',                   categoria:'tratamento', duracao_min:20,  preco:40},
  {id:'s21',nome:'Solução Cachos Soltos',      categoria:'tratamento', duracao_min:120, preco:150,  preco_a_partir:true},
  {id:'s22',nome:'Manutenção Prótese Capilar', categoria:'premium',    duracao_min:90,  preco:195},
  {id:'s23',nome:'Prótese Capilar',            categoria:'premium',    duracao_min:180, preco:1900, preco_a_partir:true},
];

/* 7 planos Gold (vagas = o que restava no dia do cadastro) */
const PLANOS = [
  {id:'p1', nome:'Plano Um Corte no Mês Gold',                preco:79.90,  vagas_restantes:88,   vantagens:['1 corte por mês','Agendamento prioritário']},
  {id:'p2', nome:'Plano Raspado e Barba Gold',                preco:255.00, vagas_restantes:null, vantagens:['Raspado ilimitado','Barba ilimitada']},
  {id:'p3', nome:'Plano Corte Ilimitado Gold',                preco:160.00, vagas_restantes:29,   vantagens:['Cortes ilimitados no mês']},
  {id:'p4', nome:'Corte e Barba Ilimitado Gold',              preco:244.00, vagas_restantes:37,   vantagens:['Cortes ilimitados','Barba ilimitada']},
  {id:'p5', nome:'Barba Ilimitada Gold',                      preco:154.00, vagas_restantes:35,   vantagens:['Barba ilimitada no mês'], mais_vendido:true},
  {id:'p6', nome:'Plano Corte Sobrancelha e Cavanhaque Gold', preco:200.00, vagas_restantes:null, vantagens:['Corte','Sobrancelha','Cavanhaque']},
  {id:'p7', nome:'Corte Infantil Gold',                       preco:129.90, vagas_restantes:null, vantagens:['Corte infantil ilimitado']},
].map(p => ({vigencia:'Indeterminado', termos_url:null, mais_vendido:false, ...p}));

/* Barbeiros (nomes de exemplo até o Thiago passar a equipe) */
const BARBEIROS = [
  {id:'b1', nome:'Thiago Prado',   especialidade:'Prótese capilar',          iniciais:'TP'},
  {id:'b2', nome:'Marcus Alves',   especialidade:'Corte & barba a vapor',    iniciais:'MA'},
  {id:'b3', nome:'Pedro Oliveira', especialidade:'Pigmentação & risquinho',  iniciais:'PO'},
];

/* Equipe editável pelo painel.
   - Modo demonstração: fica no navegador (localStorage).
   - Modo real: o painel carrega a tabela `profissionais` do Supabase para
     window.EQUIPE (ver js/equipe.js) e todas as telas leem daqui. */
window.EQUIPE = null;
const EQUIPE_PADRAO = () => BARBEIROS.map(b => ({...b, ativo:true, aparece_no_link:true, comissao_pct:0, foto_url:null}));
function iniciaisProfissional(nome){
  return String(nome||'').trim().split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase() || 'PR';
}
function lerEquipeLocal(){
  let lista;
  try {
    const salvos = JSON.parse(localStorage.getItem('tp_demo_barbeiros') || 'null');
    lista = Array.isArray(salvos) ? salvos : EQUIPE_PADRAO();
  } catch(e){ lista = EQUIPE_PADRAO(); }
  const fotos = lerFotos();   // fotos guardadas na versão anterior
  return lista.map(b => ({...b, foto_url: b.foto_url || fotos[b.id] || null, iniciais: iniciaisProfissional(b.nome)}));
}
function obterBarbeiros(){ return window.EQUIPE || lerEquipeLocal(); }
function salvarBarbeiros(lista){
  try { localStorage.setItem('tp_demo_barbeiros', JSON.stringify(lista)); return true; }
  catch(e){ return false; }
}


/* Prêmios do clube (exemplos — a barbearia ajusta) */
const RECOMPENSAS = [
  {id:'r1', nome:'Risquinho grátis',     pontos:100},
  {id:'r2', nome:'Sobrancelha grátis',   pontos:250},
  {id:'r3', nome:'Barba a vapor grátis', pontos:600},
  {id:'r4', nome:'Corte grátis',         pontos:900},
];

/* Qual barbearia é este site (vem do config.js gerado pelo painel da DuoTech) */
const EH_THIAGO = !window.CONFIG || !CONFIG.BARBEARIA_SLUG || CONFIG.BARBEARIA_SLUG === 'thiagoprado';
const NOME_CURTO = String((window.CONFIG && CONFIG.BARBEARIA_NOME) || 'Barbearia')
  .replace(/^\s*barbearia\s+(d[oae]s?\s+)?/i, '').replace(/\s+barbearia\s*$/i, '').trim() || 'Barbearia';

if (!EH_THIAGO) document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-nav="planos"], [data-aba="planos"]').forEach(el => {
    el.childNodes.forEach(n => { if (n.nodeType === 3 && /Planos Gold/.test(n.textContent)) n.textContent = n.textContent.replace('Planos Gold', 'Planos'); });
  });
});

/* Personalidade padrão (o dono troca em Personalidade) */
const PERSONALIDADE_PADRAO = {
  nome: EH_THIAGO ? 'Thiago Prado' : NOME_CURTO,
  tipo: 'Barbearia',
  slogan: EH_THIAGO ? 'Corte de rei, atendimento de rei.' : 'Seu estilo em boas mãos.',
  boas_vindas: EH_THIAGO ? 'Escolhe o serviço e garante tua cadeira.' : 'Escolha o serviço e garanta seu horário.',
  tom_voz: 'descontraido',          // descontraido | classico | premium
  clube_nome: EH_THIAGO ? 'Clube Gold TP' : 'Clube de pontos',
  especialidade: EH_THIAGO ? 'Especialista em prótese capilar' : '',
  cor: (window.CONFIG && CONFIG.COR) || '#C9A84C',
  whatsapp: '',                     // preencher com o número da barbearia (só números, com DDD)
  instagram: '',                    // ex.: thiagopradobarbearia
  pontos_por_real: 1,
  pix_tipo: '', pix_chave: '',      // a barbearia preenche em Personalidade
  pix_nome: '', pix_cidade: '',
};

/* Jeito de falar de cada tom de voz */
const FALAS = {
  descontraido: {
    ola: n => `Fala, ${n}!`, olaAnon: 'Fala, parceiro!',
    passo1: 'Quem vai cuidar do teu visual?', passo2: 'O que vai ser hoje?', passo3: 'Quando fica bom pra ti?',
    cta: 'Garantir minha cadeira', confirmado: 'Cadeira garantida!',
    pedirLogin: 'Cria tua conta rapidinho pra garantir a cadeira e já começar a juntar pontos.',
    planoCta: 'Quero esse plano', clubeConvite: 'Cada real gasto vira ponto. Junta e troca por serviço na faixa.',
    semHorario: 'Esse dia tá lotado. Tenta outro?',
  },
  classico: {
    ola: n => `Olá, ${n}.`, olaAnon: 'Seja bem-vindo.',
    passo1: 'Escolha o profissional', passo2: 'Escolha o serviço', passo3: 'Escolha o dia e o horário',
    cta: 'Reservar horário', confirmado: 'Horário reservado.',
    pedirLogin: 'Crie sua conta para reservar o horário e acumular pontos.',
    planoCta: 'Assinar este plano', clubeConvite: 'Cada real em serviços vale pontos, que podem ser trocados por atendimentos.',
    semHorario: 'Não há horários livres neste dia.',
  },
  premium: {
    ola: n => `Bem-vindo de volta, ${n}.`, olaAnon: 'Seja bem-vindo à casa.',
    passo1: 'Seu barbeiro', passo2: 'Sua experiência', passo3: 'Data e horário',
    cta: 'Reservar experiência', confirmado: 'Sua experiência está reservada.',
    pedirLogin: 'Crie sua conta para reservar e fazer parte do clube.',
    planoCta: 'Fazer parte', clubeConvite: 'Membros acumulam pontos a cada visita e trocam por experiências da casa.',
    semHorario: 'Agenda completa neste dia.',
  },
};

/* Lê o que a barbearia mudou no painel (modo demonstração guarda no navegador) */
function lerPersonalidade(){
  try { return {...PERSONALIDADE_PADRAO, ...JSON.parse(localStorage.getItem('tp_demo_personalidade') || '{}')}; }
  catch(e){ return {...PERSONALIDADE_PADRAO}; }
}
function salvarPersonalidade(p){
  try { localStorage.setItem('tp_demo_personalidade', JSON.stringify(p)); } catch(e){}
}
function lerLogo(){ try { return localStorage.getItem('tp_demo_logo') || ''; } catch(e){ return ''; } }
function salvarLogo(dataUrl){
  try { dataUrl ? localStorage.setItem('tp_demo_logo', dataUrl) : localStorage.removeItem('tp_demo_logo'); return true; }
  catch(e){ return false; }
}
/* Mostra a logo da barbearia no topo da lateral do painel (ou a coroa padrão) */
function aplicarLogoPainel(){
  const caixa = document.getElementById('sidebarLogo'); if(!caixa) return;
  const logo = lerLogo() || (window.CONFIG && CONFIG.LOGO) || '';
  caixa.classList.toggle('com-imagem', !!logo);
  let img = caixa.querySelector('.logo-img'), svg = caixa.querySelector('.logo-svg');
  if(logo){
    if(!img){ img = document.createElement('img'); img.className = 'logo-img'; img.alt = 'Logo da barbearia'; caixa.prepend(img); }
    img.src = logo; if(svg) svg.style.display = 'none';
  } else {
    if(img) img.remove(); if(svg) svg.style.display = '';
  }
}
function lerFotos(){
  try { return JSON.parse(localStorage.getItem('tp_demo_fotos') || '{}'); } catch(e){ return {}; }
}
function salvarFoto(id, dataUrl){
  const f = lerFotos(); if(dataUrl) f[id] = dataUrl; else delete f[id];
  try { localStorage.setItem('tp_demo_fotos', JSON.stringify(f)); return true; }
  catch(e){ return false; }
}

/* Marca da barbearia: coroa TP na Thiago Prado; nas outras, as iniciais do nome */
const COROA_SVG = (tam=44, fundo='#C9A84C', traco='#111') =>
  EH_THIAGO ? COROA_TP_SVG(tam, fundo, traco) : EMBLEMA_SVG(NOME_CURTO, tam, fundo, traco);
const EMBLEMA_SVG = (nome, tam=44, fundo='#C9A84C', traco='#111') => {
  const pal = String(nome || '').replace(/\b(barbearia|barber ?shop|barbershop|do|da|de|dos|das)\b/gi, ' ').trim().split(/\s+/).filter(Boolean);
  const ini = (((pal[0] || 'B')[0] || 'B') + ((pal[1] || '')[0] || '')).toUpperCase().replace(/[<>&"']/g, '');
  return `<svg width="${tam}" height="${tam}" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="80" height="80" rx="14" fill="${fundo}"/>
  <text x="40" y="52" text-anchor="middle" font-family="Oswald,Arial Narrow,Arial,sans-serif" font-weight="700" font-size="${ini.length > 1 ? 32 : 38}" fill="${traco}">${ini}</text></svg>`;
};
/* Coroa TP em SVG (mesma da logo do Thiago) */
const COROA_TP_SVG = (tam=44, fundo='#C9A84C', traco='#111') => `
<svg width="${tam}" height="${tam}" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="80" height="80" rx="14" fill="${fundo}"/>
  <path d="M40 10 L28 26 L18 20 L23 38 H57 L62 20 L52 26 Z" fill="${traco}"/>
  <rect x="23" y="38" width="34" height="4" rx="1" fill="${traco}"/>
  <rect x="12" y="44" width="26" height="4" rx="1.5" fill="${traco}"/>
  <rect x="22" y="44" width="6" height="22" rx="1.5" fill="${traco}"/>
  <rect x="42" y="44" width="6" height="22" rx="1.5" fill="${traco}"/>
  <path d="M48 44 Q62 44 62 52 Q62 60 48 60 L48 56 Q57 56 57 52 Q57 48 48 48 Z" fill="${traco}"/>
</svg>`;
