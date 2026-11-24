-- =====================================================================
--  DuoTech Barber — ACESSO AO PAINEL E EQUIPE (preencher e rodar)
--  Projeto Supabase: duotech-barber   ← CONFERIR O NOME NO TOPO!
--  Rodar DEPOIS do barber-v4-painel.sql.
--
--  ANTES DE RODAR (uma vez):
--    Supabase → Authentication → Users → Add user → Create new user
--    E-mail do Thiago + uma senha forte → marque "Auto Confirm User".
--    A senha NÃO vai neste arquivo: só o e-mail.
--
--  Troque o que está em MAIÚSCULAS. Pode rodar mais de uma vez.
--  Se algo estiver errado, NADA é gravado e aparece o motivo.
-- =====================================================================
do $$
declare
  v_email   text := 'EMAIL_DO_THIAGO';      -- o mesmo e-mail criado em Authentication → Users
  v_nome    text := 'Thiago Prado';
  v_comissao numeric := 0;                  -- % do Thiago como barbeiro (0 = usa a do Lucro real)

  -- equipe que só aparece na agenda (sem login). Nome e % de comissão nos serviços.
  -- Deixe a lista vazia se ainda não quiser cadastrar: array[]::text[]
  v_barbeiros text[]    := array['Everton Daniel Elias', 'Wesley Evaristo David'];
  v_comissoes numeric[] := array[0, 0];      -- mesma ordem dos nomes (0 = usa a do Lucro real)

  v_emp  uuid;
  v_user uuid;
  i int;
begin
  if v_email = 'EMAIL_DO_THIAGO' then
    raise exception 'Nada foi gravado. Troque EMAIL_DO_THIAGO pelo e-mail criado em Authentication → Users.';
  end if;
  select id into v_emp from empresas where slug = 'thiagoprado';
  if v_emp is null then raise exception 'Barbearia thiagoprado não encontrada. Rode antes os SQL da versão 3 e 4.'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(v_email));
  if v_user is null then
    raise exception 'Nada foi gravado. O e-mail % não existe em Authentication → Users. Crie o usuário primeiro.', v_email;
  end if;
  if coalesce(array_length(v_barbeiros, 1), 0) <> coalesce(array_length(v_comissoes, 1), 0) then
    raise exception 'Nada foi gravado. A lista de barbeiros e a de comissões precisam ter o mesmo tamanho.';
  end if;

  -- dono: acesso ao painel e aparece na agenda
  insert into perfis (id, empresa_id, tipo, nome, email, comissao_pct, aparece_no_link, ativo)
  values (v_user, v_emp, 'admin', v_nome, lower(trim(v_email)), v_comissao, true, true)
  on conflict (id) do update set empresa_id = excluded.empresa_id, tipo = 'admin', nome = excluded.nome,
                                 email = excluded.email, ativo = true;

  -- barbeiros sem login (não cria de novo quem já existe com o mesmo nome)
  for i in 1 .. coalesce(array_length(v_barbeiros, 1), 0) loop
    insert into perfis (empresa_id, tipo, nome, comissao_pct, aparece_no_link, ativo)
    select v_emp, 'barbeiro', trim(v_barbeiros[i]), v_comissoes[i], true, true
    where not exists (select 1 from perfis where empresa_id = v_emp and lower(nome) = lower(trim(v_barbeiros[i])));
  end loop;
end $$;

-- Conferir
select nome, tipo, email, comissao_pct, aparece_no_link
from perfis where empresa_id = (select id from empresas where slug = 'thiagoprado') order by tipo, nome;
