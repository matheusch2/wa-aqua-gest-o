-- Banco efêmero: validar a RPC completa com duas dependências em cascata.
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000002','teste@example.invalid');
INSERT INTO assinaturas(user_id) SELECT id FROM auth.users WHERE email='teste@example.invalid';
INSERT INTO produtos SELECT id FROM auth.users WHERE email='teste@example.invalid';
INSERT INTO custos(user_id) SELECT id FROM auth.users WHERE email='teste@example.invalid';
SELECT set_config('wa.uid','00000000-0000-0000-0000-00000000000a',false);
SELECT admin_bloquear_cliente('00000000-0000-0000-0000-000000000002','teste de exclusão');
SET ROLE service_role;
DO $$ DECLARE alvo uuid:='00000000-0000-0000-0000-000000000002'; BEGIN
 BEGIN DELETE FROM custos WHERE user_id=alvo; RAISE EXCEPTION 'serviço apagou custo';
 EXCEPTION WHEN insufficient_privilege THEN IF position('BLOQUEIO_ADMIN:' in SQLERRM)=0 THEN RAISE; END IF; END;
 BEGIN UPDATE produtos SET user_id=alvo WHERE user_id=alvo; RAISE EXCEPTION 'serviço editou produto';
 EXCEPTION WHEN insufficient_privilege THEN IF position('BLOQUEIO_ADMIN:' in SQLERRM)=0 THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$ DECLARE alvo uuid:='00000000-0000-0000-0000-000000000002'; BEGIN
 PERFORM set_config('wa.uid',alvo::text,true);
 BEGIN PERFORM admin_excluir_cliente(alvo,'teste@example.invalid'); RAISE EXCEPTION 'aceitou usuário comum';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Sem permissão.' THEN RAISE; END IF; END;
 PERFORM set_config('wa.uid','00000000-0000-0000-0000-00000000000a',true);
 BEGIN PERFORM admin_excluir_cliente(alvo,'errado@example.invalid'); RAISE EXCEPTION 'email incorreto aceito';
 EXCEPTION WHEN raise_exception THEN IF position('e-mail não corresponde' in SQLERRM)=0 THEN RAISE; END IF; END;
END $$;
RESET ROLE;
CREATE TABLE obstaculo(id uuid REFERENCES auth.users); 
INSERT INTO obstaculo SELECT id FROM auth.users WHERE email='teste@example.invalid';
SET ROLE authenticated;
DO $$ DECLARE alvo uuid:='00000000-0000-0000-0000-000000000002'; BEGIN
 BEGIN PERFORM admin_excluir_cliente(alvo,'teste@example.invalid'); RAISE EXCEPTION 'exclusão parcial'; EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
RESET ROLE;
DO $$ DECLARE alvo uuid:='00000000-0000-0000-0000-000000000002'; BEGIN
 IF NOT EXISTS(SELECT FROM custos WHERE user_id=alvo) OR NOT EXISTS(SELECT FROM assinaturas WHERE user_id=alvo AND bloqueio_admin_em IS NOT NULL) OR EXISTS(SELECT FROM wa_bloqueio_interno.exclusoes) THEN RAISE EXCEPTION 'atomicidade'; END IF;
END $$;
DELETE FROM obstaculo;
SET ROLE authenticated;
SELECT admin_excluir_cliente('00000000-0000-0000-0000-000000000002','teste@example.invalid');
RESET ROLE;
DO $$ DECLARE alvo uuid:='00000000-0000-0000-0000-000000000002'; BEGIN
 IF EXISTS(SELECT FROM auth.users WHERE id=alvo) OR EXISTS(SELECT FROM custos WHERE user_id=alvo) OR EXISTS(SELECT FROM assinaturas WHERE user_id=alvo) OR EXISTS(SELECT FROM produtos WHERE user_id=alvo) OR EXISTS(SELECT FROM wa_bloqueio_interno.exclusoes) THEN RAISE EXCEPTION 'restaram dependências'; END IF;
END $$;
