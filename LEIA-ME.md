# DuoTech Barber · painel do Thiago Prado (versão 14)

Base: o painel v13 que está no ar. A v14 acrescenta:

- **Início novo**: saúde do negócio, "Precisa de ação hoje", aba Crescimento e ocupação por horário. Barbeiro com login vê só a Palavra do dia e a agenda dele, sem números.
- **Fé no painel** (nada no app do cliente): Palavra do dia, Momento da equipe, Meta com propósito, lembrete do dízimo ao fechar o caixa e versículo no lembrete do WhatsApp. Cada item liga e desliga em Propósito > Palavra do dia. Não existe pedido de oração.
- **Caixa**: abrir, lançar entradas e saídas, fechar com conferência. Os atendimentos fechados pela Agenda da v13 entram sozinhos.
- **Comanda completa**: serviços e produtos, desconto, barbeiro, forma de pagamento, baixa no estoque, comissão e pontos. Funciona no balcão (cliente sem agendamento) e pelo botão "Comanda com produtos" na Agenda.
- **Meta do mês** e **Lucro real**: só o administrador vê.
- **Academia**: guias de configuração e trilha de fé.

## Como colocar no ar
1. No Supabase, rode `sql/barber-v14-gestao.sql` (depois da v13). Veja `sql/LEIA-ME-SQL.txt`.
2. Publique os arquivos (index.html, css, js, img) no mesmo lugar da v13.

## O que foi testado
Numa cópia local do banco real (mesma estrutura, dados de teste):
- SQL roda duas vezes sem erro; barbeiro não vê números nem muda a meta; outra barbearia e visitante não leem nada.
- Painel do Thiago no computador e no celular: comanda de R$ 120, caixa com R$ 250 na gaveta, faturamento de R$ 259,90, Pix de plano confirmado.
- Barbeiro (Everton) no celular: Meta escondida, sem números no Início.
- Modo demonstração: 19 telas sem erro e sem rolar para o lado.

Ainda não foi rodado no Supabase de verdade.

## Ainda falta
- Regra do Pote.
- Assinatura com cartão pelo Asaas (precisa da conta PJ e da chave de teste).
- Fila, Financeiro e Comissões ainda usam dados de exemplo na v13.
