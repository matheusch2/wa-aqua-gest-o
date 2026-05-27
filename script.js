const SUPABASE_URL = "https://bzlzjjodzyxvkakfmmxw.supabase.co";
const SUPABASE_KEY = "sb_publishable_Avq19q531p8NrIRaHf5VvQ_DoWzOoaW";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let viveiros = [];

async function sairUsuario() {
  fecharMenuUsuario();
  await supabaseClient.auth.signOut();
  viveiros = [];
  window.location.href = "login.html";
}

function toggleMenuUsuario() {
  const menu = document.getElementById("menu-usuario");
  menu.classList.toggle("aberto");
}

function fecharMenuUsuario() {
  const menu = document.getElementById("menu-usuario");
  if (menu) menu.classList.remove("aberto");
}

// Fecha dropdown ao clicar fora
document.addEventListener("click", function(e) {
  const wrap = document.querySelector(".topo-usuario-wrap");
  if (wrap && !wrap.contains(e.target)) {
    fecharMenuUsuario();
  }
});

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
  const svgOlho = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const svgOlhoFechado = `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  if (input.type === "password") {
    input.type = "text";
    botao.innerHTML = svgOlhoFechado;
  } else {
    input.type = "password";
    botao.innerHTML = svgOlho;
  }
}

function abreviarViveiro(nome) {
  const numero = nome.replace(/\D/g, "");
  const letra = nome.trim()[0].toUpperCase();
  return numero ? `${letra}${numero}` : nome;
}

function limparAreaGestao() {
  const area = document.getElementById("area-gestao");
  area.innerHTML = "";
}

function esconderMenu() {
  document.getElementById("menuGestao").style.display = "none";
}

function voltarMenuGestao() {
  document.getElementById("menuGestao").style.display = "grid";
  limparAreaGestao();
}

// ─── VIVEIRO ─────────────────────────────────────────────────────────────────

function mostrarCadastroViveiro() {
  esconderMenu();
  const area = document.getElementById("area-gestao");

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
        </div>
        <h2 class="form-titulo">Cadastrar Viveiro</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
            <label>Nome do viveiro</label>
          </div>
          <input type="text" id="nomeViveiro" placeholder="Ex: Viveiro 1">
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data de povoamento</label>
          </div>
          <input type="date" id="dataPovoamento">
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
            <label>Total povoado</label>
          </div>
          <input type="text" id="totalPovoadoGestao" placeholder="Ex: 250.000" oninput="formatarPopulacao(this)">
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            <label>Tamanho do viveiro</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="tamanhoViveiro" placeholder="Ex: 0.5">
            <span class="campo-unidade">ha</span>
          </div>
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            <label>Laboratório (fornecedor de pós-larva)</label>
          </div>
          <input type="text" id="laboratorio" placeholder="Ex: Aquatec">
        </div>

        <button class="botao-salvar" onclick="salvarViveiro()">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar viveiro
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">← Voltar</button>
      </div>
    </div>
  `;
}

async function salvarViveiro() {
  const nome = document.getElementById("nomeViveiro").value;
  const data = document.getElementById("dataPovoamento").value;
  const total = document.getElementById("totalPovoadoGestao").value.replace(/\D/g, "");
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

  // Volta pro menu principal com mensagem de sucesso
  voltarMenuGestao();

  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div style="text-align:center; padding: 30px 0;">
      <div style="font-size:48px; margin-bottom:12px">✅</div>
      <p style="font-size:18px; font-weight:800; color:rgb(6,107,99); margin:0 0 6px 0">Viveiro salvo!</p>
      <p style="font-size:14px; color:#6b7280; margin:0">${nome} cadastrado com sucesso.</p>
    </div>
  `;

  setTimeout(() => {
    area.innerHTML = "";
  }, 2500);
}

function mostrarListaViveiros(posicao = 0, direcao = "") {
  esconderMenu();
  const area = document.getElementById("area-gestao");

  if (viveiros.length === 0) {
    area.innerHTML = `
        <p style="text-align:center;color:#9ca3af;padding:20px 0">Nenhum viveiro cadastrado.</p>
        <button class="botao-voltar" onclick="voltarMenuGestao()">Voltar</button>
    `;
    return;
  }

  const viveirosOrdenados = [...viveiros].sort((a, b) => {
    const numA = parseInt(a.nome.replace(/\D/g, "")) || 0;
    const numB = parseInt(b.nome.replace(/\D/g, "")) || 0;
    return numA - numB || a.nome.localeCompare(b.nome, "pt-BR");
  });

  const total = viveirosOrdenados.length;
  const viveiro = viveirosOrdenados[posicao];
  const indexOriginal = viveiros.indexOf(viveiro);

  // Sempre renderiza 3 elementos para o contador ficar sempre centrado
  const navAnterior = posicao > 0
    ? `<button class="botao-nav-viveiro" onclick="mostrarListaViveiros(${posicao - 1}, 'anterior')">← Anterior</button>`
    : `<span class="botao-nav-viveiro" style="visibility:hidden">← Anterior</span>`;

  const navProximo = posicao < total - 1
    ? `<button class="botao-nav-viveiro" onclick="mostrarListaViveiros(${posicao + 1}, 'proximo')">Próximo →</button>`
    : `<span class="botao-nav-viveiro" style="visibility:hidden">Próximo →</span>`;

  area.innerHTML = `
    <h2 class="titulo-secao">Viveiros</h2>

    <div class="viveiro-card">

      <div class="vc-topo">
        <div class="vc-icone-box">🦐</div>
        <div class="vc-titulo-area">
          <h3>${viveiro.nome}</h3>
          <span class="vc-badge-cultivo">● Em cultivo</span>
        </div>
        <div class="vc-pls-badge">
          🦐 ${viveiro.totalPovoado ? Number(String(viveiro.totalPovoado).replace(/\./g, "")).toLocaleString("pt-BR") : "--"} PLs
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

    <div class="nav-viveiros">
      ${navAnterior}
      <span class="nav-viveiros-contador">${posicao + 1} / ${total}</span>
      ${navProximo}
    </div>

    <button class="botao-voltar-form" style="margin-top:4px" onclick="voltarMenuGestao()">← Voltar</button>
  `;

  // Swipe para navegar entre viveiros (toda a área)
  let touchStartX = 0;
  area.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  area.addEventListener("touchend", e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && posicao < total - 1) mostrarListaViveiros(posicao + 1, "proximo");
      if (diff < 0 && posicao > 0) mostrarListaViveiros(posicao - 1, "anterior");
    }
  }, { passive: true });

  // Animação de entrada
  const card = area.querySelector(".viveiro-card");
  if (card && direcao) {
    card.classList.add(direcao === "proximo" ? "slide-in-direita" : "slide-in-esquerda");
  }
}

function abrirViveiro(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");

  const diasCultivo = calcularDiasCultivo(viveiro.dataPovoamento);
  const racoes = viveiro.racoes || [];
  const biometrias = viveiro.biometrias || [];
  const totalRacao = racoes.reduce((total, item) => total + item.racao, 0);
  const ultimaBiometria = biometrias.length > 0 ? biometrias[biometrias.length - 1].gramatura : "--";

  const totalFormatado = viveiro.totalPovoado
    ? Number(String(viveiro.totalPovoado).replace(/\./g, "")).toLocaleString("pt-BR")
    : "--";

  area.innerHTML = `
    <div class="painel-viveiro">

      <div class="viveiro-header">
        <h2 class="viveiro-titulo">${viveiro.nome.toUpperCase()}</h2>
        <div class="viveiro-pls">
          <div class="pls-numero">${totalFormatado} PLs</div>
        </div>
      </div>

      <div class="painel-info">
        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <small>Povoamento</small>
          <strong>${formatarData(viveiro.dataPovoamento)}</strong>
        </div>

        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <small>Laboratório</small>
          <strong>${viveiro.laboratorio || "--"}</strong>
        </div>

        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <small>Dias de cultivo</small>
          <strong>${diasCultivo} dias</strong>
        </div>

        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </div>
          <small>Tamanho</small>
          <strong>${viveiro.tamanho || "--"} ha</strong>
        </div>

        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><path d="M3 11h18M5 11a7 7 0 0 0 14 0"/><path d="M10 4c0 1.5-1 2.5-1 4h6c0-1.5-1-2.5-1-4"/></svg>
          </div>
          <small>Ração consumida</small>
          <strong>${formatarNumeroBR(totalRacao, 1)} kg</strong>
        </div>

        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><path d="M2 12h4l3-9 4 18 3-9h6"/></svg>
          </div>
          <small>Última biometria</small>
          <strong>${ultimaBiometria} g</strong>
        </div>
      </div>

      <div class="painel-acoes">
        <button class="botao-painel" onclick="mostrarLancamentoRacao(${index})">
          <svg viewBox="0 0 24 24"><path d="M3 11h18M5 11a7 7 0 0 0 14 0"/><path d="M10 4c0 1.5-1 2.5-1 4h6c0-1.5-1-2.5-1-4"/></svg>
          Lançar ração
        </button>

        <button class="botao-painel" onclick="abrirBiometria(${index})">
          <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="1"/><line x1="6" y1="7" x2="6" y2="17"/><line x1="10" y1="7" x2="10" y2="12"/><line x1="14" y1="7" x2="14" y2="12"/><line x1="18" y1="7" x2="18" y2="17"/></svg>
          Lançar biometria
        </button>

        <button class="botao-painel" onclick="abrirDespesca(${index})">
          <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Lançar despesca
        </button>

        <button class="botao-painel" onclick="mostrarHistoricoDoViveiroDireto(${index})">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Histórico
        </button>

        <button class="botao-painel botao-alerta" onclick="abrirEncerrarCiclo(${index})">
          <svg viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          Encerrar ciclo
        </button>

        <button class="botao-painel botao-reiniciar" onclick="reiniciarCiclo(${index})">
          <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
          Reiniciar ciclo
        </button>

        <button class="botao-painel botao-perigo" onclick="excluirViveiro(${index})">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Excluir viveiro
        </button>
      </div>

      <button class="botao-voltar-form" onclick="mostrarListaViveiros()">← Voltar</button>
    </div>
  `;
}

// ─── RAÇÃO ────────────────────────────────────────────────────────────────────

function mostrarLancamentoRacao(indexSelecionado = "") {
  if (indexSelecionado === "") esconderMenu();
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
  const hoje = new Date().toISOString().split("T")[0];

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        ${dentroDoViveiro ? `<span class="form-caption">${abreviarViveiro(viveiros[indexSelecionado].nome)}</span>` : ""}
        <h2 class="form-titulo">Lançar Ração</h2>
      </div>
      <div class="form-corpo">
        ${!dentroDoViveiro ? `
          <div class="campo-form">
            <div class="campo-label">
              <svg class="campo-icone" viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
              <label>Viveiro</label>
            </div>
            <select id="viveiroRacao">
              ${viveiros.map((v, i) => `<option value="${i}">${v.nome}</option>`).join("")}
            </select>
          </div>
        ` : ""}

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data</label>
          </div>
          <input type="date" id="dataRacao" value="${hoje}">
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Consumo de ração</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="consumoRacao" placeholder="Ex: 50">
            <span class="campo-unidade">kg</span>
          </div>
        </div>

        <div id="msg-racao-sucesso" class="msg-sucesso-lancamento" style="display:none;">
          <span class="msg-emoji">✅</span>
          <span class="msg-texto">Ração lançada com sucesso!</span>
        </div>

        <button class="botao-salvar" onclick="salvarLancamentoRacao(${dentroDoViveiro ? indexSelecionado : ""})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar lançamento
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${dentroDoViveiro ? `abrirViveiro(${indexSelecionado})` : "voltarMenuGestao()"}">
          ← Voltar
        </button>
      </div>
    </div>
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

  // Verifica se já existe lançamento nessa data (normaliza formato)
  const jaExiste = (viveiros[index].racoes || []).some(r => r.data.substring(0, 10) === data);
  if (jaExiste) {
    alert(`Já existe um lançamento de ração em ${formatarData(data)}. Edite o lançamento existente.`);
    return;
  }

  // Desabilita o botão para evitar duplo clique
  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

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
    if (botao) { botao.disabled = false; botao.style.opacity = ""; }
    return;
  }

  viveiros[index].racoes.push({
    id: racaoSalva[0].id,
    data: data,
    racao: racao,
  });

  // Mostra mensagem de sucesso e reseta o formulário
  document.getElementById("dataRacao").value = new Date().toISOString().split("T")[0];
  document.getElementById("consumoRacao").value = "";
  if (botao) { botao.disabled = false; botao.style.opacity = ""; }

  const msgSucesso = document.getElementById("msg-racao-sucesso");
  if (msgSucesso) {
    msgSucesso.style.display = "flex";
    setTimeout(() => { msgSucesso.style.display = "none"; }, 2500);
  }
}

// ─── BIOMETRIA ────────────────────────────────────────────────────────────────

function abrirBiometria(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const hoje = new Date().toISOString().split("T")[0];

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="12"/><line x1="14" y1="10" x2="14" y2="12"/><line x1="18" y1="10" x2="18" y2="14"/></svg>
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">Lançar Biometria</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data da biometria</label>
          </div>
          <input type="date" id="dataBiometria" value="${hoje}">
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="12"/><line x1="14" y1="10" x2="14" y2="12"/><line x1="18" y1="10" x2="18" y2="14"/></svg>
            <label>Gramatura média</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="gramaturaBiometria" placeholder="Ex: 10">
            <span class="campo-unidade">g</span>
          </div>
        </div>

        <div id="msg-bio-sucesso" class="msg-sucesso-lancamento" style="display:none;">
          <span class="msg-emoji">✅</span>
          <span class="msg-texto">Biometria lançada com sucesso!</span>
        </div>

        <button class="botao-salvar" onclick="salvarBiometria(${index})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar biometria
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirViveiro(${index})">
          ← Voltar
        </button>
      </div>
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

  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

  if (!viveiros[index].biometrias) {
    viveiros[index].biometrias = [];
  }

  const novaBiometria = {
    viveiro_id: viveiros[index].id,
    data: data,
    gramatura: gramatura,
    user_id: usuario.id,
  };

  const { data: bioSalva, error } = await supabaseClient
    .from("biometrias")
    .insert([novaBiometria])
    .select();

  if (error) {
    console.log(error);
    alert(error.message);
    return;
  }

  viveiros[index].biometrias.push({
    id: bioSalva[0].id,
    data: data,
    gramatura: gramatura,
  });

  document.getElementById("dataBiometria").value = new Date().toISOString().split("T")[0];
  document.getElementById("gramaturaBiometria").value = "";
  if (botao) { botao.disabled = false; botao.style.opacity = ""; }

  const msgSucesso = document.getElementById("msg-bio-sucesso");
  if (msgSucesso) {
    msgSucesso.style.display = "flex";
    setTimeout(() => { msgSucesso.style.display = "none"; }, 2500);
  }
}

// ─── DESPESCA ─────────────────────────────────────────────────────────────────

function abrirDespesca(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const hoje = new Date().toISOString().split("T")[0];

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M21 12s-4 6-9 6-9-6-9-6 4-6 9-6 9 6 9 6"/><circle cx="17" cy="12" r="1.5"/><path d="M3 12l-2-3.5M3 12l-2 3.5"/></svg>
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">Lançar Despesca</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data da despesca</label>
          </div>
          <input type="date" id="dataDespesca" value="${hoje}">
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Quantidade despescada</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="quantidadeDespesca" placeholder="Ex: 500">
            <span class="campo-unidade">kg</span>
          </div>
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
            <label>Peso médio</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="pesoMedioDespesca" placeholder="Ex: 12">
            <span class="campo-unidade">g</span>
          </div>
        </div>

        <div id="msg-despesca-sucesso" class="msg-sucesso-lancamento" style="display:none;">
          <span class="msg-emoji">✅</span>
          <span class="msg-texto">Despesca lançada com sucesso!</span>
        </div>

        <button class="botao-salvar" onclick="salvarDespesca(${index})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar despesca
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirViveiro(${index})">
          ← Voltar
        </button>
      </div>
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

  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

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

  const { data: despescaSalva, error } = await supabaseClient
    .from("despescas")
    .insert([novaDespesca])
    .select();

  if (error) {
    console.log(error);
    alert(error.message);
    return;
  }

  viveiros[index].despescas.push({
    id: despescaSalva[0].id,
    data: data,
    tipo: "Parcial",
    quantidadeKg: quantidadeKg,
    pesoMedio: pesoMedio,
  });

  document.getElementById("dataDespesca").value = new Date().toISOString().split("T")[0];
  document.getElementById("quantidadeDespesca").value = "";
  document.getElementById("pesoMedioDespesca").value = "";
  if (botao) { botao.disabled = false; botao.style.opacity = ""; }

  const msgSucesso = document.getElementById("msg-despesca-sucesso");
  if (msgSucesso) {
    msgSucesso.style.display = "flex";
    setTimeout(() => { msgSucesso.style.display = "none"; }, 2500);
  }
}

// ─── HISTÓRICO ────────────────────────────────────────────────────────────────

function mostrarHistoricoCultivo(indexSelecionado = "") {
  esconderMenu();
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
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h2 class="form-titulo">Histórico</h2>
      </div>

      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
            <label>Viveiro</label>
          </div>
          <select id="viveiroHistorico" onchange="mostrarOpcoesHistorico()">
            <option value="">Escolha um viveiro</option>
            ${viveiros.map((viveiro, index) => `
              <option value="${index}" ${String(index) === String(indexSelecionado) ? "selected" : ""}>${viveiro.nome}</option>
            `).join("")}
          </select>
        </div>

        <div id="opcoes-historico"></div>
        <div id="resultado-historico"></div>
      </div>

      <div class="separador-ou"><span>ou</span></div>
      <button class="botao-voltar-form" onclick="voltarMenuGestao()">← Voltar</button>
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
    <div class="historico-opcoes-grid">
      <button class="botao-historico-opcao" onclick="abrirHistoricoBiometria()">
        <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="12"/><line x1="14" y1="10" x2="14" y2="12"/><line x1="18" y1="10" x2="18" y2="14"/></svg>
        Biometria
      </button>
      <button class="botao-historico-opcao" onclick="abrirHistoricoRacao()">
        <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        Ração
      </button>
      <button class="botao-historico-opcao" onclick="abrirHistoricoDespesca()">
        <svg viewBox="0 0 24 24"><path d="M21 12s-4 6-9 6-9-6-9-6 4-6 9-6 9 6 9 6"/><circle cx="17" cy="12" r="1.5"/><path d="M3 12l-2-3.5M3 12l-2 3.5"/></svg>
        Despesca
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
    <div class="form-lancamento">
      <div id="opcoes-historico">
        <div class="form-topo">
          <div class="form-icone-circulo">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
          <h2 class="form-titulo">Histórico</h2>
        </div>

        <div class="historico-opcoes-grid">
          <button class="botao-historico-opcao" onclick="abrirHistoricoBiometriaDireto(${index})">
            <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="12"/><line x1="14" y1="10" x2="14" y2="12"/><line x1="18" y1="10" x2="18" y2="14"/></svg>
            Biometria
          </button>
          <button class="botao-historico-opcao" onclick="abrirHistoricoRacaoDireto(${index})">
            <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Ração
          </button>
          <button class="botao-historico-opcao" onclick="abrirHistoricoDespescaDireto(${index})">
            <svg viewBox="0 0 24 24"><path d="M21 12s-4 6-9 6-9-6-9-6 4-6 9-6 9 6 9 6"/><circle cx="17" cy="12" r="1.5"/><path d="M3 12l-2-3.5M3 12l-2 3.5"/></svg>
            Despesca
          </button>
        </div>

        <div class="separador-ou" style="margin-top:14px"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirViveiro(${index})">← Voltar</button>
      </div>

      <div id="resultado-historico"></div>
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
        <h3 class="titulo-secao">Biometria - ${abreviarViveiro(viveiro.nome)}</h3>

        <div class="tabela-historico">
            <div class="linha-historico-acoes cabecalho">
                <span>DATA</span>
                <span class="col-centro">PESO</span>
                <span class="col-centro">CRESC.</span>
                <span></span>
            </div>

            ${
              biometrias.length === 0
                ? `<p class="sobrevivencia-texto">Nenhuma biometria lançada.</p>`
                : biometrias
                    .map((item, i) => {
                      let crescimento = "-";
                      if (i > 0) {
                        crescimento = (item.gramatura - biometrias[i - 1].gramatura).toFixed(1) + " g";
                      }
                      return `
                        <div class="linha-historico-acoes">
                            <span>${formatarData(item.data)}</span>
                            <span class="col-centro">${formatarNumeroBR(item.gramatura, 1)} g</span>
                            <span class="col-centro">${crescimento}</span>
                            <span class="col-acoes">
                              <button class="botao-editar" onclick="abrirEdicaoBiometria(${index}, ${i}, '${elementoId}', ${direto})">✏️</button>
                              <button class="botao-editar botao-excluir" onclick="excluirBiometria(${index}, ${i}, '${elementoId}', ${direto})">🗑️</button>
                            </span>
                        </div>
                    `;
                    })
                    .join("")
            }
        </div>

    <button class="botao-voltar-form" style="margin-top:10px" onclick="${direto ? `mostrarHistoricoDoViveiroDireto(${index})` : `voltarOpcoesHistorico()`}">← Voltar</button>
    `;
}

function renderizarHistoricoRacao(index, elementoId, direto, pagina = 0, direcao = "") {
  const viveiro = viveiros[index];
  const resultado = document.getElementById(elementoId);
  const racoes = viveiro.racoes || [];

  const ITENS_POR_PAGINA = 30;
  const totalPaginas = Math.max(1, Math.ceil(racoes.length / ITENS_POR_PAGINA));
  pagina = Math.max(0, Math.min(pagina, totalPaginas - 1));

  const inicio = pagina * ITENS_POR_PAGINA;
  const racoesPagina = racoes.slice(inicio, inicio + ITENS_POR_PAGINA);
  const totalRacao = racoes.reduce((total, item) => total + item.racao, 0);

  const navAnterior = pagina > 0
    ? `<button class="botao-nav-viveiro" onclick="renderizarHistoricoRacao(${index},'${elementoId}',${direto},${pagina - 1},'anterior')">← Anterior</button>`
    : `<span class="botao-nav-viveiro" style="visibility:hidden">← Anterior</span>`;

  const navProximo = pagina < totalPaginas - 1
    ? `<button class="botao-nav-viveiro" onclick="renderizarHistoricoRacao(${index},'${elementoId}',${direto},${pagina + 1},'proximo')">Próxima →</button>`
    : `<span class="botao-nav-viveiro" style="visibility:hidden">Próxima →</span>`;

  resultado.innerHTML = `
    <h3 class="titulo-secao">Ração - ${abreviarViveiro(viveiro.nome)}</h3>

    <div class="tabela-historico">
      <div class="linha-historico-racao cabecalho">
        <span>DIA</span>
        <span class="col-centro">DATA</span>
        <span class="col-centro">RAÇÃO</span>
        <span></span>
      </div>
      ${racoes.length === 0
        ? `<p class="sobrevivencia-texto">Nenhuma ração lançada.</p>`
        : racoesPagina.map((item, i) => {
            const iReal = inicio + i;
            return `
              <div class="linha-historico-racao">
                <span>${calcularDiasCultivo(viveiro.dataPovoamento, item.data)}</span>
                <span class="col-centro">${formatarData(item.data)}</span>
                <span class="col-centro">${formatarNumeroBR(item.racao, 1)} kg</span>
                <span class="col-acoes">
                  <button class="botao-editar" onclick="abrirEdicaoRacao(${index},${iReal},'${elementoId}',${direto})">✏️</button>
                  <button class="botao-editar botao-excluir" onclick="excluirRacao(${index},${iReal},'${elementoId}',${direto})">🗑️</button>
                </span>
              </div>`;
          }).join("")
      }
    </div>

    ${totalPaginas > 1 ? `
      <div class="nav-viveiros">
        ${navAnterior}
        <span class="nav-viveiros-contador">Pág. ${pagina + 1} / ${totalPaginas}</span>
        ${navProximo}
      </div>
    ` : ""}

    <div class="total-chip">
      <span class="total-chip-label">Consumo total</span>
      <span class="total-chip-valor">${formatarNumeroBR(totalRacao, 1)} kg</span>
    </div>

    <button class="botao-voltar-form" style="margin-top:10px" onclick="${direto ? `mostrarHistoricoDoViveiroDireto(${index})` : `voltarOpcoesHistorico()`}">← Voltar</button>
  `;

  // Animação de slide ao trocar página
  if (direcao) {
    const tabela = resultado.querySelector(".tabela-historico");
    if (tabela) tabela.classList.add(direcao === "proximo" ? "slide-in-direita" : "slide-in-esquerda");
  }

  // Swipe para trocar página
  if (totalPaginas > 1) {
    let touchStartX = 0;
    resultado.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    resultado.addEventListener("touchend", e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && pagina < totalPaginas - 1) renderizarHistoricoRacao(index, elementoId, direto, pagina + 1, "proximo");
        if (diff < 0 && pagina > 0) renderizarHistoricoRacao(index, elementoId, direto, pagina - 1, "anterior");
      }
    }, { passive: true });
  }
}

function abrirEdicaoRacao(viveiroIndex, racaoIndex, elementoId, direto) {
  const viveiro = viveiros[viveiroIndex];
  const racao = viveiro.racoes[racaoIndex];

  // Quando direto=true, substitui a área inteira para evitar
  // título duplicado e botão Voltar duplo do histórico externo
  const alvo = direto
    ? document.getElementById("area-gestao")
    : document.getElementById(elementoId);

  const acaoVoltar = direto
    ? `voltarParaHistoricoRacaoDireto(${viveiroIndex})`
    : `renderizarHistoricoRacao(${viveiroIndex}, '${elementoId}', ${direto})`;

  alvo.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">Editar Ração</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data</label>
          </div>
          <input type="date" id="dataEdicaoRacao" value="${racao.data}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Consumo de ração</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="qtdEdicaoRacao" value="${racao.racao}" placeholder="Ex: 50">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <button class="botao-salvar" onclick="salvarEdicaoRacao(${viveiroIndex}, ${racaoIndex}, '${elementoId}', ${direto})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${acaoVoltar}">← Voltar</button>
      </div>
    </div>
  `;
}

// ─── EDITAR / EXCLUIR BIOMETRIA ───────────────────────────────────────────────

function abrirEdicaoBiometria(viveiroIndex, bioIndex, elementoId, direto) {
  const viveiro = viveiros[viveiroIndex];
  const bio = viveiro.biometrias[bioIndex];

  const alvo = direto
    ? document.getElementById("area-gestao")
    : document.getElementById(elementoId);

  const acaoVoltar = direto
    ? `mostrarHistoricoDoViveiroDireto(${viveiroIndex}); abrirHistoricoBiometriaDireto(${viveiroIndex})`
    : `renderizarHistoricoBiometria(${viveiroIndex}, '${elementoId}', ${direto})`;

  alvo.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="12"/><line x1="14" y1="10" x2="14" y2="12"/><line x1="18" y1="10" x2="18" y2="14"/></svg>
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">Editar Biometria</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data</label>
          </div>
          <input type="date" id="dataEdicaoBio" value="${bio.data}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="12"/><line x1="14" y1="10" x2="14" y2="12"/><line x1="18" y1="10" x2="18" y2="14"/></svg>
            <label>Gramatura média</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="qtdEdicaoBio" value="${bio.gramatura}" placeholder="Ex: 10">
            <span class="campo-unidade">g</span>
          </div>
        </div>
        <button class="botao-salvar" onclick="salvarEdicaoBiometria(${viveiroIndex}, ${bioIndex}, '${elementoId}', ${direto})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${acaoVoltar}">← Voltar</button>
      </div>
    </div>
  `;
}

async function salvarEdicaoBiometria(viveiroIndex, bioIndex, elementoId, direto) {
  const novaData = document.getElementById("dataEdicaoBio").value;
  const novaQtd = parseFloat(document.getElementById("qtdEdicaoBio").value);

  if (!novaData || !novaQtd) { alert("Preencha a data e a gramatura."); return; }

  const bio = viveiros[viveiroIndex].biometrias[bioIndex];

  const { error } = await supabaseClient
    .from("biometrias")
    .update({ data: novaData, gramatura: novaQtd })
    .eq("id", bio.id);

  if (error) { console.log(error); alert("Erro ao salvar."); return; }

  viveiros[viveiroIndex].biometrias[bioIndex].data = novaData;
  viveiros[viveiroIndex].biometrias[bioIndex].gramatura = novaQtd;

  if (direto) {
    mostrarHistoricoDoViveiroDireto(viveiroIndex);
    abrirHistoricoBiometriaDireto(viveiroIndex);
  } else {
    renderizarHistoricoBiometria(viveiroIndex, elementoId, direto);
  }
}

async function excluirBiometria(viveiroIndex, bioIndex, elementoId, direto) {
  if (!confirm("Excluir esta biometria?")) return;

  const bio = viveiros[viveiroIndex].biometrias[bioIndex];

  const { error } = await supabaseClient.from("biometrias").delete().eq("id", bio.id);

  if (error) { console.log(error); alert("Erro ao excluir."); return; }

  viveiros[viveiroIndex].biometrias.splice(bioIndex, 1);
  renderizarHistoricoBiometria(viveiroIndex, elementoId, direto);
}

// ─── EDITAR / EXCLUIR DESPESCA ────────────────────────────────────────────────

function abrirEdicaoDespesca(viveiroIndex, despIndex, elementoId, direto) {
  const viveiro = viveiros[viveiroIndex];
  const desp = viveiro.despescas[despIndex];

  const alvo = direto
    ? document.getElementById("area-gestao")
    : document.getElementById(elementoId);

  const acaoVoltar = direto
    ? `mostrarHistoricoDoViveiroDireto(${viveiroIndex}); abrirHistoricoDespescaDireto(${viveiroIndex})`
    : `renderizarHistoricoDespesca(${viveiroIndex}, '${elementoId}', ${direto})`;

  alvo.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M21 12s-4 6-9 6-9-6-9-6 4-6 9-6 9 6 9 6"/><circle cx="17" cy="12" r="1.5"/><path d="M3 12l-2-3.5M3 12l-2 3.5"/></svg>
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">Editar Despesca</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data</label>
          </div>
          <input type="date" id="dataEdicaoDesp" value="${desp.data}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Quantidade</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="qtdEdicaoDesp" value="${desp.quantidadeKg}" placeholder="Ex: 500">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
            <label>Peso médio</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="pesoEdicaoDesp" value="${desp.pesoMedio}" placeholder="Ex: 12">
            <span class="campo-unidade">g</span>
          </div>
        </div>
        <button class="botao-salvar" onclick="salvarEdicaoDespesca(${viveiroIndex}, ${despIndex}, '${elementoId}', ${direto})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${acaoVoltar}">← Voltar</button>
      </div>
    </div>
  `;
}

async function salvarEdicaoDespesca(viveiroIndex, despIndex, elementoId, direto) {
  const novaData = document.getElementById("dataEdicaoDesp").value;
  const novaQtd = parseFloat(document.getElementById("qtdEdicaoDesp").value);
  const novoPeso = parseFloat(document.getElementById("pesoEdicaoDesp").value);

  if (!novaData || !novaQtd || !novoPeso) { alert("Preencha todos os campos."); return; }

  const desp = viveiros[viveiroIndex].despescas[despIndex];

  const { error } = await supabaseClient
    .from("despescas")
    .update({ data: novaData, quantidade_kg: novaQtd, peso_medio: novoPeso })
    .eq("id", desp.id);

  if (error) { console.log(error); alert("Erro ao salvar."); return; }

  viveiros[viveiroIndex].despescas[despIndex].data = novaData;
  viveiros[viveiroIndex].despescas[despIndex].quantidadeKg = novaQtd;
  viveiros[viveiroIndex].despescas[despIndex].pesoMedio = novoPeso;

  if (direto) {
    mostrarHistoricoDoViveiroDireto(viveiroIndex);
    abrirHistoricoDespescaDireto(viveiroIndex);
  } else {
    renderizarHistoricoDespesca(viveiroIndex, elementoId, direto);
  }
}

async function excluirDespesca(viveiroIndex, despIndex, elementoId, direto) {
  if (!confirm("Excluir esta despesca?")) return;

  const desp = viveiros[viveiroIndex].despescas[despIndex];

  const { error } = await supabaseClient.from("despescas").delete().eq("id", desp.id);

  if (error) { console.log(error); alert("Erro ao excluir."); return; }

  viveiros[viveiroIndex].despescas.splice(despIndex, 1);
  renderizarHistoricoDespesca(viveiroIndex, elementoId, direto);
}

function voltarParaHistoricoRacaoDireto(viveiroIndex) {
  mostrarHistoricoDoViveiroDireto(viveiroIndex);
  abrirHistoricoRacaoDireto(viveiroIndex);
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

  if (direto) {
    voltarParaHistoricoRacaoDireto(viveiroIndex);
  } else {
    renderizarHistoricoRacao(viveiroIndex, elementoId, direto);
  }
}

async function excluirRacao(viveiroIndex, racaoIndex, elementoId, direto) {
  if (!confirm("Excluir este lançamento de ração?")) return;

  const racao = viveiros[viveiroIndex].racoes[racaoIndex];

  if (!racao || !racao.id) {
    alert("Erro: lançamento sem ID.");
    return;
  }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const { data: deletado, error } = await supabaseClient
    .from("racoes")
    .delete()
    .eq("id", racao.id)
    .eq("user_id", usuario.id)
    .select();

  if (error) {
    console.log(error);
    alert("Erro ao excluir lançamento.");
    return;
  }

  if (!deletado || deletado.length === 0) {
    alert("Não foi possível excluir. Verifique sua conexão ou permissão.");
    return;
  }

  viveiros[viveiroIndex].racoes.splice(racaoIndex, 1);

  renderizarHistoricoRacao(viveiroIndex, elementoId, direto);
}

// ─── CICLO ───────────────────────────────────────────────────────────────────

function reiniciarCiclo(index) {
  mostrarFormularioReinicio(index);
}

function mostrarFormularioReinicio(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const hoje = new Date().toISOString().split("T")[0];

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo" style="background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.2)">
          <svg viewBox="0 0 24 24" style="stroke:#ef4444"><polyline points="23 4 23 10 17 10"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">Reiniciar Ciclo</h2>
      </div>
      <div class="aviso-reinicio">
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:#b45309;fill:none;stroke-width:2;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>Todo o histórico de ração, biometrias e despescas será <strong>apagado</strong>.</span>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Nova data de povoamento</label>
          </div>
          <input type="date" id="novoPovoamento" value="${hoje}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <label>Novo total povoado</label>
          </div>
          <input type="text" id="novoTotal" placeholder="Ex: 50.000" oninput="formatarPopulacao(this)">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <label>Laboratório</label>
          </div>
          <input type="text" id="novoLaboratorio" placeholder="Nome do laboratório">
        </div>
        <button class="botao-salvar botao-alerta" onclick="salvarNovoCiclo(${index})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
          Confirmar reinício
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirViveiro(${index})">← Cancelar</button>
      </div>
    </div>
  `;
}

// CORREÇÃO: salvarNovoCiclo agora salva no banco de dados
async function salvarNovoCiclo(index) {
  const novoPovoamento = document.getElementById("novoPovoamento").value;
  const novoTotal = document.getElementById("novoTotal").value.replace(/\D/g, "");
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
        <h3 class="titulo-secao">Despesca - ${abreviarViveiro(viveiro.nome)}</h3>

        <div class="tabela-historico">
            <div class="linha-historico-acoes cabecalho">
                <span>DATA</span>
                <span class="col-centro">KG</span>
                <span class="col-centro">PESO</span>
                <span></span>
            </div>

            ${
              despescas.length === 0
                ? `<p class="sobrevivencia-texto">Nenhuma despesca lançada.</p>`
                : despescas
                    .map((item, i) => `
                    <div class="linha-historico-acoes">
                        <span>${formatarData(item.data)}</span>
                        <span class="col-centro">${formatarNumeroBR(item.quantidadeKg, 1)} kg</span>
                        <span class="col-centro">${formatarNumeroBR(item.pesoMedio, 1)} g</span>
                        <span class="col-acoes">
                          <button class="botao-editar" onclick="abrirEdicaoDespesca(${index}, ${i}, '${elementoId}', ${direto})">✏️</button>
                          <button class="botao-editar botao-excluir" onclick="excluirDespesca(${index}, ${i}, '${elementoId}', ${direto})">🗑️</button>
                        </span>
                    </div>
                `)
                    .join("")
            }
        </div>

    <div class="total-chip">
      <span class="total-chip-label">Total despescado</span>
      <span class="total-chip-valor">${formatarNumeroBR(totalDespescado, 1)} kg</span>
    </div>

    <button class="botao-voltar-form" style="margin-top:10px" onclick="${direto ? `mostrarHistoricoDoViveiroDireto(${index})` : `voltarOpcoesHistorico()`}">← Voltar</button>
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
  esconderMenu();
  const area = document.getElementById("area-gestao");
  const tituloHtml = `<h2 class="titulo-secao">Histórico de Ciclos</h2>`;

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
      <div class="form-topo" style="margin-top:8px">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        </div>
        <h2 class="form-titulo">Histórico de Ciclos</h2>
      </div>
      <p style="text-align:center;color:#9ca3af;padding:16px 0;font-size:14px">Nenhum ciclo encerrado ainda.</p>
      <button class="botao-voltar-form" onclick="voltarMenuGestao()">← Voltar</button>
    `;
    return;
  }

  area.innerHTML = `
    <div class="form-topo" style="margin-top:8px">
      <div class="form-icone-circulo">
        <svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
      </div>
      <h2 class="form-titulo">Histórico de Ciclos</h2>
    </div>
  ` + ciclos.map(item => `
    <div class="ciclo-card">
      <div class="ciclo-card-topo">
        <span class="ciclo-card-nome">${item.viveiro}</span>
        <span class="ciclo-card-producao">${formatarNumeroBR(item.ciclo.producaoTotal || 0, 1)} kg</span>
      </div>
      <div class="ciclo-card-infos">
        <div class="ciclo-info-item">
          <span class="ciclo-info-label">Povoamento</span>
          <span class="ciclo-info-valor">${formatarData(item.ciclo.dataPovoamento)}</span>
        </div>
        <div class="ciclo-info-item">
          <span class="ciclo-info-label">Encerramento</span>
          <span class="ciclo-info-valor">${formatarData(item.ciclo.dataEncerramento)}</span>
        </div>
        <div class="ciclo-info-item">
          <span class="ciclo-info-label">Sobrevivência</span>
          <span class="ciclo-info-valor">${formatarNumeroBR(item.ciclo.sobrevivencia || 0, 1)}%</span>
        </div>
      </div>
    </div>
  `).join("") + `<button class="botao-voltar-form" style="margin-top:8px" onclick="voltarMenuGestao()">← Voltar</button>`;
}

function abrirFinanceiro() {
  esconderMenu();
  const area = document.getElementById("area-gestao");

  area.innerHTML = `
    <div class="form-topo" style="margin-top:8px">
      <div class="form-icone-circulo">
        <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </div>
      <h2 class="form-titulo">Financeiro</h2>
    </div>
    <div style="text-align:center;padding:24px 16px;background:#f8fafc;border-radius:14px;border:1px solid #e5e7eb;margin-bottom:12px">
      <p style="font-size:32px;margin:0 0 8px">🚧</p>
      <p style="font-size:14px;font-weight:700;color:#374151;margin:0 0 4px">Módulo em desenvolvimento</p>
      <p style="font-size:13px;color:#9ca3af;margin:0">Em breve você poderá registrar custos e receitas do seu cultivo.</p>
    </div>
    <button class="botao-voltar-form" onclick="voltarMenuGestao()">← Voltar</button>
  `;
}

function abrirEncerrarCiclo(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");

  const hoje = new Date().toISOString().split("T")[0];

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">Encerrar Ciclo</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data de encerramento</label>
          </div>
          <input type="date" id="dataEncerramento" value="${hoje}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Produção final</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="producaoFinal" placeholder="Ex: 1000">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
            <label>Peso médio final</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="pesoFinal" placeholder="Ex: 12">
            <span class="campo-unidade">g</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <label>Observações</label>
          </div>
          <input type="text" id="observacoesCiclo" placeholder="Opcional">
        </div>
        <button class="botao-salvar botao-alerta" onclick="salvarEncerramentoCiclo(${index})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          Finalizar ciclo
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirViveiro(${index})">← Voltar</button>
      </div>
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

      <!-- ── HEADER ── -->
      <div class="rel-header">
        <div class="rel-logo">
          <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </div>
        <div class="rel-marca">
          <span class="rel-marca-nome">WA AQUA GESTÃO</span>
          <span class="rel-marca-sub">Relatório de Ciclo</span>
        </div>
      </div>
      <div class="rel-viveiro-badge">${ciclo.nomeViveiro}</div>
      <div class="rel-divider"></div>

      <!-- ── PERÍODO ── -->
      <div class="rel-periodo">
        <div class="rel-periodo-datas">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>${formatarData(ciclo.dataPovoamento)}</span>
          <span class="rel-seta">→</span>
          <span>${formatarData(ciclo.dataEncerramento)}</span>
        </div>
        <div class="rel-periodo-dias">${ciclo.diasCultivo} dias</div>
      </div>

      <!-- ── INFORMAÇÕES DO CICLO ── -->
      <div class="relatorio-secao">
        <h3>Informações do ciclo</h3>
        <div class="rel-info-lista">
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>Data de povoamento</span>
            </div>
            <strong>${formatarData(ciclo.dataPovoamento)}</strong>
          </div>
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>Total povoado</span>
            </div>
            <strong>${Number(ciclo.totalPovoado).toLocaleString("pt-BR")} PLs</strong>
          </div>
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>Laboratório</span>
            </div>
            <strong>${ciclo.laboratorio}</strong>
          </div>
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
              <span>Tamanho</span>
            </div>
            <strong>${ciclo.tamanho} ha</strong>
          </div>
        </div>
      </div>

      <!-- ── RESULTADO PRODUTIVO ── -->
      <div class="relatorio-secao">
        <h3>Resultado produtivo</h3>
        <div class="rel-metricas-grid">
          <div class="rel-metrica-card">
            <span class="rel-metrica-valor">${formatarNumeroBR(ciclo.produtividade, 1)}</span>
            <span class="rel-metrica-unidade">kg/ha</span>
            <span class="rel-metrica-nome">Produtividade</span>
          </div>
          <div class="rel-metrica-card">
            <span class="rel-metrica-valor">${formatarNumeroBR(ciclo.pesoFinal, 1)}</span>
            <span class="rel-metrica-unidade">g</span>
            <span class="rel-metrica-nome">Peso médio final</span>
          </div>
        </div>
        <div class="rel-sobrevivencia">
          <div class="rel-sobrev-esq">
            <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <span>Sobrevivência</span>
          </div>
          <span class="rel-sobrev-valor">${formatarNumeroBR(ciclo.sobrevivencia, 1)}%</span>
        </div>
      </div>

      <!-- ── ALIMENTAÇÃO ── -->
      <div class="relatorio-secao">
        <h3>Alimentação</h3>
        <div class="rel-info-lista">
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><path d="M3 3h18v18H3z" rx="2"/><path d="M8 12h8M12 8v8"/></svg>
              <span>Ração consumida</span>
            </div>
            <strong>${formatarNumeroBR(ciclo.racaoConsumida, 1)} kg</strong>
          </div>
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              <span>FCA final</span>
            </div>
            <strong>${formatarNumeroBR(ciclo.fca, 2)}</strong>
          </div>
        </div>
      </div>

      <!-- ── DESPESCA ── -->
      <div class="relatorio-secao">
        <h3>Despesca</h3>
        <div class="rel-info-lista">
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              <span>Despesca parcial</span>
            </div>
            <strong>${formatarNumeroBR(ciclo.despescaParcial, 1)} kg</strong>
          </div>
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              <span>Despesca total</span>
            </div>
            <strong>${formatarNumeroBR(ciclo.producaoFinal, 1)} kg</strong>
          </div>
        </div>
      </div>

      <!-- ── HERO: PRODUÇÃO FINAL ── -->
      <div class="rel-producao-hero">
        <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        <span class="rel-hero-label">Produção final do ciclo</span>
        <span class="rel-hero-valor">${formatarNumeroBR(ciclo.producaoTotal, 1)} kg</span>
      </div>

      <!-- ── AÇÕES ── -->
      <div class="acoes-relatorio">
        <button class="botao-salvar" onclick="window.print()">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir relatório
        </button>
        <button class="botao-voltar-form" onclick="abrirViveiro(${index})">← Voltar ao viveiro</button>
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
        id: bio.id,
        data: bio.data,
        gramatura: Number(bio.gramatura),
      })),

    despescas: despescasData
      .filter((despesca) => despesca.viveiro_id === item.id)
      .map((despesca) => ({
        id: despesca.id,
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

  // Ordenar viveiros por número no nome (Viveiro 1, Viveiro 2...)
  viveiros.sort((a, b) => {
    const numA = parseInt(a.nome.replace(/\D/g, "")) || 0;
    const numB = parseInt(b.nome.replace(/\D/g, "")) || 0;
    return numA - numB || a.nome.localeCompare(b.nome, "pt-BR");
  });

  console.log("Viveiros carregados:", viveiros);
}

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (session) {
      document.querySelector(".topo").style.display = "";
      document.getElementById("menuGestao").style.display = "grid";
      await carregarViveiros();
    } else {
      window.location.href = "login.html";
    }
  } catch (error) {
    console.log("Erro na inicialização:", error);
    window.location.href = "login.html";
  }
});
