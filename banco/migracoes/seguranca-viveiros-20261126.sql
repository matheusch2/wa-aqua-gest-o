-- Proposta, ainda não aplicada. Não atualiza registros de clientes.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE SCHEMA wa_quota_interna;
REVOKE ALL ON SCHEMA wa_quota_interna FROM PUBLIC, anon, authenticated;
CREATE TABLE wa_quota_interna.travas (faixa smallint PRIMARY KEY, marca boolean NOT NULL);
REVOKE ALL ON TABLE wa_quota_interna.travas FROM PUBLIC, anon, authenticated;
ALTER TABLE wa_quota_interna.travas ENABLE ROW LEVEL SECURITY;
INSERT INTO wa_quota_interna.travas SELECT i, false FROM generate_series(0,255) i;
CREATE OR REPLACE FUNCTION public.checar_limite_viveiros()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE qtd integer; a public.assinaturas%ROWTYPE; limite integer := 1; hoje date := (now() AT TIME ZONE 'America/Fortaleza')::date;
BEGIN
 IF NEW.ativo IS NOT TRUE THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' THEN
   IF OLD.ativo IS TRUE AND OLD.user_id IS NOT DISTINCT FROM NEW.user_id THEN RETURN NEW; END IF;
 END IF;
 -- Escreve uma versão MVCC: duas admissões concorrentes do mesmo titular
 -- se serializam em READ COMMITTED; snapshots antigos recebem 40001.
 UPDATE wa_quota_interna.travas SET marca = NOT marca
 WHERE faixa = (pg_catalog.hashtextextended(NEW.user_id::text,0) & 255);
 IF NOT FOUND THEN RAISE EXCEPTION 'Titular ou trava de quota ausente'; END IF;
 SELECT * INTO a FROM public.assinaturas WHERE user_id=NEW.user_id;
 IF a.plano <> 'gratis' AND ((a.status='ativo' AND (a.proximo_vencimento IS NULL OR a.proximo_vencimento >= hoje OR (a.asaas_subscription_id IS NOT NULL AND a.proximo_vencimento >= hoje-5))) OR (a.status='pendente' AND a.asaas_subscription_id IS NOT NULL AND a.proximo_vencimento >= hoje-5)) THEN
 limite := coalesce(a.limite_viveiros,1);
 END IF;
 SELECT count(*) INTO qtd FROM public.viveiros WHERE user_id=NEW.user_id AND ativo IS TRUE;
 IF qtd > limite THEN RAISE EXCEPTION 'LIMITE_PLANO: % viveiro(s), limite %',qtd,limite; END IF;
 RETURN NEW;
END; $function$
;
-- AFTER considera o resultado efetivo (inclusive ON CONFLICT e escrita em lote).
DROP TRIGGER trg_limite_viveiros ON public.viveiros;
CREATE TRIGGER trg_limite_viveiros AFTER INSERT OR UPDATE ON public.viveiros
 FOR EACH ROW EXECUTE FUNCTION public.checar_limite_viveiros();
REVOKE EXECUTE ON FUNCTION public.assinatura_carimbar_valor() FROM PUBLIC, anon, authenticated;
COMMIT;
