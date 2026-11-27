-- [ESTADO EM 27/11/2026: PROPOSTA — NAO APLICADA EM PRODUCAO]
--
-- ═══════════════════════════════════════════════════════════════════════════
-- O BLOQUEIO ADMINISTRATIVO DEIXA DE SER O MESMO CAMPO DA SITUACAO COMERCIAL
--
-- HOJE as duas coisas moram em assinaturas.status:
--
--   "bloquear" no painel        -> status = 'cancelado'
--   "reativar" no painel        -> status = 'ativo'
--   "liberar" no painel         -> status = 'ativo'   (comercial)
--   Pix confirmado              -> status = 'ativo'   (comercial)
--   cartao confirmado           -> status = 'ativo'   (comercial)
--   SUBSCRIPTION_DELETED        -> status = 'cancelado'
--
-- Quem escreve por ultimo manda. Entao um pagamento desfaz um bloqueio, e um
-- bloqueio parece um cancelamento comercial.
--
-- JA ACONTECEU, e esta no historico (admin_historico, conta 93fdb707):
--
--   15/09 23:39     bloquear
--   01/10 14:37:25  liberar      <- status voltou para 'ativo'
--   01/10 14:37:37  bloquear     <- 12 segundos depois
--
-- O "liberar" e uma acao COMERCIAL (dar plano e validade) e desligou um
-- bloqueio administrativo que estava de pe havia duas semanas. Quem estava no
-- painel percebeu e refez o bloqueio. Nao ha, no historico, nenhum caso de
-- pagamento desfazendo bloqueio — mas o caminho e o mesmo.
--
-- O QUE ESTA MIGRACAO FAZ
--   1. Tres colunas novas em assinaturas guardam QUEM bloqueou, QUANDO e POR
--      QUE. O bloqueio passa a ser `bloqueio_admin_em IS NOT NULL`, e nao mais
--      um valor de status.
--   2. Um gatilho recusa qualquer escrita nessas colunas que nao venha das
--      duas funcoes dedicadas. Vale inclusive para o service_role, que ignora
--      RLS mas NAO ignora gatilho — e e com service_role que o webhook do
--      Asaas e a funcao admin-clientes escrevem.
--   3. Duas RPCs novas (bloquear/desbloquear) mexem SO nas tres colunas, e
--      exigem motivo. Nao tocam plano, ciclo, status, limite nem vencimento.
--   4. O bloqueio entra em meu_plano_efetivo() e em
--      viveiro_permite_lancamento(), que ja sao a porta de escrita no servidor
--      (politicas RESTRICTIVE em racoes, biometrias, despescas, custos e
--      ciclos). Para as tabelas que nao passam por essa porta — viveiros,
--      boletos, custos_fixos, produtos, tipos_racao — entram politicas
--      RESTRICTIVE novas, so de escrita.
--   5. Carga inicial a partir do admin_historico, so para quem continua
--      bloqueado.
--
-- O QUE ELA NAO FAZ, DE PROPOSITO
--   - Nao reescreve assinaturas.status de ninguem. O status de hoje mistura as
--     duas historias e nao da para separar com confianca retroativa. Na duvida,
--     deixa como esta: quem esta bloqueado continua bloqueado pelos dois
--     caminhos, e ninguem ganha acesso por causa da migracao.
--   - Nao mexe em limite_viveiros. Bloqueio e porta de ESCRITA; o cliente
--     continua vendo e consultando tudo o que e dele.
--   - Nao encosta na correcao critica de quota publicada em 65d6885: nem no
--     gatilho, nem na funcao da quota, nem no schema dela. Ha teste que confere
--     que nenhum desses nomes aparece aqui fora de comentario.
--
-- ENSAIADA CONTRA O BANCO DE PRODUCAO em 27/11/2026, dentro de uma transacao
-- desfeita no fim (BEGIN ... ROLLBACK). Resultado, com residuo conferido em
-- zero depois:
--   pagamento tentando limpar o bloqueio -> barrado pelo gatilho
--   pagamento mexendo so no comercial    -> passou
--   meu_plano_efetivo: bloqueio_admin=true, plano=basico, limite=5
--   viveiro_permite_lancamento           -> false
--   o cliente continua lendo os viveiros dele
--   trg_limite_viveiros                  -> tgtype 21, intacto
--
-- COMO RODAR: como postgres, num unico BEGIN/COMMIT. Reversao em
-- banco/reversoes/bloqueio-administrativo-20261127.sql.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Aplicar como postgres'; END IF;
END $$;

-- ─── 1. ONDE O BLOQUEIO PASSA A MORAR ──────────────────────────────────────

ALTER TABLE public.assinaturas
  ADD COLUMN IF NOT EXISTS bloqueio_admin_em     timestamptz,
  ADD COLUMN IF NOT EXISTS bloqueio_admin_por    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bloqueio_admin_motivo text;

COMMENT ON COLUMN public.assinaturas.bloqueio_admin_em IS
  'Quando o administrador bloqueou. NULO = sem bloqueio administrativo. Independe de status, plano e vencimento.';
COMMENT ON COLUMN public.assinaturas.bloqueio_admin_por IS
  'Qual administrador bloqueou.';
COMMENT ON COLUMN public.assinaturas.bloqueio_admin_motivo IS
  'Por que foi bloqueado. Obrigatorio na RPC, de 3 a 180 caracteres.';

-- Quem esta bloqueado tem de ter data e motivo, ou nenhum dos dois.
ALTER TABLE public.assinaturas
  DROP CONSTRAINT IF EXISTS assinaturas_bloqueio_admin_completo;
ALTER TABLE public.assinaturas
  ADD CONSTRAINT assinaturas_bloqueio_admin_completo CHECK (
    (bloqueio_admin_em IS NULL AND bloqueio_admin_motivo IS NULL)
    OR (bloqueio_admin_em IS NOT NULL AND coalesce(length(trim(bloqueio_admin_motivo)),0) >= 3)
  );

CREATE INDEX IF NOT EXISTS ix_assinaturas_bloqueio_admin
  ON public.assinaturas (bloqueio_admin_em) WHERE bloqueio_admin_em IS NOT NULL;

-- ─── 2. SO AS FUNCOES DEDICADAS MEXEM NESSAS COLUNAS ───────────────────────
--
-- A garantia nao pode depender de disciplina de quem escreve codigo. O
-- webhook do Asaas e a admin-clientes usam service_role, que passa por cima
-- de RLS; gatilho eles nao passam. Qualquer escrita que mude uma das tres
-- colunas sem o sinal da sessao e recusada.

CREATE OR REPLACE FUNCTION public.assinatura_bloqueio_admin_protegido()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.bloqueio_admin_em IS NOT NULL
       AND coalesce(current_setting('wa.bloqueio_admin', true),'') <> '1' THEN
      RAISE EXCEPTION 'BLOQUEIO_ADMIN_PROTEGIDO: use admin_bloquear_cliente()';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.bloqueio_admin_em     IS DISTINCT FROM OLD.bloqueio_admin_em
     OR NEW.bloqueio_admin_por    IS DISTINCT FROM OLD.bloqueio_admin_por
     OR NEW.bloqueio_admin_motivo IS DISTINCT FROM OLD.bloqueio_admin_motivo THEN
    IF coalesce(current_setting('wa.bloqueio_admin', true),'') <> '1' THEN
      RAISE EXCEPTION 'BLOQUEIO_ADMIN_PROTEGIDO: pagamento, webhook ou liberacao nao mexem no bloqueio administrativo';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

COMMENT ON FUNCTION public.assinatura_bloqueio_admin_protegido() IS
  'Recusa escrita nas colunas bloqueio_admin_* fora de admin_bloquear_cliente/admin_desbloquear_cliente. Vale tambem para service_role.';

REVOKE EXECUTE ON FUNCTION public.assinatura_bloqueio_admin_protegido() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_assinatura_bloqueio_admin ON public.assinaturas;
CREATE TRIGGER trg_assinatura_bloqueio_admin
  BEFORE INSERT OR UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.assinatura_bloqueio_admin_protegido();

-- ─── 3. AS DUAS ACOES ADMINISTRATIVAS ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_bloquear_cliente(p_user uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_linha public.assinaturas%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.perfis WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NAO_AUTORIZADO';
  END IF;
  IF coalesce(length(trim(p_motivo)),0) NOT BETWEEN 3 AND 180 THEN
    RAISE EXCEPTION 'Informe o motivo do bloqueio (3 a 180 caracteres).';
  END IF;
  IF p_user IS NULL THEN RAISE EXCEPTION 'Informe o cliente.'; END IF;

  PERFORM set_config('wa.bloqueio_admin','1',true);   -- so vale nesta transacao

  UPDATE public.assinaturas
     SET bloqueio_admin_em     = coalesce(bloqueio_admin_em, now()),
         bloqueio_admin_por    = auth.uid(),
         bloqueio_admin_motivo = trim(p_motivo),
         atualizado_em         = now()
   WHERE user_id = p_user
   RETURNING * INTO v_linha;

  IF NOT FOUND THEN RAISE EXCEPTION 'NAO_ENCONTRADO: esse cliente nao tem assinatura'; END IF;

  INSERT INTO public.admin_historico(admin_id, alvo_user_id, acao, detalhes)
  VALUES (auth.uid(), p_user, 'bloquear',
          jsonb_build_object('motivo', trim(p_motivo), 'desde', v_linha.bloqueio_admin_em));

  RETURN jsonb_build_object('bloqueado', true, 'desde', v_linha.bloqueio_admin_em,
                            'motivo', v_linha.bloqueio_admin_motivo);
END $function$;

CREATE OR REPLACE FUNCTION public.admin_desbloquear_cliente(p_user uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE v_antes public.assinaturas%ROWTYPE; v_depois public.assinaturas%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.perfis WHERE user_id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'NAO_AUTORIZADO';
  END IF;
  IF coalesce(length(trim(p_motivo)),0) NOT BETWEEN 3 AND 180 THEN
    RAISE EXCEPTION 'Informe o motivo do desbloqueio (3 a 180 caracteres).';
  END IF;

  SELECT * INTO v_antes FROM public.assinaturas WHERE user_id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NAO_ENCONTRADO: esse cliente nao tem assinatura'; END IF;

  PERFORM set_config('wa.bloqueio_admin','1',true);

  UPDATE public.assinaturas
     SET bloqueio_admin_em     = NULL,
         bloqueio_admin_por    = NULL,
         bloqueio_admin_motivo = NULL,
         atualizado_em         = now()
   WHERE user_id = p_user
   RETURNING * INTO v_depois;

  /* O desbloqueio NAO mexe no comercial. Se o cliente estava vencido antes do
     bloqueio, continua vencido depois dele — quem resolve isso e "Liberar",
     que e outra acao, com outro registro. Esta conferencia existe para o caso
     de alguem acrescentar um campo aqui por engano no futuro. */
  IF v_depois.plano              IS DISTINCT FROM v_antes.plano
     OR v_depois.ciclo              IS DISTINCT FROM v_antes.ciclo
     OR v_depois.status             IS DISTINCT FROM v_antes.status
     OR v_depois.limite_viveiros    IS DISTINCT FROM v_antes.limite_viveiros
     OR v_depois.proximo_vencimento IS DISTINCT FROM v_antes.proximo_vencimento THEN
    RAISE EXCEPTION 'DESBLOQUEIO_MEXEU_NO_COMERCIAL: operacao desfeita';
  END IF;

  INSERT INTO public.admin_historico(admin_id, alvo_user_id, acao, detalhes)
  VALUES (auth.uid(), p_user, 'desbloquear',
          jsonb_build_object('motivo', trim(p_motivo),
                             'bloqueado_desde', v_antes.bloqueio_admin_em,
                             'motivo_do_bloqueio', v_antes.bloqueio_admin_motivo));

  RETURN jsonb_build_object('bloqueado', false, 'bloqueado_desde', v_antes.bloqueio_admin_em);
END $function$;

REVOKE ALL ON FUNCTION public.admin_bloquear_cliente(uuid,text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_desbloquear_cliente(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bloquear_cliente(uuid,text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_desbloquear_cliente(uuid,text) TO authenticated;

-- ─── 4. O BLOQUEIO VALE NO SERVIDOR ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.bloqueio_admin_ativo(p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
  SELECT EXISTS (SELECT 1 FROM public.assinaturas
                  WHERE user_id = p_user AND bloqueio_admin_em IS NOT NULL)
$function$;

REVOKE ALL ON FUNCTION public.bloqueio_admin_ativo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bloqueio_admin_ativo(uuid) TO authenticated;

/* meu_plano_efetivo passa a dizer se a conta esta bloqueada. O resto do
   objeto continua igual: plano, limite e vencimento sao a situacao COMERCIAL,
   que o bloqueio nao altera. */
CREATE OR REPLACE FUNCTION public.meu_plano_efetivo()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE a public.assinaturas%ROWTYPE; hoje date := (now() AT TIME ZONE 'America/Fortaleza')::date; vigente boolean; escolhido uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'NAO_AUTORIZADO'; END IF;
 SELECT * INTO a FROM public.assinaturas WHERE user_id=auth.uid();
 vigente := coalesce(a.plano <> 'gratis' AND ((a.status='ativo' AND (a.proximo_vencimento IS NULL OR a.proximo_vencimento >= hoje OR (a.asaas_subscription_id IS NOT NULL AND a.proximo_vencimento >= hoje-5))) OR (a.status='pendente' AND a.asaas_subscription_id IS NOT NULL AND a.proximo_vencimento >= hoje-5)),false);
 SELECT e.viveiro_id INTO escolhido FROM public.viveiro_gratuito_escolha e JOIN public.viveiros v ON v.id=e.viveiro_id WHERE e.user_id=auth.uid() AND v.user_id=auth.uid() AND v.ativo IS TRUE;
 RETURN jsonb_build_object(
   'plano', case when vigente then a.plano else 'gratis' end,
   'limite_viveiros', case when vigente then a.limite_viveiros else 1 end,
   'plano_contratado', a.plano,
   'proximo_vencimento', a.proximo_vencimento,
   'viveiro_escolhido', escolhido,
   'bloqueio_admin', a.bloqueio_admin_em IS NOT NULL,
   'bloqueio_admin_desde', a.bloqueio_admin_em,
   'bloqueio_admin_motivo', a.bloqueio_admin_motivo);
END; $function$;

/* A porta de escrita que as politicas RESTRICTIVE de racoes, biometrias,
   despescas, custos e ciclos ja usam. Bloqueado nao lanca nada. */
CREATE OR REPLACE FUNCTION public.viveiro_permite_lancamento(p_viveiro uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE lim integer; escolhido uuid; plano jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RETURN false; END IF;
 plano := public.meu_plano_efetivo();
 IF (plano->>'bloqueio_admin')::boolean THEN RETURN false; END IF;
 lim := (plano->>'limite_viveiros')::integer;
 escolhido := (plano->>'viveiro_escolhido')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.viveiros WHERE id=p_viveiro AND user_id=auth.uid() AND ativo IS TRUE) THEN RETURN false; END IF;
 IF plano->>'plano'='gratis' AND escolhido IS NOT NULL THEN RETURN escolhido=p_viveiro; END IF;
 RETURN EXISTS(SELECT 1 FROM (SELECT id FROM public.viveiros WHERE user_id=auth.uid() AND ativo IS TRUE ORDER BY data_povoamento ASC NULLS LAST,nome,id LIMIT lim) v WHERE v.id=p_viveiro);
END; $function$;

/* As tabelas que NAO passam por viveiro_permite_lancamento ganham a trava
   agora: viveiros, boletos, custos_fixos, produtos e tipos_racao. Hoje elas
   so tem politica PERMISSIVA de dono, e eram o buraco que sobrava.

   SO ESCRITA. Nada de politica em FOR ALL: uma RESTRICTIVE assim valeria
   tambem para o SELECT, e o cliente bloqueado perderia a consulta dos
   proprios dados — o contrario do que esta tarefa pede ("preservar
   historicos e acesso para consulta"). Por isso INSERT, UPDATE e DELETE, um a
   um, e o SELECT intocado. Ha teste que confere exatamente isso.

   Enquanto ninguem estiver bloqueado, nada muda: bloqueio_admin_ativo()
   devolve falso para todo mundo. */
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['viveiros','boletos','custos_fixos','produtos','tipos_racao'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS bloqueio_admin_sem_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS bloqueio_admin_sem_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS bloqueio_admin_sem_delete ON public.%I', t);

    EXECUTE format($f$CREATE POLICY bloqueio_admin_sem_insert ON public.%I
      AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK (NOT public.bloqueio_admin_ativo())$f$, t);
    EXECUTE format($f$CREATE POLICY bloqueio_admin_sem_update ON public.%I
      AS RESTRICTIVE FOR UPDATE TO authenticated
      USING (NOT public.bloqueio_admin_ativo())
      WITH CHECK (NOT public.bloqueio_admin_ativo())$f$, t);
    EXECUTE format($f$CREATE POLICY bloqueio_admin_sem_delete ON public.%I
      AS RESTRICTIVE FOR DELETE TO authenticated
      USING (NOT public.bloqueio_admin_ativo())$f$, t);
  END LOOP;
END $$;

-- ─── 5. CARGA INICIAL A PARTIR DO HISTORICO ────────────────────────────────
--
-- Conferido em 27/11/2026: cinco bloqueios e cinco reativacoes no
-- admin_historico, em tres clientes. So UM continua com "bloquear" como
-- ultima acao administrativa — os outros foram reativados por um admin.
-- Nenhum pagamento aparece desfazendo bloqueio.

DO $$ BEGIN PERFORM set_config('wa.bloqueio_admin','1',true); END $$;

WITH ultima AS (
  SELECT DISTINCT ON (alvo_user_id) alvo_user_id, acao, criado_em, admin_id
    FROM public.admin_historico
   WHERE acao IN ('bloquear','reativar','desbloquear')
   ORDER BY alvo_user_id, criado_em DESC)
UPDATE public.assinaturas a
   SET bloqueio_admin_em     = u.criado_em,
       bloqueio_admin_por    = u.admin_id,
       bloqueio_admin_motivo = 'Migrado do historico administrativo em 27/11/2026; motivo original nao foi registrado na epoca.'
  FROM ultima u
 WHERE a.user_id = u.alvo_user_id
   AND u.acao = 'bloquear'
   AND a.bloqueio_admin_em IS NULL;

COMMIT;
