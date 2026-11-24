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

/* Prêmios do clube (exemplos — a barbearia ajusta) */
const RECOMPENSAS = [
  {id:'r1', nome:'Risquinho grátis',     pontos:100},
  {id:'r2', nome:'Sobrancelha grátis',   pontos:250},
  {id:'r3', nome:'Barba a vapor grátis', pontos:600},
  {id:'r4', nome:'Corte grátis',         pontos:900},
];

/* Personalidade padrão (frase e boas-vindas são EXEMPLOS: trocar pelas do Thiago) */
const PERSONALIDADE_PADRAO = {
  nome: 'Thiago Prado',
  tipo: 'Barbearia',
  slogan: 'Corte de rei, atendimento de rei.',
  boas_vindas: 'Escolhe o serviço e garante tua cadeira.',
  tom_voz: 'descontraido',          // descontraido | classico | premium
  clube_nome: 'Clube Gold TP',
  especialidade: 'Especialista em prótese capilar',
  cor: '#C9A84C',
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
function lerFotos(){
  try { return JSON.parse(localStorage.getItem('tp_demo_fotos') || '{}'); } catch(e){ return {}; }
}
function salvarFoto(id, dataUrl){
  const f = lerFotos(); if(dataUrl) f[id] = dataUrl; else delete f[id];
  try { localStorage.setItem('tp_demo_fotos', JSON.stringify(f)); return true; }
  catch(e){ return false; }
}

/* Coroa TP em SVG (mesma da logo) */
const COROA_SVG = (tam=44, fundo='#C9A84C', traco='#111') => `
<svg width="${tam}" height="${tam}" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="80" height="80" rx="14" fill="${fundo}"/>
  <path d="M40 10 L28 26 L18 20 L23 38 H57 L62 20 L52 26 Z" fill="${traco}"/>
  <rect x="23" y="38" width="34" height="4" rx="1" fill="${traco}"/>
  <rect x="12" y="44" width="26" height="4" rx="1.5" fill="${traco}"/>
  <rect x="22" y="44" width="6" height="22" rx="1.5" fill="${traco}"/>
  <rect x="42" y="44" width="6" height="22" rx="1.5" fill="${traco}"/>
  <path d="M48 44 Q62 44 62 52 Q62 60 48 60 L48 56 Q57 56 57 52 Q57 48 48 48 Z" fill="${traco}"/>
</svg>`;

/* Números do painel Início (EXEMPLOS para o modo demonstração).
   Na versão ligada ao banco, cada número vem de uma consulta. */
const DASH_DEMO = {
  faturamento_mes: 21480.50, faturamento_mes_passado: 23910.00, acumulado_ano: 158320.75,
  ocupacao: 41.4, meta_ocupacao: 65,
  planos_ativos: 96, planos_vendidos_mes: 21, planos_cancelados_mes: 4,
  ticket_medio: 142.30,
  comandas_abertas: 3, comandas_outros_dias: 2,
  /* últimos 6 meses (aba Crescimento) */
  meses: [
    {mes:'Jun', fat:19850, novos:31, voltaram:212, ticket:131},
    {mes:'Jul', fat:21340, novos:28, voltaram:225, ticket:134},
    {mes:'Ago', fat:22780, novos:35, voltaram:231, ticket:138},
    {mes:'Set', fat:22100, novos:26, voltaram:238, ticket:139},
    {mes:'Out', fat:23910, novos:33, voltaram:247, ticket:141},
    {mes:'Nov', fat:21480, novos:24, voltaram:219, ticket:142.30},
  ],
  pix_conferir: [
    {nome:'Diego M.',   plano:'Barba Ilimitada Gold',         valor:154.00, quando:'hoje, 11:20', disse_que_pagou:true},
    {nome:'André L.',   plano:'Plano Corte Ilimitado Gold',   valor:160.00, quando:'ontem',       disse_que_pagou:false},
  ],
  mensalidade_aberta: [
    {nome:'Bruno C.',   plano:'Corte e Barba Ilimitado Gold', dias:5, tel:''},
    {nome:'Felipe R.',  plano:'Barba Ilimitada Gold',         dias:3, tel:''},
    {nome:'Mateus A.',  plano:'Plano Um Corte no Mês Gold',   dias:1, tel:''},
  ],
  estoque_minimo: [
    {nome:'Pomada efeito matte 70g', atual:2, min:10},
    {nome:'Óleo para barba',         atual:1, min:3},
    {nome:'Shampoo antiqueda',       atual:0, min:2},
    {nome:'Body splash',             atual:1, min:2},
  ],
  contratos_pendentes: [
    {nome:'Thiago Prado',   situacao:'Sem contrato cadastrado'},
    {nome:'Marcus Alves',   situacao:'Sem contrato cadastrado'},
    {nome:'Pedro Oliveira', situacao:'Vence em 40 dias'},
  ],
};
