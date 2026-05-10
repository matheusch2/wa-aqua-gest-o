let viveiros = [];

function formatarNumeroBR(valor, casas = 0) {
    return valor.toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
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

function salvarViveiro() {
    const nome = document.getElementById("nomeViveiro").value;
    const data = document.getElementById("dataPovoamento").value;
    const total = document.getElementById("totalPovoadoGestao").value;
    const tamanho = document.getElementById("tamanhoViveiro").value;
    const laboratorio = document.getElementById("laboratorio").value;

    if (!nome || !data || !total || !tamanho || !laboratorio) {
        document.getElementById("area-gestao").innerHTML += "<p>Preencha todos os campos.</p>";
        return;
    }

    viveiros.push({
        nome: nome,
        dataPovoamento: data,
        totalPovoado: total,
        tamanho: tamanho,
        laboratorio: laboratorio,
        racoes: [],
        biometrias: []
    });

    const index = viveiros.length - 1;

    document.getElementById("area-gestao").innerHTML = `
        <div class="viveiro-card">
            <div class="viveiro-topo">
                <h3>${nome}</h3>
                <span>${total} PLs</span>
            </div>

            <div class="viveiro-info">
                <p>Povoamento: ${formatarData(data)}</p>
                <p>Laboratório: ${laboratorio}</p>
                <p>Tamanho: ${tamanho} ha</p>
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

    area.innerHTML = viveiros.map((viveiro, index) => `
        <div class="viveiro-card">
            <div class="viveiro-topo">
                <h3>${viveiro.nome}</h3>
                <span>${viveiro.totalPovoado || "--"} PLs</span>
            </div>

            <div class="viveiro-info">
                <p>Povoamento: ${formatarData(viveiro.dataPovoamento)}</p>
                <p>Laboratório: ${viveiro.laboratorio || "--"}</p>
                <p>Tamanho: ${viveiro.tamanho || "--"} ha</p>
            </div>

            <button class="botao-abrir" onclick="abrirViveiro(${index})">
                Abrir viveiro
            </button>
        </div>
    `).join("");
}

function abrirViveiro(index) {
    const viveiro = viveiros[index];
    const area = document.getElementById("area-gestao");

    const diasCultivo = calcularDiasCultivo(viveiro.dataPovoamento);

    const racoes = viveiro.racoes || [];
    const biometrias = viveiro.biometrias || [];

    const totalRacao = racoes.reduce((total, item) => total + item.racao, 0);

    const ultimaBiometria = biometrias.length > 0
        ? biometrias[biometrias.length - 1].gramatura
        : "--";

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

                 <button class="botao-painel" onclick="abrirEncerrarCiclo(${index})">
                    Encerrar ciclo
                </button>

                <button class="botao-painel" onclick="reiniciarCiclo(${index})">
                    Reiniciar ciclo
                </button>

                <button class="botao-painel" onclick="excluirViveiro(${index})">
                    Excluir viveiro
                </button>
            </div>
        </div>
    `;
}

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

    area.innerHTML = `
        <label>Selecione o viveiro</label>
        <select id="viveiroRacao">
            ${viveiros.map((viveiro, index) => `
                <option value="${index}" ${String(index) === String(indexSelecionado) ? "selected" : ""}>
                    ${viveiro.nome}
                </option>
            `).join("")}
        </select>

        <label>Data</label>
        <input type="date" id="dataRacao" value="${new Date().toISOString().split("T")[0]}">

        <label>Consumo de ração</label>
        <div class="input-unidade">
            <input type="number" id="consumoRacao" placeholder="Ex: 50">
            <span>kg</span>
        </div>

        <button class="botao-gestao" onclick="salvarLancamentoRacao()">
            Salvar lançamento
        </button>
    `;
}

function salvarLancamentoRacao() {
    const index = document.getElementById("viveiroRacao").value;
    const data = document.getElementById("dataRacao").value;
    const racao = parseFloat(document.getElementById("consumoRacao").value);

    if (!data || !racao) {
        document.getElementById("area-gestao").innerHTML += "<p>Preencha todos os campos.</p>";
        return;
    }

    if (!viveiros[index].racoes) {
        viveiros[index].racoes = [];
    }

    viveiros[index].racoes.push({
        data: data,
        racao: racao
    });

    document.getElementById("area-gestao").innerHTML = `
        <div class="resultado-box destaque">
            <p>Ração lançada</p>
            <h3>${formatarNumeroBR(racao, 1)} kg</h3>
            <span>${viveiros[index].nome} - ${formatarData(data)}</span>
        </div>

        <button class="limpar" onclick="abrirViveiro(${index})">
            Voltar ao viveiro
        </button>
    `;
}

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

function salvarBiometria(index) {
    const data = document.getElementById("dataBiometria").value;
    const gramatura = parseFloat(document.getElementById("gramaturaBiometria").value);

    if (!data || !gramatura) {
        alert("Preencha a data e a gramatura.");
        return;
    }

    if (!viveiros[index].biometrias) {
        viveiros[index].biometrias = [];
    }

    viveiros[index].biometrias.push({
        data: data,
        gramatura: gramatura
    });

    abrirViveiro(index);
}

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
                ${viveiros.map((viveiro, index) => `
                    <option value="${index}" ${String(index) === String(indexSelecionado) ? "selected" : ""}>
                        ${viveiro.nome}
                    </option>
                `).join("")}
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
                <h2>Histórico - ${viveiro.nome}</h2>
            </div>

            <div id="opcoes-historico">
                <div class="painel-acoes">
                    <button class="botao-historico" onclick="abrirHistoricoBiometriaDireto(${index})">
                        Biometria
                    </button>

                    <button class="botao-historico" onclick="abrirHistoricoRacaoDireto(${index})">
                        Ração
                    </button>

                    <button class="botao-historico" onclick="abrirHistoricoDespescaDireto(${index})">
                        Despesca parcial
                    </button>
                </div>
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
                : biometrias.map((item, i) => {
                    let crescimento = "-";

                    if (i > 0) {
                        crescimento = (
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
                }).join("")
            }
        </div>
${
 direto
    ?`<button class="limpar" onclick="mostrarHistoricoDoViveiroDireto(${index})">Voltar</button>`
     :`<button class="limpar" onclick="voltarOpcoesHistorico()">Voltar</button>`
}
    `;
}

function renderizarHistoricoRacao(index, elementoId, direto) {
    const viveiro = viveiros[index];
    const resultado = document.getElementById(elementoId);
    const racoes = viveiro.racoes || [];

    const totalRacao = racoes.reduce((total, item) => total + item.racao, 0);

    resultado.innerHTML = `
        <h3>Ração</h3>

        <div class="tabela-historico">
            <div class="linha-historico cabecalho">
                <span>Dia</span>
                <span>Data</span>
                <span>Ração</span>
            </div>

            ${
                racoes.length === 0
                ? `<p class="sobrevivencia-texto">Nenhuma ração lançada.</p>`
                : racoes.map((item) => `
                    <div class="linha-historico">
                        <span>${calcularDiasCultivo(viveiro.dataPovoamento, item.data)}</span>
                        <span>${formatarData(item.data)}</span>
                        <span>${formatarNumeroBR(item.racao, 1)} kg</span>
                    </div>
                `).join("")
            }
        </div>

        <div class="resultado-box destaque">
            <p>Consumo total</p>
            <h3>${formatarNumeroBR(totalRacao, 1)} kg</h3>
        </div>

        ${
             direto
             ? `<button class="limpar" onclick="mostrarHistoricoDoViveiroDireto(${index})">Voltar</button>`
             : `<button class="limpar" onclick="voltarOpcoesHistorico()">Voltar</button>`
}
    `;
}

function reiniciarCiclo(index) {
    if (!confirm("Deseja reiniciar o ciclo deste viveiro?")) return;

    const viveiro = viveiros[index];

    viveiro.dataPovoamento = "";
    viveiro.totalPovoado = "";
    viveiro.laboratorio = "";
    viveiro.racoes = [];
    viveiro.biometrias = [];

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

function salvarNovoCiclo(index) {
    viveiros[index].dataPovoamento = document.getElementById("novoPovoamento").value;
    viveiros[index].totalPovoado = document.getElementById("novoTotal").value;
    viveiros[index].laboratorio = document.getElementById("novoLaboratorio").value;

    abrirViveiro(index);
}

function excluirViveiro(index) {
    viveiros.splice(index, 1);
    mostrarListaViveiros();
}

function limparAreaGestao() {
    document.getElementById("area-gestao").innerHTML = "";
}

function abrirDespesca(index) {
    const viveiro = viveiros[index];
    const area = document.getElementById("area-gestao");
    const hoje = new Date().toISOString().split("T")[0];

    area.innerHTML = `
        <div class="painel-viveiro">
            <div class="painel-topo">
                <h2>Lançar despesca - ${viveiro.nome}</h2>
            </div>

            <label>Data da despesca</label>
            <input type="date" id="dataDespesca" value="${hoje}">

            <label>Total despescado</label>
            <div class="input-unidade">
                <input type="number" id="kgDespesca" placeholder="Ex: 500">
                <span>kg</span>
            </div>

            <label>Peso médio</label>
            <div class="input-unidade">
                <input type="number" id="pesoDespesca" placeholder="Ex: 10">
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

function salvarDespesca(index) {
    const data = document.getElementById("dataDespesca").value;
    const quantidadeKg = parseFloat(document.getElementById("kgDespesca").value);
    const pesoMedio = parseFloat(document.getElementById("pesoDespesca").value);

    if (!data || !quantidadeKg || !pesoMedio) {
        alert("Preencha a data, os quilos despescados e o peso médio.");
        return;
    }

    if (!viveiros[index].despescas) {
        viveiros[index].despescas = [];
    }

    viveiros[index].despescas.push({
        data: data,
        tipo: "Parcial",
        quantidadeKg: quantidadeKg,
        pesoMedio: pesoMedio
    });

    abrirViveiro(index);
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
                : despescas.map((item) => `
                    <div class="linha-historico">
                        <span>${formatarData(item.data)}</span>
                        <span>${formatarNumeroBR(item.quantidadeKg, 1)} kg</span>
                        <span>${formatarNumeroBR(item.pesoMedio, 1)} g</span>
                    </div>
                `).join("")
            }
        </div>

        <div class="resultado-box destaque">
            <p>Total despescado</p>
            <h3>${formatarNumeroBR(totalDespescado, 1)} kg</h3>
        </div>

       ${
            direto
            ? `<button class="limpar" onclick="mostrarHistoricoDoViveiroDireto(${index})">Voltar</button>`
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

    viveiros.forEach(viveiro => {

        if (viveiro.ciclosFinalizados) {

            viveiro.ciclosFinalizados.forEach(ciclo => {

                ciclos.push({
                    viveiro: viveiro.nome,
                    ciclo: ciclo
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

    area.innerHTML = ciclos.map((item) => `

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

    `).join("");
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
function salvarEncerramentoCiclo(index) {
    const viveiro = viveiros[index];

    const dataEncerramento = document.getElementById("dataEncerramento").value;
    const producaoFinal = parseFloat(document.getElementById("producaoFinal").value);
    const pesoFinal = parseFloat(document.getElementById("pesoFinal").value);
    const observacoes = document.getElementById("observacoesCiclo").value;

    if (!dataEncerramento || !producaoFinal || !pesoFinal) {
        alert("Preencha data de encerramento, produção final e peso médio final.");
        return;
    }

    const racoes = viveiro.racoes || [];
    const despescas = viveiro.despescas || [];
    const biometrias = viveiro.biometrias || [];

    const racaoConsumida = racoes.reduce((total, item) => total + item.racao, 0);
    const despescaParcial = despescas.reduce((total, item) => total + item.quantidadeKg, 0);

    const producaoTotal = despescaParcial + producaoFinal;
    const fca = racaoConsumida / producaoTotal;

    const totalPovoado = parseFloat(String(viveiro.totalPovoado).replace(/\./g, ""));
    const quantidadeFinal = producaoTotal / (pesoFinal / 1000);
    const sobrevivencia = (quantidadeFinal / totalPovoado) * 100;

    const diasCultivo = calcularDiasCultivo(viveiro.dataPovoamento, dataEncerramento);

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
        producaoTotal: producaoTotal,
        pesoFinal: pesoFinal,
        racaoConsumida: racaoConsumida,
        fca: fca,
        sobrevivencia: sobrevivencia,
        biometrias: [...biometrias],
        racoes: [...racoes],
        despescas: [...despescas],
        observacoes: observacoes
    };

    if (!viveiro.ciclosFinalizados) {
        viveiro.ciclosFinalizados = [];
    }

    viveiro.ciclosFinalizados.push(cicloFinalizado);

    if (typeof salvarDados === "function") {
        salvarDados();
    }

    mostrarRelatorioCiclo(index, cicloFinalizado);
}

function mostrarRelatorioCiclo(index, ciclo) {
    const area = document.getElementById("area-gestao");

    area.innerHTML = `
        <div class="painel-viveiro">
            <div class="painel-topo">
                <h2>Relatório final</h2>
                <span>${ciclo.nomeViveiro}</span>
            </div>

            <div class="painel-info">
                <div class="info-box">
                    <small>Laboratório</small>
                    <strong>${ciclo.laboratorio}</strong>
                </div>

                <div class="info-box">
                    <small>Tamanho</small>
                    <strong>${ciclo.tamanho} ha</strong>
                </div>

                <div class="info-box">
                    <small>Total povoado</small>
                    <strong>${ciclo.totalPovoado} PLs</strong>
                </div>

                <div class="info-box">
                    <small>Povoamento</small>
                    <strong>${formatarData(ciclo.dataPovoamento)}</strong>
                </div>

                <div class="info-box">
                    <small>Encerramento</small>
                    <strong>${formatarData(ciclo.dataEncerramento)}</strong>
                </div>

                <div class="info-box">
                    <small>Dias de cultivo</small>
                    <strong>${ciclo.diasCultivo} dias</strong>
                </div>

                <div class="info-box">
                    <small>Produção total</small>
                    <strong>${formatarNumeroBR(ciclo.producaoTotal, 1)} kg</strong>
                </div>

                <div class="info-box">
                    <small>Despesca parcial</small>
                    <strong>${formatarNumeroBR(ciclo.despescaParcial, 1)} kg</strong>
                </div>

                <div class="info-box">
                    <small>Produção final</small>
                    <strong>${formatarNumeroBR(ciclo.producaoFinal, 1)} kg</strong>
                </div>

                <div class="info-box">
                    <small>Peso médio final</small>
                    <strong>${formatarNumeroBR(ciclo.pesoFinal, 1)} g</strong>
                </div>

                <div class="info-box">
                    <small>Ração consumida</small>
                    <strong>${formatarNumeroBR(ciclo.racaoConsumida, 1)} kg</strong>
                </div>

                <div class="info-box">
                    <small>FCA final</small>
                    <strong>${formatarNumeroBR(ciclo.fca, 2)}</strong>
                </div>

                <div class="info-box">
                    <small>Sobrevivência</small>
                    <strong>${formatarNumeroBR(ciclo.sobrevivencia, 1)}%</strong>
                </div>
            </div>

            <div class="resultado-box destaque">
                <p>Ciclo encerrado</p>
                <h3>${formatarNumeroBR(ciclo.producaoTotal, 1)} kg</h3>
                <span>Produção total do ciclo</span>
            </div>

            <button class="botao-painel" onclick="window.print()">
                Imprimir relatório
            </button>

            <button class="limpar" onclick="abrirViveiro(${index})">
                Voltar ao viveiro
            </button>
        </div>
    `;
}