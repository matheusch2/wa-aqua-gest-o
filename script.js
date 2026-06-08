const SUPABASE_URL = "https://bzlzjjodzyxvkakfmmxw.supabase.co";
const SUPABASE_KEY = "sb_publishable_Avq19q531p8NrIRaHf5VvQ_DoWzOoaW";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let viveiros = [];
let produtos = []; let tiposRacao = [];

async function toggleMenuUsuario() {
  const menu = document.getElementById("menu-usuario");
  if (menu.classList.contains("aberto")) {
    fecharMenuUsuario();
    return;
  }

  // Carregar dados do usuário
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const nome = user.user_metadata?.nome || user.email?.split("@")[0] || "Usuário";
  const email = user.email || "";
  const fotoUrl = user.user_metadata?.avatar_url || null;

  document.getElementById("menu-usuario-nome").textContent = nome;
  document.getElementById("menu-usuario-email").textContent = email;

  // Avatar no menu
  const avatarMenu = document.getElementById("menu-avatar");
  if (fotoUrl) {
    avatarMenu.innerHTML = `<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    const iniciais = nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
    avatarMenu.innerHTML = `<span class="menu-avatar-iniciais">${iniciais}</span>`;
  }

  // Avatar no topo
  const avatarTopo = document.getElementById("avatar-topo");
  if (fotoUrl) {
    avatarTopo.innerHTML = `<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    const iniciais = nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
    avatarTopo.innerHTML = `<span class="avatar-topo-iniciais">${iniciais || "?"}</span>`;
  }

  // Tema
  const temaDark = document.body.classList.contains("tema-escuro");
  document.getElementById("tema-toggle").querySelector(".menu-tema-bolinha").style.left = temaDark ? "21px" : "3px";

  // Fechar foto opcoes
  document.getElementById("menu-foto-opcoes").style.display = "none";

  menu.classList.add("aberto");
}

function abrirOpcoesFoto() {
  const opcoes = document.getElementById("menu-foto-opcoes");
  opcoes.style.display = opcoes.style.display === "none" ? "flex" : "none";
}

async function uploadFotoPerfil(input) {
  const file = input.files[0];
  if (!file) return;

  // Comprimir para 80x80 JPEG
  const canvas = document.createElement("canvas");
  canvas.width = 80; canvas.height = 80;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = async () => {
    const ctx = canvas.getContext("2d");
    const size = Math.min(img.width, img.height);
    const x = (img.width - size) / 2;
    const y = (img.height - size) / 2;
    ctx.drawImage(img, x, y, size, size, 0, 0, 80, 80);
    URL.revokeObjectURL(url);

    const base64 = canvas.toDataURL("image/jpeg", 0.5);

    const { error } = await supabaseClient.auth.updateUser({
      data: { avatar_url: base64 }
    });

    if (error) { alert("Erro ao salvar foto."); return; }

    // Atualizar UI
    document.getElementById("menu-avatar").innerHTML =
      `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    document.getElementById("avatar-topo").innerHTML =
      `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    document.getElementById("menu-foto-opcoes").style.display = "none";
  };
  img.src = url;
}

async function excluirFotoPerfil() {
  const { error } = await supabaseClient.auth.updateUser({ data: { avatar_url: null } });
  if (error) { alert("Erro ao excluir foto."); return; }

  const { data: { user } } = await supabaseClient.auth.getUser();
  const nome = user?.user_metadata?.nome || user?.email?.split("@")[0] || "?";
  const iniciais = nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);

  document.getElementById("menu-avatar").innerHTML = `<span class="menu-avatar-iniciais">${iniciais}</span>`;
  document.getElementById("avatar-topo").innerHTML = `<span class="avatar-topo-iniciais">${iniciais}</span>`;
  document.getElementById("menu-foto-opcoes").style.display = "none";
}

function abrirPerfilUsuario() {
  fecharMenuUsuario();
  supabaseClient.auth.getUser().then(({ data: { user } }) => {
    const nome = user?.user_metadata?.nome || "";
    const area = document.getElementById("area-gestao");
    esconderMenu();
    area.innerHTML = `
      <div class="form-lancamento">
        <div class="form-topo">
          <div class="form-icone-circulo">
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h2 class="form-titulo">Perfil</h2>
        </div>
        <div class="form-corpo">
          <div class="campo-form">
            <div class="campo-label">
              <svg class="campo-icone" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <label>Nome da fazenda</label>
            </div>
            <input type="text" id="inputNomePerfil" placeholder="Ex: Fazenda São João" value="${nome}">
          </div>
          <button class="botao-salvar" onclick="salvarNomePerfil()">
            <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Salvar
          </button>
          <div class="separador-ou"><span>ou</span></div>
          <button class="botao-voltar-form" onclick="voltarMenuGestao()">← Voltar</button>
        </div>
      </div>
    `;
  });
}

async function salvarNomePerfil() {
  const nome = document.getElementById("inputNomePerfil").value.trim();
  if (!nome) { alert("Digite um nome."); return; }

  const { error } = await supabaseClient.auth.updateUser({ data: { nome } });
  if (error) { alert("Erro ao salvar."); return; }

  voltarMenuGestao();
}

function abrirSegurancaUsuario() {
  fecharMenuUsuario();
  const area = document.getElementById("area-gestao");
  esconderMenu();
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h2 class="form-titulo">Segurança</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <label>Nova senha</label>
          </div>
          <input type="password" id="inputNovaSenha" placeholder="Mínimo 6 caracteres">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <label>Confirmar nova senha</label>
          </div>
          <input type="password" id="inputConfirmarSenha" placeholder="Repita a nova senha">
        </div>
        <button class="botao-salvar" onclick="salvarSenha()">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar nova senha
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">← Voltar</button>
      </div>
    </div>
  `;
}

async function salvarSenha() {
  const nova = document.getElementById("inputNovaSenha").value;
  const confirmar = document.getElementById("inputConfirmarSenha").value;

  if (!nova || nova.length < 6) { alert("A senha deve ter no mínimo 6 caracteres."); return; }
  if (nova !== confirmar) { alert("As senhas não coincidem."); return; }

  const { error } = await supabaseClient.auth.updateUser({ password: nova });
  if (error) { alert("Erro ao alterar senha: " + error.message); return; }

  alert("Senha alterada com sucesso!");
  voltarMenuGestao();
}

function toggleTema() {
  document.body.classList.toggle("tema-escuro");
  const escuro = document.body.classList.contains("tema-escuro");
  localStorage.setItem("tema", escuro ? "escuro" : "claro");
  const bolinha = document.querySelector("#tema-toggle .menu-tema-bolinha");
  if (bolinha) bolinha.style.left = escuro ? "21px" : "3px";
  document.querySelector(".menu-tema-toggle") &&
    (document.querySelector(".menu-tema-toggle").style.background = escuro ? "rgb(6,107,99)" : "");
}


async function sairUsuario() {
  fecharMenuUsuario();
  await supabaseClient.auth.signOut();
  viveiros = [];
  window.location.href = "login.html";
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

function parseMoedaBR(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/\./g, "").replace(",", ".")) || 0;
}

function formatarMoedaBlur(input) {
  let v = input.value.trim();
  if (!v) return;
  if (v.includes(",")) { v = v.replace(/\./g, "").replace(",", "."); }
  const n = parseFloat(v);
  if (isNaN(n)) { input.value = ""; return; }
  input.value = n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function posicaoNaLista(index) {
  const ordenados = [...viveiros].sort((a, b) => {
    const numA = parseInt(a.nome.replace(/\D/g, "")) || 0;
    const numB = parseInt(b.nome.replace(/\D/g, "")) || 0;
    return numA - numB || a.nome.localeCompare(b.nome, "pt-BR");
  });
  return Math.max(0, ordenados.indexOf(viveiros[index]));
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

  // Recarrega do banco para garantir estado sincronizado
  await carregarViveiros();

  // Vai pra lista de viveiros com mensagem de sucesso
  mostrarListaViveiros(0, "", `${nome} cadastrado com sucesso!`);
}

function mostrarListaViveiros(posicao = 0, direcao = "", msg = "") {
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
          ${viveiro.dataPovoamento
            ? `<span class="vc-badge-cultivo">● Em cultivo</span>`
            : `<span class="vc-badge-vazio">● Vazio</span>`}
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

  // Mensagem de sucesso (ex: após excluir viveiro)
  if (msg) {
    const toast = document.createElement("div");
    toast.className = "toast-sucesso";
    toast.innerHTML = `<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ${msg}`;
    area.prepend(toast);
    setTimeout(() => toast.remove(), 3000);
  }

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

  // Se o viveiro não tem ciclo ativo, mostra tela de novo ciclo
  if (!viveiro.dataPovoamento) {
    mostrarViveiroSemCiclo(index);
    return;
  }

  const diasCultivo = calcularDiasCultivo(viveiro.dataPovoamento);
  const racoes = viveiro.racoes || [];
  const biometrias = viveiro.biometrias || [];
  const totalRacao = racoes.reduce((total, item) => total + item.racao, 0);
  const totalCustos = (viveiro.custos || []).reduce((s, c) => s + Number(c.valor), 0);

  // Última biometria e média de crescimento
  const biosSorted = [...biometrias].sort((a, b) => a.data.localeCompare(b.data));
  const ultimaBiometria = biosSorted.length > 0 ? biosSorted[biosSorted.length - 1].gramatura : "--";
  let mediaCrescimento = "--";
  if (biosSorted.length >= 2) {
    const taxas = [];
    for (let i = 1; i < biosSorted.length; i++) {
      const dias = Math.round((new Date(biosSorted[i].data) - new Date(biosSorted[i - 1].data)) / 86400000);
      if (dias > 0) taxas.push((biosSorted[i].gramatura - biosSorted[i - 1].gramatura) / dias);
    }
    if (taxas.length > 0) {
      const mediaGDia = taxas.reduce((s, v) => s + v, 0) / taxas.length;
      mediaCrescimento = formatarNumeroBR(mediaGDia * 7, 2) + " g/sem";
    }
  }

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
            <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <small>Custo parcial</small>
          <strong>${totalCustos > 0 ? "R$ " + formatarNumeroBR(totalCustos, 2) : "--"}</strong>
        </div>

        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><path d="M2 12h4l3-9 4 18 3-9h6"/></svg>
          </div>
          <small>Última biometria</small>
          <strong>${ultimaBiometria} g</strong>
        </div>

        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
          </div>
          <small>Média de crescimento</small>
          <strong>${mediaCrescimento}</strong>
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

        <button class="botao-painel" onclick="abrirLancarCusto(${index})">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Lançar custo
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

      <button class="botao-voltar-form" onclick="mostrarListaViveiros(posicaoNaLista(${index}))">← Voltar</button>
    </div>
  `;
}

// ─── RAÇÕES CATÁLOGO ──────────────────────────────────────────────────────────

function abrirRacoesCatalogo() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <h2 class="form-titulo">Rações</h2>
      </div>
      <div class="form-corpo">
        <div class="historico-opcoes-grid">
          <button class="botao-historico-opcao" onclick="abrirCadastrarTipoRacao()">
            <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Cadastrar ração
          </button>
          <button class="botao-historico-opcao" onclick="abrirVerTiposRacao()">
            <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Ver rações
          </button>
        </div>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">← Voltar</button>
      </div>
    </div>
  `;
}

function abrirCadastrarTipoRacao() {
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <h2 class="form-titulo">Cadastrar Ração</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Nome da ração</label>
          </div>
          <input type="text" id="nomeTipoRacao" placeholder="Ex: Samaria Start T1">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Peso do saco</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="pesoSacoRacao" value="30" step="0.1" oninput="calcularPreviaSacoRacao()">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Valor do saco</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="valorSacoRacao" placeholder="Ex: 120,00" onblur="formatarMoedaBlur(this); calcularPreviaSacoRacao()">
            <span class="campo-unidade">R$</span>
          </div>
        </div>
        <div id="previa-saco-racao" class="custo-por-grama-preview" style="display:none">
          Custo por kg: <strong id="previa-saco-racao-valor">—</strong>
        </div>
        <div id="erro-tipo-racao" style="display:none;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 12px;font-size:13px;color:#b91c1c;margin-bottom:4px"></div>
        <button class="botao-salvar" onclick="salvarTipoRacao()">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirRacoesCatalogo()">← Voltar</button>
      </div>
    </div>
  `;
}

function calcularPreviaSacoRacao() {
  const peso = parseFloat(document.getElementById("pesoSacoRacao")?.value);
  const valor = parseMoedaBR(document.getElementById("valorSacoRacao")?.value);
  const div = document.getElementById("previa-saco-racao");
  const el = document.getElementById("previa-saco-racao-valor");
  if (div && el && peso > 0 && valor > 0) {
    el.textContent = `R$ ${formatarNumeroBR(valor / peso, 2)}/kg`;
    div.style.display = "block";
  } else if (div) {
    div.style.display = "none";
  }
}

function mostrarErroTipoRacao(msg) {
  const el = document.getElementById("erro-tipo-racao");
  if (el) { el.textContent = msg; el.style.display = "block"; }
}

async function salvarTipoRacao() {
  const nome = document.getElementById("nomeTipoRacao").value.trim();
  const pesoSacoKg = parseFloat(document.getElementById("pesoSacoRacao").value);
  const valorSaco = parseMoedaBR(document.getElementById("valorSacoRacao").value);
  const erroEl = document.getElementById("erro-tipo-racao");
  if (erroEl) erroEl.style.display = "none";

  if (!nome) { mostrarErroTipoRacao("Digite o nome da ração."); return; }
  if (!pesoSacoKg || pesoSacoKg <= 0) { mostrarErroTipoRacao("Digite o peso do saco."); return; }
  if (!valorSaco || valorSaco <= 0) { mostrarErroTipoRacao("Digite o valor do saco."); return; }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const custoPorKg = valorSaco / pesoSacoKg;
  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

  const { data: salvo, error } = await supabaseClient
    .from("tipos_racao")
    .insert([{ user_id: usuario.id, nome, peso_saco_kg: pesoSacoKg, valor_saco: valorSaco, custo_por_kg: custoPorKg }])
    .select();

  if (botao) { botao.disabled = false; botao.style.opacity = ""; }
  if (error) {
    mostrarErroTipoRacao(
      error.code === "42P01"
        ? "Tabela 'tipos_racao' não existe. Execute o SQL no Supabase primeiro."
        : "Erro ao salvar: " + error.message
    );
    return;
  }

  tiposRacao.push({ id: salvo[0].id, nome, pesoSacoKg, valorSaco, custoPorKg });
  abrirVerTiposRacao();
}

function abrirVerTiposRacao() {
  const area = document.getElementById("area-gestao");

  if (tiposRacao.length === 0) {
    area.innerHTML = `
      <div class="form-lancamento">
        <div class="form-topo">
          <div class="form-icone-circulo">
            <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </div>
          <h2 class="form-titulo">Rações Cadastradas</h2>
        </div>
        <div class="form-corpo">
          <div class="viveiro-sem-ciclo-msg">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Nenhuma ração cadastrada ainda.</span>
          </div>
          <button class="botao-voltar-form" onclick="abrirRacoesCatalogo()">← Voltar</button>
        </div>
      </div>
    `;
    return;
  }

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <h2 class="form-titulo">Rações Cadastradas</h2>
      </div>
      <div class="form-corpo">
        <div class="lista-produtos">
          ${tiposRacao.map((t, i) => `
            <div class="produto-item" id="tipo-racao-item-${i}">
              <div class="produto-info">
                <span class="produto-nome">${t.nome}</span>
                <span class="produto-detalhe">${formatarNumeroBR(t.pesoSacoKg, 0)} kg/saco · R$ ${formatarNumeroBR(t.valorSaco, 2)}/saco · R$ ${formatarNumeroBR(t.custoPorKg, 2)}/kg</span>
              </div>
              <span class="col-acoes">
                <button class="botao-editar" onclick="abrirEdicaoTipoRacao(${i})">✏️</button>
                <button class="botao-editar botao-excluir" onclick="confirmarExcluirTipoRacao(${i})">🗑️</button>
              </span>
            </div>
          `).join("")}
        </div>
        <button class="botao-voltar-form" onclick="abrirRacoesCatalogo()">← Voltar</button>
      </div>
    </div>
  `;
}

function confirmarExcluirTipoRacao(i) {
  const item = document.getElementById(`tipo-racao-item-${i}`);
  if (!item) return;
  item.innerHTML = `
    <div class="confirmar-exclusao-custo">
      <span>Excluir <strong>${tiposRacao[i].nome}</strong>?</span>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirTipoRacao(${i})">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="abrirVerTiposRacao()">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirTipoRacao(i) {
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;
  const { error } = await supabaseClient.from("tipos_racao").delete().eq("id", tiposRacao[i].id).eq("user_id", usuario.id);
  if (error) { alert("Erro ao excluir: " + error.message); return; }
  tiposRacao.splice(i, 1);
  abrirVerTiposRacao();
}

function abrirEdicaoTipoRacao(i) {
  const t = tiposRacao[i];
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <h2 class="form-titulo">Editar Ração</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Nome da ração</label>
          </div>
          <input type="text" id="editNomeTipoRacao" value="${t.nome}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Peso do saco</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="editPesoSacoRacao" value="${t.pesoSacoKg}" step="0.1">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Valor do saco</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="editValorSacoRacao" value="${t.valorSaco.toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2})}" onblur="formatarMoedaBlur(this)">
            <span class="campo-unidade">R$</span>
          </div>
        </div>
        <button class="botao-salvar" onclick="salvarEdicaoTipoRacao(${i})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirVerTiposRacao()">← Voltar</button>
      </div>
    </div>
  `;
}

async function salvarEdicaoTipoRacao(i) {
  const nome = document.getElementById("editNomeTipoRacao").value.trim();
  const pesoSacoKg = parseFloat(document.getElementById("editPesoSacoRacao").value);
  const valorSaco = parseMoedaBR(document.getElementById("editValorSacoRacao").value);

  if (!nome || !pesoSacoKg || !valorSaco) { alert("Preencha todos os campos."); return; }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const custoPorKg = valorSaco / pesoSacoKg;
  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

  const { error } = await supabaseClient.from("tipos_racao")
    .update({ nome, peso_saco_kg: pesoSacoKg, valor_saco: valorSaco, custo_por_kg: custoPorKg })
    .eq("id", tiposRacao[i].id).eq("user_id", usuario.id);

  if (botao) { botao.disabled = false; botao.style.opacity = ""; }
  if (error) { alert("Erro ao salvar: " + error.message); return; }

  tiposRacao[i] = { ...tiposRacao[i], nome, pesoSacoKg, valorSaco, custoPorKg };
  abrirVerTiposRacao();
}

// ─── RAÇÃO ────────────────────────────────────────────────────────────────────

function mostrarLancamentoRacao(indexSelecionado = "") {
  if (indexSelecionado === "") esconderMenu();
  const area = document.getElementById("area-gestao");
  const dentroDoViveiro = indexSelecionado !== "";
  const viveirosCicloAtivo = viveiros.filter(v => v.dataPovoamento);

  if (viveiros.length === 0) {
    area.innerHTML = `
      <div class="resultado-box">
        <p>Nenhum viveiro cadastrado</p>
        <span>Cadastre um viveiro antes de lançar ração.</span>
      </div>
    `;
    return;
  }

  if (!dentroDoViveiro && viveirosCicloAtivo.length === 0) {
    area.innerHTML = `
      <div class="form-lancamento">
        <div class="form-topo">
          <div class="form-icone-circulo">
            <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </div>
          <h2 class="form-titulo">Lançar Ração</h2>
        </div>
        <div class="viveiro-sem-ciclo-msg">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Nenhum viveiro com ciclo ativo. Inicie um ciclo antes de lançar ração.</span>
        </div>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">← Voltar</button>
      </div>
    `;
    return;
  }

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
              ${viveiros.map((v, i) => v.dataPovoamento ? `<option value="${i}">${v.nome}</option>` : "").join("")}
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

        ${tiposRacao.length > 0 ? `
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Tipo de ração</label>
          </div>
          <select id="tipoRacaoSelect">
            <option value="">— Não especificado —</option>
            ${tiposRacao.map((t, i) => `<option value="${i}">${t.nome}</option>`).join("")}
          </select>
        </div>
        ` : ""}
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

  if (!data || isNaN(racao) || racao < 0) {
    alert("Preencha a data e a quantidade (pode ser 0 para dia sem ração).");
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

  const tipoRacaoIdx = document.getElementById("tipoRacaoSelect")?.value;
  const tipoRacao = (tipoRacaoIdx !== "" && tipoRacaoIdx !== undefined && tipoRacaoIdx !== null)
    ? tiposRacao[tipoRacaoIdx] : null;
  const nomeRacao = tipoRacao ? tipoRacao.nome : null;
  const tipoRacaoId = tipoRacao ? tipoRacao.id : null;

  const novaRacao = {
    viveiro_id: viveiros[index].id,
    data: data,
    racao: racao,
    user_id: usuario.id,
    nome_racao: nomeRacao,
    tipo_racao_id: tipoRacaoId,
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
    nomeRacao: nomeRacao,
    tipoRacaoId: tipoRacaoId,
  });

  // Acumula custo de ração num único registro "Ração" por viveiro
  if (tipoRacao && racao > 0) {
    const custoNovo = tipoRacao.custoPorKg * racao;
    const qtdNova = racao * 1000;
    if (!viveiros[index].custos) viveiros[index].custos = [];
    const custoExistente = viveiros[index].custos.find(
      c => c.categoria === "Ração" && c.nomeProduto === "Ração"
    );
    if (custoExistente) {
      const novoValor = custoExistente.valor + custoNovo;
      const novaQtd = (custoExistente.quantidadeG || 0) + qtdNova;
      await supabaseClient.from("custos")
        .update({ valor: novoValor, quantidade_g: novaQtd })
        .eq("id", custoExistente.id).eq("user_id", usuario.id);
      custoExistente.valor = novoValor;
      custoExistente.quantidadeG = novaQtd;
    } else {
      const { data: salvoCusto } = await supabaseClient.from("custos")
        .insert([{
          user_id: usuario.id,
          viveiro_id: viveiros[index].id,
          tipo: "produto",
          produto_id: null,
          nome_produto: "Ração",
          quantidade_g: qtdNova,
          valor: custoNovo,
          categoria: "Ração",
          data: data,
        }]).select();
      if (salvoCusto) {
        viveiros[index].custos.push({
          id: salvoCusto[0].id,
          tipo: "produto",
          produtoId: null,
          nomeProduto: "Ração",
          quantidadeG: qtdNova,
          valor: custoNovo,
          categoria: "Ração",
          data: data,
          observacao: null,
        });
      }
    }
  }

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
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">
           ← Voltar
        </button>
  </div>
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
  <div id="voltar-menu-historico" style="margin-top:16px">
    <button class="botao-voltar-form" onclick="voltarMenuGestao()">
       ← Voltar
    </button>
  </div>
      </div>
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
      <button class="botao-historico-opcao" onclick="abrirHistoricoCustos()">
        <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        Custos
      </button>
    </div>
  `;
}

function abrirHistoricoBiometria() {
  const index = document.getElementById("viveiroHistorico").value;
  if (index === "") return;

  document.getElementById("opcoes-historico").innerHTML = "";
  const voltarFixo = document.getElementById("voltar-menu-historico");
  if (voltarFixo) voltarFixo.style.display = "none";

  renderizarHistoricoBiometria(index, "resultado-historico", false);
}

function abrirHistoricoRacao() {
  const index = document.getElementById("viveiroHistorico").value;
  if (index === "") return;

  document.getElementById("opcoes-historico").innerHTML = "";
  const voltarFixo = document.getElementById("voltar-menu-historico");
  if (voltarFixo) voltarFixo.style.display = "none";

  renderizarHistoricoRacao(index, "resultado-historico", false);
}

function abrirHistoricoDespesca() {
  const index = document.getElementById("viveiroHistorico").value;
  if (index === "") return;

  document.getElementById("opcoes-historico").innerHTML = "";
  const voltarFixo = document.getElementById("voltar-menu-historico");
  if (voltarFixo) voltarFixo.style.display = "none";

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
          <button class="botao-historico-opcao" onclick="abrirHistoricoCustosDireto(${index})">
            <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Custos
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
  const biometrias = [...(viveiro.biometrias || [])].sort((a, b) => a.data.localeCompare(b.data));

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
  const racoes = [...(viveiro.racoes || [])].sort((a, b) => a.data.localeCompare(b.data));

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
        : racoesPagina.map((item) => {
            const iOriginal = viveiro.racoes.findIndex(r => r.id === item.id);
            return `
              <div class="linha-historico-racao">
                <span>${calcularDiasCultivo(viveiro.dataPovoamento, item.data)}</span>
                <span class="col-centro">${formatarData(item.data)}</span>
                <span class="col-centro">${formatarNumeroBR(item.racao, 1)} kg${item.nomeRacao ? `<br><small style="font-size:10px;opacity:0.7">${item.nomeRacao}</small>` : ""}</span>
                <span class="col-acoes">
                  <button class="botao-editar" onclick="abrirEdicaoRacao(${index},${iOriginal},'${elementoId}',${direto})">✏️</button>
                  <button class="botao-editar botao-excluir" onclick="excluirRacao(${index},${iOriginal},'${elementoId}',${direto})">🗑️</button>
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

  const alvo = direto
    ? document.getElementById("area-gestao")
    : document.getElementById(elementoId);

  const acaoVoltar = direto
    ? `voltarParaHistoricoRacaoDireto(${viveiroIndex})`
    : `renderizarHistoricoRacao(${viveiroIndex}, '${elementoId}', ${direto})`;

  const tipoAtualIdx = racao.tipoRacaoId
    ? tiposRacao.findIndex(t => t.id === racao.tipoRacaoId) : -1;

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
        ${tiposRacao.length > 0 ? `
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Tipo de ração</label>
          </div>
          <select id="tipoRacaoEdicaoSelect">
            <option value="">— Não especificado —</option>
            ${tiposRacao.map((t, i) => `<option value="${i}" ${i === tipoAtualIdx ? "selected" : ""}>${t.nome}</option>`).join("")}
          </select>
        </div>
        ` : ""}
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
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  // DELETE + INSERT contorna restrição de RLS em UPDATE
  const { error: erroDel } = await supabaseClient
    .from("biometrias")
    .delete()
    .eq("id", bio.id)
    .eq("user_id", usuario.id);

  if (erroDel) { console.log(erroDel); alert("Erro ao salvar: " + erroDel.message); return; }

  const { data: inserido, error: erroIns } = await supabaseClient
    .from("biometrias")
    .insert([{
      viveiro_id: viveiros[viveiroIndex].id,
      data: novaData,
      gramatura: novaQtd,
      user_id: usuario.id,
    }])
    .select();

  if (erroIns || !inserido || inserido.length === 0) {
    console.log(erroIns);
    alert("Erro ao salvar edição. Tente novamente.");
    return;
  }

  viveiros[viveiroIndex].biometrias[bioIndex].id = inserido[0].id;
  viveiros[viveiroIndex].biometrias[bioIndex].data = novaData;
  viveiros[viveiroIndex].biometrias[bioIndex].gramatura = novaQtd;

  if (direto) {
    mostrarHistoricoDoViveiroDireto(viveiroIndex);
    abrirHistoricoBiometriaDireto(viveiroIndex);
  } else {
    mostrarHistoricoCultivo(viveiroIndex);
    abrirHistoricoBiometria();
  }
}

async function excluirBiometria(viveiroIndex, bioIndex, elementoId, direto) {
  if (!confirm("Excluir esta biometria?")) return;

  const bio = viveiros[viveiroIndex].biometrias[bioIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const { error } = await supabaseClient.from("biometrias").delete().eq("id", bio.id).eq("user_id", usuario.id);

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
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  // DELETE + INSERT contorna restrição de RLS em UPDATE
  const { error: erroDel } = await supabaseClient
    .from("despescas")
    .delete()
    .eq("id", desp.id)
    .eq("user_id", usuario.id);

  if (erroDel) { console.log(erroDel); alert("Erro ao salvar: " + erroDel.message); return; }

  const { data: inserido, error: erroIns } = await supabaseClient
    .from("despescas")
    .insert([{
      viveiro_id: viveiros[viveiroIndex].id,
      data: novaData,
      quantidade_kg: novaQtd,
      peso_medio: novoPeso,
      user_id: usuario.id,
    }])
    .select();

  if (erroIns || !inserido || inserido.length === 0) {
    console.log(erroIns);
    alert("Erro ao salvar edição. Tente novamente.");
    return;
  }

  viveiros[viveiroIndex].despescas[despIndex].id = inserido[0].id;
  viveiros[viveiroIndex].despescas[despIndex].data = novaData;
  viveiros[viveiroIndex].despescas[despIndex].quantidadeKg = novaQtd;
  viveiros[viveiroIndex].despescas[despIndex].pesoMedio = novoPeso;

  if (direto) {
    mostrarHistoricoDoViveiroDireto(viveiroIndex);
    abrirHistoricoDespescaDireto(viveiroIndex);
  } else {
    mostrarHistoricoCultivo(viveiroIndex);
    abrirHistoricoDespesca();
  }
}

async function excluirDespesca(viveiroIndex, despIndex, elementoId, direto) {
  if (!confirm("Excluir esta despesca?")) return;

  const desp = viveiros[viveiroIndex].despescas[despIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const { error } = await supabaseClient.from("despescas").delete().eq("id", desp.id).eq("user_id", usuario.id);

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

  if (!novaData || isNaN(novaQtd) || novaQtd < 0) {
    alert("Preencha a data e a quantidade (pode ser 0).");
    return;
  }

  const racao = viveiros[viveiroIndex].racoes[racaoIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const novoTipoIdx = document.getElementById("tipoRacaoEdicaoSelect")?.value;
  const novoTipo = (novoTipoIdx !== "" && novoTipoIdx !== undefined)
    ? tiposRacao[novoTipoIdx] : null;
  const velhoTipo = racao.tipoRacaoId
    ? tiposRacao.find(t => t.id === racao.tipoRacaoId) || null : null;

  // DELETE + INSERT contorna restrição de RLS em UPDATE
  const { error: erroDel } = await supabaseClient
    .from("racoes").delete().eq("id", racao.id).eq("user_id", usuario.id);

  if (erroDel) { alert("Erro ao salvar: " + erroDel.message); return; }

  const { data: inserido, error: erroIns } = await supabaseClient
    .from("racoes")
    .insert([{
      viveiro_id: viveiros[viveiroIndex].id,
      data: novaData,
      racao: novaQtd,
      user_id: usuario.id,
      nome_racao: novoTipo ? novoTipo.nome : null,
      tipo_racao_id: novoTipo ? novoTipo.id : null,
    }])
    .select();

  if (erroIns || !inserido || inserido.length === 0) {
    alert("Erro ao salvar edição. Tente novamente.");
    return;
  }

  // Ajustar custos: desfaz custo antigo, aplica novo
  await ajustarCustoRacaoEdicao(viveiroIndex, velhoTipo, racao.racao, novoTipo, novaQtd, novaData, usuario);

  viveiros[viveiroIndex].racoes[racaoIndex] = {
    id: inserido[0].id, data: novaData, racao: novaQtd,
    nomeRacao: novoTipo ? novoTipo.nome : null,
    tipoRacaoId: novoTipo ? novoTipo.id : null,
  };

  if (direto) {
    voltarParaHistoricoRacaoDireto(viveiroIndex);
  } else {
    mostrarHistoricoCultivo(viveiroIndex);
    abrirHistoricoRacao();
  }
}

async function ajustarCustoRacaoEdicao(viveiroIndex, velhoTipo, velhaQtd, novoTipo, novaQtd, data, usuario) {
  if (!viveiros[viveiroIndex].custos) viveiros[viveiroIndex].custos = [];
  const custos = viveiros[viveiroIndex].custos;
  const entry = custos.find(c => c.categoria === "Ração" && c.nomeProduto === "Ração");

  // Calcula diferença líquida no custo de ração
  const custoVelho = velhoTipo ? velhoTipo.custoPorKg * velhaQtd : 0;
  const custoNovo  = novoTipo  ? novoTipo.custoPorKg  * novaQtd  : 0;
  const diffValor  = custoNovo - custoVelho;
  const diffQtdG   = (novoTipo ? novaQtd * 1000 : 0) - (velhoTipo ? velhaQtd * 1000 : 0);

  if (entry) {
    const novoValor = Math.max(0, entry.valor + diffValor);
    const novaQtdG  = Math.max(0, (entry.quantidadeG || 0) + diffQtdG);
    if (novoValor < 0.01) {
      await supabaseClient.from("custos").delete().eq("id", entry.id).eq("user_id", usuario.id);
      custos.splice(custos.indexOf(entry), 1);
    } else {
      await supabaseClient.from("custos").update({ valor: novoValor, quantidade_g: novaQtdG }).eq("id", entry.id).eq("user_id", usuario.id);
      entry.valor = novoValor;
      entry.quantidadeG = novaQtdG;
    }
  } else if (custoNovo > 0) {
    const { data: salvoCusto } = await supabaseClient.from("custos").insert([{
      user_id: usuario.id, viveiro_id: viveiros[viveiroIndex].id,
      tipo: "produto", produto_id: null, nome_produto: "Ração",
      quantidade_g: novaQtd * 1000, valor: custoNovo, categoria: "Ração", data: data,
    }]).select();
    if (salvoCusto) {
      custos.push({ id: salvoCusto[0].id, tipo: "produto", produtoId: null, nomeProduto: "Ração", quantidadeG: novaQtd * 1000, valor: custoNovo, categoria: "Ração", data, observacao: null });
    }
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
  await Promise.all([
    supabaseClient.from("racoes").delete().eq("viveiro_id", viveiros[index].id).eq("user_id", usuario.id),
    supabaseClient.from("biometrias").delete().eq("viveiro_id", viveiros[index].id).eq("user_id", usuario.id),
    supabaseClient.from("despescas").delete().eq("viveiro_id", viveiros[index].id).eq("user_id", usuario.id),
  ]);

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

  mostrarListaViveiros(0, "", `Viveiro "${viveiro.nome}" excluído com sucesso.`);
}

function renderizarHistoricoDespesca(index, elementoId, direto) {
  const viveiro = viveiros[index];
  const resultado = document.getElementById(elementoId);
  const despescas = [...(viveiro.despescas || [])].sort((a, b) => a.data.localeCompare(b.data));

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
  const voltarFixo = document.getElementById("voltar-menu-historico");
  if (voltarFixo) voltarFixo.style.display = "";
}

function mostrarHistoricoCiclos() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  const tituloHtml = `<h2 class="titulo-secao">Histórico de Ciclos</h2>`;

  let ciclos = [];

  viveiros.forEach((viveiro, viveiroIndex) => {
    if (viveiro.ciclosFinalizados) {
      viveiro.ciclosFinalizados.forEach((ciclo, cicloIndex) => {
        ciclos.push({
          viveiro: viveiro.nome,
          viveiroIndex,
          cicloIndex,
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
      <div class="ciclo-card-acoes">
        <button class="ciclo-btn-relatorio" onclick="mostrarRelatorioCiclo(${item.viveiroIndex}, viveiros[${item.viveiroIndex}].ciclosFinalizados[${item.cicloIndex}], 'historico')">
          📋 Ver relatório
        </button>
        <button class="ciclo-btn-excluir" onclick="confirmarExcluirCiclo(${item.viveiroIndex}, ${item.cicloIndex}, this)">
          🗑️ Excluir
        </button>
      </div>
      <div id="confirm-excluir-${item.viveiroIndex}-${item.cicloIndex}" style="display:none;margin-top:10px;padding:10px 12px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#dc2626">Excluir este ciclo?</p>
        <p style="margin:0 0 10px;font-size:12px;color:#7f1d1d">Esta ação não pode ser desfeita.</p>
        <div style="display:flex;gap:8px">
          <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirCiclo(${item.viveiroIndex}, ${item.cicloIndex})">Sim, excluir</button>
          <button class="ciclo-btn-relatorio" style="flex:1" onclick="cancelarExcluirCiclo(${item.viveiroIndex}, ${item.cicloIndex})">Cancelar</button>
        </div>
      </div>
    </div>
  `).join("") + `<button class="botao-voltar-form" style="margin-top:8px" onclick="voltarMenuGestao()">← Voltar</button>`;
}

function confirmarExcluirCiclo(viveiroIndex, cicloIndex, btn) {
  document.getElementById(`confirm-excluir-${viveiroIndex}-${cicloIndex}`).style.display = "block";
  btn.style.display = "none";
}

function cancelarExcluirCiclo(viveiroIndex, cicloIndex) {
  const confirm = document.getElementById(`confirm-excluir-${viveiroIndex}-${cicloIndex}`);
  confirm.style.display = "none";
  confirm.previousElementSibling.querySelector(".ciclo-btn-excluir").style.display = "";
}

async function excluirCiclo(viveiroIndex, cicloIndex) {
  const viveiro = viveiros[viveiroIndex];
  const ciclo = viveiro.ciclosFinalizados[cicloIndex];

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  if (!ciclo.id) {
    viveiro.ciclosFinalizados.splice(cicloIndex, 1);
    mostrarHistoricoCiclos();
    return;
  }

  const { data: deletado, error } = await supabaseClient
    .from("ciclos")
    .delete()
    .eq("id", ciclo.id)
    .eq("user_id", usuario.id)
    .select();

  if (error) {
    const div = document.getElementById(`confirm-excluir-${viveiroIndex}-${cicloIndex}`);
    if (div) div.innerHTML = `<p style="color:#dc2626;font-size:13px;margin:0">Erro: ${error.message}</p>`;
    return;
  }

  if (!deletado || deletado.length === 0) {
    const div = document.getElementById(`confirm-excluir-${viveiroIndex}-${cicloIndex}`);
    if (div) div.innerHTML = `<p style="color:#dc2626;font-size:13px;margin:0">Não foi possível excluir. Verifique as permissões no Supabase (RLS da tabela ciclos).</p>`;
    return;
  }

  viveiro.ciclosFinalizados.splice(cicloIndex, 1);
  mostrarHistoricoCiclos();
}

function abrirFinanceiro() {
  esconderMenu();
  const area = document.getElementById("area-gestao");

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <h2 class="form-titulo">Financeiro</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
            <label>Viveiro</label>
          </div>
          <select id="viveiroFinanceiro" onchange="mostrarCustosFinanceiro()">
            <option value="">Todos os viveiros</option>
            ${viveiros.map((v, i) => `<option value="${i}">${v.nome}</option>`).join("")}
          </select>
        </div>
        <div id="resultado-financeiro"></div>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">← Voltar</button>
      </div>
    </div>
  `;

  mostrarCustosFinanceiro();
}

function mostrarCustosFinanceiro() {
  const viveiroIndex = document.getElementById("viveiroFinanceiro").value;
  const resultado = document.getElementById("resultado-financeiro");
  const porViveiro = viveiroIndex !== "";

  let custos;
  if (porViveiro) {
    const v = viveiros[viveiroIndex];
    custos = (v.custos || []).map(c => ({ ...c, viveiroNome: v.nome }));
  } else {
    custos = viveiros.flatMap(v =>
      (v.custos || []).map(c => ({ ...c, viveiroNome: v.nome }))
    );
  }

  custos.sort((a, b) => a.data.localeCompare(b.data));
  const total = custos.reduce((s, c) => s + Number(c.valor), 0);

  if (custos.length === 0) {
    resultado.innerHTML = `<p class="sobrevivencia-texto" style="margin:16px 0">Nenhum custo lançado${porViveiro ? " para este viveiro" : ""}.<br><small>Lance custos dentro de cada viveiro.</small></p>`;
    return;
  }

  resultado.innerHTML = `
    <div class="tabela-historico" style="margin-bottom:10px">
      <div class="${porViveiro ? "linha-hist-custo-3col" : "linha-hist-custo-geral"} cabecalho">
        <span>DATA</span>
        ${!porViveiro ? `<span class="col-centro">VIVEIRO</span>` : ""}
        <span class="col-centro">DESCRIÇÃO</span>
        <span class="col-centro">VALOR</span>
      </div>
      ${custos.map(c => `
        <div class="${porViveiro ? "linha-hist-custo-3col" : "linha-hist-custo-geral"}">
          <span style="font-size:12px">${formatarData(c.data)}</span>
          ${!porViveiro ? `<span class="col-centro" style="font-size:12px">${abreviarViveiro(c.viveiroNome)}</span>` : ""}
          <span class="col-centro" style="font-size:12px">
            <span class="custo-badge custo-badge-${c.tipo}">${c.tipo === "produto" ? "P" : "O"}</span>
            ${c.nomeProduto}${c.quantidadeG ? ` · ${c.quantidadeG >= 1000 ? formatarNumeroBR(c.quantidadeG / 1000, 2) + " kg" : formatarNumeroBR(c.quantidadeG, 0) + " g"}` : ""}
          </span>
          <span class="col-centro" style="font-size:12px">R$&nbsp;${formatarNumeroBR(c.valor, 2)}</span>
        </div>
      `).join("")}
    </div>
    <div class="total-chip">
      <span class="total-chip-label">Total</span>
      <span class="total-chip-valor">R$ ${formatarNumeroBR(total, 2)}</span>
    </div>
  `;
}

function abrirEstoque() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M5 8h14M5 8a2 2 0 1 0 0-4h14a2 2 0 1 0 0 4M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-9 4h4"/></svg>
        </div>
        <h2 class="form-titulo">Estoque</h2>
      </div>
      <div class="form-corpo">
        <div style="text-align:center;padding:24px 16px;background:#f8fafc;border-radius:14px;border:1px solid #e5e7eb;margin-bottom:12px">
          <p style="font-size:32px;margin:0 0 8px">🚧</p>
          <p style="font-size:14px;font-weight:700;color:#374151;margin:0 0 4px">Em desenvolvimento</p>
          <p style="font-size:13px;color:#9ca3af;margin:0">Em breve você poderá controlar o estoque dos seus insumos.</p>
        </div>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">← Voltar</button>
      </div>
    </div>
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

  // Apagar todos os lançamentos do ciclo encerrado no banco
  const [erroDelRacao, erroDelBio, erroDelDesp] = await Promise.all([
    supabaseClient.from("racoes").delete().eq("viveiro_id", viveiro.id).eq("user_id", usuario.id).then(r => r.error),
    supabaseClient.from("biometrias").delete().eq("viveiro_id", viveiro.id).eq("user_id", usuario.id).then(r => r.error),
    supabaseClient.from("despescas").delete().eq("viveiro_id", viveiro.id).eq("user_id", usuario.id).then(r => r.error),
  ]);

  if (erroDelRacao || erroDelBio || erroDelDesp) {
    console.error("Erro ao limpar lançamentos:", erroDelRacao || erroDelBio || erroDelDesp);
    // Continua mesmo assim — o ciclo foi salvo, tentamos limpar o máximo possível
  }

  // Montar cicloFinalizado ANTES de zerar o viveiro (para preservar dados no objeto local)
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

  // Limpar estado local
  viveiro.racoes = [];
  viveiro.biometrias = [];
  viveiro.despescas = [];

  // Zerar campos do ciclo no viveiro (mantém só nome e tamanho)
  await supabaseClient
    .from("viveiros")
    .update({ data_povoamento: null, total_povoado: null, laboratorio: null })
    .eq("id", viveiro.id)
    .eq("user_id", usuario.id);

  viveiro.dataPovoamento = null;
  viveiro.totalPovoado = null;
  viveiro.laboratorio = null;

  if (!viveiro.ciclosFinalizados) {
    viveiro.ciclosFinalizados = [];
  }

  viveiro.ciclosFinalizados.push(cicloFinalizado);

  mostrarRelatorioCiclo(index, cicloFinalizado, "viveiro");
}

function mostrarViveiroSemCiclo(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const temCicloAnterior = viveiro.ciclosFinalizados && viveiro.ciclosFinalizados.length > 0;

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo" style="background:rgba(6,107,99,0.07);border-color:rgba(6,107,99,0.15)">
          <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <span class="form-caption">${viveiro.tamanho ? viveiro.tamanho + " ha" : ""}</span>
        <h2 class="form-titulo">${viveiro.nome}</h2>
      </div>
      <div class="viveiro-sem-ciclo-msg">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Nenhum ciclo ativo. Inicie um novo ciclo para começar os lançamentos.</span>
      </div>

      <button class="botao-salvar" onclick="mostrarFormularioReinicio(${index})" style="margin-top:4px">
        <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Iniciar novo ciclo
      </button>

      <button class="botao-voltar-form botao-perigo-outline" onclick="mostrarConfirmExcluirViveiro(${index})" style="margin-top:8px">
        🗑️ Excluir viveiro
      </button>

      <div id="confirm-excluir-viveiro-${index}" style="display:none;margin-top:10px;padding:10px 12px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca">
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#dc2626">Excluir "${viveiro.nome}"?</p>
        <p style="margin:0 0 10px;font-size:12px;color:#7f1d1d">Todos os ciclos e dados deste viveiro serão removidos.</p>
        <div style="display:flex;gap:8px">
          <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirViveiro(${index})">Sim, excluir</button>
          <button class="ciclo-btn-relatorio" style="flex:1" onclick="mostrarViveiroSemCiclo(${index})">Cancelar</button>
        </div>
      </div>

      ${temCicloAnterior ? `
      <button class="botao-voltar-form" onclick="mostrarRelatorioCiclo(${index}, viveiros[${index}].ciclosFinalizados[viveiros[${index}].ciclosFinalizados.length - 1], 'viveiro')" style="margin-top:8px">
        📋 Ver relatório do último ciclo
      </button>
      ` : ""}

      <button class="botao-voltar-form" onclick="mostrarListaViveiros(posicaoNaLista(${index}))" style="margin-top:8px">← Voltar</button>
    </div>
  `;
}

function mostrarConfirmExcluirViveiro(index) {
  document.getElementById(`confirm-excluir-viveiro-${index}`).style.display = "block";
}

function mostrarRelatorioCiclo(index, ciclo, origem = "historico") {
  const area = document.getElementById("area-gestao");

  area.innerHTML = `
    <div class="relatorio-final">

      <!-- ── HEADER ── -->
      <div class="rel-header">
        <span class="rel-titulo-principal">Relatório de Ciclo</span>
        <span class="rel-marca-nome">WA AQUA GESTÃO</span>
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
              <span>Data do povoamento</span>
            </div>
            <strong>${formatarData(ciclo.dataPovoamento)}</strong>
          </div>
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>Total de PLs</span>
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
              <svg viewBox="0 0 24 24"><path d="M3 6l9-4 9 4v6c0 5-4 9-9 10C7 21 3 17 3 12V6z"/></svg>
              <span>Área do viveiro</span>
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
            <span class="rel-metrica-unidade">kg / ha</span>
            <span class="rel-metrica-nome">Produtividade</span>
          </div>
          <div class="rel-metrica-card">
            <span class="rel-metrica-valor">${formatarNumeroBR(ciclo.pesoFinal, 1)}</span>
            <span class="rel-metrica-unidade">gramas</span>
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
              <span>FCA</span>
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

      <!-- ── CUSTOS DO CICLO ── -->
      ${(() => {
        const custosCiclo = (viveiros[index]?.custos || []).filter(c =>
          ciclo.dataPovoamento && ciclo.dataEncerramento &&
          c.data >= ciclo.dataPovoamento && c.data <= ciclo.dataEncerramento
        );
        const totalProdutos = custosCiclo.filter(c => c.tipo === "produto").reduce((s, c) => s + Number(c.valor), 0);
        const totalOutros = custosCiclo.filter(c => c.tipo === "outro").reduce((s, c) => s + Number(c.valor), 0);
        const totalCustos = totalProdutos + totalOutros;
        if (totalCustos === 0) return "";
        return `
      <div class="relatorio-secao">
        <h3>Custos do ciclo</h3>
        <div class="rel-info-lista">
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
              <span>Insumos</span>
            </div>
            <strong>R$ ${formatarNumeroBR(totalProdutos, 2)}</strong>
          </div>
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Outros custos</span>
            </div>
            <strong>R$ ${formatarNumeroBR(totalOutros, 2)}</strong>
          </div>
          <div class="rel-info-row">
            <div class="rel-info-esq">
              <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              <span><strong>Total de custos</strong></span>
            </div>
            <strong>R$ ${formatarNumeroBR(totalCustos, 2)}</strong>
          </div>
        </div>
      </div>`;
      })()}

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
        <button class="botao-voltar-form" onclick="${origem === 'viveiro' ? `mostrarViveiroSemCiclo(${index})` : `mostrarHistoricoCiclos()`}">← Voltar</button>
      </div>

    </div>
  `;
}

// ─── CUSTOS E INSUMOS ─────────────────────────────────────────────────────────

function abrirCustosInsumos() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <h2 class="form-titulo">Insumos</h2>
      </div>
      <div class="form-corpo">
        <div class="historico-opcoes-grid">
          <button class="botao-historico-opcao" onclick="abrirCadastrarProduto()">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Cadastrar produto
          </button>
          <button class="botao-historico-opcao" onclick="abrirVerProdutos()">
            <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            Ver produtos
          </button>
        </div>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">← Voltar</button>
      </div>
    </div>
  `;
}

function abrirCadastrarProduto() {
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <h2 class="form-titulo">Cadastrar Produto</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <label>Nome do produto</label>
          </div>
          <input type="text" id="nomeProduto" placeholder="Ex: Ração">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <label>Categoria</label>
          </div>
          <select id="categoriaProduto">
            <option value="Ração">Ração</option>
            <option value="Probiótico">Probiótico</option>
            <option value="Calcário">Calcário</option>
            <option value="Outros">Outros</option>
          </select>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Peso do saco / embalagem</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="pesoKgProduto" placeholder="Ex: 25">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Valor pago por saco</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="valorPagoProduto" placeholder="Ex: 85,00" onblur="formatarMoedaBlur(this); calcularPreviaKg()">
            <span class="campo-unidade">R$</span>
          </div>
        </div>
        <div id="previa-custo-kg" class="custo-por-grama-preview" style="display:none">
          Custo por kg: <strong id="previa-custo-kg-valor">—</strong>
        </div>
        <div id="msg-produto-sucesso" class="msg-sucesso-lancamento" style="display:none;">
          <span class="msg-emoji">✅</span>
          <span class="msg-texto">Produto cadastrado!</span>
        </div>
        <div id="erro-produto" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;font-size:13px;color:#dc2626;margin-bottom:12px"></div>
        <button class="botao-salvar" onclick="salvarProduto()">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar produto
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirCustosInsumos()">← Voltar</button>
      </div>
    </div>
  `;
}

function calcularPreviaKg() {
  const peso = parseFloat(document.getElementById("pesoKgProduto").value);
  const valor = parseMoedaBR(document.getElementById("valorPagoProduto").value);
  const div = document.getElementById("previa-custo-kg");
  const el = document.getElementById("previa-custo-kg-valor");
  if (peso > 0 && valor > 0) {
    el.textContent = `R$ ${formatarNumeroBR(valor / peso, 2)} / kg`;
    div.style.display = "block";
  } else {
    div.style.display = "none";
  }
}

async function salvarProduto() {
  const nome = document.getElementById("nomeProduto").value.trim();
  const categoria = document.getElementById("categoriaProduto").value;
  const pesoKg = parseFloat(document.getElementById("pesoKgProduto").value);
  const valorPago = parseMoedaBR(document.getElementById("valorPagoProduto").value);

  if (!nome || !pesoKg || !valorPago) { alert("Preencha todos os campos."); return; }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const custoPorGrama = valorPago / (pesoKg * 1000);
  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

  const { data: salvo, error } = await supabaseClient
    .from("produtos")
    .insert([{ user_id: usuario.id, nome, categoria, peso_kg: pesoKg, valor_pago: valorPago, custo_por_grama: custoPorGrama }])
    .select();

  if (error) {
    if (botao) { botao.disabled = false; botao.style.opacity = ""; }
    const erroEl = document.getElementById("erro-produto");
    if (erroEl) {
      erroEl.textContent = error.code === "42P01"
        ? "Tabela 'produtos' não existe ainda. Crie-a no Supabase conforme instruções."
        : "Erro ao salvar: " + error.message;
      erroEl.style.display = "block";
    }
    return;
  }

  document.getElementById("erro-produto").style.display = "none";
  produtos.push({ id: salvo[0].id, nome, categoria, pesoKg, valorPago, custoPorGrama });

  document.getElementById("nomeProduto").value = "";
  document.getElementById("pesoKgProduto").value = "";
  document.getElementById("valorPagoProduto").value = "";
  document.getElementById("previa-custo-kg").style.display = "none";
  if (botao) { botao.disabled = false; botao.style.opacity = ""; }

  const msg = document.getElementById("msg-produto-sucesso");
  if (msg) { msg.style.display = "flex"; setTimeout(() => { msg.style.display = "none"; }, 2500); }
}

function abrirVerProdutos() {
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
        </div>
        <h2 class="form-titulo">Produtos cadastrados</h2>
      </div>
      <div class="form-corpo">
        ${produtos.length === 0
          ? `<p class="sobrevivencia-texto">Nenhum produto cadastrado.</p>`
          : `<div class="lista-produtos">
              ${produtos.map((p, i) => `
                <div class="produto-item" id="produto-item-${i}">
                  <div class="produto-info">
                    <span class="produto-nome">${p.nome}</span>
                    <span class="produto-detalhe">${p.categoria} · ${formatarNumeroBR(p.pesoKg, 0)} kg · R$ ${formatarNumeroBR(p.valorPago, 2)} · R$ ${formatarNumeroBR(p.valorPago / p.pesoKg, 2)}/kg</span>
                  </div>
                  <span class="col-acoes">
                    <button class="botao-editar" onclick="abrirEdicaoProduto(${i})">✏️</button>
                    <button class="botao-editar botao-excluir" onclick="confirmarExcluirProduto(${i})">🗑️</button>
                  </span>
                </div>
              `).join("")}
            </div>`
        }
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirCustosInsumos()">← Voltar</button>
      </div>
    </div>
  `;
}

function confirmarExcluirProduto(i) {
  const item = document.getElementById(`produto-item-${i}`);
  if (!item) return;
  item.innerHTML = `
    <div class="confirmar-exclusao-custo">
      <span>Excluir <strong>${produtos[i].nome}</strong>?</span>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirProduto(${i})">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="abrirVerProdutos()">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirProduto(i) {
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;
  const { error } = await supabaseClient.from("produtos").delete().eq("id", produtos[i].id).eq("user_id", usuario.id);
  if (error) { alert("Erro ao excluir: " + error.message); return; }
  produtos.splice(i, 1);
  abrirVerProdutos();
}

function abrirEdicaoProduto(i) {
  const p = produtos[i];
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <h2 class="form-titulo">Editar Produto</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <label>Nome do produto</label>
          </div>
          <input type="text" id="editNomeProduto" value="${p.nome}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <label>Categoria</label>
          </div>
          <select id="editCategoriaProduto">
            <option value="Ração" ${p.categoria === "Ração" ? "selected" : ""}>Ração</option>
            <option value="Probiótico" ${p.categoria === "Probiótico" ? "selected" : ""}>Probiótico</option>
            <option value="Calcário" ${p.categoria === "Calcário" ? "selected" : ""}>Calcário</option>
            <option value="Outros" ${p.categoria === "Outros" ? "selected" : ""}>Outros</option>
          </select>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Peso do saco / embalagem</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="editPesoKgProduto" value="${p.pesoKg}">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Valor pago por saco</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="editValorPagoProduto" value="${p.valorPago ? p.valorPago.toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2}) : ''}" onblur="formatarMoedaBlur(this)">
            <span class="campo-unidade">R$</span>
          </div>
        </div>
        <button class="botao-salvar" onclick="salvarEdicaoProduto(${i})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirVerProdutos()">← Voltar</button>
      </div>
    </div>
  `;
}

async function salvarEdicaoProduto(i) {
  const nome = document.getElementById("editNomeProduto").value.trim();
  const categoria = document.getElementById("editCategoriaProduto").value;
  const pesoKg = parseFloat(document.getElementById("editPesoKgProduto").value);
  const valorPago = parseMoedaBR(document.getElementById("editValorPagoProduto").value);

  if (!nome || !pesoKg || !valorPago) { alert("Preencha todos os campos."); return; }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const custoPorGrama = valorPago / (pesoKg * 1000);
  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

  const { error } = await supabaseClient
    .from("produtos")
    .update({ nome, categoria, peso_kg: pesoKg, valor_pago: valorPago, custo_por_grama: custoPorGrama })
    .eq("id", produtos[i].id)
    .eq("user_id", usuario.id);

  if (botao) { botao.disabled = false; botao.style.opacity = ""; }

  if (error) { alert("Erro ao salvar: " + error.message); return; }

  produtos[i] = { ...produtos[i], nome, categoria, pesoKg, valorPago, custoPorGrama };
  abrirVerProdutos();
}

function abrirLancarCusto(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">Lançar Custo</h2>
      </div>
      <div class="form-corpo">
        <div class="historico-opcoes-grid">
          <button class="botao-historico-opcao" onclick="abrirLancarCustoProduto(${index})">
            <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Produto cadastrado
          </button>
          <button class="botao-historico-opcao" onclick="abrirLancarOutroCusto(${index})">
            <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Outro custo
          </button>
        </div>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirViveiro(${index})">← Voltar</button>
      </div>
    </div>
  `;
}

function abrirLancarCustoProduto(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const hoje = new Date().toISOString().split("T")[0];

  if (produtos.length === 0) {
    area.innerHTML = `
      <div class="form-lancamento">
        <div class="form-topo">
          <div class="form-icone-circulo">
            <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          <h2 class="form-titulo">Lançar Produto</h2>
        </div>
        <div class="form-corpo">
          <div class="viveiro-sem-ciclo-msg">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Nenhum produto cadastrado. Vá em Custos e Insumos → Cadastrar produto primeiro.</span>
          </div>
          <button class="botao-voltar-form" onclick="abrirLancarCusto(${index})">← Voltar</button>
        </div>
      </div>
    `;
    return;
  }

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">Lançar Produto</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data</label>
          </div>
          <input type="date" id="dataCustoProduto" value="${hoje}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            <label>Produto</label>
          </div>
          <select id="selectProduto" onchange="atualizarPreviaCusto()">
            <option value="">Escolha um produto</option>
            ${produtos.map((p, i) => `<option value="${i}">${p.nome} (${p.categoria})</option>`).join("")}
          </select>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Quantidade utilizada</label>
          </div>
          <div class="campo-input-unidade">
            <input type="number" id="qtdCustoProduto" placeholder="Ex: 300" step="1" oninput="atualizarPreviaCusto()">
            <span class="campo-unidade">g</span>
          </div>
        </div>
        <div id="previa-custo-produto" class="custo-por-grama-preview" style="display:none">
          Valor calculado: <strong id="previa-custo-valor">—</strong>
        </div>
        <div id="msg-custo-produto-sucesso" class="msg-sucesso-lancamento" style="display:none;">
          <span class="msg-emoji">✅</span>
          <span class="msg-texto">Custo lançado!</span>
        </div>
        <button class="botao-salvar" onclick="salvarCustoProduto(${index})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar lançamento
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirLancarCusto(${index})">← Voltar</button>
      </div>
    </div>
  `;
}

function atualizarPreviaCusto() {
  const prodIndex = document.getElementById("selectProduto")?.value;
  const qtdG = parseFloat(document.getElementById("qtdCustoProduto")?.value);
  const div = document.getElementById("previa-custo-produto");
  const el = document.getElementById("previa-custo-valor");
  if (prodIndex !== "" && prodIndex !== undefined && !isNaN(qtdG) && qtdG > 0) {
    const prod = produtos[prodIndex];
    if (prod) {
      el.textContent = `R$ ${formatarNumeroBR(prod.custoPorGrama * qtdG, 2)}`;
      div.style.display = "block";
      return;
    }
  }
  if (div) div.style.display = "none";
}

async function salvarCustoProduto(index) {
  const data = document.getElementById("dataCustoProduto").value;
  const prodIndex = document.getElementById("selectProduto").value;
  const qtdG = parseFloat(document.getElementById("qtdCustoProduto").value);

  if (!data || prodIndex === "" || isNaN(qtdG) || qtdG <= 0) { alert("Preencha todos os campos."); return; }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const prod = produtos[prodIndex];
  const quantidadeG = qtdG;
  const valor = prod.custoPorGrama * quantidadeG;

  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

  const { data: salvo, error } = await supabaseClient
    .from("custos")
    .insert([{ user_id: usuario.id, viveiro_id: viveiros[index].id, tipo: "produto", produto_id: prod.id, nome_produto: prod.nome, quantidade_g: quantidadeG, valor, categoria: prod.categoria, data }])
    .select();

  if (error) {
    if (botao) { botao.disabled = false; botao.style.opacity = ""; }
    alert("Erro ao salvar: " + error.message);
    return;
  }

  if (!viveiros[index].custos) viveiros[index].custos = [];
  viveiros[index].custos.push({ id: salvo[0].id, tipo: "produto", produtoId: prod.id, nomeProduto: prod.nome, quantidadeG, valor, categoria: prod.categoria, data, observacao: null });

  document.getElementById("dataCustoProduto").value = new Date().toISOString().split("T")[0];
  document.getElementById("selectProduto").value = "";
  document.getElementById("qtdCustoProduto").value = "";
  document.getElementById("previa-custo-produto").style.display = "none";
  if (botao) { botao.disabled = false; botao.style.opacity = ""; }

  const msg = document.getElementById("msg-custo-produto-sucesso");
  if (msg) { msg.style.display = "flex"; setTimeout(() => { msg.style.display = "none"; }, 2500); }
}

function abrirLancarOutroCusto(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const hoje = new Date().toISOString().split("T")[0];

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">Outro Custo</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data</label>
          </div>
          <input type="date" id="dataOutroCusto" value="${hoje}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <label>Nome do custo</label>
          </div>
          <input type="text" id="nomeOutroCusto" placeholder="Ex: Análise de água, Energia, Técnico...">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Valor</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="valorOutroCusto" placeholder="Ex: 350,00" onblur="formatarMoedaBlur(this)">
            <span class="campo-unidade">R$</span>
          </div>
        </div>
        <div id="msg-outro-custo-sucesso" class="msg-sucesso-lancamento" style="display:none;">
          <span class="msg-emoji">✅</span>
          <span class="msg-texto">Custo lançado!</span>
        </div>
        <button class="botao-salvar" onclick="salvarOutroCusto(${index})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar lançamento
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirLancarCusto(${index})">← Voltar</button>
      </div>
    </div>
  `;
}

async function salvarOutroCusto(index) {
  const data = document.getElementById("dataOutroCusto").value;
  const descricao = document.getElementById("nomeOutroCusto").value.trim();
  if (!descricao) { alert("Digite o nome do custo."); return; }
  const categoria = descricao;
  const valor = parseMoedaBR(document.getElementById("valorOutroCusto").value);

  if (!data || isNaN(valor) || valor <= 0) { alert("Preencha todos os campos."); return; }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

  const { data: salvo, error } = await supabaseClient
    .from("custos")
    .insert([{ user_id: usuario.id, viveiro_id: viveiros[index].id, tipo: "outro", nome_produto: descricao, valor, categoria, data }])
    .select();

  if (error) {
    if (botao) { botao.disabled = false; botao.style.opacity = ""; }
    alert("Erro ao salvar: " + error.message);
    return;
  }

  if (!viveiros[index].custos) viveiros[index].custos = [];
  viveiros[index].custos.push({ id: salvo[0].id, tipo: "outro", produtoId: null, nomeProduto: descricao, quantidadeG: null, valor, categoria, data, observacao: null });

  document.getElementById("dataOutroCusto").value = new Date().toISOString().split("T")[0];
  document.getElementById("nomeOutroCusto").value = "";
  document.getElementById("valorOutroCusto").value = "";
  if (botao) { botao.disabled = false; botao.style.opacity = ""; }

  const msg = document.getElementById("msg-outro-custo-sucesso");
  if (msg) { msg.style.display = "flex"; setTimeout(() => { msg.style.display = "none"; }, 2500); }
}

function abrirHistoricoCustosDireto(index) {
  document.getElementById("opcoes-historico").innerHTML = "";
  renderizarHistoricoCustos(index, "resultado-historico", true);
}

function abrirHistoricoCustos() {
  const index = document.getElementById("viveiroHistorico").value;
  if (index === "") return;
  document.getElementById("opcoes-historico").innerHTML = "";
  const voltarFixo = document.getElementById("voltar-menu-historico");
  if (voltarFixo) voltarFixo.style.display = "none";
  renderizarHistoricoCustos(index, "resultado-historico", false);
}

function renderizarHistoricoCustos(index, elementoId, direto) {
  const viveiro = viveiros[index];
  const resultado = document.getElementById(elementoId);
  const custos = [...(viveiro.custos || [])].sort((a, b) => a.data.localeCompare(b.data));
  const totalCustos = custos.reduce((s, c) => s + Number(c.valor), 0);

  resultado.innerHTML = `
    <h3 class="titulo-secao">Custos - ${abreviarViveiro(viveiro.nome)}</h3>
    <div class="tabela-historico">
      <div class="linha-historico-acoes cabecalho">
        <span>DATA</span>
        <span class="col-centro">DESCRIÇÃO</span>
        <span class="col-centro">VALOR</span>
        <span></span>
      </div>
      ${custos.length === 0
        ? `<p class="sobrevivencia-texto">Nenhum custo lançado.</p>`
        : custos.map((c, i) => `
            <div class="linha-historico-acoes">
              <span>${formatarData(c.data)}</span>
              <span class="col-centro" style="font-size:12px">
                <span class="custo-badge custo-badge-${c.tipo}">${c.tipo === "produto" ? "P" : "O"}</span>
                ${c.nomeProduto}${c.quantidadeG ? ` · ${c.quantidadeG >= 1000 ? formatarNumeroBR(c.quantidadeG / 1000, 2) + " kg" : formatarNumeroBR(c.quantidadeG, 0) + " g"}` : ""}
              </span>
              <span class="col-centro">R$&nbsp;${formatarNumeroBR(c.valor, 2)}</span>
              <span class="col-acoes">
                <button class="botao-editar botao-excluir" onclick="excluirCusto(${index}, ${i}, '${elementoId}', ${direto})">🗑️</button>
              </span>
            </div>
          `).join("")
      }
    </div>
    <div class="total-chip">
      <span class="total-chip-label">Total de custos</span>
      <span class="total-chip-valor">R$ ${formatarNumeroBR(totalCustos, 2)}</span>
    </div>
    <button class="botao-voltar-form" style="margin-top:10px" onclick="${direto ? `mostrarHistoricoDoViveiroDireto(${index})` : `voltarOpcoesHistorico()`}">← Voltar</button>
  `;
}

async function excluirCusto(viveiroIndex, custoIndex, elementoId, direto) {
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;
  const custo = viveiros[viveiroIndex].custos[custoIndex];
  const { error } = await supabaseClient.from("custos").delete().eq("id", custo.id).eq("user_id", usuario.id);
  if (error) { alert("Erro ao excluir: " + error.message); return; }
  viveiros[viveiroIndex].custos.splice(custoIndex, 1);
  renderizarHistoricoCustos(viveiroIndex, elementoId, direto);
}

function abrirHistoricoGeralCustos() {
  const area = document.getElementById("area-gestao");

  const todosCustos = viveiros.flatMap(v =>
    (v.custos || []).map(c => ({ ...c, viveiroNome: v.nome }))
  ).sort((a, b) => a.data.localeCompare(b.data));

  const totalGeral = todosCustos.reduce((s, c) => s + Number(c.valor), 0);

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
        </div>
        <h2 class="form-titulo">Histórico geral de custos</h2>
      </div>
      <div class="form-corpo">
        <div class="tabela-historico">
          <div class="linha-hist-custo-geral cabecalho">
            <span>DATA</span>
            <span class="col-centro">VIVEIRO</span>
            <span class="col-centro">DESCRIÇÃO</span>
            <span class="col-centro">VALOR</span>
          </div>
          ${todosCustos.length === 0
            ? `<p class="sobrevivencia-texto">Nenhum custo lançado.</p>`
            : todosCustos.map(c => `
                <div class="linha-hist-custo-geral">
                  <span style="font-size:12px">${formatarData(c.data)}</span>
                  <span class="col-centro" style="font-size:12px">${abreviarViveiro(c.viveiroNome)}</span>
                  <span class="col-centro" style="font-size:12px">
                    <span class="custo-badge custo-badge-${c.tipo}">${c.tipo === "produto" ? "P" : "O"}</span>
                    ${c.nomeProduto}
                  </span>
                  <span class="col-centro" style="font-size:12px">R$&nbsp;${formatarNumeroBR(c.valor, 2)}</span>
                </div>
              `).join("")
          }
        </div>
        ${totalGeral > 0 ? `
          <div class="total-chip">
            <span class="total-chip-label">Total geral</span>
            <span class="total-chip-valor">R$ ${formatarNumeroBR(totalGeral, 2)}</span>
          </div>
        ` : ""}
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirCustosInsumos()">← Voltar</button>
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

  // Carregar produtos (gracioso se a tabela não existir ainda)
  const { data: produtosData, error: erroProdutos } = await supabaseClient
    .from("produtos").select("*").eq("user_id", usuario.id);
  if (!erroProdutos && produtosData) {
    produtos = produtosData.map(p => ({
      id: p.id, nome: p.nome, categoria: p.categoria,
      pesoKg: Number(p.peso_kg), valorPago: Number(p.valor_pago),
      custoPorGrama: Number(p.custo_por_grama),
    }));
  }

  // Carregar tipos de ração (gracioso se a tabela não existir ainda)
  const { data: tiposRacaoData } = await supabaseClient
    .from("tipos_racao").select("*").eq("user_id", usuario.id);
  if (tiposRacaoData) {
    tiposRacao = tiposRacaoData.map(t => ({
      id: t.id, nome: t.nome,
      pesoSacoKg: Number(t.peso_saco_kg),
      valorSaco: Number(t.valor_saco),
      custoPorKg: Number(t.custo_por_kg),
    }));
  }

  // Carregar custos (gracioso se a tabela não existir ainda)
  const { data: custosData } = await supabaseClient
    .from("custos").select("*").eq("user_id", usuario.id);
  const custosArr = custosData || [];

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
        nomeRacao: racao.nome_racao || null,
        tipoRacaoId: racao.tipo_racao_id || null,
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
        id: ciclo.id,
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

    custos: custosArr
      .filter(c => c.viveiro_id === item.id)
      .map(c => ({
        id: c.id,
        tipo: c.tipo,
        produtoId: c.produto_id,
        nomeProduto: c.nome_produto,
        quantidadeG: c.quantidade_g ? Number(c.quantidade_g) : null,
        valor: Number(c.valor),
        categoria: c.categoria,
        data: c.data,
        observacao: c.observacao,
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
  if (localStorage.getItem("tema") === "escuro") {
    document.body.classList.add("tema-escuro");
  }

  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (session) {
      document.querySelector(".topo").style.display = "";
      document.getElementById("area-gestao").innerHTML = `
        <div style="text-align:center;padding:40px 16px;color:#9ca3af">
          <svg viewBox="0 0 24 24" style="width:32px;height:32px;stroke:#d1d5db;fill:none;stroke-width:2;margin-bottom:12px;display:block;margin-inline:auto"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <p style="margin:0;font-size:14px">Carregando...</p>
        </div>
      `;
      await carregarViveiros();

      // Atualizar avatar no topo
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const fotoUrl = user.user_metadata?.avatar_url;
        const nome = user.user_metadata?.nome || user.email?.split("@")[0] || "?";
        const avatarTopo = document.getElementById("avatar-topo");
        if (fotoUrl) {
          avatarTopo.innerHTML = `<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        } else {
          const iniciais = nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
          avatarTopo.innerHTML = `<span class="avatar-topo-iniciais">${iniciais || "?"}</span>`;
        }
      }

      document.getElementById("area-gestao").innerHTML = "";
      document.getElementById("menuGestao").style.display = "grid";
    } else {
      window.location.href = "login.html";
    }
  } catch (error) {
    console.log("Erro na inicialização:", error);
    window.location.href = "login.html";
  }
});
