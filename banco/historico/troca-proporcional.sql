-- [ESTADO EM 26/11/2026: SUPERADA — nao rode este arquivo]
--   O que esta aqui NAO e o que esta no banco. Conferido em 26/11/2026:
--   a versao publicada de cotar_troca_plano exigia uma cobranca Pix paga
--   com inicio_periodo, e este arquivo mostra uma versao que calcula a
--   duracao sozinha. As duas ja divergiam.
--
--   As correcoes aplicadas estao em `upgrade-proporcional-correcoes.sql`,
--   que substitui as DUAS funcoes daqui. Este arquivo fica so como
--   historico de como a troca proporcional nasceu.
--
--   Rodar este arquivo hoje seria um retrocesso: traria de volta a exigencia
--   do Pix e o `raise exception` que fazia o pagamento sumir.

create function public.cotar_troca_plano(p_plano text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.assinaturas; origem public.planos; destino public.planos; hoje date := (now() at time zone 'America/Fortaleza')::date; dias int; duracao int; atual numeric; novo numeric; valor numeric;
begin
 select * into a from public.assinaturas where user_id=auth.uid();
 if not found or a.status <> 'ativo' or a.plano='gratis' or a.proximo_vencimento is null or a.proximo_vencimento<=hoje then raise exception 'Não há período vigente para compensar.'; end if;
 select * into origem from public.planos where chave=a.plano;
 select * into destino from public.planos where chave=p_plano and ativo and permite_cartao;
 if destino.chave is null or origem.chave is null or destino.limite_viveiros<=origem.limite_viveiros then raise exception 'Escolha um plano com mais viveiros.'; end if;
 atual := (to_jsonb(origem)->>a.ciclo)::numeric; novo := (to_jsonb(destino)->>a.ciclo)::numeric;
 dias := a.proximo_vencimento-hoje;
 duracao := a.proximo_vencimento-(a.proximo_vencimento-case a.ciclo when 'mensal' then interval '1 month' when 'semestral' then interval '6 months' when 'anual' then interval '1 year' end)::date;
 if duracao is null or atual is null or novo is null or novo<=atual or atual<=0 then raise exception 'Não há preço disponível para essa troca.'; end if;
 valor:=round((novo-atual)*dias/duracao,2);
 return jsonb_build_object('valor',valor,'dias',dias,'ciclo',a.ciclo,'origem',a.plano,'destino',p_plano,'validade',a.proximo_vencimento);
end $$;
revoke all on function public.cotar_troca_plano(text) from public,anon;
grant execute on function public.cotar_troca_plano(text) to authenticated;
create unique index if not exists uq_pix_upgrade_pendente on public.cobrancas_pix(user_id) where finalidade='upgrade' and status='pendente';
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
BEGIN
    SELECT *
    INTO v_cobranca
    FROM public.cobrancas_pix
    WHERE id = p_cobranca_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cobranca nao encontrada';
    END IF;

    IF p_checkout_id IS NULL
       OR v_cobranca.asaas_checkout_id
          IS DISTINCT FROM p_checkout_id THEN
        RAISE EXCEPTION 'Checkout divergente';
    END IF;

    IF p_valor IS DISTINCT FROM v_cobranca.valor THEN
        RAISE EXCEPTION 'Valor divergente';
    END IF;

    IF v_cobranca.aplicado_em IS NOT NULL THEN
        RETURN jsonb_build_object(
            'ok', true,
            'duplicado', true
        );
    END IF;

    IF v_cobranca.status NOT IN ('pendente', 'pago') THEN
        RAISE EXCEPTION 'Status de cobranca invalido';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(v_cobranca.user_id::text, 0)
    );

    SELECT *
    INTO v_assinatura
    FROM public.assinaturas
    WHERE user_id = v_cobranca.user_id
    FOR UPDATE;

    -- IDs de checkout/recorrencia nao comprovam pagamento. Preserve-os para conciliacao.

    v_periodo := CASE v_cobranca.ciclo
        WHEN 'mensal' THEN interval '1 month'
        WHEN 'semestral' THEN interval '6 months'
        WHEN 'anual' THEN interval '1 year'
        ELSE NULL
    END;

    IF v_periodo IS NULL THEN
        RAISE EXCEPTION 'Ciclo invalido';
    END IF;

    v_inicio := (now() AT TIME ZONE 'America/Fortaleza')::date;

    IF v_cobranca.finalidade = 'upgrade' THEN
      IF v_assinatura.status is distinct from 'ativo' or v_assinatura.plano is distinct from v_cobranca.plano_origem or v_assinatura.ciclo is distinct from v_cobranca.ciclo or v_assinatura.proximo_vencimento is distinct from v_cobranca.vencimento_origem THEN
        raise exception 'A assinatura mudou após a cotação. Revisar o Pix antes de aplicar.';
      END IF;
      v_validade := v_cobranca.vencimento_origem;
      update public.assinaturas set plano=v_cobranca.plano,limite_viveiros=v_cobranca.limite_viveiros,atualizado_em=now() where user_id=v_cobranca.user_id;
    ELSE
    IF v_assinatura.status = 'ativo'
       AND v_assinatura.plano <> 'gratis'
       AND v_assinatura.plano IS DISTINCT FROM v_cobranca.plano
       AND (v_assinatura.proximo_vencimento IS NULL
            OR v_assinatura.proximo_vencimento > v_inicio) THEN
        RAISE EXCEPTION 'Existe outro plano ativo';
    END IF;

    IF v_assinatura.status = 'ativo'
       AND v_assinatura.plano = v_cobranca.plano THEN
        v_inicio := greatest(
            v_inicio,
            v_assinatura.proximo_vencimento
        );
    END IF;

    v_validade := (v_inicio + v_periodo)::date;

    INSERT INTO public.assinaturas (
        user_id,
        plano,
        ciclo,
        status,
        limite_viveiros,
        proximo_vencimento,
        atualizado_em
    )
    VALUES (
        v_cobranca.user_id,
        v_cobranca.plano,
        v_cobranca.ciclo,
        'ativo',
        v_cobranca.limite_viveiros,
        v_validade,
        now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        plano = EXCLUDED.plano,
        ciclo = EXCLUDED.ciclo,
        status = 'ativo',
        limite_viveiros = EXCLUDED.limite_viveiros,
        proximo_vencimento = EXCLUDED.proximo_vencimento,
        atualizado_em = now()
    WHERE assinaturas.status IS DISTINCT FROM 'ativo'
       OR assinaturas.plano IN ('gratis', EXCLUDED.plano)
       OR assinaturas.proximo_vencimento <= (now() AT TIME ZONE 'America/Fortaleza')::date;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conflito com assinatura existente';
    END IF;

    END IF;
    UPDATE public.cobrancas_pix
    SET
        status = 'pago',
        pago_em = coalesce(pago_em, now()),
        aplicado_em = now(),
        validade_ate = v_validade
    WHERE id = p_cobranca_id;

    RETURN jsonb_build_object(
        'ok', true,
        'duplicado', false,
        'validade_ate', v_validade
    );
END;
$function$
