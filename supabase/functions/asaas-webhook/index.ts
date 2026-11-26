
/*
 * WA AQUA GESTAO
 * Webhook Asaas - Cartao recorrente e PIX avulso.
 *
 * A ativacao depende de notificacao autenticada do Asaas.
 * A URL de retorno nunca confirma pagamentos.
 *
 * PIX: cobrancas_pix + confirmar_pagamento_pix.
 * CARTAO: fluxo existente da tabela assinaturas.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_TOKEN =
  Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let dif = 0;

  for (let i = 0; i < a.length; i++) {
    dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return dif === 0;
}

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

const ok = (corpo: unknown) => resposta(corpo);

function falha(mensagem: string) {
  console.error("ASAAS WEBHOOK:", mensagem);

  return resposta({
    ok: false,
    error: mensagem,
  }, 500);
}

function uuidValido(valor: unknown): valor is string {
  return typeof valor === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      .test(valor);
}

// =====================================================
// LOCALIZACAO DA COBRANCA PIX
// =====================================================

async function localizarPix(
  checkout: any,
  cobranca: any,
) {
  const checkoutId =
    checkout?.id ??
    cobranca?.checkoutSession ??
    null;

  const referencia =
    checkout?.externalReference ??
    cobranca?.externalReference ??
    null;

  if (typeof checkoutId === "string" && checkoutId) {
    const { data, error } = await supabase
      .from("cobrancas_pix")
      .select("*")
      .eq("asaas_checkout_id", checkoutId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data;
  }

  if (uuidValido(referencia)) {
    const { data, error } = await supabase
      .from("cobrancas_pix")
      .select("*")
      .eq("id", referencia)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data;
  }

  if (typeof cobranca?.id === "string") {
    const { data, error } = await supabase
      .from("cobrancas_pix")
      .select("*")
      .eq("asaas_payment_id", cobranca.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data;
  }

  return null;
}

// =====================================================
// PROCESSAMENTO DO PIX
// =====================================================

async function processarPix(
  evento: string,
  pix: any,
  checkout: any,
  cobranca: any,
) {
  const checkoutId =
    checkout?.id ??
    cobranca?.checkoutSession ??
    null;

  if(!pix.asaas_checkout_id && checkout?.id && checkout.externalReference===pix.id && checkout.billingTypes?.includes("PIX")){
    const {data,error}=await supabase.from("cobrancas_pix").update({asaas_checkout_id:checkout.id}).eq("id",pix.id).is("asaas_checkout_id",null).select("asaas_checkout_id").maybeSingle();
    if(error||!data)return falha("Repetir conciliação do checkout Pix");
    pix.asaas_checkout_id=data.asaas_checkout_id;
  }
  if(pix.asaas_checkout_id){const {error}=await supabase.from("cobranca_revisao").update({resolvido_em:new Date().toISOString()}).eq("chave","checkout:"+pix.id).is("resolvido_em",null);if(error)return falha(error.message)}
  if (!pix.asaas_checkout_id) {
    return falha("PIX: checkout ainda nao registrado");
  }

  if (
    typeof checkoutId === "string" &&
    checkoutId !== pix.asaas_checkout_id
  ) {
    return falha("PIX: checkout divergente");
  }

  if (
    cobranca?.id &&
    pix.asaas_payment_id &&
    cobranca.id !== pix.asaas_payment_id
  ) {
    return falha("PIX: pagamento divergente");
  }

  // Estornos exigem conciliacao administrativa.
  // Nao cancelar automaticamente um plano posterior.

  if (evento === "PAYMENT_REFUNDED") {
    const { error } = await supabase
      .from("cobrancas_pix")
      .update({ status: "estornado" })
      .eq("id", pix.id);

    if (error) return falha(error.message);

    console.error("PIX ESTORNADO - REVISAR ACESSO", pix.id);

    return ok({
      ok: true,
      metodo: "pix",
      status: "estornado",
      revisao_manual: true,
    });
  }

  // Cancelamento e expiracao nao alteram
  // uma assinatura anteriormente paga.

  if (
    evento === "CHECKOUT_CANCELED" ||
    evento === "CHECKOUT_EXPIRED" ||
    evento === "PAYMENT_DELETED" ||
    evento === "PAYMENT_OVERDUE"
  ) {
    const status =
      evento === "CHECKOUT_EXPIRED" ||
      evento === "PAYMENT_OVERDUE"
        ? "expirado"
        : "cancelado";

    const { error } = await supabase
      .from("cobrancas_pix")
      .update({ status })
      .eq("id", pix.id)
      .eq("status", "pendente")
      .is("aplicado_em", null);

    if (error) return falha(error.message);

    return ok({
      ok: true,
      metodo: "pix",
      evento,
    });
  }

  const checkoutPago = evento === "CHECKOUT_PAID";

  const pagamentoConfirmado =
    evento === "PAYMENT_RECEIVED" ||
    evento === "PAYMENT_CONFIRMED";

  if (!checkoutPago && !pagamentoConfirmado) {
    return ok({
      ok: true,
      metodo: "pix",
      ignorado: evento,
    });
  }

  if (pix.status === "estornado") {
    return ok({
      ok: true,
      metodo: "pix",
      ignorado: "cobranca estornada",
    });
  }

  let valorPago: number;

  if (checkoutPago) {
    if (checkout?.id !== pix.asaas_checkout_id) {
      return falha("PIX: checkout pago nao identificado");
    }

    if (checkout?.status && checkout.status !== "PAID") {
      return falha("PIX: checkout sem status pago");
    }

    if (
      Array.isArray(checkout?.billingTypes) &&
      !checkout.billingTypes.includes("PIX")
    ) {
      return falha("PIX: modalidade divergente");
    }

    // Checkout criado pelo nosso backend
    // com valor fixado no banco.

    valorPago = Number(pix.valor);

    // Quando o Asaas informar os itens,
    // conferir o valor total do checkout.

    if (
      Array.isArray(checkout?.items) &&
      checkout.items.length > 0
    ) {
      const total = checkout.items.reduce(
        (soma: number, item: any) =>
          soma +
          Number(item.value) *
          Number(item.quantity ?? 1),
        0,
      );

      if (
        !Number.isFinite(total) ||
        Math.round(total * 100) !==
          Math.round(valorPago * 100)
      ) {
        return falha("PIX: valor dos itens divergente");
      }
    }

  } else {
    if (cobranca?.billingType !== "PIX") {
      return falha("PIX: pagamento com modalidade divergente");
    }

    if (
      cobranca?.status !== "RECEIVED" &&
      cobranca?.status !== "CONFIRMED"
    ) {
      return falha("PIX: pagamento nao confirmado");
    }

    valorPago = Number(cobranca.value);

    if (
      !Number.isFinite(valorPago) ||
      valorPago <= 0 ||
      Math.round(valorPago * 100) !==
        Math.round(Number(pix.valor) * 100)
    ) {
      return falha("PIX: valor do pagamento divergente");
    }

    if (typeof cobranca?.id !== "string") {
      return falha("PIX: pagamento sem identificador");
    }

    // Registrar o ID financeiro para conciliacao.

    let registro = supabase
      .from("cobrancas_pix")
      .update({
        asaas_payment_id: cobranca.id,
      })
      .eq("id", pix.id);

    if (pix.asaas_payment_id) {
      registro = registro.eq(
        "asaas_payment_id",
        cobranca.id,
      );
    } else {
      registro = registro.is(
        "asaas_payment_id",
        null,
      );
    }

    const { data, error } = await registro
      .select("id")
      .maybeSingle();

    if (error) return falha(error.message);

    if (!data) {
      return falha("PIX: conflito no registro do pagamento");
    }
  }

  // A funcao SQL realiza a ativacao em uma
  // unica transacao e impede duplicidade.

  const { data, error } = await supabase.rpc(
    "confirmar_pagamento_pix",
    {
      p_cobranca_id: pix.id,
      p_checkout_id: pix.asaas_checkout_id,
      p_valor: valorPago,
    },
  );

  if (error) {
    console.error(
      "PIX PAGO COM ERRO DE ATIVACAO",
      pix.id,
      error.message,
    );

    return falha(error.message);
  }

  console.log(
    "PIX PROCESSADO",
    pix.id,
    JSON.stringify(data),
  );

  return ok({
    ok: true,
    metodo: "pix",
    evento,
    resultado: data,
  });
}

// =====================================================
// RECEBIMENTO E AUTENTICACAO DO WEBHOOK
// =====================================================

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
    });
  }

  const token =
    req.headers.get("asaas-access-token") ?? "";

  if (!WEBHOOK_TOKEN || !iguais(token, WEBHOOK_TOKEN)) {
    return new Response("Unauthorized", {
      status: 401,
    });
  }

  let body: any;

  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", {
      status: 400,
    });
  }

  const evento = body?.event;

  if (typeof evento !== "string" || !evento) {
    return ok({
      ok: true,
      ignorado: "sem evento",
    });
  }

  const checkout = body?.checkout ?? null;
  const assinatura = body?.subscription ?? null;
  const cobranca = body?.payment ?? null;

  const caixa =
    checkout ??
    assinatura ??
    cobranca ??
    {};

  try {
    // PIX possui um fluxo independente.
    // Nunca deve cair no processamento do cartao.

    if (checkout || cobranca) {
      const pix = await localizarPix(
        checkout,
        cobranca,
      );

      if (pix) {
        return await processarPix(
          evento,
          pix,
          checkout,
          cobranca,
        );
      }
    }

    // =================================================
    // FLUXO ORIGINAL DO CARTAO
    // =================================================

    const userId: string | undefined =
      caixa?.externalReference ??
      cobranca?.externalReference ??
      undefined;

    const checkoutId: string | undefined =
      checkout?.id ??
      undefined;

    const assinaturaId: string | undefined =
      assinatura?.id ??
      cobranca?.subscription ??
      undefined;

    const mudanca: Record<string, unknown> = {
      atualizado_em: new Date().toISOString(),
    };

    let agir = false;
    let pago = false;

    if (evento === "CHECKOUT_PAID") {
      mudanca.status = "ativo";
      mudanca.checkout_url = null;
      mudanca.checkout_expira_em = null;

      agir = true;
      pago = true;

    } else if (
      evento === "CHECKOUT_CANCELED" ||
      evento === "CHECKOUT_EXPIRED"
    ) {
      mudanca.checkout_url = null;
      mudanca.checkout_expira_em = null;

      agir = true;

    } else if (evento.startsWith("SUBSCRIPTION_")) {
      if (evento.includes("DELETED")) {
        mudanca.status = "cancelado";

      } else if (assinaturaId) {
        mudanca.asaas_subscription_id = assinaturaId;
      }

      agir = true;

    } else if (
      evento === "PAYMENT_CONFIRMED" ||
      evento === "PAYMENT_RECEIVED"
    ) {
      mudanca.status = "ativo";

      if (assinaturaId) {
        mudanca.asaas_subscription_id = assinaturaId;
      }

      agir = true;
      pago = true;

    } else if (
      evento === "PAYMENT_OVERDUE" ||
      evento === "PAYMENT_DELETED" ||
      evento === "PAYMENT_REFUNDED"
    ) {
      mudanca.status = "pendente";

      agir = true;
    }

    if (!agir) {
      return ok({
        ok: true,
        ignorado: evento,
      });
    }

    const chave=String(body.id || evento+":"+String(cobranca?.id || checkoutId || assinaturaId || userId));
    async function revisar(motivo:string){
      const {error}=await supabase.from("cobranca_revisao").upsert({chave,evento,referencia:String(cobranca?.id || checkoutId || assinaturaId || ""),resolvido_em:null},{onConflict:"chave"});
      return falha(error?.message || motivo);
    }
    const filtrar = <T>(q: T): T | null => {
      const c = q as unknown as {
        eq: (col: string, v: string) => T;
      };

      if (uuidValido(userId)) {
        return c.eq("user_id", userId);
      }

      if (checkoutId) {
        return c.eq("asaas_checkout_id", checkoutId);
      }

      if (assinaturaId) {
        return c.eq(
          "asaas_subscription_id",
          assinaturaId,
        );
      }

      return null;
    };

    if (
      !filtrar(
        supabase.from("assinaturas").select("user_id"),
      )
    ) {
      console.error(
        "Evento sem referencia utilizavel",
        evento,
      );

      if(pago)return revisar("Pagamento sem referência");
      return ok({
        ok: true,
        ignorado: "sem referencia",
      });
    }

    let comprovante:any=null;
    let anterior: string|null=null;
    if (pago) {
      const { data: atual, error: erroLer } =
        await filtrar(
          supabase
            .from("assinaturas")
            .select("user_id, plano, ciclo, plano_checkout, ciclo_checkout, proximo_vencimento,asaas_subscription_id"),
        )!.maybeSingle();

      if (erroLer) {
        return falha(erroLer.message);
      }

      if(!atual || (cobranca?.billingType==="PIX") || (assinaturaId && atual.asaas_subscription_id && assinaturaId!==atual.asaas_subscription_id))return revisar("Pagamento sem vínculo confirmado");
      anterior=atual.proximo_vencimento;
      if(cobranca?.dueDate && assinaturaId){
        const ciclo=atual.ciclo_checkout||atual.ciclo;
        const meses=({mensal:1,semestral:6,anual:12} as Record<string,number>)[ciclo];
        if(!meses || !/^\d{4}-\d{2}-\d{2}$/.test(cobranca.dueDate))return revisar("Ciclo ou data não identificado");
        const d=new Date(cobranca.dueDate+"T12:00:00Z"),dia=d.getUTCDate();
        d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+meses);
        const fim=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
        d.setUTCDate(Math.min(dia,fim));const ate=d.toISOString().slice(0,10);
        comprovante={evento:cobranca.id,user_id:atual.user_id,plano:atual.plano_checkout||atual.plano,inicio:cobranca.dueDate,validade:ate};
        if(!anterior||ate>anterior)mudanca.proximo_vencimento=ate;
      }
      const escolhido = atual?.plano_checkout;

      if (escolhido) {
        const { data: plano, error: erroPlano } =
          await supabase
            .from("planos")
            .select("chave, limite_viveiros")
            .eq("chave", escolhido)
            .maybeSingle();

        if (erroPlano) {
          return falha(erroPlano.message);
        }

        if (!plano) {
          return revisar("Plano comprado não encontrado");

        } else {
          mudanca.plano = plano.chave;
          mudanca.limite_viveiros =
            plano.limite_viveiros;

          if (atual?.ciclo_checkout) {
            mudanca.ciclo = atual.ciclo_checkout;
          }

          mudanca.plano_checkout = null;
          mudanca.ciclo_checkout = null;
        }
      }
    }

    let update=filtrar(
      supabase
        .from("assinaturas")
        .update(mudanca),
    )!;
    if(mudanca.proximo_vencimento)update=anterior?update.eq("proximo_vencimento",anterior):update.is("proximo_vencimento",null);
    const {data,error}=await update.select("user_id");

    if (error) {
      return falha(error.message);
    }

    if (!data || data.length === 0) {
      console.error(
        "PAGAMENTO SEM DONO",
        evento,
        userId,
        checkoutId,
        assinaturaId,
      );

      if(pago)return revisar("Pagamento sem assinatura correspondente ou atualização concorrente");
      return ok({
        ok: true,
        aviso: "nenhuma assinatura encontrada",
      });
    }

    if(comprovante){const {error}=await supabase.from("periodos_cartao").upsert(comprovante,{onConflict:"evento",ignoreDuplicates:true});if(error)return falha(error.message)}
    if(pago){const {error}=await supabase.from("cobranca_revisao").update({resolvido_em:new Date().toISOString()}).eq("chave",chave).is("resolvido_em",null);if(error)return falha(error.message)}
    console.log(
      "ASSINATURA PROCESSADA",
      evento,
      data.length,
    );

    return ok({
      ok: true,
      evento,
      atualizadas: data.length,
    });

  } catch (erro) {
    return falha(
      erro instanceof Error
        ? erro.message
        : String(erro),
    );
  }
});
