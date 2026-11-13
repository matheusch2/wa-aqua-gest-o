-- ============================================================================
-- PREÇOS DO CAMARÃO — tabela de referência publicada pelo administrador
--
-- Para que serve: o produtor abre o app e vê a faixa de preços da semana, como
-- um painel de bolsa. Não existe índice público semanal do camarão cultivado no
-- Brasil (procurei), então a fonte é o próprio administrador, que tem acesso à
-- média de mercado e publica aqui.
--
-- Uma lista só, nacional. A coluna "regiao" já nasce aqui, sempre nula, para o
-- dia em que o preço precisar variar por estado — assim essa mudança não vai
-- exigir migrar dados nem reescrever as políticas.
--
-- O rótulo é TEXTO LIVRE de propósito ("12 g", "10-12 g", "60 peças"): cada
-- região nomeia o tamanho do seu jeito, e engessar numa lista fixa obrigaria a
-- mexer no banco toda vez que a convenção mudasse.
--
-- Rodar uma vez no SQL Editor do Supabase.
-- ============================================================================

create table if not exists public.precos_camarao (
  id              uuid primary key default gen_random_uuid(),
  rotulo          text        not null,
  preco           numeric     not null check (preco > 0),
  -- Guardado para a setinha de alta/baixa. Fica nulo no primeiro lançamento,
  -- e aí a faixa simplesmente não mostra variação — melhor que inventar zero.
  preco_anterior  numeric,
  regiao          text,
  ordem           int         not null default 0,
  atualizado_em   timestamptz not null default now()
);

create index if not exists precos_camarao_ordem_idx
  on public.precos_camarao (ordem, rotulo);

alter table public.precos_camarao enable row level security;

-- ── Leitura: qualquer cliente logado ────────────────────────────────────────
-- É informação pública do produto, igual para todo mundo. Sem user_id: a
-- tabela não pertence a ninguém.
drop policy if exists precos_camarao_leitura on public.precos_camarao;
create policy precos_camarao_leitura
  on public.precos_camarao
  for select
  to authenticated
  using (true);

-- ── Escrita: só administrador ───────────────────────────────────────────────
-- Mesma checagem que o admin_ajustar_vencimento já usa (tabela perfis), para
-- não existirem dois jeitos diferentes de dizer quem é admin neste banco.
drop policy if exists precos_camarao_escrita on public.precos_camarao;
create policy precos_camarao_escrita
  on public.precos_camarao
  for all
  to authenticated
  using      (exists (select 1 from public.perfis p where p.user_id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.perfis p where p.user_id = auth.uid() and p.role = 'admin'));

-- ── Carimbo de data automático ──────────────────────────────────────────────
-- A faixa some sozinha no app quando a tabela fica velha, e quem decide isso é
-- esta data. Deixar o carimbo a cargo de quem grava daria em esquecimento:
-- bastaria uma tela nova salvar sem mandar o campo para o preço velho passar a
-- se apresentar como novo.
create or replace function public.precos_camarao_carimbo()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists precos_camarao_carimbo_tg on public.precos_camarao;
create trigger precos_camarao_carimbo_tg
  before insert or update on public.precos_camarao
  for each row execute function public.precos_camarao_carimbo();

-- ── Conferência ─────────────────────────────────────────────────────────────
-- select rotulo, preco, preco_anterior, atualizado_em
--   from public.precos_camarao order by ordem, rotulo;
