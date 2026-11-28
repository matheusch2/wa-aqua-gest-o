#!/usr/bin/env bash
# Cluster descartavel em socket Unix, sem escutar TCP — mesmo molde de
# validar-quota.sh. Aplica a migracao do bloqueio administrativo, roda os
# ensaios e depois a reversao, conferindo que a quota publicada sobrevive.
set -euo pipefail
cd "$(dirname "$0")/../.."
tmp=$(mktemp -d)
export PATH="${PG_BIN_DIR:-$(pg_config --bindir)}:$PATH"
unset PGHOSTADDR PGSERVICE PGOPTIONS
export PGHOST="$tmp" PGPORT=54877 PGUSER=postgres PGDATABASE=postgres
trap 'pg_ctl -D "$tmp/db" -m immediate stop >/dev/null 2>&1 || :; rm -rf "$tmp"' EXIT
initdb -U postgres -A trust -D "$tmp/db" >/dev/null
pg_ctl -D "$tmp/db" -o "-k $tmp -p $PGPORT -c listen_addresses=''" -w start >/dev/null
sql=(psql -X -v ON_ERROR_STOP=1)
m=bloqueio-administrativo-20261127.sql

# Esqueleto minimo: so o que a migracao toca.
"${sql[@]}" <<'SQL'
CREATE ROLE service_role BYPASSRLS; CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('wa.uid', true),'')::uuid $$;
CREATE TABLE public.perfis(user_id uuid, role text);
CREATE TABLE public.assinaturas(user_id uuid PRIMARY KEY, plano text, ciclo text, status text,
  limite_viveiros int, proximo_vencimento date, asaas_subscription_id text, atualizado_em timestamptz);
CREATE TABLE public.admin_historico(admin_id uuid, alvo_user_id uuid, acao text, detalhes jsonb,
  criado_em timestamptz DEFAULT now());
CREATE TABLE public.viveiros(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, ativo boolean,
  nome text, data_povoamento date);
CREATE TABLE public.viveiro_gratuito_escolha(user_id uuid, viveiro_id uuid);
CREATE TABLE public.boletos(user_id uuid);
CREATE TABLE public.custos_fixos(user_id uuid);
CREATE TABLE public.produtos(user_id uuid);
CREATE TABLE public.tipos_racao(user_id uuid);
ALTER TABLE public.viveiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_fixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_racao ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.meu_plano_efetivo() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
CREATE FUNCTION public.viveiro_permite_lancamento(p_viveiro uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-00000000000a');
INSERT INTO public.perfis VALUES('00000000-0000-0000-0000-00000000000a','admin');
INSERT INTO public.assinaturas(user_id,plano,ciclo,status,limite_viveiros,proximo_vencimento)
  VALUES('00000000-0000-0000-0000-000000000001','basico','mensal','ativo',5,current_date+30);
CREATE FUNCTION public.checar_limite_viveiros() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE TRIGGER trg_limite_viveiros BEFORE INSERT ON public.viveiros FOR EACH ROW EXECUTE FUNCTION public.checar_limite_viveiros();
CREATE FUNCTION public.assinatura_carimbar_valor() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['racoes','biometrias','despescas','ciclos','custos','whatsapp_vinculos','contatos'] LOOP
   EXECUTE format('CREATE TABLE public.%I (user_id uuid, viveiro_id uuid)',t);
 END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
INSERT INTO public.viveiros(user_id,ativo,nome) VALUES('00000000-0000-0000-0000-000000000001',true,'v1');
SQL

"${sql[@]}" -f banco/migracoes/seguranca-viveiros-20261126.sql
"${sql[@]}" -f "banco/migracoes/$m"
"${sql[@]}" -f test/postgres/bloqueio.sql

# As RPCs, com um admin de verdade na sessao.
"${sql[@]}" <<'SQL'
SELECT set_config('wa.uid','00000000-0000-0000-0000-00000000000a',false);
-- desbloquear primeiro (o ensaio anterior deixou bloqueado) e conferir que o
-- comercial nao se mexeu
CREATE TEMP TABLE antes AS SELECT plano,ciclo,status,limite_viveiros,proximo_vencimento
  FROM public.assinaturas WHERE user_id='00000000-0000-0000-0000-000000000001';
SELECT public.admin_desbloquear_cliente('00000000-0000-0000-0000-000000000001','ensaio: acordo');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM antes a JOIN public.assinaturas s
               ON s.user_id='00000000-0000-0000-0000-000000000001'
             WHERE (a.plano,a.ciclo,a.status,a.limite_viveiros,a.proximo_vencimento)
                IS DISTINCT FROM (s.plano,s.ciclo,s.status,s.limite_viveiros,s.proximo_vencimento))
  THEN RAISE EXCEPTION 'FALHOU: o desbloqueio mexeu no comercial'; END IF;
END $$;
SELECT public.admin_bloquear_cliente('00000000-0000-0000-0000-000000000001','ensaio: inadimplencia');
DO $$ BEGIN
  BEGIN PERFORM public.admin_bloquear_cliente('00000000-0000-0000-0000-000000000001','x');
        RAISE EXCEPTION 'FALHOU: aceitou motivo curto';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF position('motivo' in SQLERRM) = 0 THEN RAISE; END IF; END;
END $$;
-- quem nao e admin nao bloqueia
SELECT set_config('wa.uid','00000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  BEGIN PERFORM public.admin_bloquear_cliente('00000000-0000-0000-0000-000000000001','tentando');
        RAISE EXCEPTION 'FALHOU: nao-admin bloqueou';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF position('NAO_AUTORIZADO' in SQLERRM) = 0 THEN RAISE; END IF; END;
END $$;
SQL

# A leitura continua liberada para quem esta bloqueado.
"${sql[@]}" <<'SQL'
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viveiros TO authenticated;
CREATE POLICY dono ON public.viveiros FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

SET ROLE authenticated;
SELECT set_config('wa.uid','00000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.viveiros) <> 1 THEN
    RAISE EXCEPTION 'FALHOU: bloqueado perdeu a LEITURA dos proprios viveiros'; END IF;
  BEGIN INSERT INTO public.viveiros(user_id,ativo,nome) VALUES(auth.uid(),true,'v2');
        RAISE EXCEPTION 'FALHOU: bloqueado conseguiu ESCREVER';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SQL

if "${sql[@]}" -f "banco/reversoes/$m" >"$tmp/reversao" 2>&1; then exit 1; fi
grep -q REVERSAO_COM_BLOQUEIOS "$tmp/reversao"
"${sql[@]}" <<'SQL'
SELECT set_config('wa.uid','00000000-0000-0000-0000-00000000000a',false);
SELECT public.admin_desbloquear_cliente('00000000-0000-0000-0000-000000000001','fim do ensaio isolado');
DO $$ BEGIN
 IF EXISTS (SELECT FROM wa_bloqueio_interno.autorizacoes) THEN RAISE EXCEPTION 'autorização residual'; END IF;
 IF NOT EXISTS (SELECT FROM public.admin_historico WHERE acao='desbloquear') THEN RAISE EXCEPTION 'auditoria ausente'; END IF;
END $$;
SQL
"${sql[@]}" -f "banco/reversoes/$m"
[[ $("${sql[@]}" -Atc "select count(*)=0 from information_schema.columns where table_schema='public' and table_name='assinaturas' and column_name like 'bloqueio_admin%'") = t ]]
echo 'Bloqueio administrativo: gatilho, RPCs, politicas, leitura preservada e reversao: OK'
