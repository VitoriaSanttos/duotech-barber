# DuoTech Barber · Mapa do sistema

Referência: o que o CashBarber (painel Empresa + painel Pump) tem, como fica no
DuoTech Barber e em que pé está. Usamos o CashBarber como referência de
funcionalidade, **não** copiamos nomes, marca nem visual.

Legenda: ✅ pronto (modo demonstração) · 🟡 parcial · ⬜ a fazer · ✝️ diferencial de fé

> Versão 4: o painel está **ligado ao banco** (login, Início, Agenda, Comanda, Caixa,
> Clientes, Planos, Meta do mês, Lucro real, Propósito e Academia).
> Ainda com exemplos: Fila, Financeiro, Comissões, Estoque, Clube de pontos,
> Personalidade e Configurações. Use `index.html?demo` para o modo demonstração.

## Operação

| CashBarber | DuoTech Barber | Status |
|---|---|---|
| Dashboard (Hoje / Crescimento) | **Início** | ✅ |
| Live de mentoria no topo | **Palavra do dia + Momento da equipe** | ✅ ✝️ |
| Agenda (colunas por barbeiro, bloqueios, chegaram/faltaram, % ocupado) | Agenda | ✅ colunas por barbeiro, chegou/faltou, contadores · ⬜ bloqueio de horário |
| Comandas (abertas, de outros dias) | Comanda | ✅ serviços + produtos, desconto, plano, cortesia, avaliação · 🟡 comanda aberta = cliente "na cadeira" |
| Caixa (abrir, entrada, saída, fechar, histórico) | **Caixa** | ✅ ligado ao banco, conferência da gaveta, gratidão e dízimo opcional ✝️ |
| Bar / Cozinha | — | ⬜ vender bebida/comida na comanda |
| Fila | Fila de espera | 🟡 devocional na fila ✝️ a fazer |

## Assinaturas (planos)

| CashBarber | DuoTech Barber | Status |
|---|---|---|
| Planos (criar, exibição, listagem) | Planos Gold | ✅ |
| Cobrança recorrente (CashPag), saque, transações | Pix manual com "Pix recebido" | 🟡 cobrança automática exige gateway (Asaas, Mercado Pago, Pagar.me) |
| Inadimplentes, pré-aprovado, pré-cancelado | "Mensalidade em aberto" no Início | 🟡 |
| Calendário de assinaturas e de recebíveis | — | ⬜ |
| Price (quanto cobrar no plano) | Planos inteligentes · Preço do plano | ⬜ |
| Régua de Preço (desconto real, simular reajuste) | Planos inteligentes · Régua | ⬜ |
| Pulse (frequência dos assinantes) | Planos inteligentes · Frequência | ⬜ |
| Pote (dinheiro dos planos dividido entre barbeiros) | Planos inteligentes · Pote | ⬜ **precisa da regra do Thiago** |
| Clube do assinante (empresas parceiras, cupons) | Clube Gold TP | 🟡 falta empresas parceiras e cupons |

### Assinatura com cartão (cobrança automática todo mês)

Plataforma recomendada: **Asaas** (o projeto já previa: `asaas_subscription_id`, `ASAAS_WEBHOOK_PATH`).

1. No app, o cliente escolhe o plano e preenche nome, CPF, e-mail, celular e endereço (CEP preenche a rua).
2. Uma Edge Function do Supabase, com a chave do Asaas guardada em Secrets, cria o cliente e a
   assinatura no Asaas e devolve o link de pagamento.
3. O cliente digita o cartão **na página do Asaas**: o número do cartão nunca passa pelo DuoTech.
4. O Asaas cobra sozinho todo mês e avisa o DuoTech (webhook): pago → plano ativo e entrada no
   Financeiro; atrasado → "Mensalidade em aberto" no Início; cancelado → plano cancelado.
5. Segunda opção sem cartão: **Pix Automático** (Asaas, conta PJ).

CPF e endereço ficam no Asaas; no banco do DuoTech fica só o código do cliente no Asaas.
Pendências: conta Asaas PJ do Thiago; chave de teste (sandbox) para desenvolver; para vender a outras
barbearias, decidir entre cada uma conectar a própria conta (mais simples) ou subcontas do DuoTech
(exige alinhar com o Asaas).

### Marketing de assinaturas (ideias que viram funcionalidade)

| Ideia | Status |
|---|---|
| Lista "clientes que pagariam menos no plano" (avulso que gasta mais que o plano) | ✅ selo na tela Clientes |
| Plano Flex (só em dias e horários vazios) | ⬜ |
| Indique e ganhe (assinante traz assinante) | ⬜ |
| Primeiro mês promocional com permanência mínima | ⬜ |
| Aviso "pagou e não veio há 15 dias" | ⬜ |
| Pausar em vez de cancelar + pergunta "o que faltou?" | ⬜ |
| Bônus do barbeiro por plano vendido (Premiação da Meta do mês) | 🟡 |

## Financeiro e gestão

| CashBarber | DuoTech Barber | Status |
|---|---|---|
| Balanço, contas a pagar/receber, criar despesa | Financeiro | 🟡 |
| Categorias financeiras, contas bancárias, formas de pagamento | — | ⬜ |
| Gerar comissões | Comissões | 🟡 |
| Estoque | Estoque | 🟡 alerta de mínimo já no Início |
| Clientes (cadastro, bloqueados, recompras) | Clientes | ✅ busca, visitas, plano, pontos, "pagaria menos no plano", senha do app · ⬜ bloqueados |
| Auditorias | — | ⬜ registro de quem fez o quê |
| Contratos/documentos dos profissionais | Alerta no Início | 🟡 |

## Inteligência

| CashBarber | DuoTech Barber | Status |
|---|---|---|
| Ocupação da agenda por horário | **Crescimento · Ocupação por horário** | ✅ com horários mais cheios e mais vazios |
| Profit (margem, premissas, ponto de equilíbrio) | **Lucro real** | ✅ com o detalhe de para onde vai cada real |
| Pace (meta, quinzena, mix, confronto, premiação, modo palco, imagem) | **Meta do mês** | ✅ + **Meta com propósito** (doação ao bater a meta) ✝️ |
| Radar (operação ao vivo, ranking por profissional) | — | ⬜ |
| Boost (campanhas gamificadas, ranking ao vivo, app do barbeiro) | — | ⬜ premiação simples já existe na Meta do mês |
| Visão do Dono | Início já cumpre esse papel | ✅ |
| Relatórios (assinaturas, financeiro, clientes, marketing, profissional) | — | ⬜ |

## Competição e extras (vendidos à parte no CashBarber)

| CashBarber | DuoTech Barber | Status |
|---|---|---|
| Cash Liga (ranking de profissionais e de barbearias) | Liga entre barbeiros e entre barbearias da rede DuoTech | ⬜ ranking com foco em atendimento e avaliação, não só dinheiro ✝️ |
| Cash.IA (atendimento automático no WhatsApp oficial) | Atendente no WhatsApp | ⬜ exige WhatsApp Business API (Meta) e custo por conversa |
| Cash.NF (nota fiscal ao fechar a comanda) | Nota fiscal automática | ⬜ exige emissor (ex.: NFE.io, Focus NFe) e cadastro na prefeitura |
| Cash.Totem (check-in e pagamento na recepção) | Totem / check-in | ⬜ pode reaproveitar o app do cliente em tablet + fila |
| Explorar add-ons | Loja de extras | ⬜ modelo de venda: plano base + extras |

## Painel Pump (visão consolidada)

| CashBarber | DuoTech Barber | Status |
|---|---|---|
| Faturamento consolidado (empresa / assinaturas, por mês) | Crescimento | 🟡 falta separar assinaturas |
| Clientes atendidos, serviços realizados (dia anterior, semana, mês) | — | ⬜ |
| Agendamentos sem preferência + profissional que mais atende | — | ⬜ |
| Clientes novos (semana, mês, ano) | Crescimento | 🟡 |
| Avaliações (nota média, 1 estrela, melhor profissional) | Avaliação no fechar atendimento | 🟡 falta o painel |
| Ticket médio por profissional e por unidade | Ticket médio geral | 🟡 |
| Fábrica de planos, Prévia, Presentes | — | ⬜ |

## Academia (no lugar do "Skills")

| CashBarber | DuoTech Barber | Status |
|---|---|---|
| Aula ao vivo com mentor | **Café com Propósito** (ao vivo toda terça, 08:00), confirmar presença | ✅ ✝️ falta o link real da sala |
| Continuar assistindo, trilhas, categorias, busca | **Academia** | ✅ |
| Cursos dos mentores deles | **Cursos de parceiros** (barbeiros e empresários) + "Quero ser parceiro" | 🟡 vitrine de exemplo; vídeos entram por YouTube/Vimeo |
| Curso "Configurações" | **Como configurar**: 8 guias com botão que abre a tela | ✅ |
| — | **Cristo na cadeira**: 7 devocionais de 5 min | ✅ ✝️ |
| — | **Barbearia com propósito** (liderança cristã) | 🟡 aulas a gravar ✝️ |

Decisões de negócio em aberto: como o parceiro ganha (porcentagem da assinatura, valor
fixo por curso ou divulgação), quem aprova o conteúdo e se cursos ficam liberados para
todos os planos.

## Marketing

| CashBarber | DuoTech Barber | Status |
|---|---|---|
| Banners do painel do cliente | Personalidade + App do cliente | 🟡 |
| Configurações de WhatsApp (lembretes) | Prévia do lembrete com versículo | 🟡 ✝️ envio automático a fazer |
| Promoções | — | ⬜ |
| Cash Indica (indique e ganhe) | — | ⬜ |

## Propósito (só no DuoTech) ✝️

| Funcionalidade | Status |
|---|---|
| Palavra do dia no painel | ✅ |
| Momento da equipe (oração antes de abrir) | ✅ |
| Pedidos de oração dos clientes (em particular) | ✅ no painel · ⬜ botão no app do cliente |
| Liga/desliga por barbearia | ✅ |
| Versículo no lembrete do WhatsApp | 🟡 prévia pronta |
| Gratidão e lembrete do dízimo no fechamento do caixa | ✅ |
| Meta com propósito (doação ao bater a meta) | ✅ |
| Devocional na fila de espera | ⬜ |
| Versículo do dia no app do cliente | ⬜ |

## Várias unidades

O CashBarber trabalha com filiais ("Centro"). O DuoTech ainda é uma barbearia só.
O banco deve ganhar `unidade_id` antes de ligar o painel, para não ter que refazer depois.
