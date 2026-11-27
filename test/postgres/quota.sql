-- Dados sintéticos exclusivos do cluster criado pelo script.
DO $$
DECLARE a uuid='00000000-0000-0000-0000-000000000001';
 b uuid='00000000-0000-0000-0000-000000000002';
 c uuid='00000000-0000-0000-0000-000000000003';
BEGIN
 ASSERT (SELECT count(*) FROM viveiros WHERE ativo AND user_id=a)=2;
 UPDATE viveiros SET nome='novo' WHERE id=1;
 INSERT INTO viveiros VALUES(1,a,true,'renomeado') ON CONFLICT(id) DO UPDATE SET nome=excluded.nome;
 INSERT INTO viveiros VALUES(3,a,NULL,'inativo');
 BEGIN
   UPDATE viveiros SET ativo=true WHERE id=3;
   RAISE EXCEPTION 'reativação indevida';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'LIMITE_PLANO:%' THEN RAISE; END IF; END;
 INSERT INTO assinaturas VALUES(b,'basico','ativo',2,current_date+20,NULL);
 UPDATE viveiros SET user_id=b WHERE id=2;
 UPDATE viveiros SET user_id=b,ativo=true WHERE id=3;
 BEGIN
   UPDATE viveiros SET user_id=b WHERE id=1;
   RAISE EXCEPTION 'transferência indevida';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'LIMITE_PLANO:%' THEN RAISE; END IF; END;
 UPDATE viveiros SET ativo=false WHERE id=3;
 UPDATE viveiros SET ativo=true WHERE id=3;
 BEGIN
   INSERT INTO viveiros VALUES(4,c,true,'1'),(5,c,true,'2');
   RAISE EXCEPTION 'lote indevido';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'LIMITE_PLANO:%' THEN RAISE; END IF; END;
 ASSERT NOT EXISTS(SELECT FROM viveiros WHERE user_id=c);
 ASSERT EXISTS(SELECT FROM historico JOIN viveiros ON id=viveiro_id WHERE peso=12.1 AND user_id=a);
 ASSERT NOT has_function_privilege('anon','assinatura_carimbar_valor()','execute');
 ASSERT NOT has_function_privilege('authenticated','assinatura_carimbar_valor()','execute');
END $$;
SET ROLE authenticated;
INSERT INTO carimbos DEFAULT VALUES;
RESET ROLE;
DO $$BEGIN ASSERT EXISTS(SELECT FROM carimbos WHERE nome='carimbado'); END $$;
INSERT INTO viveiros VALUES(901,'00000000-0000-0000-0000-000000000009',false,'reserva');
