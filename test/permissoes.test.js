"use strict";
/*
 * AS ONZE FUNÇÕES QUE DECIDEM QUEM PODE ESCREVER NO SISTEMA
 *
 * Até 26/11/2026 não havia UM teste sobre elas — conferido por busca em
 * test/. São as funções que separam um cliente pagante de um bloqueado, e a
 * etapa seguinte do projeto é justamente movê-las para um módulo.
 *
 * ESTE ARQUIVO FIXA O COMPORTAMENTO ATUAL, não o desejado. Onde os dois
 * divergem, o nome do caso diz "hoje" e um comentário explica a diferença.
 * Um teste de caracterização que "conserta" a regra de passagem deixa de
 * servir para o que foi feito: provar que a extração não mudou nada.
 *
 * POR QUE RODAR O script.js DE VERDADE
 * Reescrever as funções aqui testaria a cópia. O arquivo original é carregado
 * num sandbox (vm) com dublês de navegador e de Supabase; cada cenário ganha
 * um sandbox novo, porque estas funções leem variáveis globais (assinatura,
 * _planoEfetivo, viveiros) e um estado vazado entre casos daria verde falso.
 */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RAIZ = path.join(__dirname, "..");
const FONTE = fs.readFileSync(path.join(RAIZ, "app", "script.js"), "utf8");

const noop = () => {};
function elemento() {
  return {
    addEventListener: noop, removeEventListener: noop, setAttribute: noop,
    removeAttribute: noop, appendChild: noop, remove: noop, focus: noop, click: noop,
    insertBefore: noop, getAttribute: () => null,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    style: {}, dataset: {}, value: "", innerHTML: "", textContent: "",
    firstElementChild: null, firstChild: null,
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ height: 0, top: 0, width: 0 }),
  };
}

/* Um sandbox novo por cenário. Devolve `run` para ler e escrever no mesmo
   escopo do script, e `avisos` com o que _toastErro mostraria na tela. */
function carregar() {
  const avisos = [];
  const janela = {
    addEventListener: noop, removeEventListener: noop, scrollY: 0, scrollTo: noop,
    location: { href: "", search: "", reload: noop },
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  };
  const ctx = {
    supabase: { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: noop }, from: () => ({}) }) },
    document: {
      addEventListener: noop, removeEventListener: noop,
      getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => elemento(), body: elemento(), documentElement: { style: {} },
    },
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
  return { run: (codigo) => vm.runInContext(codigo, ctx), avisos };
}

/* Datas relativas a HOJE. As funções chamam new Date() direto; em vez de
   congelar o relógio (que mexeria no script), os cenários são montados a
   partir do dia de hoje, que é como o app vive. */
function dia(deslocamento) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + deslocamento);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Monta um cenário: assinatura, resposta do servidor e lista de viveiros.
   `efetivo: null` representa a RPC meu_plano_efetivo que não respondeu. */
function cenario(a, { efetivo = null, viveiros = [] } = {}) {
  const app = carregar();
  app.run(`assinatura = ${JSON.stringify(a)};`);
  app.run(`_planoEfetivo = ${JSON.stringify(efetivo)};`);
  app.run(`viveiros = ${JSON.stringify(viveiros)};`);
  return app;
}

const vivs = (n) => Array.from({ length: n }, (_, i) => ({ id: "v" + i, nome: "Viveiro " + (i + 1) }));
/* Viveiro em cultivo: tem dataPovoamento. A ordem de liberação usa isso. */
const cultivo = (id, povoamento) => ({ id, nome: id, dataPovoamento: povoamento });

/* A resposta real da RPC meu_plano_efetivo, conferida no banco em 26/11/2026:
   quando o plano não está vigente ela devolve plano 'gratis' e limite 1 — não
   devolve nulo. Isso importa para os casos de divergência mais abaixo. */
const efetivoDoServidor = (plano, limite, extra = {}) =>
  ({ plano, limite_viveiros: limite, plano_contratado: plano, proximo_vencimento: null, viveiro_escolhido: null, ...extra });

// ═══════════════════════════════════════════════════════════════════════════
// DATAS E CARÊNCIA
// ═══════════════════════════════════════════════════════════════════════════

test("carência: são 5 dias, contados da data de vencimento", () => {
  const app = carregar();
  assert.equal(app.run("_DIAS_CARENCIA"), 5);
});

test("_parseVenc: devolve nulo para vazio e data para texto válido", () => {
  const app = carregar();
  assert.equal(app.run("_parseVenc(null)"), null);
  assert.equal(app.run("_parseVenc('')"), null);
  assert.equal(app.run("_parseVenc(undefined)"), null);
  assert.equal(app.run("_parseVenc('2026-12-25').getFullYear()"), 2026);
  assert.equal(app.run("_parseVenc('2026-12-25').getMonth()"), 11);
  assert.equal(app.run("_parseVenc('2026-12-25').getDate()"), 25);
});

test("_planoVencido: olha a DATA, nunca o campo status", () => {
  const app = carregar();
  // O comentário no código conta por que: o painel mostrava "Ativo" e
  // "Vencido há 8 dias" no mesmo cartão, e a trava lia só o status.
  assert.equal(app.run(`_planoVencido({status:'ativo', proximo_vencimento:'${dia(-30)}'})`), true,
    "status 'ativo' com data velha tem de contar como vencido");
  assert.equal(app.run(`_planoVencido({status:'cancelado', proximo_vencimento:'${dia(+30)}'})`), false,
    "status 'cancelado' com data no futuro NÃO é vencimento por data");
});

test("_planoVencido: sem data gravada devolve falso, de propósito", () => {
  const app = carregar();
  assert.equal(app.run("_planoVencido({status:'ativo'})"), false);
  assert.equal(app.run("_planoVencido(null)"), false);
  // Travar quem está pagando é pior do que deixar passar quem não está.
});

test("_planoVencido: a virada é no 5º dia, não no 6º", () => {
  const app = carregar();
  assert.equal(app.run(`_planoVencido({proximo_vencimento:'${dia(0)}'})`), false, "vence hoje: ainda não");
  assert.equal(app.run(`_planoVencido({proximo_vencimento:'${dia(-5)}'})`), false, "5 dias: último dia de carência");
  assert.equal(app.run(`_planoVencido({proximo_vencimento:'${dia(-6)}'})`), true, "6 dias: vencido");
});

test("_dentroDaCarencia: só vale para status 'pendente'", () => {
  const app = carregar();
  assert.equal(app.run(`_dentroDaCarencia({status:'ativo', proximo_vencimento:'${dia(-1)}'})`), false);
  assert.equal(app.run(`_dentroDaCarencia({status:'cancelado', proximo_vencimento:'${dia(-1)}'})`), false);
  assert.equal(app.run(`_dentroDaCarencia({status:'pendente', proximo_vencimento:'${dia(-1)}'})`), true);
  assert.equal(app.run(`_dentroDaCarencia({status:'pendente', proximo_vencimento:'${dia(-6)}'})`), false);
  assert.equal(app.run("_dentroDaCarencia({status:'pendente'})"), true,
    "pendente sem data: a carência protege, porque não dá para afirmar que venceu");
  assert.equal(app.run("_dentroDaCarencia(null)"), false);
});

test("_contaSituacao: classifica sem depender de nenhuma global", () => {
  const app = carregar();
  const cls = (a, dias) => app.run(`JSON.stringify(_contaSituacao(${JSON.stringify(a)}, ${dias}))`);
  assert.match(cls({ plano: "gratis", status: "ativo" }, null), /\w/);
  assert.match(cls({ plano: "basico", status: "cancelado" }, 10), /\w/);
  // Só confere que responde para todas as combinações, sem travar o texto:
  // o rótulo é interface e muda; o que não pode é quebrar.
  for (const s of ["ativo", "pendente", "cancelado"]) {
    for (const d of [-10, -1, 0, 3, 30, null]) {
      assert.ok(cls({ plano: "basico", status: s, proximo_vencimento: dia(d || 0) }, d),
        `_contaSituacao falhou em status=${s} dias=${d}`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LIMITE DE VIVEIROS
// ═══════════════════════════════════════════════════════════════════════════

test("limite: conta gratuita tem 1 viveiro", () => {
  const app = cenario({ plano: "gratis", status: "ativo" }, { viveiros: vivs(3) });
  assert.equal(app.run("_planoLimiteEfetivo()"), 1);
});

test("limite: conta paga e vigente usa o limite da própria assinatura", () => {
  const app = cenario(
    { plano: "intermediario", status: "ativo", limite_viveiros: 10, proximo_vencimento: dia(+20) },
    { viveiros: vivs(12) });
  assert.equal(app.run("_planoLimiteEfetivo()"), 10);
});

test("limite: assinatura antiga sem limite_viveiros cai na tabela do script", () => {
  const app = cenario({ plano: "avancado", status: "ativo", proximo_vencimento: dia(+20) });
  assert.equal(app.run("_planoLimiteEfetivo()"), 20);
  assert.deepEqual(app.run("JSON.parse(JSON.stringify(_LIMITES_PLANO))"),
    { gratis: 1, basico: 5, intermediario: 10, avancado: 20, pro: 999999 });
});

test("limite: plano vencido além da carência volta para 1", () => {
  const app = cenario(
    { plano: "pro", status: "ativo", limite_viveiros: 999999, proximo_vencimento: dia(-30) },
    { viveiros: vivs(8) });
  assert.equal(app.run("_planoLimiteEfetivo()"), 1);
});

test("limite: pendente DENTRO da carência mantém o plano; fora, não", () => {
  const dentro = cenario({ plano: "basico", status: "pendente", limite_viveiros: 5, proximo_vencimento: dia(-2) });
  assert.equal(dentro.run("_planoLimiteEfetivo()"), 5, "a carência protege o limite igual protege a trava");
  const fora = cenario({ plano: "basico", status: "pendente", limite_viveiros: 5, proximo_vencimento: dia(-10) });
  assert.equal(fora.run("_planoLimiteEfetivo()"), 1);
});

test("limite: assinatura cancelada não dá limite nenhum", () => {
  const app = cenario({ plano: "pro", status: "cancelado", limite_viveiros: 999999, proximo_vencimento: dia(+300) });
  assert.equal(app.run("_planoLimiteEfetivo()"), 1,
    "cancelado não é 'ativo' nem 'pendente na carência'");
});

test("limite: a resposta do servidor manda, quando existe", () => {
  // Liberação manual pelo painel: o admin grava a assinatura e a RPC
  // meu_plano_efetivo passa a devolver o plano vigente.
  const app = cenario(
    { plano: "gratis", status: "ativo" },
    { efetivo: efetivoDoServidor("pro", 999999), viveiros: vivs(30) });
  assert.equal(app.run("_planoLimiteEfetivo()"), 999999,
    "_planoEfetivo tem precedência sobre a assinatura local");
});

// ═══════════════════════════════════════════════════════════════════════════
// QUAIS VIVEIROS FICAM LIBERADOS
// ═══════════════════════════════════════════════════════════════════════════

test("viveiros: no grátis sobra o cultivo MAIS ANTIGO, não o primeiro cadastrado", () => {
  // A ordem é a do produtor: em cultivo primeiro, do mais velho para o mais
  // novo. Antes era a posição no array, e travava justamente o viveiro que
  // estava mais perto da despesca.
  const app = cenario({ plano: "gratis", status: "ativo" }, {
    viveiros: [
      { id: "vazio", nome: "Vazio" },                 // 0 — sem cultivo
      cultivo("novo", "2026-11-01"),                  // 1 — povoado há pouco
      cultivo("velho", "2026-08-01"),                 // 2 — povoado há mais tempo
    ],
  });
  assert.deepEqual([...app.run("Array.from(_viveirosLiberados())")], [2],
    "o liberado tem de ser o índice 2 (cultivo mais antigo)");
  assert.equal(app.run("_viveiroForaDoLimite(0)"), true);
  assert.equal(app.run("_viveiroForaDoLimite(1)"), true);
  assert.equal(app.run("_viveiroForaDoLimite(2)"), false);
});

test("viveiros: os vazios ficam por último, mesmo cadastrados antes", () => {
  const app = cenario({ plano: "basico", status: "ativo", limite_viveiros: 2, proximo_vencimento: dia(+10) }, {
    viveiros: [
      { id: "a" }, { id: "b" },
      cultivo("c", "2026-09-10"), cultivo("d", "2026-07-01"),
    ],
  });
  assert.deepEqual([...app.run("Array.from(_viveirosLiberados())")].sort(), [2, 3],
    "com limite 2, os dois em cultivo ganham a vaga");
});

test("viveiros: limite atingido — os excedentes ficam fora", () => {
  const app = cenario(
    { plano: "basico", status: "ativo", limite_viveiros: 5, proximo_vencimento: dia(+10) },
    { viveiros: vivs(7) });
  const liberados = [...app.run("Array.from(_viveirosLiberados())")];
  assert.equal(liberados.length, 5);
  assert.equal(app.run("_viveiroForaDoLimite(5)"), true);
  assert.equal(app.run("_viveiroForaDoLimite(6)"), true);
});

test("viveiros: índice inválido nunca é 'fora do limite'", () => {
  const app = cenario({ plano: "gratis", status: "ativo" }, { viveiros: vivs(2) });
  for (const i of ["-1", "99", "'abc'", "null", "undefined", "NaN"]) {
    assert.equal(app.run(`_viveiroForaDoLimite(${i})`), false, `índice ${i} devolveu true`);
  }
});

test("viveiros: a escolha do viveiro gratuito manda no grátis", () => {
  const app = cenario({ plano: "gratis", status: "ativo" }, {
    efetivo: efetivoDoServidor("gratis", 1, { viveiro_escolhido: "escolhido" }),
    viveiros: [cultivo("antigo", "2026-01-01"), { id: "escolhido" }, cultivo("outro", "2026-02-01")],
  });
  assert.deepEqual([...app.run("Array.from(_viveirosLiberados())")], [1],
    "a escolha do produtor vence a ordem automática");
  assert.equal(app.run("_viveiroForaDoLimite(0)"), true, "nem o cultivo mais antigo escapa da escolha");
});

test("viveiros: escolha apontando para viveiro que não existe mais cai na ordem automática", () => {
  const app = cenario({ plano: "gratis", status: "ativo" }, {
    efetivo: efetivoDoServidor("gratis", 1, { viveiro_escolhido: "viveiro-apagado" }),
    viveiros: [{ id: "a" }, cultivo("b", "2026-03-01")],
  });
  assert.deepEqual([...app.run("Array.from(_viveirosLiberados())")], [1],
    "sem o escolhido, vale o cultivo mais antigo");
});

// ═══════════════════════════════════════════════════════════════════════════
// A TRAVA GLOBAL (modo somente leitura)
// ═══════════════════════════════════════════════════════════════════════════

test("trava: sem assinatura e no grátis a conta nunca trava", () => {
  assert.equal(cenario(null, { viveiros: vivs(3) }).run("_contaBloqueada()"), false);
  assert.equal(cenario({ plano: "gratis", status: "ativo" }, { viveiros: vivs(3) }).run("_contaBloqueada()"), false);
  assert.equal(cenario({ status: "cancelado" }, { viveiros: vivs(3) }).run("_contaBloqueada()"), false,
    "sem campo plano, trata como grátis");
});

test("trava: com 1 viveiro só, nunca trava — cabe no grátis", () => {
  const app = cenario(
    { plano: "pro", status: "cancelado", proximo_vencimento: dia(-90) },
    { viveiros: vivs(1) });
  assert.equal(app.run("_contaBloqueada()"), false);
});

test("trava: plano pago cancelado, com mais de um viveiro, trava", () => {
  const app = cenario(
    { plano: "basico", status: "cancelado", proximo_vencimento: dia(+300) },
    { viveiros: vivs(3) });
  assert.equal(app.run("_contaBloqueada()"), true,
    "cancelado trava mesmo com a data no futuro");
});

test("trava: plano pago vencido além da carência trava mesmo com status 'ativo'", () => {
  const app = cenario(
    { plano: "basico", status: "ativo", proximo_vencimento: dia(-10) },
    { viveiros: vivs(3) });
  assert.equal(app.run("_contaBloqueada()"), true);
});

test("trava: perto do vencimento ainda não trava", () => {
  for (const d of [+10, +1, 0, -1, -5]) {
    const app = cenario(
      { plano: "basico", status: "ativo", proximo_vencimento: dia(d) },
      { viveiros: vivs(3) });
    assert.equal(app.run("_contaBloqueada()"), false, `vencimento em ${d} dias travou cedo demais`);
  }
});

test("trava: pendente trava só depois da carência", () => {
  const dentro = cenario({ plano: "basico", status: "pendente", proximo_vencimento: dia(-3) }, { viveiros: vivs(3) });
  assert.equal(dentro.run("_contaBloqueada()"), false);
  const fora = cenario({ plano: "basico", status: "pendente", proximo_vencimento: dia(-9) }, { viveiros: vivs(3) });
  assert.equal(fora.run("_contaBloqueada()"), true);
});

test("trava: _bloqueioEdicao avisa na tela quando barra", () => {
  const app = cenario({ plano: "basico", status: "cancelado" }, { viveiros: vivs(3) });
  assert.equal(app.run("_bloqueioEdicao()"), true);
  assert.equal(app.avisos.length, 1);
  assert.match(app.avisos[0], /somente leitura/i);
});

test("trava: _bloqueioEdicao não avisa quando deixa passar", () => {
  const app = cenario({ plano: "basico", status: "ativo", proximo_vencimento: dia(+10) }, { viveiros: vivs(3) });
  assert.equal(app.run("_bloqueioEdicao()"), false);
  assert.deepEqual(app.avisos, []);
});

test("trava: _bloqueioViveiro distingue conta travada de viveiro fora do limite", () => {
  const travada = cenario({ plano: "basico", status: "cancelado" }, { viveiros: vivs(3) });
  assert.equal(travada.run("_bloqueioViveiro(0)"), true);
  assert.match(travada.avisos[0], /somente leitura/i);

  const excedente = cenario(
    { plano: "basico", status: "ativo", limite_viveiros: 2, proximo_vencimento: dia(+10) },
    { viveiros: vivs(4) });
  assert.equal(excedente.run("_bloqueioViveiro(0)"), false, "dentro do limite passa");
  assert.equal(excedente.run("_bloqueioViveiro(3)"), true, "fora do limite barra");
  assert.match(excedente.avisos[0], /Viveiro bloqueado/i);
  assert.match(excedente.avisos[0], /Meu plano/,
    "o aviso tem de dizer para onde ir");
});

// ═══════════════════════════════════════════════════════════════════════════
// DIVERGÊNCIA ENTRE A ASSINATURA LOCAL E O PLANO EFETIVO
//
// É aqui que mora a inconsistência mais séria que este levantamento achou.
// Está registrada em docs/modulos-criticos.md; os casos abaixo fixam o
// comportamento ATUAL, para que a extração não o mude sem querer.
// ═══════════════════════════════════════════════════════════════════════════

test("cancelamento comercial com vários viveiros mantém a trava global com RPC", () => {
  const app = cenario(
    { plano: "basico", status: "cancelado", proximo_vencimento: dia(-90) },
    { efetivo: efetivoDoServidor("gratis", 1), viveiros: vivs(5) });

  assert.equal(app.run("_contaBloqueada()"), true,
    "a resposta da RPC não anula o cancelamento");
  assert.equal(app.run("_bloqueioEdicao()"), true);

  // O que AINDA protege: o limite por viveiro.
  assert.equal(app.run("_planoLimiteEfetivo()"), 1);
  assert.equal(app.run("_viveiroForaDoLimite(4)"), true);
  assert.equal(app.run("_bloqueioViveiro(4)"), true);
});

test("divergência: sem resposta do servidor, a regra local volta a valer", () => {
  // meu_plano_efetivo falhou (rede, permissão): script.js:15531 deixa
  // _planoEfetivo em null e só avisa no console.
  const app = cenario(
    { plano: "basico", status: "cancelado", proximo_vencimento: dia(-90) },
    { efetivo: null, viveiros: vivs(5) });
  assert.equal(app.run("_contaBloqueada()"), true,
    "sem o servidor, a trava local é a única que resta");
});

test("divergência: servidor diz pago, assinatura local diz vencida — o servidor vence", () => {
  const app = cenario(
    { plano: "basico", status: "cancelado", proximo_vencimento: dia(-90) },
    { efetivo: efetivoDoServidor("pro", 999999), viveiros: vivs(9) });
  assert.equal(app.run("_planoLimiteEfetivo()"), 999999);
  assert.equal(app.run("_viveiroForaDoLimite(8)"), false);
  assert.equal(app.run("_contaBloqueada()"), false);
});

test("divergência: limite_viveiros ausente na resposta do servidor cai para 1", () => {
  const app = cenario(
    { plano: "pro", status: "ativo", limite_viveiros: 999999, proximo_vencimento: dia(+300) },
    { efetivo: { plano: "pro" }, viveiros: vivs(9) });
  assert.equal(app.run("_planoLimiteEfetivo()"), 1,
    "ATUAL: a resposta do servidor tem precedência mesmo incompleta, e um "
    + "limite ausente vira 1 — rebaixa um pagante em dia");
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPATIBILIDADE DAS CHAVES gratis / gratis1
// ═══════════════════════════════════════════════════════════════════════════

test("chaves: 'gratis' e 'gratis1' NÃO são tratadas igual hoje", () => {
  /* As assinaturas antigas usam 'gratis'; o catálogo public.planos chama o
     mesmo plano de 'gratis1'. O script só conhece 'gratis'. */
  const app = carregar();
  assert.equal(app.run("'gratis' in _LIMITES_PLANO"), true);
  assert.equal(app.run("'gratis1' in _LIMITES_PLANO"), false,
    "_LIMITES_PLANO não tem a chave do catálogo");

  // 'gratis' não trava nunca:
  const antigo = cenario({ plano: "gratis", status: "cancelado", proximo_vencimento: dia(-90) }, { viveiros: vivs(4) });
  assert.equal(antigo.run("_contaBloqueada()"), false);

  // 'gratis1' é tratado como plano PAGO e trava:
  const novo = cenario({ plano: "gratis1", status: "cancelado", proximo_vencimento: dia(-90) }, { viveiros: vivs(4) });
  assert.equal(novo.run("_contaBloqueada()"), true,
    "ATUAL: a chave do catálogo cai no caminho de plano pago e bloqueia a conta");
});

test("chaves: 'gratis1' sem limite_viveiros também vira 1, por outro caminho", () => {
  const app = cenario({ plano: "gratis1", status: "ativo", proximo_vencimento: dia(+30) }, { viveiros: vivs(3) });
  assert.equal(app.run("_planoLimiteEfetivo()"), 1,
    "_LIMITES_PLANO['gratis1'] é undefined, e o `|| 1` segura");
});

// ═══════════════════════════════════════════════════════════════════════════
// CATÁLOGO: o rótulo do plano
// ═══════════════════════════════════════════════════════════════════════════

test("_planoLabel: sem catálogo carregado, tudo vira 'Grátis'", () => {
  const app = carregar();
  assert.equal(app.run("_planoLabel('pro')"), "Grátis",
    "ATUAL: com _planosCatalogo vazio, até um plano pago aparece como Grátis na tela");
});

test("_planoLabel: com catálogo carregado, devolve o nome do plano", () => {
  const app = carregar();
  app.run("_planosCatalogo = [{key:'pro', nome:'Pro'}, {key:'basico', nome:'Básico'}];");
  assert.equal(app.run("_planoLabel('pro')"), "Pro");
  assert.equal(app.run("_planoLabel('inexistente')"), "Grátis");
});
