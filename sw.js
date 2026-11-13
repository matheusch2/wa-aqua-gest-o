/*!
 * WA Aqua Gestão — service worker
 * Copyright © 2026 Matheus. Todos os direitos reservados / All rights reserved.
 *
 * O que ele faz:
 *  1. Habilita o botão "Instalar" no computador (Chrome/Edge) e permite
 *     empacotar o app para a Play Store.
 *  2. Dá resistência offline: se a internet cair, o app abre com a última
 *     versão que passou por aqui em vez de dar tela de erro.
 *
 * REGRA DE OURO — REDE SEMPRE PRIMEIRO.
 * Este arquivo NUNCA pode servir código velho quando há internet. As
 * atualizações do sistema chegam por deploy no GitHub Pages, e um service
 * worker "cache primeiro" seguraria a versão antiga no aparelho do cliente
 * por tempo indeterminado. Por isso toda requisição tenta a rede antes; o
 * que está guardado só entra em cena quando a rede falha.
 *
 * PARA DESLIGAR TUDO (se um dia der problema):
 *  1. Troque o corpo do "fetch" abaixo por nada (apague o listener).
 *  2. Publique. Como o navegador rebusca o sw.js a cada navegação, em uma
 *     visita todos os aparelhos param de usar cache.
 */

// Trocar este nome faz o "activate" apagar o cache antigo sozinho. A REGRA:
// mude aqui a cada publicacao, sem excecao. Trocar o nome muda o sw.js, que
// reinstala, limpa o que estava guardado e re-guarda os arquivos novos — e a
// abertura offline nunca serve codigo velho.
//
// (O comentario antigo mandava copiar a versao do script.js. Nao serve: tem
// publicacao que mexe so no CSS e nao bumpa o script.js, e ai o cache ficaria
// parado. A data da publicacao, com uma letra pra desempatar, basta.)
const CACHE = "waaqua-20261113i";

// Guardados já na instalação, para a primeira abertura sem internet funcionar.
// Sem "?v=" de propósito: a busca de reserva ignora a query (ver ignoreSearch).
// Caminhos ABSOLUTOS: este arquivo mora na raiz, mas guarda coisas de duas
// pastas diferentes (a página de vendas e o sistema, em /app). Com caminho
// relativo, "/app/..." seria resolvido errado.
const ESSENCIAIS = [
  // Página de vendas (a raiz do site)
  "/",
  "/index.html",
  "/style.css",
  // O sistema
  "/app/login.html",
  "/app/index.html",
  "/app/imprimir.html",   // página de impressão aberta no navegador quando o
                          // app está instalado (o iPhone não imprime de lá)
  "/app/styles/01-base-e-painel.css",
  "/app/styles/02-viveiros-e-formularios.css",
  "/app/styles/03-tema-custos-e-crescimento.css",
  "/app/styles/04-configuracoes.css",
  "/app/styles/05-financeiro.css",
  "/app/styles/06-viveiro-e-relatorios.css",
  "/app/styles/07-planos-e-complementos.css",
  "/app/styles/90-desktop.css",
  "/app/styles/91-natal.css",   // enfeite de dezembro; o par deles some
  "/app/natal.js",              // do caminho sozinho fora do mês
  "/app/styles/92-home.css",    // tela inicial do celular
  "/app/script.js",   // o cérebro do app: sem ele no precache, a PRIMEIRA
                      // abertura offline carregava a casca sem funcionar.
                      // Continua rede-primeiro; isto é só a reserva offline.
  "/app/manifest.json",
  "/logo-wa.jpg",
  // Comuns
  "/icon-192.png",
  "/favicon.ico",
  "/favicon-96.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/privacidade.html",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      // Um a um, e não addAll: o addAll desiste de TUDO se um único arquivo
      // falhar, e aí a instalação inteira ia por água abaixo por causa de um
      // ícone que não baixou.
      .then((c) => Promise.allSettled(ESSENCIAIS.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// O que este service worker tem permissão de tocar.
function podeCuidar(req) {
  if (req.method !== "GET") return false;
  let url;
  try { url = new URL(req.url); } catch (e) { return false; }
  // Supabase (banco, login) e as bibliotecas do CDN passam direto, sem cache.
  if (url.origin !== self.location.origin) return false;
  // Painel administrativo sempre direto da rede — ele não tem "?v=" para
  // furar cache e é a última tela onde alguém quer ver dado velho.
  if (url.pathname.startsWith("/ch2")) return false;
  if (url.pathname.endsWith("/sw.js")) return false;
  // Verificação do Google e Digital Asset Links: são perguntas que o Google faz
  // ao SERVIDOR. Uma cópia guardada poderia responder por um arquivo que já não
  // existe mais — melhor deixar passar direto, sempre.
  if (/^\/google[0-9a-f]+\.html$/.test(url.pathname)) return false;
  if (url.pathname.startsWith("/.well-known/")) return false;
  // Mesma coisa para o que o Google lê para montar o resultado da busca.
  if (url.pathname === "/robots.txt" || url.pathname === "/sitemap.xml") return false;
  if (url.pathname === "/favicon.ico") return false;
  return true;
}

// A página em si (a navegação, ou qualquer .html).
function ehPagina(req) {
  if (req.mode === "navigate") return true;
  try { return /\.html$/.test(new URL(req.url).pathname); } catch (e) { return false; }
}

/*
 * REDE PRIMEIRO DE VERDADE.
 *
 * Um fetch(req) comum obedece a REGRA DE OURO só pela metade: ele sai daqui,
 * mas o navegador tem uma despensa própria no caminho, e o GitHub Pages manda
 * cada página com um bilhete de 10 minutos de validade (Cache-Control:
 * max-age=600). Dentro desses 10 minutos o navegador responde da despensa dele
 * sem chegar no servidor — e o "rede primeiro" entregava a casca velha.
 *
 * Isso não estragava só a página: a casca é quem diz quais arquivos carregar
 * (script.js?v=..., css?v=...). Casca velha pede os ?v= velhos, que estão
 * todos guardados, e o app inteiro fica na versão anterior com a nova no ar.
 * Era o "publiquei mas não chegou".
 *
 * O no-store vale SÓ pra página, que é justamente o arquivo sem "?v=" pra se
 * virar sozinho. Os versionados mudam de endereço a cada publicação, então
 * ali a despensa do navegador é amiga: desligar só faria baixar tudo à toa.
 *
 * Prova: test/sw-rede-primeiro.test.js sobe um servidor com os mesmos
 * cabeçalhos do GitHub Pages e falha se a publicação não chegar no cliente.
 */
function buscarNaRede(req) {
  if (!ehPagina(req)) return fetch(req);
  return fetch(req.url, { cache: "no-store", credentials: "same-origin" })
    .then((resposta) => {
      // Navegação não aceita resposta vinda de redirecionamento. Como pedimos
      // pela URL, e não pelo Request original, remontamos nesse caso — senão a
      // página simplesmente não abre.
      if (!resposta.redirected) return resposta;
      return resposta.blob().then((corpo) => new Response(corpo, {
        status: resposta.status,
        statusText: resposta.statusText,
        headers: resposta.headers,
      }));
    });
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (!podeCuidar(req)) return; // deixa o navegador cuidar normalmente

  evento.respondWith(
    buscarNaRede(req)
      .then((resposta) => {
        // Guarda uma cópia só do que veio certo e do próprio site.
        if (resposta && resposta.ok && resposta.type === "basic") {
          const copia = resposta.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return resposta;
      })
      .catch(async () => {
        // ignoreSearch é o detalhe que faz isto conviver com o "?v=" das
        // atualizações: sem ele, o script.js guardado como "?v=20260820b"
        // nunca serviria de reserva depois do deploy seguinte, e o app
        // offline quebraria a cada atualização.
        const guardado = await caches.match(req, { ignoreSearch: true });
        if (guardado) return guardado;

        if (req.mode === "navigate") {
          // Sem internet, devolve a tela mais próxima do que a pessoa pediu:
          // quem tentou abrir o sistema quer o sistema, não a página de vendas.
          const noApp = new URL(req.url).pathname.startsWith("/app");
          const alvos = noApp
            ? ["/app/login.html", "/app/index.html", "/index.html"]
            : ["/index.html", "/app/login.html"];
          for (const a of alvos) {
            const guardado = await caches.match(a, { ignoreSearch: true });
            if (guardado) return guardado;
          }
        }

        return new Response(
          "Sem conexão com a internet. Abra o app novamente quando o sinal voltar.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      })
  );
});
