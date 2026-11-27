"use strict";
/*
 * BLOQUEIO ADMINISTRATIVO x SITUAÇÃO COMERCIAL
 *
 * Até 26/11/2026 as duas coisas eram o mesmo campo, assinaturas.status. Quem
 * escrevesse por último mandava — e quem escreve ali é o painel, o Pix, o
 * cartão e o webhook. O histórico tem o caso: em 01/10 um "Liberar" desligou
 * um bloqueio que estava de pé havia duas semanas, e o bloqueio foi refeito
 * 12 segundos depois.
 *
 * Estes testes guardam a separação em três frentes:
 *   1. o que a tela do cliente faz;
 *   2. o que o painel e a Edge Function têm permissão de chamar;
 *   3. o que a migração promete e o que a reversão preserva.
 *
 * O comportamento do BANCO (gatilho, RPCs, políticas) não cabe aqui: é SQL,
 * e está em test/postgres/bloqueio.sql, que roda num cluster descartável.
 */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RAIZ = path.join(__dirname, "..");
const FONTE = fs.readFileSync(path.join(RAIZ, "app", "script.js"), "utf8");
const MIGRACAO = fs.readFileSync(path.join(RAIZ, "banco", "migracoes", "bloqueio-administrativo-20261127.sql"), "utf8");
const REVERSAO = fs.readFileSync(path.join(RAIZ, "banco", "reversoes", "bloqueio-administrativo-20261127.sql"), "utf8");
const PAINEL = fs.readFileSync(path.join(RAIZ, "ch2", "index.html"), "utf8");
const EDGE = fs.readFileSync(path.join(RAIZ, "supabase", "functions", "admin-clientes", "index.ts"), "utf8");

/* ─── a tela do cliente ──────────────────────────────────────────────────── */

const noop = () => {};
const elemento = () => ({
  addEventListener: noop, removeEventListener: noop, setAttribute: noop, removeAttribute: noop,
  appendChild: noop, remove: noop, focus: noop, click: noop, insertBefore: noop,
  getAttribute: () => null, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  style: {}, dataset: {}, value: "", innerHTML: "", textContent: "",
  firstElementChild: null, querySelector: () => null, querySelectorAll: () => [],
  getBoundingClientRect: () => ({ height: 0, top: 0, width: 0 }),
});

function carregar() {
  const avisos = [];
  const janela = { addEventListener: noop, removeEventListener: noop, scrollY: 0, scrollTo: noop,
    location: { href: "", search: "", reload: noop },
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }) };
  const ctx = {
    supabase: { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: noop }, from: () => ({}) }) },
    document: { addEventListener: noop, removeEventListener: noop, getElementById: () => null,
      querySelector: () => null, querySelectorAll: () => [], createElement: () => elemento(),
      body: elemento(), documentElement: { style: {} } },
    window: janela, location: janela.location, history: { pushState: noop, replaceState: noop },
    navigator: { onLine: true },
    localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    getComputedStyle: () => ({ marginTop: "0px", marginBottom: "0px" }),
    console: { log: noop, warn: noop, error: noop },
    setTimeout: noop, clearTimeout: noop, setInterval: noop, clearInterval: noop,
    crypto: { randomUUID: () => "00000000-0000-0000-0000-000000000000" },
    MutationObserver: function () { return { observe: noop, disconnect: noop }; },
    Chart: function () { return { destroy: noop, update: noop, resize: noop }; },
    __avisos: avisos,
  };
  ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(FONTE, ctx, { filename: "app/script.js" });
  vm.runInContext("_toastErro = (m) => { __avisos.push(m); };", ctx);
  return { run: (c) => vm.runInContext(c, ctx), avisos };
}

/* O que meu_plano_efetivo devolve, conferido contra a função real do banco. */
const doServidor = (extra = {}) => JSON.stringify(Object.assign({
  plano: "basico", limite_viveiros: 5, plano_contratado: "basico",
  proximo_vencimento: "2027-06-30", viveiro_escolhido: null,
  bloqueio_admin: false, bloqueio_admin_desde: null, bloqueio_admin_motivo: null,
}, extra));

function cenario(efetivo, assinatura = { plano: "basico", status: "ativo", proximo_vencimento: "2027-06-30" }) {
  const app = carregar();
  app.run(`_planoEfetivo = ${efetivo};`);
  app.run(`assinatura = ${JSON.stringify(assinatura)};`);
  app.run(`viveiros = [{id:'v1'},{id:'v2'},{id:'v3'}];`);
  return app;
}

test("cliente: conta em dia e sem bloqueio continua escrevendo", () => {
  const app = cenario(doServidor());
  assert.equal(app.run("_bloqueioAdministrativo()"), false);
  assert.equal(app.run("_contaBloqueada()"), false);
  assert.equal(app.run("_bloqueioEdicao()"), false);
  assert.deepEqual(app.avisos, []);
});

test("cliente: bloqueio administrativo trava mesmo com plano pago em dia", () => {
  // É o ponto da tarefa: a situação comercial está impecável e a conta
  // continua bloqueada.
  const app = cenario(doServidor({ bloqueio_admin: true, bloqueio_admin_motivo: "uso indevido" }));
  assert.equal(app.run("_bloqueioAdministrativo()"), true);
  assert.equal(app.run("_contaBloqueada()"), true);
  assert.equal(app.run("_bloqueioEdicao()"), true);
  assert.equal(app.run("_bloqueioViveiro(0)"), true);
});

test("cliente: o aviso do bloqueio não manda pagar", () => {
  // Mandar "regularize o pagamento" para quem o suporte bloqueou faz a pessoa
  // pagar achando que resolve. Não resolve.
  const app = cenario(doServidor({ bloqueio_admin: true, bloqueio_admin_motivo: "uso indevido" }));
  app.run("_bloqueioEdicao()");
  assert.equal(app.avisos.length, 1);
  assert.match(app.avisos[0], /bloqueada pelo suporte/i);
  assert.match(app.avisos[0], /uso indevido/, "o motivo tem de aparecer para o cliente");
  assert.doesNotMatch(app.avisos[0], /regularize o pagamento/i);
});

test("cliente: sem bloqueio, o aviso de pagamento continua o de sempre", () => {
  const app = cenario("null", { plano: "basico", status: "cancelado", proximo_vencimento: "2026-01-01" });
  assert.equal(app.run("_contaBloqueada()"), true);
  app.run("_bloqueioEdicao()");
  assert.match(app.avisos[0], /Regularize o pagamento/i);
});

test("cliente: pagar não tira o bloqueio administrativo", () => {
  // Depois de um Pix confirmado o servidor devolve o plano vigente de novo,
  // mas bloqueio_admin continua verdadeiro — porque o pagamento não mexe nele.
  const app = cenario(doServidor({
    plano: "pro", limite_viveiros: 999999, bloqueio_admin: true,
    bloqueio_admin_motivo: "pendência contratual",
  }), { plano: "pro", status: "ativo", proximo_vencimento: "2027-12-31", limite_viveiros: 999999 });
  assert.equal(app.run("_planoLimiteEfetivo()"), 999999, "o comercial continua valendo");
  assert.equal(app.run("_contaBloqueada()"), true, "e a conta continua bloqueada");
});

test("cliente: sem resposta do servidor o bloqueio administrativo é desconhecido", () => {
  // meu_plano_efetivo falhou: não dá para afirmar que está bloqueado, e a
  // regra comercial local assume. As políticas do banco continuam barrando a
  // escrita de quem estiver bloqueado — a tela é só o aviso.
  const app = cenario("null");
  assert.equal(app.run("_bloqueioAdministrativo()"), false);
  assert.equal(app.run("_contaBloqueada()"), false, "plano em dia pela regra local");
});

/* ─── painel e Edge Function ─────────────────────────────────────────────── */

test("painel: bloquear e desbloquear chamam as RPCs dedicadas, não a Edge Function", () => {
  assert.match(PAINEL, /admin_bloquear_cliente/, "o painel precisa chamar a RPC de bloqueio");
  assert.match(PAINEL, /admin_desbloquear_cliente/, "o painel precisa chamar a RPC de desbloqueio");
  assert.doesNotMatch(PAINEL, /acao\(this,'bloquear'/, "o botão antigo ainda aponta para a Edge Function");
  assert.doesNotMatch(PAINEL, /acao\(this,'reativar'/, "o botão antigo ainda aponta para a Edge Function");
});

test("painel: não dá para bloquear sem motivo", () => {
  const fn = PAINEL.slice(PAINEL.indexOf("async function bloqueioAdmin"),
                          PAINEL.indexOf("async function acao("));
  assert.match(fn, /prompt\(/, "tem de perguntar o motivo");
  assert.match(fn, /length\s*<\s*3/, "tem de recusar motivo curto antes de chamar o servidor");
  assert.match(fn, /180/, "tem de recusar motivo longo demais");
});

test("edge function: o caminho antigo de bloqueio está fechado", () => {
  const bloco = EDGE.slice(EDGE.indexOf('if (action === "bloquear"'));
  assert.ok(bloco.length > 0, "o tratamento de bloquear sumiu por inteiro — era para recusar, não sumir");
  const corpo = bloco.slice(0, bloco.indexOf("}"));
  assert.doesNotMatch(corpo, /upsert|status/,
    "a Edge Function voltou a escrever status em bloquear/reativar");
  assert.match(bloco, /410/, "a recusa precisa ser explícita, para painel velho em cache não bloquear calado");
});

test("edge function: liberar e trocar continuam sem tocar no bloqueio", () => {
  assert.doesNotMatch(EDGE, /bloqueio_admin/,
    "nenhuma ação da Edge Function pode escrever nas colunas de bloqueio — ela usa service_role");
});

/* ─── migração e reversão ────────────────────────────────────────────────── */

test("migração: o desbloqueio não pode mexer no comercial", () => {
  const fn = MIGRACAO.slice(MIGRACAO.indexOf("FUNCTION public.admin_desbloquear_cliente"));
  for (const campo of ["plano", "ciclo", "status", "limite_viveiros", "proximo_vencimento"]) {
    assert.match(fn, new RegExp(`v_depois\\.${campo}\\s+IS DISTINCT FROM v_antes\\.${campo}`),
      `falta a conferência de ${campo} no desbloqueio`);
  }
  assert.match(fn, /DESBLOQUEIO_MEXEU_NO_COMERCIAL/);
});

test("migração: as duas RPCs exigem motivo e conferem o papel de admin", () => {
  for (const nome of ["admin_bloquear_cliente", "admin_desbloquear_cliente"]) {
    const fn = MIGRACAO.slice(MIGRACAO.indexOf(`FUNCTION public.${nome}`),
                              MIGRACAO.indexOf(`FUNCTION public.${nome}`) + 2000);
    assert.match(fn, /role = 'admin'/, `${nome} não confere se quem chama é admin`);
    assert.match(fn, /NOT BETWEEN 3 AND 180/, `${nome} não exige motivo`);
    assert.match(fn, /admin_historico/, `${nome} não registra no histórico`);
  }
});

test("migração: as políticas novas valem para escrita, nunca para leitura", () => {
  // Uma RESTRICTIVE em FOR ALL travaria o SELECT junto, e o cliente perderia a
  // consulta dos próprios dados — o contrário do que a tarefa pede.
  const bloco = MIGRACAO.slice(MIGRACAO.indexOf("bloqueio_admin_sem_insert"));
  for (const cmd of ["FOR INSERT", "FOR UPDATE", "FOR DELETE"]) {
    assert.ok(bloco.includes(cmd), `falta política ${cmd}`);
  }
  assert.ok(!/CREATE POLICY[^;]*bloqueio_admin[^;]*FOR ALL/i.test(MIGRACAO),
    "política de bloqueio em FOR ALL travaria a leitura");
  assert.ok(!/CREATE POLICY[^;]*bloqueio_admin[^;]*FOR SELECT/i.test(MIGRACAO),
    "política de bloqueio não pode alcançar SELECT");
});

test("migração: a correção crítica de quota não é tocada", () => {
  // 65d6885 já está em produção. Esta migração não pode encostar nela.
  for (const intocavel of ["checar_limite_viveiros", "trg_limite_viveiros", "wa_quota_interna"]) {
    const linhas = MIGRACAO.split("\n").filter((l) => l.includes(intocavel) && !l.trim().startsWith("--"));
    assert.deepEqual(linhas, [],
      `a migração menciona ${intocavel} fora de comentário: ` + linhas.join(" | "));
  }
});

test("reversão: desfaz o que a migração criou", () => {
  for (const alvo of ["bloqueio_admin_sem_insert", "assinatura_bloqueio_admin_protegido",
                      "admin_bloquear_cliente", "admin_desbloquear_cliente", "bloqueio_admin_ativo",
                      "bloqueio_admin_em"]) {
    assert.ok(REVERSAO.includes(alvo), `a reversão não desfaz ${alvo}`);
  }
  assert.match(REVERSAO, /DROP TRIGGER IF EXISTS trg_assinatura_bloqueio_admin/);
});

test("reversão: avisa que o estado de bloqueio se perde, e confere a quota", () => {
  assert.match(REVERSAO, /PASSO 0/, "falta o passo de anotar quem está bloqueado antes de apagar");
  assert.match(REVERSAO, /tgtype = 21/,
    "a reversão tem de conferir que o gatilho da quota continuou AFTER INSERT OR UPDATE");
  assert.match(REVERSAO, /wa_quota_interna/,
    "a reversão tem de conferir que o schema da quota continua de pé");
  assert.ok(!/DROP (TRIGGER|FUNCTION)[^;]*checar_limite_viveiros/i.test(REVERSAO),
    "a reversão não pode derrubar a função da quota");
});
