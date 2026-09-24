-- ═══════════════════════════════════════════════════════════════════════════
-- WA Aqua Gestão — B03: MIGRAÇÃO de vínculo de propriedade do viveiro
--
-- ⚠️ RODE O seguranca-b03-diagnostico.sql PRIMEIRO e me mande os resultados.
--    Em especial: o bloco 2 (ids duplicados) deve vir VAZIO, senão a chave
--    única falha. Este arquivo NÃO apaga nada.
--
-- O QUE FAZ
--   1) Cria em viveiros a chave única (id, user_id) — alvo da FK composta.
--   2) Cria em cada tabela de lançamento a FK (viveiro_id, user_id) →
--      viveiros(id, user_id) como NOT VALID: passa a EXIGIR, em toda gravação
--      NOVA, que o viveiro seja do próprio usuário — fechando o B03 — sem
--      escanear o histórico (não trava a tabela nem falha por dado antigo).
--   3) (PARTE 2, separada) valida o histórico quando o diagnóstico confirmar
--      que não há órfãos/cruzados.
--
-- SEGURANÇA / REVERSÃO
--   Tudo dentro de transação: se um passo falhar, nada é aplicado. As FKs são
--   idempotentes (DO block checa antes de criar). Para desfazer, veja o rodapé.
--
-- COMO RODAR
--   Supabase → SQL Editor → cole a PARTE 1 → Run. Depois de confirmar histórico
--   limpo, rode a PARTE 2.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────── PARTE 1 (aplicar já) ───────────────────────────
begin;

-- 1) Chave única alvo da FK composta (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'viveiros_id_user_key'
      and conrelid = 'public.viveiros'::regclass
  ) then
    alter table public.viveiros
      add constraint viveiros_id_user_key unique (id, user_id);
  end if;
end $$;

-- 2) FK composta em cada tabela de lançamento (NOT VALID: vale já para o novo)
do $$
declare
  t text;
  tabelas text[] := array['racoes','biometrias','despescas','ciclos','custos'];
begin
  foreach t in array tabelas loop
    if not exists (
      select 1 from pg_constraint
      where conname = t || '_viveiro_owner_fk'
        and conrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'alter table public.%I
           add constraint %I
           foreign key (viveiro_id, user_id)
           references public.viveiros(id, user_id) not valid',
        t, t || '_viveiro_owner_fk'
      );
    end if;
  end loop;
end $$;

commit;


-- ─────────── PARTE 2 (rodar só com o diagnóstico bloco 4 = tudo 0) ───────────
-- Valida o histórico. Se houver órfão/cruzado, ESTE comando falha e aponta a
-- tabela — nesse caso, me mande o resultado do bloco 6 do diagnóstico para
-- decidirmos o conserto (nunca apagar às cegas).
--
-- alter table public.racoes     validate constraint racoes_viveiro_owner_fk;
-- alter table public.biometrias validate constraint biometrias_viveiro_owner_fk;
-- alter table public.despescas  validate constraint despescas_viveiro_owner_fk;
-- alter table public.ciclos     validate constraint ciclos_viveiro_owner_fk;
-- alter table public.custos     validate constraint custos_viveiro_owner_fk;


-- ─────────────────────────── COMO DESFAZER ──────────────────────────────────
-- alter table public.racoes     drop constraint if exists racoes_viveiro_owner_fk;
-- alter table public.biometrias drop constraint if exists biometrias_viveiro_owner_fk;
-- alter table public.despescas  drop constraint if exists despescas_viveiro_owner_fk;
-- alter table public.ciclos     drop constraint if exists ciclos_viveiro_owner_fk;
-- alter table public.custos     drop constraint if exists custos_viveiro_owner_fk;
-- alter table public.viveiros   drop constraint if exists viveiros_id_user_key;
