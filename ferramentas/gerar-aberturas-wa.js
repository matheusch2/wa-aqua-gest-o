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
 * O desenho e a logo do WA Aqua centralizada no verde da marca (#066b63) —
 * igual ao centro da splash em index.html/login.html, pra emendar sem corte.
 * Fundo SOLIDO de proposito: PNG de gradiente fica enorme (~800KB); solido
 * comprime pra ~45KB. O gradiente fica so na splash (CSS, de graca).
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
  const tam = Math.round(Math.min(w * 0.24, h * 0.14));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;}
    body{background:#066b63;display:grid;place-items:center;}
    img{width:${tam}px;height:${tam}px;border-radius:20%;object-fit:cover;
      box-shadow:0 ${Math.round(tam * 0.05)}px ${Math.round(tam * 0.22)}px rgba(0,0,0,.28);}
  </style></head><body><img src="${LOGO}"></body></html>`;
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
