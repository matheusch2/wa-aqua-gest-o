"use strict";
/*
 * Carrega o app/script.js DE VERDADE num ambiente Node, colocando "dubles"
 * (stubs) no lugar do navegador e do Supabase, e devolve as funcoes puras de
 * calculo para os testes.
 *
 * Por que assim: o script.js e um script de navegador (usa document, window,
 * Supabase). Em vez de copiar as funcoes para o teste (que sairiam do sincronismo
 * com o app), a gente roda o arquivo original num "sandbox" e testa as funcoes
 * reais. Nao altera nada do app — so le o arquivo.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(path.join(__dirname, "..", "..", "app", "script.js"), "utf8");

const noop = () => {};
function elemento() {
  return {
    addEventListener: noop, removeEventListener: noop, setAttribute: noop,
    appendChild: noop, remove: noop, setSelectionRange: noop, focus: noop, click: noop,
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    style: {}, dataset: {}, value: "", innerHTML: "", textContent: "",
    querySelector: () => null, querySelectorAll: () => [],
  };
}
const documento = {
  addEventListener: noop, removeEventListener: noop,
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => elemento(), body: elemento(), documentElement: { style: {} },
};
const janela = {
  addEventListener: noop, removeEventListener: noop,
  location: { href: "", search: "", reload: noop },
  matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
  history: { pushState: noop, replaceState: noop },
};
const supabaseFalso = {
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: noop,
      signOut: async () => ({}),
    },
    from: () => ({
      select: () => ({ eq: () => ({}) }), insert: () => ({}),
      update: () => ({ eq: () => ({}) }), delete: () => ({ eq: () => ({}) }),
    }),
  }),
};

const sandbox = {
  supabase: supabaseFalso,
  document: documento,
  window: janela,
  location: janela.location,
  history: janela.history,
  navigator: { onLine: true, serviceWorker: { register: async () => ({}) } },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  console,
  crypto: { randomUUID: () => "00000000-0000-0000-0000-000000000000" },
  setTimeout, clearTimeout, setInterval, clearInterval,
  matchMedia: janela.matchMedia,
  MutationObserver: function () { return { observe: noop, disconnect: noop }; },
  Chart: function () { return { destroy: noop, update: noop, resize: noop }; },
};
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);

// Funcoes puras que queremos expor para os testes. O epilogo roda no MESMO
// escopo do script, entao enxerga tanto "function" quanto "const".
const NOMES = [
  "_obterTaxa", "_calcularBiomassa",
  "parseDecimalBR", "parseMoedaBR", "_numeroMoedaBR",
  "_tamanhoHa", "_fmtHa", "formatarNumeroBR",
  "_parseDataLocal", "_dataLocalISO", "_hojeLocal", "calcularDiasCultivo",
];
const epilogo = "\n;globalThis.__TESTE__ = {" +
  NOMES.map((n) => `${n}: (typeof ${n} !== "undefined" ? ${n} : undefined)`).join(",") +
  "};";

vm.runInContext(src + epilogo, sandbox, { filename: "app/script.js" });

module.exports = sandbox.__TESTE__;
