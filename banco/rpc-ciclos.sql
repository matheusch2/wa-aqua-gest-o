-- ═══════════════════════════════════════════════════════════════════════════
-- WA Aqua Gestão — funções transacionais de ciclo (RPC)
--
-- O QUE FAZEM
--   Tornam o REINÍCIO e o ENCERRAMENTO de ciclo operações "tudo ou nada".
--   Hoje o app faz esses passos um a um; se a internet cai no meio, pode sobrar
--   estado pela metade. Dentro de uma função do Postgres, todos os passos rodam
--   na MESMA transação: se qualquer um falhar, o banco desfaz tudo sozinho.
--
-- SEGURANÇA
--   security invoker + auth.uid(): a função roda com as permissões do próprio
--   usuário e continua obedecendo o RLS. Ela NÃO contorna a segurança do banco —
--   só empacota as operações numa transação. Cada comando ainda filtra por
--   user_id = auth.uid() (cinto + suspensório).
--
-- COMO RODAR
--   Supabase → SQL Editor → New query → cole este arquivo inteiro → Run.
--   Criar/atualizar função NÃO altera nenhum dado das tabelas.
--
-- COMO DESFAZER (se um dia precisar)
--   drop function if exists public.reiniciar_ciclo(uuid, date, text, text, uuid);
--   drop function if exists public.encerrar_ciclo(uuid, uuid, uuid, date, jsonb, date, numeric, numeric, date);
-- ═══════════════════════════════════════════════════════════════════════════


-- ---------------------------------------------------------------------------
-- 1) REINICIAR CICLO
--    Apaga rações/biometrias/despescas do viveiro e avança para o ciclo novo,
--    tudo na mesma transação.
-- ---------------------------------------------------------------------------
create or replace function public.reiniciar_ciclo(
  p_viveiro      uuid,
  p_povoamento   date,
  p_total        text,
  p_laboratorio  text,
  p_ciclo_id     uuid
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  -- Trava a linha do viveiro e confere que é do usuário. Se não achar, aborta
  -- sem tocar em nada.
  perform 1 from public.viveiros
   where id = p_viveiro and user_id = v_uid
   for update;
  if not found then
    raise exception 'Viveiro não encontrado';
  end if;

  delete from public.racoes     where viveiro_id = p_viveiro and user_id = v_uid;
  delete from public.biometrias where viveiro_id = p_viveiro and user_id = v_uid;
  delete from public.despescas  where viveiro_id = p_viveiro and user_id = v_uid;

  update public.viveiros
     set data_povoamento = p_povoamento,
         total_povoado   = p_total,
         laboratorio     = p_laboratorio,
         ciclo_id        = p_ciclo_id
   where id = p_viveiro and user_id = v_uid;
end;
$$;

grant execute on function public.reiniciar_ciclo(uuid, date, text, text, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 2) ENCERRAR CICLO
--    Grava o ciclo (idempotente por ciclo_id), apaga os lançamentos, congela o
--    custo de ração e volta o viveiro para "em preparação" — tudo junto.
--
--    Idempotência: como não há índice único em ciclos(ciclo_id), a função
--    verifica se o ciclo já foi gravado. Se a transação já tinha COMMITADO numa
--    tentativa anterior (mas o app não recebeu a resposta), uma nova chamada não
--    duplica o ciclo.
--
--    Retorna: { "ciclo_id_row": <id do ciclo>, "custo_id": <id do custo|null>,
--               "reaproveitado": <bool> }
-- ---------------------------------------------------------------------------
create or replace function public.encerrar_ciclo(
  p_viveiro           uuid,
  p_ciclo_id          uuid,
  p_novo_ciclo_id     uuid,
  p_data_encerramento date,
  p_ciclo             jsonb,
  p_ini_ciclo         date    default null,
  p_racao_valor       numeric default null,
  p_racao_qtd_g       numeric default null,
  p_racao_data        date    default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_atual_ciclo uuid;
  v_ciclo_row   bigint;
  v_custo_id    uuid;
  v_reaproveit  boolean := false;
  v_bio_json    jsonb;
  v_rac_json    jsonb;
  v_desp_json   jsonb;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;

  -- Trava o viveiro, confere o dono e lê o ciclo_id atual dele.
  select ciclo_id into v_atual_ciclo
    from public.viveiros
   where id = p_viveiro and user_id = v_uid
   for update;
  if not found then
    raise exception 'Viveiro não encontrado';
  end if;

  -- Já existe um ciclo gravado com este ciclo_id?
  if p_ciclo_id is not null then
    select id into v_ciclo_row
      from public.ciclos
     where viveiro_id = p_viveiro and user_id = v_uid and ciclo_id = p_ciclo_id
     order by id
     limit 1;
    if found then
      v_reaproveit := true;
    end if;
  end if;

  -- CASO 1 — já encerrado por completo antes: o ciclo existe E o viveiro já saiu
  -- deste ciclo_id (foi resetado). Nada a fazer; devolve o que já está gravado.
  if v_ciclo_row is not null and v_atual_ciclo is distinct from p_ciclo_id then
    return jsonb_build_object(
      'ciclo_id_row', v_ciclo_row,
      'custo_id', null,
      'reaproveitado', true,
      -- Id de preparação que REALMENTE ficou no banco na 1ª tentativa. Numa
      -- repetição (resposta perdida), o app adota este em vez do id novo que
      -- ele gerou — senão os dois divergem e custos caem no ciclo errado (#3).
      'novo_ciclo_id_atual', v_atual_ciclo
    );
  end if;

  -- CASO 2 — encerramento normal (ou conclusão de um estado antigo pela metade).
  if v_ciclo_row is null then
    -- Monta a "foto" do histórico A PARTIR DAS LINHAS ATUAIS DO BANCO, e não da
    -- que o celular enviou. Assim, se outro aparelho lançou uma ração/biometria/
    -- despesca depois deste celular carregar, ela ENTRA no histórico do ciclo em
    -- vez de ser apagada logo abaixo sem deixar rastro (auditoria #1). O formato
    -- de cada objeto espelha exatamente o que o app lê de volta.
    select coalesce(jsonb_agg(jsonb_build_object(
             'data', b.data, 'gramatura', b.gramatura) order by b.data), '[]'::jsonb)
      into v_bio_json
      from public.biometrias b
     where b.viveiro_id = p_viveiro and b.user_id = v_uid;

    select coalesce(jsonb_agg(jsonb_build_object(
             'data', r.data, 'racao', r.racao,
             'nomeRacao', r.nome_racao, 'tipoRacaoId', r.tipo_racao_id) order by r.data), '[]'::jsonb)
      into v_rac_json
      from public.racoes r
     where r.viveiro_id = p_viveiro and r.user_id = v_uid;

    select coalesce(jsonb_agg(jsonb_build_object(
             'data', d.data, 'tipo', 'Parcial',
             'quantidadeKg', d.quantidade_kg, 'pesoMedio', d.peso_medio,
             'precoKg', d.preco_kg) order by d.data), '[]'::jsonb)
      into v_desp_json
      from public.despescas d
     where d.viveiro_id = p_viveiro and d.user_id = v_uid;

    insert into public.ciclos (
      viveiro_id, user_id, nome_viveiro, laboratorio, tamanho, total_povoado,
      data_povoamento, data_encerramento, dias_cultivo, producao_final,
      despesca_parcial, produtividade, producao_total, peso_final, racao_consumida,
      custo_fixo_rateado, fca, sobrevivencia, observacoes, preco_venda,
      data_preparacao, ciclo_id, biometrias_json, racoes_json, despescas_json
    ) values (
      p_viveiro, v_uid,
      p_ciclo->>'nome_viveiro',
      p_ciclo->>'laboratorio',
      p_ciclo->>'tamanho',
      p_ciclo->>'total_povoado',
      nullif(p_ciclo->>'data_povoamento','')::date,
      p_data_encerramento,
      nullif(p_ciclo->>'dias_cultivo','')::int,
      nullif(p_ciclo->>'producao_final','')::numeric,
      nullif(p_ciclo->>'despesca_parcial','')::numeric,
      nullif(p_ciclo->>'produtividade','')::numeric,
      nullif(p_ciclo->>'producao_total','')::numeric,
      nullif(p_ciclo->>'peso_final','')::numeric,
      nullif(p_ciclo->>'racao_consumida','')::numeric,
      nullif(p_ciclo->>'custo_fixo_rateado','')::numeric,
      nullif(p_ciclo->>'fca','')::numeric,
      nullif(p_ciclo->>'sobrevivencia','')::numeric,
      p_ciclo->>'observacoes',
      nullif(p_ciclo->>'preco_venda','')::numeric,
      nullif(p_ciclo->>'data_preparacao','')::date,
      p_ciclo_id,
      v_bio_json,
      v_rac_json,
      v_desp_json
    ) returning id into v_ciclo_row;
  end if;

  -- Apaga os lançamentos do ciclo encerrado (o histórico já está congelado nos
  -- campos *_json do ciclo, então nada se perde).
  delete from public.racoes     where viveiro_id = p_viveiro and user_id = v_uid;
  delete from public.biometrias where viveiro_id = p_viveiro and user_id = v_uid;
  delete from public.despescas  where viveiro_id = p_viveiro and user_id = v_uid;

  -- Congela o custo de Ração do ciclo (removendo antes para não duplicar).
  if p_ciclo_id is not null then
    delete from public.custos
     where viveiro_id = p_viveiro and user_id = v_uid
       and categoria = 'Ração' and ciclo_id = p_ciclo_id;

    if p_ini_ciclo is not null then
      delete from public.custos
       where viveiro_id = p_viveiro and user_id = v_uid
         and categoria = 'Ração' and nome_produto = 'Ração'
         and ciclo_id is null
         and data >= p_ini_ciclo and data <= p_data_encerramento;
    end if;

    if p_racao_valor is not null then
      insert into public.custos (
        user_id, viveiro_id, tipo, produto_id, nome_produto,
        quantidade_g, valor, categoria, data, ciclo_id
      ) values (
        v_uid, p_viveiro, 'produto', null, 'Ração',
        p_racao_qtd_g, p_racao_valor, 'Ração',
        coalesce(p_racao_data, p_data_encerramento), p_ciclo_id
      ) returning id into v_custo_id;
    end if;
  end if;

  -- Volta o viveiro para "em preparação", contando desde o encerramento.
  update public.viveiros
     set data_povoamento = null,
         total_povoado   = null,
         laboratorio     = null,
         data_preparacao = p_data_encerramento,
         ciclo_id        = p_novo_ciclo_id
   where id = p_viveiro and user_id = v_uid;

  return jsonb_build_object(
    'ciclo_id_row', v_ciclo_row,
    'custo_id', v_custo_id,
    'reaproveitado', v_reaproveit,
    -- Id de preparação que passou a valer para o viveiro (o mesmo gravado agora).
    'novo_ciclo_id_atual', p_novo_ciclo_id
  );
end;
$$;

grant execute on function public.encerrar_ciclo(uuid, uuid, uuid, date, jsonb, date, numeric, numeric, date) to authenticated;
