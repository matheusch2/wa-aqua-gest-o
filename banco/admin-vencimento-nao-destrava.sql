-- ═══════════════════════════════════════════════════════════════════════════
-- WA Aqua Gestão — ajustar vencimento NÃO pode destravar cliente bloqueado
--
-- PROBLEMA
--   admin_ajustar_vencimento grava status = 'ativo' sempre. Então bloquear um
--   cliente e, depois, mexer na data dele o destrava sozinho — sem ninguém
--   mandar destravar. Enquanto o bloqueio não funcionava direito isso passava
--   batido; agora que funciona, vira um furo de cobrança.
--
-- O QUE MUDA
--   Uma linha. O status só vira 'ativo' quando a assinatura está 'pendente'
--   (vencida esperando pagamento) — remarcar a data nesse caso é mesmo um
--   acerto de prazo. Quem está 'cancelado' (bloqueado de propósito) continua
--   bloqueado, e só o botão Reativar / Registrar pagamento solta.
--
-- O RESTO DA FUNÇÃO É IGUAL. A data continua sendo gravada exatamente como
-- escolhida — isso já estava certo.
--
-- COMO RODAR
--   Supabase → SQL Editor → cole e Run. Substitui a função existente.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_ajustar_vencimento(p_user uuid, p_vencimento date, p_ciclo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row assinaturas;
begin
  -- Só admin pode chamar
  if not exists (select 1 from perfis where user_id = auth.uid() and role = 'admin') then
    raise exception 'NAO_AUTORIZADO: apenas administradores podem ajustar vencimento';
  end if;
  if p_vencimento is null then
    raise exception 'DATA_INVALIDA: informe a data de vencimento';
  end if;
  if p_ciclo is not null and p_ciclo not in ('mensal','anual') then
    raise exception 'CICLO_INVALIDO: use mensal ou anual';
  end if;

  update assinaturas
     set proximo_vencimento = p_vencimento,
         ciclo              = coalesce(p_ciclo, ciclo),
         -- Antes era status = 'ativo' sempre, e remarcar a data de um cliente
         -- bloqueado o destravava sem querer. Cancelado continua cancelado.
         status             = case when status = 'cancelado' then status else 'ativo' end,
         atualizado_em      = now()
   where user_id = p_user
   returning * into v_row;

  if not found then
    raise exception 'NAO_ENCONTRADO: nao existe assinatura para esse usuario';
  end if;

  return to_jsonb(v_row);
end;
$function$;
