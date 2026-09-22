-- ═══════════════════════════════════════════════════════════════════════════
-- WA Aqua Gestão — pagamento de boleto atômico (RPC)
--
-- O QUE FAZ
--   Registra um pagamento de boleto SOMANDO no próprio banco, com a linha do
--   boleto travada durante a operação. Hoje o app lê a lista de pagamentos no
--   celular, adiciona a parcela e regrava a lista INTEIRA — então, se dois
--   aparelhos pagam a partir do mesmo saldo, o segundo grava por cima do
--   primeiro e um pagamento some. Aqui os pagamentos concorrentes entram em
--   fila (FOR UPDATE) e cada um é somado — nada se perde.
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
--   drop function if exists public.pagar_boleto(uuid, numeric, date);
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.pagar_boleto(
  p_boleto uuid,
  p_valor  numeric,
  p_data   date
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid         uuid := auth.uid();
  v_valor       numeric;   -- valor total do boleto (pode ser NULL = sem total)
  v_pago_atual  numeric;   -- valor_pago atual (no banco, não no celular)
  v_pagamentos  jsonb;     -- lista atual de pagamentos [{data,valor}, ...]
  v_restante    numeric;
  v_pagar       numeric;
  v_novo_pago   numeric;
  v_quitou      boolean;
begin
  if v_uid is null then
    raise exception 'Não autenticado';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor de pagamento inválido';
  end if;

  -- Trava a linha do boleto: pagamentos concorrentes de outro aparelho esperam
  -- aqui e são somados um após o outro, em vez de um sobrescrever o outro.
  select valor, coalesce(valor_pago, 0), coalesce(pagamentos, '[]'::jsonb)
    into v_valor, v_pago_atual, v_pagamentos
    from public.boletos
   where id = p_boleto and user_id = v_uid
   for update;
  if not found then
    raise exception 'Boleto não encontrado';
  end if;

  v_pagar := round(p_valor, 2);

  -- Nunca paga mais que o restante — calculado com o saldo ATUAL do banco, então
  -- se outro aparelho já quitou parte, este pagamento não estoura o total.
  if v_valor is not null and v_valor > 0 then
    v_restante := round(v_valor - v_pago_atual, 2);
    if v_restante <= 0 then
      -- Já estava quitado quando esta chamada pegou a vez: nada a somar.
      return jsonb_build_object(
        'valor_pago', v_pago_atual,
        'pagamentos', v_pagamentos,
        'pago', true,
        'valor_pagou', 0,
        'ja_quitado', true
      );
    end if;
    if v_pagar > v_restante then
      v_pagar := v_restante;
    end if;
  end if;

  v_novo_pago  := round(v_pago_atual + v_pagar, 2);
  v_quitou     := (v_valor is not null and v_valor > 0 and v_novo_pago >= v_valor - 0.005);
  v_pagamentos := v_pagamentos || jsonb_build_array(
    jsonb_build_object('data', p_data, 'valor', v_pagar)
  );

  update public.boletos
     set valor_pago     = v_novo_pago,
         pagamentos     = v_pagamentos,
         pago           = case when v_quitou then true else pago end,
         data_pagamento = case when v_quitou then p_data else data_pagamento end
   where id = p_boleto and user_id = v_uid;

  return jsonb_build_object(
    'valor_pago',  v_novo_pago,
    'pagamentos',  v_pagamentos,
    'pago',        v_quitou,
    'valor_pagou', v_pagar,
    'ja_quitado',  false
  );
end;
$$;

grant execute on function public.pagar_boleto(uuid, numeric, date) to authenticated;
