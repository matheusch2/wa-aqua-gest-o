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
    throw Object.assign(new Error(`Asaas ${res.status} ${metodo} ${caminho}: ${msg}`),{providerStatus:res.status});
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

    const { plano, ciclo, troca } = await req.json().catch(() => ({}));
    const c = CICLOS[String(ciclo)];
    if (!c) return responde({ error: "Ciclo invalido" }, 400);


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

    let valor = Number((p as Record<string, unknown>)[c.coluna]);
    if (!valor || valor <= 0) {
      // Ciclo sem preço cadastrado naquele plano (coluna nula).
      return responde({ error: `O plano ${p.nome} não tem ${ciclo}.` }, 400);
    }

    const {data: anterior, error: erroAssinatura} = await admin.from("assinaturas")
      .select("plano,status,proximo_vencimento,asaas_subscription_id")
      .eq("user_id", user.id).maybeSingle();
    if (erroAssinatura) return responde({error:"Não foi possível conferir seu plano. Tente novamente."},503);
    const hoje = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Fortaleza",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
    let extras: Record<string,unknown> = {};
    if (troca) {
      const {data:q,error} = await supaUser.rpc("cotar_troca_plano",{p_plano:p.chave});
      if(error || !q || q.ciclo!==ciclo || q.validade!==troca.validade || q.origem!==troca.origem || Number(q.valor)!==Number(troca.valor))
        return responde({error:"As condições da troca mudaram. Abra a página de cobrança novamente."},409);
      valor = Number(q.valor);
      extras={finalidade:"upgrade",plano_origem:q.origem,vencimento_origem:q.validade};
    }
    if (!troca && anterior?.status === "ativo" && anterior.plano !== "gratis" && anterior.plano !== p.chave &&
        (!anterior.proximo_vencimento || anterior.proximo_vencimento > hoje)) {
      return responde({error:"Você já possui outro plano vigente. Nenhum Pix foi gerado."},409);
    }
    if (anterior?.asaas_subscription_id) {
      const idSub = anterior.asaas_subscription_id;
      const res = await fetch(ASAAS_URL + "/subscriptions/" + encodeURIComponent(idSub), {
        headers:{access_token:ASAAS_KEY},signal:AbortSignal.timeout(15000),redirect:"error"
      });
      if (res.status !== 404) {
        const sub = res.ok ? await res.json().catch(()=>null) : null;
        if (!sub || sub.id !== idSub) return responde({error:"Não foi possível conferir a recorrência no Asaas. Nenhum Pix foi gerado."},503);
        if (sub.deleted !== true && sub.status === "ACTIVE") return responde({error:"Já existe uma assinatura recorrente ativa no Asaas. Confira a forma de pagamento antes de gerar um Pix."},409);
        if (sub.deleted !== true && !["INACTIVE","EXPIRED"].includes(sub.status)) return responde({error:"Não foi possível confirmar a situação da assinatura. Nenhum Pix foi gerado."},503);
      }
    }

    const minutosAteExpirar = 60;   // o Asaas aceita de 10 a 1440

    if(troca){
      const {data:pend,error}=await admin.from("cobrancas_pix").select("plano,ciclo,valor,asaas_checkout_id,expira_em,plano_origem,vencimento_origem").eq("user_id",user.id).eq("finalidade","upgrade").eq("status","pendente").maybeSingle();
      if(error)return responde({error:"Não foi possível consultar a troca pendente."},503);
      if(pend){
        if(pend.plano===p.chave && pend.ciclo===ciclo && pend.plano_origem===extras.plano_origem && pend.vencimento_origem===extras.vencimento_origem && Number(pend.valor)===valor && pend.asaas_checkout_id && Date.parse(pend.expira_em)>Date.now())
          return responde({url:"https://asaas.com/checkoutSession/show?id="+encodeURIComponent(pend.asaas_checkout_id),valor});
        return responde({error:"Existe uma troca em processamento. Aguarde a confirmação ou o encerramento do checkout anterior."},409);
      }
    }
    const {data: registro,error: erroRegistro}=await admin.from("cobrancas_pix").insert({...extras,user_id:user.id,plano:p.chave,ciclo,valor,limite_viveiros:p.limite_viveiros,expira_em:new Date(Date.now()+minutosAteExpirar*60000).toISOString()}).select("id").single();
    if(erroRegistro || !registro) return responde({error:"Não foi possível registrar a cobrança."},500);
    let checkout;
    try {checkout = await asaas("/checkouts", "POST", {
      billingTypes: ["PIX"],
      chargeTypes: ["DETACHED"],
      minutesToExpire: minutosAteExpirar,
      externalReference: registro.id,
      callback: {
        successUrl: `${APP_URL}/app/index.html?assinatura=ok`,
        cancelUrl:  `${APP_URL}/app/index.html?assinatura=cancelada`,
        expiredUrl: `${APP_URL}/app/index.html?assinatura=expirada`,
      },
      items: [{
        name: Array.from(`WA Aqua - ${p.nome}`).slice(0, 30).join(""),
        description: troca ? "Troca proporcional de plano" : c.rotulo,
        quantity: 1,
        value: valor,
      }],
    });

    }catch(err){
      const status=(err as {providerStatus?:number})?.providerStatus;
      if(status && [400,401,403,422].includes(status)){
        const {error}=await admin.from("cobrancas_pix").update({status:"cancelado"}).eq("id",registro.id).eq("status","pendente").is("asaas_checkout_id",null);
        if(!error)return responde({error:"O Asaas recusou a criação do checkout. Nenhum Pix foi emitido. Tente novamente ou contate o atendimento."},422);
      }
      const {error}=await admin.from("cobranca_revisao").upsert({chave:"checkout:"+registro.id,evento:"CHECKOUT_INDETERMINADO",referencia:registro.id});
      if(error)console.error("revisao checkout",error.message);
      return responde({error:"Estamos conferindo se o Asaas criou seu checkout. Não faça outro pagamento; consulte o atendimento."},503);
    }
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
    const {error: erroBanco}=await admin.from("cobrancas_pix").update({asaas_checkout_id:id,expira_em:expira}).eq("id",registro.id);
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
