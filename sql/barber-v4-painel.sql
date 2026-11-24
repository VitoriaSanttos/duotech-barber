-- =====================================================================
--  DuoTech Barber — VERSÃO 4  (barber-v4-painel.sql)
--  Liga o PAINEL da barbearia ao banco.
--
--  O QUE ESTE ARQUIVO FAZ (só ACRESCENTA, não apaga dados):
--    0. CORREÇÃO DE SEGURANÇA: um administrador conseguia se transformar em
--       "super" e ver todas as barbearias. Agora não consegue.
--    1. Barbeiros sem login (Everton, Wesley...) e unidades (filiais)
--    2. Comanda: fechar atendimento grava agenda, financeiro, caixa, pontos,
--       estoque e comissão de uma vez só
--    3. Caixa do dia: abrir, entrada, saída, fechar com conferência
--    4. Meta do mês, configurações de fé e do Lucro real
--    5. Pedidos de oração (o cliente pede pelo app; a equipe vê no painel)
--    6. Academia: progresso das aulas e "Quero ser parceiro"
--    7. Resumo do painel (Início, Meta, Lucro real) calculado no banco
--    8. Agenda, clientes e gravações do painel (tudo por funções que
--       conferem se quem chama é da barbearia)
--
--  COMO RODAR:
--    Projeto Supabase: duotech-barber   ← CONFERIR O NOME NO TOPO!
--    NUNCA rodar no projeto do DuoTech Beauty.
--    Precisa ter rodado antes: schema-barber.sql e barber-v3-thiago-prado.sql.
--    SQL Editor → New query → cole tudo → Run. Pode rodar mais de uma vez.
--
--  Sem senhas, chaves ou tokens neste arquivo.
-- =====================================================================

set client_min_messages = warning;

-- =====================================================================
--  0. SEGURANÇA DOS PERFIS
--  A regra antiga deixava o administrador mudar o próprio "tipo" para
--  'super'. A trava abaixo vale para quem entra pelo painel (papel
--  authenticated); o SQL Editor do Supabase continua podendo tudo.
-- =====================================================================
create or replace function trg_perfis_protege() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if current_user in ('authenticated', 'anon') and not sou_super() then
    if new.tipo = 'super' then
      raise exception 'Sem permissão para este tipo de acesso';
    end if;
    if tg_op = 'UPDATE' and new.empresa_id is distinct from old.empresa_id then
      raise exception 'Sem permissão para mudar a barbearia do perfil';
    end if;
    if tg_op = 'UPDATE' and new.id = auth.uid() and new.tipo is distinct from old.tipo then
      raise exception 'Você não pode mudar o seu próprio tipo de acesso';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_perfis_protege on perfis;
create trigger trg_perfis_protege before insert or update on perfis
  for each row execute function trg_perfis_protege();

-- =====================================================================
--  1. BARBEIROS SEM LOGIN E UNIDADES
--  Antes, todo perfil precisava ser um login. Barbeiro que só aparece na
--  agenda não precisa: vira tipo 'barbeiro', sem acesso ao painel.
-- =====================================================================
alter table perfis drop constraint if exists perfis_id_fkey;
alter table perfis alter column id set default gen_random_uuid();
alter table perfis drop constraint if exists perfis_tipo_check;
alter table perfis add  constraint perfis_tipo_check check (tipo in ('super','admin','barbeiro'));

create table if not exists unidades (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nome        text not null,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);
insert into unidades (empresa_id, nome)
select e.id, 'Centro' from empresas e
where not exists (select 1 from unidades u where u.empresa_id = e.id);

create or replace function _unidade_padrao(p_emp uuid) returns uuid
language sql stable security definer set search_path to 'public' as $$
  select id from unidades where empresa_id = p_emp and ativo order by criado_em limit 1;
$$;
revoke execute on function _unidade_padrao(uuid) from public, anon;

alter table empresas     add column if not exists meta_ocupacao int not null default 65;
alter table servicos     add column if not exists insumo        numeric(10,2) not null default 0;
alter table agendamentos add column if not exists unidade_id    uuid references unidades(id) on delete set null;
alter table agendamentos add column if not exists chegou_em     timestamptz;
alter table agendamentos add column if not exists avaliacao     smallint check (avaliacao between 1 and 5);

-- comanda de balcão (cliente que chegou sem agendar) não bloqueia a agenda
alter table agendamentos drop constraint if exists agendamentos_origem_check;
alter table agendamentos add  constraint agendamentos_origem_check
  check (origem in ('balcao','link','whatsapp','fila','comanda'));
alter table agendamentos drop constraint if exists agend_sem_conflito_barbeiro;
alter table agendamentos add  constraint agend_sem_conflito_barbeiro exclude using gist (
  empresa_id with =, barbeiro_id with =, tstzrange(inicio, fim) with &&
) where (status not in ('cancelado','faltou') and barbeiro_id is not null and origem <> 'comanda');

-- =====================================================================
--  2. CAIXA E FINANCEIRO
-- =====================================================================
create table if not exists caixas (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references empresas(id) on delete cascade,
  unidade_id         uuid not null references unidades(id) on delete cascade,
  aberto_em          timestamptz not null default now(),
  aberto_por         uuid,
  troco              numeric(10,2) not null default 0 check (troco >= 0),
  fechado_em         timestamptz,
  fechado_por        uuid,
  esperado_dinheiro  numeric(10,2),
  contado            numeric(10,2),
  observacao         text
);
create unique index if not exists caixas_um_aberto on caixas (unidade_id) where fechado_em is null;

alter table financeiro add column if not exists caixa_id   uuid references caixas(id) on delete set null;
alter table financeiro add column if not exists unidade_id uuid references unidades(id) on delete set null;
alter table financeiro add column if not exists cliente_id uuid references clientes(id) on delete set null;
alter table financeiro add column if not exists itens      jsonb;
alter table financeiro add column if not exists origem     text not null default 'manual';
alter table financeiro drop constraint if exists financeiro_origem_check;
alter table financeiro add  constraint financeiro_origem_check
  check (origem in ('comanda','manual','plano_novo','plano_renovacao','plano_uso'));
create index if not exists idx_financeiro_caixa on financeiro (caixa_id);

-- =====================================================================
--  3. CONFIGURAÇÕES, METAS, ORAÇÃO E ACADEMIA
-- =====================================================================
create table if not exists empresas_config (
  empresa_id     uuid primary key references empresas(id) on delete cascade,
  fe             jsonb not null default '{"fe_ativa":true,"fe_app_cliente":true,"fe_lembrete":true,"fe_fila":true,"fe_dizimo":false}'::jsonb,
  profit         jsonb not null default '{}'::jsonb,   -- premissas e custos fixos do Lucro real
  atualizado_em  timestamptz not null default now()
);
insert into empresas_config (empresa_id) select id from empresas on conflict do nothing;

create table if not exists metas (
  empresa_id     uuid not null references empresas(id) on delete cascade,
  mes            text not null check (mes ~ '^[0-9]{4}-[0-9]{2}$'),
  dados          jsonb not null default '{}'::jsonb,   -- meta, inad, churn, novas, mix, campanhas, proposito
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

create table if not exists pedidos_oracao (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  cliente_id  uuid references clientes(id) on delete set null,
  nome        text,
  anonimo     boolean not null default false,
  texto       text not null check (length(texto) between 3 and 500),
  criado_em   timestamptz not null default now(),
  orado_em    timestamptz,
  orado_por   uuid
);
create index if not exists idx_pedidos_oracao on pedidos_oracao (empresa_id, criado_em desc);

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

-- regras de acesso: a equipe vê e mexe só no que é da própria barbearia
do $$
declare t text;
begin
  foreach t in array array['unidades','caixas','empresas_config','metas','metas_historico','pedidos_oracao'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "acesso empresa" on %I', t);
    execute format('create policy "acesso empresa" on %I for all to authenticated
                    using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('grant all on %I to service_role', t);
  end loop;
end $$;

alter table academia_progresso enable row level security;
drop policy if exists "o proprio progresso" on academia_progresso;
create policy "o proprio progresso" on academia_progresso for all to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid() and acesso_empresa(empresa_id));
grant select, insert, update, delete on academia_progresso to authenticated;
grant all on academia_progresso to service_role;

alter table academia_parceiros enable row level security;
drop policy if exists "envia ideia" on academia_parceiros;
drop policy if exists "super le" on academia_parceiros;
create policy "envia ideia" on academia_parceiros for insert to authenticated
  with check (perfil_id = auth.uid() and acesso_empresa(empresa_id));
create policy "super le" on academia_parceiros for select to authenticated using (sou_super());
grant select, insert on academia_parceiros to authenticated;
grant all on academia_parceiros to service_role;

-- =====================================================================
--  4. FUNÇÕES DO PAINEL
--  Todas checam se quem chama é da barbearia. Erros que o usuário pode
--  resolver voltam como {"erro": "..."} com a mensagem pronta.
-- =====================================================================

-- 4.1 Quem sou eu (perfil + barbearia + configurações)
create or replace function painel_eu() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_p perfis; v_e empresas;
begin
  select * into v_p from perfis where id = auth.uid() and ativo and tipo in ('admin','super');
  if v_p.id is null then return jsonb_build_object('erro', 'Este login ainda não tem acesso ao painel. Peça para a DuoTech liberar.'); end if;
  if v_p.empresa_id is null then return jsonb_build_object('erro', 'Este login não está ligado a nenhuma barbearia.'); end if;
  select * into v_e from empresas where id = v_p.empresa_id;
  return jsonb_build_object(
    'perfil', jsonb_build_object('id', v_p.id, 'nome', v_p.nome, 'tipo', v_p.tipo, 'email', v_p.email),
    'empresa', to_jsonb(v_e) - 'obs_duotech' - 'asaas_customer_id' - 'instancia_whatsapp',
    'liberada', empresa_liberada(v_e.id),
    'unidade_id', _unidade_padrao(v_e.id),
    'config', (select to_jsonb(c) - 'empresa_id' from empresas_config c where c.empresa_id = v_e.id));
end $$;

-- 4.2 Resumo do caixa (troco + dinheiro que entrou − dinheiro que saiu)
create or replace function _caixa_resumo(p_caixa uuid) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'entradas', coalesce(sum(valor) filter (where tipo = 'entrada'), 0),
    'saidas',   coalesce(sum(valor) filter (where tipo = 'saida'), 0),
    'dinheiro', (select troco from caixas where id = p_caixa)
                + coalesce(sum(valor) filter (where tipo = 'entrada' and forma = 'dinheiro'), 0)
                - coalesce(sum(valor) filter (where tipo = 'saida'   and forma = 'dinheiro'), 0),
    'pix',      coalesce(sum(case when tipo='entrada' then valor else -valor end) filter (where forma = 'pix'), 0),
    'credito',  coalesce(sum(valor) filter (where tipo = 'entrada' and forma = 'credito'), 0),
    'debito',   coalesce(sum(valor) filter (where tipo = 'entrada' and forma = 'debito'), 0))
  from financeiro where caixa_id = p_caixa;
$$;
revoke execute on function _caixa_resumo(uuid) from public, anon;

-- 4.3 Caixa aberto agora, movimentações e histórico
create or replace function caixa_atual() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v_c caixas;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  select * into v_c from caixas where empresa_id = v_emp and unidade_id = _unidade_padrao(v_emp) and fechado_em is null;
  return jsonb_build_object(
    'aberto', v_c.id is not null,
    'caixa', case when v_c.id is null then null else to_jsonb(v_c) end,
    'resumo', case when v_c.id is null then null else _caixa_resumo(v_c.id) end,
    'movs', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'tipo', f.tipo, 'origem', f.origem,
              'desc', coalesce(f.descricao, f.categoria), 'cat', f.categoria, 'forma', f.forma, 'valor', f.valor,
              'hora', to_char(f.criado_em at time zone 'America/Sao_Paulo', 'HH24:MI')) order by f.criado_em desc)
            from financeiro f where f.caixa_id = v_c.id), '[]'::jsonb),
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
  if exists (select 1 from caixas where unidade_id = _unidade_padrao(v_emp) and fechado_em is null) then
    return jsonb_build_object('erro', 'O caixa já está aberto.');
  end if;
  insert into caixas (empresa_id, unidade_id, troco, aberto_por) values (v_emp, _unidade_padrao(v_emp), p_troco, auth.uid());
  return jsonb_build_object('ok', true);
end $$;

create or replace function caixa_lancar(p_tipo text, p_categoria text, p_descricao text, p_forma text, p_valor numeric) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v_c uuid;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if p_tipo not in ('entrada','saida') then return jsonb_build_object('erro', 'Tipo inválido.'); end if;
  if p_forma not in ('dinheiro','pix','credito','debito') then return jsonb_build_object('erro', 'Forma de pagamento inválida.'); end if;
  if coalesce(p_valor, 0) <= 0 then return jsonb_build_object('erro', 'Informe o valor.'); end if;
  select id into v_c from caixas where unidade_id = _unidade_padrao(v_emp) and fechado_em is null;
  if v_c is null then return jsonb_build_object('erro', 'Abra o caixa antes de lançar.'); end if;
  insert into financeiro (empresa_id, unidade_id, caixa_id, tipo, categoria, descricao, valor, forma, origem)
  values (v_emp, _unidade_padrao(v_emp), v_c, p_tipo, left(coalesce(nullif(trim(p_categoria),''), 'Outros'), 40),
          left(nullif(trim(p_descricao), ''), 120), round(p_valor, 2), p_forma, 'manual');
  return jsonb_build_object('ok', true);
end $$;

create or replace function caixa_fechar(p_contado numeric, p_obs text default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v_c caixas; v_r jsonb;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if coalesce(p_contado, -1) < 0 then return jsonb_build_object('erro', 'Conte o dinheiro da gaveta e informe o valor.'); end if;
  select * into v_c from caixas where unidade_id = _unidade_padrao(v_emp) and fechado_em is null for update;
  if v_c.id is null then return jsonb_build_object('erro', 'O caixa já está fechado.'); end if;
  v_r := _caixa_resumo(v_c.id);
  update caixas set fechado_em = now(), fechado_por = auth.uid(), esperado_dinheiro = (v_r->>'dinheiro')::numeric,
                    contado = round(p_contado, 2), observacao = left(p_obs, 300)
  where id = v_c.id;
  return jsonb_build_object('ok', true, 'esperado', (v_r->>'dinheiro')::numeric, 'diferenca', round(p_contado, 2) - (v_r->>'dinheiro')::numeric);
end $$;

-- 4.4 Fechar comanda: tudo de uma vez (agenda, financeiro, caixa, plano, estoque, comissão, pontos)
--  p: {agendamento_id?, cliente_id?, cliente_nome?, cliente_whatsapp?, barbeiro_id?,
--      itens:[{tipo:'servico'|'produto', id, nome, preco, qtd}], desconto, forma, avaliacao?}
create or replace function fechar_comanda(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_emp    uuid := minha_empresa();
  v_uni    uuid;
  v_forma  text := p->>'forma';
  v_desc   numeric := round(coalesce((p->>'desconto')::numeric, 0), 2);
  v_ag     agendamentos;
  v_cli    uuid := nullif(p->>'cliente_id', '')::uuid;
  v_barb   uuid := nullif(p->>'barbeiro_id', '')::uuid;
  v_item   jsonb;
  v_serv   numeric := 0;
  v_prod   numeric := 0;
  v_dur    int := 0;
  v_nomes  text[] := '{}';
  v_itens  jsonb := '[]'::jsonb;
  v_total  numeric;
  v_caixa  uuid;
  v_pct    numeric;
  v_pctp   numeric;
  v_com    numeric;
  v_uso    planos_cliente_usos;
  v_plano  planos_cliente;
  v_wa     text;
  v_s      servicos;
  v_pr     produtos;
  v_qtd    numeric;
  v_preco  numeric;
  v_origem text;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  v_uni := _unidade_padrao(v_emp);
  if v_forma is null or v_forma not in ('dinheiro','pix','credito','debito','plano','cortesia') then
    return jsonb_build_object('erro', 'Escolha a forma de pagamento.');
  end if;
  if jsonb_typeof(p->'itens') <> 'array' or jsonb_array_length(p->'itens') = 0 then
    return jsonb_build_object('erro', 'Adicione pelo menos um serviço ou produto.');
  end if;
  if v_desc < 0 then return jsonb_build_object('erro', 'Desconto inválido.'); end if;

  -- itens: confere se são desta barbearia
  for v_item in select * from jsonb_array_elements(p->'itens') loop
    v_qtd   := greatest(coalesce((v_item->>'qtd')::numeric, 1), 1);
    v_preco := round(coalesce((v_item->>'preco')::numeric, -1), 2);
    if v_preco < 0 then return jsonb_build_object('erro', 'Preço inválido em um dos itens.'); end if;
    if v_item->>'tipo' = 'produto' then
      select * into v_pr from produtos where id = (v_item->>'id')::uuid and empresa_id = v_emp;
      if v_pr.id is null then return jsonb_build_object('erro', 'Produto não encontrado.'); end if;
      v_prod  := v_prod + v_preco * v_qtd;
      v_nomes := v_nomes || v_pr.nome;
      v_itens := v_itens || jsonb_build_object('tipo','produto','id',v_pr.id,'nome',v_pr.nome,'preco',v_preco,'qtd',v_qtd);
    else
      select * into v_s from servicos where id = (v_item->>'id')::uuid and empresa_id = v_emp;
      if v_s.id is null then return jsonb_build_object('erro', 'Serviço não encontrado.'); end if;
      v_serv  := v_serv + v_preco * v_qtd;
      v_dur   := v_dur + v_s.duracao_min * v_qtd::int;
      v_nomes := v_nomes || v_s.nome;
      v_itens := v_itens || jsonb_build_object('tipo','servico','id',v_s.id,'nome',v_s.nome,'categoria',v_s.categoria,'preco',v_preco,'qtd',v_qtd);
    end if;
  end loop;

  -- agendamento existente
  if nullif(p->>'agendamento_id', '') is not null then
    select * into v_ag from agendamentos where id = (p->>'agendamento_id')::uuid and empresa_id = v_emp for update;
    if v_ag.id is null then return jsonb_build_object('erro', 'Agendamento não encontrado.'); end if;
    if v_ag.status = 'concluido' then return jsonb_build_object('erro', 'Esta comanda já foi fechada.'); end if;
    if v_ag.status in ('cancelado','faltou') then return jsonb_build_object('erro', 'Este agendamento está cancelado.'); end if;
    v_cli  := coalesce(v_cli, v_ag.cliente_id);
    v_barb := coalesce(v_barb, v_ag.barbeiro_id);
  end if;

  -- cliente: escolhido, achado pelo WhatsApp ou cadastrado agora
  if v_cli is not null then
    if not exists (select 1 from clientes where id = v_cli and empresa_id = v_emp) then
      return jsonb_build_object('erro', 'Cliente não encontrado.');
    end if;
  elsif nullif(trim(p->>'cliente_nome'), '') is not null then
    v_wa := nullif(regexp_replace(coalesce(p->>'cliente_whatsapp', ''), '\D', '', 'g'), '');
    if v_wa is not null and length(v_wa) in (10, 11) then v_wa := '55' || v_wa; end if;
    if v_wa is not null then select id into v_cli from clientes where empresa_id = v_emp and whatsapp = v_wa; end if;
    if v_cli is null then
      insert into clientes (empresa_id, nome, whatsapp, origem) values (v_emp, left(trim(p->>'cliente_nome'), 80), v_wa, 'balcao')
      returning id into v_cli;
    end if;
  end if;

  if v_barb is not null and not exists (select 1 from perfis where id = v_barb and empresa_id = v_emp) then
    return jsonb_build_object('erro', 'Barbeiro não encontrado.');
  end if;

  v_total := greatest(v_serv + v_prod - v_desc, 0);

  -- pelo plano: precisa ter plano ativo e saldo de cortes no mês
  if v_forma = 'plano' then
    if v_cli is null then return jsonb_build_object('erro', 'Escolha o cliente do plano.'); end if;
    select * into v_uso from planos_cliente_usos where empresa_id = v_emp and cliente_id = v_cli and status = 'ativo'
      order by criado_em desc limit 1 for update;
    if v_uso.id is null then return jsonb_build_object('erro', 'Este cliente não tem plano ativo.'); end if;
    select * into v_plano from planos_cliente where id = v_uso.plano_id;
    if v_uso.mes_referencia is distinct from to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') then
      v_uso.cortes_usados_mes := 0;
    end if;
    if v_plano.cortes_mes > 0 and v_uso.cortes_usados_mes >= v_plano.cortes_mes then
      return jsonb_build_object('erro', 'O plano deste cliente já usou todos os atendimentos do mês.');
    end if;
    update planos_cliente_usos set cortes_usados_mes = v_uso.cortes_usados_mes + 1,
           mes_referencia = to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') where id = v_uso.id;
    v_total := 0;
  elsif v_forma = 'cortesia' then
    v_total := 0;
  end if;

  -- dinheiro, Pix e cartão entram no caixa aberto
  if v_forma in ('dinheiro','pix','credito','debito') and v_total > 0 then
    select id into v_caixa from caixas where unidade_id = v_uni and fechado_em is null;
    if v_caixa is null then return jsonb_build_object('erro', 'Abra o caixa antes de fechar a comanda.'); end if;
  end if;

  -- comissão: % do barbeiro nos serviços e % de produto (Lucro real > Premissas) nos produtos.
  -- Atendimento pelo plano não gera comissão aqui: vai para o Pote (regra a definir).
  v_com := 0;
  if v_barb is not null and v_forma not in ('plano','cortesia') then
    -- % do serviço: a do barbeiro (comissao_config ou cadastro); se ele não tiver, a das premissas do Lucro real
    select coalesce((profit->'premissas'->>'barb_produto')::numeric, 0), (profit->'premissas'->>'barb_servico')::numeric
      into v_pctp, v_pct from empresas_config where empresa_id = v_emp;
    select coalesce(nullif((select pct_padrao from comissao_config where empresa_id = v_emp and barbeiro_id = v_barb), 0),
                    nullif(comissao_pct, 0), v_pct, 0)
      into v_pct from perfis where id = v_barb;
    v_com := round((v_serv * coalesce(v_pct, 0) + v_prod * coalesce(v_pctp, 0)) / 100
                   * case when v_serv + v_prod > 0 then v_total / (v_serv + v_prod) else 0 end, 2);
  end if;

  -- agenda: conclui o agendamento ou registra a comanda de balcão
  if v_ag.id is not null then
    update agendamentos set status = 'concluido', pago = true, cliente_id = v_cli, barbeiro_id = v_barb,
           preco = v_serv + v_prod, desconto = case when v_forma in ('plano','cortesia') then 0 else least(v_desc, v_serv + v_prod) end,
           servico_nome = left(array_to_string(v_nomes, ' + '), 200),
           forma_pagamento = case v_forma when 'credito' then 'cartao_credito' when 'debito' then 'cartao_debito' else v_forma end,
           plano_cliente_id = case when v_forma = 'plano' then v_uso.id else plano_cliente_id end,
           avaliacao = nullif((p->>'avaliacao')::int, 0)
    where id = v_ag.id returning * into v_ag;
  else
    insert into agendamentos (empresa_id, unidade_id, cliente_id, servico_nome, barbeiro_id, inicio, fim, preco, desconto,
                              status, origem, forma_pagamento, pago, plano_cliente_id, avaliacao)
    values (v_emp, v_uni, v_cli, left(array_to_string(v_nomes, ' + '), 200), v_barb,
            now() - make_interval(mins => greatest(v_dur, 15)), now(), v_serv + v_prod,
            case when v_forma in ('plano','cortesia') then 0 else least(v_desc, v_serv + v_prod) end,
            'concluido', 'comanda',
            case v_forma when 'credito' then 'cartao_credito' when 'debito' then 'cartao_debito' else v_forma end,
            true, case when v_forma = 'plano' then v_uso.id end, nullif((p->>'avaliacao')::int, 0))
    returning * into v_ag;
  end if;

  -- estoque: produtos vendidos saem do estoque
  update produtos pr set estoque_atual = pr.estoque_atual - x.qtd
  from (select (i->>'id')::uuid id, sum((i->>'qtd')::numeric) qtd from jsonb_array_elements(v_itens) i
        where i->>'tipo' = 'produto' group by 1) x
  where pr.id = x.id;

  v_origem := case when v_forma = 'plano' then 'plano_uso' else 'comanda' end;
  insert into financeiro (empresa_id, unidade_id, caixa_id, tipo, categoria, descricao, valor, forma, pago,
                          barbeiro_id, comissao_valor, agendamento_id, cliente_id, itens, origem)
  values (v_emp, v_uni, v_caixa, 'entrada', case when v_forma = 'plano' then 'Uso do plano' else 'Atendimento' end,
          left(coalesce((select nome from clientes where id = v_cli), 'Cliente') || ' · ' || array_to_string(v_nomes, ' + '), 200),
          v_total, v_forma, true, v_barb, v_com, v_ag.id, v_cli, v_itens, v_origem);

  return jsonb_build_object('ok', true, 'agendamento_id', v_ag.id, 'total', v_total, 'comissao', v_com, 'cliente_id', v_cli);
end $$;

-- 4.5 Meta: calibrar no meio do mês exige motivo e fica no histórico
create or replace function meta_calibrar(p_mes text, p_meta numeric, p_motivo text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v_de numeric;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
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
  select * into v_h from metas_historico where empresa_id = v_emp and mes = p_mes order by quando desc limit 1;
  if v_h.id is null then return jsonb_build_object('erro', 'Não há alteração para desfazer.'); end if;
  update metas set dados = case when v_h.de is null then dados - 'meta' else dados || jsonb_build_object('meta', v_h.de) end,
                   atualizado_em = now()
  where empresa_id = v_emp and mes = p_mes;
  delete from metas_historico where id = v_h.id;
  return jsonb_build_object('ok', true);
end $$;

-- 4.6 Pix do plano confirmado: agora separa plano novo de renovação (para a Meta do mês)
create or replace function barbearia_confirmar_pagamento_plano(p_assinatura uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_u    planos_cliente_usos;
  v_p    planos_cliente;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_venc date;
  v_novo boolean;
begin
  select * into v_u from planos_cliente_usos where id = p_assinatura for update;
  if v_u.id is null or not acesso_empresa(v_u.empresa_id) then raise exception 'Sem acesso'; end if;
  if v_u.status not in ('aguardando_pagamento','ativo','pausado') then
    return jsonb_build_object('erro', 'Este plano está cancelado ou expirado.');
  end if;
  if v_u.ultimo_pagamento = v_hoje then
    return jsonb_build_object('erro', 'Pagamento de hoje já foi confirmado.');
  end if;
  select * into v_p from planos_cliente where id = v_u.plano_id;
  v_novo := v_u.status = 'aguardando_pagamento' or v_u.ultimo_pagamento is null;

  v_venc := case when v_u.status = 'aguardando_pagamento' or v_u.proximo_vencimento is null
                 then v_hoje + interval '1 month'
                 else greatest(v_u.proximo_vencimento, v_hoje) + interval '1 month' end;

  update planos_cliente_usos set
    status = 'ativo',
    inicio = case when status = 'aguardando_pagamento' then v_hoje else inicio end,
    proximo_vencimento = v_venc, ultimo_pagamento = v_hoje,
    pagamento_informado_em = null, cortes_usados_mes = 0,
    mes_referencia = to_char(v_hoje, 'YYYY-MM')
  where id = v_u.id;

  insert into financeiro (empresa_id, unidade_id, tipo, categoria, descricao, valor, forma, data, pago, cliente_id, origem)
  values (v_u.empresa_id, _unidade_padrao(v_u.empresa_id), 'entrada', 'Plano mensal',
          v_p.nome || ' — ' || (select nome from clientes where id = v_u.cliente_id), v_p.preco, 'pix', v_hoje, true,
          v_u.cliente_id, case when v_novo then 'plano_novo' else 'plano_renovacao' end);

  return jsonb_build_object('ok', true, 'proximo_vencimento', v_venc);
end $$;

-- 4.7 Pedido de oração feito pelo cliente no app (precisa estar logado no app)
create or replace function cliente_pedir_oracao(p_slug text, p_token text, p_texto text, p_anonimo boolean default false) returns jsonb
language plpgsql security definer set search_path to public, extensions as $$
declare v_e empresas; v_c clientes; v_fe boolean;
begin
  v_e := _empresa_link(p_slug);
  if v_e.id is null then return jsonb_build_object('erro', 'Barbearia não encontrada.'); end if;
  select coalesce((fe->>'fe_ativa')::boolean, true) and coalesce((fe->>'fe_app_cliente')::boolean, true)
    into v_fe from empresas_config where empresa_id = v_e.id;
  if not coalesce(v_fe, true) then return jsonb_build_object('erro', 'Esta barbearia não recebe pedidos de oração pelo app.'); end if;
  v_c := _cliente_token(v_e.id, p_token);
  if v_c.id is null then return jsonb_build_object('erro', 'Entre na sua conta para enviar o pedido.'); end if;
  if length(trim(coalesce(p_texto, ''))) < 3 then return jsonb_build_object('erro', 'Escreva o seu pedido.'); end if;
  if (select count(*) from pedidos_oracao where cliente_id = v_c.id and criado_em > now() - interval '1 day') >= 3 then
    return jsonb_build_object('erro', 'Você já enviou 3 pedidos hoje. A equipe vai orar por eles.');
  end if;
  insert into pedidos_oracao (empresa_id, cliente_id, nome, anonimo, texto)
  values (v_e.id, v_c.id, case when p_anonimo then null else v_c.nome end, coalesce(p_anonimo, false), left(trim(p_texto), 500));
  return jsonb_build_object('ok', true);
end $$;

-- =====================================================================
--  5. RESUMO DO PAINEL
--  Calculado no banco para não esbarrar no limite de 1.000 linhas por
--  consulta. Datas sempre no horário de Brasília.
-- =====================================================================
create or replace function painel_resumo() returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_emp   uuid := minha_empresa();
  v_e     empresas;
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ini   date := date_trunc('month', v_hoje)::date;
  v_ant   date := (date_trunc('month', v_hoje) - interval '1 month')::date;
  v_nbarb int;
  v_r     jsonb;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  select * into v_e from empresas where id = v_emp;
  select greatest(count(*), 1) into v_nbarb from perfis where empresa_id = v_emp and ativo and aparece_no_link and tipo in ('admin','barbeiro');

  with
  fin as (
    select data, tipo, valor, origem, cliente_id, itens from financeiro
    where empresa_id = v_emp and data >= (v_ini - interval '6 months')::date and pago
  ),
  ag as (
    select a.*, (a.inicio at time zone 'America/Sao_Paulo') li, (a.fim at time zone 'America/Sao_Paulo') lf
    from agendamentos a where a.empresa_id = v_emp and a.inicio >= (v_ini - interval '6 months') and a.status not in ('cancelado','faltou')
  ),
  -- capacidade: horas abertas × barbeiros, por dia e hora
  slots as (
    select d::date dia, extract(dow from d)::int dow, h,
           (select coalesce(sum(greatest(0, extract(epoch from (least((d::date + make_time(h+1,0,0)), (d::date + (iv->>1)::time))
                                                               - greatest((d::date + make_time(h,0,0)), (d::date + (iv->>0)::time)))) / 60)), 0)
            from jsonb_array_elements(v_e.horarios -> extract(dow from d)::int::text) iv) * v_nbarb cap
    from generate_series(v_ant, v_hoje, interval '1 day') d, generate_series(6, 22) h
  ),
  ocup as (
    select s.dia, s.dow, s.h, s.cap,
           coalesce((select sum(extract(epoch from (least(a.lf, s.dia + make_time(s.h+1,0,0)) - greatest(a.li, s.dia + make_time(s.h,0,0)))) / 60)
                     from ag a where a.li < s.dia + make_time(s.h+1,0,0) and a.lf > s.dia + make_time(s.h,0,0)), 0) usado
    from slots s where s.cap > 0
  ),
  primeira as (
    select cliente_id, min(li::date) primeira from (select cliente_id, (inicio at time zone 'America/Sao_Paulo') li
      from agendamentos where empresa_id = v_emp and status = 'concluido' and cliente_id is not null) x group by 1
  )
  select jsonb_build_object(
    'hoje', v_hoje,
    'faturamento_mes', (select coalesce(sum(valor), 0) from fin where tipo = 'entrada' and data >= v_ini),
    'faturamento_mes_passado', (select coalesce(sum(valor), 0) from fin where tipo = 'entrada' and data >= v_ant and data < v_ini),
    'acumulado_ano', (select coalesce(sum(valor), 0) from financeiro where empresa_id = v_emp and pago and tipo = 'entrada'
                       and data >= date_trunc('year', v_hoje)::date),
    'atendimentos_mes', (select count(*) from ag where status = 'concluido' and li::date >= v_ini),
    'ocupacao', (select case when sum(cap) > 0 then round(sum(least(usado, cap)) / sum(cap) * 100, 1) else 0 end
                 from ocup where dia >= v_ini and dia <= v_hoje),
    'meta_ocupacao', v_e.meta_ocupacao,
    'heatmap', (select jsonb_object_agg(dow || '-' || h, pct) from (
                 select dow, h, round(sum(least(usado, cap)) / nullif(sum(cap), 0) * 100) pct
                 from ocup where dia > v_hoje - 30 and dia < v_hoje group by dow, h) x),
    'planos_ativos', (select count(*) from planos_cliente_usos where empresa_id = v_emp and status = 'ativo'),
    'planos_vendidos_mes', (select count(*) from fin where origem = 'plano_novo' and data >= v_ini),
    'planos_cancelados_mes', (select count(*) from planos_cliente_usos where empresa_id = v_emp and status = 'cancelado'
                              and coalesce(fim, (criado_em at time zone 'America/Sao_Paulo')::date) >= v_ini),
    'mensalidades_ativas', (select coalesce(sum(p.preco), 0) from planos_cliente_usos u join planos_cliente p on p.id = u.plano_id
                            where u.empresa_id = v_emp and u.status = 'ativo'),
    'assinantes', (select coalesce(jsonb_object_agg(plano_id, n), '{}'::jsonb) from (
                     select plano_id, count(*) n from planos_cliente_usos where empresa_id = v_emp and status = 'ativo' group by 1) x),
    'comandas_abertas', (select count(*) from ag where status = 'em_atendimento'),
    'comandas_outros_dias', (select count(*) from ag where status = 'em_atendimento' and li::date < v_hoje),
    'dias', (select coalesce(jsonb_agg(jsonb_build_object('data', data,
               'comandas', cmd, 'assin', ren, 'novas', nov) order by data), '[]'::jsonb) from (
               select data, sum(valor) filter (where origem in ('comanda','manual')) cmd,
                      sum(valor) filter (where origem = 'plano_renovacao') ren,
                      sum(valor) filter (where origem = 'plano_novo') nov
               from fin where tipo = 'entrada' and data >= v_ant group by data) x),
    'meses', (select coalesce(jsonb_agg(m order by m->>'mes'), '[]'::jsonb) from (
               select jsonb_build_object('mes', to_char(mm, 'YYYY-MM'),
                 'fat', (select coalesce(sum(valor), 0) from fin where tipo = 'entrada' and date_trunc('month', data) = mm),
                 'atend', (select count(*) from ag where status = 'concluido' and date_trunc('month', li) = mm),
                 'novos', (select count(*) from primeira where date_trunc('month', primeira) = mm),
                 'clientes', (select count(distinct cliente_id) from ag where status = 'concluido' and date_trunc('month', li) = mm)) m
               from generate_series(v_ini - interval '5 months', v_ini, interval '1 month') mm) y),
    'mix_mes', (select jsonb_build_object(
                  'avulsos',  coalesce(sum((i->>'preco')::numeric * (i->>'qtd')::numeric) filter (where i->>'tipo' = 'servico' and i->>'categoria' in ('corte','barba','combo')), 0),
                  'extras',   coalesce(sum((i->>'preco')::numeric * (i->>'qtd')::numeric) filter (where i->>'tipo' = 'servico' and coalesce(i->>'categoria','') not in ('corte','barba','combo')), 0),
                  'produtos', coalesce(sum((i->>'preco')::numeric * (i->>'qtd')::numeric) filter (where i->>'tipo' = 'produto'), 0))
                from fin, jsonb_array_elements(coalesce(fin.itens, '[]'::jsonb)) i where fin.origem = 'comanda' and fin.data >= v_ini),
    'vendidos_30d', (select coalesce(jsonb_object_agg(id, n), '{}'::jsonb) from (
                      select i->>'id' id, sum((i->>'qtd')::numeric) n from fin, jsonb_array_elements(coalesce(fin.itens, '[]'::jsonb)) i
                      where fin.origem in ('comanda','plano_uso') and fin.data > v_hoje - 30 group by 1) x),
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
                     from produtos where empresa_id = v_emp and ativo and estoque_minimo > 0 and estoque_atual <= estoque_minimo),
    'pedidos_oracao', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', case when anonimo then null else nome end,
                       'anonimo', anonimo, 'texto', texto, 'quando', criado_em, 'orado', orado_em is not null) order by criado_em desc), '[]'::jsonb)
                     from (select * from pedidos_oracao where empresa_id = v_emp order by criado_em desc limit 30) x)
  ) into v_r;
  return v_r;
end $$;


-- =====================================================================
--  6. AGENDA, CLIENTES E GRAVAÇÕES DO PAINEL
--  O painel lê e grava só por estas funções: cada uma confere se quem
--  chama é da barbearia e devolve mensagens prontas em caso de erro.
-- =====================================================================

-- 6.1 Agenda de um dia (com cliente, barbeiro e se o cliente tem plano ativo)
create or replace function painel_agenda(p_dia date) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa();
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'inicio', a.inicio, 'fim', a.fim, 'status', a.status, 'origem', a.origem,
      'servico_id', a.servico_id, 'servico', a.servico_nome, 'preco', a.preco, 'desconto', a.desconto,
      'barbeiro_id', a.barbeiro_id, 'cliente_id', a.cliente_id, 'cliente', c.nome, 'whatsapp', c.whatsapp,
      'chegou_em', a.chegou_em, 'pago', a.pago, 'forma', a.forma_pagamento, 'obs', a.observacoes,
      'tem_plano', exists (select 1 from planos_cliente_usos u where u.cliente_id = a.cliente_id and u.status = 'ativo'))
      order by a.inicio)
    from agendamentos a left join clientes c on c.id = a.cliente_id
    where a.empresa_id = v_emp
      and (a.inicio at time zone 'America/Sao_Paulo')::date = p_dia), '[]'::jsonb);
end $$;

-- 6.2 Novo agendamento pelo painel
--  p: {servico_id, barbeiro_id?, inicio (ISO), cliente_id? | cliente_nome + cliente_whatsapp?, obs?}
create or replace function painel_agendar(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_emp uuid := minha_empresa(); v_s servicos; v_cli uuid := nullif(p->>'cliente_id','')::uuid;
  v_barb uuid := nullif(p->>'barbeiro_id','')::uuid; v_ini timestamptz; v_wa text; v_id uuid;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  select * into v_s from servicos where id = nullif(p->>'servico_id','')::uuid and empresa_id = v_emp;
  if v_s.id is null then return jsonb_build_object('erro', 'Escolha o serviço.'); end if;
  begin v_ini := (p->>'inicio')::timestamptz; exception when others then v_ini := null; end;
  if v_ini is null then return jsonb_build_object('erro', 'Escolha o dia e o horário.'); end if;
  if v_barb is not null and not exists (select 1 from perfis where id = v_barb and empresa_id = v_emp and ativo) then
    return jsonb_build_object('erro', 'Barbeiro não encontrado.');
  end if;
  if v_cli is not null then
    if not exists (select 1 from clientes where id = v_cli and empresa_id = v_emp) then return jsonb_build_object('erro', 'Cliente não encontrado.'); end if;
  else
    if nullif(trim(p->>'cliente_nome'), '') is null then return jsonb_build_object('erro', 'Informe o nome do cliente.'); end if;
    v_wa := nullif(regexp_replace(coalesce(p->>'cliente_whatsapp',''), '\D', '', 'g'), '');
    if v_wa is not null and length(v_wa) in (10, 11) then v_wa := '55' || v_wa; end if;
    if v_wa is not null then select id into v_cli from clientes where empresa_id = v_emp and whatsapp = v_wa; end if;
    if v_cli is null then
      insert into clientes (empresa_id, nome, whatsapp, origem) values (v_emp, left(trim(p->>'cliente_nome'), 80), v_wa, 'balcao') returning id into v_cli;
    end if;
  end if;
  begin
    insert into agendamentos (empresa_id, unidade_id, cliente_id, servico_id, servico_nome, barbeiro_id, inicio, fim, preco, status, origem, observacoes)
    values (v_emp, _unidade_padrao(v_emp), v_cli, v_s.id, v_s.nome, v_barb, v_ini, v_ini + make_interval(mins => v_s.duracao_min),
            v_s.preco, 'confirmado', 'balcao', left(nullif(trim(p->>'obs'), ''), 300))
    returning id into v_id;
  exception when exclusion_violation then
    return jsonb_build_object('erro', 'Esse barbeiro já tem atendimento nesse horário.');
  end;
  return jsonb_build_object('ok', true, 'id', v_id, 'cliente_id', v_cli);
end $$;

-- 6.3 Mudar o status de um agendamento (confirmar, chegou, faltou, cancelar, voltar para agendado)
create or replace function painel_status(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v_a agendamentos;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  if p_status not in ('agendado','confirmado','em_atendimento','cancelado','faltou') then
    return jsonb_build_object('erro', 'Status inválido.');
  end if;
  select * into v_a from agendamentos where id = p_id and empresa_id = v_emp for update;
  if v_a.id is null then return jsonb_build_object('erro', 'Agendamento não encontrado.'); end if;
  if v_a.status = 'concluido' then return jsonb_build_object('erro', 'Este atendimento já foi fechado.'); end if;
  begin
    update agendamentos set status = p_status,
      chegou_em = case when p_status = 'em_atendimento' then coalesce(chegou_em, now()) else chegou_em end,
      cancelado_por = case when p_status = 'cancelado' then 'barbearia' else cancelado_por end
    where id = p_id;
  exception when exclusion_violation then
    return jsonb_build_object('erro', 'Esse horário já foi ocupado por outro agendamento.');
  end;
  return jsonb_build_object('ok', true);
end $$;

-- 6.4 Clientes (busca por nome ou WhatsApp), com visitas, plano e pontos
create or replace function painel_clientes(p_busca text default null) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v_b text := nullif(trim(coalesce(p_busca, '')), '');
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  return coalesce((select jsonb_agg(x order by x->>'ultima' desc nulls last, x->>'nome') from (
    select jsonb_build_object('id', c.id, 'nome', c.nome, 'whatsapp', c.whatsapp, 'origem', c.origem,
      'tem_conta', c.senha_hash is not null,
      'visitas', (select count(*) from agendamentos a where a.cliente_id = c.id and a.status = 'concluido'),
      'ultima', (select max(a.inicio) from agendamentos a where a.cliente_id = c.id and a.status = 'concluido'),
      'gasto_30d', (select coalesce(sum(f.valor), 0) from financeiro f where f.cliente_id = c.id and f.origem = 'comanda'
                    and f.data > (now() at time zone 'America/Sao_Paulo')::date - 30),
      'pontos', (select coalesce(sum(pontos), 0) from pontos_mov m where m.cliente_id = c.id),
      'plano', (select jsonb_build_object('nome', pl.nome, 'status', u.status, 'vence', u.proximo_vencimento)
                from planos_cliente_usos u join planos_cliente pl on pl.id = u.plano_id
                where u.cliente_id = c.id and u.status in ('ativo','aguardando_pagamento','pausado') order by u.criado_em desc limit 1)) x
    from clientes c
    where c.empresa_id = v_emp
      and (v_b is null or c.nome ilike '%' || v_b || '%'
           or (regexp_replace(v_b, '\D', '', 'g') <> '' and c.whatsapp like '%' || regexp_replace(v_b, '\D', '', 'g') || '%'))
    order by c.nome limit 200) y), '[]'::jsonb);
end $$;

-- 6.5 Gravar configurações (fé e Lucro real) e a meta do mês
create or replace function painel_salvar_config(p_fe jsonb default null, p_profit jsonb default null) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa();
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  insert into empresas_config (empresa_id) values (v_emp) on conflict do nothing;
  update empresas_config set
    fe = case when jsonb_typeof(p_fe) = 'object' then fe || p_fe else fe end,
    profit = case when jsonb_typeof(p_profit) = 'object' then p_profit else profit end,
    atualizado_em = now()
  where empresa_id = v_emp;
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
  if p_mes !~ '^[0-9]{4}-[0-9]{2}$' or jsonb_typeof(p_dados) <> 'object' then return jsonb_build_object('erro', 'Dados inválidos.'); end if;
  insert into metas (empresa_id, mes, dados) values (v_emp, p_mes, p_dados - 'historico')
  on conflict (empresa_id, mes) do update set dados = excluded.dados, atualizado_em = now();
  return jsonb_build_object('ok', true);
end $$;

-- 6.6 Preço e insumo de serviços, preço e custo de produtos (Lucro real)
--  p: {servicos:[{id, preco?, insumo?}], produtos:[{id, venda?, custo?}]}
create or replace function painel_salvar_custos(p jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa(); v jsonb;
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  for v in select * from jsonb_array_elements(coalesce(p->'servicos', '[]'::jsonb)) loop
    -- só mexe no campo que veio (greatest(null, 0) daria 0 e zeraria o preço)
    update servicos set preco  = case when v ? 'preco'  and v->>'preco'  is not null then greatest((v->>'preco')::numeric, 0)  else preco  end,
                        insumo = case when v ? 'insumo' and v->>'insumo' is not null then greatest((v->>'insumo')::numeric, 0) else insumo end
    where id = (v->>'id')::uuid and empresa_id = v_emp;
  end loop;
  for v in select * from jsonb_array_elements(coalesce(p->'produtos', '[]'::jsonb)) loop
    update produtos set preco_venda = case when v ? 'venda' and v->>'venda' is not null then greatest((v->>'venda')::numeric, 0) else preco_venda end,
                        preco_custo = case when v ? 'custo' and v->>'custo' is not null then greatest((v->>'custo')::numeric, 0) else preco_custo end
    where id = (v->>'id')::uuid and empresa_id = v_emp;
  end loop;
  return jsonb_build_object('ok', true);
end $$;

-- 6.7 Oração e Academia
create or replace function oracao_orei(p_id uuid, p_orado boolean default true) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_emp uuid := minha_empresa();
begin
  if v_emp is null then raise exception 'Sem acesso'; end if;
  update pedidos_oracao set orado_em = case when p_orado then coalesce(orado_em, now()) end,
                            orado_por = case when p_orado then auth.uid() end
  where id = p_id and empresa_id = v_emp;
  if not found then return jsonb_build_object('erro', 'Pedido não encontrado.'); end if;
  return jsonb_build_object('ok', true);
end $$;

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
  insert into academia_parceiros (empresa_id, perfil_id, nome, whatsapp, area, ideia)
  values (v_emp, auth.uid(), left(trim(p_nome), 80), left(trim(p_whatsapp), 20), left(p_area, 40), left(trim(p_ideia), 400));
  return jsonb_build_object('ok', true);
end $$;

-- quem pode chamar o quê
do $$
declare f text;
begin
  foreach f in array array['painel_eu()','painel_resumo()','caixa_atual()','caixa_abrir(numeric)',
      'caixa_lancar(text,text,text,text,numeric)','caixa_fechar(numeric,text)','fechar_comanda(jsonb)',
      'meta_calibrar(text,numeric,text)','meta_desfazer(text)','barbearia_confirmar_pagamento_plano(uuid)',
      'painel_agenda(date)','painel_agendar(jsonb)','painel_status(uuid,text)','painel_clientes(text)',
      'painel_salvar_config(jsonb,jsonb)','meta_ler(text)','meta_salvar(text,jsonb)','painel_salvar_custos(jsonb)',
      'oracao_orei(uuid,boolean)','academia_ler()','academia_concluir(text,boolean)',
      'academia_quero_ser_parceiro(text,text,text,text)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'revoke execute on function cliente_pedir_oracao(text,text,text,boolean) from public';
  execute 'grant execute on function cliente_pedir_oracao(text,text,text,boolean) to anon, authenticated';
end $$;

-- =====================================================================
--  CONFERIR DEPOIS DE RODAR
-- =====================================================================
-- select count(*) from unidades;                       -- 1 por barbearia
-- select conname from pg_constraint where conname = 'agend_sem_conflito_barbeiro';
