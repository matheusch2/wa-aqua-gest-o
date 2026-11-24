/*
 * ASSINATURA NO CARTÃO, COBRADA SOZINHA TODO CICLO
 *
 * Esta função devolve um LINK. O cliente abre o link, digita o cartão na
 * página do Asaas e pronto: o Asaas cria a assinatura e passa a descontar
 * no cartão a cada ciclo, sem ninguém cobrar na mão.
 *
 * POR QUE O LINK E NÃO UM FORMULÁRIO NOSSO
 *   O número do cartão nunca passa por aqui nem pela tela do app. Quem
 *   recebe o cartão é o Asaas, na página dele. Isso é a diferença entre o
 *   questionário de segurança SAQ-A e o SAQ-D, e o segundo é um projeto
 *   inteiro de conformidade.
 *
 * O PREÇO VEM DO BANCO, NUNCA DAQUI
 *   Esta função já teve a tabela de preços escrita no próprio código. Deu no
 *   que tinha de dar: em 24/11/2026 havia TRÊS tabelas no sistema e as três
 *   discordavam —
 *
 *     a tela do app        50 / 100 / 200 / 400 / 600
 *     esta função          50 /  90 / 160 / 250
 *     a tabela do dono     50 / 100 / 150 / 300 / 500
 *
 *   O cliente veria R$ 300 na tela e seria cobrado R$ 160 no cartão, todo
 *   mês, e só apareceria no extrato do Asaas. Agora o preço mora em
 *   public.planos e os dois lados leem a MESMA linha. Preço escrito em dois
 *   lugares diverge; não repita isso.
 *
 * SEM PADRÃO SILENCIOSO — DE PROPÓSITO
 *   Sem ASAAS_API_URL e ASAAS_API_KEY a função RECUSA e diz o que falta. A
 *   versão antiga caía em sandbox sozinha, e o sistema passou meses
 *   "cobrando" dinheiro que não existia.
 *
 * SEGREDOS (Supabase → Edge Functions → Secrets)
 *   ASAAS_API_URL   https://api.asaas.com/v3  (produção)
 *                   https://api-sandbox.asaas.com/v3  (teste)
 *   ASAAS_API_KEY   a chave daquele ambiente — são chaves diferentes.
 *   APP_URL         para onde o cliente volta depois de pagar.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const ASAAS_URL = Deno.env.get("ASAAS_API_URL") ?? "";
const ASAAS_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const APP_URL   = Deno.env.get("APP_URL") ?? "https://waaqua.com.br";

/* Os nossos nomes de ciclo, e os do Asaas. SEMIANNUALLY existe e está no
 * enum da API (WEEKLY, BIWEEKLY, MONTHLY, BIMONTHLY, QUARTERLY,
 * SEMIANNUALLY, YEARLY) — conferido na documentação antes de usar. */
const CICLOS: Record<string, { asaas: string; coluna: string; rotulo: string }> = {
  mensal:    { asaas: "MONTHLY",      coluna: "mensal",    rotulo: "Assinatura mensal" },
  semestral: { asaas: "SEMIANNUALLY", coluna: "semestral", rotulo: "Assinatura semestral" },
  anual:     { asaas: "YEARLY",       coluna: "anual",     rotulo: "Assinatura anual" },
};

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
function agoraAsaas(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
         `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responde({ error: "Metodo nao permitido" }, 405);

  if (!ASAAS_URL || !ASAAS_KEY) {
    console.error("Faltando ASAAS_API_URL e/ou ASAAS_API_KEY nos segredos.");
    return responde({ error: "Pagamento não configurado. Avise o suporte." }, 503);
  }
  if (!/^https:\/\/api(-sandbox)?\.asaas\.com\/v3$/.test(ASAAS_URL)) {
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
    const c = CICLOS[String(ciclo)];
    if (!c) return responde({ error: "Ciclo invalido" }, 400);

    const doc = String(cpfCnpj || "").replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14) return responde({ error: "CPF ou CNPJ invalido" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    /* O PREÇO VEM DAQUI, e com a chave de serviço: o valor cobrado não pode
     * depender do que o celular manda. Se um dia alguém mexer na requisição
     * para pedir "plano pro por R$ 1", o número continua saindo do banco. */
    const { data: p, error: erroPlano } = await admin
      .from("planos")
      .select("chave, nome, limite_viveiros, mensal, semestral, anual, permite_cartao, ativo")
      .eq("chave", String(plano))
      .maybeSingle();

    if (erroPlano) {
      console.error("Erro ao ler planos:", erroPlano);
      return responde({ error: "Nao consegui consultar os planos. Tente de novo." }, 500);
    }
    if (!p || !p.ativo) return responde({ error: "Plano invalido" }, 400);
    if (!p.permite_cartao) {
      return responde({ error: "Este plano é contratado pelo WhatsApp." }, 400);
    }

    const valor = Number((p as Record<string, unknown>)[c.coluna]);
    if (!valor || valor <= 0) {
      // Ciclo sem preço cadastrado naquele plano (coluna nula).
      return responde({ error: `O plano ${p.nome} não tem ${ciclo}.` }, 400);
    }

    const minutosAteExpirar = 60;   // o Asaas aceita de 10 a 1440

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
        name: `WA Aqua Gestão — Plano ${p.nome}`,
        description: c.rotulo,
        quantity: 1,
        value: valor,
      }],
      subscription: {
        cycle: c.asaas,
        nextDueDate: agoraAsaas(),   // primeira cobrança hoje
      },
      customerData: {
        name: String(nome || user.user_metadata?.nome || user.email || "").slice(0, 100),
        cpfCnpj: doc,
        email: user.email,
        ...(telefone ? { phone: String(telefone).replace(/\D/g, "") } : {}),
      },
    });

    const id = checkout?.id as string | undefined;
    if (!id) throw new Error("O Asaas nao devolveu o id do checkout");

    const link = `https://asaas.com/checkoutSession/show?id=${id}`;
    const expira = new Date(Date.now() + minutosAteExpirar * 60000).toISOString();

    /* Guarda ANTES de devolver o link. Se gravasse depois e a gravação
     * falhasse, o cliente pagaria e nós não saberíamos de quem é.
     *
     * O QUE NÃO SE ESCREVE AQUI, e por quê:
     *   plano, ciclo, limite_viveiros e status são o que o cliente TEM.
     *   Isto aqui é só o que ele ESCOLHEU numa página que talvez nem
     *   abra. A primeira versão gravava plano e limite na hora, e com
     *   isso um cliente no Pro que tocasse em "Assinar" no Básico só
     *   para ver o preço caía para 5 viveiros na mesma hora, sem ter
     *   pago nada — e, no outro sentido, subia de plano de graça.
     *   Quem move plano_checkout -> plano é o webhook, quando o dinheiro
     *   entra. */
    const { error: erroBanco } = await admin.from("assinaturas").upsert({
      user_id: user.id,
      plano_checkout: p.chave,
      ciclo_checkout: ciclo,
      asaas_checkout_id: id,
      checkout_url: link,
      checkout_expira_em: expira,
      atualizado_em: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (erroBanco) {
      console.error("Nao consegui guardar o checkout:", erroBanco);
      return responde({ error: "Nao consegui registrar a assinatura. Tente de novo." }, 500);
    }

    return responde({ ok: true, url: link, valor, expiraEm: expira });
  } catch (e) {
    console.error(e);
    return responde({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
