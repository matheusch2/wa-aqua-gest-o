const SUPABASE_URL = "https://bzlzjjodzyxvkakfmmxw.supabase.co";
const SUPABASE_KEY = "sb_publishable_Avq19q531p8NrIRaHf5VvQ_DoWzOoaW";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let viveiros = [];

async function cadastrarUsuario() {
  const email = document.getElementById("emailCadastro").value;
  const senha = document.getElementById("senhaCadastro").value;
  const confirmar = document.getElementById("confirmarSenha").value;

  if (!email || !senha || !confirmar) {
    alert("Preencha todos os campos.");
    return;
  }

  if (senha !== confirmar) {
    alert("As senhas não coincidem.");
    return;
  }

  if (senha.length < 6) {
    alert("A senha deve ter pelo menos 6 caracteres.");
    return;
  }

  const { error } = await supabaseClient.auth.signUp({
    email: email,
    password: senha,
  });

  if (error) {
    alert(error.message);
    return;
  }

  alert("Conta criada com sucesso! Agora faça login.");
  mostrarLogin();
}

async function entrarUsuario() {
  const email = document.getElementById("emailLogin").value;
  const senha = document.getElementById("senhaLogin").value;

  if (!email || !senha) {
    alert("Preencha e-mail e senha.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: senha,
  });

  if (error) {
    alert(error.message);
    return;
  }

  // Limpa o formulário de login imediatamente
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="boas-vindas">
      <p>Carregando...</p>
    </div>
  `;

  document.getElementById("menuGestao").style.display = "grid";
  document.getElementById("botao-sair").style.display = "block";

  await carregarViveiros();
}

async function sairUsuario() {
  await supabaseClient.auth.signOut();
  viveiros = [];
  mostrarLogin();
}

function mostrarLogin() {

  document.getElementById("menuGestao").style.display = "none";
  document.getElementById("botao-sair").style.display = "none";

  const area = document.getElementById("area-gestao");

  area.innerHTML = `
    <div class="painel-viveiro">

      <h1 class="titulo-login">ENTRAR</h1>

      <label>E-mail</label>
      <input
        type="email"
        id="emailLogin"
        placeholder="Digite seu e-mail"
      >

      <label>Senha</label>
      <div class="input-senha">
        <input type="password" id="senhaLogin" placeholder="Digite sua senha">
        <button class="botao-olho" type="button" onclick="toggleSenha('senhaLogin', this)">👁️</button>
      </div>

      <button
        class="botao-entrar"
        onclick="entrarUsuario()"
      >
        Entrar
      </button>

      <button
        class="link-esqueci"
        onclick="mostrarRecuperarSenha()"
      >
        Esqueci minha senha
      </button>

      <div class="separador-login">
        <span>Não tem uma conta?</span>
      </div>

      <button
        class="botao-criar-conta"
        onclick="mostrarCadastro()"
      >
        Criar conta
      </button>

    </div>
  `;
}

function mostrarCadastro() {

  const area = document.getElementById("area-gestao");

  area.innerHTML = `
    <div class="painel-viveiro">

      <h1 class="titulo-login titulo-menor">CRIAR CONTA</h1>

      <label>E-mail</label>
      <input
        type="email"
        id="emailCadastro"
        placeholder="Digite seu e-mail"
      >

      <label>Senha</label>
      <div class="input-senha">
        <input type="password" id="senhaCadastro" placeholder="Mínimo 6 caracteres">
        <button class="botao-olho" type="button" onclick="toggleSenha('senhaCadastro', this)">👁️</button>
      </div>

      <label>Confirmar senha</label>
      <div class="input-senha">
        <input type="password" id="confirmarSenha" placeholder="Repita a senha">
        <button class="botao-olho" type="button" onclick="toggleSenha('confirmarSenha', this)">👁️</button>
      </div>

      <button
        class="botao-cadastrar"
        onclick="cadastrarUsuario()"
      >
        Criar conta
      </button>

      <button
        class="limpar"
        onclick="mostrarLogin()"
      >
        ← Voltar para o login
      </button>

    </div>
  `;
}

function mostrarRecuperarSenha() {
  const area = document.getElementById("area-gestao");

  area.innerHTML = `
    <div class="painel-viveiro">

      <h1 class="titulo-login titulo-menor">RECUPERAR SENHA</h1>

      <label>E-mail da sua conta</label>
      <input
        type="email"
        id="emailRecuperacao"
        placeholder="Digite seu e-mail"
      >

      <button
        class="botao-entrar"
        onclick="recuperarSenha()"
      >
        Enviar link de recuperação
      </button>

      <button
        class="limpar"
        onclick="mostrarLogin()"
      >
        ← Voltar para o login
      </button>

    </div>
  `;
}

async function recuperarSenha() {
  const email = document.getElementById("emailRecuperacao").value;

  if (!email) {
    alert("Digite seu e-mail.");
    return;
  }

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email);

  if (error) {
    alert(error.message);
    return;
  }

  alert("E-mail enviado! Verifique sua caixa de entrada.");
  mostrarLogin();
}

async function pegarUsuarioLogado() {
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error || !user) {
    alert("Usuário não está logado.");
    return null;
  }

  return user;
}

function formatarNumeroBR(valor, casas = 0) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function formatarData(data) {
  if (!data) return "";

  const partes = data.split("-");
  const ano = partes[0];
  const mes = partes[1];
  const dia = partes[2];

  return `${dia}/${mes}/${ano}`;
}

function formatarPopulacao(input) {
  let valor = input.value.replace(/\D/g, "");
  valor = Number(valor).toLocaleString("pt-BR");

  if (valor === "0") valor = "";

  input.value = valor;
}

function calcularDiasCultivo(dataPovoamento, dataFinal = new Date()) {
  if (!dataPovoamento) return 0;

  const inicio = new Date(dataPovoamento);
  const fim = new Date(dataFinal);

  const diferenca = fim - inicio;
  const dias = Math.floor(diferenca / (1000 * 60 * 60 * 24)) + 1;

  return dias > 0 ? dias : 0;
}

// ─── FUNÇÕES UTILITÁRIAS (antes ausentes) ───────────────────────────────────

function toggleSenha(inputId, botao) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    botao.innerHTML = '<span style="text-decoration:line-through">👁</span>';
  } else {
    input.type = "password";
    botao.innerHTML = "👁";
  }
}

function limparAreaGestao() {
  const area = document.getElementById("area-gestao");
  area.innerHTML = "";
}

function voltarMenuGestao() {
  limparAreaGestao();
}

// ─── VIVEIRO ─────────────────────────────────────────────────────────────────

function mostrarCadastroViveiro() {
  const area = document.getElementById("area-gestao");

  area.innerHTML = `
        <label>Nome do viveiro</label>
        <input type="text" id="nomeViveiro" placeholder="Ex: Viveiro 1">

        <label>Data de povoamento</label>
        <input type="date" id="dataPovoamento">

        <label>Total povoado</label>
        <input type="text" id="totalPovoadoGestao" placeholder="Ex: 250000" oninput="formatarPopulacao(this)">

        <label>Tamanho do viveiro</label>
        <div class="input-unidade">
            <input type="number" id="tamanhoViveiro" placeholder="Ex: 0.5">
            <span>ha</span>
        </div>

        <label>Laboratório</label>
        <input type="text" id="laboratorio" placeholder="Ex: Aquatec">

        <button class="botao-gestao" onclick="salvarViveiro()">Salvar viveiro</button>
    `;
}

async function salvarViveiro() {
  const nome = document.getElementById("nomeViveiro").value;
  const data = document.getElementById("dataPovoamento").value;
  const total = document.getElementById("totalPovoadoGestao").value;
  const tamanho = document.getElementById("tamanhoViveiro").value;
  const laboratorio = document.getElementById("laboratorio").value;
  const usuario = await pegarUsuarioLogado();

  if (!usuario) return;

  if (!nome || !data || !total || !tamanho || !laboratorio) {
    document.getElementById("area-gestao").innerHTML +=
      "<p>Preencha todos os campos.</p>";
    return;
  }

  const novoViveiro = {
    nome: nome,
    data_povoamento: data,
    total_povoado: total,
    tamanho: tamanho,
    laboratorio: laboratorio,
    ativo: true,
    user_id: usuario.id,
  };

  const { data: viveiroSalvo, error } = await supabaseClient
    .from("viveiros")
    .insert([novoViveiro])
    .select();

  if (error) {
    console.log(error);
    alert(error.message);
    return;
  }

  const viveiroLocal = {
    id: viveiroSalvo[0].id,
    nome: nome,
    dataPovoamento: data,
    totalPovoado: total,
    tamanho: tamanho,
    laboratorio: laboratorio,
    racoes: [],
    biometrias: [],
    despescas: [],
    ciclosFinalizados: [],
  };

  viveiros.push(viveiroLocal);

  const index = viveiros.length - 1;

  document.getElementById("area-gestao").innerHTML = `
        <div class="viveiro-card">
            <div class="viveiro-topo">
                <h3>${nome}</h3>
                <span>${total} PLs</span>
            </div>

            <div class="viveiro-info">
    <p><strong>Povoamento:</strong> ${formatarData(data)}</p>
    <p><strong>Laboratório:</strong> ${laboratorio}</p>
    <p><strong>Tamanho:</strong> ${tamanho} ha</p>
         </div>

         <button class="botao-abrir" onclick="abrirViveiro(${index})">
                Abrir viveiro
            </button>
        </div>
    `;
}

function mostrarListaViveiros() {
  const area = document.getElementById("area-gestao");

  if (viveiros.length === 0) {
    area.innerHTML = `
            <div class="viveiro-card">

                <div class="viveiro-topo">
                    <h3>Nenhum viveiro</h3>
                </div>

                <div class="viveiro-info">
                    <p>Cadastre um viveiro para começar.</p>
                </div>

            </div>
        `;

    return;
  }

  const viveirosOrdenados = [...viveiros].sort((a, b) => {
    return a.nome.localeCompare(b.nome, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  area.innerHTML = viveirosOrdenados
    .map((viveiro) => {
      const indexOriginal = viveiros.indexOf(viveiro);
      return `
        <div class="viveiro-card">

          <div class="vc-topo">
            <div class="vc-icone-box">🦐</div>
            <div class="vc-titulo-area">
              <h3>${viveiro.nome}</h3>
              <span class="vc-badge-cultivo">● Em cultivo</span>
            </div>
            <div class="vc-pls-badge">
              🦐 ${viveiro.totalPovoado || "--"} PLs
            </div>
          </div>

          <hr class="vc-separador">

          <div class="vc-info-lista">
            <div class="vc-info-item">
              <div class="vc-info-icone verde">🗓️</div>
              <div>
                <strong>Povoamento</strong>
                <p>${formatarData(viveiro.dataPovoamento) || "--"}</p>
              </div>
            </div>
            <div class="vc-info-item">
              <div class="vc-info-icone azul">🧪</div>
              <div>
                <strong>Laboratório</strong>
                <p>${viveiro.laboratorio || "--"}</p>
              </div>
            </div>
            <div class="vc-info-item">
              <div class="vc-info-icone roxo">📐</div>
              <div>
                <strong>Tamanho</strong>
                <p>${viveiro.tamanho || "--"} ha</p>
              </div>
            </div>
          </div>

          <button class="botao-abrir" onclick="abrirViveiro(${indexOriginal})">
            Abrir viveiro →
          </button>

        </div>
      `;
    })
    .join("");
}

function abrirViveiro(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");

  const diasCultivo = calcularDiasCultivo(viveiro.dataPovoamento);

  const racoes = viveiro.racoes || [];
  const biometrias = viveiro.biometrias || [];

  const totalRacao = racoes.reduce((total, item) => total + item.racao, 0);

  const ultimaBiometria =
    biometrias.length > 0 ? biometrias[biometrias.length - 1].gramatura : "--";

  area.innerHTML = `
        <div class="painel-viveiro">
            <div class="painel-topo">
                <h2>${viveiro.nome}</h2>
                <span>${viveiro.totalPovoado || "--"} PLs</span>
            </div>

            <div class="painel-info">
                <div class="info-box">
                    <small>Povoamento</small>
                    <strong>${formatarData(viveiro.dataPovoamento)}</strong>
                </div>

                <div class="info-box">
                    <small>Laboratório</small>
                    <strong>${viveiro.laboratorio || "--"}</strong>
                </div>

                <div class="info-box">
                    <small>Dias de cultivo</small>
                    <strong>${diasCultivo} dias</strong>
                </div>

                <div class="info-box">
                    <small>Tamanho</small>
                    <strong>${viveiro.tamanho || "--"} ha</strong>
                </div>

                <div class="info-box">
                    <small>Ração consumida</small>
                    <strong>${formatarNumeroBR(totalRacao, 1)} kg</strong>
                </div>

                <div class="info-box">
                    <small>Última biometria</small>
                    <strong>${ultimaBiometria} g</strong>
                </div>
            </div>

            <div class="painel-acoes">
                <button class="botao-painel" onclick="mostrarLancamentoRacao(${index})">
                    Lançar ração
                </button>

                <button class="botao-painel" onclick="abrirBiometria(${index})">
                   Lançar Biometria
                </button>

               <button class="botao-painel" onclick="abrirDespesca(${index})">
                   Lançar despesca
               </button>

                <button class="botao-painel" onclick="mostrarHistoricoDoViveiroDireto(${index})">
                    Histórico
                </button>

                <button class="botao-painel botao-alerta" onclick="abrirEncerrarCiclo(${index})">
                    Encerrar ciclo
                </button>

                <button class="botao-painel botao-alerta" onclick="reiniciarCiclo(${index})">
                    Reiniciar ciclo
                </button>

                <button class="botao-painel botao-perigo" onclick="excluirViveiro(${index})">
                    Excluir viveiro
                </button>
            </div>
        </div>
    `;
}

// ─── RAÇÃO ────────────────────────────────────────────────────────────────────

function mostrarLancamentoRacao(indexSelecionado = "") {
  const area = document.getElementById("area-gestao");

  if (viveiros.length === 0) {
    area.innerHTML = `
            <div class="resultado-box">
                <p>Nenhum viveiro cadastrado</p>
                <span>Cadastre um viveiro antes de lançar ração.</span>
            </div>
        `;
    return;
  }

  const dentroDoViveiro = indexSelecionado !== "";

  area.innerHTML = `
        <h2>Lançar ração</h2>

        ${
          dentroDoViveiro
            ? ""
            : `
            <label>Selecione o viveiro</label>
            <select id="viveiroRacao">
                ${viveiros
                  .map(
                    (viveiro, index) => `
                    <option value="${index}">
                        ${viveiro.nome}
                    </option>
                `,
                  )
                  .join("")}
            </select>
        `
        }

        <label>Data</label>
        <input type="date" id="dataRacao" value="${new Date().toISOString().split("T")[0]}">

        <label>Consumo de ração</label>
        <div class="input-unidade">
            <input type="number" id="consumoRacao" placeholder="Ex: 50">
            <span>kg</span>
        </div>

        <button class="botao-form" onclick="salvarLancamentoRacao(${dentroDoViveiro ? indexSelecionado : ""})">
            Salvar lançamento
        </button>

        <button class="botao-voltar" onclick="${dentroDoViveiro ? `abrirViveiro(${indexSelecionado})` : "voltarMenuGestao()"}">
            Voltar
        </button>
    `;
}

async function salvarLancamentoRacao(indexDireto = "") {
  const index =
    indexDireto !== ""
      ? indexDireto
      : document.getElementById("viveiroRacao").value;

  const data = document.getElementById("dataRacao").value;
  const racao = parseFloat(document.getElementById("consumoRacao").value);
  const usuario = await pegarUsuarioLogado();

  if (!usuario) return;

  if (!data || !racao) {
    alert("Preencha a data e o consumo de ração.");
    return;
  }

  // Verifica se já existe lançamento nessa data
  const jaExiste = (viveiros[index].racoes || []).some(r => r.data === data);
  if (jaExiste) {
    alert(`Já existe um lançamento de ração em ${formatarData(data)}. Edite o lançamento existente.`);
    return;
  }

  // Desabilita o botão para evitar duplo clique
  const botao = document.querySelector(".botao-form");
  if (botao) { botao.disabled = true; botao.textContent = "Salvando..."; }

  if (!viveiros[index].racoes) {
    viveiros[index].racoes = [];
  }

  const novaRacao = {
    viveiro_id: viveiros[index].id,
    data: data,
    racao: racao,
    user_id: usuario.id,
  };

  const { data: racaoSalva, error } = await supabaseClient
    .from("racoes")
    .insert([novaRacao])
    .select();

  if (error) {
    console.log(error);
    alert(error.message);
    return;
  }

  viveiros[index].racoes.push({
    id: racaoSalva[0].id,
    data: data,
    racao: racao,
  });

  abrirViveiro(index);
}

// ─── BIOMETRIA ────────────────────────────────────────────────────────────────

function abrirBiometria(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const hoje = new Date().toISOString().split("T")[0];

  area.innerHTML = `
        <div class="painel-viveiro">
            <div class="painel-topo">
                <h2>Biometria - ${viveiro.nome}</h2>
            </div>

            <label>Data da biometria</label>
            <input type="date" id="dataBiometria" value="${hoje}">

            <label>Gramatura média</label>
            <div class="input-unidade">
                <input type="number" id="gramaturaBiometria" placeholder="Ex: 10">
                <span>g</span>
            </div>

            <button class="botao-gestao" onclick="salvarBiometria(${index})">
                Salvar biometria
            </button>

            <button class="limpar" onclick="abrirViveiro(${index})">
                Voltar
            </button>
        </div>
    `;
}

async function salvarBiometria(index) {
  const data = document.getElementById("dataBiometria").value;

  const gramatura = parseFloat(
    document.getElementById("gramaturaBiometria").value
  );
  const usuario = await pegarUsuarioLogado();

  if (!usuario) return;

  if (!data || !gramatura) {
    alert("Preencha a data e a gramatura.");
    return;
  }

  const botao = document.querySelector(".botao-gestao");
  if (botao) { botao.disabled = true; botao.textContent = "Salvando..."; }

  if (!viveiros[index].biometrias) {
    viveiros[index].biometrias = [];
  }

  const novaBiometria = {
    viveiro_id: viveiros[index].id,
    data: data,
    gramatura: gramatura,
    user_id: usuario.id,
  };

  const { error } = await supabaseClient
    .from("biometrias")
    .insert([novaBiometria]);

  if (error) {
    console.log(error);
    alert(error.message);
    return;
  }

  viveiros[index].biometrias.push({
    data: data,
    gramatura: gramatura,
  });

  abrirViveiro(index);
}

// ─── DESPESCA ─────────────────────────────────────────────────────────────────

// CORREÇÃO: função abrirDespesca estava faltando
function abrirDespesca(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const hoje = new Date().toISOString().split("T")[0];

  area.innerHTML = `
        <div class="painel-viveiro">
            <div class="painel-topo">
                <h2>Despesca parcial - ${viveiro.nome}</h2>
            </div>

            <label>Data da despesca</label>
            <input type="date" id="dataDespesca" value="${hoje}">

            <label>Quantidade despescada</label>
            <div class="input-unidade">
                <input type="number" id="quantidadeDespesca" placeholder="Ex: 500">
                <span>kg</span>
            </div>

            <label>Peso médio</label>
            <div class="input-unidade">
                <input type="number" id="pesoMedioDespesca" placeholder="Ex: 12">
                <span>g</span>
            </div>

            <button class="botao-gestao" onclick="salvarDespesca(${index})">
                Salvar despesca
            </button>

            <button class="limpar" onclick="abrirViveiro(${index})">
                Voltar
            </button>
        </div>
    `;
}

async function salvarDespesca(index) {
  const data = document.getElementById("dataDespesca").value;
  const quantidadeKg = parseFloat(document.getElementById("quantidadeDespesca").value);
  const pesoMedio = parseFloat(document.getElementById("pesoMedioDespesca").value);
  const usuario = await pegarUsuarioLogado();

  if (!usuario) return;

  if (!data || !quantidadeKg || !pesoMedio) {
    alert("Preencha a data, quantidade e peso médio.");
    return;
  }

  const botao = document.querySelector(".botao-gestao");
  if (botao) { botao.disabled = true; botao.textContent = "Salvando..."; }

  if (!viveiros[index].despescas) {
    viveiros[index].despescas = [];
  }

  const novaDespesca = {
    viveiro_id: viveiros[index].id,
    data: data,
    quantidade_kg: quantidadeKg,
    peso_medio: pesoMedio,
    user_id: usuario.id,
  };

  const { error } = await supabaseClient
    .from("despescas")
    .insert([novaDespesca]);

  if (error) {
    console.log(error);
    alert(error.message);
    return;
  }

  viveiros[index].despescas.push({
    data: data,
    tipo: "Parcial",
    quantidadeKg: quantidadeKg,
    pesoMedio: pesoMedio,
  });

  abrirViveiro(index);
}

// ─── HISTÓRICO ────────────────────────────────────────────────────────────────

function mostrarHistoricoCultivo(indexSelecionado = "") {
  const area = document.getElementById("area-gestao");

  if (viveiros.length === 0) {
    area.innerHTML = `
            <div class="resultado-box">
                <p>Nenhum viveiro cadastrado</p>
                <span>Cadastre um viveiro para ver o histórico.</span>
            </div>
        `;
    return;
  }

  area.innerHTML = `
        <div class="painel-viveiro">
            <div class="painel-topo">
                <h2>Históricos</h2>
            </div>

            <label>Selecione o viveiro</label>

            <select id="viveiroHistorico" onchange="mostrarOpcoesHistorico()">
                <option value="">Escolha um viveiro</option>
                ${viveiros
                  .map(
                    (viveiro, index) => `
                    <option value="${index}" ${String(index) === String(indexSelecionado) ? "selected" : ""}>
                        ${viveiro.nome}
                    </option>
                `,
                  )
                  .join("")}
            </select>

            <div id="opcoes-historico"></div>
            <div id="resultado-historico"></div>
        </div>
    `;

  if (indexSelecionado !== "") {
    mostrarOpcoesHistorico();
  }
}

function mostrarOpcoesHistorico() {
  const index = document.getElementById("viveiroHistorico").value;
  const opcoes = document.getElementById("opcoes-historico");
  const resultado = document.getElementById("resultado-historico");

  resultado.innerHTML = "";

  if (index === "") {
    opcoes.innerHTML = "";
    return;
  }

  opcoes.innerHTML = `
        <div class="painel-acoes">
            <button class="botao-historico" onclick="abrirHistoricoBiometria()">
                Biometria
            </button>

            <button class="botao-historico" onclick="abrirHistoricoRacao()">
                Ração
            </button>

            <button class="botao-historico" onclick="abrirHistoricoDespesca()">
               Despesca parcial
            </button>

            <button class="limpar" onclick="limparAreaGestao()">
                Voltar
            </button>

            </div>
    `;
}

function abrirHistoricoBiometria() {
  const index = document.getElementById("viveiroHistorico").value;
  if (index === "") return;

  document.getElementById("opcoes-historico").innerHTML = "";

  renderizarHistoricoBiometria(index, "resultado-historico", false);
}

function abrirHistoricoRacao() {
  const index = document.getElementById("viveiroHistorico").value;
  if (index === "") return;

  document.getElementById("opcoes-historico").innerHTML = "";

  renderizarHistoricoRacao(index, "resultado-historico", false);
}

function abrirHistoricoDespesca() {
  const index = document.getElementById("viveiroHistorico").value;
  if (index === "") return;

  document.getElementById("opcoes-historico").innerHTML = "";

  renderizarHistoricoDespesca(index, "resultado-historico", false);
}

function mostrarHistoricoDoViveiroDireto(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");

  area.innerHTML = `
    <div class="painel-viveiro">

      <div class="painel-topo">
        <h2>${viveiro.nome}</h2>
      </div>

      <div id="opcoes-historico">
        <div class="painel-acoes">

          <button class="botao-historico"
            onclick="abrirHistoricoBiometriaDireto(${index})">
            Biometria
          </button>

          <button class="botao-historico"
            onclick="abrirHistoricoRacaoDireto(${index})">
            Ração
          </button>

          <button class="botao-historico"
            onclick="abrirHistoricoDespescaDireto(${index})">
            Despesca parcial
          </button>

        </div>
      </div>

      <div id="resultado-historico"></div>

      <button class="botao-voltar"
        onclick="abrirViveiro(${index})">
        Voltar
      </button>

    </div>
  `;
}

function abrirHistoricoBiometriaDireto(index) {
  document.getElementById("opcoes-historico").innerHTML = "";
  renderizarHistoricoBiometria(index, "resultado-historico", true);
}

function abrirHistoricoRacaoDireto(index) {
  document.getElementById("opcoes-historico").innerHTML = "";
  renderizarHistoricoRacao(index, "resultado-historico", true);
}

function renderizarHistoricoBiometria(index, elementoId, direto) {
  const viveiro = viveiros[index];
  const resultado = document.getElementById(elementoId);
  const biometrias = viveiro.biometrias || [];

  resultado.innerHTML = `
        <h3>Biometria</h3>

        <div class="tabela-historico">
            <div class="linha-historico cabecalho">
                <span>Data</span>
                <span>Biometria</span>
                <span>Crescimento</span>
            </div>

            ${
              biometrias.length === 0
                ? `<p class="sobrevivencia-texto">Nenhuma biometria lançada.</p>`
                : biometrias
                    .map((item, i) => {
                      let crescimento = "-";

                      if (i > 0) {
                        crescimento =
                          (
                            item.gramatura - biometrias[i - 1].gramatura
                          ).toFixed(1) + " g";
                      }

                      return `
                        <div class="linha-historico">
                            <span>${formatarData(item.data)}</span>
                            <span>${formatarNumeroBR(item.gramatura, 1)} g</span>
                            <span>${crescimento}</span>
                        </div>
                    `;
                    })
                    .join("")
            }
        </div>

        ${
          direto
            ? ""
            : `<button class="limpar" onclick="voltarOpcoesHistorico()">Voltar</button>`
        }
    `;
}

function renderizarHistoricoRacao(index, elementoId, direto) {
  const viveiro = viveiros[index];
  const resultado = document.getElementById(elementoId);
  const racoes = viveiro.racoes || [];

  const totalRacao = racoes.reduce((total, item) => total + item.racao, 0);

  resultado.innerHTML = `
        <h3 class="titulo-secao-historico">RAÇÃO</h3>

        <div class="tabela-historico">
            <div class="linha-historico-racao cabecalho">
                <span>DIA</span>
                <span class="col-centro">DATA</span>
                <span class="col-centro">RAÇÃO</span>
                <span></span>
            </div>

            ${
              racoes.length === 0
                ? `<p class="sobrevivencia-texto">Nenhuma ração lançada.</p>`
                : racoes
                    .map(
                      (item, i) => `
                    <div class="linha-historico-racao">
                        <span>${calcularDiasCultivo(viveiro.dataPovoamento, item.data)}</span>
                        <span class="col-centro">${formatarData(item.data)}</span>
                        <span class="col-centro">${formatarNumeroBR(item.racao, 1)} kg</span>
                        <span class="col-acoes">
                          <button class="botao-editar" onclick="abrirEdicaoRacao(${index}, ${i}, '${elementoId}', ${direto})">✏️</button>
                          <button class="botao-editar botao-excluir" onclick="excluirRacao(${index}, ${i}, '${elementoId}', ${direto})">🗑️</button>
                        </span>
                    </div>
                `,
                    )
                    .join("")
            }
        </div>

        <div class="resultado-box destaque">
            <p>Consumo total</p>
            <h3>${formatarNumeroBR(totalRacao, 1)} kg</h3>
        </div>

    ${
      direto
        ? ""
        : `<button class="limpar" onclick="voltarOpcoesHistorico()">Voltar</button>`
    }
     `;
}

function abrirEdicaoRacao(viveiroIndex, racaoIndex, elementoId, direto) {
  const viveiro = viveiros[viveiroIndex];
  const racao = viveiro.racoes[racaoIndex];
  const resultado = document.getElementById(elementoId);

  resultado.innerHTML = `
    <div class="painel-viveiro">

      <p class="caption-edicao">${viveiro.nome}</p>
      <h2 class="titulo-edicao">EDITAR RAÇÃO</h2>

      <label>Data</label>
      <input type="date" id="dataEdicaoRacao" value="${racao.data}">

      <label>Consumo de ração</label>
      <div class="input-unidade">
        <input type="number" id="qtdEdicaoRacao" value="${racao.racao}" placeholder="Ex: 50">
        <span>kg</span>
      </div>

      <button class="botao-gestao" onclick="salvarEdicaoRacao(${viveiroIndex}, ${racaoIndex}, '${elementoId}', ${direto})">
        Salvar
      </button>

      <button class="limpar" onclick="renderizarHistoricoRacao(${viveiroIndex}, '${elementoId}', ${direto})">
        ← Voltar
      </button>
    </div>
  `;
}

async function salvarEdicaoRacao(viveiroIndex, racaoIndex, elementoId, direto) {
  const novaData = document.getElementById("dataEdicaoRacao").value;
  const novaQtd = parseFloat(document.getElementById("qtdEdicaoRacao").value);

  if (!novaData || !novaQtd) {
    alert("Preencha a data e a quantidade.");
    return;
  }

  const racao = viveiros[viveiroIndex].racoes[racaoIndex];

  const { error } = await supabaseClient
    .from("racoes")
    .update({ data: novaData, racao: novaQtd })
    .eq("id", racao.id);

  if (error) {
    console.log(error);
    alert("Erro ao salvar edição.");
    return;
  }

  viveiros[viveiroIndex].racoes[racaoIndex].data = novaData;
  viveiros[viveiroIndex].racoes[racaoIndex].racao = novaQtd;

  renderizarHistoricoRacao(viveiroIndex, elementoId, direto);
}

async function excluirRacao(viveiroIndex, racaoIndex, elementoId, direto) {
  if (!confirm("Excluir este lançamento de ração?")) return;

  const racao = viveiros[viveiroIndex].racoes[racaoIndex];

  if (!racao || !racao.id) {
    alert("Erro: lançamento sem ID.");
    return;
  }

  const { error } = await supabaseClient
    .from("racoes")
    .delete()
    .eq("id", racao.id);

  if (error) {
    console.log(error);
    alert("Erro ao excluir lançamento.");
    return;
  }

  viveiros[viveiroIndex].racoes.splice(racaoIndex, 1);

  renderizarHistoricoRacao(viveiroIndex, elementoId, direto);
}

// ─── CICLO ───────────────────────────────────────────────────────────────────

async function reiniciarCiclo(index) {
  if (!confirm("Deseja reiniciar o ciclo deste viveiro?")) return;

  mostrarFormularioReinicio(index);
}

function mostrarFormularioReinicio(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");

  area.innerHTML = `
        <div class="painel-viveiro">
            <div class="painel-topo">
                <h2>${viveiro.nome}</h2>
            </div>

            <label>Nova data de povoamento</label>
            <input type="date" id="novoPovoamento">

            <label>Novo total povoado</label>
            <input type="text" id="novoTotal" oninput="formatarPopulacao(this)">

            <label>Laboratório</label>
            <input type="text" id="novoLaboratorio">

            <button class="botao-gestao" onclick="salvarNovoCiclo(${index})">
                Salvar novo ciclo
            </button>
        </div>
    `;
}

// CORREÇÃO: salvarNovoCiclo agora salva no banco de dados
async function salvarNovoCiclo(index) {
  const novoPovoamento = document.getElementById("novoPovoamento").value;
  const novoTotal = document.getElementById("novoTotal").value;
  const novoLaboratorio = document.getElementById("novoLaboratorio").value;
  const usuario = await pegarUsuarioLogado();

  if (!usuario) return;

  if (!novoPovoamento || !novoTotal || !novoLaboratorio) {
    alert("Preencha todos os campos.");
    return;
  }

  const { error } = await supabaseClient
    .from("viveiros")
    .update({
      data_povoamento: novoPovoamento,
      total_povoado: novoTotal,
      laboratorio: novoLaboratorio,
    })
    .eq("id", viveiros[index].id);

  if (error) {
    console.log(error);
    alert("Erro ao salvar novo ciclo.");
    return;
  }

  // Limpar dados do ciclo anterior no banco
  await supabaseClient.from("racoes").delete().eq("viveiro_id", viveiros[index].id);
  await supabaseClient.from("biometrias").delete().eq("viveiro_id", viveiros[index].id);
  await supabaseClient.from("despescas").delete().eq("viveiro_id", viveiros[index].id);

  // Atualizar estado local
  viveiros[index].dataPovoamento = novoPovoamento;
  viveiros[index].totalPovoado = novoTotal;
  viveiros[index].laboratorio = novoLaboratorio;
  viveiros[index].racoes = [];
  viveiros[index].biometrias = [];
  viveiros[index].despescas = [];

  abrirViveiro(index);
}

async function excluirViveiro(index) {
  const viveiro = viveiros[index];

  if (!viveiro) return;

  const confirmar = confirm(
    `Deseja excluir o viveiro "${viveiro.nome}"?`
  );

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("viveiros")
    .update({ ativo: false })
    .eq("id", viveiro.id);

  if (error) {
    console.log(error);
    alert("Erro ao excluir viveiro.");
    return;
  }

  await carregarViveiros();

  alert("Viveiro excluído com sucesso.");
}

function renderizarHistoricoDespesca(index, elementoId, direto) {
  const viveiro = viveiros[index];
  const resultado = document.getElementById(elementoId);
  const despescas = viveiro.despescas || [];

  const totalDespescado = despescas.reduce((total, item) => {
    return total + item.quantidadeKg;
  }, 0);

  resultado.innerHTML = `
        <h3>Despesca parcial</h3>

        <div class="tabela-historico">
            <div class="linha-historico cabecalho">
                <span>Data</span>
                <span>Kg</span>
                <span>Peso</span>
            </div>

            ${
              despescas.length === 0
                ? `<p class="sobrevivencia-texto">Nenhuma despesca lançada.</p>`
                : despescas
                    .map(
                      (item) => `
                    <div class="linha-historico">
                        <span>${formatarData(item.data)}</span>
                        <span>${formatarNumeroBR(item.quantidadeKg, 1)} kg</span>
                        <span>${formatarNumeroBR(item.pesoMedio, 1)} g</span>
                    </div>
                `,
                    )
                    .join("")
            }
        </div>

        <div class="resultado-box destaque">
            <p>Total despescado</p>
            <h3>${formatarNumeroBR(totalDespescado, 1)} kg</h3>
        </div>

        ${
          direto
            ? ""
            : `<button class="limpar" onclick="voltarOpcoesHistorico()">Voltar</button>`
        }
    `;
}

function abrirHistoricoDespescaDireto(index) {
  document.getElementById("opcoes-historico").innerHTML = "";
  renderizarHistoricoDespesca(index, "resultado-historico", true);
}

function voltarOpcoesHistorico() {
  mostrarOpcoesHistorico();
}

function mostrarHistoricoCiclos() {
  const area = document.getElementById("area-gestao");

  let ciclos = [];

  viveiros.forEach((viveiro) => {
    if (viveiro.ciclosFinalizados) {
      viveiro.ciclosFinalizados.forEach((ciclo) => {
        ciclos.push({
          viveiro: viveiro.nome,
          ciclo: ciclo,
        });
      });
    }
  });

  if (ciclos.length === 0) {
    area.innerHTML = `
            <div class="resultado-box">
                <p>Nenhum ciclo encerrado</p>
                <span>Os ciclos finalizados aparecerão aqui.</span>
            </div>
        `;

    return;
  }

  area.innerHTML = ciclos
    .map(
      (item) => `

        <div class="viveiro-card">

            <div class="viveiro-topo">
                <h3>${item.viveiro}</h3>
                <span>${item.ciclo.producaoTotal} kg</span>
            </div>

            <div class="viveiro-info">
                <p>Povoamento: ${formatarData(item.ciclo.dataPovoamento)}</p>
                <p>Encerramento: ${formatarData(item.ciclo.dataEncerramento)}</p>
                <p>Sobrevivência: ${formatarNumeroBR(item.ciclo.sobrevivencia, 1)}%</p>
            </div>

        </div>

    `,
    )
    .join("");
}

function abrirFinanceiro() {
  const area = document.getElementById("area-gestao");

  area.innerHTML = `
        <div class="resultado-box">
            <p>Financeiro</p>
            <span>Módulo em desenvolvimento.</span>
        </div>
    `;
}

function abrirEncerrarCiclo(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");

  const hoje = new Date().toISOString().split("T")[0];

  area.innerHTML = `

        <div class="painel-viveiro">

            <div class="painel-topo">
                <h2>Encerrar ciclo - ${viveiro.nome}</h2>
            </div>

            <label>Data de encerramento</label>
            <input type="date" id="dataEncerramento" value="${hoje}">

            <label>Produção final</label>
            <div class="input-unidade">
                <input type="number" id="producaoFinal" placeholder="Ex: 1000">
                <span>kg</span>
            </div>

            <label>Peso médio final</label>
            <div class="input-unidade">
                <input type="number" id="pesoFinal" placeholder="Ex: 12">
                <span>g</span>
            </div>

            <label>Observações</label>
            <input type="text" id="observacoesCiclo" placeholder="Opcional">

            <button
                class="botao-gestao"
                onclick="salvarEncerramentoCiclo(${index})"
            >
                Finalizar ciclo
            </button>

            <button
                class="limpar"
                onclick="abrirViveiro(${index})"
            >
                Voltar
            </button>

        </div>

    `;
}

async function salvarEncerramentoCiclo(index) {
  const viveiro = viveiros[index];

  const dataEncerramento = document.getElementById("dataEncerramento").value;
  const producaoFinal = parseFloat(document.getElementById("producaoFinal").value);
  const pesoFinal = parseFloat(document.getElementById("pesoFinal").value);
  const observacoes = document.getElementById("observacoesCiclo").value;
  const usuario = await pegarUsuarioLogado();

  if (!usuario) return;

  if (!dataEncerramento || !producaoFinal || !pesoFinal) {
    alert("Preencha data de encerramento, produção final e peso médio final.");
    return;
  }

  const racoes = viveiro.racoes || [];
  const despescas = viveiro.despescas || [];
  const biometrias = viveiro.biometrias || [];

  const racaoConsumida = racoes.reduce((total, item) => total + item.racao, 0);
  const despescaParcial = despescas.reduce(
    (total, item) => total + item.quantidadeKg,
    0
  );

  const producaoTotal = despescaParcial + producaoFinal;
  const fca = racaoConsumida / producaoTotal;
  const produtividade = producaoTotal / parseFloat(viveiro.tamanho);

  const totalPovoado = parseFloat(String(viveiro.totalPovoado).replace(/\./g, ""));
  const quantidadeFinal = producaoTotal / (pesoFinal / 1000);
  const sobrevivencia = (quantidadeFinal / totalPovoado) * 100;

  const diasCultivo = calcularDiasCultivo(
    viveiro.dataPovoamento,
    dataEncerramento
  );

  const cicloBanco = {
    viveiro_id: viveiro.id,
    user_id: usuario.id,
    nome_viveiro: viveiro.nome,
    laboratorio: viveiro.laboratorio,
    tamanho: viveiro.tamanho,
    total_povoado: viveiro.totalPovoado,
    data_povoamento: viveiro.dataPovoamento,
    data_encerramento: dataEncerramento,
    dias_cultivo: diasCultivo,
    producao_final: producaoFinal,
    despesca_parcial: despescaParcial,
    produtividade: produtividade,
    producao_total: producaoTotal,
    peso_final: pesoFinal,
    racao_consumida: racaoConsumida,
    fca: fca,
    sobrevivencia: sobrevivencia,
    observacoes: observacoes,
  };

  const { error } = await supabaseClient
    .from("ciclos")
    .insert([cicloBanco]);

  if (error) {
    console.log(error);
    alert(error.message);
    return;
  }

  const cicloFinalizado = {
    nomeViveiro: viveiro.nome,
    laboratorio: viveiro.laboratorio,
    tamanho: viveiro.tamanho,
    totalPovoado: viveiro.totalPovoado,
    dataPovoamento: viveiro.dataPovoamento,
    dataEncerramento: dataEncerramento,
    diasCultivo: diasCultivo,
    producaoFinal: producaoFinal,
    despescaParcial: despescaParcial,
    produtividade: produtividade,
    producaoTotal: producaoTotal,
    pesoFinal: pesoFinal,
    racaoConsumida: racaoConsumida,
    fca: fca,
    sobrevivencia: sobrevivencia,
    biometrias: [...biometrias],
    racoes: [...racoes],
    despescas: [...despescas],
    observacoes: observacoes,
  };

  if (!viveiro.ciclosFinalizados) {
    viveiro.ciclosFinalizados = [];
  }

  viveiro.ciclosFinalizados.push(cicloFinalizado);

  mostrarRelatorioCiclo(index, cicloFinalizado);
}

function mostrarRelatorioCiclo(index, ciclo) {
  const area = document.getElementById("area-gestao");

  area.innerHTML = `

        <div class="relatorio-final">

            <div class="relatorio-header">

                <h1>WA AQUA GESTÃO</h1>

                <h2>Relatório final do ciclo</h2>

                <span>${ciclo.nomeViveiro}</span>

            </div>

            <div class="relatorio-periodo">

                <p>
                    <strong>Período:</strong>
                    ${formatarData(ciclo.dataPovoamento)}
                    →
                    ${formatarData(ciclo.dataEncerramento)}
                </p>

                <p>
                    <strong>Dias de cultivo:</strong>
                    ${ciclo.diasCultivo} dias
                </p>

            </div>

            <div class="relatorio-secao">

                <h3>Informações do ciclo</h3>

                <div class="relatorio-grid">

                    <div class="info-box">
                        <small>Data de povoamento</small>
                        <strong>${formatarData(ciclo.dataPovoamento)}</strong>
                    </div>

                    <div class="info-box">
                        <small>Total povoado</small>
                        <strong>${ciclo.totalPovoado} PLs</strong>
                    </div>

                    <div class="info-box">
                        <small>Laboratório</small>
                        <strong>${ciclo.laboratorio}</strong>
                    </div>

                    <div class="info-box">
                        <small>Tamanho</small>
                        <strong>${ciclo.tamanho} ha</strong>
                    </div>

                </div>

            </div>

            <div class="relatorio-secao">

                <h3>Resultado produtivo</h3>

                <div class="relatorio-grid">

                    <div class="info-box">
                        <small>Produtividade</small>
                        <strong>${formatarNumeroBR(ciclo.produtividade, 1)} kg/ha</strong>
                    </div>

                    <div class="info-box">
                        <small>Peso médio final</small>
                        <strong>${formatarNumeroBR(ciclo.pesoFinal, 1)} g</strong>
                    </div>

                    <div class="info-box">
                        <small>Sobrevivência</small>
                        <strong>${formatarNumeroBR(ciclo.sobrevivencia, 1)}%</strong>
                    </div>

                </div>

            </div>

            <div class="relatorio-secao">

                <h3>Alimentação</h3>

                <div class="relatorio-grid">

                    <div class="info-box">
                        <small>Ração consumida</small>
                        <strong>${formatarNumeroBR(ciclo.racaoConsumida, 1)} kg</strong>
                    </div>

                    <div class="info-box">
                        <small>FCA final</small>
                        <strong>${formatarNumeroBR(ciclo.fca, 2)}</strong>
                    </div>

                </div>

            </div>

            <div class="relatorio-secao">

                <h3>Despesca</h3>

                <div class="relatorio-grid">

                    <div class="info-box">
                        <small>Despesca parcial</small>
                        <strong>${formatarNumeroBR(ciclo.despescaParcial, 1)} kg</strong>
                    </div>

                    <div class="info-box">
                        <small>Despesca total</small>
                        <strong>${formatarNumeroBR(ciclo.producaoFinal, 1)} kg</strong>
                    </div>

                </div>

            </div>

            <div class="fechamento-ciclo">

                <p>Produção final do ciclo</p>

                <h2>
                    ${formatarNumeroBR(ciclo.producaoTotal, 1)} kg
                </h2>

            </div>

                       <div class="acoes-relatorio">

                <button class="botao-painel" onclick="window.print()">
                    Imprimir relatório
                </button>

                <button class="limpar" onclick="abrirViveiro(${index})">
                    Voltar ao viveiro
                </button>

            </div>

        </div>
    `;
}

// ─── CARREGAR DADOS ───────────────────────────────────────────────────────────

async function carregarViveiros() {
  const usuario = await pegarUsuarioLogado();

  if (!usuario) return;

  const { data: viveirosData, error: erroViveiros } =
    await supabaseClient
      .from("viveiros")
      .select("*")
      .eq("ativo", true)
      .eq("user_id", usuario.id)
      .order("nome", { ascending: true });

  if (erroViveiros) {
    console.log(erroViveiros);
    alert("Erro ao carregar viveiros.");
    return;
  }

  // CORREÇÃO: filtrar por user_id para não carregar dados de outros usuários
  const { data: racoesData, error: erroRacoes } =
    await supabaseClient
      .from("racoes")
      .select("*")
      .eq("user_id", usuario.id);

  if (erroRacoes) {
    console.log(erroRacoes);
    alert("Erro ao carregar rações.");
    return;
  }

  const { data: biometriasData, error: erroBiometrias } =
    await supabaseClient
      .from("biometrias")
      .select("*")
      .eq("user_id", usuario.id);

  if (erroBiometrias) {
    console.log(erroBiometrias);
    alert("Erro ao carregar biometrias.");
    return;
  }

  const { data: despescasData, error: erroDespescas } =
    await supabaseClient
      .from("despescas")
      .select("*")
      .eq("user_id", usuario.id);

  if (erroDespescas) {
    console.log(erroDespescas);
    alert("Erro ao carregar despescas.");
    return;
  }

  const { data: ciclosData, error: erroCiclos } =
    await supabaseClient
      .from("ciclos")
      .select("*")
      .eq("user_id", usuario.id);

  if (erroCiclos) {
    console.log(erroCiclos);
    alert("Erro ao carregar ciclos.");
    return;
  }

  viveiros = viveirosData.map((item) => ({
    id: item.id,
    nome: item.nome,
    dataPovoamento: item.data_povoamento,
    totalPovoado: item.total_povoado,
    tamanho: item.tamanho,
    laboratorio: item.laboratorio,

    racoes: racoesData
      .filter((racao) => racao.viveiro_id === item.id)
      .map((racao) => ({
        id: racao.id,
        data: racao.data,
        racao: Number(racao.racao),
      })),

    biometrias: biometriasData
      .filter((bio) => bio.viveiro_id === item.id)
      .map((bio) => ({
        data: bio.data,
        gramatura: Number(bio.gramatura),
      })),

    despescas: despescasData
      .filter((despesca) => despesca.viveiro_id === item.id)
      .map((despesca) => ({
        data: despesca.data,
        tipo: "Parcial",
        quantidadeKg: Number(despesca.quantidade_kg),
        pesoMedio: Number(despesca.peso_medio),
      })),

    ciclosFinalizados: ciclosData
      .filter((ciclo) => ciclo.viveiro_id === item.id)
      .map((ciclo) => ({
        nomeViveiro: ciclo.nome_viveiro,
        laboratorio: ciclo.laboratorio,
        tamanho: ciclo.tamanho,
        totalPovoado: ciclo.total_povoado,
        dataPovoamento: ciclo.data_povoamento,
        dataEncerramento: ciclo.data_encerramento,
        diasCultivo: ciclo.dias_cultivo,
        producaoFinal: Number(ciclo.producao_final),
        despescaParcial: Number(ciclo.despesca_parcial),
        produtividade: Number(ciclo.produtividade),
        producaoTotal: Number(ciclo.producao_total),
        pesoFinal: Number(ciclo.peso_final),
        racaoConsumida: Number(ciclo.racao_consumida),
        fca: Number(ciclo.fca),
        sobrevivencia: Number(ciclo.sobrevivencia),
        observacoes: ciclo.observacoes,
      })),
  }));

  console.log("Viveiros carregados:", viveiros);
}

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (session) {
      document.getElementById("menuGestao").style.display = "grid";
      document.getElementById("botao-sair").style.display = "block";
      await carregarViveiros();
    } else {
      mostrarLogin();
    }
  } catch (error) {
    console.log("Erro na inicialização:", error);
    mostrarLogin();
  }
});
