const SUPABASE_URL = "https://bzlzjjodzyxvkakfmmxw.supabase.co";
const SUPABASE_KEY = "sb_publishable_Avq19q531p8NrIRaHf5VvQ_DoWzOoaW";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let viveiros = [];
let produtos = []; let tiposRacao = [];
let boletos = [];
let _financeiroModo = "detalhado";
let _boletosFiltro = "todos";
let _finOrdenacao = "data";
let _finPagina = 0;
let _finPeriodoIni = "";
let _finPeriodoFim = "";
let _scrollSalvo = 0;
function salvarScroll() { _scrollSalvo = window.scrollY || document.documentElement.scrollTop || 0; }
function restaurarScroll() { setTimeout(() => window.scrollTo(0, _scrollSalvo), 40); }

// ── Tabela de taxas de alimentação WA Aqua ──────────────────────────────────
const _TABELA_TAXA = [
  {peso:1,taxa:8.00},{peso:2,taxa:8.00},{peso:3,taxa:7.00},{peso:4,taxa:6.50},
  {peso:5,taxa:5.50},{peso:6,taxa:5.10},{peso:7,taxa:4.44},{peso:8,taxa:4.22},
  {peso:9,taxa:4.04},{peso:10,taxa:3.88},{peso:11,taxa:3.74},{peso:12,taxa:3.62},
  {peso:13,taxa:3.51},{peso:14,taxa:3.42},{peso:15,taxa:2.92},{peso:16,taxa:2.88},
  {peso:17,taxa:2.79},{peso:18,taxa:2.65},{peso:19,taxa:2.57},{peso:20,taxa:2.39},
  {peso:21,taxa:1.80},{peso:22,taxa:1.60},{peso:23,taxa:1.50},{peso:24,taxa:1.40},
  {peso:25,taxa:1.50},{peso:26,taxa:1.30},{peso:27,taxa:1.30},{peso:28,taxa:1.30},
  {peso:29,taxa:1.30},{peso:30,taxa:1.30},
];
function _obterTaxa(peso) {
  if (peso < 1 || peso > 30) return null;
  for (const item of _TABELA_TAXA) { if (peso === item.peso) return item.taxa; }
  for (let i = 0; i < _TABELA_TAXA.length - 1; i++) {
    const a = _TABELA_TAXA[i], b = _TABELA_TAXA[i + 1];
    if (peso > a.peso && peso < b.peso)
      return a.taxa + (b.taxa - a.taxa) * (peso - a.peso) / (b.peso - a.peso);
  }
  return null;
}
function _calcularBiomassa(populacao, consumoKg, pesoG) {
  const taxa = _obterTaxa(pesoG);
  if (!taxa || !consumoKg || consumoKg <= 0) return null;
  const biomassa   = consumoKg / (taxa / 100);
  const quantidade = biomassa / (pesoG / 1000);
  return { biomassa, quantidade: Math.round(quantidade), sobrevivencia: (quantidade / populacao) * 100 };
}
let _swipeViveirosAbort = null;
let _swipeRacaoAbort = null;

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

function _toastErro(msg) {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;top:72px;left:50%;transform:translateX(-50%);background:#fef2f2;border:1.5px solid #fca5a5;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:600;color:#dc2626;z-index:9999;max-width:90vw;text-align:center;pointer-events:none";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function _toastSucesso(msg) {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;top:72px;left:50%;transform:translateX(-50%);background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:600;color:#16a34a;z-index:9999;max-width:90vw;text-align:center;pointer-events:none";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
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

    if (error) { _toastErro("Erro ao salvar foto."); return; }

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
  if (error) { _toastErro("Erro ao excluir foto."); return; }

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
          <div id="msg-perfil-erro" style="display:none;color:#ef4444;font-size:13px;margin:0 0 8px;text-align:center;font-weight:500"></div>
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
  const msgErro = document.getElementById("msg-perfil-erro");
  function _erroPerfil(msg) { if (msgErro) { msgErro.textContent = msg; msgErro.style.display = "block"; } }
  if (msgErro) msgErro.style.display = "none";

  if (!nome) { _erroPerfil("Digite um nome para a fazenda."); return; }

  const { error } = await supabaseClient.auth.updateUser({ data: { nome } });
  if (error) { _erroPerfil("Erro ao salvar. Tente novamente."); return; }

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
        <div id="msg-senha-erro" style="display:none;color:#ef4444;font-size:13px;margin:0 0 8px;text-align:center;font-weight:500"></div>
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
  const msgErro = document.getElementById("msg-senha-erro");
  function _erroSenha(msg) { if (msgErro) { msgErro.textContent = msg; msgErro.style.display = "block"; } }
  if (msgErro) msgErro.style.display = "none";

  if (!nova || nova.length < 6) { _erroSenha("A senha deve ter no mínimo 6 caracteres."); return; }
  if (nova !== confirmar) { _erroSenha("As senhas não coincidem."); return; }

  const { error } = await supabaseClient.auth.updateUser({ password: nova });
  if (error) { _erroSenha("Erro ao alterar senha: " + error.message); return; }

  _toastSucesso("Senha alterada com sucesso!");
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

// ═══════════════════════════════════════════════════════════════════════════
//  CONFIGURAÇÕES
// ═══════════════════════════════════════════════════════════════════════════

const _ICO = {
  fazenda:  `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  seguranca:`<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  aparencia:`<svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  conta:    `<svg viewBox="0 0 24 24"><path d="M3 18h18M4 8l4 4 4-7 4 7 4-4-1.5 10h-13z"/></svg>`,
  faq:      `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  suporte:  `<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  sair:     `<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  boleto:   `<svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  renovar:  `<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>`,
  mail:     `<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>`,
  alerta:   `<svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  ideia:    `<svg viewBox="0 0 24 24"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>`,
};

function _cfgItem(ico, titulo, sub, onclick) {
  return `<button class="cfg-item" onclick="${onclick}">
    <div class="cfg-item-ico">${_ICO[ico]}</div>
    <div class="cfg-item-texto">
      <span class="cfg-item-titulo">${titulo}</span>
      <span class="cfg-item-sub">${sub}</span>
    </div>
    <svg class="cfg-item-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
  </button>`;
}

function _fmtDataISO(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

async function atualizarAvatarTopo() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  const fotoUrl = user.user_metadata?.avatar_url;
  const nome = user.user_metadata?.nome || user.email?.split("@")[0] || "?";
  const avatarTopo = document.getElementById("avatar-topo");
  if (!avatarTopo) return;
  if (fotoUrl) {
    avatarTopo.innerHTML = `<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    const ini = nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
    avatarTopo.innerHTML = `<span class="avatar-topo-iniciais">${ini}</span>`;
  }
}

// ─── Hub de Configurações ──────────────────────────────────────────────────
async function abrirConfiguracoes() {
  fecharMenuUsuario();
  esconderMenu();
  const area = document.getElementById("area-gestao");
  const { data: { user } } = await supabaseClient.auth.getUser();
  const nome = user?.user_metadata?.nome || user?.email?.split("@")[0] || "Minha fazenda";
  const email = user?.email || "";
  const fotoUrl = user?.user_metadata?.avatar_url || null;
  const ini = nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  const avatarHtml = fotoUrl ? `<img src="${fotoUrl}" alt="">` : `<span>${ini}</span>`;

  area.innerHTML = `
    <h3 class="titulo-secao">Configurações</h3>
    <div class="cfg-wrap">
      <div class="cfg-header">
        <div class="cfg-header-avatar">${avatarHtml}</div>
        <div class="cfg-header-info">
          <span class="cfg-header-nome">${nome}</span>
          <span class="cfg-header-email">${email}</span>
          <span class="cfg-header-online">● Online</span>
        </div>
      </div>
      <div class="cfg-lista">
        ${_cfgItem("fazenda", "Fazenda", "Nome, e-mail e foto", "abrirFazenda()")}
        ${_cfgItem("seguranca", "Segurança", "Alterar senha", "abrirSeguranca()")}
        ${_cfgItem("aparencia", "Aparência", "Tema claro ou escuro", "abrirAparencia()")}
        ${_cfgItem("conta", "Minha conta", "Plano e assinatura", "abrirMinhaConta()")}
        ${_cfgItem("faq", "Perguntas frequentes (FAQ)", "Dúvidas sobre o sistema", "abrirFAQ()")}
        ${_cfgItem("suporte", "Suporte", "Fale com nossa equipe", "abrirSuporte()")}
      </div>
      <button class="cfg-item cfg-item-sair" onclick="confirmarSairConta()">
        <div class="cfg-item-ico cfg-item-ico-sair">${_ICO.sair}</div>
        <div class="cfg-item-texto">
          <span class="cfg-item-titulo">Sair da conta</span>
          <span class="cfg-item-sub">Encerrar sessão atual</span>
        </div>
      </button>
      <div id="cfg-sair-confirm" class="cfg-sair-confirm" style="display:none">
        <p>Deseja realmente sair da sua conta?</p>
        <div class="cfg-sair-botoes">
          <button class="cfg-sair-cancelar" onclick="document.getElementById('cfg-sair-confirm').style.display='none'">Cancelar</button>
          <button class="cfg-sair-confirmar" onclick="sairUsuario()">Sim, sair</button>
        </div>
      </div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="voltarMenuGestao()">← Voltar</button>
    </div>
  `;
}

function confirmarSairConta() {
  const el = document.getElementById("cfg-sair-confirm");
  if (el) el.style.display = el.style.display === "none" ? "block" : "none";
}

// ─── Fazenda ───────────────────────────────────────────────────────────────
async function abrirFazenda() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  const { data: { user } } = await supabaseClient.auth.getUser();
  const nome = user?.user_metadata?.nome || "";
  const prop = user?.user_metadata?.proprietario || "";
  const email = user?.email || "";
  const fotoUrl = user?.user_metadata?.avatar_url || null;
  const ini = (nome || email).split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";

  area.innerHTML = `
    <h3 class="titulo-secao">Fazenda</h3>
    <div class="cfg-wrap">
      <div class="fazenda-foto-wrap">
        <div id="fazenda-foto" class="fazenda-foto">${fotoUrl ? `<img src="${fotoUrl}" alt="">` : `<span>${ini}</span>`}</div>
        <label class="fazenda-foto-edit">
          <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <input type="file" accept="image/*" onchange="uploadFotoFazenda(this)" style="display:none">
        </label>
      </div>
      ${fotoUrl ? `<button class="fazenda-remover-foto" onclick="excluirFotoFazenda()">Remover foto</button>` : `<p class="fazenda-foto-dica">Adicione uma foto da fazenda (opcional)</p>`}
      <div class="form-corpo" style="padding:0">
        <div class="campo-form">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><label>Nome da fazenda</label></div>
          <input type="text" id="fzNome" value="${nome}" placeholder="Ex: Fazenda São João">
        </div>
        <div class="campo-form">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><label>Nome do proprietário</label></div>
          <input type="text" id="fzProp" value="${prop}" placeholder="Seu nome">
        </div>
        <div class="campo-form">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg><label>E-mail</label></div>
          <input type="email" id="fzEmail" value="${email}" placeholder="seu@email.com">
        </div>
        <div id="msg-fazenda" style="display:none;font-size:13px;margin:0 0 8px;text-align:center;font-weight:500"></div>
        <button class="botao-salvar" onclick="salvarFazenda()">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar alterações
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirConfiguracoes()">← Voltar</button>
      </div>
    </div>
  `;
}

async function salvarFazenda() {
  const nome = document.getElementById("fzNome").value.trim();
  const prop = document.getElementById("fzProp").value.trim();
  const email = document.getElementById("fzEmail").value.trim();
  const msg = document.getElementById("msg-fazenda");
  const setMsg = (t, ok) => { if (msg) { msg.textContent = t; msg.style.display = "block"; msg.style.color = ok ? "#16a34a" : "#ef4444"; } };
  if (msg) msg.style.display = "none";
  if (!nome) { setMsg("Digite o nome da fazenda."); return; }

  const { data: { user } } = await supabaseClient.auth.getUser();
  const emailMudou = email && email !== user?.email;

  const { error } = await supabaseClient.auth.updateUser({ data: { nome, proprietario: prop } });
  if (error) { setMsg("Erro ao salvar. Tente novamente."); return; }

  if (emailMudou) {
    const { error: e2 } = await supabaseClient.auth.updateUser({ email });
    if (e2) { setMsg("Dados salvos, mas o e-mail não pôde ser alterado: " + e2.message); return; }
    _toastSucesso("Enviamos um link de confirmação para o novo e-mail.");
  } else {
    _toastSucesso("Alterações salvas!");
  }
  atualizarAvatarTopo();
  abrirConfiguracoes();
}

async function uploadFotoFazenda(input) {
  const file = input.files[0];
  if (!file) return;
  const canvas = document.createElement("canvas");
  canvas.width = 80; canvas.height = 80;
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = async () => {
    const ctx = canvas.getContext("2d");
    const size = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 80, 80);
    URL.revokeObjectURL(url);
    const base64 = canvas.toDataURL("image/jpeg", 0.5);
    const { error } = await supabaseClient.auth.updateUser({ data: { avatar_url: base64 } });
    if (error) { _toastErro("Erro ao salvar foto."); return; }
    const fz = document.getElementById("fazenda-foto");
    if (fz) fz.innerHTML = `<img src="${base64}" alt="">`;
    atualizarAvatarTopo();
    _toastSucesso("Foto atualizada!");
    abrirFazenda();
  };
  img.src = url;
}

async function excluirFotoFazenda() {
  const { error } = await supabaseClient.auth.updateUser({ data: { avatar_url: null } });
  if (error) { _toastErro("Erro ao remover foto."); return; }
  atualizarAvatarTopo();
  abrirFazenda();
}

// ─── Segurança ─────────────────────────────────────────────────────────────
function abrirSeguranca() {
  esconderMenu();
  const lock = `<svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <h3 class="titulo-secao">Segurança</h3>
    <div class="cfg-wrap">
      <div class="cfg-hero">
        <div class="cfg-hero-ico"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
        <h4>Alterar senha</h4>
        <p>Para sua segurança, escolha uma senha forte.</p>
      </div>
      <div class="form-corpo" style="padding:0">
        <div class="campo-form">
          <div class="campo-label">${lock}<label>Senha atual</label></div>
          <input type="password" id="segAtual" placeholder="Digite sua senha atual">
        </div>
        <div class="campo-form">
          <div class="campo-label">${lock}<label>Nova senha</label></div>
          <input type="password" id="segNova" placeholder="Mínimo 6 caracteres">
        </div>
        <div class="campo-form">
          <div class="campo-label">${lock}<label>Confirmar nova senha</label></div>
          <input type="password" id="segConfirma" placeholder="Repita a nova senha">
        </div>
        <div id="msg-seg" style="display:none;font-size:13px;margin:0 0 8px;text-align:center;font-weight:500"></div>
        <button class="botao-salvar" onclick="salvarNovaSenha()">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar nova senha
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirConfiguracoes()">← Voltar</button>
      </div>
    </div>
  `;
}

async function salvarNovaSenha() {
  const atual = document.getElementById("segAtual").value;
  const nova = document.getElementById("segNova").value;
  const conf = document.getElementById("segConfirma").value;
  const msg = document.getElementById("msg-seg");
  const setMsg = (t) => { if (msg) { msg.textContent = t; msg.style.display = "block"; msg.style.color = "#ef4444"; } };
  if (msg) msg.style.display = "none";

  if (!atual) { setMsg("Digite sua senha atual."); return; }
  if (!nova || nova.length < 6) { setMsg("A nova senha deve ter no mínimo 6 caracteres."); return; }
  if (nova !== conf) { setMsg("As senhas não coincidem."); return; }

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error: eAuth } = await supabaseClient.auth.signInWithPassword({ email: user.email, password: atual });
  if (eAuth) { setMsg("Senha atual incorreta."); return; }

  const { error } = await supabaseClient.auth.updateUser({ password: nova });
  if (error) { setMsg("Erro ao alterar senha: " + error.message); return; }

  _toastSucesso("Senha alterada com sucesso!");
  abrirConfiguracoes();
}

// ─── Aparência ─────────────────────────────────────────────────────────────
function abrirAparencia() {
  esconderMenu();
  const escuro = document.body.classList.contains("tema-escuro");
  const check = `<svg class="aparencia-check" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`;
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <h3 class="titulo-secao">Aparência</h3>
    <div class="cfg-wrap">
      <p class="cfg-secao-desc">Escolha como o aplicativo deve aparecer. A mudança é aplicada imediatamente.</p>
      <div class="aparencia-opcoes">
        <button class="aparencia-card ${!escuro ? "ativo" : ""}" onclick="setTema('claro')">
          <div class="aparencia-preview preview-claro"><span class="ap-barra"></span><span class="ap-linha"></span><span class="ap-linha curta"></span></div>
          <span class="aparencia-nome">Claro</span>
          ${!escuro ? check : ""}
        </button>
        <button class="aparencia-card ${escuro ? "ativo" : ""}" onclick="setTema('escuro')">
          <div class="aparencia-preview preview-escuro"><span class="ap-barra"></span><span class="ap-linha"></span><span class="ap-linha curta"></span></div>
          <span class="aparencia-nome">Escuro</span>
          ${escuro ? check : ""}
        </button>
      </div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirConfiguracoes()">← Voltar</button>
    </div>
  `;
}

function setTema(modo) {
  const escuro = modo === "escuro";
  document.body.classList.toggle("tema-escuro", escuro);
  localStorage.setItem("tema", escuro ? "escuro" : "claro");
  abrirAparencia();
}

// ─── Minha conta ───────────────────────────────────────────────────────────
async function abrirMinhaConta() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  const { data: { user } } = await supabaseClient.auth.getUser();
  const cadastroStr = _fmtDataISO(user?.created_at);
  let vencStr = "—", proxStr = "—";
  if (user?.created_at) {
    const venc = new Date(user.created_at);
    if (!isNaN(venc.getTime())) {
      venc.setFullYear(venc.getFullYear() + 1);
      vencStr = _fmtDataISO(venc.toISOString());
      proxStr = vencStr;
    }
  }
  area.innerHTML = `
    <h3 class="titulo-secao">Minha conta</h3>
    <div class="cfg-wrap">
      <div class="conta-plano">
        <div class="conta-plano-ico">${_ICO.conta}</div>
        <span class="conta-plano-nome">Plano Premium</span>
        <span class="conta-plano-badge">Ativo</span>
      </div>
      <div class="conta-info">
        <div class="conta-info-linha"><span>Data de cadastro</span><strong>${cadastroStr}</strong></div>
        <div class="conta-info-linha"><span>Vencimento da assinatura</span><strong>${vencStr}</strong></div>
        <div class="conta-info-linha"><span>Próxima cobrança</span><strong>${proxStr}</strong></div>
      </div>
      <div class="cfg-lista">
        ${_cfgItem("renovar", "Renovar assinatura", "Estender seu plano", "renovarAssinatura()")}
      </div>
      <div class="conta-aviso">
        <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
        <span>Sua assinatura garante acesso a todos os recursos do WA Aqua Gestão.</span>
      </div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirConfiguracoes()">← Voltar</button>
    </div>
  `;
}

function renovarAssinatura() {
  _toastSucesso("Em breve você poderá renovar sua assinatura por aqui.");
}

// ─── Perguntas frequentes (FAQ) ────────────────────────────────────────────
const _FAQ = [
  { q: "Como cadastrar um viveiro?", a: "Para cadastrar um novo viveiro, acesse Cadastrar viveiro no menu principal. Informe o nome do viveiro, a data de povoamento, a quantidade de pós-larvas, o tamanho do viveiro e o laboratório de origem. Após salvar, o viveiro estará disponível para lançamentos de ração, biometria, despesca e acompanhamento do ciclo." },
  { q: "Como lançar uma biometria?", a: "Abra o viveiro desejado e selecione Lançar biometria. Informe o peso médio obtido na biometria e confirme o lançamento. O sistema atualizará automaticamente o histórico de crescimento, o ganho semanal e a projeção de crescimento do cultivo." },
  { q: "Como encerrar um ciclo?", a: "Após finalizar a despesca, acesse o viveiro e toque em Encerrar ciclo. O sistema encerrará o cultivo atual, mantendo todas as informações armazenadas no histórico. Os dados poderão ser consultados posteriormente sempre que necessário." },
  { q: "Como funciona a projeção de crescimento?", a: "A projeção utiliza as biometrias registradas para calcular o ganho médio semanal do lote. Com base nesse histórico, o sistema estima a data em que o peso-alvo será atingido, o dia estimado de cultivo e a biomassa prevista. Quanto maior o número de biometrias registradas, maior será a precisão da estimativa." },
  { q: "Como alterar o peso-alvo?", a: "Na tela de projeção de crescimento, utilize os botões + e − para definir o peso desejado para a despesca. Todas as previsões serão recalculadas automaticamente com base no novo peso-alvo." },
  { q: "Como renovar minha assinatura?", a: "Acesse Configurações → Minha conta e selecione Renovar assinatura. Escolha o plano desejado e siga as instruções para concluir a renovação." },
  { q: "Esqueci minha senha. O que fazer?", a: "Na tela de login, selecione Esqueci minha senha. Informe o e-mail cadastrado e siga as instruções enviadas para redefinir sua senha. Se não conseguir recuperar o acesso, entre em contato com o suporte do WA Aqua Gestão." },
  { q: "Como lançar uma despesca?", a: "Acesse o viveiro desejado e selecione Lançar despesca. Informe a quantidade despescada e o peso médio dos camarões. O sistema calculará automaticamente a biomassa despescada e registrará a operação no histórico do ciclo." },
  { q: "Como lançar o consumo de ração?", a: "Abra o viveiro e toque em Lançar ração. Informe a quantidade fornecida no dia e confirme o lançamento. O consumo será somado ao histórico do cultivo e utilizado nos cálculos de biomassa, FCA e demais indicadores do sistema." },
];

function _faqItem(f, i) {
  return `<div class="faq-item" data-q="${f.q.toLowerCase()}">
    <button class="faq-pergunta" onclick="toggleFAQ(${i})">
      <span>${f.q}</span>
      <svg class="faq-seta" id="faq-seta-${i}" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
    <div class="faq-resposta" id="faq-resp-${i}"><div class="faq-resposta-inner"><p>${f.a}</p></div></div>
  </div>`;
}

function abrirFAQ() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <h3 class="titulo-secao">Perguntas frequentes</h3>
    <div class="cfg-wrap">
      <div class="faq-busca">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="faqBusca" placeholder="Buscar dúvidas..." oninput="filtrarFAQ(this.value)">
      </div>
      <div class="faq-lista" id="faq-lista">
        ${_FAQ.map((f, i) => _faqItem(f, i)).join("")}
        <p id="faq-vazio" class="faq-vazio" style="display:none">Nenhuma dúvida encontrada. Fale com o suporte.</p>
      </div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirConfiguracoes()">← Voltar</button>
    </div>
  `;
}

function toggleFAQ(i) {
  const resp = document.getElementById("faq-resp-" + i);
  const seta = document.getElementById("faq-seta-" + i);
  if (!resp) return;
  const aberto = resp.classList.toggle("aberto");
  if (seta) seta.classList.toggle("rot", aberto);
}

function filtrarFAQ(termo) {
  const t = (termo || "").trim().toLowerCase();
  let visiveis = 0;
  document.querySelectorAll("#faq-lista .faq-item").forEach(el => {
    const ok = !t || (el.dataset.q || "").includes(t);
    el.style.display = ok ? "" : "none";
    if (ok) visiveis++;
  });
  const vazio = document.getElementById("faq-vazio");
  if (vazio) vazio.style.display = visiveis === 0 ? "block" : "none";
}

// ─── Suporte ───────────────────────────────────────────────────────────────
function abrirSuporte() {
  esconderMenu();
  const wa = "5588992498067";
  const mail = "matheuswitalo86@gmail.com";
  const chev = `<svg class="cfg-item-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>`;
  const txtProblema = encodeURIComponent("Olá! Quero reportar um problema no WA Aqua Gestão:");
  const txtSugestao = encodeURIComponent("Olá! Tenho uma sugestão para o WA Aqua Gestão:");
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <h3 class="titulo-secao">Suporte</h3>
    <div class="cfg-wrap">
      <div class="cfg-hero">
        <div class="cfg-hero-ico"><svg viewBox="0 0 24 24"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg></div>
        <h4>Como podemos ajudar?</h4>
        <p>Entre em contato pelos canais abaixo.</p>
      </div>
      <div class="cfg-lista">
        <a class="cfg-item" href="https://wa.me/${wa}" target="_blank" rel="noopener">
          <div class="cfg-item-ico">${_ICO.whatsapp}</div>
          <div class="cfg-item-texto"><span class="cfg-item-titulo">WhatsApp</span><span class="cfg-item-sub">(88) 99249-8067</span></div>
          ${chev}
        </a>
        <a class="cfg-item" href="mailto:${mail}">
          <div class="cfg-item-ico">${_ICO.mail}</div>
          <div class="cfg-item-texto"><span class="cfg-item-titulo">E-mail</span><span class="cfg-item-sub">${mail}</span></div>
          ${chev}
        </a>
        <a class="cfg-item" href="https://wa.me/${wa}?text=${txtProblema}" target="_blank" rel="noopener">
          <div class="cfg-item-ico cfg-item-ico-alerta">${_ICO.alerta}</div>
          <div class="cfg-item-texto"><span class="cfg-item-titulo">Reportar problema</span><span class="cfg-item-sub">Descreva o que aconteceu</span></div>
          ${chev}
        </a>
        <a class="cfg-item" href="https://wa.me/${wa}?text=${txtSugestao}" target="_blank" rel="noopener">
          <div class="cfg-item-ico">${_ICO.ideia}</div>
          <div class="cfg-item-texto"><span class="cfg-item-titulo">Enviar sugestão</span><span class="cfg-item-sub">Conte sua ideia para a gente</span></div>
          ${chev}
        </a>
      </div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirConfiguracoes()">← Voltar</button>
    </div>
  `;
}

async function pegarUsuarioLogado() {
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error || !user) {
    _toastErro("Sua sessão expirou. Faça login novamente.");
    return null;
  }

  return user;
}

function _erroCarregamento(msg) {
  const area = document.getElementById("area-gestao");
  if (!area) return;
  area.innerHTML = `
    <div class="resultado-box" style="text-align:center;padding:28px 16px">
      <p style="font-size:30px;margin:0 0 8px">⚠️</p>
      <p style="font-weight:600;color:#dc2626;margin:0 0 4px">${msg}</p>
      <p style="font-size:13px;color:#9ca3af;margin:0 0 16px">Verifique sua conexão e tente novamente.</p>
      <button class="botao-salvar" style="max-width:220px;margin:0 auto" onclick="location.reload()">Recarregar</button>
    </div>
  `;
}

function formatarNumeroBR(valor, casas = 0) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

function fmtG(v) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function parseMoedaBR(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/\./g, "").replace(",", ".")) || 0;
}

function formatarMoedaBlur(input) {
  let v = input.value.trim();
  if (!v) return;
  // pt-BR: ponto é separador de milhar, vírgula é decimal (sempre)
  v = v.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(v);
  if (isNaN(n)) { input.value = ""; return; }
  input.value = n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _formatarMoedaInput(input) {
  const pos = input.selectionStart;
  const oldLen = input.value.length;
  let v = input.value.replace(/[^\d,]/g, "");
  const partes = v.split(",");
  if (partes.length > 2) v = partes[0] + "," + partes.slice(1).join("");
  const [intParte, decParte] = v.split(",");
  const intFmt = (intParte || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  input.value = decParte !== undefined ? intFmt + "," + decParte : intFmt;
  const diff = input.value.length - oldLen;
  try { input.setSelectionRange(pos + diff, pos + diff); } catch(e) {}
}

function _attachFormatacao(input) {
  if (input._fmtAtached) return;
  input._fmtAtached = true;
  input.addEventListener("input", () => _formatarMoedaInput(input));
  input.addEventListener("blur", () => formatarMoedaBlur(input));
}

(function() {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        const inputs = node.querySelectorAll
          ? node.querySelectorAll('input[type="text"][inputmode="decimal"]')
          : [];
        inputs.forEach(_attachFormatacao);
        if (node.matches && node.matches('input[type="text"][inputmode="decimal"]')) _attachFormatacao(node);
      });
    });
  });
  document.addEventListener("DOMContentLoaded", () => {
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();

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

// Converte "YYYY-MM-DD" (ou Date) para um Date à meia-noite LOCAL,
// evitando o deslocamento de fuso de new Date("YYYY-MM-DD") (que é UTC).
function _parseDataLocal(d) {
  if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const [ano, mes, dia] = String(d).split("T")[0].split("-").map(Number);
  return new Date(ano, (mes || 1) - 1, dia || 1);
}

function calcularDiasCultivo(dataPovoamento, dataFinal = new Date()) {
  if (!dataPovoamento) return 0;

  const inicio = _parseDataLocal(dataPovoamento);
  const fim = _parseDataLocal(dataFinal);

  const diferenca = fim - inicio;
  const dias = Math.round(diferenca / 86400000) + 1;

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
  return Math.max(0, ordenados.findIndex(v => v.id === viveiros[index].id));
}

function esconderMenu() {
  document.getElementById("menuGestao").style.display = "none";
}

function voltarMenuGestao() {
  if (window.innerWidth >= 900) {
    mostrarListaViveiros();
    return;
  }
  document.getElementById("menuGestao").style.display = "grid";
  limparAreaGestao();
  verificarBoletosVencendo();
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

        <div id="msg-viveiro-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center;font-weight:500"></div>
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
  const erroViveiro = document.getElementById("msg-viveiro-erro");
  function mostrarErroViveiro(msg) {
    if (erroViveiro) { erroViveiro.textContent = msg; erroViveiro.style.display = "block"; }
  }
  if (erroViveiro) erroViveiro.style.display = "none";

  if (!nome || !data || !total || !tamanho || !laboratorio) {
    mostrarErroViveiro("Preencha todos os campos.");
    return;
  }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

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
    mostrarErroViveiro("Erro ao salvar: " + error.message);
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

  // Swipe para navegar entre viveiros — cancela listeners anteriores antes de registrar novos
  if (_swipeViveirosAbort) _swipeViveirosAbort.abort();
  _swipeViveirosAbort = new AbortController();
  const _swipeSig = _swipeViveirosAbort.signal;
  let touchStartX = 0;
  area.addEventListener("touchstart", e => { touchStartX = e.touches?.[0]?.clientX ?? 0; }, { passive: true, signal: _swipeSig });
  area.addEventListener("touchend", e => {
    // Só swipa se ainda estiver na tela de lista de viveiros
    if (!area.querySelector(".viveiro-card")) return;
    const endX = e.changedTouches?.[0]?.clientX;
    if (endX == null) return;
    const diff = touchStartX - endX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && posicao < total - 1) mostrarListaViveiros(posicao + 1, "proximo");
      if (diff < 0 && posicao > 0) mostrarListaViveiros(posicao - 1, "anterior");
    }
  }, { passive: true, signal: _swipeSig });

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
  const ultimaBiometria = biosSorted.length > 0 ? fmtG(biosSorted[biosSorted.length - 1].gramatura) : "--";
  let mediaCrescimento = "--";
  if (biosSorted.length >= 2) {
    const taxas = [];
    for (let i = 1; i < biosSorted.length; i++) {
      const dias = Math.round((_parseDataLocal(biosSorted[i].data) - _parseDataLocal(biosSorted[i - 1].data)) / 86400000);
      if (dias > 0) taxas.push((biosSorted[i].gramatura - biosSorted[i - 1].gramatura) / dias);
    }
    if (taxas.length > 0) {
      const mediaGDia = taxas.reduce((s, v) => s + v, 0) / taxas.length;
      mediaCrescimento = formatarNumeroBR(mediaGDia * 7, 2) + " g/sem";
    }
  }

  // Sobrevivência estimada e FCI estimado
  const racoesSorted = [...racoes].sort((a, b) => a.data.localeCompare(b.data));
  const ultimaRacaoNaoZero = [...racoesSorted].reverse().find(r => r.racao > 0);
  const populacaoNum = viveiro.totalPovoado
    ? Number(String(viveiro.totalPovoado).replace(/\./g, ""))
    : null;
  const pesoUltimaBio = biosSorted.length > 0 ? biosSorted[biosSorted.length - 1].gramatura : null;

  let sobrevivenciaEstimada = "--";
  let fciEstimado = "--";
  let biomassaAtualStr = "--";
  let biomassaDespescaStr = "--";
  let custoKgProduzidoStr = "--";
  const PESO_ALVO_DESPESCA = 20; // g — meta padrão de despesca
  if (populacaoNum && ultimaRacaoNaoZero && pesoUltimaBio) {
    const res = _calcularBiomassa(populacaoNum, ultimaRacaoNaoZero.racao, pesoUltimaBio);
    if (res && res.biomassa > 0) {
      sobrevivenciaEstimada = formatarNumeroBR(res.sobrevivencia, 1) + " %";
      if (totalRacao > 0) fciEstimado = formatarNumeroBR(totalRacao / res.biomassa, 2);
      biomassaAtualStr = formatarNumeroBR(res.biomassa, 0) + " kg";
      if (totalCustos > 0) custoKgProduzidoStr = "R$ " + formatarNumeroBR(totalCustos / res.biomassa, 2);
      const pesoDespesca = Math.max(PESO_ALVO_DESPESCA, pesoUltimaBio);
      biomassaDespescaStr = formatarNumeroBR(res.quantidade * pesoDespesca / 1000, 0) + " kg";
    }
  }

  const totalFormatado = viveiro.totalPovoado
    ? Number(String(viveiro.totalPovoado).replace(/\./g, "")).toLocaleString("pt-BR")
    : "--";

  area.innerHTML = `
    <div class="painel-viveiro">

      <div class="vv-header">
        <div class="vv-header-ico">
          <svg viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
        </div>
        <div class="vv-header-info">
          <h2 class="vv-titulo">${viveiro.nome.toUpperCase()}</h2>
          <span class="vv-badge"><span class="vv-badge-dot"></span>Em cultivo</span>
        </div>
        <div class="vv-pls">${totalFormatado} PLs</div>
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
          <small>Área do viveiro</small>
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

        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <small>Sobrevivência est.</small>
          <strong>${sobrevivenciaEstimada}</strong>
        </div>

        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <small>FCA estimado</small>
          <strong>${fciEstimado}</strong>
        </div>

        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          </div>
          <small>Biomassa estimada</small>
          <strong>${biomassaAtualStr}</strong>
        </div>

        <div class="info-box">
          <div class="info-box-icone">
            <svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
          </div>
          <small>Custo por quilo</small>
          <strong>${custoKgProduzidoStr}</strong>
        </div>
      </div>

      <div class="vv-secao-lbl">Ações de manejo</div>
      <div class="vv-manejo-grid">
        <button class="vv-manejo-btn" onclick="mostrarLancamentoRacao(${index})">
          <svg viewBox="0 0 24 24"><path d="M3 11h18M5 11a7 7 0 0 0 14 0"/><path d="M10 4c0 1.5-1 2.5-1 4h6c0-1.5-1-2.5-1-4"/></svg>
          <span>Lançar ração</span>
        </button>
        <button class="vv-manejo-btn" onclick="abrirBiometria(${index})">
          <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="1"/><line x1="6" y1="7" x2="6" y2="17"/><line x1="10" y1="7" x2="10" y2="12"/><line x1="14" y1="7" x2="14" y2="12"/><line x1="18" y1="7" x2="18" y2="17"/></svg>
          <span>Lançar biometria</span>
        </button>
        <button class="vv-manejo-btn" onclick="abrirDespesca(${index})">
          <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <span>Lançar despesca</span>
        </button>
        <button class="vv-manejo-btn" onclick="abrirLancarCusto(${index})">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <span>Lançar custo</span>
        </button>
      </div>

      <div class="vv-secao-lbl">Consultas e manejo</div>
      <div class="vv-consulta-grid">
        <button class="vv-consulta-btn" onclick="mostrarHistoricoDoViveiroDireto(${index})">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Histórico
        </button>
        <button class="vv-consulta-btn" onclick="abrirManejoAutomatico(${index})">
          <svg viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>
          Manejo automático
        </button>
      </div>

      <div class="vv-secao-lbl">Ações de administração</div>
      <div class="vv-admin-row">
        <button class="vv-admin-btn vv-admin-amber" onclick="abrirEncerrarCiclo(${index})">
          <svg viewBox="0 0 24 24"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          <span>Encerrar ciclo</span>
        </button>
        <button class="vv-admin-btn vv-admin-cinza" onclick="reiniciarCiclo(${index})">
          <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
          <span>Reiniciar ciclo</span>
        </button>
        <button class="vv-admin-btn vv-admin-vermelho" onclick="confirmarExcluirViveiro(${index})">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          <span>Excluir viveiro</span>
        </button>
      </div>

      <div id="confirmar-excluir-viveiro-${index}" style="display:none;margin:0 16px 16px;background:#fff5f5;border:1px solid #fca5a5;border-radius:12px;padding:14px 16px">
        <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#dc2626">Excluir "${viveiro.nome}"?</p>
        <p style="margin:0 0 12px;font-size:12px;color:#7f1d1d">Todos os dados deste viveiro serão desativados. É possível recuperar pelo suporte.</p>
        <div style="display:flex;gap:8px">
          <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirViveiro(${index})">Sim, excluir</button>
          <button class="ciclo-btn-relatorio" style="flex:1" onclick="document.getElementById('confirmar-excluir-viveiro-${index}').style.display='none'">Cancelar</button>
        </div>
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
  if (error) { _toastErro("Erro ao excluir: " + error.message); return; }
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
        <div id="erro-edit-tipo-racao" style="display:none;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 12px;font-size:13px;color:#b91c1c;margin-bottom:4px"></div>
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
  const erroEl = document.getElementById("erro-edit-tipo-racao");
  function _erroEdit(msg) { if (erroEl) { erroEl.textContent = msg; erroEl.style.display = "block"; } }
  if (erroEl) erroEl.style.display = "none";

  if (!nome || !pesoSacoKg || !valorSaco) { _erroEdit("Preencha todos os campos."); return; }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const custoPorKg = valorSaco / pesoSacoKg;
  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

  const { error } = await supabaseClient.from("tipos_racao")
    .update({ nome, peso_saco_kg: pesoSacoKg, valor_saco: valorSaco, custo_por_kg: custoPorKg })
    .eq("id", tiposRacao[i].id).eq("user_id", usuario.id);

  if (botao) { botao.disabled = false; botao.style.opacity = ""; }
  if (error) { _erroEdit("Erro ao salvar: " + error.message); return; }

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
            <input type="number" id="consumoRacao" placeholder="Ex: 50" oninput="document.getElementById('msg-racao-erro')&&(document.getElementById('msg-racao-erro').style.display='none')">
            <span class="campo-unidade">kg</span>
          </div>
        </div>

        <div id="msg-racao-erro" style="display:none;color:#e53e3e;background:#fff5f5;border:1px solid #feb2b2;border-radius:8px;padding:10px 14px;font-size:14px;margin-bottom:8px;"></div>

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

  const erroDiv = document.getElementById("msg-racao-erro");
  function mostrarErroRacao(msg) {
    if (erroDiv) { erroDiv.textContent = msg; erroDiv.style.display = "block"; }
    const botaoSalvar = document.querySelector(".botao-salvar");
    if (botaoSalvar) { botaoSalvar.disabled = false; botaoSalvar.style.opacity = ""; }
  }

  if (!data || isNaN(racao) || racao < 0) {
    mostrarErroRacao("Preencha a data e a quantidade (pode ser 0 para dia sem ração).");
    return;
  }

  // Verifica se já existe lançamento nessa data (normaliza formato)
  const jaExiste = (viveiros[index].racoes || []).some(r => r.data.substring(0, 10) === data);
  if (jaExiste) {
    mostrarErroRacao(`Já existe um lançamento em ${formatarData(data)}. Edite o lançamento existente.`);
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
    mostrarErroRacao("Erro ao salvar: " + error.message);
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

  // Protocolos automáticos atrelados à ração (ex.: potássio por kg)
  await _aplicarProtocolosRacao(index, racao, data);

  // Mostra mensagem de sucesso e avança a data para o dia seguinte (sequência)
  const [ay, am, ad] = data.split("-").map(Number);
  const prox = new Date(ay, am - 1, ad + 1);
  const proxStr = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}-${String(prox.getDate()).padStart(2, "0")}`;
  document.getElementById("dataRacao").value = proxStr;
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
            <input type="text" inputmode="decimal" id="gramaturaBiometria" placeholder="Ex: 10,5">
            <span class="campo-unidade">g</span>
          </div>
        </div>

        <div id="msg-bio-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center;font-weight:500"></div>
        <div id="msg-bio-sucesso" class="msg-sucesso-lancamento" style="display:none;">
          <span class="msg-emoji">✅</span>
          <span class="msg-texto">Biometria lançada!</span>
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
  const gramaturaRaw = document.getElementById("gramaturaBiometria").value.trim().replace(",", ".");
  const gramatura = parseFloat(gramaturaRaw);
  const msgErro = document.getElementById("msg-bio-erro");

  function mostrarErroBio(msg) {
    if (msgErro) { msgErro.textContent = msg; msgErro.style.display = "block"; }
  }

  if (msgErro) msgErro.style.display = "none";

  if (!data || !gramatura || isNaN(gramatura)) {
    mostrarErroBio("Preencha a data e a gramatura.");
    return;
  }

  const dataDuplicada = (viveiros[index].biometrias || []).some(b => b.data === data);
  if (dataDuplicada) {
    mostrarErroBio("Já existe uma biometria nessa data. Edite ou exclua a existente.");
    return;
  }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

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
    if (botao) { botao.disabled = false; botao.style.opacity = ""; }
    mostrarErroBio("Erro ao salvar: " + error.message);
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

        <div id="msg-despesca-erro" style="display:none;color:#e53e3e;background:#fff5f5;border:1px solid #feb2b2;border-radius:8px;padding:10px 14px;font-size:14px;margin-bottom:8px;"></div>

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

  const erroDespesca = document.getElementById("msg-despesca-erro");
  function mostrarErroDespesca(msg) {
    if (erroDespesca) { erroDespesca.textContent = msg; erroDespesca.style.display = "block"; }
  }
  if (erroDespesca) erroDespesca.style.display = "none";

  if (!data || !quantidadeKg || !pesoMedio) {
    mostrarErroDespesca("Preencha a data, quantidade e peso médio.");
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
    if (botao) { botao.disabled = false; botao.style.opacity = ""; }
    mostrarErroDespesca("Erro ao salvar: " + error.message);
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

function abrirHistoricoRacao(pagina = 0) {
  const index = document.getElementById("viveiroHistorico").value;
  if (index === "") return;

  document.getElementById("opcoes-historico").innerHTML = "";
  const voltarFixo = document.getElementById("voltar-menu-historico");
  if (voltarFixo) voltarFixo.style.display = "none";

  renderizarHistoricoRacao(index, "resultado-historico", false, pagina);
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

function abrirHistoricoRacaoDireto(index, pagina = 0) {
  document.getElementById("opcoes-historico").innerHTML = "";
  renderizarHistoricoRacao(index, "resultado-historico", true, pagina);
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
                        crescimento = fmtG(item.gramatura - biometrias[i - 1].gramatura) + " g";
                      }
                      return `
                        <div class="linha-historico-acoes" id="bio-row-${index}-${i}">
                            <span>${formatarData(item.data)}</span>
                            <span class="col-centro">${fmtG(item.gramatura)} g</span>
                            <span class="col-centro">${crescimento}</span>
                            <span class="col-acoes">
                              <button class="botao-editar" onclick="abrirEdicaoBiometria(${index}, ${i}, '${elementoId}', ${direto})">✏️</button>
                              <button class="botao-editar botao-excluir" onclick="confirmarExcluirBiometria(${index}, ${i}, '${elementoId}', ${direto})">🗑️</button>
                            </span>
                        </div>
                    `;
                    })
                    .join("")
            }
        </div>

    ${biometrias.length >= 2 ? `
    <button class="botao-curva-crescimento" onclick="verCurvaCrescimento(${index}, ${direto})">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
      Ver curva de crescimento
    </button>` : ""}
    <button class="botao-voltar-form" style="margin-top:10px" onclick="${direto ? `mostrarHistoricoDoViveiroDireto(${index})` : `voltarOpcoesHistorico()`}">← Voltar</button>
    `;
}

function verCurvaCrescimento(index, direto, pesoAlvo) {
  const viveiro = viveiros[index];
  const biometrias = [...(viveiro.biometrias || [])].sort((a, b) => a.data.localeCompare(b.data));
  const dataPovoamento = viveiro.dataPovoamento ? _parseDataLocal(viveiro.dataPovoamento) : null;
  const alvo = (pesoAlvo === undefined || pesoAlvo === null || isNaN(Number(pesoAlvo))) ? 20 : Number(pesoAlvo);

  const diaDeCultivo = (dataStr) => dataPovoamento
    ? Math.round((_parseDataLocal(dataStr) - dataPovoamento) / 86400000)
    : null;

  const dias = biometrias.map(b => diaDeCultivo(b.data));
  const labels = biometrias.map((b, i) => dataPovoamento ? `D${dias[i]}` : formatarData(b.data));
  const pesos = biometrias.map(b => b.gramatura);
  const pesoAtual = pesos[pesos.length - 1];
  const ultimoDia = dias[dias.length - 1] || 0;

  // Taxa média de crescimento (g/dia)
  const taxas = [];
  for (let i = 1; i < biometrias.length; i++) {
    const dd = Math.round((_parseDataLocal(biometrias[i].data) - _parseDataLocal(biometrias[i - 1].data)) / 86400000);
    if (dd > 0) taxas.push((biometrias[i].gramatura - biometrias[i - 1].gramatura) / dd);
  }
  const gDia = taxas.length ? taxas.reduce((s, v) => s + v, 0) / taxas.length : 0;

  // Biomassa estimada (usa última ração + sobrevivência calculada)
  const racoesSorted = [...(viveiro.racoes || [])].sort((a, b) => a.data.localeCompare(b.data));
  const ultimaRacaoNaoZero = [...racoesSorted].reverse().find(r => r.racao > 0);
  const populacaoNum = viveiro.totalPovoado ? Number(String(viveiro.totalPovoado).replace(/\./g, "")) : null;
  let biomasaAlvoStr = null;
  let estimatedPopulation = null;
  if (populacaoNum && ultimaRacaoNaoZero && pesoAtual > 0) {
    const res = _calcularBiomassa(populacaoNum, ultimaRacaoNaoZero.racao, pesoAtual);
    if (res && res.quantidade > 0) {
      estimatedPopulation = res.quantidade;
      biomasaAlvoStr = formatarNumeroBR(estimatedPopulation * alvo / 1000, 0) + " kg";
    }
  }

  // Monta dados: biometrias reais + pontos semanais interpolados entre elas + projeção semanal
  const chartLabels = [];
  const realData = [];
  const projData = [];
  const actualBioIndices = new Set();

  for (let i = 0; i < biometrias.length; i++) {
    if (i > 0 && dias[i] !== null && dias[i - 1] !== null && dias[i] - dias[i - 1] > 7) {
      const dS = dias[i - 1], dE = dias[i], pS = pesos[i - 1], pE = pesos[i];
      for (let d = dS + 7; d < dE; d += 7) {
        const frac = (d - dS) / (dE - dS);
        chartLabels.push(`D${d}`);
        realData.push(parseFloat((pS + frac * (pE - pS)).toFixed(2)));
        projData.push(null);
      }
    }
    chartLabels.push(labels[i]);
    realData.push(pesos[i]);
    projData.push(null);
    actualBioIndices.add(chartLabels.length - 1);
  }

  const junctionIndex = chartLabels.length - 1;
  let cardProj = "";
  let progresso = 0;
  let despescaIndex = -1;

  if (dataPovoamento && gDia > 0 && alvo > pesoAtual) {
    const diasFalta = Math.ceil((alvo - pesoAtual) / gDia);
    const diaAlvo = ultimoDia + diasFalta;

    projData[junctionIndex] = pesoAtual;

    for (let d = ultimoDia + 7; d < diaAlvo; d += 7) {
      chartLabels.push(`D${d}`);
      realData.push(null);
      projData.push(parseFloat((pesoAtual + gDia * (d - ultimoDia)).toFixed(2)));
    }
    chartLabels.push(`D${diaAlvo}`);
    realData.push(null);
    projData.push(alvo);
    despescaIndex = chartLabels.length - 1;

    const dataAlvoObj = new Date(dataPovoamento.getTime() + diaAlvo * 86400000);
    const dataAlvoStr = `${dataAlvoObj.getFullYear()}-${String(dataAlvoObj.getMonth() + 1).padStart(2, "0")}-${String(dataAlvoObj.getDate()).padStart(2, "0")}`;
    progresso = Math.min(100, Math.round((pesoAtual / alvo) * 100));

    // Tempo restante a partir de HOJE (não da última biometria)
    const _hojeZ = new Date(); _hojeZ.setHours(0, 0, 0, 0);
    const diasRestantes = Math.max(0, Math.ceil((dataAlvoObj - _hojeZ) / 86400000));

    cardProj = `
      <div class="proj-progresso-card">
        <div class="proj-prog-pct-row"><span class="proj-prog-pct">${progresso}%</span> <span class="proj-prog-pct-lbl">do peso-alvo</span></div>
        <div class="proj-barra-fundo">
          <div class="proj-barra-preench" style="width:${progresso}%"></div>
        </div>
        <div class="proj-progresso-base">
          <span>${fmtG(pesoAtual)} g</span>
          <span>${fmtG(alvo)} g</span>
        </div>
      </div>
      <div class="proj-resumo">
        <div class="proj-resumo-linha">
          <svg class="proj-resumo-ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span class="proj-resumo-lbl">Tempo restante</span>
          <span class="proj-resumo-val">${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}</span>
        </div>
        <div class="proj-resumo-linha">
          <svg class="proj-resumo-ico" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span class="proj-resumo-lbl">Data prevista</span>
          <span class="proj-resumo-val">${formatarData(dataAlvoStr)}</span>
        </div>
        <div class="proj-resumo-linha">
          <svg class="proj-resumo-ico" viewBox="0 0 24 24"><path d="M12 2s7 6 7 12a7 7 0 0 1-14 0c0-6 7-12 7-12z"/></svg>
          <span class="proj-resumo-lbl">Dia de cultivo</span>
          <span class="proj-resumo-val">D${diaAlvo}</span>
        </div>
        ${biomasaAlvoStr ? `<div class="proj-resumo-linha">
          <svg class="proj-resumo-ico" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          <span class="proj-resumo-lbl">Biomassa estimada</span>
          <span class="proj-resumo-val">${biomasaAlvoStr}</span>
        </div>` : ""}
      </div>
      <p class="proj-obs">Estimativa pelo ganho médio de ${formatarNumeroBR(gDia * 7, 2)} g/semana. Quanto mais biometrias, mais precisa.</p>
    `;
  } else if (!dataPovoamento) {
    cardProj = `<p class="proj-obs">Defina a data de povoamento para projetar a despesca.</p>`;
  } else if (gDia <= 0) {
    cardProj = `<p class="proj-obs">Sem ganho de peso positivo entre as biometrias — não dá para projetar.</p>`;
  } else {
    progresso = 100;
    cardProj = `<p class="proj-obs">O camarão já está com ${fmtG(pesoAtual)} g, igual ou acima do alvo de ${fmtG(alvo)} g.</p>`;
  }

  const area = document.getElementById("resultado-historico") || document.getElementById("area-gestao");

  area.innerHTML = `
    <h3 class="titulo-secao">Curva de crescimento — ${abreviarViveiro(viveiro.nome)}</h3>
    <div class="cresc-cards">
      <div class="cresc-card">
        <svg class="cresc-card-ico" viewBox="0 0 24 24"><path d="M12 3a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.72V8h4l3 11a3 3 0 0 1-3 4H7a3 3 0 0 1-3-4L7 8h4V6.72A2 2 0 0 1 10 5a2 2 0 0 1 2-2z"/></svg>
        <span class="cresc-card-lbl">Peso atual</span>
        <span class="cresc-card-val">${fmtG(pesoAtual)} g</span>
      </div>
      <div class="cresc-card">
        <svg class="cresc-card-ico" viewBox="0 0 24 24"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>
        <span class="cresc-card-lbl">Crescimento</span>
        <span class="cresc-card-val">${gDia > 0 ? formatarNumeroBR(gDia * 7, 2) + " g/sem" : "--"}</span>
      </div>
      <div class="cresc-card">
        <svg class="cresc-card-ico" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span class="cresc-card-lbl">Dia de cultivo</span>
        <span class="cresc-card-val">${dataPovoamento ? "D" + ultimoDia : "--"}</span>
      </div>
    </div>
    <div class="grafico-container">
      <h4 class="grafico-titulo">Evolução do crescimento</h4>
      <div class="grafico-legenda">
        <span class="grafico-leg-item"><span class="grafico-leg-dot leg-verde"></span>Biometrias realizadas</span>
        <span class="grafico-leg-item"><span class="grafico-leg-dot leg-laranja"></span>Projeção de crescimento</span>
      </div>
      <div class="grafico-canvas-wrap">
        <canvas id="canvas-crescimento"></canvas>
      </div>
    </div>
    <div class="proj-alvo-row">
      <span class="proj-alvo-lbl">Peso-alvo</span>
      <div class="proj-alvo-ctrl">
        <button class="proj-alvo-btn" onclick="(function(){var v=Math.max(1,parseFloat(document.getElementById('proj-alvo').value||20)-0.5);document.getElementById('proj-alvo').value=v;verCurvaCrescimento(${index},${direto},v);})()">−</button>
        <div class="proj-alvo-val-wrap">
          <input type="number" id="proj-alvo" value="${alvo}" min="1" step="0.5"
            onchange="verCurvaCrescimento(${index}, ${direto}, parseFloat(this.value) || 20)">
          <span>g</span>
        </div>
        <button class="proj-alvo-btn" onclick="(function(){var v=parseFloat(document.getElementById('proj-alvo').value||20)+0.5;document.getElementById('proj-alvo').value=v;verCurvaCrescimento(${index},${direto},v);})()">+</button>
      </div>
    </div>
    ${cardProj}
    <h4 class="bio-hist-titulo">Histórico de biometrias</h4>
    <div class="bio-historico">
      ${biometrias.map((b, i) => {
        const dif = i > 0 ? b.gramatura - biometrias[i-1].gramatura : null;
        const ganho = dif !== null
          ? `<span class="bio-hist-ganho ${dif >= 0 ? "pos" : "neg"}">${dif >= 0
              ? `<svg class="bio-hist-seta" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
              : `<svg class="bio-hist-seta" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`}${dif >= 0 ? "+" : ""}${fmtG(dif)}g</span>`
          : `<span class="bio-hist-ganho neutro">—</span>`;
        return `<div class="bio-hist-linha">
          <span class="bio-hist-dia">${labels[i]}</span>
          <span class="bio-hist-peso">${fmtG(b.gramatura)} g</span>
          ${ganho}
        </div>`;
      }).join("")}
    </div>
    <button class="botao-voltar-form" style="margin-top:12px" onclick="renderizarHistoricoBiometria(${index},'resultado-historico',${direto})">← Voltar</button>
  `;

  setTimeout(() => {
    const canvas = document.getElementById("canvas-crescimento");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const linhaDespescaPlugin = {
      id: "linhaDespesca",
      afterDatasetsDraw(chart) {
        if (despescaIndex < 0) return;
        const xScale = chart.scales.x, yScale = chart.scales.y;
        const x = xScale.getPixelForValue(despescaIndex);
        const top = yScale.top, bottom = yScale.bottom;
        const c = chart.ctx;
        c.save();
        c.beginPath();
        c.setLineDash([4, 4]);
        c.moveTo(x, top);
        c.lineTo(x, bottom);
        c.lineWidth = 1.5;
        c.strokeStyle = "rgba(245,158,11,0.65)";
        c.stroke();
        c.setLineDash([]);
        c.fillStyle = "#f59e0b";
        c.font = "700 10px Arial";
        c.textAlign = x > xScale.right - 30 ? "right" : "center";
        c.fillText("Despesca", x, top - 5);
        c.restore();
      }
    };

    new Chart(ctx, {
      type: "line",
      plugins: [linhaDespescaPlugin],
      data: {
        labels: chartLabels,
        datasets: [
          {
            label: "Peso real",
            data: realData,
            borderColor: "rgb(6,107,99)",
            backgroundColor: "rgba(6,107,99,0.08)",
            pointBackgroundColor: ctx2 => actualBioIndices.has(ctx2.dataIndex) ? "rgb(6,107,99)" : "rgba(6,107,99,0.55)",
            pointRadius: ctx2 => {
              if (ctx2.dataIndex > junctionIndex) return 0;
              return actualBioIndices.has(ctx2.dataIndex) ? 5 : 3;
            },
            pointHoverRadius: 8,
            pointHitRadius: 14,
            tension: 0.3,
            fill: true,
            borderWidth: 2.5,
            spanGaps: false,
          },
          {
            label: "Projeção",
            data: projData,
            borderColor: "#f59e0b",
            backgroundColor: "transparent",
            pointBackgroundColor: ctx2 => {
              if (projData[ctx2.dataIndex] === null) return "transparent";
              if (ctx2.dataIndex === pesos.length - 1) return "transparent";
              return "#f59e0b";
            },
            pointBorderColor: ctx2 => {
              if (projData[ctx2.dataIndex] === null) return "transparent";
              if (ctx2.dataIndex === pesos.length - 1) return "transparent";
              return "#f59e0b";
            },
            pointRadius: ctx2 => {
              if (projData[ctx2.dataIndex] === null) return 0;
              if (ctx2.dataIndex === junctionIndex) return 0;
              if (ctx2.dataIndex === projData.length - 1) return 7;
              return 4;
            },
            pointHoverRadius: 8,
            pointHitRadius: 14,
            borderDash: [5, 5],
            tension: 0.2,
            fill: false,
            borderWidth: 2,
            spanGaps: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 18 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "nearest",
            intersect: false,
            animation: { duration: 60 },
            callbacks: {
              title: ctx2 => ctx2[0]?.label || "",
              label: ctx2 => {
                if (ctx2.parsed.y === null) return null;
                const isProj = ctx2.dataset.label === "Projeção";
                const peso = ctx2.parsed.y;
                const lines = [isProj ? `Proj: ${fmtG(peso)} g` : `Peso: ${fmtG(peso)} g`];
                if (estimatedPopulation) {
                  const bio = Math.round(estimatedPopulation * peso / 1000);
                  lines.push(`Biomassa: ~${bio.toLocaleString("pt-BR")} kg`);
                }
                return lines;
              },
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: "Dia de cultivo", color: "#6b7280", font: { size: 12 } },
            grid: { color: "rgba(0,0,0,0.05)" },
            ticks: { color: "#6b7280", font: { size: 11 }, maxTicksLimit: 6, autoSkip: true, maxRotation: 0 }
          },
          y: {
            title: { display: true, text: "Peso (g)", color: "#6b7280", font: { size: 12 } },
            grid: { color: "rgba(0,0,0,0.05)" },
            min: Math.max(0, Math.floor(Math.min(...pesos) * 0.8)),
            ticks: {
              color: "#6b7280",
              font: { size: 11 },
              callback: v => fmtG(v) + " g"
            },
          }
        }
      }
    });
  }, 50);
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
              <div class="linha-historico-racao" id="racao-row-${index}-${iOriginal}">
                <span>${calcularDiasCultivo(viveiro.dataPovoamento, item.data)}</span>
                <span class="col-centro">${formatarData(item.data)}</span>
                <span class="col-centro">${formatarNumeroBR(item.racao, 1)} kg${item.nomeRacao ? `<br><small style="font-size:10px;opacity:0.7">${item.nomeRacao}</small>` : ""}</span>
                <span class="col-acoes">
                  <button class="botao-editar" onclick="abrirEdicaoRacao(${index},${iOriginal},'${elementoId}',${direto},${pagina})">✏️</button>
                  <button class="botao-editar botao-excluir" onclick="confirmarExcluirRacao(${index},${iOriginal},'${elementoId}',${direto},${pagina})">🗑️</button>
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

  // Swipe para trocar página — cancela listeners anteriores para não acumular
  if (_swipeRacaoAbort) _swipeRacaoAbort.abort();
  if (totalPaginas > 1) {
    _swipeRacaoAbort = new AbortController();
    const _sig = _swipeRacaoAbort.signal;
    let touchStartX = 0;
    resultado.addEventListener("touchstart", e => { touchStartX = e.touches?.[0]?.clientX ?? 0; }, { passive: true, signal: _sig });
    resultado.addEventListener("touchend", e => {
      const endX = e.changedTouches?.[0]?.clientX;
      if (endX == null) return;
      const diff = touchStartX - endX;
      if (Math.abs(diff) > 50) {
        if (diff > 0 && pagina < totalPaginas - 1) renderizarHistoricoRacao(index, elementoId, direto, pagina + 1, "proximo");
        if (diff < 0 && pagina > 0) renderizarHistoricoRacao(index, elementoId, direto, pagina - 1, "anterior");
      }
    }, { passive: true, signal: _sig });
  }
}

function abrirEdicaoRacao(viveiroIndex, racaoIndex, elementoId, direto, paginaAtual = 0) {
  salvarScroll();
  const viveiro = viveiros[viveiroIndex];
  const racao = viveiro.racoes[racaoIndex];

  const alvo = direto
    ? document.getElementById("area-gestao")
    : document.getElementById(elementoId);

  const acaoVoltar = direto
    ? `voltarParaHistoricoRacaoDireto(${viveiroIndex},${paginaAtual})`
    : `renderizarHistoricoRacao(${viveiroIndex},'${elementoId}',${direto},${paginaAtual}); restaurarScroll()`;

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
        <button class="botao-salvar" onclick="salvarEdicaoRacao(${viveiroIndex}, ${racaoIndex}, '${elementoId}', ${direto}, ${paginaAtual})">
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
  salvarScroll();
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
            <input type="text" inputmode="decimal" id="qtdEdicaoBio" value="${fmtG(bio.gramatura)}" placeholder="Ex: 10,5">
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
  const novaQtd = parseFloat(document.getElementById("qtdEdicaoBio").value.replace(",", "."));

  if (!novaData || !novaQtd || isNaN(novaQtd)) { _toastErro("Preencha a data e a gramatura."); return; }

  // Impede duas biometrias na mesma data (ignora a própria que está sendo editada)
  const dataDuplicada = (viveiros[viveiroIndex].biometrias || [])
    .some((b, idx) => idx !== bioIndex && b.data === novaData);
  if (dataDuplicada) {
    _toastErro("Já existe uma biometria nessa data. Edite ou exclua a existente.");
    return;
  }

  const bio = viveiros[viveiroIndex].biometrias[bioIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  // DELETE + INSERT contorna restrição de RLS em UPDATE
  const { error: erroDel } = await supabaseClient
    .from("biometrias")
    .delete()
    .eq("id", bio.id)
    .eq("user_id", usuario.id);

  if (erroDel) { console.log(erroDel); _toastErro("Erro ao salvar: " + erroDel.message); return; }

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
    _toastErro("Erro ao salvar edição. Tente novamente.");
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
  restaurarScroll();
}

function confirmarExcluirBiometria(viveiroIndex, bioIndex, elementoId, direto) {
  const row = document.getElementById(`bio-row-${viveiroIndex}-${bioIndex}`);
  if (!row) return;
  row.innerHTML = `
    <div class="confirmar-exclusao-custo" style="grid-column:1/-1">
      <span>Excluir esta biometria?</span>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirBiometria(${viveiroIndex}, ${bioIndex}, '${elementoId}', ${direto})">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="renderizarHistoricoBiometria(${viveiroIndex}, '${elementoId}', ${direto})">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirBiometria(viveiroIndex, bioIndex, elementoId, direto) {
  const bio = viveiros[viveiroIndex].biometrias[bioIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const { error } = await supabaseClient.from("biometrias").delete().eq("id", bio.id).eq("user_id", usuario.id);

  if (error) { console.log(error); _toastErro("Erro ao excluir."); return; }

  viveiros[viveiroIndex].biometrias.splice(bioIndex, 1);
  renderizarHistoricoBiometria(viveiroIndex, elementoId, direto);
  restaurarScroll();
}

// ─── EDITAR / EXCLUIR DESPESCA ────────────────────────────────────────────────

function abrirEdicaoDespesca(viveiroIndex, despIndex, elementoId, direto) {
  salvarScroll();
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

  if (!novaData || !novaQtd || !novoPeso) { _toastErro("Preencha todos os campos."); return; }

  const desp = viveiros[viveiroIndex].despescas[despIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  // DELETE + INSERT contorna restrição de RLS em UPDATE
  const { error: erroDel } = await supabaseClient
    .from("despescas")
    .delete()
    .eq("id", desp.id)
    .eq("user_id", usuario.id);

  if (erroDel) { console.log(erroDel); _toastErro("Erro ao salvar: " + erroDel.message); return; }

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
    _toastErro("Erro ao salvar edição. Tente novamente.");
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
  restaurarScroll();
}

function confirmarExcluirDespesca(viveiroIndex, despIndex, elementoId, direto) {
  const row = document.getElementById(`desp-row-${viveiroIndex}-${despIndex}`);
  if (!row) return;
  row.innerHTML = `
    <div class="confirmar-exclusao-custo" style="grid-column:1/-1">
      <span>Excluir esta despesca?</span>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirDespesca(${viveiroIndex}, ${despIndex}, '${elementoId}', ${direto})">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="renderizarHistoricoDespesca(${viveiroIndex}, '${elementoId}', ${direto})">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirDespesca(viveiroIndex, despIndex, elementoId, direto) {
  const desp = viveiros[viveiroIndex].despescas[despIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const { error } = await supabaseClient.from("despescas").delete().eq("id", desp.id).eq("user_id", usuario.id);

  if (error) { console.log(error); _toastErro("Erro ao excluir."); return; }

  viveiros[viveiroIndex].despescas.splice(despIndex, 1);
  renderizarHistoricoDespesca(viveiroIndex, elementoId, direto);
  restaurarScroll();
}

function voltarParaHistoricoRacaoDireto(viveiroIndex, paginaAtual = 0) {
  mostrarHistoricoDoViveiroDireto(viveiroIndex);
  abrirHistoricoRacaoDireto(viveiroIndex, paginaAtual);
  restaurarScroll();
}

async function salvarEdicaoRacao(viveiroIndex, racaoIndex, elementoId, direto, paginaAtual = 0) {
  const novaData = document.getElementById("dataEdicaoRacao").value;
  const novaQtd = parseFloat(document.getElementById("qtdEdicaoRacao").value);

  if (!novaData || isNaN(novaQtd) || novaQtd < 0) {
    _toastErro("Preencha a data e a quantidade (pode ser 0).");
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

  if (erroDel) { _toastErro("Erro ao salvar: " + erroDel.message); return; }

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
    _toastErro("Erro ao salvar edição. Tente novamente.");
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
    voltarParaHistoricoRacaoDireto(viveiroIndex, paginaAtual);
  } else {
    mostrarHistoricoCultivo(viveiroIndex);
    abrirHistoricoRacao(paginaAtual);
  }
  restaurarScroll();
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

function confirmarExcluirRacao(viveiroIndex, racaoIndex, elementoId, direto, pagina = 0) {
  const row = document.getElementById(`racao-row-${viveiroIndex}-${racaoIndex}`);
  if (!row) return;
  row.innerHTML = `
    <div class="confirmar-exclusao-custo" style="grid-column:1/-1">
      <span>Excluir este lançamento de ração?</span>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirRacao(${viveiroIndex},${racaoIndex},'${elementoId}',${direto},${pagina})">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="renderizarHistoricoRacao(${viveiroIndex},'${elementoId}',${direto},${pagina})">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirRacao(viveiroIndex, racaoIndex, elementoId, direto, pagina = 0) {
  const racao = viveiros[viveiroIndex].racoes[racaoIndex];

  if (!racao || !racao.id) {
    _toastErro("Erro: lançamento sem ID.");
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
    _toastErro("Erro ao excluir lançamento.");
    return;
  }

  if (!deletado || deletado.length === 0) {
    _toastErro("Não foi possível excluir. Verifique sua conexão ou permissão.");
    return;
  }

  viveiros[viveiroIndex].racoes.splice(racaoIndex, 1);

  const paginaAjustada = Math.min(pagina, Math.max(0, Math.ceil((viveiros[viveiroIndex].racoes.length) / 30) - 1));
  renderizarHistoricoRacao(viveiroIndex, elementoId, direto, paginaAjustada);
  restaurarScroll();
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
        <div id="msg-reinicio-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center;font-weight:500"></div>
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

  const erroReinicio = document.getElementById("msg-reinicio-erro");
  function mostrarErroReinicio(msg) {
    if (erroReinicio) { erroReinicio.textContent = msg; erroReinicio.style.display = "block"; }
  }
  if (erroReinicio) erroReinicio.style.display = "none";

  if (!novoPovoamento || !novoTotal || !novoLaboratorio) {
    mostrarErroReinicio("Preencha todos os campos.");
    return;
  }

  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

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
    if (botao) { botao.disabled = false; botao.style.opacity = ""; }
    mostrarErroReinicio("Erro ao salvar novo ciclo.");
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

function confirmarExcluirViveiro(index) {
  const painel = document.getElementById(`confirmar-excluir-viveiro-${index}`);
  if (painel) painel.style.display = painel.style.display === "none" ? "block" : "none";
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
    _toastErro("Erro ao excluir viveiro.");
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
                    <div class="linha-historico-acoes" id="desp-row-${index}-${i}">
                        <span>${formatarData(item.data)}</span>
                        <span class="col-centro">${formatarNumeroBR(item.quantidadeKg, 1)} kg</span>
                        <span class="col-centro">${formatarNumeroBR(item.pesoMedio, 1)} g</span>
                        <span class="col-acoes">
                          <button class="botao-editar" onclick="abrirEdicaoDespesca(${index}, ${i}, '${elementoId}', ${direto})">✏️</button>
                          <button class="botao-editar botao-excluir" onclick="confirmarExcluirDespesca(${index}, ${i}, '${elementoId}', ${direto})">🗑️</button>
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

// ─── BOLETOS A VENCER ─────────────────────────────────────────────────────────

function _statusBoleto(dataCompra, prazoDias) {
  const hoje = new Date();
  const hojeZerado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const [ano, mes, dia] = dataCompra.split("-").map(Number);
  const venc = new Date(ano, mes - 1, dia);
  venc.setDate(venc.getDate() + prazoDias);
  const diff = Math.round((venc - hojeZerado) / 86400000);
  const dataFmt = venc.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (diff < 0) return { tipo: "vencido", dias: Math.abs(diff), diff, label: `Vencido há ${Math.abs(diff)} dias`, dataFmt };
  if (diff === 0) return { tipo: "hoje", dias: 0, diff, label: "Vence hoje!", dataFmt };
  if (diff <= 10) return { tipo: "proximo", dias: diff, diff, label: `Vence em ${diff} dias`, dataFmt };
  return { tipo: "ok", dias: diff, diff, label: `Vence em ${diff} dias`, dataFmt };
}

function verificarBoletosVencendo() {
  if (!boletos.length) return;
  const alertas = boletos.filter(b => !b.pago && _statusBoleto(b.dataCompra, b.prazoDias).tipo !== "ok");
  if (!alertas.length) return;
  const area = document.getElementById("area-gestao");
  const existente = document.getElementById("banner-boletos-alerta");
  if (existente) existente.remove();
  const div = document.createElement("div");
  div.id = "banner-boletos-alerta";
  div.innerHTML = `
    <div class="boleto-banner" onclick="abrirMenuFinanceiro()">
      <div class="boleto-banner-icone">
        <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="boleto-banner-texto">
        <strong>${alertas.length} boleto${alertas.length > 1 ? "s" : ""} ${alertas.length > 1 ? "precisam" : "precisa"} de atenção</strong>
        <span>${alertas.map(a => a.nome).join(", ")}</span>
      </div>
      <span class="boleto-banner-seta">›</span>
    </div>
  `;
  area.insertBefore(div, area.firstChild);
}

function abrirMenuFinanceiro() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <h3 class="titulo-secao">Financeiro</h3>
    <div class="cfg-wrap">
      <div class="cfg-hero">
        <div class="cfg-hero-ico"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
        <h4>Financeiro</h4>
        <p>Acompanhe os custos do cultivo e gerencie suas contas a pagar.</p>
      </div>
      <div class="cfg-lista">
        <button class="cfg-item" onclick="abrirFinanceiro()">
          <div class="cfg-item-ico"><svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div>
          <div class="cfg-item-texto"><span class="cfg-item-titulo">Relatório financeiro</span><span class="cfg-item-sub">Consulte os custos por viveiro ou geral</span></div>
          <svg class="cfg-item-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="cfg-item" onclick="abrirBoletos()">
          <div class="cfg-item-ico cfg-item-ico-amber"><svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
          <div class="cfg-item-texto"><span class="cfg-item-titulo">Boletos</span><span class="cfg-item-sub">Veja e gerencie boletos e vencimentos</span></div>
          <svg class="cfg-item-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="cfg-item" onclick="abrirFormBoleto()">
          <div class="cfg-item-ico cfg-item-ico-roxo"><svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg></div>
          <div class="cfg-item-texto"><span class="cfg-item-titulo">Cadastrar boleto</span><span class="cfg-item-sub">Cadastre uma nova conta a pagar</span></div>
          <svg class="cfg-item-chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="voltarMenuGestao()">← Voltar</button>
    </div>
  `;
}

function abrirBoletos(filtro) {
  if (filtro) _boletosFiltro = filtro;
  esconderMenu();
  const area = document.getElementById("area-gestao");

  const todos = boletos.map((b, i) => ({ b, i, st: _statusBoleto(b.dataCompra, b.prazoDias) }));
  const naoPagos = todos.filter(x => !x.b.pago);
  const valorTotal = naoPagos.reduce((s, x) => s + (x.b.valor || 0), 0);
  const qtdVencendo = naoPagos.filter(x => x.st.tipo === "proximo" || x.st.tipo === "hoje").length;
  const qtdVencidos = naoPagos.filter(x => x.st.tipo === "vencido").length;

  let filtrados;
  if (_boletosFiltro === "vencendo") filtrados = naoPagos.filter(x => x.st.tipo === "proximo" || x.st.tipo === "hoje");
  else if (_boletosFiltro === "vencidos") filtrados = naoPagos.filter(x => x.st.tipo === "vencido");
  else if (_boletosFiltro === "pagos") filtrados = todos.filter(x => x.b.pago);
  else filtrados = [...todos].sort((x, y) => {
    if (!!x.b.pago !== !!y.b.pago) return x.b.pago ? 1 : -1;
    return x.st.diff - y.st.diff;
  });

  const qtdPagos = todos.filter(x => x.b.pago).length;

  const rows = filtrados.map(({ b, i, st }) => {
    const [ano, mes, dia] = b.dataCompra.split("-").map(Number);
    const vencDate = new Date(ano, mes - 1, dia);
    vencDate.setDate(vencDate.getDate() + b.prazoDias);
    const vencFmt = vencDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const badgeTipo = b.pago ? "pago" : st.tipo;
    const badgeLabel = b.pago ? "✓ Pago" : st.label;
    return `
      <div class="bt-card${b.pago ? " bt-card-pago" : ""}" data-busca="${(b.nome + " " + (b.fornecedor || "")).toLowerCase()}">
        <div class="bt-card-main" onclick="verDetalhesBoleto(${i})">
          <div class="bt-card-head">
            <span class="bt-card-nome">${b.nome}</span>
            <span class="bt-badge bt-badge-${badgeTipo}">${badgeLabel}</span>
          </div>
          <div class="bt-card-sub">Fornecedor: ${b.fornecedor || "—"}</div>
          <div class="bt-card-foot">
            <span class="bt-card-venc">Vencimento: ${vencFmt}</span>
            <span class="bt-card-valor">${b.valor ? "R$ " + b.valor.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : ""}</span>
          </div>
        </div>
        <div class="bt-menu-wrap" onclick="event.stopPropagation()">
          <button class="bt-menu-btn" onclick="_toggleMenuBoleto(${i})">⋮</button>
          <div id="bt-menu-${i}" class="bt-menu-drop" style="display:none">
            ${b.pago
              ? `<button onclick="_toggleMenuBoleto(${i});desmarcarBoletoPago(${i})">↩️ Desfazer pagamento</button>`
              : `<button onclick="_toggleMenuBoleto(${i});marcarBoletoPago(${i})">✅ Marcar como pago</button>`}
            <button onclick="_toggleMenuBoleto(${i});abrirFormBoleto(${i})">✏️ Editar</button>
            <button class="bt-menu-excluir" onclick="_toggleMenuBoleto(${i});_mostrarConfirmarExcluir(${i})">🗑️ Excluir</button>
          </div>
        </div>
        <div id="bt-conf-${i}" class="bt-confirmar-inline" style="display:none">
          <span>Excluir este boleto?</span>
          <button class="confirmar-boleto-btn-cancelar" onclick="document.getElementById('bt-conf-${i}').style.display='none'">Cancelar</button>
          <button class="confirmar-boleto-btn-excluir" onclick="excluirBoleto(${i})">Excluir</button>
        </div>
      </div>
    `;
  }).join("");

  area.innerHTML = `
    <div class="fin-topo-acoes">
      <h3 class="titulo-secao" style="margin:0">Boletos</h3>
      <button class="fin-novo-btn" onclick="abrirFormBoleto()">+ Novo boleto</button>
    </div>
    <div class="cfg-wrap">
      <div class="bt-chips">
        <div class="bt-chip">
          <div class="bt-chip-val">${naoPagos.length}</div>
          <div class="bt-chip-lbl">Ativos</div>
          <div class="bt-chip-sub">R$ ${formatarNumeroBR(valorTotal, 2)}</div>
        </div>
        <div class="bt-chip bt-chip-warn">
          <div class="bt-chip-val">${qtdVencendo}</div>
          <div class="bt-chip-lbl">Vencendo</div>
        </div>
        <div class="bt-chip bt-chip-danger">
          <div class="bt-chip-val">${qtdVencidos}</div>
          <div class="bt-chip-lbl">Vencidos</div>
        </div>
        <div class="bt-chip bt-chip-ok">
          <div class="bt-chip-val">${qtdPagos}</div>
          <div class="bt-chip-lbl">Pagos</div>
        </div>
      </div>
      <div class="bt-busca">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Buscar por nome ou fornecedor..." oninput="_filtrarBoletosBusca(this.value)">
      </div>
      <div class="bt-abas">
        <button class="bt-aba${_boletosFiltro === "todos" ? " ativa" : ""}" onclick="abrirBoletos('todos')">Todos</button>
        <button class="bt-aba${_boletosFiltro === "vencendo" ? " ativa" : ""}" onclick="abrirBoletos('vencendo')">Vencendo</button>
        <button class="bt-aba${_boletosFiltro === "vencidos" ? " ativa" : ""}" onclick="abrirBoletos('vencidos')">Vencidos</button>
        <button class="bt-aba${_boletosFiltro === "pagos" ? " ativa" : ""}" onclick="abrirBoletos('pagos')">Pagos</button>
      </div>
      <div class="bt-lista">
        ${filtrados.length ? rows : `<div class="bt-empty">Nenhum boleto${_boletosFiltro !== "todos" ? " nessa categoria" : " cadastrado"}.</div>`}
        <p id="bt-busca-vazio" class="bt-empty" style="display:none">Nenhum boleto encontrado.</p>
      </div>
      <button class="botao-voltar-form" style="margin-top:6px" onclick="abrirMenuFinanceiro()">← Voltar</button>
    </div>
  `;

  // Fecha menus ao clicar fora
  document.addEventListener("click", _fecharMenusBoleto, { once: true });
}

function _filtrarBoletosBusca(termo) {
  const t = (termo || "").trim().toLowerCase();
  let vis = 0;
  document.querySelectorAll(".bt-lista .bt-card").forEach(el => {
    const ok = !t || (el.dataset.busca || "").includes(t);
    el.style.display = ok ? "" : "none";
    if (ok) vis++;
  });
  const vazio = document.getElementById("bt-busca-vazio");
  if (vazio) vazio.style.display = vis === 0 ? "block" : "none";
}

function _toggleMenuBoleto(index) {
  const menu = document.getElementById(`bt-menu-${index}`);
  if (!menu) return;
  const aberto = menu.style.display !== "none";
  document.querySelectorAll(".bt-menu-drop").forEach(el => el.style.display = "none");
  if (!aberto) menu.style.display = "block";
}

function _fecharMenusBoleto() {
  document.querySelectorAll(".bt-menu-drop").forEach(el => el.style.display = "none");
}

function _mostrarConfirmarExcluir(index) {
  const row = document.getElementById(`bt-conf-${index}`);
  if (row) row.style.display = "flex";
}

function verDetalhesBoleto(index) {
  const area = document.getElementById("area-gestao");
  const b = boletos[index];
  const st = _statusBoleto(b.dataCompra, b.prazoDias);

  const [ano, mes, dia] = b.dataCompra.split("-").map(Number);
  const dataCompraFmt = new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");

  area.innerHTML = `
    <h3 class="titulo-secao">${b.nome}</h3>
    <div class="cfg-wrap">
      <div class="bt-det-topo">
        <div class="bt-det-ico"><svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
        <div class="bt-det-status">
          ${b.pago
            ? `<span class="boleto-badge boleto-badge-pago" style="font-size:13px;padding:6px 14px">✓ Pago</span>`
            : `<span class="boleto-badge boleto-badge-${st.tipo}" style="font-size:13px;padding:6px 14px">${st.label}</span>`}
        </div>
      </div>
      <div class="bt-det-info">
        <div class="bt-det-linha"><span>Fornecedor</span><strong>${b.fornecedor || "—"}</strong></div>
        <div class="bt-det-linha"><span>Data da compra</span><strong>${dataCompraFmt}</strong></div>
        <div class="bt-det-linha"><span>Prazo</span><strong>${b.prazoDias} dias</strong></div>
        <div class="bt-det-linha"><span>Vencimento</span><strong>${st.dataFmt}</strong></div>
        ${b.pago && b.dataPagamento ? `<div class="bt-det-linha"><span>Pago em</span><strong>${formatarData(b.dataPagamento)}</strong></div>` : ""}
        ${b.valor ? `<div class="bt-det-linha bt-det-valor"><span>Valor</span><strong>R$ ${b.valor.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>` : ""}
      </div>
      ${b.pago
        ? `<button class="botao-salvar" style="margin-top:14px;background:#6b7280" onclick="desmarcarBoletoPago(${index}, true)">↩️ Desfazer pagamento</button>`
        : `<button class="botao-salvar" style="margin-top:14px;background:#16a34a" onclick="marcarBoletoPago(${index}, true)">✓ Marcar como pago</button>`}
      <div style="display:flex;gap:10px;margin-top:10px">
        <button class="botao-salvar" style="flex:1" onclick="abrirFormBoleto(${index})">✏️ Editar</button>
        <button class="botao-salvar" style="flex:1;background:#ef4444" onclick="document.getElementById('confirmar-excluir-det').style.display='block'">🗑️ Excluir</button>
      </div>
      <div id="confirmar-excluir-det" class="painel-confirmar-boleto" style="display:none;margin-top:10px">
        <p class="confirmar-boleto-pergunta">Excluir este boleto?</p>
        <div class="confirmar-boleto-botoes">
          <button class="confirmar-boleto-btn-cancelar" onclick="document.getElementById('confirmar-excluir-det').style.display='none'">Cancelar</button>
          <button class="confirmar-boleto-btn-excluir" onclick="excluirBoleto(${index})">Excluir</button>
        </div>
      </div>
      <div class="bt-det-historico">
        <h4>Histórico</h4>
        <div class="bt-hist-linha"><span class="bt-hist-data">${dataCompraFmt}</span><span class="bt-hist-txt">Boleto cadastrado</span></div>
        <div class="bt-hist-linha"><span class="bt-hist-data">${dataCompraFmt}</span><span class="bt-hist-txt">Vencimento definido: ${st.dataFmt}</span></div>
        ${b.pago && b.dataPagamento ? `<div class="bt-hist-linha"><span class="bt-hist-data">${formatarData(b.dataPagamento)}</span><span class="bt-hist-txt">Marcado como pago</span></div>` : ""}
      </div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirBoletos()">← Voltar</button>
    </div>
  `;
}

function abrirFormBoleto(index) {
  const area = document.getElementById("area-gestao");
  const editando = index !== null && index !== undefined;
  const b = editando ? boletos[index] : null;

  area.innerHTML = `
    <h3 class="titulo-secao">${editando ? "Editar boleto" : "Novo boleto"}</h3>
    <div class="cfg-wrap">
      <div class="fin-secao-titulo">Informações do boleto</div>
      <div class="campo-form">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          <label>Nome do boleto</label>
        </div>
        <input type="text" id="boleto-nome" placeholder="Ex: Ração ABC" value="${b ? b.nome : ""}">
      </div>
      <div class="campo-form">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <label>Fornecedor</label>
        </div>
        <input type="text" id="boleto-fornecedor" placeholder="Ex: Loja do João" value="${b ? b.fornecedor : ""}">
      </div>
      <div class="campo-form">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <label>Valor (R$)</label>
        </div>
        <input type="text" inputmode="decimal" id="boleto-valor" placeholder="Ex: 1.500,00" value="${b && b.valor ? b.valor.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : ""}">
      </div>

      <div class="fin-secao-titulo" style="margin-top:16px">Datas e prazo</div>
      <div class="campo-form">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <label>Data da compra</label>
        </div>
        <input type="date" id="boleto-data" value="${b ? b.dataCompra : ""}" oninput="_calcVencimentoForm()">
      </div>
      <div class="campo-form">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <label>Prazo (dias)</label>
        </div>
        <input type="number" id="boleto-prazo" placeholder="Ex: 60" min="1" value="${b ? b.prazoDias : ""}" oninput="_calcVencimentoForm()">
      </div>
      <div class="fin-venc-box">
        <div class="fin-venc-label">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Vencimento
        </div>
        <span class="fin-venc-valor" id="boleto-vencimento">—</span>
      </div>
      <p class="fin-venc-dica">Calculado automaticamente pela data da compra + prazo.</p>

      <div id="msg-boleto-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center"></div>
      <button class="botao-salvar" onclick="salvarBoleto(${editando ? index : "null"})">${editando ? "Salvar boleto" : "Salvar boleto"}</button>
      <div class="separador-ou"><span>ou</span></div>
      <button class="botao-voltar-form" onclick="abrirBoletos()">← Voltar</button>
    </div>
  `;
  _calcVencimentoForm();
}

function _calcVencimentoForm() {
  const d = document.getElementById("boleto-data")?.value;
  const p = parseInt(document.getElementById("boleto-prazo")?.value);
  const out = document.getElementById("boleto-vencimento");
  if (!out) return;
  if (d && p > 0) {
    const [a, m, dia] = d.split("-").map(Number);
    const venc = new Date(a, m - 1, dia);
    venc.setDate(venc.getDate() + p);
    out.textContent = venc.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } else {
    out.textContent = "—";
  }
}

async function salvarBoleto(index) {
  const nome = document.getElementById("boleto-nome").value.trim();
  const fornecedor = document.getElementById("boleto-fornecedor").value.trim();
  const valorRaw = document.getElementById("boleto-valor").value;
  const valor = valorRaw ? parseMoedaBR(valorRaw) : null;
  const dataCompra = document.getElementById("boleto-data").value;
  const prazoDias = parseInt(document.getElementById("boleto-prazo").value);
  const erroDiv = document.getElementById("msg-boleto-erro");

  function mostrarErroBoleto(msg) {
    if (erroDiv) { erroDiv.textContent = msg; erroDiv.style.display = "block"; }
  }

  if (!nome) return mostrarErroBoleto("Informe o nome do boleto.");
  if (!fornecedor) return mostrarErroBoleto("Informe o fornecedor.");
  if (!dataCompra) return mostrarErroBoleto("Informe a data da compra.");
  if (!prazoDias || prazoDias < 1) return mostrarErroBoleto("Informe o prazo em dias.");

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const editando = index !== null && index !== undefined && index !== "null";

  if (editando) {
    const { error } = await supabaseClient.from("boletos").update({
      nome, fornecedor, valor, data_compra: dataCompra, prazo_dias: prazoDias,
    }).eq("id", boletos[index].id);
    if (error) return mostrarErroBoleto("Erro ao salvar. Tente novamente.");
    boletos[index] = { ...boletos[index], nome, fornecedor, valor, dataCompra, prazoDias };
  } else {
    const { data, error } = await supabaseClient.from("boletos").insert({
      user_id: usuario.id, nome, fornecedor, valor, data_compra: dataCompra, prazo_dias: prazoDias,
    }).select().single();
    if (error) return mostrarErroBoleto("Erro ao salvar. Tente novamente.");
    boletos.push({ id: data.id, nome, fornecedor, valor, dataCompra, prazoDias });
  }

  abrirBoletos();
}

async function excluirBoleto(index) {
  const { error } = await supabaseClient.from("boletos")
    .update({ ativo: false }).eq("id", boletos[index].id);
  if (error) { console.error(error); return; }
  boletos.splice(index, 1);
  abrirBoletos();
}

async function marcarBoletoPago(index, voltarDetalhe) {
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;
  const hoje = new Date().toISOString().split("T")[0];
  const { error } = await supabaseClient.from("boletos")
    .update({ pago: true, data_pagamento: hoje })
    .eq("id", boletos[index].id).eq("user_id", usuario.id);
  if (error) { console.error(error); _toastErro("Erro ao marcar como pago: " + error.message); return; }
  boletos[index].pago = true;
  boletos[index].dataPagamento = hoje;
  _toastSucesso("Boleto marcado como pago.");
  if (voltarDetalhe) verDetalhesBoleto(index); else abrirBoletos();
}

async function desmarcarBoletoPago(index, voltarDetalhe) {
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;
  const { error } = await supabaseClient.from("boletos")
    .update({ pago: false, data_pagamento: null })
    .eq("id", boletos[index].id).eq("user_id", usuario.id);
  if (error) { console.error(error); _toastErro("Erro ao desfazer: " + error.message); return; }
  boletos[index].pago = false;
  boletos[index].dataPagamento = null;
  if (voltarDetalhe) verDetalhesBoleto(index); else abrirBoletos();
}

function confirmarExcluirBoleto(index) {
  const painel = document.getElementById(`confirmar-excluir-boleto-${index}`);
  if (painel) painel.style.display = painel.style.display === "none" ? "block" : "none";
}

// ─── FINANCEIRO ───────────────────────────────────────────────────────────────

function abrirFinanceiro() {
  esconderMenu();
  // Período padrão: mês atual
  if (!_finPeriodoIni && !_finPeriodoFim) {
    const now = new Date();
    const ini = new Date(now.getFullYear(), now.getMonth(), 1);
    const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    _finPeriodoIni = ini.toISOString().split("T")[0];
    _finPeriodoFim = fim.toISOString().split("T")[0];
  }
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="fin-topo-acoes">
      <h3 class="titulo-secao" style="margin:0">Relatório financeiro</h3>
      <button class="fin-novo-btn" onclick="imprimirRelatorioFinanceiro()">🖨️ Imprimir</button>
    </div>
    <div class="cfg-wrap">
      <div class="campo-form">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
          <label>Viveiro</label>
        </div>
        <select id="viveiroFinanceiro" onchange="_finPagina=0;mostrarCustosFinanceiro()">
          <option value="">Todos os viveiros</option>
          ${viveiros.map((v, i) => `<option value="${i}">${v.nome}</option>`).join("")}
        </select>
      </div>
      <div class="campo-form" style="margin-bottom:6px">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <label>Período</label>
        </div>
        <div class="fin-periodo-row">
          <input type="date" id="finPeriodoIni" value="${_finPeriodoIni}" onchange="_finSetPeriodo()">
          <span>até</span>
          <input type="date" id="finPeriodoFim" value="${_finPeriodoFim}" onchange="_finSetPeriodo()">
        </div>
      </div>
      <button class="fin-limpar-filtros" onclick="_finLimparFiltros()">Limpar filtros</button>
      <div class="fin-modo-toggle">
        <button class="fin-modo-btn ${_financeiroModo === "detalhado" ? "ativo" : ""}" onclick="_financeiroModo='detalhado';_finPagina=0;mostrarCustosFinanceiro()">Detalhado</button>
        <button class="fin-modo-btn ${_financeiroModo === "resumido" ? "ativo" : ""}" onclick="_financeiroModo='resumido';mostrarCustosFinanceiro()">Por tipo</button>
      </div>
      <div id="resultado-financeiro"></div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirMenuFinanceiro()">← Voltar</button>
    </div>
  `;
  mostrarCustosFinanceiro();
}

function _finSetPeriodo() {
  _finPeriodoIni = document.getElementById("finPeriodoIni")?.value || "";
  _finPeriodoFim = document.getElementById("finPeriodoFim")?.value || "";
  _finPagina = 0;
  mostrarCustosFinanceiro();
}

function _finLimparFiltros() {
  _finPeriodoIni = ""; _finPeriodoFim = ""; _finPagina = 0;
  const a = document.getElementById("finPeriodoIni"); if (a) a.value = "";
  const b = document.getElementById("finPeriodoFim"); if (b) b.value = "";
  const v = document.getElementById("viveiroFinanceiro"); if (v) v.value = "";
  mostrarCustosFinanceiro();
}

function _finTipoLabel(c) {
  return c.tipo === "produto" ? "Produto" : "Outro custo";
}

function _finColetarCustos() {
  const viveiroIndex = document.getElementById("viveiroFinanceiro")?.value ?? "";
  const porViveiro = viveiroIndex !== "";
  let custos;
  if (porViveiro) {
    const v = viveiros[viveiroIndex];
    custos = (v.custos || []).map(c => ({ ...c, viveiroNome: v.nome }));
  } else {
    custos = viveiros.flatMap(v => (v.custos || []).map(c => ({ ...c, viveiroNome: v.nome })));
  }
  if (_finPeriodoIni) custos = custos.filter(c => c.data >= _finPeriodoIni);
  if (_finPeriodoFim) custos = custos.filter(c => c.data <= _finPeriodoFim);
  return { custos, porViveiro };
}

function mostrarCustosFinanceiro() {
  const resultado = document.getElementById("resultado-financeiro");
  if (!resultado) return;
  const { custos, porViveiro } = _finColetarCustos();

  if (custos.length === 0) {
    resultado.innerHTML = `<p class="sobrevivencia-texto" style="margin:16px 0">Nenhum custo lançado${porViveiro ? " para este viveiro" : ""} no período.<br><small>Ajuste os filtros ou lance custos dentro de cada viveiro.</small></p>`;
    return;
  }

  const total = custos.reduce((s, c) => s + Number(c.valor), 0);

  if (_financeiroModo === "resumido") {
    _finRenderPorTipo(resultado, custos, total);
  } else {
    _finRenderDetalhado(resultado, custos, total);
  }
}

function _finRenderDetalhado(resultado, custos, total) {
  // % do total geral (mesmo período, todos os viveiros)
  let custosGeral = viveiros.flatMap(v => (v.custos || []));
  if (_finPeriodoIni) custosGeral = custosGeral.filter(c => c.data >= _finPeriodoIni);
  if (_finPeriodoFim) custosGeral = custosGeral.filter(c => c.data <= _finPeriodoFim);
  const totalGeral = custosGeral.reduce((s, c) => s + Number(c.valor), 0);
  const pct = totalGeral > 0 ? Math.round((total / totalGeral) * 100) : 100;

  // dias do período
  let dias;
  if (_finPeriodoIni && _finPeriodoFim) {
    dias = Math.max(1, Math.round((_parseDataLocal(_finPeriodoFim) - _parseDataLocal(_finPeriodoIni)) / 86400000) + 1);
  } else {
    const datas = custos.map(c => c.data).sort();
    dias = Math.max(1, Math.round((_parseDataLocal(datas[datas.length - 1]) - _parseDataLocal(datas[0])) / 86400000) + 1);
  }
  const mediaDia = total / dias;
  const maior = custos.reduce((m, c) => Number(c.valor) > Number(m.valor) ? c : m, custos[0]);

  // ordenação
  const ord = _finOrdenacao;
  const ordenados = [...custos].sort((a, b) => {
    if (ord === "valor") return Number(b.valor) - Number(a.valor);
    if (ord === "descricao") return (a.nomeProduto || "").localeCompare(b.nomeProduto || "", "pt-BR");
    return b.data.localeCompare(a.data);
  });

  // paginação
  const PP = 8;
  const totalPag = Math.max(1, Math.ceil(ordenados.length / PP));
  if (_finPagina > totalPag - 1) _finPagina = totalPag - 1;
  if (_finPagina < 0) _finPagina = 0;
  const pagina = ordenados.slice(_finPagina * PP, _finPagina * PP + PP);

  resultado.innerHTML = `
    <div class="fin-cards">
      <div class="fin-card">
        <div class="fin-card-top"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>Total de custos</span></div>
        <strong>R$ ${formatarNumeroBR(total, 2)}</strong>
        <small>${pct}% do total</small>
      </div>
      <div class="fin-card">
        <div class="fin-card-top"><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg><span>Lançamentos</span></div>
        <strong>${custos.length}</strong>
        <small>Itens registrados</small>
      </div>
      <div class="fin-card">
        <div class="fin-card-top"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>Custo médio / dia</span></div>
        <strong>R$ ${formatarNumeroBR(mediaDia, 2)}</strong>
        <small>No período</small>
      </div>
      <div class="fin-card">
        <div class="fin-card-top"><svg viewBox="0 0 24 24"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg><span>Maior lançamento</span></div>
        <strong>R$ ${formatarNumeroBR(Number(maior.valor), 2)}</strong>
        <small>${maior.nomeProduto || "—"} · ${formatarData(maior.data)}</small>
      </div>
    </div>

    <div class="fin-lista-head">
      <span>Lançamentos de custos</span>
      <select class="fin-ordenar" onchange="_finOrdenacao=this.value;_finPagina=0;mostrarCustosFinanceiro()">
        <option value="data" ${ord === "data" ? "selected" : ""}>Data</option>
        <option value="valor" ${ord === "valor" ? "selected" : ""}>Valor</option>
        <option value="descricao" ${ord === "descricao" ? "selected" : ""}>Descrição</option>
      </select>
    </div>
    <div class="fin-lista">
      ${pagina.map(c => `
        <div class="fin-linha">
          <span class="fin-linha-data">${formatarData(c.data)}</span>
          <span class="fin-linha-viveiro">${abreviarViveiro(c.viveiroNome || "")}</span>
          <span class="fin-linha-desc">${c.nomeProduto || "—"}<small>${_finTipoLabel(c)}</small></span>
          <span class="fin-linha-valor">R$ ${formatarNumeroBR(Number(c.valor), 2)}</span>
        </div>
      `).join("")}
    </div>
    ${totalPag > 1 ? `
      <div class="fin-paginacao">
        <button ${_finPagina <= 0 ? "disabled" : ""} onclick="_finPagina--;mostrarCustosFinanceiro()">← Anterior</button>
        <span>Pág. ${_finPagina + 1} / ${totalPag}</span>
        <button ${_finPagina >= totalPag - 1 ? "disabled" : ""} onclick="_finPagina++;mostrarCustosFinanceiro()">Próxima →</button>
      </div>` : ""}
    <div class="fin-total-geral">
      <div class="fin-total-geral-ico"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
      <div class="fin-total-geral-txt">
        <span>Total geral no período</span>
        <strong>R$ ${formatarNumeroBR(total, 2)}</strong>
      </div>
    </div>
  `;
}

function _finRenderPorTipo(resultado, custos, total) {
  const grupos = {};
  custos.forEach(c => {
    const chave = c.tipo === "outro" ? "Outro custo" : (c.categoria || "Outros");
    if (!grupos[chave]) grupos[chave] = { nome: chave, total: 0, qtd: 0 };
    grupos[chave].total += Number(c.valor);
    grupos[chave].qtd += 1;
  });
  const lista = Object.values(grupos).sort((a, b) => b.total - a.total);
  const cores = ["rgb(6,107,99)", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899", "#84cc16"];

  resultado.innerHTML = `
    <div class="fin-secao-titulo" style="margin-top:4px">Resumo por tipo</div>
    <div class="fin-pizza-wrap">
      <div class="fin-pizza-canvas">
        <canvas id="finPizza"></canvas>
        <div class="fin-pizza-centro"><span>Total</span><strong>R$ ${formatarNumeroBR(total, 2)}</strong></div>
      </div>
      <div class="fin-pizza-legenda">
        ${lista.map((g, i) => `
          <div class="fin-leg-item">
            <span class="fin-leg-dot" style="background:${cores[i % cores.length]}"></span>
            <span class="fin-leg-nome">${g.nome}</span>
            <span class="fin-leg-val">R$ ${formatarNumeroBR(g.total, 2)} <small>${total > 0 ? Math.round((g.total / total) * 100) : 0}%</small></span>
          </div>
        `).join("")}
      </div>
    </div>
    <div class="fin-ranking">
      <div class="fin-secao-titulo">Maiores custos</div>
      ${lista.map((g, i) => `
        <div class="fin-rank-linha">
          <span class="fin-rank-pos">${i + 1}</span>
          <span class="fin-rank-nome">${g.nome}</span>
          <span class="fin-rank-val">R$ ${formatarNumeroBR(g.total, 2)}</span>
        </div>
      `).join("")}
    </div>
  `;

  setTimeout(() => {
    const cv = document.getElementById("finPizza");
    if (!cv || typeof Chart === "undefined") return;
    new Chart(cv.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: lista.map(g => g.nome),
        datasets: [{ data: lista.map(g => g.total), backgroundColor: lista.map((_, i) => cores[i % cores.length]), borderWidth: 2, borderColor: "#fff" }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: "62%",
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` R$ ${formatarNumeroBR(ctx.parsed, 2)}` } }
        }
      }
    });
  }, 50);
}

function imprimirRelatorioFinanceiro() {
  const { custos } = _finColetarCustos();
  if (!custos.length) { _toastErro("Nenhum custo no período para imprimir."); return; }
  const total = custos.reduce((s, c) => s + Number(c.valor), 0);
  const ordenados = [...custos].sort((a, b) => b.data.localeCompare(a.data));
  const periodoTxt = (_finPeriodoIni || _finPeriodoFim)
    ? `${_finPeriodoIni ? formatarData(_finPeriodoIni) : "início"} até ${_finPeriodoFim ? formatarData(_finPeriodoFim) : "hoje"}`
    : "Todo o período";
  const linhas = ordenados.map(c => `<tr><td>${formatarData(c.data)}</td><td>${c.viveiroNome || ""}</td><td>${c.nomeProduto || ""}</td><td style="text-align:right">R$ ${formatarNumeroBR(Number(c.valor), 2)}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório financeiro</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#1f2937}h1{color:rgb(6,107,99);font-size:20px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:left}th{background:#f0fdf4}.total-row td{font-weight:700;border-top:2px solid rgb(6,107,99)}</style></head>
    <body><h1>Relatório financeiro</h1><p>Período: ${periodoTxt}</p>
    <table><thead><tr><th>Data</th><th>Viveiro</th><th>Descrição</th><th>Valor</th></tr></thead>
    <tbody>${linhas}<tr class="total-row"><td colspan="3">TOTAL</td><td style="text-align:right">R$ ${formatarNumeroBR(total, 2)}</td></tr></tbody></table></body></html>`;
  const janela = window.open("", "_blank");
  if (!janela) { _toastErro("Permita pop-ups para imprimir."); return; }
  janela.document.write(html);
  janela.document.close();
  janela.onload = () => janela.print();
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
        <div id="msg-encerrar-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center;font-weight:500"></div>
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

  const erroEncerrar = document.getElementById("msg-encerrar-erro");
  function mostrarErroEncerrar(msg) {
    if (erroEncerrar) { erroEncerrar.textContent = msg; erroEncerrar.style.display = "block"; }
  }
  if (erroEncerrar) erroEncerrar.style.display = "none";

  if (!dataEncerramento || !producaoFinal || !pesoFinal) {
    mostrarErroEncerrar("Preencha data de encerramento, produção final e peso médio final.");
    return;
  }

  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

  const racoes = viveiro.racoes || [];
  const despescas = viveiro.despescas || [];
  const biometrias = viveiro.biometrias || [];

  const racaoConsumida = racoes.reduce((total, item) => total + item.racao, 0);
  const despescaParcial = despescas.reduce(
    (total, item) => total + item.quantidadeKg,
    0
  );

  const producaoTotal = despescaParcial + producaoFinal;
  const fca = producaoTotal > 0 ? racaoConsumida / producaoTotal : 0;

  // Protege contra tamanho/total povoado ausentes (evita Infinity/NaN no relatório)
  const tamanhoNum = parseFloat(viveiro.tamanho);
  const produtividade = tamanhoNum > 0 ? producaoTotal / tamanhoNum : 0;

  const totalPovoado = parseFloat(String(viveiro.totalPovoado).replace(/\./g, ""));
  const quantidadeFinal = pesoFinal > 0 ? producaoTotal / (pesoFinal / 1000) : 0;
  const sobrevivencia = totalPovoado > 0 ? (quantidadeFinal / totalPovoado) * 100 : 0;

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
    if (botao) { botao.disabled = false; botao.style.opacity = ""; }
    mostrarErroEncerrar("Erro ao encerrar ciclo: " + error.message);
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

let _relImpCiclo = null;
let _relImpIndex = null;

function mostrarRelatorioCiclo(index, ciclo, origem = "historico") {
  const area = document.getElementById("area-gestao");
  _relImpCiclo = ciclo;
  _relImpIndex = index;

  const custosBloco = (() => {
    const custosCiclo = (viveiros[index]?.custos || []).filter(c =>
      ciclo.dataPovoamento && ciclo.dataEncerramento &&
      c.data >= ciclo.dataPovoamento && c.data <= ciclo.dataEncerramento
    );
    const totalProdutos = custosCiclo.filter(c => c.tipo === "produto").reduce((s, c) => s + Number(c.valor), 0);
    const totalOutros = custosCiclo.filter(c => c.tipo === "outro").reduce((s, c) => s + Number(c.valor), 0);
    const totalCustos = totalProdutos + totalOutros;
    if (totalCustos === 0) return "";
    return `
      <div class="rc-secao">
        <div class="rc-secao-titulo"><svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>Custos do ciclo</div>
        <div class="rc-lista">
          <div class="rc-lista-row"><span>Insumos</span><strong>R$ ${formatarNumeroBR(totalProdutos, 2)}</strong></div>
          <div class="rc-lista-row"><span>Outros custos</span><strong>R$ ${formatarNumeroBR(totalOutros, 2)}</strong></div>
          <div class="rc-lista-row rc-lista-total"><span>Total de custos</span><strong>R$ ${formatarNumeroBR(totalCustos, 2)}</strong></div>
        </div>
      </div>`;
  })();

  area.innerHTML = `
    <div class="relatorio-final rc-report">

      <div class="rc-header">
        <div class="rc-header-ico">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="13" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
        </div>
        <h2 class="rc-titulo">RELATÓRIO DE CICLO</h2>
        <div class="rc-marca"><span class="rc-marca-traco"></span>WA AQUA GESTÃO<span class="rc-marca-traco"></span></div>
        <div class="rc-viveiro-pill">${ciclo.nomeViveiro}</div>
      </div>

      <div class="rc-periodo">
        <div class="rc-periodo-item">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <div class="rc-periodo-txt"><small>Início do ciclo</small><strong>${formatarData(ciclo.dataPovoamento)}</strong></div>
        </div>
        <span class="rc-periodo-seta">→</span>
        <div class="rc-periodo-item">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <div class="rc-periodo-txt"><small>Fim do ciclo</small><strong>${formatarData(ciclo.dataEncerramento)}</strong></div>
        </div>
        <div class="rc-periodo-item rc-periodo-destaque">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <div class="rc-periodo-txt"><small>Duração total</small><strong>${ciclo.diasCultivo} dias</strong></div>
        </div>
      </div>

      <div class="rc-secao">
        <div class="rc-secao-titulo"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>Informações do ciclo</div>
        <div class="rc-info-grid">
          <div class="rc-info-card">
            <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <small>Data do povoamento</small><strong>${formatarData(ciclo.dataPovoamento)}</strong>
          </div>
          <div class="rc-info-card">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <small>Total de PLs</small><strong>${Number(ciclo.totalPovoado).toLocaleString("pt-BR")} PLs</strong>
          </div>
          <div class="rc-info-card">
            <svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6L5 19a1 1 0 0 0 1 1.5h12A1 1 0 0 0 19 19l-5-10V3"/></svg>
            <small>Laboratório</small><strong>${ciclo.laboratorio}</strong>
          </div>
          <div class="rc-info-card">
            <svg viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            <small>Área do viveiro</small><strong>${ciclo.tamanho} ha</strong>
          </div>
        </div>
      </div>

      <div class="rc-secao">
        <div class="rc-secao-titulo"><svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>Resultado produtivo</div>
        <div class="rc-result-grid">
          <div class="rc-result-card">
            <div class="rc-result-ico"><svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
            <strong>${formatarNumeroBR(ciclo.produtividade, 1)}</strong>
            <span class="rc-result-un">kg/ha</span>
            <small>Produtividade</small>
          </div>
          <div class="rc-result-card">
            <div class="rc-result-ico"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 7h18M6 7l-3 6a3 3 0 0 0 6 0zM18 7l-3 6a3 3 0 0 0 6 0z"/></svg></div>
            <strong>${formatarNumeroBR(ciclo.pesoFinal, 1)}</strong>
            <span class="rc-result-un">gramas</span>
            <small>Peso médio final</small>
          </div>
          <div class="rc-result-card">
            <div class="rc-result-ico"><svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
            <strong>${formatarNumeroBR(ciclo.sobrevivencia, 1)}%</strong>
            <small>Sobrevivência</small>
          </div>
        </div>
      </div>

      <div class="rc-secao">
        <div class="rc-secao-titulo"><svg viewBox="0 0 24 24"><path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2M5 2v20M16 2c-1.5 0-3 1.5-3 4s1 4 3 4v12"/></svg>Alimentação</div>
        <div class="rc-duo">
          <div class="rc-duo-item">
            <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <div class="rc-duo-txt"><small>Ração consumida</small><strong>${formatarNumeroBR(ciclo.racaoConsumida, 1)} kg</strong></div>
          </div>
          <div class="rc-duo-sep"></div>
          <div class="rc-duo-item">
            <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            <div class="rc-duo-txt"><small>FCA</small><strong>${formatarNumeroBR(ciclo.fca, 2)}</strong></div>
          </div>
        </div>
      </div>

      <div class="rc-secao">
        <div class="rc-secao-titulo"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>Despesca</div>
        <div class="rc-duo">
          <div class="rc-duo-item">
            <svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <div class="rc-duo-txt"><small>Despesca parcial</small><strong>${formatarNumeroBR(ciclo.despescaParcial, 1)} kg</strong></div>
          </div>
          <div class="rc-duo-sep"></div>
          <div class="rc-duo-item">
            <svg viewBox="0 0 24 24"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            <div class="rc-duo-txt"><small>Despesca total</small><strong>${formatarNumeroBR(ciclo.producaoFinal, 1)} kg</strong></div>
          </div>
        </div>
      </div>

      ${custosBloco}

      <div class="rc-hero">
        <div class="rc-hero-esq">
          <div class="rc-hero-ico"><svg viewBox="0 0 24 24"><path d="M3 6h18l-2 13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L3 6z"/><path d="M3 6l1-3h16l1 3"/><line x1="9" y1="11" x2="9" y2="16"/><line x1="15" y1="11" x2="15" y2="16"/></svg></div>
          <span class="rc-hero-label">Produção final do ciclo</span>
        </div>
        <span class="rc-hero-valor">${formatarNumeroBR(ciclo.producaoTotal, 1)} kg</span>
      </div>

      <div class="rc-print-box">
        <div class="rc-print-box-titulo">Relatório técnico (impressão)</div>
        <div class="campo-form" style="margin-bottom:8px">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><label>Preço de venda (R$/kg)</label></div>
          <input type="text" inputmode="decimal" id="rc-preco-kg" placeholder="Ex: 7,00" onblur="formatarMoedaBlur(this)">
        </div>
        <p class="rc-print-dica">Informe o preço para calcular receita, lucro e ROI no relatório técnico.</p>
        <button class="botao-salvar" onclick="gerarRelatorioImpressao()">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir relatório
        </button>
      </div>
      <button class="botao-voltar-form" style="margin-top:10px" onclick="${origem === 'viveiro' ? `mostrarViveiroSemCiclo(${index})` : `mostrarHistoricoCiclos()`}">← Voltar</button>

    </div>
  `;
}

function gerarRelatorioImpressao() {
  const ciclo = _relImpCiclo;
  const index = _relImpIndex;
  if (!ciclo) { _toastErro("Relatório indisponível."); return; }

  const precoKg = parseMoedaBR(document.getElementById("rc-preco-kg")?.value || "0") || 0;

  // ── Custos do ciclo (no período) ──
  const custos = (viveiros[index]?.custos || []).filter(c =>
    ciclo.dataPovoamento && ciclo.dataEncerramento &&
    c.data >= ciclo.dataPovoamento && c.data <= ciclo.dataEncerramento
  );
  const custoTotal = custos.reduce((s, c) => s + Number(c.valor), 0);

  const grupos = {};
  custos.forEach(c => {
    const chave = c.tipo === "outro" ? (c.categoria || c.nomeProduto || "Outros") : (c.categoria || "Outros");
    grupos[chave] = (grupos[chave] || 0) + Number(c.valor);
  });
  const distLista = Object.entries(grupos).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);

  // ── Indicadores ──
  const producaoTotal = Number(ciclo.producaoTotal) || 0;
  const custoPorKg = producaoTotal > 0 ? custoTotal / producaoTotal : 0;
  const receitaBruta = producaoTotal * precoKg;
  const lucroLiquido = receitaBruta - custoTotal;
  const tamanhoNum = parseFloat(ciclo.tamanho) || 0;
  const lucroPorHa = tamanhoNum > 0 ? lucroLiquido / tamanhoNum : 0;
  const lucroPorKg = producaoTotal > 0 ? lucroLiquido / producaoTotal : 0;
  const roi = custoTotal > 0 ? (lucroLiquido / custoTotal) * 100 : 0;
  const temPreco = precoKg > 0;

  // ── Séries (biometrias) ──
  const bios = [...(ciclo.biometrias || [])].sort((a, b) => a.data.localeCompare(b.data));
  const racoesSorted = [...(ciclo.racoes || [])].sort((a, b) => a.data.localeCompare(b.data));
  const popNum = ciclo.totalPovoado ? Number(String(ciclo.totalPovoado).replace(/\./g, "")) : 0;
  const diaDe = d => calcularDiasCultivo(ciclo.dataPovoamento, d);
  const racaoAcumAte = dataStr => racoesSorted.filter(r => r.data <= dataStr).reduce((s, r) => s + r.racao, 0);

  // Como é relatório FINAL, sabemos a sobrevivência real: reconstruímos os
  // sobreviventes decrescendo da população inicial até a quantidade final.
  const diasArr = bios.map(b => diaDe(b.data));
  const lastDay = diasArr.length ? (diasArr[diasArr.length - 1] || 1) : 1;
  const survFinal = Number(ciclo.pesoFinal) > 0 ? producaoTotal / (Number(ciclo.pesoFinal) / 1000)
    : (popNum * (Number(ciclo.sobrevivencia) || 100) / 100);

  const serieDias = [], seriePeso = [], serieCresc = [], serieBiomassa = [], serieFca = [], serieRacaoAcum = [], serieObs = [], serieDatas = [];
  bios.forEach((b, i) => {
    const racAcum = racaoAcumAte(b.data);
    const dia = diasArr[i];
    const frac = lastDay > 0 ? Math.min(1, Math.max(0, dia / lastDay)) : 1;
    let surv = popNum - (popNum - survFinal) * frac; // sobreviventes estimados nesse dia
    if (surv < 0) surv = 0;
    let biomassa = surv * b.gramatura / 1000;
    serieDatas.push(formatarData(b.data));
    serieDias.push(dia);
    seriePeso.push(Number(b.gramatura));
    serieCresc.push(i > 0 ? Number((b.gramatura - bios[i - 1].gramatura).toFixed(2)) : null);
    serieBiomassa.push(Number(biomassa.toFixed(1)));
    serieFca.push(Number((biomassa > 0 ? racAcum / biomassa : 0).toFixed(2)));
    serieRacaoAcum.push(Number(racAcum.toFixed(1)));
    serieObs.push(i === 0 ? "Povoamento" : (i === bios.length - 1 ? "Final do ciclo" : "-"));
  });
  if (serieBiomassa.length && producaoTotal > 0) serieBiomassa[serieBiomassa.length - 1] = producaoTotal;

  // ── Despescas ──
  const despescas = [...(ciclo.despescas || [])].sort((a, b) => a.data.localeCompare(b.data));
  const linhasDespesca = despescas.map(d => {
    const valor = (Number(d.quantidadeKg) || 0) * precoKg;
    return `<tr><td>${formatarData(d.data)}</td><td>${d.tipo || "Parcial"}</td><td class="num">${formatarNumeroBR(d.quantidadeKg, 1)}</td><td class="num">${d.pesoMedio ? formatarNumeroBR(d.pesoMedio, 1) : "-"}</td><td class="num">${temPreco ? "R$ " + formatarNumeroBR(valor, 2) : "-"}</td></tr>`;
  }).join("");
  const totDespQtd = despescas.reduce((s, d) => s + (Number(d.quantidadeKg) || 0), 0);

  const fmt = (v, d = 2) => formatarNumeroBR(v, d);
  const rs = (v) => temPreco ? "R$ " + formatarNumeroBR(v, 2) : "—";
  const cores = ["#0b6b63", "#2563eb", "#f59e0b", "#10b981", "#a16207", "#9ca3af", "#ec4899", "#84cc16", "#06b6d4"];

  const dados = {
    peso: { labels: serieDias, data: seriePeso },
    racao: { labels: serieDias, data: serieRacaoAcum },
    fca: { labels: serieDias, data: serieFca },
    biomassa: { labels: serieDias, data: serieBiomassa },
    dist: { labels: distLista.map(d => d.nome), data: distLista.map(d => d.total), cores: distLista.map((_, i) => cores[i % cores.length]) },
  };

  const hoje = new Date();
  const dataEmissao = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;

  const indicadores = [
    { lbl: "Peso médio final", val: fmt(ciclo.pesoFinal, 1) + " g" },
    { lbl: "Biomassa produzida", val: fmt(producaoTotal, 1) + " kg" },
    { lbl: "Produtividade", val: fmt(ciclo.produtividade, 1) + " kg/ha" },
    { lbl: "FCA final", val: fmt(ciclo.fca, 2) },
    { lbl: "Sobrevivência", val: fmt(ciclo.sobrevivencia, 1) + " %" },
    { lbl: "Ração consumida", val: fmt(ciclo.racaoConsumida, 1) + " kg" },
    { lbl: "Custo total", val: "R$ " + fmt(custoTotal, 2) },
    { lbl: "Custo por kg", val: "R$ " + fmt(custoPorKg, 2) },
    { lbl: "Receita bruta", val: rs(receitaBruta) },
    { lbl: "Lucro líquido", val: rs(lucroLiquido) },
  ];

  const legendaDist = distLista.map((d, i) => `
    <div class="leg-item"><span class="leg-dot" style="background:${cores[i % cores.length]}"></span>
      <span class="leg-nome">${d.nome}<br><b>R$ ${fmt(d.total, 2)}</b></span>
      <span class="leg-pct">${custoTotal > 0 ? fmt(d.total / custoTotal * 100, 1) : "0"}%</span></div>`).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório Final do Ciclo — ${ciclo.nomeViveiro}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 0; padding: 16px; font-size: 12px; }
  .doc { max-width: 100%; margin: 0 auto; }
  .sec, .duas > div { page-break-inside: avoid; }
  table, .chart-box, .rosca-wrap, .cel { page-break-inside: avoid; }
  .cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; border-bottom: 3px solid #0b6b63; padding-bottom: 12px; margin-bottom: 16px; }
  .cab-marca { display: flex; align-items: center; gap: 10px; }
  .cab-logo { width: 46px; height: 46px; border-radius: 10px; background: #0b6b63; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; text-align: center; line-height: 1.1; }
  .cab-marca b { font-size: 15px; color: #0b6b63; } .cab-marca small { color: #6b7280; font-size: 9px; letter-spacing: .05em; }
  .cab-centro { text-align: center; flex: 1; }
  .cab-centro h1 { margin: 0; font-size: 22px; color: #0b6b63; letter-spacing: .5px; }
  .cab-centro .viv { color: #6b7280; font-weight: 700; font-size: 12px; letter-spacing: .15em; }
  .cab-periodo { background: #0b6b63; color: #fff; border-radius: 10px; padding: 10px 14px; font-size: 11px; min-width: 180px; }
  .cab-periodo small { opacity: .8; font-size: 9px; letter-spacing: .05em; } .cab-periodo b { display: block; font-size: 12px; margin-top: 2px; }
  h2.sec { font-size: 13px; color: #0b6b63; margin: 18px 0 10px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb; }
  .grid { display: grid; gap: 8px; }
  .info6 { grid-template-columns: repeat(3, 1fr); }
  .ind5 { grid-template-columns: repeat(3, 1fr); }
  .cel { background: #f8fafc; border: 1px solid #eef0f2; border-radius: 8px; padding: 9px 10px; }
  .cel small { color: #6b7280; font-size: 9px; text-transform: uppercase; letter-spacing: .03em; display: block; }
  .cel b { font-size: 14px; color: #111827; }
  .duas { display: block; }
  .duas > div + div { margin-top: 4px; }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .chart-box { border: 1px solid #eef0f2; border-radius: 8px; padding: 8px; }
  .chart-box h4 { margin: 0 0 6px; font-size: 10.5px; color: #374151; text-align: center; font-weight: 700; }
  .chart-box canvas { width: 100% !important; height: 130px !important; }
  .rosca-wrap { display: flex; flex-direction: column; align-items: center; }
  .rosca-canvas { width: 180px; height: 180px; position: relative; }
  .rosca-centro { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; }
  .rosca-centro small { color: #6b7280; font-size: 9px; } .rosca-centro b { display: block; font-size: 12px; }
  .leg { width: 100%; margin-top: 8px; }
  .leg-item { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 10.5px; }
  .leg-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; } .leg-nome { flex: 1; } .leg-pct { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #eef0f2; text-align: left; font-size: 10.5px; }
  th { background: #f0fdf4; color: #166534; font-size: 9.5px; text-transform: uppercase; }
  td.num, th.num { text-align: right; }
  .fin-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eef0f2; font-size: 11.5px; }
  .fin-row.destaque { background: #f0fdf4; font-weight: 800; padding: 8px 8px; border-radius: 6px; border: none; color: #0b6b63; }
  .fin-row b { font-weight: 800; }
  .obs-box { border: 1px dashed #cbd5e1; border-radius: 8px; padding: 12px; min-height: 90px; font-size: 11px; color: #374151; white-space: pre-wrap; }
  .assin { text-align: center; margin-top: 28px; } .assin .linha { border-top: 1px solid #9ca3af; width: 220px; margin: 0 auto 4px; } .assin small { color: #6b7280; }
  .rodape { display: flex; justify-content: space-between; align-items: center; margin-top: 22px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9.5px; color: #9ca3af; }
  .btn-print { background: #0b6b63; color: #fff; border: none; border-radius: 8px; padding: 9px 16px; font-size: 12px; font-weight: 700; cursor: pointer; }
  @media print { .no-print { display: none !important; } body { padding: 0; } }
</style></head>
<body><div class="doc">

  <div class="cab">
    <div class="cab-marca"><div class="cab-logo">WA<br>AQUA</div><div><b>WA Aqua Gestão</b><br><small>TECNOLOGIA PARA AQUICULTURA</small></div></div>
    <div class="cab-centro"><h1>RELATÓRIO FINAL DO CICLO</h1><span class="viv">${(ciclo.nomeViveiro || "").toUpperCase()}</span></div>
    <div class="cab-periodo"><small>PERÍODO DO CICLO</small><b>${formatarData(ciclo.dataPovoamento)} a ${formatarData(ciclo.dataEncerramento)}</b>${ciclo.diasCultivo} dias de cultivo</div>
  </div>

  <h2 class="sec">1. Informações gerais</h2>
  <div class="grid info6">
    <div class="cel"><small>Data do povoamento</small><b>${formatarData(ciclo.dataPovoamento)}</b></div>
    <div class="cel"><small>Total de PLs</small><b>${Number(String(ciclo.totalPovoado).replace(/\./g,"")||0).toLocaleString("pt-BR")}</b></div>
    <div class="cel"><small>Laboratório</small><b>${ciclo.laboratorio || "-"}</b></div>
    <div class="cel"><small>Área do viveiro</small><b>${fmt(tamanhoNum, 1)} ha</b></div>
    <div class="cel"><small>Fim do ciclo</small><b>${formatarData(ciclo.dataEncerramento)}</b></div>
    <div class="cel"><small>Dias de cultivo</small><b>${ciclo.diasCultivo} dias</b></div>
  </div>

  <h2 class="sec">2. Indicadores finais do ciclo</h2>
  <div class="grid ind5">${indicadores.map(i => `<div class="cel"><small>${i.lbl}</small><b>${i.val}</b></div>`).join("")}</div>

  <div class="duas" style="margin-top:18px">
    <div>
      <h2 class="sec" style="margin-top:0">3. Evolução do cultivo</h2>
      <div class="charts">
        <div class="chart-box"><h4>Evolução do peso médio (g)</h4><canvas id="cPeso"></canvas></div>
        <div class="chart-box"><h4>Consumo acumulado de ração (kg)</h4><canvas id="cRacao"></canvas></div>
        <div class="chart-box"><h4>FCA ao longo do cultivo</h4><canvas id="cFca"></canvas></div>
        <div class="chart-box"><h4>Biomassa estimada (kg)</h4><canvas id="cBio"></canvas></div>
      </div>
    </div>
    <div>
      <h2 class="sec" style="margin-top:0">4. Distribuição dos custos</h2>
      ${distLista.length ? `<div class="rosca-wrap"><div class="rosca-canvas"><canvas id="cDist"></canvas><div class="rosca-centro"><small>TOTAL</small><b>R$ ${fmt(custoTotal,2)}</b></div></div><div class="leg">${legendaDist}</div></div>` : `<p style="color:#9ca3af;font-size:11px">Nenhum custo lançado neste ciclo.</p>`}

      <h2 class="sec">5. Resumo financeiro</h2>
      <div class="fin-row"><span>Receita bruta</span><b>${rs(receitaBruta)}</b></div>
      <div class="fin-row"><span>(-) Custo total</span><b>R$ ${fmt(custoTotal,2)}</b></div>
      <div class="fin-row destaque"><span>Lucro líquido</span><b>${rs(lucroLiquido)}</b></div>
      <div class="fin-row"><span>Lucro por hectare</span><b>${rs(lucroPorHa)}</b></div>
      <div class="fin-row"><span>Lucro por kg produzido</span><b>${rs(lucroPorKg)}</b></div>
      <div class="fin-row"><span>ROI (retorno sobre investimento)</span><b>${temPreco ? fmt(roi,1) + "%" : "—"}</b></div>
    </div>
  </div>

  <h2 class="sec">6. Biometrias realizadas</h2>
  <table><thead><tr><th>Data</th><th class="num">Dias</th><th class="num">Peso médio (g)</th><th class="num">Crescimento (g)</th><th class="num">Biomassa (kg)</th><th>Observações</th></tr></thead>
  <tbody>${bios.map((b,i)=>`<tr><td>${serieDatas[i]}</td><td class="num">${serieDias[i]}</td><td class="num">${fmt(seriePeso[i],1)}</td><td class="num">${serieCresc[i]===null?"-":fmt(serieCresc[i],1)}</td><td class="num">${fmt(serieBiomassa[i],1)}</td><td>${serieObs[i]}</td></tr>`).join("") || `<tr><td colspan="6" style="text-align:center;color:#9ca3af">Sem biometrias.</td></tr>`}</tbody></table>

  <h2 class="sec">7. Despescas realizadas</h2>
  <table><thead><tr><th>Data</th><th>Tipo</th><th class="num">Quantidade (kg)</th><th class="num">Peso médio (g)</th><th class="num">Valor (R$)</th></tr></thead>
  <tbody>${linhasDespesca || `<tr><td colspan="5" style="text-align:center;color:#9ca3af">Sem despescas.</td></tr>`}
  <tr style="font-weight:800;background:#f8fafc"><td colspan="2">TOTAL</td><td class="num">${fmt(totDespQtd,1)}</td><td></td><td class="num">${temPreco ? "R$ "+fmt(totDespQtd*precoKg,2) : "-"}</td></tr></tbody></table>

  <h2 class="sec">8. Observações</h2>
  <div class="obs-box">${(ciclo.observacoes || "").trim() || "—"}</div>
  <div class="assin"><div class="linha"></div><small>Responsável técnico</small><br><small>${dataEmissao}</small></div>

  <div class="rodape">
    <span>Relatório gerado automaticamente pelo WA Aqua Gestão. As informações baseiam-se nos dados registrados no sistema.</span>
    <span>Emissão: ${dataEmissao}</span>
  </div>

  <div class="no-print" style="text-align:center;margin-top:18px"><button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button></div>
</div>

<script>
  var D = ${JSON.stringify(dados)};
  function linha(id, dados, cor, fill) {
    new Chart(document.getElementById(id), { type: "line",
      data: { labels: dados.labels, datasets: [{ data: dados.data, borderColor: cor, backgroundColor: fill || "transparent", fill: !!fill, tension: .3, pointRadius: 3, pointBackgroundColor: cor, borderWidth: 2 }] },
      options: { responsive: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 8 } } }, y: { beginAtZero: true, ticks: { font: { size: 8 } } } } } });
  }
  function render() {
    if (typeof Chart === "undefined") { setTimeout(render, 100); return; }
    linha("cPeso", D.peso, "#16a34a", "rgba(22,163,74,.08)");
    new Chart(document.getElementById("cRacao"), { type: "bar", data: { labels: D.racao.labels, datasets: [{ data: D.racao.data, backgroundColor: "#0b6b63" }] }, options: { responsive: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 8 } } }, y: { beginAtZero: true, ticks: { font: { size: 8 } } } } } });
    linha("cFca", D.fca, "#2563eb");
    linha("cBio", D.biomassa, "#f59e0b", "rgba(245,158,11,.08)");
    if (document.getElementById("cDist") && D.dist.data.length) {
      new Chart(document.getElementById("cDist"), { type: "doughnut", data: { labels: D.dist.labels, datasets: [{ data: D.dist.data, backgroundColor: D.dist.cores, borderColor: "#fff", borderWidth: 2 }] }, options: { responsive: false, cutout: "62%", plugins: { legend: { display: false } } } });
    }
    setTimeout(function(){ try { window.print(); } catch(e){} }, 600);
  }
  window.onload = render;
<\/script>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) { _toastErro("Permita pop-ups para gerar o relatório."); return; }
  win.document.write(html);
  win.document.close();
}

// ═══════════════════════════════════════════════════════════════════════════
//  MANEJO AUTOMÁTICO (protocolos por viveiro)
// ═══════════════════════════════════════════════════════════════════════════

const _MA_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function _maYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function _maParse(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function _maAddDias(s, n) {
  const d = _maParse(s); d.setDate(d.getDate() + n); return _maYmd(d);
}

async function salvarProtocolos(index) {
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return false;
  const { error } = await supabaseClient.from("viveiros")
    .update({ protocolos: viveiros[index].protocolos || [] })
    .eq("id", viveiros[index].id).eq("user_id", usuario.id);
  if (error) { console.log(error); _toastErro("Erro ao salvar (rode o SQL da coluna protocolos): " + error.message); return false; }
  return true;
}

async function _lancarCustoAuto(index, produto, quantidadeG, data, obs) {
  if (!quantidadeG || quantidadeG <= 0) return false;
  // Nunca repete o mesmo lançamento automático (mesmo produto + data)
  const jaTem = (viveiros[index].custos || []).some(c =>
    c.data === data && c.produtoId === produto.id && (c.observacao || "").startsWith("Automático"));
  if (jaTem) return false;
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return false;
  const valor = (produto.custoPorGrama || 0) * quantidadeG;
  const { data: salvo, error } = await supabaseClient.from("custos").insert([{
    user_id: usuario.id, viveiro_id: viveiros[index].id, tipo: "produto",
    produto_id: produto.id, nome_produto: produto.nome, quantidade_g: quantidadeG,
    valor, categoria: produto.categoria, data, observacao: obs || "Automático",
  }]).select();
  if (error) { console.log(error); return false; }
  if (!viveiros[index].custos) viveiros[index].custos = [];
  viveiros[index].custos.push({ id: salvo[0].id, tipo: "produto", produtoId: produto.id, nomeProduto: produto.nome, quantidadeG, valor, categoria: produto.categoria, data, observacao: obs || "Automático" });
  return true;
}

// Dispara ao lançar ração (tipo "racao") — dose por kg de ração
async function _aplicarProtocolosRacao(index, racaoKg, data) {
  const prots = (viveiros[index].protocolos || []).filter(p => p.ativo && p.tipo === "racao");
  const wd = _maParse(data).getDay();
  for (const p of prots) {
    if (p.inicio && data < p.inicio) continue;
    if (Array.isArray(p.dias) && p.dias.length > 0 && !p.dias.includes(wd)) continue;
    const produto = produtos.find(pr => pr.id === p.produtoId);
    if (!produto) continue;
    const quantidadeG = (Number(p.dosePorKgG) || 0) * racaoKg;
    await _lancarCustoAuto(index, produto, quantidadeG, data, "Automático (ração)");
  }
}

// Aplica um protocolo de ração aos lançamentos de ração já existentes
async function _aplicarProtocoloRacaoRetroativo(index, prot) {
  const produto = produtos.find(pr => pr.id === prot.produtoId);
  if (!produto) return;
  const v = viveiros[index];
  const minData = prot.inicio || v.dataPovoamento || "0000-00-00";
  const racoes = (v.racoes || []).filter(r => r.data >= minData).sort((a, b) => a.data.localeCompare(b.data));
  for (const r of racoes) {
    const wd = _maParse(r.data).getDay();
    if (Array.isArray(prot.dias) && prot.dias.length > 0 && !prot.dias.includes(wd)) continue;
    const jaTem = (v.custos || []).some(c => c.data === r.data && c.produtoId === produto.id && (c.observacao || "").startsWith("Automático"));
    if (jaTem) continue;
    const quantidadeG = (Number(prot.dosePorKgG) || 0) * r.racao;
    await _lancarCustoAuto(index, produto, quantidadeG, r.data, "Automático (ração)");
  }
}

// Põe em dia os protocolos semanais ao abrir o app
async function aplicarProtocolosSemanais() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const hojeStr = _maYmd(hoje);
  const aSalvar = [];
  for (let index = 0; index < viveiros.length; index++) {
    const v = viveiros[index];
    if (!v.dataPovoamento) continue;
    const prots = (v.protocolos || []).filter(p => p.ativo && p.tipo === "semanal" && Array.isArray(p.dias) && p.dias.length);
    let alterou = false;
    for (const p of prots) {
      const produto = produtos.find(pr => pr.id === p.produtoId);
      if (!produto) continue;
      let inicio = p.ultimoLancamento ? _maAddDias(p.ultimoLancamento, 1) : v.dataPovoamento;
      if (inicio < v.dataPovoamento) inicio = v.dataPovoamento;
      if (p.inicio && inicio < p.inicio) inicio = p.inicio;
      let cur = _maParse(inicio);
      const fim = _maParse(hojeStr);
      let guard = 0;
      while (cur <= fim && guard < 400) {
        guard++;
        const ds = _maYmd(cur);
        if (p.dias.includes(cur.getDay())) {
          const jaTem = (v.custos || []).some(c => c.data === ds && c.produtoId === produto.id && (c.observacao || "").startsWith("Automático"));
          if (!jaTem) await _lancarCustoAuto(index, produto, Number(p.quantidadeG) || 0, ds, "Automático (semanal)");
        }
        cur.setDate(cur.getDate() + 1);
      }
      if (p.ultimoLancamento !== hojeStr) { p.ultimoLancamento = hojeStr; alterou = true; }
    }
    if (alterou) aSalvar.push(index);
  }
  for (const idx of aSalvar) await salvarProtocolos(idx);
}

function _maResumoProtocolo(p) {
  const dias = (p.dias || []).map(d => _MA_DIAS[d]).join(", ");
  const desde = p.inicio ? ` · desde ${formatarData(p.inicio)}` : "";
  if (p.tipo === "racao") {
    return `${formatarNumeroBR(p.dosePorKgG, 2)} g por kg de ração · ${dias || "todos os dias"}${desde}`;
  }
  return `${formatarNumeroBR(p.quantidadeG, 0)} g · ${dias || "—"}${desde}`;
}

function abrirManejoAutomatico(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const prots = viveiro.protocolos || [];
  area.innerHTML = `
    <h3 class="titulo-secao">Manejo automático — ${abreviarViveiro(viveiro.nome)}</h3>
    <div class="cfg-wrap">
      <p class="cfg-secao-desc">Produtos lançados automaticamente neste viveiro. Os lançamentos viram custos e podem ser editados/excluídos no histórico de custos.</p>
      ${produtos.length === 0 ? `<div class="viveiro-sem-ciclo-msg"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>Cadastre um produto em Insumos antes de criar um protocolo.</span></div>` : ""}
      <div class="ma-lista">
        ${prots.length === 0 ? `<p class="ma-vazio">Nenhum protocolo configurado.</p>` : prots.map(p => {
          const prod = produtos.find(pr => pr.id === p.produtoId);
          return `<div class="ma-item ${p.ativo ? "" : "ma-inativo"}">
            <div class="ma-item-info">
              <span class="ma-item-nome">${prod ? prod.nome : (p.nomeProduto || "Produto removido")}</span>
              <span class="ma-item-regra">${p.tipo === "racao" ? "Atrelado à ração" : "Programado semanal"} · ${_maResumoProtocolo(p)}</span>
            </div>
            <div class="ma-item-acoes">
              <button class="ma-toggle ${p.ativo ? "on" : ""}" onclick="toggleProtocolo(${index},'${p.id}')" title="${p.ativo ? "Pausar" : "Ativar"}"><span></span></button>
              <button class="ma-btn-ic" onclick="abrirFormProtocolo(${index},'${p.id}')">✏️</button>
              <button class="ma-btn-ic" onclick="excluirProtocolo(${index},'${p.id}')">🗑️</button>
            </div>
          </div>`;
        }).join("")}
      </div>
      ${produtos.length > 0 ? `<button class="botao-salvar" style="margin-top:12px" onclick="abrirFormProtocolo(${index})"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar produto automático</button>` : ""}
      <button class="botao-voltar-form" style="margin-top:10px" onclick="abrirViveiro(${index})">← Voltar</button>
    </div>
  `;
}

async function toggleProtocolo(index, protId) {
  const p = (viveiros[index].protocolos || []).find(x => x.id === protId);
  if (!p) return;
  p.ativo = !p.ativo;
  await salvarProtocolos(index);
  abrirManejoAutomatico(index);
}

async function excluirProtocolo(index, protId) {
  viveiros[index].protocolos = (viveiros[index].protocolos || []).filter(x => x.id !== protId);
  await salvarProtocolos(index);
  abrirManejoAutomatico(index);
}

function abrirFormProtocolo(index, protId) {
  const viveiro = viveiros[index];
  const p = protId ? (viveiro.protocolos || []).find(x => x.id === protId) : null;
  const tipo = p ? p.tipo : "racao";
  const diasSel = p && p.dias ? p.dias : [];
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <h3 class="titulo-secao">${p ? "Editar protocolo" : "Novo protocolo"}</h3>
    <div class="cfg-wrap">
      <div class="campo-form">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><label>Produto</label></div>
        <select id="protProduto">
          ${produtos.map(pr => `<option value="${pr.id}" ${p && p.produtoId === pr.id ? "selected" : ""}>${pr.nome} (${pr.categoria})</option>`).join("")}
        </select>
      </div>
      <div class="campo-form">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg><label>Tipo de lançamento</label></div>
        <select id="protTipo" onchange="_protToggleTipo()">
          <option value="racao" ${tipo === "racao" ? "selected" : ""}>Atrelado à ração (por kg)</option>
          <option value="semanal" ${tipo === "semanal" ? "selected" : ""}>Programado (dias da semana)</option>
        </select>
      </div>

      <div id="prot-racao" style="display:${tipo === "racao" ? "block" : "none"}">
        <div class="campo-form">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M3 11h18M5 11a7 7 0 0 0 14 0"/></svg><label>Dose por kg de ração (g)</label></div>
          <input type="number" inputmode="decimal" id="protDosePorKg" step="any" placeholder="Ex: 5" value="${p && p.tipo === "racao" ? p.dosePorKgG : ""}">
        </div>
        <p class="rc-print-dica">Ex.: 5 g de produto para cada kg de ração lançada.</p>
      </div>

      <div id="prot-semanal" style="display:${tipo === "semanal" ? "block" : "none"}">
        <div class="campo-form">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><label>Quantidade por aplicação (g)</label></div>
          <input type="number" inputmode="decimal" id="protQtd" step="any" placeholder="Ex: 250" value="${p && p.tipo === "semanal" ? p.quantidadeG : ""}">
        </div>
      </div>

      <div class="campo-label" style="margin-bottom:6px"><label>Dias da semana</label></div>
      <div class="ma-dias">
        ${_MA_DIAS.map((d, i) => `<button type="button" class="ma-dia ${diasSel.includes(i) ? "sel" : ""}" data-dia="${i}" onclick="this.classList.toggle('sel')">${d}</button>`).join("")}
      </div>
      <p class="rc-print-dica" id="prot-dias-dica">Atrelado à ração: deixe vazio para aplicar sempre que lançar ração. Programado: selecione os dias.</p>

      <div class="campo-form" style="margin-top:12px">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><label>Aplicar a partir de (opcional)</label></div>
        <input type="date" id="protInicio" value="${p && p.inicio ? p.inicio : ""}">
      </div>
      <p class="rc-print-dica">Deixe vazio para valer desde o início do cultivo.</p>

      <label class="ma-check"><input type="checkbox" id="protRetroativo"> Aplicar aos dias anteriores (lança o que já passou)</label>

      <div id="msg-prot-erro" style="display:none;color:#ef4444;font-size:13px;margin:8px 0;text-align:center;font-weight:500"></div>
      <button class="botao-salvar" style="margin-top:12px" onclick="salvarProtocolo(${index}, ${protId ? `'${protId}'` : "null"})">Salvar protocolo</button>
      <button class="botao-voltar-form" style="margin-top:10px" onclick="abrirManejoAutomatico(${index})">← Voltar</button>
    </div>
  `;
}

function _protToggleTipo() {
  const tipo = document.getElementById("protTipo").value;
  document.getElementById("prot-racao").style.display = tipo === "racao" ? "block" : "none";
  document.getElementById("prot-semanal").style.display = tipo === "semanal" ? "block" : "none";
}

async function salvarProtocolo(index, protId) {
  const msg = document.getElementById("msg-prot-erro");
  const erro = t => { if (msg) { msg.textContent = t; msg.style.display = "block"; } };
  if (msg) msg.style.display = "none";

  const produtoId = document.getElementById("protProduto").value;
  const produto = produtos.find(pr => pr.id === produtoId);
  if (!produto) { erro("Escolha um produto."); return; }
  const tipo = document.getElementById("protTipo").value;
  const retro = !!document.getElementById("protRetroativo")?.checked;
  const hojeStr = _maYmd(new Date());

  const prot = { id: protId || ("p" + Date.now()), produtoId, nomeProduto: produto.nome, tipo, ativo: true, ultimoLancamento: null };
  if (protId) {
    const antigo = (viveiros[index].protocolos || []).find(x => x.id === protId);
    if (antigo) { prot.ativo = antigo.ativo; prot.ultimoLancamento = antigo.ultimoLancamento; }
  }

  prot.inicio = document.getElementById("protInicio").value || null;
  const dias = [...document.querySelectorAll(".ma-dia.sel")].map(b => Number(b.dataset.dia));
  if (tipo === "racao") {
    const dose = parseFloat(document.getElementById("protDosePorKg").value);
    if (!dose || dose <= 0) { erro("Informe a dose por kg de ração."); return; }
    prot.dosePorKgG = dose;
    prot.dias = dias; // vazio = todo dia que lançar ração
  } else {
    const qtd = parseFloat(document.getElementById("protQtd").value);
    if (!qtd || qtd <= 0) { erro("Informe a quantidade por aplicação."); return; }
    if (dias.length === 0) { erro("Selecione ao menos um dia da semana."); return; }
    prot.quantidadeG = qtd;
    prot.dias = dias;
    // Retroativo: backfill desde o início; senão, começa de hoje em diante
    prot.ultimoLancamento = retro ? null : _maAddDias(hojeStr, -1);
  }

  if (!viveiros[index].protocolos) viveiros[index].protocolos = [];
  if (protId) {
    const i = viveiros[index].protocolos.findIndex(x => x.id === protId);
    if (i >= 0) viveiros[index].protocolos[i] = prot; else viveiros[index].protocolos.push(prot);
  } else {
    viveiros[index].protocolos.push(prot);
  }
  const ok = await salvarProtocolos(index);
  if (!ok) return;
  // Feedback imediato + volta pra lista
  _toastSucesso("Manejo salvo!");
  abrirManejoAutomatico(index);
  // Aplica lançamentos (pode envolver vários custos) sem travar o retorno
  if (tipo === "semanal") {
    await aplicarProtocolosSemanais();
    abrirManejoAutomatico(index);
  } else if (retro) {
    await _aplicarProtocoloRacaoRetroativo(index, prot);
  }
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
            <input type="number" id="pesoKgProduto" placeholder="Ex: 25" oninput="calcularPreviaKg()">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Valor pago por saco</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="valorPagoProduto" placeholder="Ex: 85,00" oninput="calcularPreviaKg()" onblur="formatarMoedaBlur(this); calcularPreviaKg()">
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
  const erroProd = document.getElementById("erro-produto");

  if (!nome || !pesoKg || !valorPago) {
    if (erroProd) { erroProd.textContent = "Preencha todos os campos."; erroProd.style.display = "block"; }
    return;
  }
  if (erroProd) erroProd.style.display = "none";

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
  if (error) { _toastErro("Erro ao excluir: " + error.message); return; }
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
        <div id="erro-edit-produto" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;font-size:13px;color:#dc2626;margin-bottom:4px"></div>
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
  const erroEditProd = document.getElementById("erro-edit-produto");
  function _erroEditProd(msg) { if (erroEditProd) { erroEditProd.textContent = msg; erroEditProd.style.display = "block"; } }
  if (erroEditProd) erroEditProd.style.display = "none";

  if (!nome || !pesoKg || !valorPago) { _erroEditProd("Preencha todos os campos."); return; }

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

  if (error) { _erroEditProd("Erro ao salvar: " + error.message); return; }

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
            <div class="unidade-toggle">
              <button type="button" class="unidade-btn ativo" id="btnUnidadeG" onclick="selecionarUnidade('g')">g</button>
              <button type="button" class="unidade-btn" id="btnUnidadeKg" onclick="selecionarUnidade('kg')">kg</button>
            </div>
          </div>
          <input type="number" inputmode="decimal" id="qtdCustoProduto" placeholder="Ex: 300" min="0" step="any" oninput="atualizarPreviaCusto()">
        </div>
        <div id="previa-custo-produto" class="custo-por-grama-preview" style="display:none">
          Valor calculado: <strong id="previa-custo-valor">—</strong>
        </div>
        <div id="msg-custo-produto-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center;font-weight:500"></div>
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

let _unidadeCusto = "g";

function selecionarUnidade(u) {
  _unidadeCusto = u;
  document.getElementById("btnUnidadeG")?.classList.toggle("ativo", u === "g");
  document.getElementById("btnUnidadeKg")?.classList.toggle("ativo", u === "kg");
  atualizarPreviaCusto();
}

function atualizarPreviaCusto() {
  const prodIndex = document.getElementById("selectProduto")?.value;
  const qtdRaw = parseFloat(document.getElementById("qtdCustoProduto")?.value);
  const div = document.getElementById("previa-custo-produto");
  const el = document.getElementById("previa-custo-valor");
  if (prodIndex !== "" && prodIndex !== undefined && !isNaN(qtdRaw) && qtdRaw > 0) {
    const prod = produtos[prodIndex];
    if (prod) {
      const qtdG = _unidadeCusto === "kg" ? qtdRaw * 1000 : qtdRaw;
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
  const qtdRaw = parseFloat(document.getElementById("qtdCustoProduto").value);
  const erroCustoProd = document.getElementById("msg-custo-produto-erro");
  function _erroCustoProd(msg) { if (erroCustoProd) { erroCustoProd.textContent = msg; erroCustoProd.style.display = "block"; } }
  if (erroCustoProd) erroCustoProd.style.display = "none";

  if (!data || prodIndex === "" || isNaN(qtdRaw) || qtdRaw <= 0) { _erroCustoProd("Preencha todos os campos."); return; }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const prod = produtos[prodIndex];
  const quantidadeG = _unidadeCusto === "kg" ? qtdRaw * 1000 : qtdRaw;
  const valor = prod.custoPorGrama * quantidadeG;

  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

  const { data: salvo, error } = await supabaseClient
    .from("custos")
    .insert([{ user_id: usuario.id, viveiro_id: viveiros[index].id, tipo: "produto", produto_id: prod.id, nome_produto: prod.nome, quantidade_g: quantidadeG, valor, categoria: prod.categoria, data }])
    .select();

  if (error) {
    if (botao) { botao.disabled = false; botao.style.opacity = ""; }
    _erroCustoProd("Erro ao salvar: " + error.message);
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
        <div id="msg-outro-custo-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center;font-weight:500"></div>
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
  const erroOutro = document.getElementById("msg-outro-custo-erro");
  function _erroOutro(msg) { if (erroOutro) { erroOutro.textContent = msg; erroOutro.style.display = "block"; } }
  if (erroOutro) erroOutro.style.display = "none";

  if (!descricao) { _erroOutro("Digite o nome do custo."); return; }
  const categoria = descricao;
  const valor = parseMoedaBR(document.getElementById("valorOutroCusto").value);

  if (!data || isNaN(valor) || valor <= 0) { _erroOutro("Preencha todos os campos."); return; }

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
    _erroOutro("Erro ao salvar: " + error.message);
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

function _fmtQtdCusto(g) {
  if (!g || g <= 0) return "";
  if (g >= 1000) {
    const kg = g / 1000;
    return formatarNumeroBR(kg, Number.isInteger(kg) ? 0 : 2) + " kg";
  }
  return formatarNumeroBR(g, 0) + " g";
}

function _chaveCusto(c) {
  return c.produtoId ? ("id:" + c.produtoId) : ("nome:" + (c.nomeProduto || c.categoria || "Outros"));
}

function renderizarHistoricoCustos(index, elementoId, direto) {
  const viveiro = viveiros[index];
  const resultado = document.getElementById(elementoId);
  const custos = viveiro.custos || [];
  const totalCustos = custos.reduce((s, c) => s + Number(c.valor), 0);

  // Agrupa por produto/nome — soma quantidade e valor (sem datas)
  const grupos = {};
  custos.forEach(c => {
    const chave = _chaveCusto(c);
    if (!grupos[chave]) grupos[chave] = { chave, nome: c.nomeProduto || c.categoria || "Custo", quantidadeG: 0, valor: 0 };
    grupos[chave].valor += Number(c.valor) || 0;
    if (c.quantidadeG) grupos[chave].quantidadeG += Number(c.quantidadeG);
  });
  const lista = Object.values(grupos).sort((a, b) => b.valor - a.valor);

  const dolarIco = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="7" x2="12" y2="17"/><path d="M14.5 9.5a2 2 0 0 0-2-1.5h-1a1.8 1.8 0 0 0 0 3.6h1a1.8 1.8 0 0 1 0 3.6h-1.2a2 2 0 0 1-2-1.5"/></svg>`;
  resultado.innerHTML = `
    <h3 class="custo-titulo">Custos — ${abreviarViveiro(viveiro.nome)}</h3>
    ${custos.length > 0 ? `<button class="custo-imprimir" onclick="imprimirCustos(${index})"><svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir</button>` : ""}
    <div class="custo-grupo-lista">
      ${lista.length === 0
        ? `<p class="sobrevivencia-texto">Nenhum custo lançado.</p>`
        : lista.map((g, gi) => {
            const qtd = _fmtQtdCusto(g.quantidadeG);
            return `<div class="custo-card" id="cg-${index}-${gi}">
              <div class="custo-card-ico">${dolarIco}</div>
              <div class="custo-card-info">
                <span class="custo-card-nome">${g.nome}</span>
                <span class="custo-card-qtd">${qtd || "—"}</span>
              </div>
              <span class="custo-card-valor">R$ ${formatarNumeroBR(g.valor, 2)}</span>
              <div class="custo-card-acoes">
                <button class="botao-editar" onclick="abrirEditarGrupoCusto(${index},'${encodeURIComponent(g.chave)}','${elementoId}',${direto})">✏️</button>
                <button class="botao-editar botao-excluir" onclick="confirmarExcluirGrupoCusto(${index},${gi},'${encodeURIComponent(g.chave)}','${elementoId}',${direto})">🗑️</button>
              </div>
            </div>`;
          }).join("")
      }
    </div>
    <div class="custo-total">
      <div class="custo-total-ico"><svg viewBox="0 0 24 24"><path d="M5 8h14l1.5 11a2 2 0 0 1-2 2.3H5.5A2 2 0 0 1 3.5 19z"/><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2"/><circle cx="12" cy="13.5" r="1.5"/></svg></div>
      <span class="custo-total-lbl">Total de custos</span>
      <span class="custo-total-val">R$ ${formatarNumeroBR(totalCustos, 2)}</span>
    </div>
    <button class="botao-voltar-form" style="margin-top:14px" onclick="${direto ? `mostrarHistoricoDoViveiroDireto(${index})` : `voltarOpcoesHistorico()`}">← Voltar</button>
  `;
}

function abrirEditarGrupoCusto(index, chaveEnc, elementoId, direto) {
  const chave = decodeURIComponent(chaveEnc);
  const v = viveiros[index];
  const grupo = (v.custos || []).filter(c => _chaveCusto(c) === chave);
  if (!grupo.length) return;
  const isProduto = chave.startsWith("id:");
  const nome = grupo[0].nomeProduto || grupo[0].categoria || "Custo";
  const valor = grupo.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const resultado = document.getElementById(elementoId);
  resultado.innerHTML = `
    <h3 class="titulo-secao">Editar custo</h3>
    <div class="cfg-wrap">
      <div class="campo-form">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><label>Nome do custo</label></div>
        <input type="text" id="editCustoNome" value="${nome.replace(/"/g, "&quot;")}" ${isProduto ? "disabled" : ""}>
        ${isProduto ? `<p class="rc-print-dica">Nome vem do cadastro do produto (Insumos).</p>` : ""}
      </div>
      <div class="campo-form">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><label>Valor total (R$)</label></div>
        <input type="text" inputmode="decimal" id="editCustoValor" value="${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}" onblur="formatarMoedaBlur(this)">
      </div>
      <div id="msg-edit-custo" style="display:none;color:#ef4444;font-size:13px;margin:0 0 8px;text-align:center;font-weight:500"></div>
      <button class="botao-salvar" onclick="salvarEdicaoGrupoCusto(${index},'${chaveEnc}','${elementoId}',${direto})">Salvar alterações</button>
      <button class="botao-voltar-form" style="margin-top:10px" onclick="renderizarHistoricoCustos(${index},'${elementoId}',${direto})">← Voltar</button>
    </div>
  `;
}

async function salvarEdicaoGrupoCusto(index, chaveEnc, elementoId, direto) {
  const chave = decodeURIComponent(chaveEnc);
  const msg = document.getElementById("msg-edit-custo");
  const erro = t => { if (msg) { msg.textContent = t; msg.style.display = "block"; } };
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;
  const v = viveiros[index];
  const grupo = (v.custos || []).filter(c => _chaveCusto(c) === chave);
  if (!grupo.length) return;
  const isProduto = chave.startsWith("id:");
  const novoNome = isProduto ? (grupo[0].nomeProduto || grupo[0].categoria) : document.getElementById("editCustoNome").value.trim();
  const novoValor = parseMoedaBR(document.getElementById("editCustoValor").value);
  if (!novoNome) { erro("Informe o nome do custo."); return; }
  if (isNaN(novoValor) || novoValor < 0) { erro("Informe um valor válido."); return; }

  const somaQtd = grupo.reduce((s, c) => s + (Number(c.quantidadeG) || 0), 0);
  const ids = grupo.map(c => c.id);

  // Remove os lançamentos do grupo e grava um único consolidado
  const del = await supabaseClient.from("custos").delete().in("id", ids).eq("user_id", usuario.id);
  if (del.error) { erro("Erro ao salvar: " + del.error.message); return; }

  const novo = {
    user_id: usuario.id, viveiro_id: v.id, tipo: grupo[0].tipo,
    produto_id: grupo[0].produtoId || null, nome_produto: novoNome,
    quantidade_g: somaQtd > 0 ? somaQtd : null, valor: novoValor,
    categoria: grupo[0].categoria, data: grupo[0].data, observacao: null,
  };
  const { data: salvo, error } = await supabaseClient.from("custos").insert([novo]).select();
  if (error) { erro("Erro ao salvar: " + error.message); return; }

  v.custos = (v.custos || []).filter(c => !ids.includes(c.id));
  v.custos.push({
    id: salvo[0].id, tipo: novo.tipo, produtoId: novo.produto_id, nomeProduto: novoNome,
    quantidadeG: novo.quantidade_g, valor: novoValor, categoria: novo.categoria, data: novo.data, observacao: null,
  });
  _toastSucesso("Custo atualizado!");
  renderizarHistoricoCustos(index, elementoId, direto);
}

function confirmarExcluirGrupoCusto(index, gi, chaveEnc, elementoId, direto) {
  const row = document.getElementById(`cg-${index}-${gi}`);
  if (!row) return;
  row.style.flexWrap = "wrap";
  row.innerHTML = `<div class="custo-grupo-conf">
    <span>Excluir todos os lançamentos deste item?</span>
    <div class="custo-grupo-conf-btns">
      <button class="ciclo-btn-relatorio" onclick="renderizarHistoricoCustos(${index},'${elementoId}',${direto})">Cancelar</button>
      <button class="ciclo-btn-excluir" onclick="excluirGrupoCusto(${index},'${chaveEnc}','${elementoId}',${direto})">Excluir</button>
    </div>
  </div>`;
}

async function excluirGrupoCusto(index, chaveEnc, elementoId, direto) {
  const chave = decodeURIComponent(chaveEnc);
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;
  const v = viveiros[index];
  const ids = (v.custos || []).filter(c => _chaveCusto(c) === chave).map(c => c.id);
  if (ids.length) {
    const { error } = await supabaseClient.from("custos").delete().in("id", ids).eq("user_id", usuario.id);
    if (error) { _toastErro("Erro ao excluir: " + error.message); return; }
  }
  v.custos = (v.custos || []).filter(c => !ids.includes(c.id));
  renderizarHistoricoCustos(index, elementoId, direto);
}

function abrirEdicaoCusto(viveiroIndex, custoIndex, elementoId, direto) {
  salvarScroll();
  const custo = viveiros[viveiroIndex].custos[custoIndex];
  const resultado = document.getElementById(elementoId);
  const acaoVoltar = `renderizarHistoricoCustos(${viveiroIndex},'${elementoId}',${direto}); restaurarScroll()`;

  resultado.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <h2 class="form-titulo">Editar Custo</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data</label>
          </div>
          <input type="date" id="dataEdicaoCusto" value="${custo.data}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            <label>Descrição</label>
          </div>
          <input type="text" id="nomeEdicaoCusto" value="${custo.nomeProduto}" placeholder="Ex: Ração, Pós larva...">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Valor (R$)</label>
          </div>
          <input type="text" inputmode="decimal" id="valorEdicaoCusto"
            value="${Number(custo.valor).toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2})}"
            onblur="formatarMoedaBlur(this)">
        </div>
        <div id="msg-edit-custo-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center;font-weight:500"></div>
        <button class="botao-salvar" onclick="salvarEdicaoCusto(${viveiroIndex},${custoIndex},'${elementoId}',${direto})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${acaoVoltar}">← Voltar</button>
      </div>
    </div>
  `;
}

async function salvarEdicaoCusto(viveiroIndex, custoIndex, elementoId, direto) {
  const novaData = document.getElementById("dataEdicaoCusto").value;
  const novoNome = document.getElementById("nomeEdicaoCusto").value.trim();
  const novoValor = parseMoedaBR(document.getElementById("valorEdicaoCusto").value);
  const erroEditCusto = document.getElementById("msg-edit-custo-erro");
  function _erroEditCusto(msg) { if (erroEditCusto) { erroEditCusto.textContent = msg; erroEditCusto.style.display = "block"; } }
  if (erroEditCusto) erroEditCusto.style.display = "none";

  if (!novaData || !novoNome || isNaN(novoValor) || novoValor < 0) {
    _erroEditCusto("Preencha todos os campos corretamente.");
    return;
  }

  const custo = viveiros[viveiroIndex].custos[custoIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const botao = document.querySelector(".botao-salvar");
  if (botao) { botao.disabled = true; botao.style.opacity = "0.65"; }

  const { error } = await supabaseClient.from("custos")
    .update({ data: novaData, nome_produto: novoNome, valor: novoValor, categoria: novoNome })
    .eq("id", custo.id).eq("user_id", usuario.id);

  if (botao) { botao.disabled = false; botao.style.opacity = ""; }
  if (error) { _erroEditCusto("Erro ao salvar: " + error.message); return; }

  viveiros[viveiroIndex].custos[custoIndex].data = novaData;
  viveiros[viveiroIndex].custos[custoIndex].nomeProduto = novoNome;
  viveiros[viveiroIndex].custos[custoIndex].valor = novoValor;

  renderizarHistoricoCustos(viveiroIndex, elementoId, direto);
  restaurarScroll();
}

function imprimirCustos(viveiroIndex) {
  const viveiro = viveiros[viveiroIndex];
  const custos = viveiro.custos || [];
  const total = custos.reduce((s, c) => s + Number(c.valor), 0);

  // Agrupa por produto/nome (igual à tela): uma linha por item
  const grupos = {};
  custos.forEach(c => {
    const chave = _chaveCusto(c);
    if (!grupos[chave]) grupos[chave] = { nome: c.nomeProduto || c.categoria || "Custo", quantidadeG: 0, valor: 0 };
    grupos[chave].valor += Number(c.valor) || 0;
    if (c.quantidadeG) grupos[chave].quantidadeG += Number(c.quantidadeG);
  });
  const lista = Object.values(grupos).sort((a, b) => b.valor - a.valor);

  const linhas = lista.map(g => {
    const qtd = _fmtQtdCusto(g.quantidadeG);
    return `<tr><td>${g.nome}</td><td>${qtd || "-"}</td><td>R$ ${formatarNumeroBR(g.valor, 2)}</td></tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Custos - ${viveiro.nome}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#222;max-width:700px;margin:0 auto}
    h1{font-size:20px;color:#066b63;margin:0 0 20px;text-align:center}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#066b63;color:#fff;padding:9px 12px;text-align:left}
    th:last-child{text-align:right}
    td{padding:8px 12px;border-bottom:1px solid #e5e7eb}
    td:last-child{text-align:right;font-weight:600}
    td:nth-child(2){text-align:center;color:#555}
    tr:nth-child(even) td{background:#f6fafa}
    .total-row td{font-weight:700;font-size:14px;border-top:2px solid #066b63;border-bottom:none;color:#066b63}
    @media print{body{padding:0}}
  </style></head><body>
  <h1>Custos — ${viveiro.nome}</h1>
  <table>
    <thead><tr><th>Descrição</th><th style="text-align:center">Quantidade</th><th>Valor</th></tr></thead>
    <tbody>
      ${linhas}
      <tr class="total-row"><td colspan="2">TOTAL</td><td>R$ ${formatarNumeroBR(total, 2)}</td></tr>
    </tbody>
  </table>
  </body></html>`;

  const janela = window.open("", "_blank");
  if (!janela) { _toastErro("Permita pop-ups para imprimir."); return; }
  janela.document.write(html);
  janela.document.close();
  janela.onload = () => { janela.print(); };
}

function confirmarExcluirCusto(viveiroIndex, custoIndex, elementoId, direto) {
  const row = document.getElementById(`custo-row-${viveiroIndex}-${custoIndex}`);
  if (!row) return;
  row.innerHTML = `
    <div class="confirmar-exclusao-custo" style="grid-column:1/-1">
      <span>Excluir este custo?</span>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirCusto(${viveiroIndex},${custoIndex},'${elementoId}',${direto})">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="renderizarHistoricoCustos(${viveiroIndex},'${elementoId}',${direto})">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirCusto(viveiroIndex, custoIndex, elementoId, direto) {
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;
  const custo = viveiros[viveiroIndex].custos[custoIndex];
  const { error } = await supabaseClient.from("custos").delete().eq("id", custo.id).eq("user_id", usuario.id);
  if (error) { _toastErro("Erro ao excluir: " + error.message); return; }
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
                  <span class="col-centro" style="font-size:13px;font-weight:500">${c.nomeProduto}</span>
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
    _erroCarregamento("Erro ao carregar viveiros.");
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
    _erroCarregamento("Erro ao carregar rações.");
    return;
  }

  const { data: biometriasData, error: erroBiometrias } =
    await supabaseClient
      .from("biometrias")
      .select("*")
      .eq("user_id", usuario.id);

  if (erroBiometrias) {
    console.log(erroBiometrias);
    _erroCarregamento("Erro ao carregar biometrias.");
    return;
  }

  const { data: despescasData, error: erroDespescas } =
    await supabaseClient
      .from("despescas")
      .select("*")
      .eq("user_id", usuario.id);

  if (erroDespescas) {
    console.log(erroDespescas);
    _erroCarregamento("Erro ao carregar despescas.");
    return;
  }

  const { data: ciclosData, error: erroCiclos } =
    await supabaseClient
      .from("ciclos")
      .select("*")
      .eq("user_id", usuario.id);

  if (erroCiclos) {
    console.log(erroCiclos);
    _erroCarregamento("Erro ao carregar ciclos.");
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

  // Carregar boletos a vencer
  const { data: boletosData } = await supabaseClient
    .from("boletos").select("*").eq("user_id", usuario.id).eq("ativo", true);
  boletos = (boletosData || []).map(b => ({
    id: b.id,
    nome: b.nome,
    fornecedor: b.fornecedor,
    dataCompra: b.data_compra,
    prazoDias: Number(b.prazo_dias),
    valor: b.valor ? Number(b.valor) : null,
    pago: !!b.pago,
    dataPagamento: b.data_pagamento || null,
  }));

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

    protocolos: Array.isArray(item.protocolos) ? item.protocolos : [],
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

      // Põe em dia os protocolos semanais (lançamento automático)
      try { await aplicarProtocolosSemanais(); } catch (e) { console.log("Protocolos:", e); }

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

      verificarBoletosVencendo();
      if (window.innerWidth >= 900) {
        mostrarListaViveiros();
      } else {
        document.getElementById("area-gestao").innerHTML = "";
        document.getElementById("menuGestao").style.display = "grid";
      }
    } else {
      window.location.href = "login.html";
    }
  } catch (error) {
    console.log("Erro na inicialização:", error);
    window.location.href = "login.html";
  }
});
