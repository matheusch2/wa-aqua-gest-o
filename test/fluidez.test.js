"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// O arquivo real, sem rede ou contas de clientes. Um contexto novo por teste.
const source = fs.readFileSync(path.join(__dirname, "../app/script.js"), "utf8");
const noop = () => {};
function element() {
  const attrs = new Map(), classes = new Set();
  return { value: "", innerHTML: "Salvar", textContent: "", disabled: false,
    style: {}, dataset: {}, scrollTop: 0, firstElementChild: {},
    addEventListener: noop, removeEventListener: noop, appendChild: noop, remove: noop,
    focus: noop, querySelector: () => null, querySelectorAll: () => [],
    getAttribute: k => attrs.has(k) ? attrs.get(k) : null,
    setAttribute: (k,v) => attrs.set(k,String(v)), removeAttribute: k => attrs.delete(k),
    classList: {add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k),toggle:noop},
  };
}
function load() {
  const els = new Map(), timers = [], scrolls = [], errors = [];
  const get = id => { if (!els.has(id)) els.set(id,element()); return els.get(id); };
  const button = element();
  const win = {addEventListener:noop,location:{href:"",search:""},scrollY:0,
    scrollTo:opts=>scrolls.push(opts),matchMedia:()=>({matches:false,addEventListener:noop})};
  const ctx = {window:win,location:win.location,history:{pushState:noop},
    document:{getElementById:get,querySelector:s=>s===".botao-salvar"?button:null,
      querySelectorAll:()=>[],addEventListener:noop,createElement:element,body:element(),documentElement:element()},
    navigator:{onLine:true},localStorage:{getItem:()=>null,setItem:noop},
    supabase:{createClient:()=>({})},console:{log:noop},
    setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:noop,setInterval:noop,
    crypto:{randomUUID:()=>"test-id"},Chart:function(){},
    MutationObserver:function(){return{observe:noop};},
    __button:button,__errors:errors,
  };
  vm.createContext(ctx);
  const run = s => vm.runInContext(s,ctx);
  run(source);
  run('_toastErro = msg => __errors.push(msg);');
  return {run,get,button,win,errors,scrolls,flush(){while(timers.length)timers.shift()();}};
}
function seed(a) {
  a.run(`tiposRacao=[{id:'a',nome:'A',custoPorKg:5},{id:'b',nome:'B',custoPorKg:6}];
    viveiros=[{id:'v1',nome:'Viveiro 1',dataPovoamento:'2026-09-01',racoes:[
      {data:'2026-09-20',tipoRacaoId:'b'}, {data:'2026-09-10',tipoRacaoId:'a'}
    ],custos:[],ciclosFinalizados:[]},
    {id:'v2',nome:'Viveiro 2',dataPovoamento:'2026-09-01',racoes:[{data:'2026-09-21',tipoRacaoId:'a'}],custos:[],ciclosFinalizados:[]}];`);
}

test("ração: escolhe por data sem reordenar o histórico",()=>{
  const a=load();seed(a);
  assert.equal(a.run('_ultimaRacaoIndex(viveiros[0])'),1);
  assert.equal(a.run('viveiros[0].racoes[0].data'),"2026-09-20");
});
test("ração: sem histórico, tipo removido ou não especificado fica vazio",()=>{
  const a=load();seed(a);
  for(const p of ["{}","{racoes:[]}","{racoes:[{data:'2026-09-21',tipoRacaoId:'removido'}]}","{racoes:[{data:'2026-09-21'},{data:'2026-09-20',tipoRacaoId:'a'}]}"])
    assert.equal(a.run(`_ultimaRacaoIndex(${p})`),-1);
});
test("ração: data do último lançamento e dias desde então",()=>{
  const a=load();seed(a);
  assert.equal(a.run('_ultimaRacaoData(viveiros[0])'),'2026-09-20');
  assert.equal(a.run('_ultimaRacaoData({racoes:[]})'),null);
  assert.equal(a.run(`_diasDesde('2026-09-13','2026-09-20')`),7);
  assert.equal(a.run(`_diasDesde('2026-09-20','2026-09-20')`),0);
  assert.equal(a.run('_diasDesde(null)'),null);
});
test("ração: tocar 'continuar' pula pro dia seguinte e some a etiqueta",()=>{
  const a=load();seed(a);
  a.get('racao-ultimo-chip').innerHTML='<button>etiqueta</button>';
  a.run('_continuarDoUltimo(0)');
  assert.equal(a.get('dataRacao').value,'2026-09-21');       // 20/09 + 1 dia
  assert.equal(a.get('racao-ultimo-chip').innerHTML,'');      // some ao tocar
});
test("ração: primeiro dia em aberto é o dia seguinte ou o povoamento",()=>{
  const a=load();seed(a);
  assert.equal(a.run('_proximoDiaRacao(viveiros[0])'),'2026-09-21'); // 20/09 + 1
  assert.equal(a.run(`_proximoDiaRacao({dataPovoamento:'2026-09-05',racoes:[]})`),'2026-09-05');
  assert.equal(a.run(`_proximoDiaRacao({dataPovoamento:'2026-09-05T00:00:00',racoes:[]})`),'2026-09-05');
  assert.equal(a.run('_proximoDiaRacao({racoes:[]})'),null);          // sem povoamento
  assert.equal(a.run('_proximoDiaRacao(undefined)'),null);
});
test("ração: sem lançamento no ciclo, a etiqueta leva pro dia do povoamento",()=>{
  const a=load();seed(a);
  a.run(`_hojeLocal = () => '2026-09-25';
    viveiros[2]={id:'v3',nome:'Viveiro 3',dataPovoamento:'2026-09-05',racoes:[],custos:[],ciclosFinalizados:[]};`);
  a.run('_atualizarChipUltimoRacao(2)');
  const html = a.get('racao-ultimo-chip').innerHTML;
  assert.match(html,/Povoamento/);        // não diz "Último": não houve lançamento
  assert.match(html,/05\/09\/2026/);
  assert.match(html,/há 20 dias/);
  a.run('_continuarDoUltimo(2)');
  assert.equal(a.get('dataRacao').value,'2026-09-05');
});
test("ração: etiqueta some quando o próximo dia em aberto seria futuro",()=>{
  const a=load();seed(a);
  a.run(`_hojeLocal = () => '2026-09-20';`); // já lançou hoje -> próximo seria 21/09
  a.run('_atualizarChipUltimoRacao(0)');
  assert.equal(a.get('racao-ultimo-chip').innerHTML,'');
  // povoamento hoje e nenhuma ração: oferece o próprio dia, sem mandar pro futuro
  a.run(`viveiros[2]={id:'v3',nome:'V3',dataPovoamento:'2026-09-20',racoes:[],custos:[],ciclosFinalizados:[]};
    _atualizarChipUltimoRacao(2);`);
  assert.match(a.get('racao-ultimo-chip').innerHTML,/Povoamento/);
  a.run('_continuarDoUltimo(2)');
  assert.equal(a.get('dataRacao').value,'2026-09-20');
});
test("ração: viveiro sem povoamento e sem ração não mostra etiqueta",()=>{
  const a=load();seed(a);
  a.run(`viveiros[2]={id:'v3',nome:'V3',racoes:[],custos:[],ciclosFinalizados:[]};
    _atualizarChipUltimoRacao(2);`);
  assert.equal(a.get('racao-ultimo-chip').innerHTML,'');
});
test("ração: troca de viveiro atualiza sugestão e custo, não quantidade/data",()=>{
  const a=load();seed(a);a.get('consumoRacao').value='10';a.get('dataRacao').value='2026-09-21';
  a.run('_sugerirUltimaRacao(0)');assert.equal(a.get('tipoRacaoSelect').value,'1');
  assert.match(a.get('previa-custo-racao-valor').textContent,/60/);
  a.run('_sugerirUltimaRacao(1)');assert.equal(a.get('tipoRacaoSelect').value,'0');
  assert.match(a.get('previa-custo-racao-valor').textContent,/50/);
  a.run('_sugerirUltimaRacao(99)');assert.equal(a.get('tipoRacaoSelect').value,'');
  assert.equal(a.get('consumoRacao').value,'10');assert.equal(a.get('dataRacao').value,'2026-09-21');
});
test("ração: abrir formulário já aplica a sugestão e mantém seleção editável",()=>{
  const a=load();seed(a);a.run('mostrarLancamentoRacao(0)');
  assert.equal(a.get('tipoRacaoSelect').value,'1');
  a.get('tipoRacaoSelect').value='0';a.run('_calcCustoRacao()');
  assert.equal(a.get('tipoRacaoSelect').value,'0');
  assert.match(a.get('area-gestao').innerHTML,/_executarSalvamento/);
});
test("feedback: trava antes da resposta e não executa duplo toque",async()=>{
  const a=load();
  const first=a.run(`globalThis.__calls=0;_executarSalvamento(__button,async()=>{
    __calls++;_travarBotao(__button);await new Promise(r=>globalThis.__resolve=r);
  })`);
  assert.equal(a.button.disabled,true);assert.equal(a.button.getAttribute('aria-busy'),'true');
  assert.match(a.button.innerHTML,/Salvando/);
  await a.run('_executarSalvamento(__button,()=>__calls++)');assert.equal(a.run('__calls'),1);
  a.run('__resolve()');await first;
  assert.equal(a.button.disabled,false);assert.equal(a.button.innerHTML,'Salvar');
  assert.equal(a.button.getAttribute('aria-busy'),null);assert.equal(a.errors.length,0);
});
test("feedback: exceção libera botão e preserva campos, sem repetir gravação",async()=>{
  const a=load();a.get('consumoRacao').value='25';
  await a.run('_executarSalvamento(__button,async()=>{_travarBotao(__button);throw Error("rede");})');
  assert.equal(a.button.disabled,false);assert.equal(a.button.innerHTML,'Salvar');
  assert.equal(a.get('consumoRacao').value,'25');assert.equal(a.errors.length,1);
  assert.match(a.errors[0],/Confira o histórico/);
});
test("feedback: validação sem chamada de rede não exibe falso sucesso",async()=>{
  const a=load();await a.run('_executarSalvamento(__button,()=>{})');
  assert.equal(a.button.innerHTML,'Salvar');assert.equal(a.errors.length,0);
});
test("feedback: restauração antiga não libera uma nova operação",()=>{
  const a=load();a.run('globalThis.__old=_travarBotao(__button);__old();globalThis.__new=_travarBotao(__button);__old();');
  assert.equal(a.button.disabled,true);a.run('__new()');assert.equal(a.button.disabled,false);
});
test("salvamento real de ração: sucesso só depois do retorno do banco simulado",async()=>{
  const a=load();seed(a);
  a.get('dataRacao').value='2026-09-21';a.get('consumoRacao').value='10';a.get('tipoRacaoSelect').value='0';
  a.get('racao-ultimo-chip').innerHTML='<button>etiqueta</button>';
  // O aviso de sucesso agora e flutuante (_toastSucesso), fora do formulario.
  // Captura as chamadas pra poder afirmar QUANDO ele aparece.
  a.run(`__sucessos=[]; _toastSucesso = m => __sucessos.push(m);`);
  a.run(`pegarUsuarioLogado=async()=>({id:'usuario-teste'});
    supabaseClient.from=()=>({insert:()=>({select:()=>new Promise(r=>globalThis.__gravar=r)})});`);
  const pending=a.run('_executarSalvamento(__button,()=>salvarLancamentoRacao(0))');
  await Promise.resolve();await Promise.resolve();
  assert.equal(a.button.disabled,true);
  assert.equal(a.run('__sucessos.length'),0,'avisou sucesso antes de o banco responder');
  assert.equal(a.get('consumoRacao').value,'10');
  a.run('__gravar({data:[{id:"racao-nova"}],error:null})');await pending;
  assert.equal(a.button.disabled,false);
  assert.match(a.run('__sucessos[0]'),/Ração lançada no Viveiro 1/);   // com o nome do viveiro
  // A quantidade PERMANECE após salvar (pra repetir no dia seguinte); a data avança.
  assert.equal(a.get('consumoRacao').value,'10');assert.equal(a.get('dataRacao').value,'2026-09-22');
  assert.equal(a.get('racao-ultimo-chip').innerHTML,''); // etiqueta some ao lançar
  assert.equal(a.errors.length,0);
});
test("salvamento real de ração: rejeição de rede não apaga o formulário",async()=>{
  const a=load();seed(a);
  a.get('dataRacao').value='2026-09-21';a.get('consumoRacao').value='10';a.get('tipoRacaoSelect').value='0';
  a.run(`__sucessos=[]; _toastSucesso = m => __sucessos.push(m);`);
  a.run(`pegarUsuarioLogado=async()=>({id:'usuario-teste'});
    supabaseClient.from=()=>({insert:()=>({select:()=>Promise.reject(Error('rede'))})});`);
  await a.run('_executarSalvamento(__button,()=>salvarLancamentoRacao(0))');
  assert.equal(a.button.disabled,false);assert.equal(a.get('consumoRacao').value,'10');
  assert.equal(a.get('tipoRacaoSelect').value,'0');assert.equal(a.get('dataRacao').value,'2026-09-21');
  assert.equal(a.run('__sucessos.length'),0,'avisou sucesso mesmo com a rede falhando');
  assert.equal(a.errors.length,1);
});
test("retorno: restaura rolagem do celular e do painel desktop",()=>{
  const a=load();a.win.scrollY=460;a.get('area-gestao').scrollTop=210;a.run('salvarScroll()');
  a.win.scrollY=0;a.get('area-gestao').scrollTop=0;a.run('restaurarScroll()');a.flush();
  assert.equal(a.scrolls[0].top,460);assert.equal(a.get('area-gestao').scrollTop,210);
});
test("retorno: não move uma tela aberta depois do agendamento",()=>{
  const a=load();a.run('salvarScroll();restaurarScroll()');a.get('area-gestao').firstElementChild={};a.flush();
  assert.equal(a.scrolls.length,0);
});
test("histórico de ração: voltar mantém página atual",()=>{
  const a=load();seed(a);a.run('abrirEdicaoRacao(0,0,"historico",false,3)');
  assert.match(a.get('historico').innerHTML,/renderizarHistoricoRacao\(0,'historico',false,3\); restaurarScroll\(\)/);
});
test("históricos: cancelar biometria e despesca restaura posição",()=>{
  const a=load();seed(a);a.run(`viveiros[0].biometrias=[{data:'2026-09-20',gramatura:10}];
    viveiros[0].despescas=[{data:'2026-09-20',quantidadeKg:20,pesoMedio:10,precoKg:20}];`);
  a.run('abrirEdicaoBiometria(0,0,"historico",false)');assert.match(a.get('historico').innerHTML,/restaurarScroll\(\)/);
  a.run('abrirEdicaoDespesca(0,0,"historico",true)');assert.match(a.get('area-gestao').innerHTML,/restaurarScroll\(\)/);
});
test("boletos: busca continua preenchida e escapada ao reabrir",()=>{
  const a=load();a.run('_filtrarBoletosBusca("Fornecedor \\\"A\\\"");abrirBoletos()');
  assert.match(a.get('area-gestao').innerHTML,/value="Fornecedor &quot;A&quot;"/);
});
test("financeiro: conserva viveiro por ID após reordenação e período limpo",()=>{
  const a=load();seed(a);
  a.run('_finRenderCicloSel=()=>{};_finAtualizarPeriodoVisivel=()=>{};mostrarCustosFinanceiro=()=>{};');
  a.get('viveiroFinanceiro').value='0';a.run('_finTrocarViveiro();abrirFinanceiro();_finLimparFiltros();');
  a.get('viveiroFinanceiro').value='0';a.run('_finTrocarViveiro();viveiros.reverse();abrirFinanceiro();');
  assert.match(a.get('area-gestao').innerHTML,/<option value="1" selected>Viveiro 1/);
  assert.equal(a.run('_finPeriodoIni'), '');assert.equal(a.run('_finPeriodoFim'), '');
});
test("financeiro: viveiro removido não seleciona outro indevidamente",()=>{
  const a=load();seed(a);a.run('_finRenderCicloSel=()=>{};_finAtualizarPeriodoVisivel=()=>{};mostrarCustosFinanceiro=()=>{};_finViveiroId="removido";_finCicloSel="antigo";abrirFinanceiro()');
  assert.equal(a.run('_finViveiroId'),null);assert.equal(a.run('_finCicloSel'),'');
});

// ── Manejo automático: o que o "desfazer" leva junto ─────────────────────────
// A tela conta e o desfazer apaga pela MESMA função. Se os dois filtros se
// separarem, o produtor lê "18 lançamentos", manda apagar, e some outra coisa.
// Por isso o que está testado aqui é a fronteira: o que entra e o que fica.
function viveiroComCustos(extra) {
  return Object.assign({
    dataPreparacao: "2026-09-01", dataPovoamento: "2026-09-10", cicloId: "c-9",
    custos: [
      { id: "a1", data: "2026-09-15", valor: 10, observacao: "Automático (ração)",  cicloId: "c-9" },
      { id: "a2", data: "2026-09-20", valor: 20, observacao: "Automático (semanal)", cicloId: "c-9" },
      { id: "m1", data: "2026-09-21", valor: 99, observacao: "Comprei na loja",      cicloId: "c-9" },
      { id: "m2", data: "2026-09-22", valor: 50, observacao: "",                     cicloId: "c-9" },
      { id: "v1", data: "2026-05-05", valor: 77, observacao: "Automático (ração)",  cicloId: "c-8" },
    ],
  }, extra || {});
}
const ids = (l) => l.map(c => c.id).join(",");

test("manejo: leva só o automático, e só do ciclo aberto",()=>{
  const a=load();
  a.run(`__v = (${viveiroComCustos.toString()})();`);
  assert.equal(a.run('_maLancamentosDoCiclo(__v).map(c=>c.id).join(",")'), "a1,a2");
});
test("manejo: custo lançado na mão nunca entra",()=>{
  const a=load();
  a.run(`__v = (${viveiroComCustos.toString()})();`);
  const pegos = a.run('_maLancamentosDoCiclo(__v).map(c=>c.id)');
  for (const manual of ["m1","m2"]) assert.equal(pegos.includes(manual), false, manual);
});
test("manejo: sem cicloId, corta pela data de início do ciclo",()=>{
  const a=load();
  a.run(`__v = (${viveiroComCustos.toString()})({cicloId:null});
    __v.custos.forEach(c => { c.cicloId = null; });`);
  // o de maio fica de fora porque é anterior à preparação (01/09)
  assert.equal(a.run('_maLancamentosDoCiclo(__v).map(c=>c.id).join(",")'), "a1,a2");
});
test("manejo: viveiro sem custos, ou sem viveiro, devolve lista vazia",()=>{
  const a=load();
  assert.equal(a.run('_maLancamentosDoCiclo({}).length'), 0);
  assert.equal(a.run('_maLancamentosDoCiclo(null).length'), 0);
  assert.equal(a.run('_maLancamentosDoCiclo({custos:[]}).length'), 0);
});
test("manejo: a conta da tela e a do desfazer são a mesma lista",()=>{
  const a=load();
  a.run(`__v = (${viveiroComCustos.toString()})();`);
  // o total que a tela mostra sai dos mesmos itens que vão ser apagados
  assert.equal(a.run('_maLancamentosDoCiclo(__v).reduce((s,c)=>s+Number(c.valor),0)'), 30);
});

// ── Nome do viveiro numa linha só ───────────────────────────────────────────
// O ajuste mede o elemento, então o miolo só dá pra testar em navegador (está
// coberto pelo roteiro do /tmp). Aqui ficam as bordas que falham caladas: sem
// elemento, e sem layout (aba em segundo plano, tela ainda não desenhada). Num
// desses o laço encolheria o título à toa, ou quebraria a abertura do viveiro.
test("título do viveiro: sem elemento na tela, não quebra",()=>{
  const a=load();
  a.run('document.querySelector = () => null;');
  assert.doesNotThrow(() => a.run('_vvAjustarTitulo()'));
});
test("título do viveiro: sem layout medido, não mexe no tamanho",()=>{
  const a=load();
  a.run(`globalThis.getComputedStyle = () => ({ fontSize: "22px" });
         __t = { style:{fontSize:""}, classList:{add(){this.q=true;},remove(){this.q=false;}},
           clientWidth: 0, scrollWidth: 999 };
         document.querySelector = () => __t;`);
  a.run('_vvAjustarTitulo()');
  assert.equal(a.run('__t.style.fontSize'), "");   // continua com o tamanho do CSS
  assert.equal(a.run('__t.classList.q'), false);   // e sem a classe de quebra
});
test("título do viveiro: nome que não cabe nem no mínimo volta a quebrar",()=>{
  const a=load();
  a.run(`globalThis.getComputedStyle = () => ({ fontSize: "22px" });
         __t = { style:{fontSize:"22px"}, classList:{add(){this.q=true;},remove(){this.q=false;}},
           clientWidth: 90, scrollWidth: 999 };
         document.querySelector = () => __t;`);
  a.run('_vvAjustarTitulo()');
  assert.equal(a.run('__t.classList.q'), true);    // quebra, em vez de cortar
  assert.equal(a.run('__t.style.fontSize'), "15px"); // parou no piso
});

// ── Custos de um ciclo já encerrado ─────────────────────────────────────────
// O custo entra no relatório certo por casar o ciclo_id. Achar o ciclo errado
// (ou não achar) lançaria a despesa num cultivo que não é o dele, e isso o
// produtor só descobriria conferindo o lucro de um ciclo que ele já fechou.
function viveiroComCiclos() {
  return {
    cicloId: "atual", custos: [],
    ciclosFinalizados: [
      { cicloId: "c-01", nomeViveiro: "Viveiro 01", dataEncerramento: "2026-07-19" },
      { cicloId: "c-02", nomeViveiro: "Viveiro 01", dataEncerramento: "2026-11-02" },
    ],
  };
}
test("ciclo encerrado: acha o ciclo pelo id, não pela posição",()=>{
  const a=load();
  a.run(`viveiros = [(${viveiroComCiclos.toString()})()];`);
  assert.equal(a.run(`_cicloEncerradoPorId(0,"c-02").dataEncerramento`), "2026-11-02");
  assert.equal(a.run(`_cicloEncerradoPorId(0,"c-01").dataEncerramento`), "2026-07-19");
});
test("ciclo encerrado: id desconhecido devolve nada, em vez de chutar o primeiro",()=>{
  const a=load();
  a.run(`viveiros = [(${viveiroComCiclos.toString()})()];`);
  assert.equal(a.run(`_cicloEncerradoPorId(0,"nao-existe")`), null);
  assert.equal(a.run(`_cicloEncerradoPorId(0,"")`), null);
  assert.equal(a.run(`_cicloEncerradoPorId(9,"c-01")`), null);   // viveiro fora da lista
});
test("ciclo encerrado: o custo marcado com o ciclo antigo não entra no atual",()=>{
  const a=load();
  a.run(`__v = { cicloId: "atual", dataPreparacao: "2026-10-01", custos: [
    { id:"x1", data:"2026-07-10", valor: 350, cicloId: "c-01" },
    { id:"x2", data:"2026-10-20", valor:  80, cicloId: "atual" }
  ]};`);
  // relatório do ciclo encerrado vê só o dele
  assert.equal(a.run(`_custosManuaisDoCiclo(__v.custos,"c-01","2026-03-27","2026-07-19").map(c=>c.id).join()`), "x1");
  // e a tela do viveiro em cultivo continua vendo só o dela
  assert.equal(a.run(`_custosDoEscopoPares(__v).map(p=>p.c.id).join()`), "x2");
});

// ── O aviso de sucesso não pode voltar a ser embutido ───────────────────────
// Media no navegador: com o aviso dentro do formulário, o "Salvar lançamento"
// descia 50px ao aparecer e subia de volta 2,5s depois, quando ele sumia. Quem
// lança ração em sequência tocava num alvo que se mexia nos dois sentidos.
// Agora é _toastSucesso(), que flutua. Este teste existe porque a tentação de
// pôr "um avisinho ali no formulário" volta sempre.
test("lançamento: nenhum formulário traz aviso de sucesso embutido",()=>{
  const a=load();seed(a);
  a.run('mostrarLancamentoRacao(0)');
  const html = a.get('area-gestao').innerHTML;
  assert.equal(html.includes("msg-sucesso-lancamento"), false,
    "o aviso voltou a ser embutido — ele empurra o botão de salvar");
  assert.equal(html.includes("msg-racao-sucesso"), false);
});

// ── Painel "Sua fazenda hoje" ───────────────────────────────────────────────
// Número errado na tela inicial ninguém desconfia: não tem com o que comparar
// ali. Por isso a conta é separada do desenho e testada aqui.
function fazendaDeTeste() {
  // Dois viveiros bem diferentes de tamanho, pra média ponderada aparecer.
  return [
    { id: 'g', nome: 'Grande', dataPovoamento: '2026-08-01', dataPreparacao: '2026-07-25',
      totalPovoado: 200000, cicloId: 'cg', custos: [{ id: 'c1', data: '2026-09-01', valor: 5000, cicloId: 'cg' }],
      biometrias: [{ data: '2026-10-01', gramatura: 10 }],
      racoes: [{ data: '2026-11-01', racao: 36 }] },
    { id: 'p', nome: 'Pequeno', dataPovoamento: '2026-09-01', dataPreparacao: '2026-08-25',
      totalPovoado: 20000, cicloId: 'cp', custos: [{ id: 'c2', data: '2026-09-10', valor: 500, cicloId: 'cp' }],
      biometrias: [{ data: '2026-10-20', gramatura: 5 }],
      racoes: [{ data: '2026-11-13', racao: 5.5 }] },
    { id: 'v', nome: 'Vazio', dataPreparacao: '2026-11-01', custos: [], biometrias: [], racoes: [] },
  ];
}

test("painel: conta só os viveiros em cultivo",()=>{
  const a=load();
  a.run(`__f = (${fazendaDeTeste.toString()})(); __r = _resumoFazenda(__f, '2026-11-13');`);
  assert.equal(a.run('__r.emCultivo'), 2);          // o "Vazio" ficou de fora
});
test("painel: peso médio é ponderado pela biomassa, não média simples",()=>{
  const a=load();
  a.run(`__f = (${fazendaDeTeste.toString()})(); __r = _resumoFazenda(__f, '2026-11-13');`);
  const medio = a.run('__r.pesoMedio');
  // Média simples de 10 g e 5 g daria 7,5. Ponderada tem que puxar pro grande.
  assert.ok(medio > 9, `esperava perto de 10, veio ${medio} (parece média simples)`);
  assert.ok(medio <= 10, `não pode passar do maior peso: ${medio}`);
});
test("painel: soma o investido de todos os ciclos abertos",()=>{
  const a=load();
  a.run(`__f = (${fazendaDeTeste.toString()})(); __r = _resumoFazenda(__f, '2026-11-13');`);
  assert.ok(a.run('__r.investido') >= 5500, 'tinha que somar os 5.000 + 500 lançados');
});
test("painel: conta quantos estão sem ração HOJE",()=>{
  const a=load();
  // só o "Pequeno" tem ração de 13/11
  a.run(`__f = (${fazendaDeTeste.toString()})(); __r = _resumoFazenda(__f, '2026-11-13');`);
  assert.equal(a.run('__r.semRacao'), 1);
  // noutro dia, os dois estão sem
  a.run(`__r2 = _resumoFazenda(__f, '2026-11-14');`);
  assert.equal(a.run('__r2.semRacao'), 2);
});
test("painel: fazenda vazia devolve zeros, sem quebrar",()=>{
  const a=load();
  for (const lista of ['[]', 'null', '[{}]', '[{dataPovoamento:null}]']) {
    a.run(`__r = _resumoFazenda(${lista}, '2026-11-13');`);
    assert.equal(a.run('__r.emCultivo'), 0, lista);
    assert.equal(a.run('__r.biomassa'), 0, lista);
    assert.equal(a.run('__r.pesoMedio'), 0, lista);
  }
});

// ── Faixa de preços do camarão ──────────────────────────────────────────────
// A regra que importa: PREÇO VELHO É PIOR QUE PREÇO NENHUM. Um produtor que
// negocia com número de três semanas atrás e se dá mal culpa o app, com razão.
// Por isso a validade é testada: é a única coisa aqui que falha em silêncio,
// porque uma faixa com preço velho parece perfeitamente normal.
const PRECO = (r, p, ant, dia) => ({ rotulo: r, preco: p, preco_anterior: ant, ordem: 1, atualizado_em: dia });

test("preços: dentro do prazo, a faixa mostra",()=>{
  const a=load();
  a.run(`__l = [${JSON.stringify(PRECO('12 g', 22, 21, '2026-11-13'))}];`);
  assert.equal(a.run(`_precosFrescos(__l, '2026-11-13').itens.length`), 1);
  assert.equal(a.run(`_precosFrescos(__l, '2026-11-23').itens.length`), 1);   // 10 dias: ainda vale
});
test("preços: passou do prazo, a faixa some — não mostra velho",()=>{
  const a=load();
  a.run(`__l = [${JSON.stringify(PRECO('12 g', 22, 21, '2026-11-13'))}];`);
  assert.equal(a.run(`_precosFrescos(__l, '2026-11-24').itens.length`), 0);   // 11 dias
  assert.equal(a.run(`_precosFrescos(__l, '2026-12-20').itens.length`), 0);
});
test("preços: a validade conta pelo lançamento mais recente",()=>{
  const a=load();
  // um tamanho antigo e outro corrigido hoje: corrigir um não pode envelhecer os outros
  a.run(`__l = [${JSON.stringify(PRECO('10 g', 18, null, '2026-10-01'))},
                ${JSON.stringify(PRECO('12 g', 22, 21, '2026-11-13'))}];`);
  assert.equal(a.run(`_precosFrescos(__l, '2026-11-13').itens.length`), 2);
});
test("preços: lista vazia ou suja não quebra",()=>{
  const a=load();
  for (const l of ['[]', 'null', '[{}]', '[{rotulo:"", preco:0}]', '[{rotulo:"12 g", preco:-5}]']) {
    a.run(`__r = _precosFrescos(${l}, '2026-11-13');`);
    assert.equal(a.run('__r.itens.length'), 0, l);
  }
});
test("preços: sem preço anterior não inventa variação",()=>{
  const a=load();
  assert.equal(a.run(`_variacaoPreco({preco: 22, preco_anterior: null})`), null);
  assert.equal(a.run(`_variacaoPreco({preco: 22, preco_anterior: 22})`), null);  // igual: sem seta
  assert.equal(a.run(`_variacaoPreco({preco: 22, preco_anterior: 21})`), 1);
  assert.ok(a.run(`_variacaoPreco({preco: 20, preco_anterior: 21})`) < 0);
});

// ── De onde sai o nome do produtor ──────────────────────────────────────────
// Três fontes, em ordem. Errar a ordem não quebra nada: o app saúda pelo nome
// errado e segue como se nada fosse — foi assim que nasceu o "Olá, Fazenda
// Santa Luzia", saudando pelo campo da FAZENDA.
const U = (meta, email) => ({ user_metadata: meta || {}, email: email || "" });

test("nome: o proprietário cadastrado vem primeiro",()=>{
  const a=load();
  a.run(`__u = ${JSON.stringify(U({ proprietario: 'Matheus Vitalo', nome: 'Fazenda Santa Luzia' }, 'outro@x.com'))};`);
  assert.equal(a.run(`_nomeDoProdutor(__u, {nome:'Zé do Contato'})`), 'Matheus Vitalo');
});
test("nome: sem proprietário, usa o do cadastro do WhatsApp",()=>{
  const a=load();
  a.run(`__u = ${JSON.stringify(U({ nome: 'Fazenda Santa Luzia' }, 'matheus.vitalo@x.com'))};`);
  assert.equal(a.run(`_nomeDoProdutor(__u, {nome:'José Carlos'})`), 'José Carlos');
  // o nome da FAZENDA nunca pode ser usado como nome da pessoa
  assert.notEqual(a.run(`_nomeDoProdutor(__u, {nome:'José Carlos'})`), 'Fazenda Santa Luzia');
});
test("nome: sem os dois, tira do e-mail",()=>{
  const a=load();
  a.run(`__u = ${JSON.stringify(U({ nome: 'Fazenda X' }, 'matheus.vitalo@gmail.com'))};`);
  assert.equal(a.run(`_nomeDoProdutor(__u, null)`), 'Matheus Vitalo');
});
test("nome do e-mail: separa, capitaliza e para em dois nomes",()=>{
  const a=load();
  assert.equal(a.run(`_nomeDoEmail('matheus.vitalo@gmail.com')`), 'Matheus Vitalo');
  assert.equal(a.run(`_nomeDoEmail('joao_silva_pereira@x.com')`), 'Joao Silva');   // para em dois
  assert.equal(a.run(`_nomeDoEmail('JOAO.SILVA82@x.com')`), 'Joao Silva');          // número fora
  assert.equal(a.run(`_nomeDoEmail('matheus@x.com')`), 'Matheus');
  assert.equal(a.run(`_nomeDoEmail('')`), '');
  assert.equal(a.run(`_nomeDoEmail(null)`), '');
});
test("nome: cadastro em branco ou só espaço não conta como preenchido",()=>{
  const a=load();
  a.run(`__u = ${JSON.stringify(U({ proprietario: '   ' }, 'ana.paula@x.com'))};`);
  assert.equal(a.run(`_nomeDoProdutor(__u, {nome:'  '})`), 'Ana Paula');
});

// ── Lucro do ano, na tela inicial ───────────────────────────────────────────
// O risco aqui não é quebrar, é somar errado em silêncio: um número grande na
// tela inicial não tem com o que ser comparado, e o produtor acredita nele.
function fazendaComCiclos() {
  return [{
    nome: 'V1', cicloId: 'atual', custos: [
      { id: 'a', data: '2026-03-01', valor: 1000, cicloId: 'c-26a' },
      { id: 'b', data: '2025-03-01', valor: 900,  cicloId: 'c-25' },
      { id: 'c', data: '2026-09-01', valor: 500,  cicloId: 'c-26b' },
    ],
    ciclosFinalizados: [
      // fechado em 2026, com preço: entra
      { cicloId: 'c-26a', dataPreparacao: '2026-01-01', dataEncerramento: '2026-05-10',
        producaoFinal: 1000, precoVenda: 20, despescas: [], custoFixoRateado: 0 },
      // fechado em 2025: fica de fora
      { cicloId: 'c-25', dataPreparacao: '2025-01-01', dataEncerramento: '2025-05-10',
        producaoFinal: 1000, precoVenda: 20, despescas: [], custoFixoRateado: 0 },
      // fechado em 2026 SEM preço lançado: não entra, e não entra como zero
      { cicloId: 'c-26b', dataPreparacao: '2026-07-01', dataEncerramento: '2026-10-10',
        producaoFinal: 800, precoVenda: 0, despescas: [], custoFixoRateado: 0 },
    ],
  }];
}

test("lucro do ano: só conta ciclo encerrado NESTE ano",()=>{
  const a=load();
  a.run(`__f = (${fazendaComCiclos.toString()})();`);
  // 1000 kg x R$ 20 = 20.000, menos 1.000 de custo = 19.000
  assert.equal(a.run(`_lucroDoAno(__f, 2026).total`), 19000);
  assert.equal(a.run(`_lucroDoAno(__f, 2026).ciclos`), 1);
  assert.equal(a.run(`_lucroDoAno(__f, 2025).total`), 19100);  // 20.000 - 900
});
test("lucro do ano: ciclo sem preço fica fora, não entra como zero",()=>{
  const a=load();
  a.run(`__f = (${fazendaComCiclos.toString()})();`);
  // se o sem-preço entrasse como zero, ciclos seria 2 e a média mentiria
  assert.equal(a.run(`_lucroDoAno(__f, 2026).ciclos`), 1);
});
test("lucro do ano: ano sem ciclo fechado devolve zero e nenhum ciclo",()=>{
  const a=load();
  a.run(`__f = (${fazendaComCiclos.toString()})();`);
  assert.equal(a.run(`_lucroDoAno(__f, 2024).total`), 0);
  assert.equal(a.run(`_lucroDoAno(__f, 2024).ciclos`), 0);
  assert.equal(a.run(`_lucroDoAno([], 2026).ciclos`), 0);
  assert.equal(a.run(`_lucroDoAno(null, 2026).ciclos`), 0);
});
test("receita do ciclo: parcial usa o preço dela; sem preço, cai no da venda",()=>{
  const a=load();
  // parcial COM preço próprio: 100 kg x 30 = 3.000, mais final 500 x 20 = 10.000
  assert.equal(a.run(`_receitaDoCiclo({ precoVenda: 20, producaoFinal: 500,
    despescas: [{ quantidadeKg: 100, precoKg: 30 }] })`), 13000);
  // parcial SEM preço (registro antigo): usa os 20 da venda -> 2.000 + 10.000
  assert.equal(a.run(`_receitaDoCiclo({ precoVenda: 20, producaoFinal: 500,
    despescas: [{ quantidadeKg: 100, precoKg: null }] })`), 12000);
  assert.equal(a.run(`_receitaDoCiclo({})`), 0);
  assert.equal(a.run(`_receitaDoCiclo(null)`), 0);
});

// ── Aviso de boletos ────────────────────────────────────────────────────────
// Um aviso que conta ou soma errado parece perfeitamente normal na tela: não
// há com o que comparar. Por isso a conta é separada do desenho e testada.
function boletosDeTeste(hoje) {
  // prazoDias contados a partir da dataCompra
  return [
    { nome: 'Agromar',   dataCompra: '2026-10-01', prazoDias: 30, valor: 1000, valorPago: 0,   pago: false }, // vencido
    { nome: 'Agromar',   dataCompra: '2026-10-05', prazoDias: 30, valor: 500,  valorPago: 200, pago: false }, // vencido, parcial
    { nome: 'Nutriaqua', dataCompra: '2026-11-10', prazoDias: 5,  valor: 300,  valorPago: 0,   pago: false }, // vencendo
    { nome: 'Agromar',   dataCompra: '2026-01-01', prazoDias: 30, valor: 900,  valorPago: 0,   pago: true  }, // pago: fora
    { nome: 'Longe',     dataCompra: '2026-11-10', prazoDias: 90, valor: 700,  valorPago: 0,   pago: false }, // longe: fora
  ];
}

test("boletos: conta vencidos e vencendo separados, ignora pago e distante",()=>{
  const a=load();
  a.run(`globalThis.__hoje = '2026-11-13';
         Date = class extends Date { constructor(...x){ x.length ? super(...x) : super(2026,10,13,12); } };
         __b = (${boletosDeTeste.toString()})();
         __r = _resumoBoletos(__b, '2026-11-13');`);
  assert.equal(a.run('__r.n'), 3);
  assert.equal(a.run('__r.nVencidos'), 2);
  assert.equal(a.run('__r.nVencendo'), 1);
});
test("boletos: soma o que FALTA pagar, não o valor cheio",()=>{
  const a=load();
  a.run(`Date = class extends Date { constructor(...x){ x.length ? super(...x) : super(2026,10,13,12); } };
         __r = _resumoBoletos((${boletosDeTeste.toString()})(), '2026-11-13');`);
  // 1000 + (500-200) + 300 = 1600 — e não 1800, que seria o valor cheio
  assert.equal(a.run('__r.total'), 1600);
});
test("boletos: nomes sem repetir",()=>{
  const a=load();
  a.run(`Date = class extends Date { constructor(...x){ x.length ? super(...x) : super(2026,10,13,12); } };
         __r = _resumoBoletos((${boletosDeTeste.toString()})(), '2026-11-13');`);
  // join(): o array vem do sandbox e tem outro protótipo, então deepEqual
  // reclama de "mesma estrutura, referência diferente".
  assert.equal(a.run(`__r.nomes.join(" | ")`), 'Agromar | Nutriaqua');
});
test("boletos: a frase de fornecedor resume em vez de listar",()=>{
  const a=load();
  assert.equal(a.run(`_fornecedoresBoletos(['Agromar'])`), 'Agromar');
  assert.equal(a.run(`_fornecedoresBoletos(['Agromar','Nutriaqua'])`), 'Agromar e Nutriaqua');
  assert.equal(a.run(`_fornecedoresBoletos(['A','B','C','D'])`), 'A e mais 3 fornecedores');
  assert.equal(a.run(`_fornecedoresBoletos([])`), '');
  assert.equal(a.run(`_fornecedoresBoletos(null)`), '');
});
test("boletos: lista vazia ou suja não quebra",()=>{
  const a=load();
  for (const l of ['[]', 'null', '[{}]', '[{pago:true}]']) {
    a.run(`__r = _resumoBoletos(${l}, '2026-11-13');`);
    assert.equal(a.run('__r.n'), 0, l);
    assert.equal(a.run('__r.total'), 0, l);
  }
});

/* ───────────────────────────────────────────────────────────────────────────
   Pastilha de categoria das telas de Custos

   Isto falha calado: a tela monta, nada dá erro no console, e o custo só sai
   com o desenho errado. Foi o que aconteceu com "Operação", que TERMINA em
   "racao" e saía com a tigela de ração. Por isso tem teste.
   ─────────────────────────────────────────────────────────────────────────── */
test("custos: a pastilha vem da categoria, e 'Operação' não é ração",()=>{
  const a=load();
  const chave = (cat, nome) => a.run(`_cxCategoriaChave(${JSON.stringify({ categoria: cat, nomeProduto: nome || cat })})`);
  assert.equal(chave('Ração'), 'racao');
  assert.equal(chave('Operação'), 'operacao');      // o bug: terminava em "racao"
  assert.equal(chave('Probiótico'), 'probio');
  assert.equal(chave('Calcário'), 'calcario');      // com acento
  assert.equal(chave('Outros', 'Dolomita (P)'), 'calcario');
  assert.equal(chave('Outros', 'Óxido de cálcio'), 'calcario');
  assert.equal(chave('Aditivo'), 'aditivo');
  assert.equal(chave('Povoamento'), 'larva');
  assert.equal(chave('Outros', 'Pós larva'), 'larva');
  assert.equal(chave('energia'), 'energia');
  assert.equal(chave('funcionario'), 'operacao');
});
test("custos: categoria desconhecida ou vazia cai em 'outro', nunca sem ícone",()=>{
  const a=load();
  for (const arg of ['null', 'undefined', '{}', '{categoria:""}', '{categoria:"Xyz"}']) {
    assert.equal(a.run(`_cxCategoriaChave(${arg})`), 'outro', arg);
  }
  // Toda chave devolvida precisa ter desenho, senão a pastilha sai vazia.
  assert.equal(a.run(`Object.keys(_CX_ICONES).filter(k => !_CX_ICONES[k]).length`), 0);
  assert.equal(a.run(`['racao','larva','probio','calcario','aditivo','energia','operacao','outro']
                      .filter(k => !_CX_ICONES[k]).length`), 0);
});

/* ═══════════════════════════════════════════════════════════════════════════
   RATEIO DO CUSTO FIXO × VIVEIRO PAUSADO

   Esta é a conta do dinheiro, e ela erra em silêncio: ninguém reclama de um
   custo por quilo 30% abaixo do real, porque não existe o número certo na
   tela do lado pra comparar. Por isso o teste principal aqui não é "o número
   bateu com X" — é a PROPRIEDADE: o que os viveiros recebem, somado, tem que
   dar exatamente o custo fixo do período. Nem sobra (dinheiro que ninguém
   pagou) nem falta (dinheiro que sumiu).
   ═══════════════════════════════════════════════════════════════════════════ */

// Novembro de 2026 tem 30 dias. R$ 3.000/mês = R$ 100/dia.
function semearRateio(a, pausas = []) {
  a.run(`
    custosFixos = [{ id:'f1', nome:'Funcionário', categoria:'mao_de_obra',
                     valorMensal:3000, dataInicio:'2026-11-01', dataFim:null, ativo:true }];
    _custosFixosOk = true;
    viveiros = [
      { id:'v1', nome:'V1', dataPovoamento:'2026-11-01', dataPreparacao:null, ciclosFinalizados:[], custos:[], pausas:[] },
      { id:'v2', nome:'V2', dataPovoamento:'2026-11-01', dataPreparacao:null, ciclosFinalizados:[], custos:[], pausas:[] },
      { id:'v3', nome:'V3', dataPovoamento:'2026-11-01', dataPreparacao:null, ciclosFinalizados:[], custos:[], pausas:${JSON.stringify(pausas)} },
    ];
    Date = class extends Date { constructor(...x){ x.length ? super(...x) : super(2026,10,30,12); } };
  `);
}
const rateioDe = (a, i) =>
  a.run(`_custoFixoRateado('2026-11-01','2026-11-30', viveiros[${i}])`);

test("rateio: sem pausa, os três dividem igual e a soma fecha o mês",()=>{
  const a=load(); semearRateio(a);
  const v = [0,1,2].map(i => rateioDe(a, i));
  for (const x of v) assert.ok(Math.abs(x - 1000) < 0.001, String(x));
  assert.ok(Math.abs(v.reduce((s,x)=>s+x,0) - 3000) < 0.001);
});

test("rateio: viveiro parado o mês inteiro nao recebe, e os outros dois pagam tudo",()=>{
  const a=load(); semearRateio(a, [{ de:'2026-11-01', ate:'2026-11-30' }]);
  const v = [0,1,2].map(i => rateioDe(a, i));
  assert.equal(Math.round(v[2]), 0, "o parado nao pode receber nada");
  // Dividido por DOIS, não por três: o parado sai do divisor. Se continuasse
  // nele, V1 e V2 pagariam 1.000 cada e R$ 1.000 sumiriam do mês.
  assert.ok(Math.abs(v[0] - 1500) < 0.001, String(v[0]));
  assert.ok(Math.abs(v.reduce((s,x)=>s+x,0) - 3000) < 0.001, "a soma tem que fechar o mes");
});

test("rateio: pausa no meio do mes cobra so os dias de fora",()=>{
  const a=load(); semearRateio(a, [{ de:'2026-11-11', ate:'2026-11-20' }]);  // 10 dias parado
  const v = [0,1,2].map(i => rateioDe(a, i));
  // 20 dias ÷3 (R$ 33,33/dia) + 10 dias ÷2 (R$ 50/dia) para quem ficou
  assert.ok(Math.abs(v[2] - (20 * 100/3)) < 0.01, String(v[2]));
  assert.ok(Math.abs(v[0] - (20 * 100/3 + 10 * 50)) < 0.01, String(v[0]));
  assert.ok(Math.abs(v.reduce((s,x)=>s+x,0) - 3000) < 0.001, "a soma tem que fechar o mes");
});

test("rateio: pausa em aberto (sem 'ate') vale de la pra frente, e so",()=>{
  const a=load(); semearRateio(a, [{ de:'2026-11-21', ate:null }]);
  const v = [0,1,2].map(i => rateioDe(a, i));
  assert.ok(Math.abs(v[2] - (20 * 100/3)) < 0.01, String(v[2]));
  assert.ok(Math.abs(v.reduce((s,x)=>s+x,0) - 3000) < 0.001);
});

test("rateio: o passado NAO muda quando alguem pausa hoje",()=>{
  // É por isto que a pausa guarda períodos e não um booleano: o rateio é
  // recalculado do zero a cada leitura, então um interruptor reescreveria
  // todos os dias anteriores — e o custo de ciclos já encerrados, já
  // impressos e já mostrados ao cliente, mudaria sozinho.
  const antes = load(); semearRateio(antes);
  const outubroAntes = antes.run(`_custoFixoRateado('2026-11-01','2026-11-10', viveiros[0])`);

  const depois = load(); semearRateio(depois, [{ de:'2026-11-21', ate:null }]);
  const outubroDepois = depois.run(`_custoFixoRateado('2026-11-01','2026-11-10', viveiros[0])`);

  assert.ok(Math.abs(outubroAntes - outubroDepois) < 0.000001,
    `1 a 10 de novembro mudou: ${outubroAntes} -> ${outubroDepois}`);
});

test("rateio: a soma dos itens bate com o total, tambem com pausa",()=>{
  const a=load(); semearRateio(a, [{ de:'2026-11-11', ate:'2026-11-20' }]);
  for (const i of [0, 2]) {
    const total = rateioDe(a, i);
    const soma = a.run(`_custoFixoRateadoPorItem('2026-11-01','2026-11-30', viveiros[${i}])
                        .reduce((s,x)=>s+x.valor,0)`);
    assert.ok(Math.abs(total - soma) < 0.001, `viveiro ${i}: ${total} vs ${soma}`);
  }
});

test("rateio: pausa suja nao quebra a conta",()=>{
  for (const p of ['[]', '[{}]', '[{de:null,ate:null}]', '[{ate:"2026-11-10"}]']) {
    const a=load();
    a.run(`custosFixos=[{id:'f1',nome:'F',categoria:'mao_de_obra',valorMensal:3000,dataInicio:'2026-11-01',dataFim:null,ativo:true}];
           viveiros=[{id:'v1',nome:'V1',dataPovoamento:'2026-11-01',ciclosFinalizados:[],custos:[],pausas:${p}}];
           Date = class extends Date { constructor(...x){ x.length ? super(...x) : super(2026,10,30,12); } };`);
    const v = a.run(`_custoFixoRateado('2026-11-01','2026-11-30', viveiros[0])`);
    assert.ok(Math.abs(v - 3000) < 0.001, `${p} deu ${v}`);
  }
});
