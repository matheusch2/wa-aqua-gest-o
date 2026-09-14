"use strict";
/*
 * Testes rapidos do "cerebro de calculo" do WA Aqua.
 *
 * Estes testes NAO abrem tela nem banco — eles conferem as CONTAS, que e onde
 * moram os erros que o cliente sente (dinheiro, peso, sobrevivencia, datas).
 * Rode com: npm test
 *
 * Cada bloco cobre a logica por tras de uma area do app:
 *   - parseDecimalBR/parseMoedaBR .... campos de racao, despesca, custo, tamanho
 *   - _obterTaxa / _calcularBiomassa .. biometria -> biomassa -> sobrevivencia
 *   - datas .......................... dias de cultivo do ciclo
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("./helpers/carregar-app");

// Compara numeros "quebrados" com uma folga (evita falha por casa decimal).
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

// ─────────────────────────────────────────────────────────────────────────────
// Leitura de numeros digitados por brasileiro (campos de racao, custo, tamanho)
// ─────────────────────────────────────────────────────────────────────────────
test("parseDecimalBR: virgula e SEMPRE decimal (2,5 kg = 2.5)", () => {
  assert.equal(app.parseDecimalBR("2,5"), 2.5);
  assert.equal(app.parseDecimalBR("0,5"), 0.5);
});

test("parseDecimalBR: ponto com 1-2 casas e decimal (bug do R$100/saco)", () => {
  // "250.75" precisa virar 250,75 — nao 25.075 (erro de 100x que ia pro banco)
  assert.equal(app.parseDecimalBR("250.75"), 250.75);
  assert.equal(app.parseDecimalBR("1.5"), 1.5);
});

test("parseDecimalBR: ponto de milhar (1.000 = mil)", () => {
  assert.equal(app.parseDecimalBR("1.000"), 1000);
  assert.equal(app.parseDecimalBR("1.234.567"), 1234567);
});

test("parseDecimalBR: vazio vira NaN (para a validacao pegar)", () => {
  assert.ok(Number.isNaN(app.parseDecimalBR("")));
  assert.ok(Number.isNaN(app.parseDecimalBR("abc")));
});

test("parseMoedaBR: vazio vira 0 e le o formato brasileiro", () => {
  assert.equal(app.parseMoedaBR(""), 0);
  assert.equal(app.parseMoedaBR("1.234,56"), 1234.56);
  assert.equal(app.parseMoedaBR("85,00"), 85);
});

test("_tamanhoHa: le 2,5 ha e trata vazio como null", () => {
  assert.equal(app._tamanhoHa("2,5"), 2.5);
  assert.equal(app._tamanhoHa(""), null);
  assert.equal(app._tamanhoHa(null), null);
});

test("formatarNumeroBR: devolve no padrao brasileiro (ponto milhar, virgula decimal)", () => {
  assert.equal(app.formatarNumeroBR(1234.5, 1), "1.234,5");
  assert.equal(app.formatarNumeroBR(1000, 0), "1.000");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tabela de taxa de alimentacao (usada para estimar biomassa/sobrevivencia)
// ─────────────────────────────────────────────────────────────────────────────
test("_obterTaxa: ancora 6 g = 5,10% (bate com a referencia Jory)", () => {
  assert.equal(app._obterTaxa(6), 5.1);
});

test("_obterTaxa: abaixo de 1 g nao estima (null)", () => {
  assert.equal(app._obterTaxa(0.5), null);
});

test("_obterTaxa: acima de 30 g usa o teto da tabela (1,45%)", () => {
  assert.equal(app._obterTaxa(30), 1.45);
  assert.equal(app._obterTaxa(45), 1.45);
});

test("_obterTaxa: interpola entre pesos (6,5 g fica entre 5,10 e 4,70 = 4,90)", () => {
  assert.ok(perto(app._obterTaxa(6.5), 4.9));
});

test("_obterTaxa: curva sempre decrescente e SEM DEGRAUS (v2)", () => {
  // Foi exatamente o degrau 20->21 g que fazia a sobrevivencia "pular".
  let anterior = Infinity;
  let maiorSalto = 0;
  for (let p = 1; p <= 30; p++) {
    const t = app._obterTaxa(p);
    assert.ok(t <= anterior + 1e-9, `taxa subiu de ${anterior} para ${t} em ${p} g`);
    maiorSalto = Math.max(maiorSalto, anterior === Infinity ? 0 : anterior - t);
    anterior = t;
  }
  // Nenhuma queda entre pesos vizinhos deve passar de 1 ponto percentual.
  assert.ok(maiorSalto <= 1.0, `houve um degrau grande de ${maiorSalto.toFixed(2)} pontos`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Biomassa e sobrevivencia a partir do consumo de racao + peso da biometria
// ─────────────────────────────────────────────────────────────────────────────
test("_calcularBiomassa: estima sobrevivencia pelo consumo (cenario 6 g)", () => {
  // 250.000 povoados, 68 kg/dia de racao, camarao de 6 g (taxa 5,10%)
  const r = app._calcularBiomassa(250000, 68, 6);
  assert.ok(perto(r.biomassa, 1333.33, 0.5), `biomassa ${r.biomassa}`);
  assert.ok(perto(r.sobrevivencia, 88.9, 0.2), `sobrevivencia ${r.sobrevivencia}`);
  assert.equal(r.quantidade, 222222);
});

test("_calcularBiomassa: sem consumo devolve null (nao inventa numero)", () => {
  assert.equal(app._calcularBiomassa(100000, 0, 6), null);
  assert.equal(app._calcularBiomassa(100000, -5, 6), null);
});

test("_calcularBiomassa: peso fora da tabela (0,5 g) devolve null", () => {
  assert.equal(app._calcularBiomassa(100000, 30, 0.5), null);
});

test("_pesoMedioAmostra: peso da amostra dividido pela quantidade contada", () => {
  assert.ok(perto(app._pesoMedioAmostra(250, 30), 8.333)); // 250 g / 30 camarões
  assert.equal(app._pesoMedioAmostra(300, 25), 12);
});

test("_pesoMedioAmostra: sem dado ou divisao por zero devolve null (nao chuta)", () => {
  assert.equal(app._pesoMedioAmostra(250, 0), null);
  assert.equal(app._pesoMedioAmostra(0, 30), null);
  assert.equal(app._pesoMedioAmostra(NaN, 30), null);
});

test("_custoRacaoEstimado: quilos x custo por kg (o custo que aparece ao lancar racao)", () => {
  // 10 kg de uma racao de R$ 6,965/kg = R$ 69,65
  assert.ok(perto(app._custoRacaoEstimado(10, 6.965), 69.65));
  assert.equal(app._custoRacaoEstimado(50, 4), 200);
});

test("_custoRacaoEstimado: sem consumo ou sem preco devolve null (nao mostra caixa)", () => {
  assert.equal(app._custoRacaoEstimado(0, 6.965), null);
  assert.equal(app._custoRacaoEstimado(10, 0), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Datas do ciclo (dias de cultivo) — sem cair para o dia anterior por fuso
// ─────────────────────────────────────────────────────────────────────────────
test("calcularDiasCultivo: conta incluindo o dia do povoamento", () => {
  assert.equal(app.calcularDiasCultivo("2026-01-01", "2026-01-10"), 10);
  assert.equal(app.calcularDiasCultivo("2026-01-01", "2026-01-01"), 1);
});

test("calcularDiasCultivo: sem data de povoamento devolve 0", () => {
  assert.equal(app.calcularDiasCultivo(null, "2026-01-10"), 0);
});

test("datas locais: ida e volta nao cai para o dia anterior (fuso)", () => {
  // O bug classico do toISOString(): 15/mar viraria 14/mar a noite.
  assert.equal(app._dataLocalISO(new Date(2026, 2, 15)), "2026-03-15");
  const d = app._parseDataLocal("2026-03-15");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 2); // marco (0 = janeiro)
  assert.equal(d.getDate(), 15);
});
