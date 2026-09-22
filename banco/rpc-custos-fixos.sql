-- ═══════════════════════════════════════════════════════════════════════════
-- WA Aqua Gestão — reajuste de custo fixo atômico (RPC)
--
-- O QUE FAZ
--   Reajustar um custo fixo "no meio do caminho" fecha o período antigo (na
--   véspera da nova data) E abre um novo período com o novo valor. Hoje o app
--   faz isso em DOIS passos soltos: se o segundo (inserir o novo) falha depois
--   do primeiro (fechar o antigo), o custo antigo fica encerrado e o novo não
--   entra — o custo some do rateio. Aqui os dois passos rodam na MESMA
--   transação: ou entra tudo, ou nada muda.
--
-- SEGURANÇA
--   security invoker + auth.uid(): roda com as permissões do próprio usuário e
--   continua obedecendo o RLS. Cada comando filtra por user_id = auth.uid().
--
-- COMO RODAR
--   Supabase → SQL Editor → New query → cole este arquivo inteiro → Run.
--   Criar a função NÃO altera nenhum dado das tabelas.
--
-- COMO DESFAZER (se um dia precisar)
--   drop function if exists public.reajustar_custo_fixo(uuid, date, text, text, numeric, date);
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.reajustar_custo_fixo(
  p_id_antigo   uuid,
  p_data_fim    date,     -- véspera: fecha o segmento antigo aqui
  p_nome        text,
  p_categoria   text,
  p_valor       numeric,
  p_data_inicio date      -- início do novo segmento (a nova vigência)
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_novo uuid;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  -- Fecha o período antigo. Se não achar (id errado / de outro usuário), aborta
  -- sem inserir nada.
  update public.custos_fixos
     set data_fim = p_data_fim
   where id = p_id_antigo and user_id = v_uid;
  if not found then
    raise exception 'Custo fixo não encontrado';
  end if;

  -- Abre o novo período. Se falhar, a transação inteira desfaz o UPDATE acima.
  insert into public.custos_fixos (user_id, nome, categoria, valor_mensal, data_inicio, ativo)
  values (v_uid, p_nome, p_categoria, p_valor, p_data_inicio, true)
  returning id into v_novo;

  return v_novo;
end;
$$;

grant execute on function public.reajustar_custo_fixo(uuid, date, text, text, numeric, date) to authenticated;
