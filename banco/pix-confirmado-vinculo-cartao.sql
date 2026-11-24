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
;
