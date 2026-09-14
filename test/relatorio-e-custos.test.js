"use strict";
/*
 * Testes das contas do RELATORIO DE CICLO e dos CUSTOS.
 *
 * Cobre a logica por tras do relatorio final e do agrupamento de custos —
 * FCA por biometria, vencimento de boletos, e a juncao de nomes de custo.
 * Rode junto com o resto: npm test
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("./helpers/carregar-app");

const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
// _seriesCiclo roda no sandbox: seus arrays tem prototype de outro "realm".
// Array.from traz para o realm do teste, senao o deepEqual estrito reclama do
// molde mesmo com os valores identicos.
const arr = (x) => Array.from(x);

// Data em "AAAA-MM-DD" deslocada N dias a partir de hoje (para testar boletos).
function isoOffset(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// _seriesCiclo — as series do relatorio (biomassa e FCA ao longo do ciclo)
// ─────────────────────────────────────────────────────────────────────────────
// Cenario controlado: 100.000 povoados, 100% de sobrevivencia, sem despescas.
//   Biometria 1: dia 08, 5 g  | racao acumulada 200 kg
//   Biometria 2: dia 15, 10 g | racao acumulada 500 kg
const cicloExemplo = {
  totalPovoado: 100000,
  dataPovoamento: "2026-01-01",
  producaoTotal: 900,
  sobrevivencia: 100,
  biometrias: [
    { data: "2026-01-08", gramatura: 5 },
    { data: "2026-01-15", gramatura: 10 },
  ],
  racoes: [
    { data: "2026-01-08", racao: 200 },
    { data: "2026-01-15", racao: 300 },
  ],
  despescas: [],
};

test("_seriesCiclo: dias de cultivo de cada biometria", () => {
  const s = app._seriesCiclo(cicloExemplo);
  assert.deepEqual(arr(s.dias), [8, 15]);
});

test("_seriesCiclo: peso e crescimento entre biometrias", () => {
  const s = app._seriesCiclo(cicloExemplo);
  assert.deepEqual(arr(s.peso), [5, 10]);
  assert.deepEqual(arr(s.cresc), [null, 5]); // 1a nao tem anterior; 2a subiu 5 g
});

test("_seriesCiclo: biomassa em pe = vivos x peso (kg)", () => {
  const s = app._seriesCiclo(cicloExemplo);
  // 100.000 x 5 g / 1000 = 500 kg ; 100.000 x 10 g / 1000 = 1000 kg
  assert.deepEqual(arr(s.biomassa), [500, 1000]);
});

test("_seriesCiclo: FCA por biometria = racao acumulada / biomassa", () => {
  const s = app._seriesCiclo(cicloExemplo);
  assert.deepEqual(arr(s.racaoAcum), [200, 500]);
  assert.ok(perto(s.fca[0], 0.4)); // 200 / 500
  assert.ok(perto(s.fca[1], 0.5)); // 500 / 1000
});

test("_seriesCiclo: FCA acumulada e do periodo (com sobrevivencia final)", () => {
  const s = app._seriesCiclo(cicloExemplo);
  assert.deepEqual(arr(s.fcaDias), [8, 15]);
  assert.ok(perto(s.fcaAcum[0], 0.4));
  assert.ok(perto(s.fcaAcum[1], 0.5));
  // periodo: 1o e lacuna (null); 2o = (500-200)/(1000-500) = 0,6
  assert.equal(s.fcaPeriodo[0], null);
  assert.ok(perto(s.fcaPeriodo[1], 0.6));
});

test("_seriesCiclo: ciclo sem biometrias nao quebra", () => {
  const s = app._seriesCiclo({ totalPovoado: 1000, dataPovoamento: "2026-01-01" });
  assert.deepEqual(arr(s.dias), []);
  assert.deepEqual(arr(s.fca), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// _statusBoleto — vencimento (vencido / hoje / proximo / ok)
// ─────────────────────────────────────────────────────────────────────────────
test("_statusBoleto: vence hoje", () => {
  assert.equal(app._statusBoleto(isoOffset(0), 0).tipo, "hoje");
});

test("_statusBoleto: vence em poucos dias = proximo (com contagem)", () => {
  const st = app._statusBoleto(isoOffset(0), 5);
  assert.equal(st.tipo, "proximo");
  assert.equal(st.dias, 5);
});

test("_statusBoleto: limite de 10 dias ainda e proximo; 11 ja e ok", () => {
  assert.equal(app._statusBoleto(isoOffset(0), 10).tipo, "proximo");
  assert.equal(app._statusBoleto(isoOffset(0), 11).tipo, "ok");
});

test("_statusBoleto: prazo folgado = ok", () => {
  assert.equal(app._statusBoleto(isoOffset(0), 30).tipo, "ok");
});

test("_statusBoleto: passou da data = vencido (com dias de atraso)", () => {
  // comprado ha 40 dias, prazo 10 -> venceu ha 30 dias
  const st = app._statusBoleto(isoOffset(-40), 10);
  assert.equal(st.tipo, "vencido");
  assert.equal(st.dias, 30);
});

// ─────────────────────────────────────────────────────────────────────────────
// Custos: rotulos e juncao de nomes (o que agrupa custos iguais no relatorio)
// ─────────────────────────────────────────────────────────────────────────────
test("_custoFixoCatLabel: traduz a categoria (e cai em 'Outro' se nao conhece)", () => {
  assert.equal(app._custoFixoCatLabel("energia"), "Energia");
  assert.equal(app._custoFixoCatLabel("mao_de_obra"), "Mão de obra");
  assert.equal(app._custoFixoCatLabel("xyz"), "Outro");
});

test("_normNomeCusto: tira acento, minusculo e espaco extra (para agrupar iguais)", () => {
  assert.equal(app._normNomeCusto("  Ração   Premium "), "racao premium");
  // "Racao premium" e "Ração Premium" viram a MESMA chave -> nao duplicam
  assert.equal(app._normNomeCusto("Racao premium"), app._normNomeCusto("Ração Premium"));
});

test("_melhorRotulo: entre grafias iguais, mostra a ACENTUADA", () => {
  assert.equal(app._melhorRotulo("Racao", "Ração"), "Ração");
  assert.equal(app._melhorRotulo("Ração", "Racao"), "Ração");
  assert.equal(app._melhorRotulo(null, "Novo"), "Novo");
});

test("_rotuloCurtoViveiro: tira o 'Viveiro -' e encurta nomes longos", () => {
  assert.equal(app._rotuloCurtoViveiro("Viveiro - 12"), "12");
  assert.equal(app._rotuloCurtoViveiro("Berçário"), "Berçár…");
  assert.equal(app._rotuloCurtoViveiro(""), "?");
});

// ─────────────────────────────────────────────────────────────────────────────
// _custosManuaisDoCiclo / _custosCicloAtivo — custos do ciclo + rateio fixo
// ─────────────────────────────────────────────────────────────────────────────
// Quatro custos: dois do ciclo "A" (por id), um do ciclo "B", e um legado sem
// ciclo_id (so a data diz a qual ciclo pertence).
const custosExemplo = [
  { tipo: "produto", valor: 100, data: "2026-01-05", cicloId: "A" },
  { tipo: "outro", valor: 50, data: "2026-01-10", cicloId: "A" },
  { tipo: "produto", valor: 30, data: "2026-02-20", cicloId: "B" },
  { tipo: "outro", valor: 20, data: "2026-01-08", cicloId: null },
];

test("_custosManuaisDoCiclo: casa pelo ciclo_id e pega o legado pela janela de datas", () => {
  // ciclo A em janeiro: os dois do A (por id) + o legado sem id que caiu em janeiro.
  // O do ciclo B (fevereiro) fica de fora.
  const m = app._custosManuaisDoCiclo(custosExemplo, "A", "2026-01-01", "2026-01-31");
  assert.equal(m.length, 3);
  assert.equal(arr(m).reduce((s, c) => s + c.valor, 0), 170);
});

test("_custosManuaisDoCiclo: sem ciclo_id, filtra so pela janela de datas", () => {
  const m = app._custosManuaisDoCiclo(custosExemplo, null, "2026-01-01", "2026-01-31");
  assert.equal(m.length, 3); // o de fevereiro (ciclo B) fica de fora
});

test("_custosCicloAtivo: separa produtos de outros e soma o rateio congelado", () => {
  const r = app._custosCicloAtivo({ custos: custosExemplo }, "A", "2026-01-01", "2026-01-31", 200);
  assert.equal(r.totalProdutos, 100); // so o produto do ciclo A
  assert.equal(r.totalOutros, 70); // 50 (A) + 20 (legado de janeiro)
  assert.equal(r.totalManuais, 170);
  assert.equal(r.rateioFixo, 200); // rateio congelado e respeitado
  assert.equal(r.total, 370); // 170 + 200
  assert.equal(r.manuais.length, 3);
});

test("_custosCicloAtivo: rateio congelado ZERO e respeitado (nao recalcula)", () => {
  // 0 e "falsy", mas o codigo checa null/undefined/NaN — entao zero vale como zero.
  const r = app._custosCicloAtivo({ custos: custosExemplo }, "A", "2026-01-01", "2026-01-31", 0);
  assert.equal(r.rateioFixo, 0);
  assert.equal(r.total, 170); // so os custos manuais, sem rateio
});
