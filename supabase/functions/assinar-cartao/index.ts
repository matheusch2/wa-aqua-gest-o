/*
 * ASSINATURA NO CARTÃO, COBRADA SOZINHA TODO CICLO
 *
 * Esta função devolve um LINK. O cliente abre o link, digita o cartão na
 * página do Asaas e pronto: o Asaas cria a assinatura e passa a descontar
 * no cartão a cada ciclo, sem ninguém cobrar na mão.
 *
 * POR QUE O LINK E NÃO UM FORMULÁRIO NOSSO
 *   O número do cartão nunca passa por aqui nem pela tela do app. Quem
 *   recebe o cartão é o Asaas, na página dele. Isso não é só comodidade:
 *   é a diferença entre o questionário de segurança SAQ-A e o SAQ-D, e o
 *   segundo é um projeto inteiro de conformidade. Um formulário nosso
 *   também significaria responder por vazamento de cartão.
 *
 * O QUE SUBSTITUI
 *   A `criar-assinatura` criava uma COBRANÇA AVULSA (POST /payments). O
 *   cliente pagava uma vez e no mês seguinte alguém tinha de gerar outra
 *   na mão — que é exatamente a dor de hoje. Aqui é
 *   POST /v3/checkouts com chargeTypes RECURRENT, que cria ASSINATURA.
 *
 * O ERRO QUE DERRUBOU A TENTATIVA ANTERIOR
 *   A função antiga aponta para "https://sandbox.asaas.com/api/v3". Não é
 *   esse o endereço. A documentação do Asaas diz:
 *       Sandbox   https://api-sandbox.asaas.com/v3
 *       Produção  https://api.asaas.com/v3
 *
 * SEM PADRÃO SILENCIOSO — DE PROPÓSITO
 *   A função antiga caía em sandbox sozinha quando o segredo faltava, e
 *   por isso o sistema passou meses "cobrando" dinheiro que não existia:
 *   todos os links gerados eram de sandbox e ninguém percebeu. Aqui, sem
 *   ASAAS_API_URL e ASAAS_API_KEY a função RECUSA e diz o que falta. É
 *   melhor a tela dar erro na hora do que o dono descobrir meses depois.
 *
 * SEGREDOS (Supabase → Edge Functions → Secrets)
 *   ASAAS_API_URL   https://api-sandbox.asaas.com/v3  (teste)
 *                   https://api.asaas.com/v3          (produção)
 *   ASAAS_API_KEY   a chave daquele ambiente. São chaves diferentes: a de
 *                   sandbox não funciona em produção e vice-versa.
 *   APP_URL         para onde o cliente volta depois de pagar.
 *
 *   ATENÇÃO: segredo novo só vale depois de REPUBLICAR a função. Salvar e
 *   não republicar deixa o valor antigo rodando, e o erro que aparece não
 *   fala de segredo. Isso já custou tempo neste projeto antes.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const ASAAS_URL = Deno.env.get("ASAAS_API_URL") ?? "";
const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const APP_URL   = Deno.env.get("APP_URL") ?? "https://waaqua.com.br";

/* Os planos. Valores em reais; o Asaas recebe número, não texto. */
const PLANOS: Record<string, { nome: string; limite: number; mensal: number; anual: number }> = {
  basico:        { nome: "Básico",        limite: 5,      mensal: 50,  anual: 500 },
  intermediario: { nome: "Intermediário", limite: 10,     mensal: 90,  anual: 900 },
  avancado:      { nome: "Avançado",      limite: 20,     mensal: 160, anual: 1600 },
  pro:           { nome: "Pro",           limite: 999999, mensal: 250, anual: 2500 },
};

/* MONTHLY e YEARLY são os nomes do Asaas; "mensal"/"anual" são os nossos. */
const CICLO_ASAAS: Record<string, string> = { mensal: "MONTHLY", anual: "YEARLY" };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const responde = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors, "content-type": "application/json" } });

async function asaas(caminho: string, metodo: string, corpo?: unknown) {
  const res = await fetch(`${ASAAS_URL}${caminho}`, {
    method: metodo,
    headers: { access_token: ASAAS_KEY, "content-type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
    // A documentação do Asaas pede no mínimo 60s e avisa para NÃO repetir
    // sozinho depois de um timeout: repetir cria assinatura duplicada.
    signal: AbortSignal.timeout(60_000),
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = dados?.errors?.[0]?.description ?? JSON.stringify(dados);
    throw new Error(`Asaas ${res.status} ${metodo} ${caminho}: ${msg}`);
  }
  return dados;
}

/* "2027-01-31 15:02:38" — o formato que o Asaas espera em nextDueDate. */
function quandoComeca(diasAFrente = 0): string {
  const d = new Date(Date.now() + diasAFrente * 86400000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
         `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responde({ error: "Metodo nao permitido" }, 405);

  // Antes de qualquer coisa: a função está configurada? Falhar aqui, alto,
  // é o ponto principal desta reescrita.
  if (!ASAAS_URL || !ASAAS_KEY) {
    console.error("Faltando ASAAS_API_URL e/ou ASAAS_API_KEY nos segredos.");
    return responde({ error: "Pagamento não configurado. Avise o suporte." }, 503);
  }
  if (!/^https:\/\/api(-sandbox)?\.asaas\.com\/v3$/.test(ASAAS_URL)) {
    // Endereço fora do padrão é o erro de 2026: parecia sandbox e não era
    // nem sandbox. Melhor recusar do que cobrar no lugar errado.
    console.error("ASAAS_API_URL fora do esperado:", ASAAS_URL);
    return responde({ error: "Pagamento mal configurado. Avise o suporte." }, 503);
  }

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supaUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await supaUser.auth.getUser();
    if (!u?.user) return responde({ error: "Nao autenticado" }, 401);
    const user = u.user;

    const { plano, ciclo, cpfCnpj, nome, telefone } = await req.json().catch(() => ({}));
    const cfg = PLANOS[plano];
    const cicloAsaas = CICLO_ASAAS[ciclo];
    if (!cfg || !cicloAsaas) return responde({ error: "Plano ou ciclo invalido" }, 400);

    const doc = String(cpfCnpj || "").replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14) return responde({ error: "CPF ou CNPJ invalido" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const valor = ciclo === "anual" ? cfg.anual : cfg.mensal;
    const minutosAteExpirar = 60;   // o Asaas aceita de 10 a 1440

    /* O CHECKOUT.
     *
     * billingTypes CREDIT_CARD e chargeTypes RECURRENT: cartão, recorrente.
     * O objeto `subscription` é obrigatório quando há RECURRENT.
     *
     * Sem `endDate` de propósito: assinatura que acaba sozinha numa data é
     * assinatura que para de pagar sem ninguém pedir. Quem encerra é o
     * cliente ou nós, pela API.
     *
     * `externalReference` leva o id do usuário, e é por ele que o webhook
     * encontra de quem é o pagamento.
     */
    const checkout = await asaas("/checkouts", "POST", {
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: minutosAteExpirar,
      externalReference: user.id,
      callback: {
        successUrl: `${APP_URL}/app/index.html?assinatura=ok`,
        cancelUrl:  `${APP_URL}/app/index.html?assinatura=cancelada`,
        expiredUrl: `${APP_URL}/app/index.html?assinatura=expirada`,
      },
      items: [{
        name: `WA Aqua Gestão — Plano ${cfg.nome}`,
        description: ciclo === "anual" ? "Assinatura anual" : "Assinatura mensal",
        quantity: 1,
        value: valor,
      }],
      subscription: {
        cycle: cicloAsaas,
        nextDueDate: quandoComeca(0),   // primeira cobrança hoje
      },
      // Os dados que já temos vão preenchidos; o cartão, não — esse o
      // cliente digita na página do Asaas, e é o ponto de tudo isto.
      customerData: {
        name: String(nome || user.user_metadata?.nome || user.email || "").slice(0, 100),
        cpfCnpj: doc,
        email: user.email,
        ...(telefone ? { phone: String(telefone).replace(/\D/g, "") } : {}),
      },
    });

    const id = checkout?.id as string | undefined;
    if (!id) throw new Error("O Asaas nao devolveu o id do checkout");

    // A URL é montada com o id — o Asaas não devolve o link pronto.
    const link = `https://asaas.com/checkoutSession/show?id=${id}`;
    const expira = new Date(Date.now() + minutosAteExpirar * 60000).toISOString();

    /* Guarda ANTES de devolver o link. Se gravar depois e a gravação
     * falhar, o cliente paga e nós não sabemos de quem é. */
    const { error: erroBanco } = await admin.from("assinaturas").upsert({
      user_id: user.id,
      plano,
      ciclo,
      // NÃO mexe no status aqui. Quem ativa é o webhook, quando o dinheiro
      // entra. Marcar "ativo" ao gerar o link liberaria o sistema para quem
      // só abriu a página e fechou.
      limite_viveiros: cfg.limite,
      asaas_checkout_id: id,
      checkout_url: link,
      checkout_expira_em: expira,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (erroBanco) {
      console.error("Nao consegui guardar o checkout:", erroBanco);
      return responde({ error: "Nao consegui registrar a assinatura. Tente de novo." }, 500);
    }

    return responde({ ok: true, url: link, expiraEm: expira });
  } catch (e) {
    console.error(e);
    return responde({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
