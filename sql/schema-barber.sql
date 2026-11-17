-- =====================================================================
--  DuoTech Barber — schema-barber.sql  (Etapa 1)
--  Projeto Supabase: duotech-barber  ← conferir o nome no topo!
--
--  Como rodar:
--    1. Abra o projeto duotech-barber no Supabase
--    2. SQL Editor → New query → cole tudo → Run
--    3. Pode rodar mais de uma vez (idempotente)
--
--  NUNCA rode no projeto duotech-beauty.
-- =====================================================================

set client_min_messages = warning;

-- Extensões necessárias
create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- =====================================================================
--  LIMPEZA (apenas se quiser recomeçar do zero)
--  Comente o bloco abaixo se quiser apenas acrescentar tabelas.
-- =====================================================================
drop table if exists
  fila_espera,
  planos_cliente_usos,
  planos_cliente,
  comissao_config,
  push_inscricoes,
  whatsapp_log,
  whatsapp_fila,
  produtos,
  financeiro,
  fidelidade,
  pacote_usos,
  pacotes,
  agendamentos,
  clientes,
  bloqueios,
  servicos,
  perfis,
  faturas,
  assinaturas_duotech,
  empresas_segredos,
  empresas,
  planos_duotech
cascade;

-- =====================================================================
--  PLATAFORMA (DuoTech — planos que as barbearias assinam)
-- =====================================================================
create table planos_duotech (
  id          text primary key,                        -- basico | pro
  nome        text not null,
  preco       numeric(10,2) not null,
  preco_anual numeric(10,2),
  recursos    jsonb not null default '{}'::jsonb,
  ativo       boolean not null default true,
  ordem       int not null default 0
);

insert into planos_duotech (id, nome, preco, preco_anual, recursos, ordem) values
 ('basico','Básico',49.90,499.00,
  '{"agenda":true,"link":true,"whatsapp":true,"clientes":true,"financeiro":true,"relatorio_diario":true,"fidelidade":true,"fila":true}',1),
 ('pro','Pro',89.90,899.00,
  '{"agenda":true,"link":true,"whatsapp":true,"clientes":true,"financeiro":true,"relatorio_diario":true,
    "relatorio_semanal":true,"relatorio_mensal":true,"anti_falta":true,"fidelidade":true,"fila":true,
    "planos_cliente":true,"comissoes":true,"estoque":true}',2)
on conflict (id) do update
  set nome = excluded.nome, preco = excluded.preco, recursos = excluded.recursos;

-- =====================================================================
--  BARBEARIAS
-- =====================================================================
create table if not exists empresas (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,                   -- nome da barbearia
  profissional        text,                            -- proprietário / gerente
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  plano_id            text not null default 'basico' references planos_duotech(id),
  situacao            text not null default 'teste'
                      check (situacao in ('teste','ativa','atrasada','bloqueada','cancelada')),
  teste_ate           date not null default ((now() at time zone 'America/Sao_Paulo')::date + 7),
  pago_ate            date,
  whatsapp            text,
  email               text,
  cidade              text,
  endereco            text,
  instagram           text,
  logo_url            text,
  foto_url            text,
  -- cores (o dono pode trocar pelo painel)
  cor_principal       text not null default '#C9A84C', -- accent (dourado padrão)
  cor_destaque        text not null default '#A8872E', -- accent-dark
  -- horários: {"1":[["09:00","12:00"],["13:00","19:00"]], ...}  (0=dom, 6=sáb)
  horarios            jsonb not null default
    '{"1":[["09:00","20:00"]],"2":[["09:00","20:00"]],"3":[["09:00","20:00"]],"4":[["09:00","20:00"]],"5":[["09:00","20:00"]],"6":[["09:00","18:00"]]}'::jsonb,
  intervalo_agenda    int not null default 30,         -- minutos entre horários (barbearia = 30+)
  antecedencia_min    int not null default 60,
  dias_abertos_link   int not null default 30,
  link_ativo          boolean not null default true,
  instancia_whatsapp  text,
  obs_duotech         text,
  asaas_customer_id   text,
  -- tolerância de atraso: se o cliente está N min atrasado, ainda atende
  tolerancia_atraso   int not null default 15,
  -- config fidelidade (10ª grátis)
  fidelidade_meta     int not null default 10,         -- quantos cortes para ganhar o prêmio
  fidelidade_premio   text not null default '1 corte grátis',
  criado_em           timestamptz not null default now()
);


-- =====================================================================
--  ACESSO — perfis (super DuoTech + admin de barbearia)
-- =====================================================================
create table if not exists perfis (
  id              uuid primary key references auth.users(id) on delete cascade,
  empresa_id      uuid references empresas(id) on delete cascade,
  profissional_id uuid,                                -- se preenchido: só vê agenda deste barbeiro
  tipo            text not null check (tipo in ('super','admin')),
  nome            text not null,
  email           text,
  comissao_pct    numeric(5,2) not null default 0,     -- % de comissão deste barbeiro
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  check (tipo = 'super' or empresa_id is not null)
);

-- ── Funções de acesso ────────────────────────────────────────────────
create or replace function sou_super()
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from perfis where id = auth.uid() and tipo = 'super' and ativo
  );
$$;
revoke execute on function sou_super() from public, anon;
grant  execute on function sou_super() to authenticated;

create or replace function minha_empresa()
returns uuid
language sql stable security definer set search_path to 'public' as $$
  select empresa_id from perfis where id = auth.uid() and ativo limit 1;
$$;
revoke execute on function minha_empresa() from public, anon;
grant  execute on function minha_empresa() to authenticated;

create or replace function acesso_empresa(v_eid uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  -- coalesce: sem barbearia ligada, a resposta é FALSE (nunca vazio/NULL,
  -- que num "if not ..." deixaria passar)
  select coalesce(sou_super() or (v_eid is not null and v_eid = minha_empresa()), false);
$$;
revoke execute on function acesso_empresa(uuid) from public, anon;
grant  execute on function acesso_empresa(uuid) to authenticated;

create or replace function empresa_liberada(v_eid uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select case
      when e.situacao in ('bloqueada','cancelada') then false
      when e.situacao = 'teste' then e.teste_ate >= (now() at time zone 'America/Sao_Paulo')::date
      else coalesce(e.pago_ate, e.teste_ate) + 5 >= (now() at time zone 'America/Sao_Paulo')::date
    end
    from empresas e where e.id = v_eid
  ), false);
$$;
revoke execute on function empresa_liberada(uuid) from public, anon;
grant  execute on function empresa_liberada(uuid) to authenticated;

-- Regras de acesso dos perfis
alter table perfis enable row level security;
drop policy if exists "le o proprio perfil"   on perfis;
drop policy if exists "super acessa tudo"     on perfis;
drop policy if exists "admin acessa a propria" on perfis;
create policy "le o proprio perfil"    on perfis for select to authenticated using (id = auth.uid());
create policy "super acessa tudo"      on perfis for all to authenticated using (sou_super());
create policy "admin acessa a propria" on perfis for all to authenticated
  using (empresa_id = minha_empresa()) with check (empresa_id = minha_empresa());
grant select, insert, update, delete on perfis to authenticated;
grant all                             on perfis to service_role;

-- Regras de acesso das barbearias (ficam aqui porque usam as funções acima)
alter table empresas enable row level security;
drop policy if exists "super acessa tudo"       on empresas;
drop policy if exists "admin acessa a propria"  on empresas;
create policy "super acessa tudo"       on empresas for all to authenticated using (sou_super());
create policy "admin acessa a propria"  on empresas for all to authenticated
  using (id = minha_empresa()) with check (id = minha_empresa());
grant select, insert, update, delete on empresas to authenticated;
grant all                             on empresas to service_role;

-- =====================================================================
create table if not exists empresas_segredos (
  empresa_id      uuid primary key references empresas(id) on delete cascade,
  mp_access_token text,
  atualizado_em   timestamptz not null default now()
);
alter table empresas_segredos enable row level security;
drop policy if exists "ninguem le segredos" on empresas_segredos;
create policy "ninguem le segredos" on empresas_segredos for select to authenticated using (false);
grant all on empresas_segredos to service_role;

-- =====================================================================
create table if not exists assinaturas_duotech (
  id                       uuid primary key default gen_random_uuid(),
  empresa_id               uuid not null references empresas(id) on delete cascade,
  plano_id                 text not null references planos_duotech(id),
  ciclo                    text not null default 'mensal' check (ciclo in ('mensal','anual')),
  valor                    numeric(10,2) not null,
  forma                    text check (forma in ('pix','boleto','cartao','indefinida')),
  asaas_subscription_id    text unique,
  status                   text not null default 'pendente'
                           check (status in ('pendente','ativa','atrasada','cancelada')),
  proximo_vencimento       date,
  criado_em                timestamptz not null default now()
);
alter table assinaturas_duotech enable row level security;
drop policy if exists "acesso empresa" on assinaturas_duotech;
create policy "acesso empresa" on assinaturas_duotech for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on assinaturas_duotech to authenticated;
grant all                             on assinaturas_duotech to service_role;

-- =====================================================================
create table if not exists faturas (
  id                   uuid primary key default gen_random_uuid(),
  empresa_id           uuid not null references empresas(id) on delete cascade,
  assinatura_id        uuid references assinaturas_duotech(id) on delete set null,
  asaas_payment_id     text unique,
  valor                numeric(10,2) not null,
  vencimento           date not null,
  forma                text,
  status               text not null default 'pendente'
                       check (status in ('pendente','paga','atrasada','cancelada','estornada')),
  pago_em              timestamptz,
  link_pagamento       text,
  criado_em            timestamptz not null default now()
);
alter table faturas enable row level security;
drop policy if exists "acesso empresa" on faturas;
create policy "acesso empresa" on faturas for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on faturas to authenticated;
grant all                             on faturas to service_role;


-- =====================================================================
--  BARBEARIA — serviços e horários
-- =====================================================================
create table if not exists servicos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  nome            text not null,
  categoria       text not null default 'corte'
                  check (categoria in ('corte','barba','combo','coloracao','tratamento','outros')),
  descricao       text,
  duracao_min     int not null default 30 check (duracao_min between 5 and 600),
  preco           numeric(10,2) not null default 0,
  foto_url        text,
  sinal_valor     numeric(10,2),                       -- sinal para confirmar (anti-falta)
  aparece_no_link boolean not null default true,
  ativo           boolean not null default true,
  ordem           int not null default 0,
  criado_em       timestamptz not null default now()
);
alter table servicos enable row level security;
drop policy if exists "acesso empresa" on servicos;
create policy "acesso empresa" on servicos for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on servicos to authenticated;
grant all                             on servicos to service_role;

-- =====================================================================
create table if not exists bloqueios (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  inicio      timestamptz not null,
  fim         timestamptz not null check (fim > inicio),
  motivo      text,
  criado_em   timestamptz not null default now()
);
alter table bloqueios enable row level security;
drop policy if exists "acesso empresa" on bloqueios;
create policy "acesso empresa" on bloqueios for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on bloqueios to authenticated;
grant all                             on bloqueios to service_role;

-- =====================================================================
--  CLIENTES
-- =====================================================================
create table if not exists clientes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  nome            text not null,
  whatsapp        text,
  email           text,
  nascimento      date,
  observacoes     text,
  origem          text not null default 'balcao' check (origem in ('balcao','link','importado')),
  sessao_token    text,
  sessao_ate      timestamptz,
  tentativas      int not null default 0,
  bloqueado_ate   timestamptz,
  criado_em       timestamptz not null default now(),
  unique (empresa_id, whatsapp)
);
alter table clientes enable row level security;
drop policy if exists "acesso empresa" on clientes;
create policy "acesso empresa" on clientes for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on clientes to authenticated;
grant all                             on clientes to service_role;

-- =====================================================================
--  AGENDA
-- =====================================================================
create table if not exists agendamentos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  cliente_id      uuid references clientes(id) on delete set null,
  servico_id      uuid references servicos(id) on delete set null,
  servico_nome    text not null default '',
  barbeiro_id     uuid references perfis(id) on delete set null,  -- qual barbeiro faz
  inicio          timestamptz not null,
  fim             timestamptz not null,
  preco           numeric(10,2) not null default 0,
  desconto        numeric(10,2) not null default 0,
  status          text not null default 'agendado'
                  check (status in ('agendado','confirmado','em_atendimento','concluido','cancelado','faltou')),
  origem          text not null default 'balcao' check (origem in ('balcao','link','whatsapp','fila')),
  forma_pagamento text check (forma_pagamento in ('dinheiro','pix','cartao_credito','cartao_debito','plano','cortesia')),
  pago            boolean not null default false,
  sinal_valor     numeric(10,2),
  sinal_pago      boolean not null default false,
  pacote_id       uuid,
  plano_cliente_id uuid,                               -- se foi via plano mensal
  observacoes     text,
  cancelado_por   text,
  criado_em       timestamptz not null default now(),
  check (fim > inicio),
  -- nunca dois agendamentos do mesmo barbeiro se sobrepondo
  constraint agend_sem_conflito_barbeiro exclude using gist (
    empresa_id with =,
    barbeiro_id with =,
    tstzrange(inicio, fim) with &&
  ) where (status not in ('cancelado','faltou') and barbeiro_id is not null)
);
create index if not exists idx_agendamentos_empresa_inicio on agendamentos (empresa_id, inicio);
create index if not exists idx_agendamentos_barbeiro       on agendamentos (barbeiro_id, inicio);
alter table agendamentos enable row level security;
drop policy if exists "acesso empresa" on agendamentos;
create policy "acesso empresa" on agendamentos for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on agendamentos to authenticated;
grant all                             on agendamentos to service_role;

-- =====================================================================
--  FILA DE ESPERA (walk-in)
-- =====================================================================
create table if not exists fila_espera (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  cliente_id      uuid references clientes(id) on delete set null,
  nome_avulso     text,                                -- se não cadastrado
  servico_id      uuid references servicos(id) on delete set null,
  servico_nome    text not null default '',
  barbeiro_id     uuid references perfis(id) on delete set null,
  posicao         int not null default 0,
  status          text not null default 'aguardando'
                  check (status in ('aguardando','chamado','em_atendimento','concluido','desistiu')),
  chegou_em       timestamptz not null default now(),
  chamado_em      timestamptz,
  iniciado_em     timestamptz,
  concluido_em    timestamptz,
  agendamento_id  uuid references agendamentos(id) on delete set null
);
alter table fila_espera enable row level security;
drop policy if exists "acesso empresa" on fila_espera;
create policy "acesso empresa" on fila_espera for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on fila_espera to authenticated;
grant all                             on fila_espera to service_role;

-- =====================================================================
--  FIDELIDADE (10ª visita grátis)
-- =====================================================================
create table if not exists fidelidade (
  empresa_id      uuid not null references empresas(id) on delete cascade,
  cliente_id      uuid not null references clientes(id) on delete cascade,
  selos           int not null default 0,
  premios_usados  int not null default 0,
  atualizado_em   timestamptz not null default now(),
  primary key (empresa_id, cliente_id)
);
alter table fidelidade enable row level security;
drop policy if exists "acesso empresa" on fidelidade;
create policy "acesso empresa" on fidelidade for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on fidelidade to authenticated;
grant all                             on fidelidade to service_role;

-- Trigger: incrementa selos quando agendamento for concluído
create or replace function trg_fidelidade_concluido()
returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_meta int;
begin
  -- só age na transição para 'concluido'
  if new.status = 'concluido' and old.status <> 'concluido' and new.cliente_id is not null then
    -- busca a meta de selos da empresa
    select fidelidade_meta into v_meta from empresas where id = new.empresa_id;
    v_meta := coalesce(v_meta, 10);

    insert into fidelidade (empresa_id, cliente_id, selos, premios_usados, atualizado_em)
      values (new.empresa_id, new.cliente_id, 1, 0, now())
    on conflict (empresa_id, cliente_id) do update
      set selos        = fidelidade.selos + 1,
          atualizado_em = now();
  end if;
  return new;
end;
$$;

drop trigger if exists tgr_fidelidade on agendamentos;
create trigger tgr_fidelidade
  after update of status on agendamentos
  for each row execute function trg_fidelidade_concluido();

-- =====================================================================
--  PLANOS MENSAIS (assinatura do cliente com a barbearia)
-- =====================================================================
create table if not exists planos_cliente (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  nome            text not null,                       -- ex: "Plano Básico"
  descricao       text,
  preco           numeric(10,2) not null,
  cortes_mes      int not null default 0,              -- 0 = ilimitado
  servicos_ids    uuid[],                              -- quais serviços cobre (nulo = todos)
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now()
);
alter table planos_cliente enable row level security;
drop policy if exists "acesso empresa" on planos_cliente;
create policy "acesso empresa" on planos_cliente for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on planos_cliente to authenticated;
grant all                             on planos_cliente to service_role;

-- =====================================================================
create table if not exists planos_cliente_usos (
  id                   uuid primary key default gen_random_uuid(),
  empresa_id           uuid not null references empresas(id) on delete cascade,
  plano_id             uuid not null references planos_cliente(id) on delete cascade,
  cliente_id           uuid not null references clientes(id) on delete cascade,
  asaas_subscription_id text unique,
  status               text not null default 'ativo'
                       check (status in ('ativo','pausado','cancelado','expirado')),
  inicio               date not null default (now() at time zone 'America/Sao_Paulo')::date,
  fim                  date,
  cortes_usados_mes    int not null default 0,
  mes_referencia       text,                           -- 'YYYY-MM'
  proximo_vencimento   date,
  criado_em            timestamptz not null default now()
);
alter table planos_cliente_usos enable row level security;
drop policy if exists "acesso empresa" on planos_cliente_usos;
create policy "acesso empresa" on planos_cliente_usos for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on planos_cliente_usos to authenticated;
grant all                             on planos_cliente_usos to service_role;

-- =====================================================================
--  COMISSÕES
-- =====================================================================
create table if not exists comissao_config (
  empresa_id      uuid not null references empresas(id) on delete cascade,
  barbeiro_id     uuid not null references perfis(id)   on delete cascade,
  pct_padrao      numeric(5,2) not null default 0,     -- % padrão
  -- exceções por serviço: [{"servico_id":"...", "pct":40}]
  excecoes        jsonb not null default '[]'::jsonb,
  atualizado_em   timestamptz not null default now(),
  primary key (empresa_id, barbeiro_id)
);
alter table comissao_config enable row level security;
drop policy if exists "acesso empresa" on comissao_config;
create policy "acesso empresa" on comissao_config for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on comissao_config to authenticated;
grant all                             on comissao_config to service_role;

-- =====================================================================
--  FINANCEIRO
-- =====================================================================
create table if not exists financeiro (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  tipo            text not null check (tipo in ('entrada','saida')),
  categoria       text not null default 'Atendimento',
  descricao       text,
  valor           numeric(10,2) not null check (valor >= 0),
  forma           text,
  data            date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  vencimento      date,
  pago            boolean not null default true,
  barbeiro_id     uuid references perfis(id) on delete set null,
  comissao_valor  numeric(10,2),                       -- calculada no fechamento
  agendamento_id  uuid references agendamentos(id) on delete cascade,
  pacote_id       uuid,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_financeiro_empresa_data on financeiro (empresa_id, data);
alter table financeiro enable row level security;
drop policy if exists "acesso empresa" on financeiro;
create policy "acesso empresa" on financeiro for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on financeiro to authenticated;
grant all                             on financeiro to service_role;

-- =====================================================================
--  ESTOQUE
-- =====================================================================
create table if not exists produtos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  nome            text not null,
  categoria       text not null default 'outros',
  unidade         text not null default 'un',
  estoque_atual   numeric(10,3) not null default 0,
  estoque_minimo  numeric(10,3) not null default 0,
  preco_custo     numeric(10,2),
  preco_venda     numeric(10,2),
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now()
);
alter table produtos enable row level security;
drop policy if exists "acesso empresa" on produtos;
create policy "acesso empresa" on produtos for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on produtos to authenticated;
grant all                             on produtos to service_role;

-- =====================================================================
--  WHATSAPP
-- =====================================================================
create table if not exists whatsapp_fila (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  agendamento_id  uuid references agendamentos(id) on delete cascade,
  tipo            text not null,
  para            text not null,
  mensagem        text not null,
  enviado         boolean not null default false,
  tentativas      int not null default 0,
  criado_em       timestamptz not null default now(),
  enviar_em       timestamptz not null default now()
);
alter table whatsapp_fila enable row level security;
drop policy if exists "acesso empresa" on whatsapp_fila;
create policy "acesso empresa" on whatsapp_fila for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on whatsapp_fila to authenticated;
grant all                             on whatsapp_fila to service_role;

create table if not exists whatsapp_log (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  fila_id         uuid references whatsapp_fila(id) on delete set null,
  status          text not null,
  resposta        jsonb,
  enviado_em      timestamptz not null default now()
);
alter table whatsapp_log enable row level security;
drop policy if exists "acesso empresa" on whatsapp_log;
create policy "acesso empresa" on whatsapp_log for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on whatsapp_log to authenticated;
grant all                             on whatsapp_log to service_role;

-- =====================================================================
--  PUSH (avisos no celular)
-- =====================================================================
create table if not exists push_inscricoes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  perfil_id       uuid not null references perfis(id) on delete cascade,
  endpoint        text not null,
  p256dh          text not null,
  auth            text not null,
  criado_em       timestamptz not null default now(),
  unique (perfil_id, endpoint)
);
alter table push_inscricoes enable row level security;
drop policy if exists "acesso empresa" on push_inscricoes;
create policy "acesso empresa" on push_inscricoes for all to authenticated
  using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id));
grant select, insert, update, delete on push_inscricoes to authenticated;
grant all                             on push_inscricoes to service_role;

-- =====================================================================
--  DEMO — cliente de exemplo (Thiago Prado Barbearia)
-- =====================================================================
-- Descomente para inserir dados de demonstração numa instância vazia.
/*
do $$
declare
  v_emp  uuid := gen_random_uuid();
  v_cli1 uuid := gen_random_uuid();
  v_cli2 uuid := gen_random_uuid();
  v_srv1 uuid := gen_random_uuid();
  v_srv2 uuid := gen_random_uuid();
  v_srv3 uuid := gen_random_uuid();
begin
  insert into empresas (id, nome, profissional, slug, situacao, cor_principal, cor_destaque, whatsapp, instagram, cidade)
  values (v_emp, 'Thiago Prado Barbearia', 'Thiago Prado', 'thiagoprado',
          'ativa', '#C9A84C', '#A8872E', '5516999990000', '@thiagopradobarbearia', 'Ribeirão Preto - SP');

  insert into servicos (id, empresa_id, nome, categoria, duracao_min, preco, ordem)
  values
    (v_srv1, v_emp, 'Corte Clássico',    'corte',  30, 35.00, 1),
    (v_srv2, v_emp, 'Barba Completa',    'barba',  30, 30.00, 2),
    (v_srv3, v_emp, 'Combo (Corte+Barba)', 'combo', 55, 60.00, 3);

  insert into clientes (id, empresa_id, nome, whatsapp, origem)
  values
    (v_cli1, v_emp, 'Carlos Mendes',  '5516988880001', 'link'),
    (v_cli2, v_emp, 'Rafael Oliveira','5516988880002', 'balcao');

  -- fidelidade
  insert into fidelidade (empresa_id, cliente_id, selos) values (v_emp, v_cli1, 7), (v_emp, v_cli2, 2);
end;
$$;
*/

-- =====================================================================
--  FIM
-- =====================================================================
-- Verificação rápida após rodar:
-- select table_name from information_schema.tables
--   where table_schema = 'public' order by 1;
