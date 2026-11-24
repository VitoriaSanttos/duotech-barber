-- =====================================================================
--  DuoTech Barber — VERSÃO 14 (gestão e propósito)
--  Projeto Supabase: duotech-barber   ← CONFERIR O NOME NO TOPO!
--  Precisa estar na versão 13. Pode rodar mais de uma vez.
--  Sem senhas, chaves ou tokens.
--
--  O QUE ACRESCENTA (nada do que já existe deixa de funcionar):
--    1. Caixa do dia: abrir, entrada, saída, fechar conferindo a gaveta.
--       O caixa soma TUDO o que entrou no Financeiro enquanto ele estava
--       aberto, inclusive o que a Agenda fecha (barbearia_fechar_atendimento).
--    2. Comanda completa: serviços + produtos, desconto, baixa no estoque,
--       comissão, uso do plano e pontos do clube, tudo de uma vez.
--    3. Meta do mês (com histórico de alterações) e Lucro real.
--    4. Fé no painel: Palavra do dia, Momento da equipe, Meta com propósito
--       e lembrete do dízimo (nada disso aparece no app do cliente).
--    5. Academia: progresso das aulas e "Quero ser parceiro".
--    6. Resumo do Início calculado no banco (só para o administrador).
--
--  A ÚNICA COISA QUE MUDA NO QUE JÁ EXISTE (fica mais aberta, não mais fechada):
--    agendamentos passa a aceitar origem 'comanda' (cliente que chegou sem
--    agendar). Essa comanda não bloqueia a agenda do barbeiro.
--
--  Quem pode o quê:
--    - Caixa, comanda e Academia: toda a equipe com login.
--    - Início com números, Meta, Lucro real e configurações da fé:
--      só o administrador (perfil admin sem profissional ligado).
-- =====================================================================
set client_min_messages = warning;

-- =====================================================================
--  1. TABELAS NOVAS E COLUNAS NOVAS
-- =====================================================================
create table if not exists caixas (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references empresas(id) on delete cascade,
  aberto_em          timestamptz not null default now(),
  aberto_por         uuid,
  troco              numeric(10,2) not null default 0 check (troco >= 0),
  fechado_em         timestamptz,
  fechado_por        uuid,
  esperado_dinheiro  numeric(10,2),
  contado            numeric(10,2),
  observacao         text
);
create unique index if not exists caixas_um_aberto on caixas (empresa_id) where fechado_em is null;

alter table financeiro add column if not exists cliente_id uuid references clientes(id) on delete set null;
alter table financeiro add column if not exists itens      jsonb;
create index if not exists idx_financeiro_empresa_criado on financeiro (empresa_id, criado_em);
alter table servicos   add column if not exists insumo     numeric(10,2) not null default 0;
alter table empresas   add column if not exists meta_ocupacao int not null default 65;

create table if not exists empresas_config (
  empresa_id     uuid primary key references empresas(id) on delete cascade,
  fe             jsonb not null default '{"fe_ativa":true,"fe_lembrete":true,"fe_dizimo":false}'::jsonb,
  profit         jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now()
);
insert into empresas_config (empresa_id) select id from empresas on conflict do nothing;

create table if not exists metas (
  empresa_id     uuid not null references empresas(id) on delete cascade,
  mes            text not null check (mes ~ '^[0-9]{4}-[0-9]{2}$'),
  dados          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now(),
  primary key (empresa_id, mes)
);
create table if not exists metas_historico (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  mes         text not null,
  de          numeric(12,2),
  para        numeric(12,2) not null,
  motivo      text not null check (length(trim(motivo)) > 0),
  por         uuid,
  quando      timestamptz not null default now()
);

create table if not exists academia_progresso (
  perfil_id     uuid not null default auth.uid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  aula_id       text not null check (length(aula_id) <= 80),
  concluida_em  timestamptz not null default now(),
  primary key (perfil_id, aula_id)
);
create table if not exists academia_parceiros (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid references empresas(id) on delete set null,
  perfil_id   uuid default auth.uid(),
  nome        text not null check (length(nome) <= 80),
  whatsapp    text not null check (length(whatsapp) <= 20),
  area        text,
  ideia       text not null check (length(ideia) <= 400),
  criado_em   timestamptz not null default now()
);

-- comanda de balcão (cliente sem horário) não bloqueia a agenda do barbeiro
alter table agendamentos drop constraint if exists agendamentos_origem_check;
alter table agendamentos add  constraint agendamentos_origem_check
  check (origem in ('balcao','link','whatsapp','fila','comanda'));
alter table agendamentos drop constraint if exists agend_sem_conflito_barbeiro;
alter table agendamentos add  constraint agend_sem_conflito_barbeiro exclude using gist (
  empresa_id with =, barbeiro_id with =, tstzrange(inicio, fim) with &&
) where (status not in ('cancelado','faltou') and barbeiro_id is not null and origem <> 'comanda');

-- =====================================================================
--  2. REGRAS DE ACESSO
--  Leitura: toda a equipe da barbearia. Gravação: pelas funções abaixo,
--  que conferem quem pode o quê.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['caixas','empresas_config','metas','metas_historico'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "equipe le" on %I', t);
    execute format('create policy "equipe le" on %I for select to authenticated using (acesso_empresa(empresa_id))', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select on %I to authenticated', t);
    execute format('grant all on %I to service_role', t);
  end loop;
end $$;

alter table academia_progresso enable row level security;
drop policy if exists "o proprio progresso" on academia_progresso;
create policy "o proprio progresso" on academia_progresso for select to authenticated using (perfil_id = auth.uid());
revoke all on academia_progresso from anon;
grant select on academia_progresso to authenticated;
grant all on academia_progresso to service_role;

alter table academia_parceiros enable row level security;
drop policy if exists "super le" on academia_parceiros;
create policy "super le" on academia_parceiros for select to authenticated using (sou_super());
revoke all on academia_parceiros from anon;
grant select on academia_parceiros to authenticated;
grant all on academia_parceiros to service_role;

-- quem é administrador desta barbearia (perfil admin sem profissional ligado)
create or replace function _sou_admin() returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce(minha_empresa() is not null and sou_admin_empresa(minha_empresa()), false);
$$;
revoke execute on function _sou_admin() from public, anon;
grant  execute on function _sou_admin() to authenticated;

-- =====================================================================
--  3. CAIXA
--  O caixa soma o que entrou no Financeiro entre a abertura e o fechamento.
--  Formas: dinheiro, pix, cartao_credito, cartao_debito.
-- =====================================================================
create or replace function _caixa_resumo(p_caixa uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  with c as (select * from caixas where id = p_caixa),
  f as (select f.* from financeiro f, c
        where f.empresa_id = c.empresa_id and f.pago
          and f.criado_em >= c.aberto_em and (c.fechado_em is null or f.criado_em <= c.fechado_em))
  select jsonb_build_object(
    'entradas', coalesce((select sum(valor) from f where tipo = 'entrada'), 0),
    'saidas',   coalesce((select sum(valor) from f where tipo = 'saida'), 0),
    'dinheiro', (select troco from c)
                + coalesce((select sum(valor) from f where tipo = 'entrada' and forma = 'dinheiro'), 0)
                - coalesce((select sum(valor) from f where tipo = 'saida'   and forma = 'dinheiro'), 0),
    'pix',      coalesce((select sum(case when tipo = 'entrada' then valor else -valor end) from f where forma = 'pix'), 0),
    'credito',  coalesce((select sum(valor) from f where tipo = 'entrada' and forma in ('cartao_credito','credito')), 0),
    'debito',   coalesce((select sum(valor) from f where tipo = 'entrada' and forma in ('cartao_debito','debito')), 0));
$$;
revoke execute on function _caixa_resumo(uuid) from public, anon, authenticated;

create or replace function caixa_atual() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v_c caixas;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  select * into v_c from caixas where empresa_id = v_emp and fechado_em is null;
  return jsonb_build_object(
    'aberto', v_c.id is not null,
    'caixa', case when v_c.id is null then null else to_jsonb(v_c) end,
    'resumo', case when v_c.id is null then null else _caixa_resumo(v_c.id) end,
    'movs', case when v_c.id is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'tipo', f.tipo, 'cat', f.categoria,
               'desc', coalesce(f.descricao, f.categoria), 'forma', f.forma, 'valor', f.valor,
               'comanda', f.categoria = 'Atendimento',
               'hora', to_char(f.criado_em at time zone 'America/Sao_Paulo', 'HH24:MI')) order by f.criado_em desc)
        from financeiro f where f.empresa_id = v_emp and f.pago and f.criado_em >= v_c.aberto_em), '[]'::jsonb) end,
    'historico', coalesce((select jsonb_agg(jsonb_build_object('data', h.aberto_em, 'esperado', h.esperado_dinheiro,
              'contado', h.contado, 'total', (_caixa_resumo(h.id)->>'entradas')::numeric) order by h.aberto_em desc)
            from (select * from caixas where empresa_id = v_emp and fechado_em is not null
                  order by aberto_em desc limit 10) h), '[]'::jsonb));
end $$;

create or replace function caixa_abrir(p_troco numeric) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa();
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if coalesce(p_troco, -1) < 0 then return jsonb_build_object('erro', 'Informe o troco da gaveta.'); end if;
  if exists (select 1 from caixas where empresa_id = v_emp and fechado_em is null) then
    return jsonb_build_object('erro', 'O caixa já está aberto.');
  end if;
  insert into caixas (empresa_id, troco, aberto_por) values (v_emp, round(p_troco, 2), auth.uid());
  return jsonb_build_object('ok', true);
end $$;

create or replace function caixa_lancar(p_tipo text, p_categoria text, p_descricao text, p_forma text, p_valor numeric) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa();
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if p_tipo not in ('entrada','saida') then return jsonb_build_object('erro', 'Tipo inválido.'); end if;
  if p_forma not in ('dinheiro','pix','cartao_credito','cartao_debito') then return jsonb_build_object('erro', 'Forma de pagamento inválida.'); end if;
  if coalesce(p_valor, 0) <= 0 then return jsonb_build_object('erro', 'Informe o valor.'); end if;
  if not exists (select 1 from caixas where empresa_id = v_emp and fechado_em is null) then
    return jsonb_build_object('erro', 'Abra o caixa antes de lançar.');
  end if;
  insert into financeiro (empresa_id, tipo, categoria, descricao, valor, forma, pago)
  values (v_emp, p_tipo, left(coalesce(nullif(trim(p_categoria), ''), 'Outros'), 40),
          left(nullif(trim(p_descricao), ''), 120), round(p_valor, 2), p_forma, true);
  return jsonb_build_object('ok', true);
end $$;

create or replace function caixa_fechar(p_contado numeric, p_obs text default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v_c caixas; v_esp numeric;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if coalesce(p_contado, -1) < 0 then return jsonb_build_object('erro', 'Conte o dinheiro da gaveta e informe o valor.'); end if;
  select * into v_c from caixas where empresa_id = v_emp and fechado_em is null for update;
  if v_c.id is null then return jsonb_build_object('erro', 'O caixa já está fechado.'); end if;
  v_esp := (_caixa_resumo(v_c.id)->>'dinheiro')::numeric;
  update caixas set fechado_em = now(), fechado_por = auth.uid(), esperado_dinheiro = v_esp,
                    contado = round(p_contado, 2), observacao = left(p_obs, 300)
  where id = v_c.id;
  return jsonb_build_object('ok', true, 'esperado', v_esp, 'diferenca', round(p_contado, 2) - v_esp);
end $$;

-- =====================================================================
--  4. COMANDA COMPLETA
--  p: {agendamento_id?, cliente_id? | cliente_nome + cliente_whatsapp?, barbeiro_id?,
--      itens:[{tipo:'servico'|'produto', id, preco, qtd}], desconto, forma}
--  forma: dinheiro, pix, cartao_credito, cartao_debito, plano, cortesia
-- =====================================================================
create or replace function barbearia_comanda(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_emp   uuid := minha_empresa();
  v_forma text := p->>'forma';
  v_desc  numeric := round(coalesce((p->>'desconto')::numeric, 0), 2);
  v_ag    agendamentos;
  v_cli   uuid := nullif(p->>'cliente_id', '')::uuid;
  v_barb  uuid := nullif(p->>'barbeiro_id', '')::uuid;
  v_item  jsonb;
  v_serv  numeric := 0;
  v_prod  numeric := 0;
  v_dur   int := 0;
  v_nomes text[] := '{}';
  v_itens jsonb := '[]'::jsonb;
  v_total numeric;
  v_pct   numeric;
  v_pctp  numeric;
  v_com   numeric := 0;
  v_uso   planos_cliente_usos;
  v_plano planos_cliente;
  v_s     servicos;
  v_pr    produtos;
  v_qtd   numeric;
  v_preco numeric;
  v_wa    text;
  v_mes   text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if v_forma is null or v_forma not in ('dinheiro','pix','cartao_credito','cartao_debito','plano','cortesia') then
    return jsonb_build_object('erro', 'Escolha a forma de pagamento.');
  end if;
  if jsonb_typeof(p->'itens') is distinct from 'array' or jsonb_array_length(p->'itens') = 0 then
    return jsonb_build_object('erro', 'Adicione pelo menos um serviço ou produto.');
  end if;
  if v_desc < 0 then return jsonb_build_object('erro', 'Desconto inválido.'); end if;

  for v_item in select * from jsonb_array_elements(p->'itens') loop
    v_qtd   := greatest(coalesce((v_item->>'qtd')::numeric, 1), 1);
    v_preco := round(coalesce((v_item->>'preco')::numeric, -1), 2);
    if v_preco < 0 then return jsonb_build_object('erro', 'Preço inválido em um dos itens.'); end if;
    if v_item->>'tipo' = 'produto' then
      select * into v_pr from produtos where id = (v_item->>'id')::uuid and empresa_id = v_emp;
      if v_pr.id is null then return jsonb_build_object('erro', 'Produto não encontrado.'); end if;
      v_prod := v_prod + v_preco * v_qtd;  v_nomes := v_nomes || v_pr.nome;
      v_itens := v_itens || jsonb_build_object('tipo','produto','id',v_pr.id,'nome',v_pr.nome,'preco',v_preco,'qtd',v_qtd);
    else
      select * into v_s from servicos where id = (v_item->>'id')::uuid and empresa_id = v_emp;
      if v_s.id is null then return jsonb_build_object('erro', 'Serviço não encontrado.'); end if;
      v_serv := v_serv + v_preco * v_qtd;  v_dur := v_dur + v_s.duracao_min * v_qtd::int;  v_nomes := v_nomes || v_s.nome;
      v_itens := v_itens || jsonb_build_object('tipo','servico','id',v_s.id,'nome',v_s.nome,'categoria',v_s.categoria,'preco',v_preco,'qtd',v_qtd);
    end if;
  end loop;

  if nullif(p->>'agendamento_id', '') is not null then
    select * into v_ag from agendamentos where id = (p->>'agendamento_id')::uuid and empresa_id = v_emp for update;
    if v_ag.id is null then return jsonb_build_object('erro', 'Agendamento não encontrado.'); end if;
    if v_ag.status = 'concluido' and v_ag.pago then return jsonb_build_object('erro', 'Este atendimento já foi fechado.'); end if;
    if v_ag.status in ('cancelado','faltou') then return jsonb_build_object('erro', 'Este agendamento está cancelado.'); end if;
    v_cli  := coalesce(v_cli, v_ag.cliente_id);
    v_barb := coalesce(v_barb, v_ag.barbeiro_id);
  end if;

  -- cliente escolhido, achado pelo WhatsApp (sem o 55, como no resto do sistema) ou cadastrado agora
  if v_cli is not null then
    if not exists (select 1 from clientes where id = v_cli and empresa_id = v_emp) then
      return jsonb_build_object('erro', 'Cliente não encontrado.');
    end if;
  elsif length(trim(coalesce(p->>'cliente_nome', ''))) >= 2 then
    v_wa := _fone(p->>'cliente_whatsapp');
    if v_wa <> '' then select id into v_cli from clientes where empresa_id = v_emp and whatsapp = v_wa; end if;
    if v_cli is null then
      insert into clientes (empresa_id, nome, whatsapp, origem)
      values (v_emp, left(trim(p->>'cliente_nome'), 80), nullif(v_wa, ''), 'balcao') returning id into v_cli;
    end if;
  end if;

  if v_barb is not null and not exists (select 1 from profissionais where id = v_barb and empresa_id = v_emp) then
    return jsonb_build_object('erro', 'Profissional não encontrado.');
  end if;

  v_total := greatest(v_serv + v_prod - v_desc, 0);

  if v_forma = 'plano' then
    if v_cli is null then return jsonb_build_object('erro', 'Escolha o cliente do plano.'); end if;
    select * into v_uso from planos_cliente_usos
     where empresa_id = v_emp and cliente_id = v_cli and status = 'ativo' order by criado_em desc limit 1 for update;
    if v_uso.id is null then return jsonb_build_object('erro', 'Este cliente não tem plano ativo.'); end if;
    select * into v_plano from planos_cliente where id = v_uso.plano_id;
    if v_uso.mes_referencia is distinct from v_mes then v_uso.cortes_usados_mes := 0; end if;
    if v_plano.cortes_mes > 0 and v_uso.cortes_usados_mes >= v_plano.cortes_mes then
      return jsonb_build_object('erro', 'O plano deste cliente já usou todos os atendimentos do mês.');
    end if;
    update planos_cliente_usos set cortes_usados_mes = v_uso.cortes_usados_mes + 1, mes_referencia = v_mes where id = v_uso.id;
    v_total := 0;
  elsif v_forma = 'cortesia' then
    v_total := 0;
  end if;

  -- comissão: % do profissional nos serviços (como na Agenda) e % de produto do Lucro real nos produtos.
  -- Atendimento pelo plano ou cortesia não gera comissão aqui.
  if v_barb is not null and v_forma not in ('plano','cortesia') then
    select coalesce(nullif((select pct_padrao from comissao_config where empresa_id = v_emp and barbeiro_id = v_barb), 0), comissao_pct, 0)
      into v_pct from profissionais where id = v_barb;
    select coalesce((profit->'premissas'->>'barb_produto')::numeric, 0) into v_pctp from empresas_config where empresa_id = v_emp;
    v_com := round((v_serv * coalesce(v_pct, 0) + v_prod * coalesce(v_pctp, 0)) / 100
                   * case when v_serv + v_prod > 0 then v_total / (v_serv + v_prod) else 0 end, 2);
  end if;

  if v_ag.id is not null then
    update agendamentos set status = 'concluido', pago = true, cliente_id = v_cli, barbeiro_id = v_barb,
           preco = v_serv + v_prod,
           desconto = case when v_forma in ('plano','cortesia') then 0 else least(v_desc, v_serv + v_prod) end,
           servico_nome = left(array_to_string(v_nomes, ' + '), 200), forma_pagamento = v_forma,
           plano_cliente_id = case when v_forma = 'plano' then v_uso.id else plano_cliente_id end
    where id = v_ag.id returning * into v_ag;
  else
    insert into agendamentos (empresa_id, cliente_id, servico_nome, barbeiro_id, inicio, fim, preco, desconto,
                              status, origem, forma_pagamento, pago, plano_cliente_id)
    values (v_emp, v_cli, left(array_to_string(v_nomes, ' + '), 200), v_barb,
            now() - make_interval(mins => greatest(v_dur, 15)), now(), v_serv + v_prod,
            case when v_forma in ('plano','cortesia') then 0 else least(v_desc, v_serv + v_prod) end,
            'concluido', 'comanda', v_forma, true, case when v_forma = 'plano' then v_uso.id end)
    returning * into v_ag;
  end if;

  update produtos pr set estoque_atual = pr.estoque_atual - x.qtd
  from (select (i->>'id')::uuid id, sum((i->>'qtd')::numeric) qtd from jsonb_array_elements(v_itens) i
        where i->>'tipo' = 'produto' group by 1) x
  where pr.id = x.id and pr.empresa_id = v_emp;

  if v_total > 0 then
    insert into financeiro (empresa_id, tipo, categoria, descricao, valor, forma, pago,
                            barbeiro_id, comissao_valor, agendamento_id, cliente_id, itens)
    values (v_emp, 'entrada', 'Atendimento',
            left(array_to_string(v_nomes, ' + ') || ' — ' || coalesce((select nome from clientes where id = v_cli), 'Cliente'), 200),
            v_total, v_forma, true, v_barb, v_com, v_ag.id, v_cli, v_itens);
  end if;

  return jsonb_build_object('ok', true, 'agendamento_id', v_ag.id, 'total', v_total, 'comissao', v_com, 'cliente_id', v_cli,
    'pontos', (select coalesce(sum(pontos), 0) from pontos_mov where agendamento_id = v_ag.id));
end $$;

-- =====================================================================
--  5. META DO MÊS, LUCRO REAL E CONFIGURAÇÕES DA FÉ (só administrador)
-- =====================================================================
create or replace function painel_config() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa();
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  return jsonb_build_object('admin', _sou_admin(),
    'config', coalesce((select to_jsonb(c) - 'empresa_id' from empresas_config c where c.empresa_id = v_emp),
                       jsonb_build_object('fe', '{"fe_ativa":true,"fe_lembrete":true,"fe_dizimo":false}'::jsonb, 'profit', '{}'::jsonb)),
    'meta_ocupacao', (select meta_ocupacao from empresas where id = v_emp),
    'horarios', (select horarios from empresas where id = v_emp));
end $$;

create or replace function painel_salvar_config(p_fe jsonb default null, p_profit jsonb default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa();
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if not _sou_admin() then return jsonb_build_object('erro', 'Só o administrador altera estas configurações.'); end if;
  insert into empresas_config (empresa_id) values (v_emp) on conflict do nothing;
  update empresas_config set
    fe = case when jsonb_typeof(p_fe) = 'object' then fe || p_fe else fe end,
    profit = case when jsonb_typeof(p_profit) = 'object' then p_profit else profit end,
    atualizado_em = now()
  where empresa_id = v_emp;
  return jsonb_build_object('ok', true);
end $$;

-- preço e insumo dos serviços, preço e custo dos produtos (só o campo enviado muda)
create or replace function painel_salvar_custos(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v jsonb;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if not _sou_admin() then return jsonb_build_object('erro', 'Só o administrador altera preços e custos.'); end if;
  for v in select * from jsonb_array_elements(coalesce(p->'servicos', '[]'::jsonb)) loop
    update servicos set
      preco  = case when v ? 'preco'  and v->>'preco'  is not null then greatest((v->>'preco')::numeric, 0)  else preco  end,
      insumo = case when v ? 'insumo' and v->>'insumo' is not null then greatest((v->>'insumo')::numeric, 0) else insumo end
    where id = (v->>'id')::uuid and empresa_id = v_emp;
  end loop;
  for v in select * from jsonb_array_elements(coalesce(p->'produtos', '[]'::jsonb)) loop
    update produtos set
      preco_venda = case when v ? 'venda' and v->>'venda' is not null then greatest((v->>'venda')::numeric, 0) else preco_venda end,
      preco_custo = case when v ? 'custo' and v->>'custo' is not null then greatest((v->>'custo')::numeric, 0) else preco_custo end
    where id = (v->>'id')::uuid and empresa_id = v_emp;
  end loop;
  return jsonb_build_object('ok', true);
end $$;

create or replace function meta_ler(p_mes text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa();
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  return jsonb_build_object(
    'dados', (select dados from metas where empresa_id = v_emp and mes = p_mes),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('quando', quando, 'de', de, 'para', para, 'motivo', motivo) order by quando desc)
                  from metas_historico where empresa_id = v_emp and mes = p_mes), '[]'::jsonb));
end $$;

create or replace function meta_salvar(p_mes text, p_dados jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa();
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if not _sou_admin() then return jsonb_build_object('erro', 'Só o administrador altera a meta.'); end if;
  if p_mes !~ '^[0-9]{4}-[0-9]{2}$' or jsonb_typeof(p_dados) is distinct from 'object' then return jsonb_build_object('erro', 'Dados inválidos.'); end if;
  insert into metas (empresa_id, mes, dados) values (v_emp, p_mes, p_dados - 'historico')
  on conflict (empresa_id, mes) do update set dados = excluded.dados, atualizado_em = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function meta_calibrar(p_mes text, p_meta numeric, p_motivo text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v_de numeric;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if not _sou_admin() then return jsonb_build_object('erro', 'Só o administrador altera a meta.'); end if;
  if nullif(trim(p_motivo), '') is null then return jsonb_build_object('erro', 'Escreva o motivo da alteração.'); end if;
  if coalesce(p_meta, 0) <= 0 then return jsonb_build_object('erro', 'A meta não pode ser zero.'); end if;
  select (dados->>'meta')::numeric into v_de from metas where empresa_id = v_emp and mes = p_mes;
  insert into metas (empresa_id, mes, dados) values (v_emp, p_mes, jsonb_build_object('meta', p_meta))
  on conflict (empresa_id, mes) do update set dados = metas.dados || jsonb_build_object('meta', p_meta), atualizado_em = now();
  insert into metas_historico (empresa_id, mes, de, para, motivo, por) values (v_emp, p_mes, v_de, p_meta, left(trim(p_motivo), 200), auth.uid());
  return jsonb_build_object('ok', true);
end $$;

create or replace function meta_desfazer(p_mes text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v_h metas_historico;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if not _sou_admin() then return jsonb_build_object('erro', 'Só o administrador altera a meta.'); end if;
  select * into v_h from metas_historico where empresa_id = v_emp and mes = p_mes order by quando desc limit 1;
  if v_h.id is null then return jsonb_build_object('erro', 'Não há alteração para desfazer.'); end if;
  update metas set dados = case when v_h.de is null then dados - 'meta' else dados || jsonb_build_object('meta', v_h.de) end,
                   atualizado_em = now()
  where empresa_id = v_emp and mes = p_mes;
  delete from metas_historico where id = v_h.id;
  return jsonb_build_object('ok', true);
end $$;

-- =====================================================================
--  6. ACADEMIA
-- =====================================================================
create or replace function academia_ler() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(aula_id), '[]'::jsonb) from academia_progresso where perfil_id = auth.uid();
$$;

create or replace function academia_concluir(p_aula text, p_feito boolean) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa();
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if p_feito then
    insert into academia_progresso (perfil_id, empresa_id, aula_id) values (auth.uid(), v_emp, left(p_aula, 80)) on conflict do nothing;
  else
    delete from academia_progresso where perfil_id = auth.uid() and aula_id = p_aula;
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function academia_quero_ser_parceiro(p_nome text, p_whatsapp text, p_area text, p_ideia text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa();
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if nullif(trim(p_nome),'') is null or nullif(trim(p_whatsapp),'') is null or nullif(trim(p_ideia),'') is null then
    return jsonb_build_object('erro', 'Preencha nome, WhatsApp e a ideia do curso.');
  end if;
  if (select count(*) from academia_parceiros where perfil_id = auth.uid() and criado_em > now() - interval '1 day') >= 5 then
    return jsonb_build_object('erro', 'Recebemos as suas ideias de hoje. Obrigado!');
  end if;
  insert into academia_parceiros (empresa_id, perfil_id, nome, whatsapp, area, ideia)
  values (v_emp, auth.uid(), left(trim(p_nome), 80), left(trim(p_whatsapp), 20), left(p_area, 40), left(trim(p_ideia), 400));
  return jsonb_build_object('ok', true);
end $$;

-- =====================================================================
--  7. RESUMO DO INÍCIO, DA META E DO LUCRO REAL (só administrador)
--  Calculado no banco para não esbarrar no limite de 1.000 linhas.
--  Datas no horário de Brasília.
-- =====================================================================
create or replace function painel_resumo() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_emp   uuid := minha_empresa();
  v_e     empresas;
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini   date := date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date;
  v_ant   date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) - interval '1 month')::date;
  v_nprof int;
  v_r     jsonb;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if not _sou_admin() then return jsonb_build_object('erro', 'Só o administrador vê os números da barbearia.'); end if;
  select * into v_e from empresas where id = v_emp;
  select greatest(count(*), 1) into v_nprof from profissionais where empresa_id = v_emp and ativo;

  with
  fin as (
    select f.data, f.tipo, f.valor, f.categoria, f.itens, f.agendamento_id from financeiro f
    where f.empresa_id = v_emp and f.pago and f.data >= (v_ini - interval '6 months')::date
  ),
  ag as (
    select a.*, (a.inicio at time zone 'America/Sao_Paulo') li, (a.fim at time zone 'America/Sao_Paulo') lf
    from agendamentos a where a.empresa_id = v_emp and a.inicio >= (v_ini - interval '6 months') and a.status not in ('cancelado','faltou')
  ),
  -- planos ativados (1ª mensalidade) por dia: o resto do "Plano mensal" do dia é renovação
  novos as (
    select u.inicio dia, sum(p.preco) valor, count(*) n from planos_cliente_usos u join planos_cliente p on p.id = u.plano_id
    where u.empresa_id = v_emp and u.status <> 'aguardando_pagamento' and u.ultimo_pagamento is not null and u.inicio >= v_ant group by 1
  ),
  slots as (
    select d::date dia, extract(dow from d)::int dow, h,
           (select coalesce(sum(greatest(0, extract(epoch from (least((d::date + make_time(h+1,0,0)), (d::date + (iv->>1)::time))
                                                               - greatest((d::date + make_time(h,0,0)), (d::date + (iv->>0)::time)))) / 60)), 0)
            from jsonb_array_elements(coalesce(v_e.horarios -> extract(dow from d)::int::text, '[]'::jsonb)) iv) * v_nprof cap
    from generate_series(v_ant, v_hoje, interval '1 day') d, generate_series(6, 22) h
  ),
  ocup as (
    select s.dia, s.dow, s.h, s.cap,
           coalesce((select sum(extract(epoch from (least(a.lf, s.dia + make_time(s.h+1,0,0)) - greatest(a.li, s.dia + make_time(s.h,0,0)))) / 60)
                     from ag a where a.li < s.dia + make_time(s.h+1,0,0) and a.lf > s.dia + make_time(s.h,0,0)), 0) usado
    from slots s where s.cap > 0
  ),
  primeira as (
    select cliente_id, min((inicio at time zone 'America/Sao_Paulo')::date) primeira
    from agendamentos where empresa_id = v_emp and status = 'concluido' and cliente_id is not null group by 1
  ),
  -- itens vendidos: os da comanda completa; os da Agenda vêm do serviço do agendamento
  itens as (
    select f.data, i->>'tipo' tipo, i->>'id' id, i->>'categoria' categoria,
           (i->>'preco')::numeric * (i->>'qtd')::numeric valor, (i->>'qtd')::numeric qtd
    from fin f, jsonb_array_elements(f.itens) i where f.categoria = 'Atendimento' and f.itens is not null
    union all
    select f.data, 'servico', s.id::text, s.categoria, f.valor, 1
    from fin f join agendamentos a on a.id = f.agendamento_id left join servicos s on s.id = a.servico_id
    where f.categoria = 'Atendimento' and f.itens is null and f.tipo = 'entrada'
  )
  select jsonb_build_object(
    'hoje', v_hoje,
    'faturamento_mes', (select coalesce(sum(valor), 0) from fin where tipo = 'entrada' and data >= v_ini),
    'faturamento_mes_passado', (select coalesce(sum(valor), 0) from fin where tipo = 'entrada' and data >= v_ant and data < v_ini),
    'acumulado_ano', (select coalesce(sum(valor), 0) from financeiro where empresa_id = v_emp and pago and tipo = 'entrada'
                       and data >= date_trunc('year', (now() at time zone 'America/Sao_Paulo'))::date),
    'atendimentos_mes', (select count(*) from ag where status = 'concluido' and li::date >= v_ini),
    'ocupacao', (select case when sum(cap) > 0 then round(sum(least(usado, cap)) / sum(cap) * 100, 1) else 0 end
                 from ocup where dia >= v_ini and dia <= v_hoje),
    'meta_ocupacao', v_e.meta_ocupacao,
    'heatmap', (select coalesce(jsonb_object_agg(dow || '-' || h, pct), '{}'::jsonb) from (
                 select dow, h, round(sum(least(usado, cap)) / nullif(sum(cap), 0) * 100) pct
                 from ocup where dia > v_hoje - 30 and dia < v_hoje group by dow, h) x),
    'planos_ativos', (select count(*) from planos_cliente_usos where empresa_id = v_emp and status = 'ativo'),
    'planos_vendidos_mes', (select coalesce(sum(n), 0) from novos where dia >= v_ini),
    'planos_cancelados_mes', (select count(*) from planos_cliente_usos where empresa_id = v_emp and status = 'cancelado'
                              and coalesce(fim, (criado_em at time zone 'America/Sao_Paulo')::date) >= v_ini),
    'mensalidades_ativas', (select coalesce(sum(p.preco), 0) from planos_cliente_usos u join planos_cliente p on p.id = u.plano_id
                            where u.empresa_id = v_emp and u.status = 'ativo'),
    'assinantes', (select coalesce(jsonb_object_agg(plano_id, n), '{}'::jsonb) from (
                     select plano_id, count(*) n from planos_cliente_usos where empresa_id = v_emp and status = 'ativo' group by 1) x),
    'comandas_abertas', (select count(*) from ag where status = 'em_atendimento'),
    'comandas_outros_dias', (select count(*) from ag where status = 'em_atendimento' and li::date < v_hoje),
    'dias', (select coalesce(jsonb_agg(jsonb_build_object('data', d.data, 'comandas', d.cmd,
               'novas', coalesce(n.valor, 0), 'assin', greatest(d.plano - coalesce(n.valor, 0), 0)) order by d.data), '[]'::jsonb)
             from (select data, coalesce(sum(valor) filter (where categoria <> 'Plano mensal'), 0) cmd,
                          coalesce(sum(valor) filter (where categoria = 'Plano mensal'), 0) plano
                   from fin where tipo = 'entrada' and data >= v_ant group by data) d
             left join novos n on n.dia = d.data),
    'meses', (select coalesce(jsonb_agg(m order by m->>'mes'), '[]'::jsonb) from (
               select jsonb_build_object('mes', to_char(mm, 'YYYY-MM'),
                 'fat', (select coalesce(sum(valor), 0) from fin where tipo = 'entrada' and date_trunc('month', data) = mm),
                 'atend', (select count(*) from ag where status = 'concluido' and date_trunc('month', li) = mm),
                 'novos', (select count(*) from primeira where date_trunc('month', primeira) = mm),
                 'clientes', (select count(distinct cliente_id) from ag where status = 'concluido' and date_trunc('month', li) = mm)) m
               from generate_series(v_ini - interval '5 months', v_ini, interval '1 month') mm) y),
    'mix_mes', (select jsonb_build_object(
                  'avulsos',  coalesce(sum(valor) filter (where tipo = 'servico' and categoria in ('corte','barba','combo')), 0),
                  'extras',   coalesce(sum(valor) filter (where tipo = 'servico' and coalesce(categoria, '') not in ('corte','barba','combo')), 0),
                  'produtos', coalesce(sum(valor) filter (where tipo = 'produto'), 0))
                from itens where data >= v_ini),
    'vendidos_30d', (select coalesce(jsonb_object_agg(id, n), '{}'::jsonb) from (
                      select id, sum(qtd) n from itens where data > v_hoje - 30 and id is not null group by 1) x),
    'pix_conferir', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'nome', c.nome, 'whatsapp', c.whatsapp, 'plano', p.nome,
                       'valor', p.preco, 'quando', coalesce(u.pagamento_informado_em, u.criado_em),
                       'disse_que_pagou', u.pagamento_informado_em is not null, 'novo', u.status = 'aguardando_pagamento')
                       order by coalesce(u.pagamento_informado_em, u.criado_em) desc), '[]'::jsonb)
                     from planos_cliente_usos u join clientes c on c.id = u.cliente_id join planos_cliente p on p.id = u.plano_id
                     where u.empresa_id = v_emp and (u.status = 'aguardando_pagamento' or u.pagamento_informado_em is not null)),
    'mensalidade_aberta', (select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'nome', c.nome, 'tel', c.whatsapp, 'plano', p.nome,
                       'dias', v_hoje - u.proximo_vencimento) order by u.proximo_vencimento), '[]'::jsonb)
                     from planos_cliente_usos u join clientes c on c.id = u.cliente_id join planos_cliente p on p.id = u.plano_id
                     where u.empresa_id = v_emp and u.status = 'ativo' and u.proximo_vencimento < v_hoje and u.pagamento_informado_em is null),
    'estoque_minimo', (select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'atual', estoque_atual, 'min', estoque_minimo)
                       order by estoque_atual - estoque_minimo), '[]'::jsonb)
                     from produtos where empresa_id = v_emp and ativo and estoque_minimo > 0 and estoque_atual <= estoque_minimo)
  ) into v_r;
  return v_r;
end $$;

-- =====================================================================
--  QUEM PODE CHAMAR O QUÊ
-- =====================================================================
do $$
declare f text;
begin
  foreach f in array array['caixa_atual()','caixa_abrir(numeric)','caixa_lancar(text,text,text,text,numeric)',
      'caixa_fechar(numeric,text)','barbearia_comanda(jsonb)','painel_config()','painel_salvar_config(jsonb,jsonb)',
      'painel_salvar_custos(jsonb)','meta_ler(text)','meta_salvar(text,jsonb)','meta_calibrar(text,numeric,text)',
      'meta_desfazer(text)','academia_ler()',
      'academia_concluir(text,boolean)','academia_quero_ser_parceiro(text,text,text,text)','painel_resumo()'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- =====================================================================
--  CONFERIR DEPOIS DE RODAR
--  select caixa_atual();          -- logado no painel
--  select count(*) from empresas_config;   -- uma linha por barbearia
-- =====================================================================
