-- =====================================================================
--  DuoTech Barber — VERSÃO 3  (barber-v3-thiago-prado.sql)
--
--  O QUE ESTE ARQUIVO FAZ (só ACRESCENTA, não apaga nada):
--    1. Personalidade da barbearia (frase, boas-vindas, jeito de falar,
--       nome do clube, especialidade)
--    2. Serviços com "a partir de" e destaque "Em alta"
--    3. Planos com vagas, "Mais vendido", vigência, vantagens e termos
--    4. Login do cliente com WhatsApp + senha (igual ao Beauty) e
--       agendamento online de verdade pelo link
--    5. Clube de pontos (igual ao do Beauty): pontos por atendimento,
--       prêmios e resgate com código
--    6. Pagamento dos planos por Pix (QR Code e copia e cola com a
--       chave da barbearia; a barbearia confirma quando o Pix cair)
--    7. Dados da Thiago Prado Barbearia: 23 serviços, 7 planos Gold
--
--  COMO RODAR:
--    Projeto Supabase: duotech-barber   ← CONFERIR O NOME NO TOPO!
--    NUNCA rodar no projeto do DuoTech Beauty.
--    Precisa ter rodado antes o schema-barber.sql.
--    SQL Editor → New query → cole tudo → Run.
--    Pode rodar mais de uma vez sem problema.
--
--  Sem senhas, chaves ou tokens neste arquivo.
-- =====================================================================

set client_min_messages = warning;

-- =====================================================================
--  0. CORREÇÃO DE SEGURANÇA
--  acesso_empresa() devolvia vazio (NULL) para quem está logado mas não é
--  de nenhuma barbearia. Dentro de funções, "if not acesso_empresa(...)"
--  deixava essa pessoa passar. Agora devolve sempre verdadeiro ou falso.
-- =====================================================================
create or replace function acesso_empresa(v_eid uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $$
  select coalesce(sou_super() or (v_eid is not null and v_eid = minha_empresa()), false);
$$;
revoke execute on function acesso_empresa(uuid) from public, anon;
grant  execute on function acesso_empresa(uuid) to authenticated;

-- =====================================================================
--  1. PERSONALIDADE DA BARBEARIA
-- =====================================================================
alter table empresas add column if not exists slogan          text;
alter table empresas add column if not exists boas_vindas     text;
alter table empresas add column if not exists tom_voz         text not null default 'descontraido';
alter table empresas add column if not exists clube_nome      text not null default 'Clube de pontos';
alter table empresas add column if not exists especialidade   text;
alter table empresas add column if not exists capa_url        text;
alter table empresas add column if not exists pontos_ativo    boolean not null default true;
alter table empresas add column if not exists pontos_por_real numeric(6,2) not null default 1;

-- Pix da barbearia (a chave Pix é pública: aparece para quem vai pagar)
alter table empresas add column if not exists pix_tipo   text;
alter table empresas add column if not exists pix_chave  text;
alter table empresas add column if not exists pix_nome   text;   -- nome de quem recebe (como está no banco)
alter table empresas add column if not exists pix_cidade text;
alter table empresas drop constraint if exists empresas_pix_tipo_check;
alter table empresas add  constraint empresas_pix_tipo_check
  check (pix_tipo is null or pix_tipo in ('cpf','cnpj','telefone','email','aleatoria'));

alter table empresas drop constraint if exists empresas_tom_voz_check;
alter table empresas add  constraint empresas_tom_voz_check
  check (tom_voz in ('descontraido','classico','premium'));

-- =====================================================================
--  2. BARBEIROS NO LINK (foto e especialidade)
-- =====================================================================
alter table perfis add column if not exists foto_url        text;
alter table perfis add column if not exists especialidade   text;
alter table perfis add column if not exists aparece_no_link boolean not null default true;

-- =====================================================================
--  3. SERVIÇOS
-- =====================================================================
alter table servicos add column if not exists preco_a_partir boolean not null default false;
alter table servicos add column if not exists destaque       boolean not null default false;

alter table servicos drop constraint if exists servicos_categoria_check;
alter table servicos add  constraint servicos_categoria_check
  check (categoria in ('corte','barba','combo','coloracao','tratamento','estetica','premium','outros'));

-- =====================================================================
--  4. PLANOS (vagas, mais vendido, vantagens)
-- =====================================================================
alter table planos_cliente add column if not exists vagas_total  int check (vagas_total is null or vagas_total >= 0); -- vazio = sem limite
alter table planos_cliente add column if not exists mais_vendido boolean not null default false;
alter table planos_cliente add column if not exists vigencia     text not null default 'Indeterminado';
alter table planos_cliente add column if not exists vantagens    text[] not null default '{}';
alter table planos_cliente add column if not exists termos_url   text;
alter table planos_cliente add column if not exists ordem        int not null default 0;

alter table planos_cliente_usos add column if not exists pagamento_informado_em timestamptz; -- cliente tocou em "Já paguei"
alter table planos_cliente_usos add column if not exists ultimo_pagamento       date;

alter table planos_cliente_usos drop constraint if exists planos_cliente_usos_status_check;
alter table planos_cliente_usos add  constraint planos_cliente_usos_status_check
  check (status in ('aguardando_pagamento','ativo','pausado','cancelado','expirado'));

-- =====================================================================
--  5. LOGIN DO CLIENTE (igual ao DuoTech Beauty: WhatsApp + senha)
--  A senha fica embaralhada (bcrypt). O app recebe um "token" de sessão
--  que vale 90 dias; no banco fica só o resumo (sha256) dele.
-- =====================================================================
alter table clientes add column if not exists senha_hash text;

create table if not exists cliente_sessoes (
  token_hash  text primary key,
  empresa_id  uuid not null references empresas(id) on delete cascade,
  cliente_id  uuid not null references clientes(id) on delete cascade,
  expira      timestamptz not null default now() + interval '90 days',
  criado_em   timestamptz not null default now()
);
alter table cliente_sessoes enable row level security;   -- sem regra: só as funções mexem
grant all on cliente_sessoes to service_role;

-- =====================================================================
--  6. CLUBE DE PONTOS
-- =====================================================================
create table if not exists pontos_mov (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  cliente_id     uuid not null references clientes(id) on delete cascade,
  pontos         int not null,
  tipo           text not null check (tipo in ('atendimento','resgate','ajuste','bonus_cadastro','aniversario')),
  descricao      text,
  agendamento_id uuid references agendamentos(id) on delete cascade,
  criado_em      timestamptz not null default now()
);
create index if not exists pontos_mov_cliente on pontos_mov (cliente_id);

create table if not exists recompensas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nome        text not null,
  descricao   text,
  pontos      int not null check (pontos > 0),
  ativo       boolean not null default true,
  ordem       int not null default 0,
  criado_em   timestamptz not null default now()
);

create table if not exists resgates (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  cliente_id    uuid not null references clientes(id) on delete cascade,
  recompensa_id uuid references recompensas(id) on delete set null,
  nome          text not null,
  pontos        int not null,
  codigo        text not null,
  status        text not null default 'pendente' check (status in ('pendente','usado','cancelado')),
  criado_em     timestamptz not null default now(),
  usado_em      timestamptz,
  unique (empresa_id, codigo)
);

-- permissões explícitas (a barbearia vê e mexe; o cliente só pelas funções abaixo)
do $$
declare t text;
begin
  foreach t in array array['pontos_mov','recompensas','resgates'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "acesso empresa" on %I', t);
    execute format('create policy "acesso empresa" on %I for all to authenticated
                    using (acesso_empresa(empresa_id)) with check (acesso_empresa(empresa_id))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('grant all on %I to service_role', t);
  end loop;
end $$;

-- Pontos entram sozinhos quando o atendimento é CONCLUÍDO e PAGO.
-- Atendimento pelo plano mensal ou cortesia não gera pontos.
-- Se a conclusão for desfeita, os pontos saem.
create or replace function fn_agendamento_pontos() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_ativo boolean;
  v_ppr   numeric;
  v_pts   int;
begin
  delete from pontos_mov where agendamento_id = new.id and tipo = 'atendimento';
  if new.status = 'concluido' and new.pago and new.cliente_id is not null
     and coalesce(new.forma_pagamento, '') not in ('cortesia','plano') then
    select pontos_ativo, pontos_por_real into v_ativo, v_ppr from empresas where id = new.empresa_id;
    if v_ativo then
      v_pts := floor(greatest(new.preco - new.desconto, 0) * coalesce(v_ppr, 1));
      if v_pts > 0 then
        insert into pontos_mov (empresa_id, cliente_id, pontos, tipo, descricao, agendamento_id)
        values (new.empresa_id, new.cliente_id, v_pts, 'atendimento', new.servico_nome, new.id);
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_agendamento_pontos on agendamentos;
create trigger trg_agendamento_pontos
  after insert or update of status, pago, preco, desconto, forma_pagamento, cliente_id
  on agendamentos for each row execute function fn_agendamento_pontos();

create or replace function saldo_pontos(p_cliente uuid) returns int
language sql stable security definer set search_path to 'public' as $$
  select coalesce(sum(pontos), 0)::int from pontos_mov where cliente_id = p_cliente;
$$;
revoke execute on function saldo_pontos(uuid) from public, anon;
grant  execute on function saldo_pontos(uuid) to authenticated;

-- código curto, fácil de falar no balcão (sem 0/O/1/I)
create or replace function _codigo_curto() returns text
language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;
revoke execute on function _codigo_curto() from public, anon;

-- =====================================================================
--  7. FUNÇÕES DO LINK PÚBLICO E DA CONTA DO CLIENTE
--  Todas devolvem {"erro": "..."} quando algo não pode ser feito,
--  com a mensagem pronta para mostrar ao cliente.
-- =====================================================================

-- 7.0 Apoio (internas)
create or replace function _fone(p text) returns text
language sql immutable as $$
  select case when length(n) > 11 and n like '55%' then substr(n, 3) else n end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') n) x;
$$;

create or replace function _empresa_link(p_slug text) returns empresas
language plpgsql stable security definer set search_path to 'public' as $$
declare v_e empresas;
begin
  select * into v_e from empresas where slug = lower(trim(p_slug));
  if not found or not v_e.link_ativo or not empresa_liberada(v_e.id) then return null; end if;
  return v_e;
end $$;

create or replace function _cliente_token(p_empresa uuid, p_token text) returns clientes
language plpgsql stable security definer set search_path to public, extensions as $$
declare v_c clientes;
begin
  if coalesce(p_token, '') = '' then return null; end if;
  select cl.* into v_c from cliente_sessoes s join clientes cl on cl.id = s.cliente_id
   where s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
     and s.empresa_id = p_empresa and s.expira > now();
  return v_c;
end $$;

create or replace function _nova_sessao(p_empresa uuid, p_cliente uuid) returns text
language plpgsql security definer set search_path to public, extensions as $$
declare v_t text := encode(gen_random_bytes(24), 'hex');
begin
  insert into cliente_sessoes (token_hash, empresa_id, cliente_id)
  values (encode(digest(v_t, 'sha256'), 'hex'), p_empresa, p_cliente);
  delete from cliente_sessoes where cliente_id = p_cliente and expira < now();
  return v_t;
end $$;

do $$
declare f text;
begin
  foreach f in array array['_fone(text)','_empresa_link(text)','_cliente_token(uuid,text)','_nova_sessao(uuid,uuid)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- 7.1 Tudo que o link público mostra (qualquer pessoa pode ver)
create or replace function link_publico(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_emp empresas;
begin
  v_emp := _empresa_link(p_slug);
  if v_emp.id is null then return jsonb_build_object('erro', 'Agenda online indisponível no momento.'); end if;

  return jsonb_build_object(
    'empresa', jsonb_build_object(
      'nome', v_emp.nome, 'slug', v_emp.slug, 'slogan', v_emp.slogan,
      'boas_vindas', v_emp.boas_vindas, 'tom_voz', v_emp.tom_voz,
      'clube_nome', v_emp.clube_nome, 'especialidade', v_emp.especialidade,
      'logo_url', v_emp.logo_url, 'capa_url', v_emp.capa_url,
      'cor_principal', v_emp.cor_principal, 'cor_destaque', v_emp.cor_destaque,
      'whatsapp', v_emp.whatsapp, 'instagram', v_emp.instagram,
      'cidade', v_emp.cidade, 'endereco', v_emp.endereco,
      'pontos_ativo', v_emp.pontos_ativo, 'pontos_por_real', v_emp.pontos_por_real,
      'horarios', v_emp.horarios, 'dias_abertos_link', v_emp.dias_abertos_link,
      'pix_tipo', v_emp.pix_tipo, 'pix_chave', v_emp.pix_chave,
      'pix_nome', coalesce(v_emp.pix_nome, v_emp.nome), 'pix_cidade', coalesce(v_emp.pix_cidade, v_emp.cidade)),
    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'categoria', s.categoria,
               'descricao', s.descricao, 'duracao_min', s.duracao_min, 'preco', s.preco,
               'preco_a_partir', s.preco_a_partir, 'destaque', s.destaque, 'foto_url', s.foto_url,
               'sinal_valor', s.sinal_valor) order by s.ordem, s.nome)
      from servicos s where s.empresa_id = v_emp.id and s.ativo and s.aparece_no_link), '[]'::jsonb),
    'planos', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'descricao', p.descricao,
               'preco', p.preco, 'vigencia', p.vigencia, 'vantagens', to_jsonb(p.vantagens),
               'termos_url', p.termos_url, 'mais_vendido', p.mais_vendido,
               'vagas_restantes', case when p.vagas_total is null then null else greatest(p.vagas_total - (
                   select count(*) from planos_cliente_usos u
                   where u.plano_id = p.id and u.status in ('ativo','aguardando_pagamento')), 0) end)
             order by p.ordem, p.preco)
      from planos_cliente p where p.empresa_id = v_emp.id and p.ativo), '[]'::jsonb),
    'barbeiros', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'foto_url', b.foto_url,
               'especialidade', b.especialidade) order by b.nome)
      from perfis b where b.empresa_id = v_emp.id and b.ativo and b.aparece_no_link), '[]'::jsonb),
    'recompensas', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'descricao', r.descricao,
               'pontos', r.pontos) order by r.pontos)
      from recompensas r where r.empresa_id = v_emp.id and r.ativo), '[]'::jsonb)
  );
end $$;

-- 7.2 Horários livres de um dia (respeita horário da barbearia, bloqueios e o barbeiro escolhido)
create or replace function link_horarios(p_slug text, p_servico uuid, p_data date, p_barbeiro uuid default null)
returns setof timestamptz
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_e    empresas;
  v_s    servicos;
  v_turno jsonb;
  v_ini  timestamptz;
  v_fim  timestamptz;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tem_barbeiros boolean;
begin
  v_e := _empresa_link(p_slug);
  if v_e.id is null then return; end if;
  select * into v_s from servicos where id = p_servico and empresa_id = v_e.id and ativo and aparece_no_link;
  if not found then return; end if;
  if p_data < v_hoje or p_data > v_hoje + v_e.dias_abertos_link then return; end if;
  select exists (select 1 from perfis where empresa_id = v_e.id and ativo and aparece_no_link) into v_tem_barbeiros;

  for v_turno in select * from jsonb_array_elements(coalesce(v_e.horarios -> extract(dow from p_data)::int::text, '[]'::jsonb))
  loop
    v_ini := (p_data + (v_turno ->> 0)::time) at time zone 'America/Sao_Paulo';
    v_fim := (p_data + (v_turno ->> 1)::time) at time zone 'America/Sao_Paulo';
    return query
      select t from generate_series(v_ini, v_fim - make_interval(mins => v_s.duracao_min),
                                    make_interval(mins => greatest(v_e.intervalo_agenda, 5))) t
      where t >= now() + make_interval(mins => v_e.antecedencia_min)
        and not exists (select 1 from bloqueios b where b.empresa_id = v_e.id
                          and b.inicio < t + make_interval(mins => v_s.duracao_min) and b.fim > t)
        and (
          -- barbeiro escolhido: ele precisa estar livre
          (p_barbeiro is not null and not exists (
             select 1 from agendamentos a where a.empresa_id = v_e.id and a.barbeiro_id = p_barbeiro
               and a.status not in ('cancelado','faltou')
               and a.inicio < t + make_interval(mins => v_s.duracao_min) and a.fim > t))
          -- sem preferência: basta um barbeiro livre
          or (p_barbeiro is null and v_tem_barbeiros and exists (
             select 1 from perfis b where b.empresa_id = v_e.id and b.ativo and b.aparece_no_link
               and not exists (select 1 from agendamentos a where a.empresa_id = v_e.id and a.barbeiro_id = b.id
                 and a.status not in ('cancelado','faltou')
                 and a.inicio < t + make_interval(mins => v_s.duracao_min) and a.fim > t)))
          -- barbearia sem barbeiros cadastrados: agenda única
          or (p_barbeiro is null and not v_tem_barbeiros and not exists (
             select 1 from agendamentos a where a.empresa_id = v_e.id and a.status not in ('cancelado','faltou')
               and a.inicio < t + make_interval(mins => v_s.duracao_min) and a.fim > t))
        );
  end loop;
end $$;

-- 7.3 Criar conta (cliente novo)
create or replace function cliente_cadastrar(p_slug text, p_nome text, p_whatsapp text, p_senha text, p_nascimento date default null)
returns jsonb
language plpgsql security definer set search_path to public, extensions as $$
declare v_e empresas; v_c clientes; v_wa text := _fone(p_whatsapp);
begin
  v_e := _empresa_link(p_slug);
  if v_e.id is null then return jsonb_build_object('erro', 'Agenda online indisponível no momento.'); end if;
  if length(trim(coalesce(p_nome, ''))) < 2 then return jsonb_build_object('erro', 'Digite seu nome.'); end if;
  if length(v_wa) not in (10, 11) then return jsonb_build_object('erro', 'WhatsApp inválido. Use DDD + número.'); end if;
  if length(coalesce(p_senha, '')) < 6 then return jsonb_build_object('erro', 'A senha precisa ter pelo menos 6 caracteres.'); end if;

  select * into v_c from clientes where empresa_id = v_e.id and whatsapp = v_wa;
  if found and v_c.senha_hash is not null then
    return jsonb_build_object('erro', 'Esse WhatsApp já tem conta. Toque em "Já tenho conta" e entre com sua senha.', 'tem_conta', true);
  end if;
  if found then
    -- já é cliente do balcão: ninguém "assume" a ficha (e os pontos) só sabendo o WhatsApp
    return jsonb_build_object('erro', 'Você já é cliente da casa! Para sua segurança, peça sua senha de acesso no WhatsApp da barbearia.',
                              'pedir_senha', true);
  end if;
  insert into clientes (empresa_id, nome, whatsapp, nascimento, origem, senha_hash)
  values (v_e.id, left(trim(p_nome), 80), v_wa, p_nascimento, 'link', crypt(p_senha, gen_salt('bf')))
  returning * into v_c;
  return jsonb_build_object('token', _nova_sessao(v_e.id, v_c.id), 'nome', v_c.nome);
end $$;

-- 7.4 Entrar (mesma mensagem para "não existe" e "senha errada"; bloqueia após 5 erros)
create or replace function cliente_entrar(p_slug text, p_whatsapp text, p_senha text) returns jsonb
language plpgsql security definer set search_path to public, extensions as $$
declare v_e empresas; v_c clientes; v_wa text := _fone(p_whatsapp); v_n int;
begin
  v_e := _empresa_link(p_slug);
  if v_e.id is null then return jsonb_build_object('erro', 'Agenda online indisponível no momento.'); end if;
  select * into v_c from clientes where empresa_id = v_e.id and whatsapp = v_wa;
  if not found or v_c.senha_hash is null then
    perform crypt(coalesce(p_senha, ''), gen_salt('bf'));
    return jsonb_build_object('erro', 'WhatsApp ou senha incorretos. Primeira vez? Toque em "Criar conta".');
  end if;
  if v_c.bloqueado_ate is not null and v_c.bloqueado_ate > now() then
    return jsonb_build_object('erro', 'Muitas tentativas. Aguarde um pouco ou peça uma senha nova à barbearia.');
  end if;
  if v_c.senha_hash <> crypt(coalesce(p_senha, ''), v_c.senha_hash) then
    v_n := v_c.tentativas + 1;
    update clientes set tentativas = v_n,
      bloqueado_ate = case when v_n % 5 = 0 then now() + make_interval(mins => least(15 * power(2, v_n / 5 - 1)::int, 240)) else bloqueado_ate end
    where id = v_c.id;
    return jsonb_build_object('erro', 'WhatsApp ou senha incorretos. Esqueceu? Peça uma senha nova à barbearia.');
  end if;
  update clientes set tentativas = 0, bloqueado_ate = null where id = v_c.id;
  return jsonb_build_object('token', _nova_sessao(v_e.id, v_c.id), 'nome', v_c.nome);
end $$;

create or replace function cliente_sair(p_token text) returns void
language sql security definer set search_path to public, extensions as $$
  delete from cliente_sessoes where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- 7.5 Minha conta: pontos, extrato, prêmios trocados, plano e próximos horários
create or replace function cliente_painel(p_slug text, p_token text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_e empresas; v_c clientes;
begin
  v_e := _empresa_link(p_slug);
  v_c := _cliente_token(v_e.id, p_token);
  if v_c.id is null then return jsonb_build_object('erro', 'Entre de novo na sua conta.', 'sair', true); end if;

  return jsonb_build_object(
    'cliente', jsonb_build_object('nome', v_c.nome, 'whatsapp', v_c.whatsapp, 'nascimento', v_c.nascimento),
    'saldo', saldo_pontos(v_c.id),
    'extrato', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('pontos', m.pontos, 'tipo', m.tipo, 'descricao', m.descricao, 'criado_em', m.criado_em) x
        from pontos_mov m where m.cliente_id = v_c.id order by m.criado_em desc limit 20) t), '[]'::jsonb),
    'resgates', coalesce((select jsonb_agg(jsonb_build_object('nome', r.nome, 'pontos', r.pontos,
        'codigo', r.codigo, 'status', r.status, 'criado_em', r.criado_em) order by r.criado_em desc)
        from resgates r where r.cliente_id = v_c.id), '[]'::jsonb),
    'plano', (select jsonb_build_object('id', u.id, 'nome', p.nome, 'preco', p.preco, 'status', u.status,
               'proximo_vencimento', u.proximo_vencimento, 'pagamento_informado_em', u.pagamento_informado_em)
        from planos_cliente_usos u join planos_cliente p on p.id = u.plano_id
        where u.cliente_id = v_c.id and u.status in ('ativo','aguardando_pagamento','pausado')
        order by u.criado_em desc limit 1),
    'proximos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'servico', a.servico_nome, 'inicio', a.inicio,
        'status', a.status, 'barbeiro', pf.nome) order by a.inicio)
        from agendamentos a left join perfis pf on pf.id = a.barbeiro_id
        where a.cliente_id = v_c.id and a.inicio >= now() and a.status in ('agendado','confirmado')), '[]'::jsonb)
  );
end $$;

-- 7.6 Agendar pelo link (precisa estar logado)
create or replace function link_agendar(p_slug text, p_token text, p_servico uuid, p_inicio timestamptz,
                                        p_barbeiro uuid default null, p_obs text default null)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_e empresas; v_c clientes; v_s servicos; v_barb uuid := p_barbeiro; v_id uuid;
begin
  v_e := _empresa_link(p_slug);
  if v_e.id is null then return jsonb_build_object('erro', 'Agenda online indisponível no momento.'); end if;
  v_c := _cliente_token(v_e.id, p_token);
  if v_c.id is null then return jsonb_build_object('erro', 'Entre na sua conta para agendar.', 'sair', true); end if;
  select * into v_s from servicos where id = p_servico and empresa_id = v_e.id and ativo and aparece_no_link;
  if not found then return jsonb_build_object('erro', 'Serviço indisponível.'); end if;
  if (select count(*) from agendamentos where cliente_id = v_c.id and inicio >= now()
        and status in ('agendado','confirmado')) >= 3 then
    return jsonb_build_object('erro', 'Você já tem 3 horários marcados. Fale com a barbearia para marcar mais.');
  end if;
  if not exists (select 1 from link_horarios(p_slug, p_servico, (p_inicio at time zone 'America/Sao_Paulo')::date, p_barbeiro) t
                 where t = p_inicio) then
    return jsonb_build_object('erro', 'Esse horário acabou de ser ocupado. Escolha outro.');
  end if;
  if v_barb is not null and not exists (select 1 from perfis where id = v_barb and empresa_id = v_e.id and ativo and aparece_no_link) then
    return jsonb_build_object('erro', 'Profissional indisponível.');
  end if;
  if v_barb is null then                               -- sem preferência: primeiro barbeiro livre
    select b.id into v_barb from perfis b
     where b.empresa_id = v_e.id and b.ativo and b.aparece_no_link
       and not exists (select 1 from agendamentos a where a.barbeiro_id = b.id and a.status not in ('cancelado','faltou')
             and a.inicio < p_inicio + make_interval(mins => v_s.duracao_min) and a.fim > p_inicio)
     order by random() limit 1;
  end if;

  begin
    insert into agendamentos (empresa_id, cliente_id, servico_id, servico_nome, barbeiro_id, inicio, fim,
                              preco, origem, sinal_valor, observacoes)
    values (v_e.id, v_c.id, v_s.id, v_s.nome, v_barb, p_inicio, p_inicio + make_interval(mins => v_s.duracao_min),
            v_s.preco, 'link', v_s.sinal_valor, nullif(left(trim(coalesce(p_obs, '')), 300), ''))
    returning id into v_id;
  exception when exclusion_violation then
    return jsonb_build_object('erro', 'Esse horário acabou de ser ocupado. Escolha outro.');
  end;
  return jsonb_build_object('ok', true, 'id', v_id, 'servico', v_s.nome, 'inicio', p_inicio,
                            'barbeiro', (select nome from perfis where id = v_barb));
end $$;

-- 7.7 Trocar pontos por um prêmio (gera um código para mostrar no balcão)
create or replace function cliente_resgatar(p_slug text, p_token text, p_recompensa uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_e empresas; v_c clientes; v_rec recompensas; v_saldo int; v_cod text;
begin
  v_e := _empresa_link(p_slug);
  v_c := _cliente_token(v_e.id, p_token);
  if v_c.id is null then return jsonb_build_object('erro', 'Entre na sua conta primeiro.', 'sair', true); end if;
  perform 1 from clientes where id = v_c.id for update;   -- trava: evita trocar duas vezes ao mesmo tempo

  select * into v_rec from recompensas where id = p_recompensa and empresa_id = v_e.id and ativo;
  if v_rec.id is null then return jsonb_build_object('erro', 'Prêmio não encontrado.'); end if;

  v_saldo := saldo_pontos(v_c.id);
  if v_saldo < v_rec.pontos then
    return jsonb_build_object('erro', format('Faltam %s pontos para este prêmio.', v_rec.pontos - v_saldo));
  end if;

  loop
    v_cod := _codigo_curto();
    exit when not exists (select 1 from resgates where empresa_id = v_e.id and codigo = v_cod);
  end loop;

  insert into pontos_mov (empresa_id, cliente_id, pontos, tipo, descricao)
  values (v_e.id, v_c.id, -v_rec.pontos, 'resgate', v_rec.nome);
  insert into resgates (empresa_id, cliente_id, recompensa_id, nome, pontos, codigo)
  values (v_e.id, v_c.id, v_rec.id, v_rec.nome, v_rec.pontos, v_cod);

  return jsonb_build_object('ok', true, 'codigo', v_cod, 'saldo', v_saldo - v_rec.pontos);
end $$;

-- 7.8 Escolher um plano (fica "aguardando pagamento" até a barbearia confirmar o pagamento)
create or replace function cliente_assinar_plano(p_slug text, p_token text, p_plano uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_e empresas; v_c clientes; v_plano planos_cliente; v_usados int; v_id uuid;
begin
  v_e := _empresa_link(p_slug);
  v_c := _cliente_token(v_e.id, p_token);
  if v_c.id is null then return jsonb_build_object('erro', 'Entre na sua conta para escolher um plano.', 'sair', true); end if;

  select * into v_plano from planos_cliente where id = p_plano and empresa_id = v_e.id and ativo
   for update;                                        -- trava: duas pessoas não pegam a última vaga
  if v_plano.id is null then return jsonb_build_object('erro', 'Plano não encontrado.'); end if;

  if exists (select 1 from planos_cliente_usos where cliente_id = v_c.id and status in ('ativo','aguardando_pagamento')) then
    return jsonb_build_object('erro', 'Você já tem um plano ativo ou aguardando pagamento.');
  end if;
  if v_plano.vagas_total is not null then
    select count(*) into v_usados from planos_cliente_usos
     where plano_id = v_plano.id and status in ('ativo','aguardando_pagamento');
    if v_usados >= v_plano.vagas_total then return jsonb_build_object('erro', 'As vagas deste plano acabaram.'); end if;
  end if;

  insert into planos_cliente_usos (empresa_id, plano_id, cliente_id, status, mes_referencia)
  values (v_e.id, v_plano.id, v_c.id, 'aguardando_pagamento', to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM'))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'assinatura_id', v_id, 'plano', v_plano.nome, 'preco', v_plano.preco);
end $$;

-- 7.9 Barbearia: senha provisória para cliente do balcão entrar no link
create or replace function barbearia_senha_cliente(p_cliente uuid) returns text
language plpgsql security definer set search_path to public, extensions as $$
declare v_c clientes; v_senha text := lpad(((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
begin
  select * into v_c from clientes where id = p_cliente;
  if not found or not acesso_empresa(v_c.empresa_id) then raise exception 'Sem acesso'; end if;
  update clientes set senha_hash = crypt(v_senha, gen_salt('bf')), tentativas = 0, bloqueado_ate = null where id = v_c.id;
  delete from cliente_sessoes where cliente_id = v_c.id;
  return v_senha;
end $$;

-- 7.10 Barbearia dá baixa no código de resgate no balcão
create or replace function usar_resgate(p_codigo text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_r resgates;
begin
  update resgates set status = 'usado', usado_em = now()
   where empresa_id = minha_empresa() and codigo = upper(trim(p_codigo)) and status = 'pendente'
  returning * into v_r;
  if v_r.id is null then return jsonb_build_object('erro', 'Código não encontrado ou já usado.'); end if;
  return jsonb_build_object('ok', true, 'nome', v_r.nome, 'pontos', v_r.pontos);
end $$;

-- 7.11 Cliente avisa que pagou o Pix do plano (primeira vez ou mensalidade)
create or replace function cliente_informar_pagamento_plano(p_slug text, p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_e empresas; v_c clientes; v_id uuid;
begin
  v_e := _empresa_link(p_slug);
  v_c := _cliente_token(v_e.id, p_token);
  if v_c.id is null then return jsonb_build_object('erro', 'Entre de novo na sua conta.', 'sair', true); end if;
  update planos_cliente_usos set pagamento_informado_em = now()
   where id = (select id from planos_cliente_usos where cliente_id = v_c.id
                 and status in ('aguardando_pagamento','ativo') order by criado_em desc limit 1)
  returning id into v_id;
  if v_id is null then return jsonb_build_object('erro', 'Você não tem plano para pagar.'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- 7.12 Barbearia confirma que o Pix caiu: ativa o plano (ou renova por mais 1 mês)
--      e lança a entrada no Financeiro
create or replace function barbearia_confirmar_pagamento_plano(p_assinatura uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  v_u    planos_cliente_usos;
  v_p    planos_cliente;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_venc date;
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

  insert into financeiro (empresa_id, tipo, categoria, descricao, valor, forma, data, pago)
  values (v_u.empresa_id, 'entrada', 'Plano mensal',
          v_p.nome || ' — ' || (select nome from clientes where id = v_u.cliente_id), v_p.preco, 'pix', v_hoje, true);

  return jsonb_build_object('ok', true, 'proximo_vencimento', v_venc);
end $$;

-- quem pode chamar o quê
do $$
declare f text;
begin
  -- link público e conta do cliente: qualquer pessoa (a conta é protegida pelo token)
  foreach f in array array['link_publico(text)','link_horarios(text,uuid,date,uuid)',
      'cliente_cadastrar(text,text,text,text,date)','cliente_entrar(text,text,text)','cliente_sair(text)',
      'cliente_painel(text,text)','link_agendar(text,text,uuid,timestamptz,uuid,text)',
      'cliente_resgatar(text,text,uuid)','cliente_assinar_plano(text,text,uuid)',
      'cliente_informar_pagamento_plano(text,text)'] loop
    execute format('revoke execute on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
  -- só a equipe da barbearia
  foreach f in array array['barbearia_senha_cliente(uuid)','usar_resgate(text)','barbearia_confirmar_pagamento_plano(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- =====================================================================
--  8. THIAGO PRADO BARBEARIA — personalidade, serviços, planos, prêmios
--  Durações são uma estimativa inicial: ajuste no painel.
--  Frase e boas-vindas são EXEMPLOS: troque pelas palavras do Thiago.
-- =====================================================================
do $$
declare
  v_emp uuid;
begin
  select id into v_emp from empresas where slug = 'thiagoprado';
  if v_emp is null then
    insert into empresas (nome, profissional, slug, situacao, cor_principal, cor_destaque)
    values ('Thiago Prado Barbearia', 'Thiago Prado', 'thiagoprado', 'ativa', '#C9A84C', '#111111')
    returning id into v_emp;
  end if;

  update empresas set
    slogan        = coalesce(slogan, 'Corte de rei, atendimento de rei.'),
    boas_vindas   = coalesce(boas_vindas, 'Fala, parceiro! Escolhe o serviço e garante tua cadeira.'),
    tom_voz       = 'descontraido',
    clube_nome    = case when clube_nome = 'Clube de pontos' then 'Clube Gold TP' else clube_nome end,
    especialidade = coalesce(especialidade, 'Especialista em prótese capilar')
  where id = v_emp;

  -- serviços (só insere os que ainda não existem com o mesmo nome)
  insert into servicos (empresa_id, nome, categoria, duracao_min, preco, preco_a_partir, destaque, ordem)
  select v_emp, s.nome, s.cat, s.dur, s.preco, s.apartir, s.dest, s.ordem
  from (values
    ('Corte',                       'corte',      40,   90.00, false, true,   1),
    ('Barba a vapor',               'barba',      30,   60.00, false, true,   2),
    ('Corte Infantil',              'corte',      30,   80.00, false, false,  3),
    ('Corte Raspado',               'corte',      20,   50.00, false, false,  4),
    ('Pezinho',                     'corte',      15,   50.00, false, false,  5),
    ('Só as Pontinhas',             'corte',      20,   30.00, false, false,  6),
    ('Cavanhaque',                  'barba',      20,   35.00, false, false,  7),
    ('Bigode',                      'barba',      15,   25.00, true,  false,  8),
    ('Sobrancelhas',                'estetica',   15,   25.00, false, false,  9),
    ('Risquinho',                   'estetica',   10,   10.00, false, false, 10),
    ('Depilação Orelha',            'estetica',   10,   25.00, false, false, 11),
    ('Depilação Nariz',             'estetica',   10,   25.00, false, false, 12),
    ('Pigmentação Cabelo',          'coloracao',  40,   90.00, false, false, 13),
    ('Pigmentação Barba',           'coloracao',  30,   40.00, false, false, 14),
    ('Pigmentação Sobrancelhas',    'coloracao',  15,   15.00, false, false, 15),
    ('Luzes',                       'coloracao', 120,  160.00, true,  false, 16),
    ('Platinado Global',            'coloracao', 180,  260.00, true,  false, 17),
    ('Alisamento',                  'coloracao',  90,   95.00, true,  false, 18),
    ('Hidratação dos Fios',         'tratamento', 30,   45.00, false, false, 19),
    ('Penteado',                    'tratamento', 20,   40.00, false, false, 20),
    ('Solução Cachos Soltos',       'tratamento',120,  150.00, true,  false, 21),
    ('Manutenção Prótese Capilar',  'premium',    90,  195.00, false, false, 22),
    ('Prótese Capilar',             'premium',   180, 1900.00, true,  false, 23)
  ) as s(nome, cat, dur, preco, apartir, dest, ordem)
  where not exists (select 1 from servicos x where x.empresa_id = v_emp and x.nome = s.nome);

  -- planos Gold (vagas = vagas que restavam no dia do cadastro)
  insert into planos_cliente (empresa_id, nome, preco, cortes_mes, vagas_total, mais_vendido, vantagens, ordem)
  select v_emp, p.nome, p.preco, p.cortes, p.vagas, p.top, p.vant, p.ordem
  from (values
    ('Plano Um Corte no Mês Gold',                 79.90, 1, 88,   false, array['1 corte por mês','Agendamento prioritário'], 1),
    ('Plano Raspado e Barba Gold',                255.00, 0, null, false, array['Raspado ilimitado','Barba ilimitada'], 2),
    ('Plano Corte Ilimitado Gold',                160.00, 0, 29,   false, array['Cortes ilimitados no mês'], 3),
    ('Corte e Barba Ilimitado Gold',              244.00, 0, 37,   false, array['Cortes ilimitados','Barba ilimitada'], 4),
    ('Barba Ilimitada Gold',                      154.00, 0, 35,   true,  array['Barba ilimitada no mês'], 5),
    ('Plano Corte Sobrancelha e Cavanhaque Gold', 200.00, 0, null, false, array['Corte','Sobrancelha','Cavanhaque'], 6),
    ('Corte Infantil Gold',                       129.90, 0, null, false, array['Corte infantil ilimitado'], 7)
  ) as p(nome, preco, cortes, vagas, top, vant, ordem)
  where not exists (select 1 from planos_cliente x where x.empresa_id = v_emp and x.nome = p.nome);

  -- prêmios do clube (exemplos — a barbearia ajusta)
  insert into recompensas (empresa_id, nome, pontos, ordem)
  select v_emp, r.nome, r.pts, r.ordem
  from (values
    ('Risquinho grátis',        100, 1),
    ('Sobrancelha grátis',      250, 2),
    ('Barba a vapor grátis',    600, 3),
    ('Corte grátis',            900, 4)
  ) as r(nome, pts, ordem)
  where not exists (select 1 from recompensas x where x.empresa_id = v_emp and x.nome = r.nome);
end $$;

-- =====================================================================
--  CONFERIR DEPOIS DE RODAR
-- =====================================================================
-- select count(*) from servicos       s join empresas e on e.id = s.empresa_id where e.slug = 'thiagoprado';  -- 23
-- select count(*) from planos_cliente p join empresas e on e.id = p.empresa_id where e.slug = 'thiagoprado';  -- 7
-- select link_publico('thiagoprado');
