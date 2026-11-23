import { createClient } from "jsr:@supabase/supabase-js@2";

const ASAAS_URL = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";
const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY")!;

const PLANOS: Record<string, { nome: string; limite: number; mensal: number; anual: number }> = {
  basico:        { nome: "Básico",        limite: 5,      mensal: 50,  anual: 500 },
  intermediario: { nome: "Intermediário", limite: 10,     mensal: 90,  anual: 900 },
  avancado:      { nome: "Avançado",      limite: 20,     mensal: 160, anual: 1600 },
  pro:           { nome: "Pro",           limite: 999999, mensal: 250, anual: 2500 },
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function asaas(path: string, method: string, body?: unknown) {
  const res = await fetch(`${ASAAS_URL}${path}`, {
    method,
    headers: { access_token: ASAAS_KEY, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Asaas ${res.status} ${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Metodo nao permitido", { status: 405, headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await supaUser.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Nao autenticado" }), { status: 401, headers: cors });
    const user = u.user;

    const { plano, ciclo, cpfCnpj } = await req.json();
    const cfg = PLANOS[plano];
    if (!cfg || (ciclo !== "mensal" && ciclo !== "anual")) {
      return new Response(JSON.stringify({ error: "Plano ou ciclo invalido" }), { status: 400, headers: cors });
    }
    const doc = String(cpfCnpj || "").replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14) {
      return new Response(JSON.stringify({ error: "CPF ou CNPJ invalido" }), { status: 400, headers: cors });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cliente (com CPF)
    const cliente = await asaas("/customers", "POST", {
      name: user.user_metadata?.nome ?? user.email,
      email: user.email,
      cpfCnpj: doc,
      externalReference: user.id,
    });
    const customerId = cliente.id as string;

    // COBRANCA DIRETA — ja retorna o link (invoiceUrl) na hora
    const value = ciclo === "anual" ? cfg.anual : cfg.mensal;
    const hoje = new Date().toISOString().split("T")[0];
    const pay = await asaas("/payments", "POST", {
      customer: customerId,
      billingType: "UNDEFINED",
      value,
      dueDate: hoje,
      description: `WA Aqua - Plano ${cfg.nome} (${ciclo})`,
      externalReference: user.id,
    });
    const invoiceUrl = pay?.invoiceUrl ?? null;

    // Grava no banco (upsert: cria se nao existir), checando o erro
    const { error: dbErr } = await admin.from("assinaturas").upsert({
      user_id: user.id,
      plano, ciclo, status: "pendente", limite_viveiros: cfg.limite,
      asaas_customer_id: customerId,
      checkout_url: invoiceUrl,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (dbErr) console.error("Erro upsert assinaturas:", dbErr);

    return new Response(JSON.stringify({ ok: true, invoiceUrl }), { status: 200, headers: cors });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500, headers: cors });
  }
});
