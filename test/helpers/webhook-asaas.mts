/* Roda o CÓDIGO DE VERDADE do asaas-webhook em cima de um banco de mentira.
   O arquivo é lido do repositório e transformado só no que o Deno tem e o
   Node não: o import jsr, Deno.env e Deno.serve. A lógica não é tocada. */
import fs from "node:fs";
import assert from "node:assert";
import { bancoFalso } from "./webhook-banco-falso.mts";

const FONTE = `${import.meta.dirname}/../../supabase/functions/asaas-webhook/index.ts`;
const TOKEN = "token-de-mentira";

/* Em vez de avaliar o texto (o `new Function` recebia TypeScript cru e
   engasgava no primeiro `: string`), o arquivo transformado é gravado em
   disco e IMPORTADO: aí o Node tira os tipos sozinho. Só o import do jsr e
   o objeto Deno são trocados; a lógica é a do repositório, linha por linha. */
let n = 0;
async function carregar(banco: any) {
  const src = fs.readFileSync(FONTE, "utf8").replace(
    /import \{ createClient \} from "jsr:[^"]+";/,
    "const createClient = () => (globalThis as any).__BANCO;",
  );
  const alvo = `${import.meta.dirname}/.gerado-${++n}.mts`;
  fs.writeFileSync(alvo, src);
  let handler: any = null;
  (globalThis as any).Deno = {
    env: { get: (k: string) => k === "ASAAS_WEBHOOK_TOKEN" ? TOKEN : "x" },
    serve: (h: any) => { handler = h; },
  };
  (globalThis as any).__BANCO = banco;
  await import(alvo);
  fs.unlinkSync(alvo);
  if (!handler) throw new Error("Deno.serve nao foi chamado — o arquivo mudou de forma?");
  return handler;
}

const pedir = (corpo: any, token = TOKEN) =>
  new Request("https://x/asaas-webhook", {
    method: "POST", headers: { "asaas-access-token": token, "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });

const UID = "11111111-1111-1111-1111-111111111111";
const PLANOS = [
  { chave: "gratis1", limite_viveiros: 1 }, { chave: "basico", limite_viveiros: 5 },
  { chave: "intermediario", limite_viveiros: 10 }, { chave: "avancado", limite_viveiros: 20 },
  { chave: "pro", limite_viveiros: 999999 },
];
const cliente = (extra: any = {}) => ({
  user_id: UID, plano: "pro", ciclo: "anual", status: "ativo", limite_viveiros: 999999,
  plano_checkout: null, ciclo_checkout: null, asaas_checkout_id: null,
  asaas_subscription_id: null, checkout_url: null, ...extra,
});

/* O webhook escreve no console de propósito (é o log de produção). Aqui
   ele é silenciado para o resultado sair limpo em JSON. */
const resultados: { nome: string; erro: string | null }[] = [];
console.log = () => {};
console.error = () => {};
async function caso(nome: string, fn: () => Promise<void>) {
  try { await fn(); resultados.push({ nome, erro: null }); }
  catch (e) { resultados.push({ nome, erro: String((e as Error).message).split("\n")[0] }); }
}

await caso("checkout abandonado não mexe no plano de quem já paga", async () => {
  const linha = cliente({ plano_checkout: "basico", ciclo_checkout: "mensal",
    asaas_checkout_id: "chk1", checkout_url: "https://asaas.com/x" });
  const b = bancoFalso([linha], PLANOS);
  const h = await carregar(b.cliente);
  const r = await h(pedir({ event: "CHECKOUT_EXPIRED", checkout: { id: "chk1", externalReference: UID } }));
  assert.equal(r.status, 200);
  assert.equal(linha.plano, "pro", "o plano em vigor foi trocado por um checkout que ninguém pagou");
  assert.equal(linha.limite_viveiros, 999999, "o cliente perdeu viveiros sem pagar nada");
  assert.equal(linha.checkout_url, null, "o link morto deveria ter sido limpo");
});

await caso("checkout pago troca o plano e zera a escolha", async () => {
  const linha = cliente({ plano: "gratis", limite_viveiros: 1, ciclo: null,
    plano_checkout: "intermediario", ciclo_checkout: "semestral", asaas_checkout_id: "chk2" });
  const b = bancoFalso([linha], PLANOS);
  const h = await carregar(b.cliente);
  const r = await h(pedir({ event: "CHECKOUT_PAID", checkout: { id: "chk2", externalReference: UID } }));
  assert.equal(r.status, 200);
  assert.equal(linha.plano, "intermediario");
  assert.equal(linha.limite_viveiros, 10, "o limite tem de vir de public.planos, não do pedido");
  assert.equal(linha.ciclo, "semestral");
  assert.equal(linha.status, "ativo");
  assert.equal(linha.plano_checkout, null, "a escolha tem de ser zerada depois de usada");
});

await caso("o mesmo aviso dez vezes dá no mesmo que uma", async () => {
  const linha = cliente({ plano: "gratis", limite_viveiros: 1,
    plano_checkout: "basico", ciclo_checkout: "mensal", asaas_checkout_id: "chk3" });
  const b = bancoFalso([linha], PLANOS);
  const h = await carregar(b.cliente);
  for (let i = 0; i < 10; i++) {
    await h(pedir({ event: "CHECKOUT_PAID", checkout: { id: "chk3", externalReference: UID } }));
  }
  assert.equal(linha.plano, "basico");
  assert.equal(linha.limite_viveiros, 5);
});

await caso("cobrança do mês seguinte não ressuscita escolha velha", async () => {
  // Cliente já no básico. Um PAYMENT_CONFIRMED da mensalidade não pode
  // trocar nada: a escolha foi zerada quando ele comprou.
  const linha = cliente({ plano: "basico", limite_viveiros: 5, ciclo: "mensal",
    asaas_subscription_id: "sub9" });
  const b = bancoFalso([linha], PLANOS);
  const h = await carregar(b.cliente);
  await h(pedir({ event: "PAYMENT_CONFIRMED",
    payment: { id:"pay9", subscription: "sub9", externalReference: UID, dueDate: "2027-01-10" } }));
  assert.equal(linha.plano, "basico");
  assert.equal(linha.limite_viveiros, 5);
  assert.equal(linha.proximo_vencimento, "2027-02-10");
  assert.equal(b.tabelas.periodos_cartao[0].evento,"pay9");
});

await caso("liberação manual não é desfeita pela cobrança do mês seguinte", async () => {
  /* O caso do dono: o cliente comprou o básico no cartão, depois pediu mais
     viveiros e foi liberado NA MÃO no pro. Quando a mensalidade do básico
     for confirmada no mês seguinte, ela não pode puxar ele de volta. */
  const linha = cliente({ plano: "basico", limite_viveiros: 5, ciclo: "mensal",
    plano_checkout: "basico", ciclo_checkout: "mensal", asaas_subscription_id: "sub7" });
  const b1 = bancoFalso([linha], PLANOS);
  await (await carregar(b1.cliente))(pedir({ event: "CHECKOUT_PAID",
    checkout: { externalReference: UID } }));

  // o dono libera na mão, como faz hoje pelo painel
  Object.assign(linha, { plano: "pro", limite_viveiros: 999999, status: "ativo" });

  const b2 = bancoFalso([linha], PLANOS);
  await (await carregar(b2.cliente))(pedir({ event: "PAYMENT_CONFIRMED",
    payment: { subscription: "sub7", externalReference: UID } }));
  assert.equal(linha.plano, "pro", "a cobrança do cartão desfez a liberação manual");
  assert.equal(linha.limite_viveiros, 999999);
});

await caso("atraso é encaminhado à conciliação sem rebaixamento direto", async () => {
  const linha = cliente({ plano: "pro", plano_checkout: "gratis1" });
  const b = bancoFalso([linha], PLANOS);
  const h = await carregar(b.cliente);
  await h(pedir({ event: "PAYMENT_OVERDUE", payment: { externalReference: UID } }));
  assert.equal(b.chamadas.length,1);
  assert.equal(b.chamadas[0].nome,"tratar_aviso_cobranca");
  assert.equal(b.chamadas[0].args.p_evento,"PAYMENT_OVERDUE");
  assert.equal(linha.status, "ativo");
  assert.equal(linha.plano, "pro", "um atraso rebaixou o plano");
  assert.equal(linha.limite_viveiros, 999999);
});

await caso("plano ausente vai para revisão e preserva o acesso anterior", async () => {
  const linha = cliente({ plano: "gratis", limite_viveiros: 1, plano_checkout: "plano-que-nao-existe" });
  const b = bancoFalso([linha], PLANOS);
  const h = await carregar(b.cliente);
  const r = await h(pedir({ event: "CHECKOUT_PAID", checkout: { externalReference: UID } }));
  assert.equal(r.status, 500);
  assert.equal(b.tabelas.cobranca_revisao.length,1);
  assert.equal(linha.plano,"gratis");
  assert.equal(linha.limite_viveiros, 1, "inventou limite para um plano inexistente");
});

await caso("token errado não passa", async () => {
  const linha = cliente();
  const b = bancoFalso([linha], PLANOS);
  const h = await carregar(b.cliente);
  const r = await h(pedir({ event: "CHECKOUT_PAID", checkout: { externalReference: UID } }, "token-errado"));
  assert.equal(r.status, 401);
  assert.equal(b.escritas.length, 0, "escreveu no banco sem token válido");
});

await caso("pagamento sem dono não escreve em ninguém", async () => {
  const linha = cliente();
  const b = bancoFalso([linha], PLANOS);
  const h = await carregar(b.cliente);
  const r = await h(pedir({ event: "CHECKOUT_PAID",
    checkout: { id: "chk-de-outro", externalReference: "99999999-9999-9999-9999-999999999999" } }));
  assert.equal(r.status, 500);
  assert.equal(b.tabelas.cobranca_revisao.length,1);
  assert.equal(linha.plano, "pro");
  assert.equal(linha.status, "ativo");
});

process.stdout.write("\n__RESULTADOS__" + JSON.stringify(resultados) + "\n");
