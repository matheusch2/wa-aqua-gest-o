-- ═══════════════════════════════════════════════════════════════════════════
-- WA Aqua Gestão — permitir 2 rações no mesmo dia (transição inicial→engorda)
--
-- CONTEXTO
--   O índice único ux_racoes_viveiro_data (viveiro_id, data) só permitia UMA
--   ração por dia. Para lançar a ração inicial + a de engorda no mesmo dia
--   durante a transição, a chave de unicidade passa a incluir o TIPO.
--
-- O QUE FAZ
--   Troca o índice único (viveiro_id, data) por (viveiro_id, data, tipo).
--   O coalesce em tipo_racao_id trata "não especificado" (nulo) como uma chave
--   fixa, impedindo 2 lançamentos sem tipo no mesmo dia.
--
-- SEGURANÇA
--   O índice antigo já garantia no máximo 1 ração por (viveiro, data); o novo é
--   MENOS restritivo, então não falha em nenhum dado existente. Em transação.
--
-- COMO RODAR
--   Supabase → SQL Editor → cole e Run.
--
-- COMO DESFAZER
--   drop index if exists public.ux_racoes_viveiro_data_tipo;
--   create unique index ux_racoes_viveiro_data on public.racoes (viveiro_id, data);
-- ═══════════════════════════════════════════════════════════════════════════

begin;

drop index if exists public.ux_racoes_viveiro_data;

create unique index ux_racoes_viveiro_data_tipo
  on public.racoes (viveiro_id, data, coalesce(tipo_racao_id, '00000000-0000-0000-0000-000000000000'::uuid));

commit;
