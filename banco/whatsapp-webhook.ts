// ============================================================================
// WEBHOOK DO WHATSAPP — a porta de entrada das mensagens
//
// Fase 1: só conectar o número. Ainda não lança nada.
//
// ESTA FUNÇÃO É A TRANCA. Dentro do app quem protege os dados é o RLS, porque
// o Postgres sabe quem está logado. Aqui não existe login: chega um número de
// telefone e mais nada. A função roda com a chave de serviço, que fura o RLS,
// então ela é a única coisa entre um cliente e o viveiro do outro.
//
// Daí as três travas abaixo, nesta ordem, antes de qualquer coisa:
//   1. assinatura do corpo  — a mensagem veio MESMO da Meta?
//   2. whatsapp_confirmar() — o código bate, e o número não é de outra conta?
//   3. nada fora disso      — qualquer outra mensagem só recebe instrução.
//
// Segredos (Supabase → Project Settings → Edge Functions → Secrets):
//   WHATSAPP_VERIFY_TOKEN  o que vai no painel da Meta, no handshake
//   WHATSAPP_APP_SECRET    Meta → Configurações do app → Chave secreta
//   WHATSAPP_TOKEN         token do usuário do sistema, para responder
//   WHATSAPP_PHONE_ID      Phone Number ID, para responder
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const APP_SECRET   = Deno.env.get("WHATSAPP_APP_SECRET") ?? "";
const TOKEN        = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const PHONE_ID     = Deno.env.get("WHATSAPP_PHONE_ID") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

/*
 * A assinatura que a Meta põe em cada entrega (X-Hub-Signature-256): HMAC
 * SHA-256 do corpo CRU com a chave secreta do app.
 *
 * Sem isto a URL é pública e qualquer um na internet pode mandar "sou o
 * número 55889..., meu código é 123456" e ir tentando. A conferência do
 * código tem limite de cinco tentativas, mas o limite é a segunda tranca —
 * esta é a primeira, e é a que impede o atacante de sequer chegar nela.
 *
 * timingSafeEqual porque comparar com === vaza, pelo tempo da comparação,
 * quantos bytes do começo estavam certos.
 */
async function assinaturaConfere(corpo: string, cabecalho: string | null): Promise<boolean> {
  if (!APP_SECRET || !cabecalho?.startsWith("sha256=")) return false;
  const chave = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(corpo));
  const esperado = new Uint8Array(mac);
  const veio = Uint8Array.from(
    cabecalho.slice(7).match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) ?? [],
  );
  if (veio.length !== esperado.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) diferenca |= esperado[i] ^ veio[i];
  return diferenca === 0;
}

async function responder(para: string, texto: string): Promise<void> {
  if (!TOKEN || !PHONE_ID) return;   // canal ainda não configurado
  try {
    await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: para,
        type: "text", text: { preview_url: false, body: texto },
      }),
    });
  } catch (_) { /* falar é o melhor esforço; não derruba a entrega */ }
}

/* O código pode vir de três jeitos: pelo link que o app monta ("Conectar
   minha fazenda: 384729"), digitado solto ("384729") ou no meio de uma frase.
   O produtor não tem de acertar um formato. */
function acharCodigo(texto: string): string | null {
  const m = String(texto || "").match(/\b(\d{6})\b/);
  return m ? m[1] : null;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ── Handshake: a Meta chama uma vez, ao salvar a URL no painel ───────────
  if (req.method === "GET") {
    const modo = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const desafio = url.searchParams.get("hub.challenge");
    if (modo === "subscribe" && VERIFY_TOKEN && token === VERIFY_TOKEN) {
      return new Response(desafio ?? "", { status: 200 });
    }
    return new Response("nao", { status: 403 });
  }

  if (req.method !== "POST") return new Response("nao", { status: 405 });

  const corpo = await req.text();

  // FALHA PARA O LADO DE FECHAR. Sem a chave secreta configurada, a função
  // recusa tudo em vez de aceitar tudo: um webhook aberto é pior que um
  // webhook que ainda não funciona.
  if (!await assinaturaConfere(corpo, req.headers.get("x-hub-signature-256"))) {
    return new Response("assinatura", { status: 401 });
  }

  // Responder 200 sempre, mesmo quando não entendemos: a Meta reentrega o que
  // não recebeu 200, e uma mensagem estranha ficaria voltando para sempre.
  let dados: any;
  try { dados = JSON.parse(corpo); } catch (_) { return new Response("ok"); }

  try {
    const msgs = dados?.entry?.[0]?.changes?.[0]?.value?.messages ?? [];
    for (const m of msgs) {
      // O número vem da META, não do que o remetente diz ser. É isto que faz
      // o telefone valer como prova de identidade.
      const de: string = String(m.from || "").replace(/\D/g, "");
      const texto: string = m.type === "text" ? (m.text?.body ?? "") : "";
      if (!de) continue;

      // Já conectado? Então a mensagem é conversa, e a Fase 1 ainda não
      // conversa. Melhor dizer isso do que ficar calado.
      const { data: vinculo } = await supabase
        .from("whatsapp_vinculos")
        .select("user_id")
        .eq("telefone", de)
        .not("verificado_em", "is", null)
        .maybeSingle();

      if (vinculo) {
        await responder(de,
          "Seu número já está conectado ✅\n\n" +
          "Ainda estou aprendendo a lançar ração por aqui. " +
          "Por enquanto, use o app — eu aviso quando isso estiver pronto.");
        continue;
      }

      const codigo = acharCodigo(texto);
      if (!codigo) {
        await responder(de,
          "Oi! Sou o WA Aqua 🦐\n\n" +
          "Para conectar sua fazenda, abra o app em " +
          "Configurações → Lançar pelo WhatsApp e me mande o código de 6 dígitos.");
        continue;
      }

      const { data: userId } = await supabase.rpc("whatsapp_confirmar", {
        p_telefone: de, p_codigo: codigo,
      });

      await responder(de, userId
        ? "Pronto! Seu WhatsApp está conectado à sua fazenda ✅\n\n" +
          "Eu aviso assim que der para lançar ração por aqui."
        : "Esse código não funcionou 😕\n\n" +
          "Ele vale por 10 minutos. Gere um novo no app, em " +
          "Configurações → Lançar pelo WhatsApp.");
    }
  } catch (e) {
    console.log("webhook:", e);
  }

  return new Response("ok");
});
