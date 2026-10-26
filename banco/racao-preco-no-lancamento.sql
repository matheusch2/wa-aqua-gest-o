-- ═══════════════════════════════════════════════════════════════════════════
-- WA Aqua Gestão — guardar o preço da ração EM CADA LANÇAMENTO
--
-- PROBLEMA
--   O custo da ração do ciclo em andamento é calculado como
--   "kg lançados × preço ATUAL do catálogo". Quando o produtor reajusta o
--   preço de uma ração no meio do ciclo, todos os lançamentos anteriores
--   passam a valer o preço novo — para trás. A ração comprada a R$ 4,50 e já
--   consumida vira R$ 4,80 no relatório, e o custo do ciclo, o custo por kg e
--   o lucro mudam sozinhos, sem ninguém ter lançado nada.
--
-- O QUE FAZ
--   Cria a coluna custo_por_kg em racoes. A partir daqui, cada lançamento
--   guarda o preço do dia em que foi feito, e o reajuste só vale para os
--   lançamentos seguintes.
--
-- LANÇAMENTOS ANTIGOS
--   Ficam com a coluna vazia (null) e continuam usando o preço do catálogo,
--   exatamente como hoje — nenhum número muda ao rodar isto. A correção
--   passa a valer para o que for lançado daqui para frente.
--
-- SEGURANÇA
--   Só adiciona coluna opcional. Não altera nenhum dado existente, não
--   derruba nada e pode rodar com o app aberto.
--
-- COMO RODAR
--   Supabase → SQL Editor → cole e Run.
--
-- COMO DESFAZER
--   alter table public.racoes drop column if exists custo_por_kg;
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.racoes
  add column if not exists custo_por_kg numeric;

comment on column public.racoes.custo_por_kg is
  'Preço por kg da ração NO DIA do lançamento. Nulo = lançamento antigo, usa o preço atual do catálogo.';
