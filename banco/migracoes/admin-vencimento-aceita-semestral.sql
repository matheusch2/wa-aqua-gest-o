-- [ESTADO EM 24/11/2026: APLICADA]
--   Aplicada por migracao (admin_ajustar_vencimento_aceita_semestral) e
--   conferida lendo o prosrc: aceita os tres ciclos E mantem a guarda do
--   cliente bloqueado.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- O AJUSTE DE VENCIMENTO PASSA A ACEITAR 6 MESES
--
-- O plano semestral entrou no catalogo e o painel do dono passou a oferecer
-- "6 meses" ao ajustar o vencimento. Esta funcao recusava qualquer ciclo
-- fora de mensal/anual, entao o ajuste quebrava com CICLO_INVALIDO.
--
-- MUDA SO A LINHA DA VALIDACAO. O resto e identico de proposito: o
-- `case when status = 'cancelado'` e a correcao do furo de cobranca de
-- 23/11/2026 (remarcar a data de um cliente bloqueado o destravava sozinho)
-- e um CREATE OR REPLACE descuidado a perderia.
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
  -- So admin pode chamar
  if not exists (select 1 from perfis where user_id = auth.uid() and role = 'admin') then
    raise exception 'NAO_AUTORIZADO: apenas administradores podem ajustar vencimento';
  end if;
  if p_vencimento is null then
    raise exception 'DATA_INVALIDA: informe a data de vencimento';
  end if;
  if p_ciclo is not null and p_ciclo not in ('mensal','semestral','anual') then
    raise exception 'CICLO_INVALIDO: use mensal, semestral ou anual';
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
