async function carregarLua() {

  const luaCard = document.getElementById("luaCard");

  try {

    // data atual
    const hoje = new Date();

    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    // API astronômica real
    const url =
      `https://api.met.no/weatherapi/sunrise/3.0/moon` +
      `?lat=-5.1459&lon=-38.0980&date=${ano}-${mes}-${dia}`;

    const resposta = await fetch(url);

    const dados = await resposta.json();

    console.log(dados);

    const fase = dados.properties.moonphase;

    let emoji = "🌑";

    // DEFINE O EMOJI
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

    else {
      emoji = "🌗";
    }

    // RENDERIZA
    luaCard.innerHTML = `
    
      <div class="lua-emoji">
        ${emoji}
      </div>

      <div class="lua-fase">
        ${fase}
      </div>

      <div class="lua-info">
        Calendário lunar atualizado em tempo real
      </div>

    `;

  }

  catch (erro) {

    console.error(erro);

    luaCard.innerHTML = `
    
      <div class="lua-fase">
        Erro ao carregar dados lunares
      </div>

    `;
  }
}

carregarLua();
