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

const CACHE = "waaqua-v1";

// Guardados já na instalação, para a primeira abertura sem internet funcionar.
// Sem "?v=" de propósito: a busca de reserva ignora a query (ver ignoreSearch).
const ESSENCIAIS = [
  "./",
  "index.html",
  "login.html",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
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
  return true;
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (!podeCuidar(req)) return; // deixa o navegador cuidar normalmente

  evento.respondWith(
    fetch(req)
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
          const inicio = (await caches.match("login.html", { ignoreSearch: true }))
            || (await caches.match("index.html", { ignoreSearch: true }));
          if (inicio) return inicio;
        }

        return new Response(
          "Sem conexão com a internet. Abra o app novamente quando o sinal voltar.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      })
  );
});
