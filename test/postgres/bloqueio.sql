-- Ensaios do bloqueio administrativo, num cluster descartavel.
-- Rodados por test/postgres/validar-bloqueio.sh DEPOIS da migracao.
\set ON_ERROR_STOP on

-- 1. O gatilho barra quem nao e a RPC (webhook, pagamento, liberar).
SELECT set_config('wa.uid','00000000-0000-0000-0000-00000000000a',false);
SELECT public.admin_bloquear_cliente('00000000-0000-0000-0000-000000000001','ensaio');
SET ROLE service_role;
DO $$ BEGIN
  BEGIN
    UPDATE public.assinaturas
       SET bloqueio_admin_em=NULL, bloqueio_admin_motivo=NULL, bloqueio_admin_por=NULL, status='ativo'
     WHERE user_id='00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FALHOU: pagamento conseguiu limpar o bloqueio';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF position('BLOQUEIO_ADMIN_PROTEGIDO' in SQLERRM) = 0 THEN RAISE; END IF;
  END;
END $$;

-- 2. O mesmo pagamento mexendo so no comercial passa.
UPDATE public.assinaturas SET status='ativo', proximo_vencimento=current_date+30
 WHERE user_id='00000000-0000-0000-0000-000000000001';

-- 3. O bloqueio continua de pe depois do pagamento.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.assinaturas
                  WHERE user_id='00000000-0000-0000-0000-000000000001'
                    AND bloqueio_admin_em IS NOT NULL) THEN
    RAISE EXCEPTION 'FALHOU: o pagamento desfez o bloqueio';
  END IF;
END $$;


DO $$ DECLARE t text; alvo uuid := '00000000-0000-0000-0000-000000000001'; BEGIN
 FOREACH t IN ARRAY ARRAY['whatsapp_vinculos','viveiro_gratuito_escolha','custos','contatos','boletos','racoes','ciclos','biometrias','despescas','custos_fixos','produtos','tipos_racao'] LOOP
   BEGIN
     EXECUTE format('INSERT INTO public.%I(user_id) VALUES ($1)',t) USING alvo;
     RAISE EXCEPTION 'gravou na tabela %',t;
   EXCEPTION WHEN insufficient_privilege THEN
     IF position('BLOQUEIO_ADMIN:' in SQLERRM)=0 THEN RAISE; END IF;
   END;
 END LOOP;
 BEGIN DELETE FROM public.assinaturas WHERE user_id=alvo; RAISE EXCEPTION 'apagou assinatura';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'BLOQUEIO_ADMIN_PROTEGIDO' THEN RAISE; END IF; END;
 BEGIN INSERT INTO public.assinaturas(user_id) VALUES(alvo)
   ON CONFLICT(user_id) DO UPDATE SET bloqueio_admin_em=NULL;
   RAISE EXCEPTION 'upsert removeu bloqueio';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'BLOQUEIO_ADMIN_PROTEGIDO' THEN RAISE; END IF; END;
 IF to_regprocedure('public.bloqueio_admin_ativo(uuid)') IS NOT NULL THEN RAISE EXCEPTION 'consulta arbitraria exposta'; END IF;
END $$;
RESET ROLE;
