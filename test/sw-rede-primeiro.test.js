"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

/*
 * O service worker é o arquivo mais perigoso do projeto: errar nele não quebra
 * uma tela, quebra o app inteiro no aparelho de todo mundo, e a gente só
 * descobre pelo cliente. Ele tem duas promessas, e as duas só dá pra conferir
 * com um navegador de verdade rodando o porteiro:
 *
 *   1. Publicou, chegou. Nada de servir casca velha quando há internet.
 *   2. Sem internet, o app abre assim mesmo.
 *
 * São promessas que brigam entre si — o conserto de uma é exatamente o jeito
 * de quebrar a outra. Por isso as duas moram neste arquivo, juntas.
 *
 * O servidor abaixo imita o GitHub Pages no detalhe que importa: manda as
 * páginas com Cache-Control: max-age=600. Foi esse bilhete de 10 minutos que
 * furou o "rede primeiro" — o navegador respondia da despensa dele sem nem
 * chegar no servidor, e a casca velha pedia os ?v= velhos, segurando a
 * publicação inteira.
 *
 * Playwright não é dependência do projeto. Sem ele, o teste se pula.
 */

let chromium = null;
try { chromium = require("playwright").chromium; } catch (e) { /* sem navegador */ }

const RAIZ = path.join(__dirname, "..");
const PAGINA = (versao) =>
  `<!doctype html><meta charset="utf-8"><title>t</title><body>VERSAO-${versao}`;

// Servidor com os cabeçalhos do GitHub Pages. `publicar` troca o conteúdo da
// página sem reiniciar nada, que é o que uma publicação faz na vida real.
function servidor() {
  let versao = "1";
  const app = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");

    if (url.pathname === "/teste-sw.html") {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "max-age=600",   // o bilhete de 10 minutos
      });
      return res.end(PAGINA(versao));
    }
    if (url.pathname === "/registra.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end('<!doctype html><meta charset="utf-8"><title>r</title>' +
        '<body>a<script>navigator.serviceWorker.register("/sw.js")</script>');
    }

    // O resto sai do repositório — inclusive o sw.js de verdade, que é o que
    // está sendo testado.
    const alvo = path.join(RAIZ, url.pathname);
    if (!alvo.startsWith(RAIZ) || !fs.existsSync(alvo) || fs.statSync(alvo).isDirectory()) {
      res.writeHead(404);
      return res.end("nao achei");
    }
    res.writeHead(200, {
      "Content-Type": alvo.endsWith(".js") ? "application/javascript" : "application/octet-stream",
      // Como no GitHub Pages: o próprio sw.js nunca é guardado.
      "Cache-Control": alvo.endsWith("sw.js") ? "no-cache" : "max-age=600",
    });
    fs.createReadStream(alvo).pipe(res);
  });

  return {
    ouvir: () => new Promise((ok) => app.listen(0, "127.0.0.1", () => ok(app.address().port))),
    publicar: (v) => { versao = v; },
    fechar: () => new Promise((ok) => app.close(ok)),
  };
}

async function comPorteiro(porta, ctx) {
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${porta}/registra.html`);
  for (let i = 0; i < 3; i++) {
    const noComando = await p.evaluate(() => !!navigator.serviceWorker.controller);
    if (noComando) break;
    await p.waitForTimeout(500);
    await p.reload();
  }
  assert.equal(await p.evaluate(() => !!navigator.serviceWorker.controller),
    true, "o service worker não assumiu o comando");
  return p;
}

const texto = (p) => p.evaluate(() => document.body.textContent.trim());

test("service worker: as duas promessas", { skip: chromium ? false : "playwright não instalado", timeout: 90000 }, async (t) => {
  const s = servidor();
  const porta = await s.ouvir();
  const navegador = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx = await navegador.newContext();

  try {
    const p = await comPorteiro(porta, ctx);
    const url = `http://127.0.0.1:${porta}/teste-sw.html`;

    await t.test("publicou, chegou (nem que o navegador ache que tem cópia boa)", async () => {
      await p.goto(url);
      assert.equal(await texto(p), "VERSAO-1");

      s.publicar("2");                      // publicação, agora mesmo
      await p.goto(url);                    // cliente fecha e abre o app

      assert.equal(await texto(p), "VERSAO-2",
        "o cliente ficou na casca velha: o cache HTTP do navegador furou o rede-primeiro");
    });

    await t.test("sem internet, o app abre assim mesmo", async () => {
      await ctx.setOffline(true);
      try {
        await p.goto(url);
        assert.equal(await texto(p), "VERSAO-2",
          "offline o app tem que abrir com a última versão guardada");
      } finally {
        await ctx.setOffline(false);
      }
    });

    await t.test("voltou a internet, volta a buscar no servidor", async () => {
      s.publicar("3");
      await p.goto(url);
      assert.equal(await texto(p), "VERSAO-3");
    });
  } finally {
    await navegador.close();
    await s.fechar();
  }
});
