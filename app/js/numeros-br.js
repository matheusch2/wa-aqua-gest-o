// Interpreta um valor em reais digitado por brasileiro. Devolve null quando não
// dá para entender. Vírgula é SEMPRE decimal. O ponto é separador de milhar,
// exceto quando é o único ponto seguido de 1 ou 2 dígitos ("250.75", "1,5" →
// "1.5"): aí o usuário claramente quis decimal, porque o teclado ofereceu ponto.
// Sem essa exceção, "250.75" era lido como R$ 25.075,00 — erro de 100x que
// passava pela validação (número positivo) e ia para o banco em silêncio.
function _numeroMoedaBR(str) {
  if (str === null || str === undefined) return null;
  const limpo = String(str).trim().replace(/[^\d.,-]/g, "");
  if (!limpo) return null;
  let normalizado;
  if (limpo.includes(",")) {
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = limpo.split(".");
    normalizado = (partes.length === 2 && partes[1].length >= 1 && partes[1].length <= 2)
      ? limpo                      // ponto decimal: 250.75 / 1.5
      : limpo.replace(/\./g, "");  // ponto de milhar: 1.000 / 1.234.567
  }
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : null;
}

// Lê um campo numérico aceitando vírgula OU ponto como decimal. Os campos eram
// type="number", e nesses o navegador DESCARTA a vírgula em silêncio: quem
// digitava "2,5" kg gravava 25 kg, e "0,5" ha virava 5 ha. Como o número saía
// positivo e válido, nenhuma validação pegava. Agora os campos são de texto com
// teclado numérico, e a leitura passa por aqui.
function parseDecimalBR(str) {
  const n = _numeroMoedaBR(str);
  return n === null ? NaN : n;
}

function parseMoedaBR(str) {
  if (!str) return 0;
  const n = _numeroMoedaBR(str);
  return n === null ? 0 : n;
}

