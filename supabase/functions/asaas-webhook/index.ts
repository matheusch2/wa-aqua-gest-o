/*
 * O AVISO DO ASAAS
 *
 * É aqui que o dinheiro vira acesso. O Asaas chama esta função quando algo
 * acontece com um Checkout, uma assinatura ou uma cobrança, e é só por aqui
 * que a assinatura do cliente muda de estado.
 *
 * NUNCA pela URL de retorno (`successUrl`). Aquilo só manda o navegador de
 * volta para o app: quem fechar a aba antes, ou digitar a URL na mão, teria
 * liberado o sistema sem pagar. A própria documentação do Asaas avisa para
 * não usar o callback como confirmação financeira.
 *
 * TRÊS FORMATOS DE AVISO, TRÊS CAIXAS DIFERENTES
 *   evento de Checkout   -> o corpo traz `checkout`
 *   evento de assinatura -> traz `subscription`
 *   evento de cobrança   -> traz `payment`
 *
 *   A versão anterior só olhava `payment`. Com o Checkout no ar ela
 *   receberia CHECKOUT_PAID, não acharia nada em `payment`, responderia
 *   "ignorado" e o cliente pagaria sem liberar o acesso.
 *
 * COMO SE ACHA O DONO DO PAGAMENTO, em ordem:
 *   1. `externalReference` — nós mandamos o id do usuário ao criar;
 *   2. o id do Checkout, que guardamos em asaas_checkout_id;
 *   3. o id da assinatura, em asaas_subscription_id.
 *   Três caminhos porque nem todo evento traz os três campos.
 *
 * REPETIÇÃO É ESPERADA. O Asaas reenvia o aviso quando não recebe 200, e a
 * documentação pede tratamento idempotente. Tudo aqui é "deixe nesse
 * estado", nunca "some mais um" — reenviar o mesmo aviso dez vezes dá no
 * mesmo que uma.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

/* Comparação que não entrega o tamanho nem o conteúdo pelo tempo de
   resposta. Exagero para um token de webhook? É barato, e o custo de
   errar aqui é alguém conseguir ativar a própria assinatura de graça. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

const ok = (corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const token = req.headers.get("asaas-access-token") ?? "";
  if (!WEBHOOK_TOKEN || !iguais(token, WEBHOOK_TOKEN)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response("Bad request", { status: 400 }); }

  const evento: string | undefined = body?.event;
  if (!evento) return ok({ ok: true, ignorado: "sem evento" });

  const checkout     = body?.checkout ?? null;
  const assinatura   = body?.subscription ?? null;
  const cobranca     = body?.payment ?? null;
  const caixa        = checkout ?? assinatura ?? cobranca ?? {};

  // De quem é isto?
  const userId: string | undefined =
    caixa?.externalReference ?? cobranca?.externalReference ?? undefined;
  const checkoutId: string | undefined = checkout?.id ?? undefined;
  const assinaturaId: string | undefined =
    assinatura?.id ?? cobranca?.subscription ?? undefined;

  /* O que cada evento faz com a assinatura do cliente. */
  const mudanca: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  let agir = false;

  if (evento === "CHECKOUT_PAID") {
    // O cartão passou. O Asaas cria a assinatura a partir daqui.
    mudanca.status = "ativo";
    mudanca.checkout_url = null;          // o link cumpriu o papel
    mudanca.checkout_expira_em = null;
    agir = true;

  } else if (evento === "CHECKOUT_CANCELED" || evento === "CHECKOUT_EXPIRED") {
    // Não mexe no status: quem já era assinante continua sendo. Só limpa o
    // link morto, para a tela oferecer um novo em vez de um que não abre.
    mudanca.checkout_url = null;
    mudanca.checkout_expira_em = null;
    agir = true;

  } else if (evento.startsWith("SUBSCRIPTION_")) {
    if (evento.includes("DELETED")) {
      mudanca.status = "cancelado";
    } else if (assinaturaId) {
      // SUBSCRIPTION_CREATED / UPDATED: guarda o id, que é por onde as
      // cobranças dos próximos meses vão ser reconhecidas.
      mudanca.asaas_subscription_id = assinaturaId;
    }
    agir = true;

  } else if (evento.startsWith("PAYMENT_CONFIRMED") || evento.startsWith("PAYMENT_RECEIVED")) {
    mudanca.status = "ativo";
    if (assinaturaId) mudanca.asaas_subscription_id = assinaturaId;
    agir = true;

  } else if (evento.startsWith("PAYMENT_OVERDUE") || evento === "PAYMENT_DELETED" || evento === "PAYMENT_REFUNDED") {
    mudanca.status = "pendente";
    agir = true;
  }

  if (!agir) return ok({ ok: true, ignorado: evento });

  // A data do próximo vencimento, quando o evento informa.
  const venc = cobranca?.dueDate ?? assinatura?.nextDueDate ?? checkout?.subscription?.nextDueDate;
  if (venc) mudanca.proximo_vencimento = String(venc).substring(0, 10);

  let consulta = supabase.from("assinaturas").update(mudanca);
  if (userId)            consulta = consulta.eq("user_id", userId);
  else if (checkoutId)   consulta = consulta.eq("asaas_checkout_id", checkoutId);
  else if (assinaturaId) consulta = consulta.eq("asaas_subscription_id", assinaturaId);
  else {
    console.error("Evento sem nenhuma referencia utilizavel:", evento, JSON.stringify(body).slice(0, 400));
    return ok({ ok: true, ignorado: "sem referencia" });
  }

  const { data, error } = await consulta.select("user_id");
  if (error) {
    // 500 de propósito: o Asaas reenvia, e é isso que queremos.
    console.error("Erro ao atualizar assinatura:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  if (!data || data.length === 0) {
    // Dinheiro que entrou e não achou dono. Responder 200 evita o Asaas
    // ficar reenviando para sempre, mas isto PRECISA aparecer no log.
    console.error("PAGAMENTO SEM DONO:", evento,
      "externalReference=", userId, "checkout=", checkoutId, "assinatura=", assinaturaId);
    return ok({ ok: true, aviso: "nenhuma assinatura encontrada" });
  }

  console.log("ok", evento, "->", JSON.stringify(mudanca), "para", data.length, "assinatura(s)");
  return ok({ ok: true, evento, atualizadas: data.length });
});
