-- =====================================================================
--  DuoTech Barber — VERSÃO 13 (visual novo, produtos no app, CRM)
--  Projeto Supabase: duotech-barber   ← CONFERIR O NOME NO TOPO!
--  Só ACRESCENTA: o app que está no ar continua funcionando igual.
--  Pode rodar mais de uma vez. Sem senhas, chaves ou tokens.
-- =====================================================================
set client_min_messages = warning;

-- 1. Produtos à venda no app do cliente
alter table produtos add column if not exists foto_url text;
--    Aparecem os produtos ativos que têm PREÇO DE VENDA no estoque.
create or replace function link_produtos(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare v_e empresas;
begin
  v_e := _empresa_link(p_slug);
  if v_e.id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('nome', p.nome, 'categoria', p.categoria, 'preco', p.preco_venda,
             'foto_url', p.foto_url, 'disponivel', coalesce(p.estoque_atual, 0) > 0) order by p.categoria nulls last, p.nome)
      from produtos p
     where p.empresa_id = v_e.id and p.ativo and coalesce(p.preco_venda, 0) > 0), '[]'::jsonb);
end $$;
revoke execute on function link_produtos(text) from public;
grant  execute on function link_produtos(text) to anon, authenticated;

-- 2. Ficha do cliente no painel (visagismo e anotações da equipe)
alter table clientes add column if not exists ficha jsonb not null default '{}'::jsonb;

-- =====================================================================
--  CONFERIR
--  select link_produtos('thiagoprado');
-- =====================================================================
