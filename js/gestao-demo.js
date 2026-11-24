/* ═══════════════════════════════════════════════
   DuoTech Barber · gestao-demo.js  (versão 14)
   Números de EXEMPLO do Início, da Meta do mês e do Lucro real para o
   modo demonstração. Com login, js/gestao-real.js troca tudo pelos
   números do banco.
═══════════════════════════════════════════════ */

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

/* Ocupação média por dia e hora nos últimos 30 dias (%). null = fechado.
   Linhas: Seg, Ter, Qua, Qui, Sex, Sáb, Dom · Colunas: 07h a 19h */
const OCUPACAO_DEMO = [
  [null,12, 15, 18, 14, 35, 38, 72, 55, 16, 33, 70, 18],
  [ 66, 52, 47, 31, 45, 12, 30, 48, 36, 58, 39, 74, 65],
  [ 38, 50, 33, 17, 36, 15, 34, 37, 51, 44, 28,null,null],
  [null,35, 38, 34, 40, 14, 38, 55, 30, 52, 57, 36,null],
  [ 88, 54, 69, 56, 55, 32, 53, 58, 49, 47, 34, 33, 15],
  [ 63, 37, 39, 58, 52, 16, 36, 46, 38,null,null,null,null],
  [null,null,null,null,null,null,null,null,null,null,null,null,null],
];
