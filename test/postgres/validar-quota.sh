#!/usr/bin/env bash
# Só usa um cluster descartável em socket Unix, sem escutar TCP.
set -euo pipefail
cd "$(dirname "$0")/../.."
tmp=$(mktemp -d)
export PATH="${PG_BIN_DIR:-$(pg_config --bindir)}:$PATH"
unset PGHOSTADDR PGSERVICE PGOPTIONS
export PGHOST="$tmp" PGPORT=54876 PGUSER=postgres PGDATABASE=postgres
trap 'pg_ctl -D "$tmp/db" -m immediate stop >/dev/null 2>&1 || :; rm -rf "$tmp"' EXIT
initdb -U postgres -A trust -D "$tmp/db" >/dev/null
pg_ctl -D "$tmp/db" -o "-k $tmp -p $PGPORT -c listen_addresses=''" -w start >/dev/null
sql=(psql -X -v ON_ERROR_STOP=1)
m=seguranca-viveiros-20261126.sql
"${sql[@]}" <<'SQL'
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE TABLE public.assinaturas(user_id uuid, plano text, status text, limite_viveiros int,
 proximo_vencimento date, asaas_subscription_id text);
CREATE TABLE public.viveiros(id int PRIMARY KEY,user_id uuid NOT NULL,ativo boolean,nome text);
CREATE TABLE historico(viveiro_id int REFERENCES viveiros(id), peso numeric);
CREATE FUNCTION checar_limite_viveiros() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;
CREATE TRIGGER trg_limite_viveiros BEFORE INSERT ON viveiros FOR EACH ROW EXECUTE FUNCTION checar_limite_viveiros();
CREATE FUNCTION assinatura_carimbar_valor() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.nome='carimbado'; RETURN NEW; END$$;
CREATE TABLE carimbos(nome text);
CREATE TRIGGER carimbo BEFORE INSERT ON carimbos FOR EACH ROW EXECUTE FUNCTION assinatura_carimbar_valor();
GRANT INSERT ON carimbos TO authenticated;
INSERT INTO viveiros SELECT i,'00000000-0000-0000-0000-000000000001',true,'antigo' FROM generate_series(1,2) i;
INSERT INTO historico VALUES(1,12.1);
SQL
"${sql[@]}" -f "banco/migracoes/$m"
"${sql[@]}" -f test/postgres/quota.sql
# Duas sessões independentes. A primeira sinaliza somente após reservar a vaga.
for nivel in 'READ COMMITTED' 'REPEATABLE READ' 'SERIALIZABLE'; do
  rm -f "$tmp/pronta" "$tmp/liberar"
  "${sql[@]}" -q >"$tmp/primeira" 2>&1 <<SQL &
BEGIN;
INSERT INTO viveiros VALUES(900,'00000000-0000-0000-0000-000000000009',true,'primeiro');
\! touch "$tmp/pronta"
\! while [ ! -f "$tmp/liberar" ]; do sleep .05; done
COMMIT;
SQL
  p1=$!
  for i in {1..150}; do [[ -f "$tmp/pronta" ]] && break; sleep .05; done
  [[ -f "$tmp/pronta" ]]
  PGAPPNAME=quota_segunda "${sql[@]}" -v VERBOSITY=verbose >"$tmp/segunda" 2>&1 <<SQL &
BEGIN ISOLATION LEVEL $nivel;
UPDATE viveiros SET ativo=true WHERE id=901;
COMMIT;
SQL
  p2=$!
  bloqueada=f
  for i in {1..150}; do
    bloqueada=$("${sql[@]}" -Atc "select exists(select 1 from pg_stat_activity where application_name='quota_segunda' and wait_event_type='Lock')")
    [[ $bloqueada = t ]] && break
    sleep .05
  done
  touch "$tmp/liberar"
  wait "$p1"
  [[ $bloqueada = t ]]
  if wait "$p2"; then echo "Duas admissões: $nivel"; exit 1; fi
  if [[ $nivel = 'READ COMMITTED' ]]; then grep -q LIMITE_PLANO "$tmp/segunda"; else grep -q 40001 "$tmp/segunda"; fi
  [[ $("${sql[@]}" -Atc "select count(*) from viveiros where ativo and id in (900,901)") = 1 ]]
  "${sql[@]}" -c 'delete from viveiros where id=900'
done
"${sql[@]}" -f "banco/reversoes/$m"
[[ $("${sql[@]}" -Atc "select to_regnamespace('wa_quota_interna') is null and has_function_privilege('anon','assinatura_carimbar_valor()','execute') and (select tgtype=7 from pg_trigger where tgname='trg_limite_viveiros') and exists(select from historico where peso=12.1)") = t ]]
echo 'Quota, concorrência, permissões e reversão: OK'
