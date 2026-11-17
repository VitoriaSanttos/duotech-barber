-- =====================================================================
--  DuoTech Barber — DADOS DA BARBEARIA (preencher e rodar)
--  Projeto Supabase: duotech-barber   ← CONFERIR O NOME NO TOPO!
--  Rodar DEPOIS do barber-v3-thiago-prado.sql.
--
--  Troque o que está em MAIÚSCULAS entre aspas. Pode rodar quantas vezes
--  quiser. Se sobrar algum valor de exemplo, NADA é gravado e aparece um
--  aviso dizendo qual campo falta.
--  Chave Pix NÃO é senha: ela aparece para quem vai pagar.
--  Nada de senha, token ou chave secreta aqui.
-- =====================================================================
do $$
declare
  -- contato
  v_whatsapp   text := 'WHATSAPP';            -- ex.: 5516999998888 (55 + DDD + número, só números)
  v_instagram  text := 'thiagopradobarbearia';-- sem @
  v_cidade     text := 'CIDADE - UF';
  v_endereco   text := 'ENDERECO';            -- rua, número - bairro (botão "Como chegar")

  -- personalidade (aparece no topo do app)
  v_slogan     text := 'Corte de rei, atendimento de rei.';
  v_boas       text := 'Escolhe o serviço e garante tua cadeira.';
  v_especial   text := 'Especialista em prótese capilar';
  v_tom        text := 'descontraido';        -- descontraido | classico | premium
  v_clube      text := 'Clube Gold TP';

  -- Pix para receber os planos
  v_pix_tipo   text := 'cpf';                 -- cpf | cnpj | telefone | email | aleatoria
  v_pix_chave  text := 'CHAVE_PIX';
  v_pix_nome   text := 'NOME DO RECEBEDOR';   -- como está no banco, até 25 letras
  v_pix_cidade text := 'CIDADE DO PIX';       -- até 15 letras, sem acento

  v_falta text;
begin
  select string_agg(campo, ', ') into v_falta from (values
    ('WhatsApp', v_whatsapp = 'WHATSAPP' or v_whatsapp !~ '^55[0-9]{10,11}$'),
    ('cidade', v_cidade = 'CIDADE - UF'),
    ('endereço', v_endereco = 'ENDERECO'),
    ('chave Pix', v_pix_chave = 'CHAVE_PIX'),
    ('nome do recebedor do Pix', v_pix_nome = 'NOME DO RECEBEDOR'),
    ('cidade do Pix', v_pix_cidade = 'CIDADE DO PIX')
  ) t(campo, falta) where falta;
  if v_falta is not null then
    raise exception 'Nada foi gravado. Falta preencher: %', v_falta;
  end if;

  update empresas set
    whatsapp = v_whatsapp, instagram = nullif(ltrim(v_instagram, '@'), ''),
    cidade = v_cidade, endereco = v_endereco,
    slogan = v_slogan, boas_vindas = v_boas, especialidade = v_especial,
    tom_voz = v_tom, clube_nome = v_clube,
    pix_tipo = v_pix_tipo, pix_chave = trim(v_pix_chave),
    pix_nome = left(v_pix_nome, 25), pix_cidade = left(v_pix_cidade, 15)
  where slug = 'thiagoprado';
  if not found then raise exception 'Barbearia thiagoprado não encontrada. Rode antes o barber-v3-thiago-prado.sql.'; end if;
end $$;

-- Conferir
select nome, whatsapp, instagram, pix_tipo, pix_chave, pix_nome, slogan
from empresas where slug = 'thiagoprado';
