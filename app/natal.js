/* ============================================================================
   natal.js — põe o gorro de Papai Noel e o pisca-pisca na logo, em dezembro.

   Fora de dezembro este arquivo não faz NADA: sai na primeira linha. Então em
   1º de janeiro o enfeite some sozinho, pelo relógio do próprio aparelho, sem
   precisar publicar versão nova pra tirar.

   Fica fora do script.js de propósito. O script.js é o cérebro do app e não
   roda na tela de entrada; este aqui precisa valer nas duas páginas
   (app/index.html e app/login.html) e some do mapa o resto do ano.

   O desenho e as medidas moram no CSS: app/styles/91-natal.css.
   ========================================================================== */

(function () {
  "use strict";

  // Dezembro inteiro. getMonth() conta de 0, então 11 é dezembro.
  if (new Date().getMonth() !== 11) return;

  /* Gradientes e sombras numa <defs> só, pendurada uma vez na página. Cada
     gorro aponta pra cá por id — senão o mesmo gradiente seria repetido em
     toda logo (a tela de entrada tem quatro). */
  var DEFS =
    '<svg class="wa-natal-defs" aria-hidden="true" focusable="false"><defs>' +
      '<linearGradient id="wa-g-cone" x1="14%" y1="4%" x2="84%" y2="96%">' +
        '<stop offset="0%" stop-color="#e63a34"/>' +
        '<stop offset="58%" stop-color="#cc2026"/>' +
        '<stop offset="100%" stop-color="#9c1419"/>' +
      '</linearGradient>' +
      '<linearGradient id="wa-g-aba" x1="0%" y1="0%" x2="0%" y2="100%">' +
        '<stop offset="0%" stop-color="#ffffff"/>' +
        '<stop offset="62%" stop-color="#f4f1ee"/>' +
        '<stop offset="100%" stop-color="#ddd7d2"/>' +
      '</linearGradient>' +
      '<radialGradient id="wa-g-pom" cx="36%" cy="30%" r="76%">' +
        '<stop offset="0%" stop-color="#ffffff"/>' +
        '<stop offset="68%" stop-color="#f3efec"/>' +
        '<stop offset="100%" stop-color="#d6cfca"/>' +
      '</radialGradient>' +
    '</defs></svg>';

  /* O gorro. A aba de pelo vai de ponta a ponta do viewBox de propósito: é ela
     que atravessa a largura inteira da logo. */
  var GORRO =
    '<svg class="wa-gorro" viewBox="0 0 140 112" aria-hidden="true" focusable="false">' +
      // corpo: base larga apoiada na aba, ponta tombando pro lado do pompom
      '<path d="M14 84 C 10 52, 26 22, 56 12 C 84 3, 110 12, 123 27 ' +
              'C 114 40, 108 60, 110 84 Z" fill="url(#wa-g-cone)"/>' +
      // dobra de luz, pro vermelho não ficar chapado
      '<path d="M28 80 C 26 52, 40 26, 64 19 C 80 14, 94 17, 103 23 ' +
              'C 86 26, 66 40, 54 58 C 46 70, 42 78, 40 82 Z" fill="#ffffff" opacity=".10"/>' +
      // sombra onde o corpo encontra a aba
      '<path d="M14 84 C 40 76, 84 76, 110 84 Z" fill="#7c0f14" opacity=".30"/>' +
      // aba de pelo
      '<rect x="0" y="76" width="140" height="32" rx="16" fill="url(#wa-g-aba)"/>' +
      '<rect x="5" y="79" width="130" height="13" rx="6.5" fill="#ffffff" opacity=".6"/>' +
      // pompom
      '<circle cx="124" cy="24" r="16" fill="url(#wa-g-pom)"/>' +
      '<circle cx="118" cy="18" r="5" fill="#ffffff" opacity=".75"/>' +
    '</svg>';

  var CORES = ["#ff3b30", "#2ecc71", "#ffd21e", "#5ac8fa", "#ff8fd0"];

  /* Anel de luzes no arco de baixo: de uma lateral à outra, passando por
     baixo. O raio é 63% da caixa, então as luzes ficam do lado de fora tanto
     do quadrado da abertura quanto do círculo da entrada. */
  function luzes(quantas, tamanho) {
    var html = '<span class="wa-luzes" aria-hidden="true">';
    for (var i = 0; i < quantas; i++) {
      var ang = Math.PI * (0.06 + (i / (quantas - 1)) * 0.88);
      html +=
        '<i class="wa-luz" style="' +
          "--c:" + CORES[i % CORES.length] + ";" +
          "--d:" + tamanho + "px;" +
          "--atraso:" + (i * 0.17).toFixed(2) + "s;" +
          "left:" + (50 + Math.cos(ang) * 63).toFixed(2) + "%;" +
          "top:" + (50 + Math.sin(ang) * 63).toFixed(2) + "%" +
        '"></i>';
    }
    return html + "</span>";
  }

  /* Embrulha a caixa da logo e pendura o enfeite no envoltório, POR FORA do
     overflow:hidden que recorta a logo (ver o comentário no 91-natal.css). */
  function enfeitar(caixa, quantas, tamanho) {
    if (!caixa || !caixa.parentNode) return;
    if (caixa.parentNode.classList.contains("wa-natal")) return; // já vestida

    var env = document.createElement("div");
    env.className = "wa-natal";
    caixa.parentNode.insertBefore(env, caixa);
    env.appendChild(caixa);
    env.insertAdjacentHTML("beforeend", GORRO + luzes(quantas, tamanho));
  }

  function cada(seletor, quantas, tamanho) {
    var achados = document.querySelectorAll(seletor);
    for (var i = 0; i < achados.length; i++) enfeitar(achados[i], quantas, tamanho);
  }

  function passada() {
    cada(".splash-wa-logo-card", 14, 8);               // abertura, 110px
    cada(".login-logo", 12, 6);                        // entrada, 74px
    cada(".logo-circulo:not(.login-logo)", 11, 5);     // barra de cima, 65px
    // O :not() importa: na entrada a logo tem as DUAS classes, e sem ele a
    // mesma caixa seria enfeitada duas vezes com tamanhos diferentes.
  }

  /* Uma passada só não basta. As telas da entrada (login, cadastro, recuperar
     senha) são montadas por JavaScript DEPOIS do DOMContentLoaded, e o app
     redesenha tela com innerHTML o tempo todo. Então ficamos de olho e vestimos
     o que nascer. Enfeitar é idempotente (ver o teste em enfeitar()), e a
     passada é juntada por quadro pra não rodar a cada nó inserido. */
  function observar() {
    if (typeof MutationObserver !== "function") return;
    var marcado = false;
    new MutationObserver(function () {
      if (marcado) return;
      marcado = true;
      requestAnimationFrame(function () { marcado = false; passada(); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  function vestir() {
    document.documentElement.classList.add("natal");
    document.body.insertAdjacentHTML("afterbegin", DEFS);
    passada();
    observar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", vestir);
  } else {
    vestir();
  }
})();
