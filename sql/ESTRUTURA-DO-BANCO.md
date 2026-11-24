# Estrutura do banco (Supabase duotech-barber)
Lida direto do banco em 24/11/2026, só leitura. Só nomes de tabelas, colunas e ligações: nenhum dado de cliente.

## planos_duotech
Colunas: `id`, `nome`, `preco`, `preco_anual`, `recursos`, `ativo`, `ordem`

## empresas
Colunas: `id`, `nome`, `profissional`, `slug`, `plano_id`, `situacao`, `teste_ate`, `pago_ate`, `whatsapp`, `email`, `cidade`, `endereco`, `instagram`, `logo_url`, `foto_url`, `cor_principal`, `cor_destaque`, `horarios`, `intervalo_agenda`, `antecedencia_min`, `dias_abertos_link`, `link_ativo`, `instancia_whatsapp`, `obs_duotech`, `asaas_customer_id`, `tolerancia_atraso`, `fidelidade_meta`, `fidelidade_premio`, `criado_em`, `slogan`, `boas_vindas`, `tom_voz`, `clube_nome`, `especialidade`, `capa_url`, `pontos_ativo`, `pontos_por_real`, `pix_tipo`, `pix_chave`, `pix_nome`, `pix_cidade`, `modulos`, `mensalidade`, `sites`

Ligações: `plano_id` → `planos_duotech`

## perfis
Colunas: `id`, `empresa_id`, `profissional_id`, `tipo`, `nome`, `email`, `comissao_pct`, `ativo`, `criado_em`, `foto_url`, `especialidade`, `aparece_no_link`

Ligações: `id` → `auth.users`; `profissional_id` → `profissionais`; `empresa_id` → `empresas`

## empresas_segredos
Colunas: `empresa_id`, `mp_access_token`, `atualizado_em`

Ligações: `empresa_id` → `empresas`

## assinaturas_duotech
Colunas: `id`, `empresa_id`, `plano_id`, `ciclo`, `valor`, `forma`, `asaas_subscription_id`, `status`, `proximo_vencimento`, `criado_em`

Ligações: `plano_id` → `planos_duotech`; `empresa_id` → `empresas`

## faturas
Colunas: `id`, `empresa_id`, `assinatura_id`, `asaas_payment_id`, `valor`, `vencimento`, `forma`, `status`, `pago_em`, `link_pagamento`, `criado_em`

Ligações: `empresa_id` → `empresas`; `assinatura_id` → `assinaturas_duotech`

## servicos
Colunas: `id`, `empresa_id`, `nome`, `categoria`, `descricao`, `duracao_min`, `preco`, `foto_url`, `sinal_valor`, `aparece_no_link`, `ativo`, `ordem`, `criado_em`, `preco_a_partir`, `destaque`

Ligações: `empresa_id` → `empresas`

## bloqueios
Colunas: `id`, `empresa_id`, `inicio`, `fim`, `motivo`, `criado_em`

Ligações: `empresa_id` → `empresas`

## clientes
Colunas: `id`, `empresa_id`, `nome`, `whatsapp`, `email`, `nascimento`, `observacoes`, `origem`, `sessao_token`, `sessao_ate`, `tentativas`, `bloqueado_ate`, `criado_em`, `senha_hash`, `ficha`

Ligações: `empresa_id` → `empresas`

## agendamentos
Colunas: `id`, `empresa_id`, `cliente_id`, `servico_id`, `servico_nome`, `barbeiro_id`, `inicio`, `fim`, `preco`, `desconto`, `status`, `origem`, `forma_pagamento`, `pago`, `sinal_valor`, `sinal_pago`, `pacote_id`, `plano_cliente_id`, `observacoes`, `cancelado_por`, `criado_em`

Ligações: `barbeiro_id` → `profissionais`; `empresa_id` → `empresas`; `cliente_id` → `clientes`; `servico_id` → `servicos`

## fila_espera
Colunas: `id`, `empresa_id`, `cliente_id`, `nome_avulso`, `servico_id`, `servico_nome`, `barbeiro_id`, `posicao`, `status`, `chegou_em`, `chamado_em`, `iniciado_em`, `concluido_em`, `agendamento_id`

Ligações: `empresa_id` → `empresas`; `barbeiro_id` → `profissionais`; `agendamento_id` → `agendamentos`; `servico_id` → `servicos`; `cliente_id` → `clientes`

## fidelidade
Colunas: `empresa_id`, `cliente_id`, `selos`, `premios_usados`, `atualizado_em`

Ligações: `empresa_id` → `empresas`; `cliente_id` → `clientes`

## planos_cliente
Colunas: `id`, `empresa_id`, `nome`, `descricao`, `preco`, `cortes_mes`, `servicos_ids`, `ativo`, `criado_em`, `vagas_total`, `mais_vendido`, `vigencia`, `vantagens`, `termos_url`, `ordem`

Ligações: `empresa_id` → `empresas`

## planos_cliente_usos
Colunas: `id`, `empresa_id`, `plano_id`, `cliente_id`, `asaas_subscription_id`, `status`, `inicio`, `fim`, `cortes_usados_mes`, `mes_referencia`, `proximo_vencimento`, `criado_em`, `pagamento_informado_em`, `ultimo_pagamento`

Ligações: `empresa_id` → `empresas`; `cliente_id` → `clientes`; `plano_id` → `planos_cliente`

## comissao_config
Colunas: `empresa_id`, `barbeiro_id`, `pct_padrao`, `excecoes`, `atualizado_em`

Ligações: `empresa_id` → `empresas`; `barbeiro_id` → `profissionais`

## financeiro
Colunas: `id`, `empresa_id`, `tipo`, `categoria`, `descricao`, `valor`, `forma`, `data`, `vencimento`, `pago`, `barbeiro_id`, `comissao_valor`, `agendamento_id`, `pacote_id`, `criado_em`

Ligações: `agendamento_id` → `agendamentos`; `empresa_id` → `empresas`; `barbeiro_id` → `profissionais`

## produtos
Colunas: `id`, `empresa_id`, `nome`, `categoria`, `unidade`, `estoque_atual`, `estoque_minimo`, `preco_custo`, `preco_venda`, `ativo`, `criado_em`, `foto_url`

Ligações: `empresa_id` → `empresas`

## whatsapp_fila
Colunas: `id`, `empresa_id`, `agendamento_id`, `tipo`, `para`, `mensagem`, `enviado`, `tentativas`, `criado_em`, `enviar_em`

Ligações: `agendamento_id` → `agendamentos`; `empresa_id` → `empresas`

## whatsapp_log
Colunas: `id`, `empresa_id`, `fila_id`, `status`, `resposta`, `enviado_em`

Ligações: `fila_id` → `whatsapp_fila`; `empresa_id` → `empresas`

## push_inscricoes
Colunas: `id`, `empresa_id`, `perfil_id`, `endpoint`, `p256dh`, `auth`, `criado_em`

Ligações: `empresa_id` → `empresas`; `perfil_id` → `perfis`

## cliente_sessoes
Colunas: `token_hash`, `empresa_id`, `cliente_id`, `expira`, `criado_em`

Ligações: `empresa_id` → `empresas`; `cliente_id` → `clientes`

## pontos_mov
Colunas: `id`, `empresa_id`, `cliente_id`, `pontos`, `tipo`, `descricao`, `agendamento_id`, `criado_em`

Ligações: `agendamento_id` → `agendamentos`; `empresa_id` → `empresas`; `cliente_id` → `clientes`

## recompensas
Colunas: `id`, `empresa_id`, `nome`, `descricao`, `pontos`, `ativo`, `ordem`, `criado_em`

Ligações: `empresa_id` → `empresas`

## resgates
Colunas: `id`, `empresa_id`, `cliente_id`, `recompensa_id`, `nome`, `pontos`, `codigo`, `status`, `criado_em`, `usado_em`

Ligações: `empresa_id` → `empresas`; `recompensa_id` → `recompensas`; `cliente_id` → `clientes`

## profissionais
Colunas: `id`, `empresa_id`, `nome`, `especialidade`, `foto_url`, `comissao_pct`, `aparece_no_link`, `ativo`, `ordem`, `criado_em`

Ligações: `empresa_id` → `empresas`

## Funções do banco (fora as da extensão btree_gist)

Painel: `minha_barbearia`, `minha_empresa`, `acesso_empresa`, `sou_admin_empresa`, `sou_super`, `empresa_liberada`,
`barbearia_cliente`, `barbearia_fechar_atendimento`, `barbearia_saldos`, `barbearia_planos_pendentes`,
`barbearia_confirmar_pagamento_plano`, `barbearia_senha_cliente`, `usar_resgate`, `saldo_pontos`

App do cliente: `link_publico`, `link_horarios`, `link_agendar`, `link_agendar_rapido`, `link_produtos`,
`cliente_cadastrar`, `cliente_entrar`, `cliente_sair`, `cliente_painel`, `cliente_resgatar`,
`cliente_assinar_plano`, `cliente_informar_pagamento_plano`

Site: `site_barbearia`

Plataforma DuoTech: `plataforma_criar_barbearia`, `plataforma_resumo`, `plataforma_uso`, `criar_barbearia`,
`tornar_dono`, `tornar_super`

Proteções (gatilhos): `trg_perfil_protegido` (perfis), `trg_empresa_protegida` (empresas),
`trg_agendamento_pontos` e `tgr_fidelidade` (agendamentos)
