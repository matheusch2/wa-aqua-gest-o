"use strict";
/*
 * O WEBHOOK DO ASAAS, RODANDO DE VERDADE
 *
 * Esta função é onde o dinheiro vira acesso, e ela é TypeScript rodando no
 * Deno — nada que o resto da suíte alcance. Em vez de reescrever a lógica
 * aqui (um teste que confere uma cópia não confere nada), o arquivo do
 * repositório é carregado como está, com um PostgREST de mentira por trás.
 *
 * O Node desta máquina precisa da flag --experimental-strip-types para ler
 * TypeScript, e `npm test` não passa flag nenhuma. Por isso o ensaio roda
 * num processo filho e devolve o resultado em JSON.
 */
const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ensaio = path.join(__dirname, "helpers", "webhook-asaas.mts");

let saida;
try {
  saida = execFileSync(process.execPath, ["--experimental-strip-types", "--no-warnings", ensaio],
    { encoding: "utf8", timeout: 60000 });
} catch (e) {
  saida = `${e.stdout || ""}${e.stderr || ""}`;
}

const marca = saida.indexOf("__RESULTADOS__");
const casos = marca >= 0 ? JSON.parse(saida.slice(marca + "__RESULTADOS__".length).trim()) : null;

test("webhook: o ensaio conseguiu carregar a função", () => {
  assert.ok(casos, "o processo filho não devolveu resultados:\n" + saida.slice(0, 1200));
  assert.ok(casos.length >= 9, `só ${casos.length} casos rodaram — o ensaio parou no meio?`);
});

for (const c of casos || []) {
  test(`webhook: ${c.nome}`, () => { assert.equal(c.erro, null, c.erro || ""); });
}
