/*!
 * WA Aqua Gestão
 * Copyright © 2026 Matheus. Todos os direitos reservados / All rights reserved.
 * Uso, cópia, modificação ou distribuição proibidos sem autorização por escrito.
 * Contato: matheuswitalo86@gmail.com
 */

/* ═══════════════════════════════════════════════════════════════════════════
   MAPA DO ARQUIVO — use Ctrl/Cmd + F pelos títulos abaixo

   01. Configuração, estado global e funções básicas
   02. Taxa de alimentação, segurança de texto, avisos e gráficos
   03. Sessão, perfil, configurações, fazenda e assinatura
   04. Navegação, histórico de telas e utilitários compartilhados
   05. Cadastro, listagem e tela individual dos viveiros
   06. Catálogo de rações e lançamentos de ração
   07. Biometria, despesca, históricos e curva de crescimento
   08. Ciclos, planos, modo leitura e simulação de venda
   09. Custos fixos, energia e boletos
   10. Financeiro e relatórios de ciclo
   11. Custos, insumos e unidades de lançamento
   12. Carregamento de dados, inicialização e atualização do aplicativo

   REGRA DE MANUTENÇÃO
   Este arquivo permanece como núcleo estabilizado do sistema. Novas funções
   independentes devem nascer em arquivos próprios; aqui entram apenas ajustes
   das rotinas existentes. Não mover estado global, eventos ou inicialização
   sem conferir a ordem de execução.
   ═══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://bzlzjjodzyxvkakfmmxw.supabase.co";
const SUPABASE_KEY = "sb_publishable_Avq19q531p8NrIRaHf5VvQ_DoWzOoaW";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let viveiros = [];
let produtos = []; let tiposRacao = [];
let boletos = [];
let contato = null;   // nome e telefone do dono da conta (tabela contatos)
let custosFixos = [];
// false quando a consulta de custos fixos FALHOU (não é o mesmo que "não tem
// custo fixo"). Impede o congelamento de rateio gravar 0 permanente por engano.
let _custosFixosOk = true;
let assinatura = null;
let _planosCiclo = "mensal";
let _financeiroModo = "detalhado";
let _custoModo = "geral"; // relatório de custos do viveiro: "geral" ou "detalhado"
let _outroCustoModo = "um"; // "Outro custo" pelo menu: "um" viveiro ou "ratear" entre vários
let _boletosFiltro = "todos";
let _boletosFornecedor = "";
let _boletosBusca = "";
let _finViveiroId = null;
let _finOrdenacao = "data";
let _finPagina = 0;
let _finPeriodoIni = "";
let _finPeriodoFim = "";
let _finPeriodoInicializado = false;
// Seletor de ciclo do relatório financeiro (só vale com UM viveiro escolhido):
// "" = por período (datas); "atual" = ciclo em andamento; senão = ciclo_id de um
// ciclo já encerrado. _finCicloWin guarda a janela ini/fim do ciclo escolhido,
// para os renderizadores mostrarem "dias" e "total do ciclo" em vez de período.
let _finCicloSel = "";
let _finCicloWin = null;
let _scrollSalvo = 0;
let _scrollPainelSalvo = 0;
function salvarScroll() {
  _scrollSalvo = window.scrollY || document.documentElement.scrollTop || 0;
  _scrollPainelSalvo = document.getElementById("area-gestao")?.scrollTop || 0;
}
function restaurarScroll() {
  const y = _scrollSalvo, painelY = _scrollPainelSalvo;
  const painel = document.getElementById("area-gestao");
  const tela = painel?.firstElementChild;
  setTimeout(() => {
    // Não puxar a rolagem se a pessoa já navegou para outra tela.
    if (painel && painel.firstElementChild !== tela) return;
    if (painel) painel.scrollTop = painelY;
    window.scrollTo({ top: y, left: 0, behavior: "instant" });
  }, 60);
}

// ── Tabela de taxas de alimentação WA Aqua ──────────────────────────────────
// Curva contínua e suave (v2), calibrada pela referência comercial (Jory 1995) —
// âncora em 6 g = 5,10 %. A versão anterior tinha dois degraus artificiais
// (14→15 g e, sobretudo, 20→21 g) que faziam a sobrevivência estimada "pular"
// de ~63 % para ~79 % quando o camarão crescia 1 g. A queda agora é gradual do
// início ao fim e no topo continua caindo em vez de travar em 1,30 %.
const _TABELA_TAXA = [
  {peso:1,taxa:8.00},{peso:2,taxa:7.30},{peso:3,taxa:6.60},{peso:4,taxa:6.00},
  {peso:5,taxa:5.50},{peso:6,taxa:5.10},{peso:7,taxa:4.70},{peso:8,taxa:4.30},
  {peso:9,taxa:3.95},{peso:10,taxa:3.65},{peso:11,taxa:3.38},{peso:12,taxa:3.15},
  {peso:13,taxa:2.98},{peso:14,taxa:2.83},{peso:15,taxa:2.70},{peso:16,taxa:2.58},
  {peso:17,taxa:2.47},{peso:18,taxa:2.37},{peso:19,taxa:2.27},{peso:20,taxa:2.18},
  {peso:21,taxa:2.09},{peso:22,taxa:2.00},{peso:23,taxa:1.92},{peso:24,taxa:1.84},
  {peso:25,taxa:1.77},{peso:26,taxa:1.70},{peso:27,taxa:1.63},{peso:28,taxa:1.57},
  {peso:29,taxa:1.51},{peso:30,taxa:1.45},
];
function _obterTaxa(peso) {
  if (peso < 1) return null;
  // Acima de 30 g usa a taxa do maior peso da tabela (não trava a estimativa).
  if (peso >= 30) return _TABELA_TAXA[_TABELA_TAXA.length - 1].taxa;
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


// Escapa texto livre do cliente antes de ele entrar em innerHTML. Sem isto,
// um nome de viveiro como <img src=x onerror=...> viraria código executável.
// Hoje o dano fica na propria sessao do cliente; a defesa e higiene, e blinda
// o dia em que esse texto aparecer em outra tela (como o painel admin).
// NAO use nos toasts: eles montam com textContent, que ja e seguro.
function _esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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

// Trava um botão de ação durante uma operação de rede: mostra spinner + texto,
// bloqueia duplo toque e devolve uma função para restaurar o estado original.
// Use no topo da função: if (botao?.disabled) return;  (antes de qualquer await)
const _acoesPendentes = new WeakMap();
function _travarBotao(botao, texto = "Salvando...") {
  if (!botao) return () => {};
  if (_acoesPendentes.has(botao)) return _acoesPendentes.get(botao);
  const htmlOriginal = botao.innerHTML;
  const busyOriginal = botao.getAttribute("aria-busy");
  botao.disabled = true;
  botao.setAttribute("aria-busy", "true");
  botao.classList.add("btn-carregando");
  botao.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span><span role="status">${_esc(texto)}</span>`;
  const restaurar = () => {
    if (_acoesPendentes.get(botao) !== restaurar) return;
    _acoesPendentes.delete(botao);
    botao.disabled = false;
    if (busyOriginal === null) botao.removeAttribute("aria-busy");
    else botao.setAttribute("aria-busy", busyOriginal);
    botao.classList.remove("btn-carregando");
    botao.innerHTML = htmlOriginal;
  };
  _acoesPendentes.set(botao, restaurar);
  return restaurar;
}

// Os validadores e a confirmação de sucesso continuam nas funções de salvar.
// Esta borda captura exceções inesperadas sem limpar os campos nem deixar o
// botão preso. Não repete uma gravação cujo resultado possa ser incerto.
async function _executarSalvamento(botao, acao) {
  if (botao?.disabled) return;
  let restaurar;
  try {
    const operacao = acao();
    restaurar = _acoesPendentes.get(botao);
    await operacao;
  } catch (erro) {
    console.log("Falha ao concluir ação:", erro);
    _toastErro("Não foi possível confirmar a operação. Confira o histórico antes de tentar novamente.");
  } finally {
    if (restaurar) restaurar();
    else _acoesPendentes.get(botao)?.();
  }
}

// O Chart.js guarda cada gráfico numa lista interna, com um observador de
// redimensionamento preso ao canvas. Como as telas são redesenhadas trocando o
// innerHTML, o canvas antigo sai da página mas o gráfico continua vivo e
// escutando. Quem fica ajustando o peso-alvo no +/- acumula dezenas deles e o
// celular vai ficando lento. Aqui derrubamos os que não estão mais na tela.
function _limparGraficosOrfaos() {
  try {
    const insts = (typeof Chart !== "undefined" && Chart.instances) || {};
    Object.keys(insts).forEach((k) => {
      const c = insts[k];
      // isConnected vale para qualquer documento — não derruba o gráfico da
      // janela de impressão, que vive fora do documento principal.
      if (c && c.canvas && c.canvas.isConnected === false) {
        try { c.destroy(); } catch (e) {}
      }
    });
  } catch (e) {}
}

// Prepara um canvas para receber um gráfico novo.
// Além da limpeza acima, resolve uma corrida real: cada tela desenha o gráfico
// dentro de um setTimeout. Em dois toques rápidos no +/- do peso-alvo, o
// temporizador do desenho ANTIGO acorda depois de a tela já ter sido
// redesenhada, acha o canvas NOVO e ocupa ele. Quando o temporizador certo
// acorda, o Chart.js recusa ("Canvas is already in use"), a exceção sobe e o
// gráfico simplesmente para de atualizar. Derrubar quem estiver no canvas
// antes de desenhar faz o último desenho sempre vencer, que é o correto.
function _prepararCanvasGrafico(canvas) {
  _limparGraficosOrfaos();
  try {
    const atual = (canvas && typeof Chart !== "undefined" && Chart.getChart) ? Chart.getChart(canvas) : null;
    if (atual) atual.destroy();
  } catch (e) {}
  return canvas;
}

// Gera um identificador único para vincular lançamentos ao ciclo correto
// (evita mistura de custos quando um ciclo encerra e outro inicia no mesmo dia).
function _novoCicloId() {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


async function sairUsuario(botao) {
  if (botao?.disabled) return; // evita duplo toque
  _travarBotao(botao, "Saindo...");
  fecharMenuUsuario();
  try { await supabaseClient.auth.signOut(); } catch (e) { console.log(e); }
  viveiros = [];
  // replace(): Voltar/Avançar não devem reabrir o app autenticado após o logout
  window.location.replace("login.html");
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

// ═══ CONFIGURAÇÕES ═══════════════════════════════════════════════════════════

const _ICO = {
  atualizar:`<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
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
    avatarTopo.innerHTML = `<img src="${_attr(fotoUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  } else {
    const ini = nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
    avatarTopo.innerHTML = `<span class="avatar-topo-iniciais">${_esc(ini)}</span>`;
  }
}

// ─── Hub de Configurações ──────────────────────────────────────────────────
async function abrirConfiguracoes() {
  fecharMenuUsuario();
  esconderMenu();
  const area = document.getElementById("area-gestao");
  // Desenha a tela INTEIRA de uma vez (lista + botoes) com o cabecalho ainda
  // vazio, SEM esperar a rede. Assim nao aparece so o titulo primeiro nem pisca
  // o conteudo anterior. Os dados do usuario entram logo em seguida via
  // getSession() (leitura LOCAL, quase instantanea), preenchendo o cabecalho.
  area.innerHTML = `
    <h3 class="titulo-secao">Configurações</h3>
    <div class="cfg-wrap">
      <div class="cfg-header">
        <div class="cfg-header-avatar" id="cfg-avatar"></div>
        <div class="cfg-header-info">
          <span class="cfg-header-nome" id="cfg-nome">&nbsp;</span>
          <span class="cfg-header-email" id="cfg-email"></span>
          <span class="cfg-header-online">● Online</span>
        </div>
      </div>
      <div class="cfg-lista">
        ${_cfgItem("fazenda", "Fazenda", "Nome, e-mail e foto", "abrirFazenda()")}
        ${_cfgItem("conta", "Meus dados", "Nome e WhatsApp para contato", "abrirMeusDados()")}
        ${_cfgItem("seguranca", "Segurança", "Alterar senha", "abrirSeguranca()")}
        ${_cfgItem("aparencia", "Aparência", "Tema claro ou escuro", "abrirAparencia()")}
        ${_cfgItem("conta", "Minha conta", "Plano e assinatura", "abrirMinhaConta()")}
        ${_cfgItem("faq", "Perguntas frequentes (FAQ)", "Dúvidas sobre o sistema", "abrirFAQ()")}
        ${_cfgItem("suporte", "Suporte", "Fale com nossa equipe", "abrirSuporte()")}
        ${_cfgItem("atualizar", "Buscar atualização", `Versão ${_VERSAO_RODANDO || "—"}`, "buscarAtualizacaoManual(this)")}
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
          <button class="cfg-sair-confirmar" onclick="sairUsuario(this)">Sim, sair</button>
        </div>
      </div>
      <div class="cfg-perigo">
        <button class="cfg-excluir-link" onclick="confirmarExcluirConta()">Excluir minha conta</button>
      </div>
      <div id="cfg-excluir-confirm" class="cfg-sair-confirm" style="display:none">
        <p><b>⚠️ Atenção:</b> isso apaga sua conta e <b>TODOS os dados</b> — viveiros, lançamentos, histórico, tudo. <b>Não tem volta.</b></p>
        <p style="margin-top:8px">Digite <b>EXCLUIR</b> para confirmar:</p>
        <input type="text" id="cfg-excluir-input" autocomplete="off" autocapitalize="characters"
               style="width:100%;margin-top:6px;border:1.5px solid #fca5a5;border-radius:10px;padding:10px;font-size:15px;text-align:center;outline:none">
        <div class="cfg-sair-botoes" style="margin-top:10px">
          <button class="cfg-sair-cancelar" onclick="document.getElementById('cfg-excluir-confirm').style.display='none'">Cancelar</button>
          <button class="cfg-sair-confirmar" onclick="excluirMinhaConta(this)">Excluir tudo</button>
        </div>
      </div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="voltarMenuGestao()">Voltar</button>
    </div>
  `;

  // Preenche o cabecalho com o usuario da sessao — getSession() le do
  // armazenamento local (sem rede), entao entra quase instantaneo.
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const user = session?.user;
    const nome = user?.user_metadata?.nome || user?.email?.split("@")[0] || "Minha fazenda";
    const email = user?.email || "";
    const fotoUrl = user?.user_metadata?.avatar_url || null;
    const ini = nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2) || "?";
    const elAvatar = document.getElementById("cfg-avatar");
    const elNome = document.getElementById("cfg-nome");
    const elEmail = document.getElementById("cfg-email");
    // avatar usa innerHTML com _attr/_esc (seguro); nome/email via textContent.
    if (elAvatar) elAvatar.innerHTML = fotoUrl ? `<img src="${_attr(fotoUrl)}" alt="">` : `<span>${_esc(ini)}</span>`;
    if (elNome) elNome.textContent = nome;
    if (elEmail) elEmail.textContent = email;
  } catch (e) {}
}

function confirmarSairConta() {
  const el = document.getElementById("cfg-sair-confirm");
  if (el) el.style.display = el.style.display === "none" ? "block" : "none";
}

function confirmarExcluirConta() {
  const el = document.getElementById("cfg-excluir-confirm");
  if (el) el.style.display = el.style.display === "none" ? "block" : "none";
}

// Exclusão da própria conta: apaga todos os dados no servidor (Edge Function
// excluir-conta, com service role) e encerra a sessão.
async function excluirMinhaConta(botao) {
  if (botao && botao.disabled) return;
  const inp = document.getElementById("cfg-excluir-input");
  if (!inp || inp.value.trim().toUpperCase() !== "EXCLUIR") {
    _toastErro('Digite EXCLUIR no campo para confirmar.');
    if (inp) inp.focus();
    return;
  }
  const restaurar = _travarBotao(botao, "Excluindo...");
  try {
    const { data, error } = await supabaseClient.functions.invoke("excluir-conta", { body: {} });
    if (error || (data && data.error)) {
      console.log("excluir-conta:", error || data.error);
      _toastErro("Não foi possível excluir a conta. Tente de novo ou fale com o suporte.");
      restaurar();
      return;
    }
    try { await supabaseClient.auth.signOut(); } catch (e) {}
    window.location.replace("login.html");
  } catch (e) {
    console.log(e);
    _toastErro("Erro ao excluir a conta.");
    restaurar();
  }
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
        <div id="fazenda-foto" class="fazenda-foto">${fotoUrl ? `<img src="${_attr(fotoUrl)}" alt="">` : `<span>${_esc(ini)}</span>`}</div>
        <label class="fazenda-foto-edit">
          <svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <input type="file" accept="image/*" onchange="uploadFotoFazenda(this)" style="display:none">
        </label>
      </div>
      ${fotoUrl ? `<button class="fazenda-remover-foto" onclick="excluirFotoFazenda(this)">Remover foto</button>` : `<p class="fazenda-foto-dica">Adicione uma foto da fazenda (opcional)</p>`}
      <div class="form-corpo" style="padding:0">
        <div class="campo-form">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><label>Nome da fazenda</label></div>
          <input type="text" id="fzNome" value="${_attr(nome)}" placeholder="Ex: Fazenda São João">
        </div>
        <div class="campo-form">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><label>Nome do proprietário</label></div>
          <input type="text" id="fzProp" value="${_attr(prop)}" placeholder="Seu nome">
        </div>
        <div class="campo-form">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg><label>E-mail</label></div>
          <input type="email" id="fzEmail" value="${_attr(email)}" placeholder="seu@email.com">
        </div>
        <div id="msg-fazenda" style="display:none;font-size:13px;margin:0 0 8px;text-align:center;font-weight:500"></div>
        <button class="botao-salvar" onclick="salvarFazenda(this)">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar alterações
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirConfiguracoes()">Voltar</button>
      </div>
    </div>
  `;
}

async function salvarFazenda(botao) {
  if (botao?.disabled) return; // evita duplo toque
  const nome = document.getElementById("fzNome").value.trim();
  const prop = document.getElementById("fzProp").value.trim();
  const email = document.getElementById("fzEmail").value.trim();
  const msg = document.getElementById("msg-fazenda");
  const setMsg = (t, ok) => { if (msg) { msg.textContent = t; msg.style.display = "block"; msg.style.color = ok ? "#16a34a" : "#ef4444"; } };
  if (msg) msg.style.display = "none";
  if (!nome) { setMsg("Digite o nome da fazenda."); return; }

  const restaurar = _travarBotao(botao, "Salvando...");
  const { data: { user } } = await supabaseClient.auth.getUser();
  const emailMudou = email && email !== user?.email;

  const { error } = await supabaseClient.auth.updateUser({ data: { nome, proprietario: prop } });
  if (error) { restaurar(); setMsg("Erro ao salvar. Tente novamente."); return; }

  if (emailMudou) {
    const { error: e2 } = await supabaseClient.auth.updateUser({ email });
    if (e2) { restaurar(); setMsg("Dados salvos, mas o e-mail não pôde ser alterado: " + e2.message); return; }
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

async function excluirFotoFazenda(botao) {
  if (botao?.disabled) return; // evita duplo toque
  const restaurar = _travarBotao(botao, "Removendo...");
  const { error } = await supabaseClient.auth.updateUser({ data: { avatar_url: null } });
  if (error) { restaurar(); _toastErro("Erro ao remover foto."); return; }
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
        <button class="botao-salvar" onclick="salvarNovaSenha(this)">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar nova senha
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirConfiguracoes()">Voltar</button>
      </div>
    </div>
  `;
}

async function salvarNovaSenha(botao) {
  if (botao?.disabled) return; // evita duplo toque
  const atual = document.getElementById("segAtual").value;
  const nova = document.getElementById("segNova").value;
  const conf = document.getElementById("segConfirma").value;
  const msg = document.getElementById("msg-seg");
  const setMsg = (t) => { if (msg) { msg.textContent = t; msg.style.display = "block"; msg.style.color = "#ef4444"; } };
  if (msg) msg.style.display = "none";

  if (!atual) { setMsg("Digite sua senha atual."); return; }
  if (!nova || nova.length < 6) { setMsg("A nova senha deve ter no mínimo 6 caracteres."); return; }
  if (nova !== conf) { setMsg("As senhas não coincidem."); return; }

  // Sem trava, o 2º toque conferia a senha ATUAL depois de o 1º já tê-la
  // trocado — e acusava "senha atual incorreta" numa troca que deu certo.
  const restaurar = _travarBotao(botao, "Alterando...");
  const { data: { user } } = await supabaseClient.auth.getUser();
  const { error: eAuth } = await supabaseClient.auth.signInWithPassword({ email: user.email, password: atual });
  if (eAuth) { restaurar(); setMsg("Senha atual incorreta."); return; }

  const { error } = await supabaseClient.auth.updateUser({ password: nova });
  if (error) { restaurar(); setMsg("Erro ao alterar senha: " + error.message); return; }

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
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirConfiguracoes()">Voltar</button>
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
      vencStr = _fmtDataISO(_dataLocalISO(venc));
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
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirConfiguracoes()">Voltar</button>
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
  { q: "Como renovar minha assinatura?", a: "Acesse Configurações Minha conta e selecione Renovar assinatura. Escolha o plano desejado e siga as instruções para concluir a renovação." },
  { q: "Esqueci minha senha. O que fazer?", a: "Na tela de login, selecione Esqueci minha senha. Informe o e-mail cadastrado e siga as instruções enviadas para redefinir sua senha. Se não conseguir recuperar o acesso, entre em contato com o suporte do WA Aqua Gestão." },
  { q: "Como lançar uma despesca parcial?", a: "Acesse o viveiro desejado e selecione Lançar despesca parcial. Informe a quantidade despescada e o peso médio dos camarões. O sistema calculará automaticamente a biomassa despescada e registrará a operação no histórico do ciclo." },
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
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirConfiguracoes()">Voltar</button>
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
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirConfiguracoes()">Voltar</button>
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

// Tamanho do viveiro (ha) sempre como numero. O campo é de texto, e quem
// digitava "2,5" gravava a string "2,5" — que parseFloat lê como 2 e Number
// lê como NaN, estourando a produtividade (kg/ha) e o lucro/ha do relatório.
// Passar por aqui na hora de gravar E na hora de carregar conserta o que
// entra agora e cura o que já ficou torto no banco. Devolve null se vazio.
function _tamanhoHa(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseDecimalBR(v);
  return Number.isFinite(n) ? n : null;
}

// Mostra o tamanho (ha) no padrão brasileiro: 2,5 em vez de 2.5. Como agora
// guardamos numero, sem isto a tela exibiria ponto.
function _fmtHa(v) {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return "--";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function formatarMoedaBlur(input) {
  const v = input.value.trim();
  if (!v) return;
  const n = _numeroMoedaBR(v);
  if (n === null) { input.value = ""; return; }
  // Reescreve no formato pt-BR: o usuário vê a correção antes de salvar
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

// Valida se a data de um lancamento cabe no periodo do ciclo: nao pode ser
// antes do inicio (preparacao/povoamento) nem no futuro. Pura -> tem teste.
// Devolve "" (ok), "vazia", "futuro" ou "antes".
function _checarDataCiclo(dataYmd, iniYmd, hojeYmd) {
  if (!dataYmd) return "vazia";
  if (dataYmd > hojeYmd) return "futuro";
  if (iniYmd && dataYmd < iniYmd) return "antes";
  return "";
}

// Mensagem pronta para a data de um lancamento (ou "" se estiver ok).
function _erroDataCiclo(viveiro, dataYmd) {
  const ini = (viveiro && (viveiro.dataPreparacao || viveiro.dataPovoamento)) || "";
  const r = _checarDataCiclo(dataYmd, ini, _hojeLocal());
  if (r === "vazia") return "Informe a data.";
  if (r === "futuro") return "A data não pode ser no futuro.";
  if (r === "antes") return `A data não pode ser anterior ao início do ciclo (${formatarData(ini)}).`;
  return "";
}

function calcularDiasCultivo(dataPovoamento, dataFinal = new Date()) {
  if (!dataPovoamento) return 0;

  const inicio = _parseDataLocal(dataPovoamento);
  const fim = _parseDataLocal(dataFinal);

  const diferenca = fim - inicio;
  const dias = Math.round(diferenca / 86400000) + 1;

  return dias > 0 ? dias : 0;
}

// ═══ FUNÇÕES UTILITÁRIAS COMPARTILHADAS ═══════════════════════════════════════

// Escapa texto para dentro de um atributo HTML de aspas duplas (value="...").
// Sem isso, um nome como Fazenda "Boa Vista" fecha o atributo antes da hora: o
// campo abre truncado em Fazenda e, ao salvar por cima, o resto é perdido.
function _attr(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// Formata um Date como "AAAA-MM-DD" no fuso LOCAL do aparelho.
// Não use toISOString() para isso: ela converte para UTC, e às 21h de Brasília
// já é o dia seguinte lá — o lançamento cairia na data errada.
function _dataLocalISO(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// "Hoje" na data local — padrão dos formulários e fim das janelas de cálculo.
function _hojeLocal() {
  return _dataLocalISO(new Date());
}

function _compararViveirosPorNome(a, b) {
  const numA = parseInt(a.nome.replace(/\D/g, "")) || 0;
  const numB = parseInt(b.nome.replace(/\D/g, "")) || 0;
  return numA - numB || a.nome.localeCompare(b.nome, "pt-BR");
}

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
  return _esc(numero ? `${letra}${numero}` : nome);
}

function limparAreaGestao() {
  const area = document.getElementById("area-gestao");
  area.innerHTML = "";
}

function posicaoNaLista(index) {
  const ordenados = [...viveiros].sort(_compararViveirosPorNome);
  return Math.max(0, ordenados.findIndex(v => v.id === viveiros[index].id));
}

function esconderMenu() {
  document.getElementById("menuGestao").style.display = "none";
  _armarVoltarNavegador();
  _toggleVoltarTopo(true);
}

// Mostra/esconde a setinha de voltar no topo (útil no iPhone em modo app,
// onde não há botão/gesto de voltar do sistema).
function _toggleVoltarTopo(mostrar) {
  const b = document.getElementById("btn-voltar-topo");
  if (b) b.style.display = mostrar ? "flex" : "none";
}

// Volta UMA tela (mesma ação do "Voltar" do celular). Usado pela setinha do topo.
function irParaTelaAnterior() {
  const btn = _voltarBotaoVisivel();
  if (!btn) { voltarMenuGestao(); return; }
  // Se há proteção de histórico armada, usa history.back() para manter tudo
  // sincronizado (dispara o mesmo fluxo do voltar do celular); senão, clica direto.
  if (history.state && history.state.wa) history.back();
  else btn.click();
}

// ── Botão "voltar" do celular (Android) / gesto de voltar do navegador ──
// Em vez de sair do app, aciona o mesmo "Voltar" da tela atual. Só sai quando
// estiver na raiz (menu principal). Reaproveita os botões .botao-voltar já
// existentes, então o comportamento fica idêntico ao toque manual.
function _armarVoltarNavegador() {
  try {
    if (!history.state || !history.state.wa) history.pushState({ wa: true }, "");
  } catch (e) { /* ambientes sem history */ }
}

function _voltarBotaoVisivel() {
  const area = document.getElementById("area-gestao");
  if (!area) return null;
  const botoes = area.querySelectorAll(".botao-voltar-form, .botao-voltar");
  // Último botão visível (o "Voltar" costuma ficar no rodapé da tela).
  for (let i = botoes.length - 1; i >= 0; i--) {
    if (botoes[i].offsetParent !== null && !botoes[i].disabled) return botoes[i];
  }
  return null;
}

function voltarMenuGestao() {
  if (window.innerWidth >= 900) {
    mostrarListaViveiros();
    return;
  }
  document.getElementById("menuGestao").style.display = "grid";
  limparAreaGestao();
  verificarBoletosVencendo();
  _mostrarBannerLeitura();
  _toggleVoltarTopo(false);
}

// ═══ VIVEIROS ═════════════════════════════════════════════════════════════════

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

        <div class="cad-modo-toggle">
          <button type="button" class="cad-modo-btn ativo" id="cadBtnPrep" onclick="_cadModo('prep')">Em preparação</button>
          <button type="button" class="cad-modo-btn" id="cadBtnCultivo" onclick="_cadModo('cultivo')">Cultivo iniciado</button>
        </div>
        <input type="hidden" id="cadModo" value="prep">

        <div id="cad-prep">
          <div class="campo-form">
            <div class="campo-label">
              <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <label>Início da preparação</label>
            </div>
            <input type="date" id="dataPreparacao" value="${_hojeLocal()}">
          </div>
        </div>

        <div id="cad-cultivo" style="display:none">
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
              <svg class="campo-icone" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              <label>Laboratório (fornecedor de pós-larva)</label>
            </div>
            <input type="text" id="laboratorio" placeholder="Ex: Aquatec">
          </div>
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            <label>Tamanho do viveiro</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="tamanhoViveiro" placeholder="Ex: 0.5">
            <span class="campo-unidade">ha</span>
          </div>
        </div>

        <div id="msg-viveiro-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center;font-weight:500"></div>
        <button id="btnSalvarViveiro" class="botao-salvar" onclick="salvarViveiro()">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar viveiro
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">Voltar</button>
      </div>
    </div>
  `;
}

function _cadModo(modo) {
  document.getElementById("cadModo").value = modo;
  document.getElementById("cadBtnPrep").classList.toggle("ativo", modo === "prep");
  document.getElementById("cadBtnCultivo").classList.toggle("ativo", modo === "cultivo");
  document.getElementById("cad-prep").style.display = modo === "prep" ? "block" : "none";
  document.getElementById("cad-cultivo").style.display = modo === "cultivo" ? "block" : "none";
}

async function salvarViveiro() {
  const botao = document.getElementById("btnSalvarViveiro");
  if (botao && botao.disabled) return; // trava contra duplo toque
  if (_bloqueioEdicao()) return;

  // Gate de criação: respeita o limite de viveiros do plano.
  const limite = _planoLimiteEfetivo();
  if (viveiros.length >= limite) {
    _toastErro(limite <= 1
      ? "O plano grátis permite 1 viveiro. Assine um plano em \"Meu plano\" para cadastrar mais."
      : `Seu plano permite ${limite} viveiros. Faça upgrade em \"Meu plano\" para cadastrar mais.`);
    return;
  }

  const nome = document.getElementById("nomeViveiro").value.trim();
  const modo = document.getElementById("cadModo")?.value || "cultivo";
  const tamanho = _tamanhoHa(document.getElementById("tamanhoViveiro").value);
  const erroViveiro = document.getElementById("msg-viveiro-erro");
  const mostrarErroViveiro = (msg) => { if (erroViveiro) { erroViveiro.textContent = msg; erroViveiro.style.display = "block"; } };
  if (erroViveiro) erroViveiro.style.display = "none";

  if (!nome || !tamanho) { mostrarErroViveiro("Informe o nome e o tamanho do viveiro."); return; }

  // Trava: não permite dois viveiros com o mesmo nome
  const nomeNorm = nome.trim().toLowerCase();
  if (viveiros.some(v => (v.nome || "").trim().toLowerCase() === nomeNorm)) {
    mostrarErroViveiro(`Já existe um viveiro chamado "${nome.trim()}". Use outro nome.`);
    return;
  }

  // Monta o registro conforme o modo (valida os campos específicos)
  let novoViveiro;
  if (modo === "prep") {
    const dataPrep = document.getElementById("dataPreparacao").value;
    if (!dataPrep) { mostrarErroViveiro("Informe a data de início da preparação."); return; }
    novoViveiro = { nome, tamanho, ativo: true, data_preparacao: dataPrep, data_povoamento: null, total_povoado: null, laboratorio: null };
  } else {
    const data = document.getElementById("dataPovoamento").value;
    const total = document.getElementById("totalPovoadoGestao").value.replace(/\D/g, "");
    const laboratorio = document.getElementById("laboratorio").value;
    if (!data || !total || !laboratorio) { mostrarErroViveiro("Preencha data de povoamento, total povoado e laboratório."); return; }
    novoViveiro = { nome, tamanho, ativo: true, data_povoamento: data, total_povoado: total, laboratorio, data_preparacao: null };
  }

  // Feedback visual imediato (< 50 ms) e trava do botão
  const htmlOriginal = botao ? botao.innerHTML : "";
  if (botao) {
    botao.disabled = true;
    botao.classList.add("btn-carregando");
    botao.innerHTML = `<span class="btn-spinner"></span>Salvando...`;
  }
  const restaurarBotao = () => {
    if (botao) { botao.disabled = false; botao.classList.remove("btn-carregando"); botao.innerHTML = htmlOriginal; }
  };

  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurarBotao(); return; }

  // As checagens acima (nome repetido e limite do plano) enxergam só o que ESTA
  // página carregou. Se o viveiro foi criado em outro aparelho ou em outra aba
  // depois desta tela abrir, ela não sabe — e deixava criar um duplicado.
  // Confere no banco imediatamente antes de gravar.
  const { data: doBanco, error: erroConsulta } = await supabaseClient
    .from("viveiros").select("id, nome")
    .eq("user_id", usuario.id).eq("ativo", true);
  if (!erroConsulta && Array.isArray(doBanco)) {
    if (doBanco.some(v => (v.nome || "").trim().toLowerCase() === nomeNorm)) {
      restaurarBotao();
      mostrarErroViveiro(`Já existe um viveiro chamado "${nome.trim()}". Se você criou em outro aparelho, atualize a página para ver a lista.`);
      return;
    }
    if (doBanco.length >= limite) {
      restaurarBotao();
      mostrarErroViveiro(limite <= 1
        ? "O plano grátis permite 1 viveiro. Assine um plano em \"Meu plano\" para cadastrar mais."
        : `Seu plano permite ${limite} viveiros. Faça upgrade em \"Meu plano\" para cadastrar mais.`);
      return;
    }
  }

  novoViveiro.user_id = usuario.id;
  novoViveiro.ciclo_id = _novoCicloId(); // vincula os lançamentos deste ciclo

  const { data: viveiroSalvo, error } = await supabaseClient
    .from("viveiros")
    .insert([novoViveiro])
    .select();

  if (error || !viveiroSalvo || !viveiroSalvo.length) {
    console.log(error);
    mostrarErroViveiro("Erro ao salvar: " + (error?.message || "tente novamente."));
    restaurarBotao();
    return;
  }

  // Insere direto no estado local — sem recarregar tudo do banco.
  // Um viveiro novo não tem lançamentos, então os arrays vêm vazios.
  const it = viveiroSalvo[0];
  viveiros.push({
    id: it.id,
    nome: it.nome,
    dataPovoamento: it.data_povoamento,
    dataPreparacao: it.data_preparacao || null,
    totalPovoado: it.total_povoado,
    tamanho: _tamanhoHa(it.tamanho),
    laboratorio: it.laboratorio,
    cicloId: it.ciclo_id || null,
    racoes: [], biometrias: [], despescas: [], ciclosFinalizados: [], custos: [],
    protocolos: Array.isArray(it.protocolos) ? it.protocolos : [],
  });
  viveiros.sort(_compararViveirosPorNome);

  // Mostra a lista já posicionada no viveiro recém-criado
  const pos = viveiros.findIndex(v => v.id === it.id);
  mostrarListaViveiros(pos >= 0 ? pos : 0, "", `${nome.trim()} cadastrado com sucesso!`);
}

// Rótulo curto para a tira de seleção. Quase todo mundo nomeia como
// "Viveiro - 12", então tirar essa palavra deixa só o número — que é como o
// produtor chama o viveiro na fazenda. Nome sem número (ex: "Berçário") entra
// abreviado, e o nome inteiro fica no title para não haver dúvida.
function _rotuloCurtoViveiro(nome) {
  const limpo = String(nome || "").trim();
  const semPrefixo = limpo.replace(/^viveiro\s*[-–—:]?\s*/i, "").trim();
  const escolhido = semPrefixo || limpo || "?";
  return _esc(escolhido.length > 7 ? escolhido.slice(0, 6) + "…" : escolhido);
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

  const viveirosOrdenados = [...viveiros].sort(_compararViveirosPorNome);

  const total = viveirosOrdenados.length;
  const viveiro = viveirosOrdenados[posicao];
  const indexOriginal = viveiros.indexOf(viveiro);

  // Card da lista: mostra o que interessa no dia a dia — dias de cultivo e o
  // último peso — no lugar de data de povoamento e laboratório.
  const _diasCultivoVv = viveiro.dataPovoamento ? calcularDiasCultivo(viveiro.dataPovoamento) + " dias" : "--";
  const _biosVv = [...(viveiro.biometrias || [])].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const _ultBioVv = _biosVv.length ? fmtG(_biosVv[_biosVv.length - 1].gramatura) + " g" : "--";

  // Sempre renderiza 3 elementos para o contador ficar sempre centrado
  const navAnterior = posicao > 0
    ? `<button class="botao-nav-viveiro" onclick="mostrarListaViveiros(${posicao - 1}, 'anterior')">Anterior</button>`
    : `<span class="botao-nav-viveiro" style="visibility:hidden">Anterior</span>`;

  const navProximo = posicao < total - 1
    ? `<button class="botao-nav-viveiro" onclick="mostrarListaViveiros(${posicao + 1}, 'proximo')">Próximo</button>`
    : `<span class="botao-nav-viveiro" style="visibility:hidden">Próximo</span>`;

  // Tira de seleção: com 3 viveiros, "Próximo" resolve; com 20, o produtor
  // tocava 17 vezes para chegar no último. Aqui ele toca uma vez no que quer.
  const seletor = total < 2 ? "" : `
    <div class="vv-seletor" role="tablist" aria-label="Escolher viveiro">
      ${viveirosOrdenados.map((v, i) => {
        const iOriginal = viveiros.indexOf(v);
        const classes = ["vv-chip"];
        if (i === posicao) classes.push("ativo");
        if (v.dataPovoamento) classes.push("cultivo");
        if (_viveiroForaDoLimite(iOriginal)) classes.push("bloqueado");
        const situacao = _viveiroForaDoLimite(iOriginal) ? " (fora do plano)"
                       : v.dataPovoamento ? " (em cultivo)" : " (vazio)";
        return `<button type="button" class="${classes.join(" ")}" role="tab"
          aria-selected="${i === posicao}"
          title="${String(v.nome || "").replace(/"/g, "&quot;")}${situacao}"
          onclick="mostrarListaViveiros(${i}, '${i > posicao ? "proximo" : i < posicao ? "anterior" : ""}')"
        >${_rotuloCurtoViveiro(v.nome)}</button>`;
      }).join("")}
    </div>`;

  area.innerHTML = `
    <h2 class="titulo-secao">Viveiros</h2>
    ${seletor}

    <div class="viveiro-card">

      <div class="vc-topo">
        <div class="vc-icone-box">🦐</div>
        <div class="vc-titulo-area">
          <h3 class="vc-nome-viveiro">${_esc(viveiro.nome)}<button class="vc-editar-nome" onclick="editarNomeViveiro(${indexOriginal})" title="Editar nome" aria-label="Editar nome do viveiro"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></h3>
          ${viveiro.dataPovoamento
            ? `<span class="vc-badge-cultivo">● Em cultivo</span>`
            : `<span class="vc-badge-vazio">● Vazio</span>`}
          ${_viveiroForaDoLimite(indexOriginal) ? `<span class="vc-badge-bloqueado" onclick="abrirAssinatura()">🔒 Fora do plano — só leitura</span>` : ""}
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
            <strong>Dias de cultivo</strong>
            <p>${_diasCultivoVv}</p>
          </div>
        </div>
        <div class="vc-info-item">
          <div class="vc-info-icone azul">⚖️</div>
          <div>
            <strong>Última biometria</strong>
            <p>${_ultBioVv}</p>
          </div>
        </div>
        <div class="vc-info-item">
          <div class="vc-info-icone roxo">📐</div>
          <div>
            <strong>Tamanho</strong>
            <p>${_fmtHa(viveiro.tamanho)} ha</p>
          </div>
        </div>
      </div>

      <button class="botao-abrir" onclick="abrirViveiro(${indexOriginal})">
        Abrir viveiro
      </button>

    </div>

    <div class="nav-viveiros">
      ${navAnterior}
      <span class="nav-viveiros-contador">${posicao + 1} / ${total}</span>
      ${navProximo}
    </div>

    <button class="botao-voltar-form" style="margin-top:4px" onclick="voltarMenuGestao()">Voltar</button>
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
  let touchNaTira = false;
  area.addEventListener("touchstart", e => {
    touchStartX = e.touches?.[0]?.clientX ?? 0;
    // Arrastar a tira de seleção é rolagem dela, não troca de viveiro. Sem isto,
    // procurar o viveiro 18 na tira faria o card pular junto a cada arrasto.
    touchNaTira = !!(e.target && e.target.closest && e.target.closest(".vv-seletor"));
  }, { passive: true, signal: _swipeSig });
  area.addEventListener("touchend", e => {
    // Só swipa se ainda estiver na tela de lista de viveiros
    if (!area.querySelector(".viveiro-card")) return;
    if (touchNaTira) return;
    const endX = e.changedTouches?.[0]?.clientX;
    if (endX == null) return;
    const diff = touchStartX - endX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && posicao < total - 1) mostrarListaViveiros(posicao + 1, "proximo");
      if (diff < 0 && posicao > 0) mostrarListaViveiros(posicao - 1, "anterior");
    }
  }, { passive: true, signal: _swipeSig });

  // Deixa o viveiro atual visível no meio da tira. scrollLeft na mão em vez de
  // scrollIntoView de propósito: o scrollIntoView também rolaria a PÁGINA para
  // achar a tira, jogando o card para fora da tela a cada troca.
  const tira = area.querySelector(".vv-seletor");
  if (tira) {
    const ativo = tira.querySelector(".vv-chip.ativo");
    if (ativo) tira.scrollLeft = ativo.offsetLeft - (tira.clientWidth - ativo.offsetWidth) / 2;
  }

  // Animação de entrada
  const card = area.querySelector(".viveiro-card");
  if (card && direcao) {
    card.classList.add(direcao === "proximo" ? "slide-in-direita" : "slide-in-esquerda");
  }
}

function editarNomeViveiro(index) {
  if (_bloqueioViveiro(index)) return;
  const v = viveiros[index];
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <h2 class="form-titulo">Editar viveiro</h2>
      </div>
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
            <label>Nome do viveiro</label>
          </div>
          <input type="text" id="editNomeViveiro" value="${(v.nome || "").replace(/"/g, "&quot;")}" placeholder="Ex: Viveiro - 2">
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            <label>Tamanho do viveiro</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" step="any" id="editTamanhoViveiro" value="${v.tamanho || ""}" placeholder="Ex: 0.5">
            <span class="campo-unidade">ha</span>
          </div>
        </div>

        ${v.dataPovoamento ? `
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Data de povoamento</label>
          </div>
          <input type="date" id="editDataPovoamento" value="${v.dataPovoamento || ""}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
            <label>Total povoado</label>
          </div>
          <input type="text" id="editTotalPovoado" value="${v.totalPovoado ? Number(String(v.totalPovoado).replace(/\D/g, "")).toLocaleString("pt-BR") : ""}" placeholder="Ex: 250.000" oninput="formatarPopulacao(this)">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            <label>Laboratório</label>
          </div>
          <input type="text" id="editLaboratorio" value="${(v.laboratorio || "").replace(/"/g, "&quot;")}" placeholder="Ex: Aquatec">
        </div>
        ` : `
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>Início da preparação</label>
          </div>
          <input type="date" id="editDataPreparacao" value="${v.dataPreparacao || ""}">
        </div>
        <p class="rc-print-dica">Data de povoamento, total povoado e laboratório são definidos ao iniciar o cultivo.</p>
        `}

        <div id="msg-edit-nome-viv" style="display:none;color:#ef4444;font-size:13px;margin:0 0 8px;text-align:center;font-weight:500"></div>
        <button class="botao-salvar" onclick="salvarNomeViveiro(${index}, this)">Salvar alterações</button>
        <button class="botao-voltar-form" style="margin-top:10px" onclick="mostrarListaViveiros(${_posicaoViveiro(index)})">Cancelar</button>
      </div>
    </div>
  `;
  setTimeout(() => document.getElementById("editNomeViveiro")?.focus(), 60);
}

// Posição do viveiro na lista ordenada (mesma ordem de mostrarListaViveiros)
function _posicaoViveiro(index) {
  const alvo = viveiros[index];
  const ordenados = [...viveiros].sort(_compararViveirosPorNome);
  return Math.max(0, ordenados.indexOf(alvo));
}

async function salvarNomeViveiro(index, botao) {
  if (botao?.disabled) return;
  if (_bloqueioViveiro(index)) return;
  const novo = (document.getElementById("editNomeViveiro")?.value || "").trim();
  const msg = document.getElementById("msg-edit-nome-viv");
  const erro = (m) => { if (msg) { msg.textContent = m; msg.style.display = "block"; } };
  if (msg) msg.style.display = "none";
  if (!novo) { erro("Digite um nome para o viveiro."); return; }
  if (viveiros.some((vv, i) => i !== index && (vv.nome || "").trim().toLowerCase() === novo.toLowerCase())) {
    erro("Já existe um viveiro com esse nome."); return;
  }

  const v = viveiros[index];
  const tamanho = _tamanhoHa(document.getElementById("editTamanhoViveiro")?.value || "");
  if (!tamanho || tamanho <= 0) { erro("Informe o tamanho do viveiro."); return; }

  const dados = { nome: novo, tamanho };
  const mem = { nome: novo, tamanho };

  if (v.dataPovoamento) {
    const dataPov = document.getElementById("editDataPovoamento")?.value || "";
    const total = (document.getElementById("editTotalPovoado")?.value || "").replace(/\D/g, "");
    const laboratorio = (document.getElementById("editLaboratorio")?.value || "").trim();
    if (!dataPov) { erro("Informe a data de povoamento."); return; }
    if (!total || Number(total) <= 0) { erro("Informe o total povoado."); return; }
    if (!laboratorio) { erro("Informe o laboratório."); return; }
    dados.data_povoamento = dataPov; dados.total_povoado = total; dados.laboratorio = laboratorio;
    mem.dataPovoamento = dataPov; mem.totalPovoado = total; mem.laboratorio = laboratorio;
  } else {
    const dataPrep = document.getElementById("editDataPreparacao")?.value || "";
    if (!dataPrep) { erro("Informe a data de início da preparação."); return; }
    dados.data_preparacao = dataPrep;
    mem.dataPreparacao = dataPrep;
  }

  const restaurar = _travarBotao(botao, "Salvando...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); erro("Sessão expirada. Entre novamente."); return; }
  const { error } = await supabaseClient.from("viveiros")
    .update(dados).eq("id", v.id).eq("user_id", usuario.id);
  if (error) { restaurar(); erro("Erro ao salvar: " + error.message); return; }
  Object.assign(viveiros[index], mem);
  _toastSucesso("Viveiro atualizado!");
  mostrarListaViveiros(_posicaoViveiro(index));
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
  // Fonte única: custos manuais do ciclo (inclui legados sem ciclo_id na janela)
  // + custo fixo rateado, desde a preparação/povoamento até hoje.
  const _inicioCiclo = viveiro.dataPreparacao || viveiro.dataPovoamento;
  const _cc = _custosCicloAtivo(viveiro, viveiro.cicloId, _inicioCiclo, _hojeLocal());
  const totalCustos = _cc.total;

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

  // Despescas parciais já realizadas — a ração atual já reflete só o que ficou,
  // então a despesca NÃO é descontada da biomassa; ela apenas volta a contar na
  // sobrevivência (quem saiu estava vivo) e na projeção final.
  const _despescas = viveiro.despescas || [];
  const despKgTotal = _despescas.reduce((s, d) => s + (Number(d.quantidadeKg) || 0), 0);
  const despQtdTotal = _despescas.reduce((s, d) => {
    const pm = Number(d.pesoMedio) || 0;
    return s + (pm > 0 ? (Number(d.quantidadeKg) || 0) / (pm / 1000) : 0);
  }, 0);

  let sobrevivenciaEstimada = "--";
  let sobrevInconsistente = false;
  let fciEstimado = "--";
  let biomassaAtualStr = "--";
  let biomassaDespescaStr = "--";
  let custoKgProduzidoStr = "--";
  const PESO_ALVO_DESPESCA = 20; // g — meta padrão de despesca
  if (populacaoNum && ultimaRacaoNaoZero && pesoUltimaBio) {
    const res = _calcularBiomassa(populacaoNum, ultimaRacaoNaoZero.racao, pesoUltimaBio);
    if (res && res.biomassa > 0) {
      // res.biomassa = biomassa atual no viveiro, estimada pela ração que os
      // camarões remanescentes estão comendo AGORA (já é pós-despesca).
      const biomassaAtual = res.biomassa;
      const remanescentes = res.quantidade; // = biomassaAtual / (peso/1000)
      // Sobrevivência conta remanescentes + já despescados (despesca não é mortalidade)
      const sobreviventes = remanescentes + despQtdTotal;
      // NÃO limita a 100%: mostrar 103% + alerta é melhor que esconder a inconsistência
      const sobrevPct = populacaoNum > 0 ? sobreviventes / populacaoNum * 100 : 0;
      sobrevInconsistente = sobrevPct > 100;

      sobrevivenciaEstimada = formatarNumeroBR(sobrevPct, 1) + " %" + (sobrevInconsistente ? " ⚠️" : "");
      // FCA = ração total ÷ biomassa PRODUZIDA (a que ficou + a que já foi despescada).
      // Sem somar a despesca, o FCA fica artificialmente alto após uma despesca parcial.
      const biomassaProduzida = res.biomassa + despKgTotal;
      if (totalRacao > 0) fciEstimado = formatarNumeroBR(totalRacao / biomassaProduzida, 2);
      biomassaAtualStr = formatarNumeroBR(biomassaAtual, 0) + " kg";
      // Custo por kg PRODUZIDO usa a mesma base do FCA: biomassa atual + despescada.
      if (totalCustos > 0) custoKgProduzidoStr = "R$ " + formatarNumeroBR(totalCustos / biomassaProduzida, 2);
      const pesoDespesca = Math.max(PESO_ALVO_DESPESCA, pesoUltimaBio);
      // Projeção final = remanescentes crescendo até a meta + o que já foi despescado
      biomassaDespescaStr = formatarNumeroBR(remanescentes * pesoDespesca / 1000 + despKgTotal, 0) + " kg";
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
          <h2 class="vv-titulo">${_esc(viveiro.nome.toUpperCase())}</h2>
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
          <strong>${_esc(viveiro.laboratorio || "--")}</strong>
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
          <strong>${_fmtHa(viveiro.tamanho)} ha</strong>
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

      ${sobrevInconsistente ? `<div class="vv-alerta-inconsistencia">
        <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>Sobrevivência estimada acima de 100% — verifique povoamento, ração, taxa alimentar, peso médio ou o cadastro das despescas.</span>
      </div>` : ""}

      <div class="vv-secao-lbl">Ações de manejo</div>
      <div class="vv-manejo-grid">
        <button class="vv-manejo-btn" onclick="salvarScroll(); mostrarLancamentoRacao(${index})">
          <svg viewBox="0 0 24 24"><path d="M3 11h18M5 11a7 7 0 0 0 14 0"/><path d="M10 4c0 1.5-1 2.5-1 4h6c0-1.5-1-2.5-1-4"/></svg>
          <span>Lançar ração</span>
        </button>
        <button class="vv-manejo-btn" onclick="salvarScroll(); abrirBiometria(${index})">
          <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="10" rx="1"/><line x1="6" y1="7" x2="6" y2="17"/><line x1="10" y1="7" x2="10" y2="12"/><line x1="14" y1="7" x2="14" y2="12"/><line x1="18" y1="7" x2="18" y2="17"/></svg>
          <span>Lançar biometria</span>
        </button>
        <button class="vv-manejo-btn" onclick="salvarScroll(); abrirDespesca(${index})">
          <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          <!-- "parcial" no rótulo não é detalhe: o salvarDespesca grava
               tipo "Parcial" fixo, não existe caminho aqui para a despesca
               final. Um cliente leu "Lançar despesca", lançou a despesca do
               fim do ciclo por aqui, lançou de novo ao encerrar, e o ciclo
               fechou com o dobro de camarão. A despesca final é lançada em
               "Encerrar ciclo". -->
          <span>Lançar despesca parcial</span>
        </button>
        <button class="vv-manejo-btn" onclick="salvarScroll(); abrirLancarCusto(${index})">
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

      <div id="confirmar-excluir-viveiro-${index}" style="display:none;margin:0 16px 10px;background:#fff5f5;border:1px solid #fca5a5;border-radius:10px;padding:9px 11px">
        <p style="margin:0 0 1px;font-size:12px;font-weight:700;color:#dc2626">Excluir "${_esc(viveiro.nome)}"?</p>
        <p style="margin:0 0 7px;font-size:10.5px;color:#7f1d1d;line-height:1.3">Os dados serão desativados (recuperáveis pelo suporte).</p>
        <div style="display:flex;gap:6px">
          <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirViveiro(${index}, this)">Sim, excluir</button>
          <button class="ciclo-btn-relatorio" style="flex:1" onclick="document.getElementById('confirmar-excluir-viveiro-${index}').style.display='none'">Cancelar</button>
        </div>
      </div>

      <button class="botao-voltar-form" onclick="mostrarListaViveiros(posicaoNaLista(${index}))">Voltar</button>
    </div>
  `;

  // Marca os cards SEM dado (valor "--") para apagá-los visualmente — o painel
  // fica mais calmo até a biometria/estimativas existirem.
  area.querySelectorAll(".painel-info .info-box").forEach(box => {
    const v = (box.querySelector("strong")?.textContent || "").trim();
    if (v === "--" || v.startsWith("-- ")) box.classList.add("info-box-vazio");
  });
}

// ═══ CATÁLOGO DE RAÇÕES ════════════════════════════════════════════════════════

// Tela intermediaria do botao "Rações / Insumos": escolhe ir para o catalogo
// de racoes (ja existe) ou para insumos (por enquanto um placeholder).
function abrirRacoesInsumos() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </div>
        <h2 class="form-titulo">Cadastrar rações e insumos</h2>
      </div>
      <div class="form-corpo">
        <div class="historico-opcoes-grid">
          <button class="botao-historico-opcao" onclick="abrirRacoesCatalogo()">
            <svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Rações
          </button>
          <button class="botao-historico-opcao" onclick="abrirCustosInsumos()">
            <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Insumos
          </button>
        </div>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">Voltar</button>
      </div>
    </div>
  `;
}

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
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">Voltar</button>
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
            <input type="text" inputmode="decimal" id="pesoSacoRacao" value="30" step="0.1" oninput="calcularPreviaSacoRacao()">
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
        <button class="botao-voltar-form" onclick="abrirRacoesCatalogo()">Voltar</button>
      </div>
    </div>
  `;
}

function calcularPreviaSacoRacao() {
  const peso = parseDecimalBR(document.getElementById("pesoSacoRacao")?.value);
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
  if (_bloqueioEdicao()) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque (evita rações duplicadas)

  const nome = document.getElementById("nomeTipoRacao").value.trim();
  const pesoSacoKg = parseDecimalBR(document.getElementById("pesoSacoRacao").value);
  const valorSaco = parseMoedaBR(document.getElementById("valorSacoRacao").value);
  const erroEl = document.getElementById("erro-tipo-racao");
  if (erroEl) erroEl.style.display = "none";

  if (!nome) { mostrarErroTipoRacao("Digite o nome da ração."); return; }
  if (!pesoSacoKg || pesoSacoKg <= 0) { mostrarErroTipoRacao("Digite o peso do saco."); return; }
  if (!valorSaco || valorSaco <= 0) { mostrarErroTipoRacao("Digite o valor do saco."); return; }

  // Trava contra nome duplicado (mesmo nome = já existe; mude o nome para cadastrar outra)
  const nomeNorm = nome.toLowerCase();
  if (tiposRacao.some(t => (t.nome || "").trim().toLowerCase() === nomeNorm)) {
    mostrarErroTipoRacao(`Já existe uma ração chamada "${nome}". Use outro nome ou edite a existente.`);
    return;
  }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  const custoPorKg = valorSaco / pesoSacoKg;
  const restaurar = _travarBotao(botao, "Salvando...");

  const { data: salvo, error } = await supabaseClient
    .from("tipos_racao")
    .insert([{ user_id: usuario.id, nome, peso_saco_kg: pesoSacoKg, valor_saco: valorSaco, custo_por_kg: custoPorKg }])
    .select();

  if (error) {
    restaurar();
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
          <button class="botao-voltar-form" onclick="abrirRacoesCatalogo()">Voltar</button>
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
          ${tiposRacao.map((t, i) => ({ t, i })).sort((a, b) => a.t.nome.localeCompare(b.t.nome, "pt-BR", { sensitivity: "base" })).map(({ t, i }) => `
            <div class="produto-item" id="tipo-racao-item-${i}">
              <div class="produto-info">
                <span class="produto-nome">${_esc(t.nome)}</span>
                <span class="produto-detalhe">${formatarNumeroBR(t.pesoSacoKg, 0)} kg/saco · R$ ${formatarNumeroBR(t.valorSaco, 2)}/saco · R$ ${formatarNumeroBR(t.custoPorKg, 2)}/kg</span>
              </div>
              <span class="col-acoes">
                <button class="botao-editar" onclick="abrirEdicaoTipoRacao(${i})">✏️</button>
                <button class="botao-editar botao-excluir" onclick="confirmarExcluirTipoRacao(${i})">🗑️</button>
              </span>
            </div>
          `).join("")}
        </div>
        <button class="botao-voltar-form" onclick="abrirRacoesCatalogo()">Voltar</button>
      </div>
    </div>
  `;
}

function confirmarExcluirTipoRacao(i) {
  const item = document.getElementById(`tipo-racao-item-${i}`);
  if (!item) return;
  item.innerHTML = `
    <div class="confirmar-exclusao-custo">
      <span>Excluir <strong>${_esc(tiposRacao[i].nome)}</strong>?</span>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirTipoRacao(${i}, this)">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="abrirVerTiposRacao()">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirTipoRacao(i, botao) {
  if (_bloqueioEdicao()) return;
  if (botao?.disabled) return;
  // Trava: ração com lançamentos no ciclo atual não pode sair do catálogo —
  // o custo derivado (preço × kg) zeraria os kg já lançados dela.
  const emUso = viveiros.some(v => (v.racoes || []).some(r => r.tipoRacaoId === tiposRacao[i].id));
  if (emUso) {
    _toastErro("Esta ração tem lançamentos no ciclo atual e não pode ser excluída (o custo dos lançamentos zeraria).");
    return;
  }
  const restaurar = _travarBotao(botao, "Excluindo...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }
  const { error } = await supabaseClient.from("tipos_racao").delete().eq("id", tiposRacao[i].id).eq("user_id", usuario.id);
  if (error) { restaurar(); _toastErro("Erro ao excluir: " + error.message); return; }
  tiposRacao.splice(i, 1);
  _montarCustoRacaoVirtual(); // catálogo mudou custo derivado atualiza
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
          <input type="text" id="editNomeTipoRacao" value="${_attr(t.nome)}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Peso do saco</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="editPesoSacoRacao" value="${t.pesoSacoKg}" step="0.1">
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
        <button class="botao-voltar-form" onclick="abrirVerTiposRacao()">Voltar</button>
      </div>
    </div>
  `;
}

async function salvarEdicaoTipoRacao(i) {
  if (_bloqueioEdicao()) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque
  const nome = document.getElementById("editNomeTipoRacao").value.trim();
  const pesoSacoKg = parseDecimalBR(document.getElementById("editPesoSacoRacao").value);
  const valorSaco = parseMoedaBR(document.getElementById("editValorSacoRacao").value);
  const erroEl = document.getElementById("erro-edit-tipo-racao");
  const _erroEdit = (msg) => { if (erroEl) { erroEl.textContent = msg; erroEl.style.display = "block"; } };
  if (erroEl) erroEl.style.display = "none";

  if (!nome || !(pesoSacoKg > 0) || !(valorSaco > 0)) { _erroEdit("Preencha nome, peso e valor (maiores que zero)."); return; }

  const custoPorKg = valorSaco / pesoSacoKg;
  const restaurar = _travarBotao(botao, "Salvando...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const { error } = await supabaseClient.from("tipos_racao")
    .update({ nome, peso_saco_kg: pesoSacoKg, valor_saco: valorSaco, custo_por_kg: custoPorKg })
    .eq("id", tiposRacao[i].id).eq("user_id", usuario.id);

  restaurar();
  if (error) { _erroEdit("Erro ao salvar: " + error.message); return; }

  tiposRacao[i] = { ...tiposRacao[i], nome, pesoSacoKg, valorSaco, custoPorKg };
  _montarCustoRacaoVirtual(); // preço mudou custo derivado atualiza na hora
  abrirVerTiposRacao();
}

// ═══ LANÇAMENTOS DE RAÇÃO ══════════════════════════════════════════════════════

// Custo estimado de um lancamento de racao: quilos consumidos x custo por kg
// do tipo de racao escolhido. Devolve null quando falta dado (nao mostra caixa).
// Funcao pura -> tem teste.
function _custoRacaoEstimado(consumoKg, custoPorKg) {
  return (consumoKg > 0 && custoPorKg > 0) ? consumoKg * custoPorKg : null;
}

// Atualiza a caixa "Custo estimado" ao vivo, conforme a pessoa escolhe o tipo
// de racao e digita os quilos. So aparece com tipo (que tem preco) + consumo.
function _calcCustoRacao() {
  const div = document.getElementById("previa-custo-racao");
  const el = document.getElementById("previa-custo-racao-valor");
  if (!div || !el) return;
  const consumo = parseDecimalBR(document.getElementById("consumoRacao")?.value);
  const sel = document.getElementById("tipoRacaoSelect");
  const idx = sel && sel.value !== "" ? Number(sel.value) : -1;
  const tipo = idx >= 0 ? tiposRacao[idx] : null;
  const custo = tipo ? _custoRacaoEstimado(consumo, tipo.custoPorKg) : null;
  if (custo !== null) {
    el.textContent = "R$ " + formatarNumeroBR(custo, 2);
    div.style.display = "block";
  } else {
    div.style.display = "none";
  }
}

// Usa a data do lançamento, não a ordem em que a consulta devolveu as linhas.
// Se a última ração saiu do catálogo (ou não foi especificada), não adivinha.
function _ultimaRacaoIndex(viveiro, catalogo = tiposRacao) {
  const ultima = (viveiro?.racoes || []).reduce((atual, r) =>
    r.data && (!atual || r.data > atual.data) ? r : atual, null);
  return ultima?.tipoRacaoId ? catalogo.findIndex(t => t.id === ultima.tipoRacaoId) : -1;
}

function _sugerirUltimaRacao(index) {
  const select = document.getElementById("tipoRacaoSelect");
  if (!select) return;
  const tipo = _ultimaRacaoIndex(viveiros[index]);
  select.value = tipo >= 0 ? String(tipo) : "";
  _calcCustoRacao();
}

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
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">Voltar</button>
      </div>
    `;
    return;
  }

  const hoje = _hojeLocal();

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
            <select id="viveiroRacao" onchange="_sugerirUltimaRacao(this.value)">
              ${viveiros.map((v, i) => v.dataPovoamento ? `<option value="${i}">${_esc(v.nome)}</option>` : "").join("")}
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
          <select id="tipoRacaoSelect" onchange="_calcCustoRacao()">
            <option value="">— Não especificado —</option>
            ${tiposRacao.map((t, i) => `<option value="${i}">${_esc(t.nome)}</option>`).join("")}
          </select>
        </div>
        ` : ""}
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Consumo de ração</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="consumoRacao" placeholder="Ex: 50" oninput="document.getElementById('msg-racao-erro')&&(document.getElementById('msg-racao-erro').style.display='none');_calcCustoRacao()">
            <span class="campo-unidade">kg</span>
          </div>
        </div>

        <div id="previa-custo-racao" class="custo-por-grama-preview" style="display:none">
          Custo estimado: <strong id="previa-custo-racao-valor">—</strong>
        </div>

        <div id="msg-racao-erro" style="display:none;color:#e53e3e;background:#fff5f5;border:1px solid #feb2b2;border-radius:8px;padding:10px 14px;font-size:14px;margin-bottom:8px;"></div>

        <div id="msg-racao-sucesso" class="msg-sucesso-lancamento" style="display:none;">
          <span class="msg-emoji">✅</span>
          <span class="msg-texto">Ração lançada com sucesso!</span>
        </div>

        <button class="botao-salvar" onclick="_executarSalvamento(this, () => salvarLancamentoRacao(${dentroDoViveiro ? indexSelecionado : ""}))">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar lançamento
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${dentroDoViveiro ? `abrirViveiro(${indexSelecionado}); restaurarScroll()` : "voltarMenuGestao()"}">
          Voltar
        </button>
      </div>
    </div>
  `;
  _sugerirUltimaRacao(dentroDoViveiro ? indexSelecionado : document.getElementById("viveiroRacao")?.value);
}

async function salvarLancamentoRacao(indexDireto = "") {
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque

  const index =
    indexDireto !== ""
      ? indexDireto
      : document.getElementById("viveiroRacao").value;
  if (_bloqueioViveiro(index)) return;

  const data = document.getElementById("dataRacao").value;
  const racao = parseDecimalBR(document.getElementById("consumoRacao").value);

  const erroDiv = document.getElementById("msg-racao-erro");
  const mostrarErroRacao = (msg) => { if (erroDiv) { erroDiv.textContent = msg; erroDiv.style.display = "block"; } };
  if (erroDiv) erroDiv.style.display = "none";

  if (!data || isNaN(racao) || racao < 0) {
    mostrarErroRacao("Preencha a data e a quantidade (pode ser 0 para dia sem ração).");
    return;
  }
  const _eDataR = _erroDataCiclo(viveiros[index], data);
  if (_eDataR) { mostrarErroRacao(_eDataR); return; }

  // Verifica se já existe lançamento nessa data (normaliza formato)
  const jaExiste = (viveiros[index].racoes || []).some(r => r.data.substring(0, 10) === data);
  if (jaExiste) {
    mostrarErroRacao(`Já existe um lançamento em ${formatarData(data)}. Edite o lançamento existente.`);
    return;
  }

  // Feedback imediato + trava do botão (antes de qualquer await)
  const restaurar = _travarBotao(botao, "Salvando...");

  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

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
    restaurar();
    return;
  }

  viveiros[index].racoes.push({
    id: racaoSalva[0].id,
    data: data,
    racao: racao,
    nomeRacao: nomeRacao,
    tipoRacaoId: tipoRacaoId,
  });

  // Custo de ração é DERIVADO: preço do catálogo × kg lançados no ciclo.
  // Nada é gravado na tabela de custos — só recalcula o registro em memória.
  _montarCustoRacaoVirtual();

  // Protocolos automáticos atrelados à ração (ex.: potássio por kg)
  // Protegido: nunca pode quebrar o lançamento de ração nem o feedback.
  let _protAplicados = [], _protFalhas = [];
  try {
    const _pr = await _aplicarProtocolosRacao(index, racao, data);
    _protAplicados = _pr.aplicados || []; _protFalhas = _pr.falhas || [];
  } catch (e) { console.log("Protocolo ração:", e); _protFalhas = ["protocolo automático"]; }

  // Mostra mensagem de sucesso e avança a data para o dia seguinte (sequência)
  const [ay, am, ad] = data.split("-").map(Number);
  const prox = new Date(ay, am - 1, ad + 1);
  const proxStr = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}-${String(prox.getDate()).padStart(2, "0")}`;
  // Guarda contra a tela ter mudado durante o await: sem isto, um getElementById
  // nulo estouraria antes do restaurar() e o botão ficaria preso em "Salvando...".
  const _dataRacaoEl = document.getElementById("dataRacao"); if (_dataRacaoEl) _dataRacaoEl.value = proxStr;
  // A quantidade PERMANECE após salvar (não limpa): lançando rações atrasadas, a
  // data avança sozinha e a mesma quantidade fica pronta pra repetir no próximo
  // dia. É só um campo na tela — fechar e reabrir o app zera naturalmente.
  restaurar();

  const msgSucesso = document.getElementById("msg-racao-sucesso");
  if (msgSucesso) {
    // Mostra o viveiro no proprio aviso, pra confirmar de olho onde entrou.
    // textContent ja escapa o nome — nao precisa de _esc aqui.
    const alvoTexto = msgSucesso.querySelector(".msg-texto");
    if (alvoTexto) alvoTexto.textContent = `Ração lançada no ${viveiros[index].nome}!`;
    msgSucesso.style.display = "flex";
    setTimeout(() => { msgSucesso.style.display = "none"; }, 2500);
  }

  // Avisa quais protocolos automáticos entraram junto (custo já lançado)
  if (_protAplicados.length) {
    const txt = _protAplicados.map(a => `${_esc(a.nome)} (${_fmtQtdCusto(a.quantidadeG)})`).join(", ");
    setTimeout(() => _toastSucesso("Protocolo aplicado: " + txt), 500);
  }
  // Não deixa o custo automático falhar calado: a ração entrou, mas o insumo do
  // protocolo não — avisa pra pessoa relançar quando a internet voltar.
  if (_protFalhas.length) {
    setTimeout(() => _toastErro("Ração salva, mas o custo automático de " + _protFalhas.join(", ") + " não entrou. Confira a conexão e relance o protocolo."), 900);
  }
}

// ═══ BIOMETRIAS ════════════════════════════════════════════════════════════════

// Peso medio de uma biometria: pesa-se uma amostra e conta-se quantos camaroes
// ha nela (250 g / 30 = 8,33 g). Devolve null quando falta dado, para a tela
// nao sobrescrever um peso medio digitado a mao. Funcao pura -> tem teste.
function _pesoMedioAmostra(amostraG, qtd) {
  return (amostraG > 0 && qtd > 0) ? amostraG / qtd : null;
}

// Preenche o campo "Peso medio" ao vivo enquanto a pessoa digita amostra e
// quantidade. O campo continua editavel: quem ja sabe a media digita direto
// (deixando amostra/quantidade em branco).
function _calcPesoMedioBio() {
  const amostra = parseDecimalBR(document.getElementById("amostraBiometria").value);
  const qtd = parseDecimalBR(document.getElementById("qtdBiometria").value);
  const campo = document.getElementById("gramaturaBiometria");
  if (!campo) return;
  const pm = _pesoMedioAmostra(amostra, qtd);
  if (pm !== null) {
    // Calculou: preenche e marca que o valor veio da amostra (automatico).
    campo.value = formatarNumeroBR(pm, 2);
    campo.dataset.auto = "1";
  } else if (campo.dataset.auto === "1") {
    // Apagou a amostra ou a quantidade e o valor era automatico: limpa, para
    // nao salvar um peso medio velho. Se a pessoa digitou a media a mao
    // (dataset.auto vazio), respeita e nao apaga.
    campo.value = "";
    campo.dataset.auto = "";
  }
}

function abrirBiometria(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const hoje = _hojeLocal();

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

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="campo-form">
            <div class="campo-label">
              <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <label>Peso da amostra</label>
            </div>
            <div class="campo-input-unidade">
              <input type="text" inputmode="decimal" id="amostraBiometria" placeholder="Ex: 250" oninput="_calcPesoMedioBio()">
              <span class="campo-unidade">g</span>
            </div>
          </div>
          <div class="campo-form">
            <div class="campo-label">
              <svg class="campo-icone" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              <label>Qtd de camarões</label>
            </div>
            <input type="text" inputmode="numeric" id="qtdBiometria" placeholder="Ex: 30" oninput="this.value=this.value.replace(/[^0-9]/g,'');_calcPesoMedioBio()">
          </div>
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="12"/><line x1="14" y1="10" x2="14" y2="12"/><line x1="18" y1="10" x2="18" y2="14"/></svg>
            <label>Peso médio</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="gramaturaBiometria" placeholder="Ex: 10,5" oninput="this.dataset.auto=''">
            <span class="campo-unidade">g</span>
          </div>
          <p style="font-size:12px;color:#6b7280;margin:6px 2px 0">Calcula sozinho pela amostra ÷ quantidade — você também pode digitar direto.</p>
        </div>

        <div id="msg-bio-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center;font-weight:500"></div>
        <div id="msg-bio-sucesso" class="msg-sucesso-lancamento" style="display:none;">
          <span class="msg-emoji">✅</span>
          <span class="msg-texto">Biometria lançada!</span>
        </div>

        <button class="botao-salvar" onclick="_executarSalvamento(this, () => salvarBiometria(${index}))">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar biometria
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirViveiro(${index}); restaurarScroll()">
          Voltar
        </button>
      </div>
    </div>
  `;
}

async function salvarBiometria(index) {
  if (_bloqueioViveiro(index)) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque

  const data = document.getElementById("dataBiometria").value;
  const gramaturaRaw = document.getElementById("gramaturaBiometria").value.trim().replace(",", ".");
  const gramatura = parseFloat(gramaturaRaw);
  const msgErro = document.getElementById("msg-bio-erro");

  const mostrarErroBio = (msg) => { if (msgErro) { msgErro.textContent = msg; msgErro.style.display = "block"; } };
  if (msgErro) msgErro.style.display = "none";

  // !(x > 0) rejeita vazio, zero, negativo E NaN de uma vez (peso de camarão
  // negativo estragaria biomassa, FCA e sobrevivência).
  if (!data || !(gramatura > 0)) {
    mostrarErroBio("Preencha a data e uma gramatura maior que zero.");
    return;
  }
  const _eDataB = _erroDataCiclo(viveiros[index], data);
  if (_eDataB) { mostrarErroBio(_eDataB); return; }

  const dataDuplicada = (viveiros[index].biometrias || []).some(b => b.data === data);
  if (dataDuplicada) {
    mostrarErroBio("Já existe uma biometria nessa data. Edite ou exclua a existente.");
    return;
  }

  const restaurar = _travarBotao(botao, "Salvando...");

  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

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
    restaurar();
    mostrarErroBio("Erro ao salvar: " + error.message);
    return;
  }

  viveiros[index].biometrias.push({
    id: bioSalva[0].id,
    data: data,
    gramatura: gramatura,
  });

  // Guarda contra a tela ter mudado durante o await (senão trava o botão).
  const _dataBioEl = document.getElementById("dataBiometria"); if (_dataBioEl) _dataBioEl.value = _hojeLocal();
  const _gramBioEl = document.getElementById("gramaturaBiometria"); if (_gramBioEl) _gramBioEl.value = "";
  const _amBioEl = document.getElementById("amostraBiometria"); if (_amBioEl) _amBioEl.value = "";
  const _qtBioEl = document.getElementById("qtdBiometria"); if (_qtBioEl) _qtBioEl.value = "";
  restaurar();

  const msgSucesso = document.getElementById("msg-bio-sucesso");
  if (msgSucesso) {
    msgSucesso.style.display = "flex";
    setTimeout(() => { msgSucesso.style.display = "none"; }, 2500);
  }
}

// ═══ DESPESCAS ═════════════════════════════════════════════════════════════════

function abrirDespesca(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const hoje = _hojeLocal();

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><path d="M21 12s-4 6-9 6-9-6-9-6 4-6 9-6 9 6 9 6"/><circle cx="17" cy="12" r="1.5"/><path d="M3 12l-2-3.5M3 12l-2 3.5"/></svg>
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">Lançar Despesca Parcial</h2>
      </div>
      <div class="form-corpo">

        <!-- Fica ANTES dos campos de propósito: depois de digitar a
             quantidade a pessoa já decidiu que é aqui, e um aviso no rodapé
             chega tarde. É este texto que separa a despesca parcial da final
             — foi confundir as duas que fechou um ciclo com o dobro de
             camarão. -->
        <div class="form-nota">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <div>
            <b>Só despesca parcial entra aqui</b> — quando sai parte do
            camarão e o viveiro <b>continua em cultivo</b>.
            <span>A despesca que <b>encerra o ciclo</b> não se lança por aqui.
              Ela é informada em <b>Encerrar ciclo</b>, na própria tela do
              viveiro, em "Ações de administração". Lançar a mesma despesca
              nos dois lugares faz o sistema contar o camarão duas vezes.</span>
          </div>
        </div>

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
            <input type="text" inputmode="decimal" id="quantidadeDespesca" placeholder="Ex: 500">
            <span class="campo-unidade">kg</span>
          </div>
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
            <label>Peso médio</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="pesoMedioDespesca" placeholder="Ex: 12">
            <span class="campo-unidade">g</span>
          </div>
        </div>

        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Preço de venda por kg</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="precoDespesca" placeholder="Ex: 16,00" onblur="formatarMoedaBlur(this)">
            <span class="campo-unidade">R$</span>
          </div>
        </div>

        <div id="msg-despesca-erro" style="display:none;color:#e53e3e;background:#fff5f5;border:1px solid #feb2b2;border-radius:8px;padding:10px 14px;font-size:14px;margin-bottom:8px;"></div>

        <div id="msg-despesca-sucesso" class="msg-sucesso-lancamento" style="display:none;">
          <span class="msg-emoji">✅</span>
          <span class="msg-texto">Despesca lançada com sucesso!</span>
        </div>

        <button class="botao-salvar" onclick="_executarSalvamento(this, () => salvarDespesca(${index}))">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar despesca
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirViveiro(${index}); restaurarScroll()">
          Voltar
        </button>
      </div>
    </div>
  `;
}

async function salvarDespesca(index) {
  if (_bloqueioViveiro(index)) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque

  const data = document.getElementById("dataDespesca").value;
  const quantidadeKg = parseDecimalBR(document.getElementById("quantidadeDespesca").value);
  const pesoMedio = parseDecimalBR(document.getElementById("pesoMedioDespesca").value);
  const precoKg = parseMoedaBR(document.getElementById("precoDespesca")?.value || "0") || null;

  const erroDespesca = document.getElementById("msg-despesca-erro");
  const mostrarErroDespesca = (msg) => { if (erroDespesca) { erroDespesca.textContent = msg; erroDespesca.style.display = "block"; } };
  if (erroDespesca) erroDespesca.style.display = "none";

  // O preço é obrigatório. Enquanto era opcional, a despesca sem preço não
  // ficava "sem receita" no relatório: ela era valorizada pelo preço da
  // despesca FINAL (ver o cálculo da receita em _renderRelatorioCiclo). Uma
  // parcial vendida em junho a R$ 18 entrava a R$ 25 se o ciclo fechou em
  // setembro a R$ 25 — um chute com cara de dado, e sem aviso nenhum.
  // !(x > 0) barra vazio, zero, negativo e NaN (valores negativos furavam a
  // checagem antiga com "!x", porque número negativo é "verdadeiro" em JS).
  if (!data || !(quantidadeKg > 0) || !(pesoMedio > 0) || !(precoKg > 0)) {
    mostrarErroDespesca("Preencha a data, e quantidade, peso médio e preço maiores que zero.");
    return;
  }
  const _eDataD = _erroDataCiclo(viveiros[index], data);
  if (_eDataD) { mostrarErroDespesca(_eDataD); return; }

  const restaurar = _travarBotao(botao, "Salvando...");

  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  if (!viveiros[index].despescas) {
    viveiros[index].despescas = [];
  }

  const novaDespesca = {
    viveiro_id: viveiros[index].id,
    data: data,
    quantidade_kg: quantidadeKg,
    peso_medio: pesoMedio,
    preco_kg: precoKg,
    user_id: usuario.id,
  };

  const { data: despescaSalva, error } = await supabaseClient
    .from("despescas")
    .insert([novaDespesca])
    .select();

  if (error) {
    console.log(error);
    restaurar();
    mostrarErroDespesca("Erro ao salvar: " + error.message);
    return;
  }

  viveiros[index].despescas.push({
    id: despescaSalva[0].id,
    data: data,
    tipo: "Parcial",
    quantidadeKg: quantidadeKg,
    pesoMedio: pesoMedio,
    precoKg: precoKg,
  });

  document.getElementById("dataDespesca").value = _hojeLocal();
  document.getElementById("quantidadeDespesca").value = "";
  document.getElementById("pesoMedioDespesca").value = "";
  const _pd = document.getElementById("precoDespesca"); if (_pd) _pd.value = "";
  restaurar();

  const msgSucesso = document.getElementById("msg-despesca-sucesso");
  if (msgSucesso) {
    msgSucesso.style.display = "flex";
    setTimeout(() => { msgSucesso.style.display = "none"; }, 2500);
  }
}

// ═══ HISTÓRICOS ════════════════════════════════════════════════════════════════

function mostrarHistoricoCultivo(indexSelecionado = "") {
  esconderMenu();
  const area = document.getElementById("area-gestao");

  if (viveiros.length === 0) {
    area.innerHTML = `
      <div class="resultado-box">
        <p>Nenhum viveiro cadastrado</p>
        <span>Cadastre um viveiro para ver o histórico.</span>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">
           Voltar
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
              <option value="${index}" ${String(index) === String(indexSelecionado) ? "selected" : ""}>${_esc(viveiro.nome)}</option>
            `).join("")}
          </select>
        </div>

        <div id="opcoes-historico"></div>
        <div id="resultado-historico"></div>
  <div id="voltar-menu-historico" style="margin-top:16px">
    <button class="botao-voltar-form" onclick="voltarMenuGestao()">
       Voltar
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
        <button class="botao-voltar-form" onclick="abrirViveiro(${index})">Voltar</button>
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
        <h3 class="titulo-secao bio-titulo">Biometria - ${abreviarViveiro(viveiro.nome)}</h3>

        <div class="tabela-historico bio-tabela">
            <div class="linha-historico-acoes cabecalho">
                <span>DATA</span>
                <span class="col-centro">PESO</span>
                <span class="col-centro">CRESC.</span>
                <span class="col-centro">AÇÕES</span>
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
                      // A lista é exibida ordenada por data, mas editar e excluir
                      // indexam viveiro.biometrias, que está na ordem de cadastro.
                      // Passar a posição da tela abria/apagava outra biometria
                      // sempre que alguém lançava uma com data retroativa.
                      const iOriginal = viveiro.biometrias.findIndex(b => b.id === item.id);
                      const maisRecente = i === biometrias.length - 1;
                      return `
                        <div class="linha-historico-acoes${maisRecente ? " bio-linha-mais-recente" : ""}" id="bio-row-${index}-${iOriginal}">
                            <span class="bio-data">
                              ${maisRecente ? "<small>MAIS RECENTE</small>" : ""}
                              <b>${formatarData(item.data)}</b>
                            </span>
                            <span class="col-centro bio-peso">${fmtG(item.gramatura)} g</span>
                            <span class="col-centro bio-crescimento ${i > 0 ? "positivo" : "neutro"}">${crescimento}</span>
                            <span class="col-acoes bio-acoes">
                              <button class="botao-editar bio-acao-btn" aria-label="Editar biometria de ${formatarData(item.data)}" title="Editar" onclick="abrirEdicaoBiometria(${index}, ${iOriginal}, '${elementoId}', ${direto})">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21l4.5-1 12-12-3.5-3.5-12 12L3 21z"/><path d="M14 6l3.5 3.5"/></svg>
                              </button>
                              <button class="botao-editar botao-excluir bio-acao-btn bio-acao-excluir" aria-label="Excluir biometria de ${formatarData(item.data)}" title="Excluir" onclick="confirmarExcluirBiometria(${index}, ${iOriginal}, '${elementoId}', ${direto})">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V3h8v3"/><path d="M6 6l1 15h10l1-15"/><path d="M10 10v7M14 10v7"/></svg>
                              </button>
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
    <button class="botao-voltar-form" style="margin-top:10px" onclick="${direto ? `mostrarHistoricoDoViveiroDireto(${index})` : `voltarOpcoesHistorico()`}">Voltar</button>
    `;
}

// Peso-alvo no formato do país: 19,5 e não 19.5.
function _projAlvoTexto(v) { return String(v).replace(".", ","); }

// Botões − / + do peso-alvo. Ficou em função nomeada porque o mesmo número
// precisa ser lido e reescrito em vírgula — inline dava pra errar fácil.
function _projAjustarAlvo(index, direto, delta) {
  const inp = document.getElementById("proj-alvo");
  const atual = parseDecimalBR(inp && inp.value ? inp.value : "");
  const base = isNaN(atual) ? 20 : atual;
  verCurvaCrescimento(index, direto, Math.max(1, Math.round((base + delta) * 100) / 100));
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

  // Ganho médio de peso (g/dia) do ciclo: peso da última biometria menos o da
  // primeira, dividido pelos dias entre as duas.
  // Antes era a média simples dos intervalos, que dava o MESMO peso a um
  // intervalo de 3 dias e a um de 21 — uma biometria de conferência fora do
  // ritmo semanal entortava a previsão inteira. Com biometrias sempre
  // semanais os dois cálculos dão o mesmo número; a diferença só aparece
  // justamente quando o intervalo varia, que é quando o antigo errava.
  let gDia = 0;
  if (biometrias.length >= 2) {
    const primeira = biometrias[0];
    const ultima = biometrias[biometrias.length - 1];
    const diasEntre = Math.round((_parseDataLocal(ultima.data) - _parseDataLocal(primeira.data)) / 86400000);
    if (diasEntre > 0) gDia = (Number(ultima.gramatura) - Number(primeira.gramatura)) / diasEntre;
  }

  // Biomassa estimada (usa última ração + sobrevivência calculada)
  const racoesSorted = [...(viveiro.racoes || [])].sort((a, b) => a.data.localeCompare(b.data));
  const ultimaRacaoNaoZero = [...racoesSorted].reverse().find(r => r.racao > 0);
  const populacaoNum = viveiro.totalPovoado ? Number(String(viveiro.totalPovoado).replace(/\./g, "")) : null;
  let biomasaAlvoStr = null;
  let estimatedPopulation = null;
  // Despescas parciais já realizadas
  const _despCurva = viveiro.despescas || [];
  const _despKg = _despCurva.reduce((s, d) => s + (Number(d.quantidadeKg) || 0), 0);
  if (populacaoNum && ultimaRacaoNaoZero && pesoAtual > 0) {
    const res = _calcularBiomassa(populacaoNum, ultimaRacaoNaoZero.racao, pesoAtual);
    if (res && res.quantidade > 0) {
      // A ração atual já reflete só os camarões remanescentes (pós-despesca),
      // então res.quantidade JÁ é a população que ficou — não se desconta a despesca.
      estimatedPopulation = res.quantidade;
      // projeção na despesca = remanescentes na meta + o que já saiu
      biomasaAlvoStr = formatarNumeroBR(estimatedPopulation * alvo / 1000 + _despKg, 0) + " kg";
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
        <button class="proj-alvo-btn" onclick="_projAjustarAlvo(${index}, ${direto}, -0.5)">−</button>
        <div class="proj-alvo-val-wrap">
          <input type="text" inputmode="decimal" id="proj-alvo" value="${_projAlvoTexto(alvo)}"
            onchange="verCurvaCrescimento(${index}, ${direto}, parseDecimalBR(this.value) || 20)">
          <span>g</span>
        </div>
        <button class="proj-alvo-btn" onclick="_projAjustarAlvo(${index}, ${direto}, 0.5)">+</button>
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
    <button class="botao-voltar-form" style="margin-top:12px" onclick="renderizarHistoricoBiometria(${index},'resultado-historico',${direto})">Voltar</button>
  `;

  setTimeout(() => {
    const canvas = document.getElementById("canvas-crescimento");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    _prepararCanvasGrafico(canvas);

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

// Soma a ração por SEMANA de cultivo (S1 = dias 1-7, S2 = 8-14…) para o gráfico
// de colunas. Depende da data de povoamento; sem ela, não há semana de cultivo.
function _racaoPorSemana(viveiro) {
  const povo = viveiro && viveiro.dataPovoamento;
  if (!povo) return [];
  const acc = new Map();
  for (const r of (viveiro.racoes || [])) {
    const dia = calcularDiasCultivo(povo, r.data); // inclui o dia do povoamento (=1)
    if (!dia || dia < 1) continue;
    const semana = Math.ceil(dia / 7);
    acc.set(semana, (acc.get(semana) || 0) + (Number(r.racao) || 0));
  }
  return [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([semana, kg]) => ({ semana, kg }));
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
    ? `<button class="botao-nav-viveiro" onclick="renderizarHistoricoRacao(${index},'${elementoId}',${direto},${pagina - 1},'anterior')">Anterior</button>`
    : `<span class="botao-nav-viveiro" style="visibility:hidden">Anterior</span>`;

  const navProximo = pagina < totalPaginas - 1
    ? `<button class="botao-nav-viveiro" onclick="renderizarHistoricoRacao(${index},'${elementoId}',${direto},${pagina + 1},'proximo')">Próxima</button>`
    : `<span class="botao-nav-viveiro" style="visibility:hidden">Próxima</span>`;

  const nLanc = racoes.length;
  const media = nLanc > 0 ? totalRacao / nLanc : 0;
  const maiorDia = racoes.reduce((m, r) => Math.max(m, Number(r.racao) || 0), 0);
  const semanas = _racaoPorSemana(viveiro);

  resultado.innerHTML = `
    <h3 class="titulo-secao">Ração - ${abreviarViveiro(viveiro.nome)}</h3>

    ${racoes.length === 0 ? "" : `
    <div class="rh-resumo">
      <div class="rh-rcard"><small>Média/dia</small><strong>${formatarNumeroBR(media, 1)}<span> kg</span></strong></div>
      <div class="rh-rcard"><small>Maior dia</small><strong>${formatarNumeroBR(maiorDia, 1)}<span> kg</span></strong></div>
      <div class="rh-rcard"><small>Dias</small><strong>${nLanc}</strong></div>
    </div>`}

    ${semanas.length ? `
    <div class="rh-grafico-wrap">
      <div class="rh-grafico-tit">Consumo por semana</div>
      <div class="rh-grafico-canvas"><canvas id="canvas-racao-semana"></canvas></div>
    </div>` : ""}

    <div class="rh-lista">
      ${racoes.length === 0
        ? `<p class="sobrevivencia-texto">Nenhuma ração lançada.</p>`
        : racoesPagina.map((item) => {
            const iOriginal = viveiro.racoes.findIndex(r => r.id === item.id);
            const dia = calcularDiasCultivo(viveiro.dataPovoamento, item.data);
            return `
              <div class="rh-row" id="racao-row-${index}-${iOriginal}">
                <div class="rh-dia"><b>${dia}</b><small>dia</small></div>
                <div class="rh-mid">
                  <div class="rh-mid-top">
                    <span class="rh-kg">${formatarNumeroBR(item.racao, 1)} kg</span>
                    ${item.nomeRacao ? `<span class="rh-tipo">${_esc(item.nomeRacao)}</span>` : ""}
                  </div>
                  <div class="rh-data">${formatarData(item.data)}</div>
                </div>
                <div class="rh-acoes">
                  <button class="rh-btn edit" aria-label="Editar" onclick="abrirEdicaoRacao(${index},${iOriginal},'${elementoId}',${direto},${pagina})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                  <button class="rh-btn del" aria-label="Excluir" onclick="confirmarExcluirRacao(${index},${iOriginal},'${elementoId}',${direto},${pagina})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </div>
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

    <button class="botao-voltar-form" style="margin-top:10px" onclick="${direto ? `mostrarHistoricoDoViveiroDireto(${index})` : `voltarOpcoesHistorico()`}">Voltar</button>
  `;

  // Gráfico de colunas: consumo de ração por semana de cultivo.
  if (semanas.length) {
    setTimeout(() => {
      const cv = document.getElementById("canvas-racao-semana");
      if (!cv || typeof Chart === "undefined") return;
      _prepararCanvasGrafico(cv);
      new Chart(cv.getContext("2d"), {
        type: "bar",
        data: {
          labels: semanas.map(s => "S" + s.semana),
          datasets: [{
            data: semanas.map(s => Number(s.kg.toFixed(1))),
            backgroundColor: "rgba(6,107,99,0.85)",
            hoverBackgroundColor: "rgb(6,107,99)",
            borderRadius: 6,
            maxBarThickness: 44,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => " " + formatarNumeroBR(c.parsed.y, 1) + " kg" } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: "#6b7280", font: { size: 11, weight: "600" } } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { color: "#9ca3af", font: { size: 10 }, maxTicksLimit: 5 } },
          },
        },
      });
    }, 50);
  }

  // Animação de slide ao trocar página
  if (direcao) {
    const tabela = resultado.querySelector(".rh-lista");
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
            ${tiposRacao.map((t, i) => `<option value="${i}" ${i === tipoAtualIdx ? "selected" : ""}>${_esc(t.nome)}</option>`).join("")}
          </select>
        </div>
        ` : ""}
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Consumo de ração</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="qtdEdicaoRacao" value="${racao.racao}" placeholder="Ex: 50">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <button class="botao-salvar" onclick="_executarSalvamento(this, () => salvarEdicaoRacao(${viveiroIndex}, ${racaoIndex}, '${elementoId}', ${direto}, ${paginaAtual}))">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${acaoVoltar}">Voltar</button>
      </div>
    </div>
  `;
}

// ─── EDIÇÃO E EXCLUSÃO DE BIOMETRIAS ──────────────────────────────────────────

function abrirEdicaoBiometria(viveiroIndex, bioIndex, elementoId, direto) {
  salvarScroll();
  const viveiro = viveiros[viveiroIndex];
  const bio = viveiro.biometrias[bioIndex];

  const alvo = direto
    ? document.getElementById("area-gestao")
    : document.getElementById(elementoId);

  const acaoVoltar = direto
    ? `mostrarHistoricoDoViveiroDireto(${viveiroIndex}); abrirHistoricoBiometriaDireto(${viveiroIndex}); restaurarScroll()`
    : `renderizarHistoricoBiometria(${viveiroIndex}, '${elementoId}', ${direto}); restaurarScroll()`;

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
        <button class="botao-salvar" onclick="_executarSalvamento(this, () => salvarEdicaoBiometria(${viveiroIndex}, ${bioIndex}, '${elementoId}', ${direto}))">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${acaoVoltar}">Voltar</button>
      </div>
    </div>
  `;
}

async function salvarEdicaoBiometria(viveiroIndex, bioIndex, elementoId, direto) {
  if (_bloqueioViveiro(viveiroIndex)) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque
  const novaData = document.getElementById("dataEdicaoBio").value;
  // parseDecimalBR e não um replace de vírgula na mão: é o mesmo leitor de
  // número usado nos outros 20 campos do app, e entende ponto de milhar também.
  const novaQtd = parseDecimalBR(document.getElementById("qtdEdicaoBio").value);

  if (!novaData || !(novaQtd > 0)) { _toastErro("Preencha a data e uma gramatura maior que zero."); return; }

  // Mesma validação de data do cadastro: não pode ser no futuro nem antes do
  // início do ciclo (a edição pulava essa checagem e deixava passar).
  const _eDataEditBio = _erroDataCiclo(viveiros[viveiroIndex], novaData);
  if (_eDataEditBio) { _toastErro(_eDataEditBio); return; }

  // Impede duas biometrias na mesma data (ignora a própria que está sendo editada)
  const dataDuplicada = (viveiros[viveiroIndex].biometrias || [])
    .some((b, idx) => idx !== bioIndex && b.data === novaData);
  if (dataDuplicada) {
    _toastErro("Já existe uma biometria nessa data. Edite ou exclua a existente.");
    return;
  }

  const restaurar = _travarBotao(botao, "Salvando...");
  const bio = viveiros[viveiroIndex].biometrias[bioIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  // UPDATE de verdade. Antes daqui era DELETE + INSERT, porque a tabela não
  // tinha política de RLS para UPDATE e o banco recusava. O contorno tinha um
  // preço: entre apagar e inserir existia um instante em que a biometria não
  // existia em lugar nenhum — internet caindo ali, o dado do cliente sumia.
  // A política foi criada em 30/08/2026 e o contorno saiu.
  const { error } = await supabaseClient
    .from("biometrias")
    .update({ data: novaData, gramatura: novaQtd })
    .eq("id", bio.id)
    .eq("user_id", usuario.id);

  if (error) { console.log(error); restaurar(); _toastErro("Erro ao salvar: " + error.message); return; }

  // O id não muda mais: é a mesma linha, editada.
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
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirBiometria(${viveiroIndex}, ${bioIndex}, '${elementoId}', ${direto}, this)">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="renderizarHistoricoBiometria(${viveiroIndex}, '${elementoId}', ${direto})">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirBiometria(viveiroIndex, bioIndex, elementoId, direto, botao) {
  if (_bloqueioViveiro(viveiroIndex)) return;
  if (botao?.disabled) return;
  const restaurar = _travarBotao(botao, "Excluindo...");
  const bio = viveiros[viveiroIndex].biometrias[bioIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const { error } = await supabaseClient.from("biometrias").delete().eq("id", bio.id).eq("user_id", usuario.id);

  if (error) { console.log(error); restaurar(); _toastErro("Erro ao excluir."); return; }

  viveiros[viveiroIndex].biometrias.splice(bioIndex, 1);
  renderizarHistoricoBiometria(viveiroIndex, elementoId, direto);
  restaurarScroll();
}

// ─── EDIÇÃO E EXCLUSÃO DE DESPESCAS ───────────────────────────────────────────

function abrirEdicaoDespesca(viveiroIndex, despIndex, elementoId, direto) {
  salvarScroll();
  const viveiro = viveiros[viveiroIndex];
  const desp = viveiro.despescas[despIndex];

  const alvo = direto
    ? document.getElementById("area-gestao")
    : document.getElementById(elementoId);

  const acaoVoltar = direto
    ? `mostrarHistoricoDoViveiroDireto(${viveiroIndex}); abrirHistoricoDespescaDireto(${viveiroIndex}); restaurarScroll()`
    : `renderizarHistoricoDespesca(${viveiroIndex}, '${elementoId}', ${direto}); restaurarScroll()`;

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
            <input type="text" inputmode="decimal" id="qtdEdicaoDesp" value="${desp.quantidadeKg}" placeholder="Ex: 500">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
            <label>Peso médio</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="pesoEdicaoDesp" value="${desp.pesoMedio}" placeholder="Ex: 12">
            <span class="campo-unidade">g</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Preço de venda por kg</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="precoEdicaoDesp" value="${desp.precoKg ? formatarNumeroBR(desp.precoKg, 2) : ""}" placeholder="Ex: 16,00" onblur="formatarMoedaBlur(this)">
            <span class="campo-unidade">R$</span>
          </div>
        </div>
        <button class="botao-salvar" onclick="_executarSalvamento(this, () => salvarEdicaoDespesca(${viveiroIndex}, ${despIndex}, '${elementoId}', ${direto}))">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${acaoVoltar}">Voltar</button>
      </div>
    </div>
  `;
}

async function salvarEdicaoDespesca(viveiroIndex, despIndex, elementoId, direto) {
  if (_bloqueioViveiro(viveiroIndex)) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque
  const novaData = document.getElementById("dataEdicaoDesp").value;
  const novaQtd = parseDecimalBR(document.getElementById("qtdEdicaoDesp").value);
  const novoPeso = parseDecimalBR(document.getElementById("pesoEdicaoDesp").value);
  const novoPreco = parseMoedaBR(document.getElementById("precoEdicaoDesp")?.value || "0") || null;

  // Preço também é obrigatório aqui: se fosse exigido só no lançamento, dava
  // para apagá-lo depois abrindo a edição — e a despesca voltaria a ser
  // valorizada pelo preço da despesca final.
  if (!novaData || !(novaQtd > 0) || !(novoPeso > 0) || !(novoPreco > 0)) { _toastErro("Preencha todos os campos com valores maiores que zero, inclusive o preço."); return; }

  const restaurar = _travarBotao(botao, "Salvando...");
  const desp = viveiros[viveiroIndex].despescas[despIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  // UPDATE de verdade — ver a nota em salvarEdicaoBiometria. Aqui o contorno
  // era ainda mais arriscado: a despesca carrega quantidade, peso e preço, e
  // é dela que saem produção, FCA e receita do ciclo.
  const { error } = await supabaseClient
    .from("despescas")
    .update({
      data: novaData,
      quantidade_kg: novaQtd,
      peso_medio: novoPeso,
      preco_kg: novoPreco,
    })
    .eq("id", desp.id)
    .eq("user_id", usuario.id);

  if (error) { console.log(error); restaurar(); _toastErro("Erro ao salvar: " + error.message); return; }

  viveiros[viveiroIndex].despescas[despIndex].data = novaData;
  viveiros[viveiroIndex].despescas[despIndex].quantidadeKg = novaQtd;
  viveiros[viveiroIndex].despescas[despIndex].pesoMedio = novoPeso;
  viveiros[viveiroIndex].despescas[despIndex].precoKg = novoPreco;

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
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirDespesca(${viveiroIndex}, ${despIndex}, '${elementoId}', ${direto}, this)">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="renderizarHistoricoDespesca(${viveiroIndex}, '${elementoId}', ${direto})">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirDespesca(viveiroIndex, despIndex, elementoId, direto, botao) {
  if (_bloqueioViveiro(viveiroIndex)) return;
  if (botao?.disabled) return;
  const restaurar = _travarBotao(botao, "Excluindo...");
  const desp = viveiros[viveiroIndex].despescas[despIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const { error } = await supabaseClient.from("despescas").delete().eq("id", desp.id).eq("user_id", usuario.id);

  if (error) { console.log(error); restaurar(); _toastErro("Erro ao excluir."); return; }

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
  if (_bloqueioViveiro(viveiroIndex)) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque
  const novaData = document.getElementById("dataEdicaoRacao").value;
  const novaQtd = parseDecimalBR(document.getElementById("qtdEdicaoRacao").value);

  if (!novaData || isNaN(novaQtd) || novaQtd < 0) {
    _toastErro("Preencha a data e a quantidade (pode ser 0).");
    return;
  }

  // Mesmas validações do cadastro (a edição pulava as duas): a data não pode
  // ser futura nem anterior ao início do ciclo, e não pode haver dois
  // lançamentos de ração no mesmo dia (ignora o próprio, que está sendo editado).
  const _eDataEditR = _erroDataCiclo(viveiros[viveiroIndex], novaData);
  if (_eDataEditR) { _toastErro(_eDataEditR); return; }
  const _dupEditR = (viveiros[viveiroIndex].racoes || [])
    .some((r, idx) => idx !== racaoIndex && r.data.substring(0, 10) === novaData);
  if (_dupEditR) { _toastErro(`Já existe um lançamento em ${formatarData(novaData)}. Edite o existente.`); return; }

  const restaurar = _travarBotao(botao, "Salvando...");
  const racao = viveiros[viveiroIndex].racoes[racaoIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const novoTipoIdx = document.getElementById("tipoRacaoEdicaoSelect")?.value;
  const novoTipo = (novoTipoIdx !== "" && novoTipoIdx !== undefined)
    ? tiposRacao[novoTipoIdx] : null;

  // UPDATE de verdade — ver a nota em salvarEdicaoBiometria.
  const { error } = await supabaseClient
    .from("racoes")
    .update({
      data: novaData,
      racao: novaQtd,
      nome_racao: novoTipo ? novoTipo.nome : null,
      tipo_racao_id: novoTipo ? novoTipo.id : null,
    })
    .eq("id", racao.id)
    .eq("user_id", usuario.id);

  if (error) { restaurar(); _toastErro("Erro ao salvar: " + error.message); return; }

  // A data antiga é lida ANTES de sobrescrever o objeto: é ela que diz de qual
  // dia os custos automáticos de protocolo precisam ser refeitos, logo abaixo.
  const dataAntiga = racao.data;
  viveiros[viveiroIndex].racoes[racaoIndex] = {
    id: racao.id, data: novaData, racao: novaQtd,
    nomeRacao: novoTipo ? novoTipo.nome : null,
    tipoRacaoId: novoTipo ? novoTipo.id : null,
  };

  // Os protocolos atrelados à ração dosam por kg lançado: ao corrigir o
  // lançamento, o custo automático precisa ser refeito, senão continua cobrando
  // pela quantidade antiga. Limpa a data antiga (e a nova, se mudou) e reaplica.
  let _protFalhasEd = [];
  try {
    await _removerCustosAutoRacao(viveiroIndex, dataAntiga);
    if (novaData !== dataAntiga) await _removerCustosAutoRacao(viveiroIndex, novaData);
    if (novaQtd > 0) {
      const _pr = await _aplicarProtocolosRacao(viveiroIndex, novaQtd, novaData);
      _protFalhasEd = _pr.falhas || [];
    }
  } catch (e) { console.log("Protocolo ração (edição):", e); _protFalhasEd = ["protocolo automático"]; }
  if (_protFalhasEd.length) {
    setTimeout(() => _toastErro("Ração atualizada, mas o custo automático de " + _protFalhasEd.join(", ") + " não entrou. Confira a conexão e relance o protocolo."), 900);
  }

  // Custo de ração derivado dos lançamentos — recalcula em memória
  _montarCustoRacaoVirtual();

  if (direto) {
    voltarParaHistoricoRacaoDireto(viveiroIndex, paginaAtual);
  } else {
    mostrarHistoricoCultivo(viveiroIndex);
    abrirHistoricoRacao(paginaAtual);
  }
  restaurarScroll();
}

// Ração derivada de um viveiro: preço do catálogo × kg lançados no ciclo
// ativo. Fonte única usada pelo registro em memória E pelo congelamento no
// encerramento — os dois nunca podem divergir.
function _racaoDerivada(v) {
  const lancs = (v.racoes || []).filter(r => r.tipoRacaoId && r.racao > 0);
  if (!lancs.length) return null;
  const qtdG = lancs.reduce((s, r) => s + r.racao * 1000, 0);
  const valor = lancs.reduce((s, r) => {
    const t = tiposRacao.find(x => x.id === r.tipoRacaoId);
    return s + r.racao * (t ? (t.custoPorKg || 0) : 0);
  }, 0);
  return { qtdG, valor, data: lancs.map(r => r.data).sort()[0] };
}

// Custo de "Ração" é sempre DERIVADO dos lançamentos. Este helper (re)monta um
// registro em memória por viveiro (marcado com `derivado: true` — a flag
// `virtual` é reservada ao rateio de custo fixo no financeiro) e descarta
// registros gravados de Ração do ciclo ativo (o modelo antigo acumulava no
// banco e divergia). Registros de ciclos ENCERRADOS permanecem como estão.
function _montarCustoRacaoVirtual() {
  for (const v of viveiros) {
    const cicloId = v.cicloId || null;
    const ini = v.dataPreparacao || v.dataPovoamento || null;
    v.custos = (v.custos || []).filter(c => {
      if (c.derivado) return false; // remonta sempre
      if (!(c.categoria === "Ração" && c.nomeProduto === "Ração")) return true;
      if (cicloId && (c.cicloId || null) === cicloId) return false;   // substituído pelo derivado
      if (!c.cicloId && ini && c.data >= ini) return false;           // cairia na janela do ciclo ativo
      return true;
    });
    const der = _racaoDerivada(v);
    if (!der) continue;
    v.custos.push({
      id: null, derivado: true, tipo: "produto", produtoId: null,
      nomeProduto: "Ração", quantidadeG: der.qtdG, valor: der.valor,
      categoria: "Ração", data: der.data,
      observacao: null, cicloId,
    });
  }
}

function confirmarExcluirRacao(viveiroIndex, racaoIndex, elementoId, direto, pagina = 0) {
  const row = document.getElementById(`racao-row-${viveiroIndex}-${racaoIndex}`);
  if (!row) return;
  row.innerHTML = `
    <div class="confirmar-exclusao-custo" style="grid-column:1/-1">
      <span>Excluir este lançamento de ração?</span>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirRacao(${viveiroIndex},${racaoIndex},'${elementoId}',${direto},${pagina},this)">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="renderizarHistoricoRacao(${viveiroIndex},'${elementoId}',${direto},${pagina})">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirRacao(viveiroIndex, racaoIndex, elementoId, direto, pagina = 0, botao) {
  if (_bloqueioViveiro(viveiroIndex)) return;
  if (botao?.disabled) return;
  const racao = viveiros[viveiroIndex].racoes[racaoIndex];

  if (!racao || !racao.id) {
    _toastErro("Erro: lançamento sem ID.");
    return;
  }

  const restaurar = _travarBotao(botao, "Excluindo...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const { data: deletado, error } = await supabaseClient
    .from("racoes")
    .delete()
    .eq("id", racao.id)
    .eq("user_id", usuario.id)
    .select();

  if (error) {
    console.log(error);
    restaurar();
    _toastErro("Erro ao excluir lançamento.");
    return;
  }

  if (!deletado || deletado.length === 0) {
    restaurar();
    _toastErro("Não foi possível excluir. Verifique sua conexão ou permissão.");
    return;
  }

  const dataExcluida = racao.data;
  viveiros[viveiroIndex].racoes.splice(racaoIndex, 1);

  // Sem o lançamento de ração, o custo que os protocolos dosaram a partir dele
  // não tem mais razão de existir — ficaria órfão inflando o custo do ciclo.
  try { await _removerCustosAutoRacao(viveiroIndex, dataExcluida); }
  catch (e) { console.log("Protocolo ração (exclusão):", e); }

  // Custo de ração derivado dos lançamentos — recalcula em memória
  _montarCustoRacaoVirtual();

  const paginaAjustada = Math.min(pagina, Math.max(0, Math.ceil((viveiros[viveiroIndex].racoes.length) / 30) - 1));
  renderizarHistoricoRacao(viveiroIndex, elementoId, direto, paginaAjustada);
  restaurarScroll();
}

// ═══ CICLOS ════════════════════════════════════════════════════════════════════

function reiniciarCiclo(index) {
  mostrarFormularioReinicio(index);
}

function mostrarFormularioReinicio(index, modo = "reiniciar") {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const hoje = _hojeLocal();
  const povoar = modo === "povoar";

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo" style="${povoar ? "" : "background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.2)"}">
          ${povoar
            ? `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>`
            : `<svg viewBox="0 0 24 24" style="stroke:#ef4444"><polyline points="23 4 23 10 17 10"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>`}
        </div>
        <span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>
        <h2 class="form-titulo">${povoar ? "Povoar Viveiro" : "Reiniciar Ciclo"}</h2>
      </div>
      ${povoar ? "" : `<div class="aviso-reinicio">
        <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:#b45309;fill:none;stroke-width:2;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>Todo o histórico de ração, biometrias e despescas será <strong>apagado</strong>.</span>
      </div>`}
      <div class="form-corpo">
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <label>${povoar ? "Data de povoamento" : "Nova data de povoamento"}</label>
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
        <button class="botao-salvar ${povoar ? "" : "botao-alerta"}" onclick="salvarNovoCiclo(${index}, '${modo}')">
          ${povoar
            ? `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg> Povoar viveiro`
            : `<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg> Confirmar reinício`}
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirViveiro(${index})">Cancelar</button>
      </div>
    </div>
  `;
}

// CORREÇÃO: salvarNovoCiclo agora salva no banco de dados
async function salvarNovoCiclo(index, modo = "reiniciar") {
  if (_bloqueioViveiro(index)) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque

  const novoPovoamento = document.getElementById("novoPovoamento").value;
  const novoTotal = document.getElementById("novoTotal").value.replace(/\D/g, "");
  const novoLaboratorio = document.getElementById("novoLaboratorio").value;

  const erroReinicio = document.getElementById("msg-reinicio-erro");
  const mostrarErroReinicio = (msg) => { if (erroReinicio) { erroReinicio.textContent = msg; erroReinicio.style.display = "block"; } };
  if (erroReinicio) erroReinicio.style.display = "none";

  if (!novoPovoamento || !novoTotal || !novoLaboratorio) {
    mostrarErroReinicio("Preencha todos os campos.");
    return;
  }

  const restaurar = _travarBotao(botao, "Salvando...");

  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  // Povoar (prep cultivo) continua o MESMO ciclo (mantém o ciclo_id da preparação,
  // para os custos de preparação seguirem no ciclo). Reiniciar começa um ciclo novo.
  const povoar = modo === "povoar";
  const novoCicloId = povoar ? (viveiros[index].cicloId || _novoCicloId()) : _novoCicloId();

  // Reinício ATÔMICO via RPC (função reiniciar_ciclo no Postgres): apagar os
  // registros do ciclo anterior e avançar o viveiro para o ciclo novo acontecem
  // na MESMA transação — ou tudo, ou nada. Assim uma queda de internet no meio
  // nunca deixa um ciclo novo convivendo com rações/biometrias velhas (que
  // voltariam "coladas" no ciclo atual, pois na abertura os lançamentos são lidos
  // por viveiro_id). Num erro, nada muda no banco e a tela não avança.
  const { error } = await supabaseClient.rpc("reiniciar_ciclo", {
    p_viveiro: viveiros[index].id,
    p_povoamento: novoPovoamento,
    p_total: novoTotal,
    p_laboratorio: novoLaboratorio,
    p_ciclo_id: novoCicloId,
  });

  if (error) {
    console.log(error);
    restaurar();
    mostrarErroReinicio("Erro ao salvar o novo ciclo. Tente novamente.");
    return;
  }

  // Atualizar estado local (só depois do sucesso completo no banco)
  viveiros[index].dataPovoamento = novoPovoamento;
  viveiros[index].totalPovoado = novoTotal;
  viveiros[index].laboratorio = novoLaboratorio;
  viveiros[index].cicloId = novoCicloId;
  // Espelha o que a RPC faz: reiniciar (ciclo novo) zera a data de preparação
  // pra o rateio começar no povoamento, não na preparação do ciclo anterior;
  // povoar (mesmo ciclo) mantém a preparação. Sem isto, o estado local ficaria
  // com a data antiga até um recarregar.
  if (!povoar) viveiros[index].dataPreparacao = null;
  viveiros[index].racoes = [];
  viveiros[index].biometrias = [];
  viveiros[index].despescas = [];
  _montarCustoRacaoVirtual(); // zera o custo de ração derivado do ciclo novo

  abrirViveiro(index);
}

function confirmarExcluirViveiro(index) {
  const painel = document.getElementById(`confirmar-excluir-viveiro-${index}`);
  if (painel) painel.style.display = painel.style.display === "none" ? "block" : "none";
}

async function excluirViveiro(index, botao) {
  if (_bloqueioEdicao()) return;
  if (botao?.disabled) return; // trava contra duplo toque
  const viveiro = viveiros[index];
  if (!viveiro) return;

  const restaurar = _travarBotao(botao, "Excluindo...");

  // Filtra também por user_id: cinto + suspensório com o RLS, pra ninguém
  // conseguir apagar viveiro de outra conta nem que a política falhe.
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const { error } = await supabaseClient
    .from("viveiros")
    .update({ ativo: false })
    .eq("id", viveiro.id)
    .eq("user_id", usuario.id);

  if (error) {
    console.log(error);
    restaurar();
    _toastErro("Erro ao excluir viveiro.");
    return;
  }

  // Remove do estado local em vez de recarregar tudo do banco
  const pos = viveiros.findIndex(v => v.id === viveiro.id);
  if (pos >= 0) viveiros.splice(pos, 1);

  if (viveiros.length === 0) {
    mostrarListaViveiros();
    _toastSucesso(`Viveiro "${viveiro.nome}" excluído.`);
    return;
  }
  mostrarListaViveiros(0, "", `Viveiro "${_esc(viveiro.nome)}" excluído com sucesso.`);
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
                    .map((item) => {
                      // Mesmo cuidado da biometria: a tela ordena por data, mas
                      // editar/excluir/detalhe indexam viveiro.despescas, que está
                      // na ordem de cadastro.
                      const iOriginal = viveiro.despescas.findIndex(d => d.id === item.id);
                      return `
                    <div class="linha-historico-acoes despesca-clicavel" id="desp-row-${index}-${iOriginal}" onclick="_toggleDetalheDespesca(${index}, ${iOriginal})" title="Toque para ver o detalhe">
                        <span>${formatarData(item.data)}</span>
                        <span class="col-centro">${formatarNumeroBR(item.quantidadeKg, 1)} kg</span>
                        <span class="col-centro">${formatarNumeroBR(item.pesoMedio, 1)} g</span>
                        <span class="col-acoes">
                          <button class="botao-editar" onclick="event.stopPropagation(); abrirEdicaoDespesca(${index}, ${iOriginal}, '${elementoId}', ${direto})">✏️</button>
                          <button class="botao-editar botao-excluir" onclick="event.stopPropagation(); confirmarExcluirDespesca(${index}, ${iOriginal}, '${elementoId}', ${direto})">🗑️</button>
                        </span>
                    </div>
                `;
                    })
                    .join("")
            }
        </div>

    <div class="total-chip">
      <span class="total-chip-label">Total despescado</span>
      <span class="total-chip-valor">${formatarNumeroBR(totalDespescado, 1)} kg</span>
    </div>

    <button class="botao-voltar-form" style="margin-top:10px" onclick="${direto ? `mostrarHistoricoDoViveiroDireto(${index})` : `voltarOpcoesHistorico()`}">Voltar</button>
    `;
}

// Abre/fecha o detalhe de uma despesca ao tocar na linha
function _toggleDetalheDespesca(index, i) {
  const row = document.getElementById(`desp-row-${index}-${i}`);
  if (!row) return;
  const jaAberto = document.getElementById(`desp-det-${index}-${i}`);
  document.querySelectorAll(".despesca-detalhe").forEach(e => e.remove());
  if (jaAberto) return; // clicou no que já estava aberto só fecha

  const viveiro = viveiros[index];
  // 'i' é o índice no array ORIGINAL (viveiro.despescas), o mesmo que a linha e
  // o botão de editar/excluir usam. NÃO reordenar aqui: se ordenasse por data,
  // este índice apontaria para outra despesca e o detalhe mostraria os números
  // de um registro diferente do que foi tocado.
  const d = (viveiro.despescas || [])[i];
  if (!d) return;
  const kg = Number(d.quantidadeKg) || 0;
  const peso = Number(d.pesoMedio) || 0;
  const preco = Number(d.precoKg) || 0;
  const animais = peso > 0 ? Math.round(kg / (peso / 1000)) : null;
  const total = preco > 0 ? kg * preco : null;

  const det = document.createElement("div");
  det.id = `desp-det-${index}-${i}`;
  det.className = "despesca-detalhe";
  det.innerHTML = `
    <div class="dd-row"><span>Data</span><b>${formatarData(d.data)}</b></div>
    <div class="dd-row"><span>Quantidade despescada</span><b>${formatarNumeroBR(kg, 1)} kg</b></div>
    <div class="dd-row"><span>Peso médio</span><b>${formatarNumeroBR(peso, 1)} g</b></div>
    <div class="dd-row"><span>Nº de camarões</span><b>${animais != null ? formatarNumeroBR(animais, 0) : "—"}</b></div>
    <div class="dd-row"><span>Preço de venda</span><b>${preco > 0 ? "R$ " + formatarNumeroBR(preco, 2) + "/kg" : "— não informado"}</b></div>
    <div class="dd-row dd-total"><span>Total faturado</span><b>${total != null ? "R$ " + formatarNumeroBR(total, 2) : "—"}</b></div>
  `;
  row.after(det);
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

// ═══ NUMERAÇÃO DOS CICLOS (Ciclo 1, 2, 3… por viveiro) ═══════════════════════
// O número é a POSIÇÃO cronológica do ciclo na vida do viveiro. É calculado na
// hora a partir do histórico (não gravado): assim os ciclos que já existem ficam
// numerados de imediato e nada muda no banco. Quando os relatórios de comparação
// chegarem, aí vale congelar esse número numa coluna — esta ordem é a base.

// Ciclos ENCERRADOS do viveiro em ordem cronológica (do 1º ao mais recente).
function _ciclosEncerradosOrdenados(viveiro) {
  return [...((viveiro && viveiro.ciclosFinalizados) || [])].sort((a, b) =>
    (a.dataEncerramento || a.dataPovoamento || "").localeCompare(b.dataEncerramento || b.dataPovoamento || "")
    || (a.dataPovoamento || "").localeCompare(b.dataPovoamento || "")
  );
}

// Número (1-based) de um ciclo ENCERRADO. Casa por ciclo_id quando há; senão,
// pela identidade do objeto (ciclos legados sem id ainda ficam numerados).
function _numeroCicloEncerrado(viveiro, ciclo) {
  if (!viveiro || !ciclo) return null;
  const ord = _ciclosEncerradosOrdenados(viveiro);
  const i = ord.findIndex(c => (ciclo.cicloId && c.cicloId) ? c.cicloId === ciclo.cicloId : c === ciclo);
  return i >= 0 ? i + 1 : null;
}

// Número do ciclo ATUAL (em andamento) = quantos já encerraram + 1.
function _numeroCicloAtual(viveiro) {
  return (((viveiro && viveiro.ciclosFinalizados) || []).length) + 1;
}

function mostrarHistoricoCiclos() {
  esconderMenu();
  const area = document.getElementById("area-gestao");

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
      <button class="botao-voltar-form" onclick="voltarMenuGestao()">Voltar</button>
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
        <span class="ciclo-card-nome">${item.viveiro}${(() => { const n = _numeroCicloEncerrado(viveiros[item.viveiroIndex], item.ciclo); return n ? ` · Ciclo ${n}` : ""; })()}</span>
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
          <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirCiclo(${item.viveiroIndex}, ${item.cicloIndex}, this)">Sim, excluir</button>
          <button class="ciclo-btn-relatorio" style="flex:1" onclick="cancelarExcluirCiclo(${item.viveiroIndex}, ${item.cicloIndex})">Cancelar</button>
        </div>
      </div>
    </div>
  `).join("") + `<button class="botao-voltar-form" style="margin-top:8px" onclick="voltarMenuGestao()">Voltar</button>`;
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

async function excluirCiclo(viveiroIndex, cicloIndex, botao) {
  if (_bloqueioEdicao()) return;
  if (botao?.disabled) return;
  const viveiro = viveiros[viveiroIndex];
  const ciclo = viveiro.ciclosFinalizados[cicloIndex];

  const restaurar = _travarBotao(botao, "Excluindo...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

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
    restaurar();
    const div = document.getElementById(`confirm-excluir-${viveiroIndex}-${cicloIndex}`);
    if (div) {
      const aviso = document.createElement("p");
      aviso.style.cssText = "color:#dc2626;font-size:13px;margin:0";
      aviso.textContent = "Erro: " + error.message;
      div.replaceChildren(aviso);
    }
    return;
  }

  if (!deletado || deletado.length === 0) {
    restaurar();
    const div = document.getElementById(`confirm-excluir-${viveiroIndex}-${cicloIndex}`);
    if (div) div.innerHTML = `<p style="color:#dc2626;font-size:13px;margin:0">Não foi possível excluir. Verifique as permissões no Supabase (RLS da tabela ciclos).</p>`;
    return;
  }

  viveiro.ciclosFinalizados.splice(cicloIndex, 1);
  mostrarHistoricoCiclos();
}

// ═══ BOLETOS A VENCER ══════════════════════════════════════════════════════════

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
  const alertas = boletos
    .filter(b => !b.pago)
    .map(b => ({ b, st: _statusBoleto(b.dataCompra, b.prazoDias) }))
    .filter(x => x.st.tipo !== "ok");
  if (!alertas.length) return;
  // Ao tocar no aviso, vai DIRETO pros boletos — já filtrado pelo que precisa de atenção
  const temVencido = alertas.some(x => x.st.tipo === "vencido");
  const temVencendo = alertas.some(x => x.st.tipo === "hoje" || x.st.tipo === "proximo");
  const filtroBanner = temVencido && temVencendo ? "todos" : (temVencido ? "vencidos" : "vencendo");
  const area = document.getElementById("area-gestao");
  const existente = document.getElementById("banner-boletos-alerta");
  if (existente) existente.remove();
  const div = document.createElement("div");
  div.id = "banner-boletos-alerta";
  div.innerHTML = `
    <div class="boleto-banner" onclick="abrirBoletos('${filtroBanner}')">
      <div class="boleto-banner-icone">
        <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="boleto-banner-texto">
        <strong>${alertas.length} boleto${alertas.length > 1 ? "s" : ""} ${alertas.length > 1 ? "precisam" : "precisa"} de atenção</strong>
        <span>${_esc(alertas.map(x => x.b.nome).join(", "))}</span>
      </div>
      <span class="boleto-banner-seta">›</span>
    </div>
  `;
  area.insertBefore(div, area.firstChild);
}

// Menu "Lançar custo" (antigo botao Insumos). Reune Energia e Custos fixos
// (que sairam do Financeiro). Produto cadastrado / Outro custo entram na 3b.
function abrirMenuCusto() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <h2 class="form-titulo">Lançar Custo</h2>
      </div>
      <div class="form-corpo">
        <div class="historico-opcoes-grid">
          <button class="botao-historico-opcao" onclick="abrirLancarCustoProduto()">
            <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Lançar insumos
          </button>
          <button class="botao-historico-opcao" onclick="abrirCustosFixos()">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
            Custos fixos
          </button>
          <button class="botao-historico-opcao" onclick="abrirEnergia()">
            <svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Energia
          </button>
          <button class="botao-historico-opcao" onclick="abrirLancarOutroCusto()">
            <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Outro custo
          </button>
        </div>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">Voltar</button>
      </div>
    </div>
  `;
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
      </div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="voltarMenuGestao()">Voltar</button>
    </div>
  `;
}

// ═══ ASSINATURA E PLANOS ═══════════════════════════════════════════════════════
// Contratação manual via WhatsApp: cliente chama, paga por Pix e o admin
// libera pelo painel /admin. Número obrigatório (DDI+DDD+número).
const _WHATSAPP_COMERCIAL = "5588992498067";

// Link único de contratação — mensagem e número num lugar só.
function _linkWhatsAppPlano(nomePlano, ciclo) {
  const msg = encodeURIComponent(`Olá! Quero assinar o plano ${nomePlano} (${ciclo || "mensal"}) do WA Aqua Gestão. 🦐`);
  return `https://wa.me/${_WHATSAPP_COMERCIAL}?text=${msg}`;
}

const _PLANOS_APP = [
  { key: "basico",        nome: "Básico",        viveiros: "2 a 5 viveiros", mensal: 50,  anual: 500 },
  { key: "intermediario", nome: "Intermediário", viveiros: "até 10 viveiros", mensal: 100, anual: 1000 },
  { key: "avancado",      nome: "Avançado",      viveiros: "até 20 viveiros", mensal: 300, anual: 3000 },
  { key: "pro",           nome: "Pro",           viveiros: "viveiros ilimitados", mensal: 500, anual: 5000 },
];

function _planoLabel(key) {
  const p = _PLANOS_APP.find(x => x.key === key);
  return p ? p.nome : "Grátis";
}

// ─── CONTROLE DO MODO SOMENTE LEITURA ─────────────────────────────────────────
// Regra do produto:
//  • 1 viveiro é grátis para sempre. A partir do 2º, precisa de um plano.
//  • Se o pagamento de um plano pago parar, a conta entra em "somente leitura":
//    a pessoa continua vendo TUDO (relatórios, ração, biometria, histórico),
//    mas não consegue lançar nem editar até regularizar.
//  • Há uma carência de alguns dias após o vencimento antes de travar.
const _DIAS_CARENCIA = 5;

// Limite de viveiros de cada plano (espelha a Edge Function admin-clientes)
const _LIMITES_PLANO = { gratis: 1, basico: 5, intermediario: 10, avancado: 20, pro: 999999 };

// Converte "YYYY-MM-DD" (ou timestamp) numa Data local à meia-noite, ou null.
function _parseVenc(str) {
  if (!str) return null;
  const d = _parseDataLocal(str);
  return isNaN(d.getTime()) ? null : d;
}

// Pagamento pendente ainda dentro da carência? (não pune enquanto o
// vencimento não passou de _DIAS_CARENCIA; sem vencimento conhecido, não pune)
function _dentroDaCarencia(a) {
  if (!a || a.status !== "pendente") return false;
  const venc = _parseVenc(a.proximo_vencimento);
  if (!venc) return true;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return Math.floor((hoje - venc) / 86400000) <= _DIAS_CARENCIA;
}

// Limite de viveiros do plano vigente. Grátis / plano pago bloqueado = 1.
// O plano pago vale enquanto está ativo OU pendente dentro da carência
// (a carência protege o limite por viveiro igual protege a trava geral).
// Se o campo limite_viveiros vier vazio (linhas antigas), usa o limite
// padrão do plano — nunca rebaixa um pagante em dia para o grátis.
function _planoLimiteEfetivo() {
  const a = assinatura;
  if (a && a.plano && a.plano !== "gratis" && (a.status === "ativo" || _dentroDaCarencia(a))) {
    const lim = Number(a.limite_viveiros);
    if (lim > 0) return lim;
    return _LIMITES_PLANO[a.plano] || 1;
  }
  return 1; // free tier
}

// A conta está em modo somente leitura?
// Só trava plano PAGO cujo pagamento parou (pendente/cancelado) e que já
// passou da carência. Nunca trava quem está no grátis nem quem está em dia.
function _contaBloqueada() {
  const a = assinatura;
  if (!a) return false;                                // sem assinatura não trava
  if (!a.plano || a.plano === "gratis") return false;  // grátis não trava
  if (a.status === "ativo") return false;              // pagamento em dia
  if (viveiros.length <= 1) return false;              // dentro do grátis (1 viveiro)
  if (a.status === "cancelado") return true;           // assinatura cancelada só leitura
  return !_dentroDaCarencia(a);                        // pendente: trava só após a carência
}

// Guarda de escrita GLOBAL: retorna true (e avisa) quando a conta inteira
// está travada (plano pago vencido). Usado em funções que não são de um
// viveiro específico (catálogos, boletos, custos fixos, produtos).
function _bloqueioEdicao() {
  if (_contaBloqueada()) {
    _toastErro("Conta em modo somente leitura. Regularize o pagamento para lançar ou editar.");
    return true;
  }
  return false;
}

// Um viveiro (pela POSIÇÃO na lista ordenada) está fora do limite do plano?
// Ex.: no grátis (limite 1), só o 1º viveiro fica liberado; do 2º em diante
// fica em modo leitura, mesmo já estando cadastrado.
function _viveiroForaDoLimite(idx) {
  const i = Number(idx);
  if (!Number.isFinite(i) || i < 0) return false;
  return i >= _planoLimiteEfetivo();
}

// Guarda de escrita POR VIVEIRO: bloqueia se a conta está travada OU se este
// viveiro específico está além do limite do plano.
function _bloqueioViveiro(idx) {
  if (_contaBloqueada()) {
    _toastErro("Conta em modo somente leitura. Regularize o pagamento para lançar ou editar.");
    return true;
  }
  if (_viveiroForaDoLimite(idx)) {
    _toastErro(`Viveiro bloqueado no seu plano. Assine um plano em "Meu plano" para liberar este viveiro.`);
    return true;
  }
  return false;
}

// Banner de aviso no menu quando a conta está em somente leitura.
function _mostrarBannerLeitura() {
  const area = document.getElementById("area-gestao");
  if (!area) return;
  const existente = document.getElementById("banner-leitura");
  if (existente) existente.remove();
  if (!_contaBloqueada()) return;
  const div = document.createElement("div");
  div.id = "banner-leitura";
  div.innerHTML = `
    <div class="leitura-banner" onclick="abrirAssinatura()">
      <div class="leitura-banner-icone">
        <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <div class="leitura-banner-texto">
        <strong>Modo somente leitura</strong>
        <span>Você continua vendo tudo. Para voltar a lançar e editar, regularize seu plano.</span>
      </div>
      <span class="leitura-banner-seta">›</span>
    </div>`;
  area.insertBefore(div, area.firstChild);
}

function abrirAssinatura() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  const a = assinatura || { plano: "gratis", status: "ativo" };
  const ehGratis = !a.plano || a.plano === "gratis";

  // Bloco de status unificado (plano atual + info do grátis, sem repetir aviso)
  let statusL1, statusL2, statusCls;
  if (a.status === "ativo" && !ehGratis) {
    statusL1 = `Plano atual: <b>${_planoLabel(a.plano)}</b>`;
    statusL2 = a.ciclo ? `Cobrança ${a.ciclo} · ativa` : "Assinatura ativa";
    statusCls = "ok";
  } else if (a.status === "pendente") {
    statusL1 = `Plano atual: <b>${_planoLabel(a.plano)}</b>`;
    statusL2 = "Pagamento pendente — libera assim que confirmar";
    statusCls = "pend";
  } else if (a.status === "cancelado") {
    statusL1 = `Plano atual: <b>Grátis</b>`;
    statusL2 = "Assinatura cancelada — escolha um plano para reativar";
    statusCls = "free";
  } else {
    statusL1 = `Plano atual: <b>Grátis</b>`;
    statusL2 = "1 viveiro ativo · sem cobrança";
    statusCls = "free";
  }

  const ciclo = _planosCiclo;
  const cards = _PLANOS_APP.map(p => {
    // "Plano atual" só no ciclo que a pessoa realmente assinou (mensal OU anual).
    // Se a assinatura antiga não tiver ciclo gravado, mantém o comportamento antigo.
    const atual = a.plano === p.key && a.status === "ativo" && (!a.ciclo || a.ciclo === ciclo);
    let precoBloco;
    if (ciclo === "anual") {
      const equiv = p.anual / 12;
      const economia = p.mensal * 12 - p.anual;
      precoBloco = `
        <div class="plano-preco">R$ ${formatarNumeroBR(p.anual, 0)}<small>por ano</small></div>
        <div class="plano-preco-sub">equivale a R$ ${formatarNumeroBR(equiv, 2)}/mês</div>
        <div class="plano-economia">economia de R$ ${formatarNumeroBR(economia, 0)} no ano</div>`;
    } else {
      precoBloco = `<div class="plano-preco">R$ ${formatarNumeroBR(p.mensal, 0)}<small>por mês</small></div>`;
    }
    const rodape = atual
      ? `<div class="plano-atual-tag">✓ Plano atual</div>`
      : `<a class="plano-btn" style="display:block;text-align:center;text-decoration:none" href="${_linkWhatsAppPlano(p.nome, ciclo)}" target="_blank" rel="noopener">Assinar pelo WhatsApp</a>`;
    return `
      <div class="plano-card${atual ? " plano-card-atual" : ""}">
        <div class="plano-card-corpo">
          <span class="plano-nome">${_esc(p.nome)}</span>
          <span class="plano-viv">${p.viveiros}</span>
          ${precoBloco}
          <ul class="plano-recursos">
            <li>Gestão completa dos ciclos</li>
            <li>Financeiro e relatórios</li>
            <li>Histórico de cultivo</li>
          </ul>
        </div>
        <div class="plano-card-rodape">${rodape}</div>
      </div>`;
  }).join("");

  area.innerHTML = `
    <h3 class="titulo-secao">Meu plano</h3>
    <div class="cfg-wrap">
      <div class="assin-status assin-status-${statusCls}">
        <div class="assin-status-l1">${statusL1}</div>
        <div class="assin-status-l2">${statusL2}</div>
        <div class="assin-status-hint">Escolha o plano conforme a quantidade de viveiros que deseja gerenciar.</div>
      </div>
      <div class="assin-toggle">
        <button class="assin-toggle-btn ${ciclo === "mensal" ? "ativo" : ""}" onclick="_planosCiclo='mensal';abrirAssinatura()">Mensal</button>
        <button class="assin-toggle-btn ${ciclo === "anual" ? "ativo" : ""}" onclick="_planosCiclo='anual';abrirAssinatura()">Anual <span class="assin-toggle-eco">· 2 meses grátis</span></button>
      </div>
      <div class="planos-grid">${cards}</div>
      <p class="assin-obs">Contratação pelo <b>WhatsApp</b> com pagamento via <b>Pix</b> — seu plano é liberado assim que o pagamento for confirmado.</p>
      <button class="botao-voltar-form" style="margin-top:8px" onclick="voltarMenuGestao()">Voltar</button>
    </div>
  `;
}

// Porta de entrada legada: qualquer botão antigo "Assinar" cai no WhatsApp.

// ═══ SIMULAÇÃO DE VENDA ════════════════════════════════════════════════════════
// Estima a biomassa produzida (atual + despescada) e o custo total do ciclo,
// reaproveitando exatamente as mesmas contas da tela do viveiro.
function _simularDadosViveiro(viveiro) {
  if (!viveiro || !viveiro.dataPovoamento) return null;
  const hoje = _hojeLocal();
  const inicio = viveiro.dataPreparacao || viveiro.dataPovoamento;
  const cc = _custosCicloAtivo(viveiro, viveiro.cicloId, inicio, hoje);
  const custoTotal = cc.total;

  const racoesSorted = [...(viveiro.racoes || [])].sort((a, b) => a.data.localeCompare(b.data));
  const ultimaRacaoNaoZero = [...racoesSorted].reverse().find(r => r.racao > 0);
  const populacaoNum = viveiro.totalPovoado ? Number(String(viveiro.totalPovoado).replace(/\./g, "")) : null;
  const bios = [...(viveiro.biometrias || [])].sort((a, b) => a.data.localeCompare(b.data));
  const pesoUltimaBio = bios.length ? bios[bios.length - 1].gramatura : null;
  const despKgTotal = (viveiro.despescas || []).reduce((s, d) => s + (Number(d.quantidadeKg) || 0), 0);

  // Biomassa EM PÉ (só o que ainda está no viveiro) — a despesca já vendida
  // entra depois pelo seu preço real, não é revalorizada pelo preço simulado.
  let biomassaAtual = null;
  if (populacaoNum && ultimaRacaoNaoZero && pesoUltimaBio) {
    const res = _calcularBiomassa(populacaoNum, ultimaRacaoNaoZero.racao, pesoUltimaBio);
    if (res && res.biomassa > 0) biomassaAtual = res.biomassa;
  }
  const dias = calcularDiasCultivo(viveiro.dataPovoamento) || 0;
  return { biomassaAtual, custoTotal, pesoUltimaBio, despKgTotal, dias };
}

function abrirSimularVenda() {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  const ativos = viveiros.map((v, i) => ({ v, i })).filter(o => o.v.dataPovoamento);
  if (!ativos.length) {
    area.innerHTML = `
      <h3 class="titulo-secao">Simular venda</h3>
      <div class="cfg-wrap">
        <p class="sobrevivencia-texto" style="margin:18px 0">Nenhum viveiro em cultivo ativo para simular.<br><small>Cadastre um ciclo e lance ração/biometria primeiro.</small></p>
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">Voltar</button>
      </div>`;
    return;
  }
  area.innerHTML = `
    <h3 class="titulo-secao">Simular venda</h3>
    <div class="cfg-wrap">
      <div class="campo-form">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
          <label>Viveiro</label>
        </div>
        <select id="simVenda-viveiro" onchange="_simVendaTrocouViveiro()">
          <option value="">Selecione o viveiro</option>
          ${ativos.map(o => `<option value="${o.i}">${_esc(o.v.nome)}</option>`).join("")}
        </select>
      </div>

      <!-- Biomassa editável: vem preenchida com a estimativa, mas o produtor
           pode trocar para simular cenários ("e se der 5 toneladas?"). -->
      <div class="campo-form" id="simVenda-campo-bio" style="display:none">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
          <label>Biomassa a vender</label>
        </div>
        <div class="campo-input-unidade">
          <input type="text" inputmode="decimal" id="simVenda-biomassa" oninput="_simVendaCalcular()" onblur="_simVendaFormatarBio(this)">
          <span class="campo-unidade">kg</span>
        </div>
        <p class="sim-hint" id="simVenda-bio-nota" style="margin-top:6px"></p>
      </div>

      <div class="campo-form">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          <label>Preço de venda (R$/kg)</label>
        </div>
        <input type="text" inputmode="decimal" step="0.01" id="simVenda-preco" placeholder="Ex.: 15,00" oninput="_simVendaCalcular()">
      </div>
      <div id="simVenda-resultado"></div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="voltarMenuGestao()">Voltar</button>
    </div>
  `;
}

// Troca de viveiro: a biomassa digitada era do viveiro anterior, então volta
// para a estimativa do novo. Sem isso, escolher outro viveiro simularia com um
// número que não tem nada a ver com ele.
function _simVendaTrocouViveiro() {
  const sel = document.getElementById("simVenda-viveiro");
  const campo = document.getElementById("simVenda-campo-bio");
  const input = document.getElementById("simVenda-biomassa");
  const idx = sel ? sel.value : "";

  if (idx === "") {
    if (campo) campo.style.display = "none";
    _simVendaCalcular();
    return;
  }
  const dados = _simularDadosViveiro(viveiros[idx]);
  const estimada = dados && dados.biomassaAtual ? dados.biomassaAtual : 0;
  if (campo) campo.style.display = estimada > 0 ? "block" : "none";
  if (input) input.value = estimada > 0 ? formatarNumeroBR(estimada, 0) : "";
  _simVendaCalcular();
}

function _simVendaFormatarBio(input) {
  const n = parseDecimalBR(input.value);
  if (!isNaN(n) && n > 0) input.value = formatarNumeroBR(n, 0);
  _simVendaCalcular();
}

// Volta a biomassa para o valor que o app estimou.
function _simVendaUsarEstimada() {
  const sel = document.getElementById("simVenda-viveiro");
  const input = document.getElementById("simVenda-biomassa");
  if (!sel || sel.value === "" || !input) return;
  const dados = _simularDadosViveiro(viveiros[sel.value]);
  if (dados && dados.biomassaAtual) input.value = formatarNumeroBR(dados.biomassaAtual, 0);
  _simVendaCalcular();
}

function _simVendaCalcular() {
  const resultado = document.getElementById("simVenda-resultado");
  if (!resultado) return;
  const sel = document.getElementById("simVenda-viveiro");
  const idx = sel ? sel.value : "";
  if (idx === "") { resultado.innerHTML = ""; return; }

  const viveiro = viveiros[idx];
  const dados = _simularDadosViveiro(viveiro);
  if (!dados || !dados.biomassaAtual) {
    resultado.innerHTML = `<div class="sim-aviso">Ainda não dá pra estimar a biomassa deste viveiro. É preciso ter pelo menos uma <b>biometria</b> e <b>ração</b> lançada.</div>`;
    return;
  }

  // A biomassa a vender pode ter sido digitada pelo produtor. parseDecimalBR e
  // não parseFloat: "5.000" tem que virar 5000, e não 5.
  const estimada = dados.biomassaAtual;
  const digitada = parseDecimalBR(document.getElementById("simVenda-biomassa")?.value);
  const editada = !isNaN(digitada) && digitada > 0 && Math.abs(digitada - estimada) >= 1;
  const biomassaAtual = editada ? digitada : estimada;    // o que ainda está no viveiro (a vender)

  const nota = document.getElementById("simVenda-bio-nota");
  if (nota) {
    // Só reescreve quando o texto REALMENTE muda. Sem esta trava, tocar em
    // "usar o estimado" não funcionava: o toque tira o foco do campo, o onblur
    // redesenha a nota, o botão é destruído e recriado no meio do toque, e o
    // dedo levanta sobre um elemento que já não é o mesmo — o clique se perde.
    // dados.despKgTotal e não a const despKgTotal: ela só é declarada abaixo,
    // e uma const antes da declaração estoura (zona morta temporal).
    const jaDespescado = dados.despKgTotal || 0;
    const extra = jaDespescado > 0
      ? ` Os <b>${formatarNumeroBR(jaDespescado, 0)} kg</b> já despescados entram à parte, pelo preço real de venda.`
      : "";
    const estado = (editada ? "editada:" + Math.round(estimada) : "estimada") + "|" + Math.round(jaDespescado);
    if (nota.dataset.estado !== estado) {
      nota.dataset.estado = estado;
      nota.innerHTML = (editada
        ? `Simulando com um valor seu. O app estimou <b>${formatarNumeroBR(estimada, 0)} kg</b>.
           <button type="button" class="sim-voltar-est" onclick="_simVendaUsarEstimada()">usar o estimado</button>`
        : `Estimado pela última biometria${dados.pesoUltimaBio ? ` (peso médio ${formatarNumeroBR(dados.pesoUltimaBio, 1)} g)` : ""} e pela ração. <b>Pode mudar</b> para simular outro cenário.`
      ) + extra;
    }
  }
  const despKgTotal = dados.despKgTotal;                  // o que já foi despescado
  const biomassaTotal = biomassaAtual + despKgTotal;      // produção total (base do custo/kg e lucro/kg)
  const custoTotal = dados.custoTotal;
  const custoKg = biomassaTotal > 0 ? custoTotal / biomassaTotal : 0;
  // parseDecimalBR: o replace de vírgula na mão lia "1.234,50" como 1,234.
  const precoLido = parseDecimalBR(document.getElementById("simVenda-preco").value);
  const preco = isNaN(precoLido) || precoLido < 0 ? 0 : precoLido;

  if (preco <= 0) {
    resultado.innerHTML = `
      <div class="sim-cards">
        <div class="sim-card"><small>Custo total</small><strong>R$ ${formatarNumeroBR(custoTotal, 2)}</strong></div>
        <div class="sim-card"><small>Custo por kg</small><strong>R$ ${formatarNumeroBR(custoKg, 2)}</strong></div>
      </div>
      <div class="sim-hint">Digite o preço por kg acima para ver faturamento e lucro.</div>`;
    return;
  }

  // Receita das despescas JÁ VENDIDAS: usa o preço REAL de cada despesca.
  // Se alguma despesca não tiver preço salvo, cai no preço simulado (aproximação).
  let kgSemPreco = 0;
  const receitaDespesca = (viveiro.despescas || []).reduce((s, d) => {
    const kg = Number(d.quantidadeKg) || 0;
    const pk = Number(d.precoKg) || 0;
    if (kg <= 0) return s;
    if (pk > 0) return s + kg * pk;
    kgSemPreco += kg;
    return s + kg * preco;
  }, 0);

  const faturamento = biomassaAtual * preco + receitaDespesca;
  const lucro = faturamento - custoTotal;
  const lucroKg = biomassaTotal > 0 ? lucro / biomassaTotal : 0;
  const meses = dados.dias > 0 ? dados.dias / 30 : 1;
  const lucroMes = meses > 0 ? lucro / meses : lucro;
  const ok = lucro >= 0;

  const avisoSemPreco = kgSemPreco > 0
    ? `<div class="sim-hint" style="color:#92400e">⚠️ ${formatarNumeroBR(kgSemPreco, 0)} kg de despesca sem preço de venda salvo — usei o preço simulado como aproximação. Informe o preço na despesca para o cálculo exato.</div>`
    : "";

  resultado.innerHTML = `
    <div class="sim-cards">
      <div class="sim-card"><small>Faturamento</small><strong>R$ ${formatarNumeroBR(faturamento, 2)}</strong></div>
      <div class="sim-card"><small>Custo total</small><strong>R$ ${formatarNumeroBR(custoTotal, 2)}</strong></div>
      <div class="sim-card ${ok ? "sim-ok" : "sim-neg"}"><small>Lucro</small><strong>R$ ${formatarNumeroBR(lucro, 2)}</strong></div>
      <div class="sim-card"><small>Custo por kg</small><strong>R$ ${formatarNumeroBR(custoKg, 2)}</strong></div>
      <div class="sim-card ${ok ? "sim-ok" : "sim-neg"}"><small>Lucro por kg</small><strong>R$ ${formatarNumeroBR(lucroKg, 2)}</strong></div>
      <div class="sim-card ${ok ? "sim-ok" : "sim-neg"}"><small>Lucro por mês</small><strong>R$ ${formatarNumeroBR(lucroMes, 2)}</strong></div>
    </div>
    <div class="sim-hint">Faturamento = biomassa em pé × preço simulado + receita real das despescas já vendidas. Lucro/mês = lucro ÷ ${formatarNumeroBR(meses, 1)} ${meses >= 2 ? "meses" : "mês"}.</div>
    ${avisoSemPreco}`;
}

// ═══ CUSTOS FIXOS MENSAIS — TELA E CRUD ════════════════════════════════════════

function abrirCustosFixos() {
  esconderMenu();
  const area = document.getElementById("area-gestao");

  const hoje = _hojeLocal();
  const totalMensal = _custoFixoMensalTotal();
  const nViveirosAtivos = _viveirosAtivosNaData(hoje, hoje);
  const custoDiaPorViveiro = nViveirosAtivos > 0 ? _custoFixoDiaTotalNaData(hoje) / nViveirosAtivos : 0;

  const cards = custosFixos.length === 0
    ? `<p class="sobrevivencia-texto" style="margin:18px 0">Nenhum custo fixo cadastrado ainda.<br><small>Cadastre mão de obra, energia e outros custos mensais para rateá-los automaticamente entre os viveiros.</small></p>`
    : custosFixos.map((c, i) => {
        // Só a data no subtítulo (o nome já diz o que é; a categoria fica na
        // edição). Antes vinha "Mão de obra · desde… até…" e, espremido entre o
        // valor e os botões, quebrava palavra por palavra.
        const meta = [
          c.dataInicio ? "desde " + formatarData(c.dataInicio) : "",
          c.dataFim ? "até " + formatarData(c.dataFim) : (c.ativo ? "" : "inativo"),
        ].filter(Boolean).join(" · ");
        return `
        <div class="cf-card${c.ativo ? "" : " cf-card-off"}">
          <div class="cf-card-top">
            <div class="cf-card-ico"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
            <div class="cf-card-info">
              <span class="cf-card-nome">${_esc(c.nome)}</span>
              ${meta ? `<span class="cf-card-cat">${meta}</span>` : ""}
            </div>
            <div class="cf-card-valor">R$ ${formatarNumeroBR(c.valorMensal, 2)}<small>/mês</small></div>
          </div>
          <div class="cf-card-acoes">
            <button class="cf-btn-acao" title="${c.ativo ? "Desativar" : "Ativar"}" onclick="toggleCustoFixo(${i}, this)">
              ${c.ativo
                ? `<svg viewBox="0 0 24 24"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`
                : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>`}
            </button>
            <button class="cf-btn-acao" title="Editar" onclick="abrirFormCustoFixo(${i})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="cf-btn-acao cf-btn-excluir" title="Excluir" onclick="confirmarExcluirCustoFixo(${i})"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
          <div id="cf-conf-${i}" class="cf-confirmar" style="display:none">
            <span>Excluir este custo fixo?</span>
            <button class="confirmar-boleto-btn-cancelar" onclick="document.getElementById('cf-conf-${i}').style.display='none'">Cancelar</button>
            <button class="confirmar-boleto-btn-excluir" onclick="excluirCustoFixo(${i}, this)">Excluir</button>
          </div>
        </div>`;
      }).join("");

  area.innerHTML = `
    <div class="fin-topo-acoes">
      <h3 class="titulo-secao" style="margin:0">Custos fixos mensais</h3>
      <button class="fin-novo-btn" onclick="abrirFormCustoFixo()">+ Novo custo</button>
    </div>
    <div class="cfg-wrap">
      <div class="cf-explica">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>Estes custos são <strong>rateados por dia</strong> entre os viveiros ativos (em preparação ou em cultivo) e entram automaticamente no custo de cada ciclo.</span>
      </div>
      <div class="cf-resumo">
        <div class="cf-resumo-card">
          <small>Total mensal</small>
          <strong>R$ ${formatarNumeroBR(totalMensal, 2)}</strong>
        </div>
        <div class="cf-resumo-card">
          <small>Viveiros ativos hoje</small>
          <strong>${nViveirosAtivos}</strong>
        </div>
        <div class="cf-resumo-card">
          <small>Rateio por viveiro/dia</small>
          <strong>R$ ${formatarNumeroBR(custoDiaPorViveiro, 2)}</strong>
        </div>
      </div>
      <div class="cf-lista">${cards}</div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirMenuCusto()">Voltar</button>
    </div>
  `;
}

function abrirFormCustoFixo(index) {
  esconderMenu();
  const editando = index !== undefined && index !== null;
  const c = editando ? custosFixos[index] : null;
  const area = document.getElementById("area-gestao");
  // Para um custo novo, o padrão de "válido a partir de" é o início do cultivo
  // ativo mais antigo (cobre os cultivos em andamento).
  const _iniAtivos = viveiros.map(v => v.dataPreparacao || v.dataPovoamento).filter(Boolean).sort();
  const _hojeYmd = _hojeLocal();
  const _defaultInicio = _iniAtivos.length ? _iniAtivos[0] : _hojeYmd;
  const cats = [
    ["mao_de_obra", "Mão de obra"],
    ["energia", "Energia"],
    ["aluguel", "Aluguel"],
    ["agua", "Água"],
    ["manutencao", "Manutenção"],
    ["outro", "Outro"],
  ];
  area.innerHTML = `
    <h3 class="titulo-secao">${editando ? "Editar custo fixo" : "Novo custo fixo"}</h3>
    <div class="cfg-wrap">
      ${editando ? "" : `<p class="rc-print-dica" style="margin:2px 0 12px">Custo que se repete todo mês (ex: energia, funcionário). É rateado por dia entre os viveiros ativos.</p>`}
      <div class="campo-form">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg><label>Nome</label></div>
        <input type="text" id="cfNome" placeholder="Ex: Funcionário, Conta de luz…" value="${editando ? (c.nome || "").replace(/"/g, "&quot;") : ""}">
      </div>
      <div class="campo-form">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 4v16"/></svg><label>Categoria</label></div>
        <select id="cfCategoria">
          ${cats.map(([v, l]) => `<option value="${v}" ${editando && c.categoria === v ? "selected" : ""}>${l}</option>`).join("")}
        </select>
      </div>
      <div class="campo-form">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><label>Valor mensal (R$)</label></div>
        <input type="text" inputmode="decimal" id="cfValor" placeholder="Ex: 1.500,00" value="${editando && c.valorMensal ? formatarNumeroBR(c.valorMensal, 2) : ""}" onblur="formatarMoedaBlur(this)">
      </div>
      <div class="campo-form">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><label>Válido a partir de</label></div>
        <input type="date" id="cfDataInicio" value="${editando ? (c.dataInicio || "") : _defaultInicio}">
      </div>
      <p class="rc-print-dica" style="margin:2px 0 10px">O custo é rateado a partir dessa data. Já vem com o início do cultivo mais antigo para cobrir os viveiros em andamento — ajuste se quiser.</p>
      <div id="msg-cf-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center;font-weight:500"></div>
      <button class="botao-salvar" onclick="salvarCustoFixo(${editando ? index : "null"})">
        <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Salvar
      </button>
      <button class="botao-voltar-form" style="margin-top:10px" onclick="abrirCustosFixos()">Voltar</button>
    </div>
  `;
}

// Pergunta a partir de QUE DIA o novo valor passa a valer. Uma data cobre todos
// os casos: hoje (reajuste), uma data passada (reajuste retroativo) ou o próprio
// início do custo (corrigir um valor digitado errado). Devolve "AAAA-MM-DD" ou
// null se cancelar.
function _perguntarVigenciaCustoFixo(c, valorNovo) {
  return new Promise((resolve) => {
    const rs = (v) => "R$ " + formatarNumeroBR(Number(v) || 0, 2);
    const hoje = _hojeLocal();
    const inicio = c.dataInicio || "";
    const fundo = document.createElement("div");
    fundo.className = "cf-vig-fundo";
    fundo.innerHTML = `
      <div class="cf-vig-caixa">
        <h4>A partir de quando vale?</h4>
        <p class="cf-vig-sub">${_esc(c.nome)}: de <b>${rs(c.valorMensal)}</b> para <b>${rs(valorNovo)}</b></p>
        <input type="date" id="cfVigData" class="cf-vig-data" value="${hoje}">
        <div class="cf-vig-atalhos">
          <button type="button" class="cf-vig-chip" data-data="${hoje}">Hoje</button>
          ${inicio && inicio < hoje ? `<button type="button" class="cf-vig-chip" data-data="${inicio}">Desde o início (${formatarData(inicio)})</button>` : ""}
        </div>
        <p class="cf-vig-nota">Os dias anteriores a essa data continuam com ${rs(c.valorMensal)}.</p>
        <button class="botao-salvar cf-vig-ok" type="button">Confirmar</button>
        <button class="cf-vig-cancelar" type="button">Cancelar</button>
      </div>`;
    const campo = () => fundo.querySelector("#cfVigData");
    const nota = () => fundo.querySelector(".cf-vig-nota");
    const atualizarNota = () => {
      const d = campo().value;
      nota().textContent = (!d || (inicio && d <= inicio))
        ? `Refaz todo o período com ${rs(valorNovo)}.`
        : `Os dias anteriores a ${formatarData(d)} continuam com ${rs(c.valorMensal)}.`;
    };
    const fechar = (v) => { fundo.remove(); resolve(v); };
    fundo.addEventListener("click", (e) => {
      if (e.target === fundo) return fechar(null);
      const chip = e.target.closest(".cf-vig-chip");
      if (chip) { campo().value = chip.dataset.data; atualizarNota(); return; }
      if (e.target.closest(".cf-vig-cancelar")) return fechar(null);
      if (e.target.closest(".cf-vig-ok")) {
        const d = campo().value;
        if (!d) return; // sem data não dá para decidir
        return fechar(d);
      }
    });
    fundo.addEventListener("change", (e) => { if (e.target.id === "cfVigData") atualizarNota(); });
    document.body.appendChild(fundo);
    atualizarNota();
  });
}

async function salvarCustoFixo(index) {
  if (_bloqueioEdicao()) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque
  const editando = index !== null && index !== undefined;
  const nome = (document.getElementById("cfNome").value || "").trim();
  const categoria = document.getElementById("cfCategoria").value;
  const valorMensal = parseMoedaBR(document.getElementById("cfValor").value || "0");
  const dataInicio = document.getElementById("cfDataInicio").value || null;
  const erro = document.getElementById("msg-cf-erro");
  const mostrarErro = (m) => { if (erro) { erro.textContent = m; erro.style.display = "block"; } };
  if (erro) erro.style.display = "none";

  if (!nome) { mostrarErro("Informe o nome do custo."); return; }
  if (!valorMensal || valorMensal <= 0) { mostrarErro("Informe um valor mensal válido."); return; }

  const restaurar = _travarBotao(botao, "Salvando...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  if (editando) {
    const c = custosFixos[index];
    const mudouValor = Number(c.valorMensal) !== Number(valorMensal);
    // Mudar o valor tem dois sentidos diferentes: um reajuste (o passado ficou
    // como estava) ou a correção de um valor digitado errado (refaz tudo). Só o
    // usuário sabe qual é, então perguntamos — mas apenas quando o valor mudou.
    const desde = mudouValor ? await _perguntarVigenciaCustoFixo(c, valorMensal) : null;
    if (mudouValor && desde === null) { restaurar(); return; } // cancelou

    // Data escolhida DEPOIS do início do custo = o valor mudou no meio do
    // caminho: fecha o período atual na véspera e abre outro. Data igual ou
    // anterior ao início = o valor sempre foi esse (correção), então basta
    // atualizar o registro.
    const dividir = mudouValor && c.dataInicio && desde > c.dataInicio;

    if (dividir) {
      const vespera = _maAddDias(desde, -1);
      // Reajuste ATÔMICO: fechar o segmento antigo (data_fim = véspera) e abrir o
      // novo acontecem na MESMA transação. Antes eram dois passos soltos: se o
      // segundo falhava, o antigo ficava fechado e o novo não entrava — o custo
      // sumia do rateio (auditoria). Fallback pro jeito antigo se a função ainda
      // não existir no banco.
      const { data: novoId, error: eRpc } = await supabaseClient.rpc("reajustar_custo_fixo", {
        p_id_antigo: c.id, p_data_fim: vespera,
        p_nome: nome, p_categoria: categoria, p_valor: valorMensal, p_data_inicio: desde,
      });
      const _ausente = !!eRpc && (eRpc.code === "PGRST202" ||
        /reajustar_custo_fixo|could not find the function/i.test(eRpc.message || ""));
      if (!eRpc) {
        c.dataFim = vespera;
        custosFixos.push({ id: novoId, nome, categoria, valorMensal, dataInicio: desde, dataFim: null, ativo: true });
        _toastSucesso(`Novo valor vale a partir de ${formatarData(desde)}.`);
      } else if (!_ausente) {
        console.log(eRpc); mostrarErro("Erro ao salvar: " + eRpc.message); restaurar(); return;
      } else {
        const { error: e1 } = await supabaseClient.from("custos_fixos")
          .update({ data_fim: vespera }).eq("id", c.id).eq("user_id", usuario.id);
        if (e1) { console.log(e1); mostrarErro("Erro ao salvar: " + e1.message); restaurar(); return; }
        const { data: novoReg, error: e2 } = await supabaseClient.from("custos_fixos")
          .insert([{ user_id: usuario.id, nome, categoria, valor_mensal: valorMensal, data_inicio: desde, ativo: true }])
          .select();
        if (e2 || !novoReg || !novoReg.length) { console.log(e2); mostrarErro("Erro ao salvar: " + (e2?.message || "tente novamente.")); restaurar(); return; }
        c.dataFim = vespera;
        custosFixos.push({ id: novoReg[0].id, nome, categoria, valorMensal, dataInicio: desde, dataFim: null, ativo: true });
        _toastSucesso(`Novo valor vale a partir de ${formatarData(desde)}.`);
      }
    } else {
      const { error } = await supabaseClient.from("custos_fixos")
        .update({ nome, categoria, valor_mensal: valorMensal, data_inicio: dataInicio })
        .eq("id", c.id).eq("user_id", usuario.id);
      if (error) { console.log(error); mostrarErro("Erro ao salvar: " + error.message); restaurar(); return; }
      c.nome = nome; c.categoria = categoria; c.valorMensal = valorMensal; c.dataInicio = dataInicio;
      _toastSucesso("Custo fixo atualizado.");
    }
  } else {
    const { data, error } = await supabaseClient.from("custos_fixos")
      .insert([{ user_id: usuario.id, nome, categoria, valor_mensal: valorMensal, data_inicio: dataInicio, ativo: true }])
      .select();
    if (error) { console.log(error); mostrarErro("Erro ao salvar (rode o SQL da tabela custos_fixos): " + error.message); restaurar(); return; }
    custosFixos.push({ id: data[0].id, nome, categoria, valorMensal, dataInicio, ativo: true });
    _toastSucesso("Custo fixo cadastrado.");
  }
  abrirCustosFixos();
}

// Divide um valor em partes iguais entre N. Devolve null se faltar dado.
// Funcao pura -> tem teste.
function _ratearIgual(valorTotal, n) {
  return (valorTotal > 0 && n > 0) ? valorTotal / n : null;
}

async function toggleCustoFixo(index, botao) {
  if (_bloqueioEdicao()) return; // ativar/desativar muda o rateio de todos os custos
  // Duplo toque aqui apagava a data de início original: o 1º toque reativava
  // (data_inicio = hoje) e o 2º já encerrava — a vigência antiga sumia de vez.
  if (botao?.disabled) return;
  const c = custosFixos[index];
  const restaurar = _travarBotao(botao, "…");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }
  const hoje = _hojeLocal();
  const ativando = !c.ativo;

  if (ativando) {
    // Reativar ABRE UM NOVO SEGMENTO a partir de hoje e mantém o período
    // anterior fechado no histórico. Antes, reativar sobrescrevia data_inicio
    // com hoje na MESMA linha — e os dias em que o custo esteve ativo antes de
    // ser desativado sumiam do rateio (auditoria). É um único INSERT (atômico):
    // se falhar, nada muda e o segmento antigo continua como estava.
    const { data: novo, error } = await supabaseClient.from("custos_fixos")
      .insert([{ user_id: usuario.id, nome: c.nome, categoria: c.categoria, valor_mensal: c.valorMensal, data_inicio: hoje, ativo: true }])
      .select();
    if (error || !novo || !novo.length) { console.log(error); restaurar(); _toastErro("Erro ao reativar."); return; }
    custosFixos.push({ id: novo[0].id, nome: c.nome, categoria: c.categoria, valorMensal: c.valorMensal, dataInicio: hoje, dataFim: null, ativo: true });
    _toastSucesso(`Reaberto a partir de ${formatarData(hoje)} — o período anterior fica no histórico.`);
  } else {
    // Desativar encerra HOJE em vez de apagar o passado: os meses já trabalhados
    // continuam contando no rateio, dentro da janela [início..hoje].
    const { error } = await supabaseClient.from("custos_fixos")
      .update({ ativo: false, data_fim: hoje }).eq("id", c.id).eq("user_id", usuario.id);
    if (error) { console.log(error); restaurar(); _toastErro("Erro ao desativar."); return; }
    c.ativo = false; c.dataFim = hoje;
    _toastSucesso(`Encerrado em ${formatarData(hoje)} — os meses anteriores continuam contando.`);
  }
  abrirCustosFixos();
}

function confirmarExcluirCustoFixo(index) {
  const el = document.getElementById("cf-conf-" + index);
  if (el) el.style.display = el.style.display === "none" ? "flex" : "none";
}

async function excluirCustoFixo(index, botao) {
  if (_bloqueioEdicao()) return;
  if (botao?.disabled) return;
  const restaurar = _travarBotao(botao, "Excluindo...");
  const c = custosFixos[index];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }
  const { error } = await supabaseClient.from("custos_fixos")
    .delete().eq("id", c.id).eq("user_id", usuario.id);
  if (error) { console.log(error); restaurar(); _toastErro("Erro ao excluir."); return; }
  custosFixos.splice(index, 1);
  _toastSucesso("Custo fixo excluído.");
  abrirCustosFixos();
}

// ═══ ENERGIA — RATEIO POR PERÍODO DE LEITURA ═══════════════════════════════════
// A conta de luz chega DEPOIS do consumo e não é proporcional a dias: viveiro
// com oito aeradores gasta muito mais que um com dois. Por isso aqui o app
// apenas SUGERE uma divisão e o produtor ajusta cada valor na mão.
//
// O ponto delicado é o ciclo. A conta de 01 a 30/08 pode pegar um ciclo que já
// encerrou no dia 20. Como o relatório de ciclo soma os custos ao vivo pelo
// ciclo_id, basta lançar cada fatia com o ciclo a que ela pertence — e o custo
// cai no ciclo certo, mesmo que ele já esteja fechado.

let _energiaSegs = [];

// Fatias (viveiro × ciclo) que existiram dentro do período de leitura.
function _energiaSegmentos(iniYmd, fimYmd) {
  const hoje = _hojeLocal();
  const segs = [];
  const recorte = (de, ate) => {
    const d = de > iniYmd ? de : iniYmd;
    const a = (ate && ate < fimYmd) ? ate : fimYmd;
    return d <= a ? { de: d, ate: a } : null;
  };

  viveiros.forEach((v, idx) => {
    // Viveiro fora do plano é somente leitura — não recebe lançamento.
    if (_viveiroForaDoLimite(idx)) return;

    // Ciclo em andamento. Vale até HOJE: data futura não conta.
    const iniAtual = v.dataPreparacao || v.dataPovoamento;
    if (iniAtual) {
      // Um ciclo encerra e a preparação do seguinte começa no MESMO dia. Sem
      // este ajuste o dia do encerramento apareceria em duas fatias.
      let de = iniAtual;
      (v.ciclosFinalizados || []).forEach((cf) => {
        if (cf.dataEncerramento && cf.dataEncerramento >= de) de = _maAddDias(cf.dataEncerramento, 1);
      });
      const r = recorte(de, hoje);
      if (r) segs.push({ viveiroIndex: idx, nome: v.nome, cicloId: v.cicloId || null, encerrado: false, de: r.de, ate: r.ate });
    }

    // Ciclos já encerrados que alcançam o período
    (v.ciclosFinalizados || []).forEach((cf) => {
      const ci = cf.dataPreparacao || cf.dataPovoamento;
      if (!ci || !cf.dataEncerramento) return;
      const r = recorte(ci, cf.dataEncerramento);
      if (r) segs.push({ viveiroIndex: idx, nome: v.nome, cicloId: cf.cicloId || null, encerrado: true, de: r.de, ate: r.ate });
    });
  });

  segs.forEach((s) => {
    s.dias = Math.round((_parseDataLocal(s.ate) - _parseDataLocal(s.de)) / 86400000) + 1;
    s.valor = 0;
  });
  segs.sort((a, b) => a.viveiroIndex - b.viveiroIndex || a.de.localeCompare(b.de));
  return segs;
}

function abrirEnergia() {
  esconderMenu();
  _energiaSegs = [];
  const area = document.getElementById("area-gestao");
  // Padrão: mês passado — é o período que a conta que acabou de chegar cobre.
  const d = new Date();
  const iniPadrao = _dataLocalISO(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const fimPadrao = _dataLocalISO(new Date(d.getFullYear(), d.getMonth(), 0));

  area.innerHTML = `
    <h3 class="titulo-secao">Energia</h3>
    <div class="cfg-wrap">
      <p class="cfg-secao-desc">Lance a conta de luz pelo <b>período da leitura</b>, não pelo dia em que ela chegou.
      O app sugere uma divisão pelos dias que cada viveiro rodou, e você ajusta conforme o gasto real de cada um.
      Fatia de ciclo já encerrado entra no custo daquele ciclo, não no novo.</p>

      <div class="en-form">
        <div class="campo-form">
          <div class="campo-label"><label>Valor da conta</label></div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="enValor" placeholder="Ex: 1.240,00" onblur="formatarMoedaBlur(this)">
            <span class="campo-unidade">R$</span>
          </div>
        </div>
        <div class="en-datas">
          <div class="campo-form">
            <div class="campo-label"><label>Leitura de</label></div>
            <input type="date" id="enIni" value="${iniPadrao}">
          </div>
          <div class="campo-form">
            <div class="campo-label"><label>Leitura até</label></div>
            <input type="date" id="enFim" value="${fimPadrao}">
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label"><label>Descrição (opcional)</label></div>
          <input type="text" id="enDesc" placeholder="Ex: Energia — conta de agosto">
        </div>
        <div id="msg-energia" class="en-erro" style="display:none"></div>
        <button class="botao-salvar" onclick="_energiaCalcular()">Calcular rateio</button>
      </div>

      <div id="en-rateio"></div>

      <button class="botao-voltar-form" style="margin-top:12px" onclick="abrirMenuCusto()">Voltar</button>
    </div>
  `;
}

function _energiaErro(msg) {
  const e = document.getElementById("msg-energia");
  if (!e) return;
  if (!msg) { e.style.display = "none"; return; }
  e.textContent = msg;
  e.style.display = "block";
}

function _energiaCalcular() {
  _energiaErro("");
  const box = document.getElementById("en-rateio");
  const ini = document.getElementById("enIni").value;
  const fim = document.getElementById("enFim").value;
  const valor = parseMoedaBR(document.getElementById("enValor").value);

  if (box) box.innerHTML = "";
  if (isNaN(valor) || valor <= 0) { _energiaErro("Informe o valor da conta."); return; }
  if (!ini || !fim) { _energiaErro("Informe as duas datas da leitura."); return; }
  if (ini > fim) { _energiaErro("A data inicial da leitura é depois da final."); return; }

  _energiaSegs = _energiaSegmentos(ini, fim);
  if (!_energiaSegs.length) {
    if (box) box.innerHTML = `<div class="en-vazio">Nenhum viveiro estava em preparação ou cultivo entre ${formatarData(ini)} e ${formatarData(fim)}. Confira as datas da leitura.</div>`;
    return;
  }
  _energiaDistribuir("dias");
}

// Espalha o valor da conta pelas fatias. "dias" = proporcional aos dias que
// cada uma rodou; "igual" = mesmo valor para todas.
function _energiaDistribuir(modo) {
  if (!_energiaSegs.length) return;
  const valor = parseMoedaBR(document.getElementById("enValor").value) || 0;
  const totalDias = _energiaSegs.reduce((s, x) => s + x.dias, 0);
  const n = _energiaSegs.length;

  _energiaSegs.forEach((s) => {
    if (modo === "zerar") { s.valor = 0; return; }
    const bruto = modo === "igual" ? valor / n : (totalDias > 0 ? (valor * s.dias) / totalDias : 0);
    s.valor = Math.round(bruto * 100) / 100;
  });

  // Os centavos que sobram do arredondamento vão para a maior fatia, senão a
  // soma nunca fecha exatamente com o valor da conta.
  if (modo !== "zerar") {
    const soma = _energiaSegs.reduce((s, x) => s + x.valor, 0);
    const resto = Math.round((valor - soma) * 100) / 100;
    if (resto !== 0) {
      const maior = _energiaSegs.reduce((a, b) => (b.valor > a.valor ? b : a), _energiaSegs[0]);
      maior.valor = Math.round((maior.valor + resto) * 100) / 100;
    }
  }
  _energiaRenderRateio();
}

function _energiaSetValor(i, txt) {
  if (!_energiaSegs[i]) return;
  const v = parseMoedaBR(txt);
  _energiaSegs[i].valor = isNaN(v) || v < 0 ? 0 : v;
  _energiaAtualizarTotal();
}

// Ao terminar de editar (ou zerar) UM viveiro, o que falta para fechar a conta
// escorre automaticamente para os OUTROS — assim o total continua batendo. Com
// 2 viveiros, mexer num ajusta o outro na hora. Com 3+, o restante é dividido
// entre os demais na proporção do que já tinham (ou pelos dias, se estavam zerados).
function _energiaRebalancear(iEditado) {
  if (!_energiaSegs[iEditado] || _energiaSegs.length < 2) return;
  const conta = parseMoedaBR(document.getElementById("enValor").value) || 0;
  const fixo = Number(_energiaSegs[iEditado].valor) || 0;
  const outros = _energiaSegs.map((s, i) => ({ s, i })).filter(x => x.i !== iEditado);

  // Editou um valor >= a conta inteira: os outros zeram (o "Distribuído" avisa
  // se passou). Deixamos honesto em vez de forçar.
  if (fixo >= conta) { outros.forEach(x => { x.s.valor = 0; }); _energiaRenderRateio(); return; }

  const restante = Math.round((conta - fixo) * 100) / 100;
  const somaOutros = outros.reduce((a, x) => a + (Number(x.s.valor) || 0), 0);
  const totalDiasOutros = outros.reduce((a, x) => a + (x.s.dias || 0), 0);
  outros.forEach(x => {
    let frac;
    if (somaOutros > 0) frac = (Number(x.s.valor) || 0) / somaOutros;
    else if (totalDiasOutros > 0) frac = (x.s.dias || 0) / totalDiasOutros;
    else frac = 1 / outros.length;
    x.s.valor = Math.round(restante * frac * 100) / 100;
  });

  // Centavos do arredondamento vão para o maior dos OUTROS, pra somar exato
  // (o viveiro que você acabou de editar fica com o valor que você digitou).
  const somaFinal = _energiaSegs.reduce((a, s) => a + (Number(s.valor) || 0), 0);
  const resto = Math.round((conta - somaFinal) * 100) / 100;
  if (resto !== 0) {
    const maior = outros.reduce((a, b) => (b.s.valor > a.s.valor ? b : a), outros[0]);
    maior.s.valor = Math.round((maior.s.valor + resto) * 100) / 100;
  }
  _energiaRenderRateio();
}

function _energiaAtualizarTotal() {
  const el = document.getElementById("en-total");
  if (!el) return;
  const conta = parseMoedaBR(document.getElementById("enValor").value) || 0;
  const soma = _energiaSegs.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  const dif = Math.round((conta - soma) * 100) / 100;
  const rs = (v) => "R$ " + formatarNumeroBR(v, 2);

  if (Math.abs(dif) < 0.005) {
    el.className = "en-total ok";
    el.innerHTML = `<span>Distribuído <b>${rs(soma)}</b></span><small>bate certinho com a conta ✓</small>`;
  } else if (dif > 0) {
    el.className = "en-total falta";
    el.innerHTML = `<span>Distribuído <b>${rs(soma)}</b> de ${rs(conta)}</span><small>${rs(dif)} ficam de fora do custo do cultivo</small>`;
  } else {
    el.className = "en-total passou";
    el.innerHTML = `<span>Distribuído <b>${rs(soma)}</b> de ${rs(conta)}</span><small>passou ${rs(-dif)} do valor da conta</small>`;
  }
}

function _energiaRenderRateio() {
  const box = document.getElementById("en-rateio");
  if (!box) return;

  // Quantas fatias cada viveiro tem: com mais de uma, mostramos as datas para
  // ficar claro qual pedaço é de qual ciclo.
  const fatias = {};
  _energiaSegs.forEach((s) => { fatias[s.viveiroIndex] = (fatias[s.viveiroIndex] || 0) + 1; });

  box.innerHTML = `
    <div class="en-sec-tit">Rateio entre os viveiros</div>
    <p class="en-dica">Sugestão pelos dias que cada um rodou no período. <b>Ajuste na mão</b> conforme o gasto real — aeradores, bombas, tamanho do viveiro. Ao mexer (ou zerar) um viveiro, os outros se ajustam sozinhos para fechar a conta.</p>
    <div class="en-atalhos">
      <button class="en-atalho" onclick="_energiaDistribuir('dias')">Sugerir por dias</button>
      <button class="en-atalho" onclick="_energiaDistribuir('igual')">Dividir igual</button>
      <button class="en-atalho" onclick="_energiaDistribuir('zerar')">Zerar</button>
    </div>
    <div class="en-lista">
      ${_energiaSegs.map((s, i) => `
        <div class="en-item${s.encerrado ? " en-encerrado" : ""}">
          <div class="en-item-info">
            <span class="en-item-nome">${abreviarViveiro(s.nome)}${s.encerrado ? ` <span class="en-badge">ciclo encerrado</span>` : ""}</span>
            <span class="en-item-sub">${s.dias} dia${s.dias === 1 ? "" : "s"}${fatias[s.viveiroIndex] > 1 ? ` · ${formatarData(s.de)} a ${formatarData(s.ate)}` : ""}</span>
          </div>
          <div class="en-item-val">
            <span class="en-item-rs">R$</span>
            <input type="text" inputmode="decimal" id="en-v-${i}" value="${formatarNumeroBR(s.valor, 2)}"
                   oninput="_energiaSetValor(${i}, this.value)" onblur="formatarMoedaBlur(this); _energiaSetValor(${i}, this.value); _energiaRebalancear(${i})">
          </div>
        </div>`).join("")}
    </div>
    <div class="en-total" id="en-total"></div>
    <button class="botao-salvar" style="margin-top:12px" onclick="salvarEnergia(this)">
      <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
      Lançar energia
    </button>
  `;
  _energiaAtualizarTotal();
}

async function salvarEnergia(botao) {
  if (_bloqueioEdicao()) return;
  if (botao?.disabled) return; // evita duplo toque: lançaria a conta duas vezes
  _energiaErro("");

  const ini = document.getElementById("enIni").value;
  const fim = document.getElementById("enFim").value;
  const conta = parseMoedaBR(document.getElementById("enValor").value) || 0;
  const desc = (document.getElementById("enDesc").value || "").trim() || "Energia";

  const lancar = _energiaSegs.filter((s) => (Number(s.valor) || 0) > 0);
  if (!lancar.length) { _energiaErro("Nenhum valor para lançar — todos os viveiros estão zerados."); return; }

  const soma = lancar.reduce((s, x) => s + x.valor, 0);
  if (soma - conta > 0.005) {
    _energiaErro(`O rateio soma R$ ${formatarNumeroBR(soma, 2)}, mais que a conta de R$ ${formatarNumeroBR(conta, 2)}. Ajuste antes de lançar.`);
    return;
  }

  const restaurar = _travarBotao(botao, "Lançando...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const observacao = `Energia · leitura ${formatarData(ini)} a ${formatarData(fim)}`;
  const linhas = lancar.map((s) => ({
    user_id: usuario.id,
    viveiro_id: viveiros[s.viveiroIndex].id,
    tipo: "outro",
    nome_produto: desc,
    valor: s.valor,
    // Categoria FIXA "Energia": o relatório financeiro agrupa os custos do tipo
    // "outro" pela categoria, então uma descrição diferente a cada mês criaria
    // um grupo novo todo mês. Já o histórico do viveiro agrupa por nome, e ali
    // ver "conta de julho" separada de "conta de agosto" ajuda.
    categoria: "Energia",
    // Último dia da fatia: está dentro do período da leitura E dentro do ciclo,
    // inclusive quando o ciclo é o que já foi encerrado.
    data: s.ate,
    ciclo_id: s.cicloId,
    observacao,
  }));

  const { data: salvos, error } = await supabaseClient.from("custos").insert(linhas).select();
  if (error) { restaurar(); _energiaErro("Erro ao lançar: " + error.message); return; }
  if (!salvos || salvos.length !== linhas.length) {
    restaurar();
    _energiaErro("O banco não confirmou todos os lançamentos. Confira o histórico de custos antes de repetir.");
    return;
  }

  // Espelha na memória: os relatórios já mostram sem precisar reabrir o app.
  salvos.forEach((row) => {
    const v = viveiros.find((x) => x.id === row.viveiro_id);
    if (!v) return;
    if (!v.custos) v.custos = [];
    v.custos.push({
      id: row.id, tipo: "outro", produtoId: null, nomeProduto: row.nome_produto,
      quantidadeG: null, valor: Number(row.valor), categoria: row.categoria,
      data: row.data, observacao: row.observacao, cicloId: row.ciclo_id || null,
    });
  });

  const sobra = Math.round((conta - soma) * 100) / 100;
  _toastSucesso(`Energia lançada em ${lancar.length} ${lancar.length === 1 ? "viveiro" : "viveiros"} — R$ ${formatarNumeroBR(soma, 2)}.`);
  if (sobra > 0.005) {
    setTimeout(() => _toastErro(`R$ ${formatarNumeroBR(sobra, 2)} não foram rateados e ficaram fora do custo do cultivo.`), 3600);
  }
  _energiaSegs = [];
  abrirMenuCusto();
}

function abrirBoletos(filtro) {
  if (filtro) _boletosFiltro = filtro;
  esconderMenu();
  const area = document.getElementById("area-gestao");

  const todos = boletos.map((b, i) => ({ b, i, st: _statusBoleto(b.dataCompra, b.prazoDias) }));
  const naoPagos = todos.filter(x => !x.b.pago);
  // Total A PAGAR = o que ainda falta (já abate os pagamentos parciais)
  const valorTotal = naoPagos.reduce((s, x) => s + _boletoRestante(x.b), 0);
  const qtdVencendo = naoPagos.filter(x => x.st.tipo === "proximo" || x.st.tipo === "hoje").length;
  const qtdVencidos = naoPagos.filter(x => x.st.tipo === "vencido").length;

  let filtrados;
  if (_boletosFiltro === "vencendo") filtrados = naoPagos.filter(x => x.st.tipo === "proximo" || x.st.tipo === "hoje");
  else if (_boletosFiltro === "vencidos") filtrados = naoPagos.filter(x => x.st.tipo === "vencido");
  else if (_boletosFiltro === "pagos") filtrados = todos.filter(x => x.b.pago);
  // Aba principal = o que ainda falta pagar, do mais urgente ao menos.
  // O cabeçalho já dizia "a pagar" e o total já ignorava os quitados: só a
  // lista é que ainda os trazia no fim, misturando o que exige ação com o que
  // já foi resolvido. Boleto pago aparece na aba "Pagos".
  else filtrados = [...naoPagos].sort((x, y) => x.st.diff - y.st.diff);

  // Lista de fornecedores para o seletor
  const fornecedores = [...new Set(boletos.map(b => (b.fornecedor || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  // Se o fornecedor selecionado não existe mais, limpa o filtro
  if (_boletosFornecedor && !fornecedores.includes(_boletosFornecedor)) _boletosFornecedor = "";
  // Filtro por fornecedor (opcional)
  if (_boletosFornecedor) filtrados = filtrados.filter(x => (x.b.fornecedor || "").trim() === _boletosFornecedor);

  const qtdPagos = todos.filter(x => x.b.pago).length;
  // Nos boletos pagos, mostra o total pago; nos demais, o que ainda falta pagar
  const totalFiltrado = _boletosFiltro === "pagos"
    ? filtrados.reduce((s, x) => s + (x.b.valorPago || x.b.valor || 0), 0)
    : filtrados.reduce((s, x) => s + (x.b.pago ? 0 : _boletoRestante(x.b)), 0);
  const labelFiltro = { todos: "a pagar", vencendo: "vencendo", vencidos: "vencidos", pagos: "pagos" }[_boletosFiltro] || "a pagar";

  const rows = filtrados.map(({ b, i, st }) => {
    const [ano, mes, dia] = b.dataCompra.split("-").map(Number);
    const vencDate = new Date(ano, mes - 1, dia);
    vencDate.setDate(vencDate.getDate() + b.prazoDias);
    const vencFmt = vencDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const _rs = v => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rest = _boletoRestante(b);
    const parcial = !b.pago && (b.valorPago || 0) > 0 && b.valor;
    // Badges independentes: situação FINANCEIRA (aberto/parcial/pago) + PRAZO
    const finCls = b.pago ? "pago" : (parcial ? "parcial" : "aberto");
    const finLabel = b.pago ? "✓ Pago" : (parcial ? "Parcial" : "Aberto");
    // Valor em destaque = saldo restante (ou valor pago, se quitado)
    const saldoVal = b.pago ? (b.valorPago || b.valor || 0) : rest;
    const saldoLbl = b.pago ? "valor pago" : "restante";
    return `
      <div class="bt-card${b.pago ? " bt-card-pago" : ""}"
           data-busca="${_attr((b.nome + " " + (b.fornecedor || "")).toLowerCase())}"
           data-pago="${b.pago ? 1 : 0}" data-rest="${rest}" data-vpago="${b.valorPago || 0}" data-valor="${b.valor || 0}">
        <div class="bt-card-main" onclick="verDetalhesBoleto(${i})">
          <div class="bt-card-head">
            <span class="bt-card-nome">${_esc(b.nome)}</span>
            <div class="bt-badges">
              <span class="bt-badge bt-badge-fin-${finCls}">${finLabel}</span>
              ${b.pago ? "" : `<span class="bt-badge bt-badge-${st.tipo}">${st.label}</span>`}
            </div>
          </div>
          <div class="bt-card-forn">${_esc(b.fornecedor || "—")}</div>
          ${b.valor ? `<div class="bt-card-saldo${b.pago ? " quit" : ""}"><b>${_rs(saldoVal)}</b><small>${saldoLbl}</small></div>` : ""}
          ${parcial ? `<div class="bt-card-aux">Valor original: ${_rs(b.valor)} · Pago: ${_rs(b.valorPago || 0)}</div>` : ""}
          <div class="bt-card-foot">
            <span class="bt-card-venc">Vence ${vencFmt}</span>
            <span class="bt-card-verdet">Ver detalhes ›</span>
          </div>
        </div>
        <div class="bt-menu-wrap" onclick="event.stopPropagation()">
          <button class="bt-menu-btn" onclick="_toggleMenuBoleto(${i})">⋮</button>
          <div id="bt-menu-${i}" class="bt-menu-drop" style="display:none">
            ${b.pago
              ? `<button onclick="_toggleMenuBoleto(${i});desmarcarBoletoPago(${i}, false, this)">↩️ Desfazer pagamento</button>`
              : `<button onclick="_toggleMenuBoleto(${i});marcarBoletoPago(${i}, false, this)">✅ Marcar como pago</button>`}
            <button onclick="_toggleMenuBoleto(${i});abrirFormBoleto(${i})">✏️ Editar</button>
            <button class="bt-menu-excluir" onclick="_toggleMenuBoleto(${i});_mostrarConfirmarExcluir(${i})">🗑️ Excluir</button>
          </div>
        </div>
        <div id="bt-conf-${i}" class="bt-confirmar-inline" style="display:none">
          <span>Excluir este boleto?</span>
          <button class="confirmar-boleto-btn-cancelar" onclick="document.getElementById('bt-conf-${i}').style.display='none'">Cancelar</button>
          <button class="confirmar-boleto-btn-excluir" onclick="excluirBoleto(${i}, this)">Excluir</button>
        </div>
      </div>
    `;
  }).join("");

  area.innerHTML = `
    <div class="fin-topo-acoes">
      <h3 class="titulo-secao" style="margin:0">Boletos</h3>
      <div class="bt-topo-btns">
        <button class="fin-novo-btn fin-novo-btn-sec" onclick="imprimirBoletos()"><svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-2px;margin-right:5px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Imprimir</button>
        <button class="fin-novo-btn" onclick="abrirFormBoleto()">+ Novo boleto</button>
      </div>
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
        <input type="text" value="${_attr(_boletosBusca)}" placeholder="Buscar por nome ou fornecedor..." oninput="_filtrarBoletosBusca(this.value)">
      </div>
      <div class="bt-abas">
        <button class="bt-aba${_boletosFiltro === "todos" ? " ativa" : ""}" onclick="abrirBoletos('todos')">A pagar</button>
        <button class="bt-aba${_boletosFiltro === "vencendo" ? " ativa" : ""}" onclick="abrirBoletos('vencendo')">Vencendo</button>
        <button class="bt-aba${_boletosFiltro === "vencidos" ? " ativa" : ""}" onclick="abrirBoletos('vencidos')">Vencidos</button>
        <button class="bt-aba${_boletosFiltro === "pagos" ? " ativa" : ""}" onclick="abrirBoletos('pagos')">Pagos</button>
      </div>
      ${fornecedores.length ? `<div class="bt-forn-filtro">
        <svg viewBox="0 0 24 24"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
        <select onchange="_setBoletoFornecedor(this.value)">
          <option value="">Todos os fornecedores</option>
          ${fornecedores.map(f => `<option value="${_attr(f)}"${_boletosFornecedor === f ? " selected" : ""}>${_esc(f)}</option>`).join("")}
        </select>
      </div>` : ""}
      <div class="bt-lista">
        ${filtrados.length ? rows : `<div class="bt-empty">${
          _boletosFiltro !== "todos" ? "Nenhum boleto nessa categoria."
          : (_boletosFornecedor ? `Nenhum boleto em aberto de ${_boletosFornecedor}.`
            : (boletos.length ? "Nenhum boleto em aberto — está tudo pago." : "Nenhum boleto cadastrado."))
        }</div>`}
        <p id="bt-busca-vazio" class="bt-empty" style="display:none">Nenhum boleto encontrado.</p>
      </div>
      ${filtrados.length ? `<div class="bt-total-bar">
        <span>Total ${labelFiltro} <small id="bt-total-qtd">(${filtrados.length} boleto${filtrados.length > 1 ? "s" : ""})</small></span>
        <strong id="bt-total-val">R$ ${formatarNumeroBR(totalFiltrado, 2)}</strong>
      </div>` : ""}
      <button class="botao-voltar-form" style="margin-top:6px" onclick="abrirMenuFinanceiro()">Voltar</button>
    </div>
  `;

  // Fecha menus ao clicar fora
  _filtrarBoletosBusca(_boletosBusca);
  document.addEventListener("click", _fecharMenusBoleto, { once: true });
}

function _filtrarBoletosBusca(termo) {
  _boletosBusca = termo || "";
  const t = (termo || "").trim().toLowerCase();
  let vis = 0, total = 0;
  const ehPagos = _boletosFiltro === "pagos";
  document.querySelectorAll(".bt-lista .bt-card").forEach(el => {
    const ok = !t || (el.dataset.busca || "").includes(t);
    el.style.display = ok ? "" : "none";
    if (!ok) return;
    vis++;
    // Recalcula o total só com os cards VISÍVEIS (coerência busca × total)
    const pago = el.dataset.pago === "1";
    if (ehPagos) total += Number(el.dataset.vpago) || Number(el.dataset.valor) || 0;
    else if (!pago) total += Number(el.dataset.rest) || 0;
  });
  const vazio = document.getElementById("bt-busca-vazio");
  if (vazio) vazio.style.display = vis === 0 ? "block" : "none";
  const qtdEl = document.getElementById("bt-total-qtd");
  const valEl = document.getElementById("bt-total-val");
  if (qtdEl) qtdEl.textContent = `(${vis} boleto${vis === 1 ? "" : "s"})`;
  if (valEl) valEl.textContent = "R$ " + formatarNumeroBR(total, 2);
}

function _toggleMenuBoleto(index) {
  const menu = document.getElementById(`bt-menu-${index}`);
  if (!menu) return;
  const aberto = menu.style.display !== "none";
  document.querySelectorAll(".bt-menu-drop").forEach(el => el.style.display = "none");
  if (!aberto) menu.style.display = "block";
}

function _setBoletoFornecedor(f) {
  _boletosFornecedor = f || "";
  abrirBoletos();
}

// Impressão SEM abrir janela nova. No app instalado (PWA), window.open abre uma
// tela sem barra de navegação e PRENDE o usuário (não tem como voltar, só
// fechando o app). Aqui a impressão roda num iframe OCULTO dentro do próprio
// app: abre o diálogo de impressão/salvar-PDF e, ao fechar, a pessoa continua
// exatamente onde estava.
function _imprimirDoc(html) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  // Espera o conteúdo montar antes de chamar a impressão.
  setTimeout(() => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); }
    catch (e) { console.log("Impressão:", e); }
  }, 350);
  // Some sozinho bem depois, sem atrapalhar o diálogo de impressão.
  setTimeout(() => { try { iframe.remove(); } catch (e) {} }, 60000);
}

function imprimirBoletos() {
  const todos = boletos.map((b, i) => ({ b, i, st: _statusBoleto(b.dataCompra, b.prazoDias) }));
  const naoPagos = todos.filter(x => !x.b.pago);

  let filtrados, titulo;
  if (_boletosFiltro === "vencendo") { filtrados = naoPagos.filter(x => x.st.tipo === "proximo" || x.st.tipo === "hoje"); titulo = "Boletos a vencer"; }
  else if (_boletosFiltro === "vencidos") { filtrados = naoPagos.filter(x => x.st.tipo === "vencido"); titulo = "Boletos vencidos"; }
  else if (_boletosFiltro === "pagos") { filtrados = todos.filter(x => x.b.pago); titulo = "Boletos pagos"; }
  else { filtrados = [...todos].sort((x, y) => (!!x.b.pago !== !!y.b.pago ? (x.b.pago ? 1 : -1) : x.st.diff - y.st.diff)); titulo = "Todos os boletos"; }

  // Aplica também o filtro de fornecedor selecionado
  if (_boletosFornecedor) {
    filtrados = filtrados.filter(x => (x.b.fornecedor || "").trim() === _boletosFornecedor);
    titulo += ` — ${_boletosFornecedor}`;
  }

  if (!filtrados.length) { _toastErro("Nenhum boleto para imprimir nessa seleção."); return; }

  // TOTAL da impressão: pagos total pago; demais o que ainda falta pagar
  const total = _boletosFiltro === "pagos"
    ? filtrados.reduce((s, x) => s + (x.b.valorPago || x.b.valor || 0), 0)
    : filtrados.reduce((s, x) => s + (x.b.pago ? 0 : _boletoRestante(x.b)), 0);
  const totalLbl = _boletosFiltro === "pagos" ? "TOTAL PAGO" : "TOTAL A PAGAR";
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const linhas = filtrados.map(({ b, st }) => {
    const situacao = b.pago ? "Pago" : ((b.valorPago || 0) > 0 && b.valor ? "Parcial" : st.label);
    const rest = _boletoRestante(b);
    const valor = b.valor
      ? "R$ " + formatarNumeroBR(b.pago ? b.valor : rest, 2) + (!b.pago && (b.valorPago || 0) > 0 ? `<br><small style="color:#888">de R$ ${formatarNumeroBR(b.valor, 2)}</small>` : "")
      : "-";
    return `<tr>
      <td>${_esc(b.nome)}</td>
      <td>${_esc(b.fornecedor || "-")}</td>
      <td style="text-align:center">${st.dataFmt}</td>
      <td style="text-align:center">${situacao}</td>
      <td style="text-align:right;font-weight:600">${valor}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${titulo}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:24px;color:#222;max-width:760px;margin:0 auto}
    h1{font-size:20px;color:#066b63;margin:0 0 4px;text-align:center}
    .sub{text-align:center;color:#666;font-size:12px;margin:0 0 20px}
    table{width:100%;border-collapse:collapse;font-size:12.5px}
    th{background:#066b63;color:#fff;padding:9px 10px;text-align:left}
    td{padding:8px 10px;border-bottom:1px solid #e5e7eb}
    tr:nth-child(even) td{background:#f6fafa}
    .total-row td{font-weight:700;font-size:14px;border-top:2px solid #066b63;border-bottom:none;color:#066b63;background:#fff}
    @media print{body{padding:0}}
  </style></head><body>
  <h1>${titulo}</h1>
  <p class="sub">Emitido em ${hoje} · ${filtrados.length} boleto${filtrados.length > 1 ? "s" : ""}</p>
  <table>
    <thead><tr><th>Nome</th><th>Fornecedor</th><th style="text-align:center">Vencimento</th><th style="text-align:center">Situação</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>
      ${linhas}
      <tr class="total-row"><td colspan="4">${totalLbl}</td><td style="text-align:right">R$ ${formatarNumeroBR(total, 2)}</td></tr>
    </tbody>
  </table>
  </body></html>`;

  _imprimirDoc(html);
}

function _fecharMenusBoleto() {
  document.querySelectorAll(".bt-menu-drop").forEach(el => el.style.display = "none");
}

function _mostrarConfirmarExcluir(index) {
  const row = document.getElementById(`bt-conf-${index}`);
  if (row) row.style.display = "flex";
}

// Quanto ainda falta pagar de um boleto (0 se não tiver valor total definido)
function _boletoRestante(b) {
  if (!b.valor || b.valor <= 0) return 0;
  return Math.max(0, b.valor - (b.valorPago || 0));
}

// Barra de progresso "pago X de Y · falta Z" (só quando há valor total)
function _boletoProgressoHtml(b) {
  if (!b.valor || b.valor <= 0) return "";
  const pago = b.valorPago || 0;
  const rest = _boletoRestante(b);
  const pct = Math.min(100, Math.round((pago / b.valor) * 100));
  const rs = v => "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `
    <div class="bt-prog">
      <div class="bt-prog-topo">
        <span>Pago <b>${rs(pago)}</b> de ${rs(b.valor)}</span>
        <span class="bt-prog-falta">${rest > 0 ? "Falta " + rs(rest) : "✓ Quitado"}</span>
      </div>
      <div class="bt-prog-barra"><div class="bt-prog-fill${rest <= 0 ? " cheio" : ""}" style="width:${pct}%"></div></div>
    </div>`;
}

// Botões de pagamento conforme o estado do boleto
function _boletoAcoesPagamentoHtml(index, b) {
  if (b.pago) {
    return `<button class="botao-salvar" style="margin-top:14px;background:#6b7280" onclick="desfazerUltimoPagamento(${index}, this)">↩️ Desfazer último pagamento</button>`;
  }
  const temTotal = b.valor && b.valor > 0;
  const jaPagouAlgo = (b.valorPago || 0) > 0;
  const rest = _boletoRestante(b);
  return `
    ${temTotal ? `
    <button class="botao-salvar" style="margin-top:14px;background:#066b63" onclick="abrirPagamentoParcial(${index})"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-3px;margin-right:7px"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/></svg>Registrar pagamento</button>
    <div id="bt-pagform-${index}" class="bt-pagform" style="display:none">
      <label>Valor do pagamento (R$)</label>
      <input type="text" inputmode="decimal" id="bt-pagvalor-${index}" placeholder="Ex: 200,00" onblur="formatarMoedaBlur(this)">
      <div class="bt-pagform-dica">Falta pagar R$ ${rest.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div class="bt-pagform-btns">
        <button class="bt-pag-cancelar" onclick="document.getElementById('bt-pagform-${index}').style.display='none'">Cancelar</button>
        <button class="bt-pag-ok" onclick="salvarPagamentoParcial(${index}, this)">Confirmar</button>
      </div>
    </div>` : ""}
    <button class="botao-salvar" style="margin-top:${temTotal ? 10 : 14}px;background:#16a34a" onclick="marcarBoletoPago(${index}, true, this)"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;vertical-align:-3px;margin-right:7px"><polyline points="20 6 9 17 4 12"/></svg>${jaPagouAlgo ? "Quitar o restante" : "Marcar como pago"}</button>
    ${!temTotal ? `<p class="rc-print-dica" style="margin-top:8px">Para pagar em partes, edite o boleto e informe o <b>valor total</b>.</p>` : ""}`;
}

function abrirPagamentoParcial(index) {
  const form = document.getElementById("bt-pagform-" + index);
  if (form) { form.style.display = form.style.display === "none" ? "block" : "none"; if (form.style.display === "block") document.getElementById("bt-pagvalor-" + index)?.focus(); }
}

async function salvarPagamentoParcial(index, botao) {
  if (_bloqueioEdicao()) return;
  if (botao?.disabled) return;
  const b = boletos[index];
  const inp = document.getElementById("bt-pagvalor-" + index);
  let valor = parseMoedaBR(inp ? inp.value : "");
  if (isNaN(valor) || valor <= 0) { _toastErro("Informe um valor de pagamento válido."); if (inp) inp.focus(); return; }
  const rest = _boletoRestante(b);
  if (rest > 0 && valor > rest + 0.005) valor = rest; // nunca paga mais que o restante
  valor = Math.round(valor * 100) / 100;

  const restaurar = _travarBotao(botao, "Salvando...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }
  const hoje = _hojeLocal();
  const _fmtRs = (n) => Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  // Pagamento ATÔMICO no banco: pagar_boleto trava a linha do boleto e SOMA o
  // pagamento lá dentro, então dois aparelhos pagando ao mesmo tempo não se
  // sobrescrevem (auditoria #6). O banco é a fonte da verdade — espelhamos a
  // resposta dele. Se a função ainda não existir (ou o cache do PostgREST não a
  // conhecer ainda), cai no jeito antigo — funciona, só sem a trava de corrida.
  const { data: res, error } = await supabaseClient.rpc("pagar_boleto", {
    p_boleto: b.id, p_valor: valor, p_data: hoje,
  });
  const _funcaoAusente = !!error && (error.code === "PGRST202" ||
    /could not find the function|pagar_boleto.*does not exist/i.test(error.message || ""));

  if (!error) {
    restaurar();
    b.valorPago = Number(res.valor_pago);
    if (Array.isArray(res.pagamentos)) b.pagamentos = res.pagamentos;
    if (res.pago) { b.pago = true; b.dataPagamento = hoje; }
    const pagou = Number(res.valor_pagou);
    _toastSucesso(res.pago ? "Boleto quitado! ✓" : "Pagamento de R$ " + _fmtRs(pagou > 0 ? pagou : valor) + " registrado.");
    verDetalhesBoleto(index);
    return;
  }
  if (!_funcaoAusente) { restaurar(); _toastErro("Erro ao registrar pagamento: " + error.message); return; }

  // Fallback (função não instalada): caminho antigo, sem proteção de corrida.
  const novosPagamentos = [...(b.pagamentos || []), { data: hoje, valor }];
  const novoValorPago = Math.round(((b.valorPago || 0) + valor) * 100) / 100;
  const quitou = b.valor && novoValorPago >= b.valor - 0.005;
  const patch = { valor_pago: novoValorPago, pagamentos: novosPagamentos };
  if (quitou) { patch.pago = true; patch.data_pagamento = hoje; }
  const { error: e2 } = await supabaseClient.from("boletos").update(patch).eq("id", b.id).eq("user_id", usuario.id);
  restaurar();
  if (e2) { _toastErro("Erro ao registrar pagamento: " + e2.message); return; }
  b.valorPago = novoValorPago; b.pagamentos = novosPagamentos;
  if (quitou) { b.pago = true; b.dataPagamento = hoje; }
  _toastSucesso(quitou ? "Boleto quitado! ✓" : "Pagamento de R$ " + _fmtRs(valor) + " registrado.");
  verDetalhesBoleto(index);
}

async function desfazerUltimoPagamento(index, botao) {
  if (_bloqueioEdicao()) return;
  // Sem trava, dois toques rápidos desfaziam DOIS pagamentos (o 2º toque já
  // enxergava a lista sem a última parcela) — e não há como saber que foi isso.
  if (botao?.disabled) return;
  const b = boletos[index];
  const restaurar = _travarBotao(botao, "Desfazendo...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }
  const pgs = [...(b.pagamentos || [])];
  const ultimo = pgs.pop();
  const novoValorPago = Math.max(0, Math.round(((b.valorPago || 0) - (ultimo ? Number(ultimo.valor) : 0)) * 100) / 100);
  // Se não havia parcelas registradas (quitação direta), apenas reabre o boleto
  const { error } = await supabaseClient.from("boletos")
    .update({ pago: false, data_pagamento: null, valor_pago: ultimo ? novoValorPago : 0, pagamentos: pgs })
    .eq("id", b.id).eq("user_id", usuario.id);
  if (error) { restaurar(); _toastErro("Erro ao desfazer: " + error.message); return; }
  b.pago = false; b.dataPagamento = null;
  b.valorPago = ultimo ? novoValorPago : 0;
  b.pagamentos = pgs;
  verDetalhesBoleto(index);
}

function verDetalhesBoleto(index) {
  const area = document.getElementById("area-gestao");
  const b = boletos[index];
  const st = _statusBoleto(b.dataCompra, b.prazoDias);

  const [ano, mes, dia] = b.dataCompra.split("-").map(Number);
  const dataCompraFmt = new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR");

  area.innerHTML = `
    <h3 class="titulo-secao">${_esc(b.nome)}</h3>
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
        <div class="bt-det-linha"><span>Fornecedor</span><strong>${_esc(b.fornecedor || "—")}</strong></div>
        <div class="bt-det-linha"><span>Data da compra</span><strong>${dataCompraFmt}</strong></div>
        <div class="bt-det-linha"><span>Prazo</span><strong>${b.prazoDias} dias</strong></div>
        <div class="bt-det-linha"><span>Vencimento</span><strong>${st.dataFmt}</strong></div>
        ${b.pago && b.dataPagamento ? `<div class="bt-det-linha"><span>Quitado em</span><strong>${formatarData(b.dataPagamento)}</strong></div>` : ""}
        ${b.valor ? `<div class="bt-det-linha bt-det-valor"><span>Valor total</span><strong>R$ ${b.valor.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></div>` : ""}
      </div>
      ${_boletoProgressoHtml(b)}
      ${_boletoAcoesPagamentoHtml(index, b)}
      <div style="display:flex;gap:10px;margin-top:10px">
        <button class="botao-salvar" style="flex:1" onclick="abrirFormBoleto(${index})"><svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-2px;margin-right:6px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>
        <button class="botao-salvar" style="flex:1;background:#ef4444" onclick="document.getElementById('confirmar-excluir-det').style.display='block'"><svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-2px;margin-right:6px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Excluir</button>
      </div>
      <div id="confirmar-excluir-det" class="painel-confirmar-boleto" style="display:none;margin-top:10px">
        <p class="confirmar-boleto-pergunta">Excluir este boleto?</p>
        <div class="confirmar-boleto-botoes">
          <button class="confirmar-boleto-btn-cancelar" onclick="document.getElementById('confirmar-excluir-det').style.display='none'">Cancelar</button>
          <button class="confirmar-boleto-btn-excluir" onclick="excluirBoleto(${index}, this)">Excluir</button>
        </div>
      </div>
      <div class="bt-det-historico">
        <h4>Histórico</h4>
        <div class="bt-hist-linha"><span class="bt-hist-data">${dataCompraFmt}</span><span class="bt-hist-txt">Boleto cadastrado</span></div>
        <div class="bt-hist-linha"><span class="bt-hist-data">${dataCompraFmt}</span><span class="bt-hist-txt">Vencimento definido: ${st.dataFmt}</span></div>
        ${(b.pagamentos || []).map(p => `<div class="bt-hist-linha"><span class="bt-hist-data">${formatarData(p.data)}</span><span class="bt-hist-txt">Pagamento de R$ ${Number(p.valor).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>`).join("")}
        ${b.pago && b.dataPagamento ? `<div class="bt-hist-linha"><span class="bt-hist-data">${formatarData(b.dataPagamento)}</span><span class="bt-hist-txt">✓ Boleto quitado</span></div>` : ""}
      </div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirBoletos()">Voltar</button>
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
        <input type="text" id="boleto-nome" placeholder="Ex: Ração ABC" value="${_attr(b ? b.nome : "")}">
      </div>
      <div class="campo-form">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <label>Fornecedor</label>
        </div>
        <input type="text" id="boleto-fornecedor" placeholder="Ex: Loja do João" value="${_attr(b ? b.fornecedor : "")}">
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
      <button class="botao-salvar" onclick="_executarSalvamento(this, () => salvarBoleto(${editando ? index : "null"}))">${editando ? "Salvar boleto" : "Salvar boleto"}</button>
      <div class="separador-ou"><span>ou</span></div>
      <button class="botao-voltar-form" onclick="abrirBoletos()">Voltar</button>
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
  if (_bloqueioEdicao()) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque

  const nome = document.getElementById("boleto-nome").value.trim();
  const fornecedor = document.getElementById("boleto-fornecedor").value.trim();
  const valorRaw = document.getElementById("boleto-valor").value;
  const valor = valorRaw ? parseMoedaBR(valorRaw) : null;
  const dataCompra = document.getElementById("boleto-data").value;
  const prazoDias = parseInt(document.getElementById("boleto-prazo").value);
  const erroDiv = document.getElementById("msg-boleto-erro");

  const mostrarErroBoleto = (msg) => { if (erroDiv) { erroDiv.textContent = msg; erroDiv.style.display = "block"; } };
  if (erroDiv) erroDiv.style.display = "none";

  if (!nome) return mostrarErroBoleto("Informe o nome do boleto.");
  if (!fornecedor) return mostrarErroBoleto("Informe o fornecedor.");
  if (!dataCompra) return mostrarErroBoleto("Informe a data da compra.");
  if (!prazoDias || prazoDias < 1) return mostrarErroBoleto("Informe o prazo em dias.");

  const restaurar = _travarBotao(botao, "Salvando...");

  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const editando = index !== null && index !== undefined && index !== "null";

  if (editando) {
    const b = boletos[index];
    // "pago" tem de acompanhar o novo valor: se o total sobe acima do que já foi
    // pago, o boleto deixa de estar quitado (antes continuava "pago" com saldo em
    // aberto — auditoria). Só recalcula quando há valor (>0); boleto sem valor
    // tem baixa manual e essa não é mexida aqui.
    const jaPago = Number(b.valorPago) || 0;
    let pago = b.pago, dataPagamento = b.dataPagamento || null;
    if (valor != null && valor > 0) {
      pago = jaPago >= valor - 0.005;
      if (!pago) dataPagamento = null;
    }
    const { error } = await supabaseClient.from("boletos").update({
      nome, fornecedor, valor, data_compra: dataCompra, prazo_dias: prazoDias,
      pago, data_pagamento: dataPagamento,
    }).eq("id", b.id).eq("user_id", usuario.id);
    if (error) { restaurar(); return mostrarErroBoleto("Erro ao salvar. Tente novamente."); }
    boletos[index] = { ...b, nome, fornecedor, valor, dataCompra, prazoDias, pago, dataPagamento };
  } else {
    const { data, error } = await supabaseClient.from("boletos").insert({
      user_id: usuario.id, nome, fornecedor, valor, data_compra: dataCompra, prazo_dias: prazoDias,
    }).select().single();
    if (error) { restaurar(); return mostrarErroBoleto("Erro ao salvar. Tente novamente."); }
    boletos.push({ id: data.id, nome, fornecedor, valor, dataCompra, prazoDias });
  }

  abrirBoletos();
}

async function excluirBoleto(index, botao) {
  if (_bloqueioEdicao()) return;
  if (botao?.disabled) return;
  const restaurar = _travarBotao(botao, "Excluindo...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }
  const { error } = await supabaseClient.from("boletos")
    .update({ ativo: false }).eq("id", boletos[index].id).eq("user_id", usuario.id);
  if (error) { console.error(error); restaurar(); _toastErro("Erro ao excluir."); return; }
  boletos.splice(index, 1);
  abrirBoletos();
}

async function marcarBoletoPago(index, voltarDetalhe, botao) {
  if (_bloqueioEdicao()) return;
  if (botao?.disabled) return; // evita duplo toque
  const restaurar = _travarBotao(botao, "Salvando...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }
  const b = boletos[index];
  const hoje = _hojeLocal();
  const patch = { pago: true, data_pagamento: hoje };
  // Se tem valor total, quita o restante e registra esse pagamento no histórico
  if (b.valor && b.valor > 0) {
    const rest = _boletoRestante(b);
    patch.valor_pago = b.valor;
    patch.pagamentos = rest > 0 ? [...(b.pagamentos || []), { data: hoje, valor: Math.round(rest * 100) / 100 }] : (b.pagamentos || []);
  }
  const { error } = await supabaseClient.from("boletos")
    .update(patch).eq("id", b.id).eq("user_id", usuario.id);
  if (error) { console.error(error); restaurar(); _toastErro("Erro ao marcar como pago: " + error.message); return; }
  b.pago = true;
  b.dataPagamento = hoje;
  if (patch.valor_pago != null) { b.valorPago = patch.valor_pago; b.pagamentos = patch.pagamentos; }
  _toastSucesso("Boleto quitado.");
  if (voltarDetalhe) verDetalhesBoleto(index); else abrirBoletos();
}

async function desmarcarBoletoPago(index, voltarDetalhe, botao) {
  if (_bloqueioEdicao()) return;
  if (botao?.disabled) return; // evita duplo toque
  const restaurar = _travarBotao(botao, "Desfazendo...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }
  // Reabre e zera os pagamentos (ação rápida de "desfazer" a partir da lista)
  const { error } = await supabaseClient.from("boletos")
    .update({ pago: false, data_pagamento: null, valor_pago: 0, pagamentos: [] })
    .eq("id", boletos[index].id).eq("user_id", usuario.id);
  if (error) { console.error(error); restaurar(); _toastErro("Erro ao desfazer: " + error.message); return; }
  boletos[index].pago = false;
  boletos[index].dataPagamento = null;
  boletos[index].valorPago = 0;
  boletos[index].pagamentos = [];
  if (voltarDetalhe) verDetalhesBoleto(index); else abrirBoletos();
}


// ═══ FINANCEIRO ════════════════════════════════════════════════════════════════

function abrirFinanceiro() {
  esconderMenu();
  // Guarda o ID, não o índice: renomear/remover um viveiro pode reordenar a lista.
  const escolhido = viveiros.findIndex(v => v.id === _finViveiroId);
  if (escolhido < 0) { _finViveiroId = null; _finCicloSel = ""; }
  else if (_finCicloSel && !_finInfoCicloSel(viveiros[escolhido])) _finCicloSel = "";
  _finCicloWin = null;
  // Período padrão: mês atual
  if (!_finPeriodoInicializado) {
    _finPeriodoInicializado = true;
    const now = new Date();
    const ini = new Date(now.getFullYear(), now.getMonth(), 1);
    const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    _finPeriodoIni = _dataLocalISO(ini);
    _finPeriodoFim = _dataLocalISO(fim);
  }
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <div class="fin-topo-acoes">
      <h3 class="titulo-secao" style="margin:0">Relatório financeiro</h3>
      <button class="fin-novo-btn" onclick="imprimirRelatorioFinanceiro()"><svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-2px;margin-right:5px"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Imprimir</button>
    </div>
    <div class="cfg-wrap">
      <div class="campo-form">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
          <label>Viveiro</label>
        </div>
        <select id="viveiroFinanceiro" onchange="_finTrocarViveiro()">
          <option value="">Todos os viveiros</option>
          ${viveiros.map((v, i) => `<option value="${i}"${i === escolhido ? " selected" : ""}>${_esc(v.nome)}</option>`).join("")}
        </select>
      </div>
      <div id="fin-ciclo-wrap"></div>
      <div class="campo-form" id="fin-periodo-wrap" style="margin-bottom:6px">
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
        <button class="fin-modo-btn ${_financeiroModo === "detalhado" ? "ativo" : ""}" data-modo="detalhado" onclick="_finTrocarModo('detalhado')">Detalhado</button>
        <button class="fin-modo-btn ${_financeiroModo === "resumido" ? "ativo" : ""}" data-modo="resumido" onclick="_finTrocarModo('resumido')">Por tipo</button>
      </div>
      <div id="resultado-financeiro"></div>
      <button class="botao-voltar-form" style="margin-top:14px" onclick="abrirMenuFinanceiro()">Voltar</button>
    </div>
  `;
  _finRenderCicloSel();
  _finAtualizarPeriodoVisivel();
  mostrarCustosFinanceiro();
}

function _finSetPeriodo() {
  _finPeriodoIni = document.getElementById("finPeriodoIni")?.value || "";
  _finPeriodoFim = document.getElementById("finPeriodoFim")?.value || "";
  _finPagina = 0;
  mostrarCustosFinanceiro();
}

function _finLimparFiltros() {
  _finViveiroId = null;
  _finPeriodoIni = ""; _finPeriodoFim = ""; _finPagina = 0;
  _finCicloSel = ""; _finCicloWin = null;
  const a = document.getElementById("finPeriodoIni"); if (a) a.value = "";
  const b = document.getElementById("finPeriodoFim"); if (b) b.value = "";
  const v = document.getElementById("viveiroFinanceiro"); if (v) v.value = "";
  _finRenderCicloSel();
  _finAtualizarPeriodoVisivel();
  mostrarCustosFinanceiro();
}

// Monta (ou limpa) o seletor de ciclo. Só aparece quando há UM viveiro escolhido;
// lista "Todos (por período)", "Ciclo atual" e cada ciclo já encerrado do viveiro.
function _finRenderCicloSel() {
  const wrap = document.getElementById("fin-ciclo-wrap");
  if (!wrap) return;
  const idx = document.getElementById("viveiroFinanceiro")?.value ?? "";
  if (idx === "") { wrap.innerHTML = ""; return; }
  const v = viveiros[idx];
  const encerrados = [...(v.ciclosFinalizados || [])]
    .filter(c => c.cicloId)
    .sort((a, b) => (b.dataEncerramento || "").localeCompare(a.dataEncerramento || ""));
  const opcoes = [
    `<option value="">Todos (por período)</option>`,
    `<option value="atual" ${_finCicloSel === "atual" ? "selected" : ""}>Ciclo ${_numeroCicloAtual(v)} (atual)</option>`,
    ...encerrados.map(c => {
      const n = _numeroCicloEncerrado(v, c);
      return `<option value="${c.cicloId}" ${_finCicloSel === c.cicloId ? "selected" : ""}>${n ? `Ciclo ${n} — ` : ""}encerrado ${formatarData(c.dataEncerramento)}</option>`;
    }),
  ];
  wrap.innerHTML = `
    <div class="campo-form" style="margin-bottom:6px">
      <div class="campo-label">
        <svg class="campo-icone" viewBox="0 0 24 24"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/></svg>
        <label>Ciclo</label>
      </div>
      <select id="cicloFinanceiro" onchange="_finTrocarCiclo()">${opcoes.join("")}</select>
    </div>`;
}

// Trocou o viveiro: volta para o modo período e remonta o seletor de ciclo.
function _finTrocarViveiro() {
  const idx = document.getElementById("viveiroFinanceiro")?.value;
  _finViveiroId = idx !== "" ? (viveiros[idx]?.id || null) : null;
  _finCicloSel = ""; _finCicloWin = null; _finPagina = 0;
  _finRenderCicloSel();
  _finAtualizarPeriodoVisivel();
  mostrarCustosFinanceiro();
}

// Trocou o ciclo escolhido.
function _finTrocarCiclo() {
  _finCicloSel = document.getElementById("cicloFinanceiro")?.value || "";
  _finPagina = 0;
  _finAtualizarPeriodoVisivel();
  mostrarCustosFinanceiro();
}

// Esconde o filtro de período quando um ciclo específico está escolhido (o ciclo
// já define o intervalo). Volta a aparecer no modo "Todos (por período)".
function _finAtualizarPeriodoVisivel() {
  const p = document.getElementById("fin-periodo-wrap");
  if (p) p.style.display = _finCicloSel ? "none" : "";
}

// Resolve a janela e o rateio congelado do ciclo escolhido no financeiro.
function _finInfoCicloSel(v) {
  if (_finCicloSel === "atual") {
    const ini = v.dataPreparacao || v.dataPovoamento || null;
    if (!ini) return null;
    return { cicloId: v.cicloId, ini, fim: _hojeLocal(), rateioCongelado: null };
  }
  const cf = (v.ciclosFinalizados || []).find(c => c.cicloId === _finCicloSel);
  if (!cf) return null;
  const ini = cf.dataPreparacao || cf.dataPovoamento || null;
  return {
    cicloId: cf.cicloId, ini, fim: cf.dataEncerramento || _hojeLocal(),
    rateioCongelado: (cf.custoFixoRateado != null ? cf.custoFixoRateado : null),
  };
}

function _finTipoLabel(c) {
  if (c.tipo === "fixo") return "Rateio automático";
  return c.tipo === "produto" ? "Produto" : "Outro custo";
}

// Gera itens VIRTUAIS de rateio dos custos fixos (funcionário, energia…) para a
// tela financeira. Não materializa linhas na tabela custos — são calculados na
// hora. Cada custo fixo vira um item por viveiro, com o valor rateado no período.
function _finItensRateioFixo(alvos) {
  if (!custosFixos.some(c => c.dataFim || c.ativo !== false)) return [];
  const hoje = _hojeLocal();
  const pIni = _finPeriodoIni || null, pFim = _finPeriodoFim || null;
  const itens = [];
  // Acumula o rateio dos custos fixos de UM viveiro numa janela [janIni, janFim]
  // (cortada pelo período do filtro) e empurra um item por custo fixo.
  const acumularJanela = (v, janIni, janFim) => {
    if (!janIni || !janFim) return;
    for (const cf of custosFixos) {
      // Legado desativado sem data de fim nunca vale em data nenhuma — pula.
      // Os demais (ativos, ou desativados COM data de fim) contam nos dias em
      // que valiam, exatamente como o rateio por ciclo.
      if (!cf.dataFim && cf.ativo === false) continue;
      // Janela = max(data_inicio do custo, início da janela) .. fim da janela,
      // interceptada com o período do filtro financeiro.
      let ini = janIni;
      if (cf.dataInicio && cf.dataInicio > ini) ini = cf.dataInicio;
      let fim = janFim;
      if (pIni && pIni > ini) ini = pIni;
      if (pFim && pFim < fim) fim = pFim;
      if (ini > fim) continue;
      // Acumula a parcela diária deste custo (função-base compartilhada, dias reais do mês).
      // _custoFixoValeNaData respeita início E fim do custo — mesma fonte do ciclo.
      let val = 0, cur = ini, guard = 0;
      while (cur <= fim && guard < 5000) {
        if (_custoFixoValeNaData(cf, cur)) {
          val += _rateioFixoDia(cf.valorMensal, cur, _viveirosAtivosNaData(cur, hoje));
        }
        cur = _maAddDias(cur, 1); guard++;
      }
      if (val > 0.005) {
        itens.push({
          tipo: "fixo", produtoId: null,
          nomeProduto: cf.nome + " — rateio automático",
          categoria: _custoFixoCatLabel(cf.categoria),
          quantidadeG: null, valor: Number(val.toFixed(2)),
          data: fim, viveiroNome: v.nome, virtual: true,
          periodoIni: ini, periodoFim: fim,
        });
      }
    }
  };
  for (const v of alvos) {
    // Ciclo ATIVO (preparação/cultivo em andamento): conta até hoje.
    const vIni = v.dataPreparacao || v.dataPovoamento;
    if (vIni) acumularJanela(v, vIni, hoje);
    // Ciclos JÁ ENCERRADOS: sem isto, o rateio de custos fixos deles sumia do
    // filtro por datas (aparecia só na visão por ciclo). Cada um conta na sua
    // própria janela [preparação/povoamento .. encerramento].
    for (const cicloF of (v.ciclosFinalizados || [])) {
      const ci = cicloF.dataPreparacao || cicloF.dataPovoamento;
      if (ci && cicloF.dataEncerramento) acumularJanela(v, ci, cicloF.dataEncerramento);
    }
  }
  return itens;
}

// Ração do ciclo ATIVO expandida em um item por lançamento, com a data real de
// cada um. O registro derivado único fica datado no PRIMEIRO lançamento e
// distorce o filtro por período (toda a ração cai no primeiro dia). Usa a mesma
// precificação de _racaoDerivada (preço do catálogo × kg), então o total bate.
function _racaoLancamentosAtivo(v) {
  return (v.racoes || []).filter(r => r.tipoRacaoId && r.racao > 0).map(r => {
    const t = tiposRacao.find(x => x.id === r.tipoRacaoId);
    return {
      tipo: "produto", produtoId: null, nomeProduto: "Ração", categoria: "Ração",
      quantidadeG: r.racao * 1000, valor: r.racao * (t ? (t.custoPorKg || 0) : 0),
      data: r.data, derivado: true, cicloId: v.cicloId || null,
    };
  });
}

// Custos de um viveiro para o filtro por PERÍODO: troca o registro derivado
// único de Ração pelos lançamentos por data (auditoria #4). Custos gravados
// (inclusive a ração de ciclos encerrados) seguem como estão.
function _finCustosDoViveiro(v) {
  const semDerivado = (v.custos || []).filter(c => !c.derivado);
  return semDerivado.concat(_racaoLancamentosAtivo(v)).map(c => ({ ...c, viveiroNome: v.nome }));
}

function _finColetarCustos() {
  const viveiroIndex = document.getElementById("viveiroFinanceiro")?.value ?? "";
  const porViveiro = viveiroIndex !== "";

  // Modo CICLO: um viveiro + um ciclo específico escolhido. Usa a MESMA fonte
  // por-ciclo do card "Custo parcial" (_custosCicloAtivo), então o total bate
  // exatamente com o que o produtor vê dentro do viveiro. O rateio dos custos
  // fixos entra como um único item (do ciclo), não pelo cálculo por período.
  if (porViveiro && _finCicloSel) {
    const v = viveiros[viveiroIndex];
    const info = _finInfoCicloSel(v);
    if (info) {
      _finCicloWin = { ini: info.ini, fim: info.fim };
      const cc = _custosCicloAtivo(v, info.cicloId, info.ini, info.fim, info.rateioCongelado);
      let custos = cc.manuais.map(c => ({ ...c, viveiroNome: v.nome }));
      if (cc.rateioFixo > 0.005) {
        custos = custos.concat([{
          tipo: "fixo", produtoId: null,
          nomeProduto: "Custos fixos — rateio do ciclo",
          categoria: "Rateio automático",
          quantidadeG: null, valor: Number(cc.rateioFixo.toFixed(2)),
          data: info.fim, viveiroNome: v.nome, virtual: true,
          periodoIni: info.ini, periodoFim: info.fim,
        }]);
      }
      return { custos, porViveiro };
    }
  }

  _finCicloWin = null;
  const alvos = porViveiro ? [viveiros[viveiroIndex]] : viveiros;
  let custos;
  if (porViveiro) {
    custos = _finCustosDoViveiro(viveiros[viveiroIndex]);
  } else {
    custos = viveiros.flatMap(_finCustosDoViveiro);
  }
  if (_finPeriodoIni) custos = custos.filter(c => c.data >= _finPeriodoIni);
  if (_finPeriodoFim) custos = custos.filter(c => c.data <= _finPeriodoFim);
  // Injeta os itens virtuais de rateio dos custos fixos (não editáveis pela lista)
  custos = custos.concat(_finItensRateioFixo(alvos));
  return { custos, porViveiro };
}

// A pastilha branca marcava sempre "Detalhado". O conteúdo trocava certo, mas
// os botões são desenhados uma vez só pela tela de cima, e quem troca de aba só
// redesenhava a área de baixo — então a marca ficava presa na primeira opção, e
// a pessoa tocava de novo achando que não tinha pegado.
function _finTrocarModo(modo) {
  _financeiroModo = modo;
  if (modo === "detalhado") _finPagina = 0;
  document.querySelectorAll(".fin-modo-btn").forEach(b => {
    b.classList.toggle("ativo", b.dataset.modo === modo);
  });
  mostrarCustosFinanceiro();
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
    _finRenderDetalhado(resultado, custos, total, porViveiro);
  }
}

// Agrupa custos por categoria (Larva, Ração, Mão de obra, Energia…), somando o
// valor de todos os viveiros. Usado na visão consolidada de "Todos os viveiros".
function _finGruposCategoria(custos) {
  const grupos = {};
  custos.forEach(c => {
    const chave = c.tipo === "fixo" ? (c.categoria || "Custos fixos")
      : (c.tipo === "outro" ? (c.categoria || c.nomeProduto || "Outro custo")
        : (c.categoria || "Outros"));
    if (!grupos[chave]) grupos[chave] = { nome: chave, total: 0, qtd: 0, viveiros: new Set() };
    grupos[chave].total += Number(c.valor);
    grupos[chave].qtd += 1;
    if (c.viveiroNome) grupos[chave].viveiros.add(c.viveiroNome);
  });
  return Object.values(grupos).sort((a, b) => b.total - a.total);
}

function _finRenderDetalhado(resultado, custos, total, porViveiro) {
  // No modo ciclo, a comparação "% do total do período" não se aplica (a tela
  // mostra um ciclo inteiro, não uma fatia do mês). Fora dele, mantém a conta
  // antiga: quanto este recorte representa do total geral no mesmo período.
  const modoCiclo = !!_finCicloWin;
  let pct = 100;
  if (!modoCiclo) {
    let custosGeral = viveiros.flatMap(v => (v.custos || []));
    if (_finPeriodoIni) custosGeral = custosGeral.filter(c => c.data >= _finPeriodoIni);
    if (_finPeriodoFim) custosGeral = custosGeral.filter(c => c.data <= _finPeriodoFim);
    custosGeral = custosGeral.concat(_finItensRateioFixo(viveiros));
    const totalGeral = custosGeral.reduce((s, c) => s + Number(c.valor), 0);
    pct = totalGeral > 0 ? Math.round((total / totalGeral) * 100) : 100;
  }

  // dias: no modo ciclo, os dias reais do ciclo (povoamento/preparação → fim);
  // fora dele, os dias do período escolhido.
  let dias;
  if (modoCiclo && _finCicloWin.ini && _finCicloWin.fim) {
    dias = Math.max(1, Math.round((_parseDataLocal(_finCicloWin.fim) - _parseDataLocal(_finCicloWin.ini)) / 86400000) + 1);
  } else if (_finPeriodoIni && _finPeriodoFim) {
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

  // Consolidação por categoria (visão "Todos os viveiros")
  const grupos = !porViveiro ? _finGruposCategoria(custos) : null;
  const maiorCat = grupos && grupos.length ? grupos[0] : null;

  // 4º card: por viveiro mostra o maior lançamento; consolidado, a maior categoria
  const cardMaiorHtml = porViveiro
    ? `<div class="fin-card">
        <div class="fin-card-top"><svg viewBox="0 0 24 24"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg><span>Maior lançamento</span></div>
        <strong>R$ ${formatarNumeroBR(Number(maior.valor), 2)}</strong>
        <small>${_esc(maior.nomeProduto || "—")} · ${formatarData(maior.data)}</small>
      </div>`
    : `<div class="fin-card">
        <div class="fin-card-top"><svg viewBox="0 0 24 24"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg><span>Maior categoria</span></div>
        <strong>R$ ${formatarNumeroBR(maiorCat ? maiorCat.total : 0, 2)}</strong>
        <small>${_esc(maiorCat ? maiorCat.nome : "—")}</small>
      </div>`;

  // Lista: por viveiro = lançamento a lançamento (com ordenação/paginação);
  // consolidado = um valor por categoria, somando todos os viveiros.
  const listaBlocoHtml = porViveiro
    ? `<div class="fin-lista-head">
        <span>Lançamentos de custos</span>
        <select class="fin-ordenar" onchange="_finOrdenacao=this.value;_finPagina=0;mostrarCustosFinanceiro()">
          <option value="data" ${ord === "data" ? "selected" : ""}>Data</option>
          <option value="valor" ${ord === "valor" ? "selected" : ""}>Valor</option>
          <option value="descricao" ${ord === "descricao" ? "selected" : ""}>Descrição</option>
        </select>
      </div>
      <div class="fin-lista">
        ${pagina.map(c => `
          <div class="fin-linha${c.virtual ? " fin-linha-virtual" : ""}">
            <span class="fin-linha-data">${formatarData(c.data)}</span>
            <span class="fin-linha-viveiro">${abreviarViveiro(c.viveiroNome || "")}</span>
            <span class="fin-linha-desc">${_esc(c.nomeProduto || "—")}<small>${c.virtual ? "Rateio · " + formatarData(c.periodoIni) + "–" + formatarData(c.periodoFim) : _finTipoLabel(c)}</small></span>
            <span class="fin-linha-valor">R$ ${formatarNumeroBR(Number(c.valor), 2)}</span>
          </div>
        `).join("")}
      </div>
      ${totalPag > 1 ? `
        <div class="fin-paginacao">
          <button ${_finPagina <= 0 ? "disabled" : ""} onclick="_finPagina--;mostrarCustosFinanceiro()">Anterior</button>
          <span>Pág. ${_finPagina + 1} / ${totalPag}</span>
          <button ${_finPagina >= totalPag - 1 ? "disabled" : ""} onclick="_finPagina++;mostrarCustosFinanceiro()">Próxima</button>
        </div>` : ""}`
    : `<div class="fin-lista-head">
        <span>Custos por categoria</span>
        <small class="fin-lista-hint">Todos os viveiros somados</small>
      </div>
      <div class="fin-lista">
        ${grupos.map(g => `
          <div class="fin-linha fin-linha-cat">
            <span class="fin-linha-desc">${_esc(g.nome)}<small>${g.qtd} lançamento${g.qtd > 1 ? "s" : ""} · ${g.viveiros.size} viveiro${g.viveiros.size > 1 ? "s" : ""}</small></span>
            <span class="fin-linha-valor">R$ ${formatarNumeroBR(g.total, 2)}</span>
          </div>
        `).join("")}
      </div>`;

  resultado.innerHTML = `
    <div class="fin-cards">
      <div class="fin-card">
        <div class="fin-card-top"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>Total de custos</span></div>
        <strong>R$ ${formatarNumeroBR(total, 2)}</strong>
        <small>${modoCiclo ? "deste ciclo" : pct + "% do total"}</small>
      </div>
      <div class="fin-card">
        <div class="fin-card-top"><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg><span>Lançamentos</span></div>
        <strong>${custos.length}</strong>
        <small>Itens registrados</small>
      </div>
      <div class="fin-card">
        <div class="fin-card-top"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>Custo médio / dia</span></div>
        <strong>R$ ${formatarNumeroBR(mediaDia, 2)}</strong>
        <small>${modoCiclo ? "No ciclo" : "No período"}</small>
      </div>
      ${cardMaiorHtml}
    </div>

    ${listaBlocoHtml}
    <div class="fin-total-geral">
      <div class="fin-total-geral-ico"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
      <div class="fin-total-geral-txt">
        <span>${modoCiclo ? "Total do ciclo" : "Total geral no período"}</span>
        <strong>R$ ${formatarNumeroBR(total, 2)}</strong>
      </div>
    </div>
  `;
}

function _finRenderPorTipo(resultado, custos, total) {
  // MESMA regra do "Detalhado", de propósito. Antes esta tela jogava TODO custo
  // avulso num balde chamado "Outro custo" — e como a pós-larva é o maior gasto
  // do ciclo, ela sozinha virava 87% de um pedaço sem nome, escondendo tudo o
  // que estava junto dela. Duas abas com contas diferentes é pior que uma aba
  // só: o produtor não sabe em qual acreditar.
  const lista = _finGruposCategoria(custos);
  const cores = ["rgb(6,107,99)", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#14b8a6", "#ec4899", "#84cc16"];

  // A rosca só aguenta umas 8 fatias antes de virar borrão. O que passa disso
  // entra somado como "Demais custos" — e o nome NÃO é "Outros" de propósito,
  // porque muita gente tem uma categoria chamada exatamente assim.
  const CABEM = cores.length - 1;
  const naPizza = lista.length > cores.length
    ? lista.slice(0, CABEM).concat([{
        nome: "Demais custos",
        total: lista.slice(CABEM).reduce((s, g) => s + g.total, 0),
        qtd: lista.slice(CABEM).reduce((s, g) => s + g.qtd, 0),
      }])
    : lista;

  resultado.innerHTML = `
    <div class="fin-secao-titulo" style="margin-top:4px">Resumo por tipo</div>
    <div class="fin-pizza-wrap">
      <div class="fin-pizza-canvas">
        <canvas id="finPizza"></canvas>
        <div class="fin-pizza-centro"><span>Total</span><strong>R$ ${formatarNumeroBR(total, 2)}</strong></div>
      </div>
      <div class="fin-pizza-legenda">
        ${naPizza.map((g, i) => `
          <div class="fin-leg-item">
            <span class="fin-leg-dot" style="background:${cores[i % cores.length]}"></span>
            <span class="fin-leg-nome">${_esc(g.nome)}</span>
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
          <span class="fin-rank-nome">${_esc(g.nome)}</span>
          <span class="fin-rank-val">R$ ${formatarNumeroBR(g.total, 2)}</span>
        </div>
      `).join("")}
    </div>
  `;

  setTimeout(() => {
    const cv = document.getElementById("finPizza");
    if (!cv || typeof Chart === "undefined") return;
    _prepararCanvasGrafico(cv);
    new Chart(cv.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: naPizza.map(g => g.nome),
        datasets: [{ data: naPizza.map(g => g.total), backgroundColor: naPizza.map((_, i) => cores[i % cores.length]), borderWidth: 2, borderColor: "#fff" }]
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
  const { custos, porViveiro } = _finColetarCustos();
  if (!custos.length) { _toastErro("Nenhum custo no período para imprimir."); return; }
  const total = custos.reduce((s, c) => s + Number(c.valor), 0);
  const periodoTxt = (_finPeriodoIni || _finPeriodoFim)
    ? `${_finPeriodoIni ? formatarData(_finPeriodoIni) : "início"} até ${_finPeriodoFim ? formatarData(_finPeriodoFim) : "hoje"}`
    : "Todo o período";
  let cabecalho, linhas, subtitulo;
  if (porViveiro) {
    // Um viveiro: detalhe lançamento a lançamento
    subtitulo = custos[0].viveiroNome || "";
    const ordenados = [...custos].sort((a, b) => b.data.localeCompare(a.data));
    cabecalho = `<tr><th>Data</th><th>Viveiro</th><th>Descrição</th><th>Valor</th></tr>`;
    linhas = ordenados.map(c => `<tr><td>${formatarData(c.data)}</td><td>${_esc(c.viveiroNome || "")}</td><td>${_esc(c.nomeProduto || "")}</td><td style="text-align:right">R$ ${formatarNumeroBR(Number(c.valor), 2)}</td></tr>`).join("")
      + `<tr class="total-row"><td colspan="3">TOTAL</td><td style="text-align:right">R$ ${formatarNumeroBR(total, 2)}</td></tr>`;
  } else {
    // Todos os viveiros: consolidado por categoria
    subtitulo = "Todos os viveiros";
    const grupos = _finGruposCategoria(custos);
    cabecalho = `<tr><th>Categoria</th><th style="text-align:center">Lançamentos</th><th style="text-align:center">Viveiros</th><th>Valor</th></tr>`;
    linhas = grupos.map(g => `<tr><td>${_esc(g.nome)}</td><td style="text-align:center">${g.qtd}</td><td style="text-align:center">${g.viveiros.size}</td><td style="text-align:right">R$ ${formatarNumeroBR(g.total, 2)}</td></tr>`).join("")
      + `<tr class="total-row"><td colspan="3">TOTAL</td><td style="text-align:right">R$ ${formatarNumeroBR(total, 2)}</td></tr>`;
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório financeiro</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#1f2937}h1{color:rgb(6,107,99);font-size:20px;margin-bottom:2px}.sub{color:#6b7280;font-size:13px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{padding:8px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:left}th{background:#f0fdf4}.total-row td{font-weight:700;border-top:2px solid rgb(6,107,99)}</style></head>
    <body><h1>Relatório financeiro</h1><p class="sub">${_esc(subtitulo)}</p><p>Período: ${periodoTxt}</p>
    <table><thead>${cabecalho}</thead>
    <tbody>${linhas}</tbody></table></body></html>`;
  _imprimirDoc(html);
}


function abrirEncerrarCiclo(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");

  const hoje = _hojeLocal();

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
            <input type="text" inputmode="decimal" id="producaoFinal" placeholder="Ex: 1000">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
            <label>Peso médio final</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="pesoFinal" placeholder="Ex: 12">
            <span class="campo-unidade">g</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Preço da despesca final (R$/kg)</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="precoVendaCiclo" placeholder="Ex: 18,00" onblur="formatarMoedaBlur(this)">
            <span class="campo-unidade">R$</span>
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
        <button class="botao-voltar-form" onclick="abrirViveiro(${index})">Voltar</button>
      </div>
    </div>
`;
}

async function salvarEncerramentoCiclo(index) {
  if (_bloqueioViveiro(index)) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque

  const viveiro = viveiros[index];

  const dataEncerramento = document.getElementById("dataEncerramento").value;
  const producaoFinal = parseDecimalBR(document.getElementById("producaoFinal").value);
  const pesoFinal = parseDecimalBR(document.getElementById("pesoFinal").value);
  const precoVenda = parseMoedaBR(document.getElementById("precoVendaCiclo")?.value || "0") || 0;
  const observacoes = document.getElementById("observacoesCiclo").value;

  const erroEncerrar = document.getElementById("msg-encerrar-erro");
  const mostrarErroEncerrar = (msg) => { if (erroEncerrar) { erroEncerrar.textContent = msg; erroEncerrar.style.display = "block"; } };
  if (erroEncerrar) erroEncerrar.style.display = "none";

  if (!dataEncerramento || !(producaoFinal > 0) || !(pesoFinal > 0)) {
    mostrarErroEncerrar("Preencha data de encerramento, e produção final e peso médio final maiores que zero.");
    return;
  }
  const _eDataE = _erroDataCiclo(viveiro, dataEncerramento);
  if (_eDataE) { mostrarErroEncerrar(_eDataE); return; }

  const restaurar = _travarBotao(botao, "Encerrando...");

  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

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
  // Sobrevivência correta: cada despesca parcial conta com o SEU peso médio,
  // não com o peso final. (Ex.: parcial 200kg@10g = 20.000 animais.)
  const qtdDespescasParciais = despescas.reduce((total, item) => {
    const kg = Number(item.quantidadeKg) || 0;
    const peso = Number(item.pesoMedio || item.gramatura || 0);
    if (kg <= 0 || peso <= 0) return total;
    return total + kg / (peso / 1000);
  }, 0);
  const qtdDespescaFinal = pesoFinal > 0 ? producaoFinal / (pesoFinal / 1000) : 0;
  const quantidadeFinal = qtdDespescasParciais + qtdDespescaFinal; // total de animais produzidos
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
    custo_fixo_rateado: _custoFixoRateado(viveiro.dataPreparacao || viveiro.dataPovoamento, dataEncerramento),
    fca: fca,
    sobrevivencia: sobrevivencia,
    observacoes: observacoes,
    preco_venda: precoVenda || null,
    data_preparacao: viveiro.dataPreparacao || null,
    ciclo_id: viveiro.cicloId || null,
    // Persiste o histórico do ciclo para os relatórios continuarem completos
    biometrias_json: biometrias,
    racoes_json: racoes,
    despescas_json: despescas,
  };

  // ═══ Encerramento ATÔMICO via RPC (função encerrar_ciclo no Postgres) ═══
  // Antes, os passos (gravar ciclo, apagar lançamentos, congelar ração, resetar
  // o viveiro) iam soltos: uma queda de internet no meio deixava estado pela
  // metade. Agora vão TODOS numa transação no banco — ou tudo, ou nada. A função
  // também é idempotente por ciclo_id: se a transação commitou mas a resposta se
  // perdeu na volta, tentar de novo não duplica o ciclo. Por isso, num erro aqui,
  // nada mudou no banco (ou já está tudo certo) — é seguro não avançar e o usuário
  // tenta de novo.
  const der = _racaoDerivada(viveiro);
  const iniCiclo = viveiro.dataPreparacao || viveiro.dataPovoamento || null;
  const congelaRacao = !!(der && viveiro.cicloId);
  // Novo ciclo_id para a preparação que começa agora — assim, se outro ciclo
  // iniciar no mesmo dia, os custos não se misturam com o ciclo recém-encerrado.
  const novoCicloIdPrep = _novoCicloId();

  const { data: rpcRes, error } = await supabaseClient.rpc("encerrar_ciclo", {
    p_viveiro: viveiro.id,
    p_ciclo_id: viveiro.cicloId || null,
    p_novo_ciclo_id: novoCicloIdPrep,
    p_data_encerramento: dataEncerramento,
    p_ciclo: cicloBanco,
    p_ini_ciclo: iniCiclo,
    p_racao_valor: congelaRacao ? der.valor : null,
    p_racao_qtd_g: congelaRacao ? der.qtdG : null,
    p_racao_data: congelaRacao ? der.data : null,
  });

  if (error) {
    console.log(error);
    restaurar();
    mostrarErroEncerrar("Erro ao encerrar ciclo: " + (error.message || "tente novamente."));
    return;
  }

  const rpc = rpcRes || {};

  // Atualiza o custo de Ração em memória com o id que a função devolveu (para
  // editar/excluir sem recarregar). Só quando ela realmente congelou o valor.
  if (congelaRacao && rpc.custo_id) {
    viveiro.custos = (viveiro.custos || []).filter(c => !(c.categoria === "Ração" && c.nomeProduto === "Ração" && (c.cicloId || null) === viveiro.cicloId));
    viveiro.custos.push({ id: rpc.custo_id, tipo: "produto", produtoId: null, nomeProduto: "Ração", quantidadeG: der.qtdG, valor: der.valor, categoria: "Ração", data: der.data || dataEncerramento, observacao: null, cicloId: viveiro.cicloId });
  }

  // Montar cicloFinalizado ANTES de zerar o viveiro (para preservar dados no objeto local)
  const cicloFinalizado = {
    // id do banco (vem da função encerrar_ciclo): sem ele, a exclusão trataria o
    // ciclo como só-local e ele reapareceria no próximo carregamento.
    id: rpc.ciclo_id_row || null,
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
    precoVenda: precoVenda || 0,
    dataPreparacao: viveiro.dataPreparacao || null,
    cicloId: viveiro.cicloId || null,
    // Rateio de custo fixo CONGELADO — o mesmo valor gravado no banco. Sem ele, o
    // relatório recém-encerrado recalculava ao vivo e mudava se o custo mensal
    // fosse alterado na mesma sessão, antes de recarregar (auditoria).
    custoFixoRateado: cicloBanco.custo_fixo_rateado,
    biometrias: [...biometrias],
    racoes: [...racoes],
    despescas: [...despescas],
    // Já está tudo em mãos: o relatório aberto logo abaixo não precisa ir
    // buscar o histórico no servidor.
    historicoCarregado: true,
    observacoes: observacoes,
  };

  // Sucesso total no banco: a função encerrar_ciclo já apagou os lançamentos e
  // resetou o viveiro para "em preparação" na mesma transação. Aqui só espelhamos
  // isso no estado local.
  viveiro.racoes = [];
  viveiro.biometrias = [];
  viveiro.despescas = [];
  viveiro.dataPovoamento = null;
  viveiro.totalPovoado = null;
  viveiro.laboratorio = null;
  viveiro.dataPreparacao = dataEncerramento;
  // Adota o id de preparação que a RPC confirma ter gravado. Numa repetição
  // após resposta perdida, o banco pode ter guardado o id da PRIMEIRA tentativa;
  // usar o id local (gerado de novo agora) desalinharia o viveiro e faria custos
  // caírem no ciclo errado (#3). Fallback pro id gerado se a RPC antiga não
  // devolver o campo — aí segue o comportamento anterior, sem quebrar.
  viveiro.cicloId = rpc.novo_ciclo_id_atual || novoCicloIdPrep;
  _montarCustoRacaoVirtual(); // ciclo novo começa sem custo de ração derivado

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
        <span class="form-caption">${viveiro.tamanho ? _fmtHa(viveiro.tamanho) + " ha" : ""}</span>
        <h2 class="form-titulo">${_esc(viveiro.nome)}</h2>
      </div>
      ${viveiro.dataPreparacao ? `
      <div class="prep-status">
        <div class="prep-status-ico"><svg viewBox="0 0 24 24"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><line x1="12" y1="7" x2="12" y2="12"/><line x1="12" y1="12" x2="15" y2="14"/></svg></div>
        <span class="prep-status-txt"><strong>${calcularDiasCultivo(viveiro.dataPreparacao)} dias</strong> em preparação</span>
        <small class="prep-status-desde">desde ${formatarData(viveiro.dataPreparacao)}</small>
      </div>

      <button class="botao-salvar" onclick="mostrarFormularioReinicio(${index}, 'povoar')" style="margin-top:4px">
        <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
        Povoar viveiro
      </button>
      <button class="botao-voltar-form" onclick="abrirLancarCusto(${index})" style="margin-top:8px">
        <svg viewBox="0 0 24 24" style="width:17px;height:17px;stroke:rgb(6,107,99);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-3px;margin-right:4px"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        Lançar custo de preparação
      </button>
      <button class="botao-voltar-form" onclick="verCustosPreparacao(${index})" style="margin-top:8px">
        <svg viewBox="0 0 24 24" style="width:17px;height:17px;stroke:rgb(6,107,99);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-3px;margin-right:4px"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        Ver custo de preparação
      </button>
      ` : `
      <div class="viveiro-sem-ciclo-msg">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Nenhum ciclo ativo. Inicie um novo ciclo para começar os lançamentos.</span>
      </div>

      <button class="botao-salvar" onclick="mostrarFormularioReinicio(${index})" style="margin-top:4px">
        <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Iniciar novo ciclo
      </button>
      `}

      <button class="botao-voltar-form botao-perigo-outline" onclick="mostrarConfirmExcluirViveiro(${index})" style="margin-top:8px">
        🗑️ Excluir viveiro
      </button>

      <div id="confirm-excluir-viveiro-${index}" style="display:none;margin-top:10px;padding:9px 11px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca">
        <p style="margin:0 0 1px;font-size:12px;font-weight:700;color:#dc2626">Excluir "${_esc(viveiro.nome)}"?</p>
        <p style="margin:0 0 7px;font-size:10.5px;color:#7f1d1d;line-height:1.3">Os dados serão desativados (recuperáveis pelo suporte).</p>
        <div style="display:flex;gap:6px">
          <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirViveiro(${index}, this)">Sim, excluir</button>
          <button class="ciclo-btn-relatorio" style="flex:1" onclick="mostrarViveiroSemCiclo(${index})">Cancelar</button>
        </div>
      </div>

      ${temCicloAnterior ? `
      <button class="botao-voltar-form" onclick="mostrarRelatorioCiclo(${index}, viveiros[${index}].ciclosFinalizados[viveiros[${index}].ciclosFinalizados.length - 1], 'viveiro')" style="margin-top:8px">
        📋 Ver relatório do último ciclo
      </button>
      ` : ""}

      <button class="botao-voltar-form" onclick="mostrarListaViveiros(posicaoNaLista(${index}))" style="margin-top:8px">Voltar</button>
    </div>
  `;
}

function mostrarConfirmExcluirViveiro(index) {
  document.getElementById(`confirm-excluir-viveiro-${index}`).style.display = "block";
}

let _relImpCiclo = null;
let _relImpIndex = null;

// Busca o histórico de UM ciclo encerrado — o que ficou de fora da abertura do
// app. Uma vez por ciclo: depois fica na memória.
async function _carregarHistoricoCiclo(ciclo) {
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return false;
  const { data, error } = await supabaseClient
    .from("ciclos")
    .select("biometrias_json, racoes_json, despescas_json")
    .eq("id", ciclo.id).eq("user_id", usuario.id)
    .maybeSingle();
  if (error) { console.log("histórico do ciclo:", error); return false; }

  const d = data || {}; // ciclo antigo, salvo antes de existirem esses campos
  ciclo.biometrias = Array.isArray(d.biometrias_json) ? d.biometrias_json.map(b => ({
    data: b.data, gramatura: Number(b.gramatura),
  })) : [];
  ciclo.racoes = Array.isArray(d.racoes_json) ? d.racoes_json.map(r => ({
    data: r.data, racao: Number(r.racao), nomeRacao: r.nomeRacao || null, tipoRacaoId: r.tipoRacaoId || null,
  })) : [];
  ciclo.despescas = Array.isArray(d.despescas_json) ? d.despescas_json.map(x => ({
    data: x.data, tipo: x.tipo || "Parcial",
    quantidadeKg: Number(x.quantidadeKg), pesoMedio: Number(x.pesoMedio),
    precoKg: x.precoKg != null ? Number(x.precoKg) : null,
  })) : [];
  ciclo.historicoCarregado = true;
  return true;
}

async function mostrarRelatorioCiclo(index, ciclo, origem = "historico") {
  // Sem o histórico o relatório sairia com os gráficos vazios e a tabela de
  // biometrias em branco — então busca antes de desenhar, não depois.
  if (ciclo && ciclo.id && !ciclo.historicoCarregado) {
    const espera = document.getElementById("area-gestao");
    if (espera) espera.innerHTML = `<p class="rel-carregando">Carregando o relatório…</p>`;
    if (!(await _carregarHistoricoCiclo(ciclo))) {
      if (espera) espera.innerHTML = `
        <div class="rel-carregando">Não foi possível carregar o histórico deste ciclo.<br>Verifique a internet e tente de novo.
          <button class="botao-voltar-form" style="margin-top:14px" onclick="mostrarHistoricoCiclos()">Voltar</button>
        </div>`;
      return;
    }
  }
  _renderRelatorioCiclo(index, ciclo, origem);
}

function _renderRelatorioCiclo(index, ciclo, origem = "historico") {
  const area = document.getElementById("area-gestao");
  _relImpCiclo = ciclo;
  _relImpIndex = index;
  const _serieRel = _seriesCiclo(ciclo);

  // ── Custos (fonte única) e financeiro automático (preços das despescas) ──
  const _cc = _custosCicloAtivo(
    viveiros[index] || { custos: [] }, ciclo.cicloId,
    ciclo.dataPreparacao || ciclo.dataPovoamento, ciclo.dataEncerramento,
    ciclo.custoFixoRateado
  );
  const custoTotal = _cc.total, custoManuais = _cc.totalManuais, rateioFixo = _cc.rateioFixo;

  const producaoTotal = Number(ciclo.producaoTotal) || 0;
  const precoFinal = Number(ciclo.precoVenda) || 0; // preço da despesca final
  const _despRel = ciclo.despescas || [];
  const receitaParciais = _despRel.reduce((s, d) => {
    // Fallback SÓ para registros antigos. Desde 28/08/2026 o preço é
    // obrigatório ao lançar e ao editar uma despesca parcial, então despesca
    // nova nunca cai aqui. Continua valendo para não zerar a receita de ciclos
    // que já estão fechados — apagar esse fallback mudaria relatório antigo.
    const p = Number(d.precoKg) > 0 ? Number(d.precoKg) : precoFinal;
    return s + (Number(d.quantidadeKg) || 0) * p;
  }, 0);
  const receitaFinal = (Number(ciclo.producaoFinal) || 0) * precoFinal;
  const receitaBruta = receitaParciais + receitaFinal;
  const temPreco = receitaBruta > 0;
  const precoMedio = producaoTotal > 0 ? receitaBruta / producaoTotal : 0;
  const lucro = receitaBruta - custoTotal;
  const custoPorKg = producaoTotal > 0 ? custoTotal / producaoTotal : 0;
  const rs = (v) => temPreco ? "R$ " + formatarNumeroBR(v, 2) : "—";

  area.innerHTML = `
    <div class="rc2-report">

      <div class="rc2-head">
        <h2 class="rc2-titulo">RELATÓRIO DE CICLO</h2>
        <div class="rc2-viveiro">${_esc(ciclo.nomeViveiro)}${(() => { const n = _numeroCicloEncerrado(viveiros[index], ciclo); return n ? ` · Ciclo ${n}` : ""; })()}</div>
        <div class="rc2-periodo">${formatarData(ciclo.dataPovoamento)} a ${formatarData(ciclo.dataEncerramento)} · ${ciclo.diasCultivo} dias</div>
      </div>

      <div class="rc2-sec-tit">Informações gerais</div>
      <div class="rc2-grid">
        <div class="rc2-cell"><small>Povoamento</small><b>${formatarData(ciclo.dataPovoamento)}</b></div>
        <!-- O total vem gravado como texto com ponto de milhar ("420.000").
             Number("420.000") lê o ponto como decimal e devolve 420 — o
             relatório mostrava 420 PLs onde eram 420 mil. -->
        <div class="rc2-cell"><small>PLs</small><b>${Number(String(ciclo.totalPovoado || "").replace(/\./g, "") || 0).toLocaleString("pt-BR")}</b></div>
        <div class="rc2-cell"><small>Laboratório</small><b>${_esc(ciclo.laboratorio || "—")}</b></div>
        <div class="rc2-cell"><small>Área</small><b>${_fmtHa(ciclo.tamanho)} ha</b></div>
        ${ciclo.dataPreparacao && ciclo.dataPovoamento ? `<div class="rc2-cell"><small>Preparação</small><b>${calcularDiasCultivo(ciclo.dataPreparacao, ciclo.dataPovoamento)} dias</b></div>` : ""}
      </div>

      <div class="rc2-sec-tit">Indicadores produtivos</div>
      <div class="rc2-band">
        <div><b>${formatarNumeroBR(ciclo.produtividade, 0)}</b><small>kg/ha</small><span>Produtividade</span></div>
        <div><b>${formatarNumeroBR(ciclo.pesoFinal, 1)} g</b><span>Peso final</span></div>
        <div><b style="color:${ciclo.sobrevivencia > 0 ? (ciclo.sobrevivencia >= 70 ? "#16a34a" : ciclo.sobrevivencia >= 50 ? "#d97706" : "#dc2626") : "inherit"}">${formatarNumeroBR(ciclo.sobrevivencia, 1)}%</b><span>Sobrevivência</span></div>
        <div><b style="color:${ciclo.fca > 0 ? (ciclo.fca <= 1.5 ? "#16a34a" : ciclo.fca <= 2.0 ? "#d97706" : "#dc2626") : "inherit"}">${formatarNumeroBR(ciclo.fca, 2)}</b><span>FCA</span></div>
      </div>

      <div class="rc2-sec-tit">Resumo operacional</div>
      <div class="rc2-lines">
        <div class="rc2-line"><span>Ração consumida</span><b>${formatarNumeroBR(ciclo.racaoConsumida, 1)} kg</b></div>
        <div class="rc2-line"><span>Despescas parciais</span><b>${formatarNumeroBR(ciclo.despescaParcial, 1)} kg</b></div>
        <div class="rc2-line"><span>Despesca final</span><b>${formatarNumeroBR(ciclo.producaoFinal, 1)} kg</b></div>
        ${custoManuais > 0 ? `<div class="rc2-line"><span>Custos manuais</span><b>R$ ${formatarNumeroBR(custoManuais, 2)}</b></div>` : ""}
        ${rateioFixo > 0 ? `<div class="rc2-line"><span>Rateio de custos fixos</span><b>R$ ${formatarNumeroBR(rateioFixo, 2)}</b></div>` : ""}
        ${custoTotal > 0 ? `<div class="rc2-line rc2-line-total"><span>Custo total</span><b>R$ ${formatarNumeroBR(custoTotal, 2)}</b></div>` : ""}
      </div>

      ${_serieRel.dias.length ? `
      <div class="rc2-sec-tit">Evolução do cultivo</div>
      <div class="rc-graficos">
        <div class="rc-graf-box"><h5>Peso médio (g)</h5><div class="rc-graf-canvas"><canvas id="rcPeso"></canvas></div></div>
        <div class="rc-graf-box"><h5>Consumo acumulado de ração (kg)</h5><div class="rc-graf-canvas"><canvas id="rcRacao"></canvas></div></div>
      </div>
      ` : ""}

      <div class="rc2-sec-tit">Produção e desempenho financeiro</div>
      <div class="rc2-prodfinal"><span>Produção final do ciclo</span><b>${formatarNumeroBR(producaoTotal, 1)} kg</b></div>
      <div class="rc2-fin">
        <div><small>Preço médio</small><b>${temPreco ? "R$ " + formatarNumeroBR(precoMedio, 2) + "/kg" : "—"}</b></div>
        <div><small>Receita bruta</small><b>${rs(receitaBruta)}</b></div>
        <div><small>Lucro líquido</small><b class="${temPreco ? (lucro < 0 ? "rc2-neg" : "rc2-pos") : ""}">${rs(lucro)}</b></div>
        <div><small>Custo por kg</small><b>${custoTotal > 0 ? "R$ " + formatarNumeroBR(custoPorKg, 2) : "—"}</b></div>
      </div>
      ${!temPreco ? `<p class="rc2-fin-nota">Informe o preço de venda nas despescas (ou no encerramento) para calcular receita e lucro.</p>` : ""}

      <div class="rc2-acoes">
        <button class="botao-voltar-form" style="margin:0;flex:1;padding:11px 10px;font-size:14px" onclick="${origem === 'viveiro' ? `mostrarViveiroSemCiclo(${index})` : `mostrarHistoricoCiclos()`}">Voltar</button>
        <button class="botao-salvar" style="margin:0;flex:1;padding:11px 10px;font-size:14px;gap:6px" onclick="gerarRelatorioImpressao()">
          <svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir
        </button>
      </div>

    </div>
  `;

  setTimeout(() => _renderGraficosCiclo(_serieRel), 60);
}

// Séries do ciclo para os gráficos — biomassa/FCA estimados descontando as
// despescas parciais reais (cada uma com seu peso médio) até cada data.
function _seriesCiclo(ciclo) {
  const bios = [...(ciclo.biometrias || [])].sort((a, b) => a.data.localeCompare(b.data));
  const racoesSorted = [...(ciclo.racoes || [])].sort((a, b) => a.data.localeCompare(b.data));
  const despescasSorted = [...(ciclo.despescas || [])].sort((a, b) => a.data.localeCompare(b.data));
  const popNum = ciclo.totalPovoado ? Number(String(ciclo.totalPovoado).replace(/\./g, "")) : 0;
  const producaoTotal = Number(ciclo.producaoTotal) || 0;
  const diaDe = d => calcularDiasCultivo(ciclo.dataPovoamento, d);
  const racaoAcumAte = ds => racoesSorted.filter(r => r.data <= ds).reduce((s, r) => s + r.racao, 0);
  // Animais já despescados (parciais) até uma data — cada despesca com seu peso médio
  const qtdDespescadaAte = ds => despescasSorted.filter(d => d.data <= ds).reduce((s, d) => {
    const kg = Number(d.quantidadeKg) || 0;
    const peso = Number(d.pesoMedio || d.gramatura || 0);
    return (kg > 0 && peso > 0) ? s + kg / (peso / 1000) : s;
  }, 0);
  const diasArr = bios.map(b => diaDe(b.data));
  const dias = [], peso = [], cresc = [], biomassa = [], fca = [], racaoAcum = [], obs = [], datas = [];
  bios.forEach((b, i) => {
    const racAcum = racaoAcumAte(b.data);
    const dia = diasArr[i];
    const restante = Math.max(0, popNum - qtdDespescadaAte(b.data));
    const bm = restante * b.gramatura / 1000; // biomassa em pé estimada na data
    datas.push(formatarData(b.data));
    dias.push(dia);
    peso.push(Number(b.gramatura));
    cresc.push(i > 0 ? Number((b.gramatura - bios[i - 1].gramatura).toFixed(2)) : null);
    biomassa.push(Number(bm.toFixed(1)));
    fca.push(Number((bm > 0 ? racAcum / bm : 0).toFixed(2)));
    racaoAcum.push(Number(racAcum.toFixed(1)));
    // Ganho médio por dia no intervalo entre as duas biometrias. Normaliza o
    // crescimento quando as pesagens não são igualmente espaçadas — e, ao
    // contrário de g/semana, não repete a coluna de crescimento quando as
    // biometrias são semanais.
    if (i === 0) {
      obs.push("—");
    } else {
      const dDias = dia - diasArr[i - 1];
      const dPeso = b.gramatura - bios[i - 1].gramatura;
      obs.push(dDias > 0 ? `${(dPeso / dDias).toFixed(2).replace(".", ",")}` : "—");
    }
  });
  // ── Conversão alimentar ao longo do ciclo ────────────────────────────────
  // Base: a sobrevivência FINAL, aplicada como constante desde o início. Não é
  // possível saber quando os animais morreram, e supor uma mortalidade
  // progressiva seria pior: o "ganho de biomassa" de cada período passaria a
  // embutir a morte inventada pela hipótese, inflando o FCA do fim do ciclo e
  // fazendo parecer que a conversão piorou quando talvez só tenha morrido
  // camarão. Com a sobrevivência fixa, o ganho vem apenas do peso subindo —
  // então o FCA do período mede conversão, que é o que se quer diagnosticar.
  // O último ponto usa a despesca final (dado real), e nele o FCA acumulado
  // cai exatamente sobre o FCA do relatório.
  const sobrFinal = (Number(ciclo.sobrevivencia) || 0) / 100;
  const fcaDias = [], fcaAcum = [], fcaPeriodo = [];
  if (sobrFinal > 0 && popNum > 0) {
    const pontos = bios.map((b, i) => ({ data: b.data, dia: diasArr[i], peso: Number(b.gramatura) }));
    if (ciclo.dataEncerramento && Number(ciclo.pesoFinal) > 0) {
      pontos.push({ data: ciclo.dataEncerramento, dia: diaDe(ciclo.dataEncerramento), peso: Number(ciclo.pesoFinal), fim: true });
    }
    let antRac = null, antProd = null;
    for (const pt of pontos) {
      const kgDespescado = despescasSorted.filter(d => d.data <= pt.data)
        .reduce((s, d) => s + (Number(d.quantidadeKg) || 0), 0);
      // Vivos = povoado × sobrevivência final, menos os que já saíram nas parciais
      const vivos = Math.max(0, popNum * sobrFinal - qtdDespescadaAte(pt.data));
      // Produzido = o que está na água + o que já saiu (também foi produzido)
      const produzido = pt.fim ? producaoTotal : (vivos * pt.peso / 1000 + kgDespescado);
      const rac = racaoAcumAte(pt.data);
      if (produzido <= 0) continue;
      fcaDias.push(pt.dia);
      fcaAcum.push(Number((rac / produzido).toFixed(2)));
      const dRac = antRac === null ? null : rac - antRac;
      const dProd = antProd === null ? null : produzido - antProd;
      // Sem ração no período (ou sem ganho de biomassa) não há conversão a
      // medir: vira lacuna no gráfico, não um zero que pareceria um tombo.
      fcaPeriodo.push((dProd > 0 && dRac > 0) ? Number((dRac / dProd).toFixed(2)) : null);
      antRac = rac; antProd = produzido;
    }
  }

  return { bios, dias, peso, cresc, biomassa, fca, racaoAcum, obs, datas, popNum, producaoTotal,
           fcaDias, fcaAcum, fcaPeriodo };
}

function _renderGraficosCiclo(serie) {
  if (typeof Chart === "undefined" || !serie.dias.length) return;
  const op = (cor, fill) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { ticks: { font: { size: 9 }, color: "#9ca3af" }, grid: { display: false } }, y: { beginAtZero: true, ticks: { font: { size: 9 }, color: "#9ca3af" }, grid: { color: "rgba(0,0,0,0.05)" } } },
  });
  const linha = (id, data, cor, fill) => {
    const el = document.getElementById(id); if (!el) return;
    _prepararCanvasGrafico(el);
    new Chart(el.getContext("2d"), { type: "line", data: { labels: serie.dias, datasets: [{ data, borderColor: cor, backgroundColor: fill || "transparent", fill: !!fill, tension: 0.3, pointRadius: 3, pointBackgroundColor: cor, borderWidth: 2 }] }, options: op() });
  };
  // Relatório final: apenas Peso médio e Consumo acumulado de ração (sem
  // gráficos estimados de FCA/biomassa).
  linha("rcPeso", serie.peso, "#16a34a", "rgba(22,163,74,.08)");
  const elR = document.getElementById("rcRacao");
  if (elR) _prepararCanvasGrafico(elR);
  if (elR) new Chart(elR.getContext("2d"), { type: "bar", data: { labels: serie.dias, datasets: [{ data: serie.racaoAcum, backgroundColor: "rgb(6,107,99)" }] }, options: op() });
}

function gerarRelatorioImpressao() {
  const ciclo = _relImpCiclo;
  const index = _relImpIndex;
  if (!ciclo) { _toastErro("Relatório indisponível."); return; }

  // Preço automático: usa o preço da despesca final (encerramento); cada despesca
  // parcial pode ter o seu próprio preço (tratado abaixo no cálculo da receita).
  const precoKg = Number(ciclo.precoVenda) || 0;

  // ── Custos do ciclo (fonte única: manuais por ciclo_id/janela + rateio fixo) ──
  const custos = _custosManuaisDoCiclo(
    viveiros[index]?.custos, ciclo.cicloId,
    ciclo.dataPreparacao || ciclo.dataPovoamento, ciclo.dataEncerramento
  );
  const custoFixoRateado = (ciclo.custoFixoRateado != null && !isNaN(Number(ciclo.custoFixoRateado)))
    ? Number(ciclo.custoFixoRateado)
    : _custoFixoRateado(ciclo.dataPreparacao || ciclo.dataPovoamento, ciclo.dataEncerramento);
  const custoTotal = custos.reduce((s, c) => s + Number(c.valor), 0) + custoFixoRateado;

  // Agrupa por nome normalizado: sem isso, "Análise de água" e "Analise de
  // água" viravam duas fatias separadas, cada uma com metade do percentual.
  const grupos = {};
  const _addGrupo = (rotulo, valor) => {
    const chave = _normNomeCusto(rotulo);
    if (!grupos[chave]) grupos[chave] = { nome: rotulo, total: 0 };
    else grupos[chave].nome = _melhorRotulo(grupos[chave].nome, rotulo);
    grupos[chave].total += Number(valor) || 0;
  };
  custos.forEach(c => _addGrupo(c.tipo === "outro" ? (c.categoria || c.nomeProduto || "Outros") : (c.categoria || "Outros"), c.valor));
  if (custoFixoRateado > 0) _addGrupo("Mão de obra e custos fixos", custoFixoRateado);
  const distLista = Object.values(grupos).sort((a, b) => b.total - a.total);

  // ── Indicadores ──
  const producaoTotal = Number(ciclo.producaoTotal) || 0;
  const custoPorKg = producaoTotal > 0 ? custoTotal / producaoTotal : 0;
  // Receita: cada despesca parcial usa o SEU preço (quando informado), senão o
  // preço geral do relatório. A despesca final usa o preço geral (do encerramento).
  const precoGeral = precoKg;
  const despescasArr = [...(ciclo.despescas || [])];
  const receitaDespescasParciais = despescasArr.reduce((s, d) => {
    const p = Number(d.precoKg) > 0 ? Number(d.precoKg) : precoGeral;
    return s + (Number(d.quantidadeKg) || 0) * p;
  }, 0);
  const producaoFinalKg = Number(ciclo.producaoFinal) || 0;
  const receitaDespescaFinal = producaoFinalKg * precoGeral;
  const receitaBruta = receitaDespescasParciais + receitaDespescaFinal;
  const lucroLiquido = receitaBruta - custoTotal;
  const tamanhoNum = parseFloat(ciclo.tamanho) || 0;
  const temPreco = receitaBruta > 0;

  const fmt = (v, d = 2) => formatarNumeroBR(v, d);
  const rs = (v) => temPreco ? "R$ " + formatarNumeroBR(v, 2) : "—";
  const hoje = new Date();
  const dataEmissao = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;


  // Gráfico de COLUNAS (torre) colorido dos custos, em SVG inline (sem Chart.js).
  const _coresCusto = ["#0b6b63", "#2563eb", "#f59e0b", "#10b981", "#a16207", "#9ca3af", "#ec4899", "#84cc16"];
  const _itensCusto = distLista.slice(0, 6);
  const _gCustos = (() => {
    if (!_itensCusto.length) return `<p style="color:#999;font-size:11px;margin-top:6px">Nenhum custo lançado neste ciclo.</p>`;
    const W = 300, H = 100, padB = 16, padT = 14;
    const max = _itensCusto[0].total || 1;
    const n = _itensCusto.length;
    const bw = Math.min(40, (W - 10) / n - 8);
    const gap = ((W - 10) - bw * n) / (n + 1);
    const bars = _itensCusto.map((d, i) => {
      const h = Math.max(1, (d.total / max) * (H - padB - padT));
      const x = 5 + gap + i * (bw + gap);
      const y = (H - padB) - h;
      const pct = custoTotal > 0 ? Math.round(d.total / custoTotal * 100) : 0;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${_coresCusto[i % _coresCusto.length]}"/><text x="${(x + bw / 2).toFixed(1)}" y="${(y - 3).toFixed(1)}" font-size="8" fill="#555" text-anchor="middle">${pct}%</text>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}"><line x1="5" y1="${H - padB}" x2="${W - 5}" y2="${H - padB}" stroke="#ddd"/>${bars}</svg>`;
  })();
  const _legCustos = _itensCusto.map((d, i) => `<div style="display:flex;align-items:center;gap:7px;font-size:10.5px;padding:2px 0;border-bottom:1px solid #f0f0f0"><span style="width:9px;height:9px;border-radius:2px;background:${_coresCusto[i % _coresCusto.length]};flex-shrink:0"></span><span style="flex:1;color:#333">${_esc(d.nome)}</span><b>R$ ${fmt(d.total, 2)}</b></div>`).join("");

  const _numCiclo = viveiros[index] ? _numeroCicloEncerrado(viveiros[index], ciclo) : null;
  const _tituloViv = `${_esc(ciclo.nomeViveiro || "")}${_numCiclo ? ` &middot; Ciclo ${_numCiclo}` : ""}`;

  // Resumo técnico ENXUTO (2-3 frases) — preenche o espaço ao lado do gráfico.
  const _resumoTec = (() => {
    const p = [];
    p.push(`Ciclo de ${ciclo.diasCultivo} dias, sobrevivência de ${fmt(ciclo.sobrevivencia, 1)}% e FCA de ${fmt(ciclo.fca, 2)}.`);
    p.push(`Produção de ${fmt(producaoTotal, 1)} kg (${fmt(ciclo.produtividade, 0)} kg/ha), a um custo de R$ ${fmt(custoPorKg, 2)}/kg.`);
    if (temPreco) p.push(lucroLiquido >= 0 ? `Resultado positivo, lucro de ${rs(lucroLiquido)}.` : `Resultado negativo, prejuízo de R$ ${fmt(Math.abs(lucroLiquido), 2)}.`);
    else p.push(`Preço de venda não informado — sem cálculo de resultado.`);
    return p.join(" ");
  })();

  // ── Semáforo de indicadores (mesmos limites do painel do ciclo) ──
  const _corSobre = ciclo.sobrevivencia > 0 ? (ciclo.sobrevivencia >= 70 ? "#16a34a" : ciclo.sobrevivencia >= 50 ? "#d97706" : "#dc2626") : "inherit";
  const _corFca = ciclo.fca > 0 ? (ciclo.fca <= 1.5 ? "#16a34a" : ciclo.fca <= 2.0 ? "#d97706" : "#dc2626") : "inherit";
  const _corLucro = temPreco ? (lucroLiquido >= 0 ? "#16a34a" : "#dc2626") : "inherit";

  // ── Histórico de biometria: tabela + torre do peso + crescimento semanal ──
  const _sBio = _seriesCiclo(ciclo);
  // Ciclo longo (ex.: 130 dias, pesagem semanal) chega a ~13-14 biometrias: a
  // tabela entra em modo compacto pra não estourar a página de impressão.
  const _bioMuitas = _sBio.bios.length > 8;
  const _bioLinhas = _sBio.bios.map((b, i) =>
    `<tr><td>${_sBio.datas[i]}</td><td>${_sBio.dias[i]}</td><td><b>${fmt(_sBio.peso[i], 1)}</b></td><td>${_sBio.obs[i] === "—" ? "—" : _sBio.obs[i] + " g"}</td></tr>`
  ).join("");
  // Crescimento médio semanal: ganho de peso entre a 1ª e a última biometria,
  // trazido para base de 7 dias (mede a engorda real, sem chutar o peso da PL).
  const _cresSemanal = (() => {
    const n = _sBio.peso.length;
    if (n < 2) return null;
    const dDias = _sBio.dias[n - 1] - _sBio.dias[0];
    if (dDias <= 0) return null;
    return (_sBio.peso[n - 1] - _sBio.peso[0]) / dDias * 7;
  })();
  // Torre do peso médio: uma coluna por biometria, verde escurecendo conforme o
  // peso sobe (progressão), com o peso em cima e o dia de cultivo embaixo.
  const _gBio = (() => {
    const n = _sBio.peso.length;
    if (n < 1) return `<p style="color:#999;font-size:11px;margin-top:6px">Sem biometrias registradas neste ciclo.</p>`;
    const W = 300, H = 110, padB = 18, padT = 13;
    const max = Math.max(..._sBio.peso, 1);
    const bw = Math.min(40, (W - 10) / n - 8);
    const gap = ((W - 10) - bw * n) / (n + 1);
    const verde = (t) => {
      const a = [159, 213, 205], b = [11, 107, 99]; // #9fd5cd → #0b6b63
      const c = a.map((v, k) => Math.round(v + (b[k] - v) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    };
    // O peso aparece em cima de TODA barra; com muita biometria ele só encolhe
    // pra não embolar. O dia embaixo aparece de 2 em 2 quando há muitas colunas.
    const fsPeso = n > 10 ? 6 : n > 8 ? 7 : 8;
    const mostraDia = (i) => n <= 10 || i % 2 === 0 || i === n - 1;
    const bars = _sBio.peso.map((p, i) => {
      const h = Math.max(1, (p / max) * (H - padB - padT));
      const x = 5 + gap + i * (bw + gap);
      const y = (H - padB) - h;
      const cor = n > 1 ? verde(i / (n - 1)) : "#0b6b63";
      const cx = (x + bw / 2).toFixed(1);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${cor}"/>` +
        `<text x="${cx}" y="${(y - 3).toFixed(1)}" font-size="${fsPeso}" fill="#555" text-anchor="middle">${fmt(p, 1)}</text>` +
        (mostraDia(i) ? `<text x="${cx}" y="${(H - padB + 11).toFixed(1)}" font-size="8" fill="#999" text-anchor="middle">D${_sBio.dias[i]}</text>` : "");
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}"><line x1="5" y1="${H - padB}" x2="${W - 5}" y2="${H - padB}" stroke="#ddd"/>${bars}</svg>`;
  })();

  const htmlEnxuto = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório de Ciclo — ${_esc(ciclo.nomeViveiro || "")}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 0; padding: 16px 30px; font-size: 12px; }
  .cab { text-align: center; border-bottom: 2px solid #0b6b63; padding-bottom: 9px; }
  .cab .marca { font-size: 11px; font-weight: 800; color: #0b6b63; letter-spacing: .1em; }
  .cab h1 { font-size: 18px; font-weight: 700; margin: 4px 0 2px; }
  .cab .sub { font-size: 11.5px; color: #555; }
  .cab .sub b { color: #1a1a1a; }
  h2 { font-size: 11px; font-weight: 700; color: #0b6b63; text-transform: uppercase; letter-spacing: .05em; margin: 11px 0 5px; padding-bottom: 3px; border-bottom: 1px solid #d8dcdb; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  td { padding: 3px 4px; border-bottom: 1px solid #eee; }
  td.lbl { color: #555; width: 52%; }
  td.val { text-align: right; font-weight: 700; }
  .cols { display: flex; gap: 30px; }
  .cols > div { flex: 1; }
  .ind { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #d8dcdb; }
  .ind > div { padding: 7px 6px; text-align: center; border-right: 1px solid #d8dcdb; }
  .ind > div:last-child { border-right: none; }
  .ind small { display: block; font-size: 9px; color: #555; text-transform: uppercase; }
  .ind b { display: block; font-size: 16px; font-weight: 800; margin-top: 3px; }
  svg { width: 100%; height: auto; display: block; }
  .custos td.bar { width: 32%; }
  .trilho { height: 6px; background: #eee; border-radius: 2px; overflow: hidden; }
  .fill { height: 100%; background: #0b6b63; border-radius: 2px; }
  .custos td.pct { text-align: right; color: #555; width: 13%; }
  .concl { font-size: 11.5px; line-height: 1.6; color: #333; text-align: justify; margin-top: 4px; }
  .bio-tab td, .bio-tab th { font-size: 11px; }
  .bio-tab th { color: #555; font-size: 9px; text-transform: uppercase; letter-spacing: .03em; text-align: right; padding: 4px; border-bottom: 1px solid #d8dcdb; }
  .bio-tab th:first-child { text-align: left; }
  .bio-tab td { padding: 3px 4px; text-align: right; border-bottom: 1px solid #f0f0f0; }
  .bio-tab td:first-child { text-align: left; color: #555; }
  .bio-compacta td, .bio-compacta th { font-size: 9.5px; padding: 2.5px 4px; }
  .bio-cresc { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding: 6px 2px 0; border-top: 1px solid #d8dcdb; }
  .bio-cresc span { font-size: 10.5px; color: #0b6b63; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; }
  .bio-cresc b { font-size: 16px; color: #0b6b63; font-weight: 800; }
  .rodape { margin-top: 12px; padding-top: 7px; border-top: 1px solid #d8dcdb; display: flex; justify-content: space-between; font-size: 10px; color: #999; }
</style></head><body>
  <div class="cab">
    <div class="marca">WA AQUA GESTÃO</div>
    <h1>Relatório de Ciclo — ${_tituloViv}</h1>
    <div class="sub">${formatarData(ciclo.dataPovoamento)} a ${formatarData(ciclo.dataEncerramento)} &middot; <b>${ciclo.diasCultivo} dias de cultivo</b></div>
  </div>
  <div class="cols">
    <div>
      <h2>Dados do ciclo</h2>
      <table>
        <tr><td class="lbl">Povoamento</td><td class="val">${formatarData(ciclo.dataPovoamento)}</td></tr>
        <tr><td class="lbl">Encerramento</td><td class="val">${formatarData(ciclo.dataEncerramento)}</td></tr>
        <tr><td class="lbl">PLs povoadas</td><td class="val">${Number(String(ciclo.totalPovoado || "").replace(/\./g, "") || 0).toLocaleString("pt-BR")}</td></tr>
        <tr><td class="lbl">Laboratório</td><td class="val">${_esc(ciclo.laboratorio || "-")}</td></tr>
        <tr><td class="lbl">Área</td><td class="val">${fmt(tamanhoNum, 1)} ha</td></tr>
      </table>
    </div>
    <div>
      <h2>Produção</h2>
      <table>
        <tr><td class="lbl">Produção total</td><td class="val">${fmt(producaoTotal, 1)} kg</td></tr>
        <tr><td class="lbl">Peso médio final</td><td class="val">${fmt(ciclo.pesoFinal, 1)} g</td></tr>
        <tr><td class="lbl">Produtividade</td><td class="val">${fmt(ciclo.produtividade, 0)} kg/ha</td></tr>
        <tr><td class="lbl">Ração consumida</td><td class="val">${fmt(ciclo.racaoConsumida, 1)} kg</td></tr>
        <tr><td class="lbl">Sobrevivência</td><td class="val">${fmt(ciclo.sobrevivencia, 1)} %</td></tr>
      </table>
    </div>
  </div>
  <h2>Indicadores finais</h2>
  <div class="ind">
    <div><small>Produtividade</small><b>${fmt(ciclo.produtividade, 0)}</b></div>
    <div><small>Peso final</small><b>${fmt(ciclo.pesoFinal, 1)} g</b></div>
    <div><small>Sobrevivência</small><b style="color:${_corSobre}">${fmt(ciclo.sobrevivencia, 1)}%</b></div>
    <div><small>FCA</small><b style="color:${_corFca}">${fmt(ciclo.fca, 2)}</b></div>
  </div>
  <div class="cols" style="margin-top:4px">
    <div>
      <h2>Resultado financeiro</h2>
      <table>
        <tr><td class="lbl">Receita bruta</td><td class="val">${rs(receitaBruta)}</td></tr>
        <tr><td class="lbl">Custo total</td><td class="val">R$ ${fmt(custoTotal, 2)}</td></tr>
        <tr><td class="lbl">Preço médio de venda</td><td class="val">${temPreco ? "R$ " + fmt(precoGeral, 2) + "/kg" : "—"}</td></tr>
        <tr><td class="lbl">Custo por kg</td><td class="val">R$ ${fmt(custoPorKg, 2)}</td></tr>
        <tr><td class="lbl">Lucro líquido</td><td class="val" style="color:${_corLucro}">${rs(lucroLiquido)}</td></tr>
      </table>
      <h2>Resumo técnico</h2>
      <p class="concl">${_resumoTec}</p>
    </div>
    <div>
      <h2>Custos do ciclo</h2>
      ${_gCustos}
      <div style="margin-top:8px">${_legCustos}<div style="display:flex;justify-content:space-between;font-size:11px;font-weight:800;color:#0b6b63;padding-top:5px;margin-top:2px;border-top:1px solid #d8dcdb"><span>Custo total</span><span>R$ ${fmt(custoTotal, 2)}</span></div></div>
    </div>
  </div>
  <div class="cols" style="margin-top:4px">
    <div>
      <h2>Histórico de biometria</h2>
      <table class="bio-tab${_bioMuitas ? " bio-compacta" : ""}">
        <thead><tr><th>Data</th><th>Dia</th><th>Peso (g)</th><th>Ganho/dia</th></tr></thead>
        <tbody>${_bioLinhas || `<tr><td colspan="4" style="text-align:center;color:#999">Sem biometrias registradas.</td></tr>`}</tbody>
      </table>
      ${_cresSemanal != null ? `<div class="bio-cresc"><span>Crescimento médio semanal</span><b>${fmt(_cresSemanal, 1)} g/sem</b></div>` : ""}
    </div>
    <div>
      <h2>Evolução do peso médio (g)</h2>
      ${_gBio}
    </div>
  </div>
  <div class="rodape">
    <span>WA Aqua Gestão — Tecnologia para aquicultura</span>
    <span>Emitido em ${dataEmissao}</span>
  </div>
</body></html>`;

  _imprimirDoc(htmlEnxuto);
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

// ─── CÁLCULO DOS CUSTOS FIXOS MENSAIS ─────────────────────────────────────────
// Cada custo fixo tem um valor mensal. O sistema rateia esse valor por dia
// entre os viveiros que estavam ativos (em preparação OU em cultivo) em cada
// data, e acumula a parcela de cada viveiro ao longo do seu ciclo.

function _custoFixoMensalTotal() {
  const hoje = _hojeLocal();
  return custosFixos.reduce((s, c) => s + (_custoFixoValeNaData(c, hoje) ? (Number(c.valorMensal) || 0) : 0), 0);
}
// Um custo fixo vale numa data se já tinha começado e ainda não terminou.
// Desativar passa a gravar uma data de fim: assim o funcionário que trabalhou
// junho e julho continua contando nesses meses, em vez de sumir do cultivo
// inteiro. Registros antigos, desativados antes de existir data de fim, mantêm
// o comportamento anterior (ficam fora de todas as datas).
function _custoFixoValeNaData(c, ymd) {
  if (c.dataInicio && ymd && c.dataInicio > ymd) return false; // ainda não começou
  if (c.dataFim && ymd && ymd > c.dataFim) return false;       // já encerrou
  if (!c.dataFim && c.ativo === false) return false;           // legado sem data de fim
  return true;
}

// Soma mensal dos custos vigentes numa data
function _custoFixoMensalNaData(ymd) {
  return custosFixos.reduce((s, c) =>
    _custoFixoValeNaData(c, ymd) ? s + (Number(c.valorMensal) || 0) : s, 0);
}
// Dias reais do mês civil de uma data (28/29/30/31)
function _diasNoMes(ymd) {
  const [y, m] = ymd.split("-").map(Number);
  return new Date(y, m, 0).getDate(); // dia 0 do mês seguinte = último dia do mês m
}
// FUNÇÃO-BASE do rateio diário (fonte única): valor mensal ÷ dias reais do mês
// ÷ viveiros ativos no dia. Sem arredondar aqui — o arredondamento é só na exibição.
function _rateioFixoDia(valorMensal, ymd, nAtivos) {
  return nAtivos > 0 ? (Number(valorMensal) || 0) / _diasNoMes(ymd) / nAtivos : 0;
}
function _custoFixoDiaTotalNaData(ymd) {
  return _custoFixoMensalNaData(ymd) / _diasNoMes(ymd);
}

// Quantos viveiros estavam ativos (preparação ou cultivo) numa data (YYYY-MM-DD)
function _viveirosAtivosNaData(ymd, hojeYmd) {
  let n = 0;
  for (const v of viveiros) {
    // Ciclo atual em andamento (preparação ou cultivo)
    const ini = v.dataPreparacao || v.dataPovoamento;
    if (ini && ini <= ymd && ymd <= hojeYmd) { n++; continue; }
    // Ciclos já finalizados desse viveiro (períodos passados)
    const teve = (v.ciclosFinalizados || []).some(cf => {
      const ci = cf.dataPreparacao || cf.dataPovoamento;
      return ci && cf.dataEncerramento && ci <= ymd && ymd <= cf.dataEncerramento;
    });
    if (teve) n++;
  }
  return n;
}

// Custo fixo rateado acumulado para um viveiro no período [iniYmd, fimYmd] (inclusive)
function _custoFixoRateado(iniYmd, fimYmd) {
  if (!iniYmd || !fimYmd || iniYmd > fimYmd) return 0;
  if (!custosFixos.some(c => c.dataFim || c.ativo !== false)) return 0;
  const hoje = _hojeLocal();
  let total = 0, cur = iniYmd, guard = 0;
  while (cur <= fimYmd && guard < 5000) {
    const mensalNoDia = _custoFixoMensalNaData(cur); // soma dos custos que já valiam nesse dia
    if (mensalNoDia > 0) {
      total += _rateioFixoDia(mensalNoDia, cur, _viveirosAtivosNaData(cur, hoje));
    }
    cur = _maAddDias(cur, 1);
    guard++;
  }
  return total;
}

// Igual ao _custoFixoRateado, mas SEPARADO por item (funcionário, energia,
// limpeza…): acumula a parcela diária de CADA custo fixo no seu próprio balde.
// Como cada parcela é valorMensal/dias/ativos, a soma dos itens bate exatamente
// com o total do _custoFixoRateado. Devolve [{ nome, categoria, valor }] ordenado
// do maior para o menor.
function _custoFixoRateadoPorItem(iniYmd, fimYmd) {
  if (!iniYmd || !fimYmd || iniYmd > fimYmd) return [];
  if (!custosFixos.some(c => c.dataFim || c.ativo !== false)) return [];
  const hoje = _hojeLocal();
  const acc = new Map(); // chave do custo fixo -> { nome, categoria, valor }
  let cur = iniYmd, guard = 0;
  while (cur <= fimYmd && guard < 5000) {
    const nAtivos = _viveirosAtivosNaData(cur, hoje);
    if (nAtivos > 0) {
      for (const cf of custosFixos) {
        if (!_custoFixoValeNaData(cf, cur)) continue;
        const parcela = _rateioFixoDia(cf.valorMensal, cur, nAtivos);
        if (parcela <= 0) continue;
        const chave = cf.id || cf.nome;
        const at = acc.get(chave) || { nome: cf.nome || _custoFixoCatLabel(cf.categoria), categoria: _custoFixoCatLabel(cf.categoria), valor: 0 };
        at.valor += parcela;
        acc.set(chave, at);
      }
    }
    cur = _maAddDias(cur, 1);
    guard++;
  }
  return [...acc.values()].filter(x => x.valor > 0.005).sort((a, b) => b.valor - a.valor);
}

// Rótulo amigável da categoria
function _custoFixoCatLabel(cat) {
  return ({ mao_de_obra: "Mão de obra", energia: "Energia", aluguel: "Aluguel", agua: "Água", manutencao: "Manutenção", outro: "Outro" })[cat] || "Outro";
}

// Custos MANUAIS (reais) que pertencem a um ciclo. Casam pelo ciclo_id quando
// ambos têm; senão (legados sem ciclo_id, criados antes do backfill) usam a
// janela de datas [ini, fim]. Corrige a regressão em que o backfill deu ciclo_id
// ao viveiro mas os custos antigos ficaram null e sumiam do filtro exato.
function _custosManuaisDoCiclo(custos, cicloId, iniYmd, fimYmd) {
  const dentroJanela = (c) => (!iniYmd || !fimYmd) ? true : (c.data >= iniYmd && c.data <= fimYmd);
  return (custos || []).filter(c => {
    if (cicloId && c.cicloId) return c.cicloId === cicloId; // ambos têm id casa exato
    return dentroJanela(c);                                  // legado/sem id janela de datas
  });
}

// FONTE ÚNICA dos custos de um ciclo: manuais válidos + custo fixo rateado.
// Alimenta o card "Custo parcial", o "Custo por kg", o relatório do ciclo e a
// impressão — garantindo o mesmo valor em todos os pontos para a mesma janela.
// rateioCongelado: valor gravado no encerramento. O rateio é recalculado a
// partir dos custos fixos ATUAIS, então desativar um funcionário ou reajustar
// um salário reescrevia o custo de ciclos já fechados — o mesmo relatório dava
// número diferente a cada dia. Ciclo encerrado é registro histórico: usa o
// valor congelado quando existe, e só recalcula para os ciclos antigos que
// fecharam antes deste campo passar a ser gravado.
function _custosCicloAtivo(viveiro, cicloId, iniYmd, fimYmd, rateioCongelado) {
  const manuais = _custosManuaisDoCiclo(viveiro.custos, cicloId, iniYmd, fimYmd);
  const totalProdutos = manuais.filter(c => c.tipo === "produto").reduce((s, c) => s + Number(c.valor), 0);
  const totalOutros = manuais.filter(c => c.tipo !== "produto").reduce((s, c) => s + Number(c.valor), 0);
  const totalManuais = totalProdutos + totalOutros;
  const rateioFixo = (rateioCongelado !== null && rateioCongelado !== undefined && !isNaN(Number(rateioCongelado)))
    ? Number(rateioCongelado)
    : _custoFixoRateado(iniYmd, fimYmd);
  return { manuais, totalProdutos, totalOutros, totalManuais, rateioFixo, total: totalManuais + rateioFixo };
}

async function salvarProtocolos(index) {
  if (_bloqueioViveiro(index)) return;
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return false;
  const { error } = await supabaseClient.from("viveiros")
    .update({ protocolos: viveiros[index].protocolos || [] })
    .eq("id", viveiros[index].id).eq("user_id", usuario.id);
  if (error) { console.log(error); _toastErro("Erro ao salvar (rode o SQL da coluna protocolos): " + error.message); return false; }
  return true;
}

// Fila dos lançamentos automáticos. "Já lancei isso?" e "grava" são dois passos
// com uma ida ao servidor no meio. Se duas rotinas correm juntas — a varredura
// que roda ao abrir o app e o salvar de um protocolo, por exemplo — as duas
// consultam antes de qualquer uma gravar, as duas acham que não existe, e o
// custo entra DUPLICADO. A fila garante que uma termine antes da outra começar.
let _maFila = Promise.resolve();
function _maSerial(fn) {
  const proximo = _maFila.then(fn, fn);
  _maFila = proximo.then(() => {}, () => {}); // a fila nunca "quebra" por um erro
  return proximo;
}

// Devolve "ok" (lançou), "pulado" (nada a fazer / já existia) ou "erro" (falhou
// no banco). Quem chama PRECISA distinguir os dois últimos: tratar erro como
// "pulado" fazia a varredura semanal marcar o dia como resolvido e nunca mais
// tentar — o custo desaparecia em silêncio quando a internet oscilava.
function _lancarCustoAuto(index, produto, quantidadeG, data, obs) {
  return _maSerial(() => _lancarCustoAutoSerial(index, produto, quantidadeG, data, obs));
}

async function _lancarCustoAutoSerial(index, produto, quantidadeG, data, obs) {
  if (!quantidadeG || quantidadeG <= 0) return "pulado";
  const observacao = obs || "Automático";
  // Não repete o mesmo lançamento automático: mesmo produto, mesma data e mesma
  // origem. Comparar a observação inteira (e não só o prefixo "Automático")
  // permite que um protocolo semanal e um atrelado à ração usem o mesmo produto
  // no mesmo dia sem que um anule o outro.
  const jaTem = (viveiros[index].custos || []).some(c =>
    c.data === data && c.produtoId === produto.id && (c.observacao || "") === observacao);
  if (jaTem) return "pulado";
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return "erro";
  const valor = (produto.custoPorGrama || 0) * quantidadeG;
  // Marca o ciclo ativo. Sem isto, o custo automático sem ciclo caía na janela
  // de datas e, quando um ciclo encerrava e outro começava no MESMO dia, era
  // contado nos dois (auditoria). Custo manual já leva ciclo_id — agora igual.
  const cicloId = viveiros[index].cicloId || null;
  const { data: salvo, error } = await supabaseClient.from("custos").insert([{
    user_id: usuario.id, viveiro_id: viveiros[index].id, tipo: "produto",
    produto_id: produto.id, nome_produto: produto.nome, quantidade_g: quantidadeG,
    valor, categoria: produto.categoria, data, observacao, ciclo_id: cicloId,
  }]).select();
  if (error) { console.log(error); return "erro"; }
  if (!salvo || !salvo.length) return "erro"; // RLS pode barrar sem devolver erro
  if (!viveiros[index].custos) viveiros[index].custos = [];
  viveiros[index].custos.push({ id: salvo[0].id, tipo: "produto", produtoId: produto.id, nomeProduto: produto.nome, quantidadeG, valor, categoria: produto.categoria, data, observacao, cicloId });
  return "ok";
}

// Remove os custos que os protocolos de ração geraram numa data. Necessário
// porque a dose é proporcional aos kg lançados: se o lançamento de ração é
// corrigido ou apagado, o custo derivado dele tem de acompanhar — senão fica
// cobrando pela quantidade antiga, ou órfão no ciclo.
function _removerCustosAutoRacao(index, data) {
  // Entra na mesma fila dos lançamentos: apagar enquanto outro lançamento está
  // gravando deixaria um custo órfão (ou apagaria o que acabou de entrar).
  return _maSerial(() => _removerCustosAutoRacaoSerial(index, data));
}

async function _removerCustosAutoRacaoSerial(index, data) {
  const v = viveiros[index];
  const alvos = (v.custos || []).filter(c => c.data === data && (c.observacao || "") === "Automático (ração)");
  if (!alvos.length) return true;
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return false;
  const ids = alvos.map(c => c.id).filter(Boolean);
  if (ids.length) {
    const { error } = await supabaseClient.from("custos").delete().in("id", ids).eq("user_id", usuario.id);
    if (error) { console.log(error); return false; }
  }
  v.custos = (v.custos || []).filter(c => !alvos.includes(c));
  return true;
}

// Dispara ao lançar ração (tipo "racao") — dose por kg de ração
async function _aplicarProtocolosRacao(index, racaoKg, data) {
  const prots = (viveiros[index].protocolos || []).filter(p => p.ativo && p.tipo === "racao");
  const wd = _maParse(data).getDay();
  const aplicados = [];
  const falhas = [];
  for (const p of prots) {
    if (p.inicio && data < p.inicio) continue;
    if (Array.isArray(p.dias) && p.dias.length > 0 && !p.dias.includes(wd)) continue;
    const produto = produtos.find(pr => pr.id === p.produtoId);
    if (!produto) continue;
    const quantidadeG = (Number(p.dosePorKgG) || 0) * racaoKg;
    const r = await _lancarCustoAuto(index, produto, quantidadeG, data, "Automático (ração)");
    if (r === "ok") aplicados.push({ nome: produto.nome, quantidadeG, valor: (produto.custoPorGrama || 0) * quantidadeG });
    else if (r === "erro") falhas.push(produto.nome); // "pulado" = já existia, não é falha
  }
  return { aplicados, falhas };
}

// Aplica um protocolo de ração aos lançamentos de ração já existentes.
// Retorna { n: quantos custos criou, valor: soma, pulados: já existentes, total: rações no período }
async function _aplicarProtocoloRacaoRetroativo(index, prot) {
  const produto = produtos.find(pr => pr.id === prot.produtoId);
  if (!produto) return { n: 0, valor: 0, pulados: 0, total: 0 };
  const v = viveiros[index];
  const minData = prot.inicio || v.dataPovoamento || "0000-00-00";
  const racoes = (v.racoes || []).filter(r => r.data >= minData && r.racao > 0).sort((a, b) => a.data.localeCompare(b.data));
  let n = 0, valor = 0, pulados = 0;
  for (const r of racoes) {
    const wd = _maParse(r.data).getDay();
    if (Array.isArray(prot.dias) && prot.dias.length > 0 && !prot.dias.includes(wd)) continue;
    const jaTem = (v.custos || []).some(c => c.data === r.data && c.produtoId === produto.id && (c.observacao || "").startsWith("Automático"));
    if (jaTem) { pulados++; continue; }
    const quantidadeG = (Number(prot.dosePorKgG) || 0) * r.racao;
    const res = await _lancarCustoAuto(index, produto, quantidadeG, r.data, "Automático (ração)");
    if (res === "ok") { n++; valor += (produto.custoPorGrama || 0) * quantidadeG; }
  }
  return { n, valor, pulados, total: racoes.length };
}

// Põe em dia os protocolos semanais.
// indexAlvo definido = roda só naquele viveiro (é o caso quando o usuário acaba
// de salvar ou ativar um manejo: o manejo pertence àquele viveiro, então não faz
// sentido disparar lançamento automático nos outros).
// indexAlvo indefinido = varredura de todos ao abrir o app (põe em dia).
// Teto de dias por protocolo numa única varredura, para o app não travar quando
// alguém abre depois de meses. O que sobrar é avisado e continua na próxima vez.
const _MA_MAX_DIAS_VARREDURA = 400;
let _maPreviaIndex = 0; // viveiro do formulário aberto, usado pela prévia de custo

// Uma varredura por vez. A da abertura do app roda em segundo plano; se o
// usuário ativa ou salva um manejo enquanto ela corre, a segunda varredura
// esperava nada e lançava os mesmos dias de novo. Aqui a segunda espera a
// primeira: quando começa, a marca de progresso já está em dia e ela não repete
// nada. Fila própria (separada da dos lançamentos) para não travar a si mesma.
let _maVarredura = Promise.resolve();
function aplicarProtocolosSemanais(indexAlvo) {
  const proximo = _maVarredura.then(
    () => _varrerProtocolosSemanais(indexAlvo),
    () => _varrerProtocolosSemanais(indexAlvo));
  _maVarredura = proximo.then(() => {}, () => {});
  return proximo;
}

async function _varrerProtocolosSemanais(indexAlvo) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const hojeStr = _maYmd(hoje);
  const aSalvar = [];
  let _maLancados = 0, _maFalhou = false, _maTruncou = false;
  const soUm = Number.isInteger(indexAlvo);
  const ini = soUm ? indexAlvo : 0;
  const fim = soUm ? indexAlvo + 1 : viveiros.length;
  for (let index = ini; index < fim; index++) {
    const v = viveiros[index];
    if (!v) continue;
    if (!v.dataPovoamento) continue;
    // Viveiro fora do plano é somente leitura: não lança custo automático nele.
    if (_viveiroForaDoLimite(index)) continue;
    const prots = (v.protocolos || []).filter(p => p.ativo && p.tipo === "semanal" && Array.isArray(p.dias) && p.dias.length);
    let alterou = false;
    for (const p of prots) {
      const produto = produtos.find(pr => pr.id === p.produtoId);
      if (!produto) continue;
      let inicio = p.ultimoLancamento ? _maAddDias(p.ultimoLancamento, 1) : v.dataPovoamento;
      if (inicio < v.dataPovoamento) inicio = v.dataPovoamento;
      if (p.inicio && inicio < p.inicio) inicio = p.inicio;
      let cur = _maParse(inicio);
      const ultimoDia = _maParse(hojeStr); // nome próprio: `fim` é o limite do laço de viveiros
      // Marca de progresso: só avança até o último dia REALMENTE resolvido. Se um
      // lançamento falha (internet, permissão), o laço para ali e a marca fica no
      // dia anterior — assim a próxima abertura do app tenta de novo.
      let ultimoOk = p.ultimoLancamento || null;
      let diasVaridos = 0;
      while (cur <= ultimoDia) {
        if (diasVaridos++ >= _MA_MAX_DIAS_VARREDURA) { _maTruncou = true; break; }
        const ds = _maYmd(cur);
        if (p.dias.includes(cur.getDay())) {
          const r = await _lancarCustoAuto(index, produto, Number(p.quantidadeG) || 0, ds, "Automático (semanal)");
          if (r === "erro") { _maFalhou = true; break; }
          if (r === "ok") _maLancados++;
        }
        ultimoOk = ds;
        cur.setDate(cur.getDate() + 1);
      }
      if (ultimoOk && p.ultimoLancamento !== ultimoOk) { p.ultimoLancamento = ultimoOk; alterou = true; }
    }
    if (alterou) aSalvar.push(index);
  }
  for (const idx of aSalvar) await salvarProtocolos(idx);

  // Nada de corte silencioso: se algo ficou pendente, o usuário fica sabendo.
  if (_maFalhou) {
    _toastErro("Alguns lançamentos automáticos não foram salvos. Serão tentados de novo quando você abrir o app com internet.");
  } else if (_maTruncou) {
    _toastErro("Havia muitos dias em atraso no manejo automático. Parte foi lançada agora; abra o app novamente para continuar.");
  }
  return { lancados: _maLancados, falhou: _maFalhou, truncou: _maTruncou };
}

function _maResumoProtocolo(p) {
  const dias = (p.dias || []).map(d => _MA_DIAS[d]).join(", ");
  const desde = p.inicio ? ` · desde ${formatarData(p.inicio)}` : "";
  if (p.tipo === "racao") {
    const doseTxt = (p.doseModo === "pct" && p.dosePct)
      ? `${formatarNumeroBR(p.dosePct, 2)}% da ração`
      : `${formatarNumeroBR(p.dosePorKgG, 2)} g por kg de ração`;
    return `${doseTxt} · ${dias || "todos os dias"}${desde}`;
  }
  return `${formatarNumeroBR(p.quantidadeG, 0)} g · ${dias || "—"}${desde}`;
}

function abrirManejoAutomatico(index) {
  const viveiro = viveiros[index];
  const area = document.getElementById("area-gestao");
  const prots = viveiro.protocolos || [];

  // O que o manejo já lançou neste ciclo — sem isso o produtor não tinha como
  // saber se os protocolos estavam realmente funcionando nem quanto custaram.
  const iniCiclo = viveiro.dataPreparacao || viveiro.dataPovoamento || "";
  const lancados = (viveiro.custos || []).filter(c =>
    (c.observacao || "").startsWith("Automático") &&
    ((viveiro.cicloId && c.cicloId) ? c.cicloId === viveiro.cicloId : (!iniCiclo || String(c.data || "") >= iniCiclo)));
  const totalLancado = lancados.reduce((s, c) => s + (Number(c.valor) || 0), 0);

  area.innerHTML = `
    <h3 class="titulo-secao">Manejo automático — ${abreviarViveiro(viveiro.nome)}</h3>
    <div class="cfg-wrap">
      <p class="cfg-secao-desc">Produtos lançados automaticamente neste viveiro. Os lançamentos viram custos e podem ser editados/excluídos no histórico de custos.
      Pausar interrompe os lançamentos enquanto estiver pausado; excluir um protocolo não apaga o que já foi lançado.</p>
      ${produtos.length === 0 ? `<div class="viveiro-sem-ciclo-msg"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>Cadastre um produto em Insumos antes de criar um protocolo.</span></div>` : ""}
      ${lancados.length > 0 ? `<div class="ma-resumo">
        <span>${lancados.length} lançamento${lancados.length !== 1 ? "s" : ""} automático${lancados.length !== 1 ? "s" : ""} neste ciclo</span>
        <b>R$ ${formatarNumeroBR(totalLancado, 2)}</b>
      </div>` : ""}
      <div class="ma-lista">
        ${prots.length === 0 ? `<p class="ma-vazio">Nenhum protocolo configurado.</p>` : prots.map(p => {
          const prod = produtos.find(pr => pr.id === p.produtoId);
          const orfao = !prod; // produto foi excluído dos Insumos
          return `<div class="ma-item ${p.ativo && !orfao ? "" : "ma-inativo"}${orfao ? " ma-orfao" : ""}">
            <div class="ma-item-info">
              <span class="ma-item-nome">${_esc(prod ? prod.nome : (p.nomeProduto || "Produto removido"))}${orfao ? ` <span class="ma-badge-alerta">produto excluído</span>` : ""}</span>
              <span class="ma-item-regra">${orfao
                ? "Não está lançando — o produto saiu dos Insumos. Edite para escolher outro, ou exclua o protocolo."
                : `${p.tipo === "racao" ? "Atrelado à ração" : "Programado semanal"} · ${_maResumoProtocolo(p)}`}</span>
            </div>
            <div class="ma-item-acoes">
              ${orfao ? "" : `<button class="ma-toggle ${p.ativo ? "on" : ""}" onclick="toggleProtocolo(${index},'${p.id}', this)" title="${p.ativo ? "Pausar" : "Ativar"}"><span></span></button>`}
              <button class="ma-btn-ic" onclick="abrirFormProtocolo(${index},'${p.id}')">✏️</button>
              <button class="ma-btn-ic" onclick="excluirProtocolo(${index},'${p.id}', this)">🗑️</button>
            </div>
          </div>`;
        }).join("")}
      </div>
      ${produtos.length > 0 ? `<button class="botao-salvar" style="margin-top:12px" onclick="abrirFormProtocolo(${index})"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar produto automático</button>` : ""}
      <button class="botao-voltar-form" style="margin-top:10px" onclick="abrirViveiro(${index})">Voltar</button>
    </div>
  `;
}

async function toggleProtocolo(index, protId, botao) {
  if (_bloqueioViveiro(index)) return;
  if (botao?.disabled) return; // evita duplo toque (ativar/pausar em sequência)
  const p = (viveiros[index].protocolos || []).find(x => x.id === protId);
  if (!p) return;
  // Chavinha: só desabilita (sem trocar o conteúdo, senão o desenho do switch some)
  if (botao) botao.disabled = true;
  const liberar = () => { if (botao) botao.disabled = false; };
  const marcaAntes = p.ultimoLancamento;
  p.ativo = !p.ativo;
  // Ao RETOMAR, a varredura recomeçaria no dia seguinte ao último lançamento —
  // ou seja, lançaria retroativamente todo o período em que ficou pausado, e o
  // produtor pagaria por aplicações que não fez. Pausar tem que significar
  // "não lançar nesses dias", então a marca de progresso pula para ontem e a
  // retomada começa hoje.
  if (p.ativo) p.ultimoLancamento = _maAddDias(_hojeLocal(), -1);
  const ok = await salvarProtocolos(index);
  if (!ok) { p.ativo = !p.ativo; p.ultimoLancamento = marcaAntes; liberar(); return; } // desfaz na memória
  // Ao ATIVAR um manejo semanal, põe em dia os lançamentos — só deste viveiro.
  if (p.ativo && p.tipo === "semanal") await aplicarProtocolosSemanais(index);
  abrirManejoAutomatico(index); // redesenha a tela — a chavinha nova já vem liberada
}

async function excluirProtocolo(index, protId, botao) {
  if (_bloqueioViveiro(index)) return;
  if (botao?.disabled) return;
  _travarBotao(botao, "…");
  viveiros[index].protocolos = (viveiros[index].protocolos || []).filter(x => x.id !== protId);
  await salvarProtocolos(index);
  abrirManejoAutomatico(index);
}

function abrirFormProtocolo(index, protId) {
  const viveiro = viveiros[index];
  _maPreviaIndex = index;
  const p = protId ? (viveiro.protocolos || []).find(x => x.id === protId) : null;
  const tipo = p ? p.tipo : "racao";
  const _protDoseModo = (p && p.tipo === "racao" && p.doseModo === "pct") ? "pct" : "gkg";
  const diasSel = p && p.dias ? p.dias : [];
  const area = document.getElementById("area-gestao");
  area.innerHTML = `
    <h3 class="titulo-secao">${p ? "Editar protocolo" : "Novo protocolo"}</h3>
    <div class="cfg-wrap">
      <div class="campo-form">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><label>Produto</label></div>
        <select id="protProduto" onchange="_protPrevia()">
          ${produtos.map(pr => `<option value="${pr.id}" ${p && p.produtoId === pr.id ? "selected" : ""}>${_esc(pr.nome)} (${_esc(pr.categoria)})</option>`).join("")}
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
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M3 11h18M5 11a7 7 0 0 0 14 0"/></svg><label>Como calcular a dose</label></div>
          <select id="protDoseModo" onchange="_protToggleDose()">
            <option value="gkg" ${_protDoseModo !== "pct" ? "selected" : ""}>Gramas por kg de ração (g/kg)</option>
            <option value="pct" ${_protDoseModo === "pct" ? "selected" : ""}>Porcentagem da ração (%)</option>
          </select>
        </div>
        <div class="campo-form" id="prot-dose-gkg" style="display:${_protDoseModo === "pct" ? "none" : "block"}">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M3 11h18M5 11a7 7 0 0 0 14 0"/></svg><label>Dose por kg de ração (g)</label></div>
          <input type="text" inputmode="decimal" id="protDosePorKg" step="any" oninput="_protPrevia()" placeholder="Ex: 5" value="${_protDoseModo !== "pct" && p && p.tipo === "racao" ? (p.dosePorKgG ?? "") : ""}">
          <p class="rc-print-dica">Ex.: 5 g de produto para cada kg de ração lançada.</p>
        </div>
        <div class="campo-form" id="prot-dose-pct" style="display:${_protDoseModo === "pct" ? "block" : "none"}">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg><label>Porcentagem da ração (%)</label></div>
          <input type="text" inputmode="decimal" id="protDosePct" step="any" oninput="_protPrevia()" placeholder="Ex: 2" value="${_protDoseModo === "pct" && p ? (p.dosePct ?? "") : ""}">
          <p class="rc-print-dica">Ex.: 2% 2 g de produto para cada 100 g de ração.</p>
        </div>
      </div>

      <div id="prot-semanal" style="display:${tipo === "semanal" ? "block" : "none"}">
        <div class="campo-form">
          <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg><label>Quantidade por aplicação (g)</label></div>
          <input type="text" inputmode="decimal" id="protQtd" step="any" oninput="_protPrevia()" placeholder="Ex: 250" value="${p && p.tipo === "semanal" ? p.quantidadeG : ""}">
        </div>
      </div>

      <div class="ma-previa" id="prot-previa"></div>
      <div class="campo-label" style="margin-bottom:6px"><label>Dias da semana</label></div>
      <div class="ma-dias">
        ${_MA_DIAS.map((d, i) => `<button type="button" class="ma-dia ${diasSel.includes(i) ? "sel" : ""}" data-dia="${i}" onclick="this.classList.toggle('sel'); _protPrevia()">${d}</button>`).join("")}
      </div>
      <p class="rc-print-dica" id="prot-dias-dica">Atrelado à ração: deixe vazio para aplicar sempre que lançar ração. Programado: selecione os dias.</p>

      <div class="campo-form" style="margin-top:12px">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><label>Aplicar a partir de (opcional)</label></div>
        <input type="date" id="protInicio" value="${p && p.inicio ? p.inicio : ""}">
      </div>
      <p class="rc-print-dica">Deixe vazio para valer desde o início do cultivo.</p>

      <label class="ma-check"><input type="checkbox" id="protRetroativo"> Aplicar aos dias anteriores (lança o que já passou)</label>

      <div id="msg-prot-erro" style="display:none;color:#ef4444;font-size:13px;margin:8px 0;text-align:center;font-weight:500"></div>
      <button class="botao-salvar" style="margin-top:12px" onclick="salvarProtocolo(${index}, ${protId ? `'${protId}'` : "null"}, this)">Salvar protocolo</button>
      <button class="botao-voltar-form" style="margin-top:10px" onclick="abrirManejoAutomatico(${index})">Voltar</button>
    </div>
  `;
  _protPrevia();
}

function _protToggleTipo() {
  const tipo = document.getElementById("protTipo").value;
  document.getElementById("prot-racao").style.display = tipo === "racao" ? "block" : "none";
  document.getElementById("prot-semanal").style.display = tipo === "semanal" ? "block" : "none";
  _protPrevia();
}

// Prévia do custo enquanto o usuário configura: antes disso, só se descobria o
// impacto no bolso depois que os lançamentos já tinham acontecido.
function _protPrevia() {
  const el = document.getElementById("prot-previa");
  if (!el) return;
  const prod = produtos.find(pr => pr.id === document.getElementById("protProduto")?.value);
  const tipo = document.getElementById("protTipo")?.value || "racao";
  if (!prod) { el.innerHTML = ""; return; }
  const rs = (v) => "R$ " + formatarNumeroBR(v, 2);
  const porG = Number(prod.custoPorGrama) || 0;

  if (tipo === "racao") {
    const modo = document.getElementById("protDoseModo")?.value || "gkg";
    const dosePorKgG = modo === "pct"
      ? (parseDecimalBR(document.getElementById("protDosePct")?.value) || 0) * 10
      : (parseDecimalBR(document.getElementById("protDosePorKg")?.value) || 0);
    if (dosePorKgG <= 0) { el.innerHTML = ""; return; }
    // Referência: quanto de ração o viveiro costuma lançar por vez
    const rac = (viveiros[_maPreviaIndex]?.racoes || []).filter(r => r.racao > 0);
    const refKg = rac.length ? rac.reduce((s, r) => s + r.racao, 0) / rac.length : 50;
    el.innerHTML = `<b>${formatarNumeroBR(dosePorKgG, 2)} g</b> de ${_esc(prod.nome)} por kg de ração
      · custo <b>${rs(dosePorKgG * porG)}</b> por kg lançado<br>
      <small>Num lançamento de ${formatarNumeroBR(refKg, 1)} kg${rac.length ? " (média deste viveiro)" : ""}: ${formatarNumeroBR(dosePorKgG * refKg, 0)} g — ${rs(dosePorKgG * refKg * porG)}</small>`;
  } else {
    const qtd = parseDecimalBR(document.getElementById("protQtd")?.value) || 0;
    if (qtd <= 0) { el.innerHTML = ""; return; }
    const nDias = document.querySelectorAll(".ma-dia.sel").length || 1;
    el.innerHTML = `<b>${formatarNumeroBR(qtd, 0)} g</b> de ${_esc(prod.nome)} por aplicação
      · <b>${rs(qtd * porG)}</b> cada<br>
      <small>Com ${nDias} dia${nDias !== 1 ? "s" : ""} por semana: ${rs(qtd * porG * nDias)}/semana — ${rs(qtd * porG * nDias * 4.3)}/mês</small>`;
  }
}

function _protToggleDose() {
  const modo = document.getElementById("protDoseModo").value;
  document.getElementById("prot-dose-gkg").style.display = modo === "pct" ? "none" : "block";
  document.getElementById("prot-dose-pct").style.display = modo === "pct" ? "block" : "none";
  _protPrevia();
}

async function salvarProtocolo(index, protId, botao) {
  if (_bloqueioViveiro(index)) return;
  if (botao?.disabled) return; // evita duplo toque: criava DOIS protocolos iguais
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
    const modo = document.getElementById("protDoseModo").value;
    if (modo === "pct") {
      const pct = parseDecimalBR(document.getElementById("protDosePct").value);
      if (!pct || pct <= 0) { erro("Informe a porcentagem da ração."); return; }
      prot.doseModo = "pct";
      prot.dosePct = pct;
      prot.dosePorKgG = pct * 10; // pct% de 1000 g de ração = pct×10 g por kg
    } else {
      const dose = parseDecimalBR(document.getElementById("protDosePorKg").value);
      if (!dose || dose <= 0) { erro("Informe a dose por kg de ração."); return; }
      prot.doseModo = "gkg";
      prot.dosePct = null;
      prot.dosePorKgG = dose;
    }
    prot.dias = dias; // vazio = todo dia que lançar ração
  } else {
    const qtd = parseDecimalBR(document.getElementById("protQtd").value);
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
  // Trava só aqui: as validações acima são instantâneas e devolvem sem gravar.
  const restaurar = _travarBotao(botao, "Salvando...");
  const ok = await salvarProtocolos(index);
  if (!ok) { restaurar(); return; }
  _toastSucesso("Manejo salvo!");
  // Aplica lançamentos (pode envolver vários custos) — só neste viveiro
  if (tipo === "semanal") {
    await aplicarProtocolosSemanais(index);
  } else if (retro) {
    const r = await _aplicarProtocoloRacaoRetroativo(index, prot);
    if (r.n > 0) {
      setTimeout(() => _toastSucesso(`${r.n} lançamento(s) anterior(es) aplicados no custo — R$ ${formatarNumeroBR(r.valor, 2)}.`), 500);
    } else if (r.pulados > 0) {
      setTimeout(() => _toastErro("Esses lançamentos já tinham o custo aplicado (nada novo a lançar)."), 500);
    } else {
      setTimeout(() => _toastErro('Nenhuma ração anterior encontrada. Confira a data em "Aplicar a partir de" e se há ração lançada.'), 500);
    }
  }
  abrirManejoAutomatico(index);
}

// ═══ CUSTOS E INSUMOS ══════════════════════════════════════════════════════════

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
        <button class="botao-voltar-form" onclick="voltarMenuGestao()">Voltar</button>
      </div>
    </div>
  `;
}

// Guarda se a pessoa já viu o aviso e insistiu. Zera a cada tela aberta e a
// cada produto salvo — confirmação de um produto não vale para o seguinte.
let _produtoConfirmado = false;
let _TXT_SALVAR_PRODUTO = "";

function abrirCadastrarProduto() {
  _produtoConfirmado = false;
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
          <input type="text" id="nomeProduto" placeholder="Ex: Probiótico">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <label>Categoria</label>
          </div>
          <select id="categoriaProduto">
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
            <input type="text" inputmode="decimal" id="pesoKgProduto" placeholder="Ex: 25" oninput="calcularPreviaKg()">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Valor pago por saco / embalagem</label>
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
        <div id="aviso-produto" class="aviso-cadastro" style="display:none"></div>
        <div id="erro-produto" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;font-size:13px;color:#dc2626;margin-bottom:12px"></div>
        <button class="botao-salvar" onclick="salvarProduto()">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar produto
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirCustosInsumos()">Voltar</button>
      </div>
    </div>
  `;
  _TXT_SALVAR_PRODUTO = document.querySelector(".botao-salvar")?.innerHTML || "Salvar produto";
}

/* ═══ CONFERÊNCIA DO CADASTRO DE PRODUTO ═════════════════════════════════════
   Um cliente cadastrou um balde de 1 kg como "1000" — pensando em gramas, num
   campo que pede quilo. O sistema aceitou sem piscar, e a partir dali o preço
   por grama daquele produto saiu mil vezes mais barato para sempre.

   Aconteceu uma vez, acontece de novo. Aqui o sistema olha o que foi digitado
   e AVISA quando o número está fora do que existe no mundo real.

   Aviso, e nunca bloqueio: big bag de uma tonelada existe, produto caro
   existe. Quem manda é o produtor — o sistema só se recusa a deixar passar
   batido.
═════════════════════════════════════════════════════════════════════════════ */

function _conferirCadastroProduto(pesoKg, valorPago) {
  const avisos = [];

  // O erro clássico: grama digitada no campo de quilo. 25 kg é saco de ração,
  // 1000 kg é big bag. Acima disso, quase sempre é engano.
  if (pesoKg >= 200) {
    avisos.push(`<b>${formatarNumeroBR(pesoKg, 0)} kg</b> é mais de ${Math.floor(pesoKg / 25)} sacos de ração juntos. ` +
      `Se o produto vem num balde de ${formatarNumeroBR(pesoKg / 1000, 2).replace(/,00$/, "")} kg, o certo é digitar <b>${formatarNumeroBR(pesoKg / 1000, 3).replace(/,000$/, "")}</b>.`);
  } else if (pesoKg > 0 && pesoKg < 0.1) {
    avisos.push(`<b>${formatarNumeroBR(pesoKg, 3)} kg</b> é menos de 100 gramas. Confira se não era para ser em quilo.`);
  }

  // Vírgula no lugar errado: R$ 5.000 onde se quis R$ 50,00.
  if (valorPago >= 5000) {
    avisos.push(`<b>R$ ${formatarNumeroBR(valorPago, 2)}</b> por embalagem é muito alto. Confira a vírgula.`);
  }

  // A conta final é a que mais denuncia: os dois erros juntos podem se anular
  // no preço da embalagem e só aparecer aqui.
  if (pesoKg > 0 && valorPago > 0) {
    const porKg = valorPago / pesoKg;
    if (porKg < 0.05) {
      avisos.push(`Isso dá <b>R$ ${formatarNumeroBR(porKg, 4)} por quilo</b> — praticamente de graça. Confira o peso.`);
    } else if (porKg > 5000) {
      avisos.push(`Isso dá <b>R$ ${formatarNumeroBR(porKg, 2)} por quilo</b>. Confira o peso e o valor.`);
    }
  }

  return avisos;
}

// Desenha o aviso embaixo do formulário. Devolve true se há algo a conferir.
function _mostrarAvisoProduto(idCaixa, pesoKg, valorPago) {
  const caixa = document.getElementById(idCaixa);
  if (!caixa) return false;
  const avisos = _conferirCadastroProduto(pesoKg, valorPago);
  if (!avisos.length) { caixa.style.display = "none"; caixa.innerHTML = ""; return false; }
  caixa.innerHTML = `<strong>Confere isto antes de salvar</strong>` +
    avisos.map(a => `<span>${a}</span>`).join("");
  caixa.style.display = "block";
  return true;
}

function calcularPreviaKg() {
  const peso = parseDecimalBR(document.getElementById("pesoKgProduto").value);
  const valor = parseMoedaBR(document.getElementById("valorPagoProduto").value);
  const div = document.getElementById("previa-custo-kg");
  const el = document.getElementById("previa-custo-kg-valor");
  if (peso > 0 && valor > 0) {
    el.textContent = `R$ ${formatarNumeroBR(valor / peso, 2)} / kg`;
    div.style.display = "block";
  } else {
    div.style.display = "none";
  }
  _mostrarAvisoProduto("aviso-produto", peso, valor);
}

async function salvarProduto() {
  if (_bloqueioEdicao()) return;
  // Trava ANTES de qualquer await: a checagem de duplicado lê o array em memória,
  // que só é atualizado depois do insert. Dois toques rápidos passavam os dois
  // pela checagem e gravavam o mesmo insumo duas vezes.
  const botaoTopo = document.querySelector(".botao-salvar");
  if (botaoTopo?.disabled) return;
  const nome = document.getElementById("nomeProduto").value.trim();
  const categoria = document.getElementById("categoriaProduto").value;
  const pesoKg = parseDecimalBR(document.getElementById("pesoKgProduto").value);
  const valorPago = parseMoedaBR(document.getElementById("valorPagoProduto").value);
  const erroProd = document.getElementById("erro-produto");

  if (!nome || !(pesoKg > 0) || !(valorPago > 0)) {
    if (erroProd) { erroProd.textContent = "Preencha nome, peso e valor (maiores que zero)."; erroProd.style.display = "block"; }
    return;
  }
  // Trava contra duplicado: mesmo nome na mesma categoria
  const nomeNorm = nome.toLowerCase();
  if (produtos.some(p => (p.nome || "").trim().toLowerCase() === nomeNorm && p.categoria === categoria)) {
    if (erroProd) { erroProd.textContent = `Já existe um produto "${nome}" nessa categoria. Edite o existente em vez de duplicar.`; erroProd.style.display = "block"; }
    return;
  }
  if (erroProd) erroProd.style.display = "none";

  // Número fora do mundo real: mostra o aviso e SEGURA o primeiro toque. O
  // segundo toque grava. Aviso que não segura nada é enfeite — a pessoa toca
  // em salvar antes de ler, e foi assim que o balde de 1 kg virou uma tonelada.
  if (_mostrarAvisoProduto("aviso-produto", pesoKg, valorPago) && !_produtoConfirmado) {
    _produtoConfirmado = true;
    if (botaoTopo) botaoTopo.innerHTML = "Confirmar mesmo assim";
    return;
  }

  // Passou nas validações: fecha a porta antes do primeiro await. Mostra
  // "Salvando..." com spinner — antes o botão só apagava um pouco, sem texto,
  // e numa conexão lenta parecia travado ("não salvou"), até aparecer o ✅.
  const botao = botaoTopo;
  if (botao) {
    botao.disabled = true; botao.style.opacity = "0.65";
    botao.innerHTML = `<span class="btn-spinner"></span>Salvando...`;
  }

  const usuario = await pegarUsuarioLogado();
  if (!usuario) {
    if (botao) { botao.disabled = false; botao.style.opacity = ""; botao.innerHTML = _TXT_SALVAR_PRODUTO; }
    return;
  }

  const custoPorGrama = valorPago / (pesoKg * 1000);

  const { data: salvo, error } = await supabaseClient
    .from("produtos")
    .insert([{ user_id: usuario.id, nome, categoria, peso_kg: pesoKg, valor_pago: valorPago, custo_por_grama: custoPorGrama }])
    .select();

  if (error) {
    if (botao) { botao.disabled = false; botao.style.opacity = ""; botao.innerHTML = _TXT_SALVAR_PRODUTO; }
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
  const avisoCad = document.getElementById("aviso-produto");
  if (avisoCad) avisoCad.style.display = "none";
  _produtoConfirmado = false;
  if (botao) botao.innerHTML = _TXT_SALVAR_PRODUTO;
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
              ${produtos.map((p, i) => ({ p, i })).sort((a, b) => a.p.nome.localeCompare(b.p.nome, "pt-BR", { sensitivity: "base" })).map(({ p, i }) => `
                <div class="produto-item" id="produto-item-${i}">
                  <div class="produto-info">
                    <span class="produto-nome">${_esc(p.nome)}</span>
                    <span class="produto-detalhe">${_esc(p.categoria)} · ${formatarNumeroBR(p.pesoKg, 0)} kg · R$ ${formatarNumeroBR(p.valorPago, 2)} · R$ ${formatarNumeroBR(p.valorPago / p.pesoKg, 2)}/kg</span>
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
        <button class="botao-voltar-form" onclick="abrirCustosInsumos()">Voltar</button>
      </div>
    </div>
  `;
}

function confirmarExcluirProduto(i) {
  const item = document.getElementById(`produto-item-${i}`);
  if (!item) return;
  item.innerHTML = `
    <div class="confirmar-exclusao-custo">
      <span>Excluir <strong>${_esc(produtos[i].nome)}</strong>?</span>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirProduto(${i}, this)">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="abrirVerProdutos()">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirProduto(i, botao) {
  if (_bloqueioEdicao()) return;
  if (botao?.disabled) return;
  const restaurar = _travarBotao(botao, "Excluindo...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }
  const { data: del, error } = await supabaseClient.from("produtos")
    .delete().eq("id", produtos[i].id).eq("user_id", usuario.id).select();
  if (error) { restaurar(); _toastErro("Erro ao excluir: " + error.message); return; }
  if (!del || del.length === 0) {
    restaurar();
    _toastErro("Não foi possível excluir no banco (falta a política de exclusão em 'produtos'). Rode o SQL enviado.");
    return;
  }
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
          <input type="text" id="editNomeProduto" value="${_attr(p.nome)}">
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            <label>Categoria</label>
          </div>
          <select id="editCategoriaProduto">
            ${p.categoria === "Ração" ? `<option value="Ração" selected>Ração</option>` : ""}
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
            <input type="text" inputmode="decimal" id="editPesoKgProduto" value="${p.pesoKg}" oninput="_conferirEdicaoProduto()">
            <span class="campo-unidade">kg</span>
          </div>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            <label>Valor pago por saco / embalagem</label>
          </div>
          <div class="campo-input-unidade">
            <input type="text" inputmode="decimal" id="editValorPagoProduto" value="${p.valorPago ? p.valorPago.toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2}) : ''}" oninput="_conferirEdicaoProduto()" onblur="formatarMoedaBlur(this); _conferirEdicaoProduto()">
            <span class="campo-unidade">R$</span>
          </div>
        </div>
        <div id="aviso-edit-produto" class="aviso-cadastro" style="display:none"></div>
        <div id="erro-edit-produto" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;font-size:13px;color:#dc2626;margin-bottom:4px"></div>
        <button class="botao-salvar" onclick="salvarEdicaoProduto(${i})">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="abrirVerProdutos()">Voltar</button>
      </div>
    </div>
  `;
}

function _conferirEdicaoProduto() {
  _mostrarAvisoProduto("aviso-edit-produto",
    parseDecimalBR(document.getElementById("editPesoKgProduto")?.value),
    parseMoedaBR(document.getElementById("editValorPagoProduto")?.value));
}

async function salvarEdicaoProduto(i) {
  if (_bloqueioEdicao()) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque
  const nome = document.getElementById("editNomeProduto").value.trim();
  const categoria = document.getElementById("editCategoriaProduto").value;
  const pesoKg = parseDecimalBR(document.getElementById("editPesoKgProduto").value);
  const valorPago = parseMoedaBR(document.getElementById("editValorPagoProduto").value);
  const erroEditProd = document.getElementById("erro-edit-produto");
  const _erroEditProd = (msg) => { if (erroEditProd) { erroEditProd.textContent = msg; erroEditProd.style.display = "block"; } };
  if (erroEditProd) erroEditProd.style.display = "none";

  if (!nome || !(pesoKg > 0) || !(valorPago > 0)) { _erroEditProd("Preencha nome, peso e valor (maiores que zero)."); return; }

  if (_mostrarAvisoProduto("aviso-edit-produto", pesoKg, valorPago) && !_produtoConfirmado) {
    _produtoConfirmado = true;
    if (botao) botao.innerHTML = "Confirmar mesmo assim";
    return;
  }

  const custoPorGrama = valorPago / (pesoKg * 1000);
  const restaurar = _travarBotao(botao, "Salvando...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const { error } = await supabaseClient
    .from("produtos")
    .update({ nome, categoria, peso_kg: pesoKg, valor_pago: valorPago, custo_por_grama: custoPorGrama })
    .eq("id", produtos[i].id)
    .eq("user_id", usuario.id);

  restaurar();

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
        <button class="botao-voltar-form" onclick="abrirViveiro(${index}); restaurarScroll()">Voltar</button>
      </div>
    </div>
  `;
}

function abrirLancarCustoProduto(index = "") {
  const dentro = index !== "" && index !== null && index !== undefined;
  const area = document.getElementById("area-gestao");
  const hoje = _hojeLocal();
  const ativos = viveiros.map((v, i) => ({ v, i })).filter(x => x.v.dataPovoamento || x.v.dataPreparacao);
  if (!dentro && ativos.length === 0) {
    area.innerHTML = `
      <div class="form-lancamento">
        <div class="form-topo">
          <div class="form-icone-circulo"><svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
          <h2 class="form-titulo">Lançar Produto</h2>
        </div>
        <div class="viveiro-sem-ciclo-msg">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Nenhum viveiro com ciclo ativo. Inicie um ciclo antes de lançar custo.</span>
        </div>
        <button class="botao-voltar-form" onclick="abrirMenuCusto()">Voltar</button>
      </div>`;
    return;
  }
  const viveiro = dentro ? viveiros[index] : null;

  // A unidade é lembrada numa variável do arquivo, e a tela é redesenhada com
  // "g" marcado sempre. Sem zerar aqui, quem lançasse em saco, saísse e
  // voltasse veria "g" na tela enquanto a conta continuava em saco — e 300
  // (que a pessoa quis em gramas) viraria 7.500.000 g, vinte e cinco mil vezes
  // o valor. Vale para kg também, que já errava mil vezes antes do saco existir.
  _unidadeCusto = "g";

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
            <span>Nenhum produto cadastrado. Vá em Custos e Insumos Cadastrar produto primeiro.</span>
          </div>
          <button class="botao-voltar-form" onclick="${dentro ? `abrirLancarCusto(${index})` : "abrirMenuCusto()"}">Voltar</button>
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
        ${dentro ? `<span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>` : ""}
        <h2 class="form-titulo">Lançar Produto</h2>
      </div>
      <div class="form-corpo">
        ${dentro ? "" : `
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
            <label>Viveiro</label>
          </div>
          <select id="viveiroCustoProduto">
            ${ativos.map(x => `<option value="${x.i}">${_esc(x.v.nome)}</option>`).join("")}
          </select>
        </div>`}
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
            ${produtos.map((p, i) => `<option value="${i}">${_esc(p.nome)} (${_esc(p.categoria)})</option>`).join("")}
          </select>
        </div>
        <div class="campo-form">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            <label>Quantidade utilizada</label>
            <div class="unidade-toggle">
              <button type="button" class="unidade-btn ativo" id="btnUnidadeG" onclick="selecionarUnidade('g')">g</button>
              <button type="button" class="unidade-btn" id="btnUnidadeKg" onclick="selecionarUnidade('kg')">kg</button>
              <!-- Só aparece depois de escolher o produto: "saco" só quer dizer
                   alguma coisa quando o sistema sabe quantos quilos ele tem. -->
              <button type="button" class="unidade-btn" id="btnUnidadeSaco" style="display:none" onclick="selecionarUnidade('saco')">saco</button>
            </div>
          </div>
          <input type="text" inputmode="decimal" id="qtdCustoProduto" placeholder="Ex: 300" min="0" step="any" oninput="atualizarPreviaCusto()">
        </div>
        <div id="previa-custo-produto" class="custo-por-grama-preview" style="display:none">
          Valor calculado: <strong id="previa-custo-valor">—</strong>
          <span id="previa-custo-equiv" class="previa-equiv" style="display:none"></span>
        </div>
        <div id="msg-custo-produto-erro" style="display:none;color:#ef4444;font-size:13px;margin:4px 0 8px;text-align:center;font-weight:500"></div>
        <button class="botao-salvar" onclick="_executarSalvamento(this, () => salvarCustoProduto(${dentro ? index : ""}))">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar lançamento
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${dentro ? `abrirLancarCusto(${index})` : "abrirMenuCusto()"}">Voltar</button>
      </div>
    </div>
  `;
}

let _unidadeCusto = "g";
let _editCustoUnidade = "kg";

/* ═══ UNIDADES DE LANÇAMENTO ═════════════════════════════════════════════════
   Tudo é guardado em GRAMAS no banco — o preço do produto é custo por grama, e
   é assim que todos os relatórios somam. As unidades são só o jeito de digitar.

   "saco" existe porque ninguém compra silicone em grama: compra em saco. Sem
   essa opção, o produtor tinha que abrir a calculadora, multiplicar por 25.000
   e digitar o resultado — e errar um zero ali estraga o custo do ciclo inteiro.

   O peso do saco vem do cadastro do produto, que já pede "Peso do saco /
   embalagem". Por isso a opção só aparece DEPOIS de escolher o produto: antes
   disso, "saco" não quer dizer nada.
═════════════════════════════════════════════════════════════════════════════ */

function _paraGramas(qtd, unidade, produto) {
  if (unidade === "kg") return qtd * 1000;
  if (unidade === "saco") {
    const pesoKg = Number(produto?.pesoKg) || 0;
    if (pesoKg <= 0) return null;   // sem peso cadastrado não dá para converter
    return qtd * pesoKg * 1000;
  }
  return qtd;
}

// Mostra ou esconde o botão "saco" conforme o produto escolhido.
function _ajustarBotaoSaco() {
  const btn = document.getElementById("btnUnidadeSaco");
  if (!btn) return;
  const i = document.getElementById("selectProduto")?.value;
  const prod = (i !== "" && i !== undefined) ? produtos[i] : null;
  const pesoKg = Number(prod?.pesoKg) || 0;
  btn.style.display = pesoKg > 0 ? "" : "none";
  btn.textContent = "saco";
  // Trocou para um produto sem peso de saco com "saco" selecionado? Volta para
  // grama, senão a conta ficaria pendurada numa unidade que não existe mais.
  if (pesoKg <= 0 && _unidadeCusto === "saco") selecionarUnidade("g");
}

function selecionarUnidadeEdit(u, index, chaveEnc) {
  const anterior = _editCustoUnidade;
  const campo = document.getElementById("editCustoQtd");
  const chave = decodeURIComponent(chaveEnc);
  const grupo = (viveiros[index]?.custos || []).filter(c => _chaveCusto(c) === chave);
  const prod = produtos.find(p => p.id === grupo[0]?.produtoId);

  // Aqui o número no campo foi preenchido pelo sistema, não digitado. Trocar a
  // unidade sem converter faria "25" (que eram 25 kg) virar 25 SACOS — 625 kg,
  // vinte e cinco vezes o valor. Converte para a quantidade continuar a mesma.
  if (campo && campo.value.trim()) {
    const atual = parseDecimalBR(campo.value);
    const emGramas = _paraGramas(atual, anterior, prod);
    if (!isNaN(atual) && emGramas !== null) {
      let novo = emGramas;
      if (u === "kg") novo = emGramas / 1000;
      else if (u === "saco") {
        const pesoKg = Number(prod?.pesoKg) || 0;
        novo = pesoKg > 0 ? emGramas / (pesoKg * 1000) : emGramas;
      }
      campo.value = formatarNumeroBR(novo, Number.isInteger(novo) ? 0 : 3);
    }
  }

  _editCustoUnidade = u;
  document.getElementById("btnEditUnidadeG")?.classList.toggle("ativo", u === "g");
  document.getElementById("btnEditUnidadeKg")?.classList.toggle("ativo", u === "kg");
  document.getElementById("btnEditUnidadeSaco")?.classList.toggle("ativo", u === "saco");
  recalcularValorEditCusto(index, chaveEnc);
}

function recalcularValorEditCusto(index, chaveEnc) {
  const chave = decodeURIComponent(chaveEnc);
  const v = viveiros[index];
  const grupo = (v.custos || []).filter(c => _chaveCusto(c) === chave);
  const prod = produtos.find(p => p.id === grupo[0]?.produtoId);
  if (!prod) return; // sem produto cadastrado, não há preço para recalcular
  const qtdRaw = parseDecimalBR(document.getElementById("editCustoQtd")?.value);
  const el = document.getElementById("editCustoValor");
  if (!el || isNaN(qtdRaw) || qtdRaw <= 0) return;
  const qtdG = _paraGramas(qtdRaw, _editCustoUnidade, prod);
  if (qtdG === null) return;
  const valor = prod.custoPorGrama * qtdG;
  el.value = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function selecionarUnidade(u) {
  _unidadeCusto = u;
  document.getElementById("btnUnidadeG")?.classList.toggle("ativo", u === "g");
  document.getElementById("btnUnidadeKg")?.classList.toggle("ativo", u === "kg");
  document.getElementById("btnUnidadeSaco")?.classList.toggle("ativo", u === "saco");
  const campo = document.getElementById("qtdCustoProduto");
  if (campo) campo.placeholder = u === "saco" ? "Ex: 1" : u === "kg" ? "Ex: 25" : "Ex: 300";
  atualizarPreviaCusto();
}

function atualizarPreviaCusto() {
  _ajustarBotaoSaco();
  const prodIndex = document.getElementById("selectProduto")?.value;
  const qtdRaw = parseDecimalBR(document.getElementById("qtdCustoProduto")?.value);
  const div = document.getElementById("previa-custo-produto");
  const el = document.getElementById("previa-custo-valor");
  const eq = document.getElementById("previa-custo-equiv");
  if (prodIndex !== "" && prodIndex !== undefined && !isNaN(qtdRaw) && qtdRaw > 0) {
    const prod = produtos[prodIndex];
    const qtdG = _paraGramas(qtdRaw, _unidadeCusto, prod);
    if (prod && qtdG !== null) {
      el.textContent = `R$ ${formatarNumeroBR(prod.custoPorGrama * qtdG, 2)}`;
      // Em saco, mostrar o equivalente em quilo é o que deixa o produtor
      // conferir de cabeça se digitou a quantidade certa.
      if (eq) {
        eq.textContent = _unidadeCusto === "saco"
          ? `${formatarNumeroBR(qtdRaw, qtdRaw % 1 ? 2 : 0)} saco${qtdRaw > 1 ? "s" : ""} = ${formatarNumeroBR(qtdG / 1000, 2)} kg`
          : "";
        eq.style.display = _unidadeCusto === "saco" ? "block" : "none";
      }
      div.style.display = "block";
      return;
    }
  }
  if (div) div.style.display = "none";
}

async function salvarCustoProduto(index = "") {
  // Aberto pelo menu (sem viveiro fixo): pega o viveiro escolhido no seletor.
  if (index === "" || index === null || index === undefined) {
    const sel = document.getElementById("viveiroCustoProduto");
    index = sel ? Number(sel.value) : NaN;
  }
  if (!(index >= 0) || !viveiros[index]) return;
  if (_bloqueioViveiro(index)) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque

  const data = document.getElementById("dataCustoProduto").value;
  const prodIndex = document.getElementById("selectProduto").value;
  const qtdRaw = parseDecimalBR(document.getElementById("qtdCustoProduto").value);
  const erroCustoProd = document.getElementById("msg-custo-produto-erro");
  const _erroCustoProd = (msg) => { if (erroCustoProd) { erroCustoProd.textContent = msg; erroCustoProd.style.display = "block"; } };
  if (erroCustoProd) erroCustoProd.style.display = "none";

  if (!data || prodIndex === "" || isNaN(qtdRaw) || qtdRaw <= 0) { _erroCustoProd("Preencha todos os campos."); return; }

  // Feedback imediato + trava (spinner "Salvando...")
  const reabilitar = _travarBotao(botao, "Salvando...");

  const usuario = await pegarUsuarioLogado();
  if (!usuario) { reabilitar(); return; }

  const prod = produtos[prodIndex];
  const quantidadeG = _paraGramas(qtdRaw, _unidadeCusto, prod);
  if (quantidadeG === null) {
    reabilitar();
    _erroCustoProd("Este produto não tem peso de saco cadastrado. Escolha g ou kg.");
    return;
  }
  const valor = prod.custoPorGrama * quantidadeG;

  const cicloId = viveiros[index].cicloId || null;
  const { data: salvo, error } = await supabaseClient
    .from("custos")
    .insert([{ user_id: usuario.id, viveiro_id: viveiros[index].id, tipo: "produto", produto_id: prod.id, nome_produto: prod.nome, quantidade_g: quantidadeG, valor, categoria: prod.categoria, data, ciclo_id: cicloId }])
    .select();

  if (error) { _erroCustoProd("Erro ao salvar: " + error.message); reabilitar(); return; }

  if (!viveiros[index].custos) viveiros[index].custos = [];
  viveiros[index].custos.push({ id: salvo[0].id, tipo: "produto", produtoId: prod.id, nomeProduto: prod.nome, quantidadeG, valor, categoria: prod.categoria, data, observacao: null, cicloId });

  // Limpa o formulário para um novo lançamento
  document.getElementById("dataCustoProduto").value = _hojeLocal();
  document.getElementById("selectProduto").value = "";
  document.getElementById("qtdCustoProduto").value = "";
  const prev = document.getElementById("previa-custo-produto");
  if (prev) prev.style.display = "none";
  reabilitar();

  _toastSucesso(`Custo lançado: ${prod.nome} — R$ ${formatarNumeroBR(valor, 2)}`);
}

function abrirLancarOutroCusto(index = "") {
  const dentro = index !== "" && index !== null && index !== undefined;
  const area = document.getElementById("area-gestao");
  const hoje = _hojeLocal();
  const ativos = viveiros.map((v, i) => ({ v, i })).filter(x => x.v.dataPovoamento || x.v.dataPreparacao);
  if (!dentro) _outroCustoModo = "um"; // sempre abre em "só um viveiro"

  if (!dentro && ativos.length === 0) {
    area.innerHTML = `
      <div class="form-lancamento">
        <div class="form-topo">
          <div class="form-icone-circulo"><svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
          <h2 class="form-titulo">Outro Custo</h2>
        </div>
        <div class="viveiro-sem-ciclo-msg">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Nenhum viveiro com ciclo ativo. Inicie um ciclo antes de lançar custo.</span>
        </div>
        <button class="botao-voltar-form" onclick="abrirMenuCusto()">Voltar</button>
      </div>`;
    return;
  }
  const viveiro = dentro ? viveiros[index] : null;

  area.innerHTML = `
    <div class="form-lancamento">
      <div class="form-topo">
        <div class="form-icone-circulo">
          <svg viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        ${dentro ? `<span class="form-caption">${abreviarViveiro(viveiro.nome)}</span>` : ""}
        <h2 class="form-titulo">Outro Custo</h2>
      </div>
      <div class="form-corpo">
        ${dentro ? "" : `
        <div class="fin-modo-toggle" style="margin-bottom:12px">
          <button type="button" class="fin-modo-btn ativo" data-modo="um" onclick="_outroCustoSetModo('um')">Só um viveiro</button>
          <button type="button" class="fin-modo-btn" data-modo="ratear" onclick="_outroCustoSetModo('ratear')">Ratear entre viveiros</button>
        </div>
        <div class="campo-form" id="oc-sel-um">
          <div class="campo-label">
            <svg class="campo-icone" viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
            <label>Viveiro</label>
          </div>
          <select id="viveiroOutroCusto">
            ${ativos.map(x => `<option value="${x.i}">${_esc(x.v.nome)}</option>`).join("")}
          </select>
        </div>
        <div id="oc-sel-ratear" style="display:none">
          <div class="campo-label" style="margin-bottom:6px">
            <svg class="campo-icone" viewBox="0 0 24 24"><ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v5c0 2.2 4 4 9 4s9-1.8 9-4V9"/></svg>
            <label>Viveiros (dividir entre)</label>
          </div>
          <div class="oc-viv-lista">
            ${ativos.map(x => `<label class="oc-viv-item"><input type="checkbox" class="oc-viv-check" value="${x.i}" checked><span>${_esc(x.v.nome)}</span></label>`).join("")}
          </div>
          <p class="rc-print-dica" style="margin:2px 0 8px">O valor será dividido igualmente entre os viveiros marcados.</p>
        </div>`}
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
        <button class="botao-salvar" onclick="${dentro ? `salvarOutroCusto(${index})` : "salvarOutroCustoDispatch()"}">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar lançamento
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${dentro ? `abrirLancarCusto(${index})` : "abrirMenuCusto()"}">Voltar</button>
      </div>
    </div>
  `;
}

async function salvarOutroCusto(index = "") {
  // Aberto pelo menu (sem viveiro fixo): pega o viveiro escolhido no seletor.
  if (index === "" || index === null || index === undefined) {
    const sel = document.getElementById("viveiroOutroCusto");
    index = sel ? Number(sel.value) : NaN;
  }
  if (!(index >= 0) || !viveiros[index]) return;
  if (_bloqueioViveiro(index)) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque

  const data = document.getElementById("dataOutroCusto").value;
  const descricao = document.getElementById("nomeOutroCusto").value.trim();
  const erroOutro = document.getElementById("msg-outro-custo-erro");
  const _erroOutro = (msg) => { if (erroOutro) { erroOutro.textContent = msg; erroOutro.style.display = "block"; } };
  if (erroOutro) erroOutro.style.display = "none";

  if (!descricao) { _erroOutro("Digite o nome do custo."); return; }
  // "Ração" é nome reservado: o custo de ração é derivado dos lançamentos, e
  // _montarCustoRacaoVirtual descarta qualquer registro com nome/categoria
  // "Ração" do ciclo ativo — o lançamento manual sumiria da tela.
  if (_normNomeCusto(descricao) === "racao") {
    _erroOutro('Para custo de ração use "Lançar ração" — esse nome é reservado.');
    return;
  }
  const categoria = descricao;
  const valor = parseMoedaBR(document.getElementById("valorOutroCusto").value);

  if (!data || isNaN(valor) || valor <= 0) { _erroOutro("Preencha todos os campos."); return; }

  // Feedback imediato + trava (spinner "Salvando...")
  const reabilitar = _travarBotao(botao, "Salvando...");

  const usuario = await pegarUsuarioLogado();
  if (!usuario) { reabilitar(); return; }

  const cicloId = viveiros[index].cicloId || null;
  const { data: salvo, error } = await supabaseClient
    .from("custos")
    .insert([{ user_id: usuario.id, viveiro_id: viveiros[index].id, tipo: "outro", nome_produto: descricao, valor, categoria, data, ciclo_id: cicloId }])
    .select();

  if (error) { _erroOutro("Erro ao salvar: " + error.message); reabilitar(); return; }

  if (!viveiros[index].custos) viveiros[index].custos = [];
  viveiros[index].custos.push({ id: salvo[0].id, tipo: "outro", produtoId: null, nomeProduto: descricao, quantidadeG: null, valor, categoria, data, observacao: null, cicloId });

  // Limpa o formulário para um novo lançamento
  document.getElementById("dataOutroCusto").value = _hojeLocal();
  document.getElementById("nomeOutroCusto").value = "";
  document.getElementById("valorOutroCusto").value = "";
  reabilitar();

  _toastSucesso(`Custo lançado: ${descricao} — R$ ${formatarNumeroBR(valor, 2)}`);
}

// Alterna, na tela "Outro custo", entre lançar para UM viveiro ou RATEAR entre
// vários — sem re-renderizar (preserva o que já foi digitado em data/nome/valor).
function _outroCustoSetModo(modo) {
  _outroCustoModo = modo;
  const um = document.getElementById("oc-sel-um");
  const rat = document.getElementById("oc-sel-ratear");
  if (um) um.style.display = modo === "um" ? "" : "none";
  if (rat) rat.style.display = modo === "ratear" ? "" : "none";
  document.querySelectorAll(".fin-modo-btn").forEach(b => b.classList.toggle("ativo", b.dataset.modo === modo));
}

// O botão Salvar (aberto pelo menu) decide qual caminho seguir.
function salvarOutroCustoDispatch() {
  if (_outroCustoModo === "ratear") return salvarOutroCustoRateado();
  return salvarOutroCusto("");
}

// Rateio de um custo avulso entre os viveiros MARCADOS: divide o valor
// igualmente e cria um "outro custo" em cada um (mesmo fluxo do custo manual).
async function salvarOutroCustoRateado() {
  if (_bloqueioEdicao()) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque

  const data = document.getElementById("dataOutroCusto").value;
  const descricao = (document.getElementById("nomeOutroCusto").value || "").trim();
  const valorTotal = parseMoedaBR(document.getElementById("valorOutroCusto").value || "0");
  const erroOutro = document.getElementById("msg-outro-custo-erro");
  const _erro = (m) => { if (erroOutro) { erroOutro.textContent = m; erroOutro.style.display = "block"; } };
  if (erroOutro) erroOutro.style.display = "none";

  if (!descricao) { _erro("Digite o nome do custo."); return; }
  if (_normNomeCusto(descricao) === "racao") {
    _erro('Para custo de ração use "Lançar ração" — esse nome é reservado.'); return;
  }
  if (!data) { _erro("Informe a data."); return; }
  if (!valorTotal || valorTotal <= 0) { _erro("Informe um valor válido."); return; }

  const marcados = [...document.querySelectorAll(".oc-viv-check:checked")]
    .map(c => Number(c.value)).filter(i => viveiros[i]);
  if (marcados.length === 0) { _erro("Marque pelo menos um viveiro."); return; }

  const valorCada = _ratearIgual(valorTotal, marcados.length);

  const restaurar = _travarBotao(botao, "Salvando...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const linhas = marcados.map(i => ({
    user_id: usuario.id, viveiro_id: viveiros[i].id, tipo: "outro",
    nome_produto: descricao, valor: valorCada, categoria: descricao, data,
    ciclo_id: viveiros[i].cicloId || null, observacao: "Rateio entre viveiros",
  }));
  const { data: salvo, error } = await supabaseClient.from("custos").insert(linhas).select();
  if (error) { console.log(error); _erro("Erro ao salvar: " + error.message); restaurar(); return; }

  (salvo || []).forEach(row => {
    const v = viveiros.find(x => x.id === row.viveiro_id);
    if (!v) return;
    if (!v.custos) v.custos = [];
    v.custos.push({ id: row.id, tipo: "outro", produtoId: null, nomeProduto: descricao, quantidadeG: null, valor: valorCada, categoria: descricao, data, observacao: "Rateio entre viveiros", cicloId: row.ciclo_id });
  });
  restaurar();
  _toastSucesso(`R$ ${formatarNumeroBR(valorTotal, 2)} rateado em ${marcados.length} viveiro(s) — R$ ${formatarNumeroBR(valorCada, 2)} cada.`);
  abrirMenuCusto();
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

function _semAcento(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Nomes digitados à mão são o mesmo insumo quando diferem só por acento,
// maiúscula ou espaço: "Análise de água", "Analise de agua" e "análise de
// água" são a mesma despesa. Agrupar por esta chave impede que o relatório
// mostre a mesma coisa quebrada em várias linhas com percentuais menores.
function _normNomeCusto(s) {
  return _semAcento(s).toLowerCase().replace(/\s+/g, " ").trim();
}

// Entre grafias do mesmo nome, mostra a que está acentuada.
function _melhorRotulo(atual, novo) {
  const temAcento = (x) => String(x) !== _semAcento(x);
  if (!atual) return novo;
  if (temAcento(novo) && !temAcento(atual)) return novo;
  return atual;
}

function _chaveCusto(c) {
  return c.produtoId ? ("id:" + c.produtoId) : ("nome:" + _normNomeCusto(c.nomeProduto || c.categoria || "Outros"));
}

// Registro de custo de Ração (derivado do ciclo ativo OU snapshot de ciclo
// encerrado): gerenciado pelo sistema, não editável nas telas de custo.
function _ehCustoRacao(c) {
  return !!(c && (c.derivado || (c.categoria === "Ração" && c.nomeProduto === "Ração")));
}

// Cabeçalho de data do extrato Detalhado: "24 JUL 2026"
function _cdDataHeader(dataStr) {
  const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const d = _parseDataLocal(dataStr);
  if (!d || isNaN(d.getTime())) return "Sem data";
  return d.getDate() + " " + meses[d.getMonth()] + " " + d.getFullYear();
}

// Menu de 3 pontinhos de cada lançamento do extrato Detalhado
function _cdToggleMenu(id) {
  _cdFecharMenus(id);
  const m = document.getElementById(id);
  if (m) m.classList.toggle("aberto");
}
function _cdFecharMenus(exceto) {
  document.querySelectorAll(".cd-menu.aberto").forEach(m => { if (m.id !== exceto) m.classList.remove("aberto"); });
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".cd-menu-wrap")) _cdFecharMenus();
});

// Custos pertencentes ao escopo pedido. "prep" = só a preparação atual (mesmo
// ciclo do viveiro; para lançamentos antigos sem ciclo, a partir da data de
// início da preparação). Sem isso, custos de ciclos já encerrados apareceriam
// na tela "custo de preparação", pois viveiro.custos guarda todo o histórico.
// Devolve pares { c, i } onde `i` é o índice REAL em viveiro.custos. Editar e
// excluir indexam o array original (viveiros[x].custos[i]), por isso o índice
// nunca pode vir de um array já filtrado — sairia mexendo no custo errado.
function _custosDoEscopoPares(viveiro) {
  const pares = (viveiro.custos || []).map((c, i) => ({ c, i }));
  // Mesma regra de _custosManuaisDoCiclo, que é a fonte única usada pelo card
  // "Custo parcial", pelo simular venda e pelo relatório: casa pelo ciclo
  // quando os dois lados têm id; senão, cai na janela de datas do ciclo.
  // Antes esta tela devolvia viveiro.custos cru — o array guarda a vida inteira
  // do viveiro, então custo de um cultivo aparecia no seguinte, e o total não
  // batia com o que as outras telas mostravam.
  const ini = viveiro.dataPreparacao || viveiro.dataPovoamento || "";
  const fim = _hojeLocal();
  const cicloId = viveiro.cicloId;
  return pares.filter(({ c }) => {
    if (cicloId && c.cicloId) return c.cicloId === cicloId;
    return (!ini || !fim) ? true : (String(c.data || "") >= ini && String(c.data || "") <= fim);
  });
}

function _custosDoEscopo(viveiro) {
  return _custosDoEscopoPares(viveiro).map(p => p.c);
}

function renderizarHistoricoCustos(index, elementoId, direto) {
  const viveiro = viveiros[index];
  const resultado = document.getElementById(elementoId);
  const pares = _custosDoEscopoPares(viveiro);
  const custos = pares.map(p => p.c);
  // Rateio dos custos fixos (funcionário/energia/limpeza) do ciclo atual — só de
  // leitura, para o total desta tela bater com o "Custo parcial" do viveiro.
  // rateioItens: o mesmo rateio SEPARADO por item, para listar um card por custo
  // (funcionário, energia, limpeza…) em vez de um monte só. A soma bate.
  const _iniCustos = viveiro.dataPreparacao || viveiro.dataPovoamento;
  const rateioFixo = _custoFixoRateado(_iniCustos, _hojeLocal());
  const rateioItens = _custoFixoRateadoPorItem(_iniCustos, _hojeLocal());
  const totalCustos = custos.reduce((s, c) => s + Number(c.valor), 0) + rateioFixo;

  // Agrupa por produto/nome — soma quantidade e valor (sem datas)
  const grupos = {};
  custos.forEach(c => {
    const chave = _chaveCusto(c);
    if (!grupos[chave]) grupos[chave] = { chave, nome: c.nomeProduto || c.categoria || "Custo", quantidadeG: 0, valor: 0 };
    else grupos[chave].nome = _melhorRotulo(grupos[chave].nome, c.nomeProduto || c.categoria || "Custo");
    grupos[chave].valor += Number(c.valor) || 0;
    if (c.quantidadeG) grupos[chave].quantidadeG += Number(c.quantidadeG);
    // Ração é calculada dos lançamentos (e inclui snapshots de ciclos
    // encerrados) — não pode ser editada/excluída por esta tela
    if (_ehCustoRacao(c)) grupos[chave].soLeitura = true;
  });
  const lista = Object.values(grupos).sort((a, b) => b.valor - a.valor);

  const dolarIco = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="7" x2="12" y2="17"/><path d="M14.5 9.5a2 2 0 0 0-2-1.5h-1a1.8 1.8 0 0 0 0 3.6h1a1.8 1.8 0 0 1 0 3.6h-1.2a2 2 0 0 1-2-1.5"/></svg>`;

  // Corpo conforme o modo escolhido
  let corpo;
  if (_custoModo === "detalhado") {
    // Extrato: cada lançamento com a sua data (mais recente primeiro),
    // agrupado por dia. Sem ícone; nome + valor na 1ª linha, categoria na 2ª,
    // quantidade + menu de 3 pontinhos na 3ª.
    const itens = pares.slice()
      .sort((a, b) => String(b.c.data || "").localeCompare(String(a.c.data || "")));
    if (itens.length === 0) {
      corpo = `<p class="sobrevivencia-texto">Nenhum custo lançado.</p>`;
    } else {
      const totalListado = itens.reduce((s, x) => s + (Number(x.c.valor) || 0), 0);
      let html = `<div class="cd-resumo">
        <span>${itens.length} lançamento${itens.length !== 1 ? "s" : ""}</span>
        <span class="cd-resumo-val">R$ ${formatarNumeroBR(totalListado, 2)}</span>
      </div>`;
      let dataAtual = null;
      itens.forEach(({ c, i }) => {
        const chaveData = String(c.data || "");
        if (chaveData !== dataAtual) {
          dataAtual = chaveData;
          html += `<div class="cd-data-header">${_cdDataHeader(c.data)}</div>`;
        }
        const qtd = _fmtQtdCusto(c.quantidadeG);
        const racao = _ehCustoRacao(c);
        const menuId = `cd-menu-${index}-${i}`;
        const l3 = (qtd || !racao)
          ? `<div class="cd-l3">
              <span class="cd-meta">${qtd || ""}</span>
              ${racao ? "" : `<div class="cd-menu-wrap">
                <button class="cd-menu-btn" onclick="_cdToggleMenu('${menuId}')" aria-label="Opções">⋮</button>
                <div class="cd-menu" id="${menuId}">
                  <button onclick="_cdFecharMenus();abrirEdicaoCusto(${index},${i},'${elementoId}',${_dArg(direto)})">Editar lançamento</button>
                  <button class="cd-menu-excluir" onclick="_cdFecharMenus();confirmarExcluirCusto(${index},${i},'${elementoId}',${_dArg(direto)})">Excluir lançamento</button>
                </div>
              </div>`}
            </div>`
          : "";
        html += `<div class="cd-card${racao ? " cd-card-auto" : ""}" id="custo-row-${index}-${i}">
          <div class="cd-l1">
            <span class="cd-nome">${_esc(c.nomeProduto || c.categoria || "Custo")}</span>
            <span class="cd-valor">R$ ${formatarNumeroBR(Number(c.valor) || 0, 2)}</span>
          </div>
          <div class="cd-l2">
            <span class="cd-cat">${_esc(racao ? "Lançamento automático" : (c.categoria || "Insumo"))}</span>
            ${racao ? `<span class="cd-badge">Automático</span>` : ""}
          </div>
          ${l3}
        </div>`;
      });
      if (rateioFixo > 0) {
        html += `<div class="cd-data-header">Custos fixos</div>`;
        html += rateioItens.map(it => `
          <div class="cd-card cd-card-auto">
            <div class="cd-l1">
              <span class="cd-nome">${_esc(it.nome)}</span>
              <span class="cd-valor">R$ ${formatarNumeroBR(it.valor, 2)}</span>
            </div>
            <div class="cd-l2">
              <span class="cd-cat">${_esc(it.categoria)} · rateio automático</span>
              <span class="cd-badge">Automático</span>
            </div>
          </div>`).join("");
      }
      corpo = html;
    }
  } else {
    // GERAL: cada produto somado num total só (sem datas)
    corpo = lista.length === 0
      ? `<p class="sobrevivencia-texto">Nenhum custo lançado.</p>`
      : lista.map((g, gi) => {
          const qtd = _fmtQtdCusto(g.quantidadeG);
          return `<div class="custo-card" id="cg-${index}-${gi}">
            <div class="custo-card-ico">${dolarIco}</div>
            <div class="custo-card-info">
              <span class="custo-card-nome">${_esc(g.nome)}</span>
              <span class="custo-card-qtd">${qtd || "—"}</span>
            </div>
            <span class="custo-card-valor">R$ ${formatarNumeroBR(g.valor, 2)}</span>
            <div class="custo-card-acoes">${g.soLeitura
              ? `<span style="font-size:10.5px;color:#9ca3af;font-weight:700" title="Calculado dos lançamentos de ração">auto</span>`
              : `<button class="botao-editar" onclick="abrirEditarGrupoCusto(${index},'${_encArg(g.chave)}','${elementoId}',${_dArg(direto)})">✏️</button>
              <button class="botao-editar botao-excluir" onclick="confirmarExcluirGrupoCusto(${index},${gi},'${_encArg(g.chave)}','${elementoId}',${_dArg(direto)})">🗑️</button>`}
            </div>
          </div>`;
        }).join("");
  }

  const rateioCard = rateioItens.map(it => `<div class="custo-card custo-card-rateio">
        <div class="custo-card-ico"><svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
        <div class="custo-card-info">
          <span class="custo-card-nome">${_esc(it.nome)}</span>
          <span class="custo-card-qtd">${_esc(it.categoria)} · rateio automático</span>
        </div>
        <span class="custo-card-valor">R$ ${formatarNumeroBR(it.valor, 2)}</span>
      </div>`).join("");

  resultado.innerHTML = `
    <h3 class="custo-titulo">Custos — ${abreviarViveiro(viveiro.nome)}</h3>
    <p class="custo-escopo">${viveiro.dataPovoamento
      ? `Cultivo atual, desde ${formatarData(viveiro.dataPreparacao || viveiro.dataPovoamento)}`
      : (viveiro.dataPreparacao ? `Preparação atual, desde ${formatarData(viveiro.dataPreparacao)}` : "Este viveiro")}
      · ciclos anteriores ficam no relatório de cada ciclo</p>
    ${(custos.length > 0 || rateioFixo > 0) ? `<button class="custo-imprimir" onclick="imprimirCustos(${index})"><svg viewBox="0 0 24 24"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Imprimir</button>` : ""}
    <div class="custo-modo-toggle">
      <button class="cmt-btn ${_custoModo === "geral" ? "ativo" : ""}" onclick="_custoModo='geral';renderizarHistoricoCustos(${index},'${elementoId}',${_dArg(direto)})">Geral</button>
      <button class="cmt-btn ${_custoModo === "detalhado" ? "ativo" : ""}" onclick="_custoModo='detalhado';renderizarHistoricoCustos(${index},'${elementoId}',${_dArg(direto)})">Detalhado</button>
    </div>
    <div class="custo-grupo-lista${_custoModo === "detalhado" ? " custo-grupo-lista-det" : ""}">
      ${corpo}
      ${_custoModo === "detalhado" ? "" : rateioCard}
    </div>
    <div class="custo-total">
      <div class="custo-total-ico"><svg viewBox="0 0 24 24"><path d="M5 8h14l1.5 11a2 2 0 0 1-2 2.3H5.5A2 2 0 0 1 3.5 19z"/><path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2"/><circle cx="12" cy="13.5" r="1.5"/></svg></div>
      <span class="custo-total-lbl">Total de custos</span>
      <span class="custo-total-val">R$ ${formatarNumeroBR(totalCustos, 2)}</span>
    </div>
    <button class="botao-voltar-form" style="margin-top:14px" onclick="${_custoVoltarAcao(index, direto)}">Voltar</button>
  `;
}

// Serializa o parâmetro `direto` para dentro de um onclick="..." (atributo com
// aspas duplas): booleano vira true/false; texto vira 'prep' com aspas simples,
// pois aspas duplas encerrariam o atributo.
function _dArg(d) { return typeof d === "string" ? `'${d}'` : String(!!d); }

// encodeURIComponent NÃO escapa o apóstrofo, que fecharia o literal de string
// dentro de onclick="...(' ... ')". decodeURIComponent devolve %27 como ', então
// os consumidores continuam recebendo a chave original.
function _encArg(s) { return encodeURIComponent(s).replace(/'/g, "%27"); }

// Destino do "Voltar" da tela de custos, conforme de onde ela foi aberta:
// "prep" = tela do viveiro em preparação; true = histórico direto; false = opções.
function _custoVoltarAcao(index, direto) {
  if (direto === "prep") return `mostrarViveiroSemCiclo(${index})`;
  return direto ? `mostrarHistoricoDoViveiroDireto(${index})` : `voltarOpcoesHistorico()`;
}

// Custos do viveiro que ainda está em preparação (aberto pela tela do viveiro)
function verCustosPreparacao(index) {
  esconderMenu();
  const area = document.getElementById("area-gestao");
  // O wrapper .form-lancamento mantém a largura confortável no desktop
  area.innerHTML = `<div class="form-lancamento"><div id="prep-custos-area"></div></div>`;
  renderizarHistoricoCustos(index, "prep-custos-area", "prep");
}

function abrirEditarGrupoCusto(index, chaveEnc, elementoId, direto) {
  salvarScroll();
  const chave = decodeURIComponent(chaveEnc);
  const v = viveiros[index];
  const grupo = _custosDoEscopo(v).filter(c => _chaveCusto(c) === chave);
  if (!grupo.length) return;
  if (grupo.some(_ehCustoRacao)) {
    _toastErro("O custo de Ração é calculado dos lançamentos — edite os lançamentos de ração.");
    return;
  }
  const isProduto = chave.startsWith("id:");
  const nome = grupo[0].nomeProduto || grupo[0].categoria || "Custo";
  const valor = grupo.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const somaQtd = grupo.reduce((s, c) => s + (Number(c.quantidadeG) || 0), 0); // gramas
  const prod = isProduto ? produtos.find(p => p.id === grupo[0].produtoId) : null;
  // Unidade padrão: kg, exceto quando a quantidade é menor que 1 kg
  _editCustoUnidade = (somaQtd > 0 && somaQtd < 1000) ? "g" : "kg";
  const qtdNaUnidade = somaQtd > 0 ? (_editCustoUnidade === "kg" ? somaQtd / 1000 : somaQtd) : "";

  const resultado = document.getElementById(elementoId);
  resultado.innerHTML = `
    <h3 class="titulo-secao">Editar custo</h3>
    <div class="cfg-wrap">
      <div class="campo-form">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><label>Nome do custo</label></div>
        <input type="text" id="editCustoNome" value="${nome.replace(/"/g, "&quot;")}" ${isProduto ? "disabled" : ""}>
        ${isProduto ? `<p class="rc-print-dica">Nome vem do cadastro do produto (Insumos).</p>` : ""}
      </div>
      ${isProduto ? `
      <div class="campo-form">
        <div class="campo-label">
          <svg class="campo-icone" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <label>Quantidade utilizada</label>
          <div class="unidade-toggle">
            <button type="button" class="unidade-btn ${_editCustoUnidade === 'g' ? 'ativo' : ''}" id="btnEditUnidadeG" onclick="selecionarUnidadeEdit('g',${index},'${chaveEnc}')">g</button>
            <button type="button" class="unidade-btn ${_editCustoUnidade === 'kg' ? 'ativo' : ''}" id="btnEditUnidadeKg" onclick="selecionarUnidadeEdit('kg',${index},'${chaveEnc}')">kg</button>
            ${Number(prod?.pesoKg) > 0 ? `
            <button type="button" class="unidade-btn ${_editCustoUnidade === 'saco' ? 'ativo' : ''}" id="btnEditUnidadeSaco" onclick="selecionarUnidadeEdit('saco',${index},'${chaveEnc}')">saco</button>` : ""}
          </div>
        </div>
        <input type="text" inputmode="decimal" id="editCustoQtd" value="${qtdNaUnidade}" min="0" step="any" oninput="recalcularValorEditCusto(${index},'${chaveEnc}')">
      </div>` : ""}
      <div class="campo-form">
        <div class="campo-label"><svg class="campo-icone" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><label>Valor total (R$)</label></div>
        <input type="text" inputmode="decimal" id="editCustoValor" value="${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}" onblur="formatarMoedaBlur(this)">
        ${prod ? `<p class="rc-print-dica">Recalculado pela quantidade (R$ ${formatarNumeroBR(prod.custoPorGrama * 1000, 2)}/kg). Você ainda pode ajustar o valor na mão.</p>` : ""}
      </div>
      <div id="msg-edit-custo" style="display:none;color:#ef4444;font-size:13px;margin:0 0 8px;text-align:center;font-weight:500"></div>
      <button class="botao-salvar" onclick="_executarSalvamento(this, () => salvarEdicaoGrupoCusto(${index},'${chaveEnc}','${elementoId}',${_dArg(direto)}))">Salvar alterações</button>
      <button class="botao-voltar-form" style="margin-top:10px" onclick="renderizarHistoricoCustos(${index},'${elementoId}',${_dArg(direto)}); restaurarScroll()">Voltar</button>
    </div>
  `;
}

async function salvarEdicaoGrupoCusto(index, chaveEnc, elementoId, direto) {
  if (_bloqueioViveiro(index)) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque
  const chave = decodeURIComponent(chaveEnc);
  const msg = document.getElementById("msg-edit-custo");
  const erro = t => { if (msg) { msg.textContent = t; msg.style.display = "block"; } };
  const v = viveiros[index];
  const grupo = _custosDoEscopo(v).filter(c => _chaveCusto(c) === chave);
  if (!grupo.length) return;
  if (grupo.some(_ehCustoRacao)) {
    _toastErro("O custo de Ração é calculado dos lançamentos — edite os lançamentos de ração.");
    return;
  }
  const isProduto = chave.startsWith("id:");
  const novoNome = isProduto ? (grupo[0].nomeProduto || grupo[0].categoria) : document.getElementById("editCustoNome").value.trim();
  const novoValor = parseMoedaBR(document.getElementById("editCustoValor").value);
  if (!novoNome) { erro("Informe o nome do custo."); return; }
  if (isNaN(novoValor) || novoValor < 0) { erro("Informe um valor válido."); return; }

  // Quantidade: para produto, respeita o que foi editado; para outros custos, mantém o que havia
  let somaQtd;
  if (isProduto) {
    const qtdRaw = parseDecimalBR(document.getElementById("editCustoQtd")?.value);
    if (isNaN(qtdRaw) || qtdRaw <= 0) { erro("Informe a quantidade utilizada."); return; }
    // _paraGramas, e não a conta na mão: a tela oferece g, kg E saco, e uma
    // conta que só conhece kg gravava "2 gramas" onde a pessoa quis 2 sacos.
    const prodGrupo = produtos.find(p => p.id === grupo[0].produtoId);
    somaQtd = _paraGramas(qtdRaw, _editCustoUnidade, prodGrupo);
    if (somaQtd === null) { erro("Este produto não tem peso de saco cadastrado."); return; }
  } else {
    somaQtd = grupo.reduce((s, c) => s + (Number(c.quantidadeG) || 0), 0);
  }
  const ids = grupo.map(c => c.id).filter(Boolean);
  if (!ids.length) { erro("Este custo não pode ser editado por aqui."); return; }

  const restaurar = _travarBotao(botao, "Salvando...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const cicloIdGrupo = grupo[0].cicloId || null; // preserva o ciclo do custo editado
  // Renomear tem que renomear no relatório também. O relatório financeiro
  // agrupa por CATEGORIA; mantendo a categoria antiga, a pessoa corrigia
  // "Tecnico" para "Técnico" e o relatório continuava mostrando o errado.
  // Em produto, a categoria é do catálogo e não se mexe.
  const novaCategoria = isProduto ? grupo[0].categoria : novoNome;
  const campos = {
    tipo: grupo[0].tipo, produto_id: grupo[0].produtoId || null, nome_produto: novoNome,
    quantidade_g: somaQtd > 0 ? somaQtd : null, valor: novoValor,
    categoria: novaCategoria, data: grupo[0].data, observacao: null, ciclo_id: cicloIdGrupo,
  };

  // ORDEM: primeiro ATUALIZA um dos lançamentos, depois apaga os irmãos.
  // Antes era o contrário — apagava o grupo inteiro e só então gravava o
  // consolidado. Se a segunda chamada falhasse (internet caindo no meio, erro
  // do banco), o custo simplesmente sumia, e a pessoa via "Erro ao salvar" sem
  // saber que já tinha perdido o lançamento. Nesta ordem, falha na primeira não
  // muda nada; falha na segunda deixa uma repetição visível, que dá para
  // corrigir. Perder é pior que repetir.
  const principal = ids[0];
  const irmaos = ids.slice(1);

  const up = await supabaseClient.from("custos")
    .update(campos).eq("id", principal).eq("user_id", usuario.id);
  if (up.error) { restaurar(); erro("Erro ao salvar: " + up.error.message); return; }

  if (irmaos.length) {
    const del = await supabaseClient.from("custos")
      .delete().in("id", irmaos).eq("user_id", usuario.id);
    if (del.error) {
      restaurar();
      _toastErro("Salvou, mas sobraram lançamentos repetidos. Recarregue e confira.");
      return;
    }
  }

  v.custos = (v.custos || []).filter(c => !irmaos.includes(c.id));
  const alvo = v.custos.find(c => c.id === principal);
  if (alvo) Object.assign(alvo, {
    tipo: campos.tipo, produtoId: campos.produto_id, nomeProduto: novoNome,
    quantidadeG: campos.quantidade_g, valor: novoValor, categoria: novaCategoria,
    data: campos.data, observacao: null, cicloId: cicloIdGrupo,
  });
  _toastSucesso("Custo atualizado!");
  renderizarHistoricoCustos(index, elementoId, direto);
  restaurarScroll();
}

function confirmarExcluirGrupoCusto(index, gi, chaveEnc, elementoId, direto) {
  const row = document.getElementById(`cg-${index}-${gi}`);
  if (!row) return;
  row.style.flexWrap = "wrap";
  row.innerHTML = `<div class="custo-grupo-conf">
    <span>Excluir todos os lançamentos deste item?</span>
    <div class="custo-grupo-conf-btns">
      <button class="ciclo-btn-relatorio" onclick="renderizarHistoricoCustos(${index},'${elementoId}',${_dArg(direto)})">Cancelar</button>
      <button class="ciclo-btn-excluir" onclick="excluirGrupoCusto(${index},'${chaveEnc}','${elementoId}',${_dArg(direto)},this)">Excluir</button>
    </div>
  </div>`;
}

async function excluirGrupoCusto(index, chaveEnc, elementoId, direto, botao) {
  if (_bloqueioViveiro(index)) return;
  if (botao?.disabled) return;
  const chave = decodeURIComponent(chaveEnc);
  const v = viveiros[index];
  if (_custosDoEscopo(v).filter(c => _chaveCusto(c) === chave).some(_ehCustoRacao)) {
    _toastErro("O custo de Ração é calculado dos lançamentos — exclua os lançamentos de ração.");
    return;
  }
  const restaurar = _travarBotao(botao, "Excluindo...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }
  const ids = _custosDoEscopo(v).filter(c => _chaveCusto(c) === chave).map(c => c.id).filter(Boolean);
  if (ids.length) {
    const { error } = await supabaseClient.from("custos").delete().in("id", ids).eq("user_id", usuario.id);
    if (error) { restaurar(); _toastErro("Erro ao excluir: " + error.message); return; }
  }
  v.custos = (v.custos || []).filter(c => !ids.includes(c.id));
  renderizarHistoricoCustos(index, elementoId, direto);
}

function abrirEdicaoCusto(viveiroIndex, custoIndex, elementoId, direto) {
  salvarScroll();
  const custo = viveiros[viveiroIndex].custos[custoIndex];
  if (_ehCustoRacao(custo)) {
    _toastErro("O custo de Ração é calculado dos lançamentos — edite os lançamentos de ração.");
    return;
  }
  const resultado = document.getElementById(elementoId);
  const acaoVoltar = `renderizarHistoricoCustos(${viveiroIndex},'${elementoId}',${_dArg(direto)}); restaurarScroll()`;

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
          <input type="text" id="nomeEdicaoCusto" value="${_attr(custo.nomeProduto)}" placeholder="Ex: Ração, Pós larva...">
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
        <button class="botao-salvar" onclick="_executarSalvamento(this, () => salvarEdicaoCusto(${viveiroIndex},${custoIndex},'${elementoId}',${_dArg(direto)}))">
          <svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:white;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Salvar
        </button>
        <div class="separador-ou"><span>ou</span></div>
        <button class="botao-voltar-form" onclick="${acaoVoltar}">Voltar</button>
      </div>
    </div>
  `;
}

async function salvarEdicaoCusto(viveiroIndex, custoIndex, elementoId, direto) {
  if (_bloqueioViveiro(viveiroIndex)) return;
  const botao = document.querySelector(".botao-salvar");
  if (botao?.disabled) return; // trava contra duplo toque
  const novaData = document.getElementById("dataEdicaoCusto").value;
  const novoNome = document.getElementById("nomeEdicaoCusto").value.trim();
  const novoValor = parseMoedaBR(document.getElementById("valorEdicaoCusto").value);
  const erroEditCusto = document.getElementById("msg-edit-custo-erro");
  const _erroEditCusto = (msg) => { if (erroEditCusto) { erroEditCusto.textContent = msg; erroEditCusto.style.display = "block"; } };
  if (erroEditCusto) erroEditCusto.style.display = "none";

  if (!novaData || !novoNome || isNaN(novoValor) || novoValor < 0) {
    _erroEditCusto("Preencha todos os campos corretamente.");
    return;
  }

  const restaurar = _travarBotao(botao, "Salvando...");
  const custo = viveiros[viveiroIndex].custos[custoIndex];
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const { error } = await supabaseClient.from("custos")
    .update({ data: novaData, nome_produto: novoNome, valor: novoValor, categoria: novoNome })
    .eq("id", custo.id).eq("user_id", usuario.id);

  restaurar();
  if (error) { _erroEditCusto("Erro ao salvar: " + error.message); return; }

  viveiros[viveiroIndex].custos[custoIndex].data = novaData;
  viveiros[viveiroIndex].custos[custoIndex].nomeProduto = novoNome;
  viveiros[viveiroIndex].custos[custoIndex].valor = novoValor;
  // O banco também recebe categoria: novoNome — sem isto a memória ficava com a
  // categoria antiga até o próximo recarregamento.
  viveiros[viveiroIndex].custos[custoIndex].categoria = novoNome;

  renderizarHistoricoCustos(viveiroIndex, elementoId, direto);
  restaurarScroll();
}

function imprimirCustos(viveiroIndex) {
  const viveiro = viveiros[viveiroIndex];
  const custos = _custosDoEscopo(viveiro);
  const _iniImp = viveiro.dataPreparacao || viveiro.dataPovoamento;
  const rateioFixo = _custoFixoRateado(_iniImp, _hojeLocal());
  const rateioItens = _custoFixoRateadoPorItem(_iniImp, _hojeLocal());
  const total = custos.reduce((s, c) => s + Number(c.valor), 0) + rateioFixo;

  // Agrupa por produto/nome (igual à tela): uma linha por item
  const grupos = {};
  custos.forEach(c => {
    const chave = _chaveCusto(c);
    if (!grupos[chave]) grupos[chave] = { nome: c.nomeProduto || c.categoria || "Custo", quantidadeG: 0, valor: 0 };
    else grupos[chave].nome = _melhorRotulo(grupos[chave].nome, c.nomeProduto || c.categoria || "Custo");
    grupos[chave].valor += Number(c.valor) || 0;
    if (c.quantidadeG) grupos[chave].quantidadeG += Number(c.quantidadeG);
  });
  const lista = Object.values(grupos).sort((a, b) => b.valor - a.valor);

  const linhas = lista.map(g => {
    const qtd = _fmtQtdCusto(g.quantidadeG);
    return `<tr><td>${_esc(g.nome)}</td><td>${qtd || "-"}</td><td>R$ ${formatarNumeroBR(g.valor, 2)}</td></tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Custos - ${_esc(viveiro.nome)}</title>
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
  <h1>Custos — ${_esc(viveiro.nome)}</h1>
  <table>
    <thead><tr><th>Descrição</th><th style="text-align:center">Quantidade</th><th>Valor</th></tr></thead>
    <tbody>
      ${linhas}
      ${rateioItens.map(it => `<tr><td>${_esc(it.nome)}</td><td>rateio</td><td>R$ ${formatarNumeroBR(it.valor, 2)}</td></tr>`).join("")}
      <tr class="total-row"><td colspan="2">TOTAL</td><td>R$ ${formatarNumeroBR(total, 2)}</td></tr>
    </tbody>
  </table>
  </body></html>`;

  _imprimirDoc(html);
}

function confirmarExcluirCusto(viveiroIndex, custoIndex, elementoId, direto) {
  const row = document.getElementById(`custo-row-${viveiroIndex}-${custoIndex}`);
  if (!row) return;
  row.innerHTML = `
    <div class="confirmar-exclusao-custo" style="grid-column:1/-1">
      <span>Excluir este custo?</span>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="ciclo-btn-excluir" style="flex:1" onclick="excluirCusto(${viveiroIndex},${custoIndex},'${elementoId}',${_dArg(direto)},this)">Sim, excluir</button>
        <button class="ciclo-btn-relatorio" style="flex:1" onclick="renderizarHistoricoCustos(${viveiroIndex},'${elementoId}',${_dArg(direto)})">Cancelar</button>
      </div>
    </div>
  `;
}

async function excluirCusto(viveiroIndex, custoIndex, elementoId, direto, botao) {
  if (_bloqueioViveiro(viveiroIndex)) return;
  if (botao?.disabled) return;
  const restaurar = _travarBotao(botao, "Excluindo...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }
  const custo = viveiros[viveiroIndex].custos[custoIndex];
  const { error } = await supabaseClient.from("custos").delete().eq("id", custo.id).eq("user_id", usuario.id);
  if (error) { restaurar(); _toastErro("Erro ao excluir: " + error.message); return; }
  viveiros[viveiroIndex].custos.splice(custoIndex, 1);
  renderizarHistoricoCustos(viveiroIndex, elementoId, direto);
}


// ═══ CARREGAMENTO DE DADOS ═════════════════════════════════════════════════════

// usuarioConhecido: na abertura do app a sessão já traz o usuário, então não
// há por que pedi-lo de novo ao servidor só para montar as consultas.
async function carregarViveiros(usuarioConhecido) {
  const usuario = usuarioConhecido || await pegarUsuarioLogado();

  if (!usuario) return;

  // As 11 consultas abaixo filtram só por user_id — nenhuma depende do resultado
  // da outra. Em série, cada uma esperava a ida e volta da anterior: num celular
  // no campo eram ~11 viagens de rede antes de a tela aparecer. Disparando todas
  // juntas, o tempo passa a ser o da mais lenta, não a soma de todas.
  const tabela = (nome) => supabaseClient.from(nome).select("*").eq("user_id", usuario.id);
  const [
    rViveiros, rRacoes, rBiometrias, rDespescas, rCiclos,
    rProdutos, rTiposRacao, rBoletos, rCustosFixos, rAssinatura, rCustos, rContato,
  ] = await Promise.all([
    tabela("viveiros").eq("ativo", true).order("nome", { ascending: true }),
    tabela("racoes"),
    tabela("biometrias"),
    tabela("despescas"),
    // Colunas explícitas: de fora ficam biometrias_json, racoes_json e
    // despescas_json — o histórico de cada ciclo encerrado. Com "*" eles vinham
    // em toda abertura do app (146 KB já com 10 ciclos, ~1 MB com 60) para uma
    // tela que quase nunca se abre. Agora chegam quando o relatório é aberto.
    supabaseClient.from("ciclos").select(
      "id, viveiro_id, nome_viveiro, laboratorio, tamanho, total_povoado, data_povoamento," +
      " data_encerramento, dias_cultivo, producao_final, despesca_parcial, produtividade," +
      " producao_total, peso_final, racao_consumida, fca, sobrevivencia, observacoes," +
      " preco_venda, data_preparacao, ciclo_id, custo_fixo_rateado"
    ).eq("user_id", usuario.id),
    tabela("produtos"),
    tabela("tipos_racao"),
    tabela("boletos").eq("ativo", true),
    tabela("custos_fixos"),
    tabela("assinaturas").maybeSingle(),
    tabela("custos"),
    tabela("contatos").maybeSingle(),
  ]);

  // Rede de segurança da consulta acima: nomear colunas é mais leve, mas se uma
  // delas não existir no banco a consulta INTEIRA falha — e ciclos é essencial,
  // ou seja, o app não abriria. Nesse caso volta ao "*", que ignora o que falta.
  let rCiclosOk = rCiclos;
  if (rCiclos.error) {
    console.log("ciclos por coluna falhou, tentando completo:", rCiclos.error);
    rCiclosOk = await tabela("ciclos");
  }

  // Tabelas essenciais: sem elas a tela mentiria, então aborta com aviso.
  const essenciais = [
    [rViveiros, "viveiros"], [rRacoes, "rações"], [rBiometrias, "biometrias"],
    [rDespescas, "despescas"], [rCiclosOk, "ciclos"],
  ];
  for (const [r, rotulo] of essenciais) {
    // return false: sinaliza falha para o init NÃO sobrescrever o aviso de erro
    // com uma lista vazia ("Nenhum viveiro cadastrado"), que faria o usuário
    // pensar que perdeu os dados numa simples oscilação de internet.
    if (r.error) { console.log(r.error); _erroCarregamento(`Erro ao carregar ${rotulo}.`); return false; }
  }
  const viveirosData = rViveiros.data || [];

  // Tabelas acessórias: seguem graciosas se ainda não existirem no banco.
  if (!rProdutos.error && rProdutos.data) {
    produtos = rProdutos.data.map(p => {
      const pesoKg = Number(p.peso_kg);
      const valorPago = Number(p.valor_pago);
      // Recalcula o custo/grama a partir do peso e do valor ORIGINAIS (guardados
      // com precisão), em vez de confiar no custo_por_grama gravado. Num insumo
      // barato e pesado (arroz R$ 100 / 30 kg = 0,00333.../g), o valor derivado
      // volta do banco arredondado e, ao multiplicar pelo saco (×30.000), não
      // fechava os R$ 100 — dava "quebrado". Do peso e valor a conta fecha certa.
      const custoPorGrama = pesoKg > 0 ? valorPago / (pesoKg * 1000) : (Number(p.custo_por_grama) || 0);
      return { id: p.id, nome: p.nome, categoria: p.categoria, pesoKg, valorPago, custoPorGrama };
    });
  }
  if (rTiposRacao.data) {
    tiposRacao = rTiposRacao.data.map(t => {
      const pesoSacoKg = Number(t.peso_saco_kg);
      const valorSaco = Number(t.valor_saco);
      // Mesmo motivo do produto: recalcula o custo/kg do saco a partir do peso e
      // valor originais, sem depender do custo_por_kg gravado (que pode arredondar).
      const custoPorKg = pesoSacoKg > 0 ? valorSaco / pesoSacoKg : (Number(t.custo_por_kg) || 0);
      return { id: t.id, nome: t.nome, pesoSacoKg, valorSaco, custoPorKg };
    });
  }
  boletos = (rBoletos.data || []).map(b => ({
    id: b.id,
    nome: b.nome,
    fornecedor: b.fornecedor,
    dataCompra: b.data_compra,
    prazoDias: Number(b.prazo_dias),
    valor: b.valor ? Number(b.valor) : null,
    pago: !!b.pago,
    dataPagamento: b.data_pagamento || null,
    valorPago: b.valor_pago ? Number(b.valor_pago) : 0,
    pagamentos: Array.isArray(b.pagamentos) ? b.pagamentos : [],
  }));
  // Guarda se a consulta REALMENTE trouxe os custos fixos. Se falhou (rede,
  // permissão), custosFixos fica vazio — e não podemos deixar o congelamento
  // gravar rateio 0 nos ciclos antigos com base nesse vazio falso (auditoria #2).
  _custosFixosOk = !rCustosFixos.error;
  custosFixos = (rCustosFixos.data || []).map(c => ({
    id: c.id,
    nome: c.nome,
    categoria: c.categoria || "outro",
    valorMensal: Number(c.valor_mensal),
    dataInicio: c.data_inicio || null,
    ativo: c.ativo !== false,
    dataFim: c.data_fim || null,
  }));
  // Assinatura é a mais sensível das acessórias: se a consulta FALHA e a gente
  // engolir o erro virando null, o app trataria um cliente PAGANTE como "grátis"
  // e o deixaria só de leitura — punindo quem paga por uma oscilação de internet.
  // Com maybeSingle(), "não tem assinatura" volta data:null SEM erro; só um erro
  // de verdade (rede, permissão) preenche .error. A única falha que seguimos
  // ignorando é a tabela ainda não existir no banco (42P01) — aí "grátis" é o
  // certo. Qualquer outro erro aborta com aviso, como as tabelas essenciais.
  if (rAssinatura.error && rAssinatura.error.code !== "42P01") {
    console.log(rAssinatura.error);
    _erroCarregamento("Erro ao carregar sua assinatura.");
    return false;
  }
  assinatura = rAssinatura.data || null;
  // Tabela nova: se ainda nao existir no banco do usuario, segue sem quebrar.
  contato = (rContato && !rContato.error) ? (rContato.data || null) : null;

  const racoesData = rRacoes.data || [];
  const biometriasData = rBiometrias.data || [];
  const despescasData = rDespescas.data || [];
  const ciclosData = rCiclosOk.data || [];
  const custosArr = rCustos.data || [];

  viveiros = viveirosData.map((item) => ({
    id: item.id,
    nome: item.nome,
    dataPovoamento: item.data_povoamento,
    dataPreparacao: item.data_preparacao || null,
    totalPovoado: item.total_povoado,
    tamanho: _tamanhoHa(item.tamanho),
    laboratorio: item.laboratorio,
    cicloId: item.ciclo_id || null,

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
        precoKg: despesca.preco_kg != null ? Number(despesca.preco_kg) : null,
      })),

    ciclosFinalizados: ciclosData
      .filter((ciclo) => ciclo.viveiro_id === item.id)
      .map((ciclo) => ({
        id: ciclo.id,
        nomeViveiro: ciclo.nome_viveiro,
        laboratorio: ciclo.laboratorio,
        tamanho: _tamanhoHa(ciclo.tamanho),
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
        precoVenda: ciclo.preco_venda ? Number(ciclo.preco_venda) : 0,
        dataPreparacao: ciclo.data_preparacao || null,
        observacoes: ciclo.observacoes,
        cicloId: ciclo.ciclo_id || null,
        custoFixoRateado: ciclo.custo_fixo_rateado != null ? Number(ciclo.custo_fixo_rateado) : null,
        // O histórico (biometrias, rações, despescas) NÃO vem na abertura do
        // app: são ~96% do peso desta tabela e só servem numa tela, a do
        // relatório daquele ciclo. Chega sob demanda em _carregarHistoricoCiclo.
        biometrias: [], racoes: [], despescas: [],
        historicoCarregado: false,
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
        cicloId: c.ciclo_id || null,
      })),

    protocolos: Array.isArray(item.protocolos) ? item.protocolos : [],
  }));

  viveiros.sort(_compararViveirosPorNome);

  // Monta o custo de Ração derivado (preço do catálogo × kg lançados no ciclo)
  _montarCustoRacaoVirtual();

  console.log("Viveiros carregados:", viveiros);
}


// Garante que todo viveiro ATIVO antigo (sem ciclo_id) receba um identificador,
// de forma idempotente e segura contra concorrência. Não toca em ciclos
// históricos encerrados nem no fallback por data.
// Congela, uma única vez, o rateio de custos fixos dos ciclos encerrados que
// ainda não têm o valor gravado. Sem isso, esses relatórios continuariam sendo
// recalculados com os custos fixos de hoje e mudariam a cada alteração de
// salário ou desativação de funcionário.
// O valor gravado é o que o sistema calcula AGORA — é uma fotografia, não a
// reconstrução do que valia na época (esse dado nunca foi guardado). Vale
// porque interrompe a variação; quanto mais cedo roda, mais fiel fica.
// Idempotente: só grava onde ainda está vazio, e só se o UPDATE realmente pegar.
async function _congelarRateioCiclosAntigos() {
  // Se os custos fixos não carregaram (erro de rede/permissão), custosFixos está
  // vazio por FALHA, não porque não existem. Congelar agora gravaria rateio 0
  // para sempre nesses ciclos e a rotina nunca mais os recalcularia. Aborta.
  if (!_custosFixosOk) return;
  const pendentes = [];
  for (const v of viveiros) {
    for (const c of (v.ciclosFinalizados || [])) {
      if (c.id && (c.custoFixoRateado === null || c.custoFixoRateado === undefined)) pendentes.push(c);
    }
  }
  if (!pendentes.length) return; // nada a migrar
  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  for (const c of pendentes) {
    const ini = c.dataPreparacao || c.dataPovoamento;
    if (!ini || !c.dataEncerramento) continue;
    const valor = _custoFixoRateado(ini, c.dataEncerramento);
    const { data, error } = await supabaseClient.from("ciclos")
      .update({ custo_fixo_rateado: valor })
      .eq("id", c.id).eq("user_id", usuario.id)
      .is("custo_fixo_rateado", null)   // não sobrescreve o que outro aparelho já congelou
      .select("custo_fixo_rateado");
    if (error) {
      // Coluna ainda não existe no banco deste usuário: para de tentar.
      if (/custo_fixo_rateado/.test(error.message || "")) return;
      console.log("congelar rateio:", error);
      continue;
    }
    if (data && data.length) c.custoFixoRateado = Number(data[0].custo_fixo_rateado);
  }
}

async function _garantirCicloIdViveirosAtivos() {
  const semId = viveiros.filter(v => !v.cicloId);
  if (!semId.length) return; // nada a migrar — idempotente

  const usuario = await pegarUsuarioLogado();
  if (!usuario) return;

  for (const v of semId) {
    if (v.cicloId) continue; // já preenchido nesta execução
    const novo = _novoCicloId();
    // UPDATE condicional: só grava se ainda estiver null. Se outra aba/dispositivo
    // preencher primeiro, o filtro não casa e retornamos vazio (sem sobrescrever).
    const { data, error } = await supabaseClient
      .from("viveiros")
      .update({ ciclo_id: novo })
      .eq("id", v.id)
      .eq("user_id", usuario.id)
      .is("ciclo_id", null)
      .select("ciclo_id");

    if (error) { console.log("ciclo_id backfill:", error); continue; }

    if (data && data.length && data[0].ciclo_id) {
      // Fonte de verdade = o valor efetivamente persistido no banco
      v.cicloId = data[0].ciclo_id;
    } else {
      // Ninguém foi atualizado (outro cliente venceu a corrida): relê o valor atual
      const { data: atual } = await supabaseClient
        .from("viveiros").select("ciclo_id").eq("id", v.id).eq("user_id", usuario.id).maybeSingle();
      if (atual && atual.ciclo_id) v.cicloId = atual.ciclo_id;
    }
  }
}

// ═══ INICIALIZAÇÃO ═════════════════════════════════════════════════════════════

// Esconde a tela de abertura (splash) com um fade e a remove. Só é chamada
// quando o app já está pronto na tela — enquanto carrega, a splash cobre a
// tela branca. Em caso de redirecionamento pro login, NÃO escondemos: a splash
// do login assume, e a entrada fica contínua.
function _esconderSplash() {
  const s = document.getElementById("splash-wa");
  if (!s) return;
  s.classList.add("sumindo");
  setTimeout(() => s.remove(), 500); // depois do fade (.45s no CSS)
}

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
          <svg class="spin-svg" viewBox="0 0 24 24" style="width:32px;height:32px;stroke:#d1d5db;fill:none;stroke-width:2;margin-bottom:12px;display:block;margin-inline:auto"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <p style="margin:0;font-size:14px">Carregando...</p>
        </div>
      `;
      const carregouOk = await carregarViveiros(session.user);
      if (carregouOk === false) {
        // Carregamento essencial falhou: carregarViveiros já desenhou o aviso
        // de erro + botão Recarregar. Revela ele (tira a splash) e PARA — não
        // segue pro render, que apagaria o aviso e mostraria lista vazia.
        _esconderSplash();
        return;
      }

      // O avatar sai da sessão que já temos em mãos — pedir o usuário de novo
      // ao servidor era mais uma ida e volta só para desenhar um círculo.
      const user = session.user;
      if (user) {
        const fotoUrl = user.user_metadata?.avatar_url;
        const nome = user.user_metadata?.nome || user.email?.split("@")[0] || "?";
        const avatarTopo = document.getElementById("avatar-topo");
        if (fotoUrl) {
          avatarTopo.innerHTML = `<img src="${_attr(fotoUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        } else {
          const iniciais = nome.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
          avatarTopo.innerHTML = `<span class="avatar-topo-iniciais">${_esc(iniciais || "?")}</span>`;
        }
      }

      // Manutenção (migração de ciclo_id e lançamentos automáticos em atraso)
      // não precisa segurar a tela: roda depois que o app já está utilizável.
      // Os dois gravam direto na memória, então a próxima tela aberta já vê o
      // resultado — o que eles não podem é atrasar a entrada do usuário.
      setTimeout(async () => {
        try { await _garantirCicloIdViveirosAtivos(); } catch (e) { console.log("ciclo_id backfill:", e); }
        try { await _congelarRateioCiclosAntigos(); } catch (e) { console.log("congelar rateio:", e); }
        try { await aplicarProtocolosSemanais(); } catch (e) { console.log("Protocolos:", e); }
      }, 0);

      verificarBoletosVencendo();
      _armarVerificacaoDeVersao();
      _registrarAcesso(session.user);
      if (window.innerWidth >= 900) {
        mostrarListaViveiros();
      } else {
        document.getElementById("area-gestao").innerHTML = "";
        document.getElementById("menuGestao").style.display = "grid";
        _mostrarBannerLeitura();
      }
      _talvezPedirContato();
      _esconderSplash();   // app pronto na tela: tira a abertura
    } else {
      window.location.replace("login.html"); // splash fica até o login assumir
    }
  } catch (error) {
    console.log("Erro na inicialização:", error);
    window.location.replace("login.html");
  }
});


// ─── NOME E TELEFONE DO CLIENTE ────────────────────────────────────────────────
// Por que existe: a conta é criada só com e-mail, e e-mail é um canal ruim para
// falar com produtor. Com o telefone dá para perguntar como o sistema está indo
// e resolver problema antes de virar cancelamento.
//
// Mora numa tabela PRÓPRIA (contatos), e não em "perfis", de propósito: perfis
// guarda a coluna "role" e não tem política de escrita nenhuma. Se a gente
// liberasse UPDATE ali para o cliente salvar o telefone, ele salvaria o cargo
// de administrador no mesmo comando.

const _CONTATO_DIAS = 3;   // quantos dias esperar depois de um "X" antes de perguntar de novo

function _contatoCompleto() {
  return !!(contato && String(contato.nome || "").trim() && String(contato.telefone || "").trim());
}

// Já pediu recentemente? Guarda no banco e não no aparelho: no celular o
// armazenamento local se perde ao limpar dados, e aí o pedido recomeçaria do
// zero — justamente com quem já disse não.
function _contatoPodePedir() {
  if (_contatoCompleto()) return false;
  if (!contato || !contato.visto_em) return true;
  const visto = new Date(contato.visto_em);
  if (isNaN(visto.getTime())) return true;
  return (Date.now() - visto.getTime()) >= _CONTATO_DIAS * 86400000;
}

// (88) 99249-8067 — formata enquanto digita, e aceita colar com ou sem máscara.
function _mascaraTelefone(valor) {
  const d = String(valor || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2)  return d.length ? "(" + d : "";
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function _telefoneNoCampo(campo) {
  campo.value = _mascaraTelefone(campo.value);
}

function _abrirPedidoContato() {
  if (document.getElementById("ct-fundo")) return;   // já está aberto

  const div = document.createElement("div");
  div.id = "ct-fundo";
  div.className = "ct-fundo";
  div.innerHTML = `
    <div class="ct-caixa" role="dialog" aria-labelledby="ct-titulo">
      <button class="ct-fechar" onclick="_recusarContato()" aria-label="Fechar">&times;</button>

      <div class="ct-ico">
        <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>

      <h4 id="ct-titulo">Complete seu cadastro</h4>

      <div class="campo-form">
        <div class="campo-label"><label>Seu nome completo</label></div>
        <input type="text" id="ctNome" autocomplete="name" placeholder="Ex: João da Silva"
               value="${(contato && contato.nome) ? String(contato.nome).replace(/"/g, "&quot;") : ""}">
      </div>

      <div class="campo-form">
        <div class="campo-label"><label>WhatsApp com DDD</label></div>
        <input type="tel" id="ctTelefone" inputmode="numeric" autocomplete="tel"
               placeholder="(88) 99999-9999" maxlength="16"
               oninput="_telefoneNoCampo(this)"
               value="${(contato && contato.telefone) ? _mascaraTelefone(contato.telefone) : ""}">
      </div>

      <div id="ct-erro" class="ct-erro" style="display:none"></div>

      <button class="botao-salvar" style="margin-top:4px" onclick="_salvarContato(this)">Salvar</button>

      <a class="ct-privacidade" href="/privacidade.html" target="_blank" rel="noopener">Privacidade</a>
    </div>`;
  document.body.appendChild(div);
  setTimeout(() => document.getElementById("ctNome")?.focus(), 120);
}

function _fecharPedidoContato() {
  document.getElementById("ct-fundo")?.remove();
}

// O "X". Marca a data para só voltar a perguntar daqui a _CONTATO_DIAS, e conta
// a recusa — número de recusas é sinal de cliente incomodado, e vale olhar.
async function _recusarContato() {
  _fecharPedidoContato();
  try {
    const usuario = await pegarUsuarioLogado();
    if (!usuario) return;
    const linha = {
      user_id: usuario.id,
      visto_em: new Date().toISOString(),
      recusas: ((contato && Number(contato.recusas)) || 0) + 1,
    };
    const { error } = await supabaseClient.from("contatos").upsert(linha, { onConflict: "user_id" });
    if (error) { console.log("contato (recusa):", error); return; }
    contato = { ...(contato || {}), ...linha };
  } catch (e) { console.log("contato (recusa):", e); }
}

async function _salvarContato(botao) {
  if (botao?.disabled) return;                       // trava contra duplo toque

  const nome = document.getElementById("ctNome").value.trim();
  const telBruto = document.getElementById("ctTelefone").value;
  const digitos = telBruto.replace(/\D/g, "");

  const erroEl = document.getElementById("ct-erro");
  const erro = (m) => { if (erroEl) { erroEl.textContent = m; erroEl.style.display = "block"; } };
  if (erroEl) erroEl.style.display = "none";

  if (nome.length < 3) { erro("Escreva seu nome completo."); return; }
  // 10 dígitos = fixo com DDD, 11 = celular com o 9 na frente.
  if (digitos.length < 10 || digitos.length > 11) { erro("Telefone incompleto. Use DDD + número."); return; }

  const restaurar = _travarBotao(botao, "Salvando...");
  const usuario = await pegarUsuarioLogado();
  if (!usuario) { restaurar(); return; }

  const linha = {
    user_id: usuario.id,
    nome: nome,
    telefone: digitos,                                // guarda só números: facilita buscar e montar link de WhatsApp
    visto_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };

  const { error } = await supabaseClient.from("contatos").upsert(linha, { onConflict: "user_id" });
  if (error) { console.log(error); restaurar(); erro("Erro ao salvar: " + error.message); return; }

  contato = { ...(contato || {}), ...linha };
  _fecharPedidoContato();
  _toastSucesso("Cadastro salvo. Obrigado!");
}

// ─── REGISTRO DO ÚLTIMO ACESSO ─────────────────────────────────────────────────
// Por que existe: o painel admin mostrava "último acesso" vindo do
// last_sign_in_at do Supabase, que só muda quando a pessoa DIGITA a senha de
// novo. Mas o app guarda a sessão — o cliente abre todo dia e nunca refaz
// login, então o número congelava no último login manual (dava "14 dias" para
// quem usou hoje). Aqui gravamos um "visto agora" a cada abertura, numa tabela
// própria (acessos), e o painel passa a usar o mais recente dos dois.
//
// Throttle: não adianta gravar a cada recarregar de tela. Se o último registro
// local for de menos de 15 min atrás, não grava de novo — 15 min de resolução
// já é de sobra para "está usando hoje" contra "sumiu faz semanas", e poupa
// escrita no banco.
const _ACESSO_INTERVALO_MIN = 15;

async function _registrarAcesso(usuario) {
  try {
    if (!usuario) return;
    const agora = Date.now();
    // localStorage só como freio de escrita — se falhar (aba privada), grava
    // mesmo assim; o dado no banco é o que importa, o local é só otimização.
    try {
      const ultimo = Number(localStorage.getItem("wa_acesso_ts") || 0);
      if (agora - ultimo < _ACESSO_INTERVALO_MIN * 60000) return;
    } catch (e) {}

    const { error } = await supabaseClient
      .from("acessos")
      .upsert({ user_id: usuario.id, ultimo_acesso: new Date(agora).toISOString() },
              { onConflict: "user_id" });
    if (error) { console.log("registrar acesso:", error.message); return; }

    try { localStorage.setItem("wa_acesso_ts", String(agora)); } catch (e) {}
  } catch (e) { console.log("registrar acesso:", e); }
}

// Chamado na abertura, depois de a tela já estar utilizável.
function _talvezPedirContato() {
  if (!_contatoPodePedir()) return;
  setTimeout(_abrirPedidoContato, 900);   // deixa o app desenhar antes
}

// Mesmo formulário, agora dentro de Configurações — para quem fechou no X e
// depois resolveu preencher, e para quem quiser corrigir o número.
function abrirMeusDados() {
  _abrirPedidoContato();
}


// Feedback de toque: onda de brilho (ripple) saindo do ponto tocado.
// Delegado no documento (captura) para valer também em botões criados dinamicamente.
(function () {
  function criarRipple(e) {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    const rect = btn.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const size = Math.max(rect.width, rect.height);
    const x = (e.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2;
    const y = (e.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2;
    if (getComputedStyle(btn).position === "static") btn.style.position = "relative";
    btn.style.overflow = "hidden";
    const ripple = document.createElement("span");
    ripple.className = "btn-ripple";
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    btn.appendChild(ripple);
    // Remove por tempo fixo (roda mesmo se o botão for escondido antes de a
    // animação acabar) — evita a luzinha "pendurada" que rejogava ao reexibir.
    setTimeout(() => ripple.remove(), 550);
  }
  document.addEventListener("pointerdown", criarRipple, true);
})();

// Voltar do celular (Android) / gesto de voltar: aciona o "Voltar" da tela atual.
window.addEventListener("popstate", function () {
  const btn = _voltarBotaoVisivel();
  if (!btn) return;                 // na raiz (menu): deixa o app sair normalmente
  btn.click();                      // volta uma tela — mesma ação do botão Voltar
  if (_voltarBotaoVisivel()) _armarVoltarNavegador(); // ainda em subtela segue protegendo
});

/* ═══ AVISO DE VERSÃO NOVA ═══════════════════════════════════════════════════

   O PROBLEMA QUE ISTO RESOLVE:
   todo arquivo do sistema carrega "?v=" no endereço, e trocar esse número
   obriga o aparelho a baixar de novo. Menos UM: o index.html, que não tem como
   ter versão — é ele que ABRE o app. E é justamente ele que aponta para
   "script.js?v=...". Enquanto o aparelho segura o index.html velho, ele
   continua pedindo o script velho, por mais que a gente publique. O resultado
   é a atualização demorar e ninguém saber quanto.

   COMO ISTO FUNCIONA:
   o app pergunta ao servidor "qual é o index.html de agora?" — com
   cache: "no-store" e um número aleatório no endereço, que furam tanto o cache
   do aparelho quanto o do GitHub. Da resposta ele tira o "?v=" e compara com o
   que está rodando. Se for diferente, houve publicação nova.

   POR QUE NÃO USAR UM ARQUIVO DE VERSÃO SEPARADO:
   seria mais um lugar para lembrar de atualizar a cada deploy, e o dia em que
   esquecêssemos, o aviso mentiria — ou pior, deixaria de aparecer. Lendo o
   próprio index.html, a fonte da verdade é a mesma que o navegador usa.
═════════════════════════════════════════════════════════════════════════════ */

// Versão que está rodando AGORA, lida da própria tag <script> desta página.
const _VERSAO_RODANDO = (() => {
  const tag = document.querySelector('script[src*="script.js"]');
  const m = tag && tag.getAttribute("src").match(/[?&]v=([^&"']+)/);
  return m ? m[1] : "";
})();

let _versaoNovaVista = "";   // já avisei sobre esta; não repete o aviso
let _checandoVersao = false;

async function _versaoNoServidor() {
  // O número aleatório é contra o cache do GitHub Pages, que ignora o
  // no-store do navegador: sem ele, a pergunta poderia ser respondida com a
  // mesma página velha que queremos descobrir que envelheceu.
  const url = "index.html?cb=" + Date.now() + "-" + Math.floor(Math.random() * 1e6);
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const html = await r.text();
  const m = html.match(/script\.js\?v=([^"']+)/);
  return m ? m[1] : "";
}

async function verificarAtualizacao(manual) {
  if (_checandoVersao) return null;
  if (!_VERSAO_RODANDO) return null;      // sem saber a versão local, não há o que comparar
  _checandoVersao = true;
  try {
    const noAr = await _versaoNoServidor();
    if (noAr && noAr !== _VERSAO_RODANDO) {
      if (manual || noAr !== _versaoNovaVista) {
        _versaoNovaVista = noAr;
        _mostrarBarraAtualizacao();
      }
      return noAr;
    }
    return false;
  } catch (e) {
    // Sem internet ou servidor fora: silêncio. Um aviso de erro aqui só
    // assustaria quem está no meio de um lançamento, sem nada para fazer.
    return null;
  } finally {
    _checandoVersao = false;
  }
}

function _mostrarBarraAtualizacao() {
  if (document.getElementById("barra-atualizacao")) return;
  const div = document.createElement("div");
  div.id = "barra-atualizacao";
  div.className = "atz-barra";
  div.innerHTML = `
    <div class="atz-texto">
      <strong>Nova versão disponível</strong>
      <span>Toque para carregar as novidades</span>
    </div>
    <button class="atz-botao" onclick="atualizarApp(this)">Atualizar</button>
    <button class="atz-fechar" onclick="document.getElementById('barra-atualizacao').remove()" aria-label="Agora não">×</button>
  `;
  document.body.appendChild(div);
}

// Limpa tudo o que pode estar segurando arquivo velho e recarrega.
async function atualizarApp(botao) {
  if (botao) { botao.disabled = true; botao.textContent = "Atualizando..."; }

  // 1) O que o service worker guardou.
  try {
    const nomes = await caches.keys();
    await Promise.all(nomes.map(n => caches.delete(n)));
  } catch (e) { /* navegador sem cache API */ }

  // 2) Manda o service worker buscar a versão nova dele mesmo. update(), e não
  //    unregister(): desregistrar tiraria o "Instalar" e o funcionamento sem
  //    internet, que são coisas que a gente quer manter.
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.update()));
  } catch (e) { /* navegador sem service worker */ }

  // 3) Recarrega com endereço diferente. Um reload comum pode ser respondido
  //    pelo mesmo index.html guardado — e aí nada mudaria. Endereço novo, o
  //    navegador é obrigado a ir buscar.
  const base = window.location.pathname;
  window.location.replace(base + "?atz=" + Date.now());
}

// Quando conferir:
//  - uns segundos depois de abrir, para não atrasar a entrada;
//  - toda vez que o app volta para a frente (é quando a pessoa vai usar);
//  - de hora em hora, para quem deixa aberto o dia todo.
function _armarVerificacaoDeVersao() {
  setTimeout(() => verificarAtualizacao(false), 4000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) verificarAtualizacao(false);
  });
  setInterval(() => verificarAtualizacao(false), 60 * 60 * 1000);
}

// Botão "Buscar atualização" das Configurações: aqui o silêncio não serve,
// porque a pessoa pediu e está esperando uma resposta.
async function buscarAtualizacaoManual(botao) {
  if (botao?.disabled) return;
  const antes = botao ? botao.innerHTML : "";
  if (botao) { botao.disabled = true; botao.querySelector(".cfg-item-sub").textContent = "Procurando..."; }
  const r = await verificarAtualizacao(true);
  if (botao) { botao.disabled = false; botao.innerHTML = antes; }
  if (r === false) _toastSucesso("Você já está na versão mais recente.");
  else if (r === null) _toastErro("Não consegui verificar. Veja sua conexão.");
}
