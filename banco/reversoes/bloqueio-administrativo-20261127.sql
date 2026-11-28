-- REVERSAO de banco/migracoes/bloqueio-administrativo-20261127.sql
--
-- Desfaz a separacao entre bloqueio administrativo e situacao comercial.
--
-- ANTES DE RODAR, LEIA ISTO
--   Reverter APAGA quem estava bloqueado. As tres colunas somem, e com elas o
--   responsavel, a data e o motivo de cada bloqueio em vigor. O historico em
--   admin_historico permanece (as acoes 'bloquear' e 'desbloquear' continuam
--   la, com motivo), mas o ESTADO de bloqueio se perde.
--
--   Por isso o primeiro passo abaixo nao e um DROP: e uma consulta que lista
--   quem esta bloqueado, para alguem anotar antes. Rode-a, guarde o resultado,
--   e so entao siga.
--
--   Depois de reverter, esses clientes voltam a ter como unica trava o
--   assinaturas.status — que e exatamente o problema que a migracao resolveu.
--   Se o motivo da reversao for um defeito pontual, prefira corrigir o defeito
--   a reverter tudo.
--
-- NAO ENCOSTA na correcao critica de quota (65d6885): nem no gatilho
-- trg_limite_viveiros, nem na funcao checar_limite_viveiros, nem no schema
-- wa_quota_interna.

-- ─── PASSO 0: anote quem perderia o bloqueio (nao e destrutivo) ────────────
-- select user_id, bloqueio_admin_em, bloqueio_admin_por, bloqueio_admin_motivo
--   from public.assinaturas where bloqueio_admin_em is not null
--   order by bloqueio_admin_em;

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Aplicar como postgres'; END IF;
END $$;


-- Falhar fechado: o histórico não substitui a proteção da escrita.
LOCK TABLE public.assinaturas IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT FROM public.assinaturas WHERE bloqueio_admin_em IS NOT NULL)
 THEN RAISE EXCEPTION 'REVERSAO_COM_BLOQUEIOS: mantenha a proteção e aplique uma correção incremental'; END IF;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['viveiros','racoes','biometrias','despescas','ciclos','custos','produtos','boletos','custos_fixos','tipos_racao','viveiro_gratuito_escolha','whatsapp_vinculos','contatos'] LOOP
   EXECUTE format('DROP TRIGGER bloqueio_admin_escrita ON public.%I',t);
   EXECUTE format('DROP TRIGGER bloqueio_admin_truncate ON public.%I',t);
 END LOOP;
END $$;
DROP TRIGGER bloqueio_admin_truncate ON public.assinaturas;
DROP FUNCTION wa_bloqueio_interno.validar_escrita();
DROP FUNCTION wa_bloqueio_interno.negar_truncate();
DROP TABLE wa_bloqueio_interno.autorizacoes;
DROP SCHEMA wa_bloqueio_interno;
-- ─── 1. As politicas de escrita voltam ao que eram ─────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['viveiros','boletos','custos_fixos','produtos','tipos_racao'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS bloqueio_admin_sem_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS bloqueio_admin_sem_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS bloqueio_admin_sem_delete ON public.%I', t);
  END LOOP;
END $$;

-- ─── 2. As duas funcoes de plano voltam a versao de 26/11/2026 ─────────────
-- Copiadas do que estava publicado antes da migracao, sem outras mudancas.

CREATE OR REPLACE FUNCTION public.meu_plano_efetivo()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE a public.assinaturas%ROWTYPE; hoje date := (now() AT TIME ZONE 'America/Fortaleza')::date; vigente boolean; escolhido uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NAO_AUTORIZADO'; END IF;
 SELECT * INTO a FROM public.assinaturas WHERE user_id=auth.uid();
 vigente := coalesce(a.plano <> 'gratis' AND ((a.status='ativo' AND (a.proximo_vencimento IS NULL OR a.proximo_vencimento >= hoje OR (a.asaas_subscription_id IS NOT NULL AND a.proximo_vencimento >= hoje-5))) OR (a.status='pendente' AND a.asaas_subscription_id IS NOT NULL AND a.proximo_vencimento >= hoje-5)),false);
 SELECT e.viveiro_id INTO escolhido FROM public.viveiro_gratuito_escolha e JOIN public.viveiros v ON v.id=e.viveiro_id WHERE e.user_id=auth.uid() AND v.user_id=auth.uid() AND v.ativo IS TRUE;
 RETURN jsonb_build_object('plano',case when vigente then a.plano else 'gratis' end,'limite_viveiros',case when vigente then a.limite_viveiros else 1 end,'plano_contratado',a.plano,'proximo_vencimento',a.proximo_vencimento,'viveiro_escolhido',escolhido);
END; $function$;

CREATE OR REPLACE FUNCTION public.viveiro_permite_lancamento(p_viveiro uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE lim integer; escolhido uuid; plano jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 plano := public.meu_plano_efetivo();
 lim := (plano->>'limite_viveiros')::integer;
 escolhido := (plano->>'viveiro_escolhido')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.viveiros WHERE id=p_viveiro AND user_id=auth.uid() AND ativo IS TRUE) THEN RETURN false; END IF;
 IF plano->>'plano'='gratis' AND escolhido IS NOT NULL THEN RETURN escolhido=p_viveiro; END IF;
 RETURN EXISTS(SELECT 1 FROM (SELECT id FROM public.viveiros WHERE user_id=auth.uid() AND ativo IS TRUE ORDER BY data_povoamento ASC NULLS LAST,nome,id LIMIT lim) v WHERE v.id=p_viveiro);
END; $function$;

-- ─── 3. Gatilho de protecao e funcoes administrativas ──────────────────────
DROP TRIGGER IF EXISTS trg_assinatura_bloqueio_admin ON public.assinaturas;
DROP FUNCTION IF EXISTS public.assinatura_bloqueio_admin_protegido();
DROP FUNCTION IF EXISTS public.admin_bloquear_cliente(uuid, text);
DROP FUNCTION IF EXISTS public.admin_desbloquear_cliente(uuid, text);
DROP FUNCTION IF EXISTS public.bloqueio_admin_ativo();

-- ─── 4. As colunas, por ultimo ─────────────────────────────────────────────
-- É aqui que o estado de bloqueio se perde. O passo 0 existe por causa disto.
ALTER TABLE public.assinaturas DROP CONSTRAINT IF EXISTS assinaturas_bloqueio_admin_completo;
DROP INDEX IF EXISTS public.ix_assinaturas_bloqueio_admin;
ALTER TABLE public.assinaturas
  DROP COLUMN IF EXISTS bloqueio_admin_em,
  DROP COLUMN IF EXISTS bloqueio_admin_por,
  DROP COLUMN IF EXISTS bloqueio_admin_motivo;

-- ─── 5. Confere que a correcao de quota ficou de pe ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
                  WHERE c.relname='viveiros' AND t.tgname='trg_limite_viveiros'
                    AND NOT t.tgisinternal AND t.tgtype = 21) THEN
    RAISE EXCEPTION 'A reversao mexeu na quota: trg_limite_viveiros deveria ser AFTER INSERT OR UPDATE (tgtype 21)';
  END IF;
  IF to_regnamespace('wa_quota_interna') IS NULL THEN
    RAISE EXCEPTION 'A reversao removeu o schema wa_quota_interna, que e da correcao critica';
  END IF;
END $$;

COMMIT;
