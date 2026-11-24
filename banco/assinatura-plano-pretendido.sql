-- [ESTADO EM 24/11/2026: APLICADA]
--   Aplicada por migracao (assinatura_plano_pretendido_no_checkout) e
--   conferida: as colunas plano_checkout e ciclo_checkout existem em
--   public.assinaturas.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- O QUE O CLIENTE ESCOLHEU x O QUE O CLIENTE TEM
--
-- PROBLEMA (estava no ar por algumas horas, em 24/11/2026)
--   A funcao assinar-cartao gravava plano e limite_viveiros na assinatura
--   no momento de ABRIR o checkout — antes de qualquer pagamento. Entao:
--
--     um cliente no Pro toca em "Assinar no cartao" do Basico so para ver
--     o preco, olha a pagina do Asaas e fecha  ->  na mesma hora ele esta
--     no Basico, com 5 viveiros, sem ter pago nada.
--
--   No outro sentido era pior: abrir o checkout do Pro ja dava o Pro.
--
-- O QUE MUDA
--   O checkout escreve a escolha em plano_checkout/ciclo_checkout. Quem
--   move isso para plano/ciclo/limite_viveiros e o webhook, e so quando o
--   dinheiro entra (CHECKOUT_PAID, PAYMENT_CONFIRMED, PAYMENT_RECEIVED).
--   Depois de usada, a escolha e zerada — assim um pagamento do mes
--   seguinte nao reaplica uma escolha velha por cima de uma liberacao
--   manual.
--
-- NAO TOCA EM NADA QUE EXISTE: so acrescenta duas colunas nulas.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.assinaturas
  add column if not exists plano_checkout text,
  add column if not exists ciclo_checkout text;

comment on column public.assinaturas.plano_checkout is
  'Plano escolhido no ultimo checkout aberto. NAO e o plano em vigor: so vira plano quando o webhook confirma o pagamento.';
comment on column public.assinaturas.ciclo_checkout is
  'Ciclo escolhido no ultimo checkout aberto (mensal, semestral, anual).';
