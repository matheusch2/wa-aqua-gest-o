import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const token = req.headers.get("asaas-access-token") ?? "";
  if (!WEBHOOK_TOKEN || token !== WEBHOOK_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const event = body?.event as string | undefined;
  const payment = body?.payment ?? {};
  const userId = payment?.externalReference as string | undefined;
  const subscriptionId = payment?.subscription as string | undefined;

  if (!event) {
    return new Response(JSON.stringify({ ok: true, ignored: "sem evento" }), { status: 200 });
  }

  let novoStatus: string | null = null;
  if (event.startsWith("PAYMENT_CONFIRMED") || event.startsWith("PAYMENT_RECEIVED")) {
    novoStatus = "ativo";
  } else if (event.startsWith("PAYMENT_OVERDUE") || event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
    novoStatus = "pendente";
  } else if (event.startsWith("SUBSCRIPTION_") && event.includes("DELETED")) {
    novoStatus = "cancelado";
  }

  if (!novoStatus) {
    return new Response(JSON.stringify({ ok: true, ignored: event }), { status: 200 });
  }

  const update: Record<string, unknown> = {
    status: novoStatus,
    atualizado_em: new Date().toISOString(),
  };
  if (payment?.dueDate) update["proximo_vencimento"] = payment.dueDate;

  let query = supabase.from("assinaturas").update(update);
  if (userId) query = query.eq("user_id", userId);
  else if (subscriptionId) query = query.eq("asaas_subscription_id", subscriptionId);
  else return new Response(JSON.stringify({ ok: true, ignored: "sem referencia" }), { status: 200 });

  const { error } = await query;
  if (error) {
    console.error("Erro ao atualizar assinatura:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, event, status: novoStatus }), { status: 200 });
});
