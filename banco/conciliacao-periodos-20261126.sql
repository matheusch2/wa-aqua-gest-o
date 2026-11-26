create table public.cobranca_revisao(chave text primary key,evento text not null,referencia text,criado_em timestamptz default now(),resolvido_em timestamptz);
alter table public.cobranca_revisao enable row level security;
revoke all on public.cobranca_revisao from anon,authenticated;
grant select on public.cobranca_revisao to authenticated;
create policy leitura_adm on public.cobranca_revisao for select to authenticated using(exists(select 1 from public.perfis where user_id=auth.uid() and role='admin'));
grant select,insert,update on public.cobranca_revisao to service_role;
alter table public.cobrancas_pix add column inicio_periodo date;
update public.cobrancas_pix set inicio_periodo=(aplicado_em at time zone 'America/Fortaleza')::date where finalidade='renovacao' and status='pago' and validade_ate=((aplicado_em at time zone 'America/Fortaleza')::date+case ciclo when 'mensal' then interval '1 month' when 'anual' then interval '1 year' when 'semestral' then interval '6 months' end)::date;
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
        inicio_periodo = case when v_cobranca.finalidade = 'renovacao' then v_inicio else null end, validade_ate = v_validade
    WHERE id = p_cobranca_id;

    RETURN jsonb_build_object(
        'ok', true,
        'duplicado', false,
        'validade_ate', v_validade
    );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.cotar_troca_plano(p_plano text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a public.assinaturas; origem public.planos; destino public.planos; hoje date := (now() at time zone 'America/Fortaleza')::date; dias int; duracao int; atual numeric; novo numeric; valor numeric;
begin
 select * into a from public.assinaturas where user_id=auth.uid();
 if not found or a.status <> 'ativo' or a.plano='gratis' or a.proximo_vencimento is null or a.proximo_vencimento<=hoje then raise exception 'Não há período vigente para compensar.'; end if;
 select * into origem from public.planos where chave=a.plano;
 select * into destino from public.planos where chave=p_plano and ativo and permite_cartao;
 if destino.chave is null or origem.chave is null or destino.limite_viveiros<=origem.limite_viveiros then raise exception 'Escolha um plano com mais viveiros.'; end if;
 atual := (to_jsonb(origem)->>a.ciclo)::numeric; novo := (to_jsonb(destino)->>a.ciclo)::numeric;
 dias := a.proximo_vencimento-hoje;
 select a.proximo_vencimento-c.inicio_periodo into duracao from public.cobrancas_pix c where c.user_id=a.user_id and c.validade_ate=a.proximo_vencimento and c.ciclo=a.ciclo and c.status='pago' and c.inicio_periodo is not null order by c.aplicado_em desc limit 1;
 if duracao is null then raise exception 'Período original não confirmado. Solicite a troca ao atendimento.'; end if;
 if duracao is null or atual is null or novo is null or novo<=atual or atual<=0 then raise exception 'Não há preço disponível para essa troca.'; end if;
 valor:=round((novo-atual)*dias/duracao,2);
 return jsonb_build_object('valor',valor,'dias',dias,'ciclo',a.ciclo,'origem',a.plano,'destino',p_plano,'validade',a.proximo_vencimento);
end $function$
;

create table public.periodos_cartao(evento text primary key,user_id uuid not null,plano text not null, inicio date not null, validade date not null);
alter table public.periodos_cartao enable row level security;
revoke all on public.periodos_cartao from anon,authenticated;
grant select,insert,update on public.periodos_cartao to service_role;
create function public.admin_pagamentos_vigentes() returns table(user_id uuid) language sql stable security definer set search_path='' as $$
select a.user_id from public.assinaturas a where exists(select from public.perfis where user_id=auth.uid() and role='admin') and a.status='ativo' and a.proximo_vencimento >= (now() at time zone 'America/Fortaleza')::date and (exists(select from public.cobrancas_pix c where c.user_id=a.user_id and c.plano=a.plano and c.status='pago' and c.aplicado_em is not null and c.validade_ate >= (now() at time zone 'America/Fortaleza')::date) or exists(select from public.periodos_cartao c where c.user_id=a.user_id and c.plano=a.plano and c.validade>=(now() at time zone 'America/Fortaleza')::date)) $$;
revoke all on function public.admin_pagamentos_vigentes() from public,anon;grant execute on function public.admin_pagamentos_vigentes() to authenticated;