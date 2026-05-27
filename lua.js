async function carregarLua() {

  try {

    const resposta = await fetch(
      "https://api.met.no/weatherapi/sunrise/3.0/moon?lat=-5.1459&lon=-38.0980&date=" +
      new Date().toISOString().split("T")[0],
      {
        headers: {
          "User-Agent": "wa-aqua"
        }
      }
    );

    const dados = await resposta.json();

    const fase = dados.properties.moonphase || "Lua";

    let emoji = "🌑";

    if (fase.includes("full")) {
      emoji = "🌕";
    }

    else if (fase.includes("new")) {
      emoji = "🌑";
    }

    else if (fase.includes("waxing")) {
      emoji = "🌒";
    }

    else if (fase.includes("waning")) {
      emoji = "🌘";
    }

    document.getElementById("luaCard").innerHTML = `
    
      <div class="lua-emoji">
        ${emoji}
      </div>

      <div class="lua-fase">
        ${fase}
      </div>

    `;

  }

  catch (erro) {

    console.error(erro);

    document.getElementById("luaCard").innerHTML = `
      Erro ao carregar calendário lunar.
    `;
  }
}

carregarLua();
