-- Reversão excepcional: restaura somente a quota; mantém restritos os grants observados em 26/11.
BEGIN;
SET LOCAL lock_timeout = '5s';
DROP TRIGGER trg_limite_viveiros ON public.viveiros;
CREATE OR REPLACE FUNCTION public.checar_limite_viveiros()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE qtd integer; a public.assinaturas%ROWTYPE; limite integer := 1; hoje date := (now() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
 IF NEW.ativo IS NOT TRUE THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,0));
 SELECT * INTO a FROM public.assinaturas WHERE user_id=NEW.user_id;
 IF a.plano <> 'gratis' AND ((a.status='ativo' AND (a.proximo_vencimento IS NULL OR a.proximo_vencimento >= hoje OR (a.asaas_subscription_id IS NOT NULL AND a.proximo_vencimento >= hoje-5))) OR (a.status='pendente' AND a.asaas_subscription_id IS NOT NULL AND a.proximo_vencimento >= hoje-5)) THEN
 limite := coalesce(a.limite_viveiros,1);
 END IF;
 SELECT count(*) INTO qtd FROM public.viveiros WHERE user_id=NEW.user_id AND ativo IS TRUE;
 IF qtd >= limite THEN RAISE EXCEPTION 'LIMITE_PLANO: % viveiro(s), limite %',qtd,limite; END IF;
 RETURN NEW;
END; $function$
;
CREATE TRIGGER trg_limite_viveiros BEFORE INSERT ON public.viveiros
 FOR EACH ROW EXECUTE FUNCTION public.checar_limite_viveiros();
DROP TABLE wa_quota_interna.travas;
DROP SCHEMA wa_quota_interna;
REVOKE EXECUTE ON FUNCTION public.assinatura_carimbar_valor() FROM PUBLIC, anon, authenticated;
COMMIT;
