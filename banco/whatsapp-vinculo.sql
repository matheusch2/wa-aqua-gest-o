-- ============================================================================
-- VÍNCULO DO WHATSAPP — qual número pertence a qual produtor
--
-- Esta tabela é A TRANCA do canal do WhatsApp, e vale a pena entender por quê.
--
-- Dentro do app, quem protege os dados é o RLS: o Postgres sabe quem está
-- logado (auth.uid()) e só deixa cada um ver o que é seu. Pelo WhatsApp NÃO
-- EXISTE LOGIN — chega um número de telefone e mais nada. A função que atende
-- o webhook roda com chave de serviço, que fura o RLS, então ela passa a ser a
-- única coisa entre um cliente e o viveiro do outro. E a resposta de "quem é
-- essa pessoa" sai daqui.
--
-- Por isso o telefone é UNIQUE e o user_id é a chave primária: um número
-- aponta para no máximo uma conta, e uma conta tem no máximo um número. Sem
-- isso a função teria de ESCOLHER entre dois donos, e escolher errado é
-- escrever na fazenda de outro.
--
-- ── O CÓDIGO VAI NO SENTIDO CONTRÁRIO ──────────────────────────────────────
-- O app mostra o código e a PESSOA manda para o nosso número. Não é economia
-- de mensagem (embora seja): é que a mensagem chegando DAQUELE número é a
-- prova de que o WhatsApp é dela. Mandar o código para o número que ela
-- digitou provaria menos — provaria que alguém com acesso àquele aparelho leu
-- o código, e exigiria template aprovado pela Meta antes de qualquer teste.
--
-- Rodar uma vez no SQL Editor do Supabase.
-- ============================================================================

create table if not exists public.whatsapp_vinculos (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  -- Só dígitos, com DDI: "5588992498067". Guardar com máscara daria dois
  -- jeitos de escrever o mesmo número, e a função teria de adivinhar qual.
  telefone          text unique check (telefone ~ '^[1-9][0-9]{9,14}$'),
  verificado_em     timestamptz,

  -- Só o hash. O código vive dez minutos, mas o painel de administração e
  -- qualquer log leriam o valor em claro — e ninguém precisa dele.
  --
  -- O hash NÃO é a proteção principal: seis dígitos são um milhão de
  -- possibilidades e quebram em segundos offline. Quem protege de verdade são
  -- o prazo curto e o limite de tentativas abaixo. O hash protege da leitura
  -- casual, que é um risco diferente e também real.
  codigo_hash       text,
  codigo_expira_em  timestamptz,
  tentativas        int not null default 0,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index if not exists whatsapp_vinculos_telefone_idx
  on public.whatsapp_vinculos (telefone) where verificado_em is not null;

alter table public.whatsapp_vinculos enable row level security;

-- ── O produtor enxerga e mexe SÓ na própria linha ───────────────────────────
drop policy if exists whatsapp_vinculos_dono on public.whatsapp_vinculos;
create policy whatsapp_vinculos_dono
  on public.whatsapp_vinculos for all to authenticated
  using      (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Gerar o código ──────────────────────────────────────────────────────────
-- security definer porque o código nasce AQUI: se o navegador sorteasse, ele
-- saberia o número antes do banco, e o que o cliente sabe o cliente pode
-- escolher. Devolve o código em claro UMA vez, para a tela mostrar; o banco
-- fica só com o hash.
create or replace function public.whatsapp_gerar_codigo()
returns table (codigo text, expira_em timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user  uuid := auth.uid();
  v_bytes bytea;
  v_cod   text;
  v_exp   timestamptz := now() + interval '10 minutes';
begin
  if v_user is null then
    raise exception 'sem sessão';
  end if;

  -- Já conectado não gera código novo. Sem esta porta, o ON CONFLICT lá
  -- embaixo não gravava (o WHERE barra) e a função DEVOLVIA o código assim
  -- mesmo: a tela mostraria seis dígitos que nunca casariam com nada, e a
  -- pessoa ficaria mandando mensagem achando que o app estava quebrado.
  -- Para trocar de número, desconecta primeiro.
  if exists (select 1 from public.whatsapp_vinculos
              where user_id = v_user and verificado_em is not null and telefone is not null) then
    raise exception 'já conectado';
  end if;

  -- Seis dígitos, sorteados por fonte criptográfica. random() do Postgres é
  -- previsível a partir da semente e não serve para credencial.
  --
  -- Os bytes são somados um a um de propósito. O caminho curto
  -- (('x'||hex)::bit(32)::bigint) é SINALIZADO: um sorteio com o bit alto
  -- ligado — metade deles — daria um número negativo, e "-12345" nunca casaria
  -- com o ^[0-9]{6}$ do whatsapp_confirmar. Metade dos códigos simplesmente
  -- não funcionaria, e o produtor leria "código inválido" sem ter errado nada.
  v_bytes := gen_random_bytes(4);
  v_cod := lpad(((get_byte(v_bytes, 0)::bigint * 16777216
                + get_byte(v_bytes, 1)::bigint * 65536
                + get_byte(v_bytes, 2)::bigint * 256
                + get_byte(v_bytes, 3)::bigint) % 1000000)::text, 6, '0');

  insert into public.whatsapp_vinculos (user_id, codigo_hash, codigo_expira_em, tentativas, atualizado_em)
  values (v_user, encode(digest(v_cod || v_user::text, 'sha256'), 'hex'), v_exp, 0, now())
  on conflict (user_id) do update
    set codigo_hash      = excluded.codigo_hash,
        codigo_expira_em = excluded.codigo_expira_em,
        tentativas       = 0,
        atualizado_em    = now();

  return query select v_cod, v_exp;
end;
$$;

revoke all on function public.whatsapp_gerar_codigo() from public, anon;
grant execute on function public.whatsapp_gerar_codigo() to authenticated;

-- ── Conferir o código (chamado pelo webhook, com chave de serviço) ──────────
-- Recebe o que chegou pelo WhatsApp: o número de quem mandou e o código que
-- ele digitou. Devolve o user_id quando bate, e null quando não.
--
-- O limite de tentativas é o que realmente segura a porta. Sem ele, seis
-- dígitos caem na força bruta — e aqui a força bruta é barata, porque quem
-- tenta não precisa de senha nenhuma, só de mandar mensagem.
create or replace function public.whatsapp_confirmar(p_telefone text, p_codigo text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_alvo public.whatsapp_vinculos%rowtype;
begin
  if p_telefone !~ '^[1-9][0-9]{9,14}$' or p_codigo !~ '^[0-9]{6}$' then
    return null;
  end if;

  -- Número já vinculado a OUTRA conta não entra: é o caso que, deixado passar,
  -- faz um produtor escrever no viveiro do outro.
  if exists (select 1 from public.whatsapp_vinculos
              where telefone = p_telefone and verificado_em is not null) then
    return null;
  end if;

  select * into v_alvo from public.whatsapp_vinculos
   where codigo_hash is not null
     and codigo_expira_em > now()
     and tentativas < 5
     and codigo_hash = encode(digest(p_codigo || user_id::text, 'sha256'), 'hex')
   limit 1;

  if not found then
    -- Queima uma tentativa de todos os códigos vivos. Quem está tentando
    -- adivinhar não sabe de quem é o código que busca, então o custo tem de
    -- recair sobre a tentativa, não sobre a conta certa.
    update public.whatsapp_vinculos
       set tentativas = tentativas + 1, atualizado_em = now()
     where codigo_hash is not null and codigo_expira_em > now();
    return null;
  end if;

  update public.whatsapp_vinculos
     set telefone      = p_telefone,
         verificado_em = now(),
         codigo_hash   = null,      -- usado uma vez, e só
         codigo_expira_em = null,
         tentativas    = 0,
         atualizado_em = now()
   where user_id = v_alvo.user_id;

  return v_alvo.user_id;
end;
$$;

revoke all on function public.whatsapp_confirmar(text, text) from public, anon, authenticated;
-- Ninguém chama esta função pelo app. Só a chave de serviço, de dentro da
-- Edge Function que atende o webhook.

-- ── Desconectar ─────────────────────────────────────────────────────────────
create or replace function public.whatsapp_desconectar()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.whatsapp_vinculos where user_id = auth.uid();
$$;

revoke all on function public.whatsapp_desconectar() from public, anon;
grant execute on function public.whatsapp_desconectar() to authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- select user_id, telefone, verificado_em, tentativas from public.whatsapp_vinculos;
