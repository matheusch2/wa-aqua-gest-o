-- ═══════════════════════════════════════════════════════════════════════════
-- WA Aqua Gestão — B03: DIAGNÓSTICO de vínculo de propriedade do viveiro
--
-- CONTEXTO (auditoria 24/09/2026)
--   O RLS exige que user_id seja o do solicitante, mas NÃO exige que o
--   viveiro_id do lançamento pertença a ele. Faltam as chaves estrangeiras
--   compostas (viveiro_id, user_id) → viveiros(id, user_id). A auditoria também
--   não encontrou chave primária/único em viveiros.
--
-- O QUE ESTE ARQUIVO FAZ
--   SÓ LEITURA. Fotografa o estado atual do banco para sabermos, ANTES de criar
--   qualquer restrição, se há: (a) chave única em viveiros; (b) ids de viveiro
--   duplicados; (c) FKs já existentes; (d) lançamentos órfãos ou apontando para
--   viveiro de OUTRO usuário. Nada é alterado, nada é apagado.
--
-- COMO RODAR
--   Supabase → SQL Editor → New query → cole este arquivo → Run.
--   Rode cada bloco e me mande os resultados. Com eles eu finalizo a migração
--   (seguranca-b03-migracao.sql) sob medida — sem apagar dado pra "passar".
-- ═══════════════════════════════════════════════════════════════════════════


-- 1) viveiros tem PRIMARY KEY / UNIQUE? em quais colunas?
--    Esperado: uma PK em (id). Para a FK composta, precisaremos de UNIQUE
--    em (id, user_id) — este bloco diz se já existe.
select
  conname                              as restricao,
  case contype when 'p' then 'PRIMARY KEY' when 'u' then 'UNIQUE' end as tipo,
  pg_get_constraintdef(oid)            as definicao
from pg_constraint
where conrelid = 'public.viveiros'::regclass
  and contype in ('p', 'u')
order by contype;


-- 2) Existe algum id de viveiro DUPLICADO? (não deveria)
--    Se retornar linhas, há um problema grave a resolver antes de qualquer FK.
select id, count(*) as vezes
from public.viveiros
group by id
having count(*) > 1;


-- 3) FKs já existentes nas tabelas de lançamento
--    Mostra o que já existe, pra não recriar nem conflitar.
select
  conrelid::regclass          as tabela,
  conname                     as fk,
  pg_get_constraintdef(oid)   as definicao
from pg_constraint
where contype = 'f'
  and conrelid in (
    'public.racoes'::regclass,
    'public.biometrias'::regclass,
    'public.despescas'::regclass,
    'public.ciclos'::regclass,
    'public.custos'::regclass
  )
order by tabela;


-- 4) ★ O NÚMERO QUE IMPORTA ★
--    Lançamentos ÓRFÃOS (viveiro_id não existe) OU CRUZADOS (viveiro é de outro
--    usuário): o par (viveiro_id, user_id) não bate com nenhuma linha de
--    viveiros. Se tudo estiver correto, todas as contagens devem ser 0.
select 'racoes' as tabela, count(*) as orfaos_ou_cruzados
from public.racoes t
where t.viveiro_id is not null
  and not exists (select 1 from public.viveiros v
                  where v.id = t.viveiro_id and v.user_id = t.user_id)
union all
select 'biometrias', count(*)
from public.biometrias t
where t.viveiro_id is not null
  and not exists (select 1 from public.viveiros v
                  where v.id = t.viveiro_id and v.user_id = t.user_id)
union all
select 'despescas', count(*)
from public.despescas t
where t.viveiro_id is not null
  and not exists (select 1 from public.viveiros v
                  where v.id = t.viveiro_id and v.user_id = t.user_id)
union all
select 'ciclos', count(*)
from public.ciclos t
where t.viveiro_id is not null
  and not exists (select 1 from public.viveiros v
                  where v.id = t.viveiro_id and v.user_id = t.user_id)
union all
select 'custos', count(*)
from public.custos t
where t.viveiro_id is not null
  and not exists (select 1 from public.viveiros v
                  where v.id = t.viveiro_id and v.user_id = t.user_id);


-- 5) Lançamentos com viveiro_id NULO (não pegam FK, mas convém saber)
select 'racoes' as tabela, count(*) as viveiro_id_nulo from public.racoes where viveiro_id is null
union all select 'biometrias', count(*) from public.biometrias where viveiro_id is null
union all select 'despescas', count(*) from public.despescas where viveiro_id is null
union all select 'ciclos',    count(*) from public.ciclos    where viveiro_id is null
union all select 'custos',    count(*) from public.custos    where viveiro_id is null;


-- 6) (Opcional) Se o bloco 4 acusar órfãos, este lista ALGUNS para inspeção
--    manual — troque 'racoes' pela tabela que acusou e rode.
-- select t.id, t.viveiro_id, t.user_id, t.data
-- from public.racoes t
-- where t.viveiro_id is not null
--   and not exists (select 1 from public.viveiros v
--                   where v.id = t.viveiro_id and v.user_id = t.user_id)
-- limit 50;
