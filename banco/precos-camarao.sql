-- ============================================================================
-- PREÇOS DO CAMARÃO — tabela de referência publicada pelo administrador
--
-- Para que serve: o produtor abre o app e vê a faixa de preços da semana, como
-- um painel de bolsa. Não existe índice público semanal do camarão cultivado no
-- Brasil (procurei), então a fonte é o próprio administrador, que tem acesso à
-- média de mercado e publica pelo painel ADM.
--
-- UMA LINHA POR TAMANHO EM GRAMAS, e o tamanho é a própria chave. A primeira
-- versão desta tabela tinha rótulo de texto livre ("12 g", "10-12 g", "60
-- peças") para caber em qualquer convenção regional. Na prática a tela ficou
-- ruim de usar: era preciso criar cada linha, escrever o nome do tamanho e só
-- então o preço — e nada impedia dois "12 g" brigando na faixa. O tamanho em
-- gramas resolve os três problemas de uma vez: a tela já nasce com a tabela
-- inteira para preencher, o número é único, e a ordem da faixa sai dele.
--
-- O dia em que o preço precisar variar por estado, a chave passa a ser
-- (gramas, regiao). É uma tabela pequena de referência; essa migração custa
-- pouco e não vale carregar uma coluna nula até lá.
--
-- Rodar uma vez no SQL Editor do Supabase.
-- ============================================================================

create table if not exists public.precos_camarao (
  gramas         int primary key check (gramas between 1 and 200),
  -- Teto de R$ 500/kg: não é regra de mercado, é rede de segurança contra
  -- digitação. "2200" no lugar de "22,00" iria para a tela de TODOS os
  -- clientes, e preço errado é pior que preço nenhum.
  preco          numeric not null check (preco > 0 and preco <= 500),
  preco_anterior numeric check (preco_anterior > 0),
  atualizado_em  timestamptz not null default now()
);

alter table public.precos_camarao enable row level security;

-- ── Leitura: qualquer cliente logado ────────────────────────────────────────
-- É informação pública do produto, igual para todo mundo. Sem user_id: a
-- tabela não pertence a ninguém.
drop policy if exists precos_camarao_leitura on public.precos_camarao;
create policy precos_camarao_leitura
  on public.precos_camarao for select to authenticated using (true);

-- ── Escrita: só administrador ───────────────────────────────────────────────
-- Mesma checagem que o admin_ajustar_vencimento já usa (tabela perfis), para
-- não existirem dois jeitos diferentes de dizer quem é admin neste banco.
drop policy if exists precos_camarao_escrita on public.precos_camarao;
create policy precos_camarao_escrita
  on public.precos_camarao for all to authenticated
  using      (exists (select 1 from public.perfis p where p.user_id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.perfis p where p.user_id = auth.uid() and p.role = 'admin'));

-- ── A data e o preço anterior são do BANCO, não de quem grava ───────────────
-- A faixa some sozinha no app quando a tabela fica velha, e quem decide isso é
-- esta data: deixar o carimbo a cargo de quem escreve daria em esquecimento —
-- bastaria uma tela nova salvar sem mandar o campo para o preço velho passar a
-- se apresentar como novo.
--
-- O preço anterior (a setinha de alta/baixa) segue a mesma lógica: calculado
-- aqui, ninguém precisa lembrar de mandar, e republicar o MESMO valor não
-- zera a seta.
create or replace function public.precos_camarao_carimbo()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  if tg_op = 'UPDATE' then
    new.preco_anterior := case when new.preco <> old.preco
                               then old.preco
                               else old.preco_anterior end;
  end if;
  return new;
end;
$$;

drop trigger if exists precos_camarao_carimbo_tg on public.precos_camarao;
create trigger precos_camarao_carimbo_tg
  before insert or update on public.precos_camarao
  for each row execute function public.precos_camarao_carimbo();

-- ── Conferência ─────────────────────────────────────────────────────────────
-- select gramas, preco, preco_anterior, atualizado_em
--   from public.precos_camarao order by gramas;
