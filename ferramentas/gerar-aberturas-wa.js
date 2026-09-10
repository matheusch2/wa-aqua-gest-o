/*
 * Gera as telas de abertura do iOS pro WA Aqua.
 *
 *     node ferramentas/gerar-aberturas-wa.js
 *
 * POR QUE EXISTE: o Android monta a tela de abertura sozinho (background_color
 * + icons do manifest.json). O Safari NAO: exige uma imagem pronta no tamanho
 * exato de cada aparelho; nao achando a do modelo, abre em BRANCO, sem erro.
 * Por isso a lista abaixo (uma imagem por aparelho).
 *
 * O desenho repete a composicao da splash de index.html/login.html: logo em
 * destaque, orbita do peixe, nome do produto e barra de carregamento. Assim a
 * abertura nativa do iOS emenda com a tela animada sem um salto visual.
 * Fundo SOLIDO de proposito: PNG de gradiente fica enorme. Os aneis e a faixa
 * inferior mantem a imagem interessante usando poucas cores e pouco arquivo.
 *
 * Aparelho novo no mercado = mais uma linha em APARELHOS aqui e mais um <link>
 * apple-touch-startup-image no <head> do index.html e do login.html. Sem a
 * linha, aquele aparelho volta a abrir em branco: nao quebra, mas fica feio.
 *
 * Usa o Chromium via CHROME (variavel de ambiente) ou o do PATH. No ambiente
 * de dev deste projeto: CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const RAIZ = path.join(__dirname, "..");
const CHROME = process.env.CHROME || "chromium";
const DEST = path.join(RAIZ, "assets", "abertura");
const TMP = fs.mkdtempSync(path.join(require("os").tmpdir(), "ab-"));
fs.mkdirSync(DEST, { recursive: true });

// Logo embutida como data URI (sem servidor, sem caminho relativo)
const LOGO = "data:image/jpeg;base64," +
  fs.readFileSync(path.join(RAIZ, "logo-wa.jpg")).toString("base64");

// [ larguraCSS, alturaCSS, dpr, "quem usa" ] — o nome do arquivo e wCss*dpr x hCss*dpr
const APARELHOS = [
  [440, 956, 3, "iPhone 16 Pro Max"], [402, 874, 3, "iPhone 16 Pro"],
  [430, 932, 3, "16 Plus/15 Pro Max/15 Plus/14 Pro Max"], [393, 852, 3, "16/15 Pro/15/14 Pro"],
  [428, 926, 3, "14 Plus/13 Pro Max/12 Pro Max"], [390, 844, 3, "14/13/13 Pro/12/12 Pro"],
  [375, 812, 3, "13 mini/12 mini/11 Pro/XS/X"], [414, 896, 3, "11 Pro Max/XS Max"],
  [414, 896, 2, "11/XR"], [414, 736, 3, "8 Plus/7 Plus/6s Plus"],
  [375, 667, 2, "SE 2/3, 8/7/6s"], [320, 568, 2, "SE 1, 5s"],
  [768, 1024, 2, "iPad 9.7 / mini"], [834, 1194, 2, "iPad Pro 11 / Air"], [1024, 1366, 2, "iPad Pro 12.9"],
];

const pagina = (w, h) => {
  const card = Math.round(Math.min(w * 0.23, h * 0.115));
  const marca = Math.round(card * 1.76);
  const padding = Math.max(7, Math.round(card * 0.073));
  const raioCard = Math.round(card * 0.255);
  const raioLogo = Math.round(card * 0.18);
  const peixe = Math.round(card * 0.29);
  const titulo = Math.round(card * 0.21);
  const subtitulo = Math.round(card * 0.105);
  const texto = Math.round(card * 0.115);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;}
    body{position:relative;display:grid;place-items:center;color:#fff;background:#054f4b;
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;}
    body:before{content:"";position:absolute;width:${Math.round(Math.min(w * 1.18, h * .68))}px;
      aspect-ratio:1;border-radius:50%;border:${Math.max(1, Math.round(w / 900))}px solid rgba(164,244,232,.14);
      box-shadow:0 0 0 ${Math.round(card * .38)}px rgba(135,235,220,.035),
        0 0 0 ${Math.round(card * .82)}px rgba(135,235,220,.025);}
    body:after{content:"";position:absolute;left:-18%;right:-18%;bottom:-18%;height:39%;
      border-radius:50% 50% 0 0;background:#043f3d;transform:rotate(-4deg);}
    .conteudo{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;
      transform:translateY(-2.5vh);}
    .marca{position:relative;width:${marca}px;height:${marca}px;display:grid;place-items:center;}
    .halo{position:absolute;inset:${Math.round(card * .19)}px;border-radius:50%;background:rgba(81,228,207,.12);}
    .track{position:absolute;inset:${Math.round(card * .073)}px;border-radius:50%;
      border:${Math.max(1, Math.round(card * .01))}px solid rgba(207,255,248,.30);}
    .track:after{content:"";position:absolute;inset:${Math.round(card * .082)}px;border-radius:50%;
      border:${Math.max(1, Math.round(card * .008))}px dashed rgba(226,255,251,.15);}
    .logo{position:relative;z-index:2;width:${card}px;height:${card}px;padding:${padding}px;
      display:grid;place-items:center;border-radius:${raioCard}px;background:#fff;
      border:${Math.max(1, Math.round(card * .009))}px solid rgba(255,255,255,.9);
      box-shadow:0 ${Math.round(card * .2)}px ${Math.round(card * .43)}px rgba(0,29,32,.34),
        0 0 0 ${Math.round(card * .064)}px rgba(255,255,255,.07);}
    img{display:block;width:100%;height:100%;border-radius:${raioLogo}px;object-fit:cover;}
    .identidade{margin-top:${Math.round(card * .145)}px;text-align:center;display:flex;flex-direction:column;
      gap:${Math.round(card * .075)}px;}
    .identidade strong{font-size:${titulo}px;line-height:1;font-weight:800;letter-spacing:.21em;padding-left:.21em;}
    .identidade span{font-size:${subtitulo}px;line-height:1;font-weight:650;letter-spacing:.18em;
      padding-left:.18em;color:rgba(224,255,250,.74);}
    .carregamento{width:${Math.round(card * 1.62)}px;margin-top:${Math.round(card * .31)}px;
      display:flex;flex-direction:column;align-items:center;gap:${Math.round(card * .11)}px;}
    .carregamento p{margin:0;font-size:${texto}px;line-height:1.3;font-weight:500;color:rgba(237,255,252,.84);}
    .barra{position:relative;width:100%;height:${Math.max(3, Math.round(card * .036))}px;}
    .trilho{position:absolute;inset:0;border-radius:999px;background:rgba(224,255,250,.14);overflow:hidden;}
    .trilho span{display:block;width:58%;height:100%;border-radius:inherit;background:#91eadc;}
    .peixe-barra{position:absolute;z-index:3;top:50%;left:58%;width:${peixe}px;
      margin-left:-${Math.round(peixe / 2)}px;transform:translateY(-50%);
      filter:drop-shadow(0 ${Math.round(card * .025)}px ${Math.round(card * .04)}px rgba(0,24,27,.34));}
    .peixe-barra svg{display:block;width:100%;height:auto;transform:scaleX(-1);}
  </style></head><body><div class="conteudo">
    <div class="marca"><div class="halo"></div><div class="track"></div>
      <div class="logo"><img src="${LOGO}"></div>
    </div>
    <div class="identidade"><strong>WA AQUA</strong><span>GESTÃO INTELIGENTE</span></div>
    <div class="carregamento"><p>Preparando seu cultivo</p><div class="barra">
      <div class="trilho"><span></span></div>
      <div class="peixe-barra"><svg viewBox="0 0 40 40"><path d="M6 20 C12 12 23 12 28 20 C23 28 12 28 6 20 Z" fill="#ffffff"/><path d="M28 20 L37 14 L34.5 20 L37 26 Z" fill="#ffffff"/><path d="M15 13 C17 9.5 21 9.5 23 12.5 Z" fill="#ffffff"/><circle cx="12" cy="18.5" r="1.7" fill="#066b63"/></svg></div>
    </div></div>
  </div></body></html>`;
};

let n = 0;
for (const [wCss, hCss, dpr, quem] of APARELHOS) {
  const w = wCss * dpr, h = hCss * dpr;
  const htmlFile = path.join(TMP, `${w}x${h}.html`);
  const outFile = path.join(DEST, `${w}x${h}.png`);
  fs.writeFileSync(htmlFile, pagina(w, h));
  // window-size em pixels REAIS + device-scale-factor 1: o screenshot ja e o arquivo final.
  execSync(`"${CHROME}" --headless=new --no-sandbox --disable-gpu --hide-scrollbars ` +
    `--window-size=${w},${h} --force-device-scale-factor=1 --virtual-time-budget=2500 ` +
    `--screenshot="${outFile}" "file://${htmlFile}"`, { stdio: "ignore", timeout: 60000 });
  console.log(`  ${String(w).padStart(4)}x${String(h).padStart(4)}  ${Math.round(fs.statSync(outFile).size / 1024)}KB  ${quem}`);
  n++;
}
console.log(`\n${n} imagens em assets/abertura/`);
