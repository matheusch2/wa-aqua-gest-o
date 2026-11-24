-- [ESTADO EM 24/11/2026: PENDENTE]
--   aguardando o dono rodar no SQL Editor. Enquanto nao rodar, a tela e a
--   Edge Function continuam com as tabelas de preco antigas, que DISCORDAM
--   entre si — ver o bloco abaixo.
--   Conferido contra o banco de producao: a tabela public.planos nao existe.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WA Aqua Gestão — O PREÇO PASSA A MORAR EM UM LUGAR SÓ
--
-- PROBLEMA
--   O preço estava escrito em TRÊS lugares, e os três discordavam:
--
--     a tela do app (_PLANOS_APP)   50 / 100 / 200 / 400 / 600
--     a Edge Function assinar-cartao 50 /  90 / 160 / 250
--     a tabela oficial do dono       50 / 100 / 150 / 300 / 500
--
--   Ligar o botão "Assinar" nesse estado faria o cliente ver um valor na
--   tela e ser cobrado outro no cartão, todo mês, sem ninguém perceber —
--   só olhando o extrato do Asaas.
--
-- O QUE MUDA
--   A tela passa a LER daqui e a cobrança passa a LER daqui. Preço escrito
--   em dois lugares diverge; em três, já divergiu.
--   De quebra, o dono muda preço pelo painel, sem depender de deploy.
--
-- NÃO TOCA EM NADA QUE EXISTE: só cria uma tabela nova.
--
-- COMO RODAR
--   Supabase → SQL Editor → cole tudo → Run.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.planos (
  chave            text primary key,
  nome             text        not null,
  viveiros_label   text        not null,
  limite_viveiros  integer     not null,
  mensal           numeric(10,2),
  semestral        numeric(10,2),
  anual            numeric(10,2),
  permite_cartao   boolean     not null default true,
  ordem            integer     not null default 0,
  ativo            boolean     not null default true,
  atualizado_em    timestamptz not null default now()
);

comment on table public.planos is
  'Fonte única do preço. A tela e a Edge Function assinar-cartao leem daqui.';
comment on column public.planos.permite_cartao is
  'false = só contratação manual pelo WhatsApp; o botão Assinar não aparece.';
comment on column public.planos.semestral is
  'Nulo = esse ciclo não é oferecido neste plano.';

alter table public.planos enable row level security;

-- Preço é informação pública: quem está logado lê. Ninguém escreve pela API
-- do cliente — mudança de preço é pelo painel.
drop policy if exists planos_leitura on public.planos;
create policy planos_leitura on public.planos
  for select to authenticated using (ativo);

-- A tabela oficial, com o semestral a 5,5× o mensal (1 mês de graça, contra
-- os 2 meses do anual). Escada: quem paga mais adiantado economiza mais.
insert into public.planos
  (chave, nome, viveiros_label, limite_viveiros, mensal, semestral, anual, ordem) values
  ('gratis1',       '1 viveiro',     '1 viveiro',               1,  50,  275,  500, 1),
  ('basico',        'Básico',        '2 a 5 viveiros',          5, 100,  550, 1000, 2),
  ('intermediario', 'Intermediário', 'até 10 viveiros',        10, 150,  825, 1500, 3),
  ('avancado',      'Avançado',      'até 20 viveiros',        20, 300, 1650, 3000, 4),
  ('pro',           'Pro',           'viveiros ilimitados', 999999, 500, 2750, 5000, 5)
on conflict (chave) do update set
  nome            = excluded.nome,
  viveiros_label  = excluded.viveiros_label,
  limite_viveiros = excluded.limite_viveiros,
  mensal          = excluded.mensal,
  semestral       = excluded.semestral,
  anual           = excluded.anual,
  ordem           = excluded.ordem,
  atualizado_em   = now();

select chave, nome, mensal, semestral, anual from public.planos order by ordem;
