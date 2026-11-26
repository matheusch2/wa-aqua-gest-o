-- [ESTADO EM 26/11/2026: APLICADA]
--   Aplicada em tres migracoes, nesta ordem, e conferida no banco depois:
--     assinatura_valor_contratado
--     cotar_troca_plano_sem_exigir_pix
--     pix_pago_sem_ativar_vira_pendencia
--
-- ═══════════════════════════════════════════════════════════════════════════
-- TRES CORRECOES NO UPGRADE PROPORCIONAL
--
-- O upgrade com cobranca proporcional entrou no ar em 26/11/2026. Conferindo
-- o que esta REALMENTE publicado no banco (nao o que esta nos arquivos — as
-- duas coisas ja divergiam), apareceram tres problemas. Os numeros abaixo
-- vieram de consulta ao banco de producao, nao de suposicao.
--
-- ───────────────────────────────────────────────────────────────────────────
-- 1. HOJE, QUASE NINGUEM CONSEGUE PEDIR UPGRADE
--
--    A versao publicada de cotar_troca_plano descobre quanto dura o periodo
--    ja pago assim:
--
--      select a.proximo_vencimento - c.inicio_periodo into duracao
--        from public.cobrancas_pix c
--       where c.user_id=... and c.validade_ate=a.proximo_vencimento
--         and c.ciclo=a.ciclo and c.status='pago'
--         and c.inicio_periodo is not null ...
--      if duracao is null then raise exception 'Periodo original nao
--        confirmado. Solicite a troca ao atendimento.'; end if;
--
--    Ou seja: exige uma cobranca Pix paga, desta casa, cobrindo exatamente
--    este periodo. A tabela cobrancas_pix nasceu hoje e tem 5 linhas, 1 paga
--    com inicio_periodo. Os pagantes ativos sao 17. Todos os outros — os que
--    pagam no cartao e os que o dono liberou na mao — batem no erro.
--
--    Pior: o proprio upgrade grava inicio_periodo = null (so 'renovacao'
--    grava), entao quem conseguisse trocar uma vez ficaria travado na
--    seguinte.
--
--    AGORA a duracao vem da melhor evidencia disponivel, nesta ordem:
--      1) a cobranca Pix daquele periodo, quando existe (a mais exata);
--      2) o periodo de cartao registrado em periodos_cartao;
--      3) a duracao nominal do ciclo (1 mes / 6 meses / 1 ano).
--    A terceira cobre liberacao manual e cartao, que e a maioria.
--
--    E os dias creditados passam a ser limitados a um periodo: uma liberacao
--    manual de 500 dias num ciclo mensal creditaria mais do que o cliente
--    pagou, e a conta viraria dinheiro de volta.
--
-- ───────────────────────────────────────────────────────────────────────────
-- 2. REAJUSTE DE PRECO BAGUNCA A CONTA
--
--    A conta usa o preco ATUAL do catalogo como "o que ele ja paga". Se o
--    dono reajustar, o cliente que contratou mais barato e tratado como se
--    pagasse o preco novo, e o credito dele sai errado.
--
--    AGORA a assinatura guarda valor_contratado: o que aquele cliente
--    realmente paga. Quem preenche e um gatilho, nao cada caminho de
--    codigo — assim vale para o Pix, para o cartao, para a liberacao manual
--    e para o que vier depois, sem ninguem precisar lembrar. Ele carimba
--    quando o plano muda, quando o ciclo muda e quando o vencimento avanca
--    (renovacao, quando o cliente passa a pagar o preco do dia).
--
--    A carga inicial grava o preco de hoje para quem ja e pagante. Isso NAO
--    muda nada agora — e exatamente o que a conta ja fazia. Serve para
--    congelar antes do proximo reajuste.
--
-- ───────────────────────────────────────────────────────────────────────────
-- 3. PIX PAGO QUE NAO ATIVA SOME
--
--    Se a assinatura mudar entre a cotacao e a confirmacao, a funcao faz
--    `raise exception`. Como a excecao desfaz a transacao inteira, nada fica
--    registrado: o dinheiro entrou, o acesso nao foi dado e nao aparece em
--    lugar nenhum. O webhook devolve 500, o Asaas reenvia, e cada reenvio
--    cai no mesmo buraco.
--
--    AGORA o conflito vira linha em cobranca_revisao — a mesma tabela que o
--    painel do dono ja le em "Cobrancas para conferir" — a cobranca fica
--    marcada como paga SEM aplicado_em, e a funcao devolve ok com
--    revisao=true. O Asaas para de reenviar e o dono ve o caso na tela.
--
--    Vale para os tres conflitos: assinatura mudou depois da cotacao, outro
--    plano ativo, e conflito na gravacao. Divergencia de checkout ou de
--    valor continua levantando excecao: aquilo nao e conflito de estado, e
--    sinal de chamada errada.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── 2. O QUE O CLIENTE REALMENTE PAGA ─────────────────────────────────────

alter table public.assinaturas
  add column if not exists valor_contratado numeric(10,2);

comment on column public.assinaturas.valor_contratado is
  'Preco que ESTE cliente paga pelo plano no ciclo dele. Pode diferir do catalogo depois de um reajuste. Nulo = use o catalogo.';

create or replace function public.assinatura_carimbar_valor()
returns trigger language plpgsql security definer set search_path='' as $$
declare v numeric;
begin
  if new.plano is null or new.ciclo is null then return new; end if;
  if new.ciclo not in ('mensal','semestral','anual') then return new; end if;

  -- Quem escreveu o valor nesta mesma operacao sabe o que foi cobrado.
  -- O gatilho so preenche o que ficou em branco.
  if TG_OP = 'UPDATE' and new.valor_contratado is distinct from old.valor_contratado then
    return new;
  end if;
  if TG_OP = 'INSERT' and new.valor_contratado is not null then
    return new;
  end if;

  -- Carimba quando o preco contratado pode ter mudado: plano novo, ciclo
  -- novo, ou vencimento que andou para a frente (renovacao).
  if TG_OP = 'UPDATE'
     and new.plano is not distinct from old.plano
     and new.ciclo is not distinct from old.ciclo
     and not (new.proximo_vencimento is not null
              and old.proximo_vencimento is not null
              and new.proximo_vencimento > old.proximo_vencimento) then
    return new;
  end if;

  select (to_jsonb(p) ->> new.ciclo)::numeric into v
    from public.planos p where p.chave = new.plano;
  if v is not null and v > 0 then
    new.valor_contratado := v;
  end if;
  return new;
end $$;

comment on function public.assinatura_carimbar_valor() is
  'Preenche assinaturas.valor_contratado a partir de public.planos. Fica num gatilho, e nao em cada caminho de codigo, para nao depender de ninguem lembrar.';

drop trigger if exists trg_assinatura_carimbar_valor on public.assinaturas;
create trigger trg_assinatura_carimbar_valor
  before insert or update on public.assinaturas
  for each row execute function public.assinatura_carimbar_valor();

-- Carga inicial: congela o preco de hoje para quem ja paga. Nao muda a conta
-- de ninguem agora; e o mesmo numero que ela ja usava.
update public.assinaturas a
   set valor_contratado = (to_jsonb(p) ->> a.ciclo)::numeric
  from public.planos p
 where p.chave = a.plano
   and a.valor_contratado is null
   and a.ciclo in ('mensal','semestral','anual')
   and a.plano <> 'gratis'
   and (to_jsonb(p) ->> a.ciclo) is not null;


-- ─── 1. A COTACAO VOLTA A FUNCIONAR PARA TODO MUNDO ────────────────────────

create or replace function public.cotar_troca_plano(p_plano text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  a public.assinaturas;
  origem public.planos;
  destino public.planos;
  hoje date := (now() at time zone 'America/Fortaleza')::date;
  dias int; duracao int; restantes int;
  atual numeric; novo numeric; valor numeric;
  base text;
begin
  select * into a from public.assinaturas where user_id = auth.uid();
  if not found or a.status <> 'ativo' or a.plano = 'gratis'
     or a.proximo_vencimento is null or a.proximo_vencimento <= hoje then
    raise exception 'Não há período vigente para compensar.';
  end if;

  select * into origem from public.planos where chave = a.plano;
  if origem.chave is null then
    raise exception 'O seu plano atual não está no catálogo. Fale com o atendimento.';
  end if;

  select * into destino from public.planos where chave = p_plano and ativo and permite_cartao;
  if destino.chave is null then
    raise exception 'Esse plano não está disponível para contratação agora.';
  end if;
  if destino.limite_viveiros <= origem.limite_viveiros then
    raise exception 'Escolha um plano com mais viveiros.';
  end if;

  if a.ciclo is null or a.ciclo not in ('mensal','semestral','anual') then
    raise exception 'O seu ciclo de cobrança não está definido. Fale com o atendimento.';
  end if;

  /* QUANTO DURA O PERÍODO QUE ELE JÁ PAGOU, pela melhor evidência que
     houver. A versão anterior só aceitava a primeira, e por isso recusava
     todo cliente de cartão e todo cliente liberado na mão. */
  select a.proximo_vencimento - c.inicio_periodo into duracao
    from public.cobrancas_pix c
   where c.user_id = a.user_id
     and c.validade_ate = a.proximo_vencimento
     and c.ciclo = a.ciclo
     and c.status = 'pago'
     and c.inicio_periodo is not null
   order by c.aplicado_em desc limit 1;
  if duracao is not null then base := 'pix'; end if;

  if duracao is null then
    select pc.validade - pc.inicio into duracao
      from public.periodos_cartao pc
     where pc.user_id = a.user_id
       and pc.validade = a.proximo_vencimento
     order by pc.inicio desc limit 1;
    if duracao is not null then base := 'cartao'; end if;
  end if;

  if duracao is null then
    duracao := a.proximo_vencimento - (a.proximo_vencimento - case a.ciclo
                 when 'mensal'    then interval '1 month'
                 when 'semestral' then interval '6 months'
                 when 'anual'     then interval '1 year'
               end)::date;
    base := 'ciclo';
  end if;

  if duracao is null or duracao <= 0 then
    raise exception 'Não consegui calcular o período já pago. Fale com o atendimento.';
  end if;

  -- O que ele paga hoje: o valor contratado, e só na falta dele o catálogo.
  atual := coalesce(a.valor_contratado, (to_jsonb(origem) ->> a.ciclo)::numeric);
  novo  := (to_jsonb(destino) ->> a.ciclo)::numeric;

  if atual is null or novo is null then
    raise exception 'O plano % não tem preço no ciclo %.', destino.nome, a.ciclo;
  end if;
  if atual <= 0 or novo <= atual then
    raise exception 'Essa troca não gera diferença a pagar. Fale com o atendimento.';
  end if;

  /* Nunca creditar mais do que um período inteiro: uma liberação manual
     longa (o dono às vezes dá 500 dias) tem vencimento muito à frente e,
     sem este limite, a conta devolveria dinheiro. */
  restantes := a.proximo_vencimento - hoje;
  dias := least(restantes, duracao);

  valor := round((novo - atual) * dias / duracao, 2);
  if valor <= 0 then
    raise exception 'A diferença ficou em zero. Fale com o atendimento.';
  end if;

  return jsonb_build_object(
    'valor', valor, 'dias', dias, 'duracao', duracao, 'base', base,
    'ciclo', a.ciclo, 'origem', a.plano, 'destino', p_plano,
    'validade', a.proximo_vencimento);
end $$;

revoke all on function public.cotar_troca_plano(text) from public, anon;
grant execute on function public.cotar_troca_plano(text) to authenticated;


-- ─── 3. PIX PAGO QUE NAO ATIVA VIRA PENDENCIA VISIVEL ──────────────────────

CREATE OR REPLACE FUNCTION public.confirmar_pagamento_pix(p_cobranca_id uuid, p_checkout_id text, p_valor numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_cobranca public.cobrancas_pix%ROWTYPE;
    v_assinatura public.assinaturas%ROWTYPE;
    v_validade date;
    v_inicio date;
    v_periodo interval;
    v_motivo text;
    v_preco numeric;
BEGIN
    SELECT * INTO v_cobranca FROM public.cobrancas_pix WHERE id = p_cobranca_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cobranca nao encontrada'; END IF;

    -- Divergencia de checkout ou de valor NAO e conflito de estado: e sinal
    -- de chamada errada. Continua levantando excecao, de proposito.
    IF p_checkout_id IS NULL OR v_cobranca.asaas_checkout_id IS DISTINCT FROM p_checkout_id THEN
        RAISE EXCEPTION 'Checkout divergente';
    END IF;
    IF p_valor IS DISTINCT FROM v_cobranca.valor THEN
        RAISE EXCEPTION 'Valor divergente';
    END IF;

    IF v_cobranca.aplicado_em IS NOT NULL THEN
        RETURN jsonb_build_object('ok', true, 'duplicado', true);
    END IF;
    IF v_cobranca.status NOT IN ('pendente', 'pago') THEN
        RAISE EXCEPTION 'Status de cobranca invalido';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_cobranca.user_id::text, 0));

    SELECT * INTO v_assinatura FROM public.assinaturas WHERE user_id = v_cobranca.user_id FOR UPDATE;

    -- IDs de checkout/recorrencia nao comprovam pagamento. Preserve-os para conciliacao.

    v_periodo := CASE v_cobranca.ciclo
        WHEN 'mensal' THEN interval '1 month'
        WHEN 'semestral' THEN interval '6 months'
        WHEN 'anual' THEN interval '1 year'
        ELSE NULL END;
    IF v_periodo IS NULL THEN RAISE EXCEPTION 'Ciclo invalido'; END IF;

    v_inicio := (now() AT TIME ZONE 'America/Fortaleza')::date;

    IF v_cobranca.finalidade = 'upgrade' THEN
      IF v_assinatura.status is distinct from 'ativo'
         or v_assinatura.plano is distinct from v_cobranca.plano_origem
         or v_assinatura.ciclo is distinct from v_cobranca.ciclo
         or v_assinatura.proximo_vencimento is distinct from v_cobranca.vencimento_origem THEN
        v_motivo := 'a assinatura mudou depois da cotacao (cotou '
                 || coalesce(v_cobranca.plano_origem,'?') || ' ate '
                 || coalesce(v_cobranca.vencimento_origem::text,'?')
                 || ', hoje esta ' || coalesce(v_assinatura.plano,'sem assinatura') || ' ate '
                 || coalesce(v_assinatura.proximo_vencimento::text,'?') || ')';
      ELSE
        v_validade := v_cobranca.vencimento_origem;
        -- O cliente passa a pagar o preco do plano de destino no ciclo dele.
        select (to_jsonb(p) ->> v_cobranca.ciclo)::numeric into v_preco
          from public.planos p where p.chave = v_cobranca.plano;
        update public.assinaturas
           set plano = v_cobranca.plano,
               limite_viveiros = v_cobranca.limite_viveiros,
               valor_contratado = coalesce(v_preco, valor_contratado),
               atualizado_em = now()
         where user_id = v_cobranca.user_id;
      END IF;
    ELSE
      IF v_assinatura.status = 'ativo'
         AND v_assinatura.plano <> 'gratis'
         AND v_assinatura.plano IS DISTINCT FROM v_cobranca.plano
         AND (v_assinatura.proximo_vencimento IS NULL
              OR v_assinatura.proximo_vencimento > v_inicio) THEN
        v_motivo := 'existe outro plano ativo (' || v_assinatura.plano
                 || ' ate ' || coalesce(v_assinatura.proximo_vencimento::text,'?') || ')';
      ELSE
        IF v_assinatura.status = 'ativo' AND v_assinatura.plano = v_cobranca.plano THEN
            v_inicio := greatest(v_inicio, v_assinatura.proximo_vencimento);
        END IF;
        v_validade := (v_inicio + v_periodo)::date;

        INSERT INTO public.assinaturas (
            user_id, plano, ciclo, status, limite_viveiros,
            proximo_vencimento, valor_contratado, atualizado_em)
        VALUES (
            v_cobranca.user_id, v_cobranca.plano, v_cobranca.ciclo, 'ativo',
            v_cobranca.limite_viveiros, v_validade, v_cobranca.valor, now())
        ON CONFLICT (user_id) DO UPDATE SET
            plano = EXCLUDED.plano,
            ciclo = EXCLUDED.ciclo,
            status = 'ativo',
            limite_viveiros = EXCLUDED.limite_viveiros,
            proximo_vencimento = EXCLUDED.proximo_vencimento,
            valor_contratado = EXCLUDED.valor_contratado,
            atualizado_em = now()
        WHERE assinaturas.status IS DISTINCT FROM 'ativo'
           OR assinaturas.plano IN ('gratis', EXCLUDED.plano)
           OR assinaturas.proximo_vencimento <= (now() AT TIME ZONE 'America/Fortaleza')::date;

        IF NOT FOUND THEN
            v_motivo := 'conflito com a assinatura existente ('
                     || coalesce(v_assinatura.plano,'?') || ', '
                     || coalesce(v_assinatura.status,'?') || ')';
        END IF;
      END IF;
    END IF;

    /* O DINHEIRO ENTROU MAS O ACESSO NAO PODE SER DADO.
       Antes isto era `raise exception`, e a excecao desfazia a transacao
       inteira: nao sobrava registro nenhum, o webhook devolvia 500 e o
       Asaas reenviava para sempre, caindo no mesmo buraco. Agora vira
       pendencia na tela do dono, e a cobranca fica paga SEM aplicado_em. */
    IF v_motivo IS NOT NULL THEN
        UPDATE public.cobrancas_pix
           SET status = 'pago', pago_em = coalesce(pago_em, now())
         WHERE id = p_cobranca_id;

        INSERT INTO public.cobranca_revisao (chave, evento, referencia)
        VALUES ('pix-sem-aplicar:' || p_cobranca_id::text,
                'PIX PAGO SEM ATIVAR',
                'R$ ' || to_char(v_cobranca.valor,'FM999999990.00')
                || ' · ' || v_cobranca.finalidade || ' ' || v_cobranca.plano
                || ' · ' || v_motivo
                || ' · checkout ' || coalesce(v_cobranca.asaas_checkout_id,'?'))
        ON CONFLICT (chave) DO NOTHING;

        RETURN jsonb_build_object('ok', true, 'revisao', true, 'motivo', v_motivo);
    END IF;

    UPDATE public.cobrancas_pix
    SET status = 'pago',
        pago_em = coalesce(pago_em, now()),
        aplicado_em = now(),
        inicio_periodo = case
            when v_cobranca.finalidade = 'renovacao' then v_inicio
            else v_cobranca.inicio_periodo end,
        validade_ate = v_validade
    WHERE id = p_cobranca_id;

    RETURN jsonb_build_object('ok', true, 'duplicado', false, 'validade_ate', v_validade);
END;
$function$;
