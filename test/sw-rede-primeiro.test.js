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
  let publicando = false;   // a janela de segundos em que o Pages devolve 404
  const batidas = {};       // quantas vezes o SERVIDOR foi mesmo incomodado
  const app = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    batidas[req.url] = (batidas[req.url] || 0) + 1;

    /* Um desenho de mentira, para contar quantas idas ao servidor ele custa.
       no-store de propósito, e isto é o coração do teste: com max-age a
       despensa do navegador já evitaria a segunda ida sozinha, e o teste
       passaria mesmo com o service worker indo à rede primeiro — foi o que
       aconteceu na primeira versão desta prova. Com no-store, a ÚNICA coisa
       capaz de poupar a ida é o Cache Storage do próprio service worker. */
    if (url.pathname === "/teste-arte.webp") {
      res.writeHead(200, { "Content-Type": "image/webp", "Cache-Control": "no-store" });
      // 1x1 webp valido
      return res.end(Buffer.from(
        "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64"));
    }

    if (publicando && url.pathname === "/teste-sw.html") {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end("<!doctype html><title>404</title><body>UNICORNIO");
    }
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
    batidas: (caminho) => batidas[caminho] || 0,
    publicar: (v) => { versao = v; },
    emPublicacao: (b) => { publicando = b; },
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
  t.after(() => s.fechar());
  const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
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

    /* O unicornio do GitHub. Durante a publicacao o arquivo velho ja saiu e o
       novo ainda nao entrou, e o Pages devolve 404. Um 404 NAO e falha de
       rede: chega como resposta normal e ia direto para a tela. O app tem de
       abrir na versao anterior em vez de mostrar a pagina de erro. */
    await t.test("durante a publicacao, o app abre em vez de mostrar o 404", async () => {
      s.emPublicacao(true);
      try {
        await p.goto(url);
        const t = await texto(p);
        assert.ok(!/UNICORNIO/.test(t), "o 404 do servidor vazou para a tela: " + t);
        assert.equal(t, "VERSAO-2", "devia abrir com a ultima versao guardada");
      } finally {
        s.emPublicacao(false);
      }
    });

    await t.test("voltou a internet, volta a buscar no servidor", async () => {
      s.publicar("3");
      await p.goto(url);
      assert.equal(await texto(p), "VERSAO-3");
    });

    /* A TERCEIRA PROMESSA: desenho guardado não volta à rede.
     *
     * A regra de ouro é do CÓDIGO. Aplicá-la aos desenhos custava uma ida e
     * volta inteira por ícone, toda vez — medido em 4G ruim: 210ms com ZERO
     * byte transferido, porque o arquivo já estava guardado e o fetch saía
     * para o servidor antes de olhar a despensa. Era o "demora a aparecer
     * essas imagens" da tela de Simular venda.
     *
     * Este teste guarda as duas metades da promessa de uma vez: o desenho não
     * incomoda o servidor duas vezes, E um desenho de versão nova incomoda,
     * porque senão a correção teria trocado lentidão por desenho velho.
     */
    await t.test("desenho guardado não vai à rede de novo (e o ?v= novo vai)", async () => {
      const buscar = (u) => p.evaluate((x) => fetch(x).then((r) => r.ok), u);

      assert.equal(await buscar("/teste-arte.webp?v=1"), true);
      const depoisDaPrimeira = s.batidas("/teste-arte.webp?v=1");
      assert.equal(depoisDaPrimeira, 1, "a primeira busca tem de ir ao servidor");

      await buscar("/teste-arte.webp?v=1");
      await buscar("/teste-arte.webp?v=1");
      assert.equal(s.batidas("/teste-arte.webp?v=1"), depoisDaPrimeira,
        "o desenho já estava guardado e mesmo assim o service worker foi ao servidor de novo");

      // A outra metade: trocar o desenho é trocar o ?v=, e aí TEM de ir buscar.
      assert.equal(await buscar("/teste-arte.webp?v=2"), true);
      assert.equal(s.batidas("/teste-arte.webp?v=2"), 1,
        "um ?v= novo é outro desenho: servir o guardado aqui seria servir desenho velho");
    });

  } finally {
    await navegador.close();

  }
});

/*
 * A porta de entrada do caminho "desenho guardado primeiro", testada sozinha.
 *
 * O teste do navegador acima prova que o desenho não volta à rede. Falta a
 * outra metade, que é o que esta correção poderia estragar sem ninguém ver:
 * o ehDesenho não pode confundir CÓDIGO com desenho. Se um dia ele passar a
 * responder true para script.js, o app inteiro congela na versão guardada e
 * a regra de ouro morre em silêncio — não quebra teste nenhum, só para de
 * chegar publicação no aparelho do cliente.
 *
 * Roda o sw.js de verdade num sandbox com um "self" de mentira, em vez de
 * copiar a função para cá, que sairia do sincronismo no primeiro ajuste.
 */
function carregarSw() {
  const src = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
  const vm = require("node:vm");
  const noop = () => {};
  const self = {
    addEventListener: noop, skipWaiting: noop,
    clients: { claim: noop },
    location: { origin: "https://waaqua.com.br" },
  };
  const ctx = {
    self, caches: { open: () => Promise.resolve({ add: noop, put: noop }), keys: () => Promise.resolve([]), match: () => Promise.resolve(null) },
    fetch: () => Promise.resolve({}), URL, Promise, console, RegExp, JSON,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
}

test("service worker: desenho é desenho, código é código", () => {
  const sw = carregarSw();
  assert.equal(typeof sw.ehDesenho, "function", "o sw.js deixou de expor ehDesenho");

  const pedido = (url, destino) => ({ url, destination: destino || "" });

  // Desenho: pode responder da cópia guardada.
  for (const u of [
    "https://waaqua.com.br/app/assets/sim-vender.webp?v=20261117",
    "https://waaqua.com.br/app/assets/icone-produto-saco.webp?v=20261119",
    "https://waaqua.com.br/logo-wa.webp?v=20261119",
    "https://waaqua.com.br/icon-192.png",
    "https://waaqua.com.br/apple-touch-icon.png",
  ]) assert.equal(sw.ehDesenho(pedido(u)), true, "devia ser tratado como desenho: " + u);

  // CÓDIGO E CASCA: têm de continuar no caminho da regra de ouro, sempre.
  for (const u of [
    "https://waaqua.com.br/app/script.js?v=20261119-a4",
    "https://waaqua.com.br/app/styles/01-base-e-painel.css?v=20261119",
    "https://waaqua.com.br/app/index.html",
    "https://waaqua.com.br/app/login.html",
    "https://waaqua.com.br/sw.js",
    "https://waaqua.com.br/app/manifest.json",
  ]) assert.equal(sw.ehDesenho(pedido(u)), false,
    "CÓDIGO sendo tratado como desenho — a regra de ouro morre aqui: " + u);

  // E pelo destination, que é o que o navegador diz quando a URL não entrega.
  assert.equal(sw.ehDesenho(pedido("https://waaqua.com.br/foto", "image")), true);
  assert.equal(sw.ehDesenho(pedido("https://waaqua.com.br/x", "script")), false);
  assert.equal(sw.ehDesenho(pedido("nao-e-url-nenhuma")), false);
});

/*
 * TODA FOLHA QUE A PÁGINA CARREGA TEM DE ESTAR NO PRECACHE.
 *
 * A lista ESSENCIAIS do sw.js é escrita à mão e não se atualiza sozinha.
 * Três folhas já escaparam dela — 99-mercado.css, 100-financeiro-v2.css e
 * uma do login —, e o sintoma não aparece em nenhum teste nem em nenhuma
 * tela: só offline, e só nas telas daquelas folhas, que abriam com o
 * conteúdo todo empilhado cru, sem estilo nenhum.
 *
 * É um erro de OMISSÃO, o tipo que nunca dá erro. Daí a guarda.
 */
test("service worker: nenhuma folha de estilo fica de fora do precache", () => {
  const sw = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
  const essenciais = sw.slice(sw.indexOf("const ESSENCIAIS"), sw.indexOf("];", sw.indexOf("const ESSENCIAIS")));

  for (const pagina of ["app/index.html", "app/login.html"]) {
    const html = fs.readFileSync(path.join(RAIZ, pagina), "utf8");
    const folhas = [...html.matchAll(/<link[^>]+href="([^"]+\.css)(?:\?[^"]*)?"/g)].map((m) => m[1]);
    assert.ok(folhas.length > 3, `${pagina}: achei só ${folhas.length} folhas — o teste parou de enxergar`);

    for (const f of folhas) {
      // o href é relativo à página; o precache guarda caminho absoluto
      const absoluto = f.startsWith("/") ? f : "/" + path.posix.join(path.posix.dirname(pagina), f);
      assert.ok(essenciais.includes(absoluto),
        `${pagina} carrega ${f}, que NÃO está no precache do sw.js. ` +
        `Offline, essa tela abre sem estilo. Acrescente "${absoluto}" em ESSENCIAIS.`);
    }
  }
});

/*
 * TODO SCRIPT PRÓPRIO QUE A PÁGINA CARREGA TEM DE ESTAR NO PRECACHE.
 *
 * A guarda das folhas de estilo existe desde que três CSS escaparam. A de
 * SCRIPTS não existia — e a modularização que começou em 26/11/2026 vai criar
 * um arquivo .js por módulo. Um script fora de ESSENCIAIS é pior que uma
 * folha fora: offline a tela não abre sem estilo, ela não abre.
 *
 * Só os scripts DA CASA entram na conta. Os de CDN (supabase-js, chart.js)
 * têm tratamento próprio no sw.js e não vivem no precache.
 */
test("service worker: nenhum script próprio fica de fora do precache", () => {
  const sw = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
  const essenciais = sw.slice(sw.indexOf("const ESSENCIAIS"), sw.indexOf("];", sw.indexOf("const ESSENCIAIS")));

  let vistos = 0;
  for (const pagina of ["app/index.html", "app/login.html"]) {
    const html = fs.readFileSync(path.join(RAIZ, pagina), "utf8");
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)(?:\?[^"]*)?"/g)]
      .map((m) => m[1])
      .filter((src) => !/^https?:\/\//.test(src));   // CDN tem caminho próprio

    for (const f of scripts) {
      vistos++;
      const absoluto = f.startsWith("/") ? f : "/" + path.posix.join(path.posix.dirname(pagina), f);
      assert.ok(essenciais.includes(absoluto),
        `${pagina} carrega ${f}, que NÃO está no precache do sw.js. ` +
        `Offline essa tela não abre. Acrescente "${absoluto}" em ESSENCIAIS.`);
    }
  }
  assert.ok(vistos >= 2,
    `achei só ${vistos} scripts próprios nas páginas — o teste parou de enxergar, ` +
    "provavelmente porque a forma de carregar mudou (módulo ES, import, bundler).");
});

test("service worker: o precache não aponta para arquivo que não existe", () => {
  const sw = fs.readFileSync(path.join(RAIZ, "sw.js"), "utf8");
  const bloco = sw.slice(sw.indexOf("const ESSENCIAIS"), sw.indexOf("];", sw.indexOf("const ESSENCIAIS")));
  const caminhos = [...bloco.matchAll(/"(\/[^"]*)"/g)].map((m) => m[1]);
  assert.ok(caminhos.length > 10, "não consegui ler a lista ESSENCIAIS");

  const faltando = caminhos.filter((c) => {
    if (c === "/") return false;                    // a raiz é servida pelo index
    return !fs.existsSync(path.join(RAIZ, c.replace(/^\//, "")));
  });
  assert.deepEqual(faltando, [],
    "o precache pede arquivo que não existe mais — a instalação do service worker " +
    "falha nesses e a reserva offline fica incompleta: " + faltando.join(", "));
});

/*
 * TODA PORTA DE ENTRADA PRECISA DECLARAR O MANIFESTO, E ESTAR NO ESCOPO.
 *
 * No Android, uma pagina que nao encontra o manifesto — ou que esta FORA do
 * scope dele — abre como site comum: a barra com o X, o dominio e os tres
 * pontinhos fica em cima, e o sistema parece um site espremido.
 *
 * Foi o que aconteceu com quem instalou antes de 21/08/2026, quando o app
 * morava na raiz: o atalho antigo aponta para /login.html, que nao declarava
 * manifesto e estava fora do scope "/app/". Medido no Chromium: antes,
 * manifesto NENHUM e fora do escopo; depois, manifesto achado e dentro.
 *
 * O "id" do manifesto e "/login.html" justamente para amarrar aquele atalho
 * antigo ao app. Trocar o id faria o Chrome tratar como OUTRO app, e quem ja
 * instalou ganharia um icone duplicado.
 */
test("pwa: toda porta de entrada declara o manifesto e cabe no escopo", () => {
  const manifesto = JSON.parse(fs.readFileSync(path.join(RAIZ, "app/manifest.json"), "utf8"));

  assert.equal(manifesto.display, "standalone",
    "sem display standalone o app abre em aba, com a barra do navegador");
  assert.equal(manifesto.id, "/login.html",
    "o id amarra o atalho antigo (app na raiz ate 21/08/2026); trocar duplica o icone de quem ja instalou");

  const portas = {
    "index.html": "/",                  // pagina de vendas
    "login.html": "/login.html",        // a ponte dos atalhos antigos
    "app/index.html": "/app/index.html",
    "app/login.html": "/app/login.html",
  };

  for (const [arquivo, url] of Object.entries(portas)) {
    const html = fs.readFileSync(path.join(RAIZ, arquivo), "utf8");
    assert.match(html, /<link[^>]+rel="manifest"/,
      `${arquivo} nao declara o manifesto: abre como site, com a barra do navegador em cima`);
    assert.ok(url.startsWith(manifesto.scope),
      `${url} esta FORA do scope "${manifesto.scope}": o Chrome trata como site comum`);
  }

  assert.ok(manifesto.start_url.startsWith(manifesto.scope),
    `start_url "${manifesto.start_url}" fora do scope "${manifesto.scope}"`);
});
