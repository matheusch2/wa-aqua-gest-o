-- Ensaios do bloqueio administrativo, num cluster descartavel.
-- Rodados por test/postgres/validar-bloqueio.sh DEPOIS da migracao.
\set ON_ERROR_STOP on

-- 1. O gatilho barra quem nao e a RPC (webhook, pagamento, liberar).
DO $$ BEGIN
  PERFORM set_config('wa.bloqueio_admin','1',true);
  UPDATE public.assinaturas SET bloqueio_admin_em=now(), bloqueio_admin_motivo='ensaio'
   WHERE user_id='00000000-0000-0000-0000-000000000001';
  PERFORM set_config('wa.bloqueio_admin','',true);
END $$;

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

-- 4. A restricao de completude: data sem motivo nao entra.
DO $$ BEGIN
  BEGIN
    PERFORM set_config('wa.bloqueio_admin','1',true);
    UPDATE public.assinaturas SET bloqueio_admin_motivo=NULL
     WHERE user_id='00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'FALHOU: bloqueio ficou sem motivo';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

\echo 'bloqueio administrativo: gatilho, separacao e restricao OK'
