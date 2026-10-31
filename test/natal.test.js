"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// O enfeite de Natal só tem um jeito de dar errado em silêncio: a data. Ele
// aparece sozinho e some sozinho, então ninguém vai reclamar se ligar no mês
// errado — a gente é que descobre em janeiro, com o cliente olhando.
// Aqui o arquivo real roda num DOM de mentira, com o relógio na mão.
const fonte = fs.readFileSync(path.join(__dirname, "../app/natal.js"), "utf8");
const noop = () => {};

function ligouEm(ymd) {
  const [ano, mes, dia] = ymd.split("-").map(Number);
  const RealDate = Date;
  const classes = new Set();

  class DataFixa extends RealDate {
    constructor(...args) {
      // new Date() sem argumento é "agora"; com argumento, passa batido.
      if (args.length) super(...args);
      else super(ano, mes - 1, dia, 12, 0, 0);
    }
  }
  DataFixa.now = RealDate.now;
  DataFixa.parse = RealDate.parse;
  DataFixa.UTC = RealDate.UTC;

  const ctx = {
    Date: DataFixa,
    document: {
      readyState: "complete",
      documentElement: { classList: { add: (c) => classes.add(c) } },
      body: { insertAdjacentHTML: noop },
      createElement: () => ({ classList: { add: noop } }),
      querySelectorAll: () => [],
      addEventListener: noop,
    },
    requestAnimationFrame: noop,
    MutationObserver: function () { return { observe: noop }; },
  };
  vm.createContext(ctx);
  vm.runInContext(fonte, ctx);
  return classes.has("natal");
}

test("natal: dezembro liga, em qualquer ano", () => {
  for (const d of ["2026-12-01", "2026-12-25", "2026-12-31", "2027-12-10", "2030-12-05"]) {
    assert.equal(ligouEm(d), true, d);
  }
});

test("natal: some sozinho na virada do ano", () => {
  assert.equal(ligouEm("2026-12-31"), true);
  assert.equal(ligouEm("2027-01-01"), false);  // sem publicar versão pra tirar
  assert.equal(ligouEm("2027-01-02"), false);
});

test("natal: a janela de adiantamento vale só neste ano", () => {
  assert.equal(ligouEm("2026-10-30"), false);  // véspera: ainda desligado
  assert.equal(ligouEm("2026-10-31"), true);   // abre aqui
  assert.equal(ligouEm("2026-11-15"), true);
  assert.equal(ligouEm("2026-11-30"), true);   // último dia antes de dezembro
  assert.equal(ligouEm("2027-10-31"), false);  // não volta no ano seguinte
  assert.equal(ligouEm("2027-11-15"), false);
});

test("natal: o resto do ano fica limpo", () => {
  for (const d of ["2026-01-10", "2026-06-20", "2026-09-30", "2027-03-15", "2027-08-01"]) {
    assert.equal(ligouEm(d), false, d);
  }
});
