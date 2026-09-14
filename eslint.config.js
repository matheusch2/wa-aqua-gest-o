/*
 * Configuracao do ESLint — ferramenta de DESENVOLVIMENTO do WA Aqua.
 *
 * O que ela NAO faz: nao e carregada pelo aplicativo, nao roda no celular do
 * cliente, nao altera nada em producao e nao corrige nem apaga codigo sozinha.
 * Serve so para "revisar" o JavaScript antes de publicar (rode: npm run verificar).
 *
 * As regras seguem o plano aprovado:
 *   - variavel nao declarada ......... ERRO   (no-undef)
 *   - codigo inalcancavel ............ ERRO   (no-unreachable)
 *   - duplicidades / padroes perigosos  ERRO  (base recomendada do ESLint)
 *   - variavel/parametro sem uso ..... ALERTA (no-unused-vars: warn)
 *   - estilo e formatacao ............ DESLIGADO (nao habilitamos regras de estilo)
 *
 * Um alerta NUNCA e autorizacao para apagar codigo: muita funcao aparece como
 * "sem uso" so porque e chamada pelo HTML (onclick) — inclusive pelos onclick
 * gerados dentro de template strings no proprio script.js, que o ESLint le como
 * texto. Por isso essa checagem fica sempre em ALERTA, nunca em erro.
 */

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  // O que ignorar por completo.
  {
    ignores: ["node_modules/**"],
  },

  // ── App no navegador: app/**/*.js ────────────────────────────────────────
  // Script classico (sem import/export). Globais externas carregadas via CDN.
  {
    files: ["app/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        supabase: "readonly", // biblioteca @supabase/supabase-js (CDN)
        Chart: "readonly", // biblioteca Chart.js (CDN)
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "error",
      "no-unreachable": "error",
      // caughtErrors:"none" — nao acusa o "e" de catch(e) sem uso: aqui isso e
      // so o padrao de ignorar a falha, nao codigo morto.
      "no-unused-vars": ["warn", { args: "after-used", vars: "all", caughtErrors: "none" }],
      // catch vazio e proposital aqui ("tenta; se falhar, segue"). Continua
      // pegando if/for/while realmente vazios (esses sim costumam ser defeito).
      "no-empty": ["error", { allowEmptyCatch: true }],
      // <\/script> e \" sao escapes propositais/inofensivos: fica so como alerta.
      "no-useless-escape": "warn",
    },
  },

  // ── Service worker: sw.js ────────────────────────────────────────────────
  // Ambiente proprio (self, caches, clients, fetch...). Sem declarar esses
  // globais, o no-undef acusaria falsos erros.
  {
    files: ["sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", { caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-useless-escape": "warn",
    },
  },

  // ── Ferramenta de linha de comando (Node): ferramentas/**/*.js ───────────
  // Usa require/module/process/__dirname. Roda no computador, nunca no app.
  {
    files: ["ferramentas/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", { caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-useless-escape": "warn",
    },
  },
];
