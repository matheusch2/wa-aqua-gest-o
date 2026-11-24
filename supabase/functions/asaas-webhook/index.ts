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
 *
 * É AQUI, E SÓ AQUI, QUE O PLANO MUDA
 *   Quem abre o checkout grava a escolha em plano_checkout/ciclo_checkout —
 *   o que a pessoa QUER. O que ela TEM (plano, ciclo, limite_viveiros) só
 *   muda quando o dinheiro entra, e é esta função que move um para o outro.
 *
 *   Antes o checkout gravava o plano direto. Um cliente no Pro que tocasse
 *   em "Assinar" no Básico só para ver o preço, e fechasse a página, caía
 *   para 5 viveiros na mesma hora, sem ter pago nada.
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
  /* "pago" é só para os eventos em que o dinheiro ENTROU. É o que autoriza
     a troca de plano; CHECKOUT_CANCELED e PAYMENT_OVERDUE não autorizam. */
  let pago = false;

  if (evento === "CHECKOUT_PAID") {
    // O cartão passou. O Asaas cria a assinatura a partir daqui.
    mudanca.status = "ativo";
    mudanca.checkout_url = null;          // o link cumpriu o papel
    mudanca.checkout_expira_em = null;
    agir = true; pago = true;

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
    agir = true; pago = true;

  } else if (evento.startsWith("PAYMENT_OVERDUE") || evento === "PAYMENT_DELETED" || evento === "PAYMENT_REFUNDED") {
    mudanca.status = "pendente";
    agir = true;
  }

  if (!agir) return ok({ ok: true, ignorado: evento });

  // A data do próximo vencimento, quando o evento informa.
  const venc = cobranca?.dueDate ?? assinatura?.nextDueDate ?? checkout?.subscription?.nextDueDate;
  if (venc) mudanca.proximo_vencimento = String(venc).substring(0, 10);

  /* Como se acha a linha deste cliente. Vale tanto para ler quanto para
     escrever, por isso virou função: as duas TÊM de filtrar igual. */
  const filtrar = <T>(q: T): T | null => {
    const c = q as unknown as { eq: (col: string, v: string) => T };
    if (userId)            return c.eq("user_id", userId);
    if (checkoutId)        return c.eq("asaas_checkout_id", checkoutId);
    if (assinaturaId)      return c.eq("asaas_subscription_id", assinaturaId);
    return null;
  };

  if (!filtrar(supabase.from("assinaturas").select("user_id"))) {
    console.error("Evento sem nenhuma referencia utilizavel:", evento, JSON.stringify(body).slice(0, 400));
    return ok({ ok: true, ignorado: "sem referencia" });
  }

  /* O DINHEIRO ENTROU: é a hora, e a única hora, de mover a escolha do
     checkout para o plano em vigor. Fora daqui o plano não muda. */
  if (pago) {
    const { data: atual, error: erroLer } = await filtrar(
      supabase.from("assinaturas").select("plano_checkout, ciclo_checkout"),
    )!.maybeSingle();

    if (erroLer) {
      // 500 de propósito: o Asaas reenvia. Melhor repetir do que liberar
      // o acesso sem saber que plano o cliente comprou.
      console.error("Erro ao ler a assinatura antes de ativar:", erroLer);
      return new Response(JSON.stringify({ ok: false, error: erroLer.message }), { status: 500 });
    }

    const escolhido = atual?.plano_checkout as string | undefined;
    if (escolhido) {
      const { data: plano, error: erroPlano } = await supabase
        .from("planos").select("chave, limite_viveiros").eq("chave", escolhido).maybeSingle();

      if (erroPlano) {
        console.error("Erro ao ler o plano comprado:", erroPlano);
        return new Response(JSON.stringify({ ok: false, error: erroPlano.message }), { status: 500 });
      }
      if (!plano) {
        /* Pagou um plano que não existe mais no catálogo. Ativa assim mesmo
           — o dinheiro entrou — mas NÃO inventa limite, e grita no log para
           alguém resolver na mão. */
        console.error("PLANO COMPRADO NAO EXISTE NO CATALOGO:", escolhido, "evento", evento);
      } else {
        mudanca.plano = plano.chave;
        mudanca.limite_viveiros = plano.limite_viveiros;
        if (atual?.ciclo_checkout) mudanca.ciclo = atual.ciclo_checkout;
        // Já foi usada. Zerar deixa o reenvio do mesmo aviso sem efeito, e
        // impede que um pagamento futuro desta assinatura troque o plano de
        // novo por causa de uma escolha velha.
        mudanca.plano_checkout = null;
        mudanca.ciclo_checkout = null;
      }
    }
  }

  const { data, error } = await filtrar(supabase.from("assinaturas").update(mudanca))!
    .select("user_id");
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
