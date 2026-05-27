async function carregarLua() {

  try {

    // pega data atual em timestamp
    const hoje = Math.floor(Date.now() / 1000);

    // API REAL
    const resposta = await fetch(
      `https://api.farmsense.net/v1/moonphases/?d=${hoje}`
    );

    const dados = await resposta.json();

    const lua = dados[0];

    let emoji = "🌑";

    // define emoji pela fase
    if (lua.Phase.includes("New")) {
      emoji = "🌑";
    }

    else if (lua.Phase.includes("Waxing")) {
      emoji = "🌒";
    }

    else if (lua.Phase.includes("First")) {
      emoji = "🌓";
    }

    else if (lua.Phase.includes("Full")) {
      emoji = "🌕";
    }

    else if (lua.Phase.includes("Waning")) {
      emoji = "🌘";
    }

    // renderiza na tela
    document.getElementById("luaCard").innerHTML = `
    
      <div class="lua-emoji">
        ${emoji}
      </div>

      <div class="lua-fase">
        ${lua.Phase}
      </div>

      <div class="lua-info">
        Iluminação: ${lua.Illumination}%
      </div>

      <div class="lua-info">
        Idade da lua: ${lua.Age} dias
      </div>

    `;

  }

  catch (erro) {

    document.getElementById("luaCard").innerHTML = `
      Erro ao carregar dados lunares.
    `;

    console.error(erro);
  }
}

carregarLua();
