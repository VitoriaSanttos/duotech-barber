/* ═══════════════════════════════════════════════
   DuoTech Barber · fe.js
   PROPÓSITO: a parte de fé do sistema.
   Palavra do dia, momento da equipe e pedidos de oração.
   Cada barbearia liga ou desliga em Propósito (fe_ativa).
   Versículos: tradução Almeida (trechos curtos).
   Reflexões e orações são EXEMPLOS: o Thiago pode trocar.
═══════════════════════════════════════════════ */

const PALAVRAS = [
  {ref:'Provérbios 22:29', texto:'Vês a um homem perito na sua obra? Perante reis será posto.',
   reflexao:'Excelência no que a gente faz também é adoração. Cada corte bem feito honra quem nos deu o dom.',
   oracao:'Senhor, dá firmeza às nossas mãos e alegria no atendimento de hoje.'},
  {ref:'Colossenses 3:23', texto:'Tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor e não aos homens.',
   reflexao:'O cliente das 8h e o das 20h merecem o mesmo cuidado. Trabalhamos para o Senhor.',
   oracao:'Pai, que cada pessoa que sentar na nossa cadeira saia melhor do que chegou.'},
  {ref:'Provérbios 16:3', texto:'Confia ao Senhor as tuas obras, e teus pensamentos serão estabelecidos.',
   reflexao:'Planos, metas e agenda cheia: tudo começa entregando o dia nas mãos de Deus.',
   oracao:'Senhor, entregamos a agenda de hoje e cada decisão da barbearia em Tuas mãos.'},
  {ref:'Josué 1:9', texto:'Sê forte e corajoso; não temas, nem te espantes, porque o Senhor, teu Deus, é contigo por onde quer que andares.',
   reflexao:'Dia fraco ou dia lotado, a gente não está sozinho.',
   oracao:'Deus, tira o medo e coloca coragem no coração de cada um da equipe.'},
  {ref:'Salmos 90:17', texto:'Seja sobre nós a graça do Senhor, nosso Deus; e confirma sobre nós a obra das nossas mãos.',
   reflexao:'A obra das nossas mãos é literal aqui. Pedimos que Deus confirme cada trabalho.',
   oracao:'Senhor, abençoa as nossas mãos e o sustento de cada família desta equipe.'},
  {ref:'Lamentações 3:22-23', texto:'As misericórdias do Senhor são a causa de não sermos consumidos; renovam-se cada manhã.',
   reflexao:'Ontem ficou para trás. Hoje é um novo dia para atender bem e recomeçar.',
   oracao:'Obrigado, Pai, por mais um dia de trabalho e por renovar as nossas forças.'},
  {ref:'Mateus 5:16', texto:'Assim resplandeça a vossa luz diante dos homens, para que vejam as vossas boas obras e glorifiquem a vosso Pai, que está nos céus.',
   reflexao:'Nem sempre a pregação é com palavras. Às vezes é o jeito que a gente trata o cliente.',
   oracao:'Senhor, que a nossa barbearia seja luz para quem entrar por essa porta.'},
  {ref:'Gálatas 6:9', texto:'E não nos cansemos de fazer o bem, porque a seu tempo ceifaremos, se não houvermos desfalecido.',
   reflexao:'Constância vence. O cliente fiel de amanhã é o atendimento caprichado de hoje.',
   oracao:'Deus, renova o nosso ânimo para fazer o bem até o último cliente.'},
  {ref:'1 Pedro 4:10', texto:'Cada um administre aos outros o dom como o recebeu, como bons despenseiros da multiforme graça de Deus.',
   reflexao:'Talento é dom. A gente cuida dele e coloca a serviço das pessoas.',
   oracao:'Senhor, ajuda cada barbeiro a usar o seu dom com humildade e excelência.'},
  {ref:'Filipenses 4:13', texto:'Posso todas as coisas naquele que me fortalece.',
   reflexao:'Meta de ocupação, plano novo, desafio no caixa: com Ele, a gente dá conta.',
   oracao:'Pai, fortalece a nossa equipe para os desafios desta semana.'},
];

/* A palavra muda todo dia (mesma para todos no mesmo dia) */
function palavraDoDia(data = new Date()){
  const inicio = new Date(data.getFullYear(), 0, 0);
  const diaDoAno = Math.floor((data - inicio) / 86400000);
  return PALAVRAS[diaDoAno % PALAVRAS.length];
}

/* Pedidos de oração (EXEMPLOS). No app, o cliente escreve em particular:
   só a equipe vê, e ele escolhe se quer se identificar. */
const PEDIDOS_ORACAO_DEMO = [
  {id:'o1', nome:'Cliente do app',  anonimo:true,  quando:'hoje, 10:42', texto:'Pela saúde da minha mãe, que vai operar na quinta.'},
  {id:'o2', nome:'Rafael S.',       anonimo:false, quando:'hoje, 09:15', texto:'Por uma porta de emprego. Estou há 3 meses procurando.'},
  {id:'o3', nome:'Lucas F.',        anonimo:false, quando:'ontem',       texto:'Pelo meu casamento.'},
];

function lerFe(){
  try { return {fe_ativa:true, fe_app_cliente:true, fe_lembrete:true, fe_fila:true, fe_dizimo:false,
                ...JSON.parse(localStorage.getItem('tp_demo_fe') || '{}')}; }
  catch(e){ return {fe_ativa:true, fe_app_cliente:true, fe_lembrete:true, fe_fila:true, fe_dizimo:false}; }
}
function salvarFe(f){ try { localStorage.setItem('tp_demo_fe', JSON.stringify(f)); } catch(e){} }

function pedidosOrados(){
  try { return JSON.parse(localStorage.getItem('tp_demo_orados') || '[]'); } catch(e){ return []; }
}
function marcarOrado(id){
  const l = pedidosOrados(); if(!l.includes(id)) l.push(id);
  try { localStorage.setItem('tp_demo_orados', JSON.stringify(l)); } catch(e){}
}

/* Momento da equipe: marcado por dia */
function hojeISO(){ const d=new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; }
function momentoFeito(){
  try { return localStorage.getItem('tp_demo_momento') === hojeISO(); } catch(e){ return false; }
}
function marcarMomento(){
  try { localStorage.setItem('tp_demo_momento', hojeISO()); } catch(e){}
}
