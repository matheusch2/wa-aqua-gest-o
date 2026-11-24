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
    style: {}, dataset: {}, scrollTop: 0, firstElementChild: null,
    __caixa: { height: 0, top: 0, width: 0 },
    getBoundingClientRect() { return this.__caixa; },
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
    navigator:{onLine:true},
    // localStorage DE VERDADE (um Map): a reserva do espaço da faixa de preços
    // guarda e lê a altura da última abertura, e com um stub que devolve null
    // o caminho inteiro ficava sem teste.
    localStorage:(()=>{const m=new Map();return{
      getItem:k=>m.has(k)?m.get(k):null,
      setItem:(k,v)=>m.set(k,String(v)),
      removeItem:k=>m.delete(k),
      __mapa:m};})(),
    getComputedStyle:el=>(el&&el.__estilo)||{marginTop:"0px",marginBottom:"0px"},
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
const PRECO = (g, p, ant, dia) => ({ gramas: g, preco: p, preco_anterior: ant, atualizado_em: dia });

test("preços: dentro do prazo, a faixa mostra",()=>{
  const a=load();
  a.run(`__l = [${JSON.stringify(PRECO(12, 22, 21, '2026-11-13'))}];`);
  assert.equal(a.run(`_precosFrescos(__l, '2026-11-13').itens.length`), 1);
  assert.equal(a.run(`_precosFrescos(__l, '2026-11-23').itens.length`), 1);   // 10 dias: ainda vale
});
test("preços: passou do prazo, a faixa some — não mostra velho",()=>{
  const a=load();
  a.run(`__l = [${JSON.stringify(PRECO(12, 22, 21, '2026-11-13'))}];`);
  assert.equal(a.run(`_precosFrescos(__l, '2026-11-24').itens.length`), 0);   // 11 dias
  assert.equal(a.run(`_precosFrescos(__l, '2026-12-20').itens.length`), 0);
});
test("preços: a validade conta pelo lançamento mais recente",()=>{
  const a=load();
  // um tamanho antigo e outro corrigido hoje: corrigir um não pode envelhecer os outros
  a.run(`__l = [${JSON.stringify(PRECO(10, 18, null, '2026-10-01'))},
                ${JSON.stringify(PRECO(12, 22, 21, '2026-11-13'))}];`);
  assert.equal(a.run(`_precosFrescos(__l, '2026-11-13').itens.length`), 2);
});
// A faixa é lida como régua de tamanho: 8, 10, 12... Fora de ordem ela deixa de
// ser régua e vira lista, e aí o produtor tem de procurar o tamanho dele.
test("preços: a faixa sai em ordem de tamanho, não na ordem do banco",()=>{
  const a=load();
  a.run(`__l = [${JSON.stringify(PRECO(14, 25, null, '2026-11-13'))},
                ${JSON.stringify(PRECO(8,  15, null, '2026-11-13'))},
                ${JSON.stringify(PRECO(30, 41, null, '2026-11-13'))},
                ${JSON.stringify(PRECO(12, 22, null, '2026-11-13'))}];`);
  assert.equal(a.run(`_precosFrescos(__l, '2026-11-13').itens.map(x => x.gramas).join(",")`), "8,12,14,30");
});
// A data VAI junto de propósito. Sem ela, a linha suja era descartada mais
// adiante por falta de carimbo, e o teste passava mesmo com o filtro removido —
// medi plantando o erro. Com data válida, só o filtro segura.
test("preços: lista vazia ou suja não quebra",()=>{
  const a=load();
  const D = `atualizado_em:'2026-11-13'`;
  for (const l of ['[]', 'null', '[{}]', `[{gramas:0, preco:22, ${D}}]`,
                   `[{gramas:12, preco:0, ${D}}]`, `[{gramas:12, preco:-5, ${D}}]`,
                   `[{preco:22, ${D}}]`, `[{gramas:12, ${D}}]`]) {
    a.run(`__r = _precosFrescos(${l}, '2026-11-13');`);
    assert.equal(a.run('__r.itens.length'), 0, l);
  }
});
/* ═══════════════════════════════════════════════════════════════════════════
   A PORTA DOS BOLETOS, NO MENU DO FINANCEIRO

   A porta mostra o estado antes de a pessoa entrar. VENCIDO MANDA: e o que ja
   custa multa, entao vem primeiro e pinta a porta de vermelho mesmo havendo
   vencendo junto — o ambar ao lado de um vencido esconderia a urgencia atras
   da cor mais calma.

   Tem teste porque falha CALADO: escrevi a primeira versao lendo r.vencidos e
   r.vencendo, e os campos chamam nVencidos e nVencendo. A porta nunca ficaria
   vermelha, a tela montaria sem erro nenhum, e o produtor pagaria multa.
   ═══════════════════════════════════════════════════════════════════════════ */
const _bol = (diasAtras, prazo, valor) => ({
  nome: "F", valor, valorPago: 0, pago: false, prazoDias: prazo,
  dataCompra: new Date(Date.UTC(2026, 10, 17) - diasAtras * 86400000).toISOString().substring(0, 10),
});

function _porta(a, lista) {
  a.run(`__p = _finPortaBoletos(${JSON.stringify(lista)}, '2026-11-17');`);
  return { texto: a.run('__p.texto'), classe: a.run('__p.classe').trim() };
}

test("boletos: sem boleto nenhum a porta fica neutra",()=>{
  const a=load();
  const r = _porta(a, []);
  assert.equal(r.classe, "");
  assert.match(r.texto, /cadastrado/);
});

test("boletos: tudo em dia nao pinta a porta",()=>{
  const a=load();
  const r = _porta(a, [_bol(2, 60, 500)]);   // vence daqui a 58 dias
  assert.equal(r.classe, "");
  assert.match(r.texto, /Nenhum boleto em aberto/);
});

test("boletos: so vencendo pinta de ambar",()=>{
  const a=load();
  const r = _porta(a, [_bol(25, 30, 900)]);  // vence em 5 dias
  assert.equal(r.classe, "fin-porta-atencao");
  assert.match(r.texto, /1 vencendo/);
});

/* O que pegou o erro dos campos: com um vencido, a porta TEM de ficar
   vermelha. Com nVencidos escrito errado, ela caia no "em aberto" neutro. */
test("boletos: vencido manda, mesmo com vencendo junto",()=>{
  const a=load();
  const r = _porta(a, [_bol(40, 30, 3200), _bol(25, 30, 900)]);
  assert.equal(r.classe, "fin-porta-vencido");
  assert.match(r.texto, /1 vencido/);
  assert.match(r.texto, /1 vencendo/);
});

test("boletos: boleto pago sai da conta",()=>{
  const a=load();
  const pago = Object.assign(_bol(40, 30, 3200), { pago: true });
  const r = _porta(a, [pago]);
  assert.equal(r.classe, "");
  assert.match(r.texto, /Nenhum boleto em aberto/);
});

/* ═══════════════════════════════════════════════════════════════════════════
   A LUA

   O camarão muda de casca com a lua, e o produtor decide despesca olhando
   isso. Então "lua cheia em 8 dias" não é enfeite: é número que vira decisão.

   A conta ingênua (mês sinódico médio) erra até 0,9 dia — medi. Dezessete
   horas de erro viram um dia inteiro na contagem. Por isso os testes batem
   contra EFEMÉRIDES PUBLICADAS, não contra a própria conta: um teste que só
   conferisse a função com ela mesma passaria igualmente com a conta errada.
   ═══════════════════════════════════════════════════════════════════════════ */
const LUAS = [   // instantes publicados, UTC
  ["nova",  "2026-11-09T07:02:00Z"],
  ["cheia", "2026-11-24T14:53:00Z"],
  ["cheia", "2026-12-24T01:28:00Z"],
];

test("lua: o instante bate com as efemérides, com minutos de folga",()=>{
  const a=load();
  for (const [tipo, quando] of LUAS) {
    const alvo = Date.parse(quando);
    // procura a partir de dez dias antes, para cair nessa lunação
    const achou = a.run(`_luaProxima(${alvo - 10 * 86400000}, ${tipo === "cheia"})`);
    const erroMin = Math.abs(achou - alvo) / 60000;
    assert.ok(erroMin < 10, `${tipo} ${quando}: errou ${erroMin.toFixed(0)} min`);
  }
});

test("lua: o nome da fase acompanha o céu",()=>{
  const a=load();
  const nome = (iso) => a.run(`_luaFase(${Date.parse(iso)}).nome`);
  assert.equal(nome("2026-11-09T07:02:00Z"), "Lua nova");
  assert.equal(nome("2026-11-24T14:53:00Z"), "Lua cheia");
  // entre as duas, crescendo
  assert.ok(/[Cc]rescente/.test(nome("2026-11-16T12:00:00Z")), nome("2026-11-16T12:00:00Z"));
  // depois da cheia, minguando
  assert.ok(/[Mm]inguante/.test(nome("2026-12-01T12:00:00Z")), nome("2026-12-01T12:00:00Z"));
});

/* Este é o que pega a conta ingênua. Em 17/11/2026 a lua cheia é dia 24: são
   7 dias. A conta do mês médio dava a cheia 16h depois do instante real e
   respondia 8. Um dia de diferença numa decisão de despesca. */
test("lua: a contagem de dias é a do calendário, não a da fração",()=>{
  const a=load();
  const dias = (iso, cheia) => a.run(`_luaDiasAte(${Date.parse(iso)}, ${cheia})`);
  assert.equal(dias("2026-11-17T09:00:00Z", true), 7);    // cheia em 24/11
  assert.equal(dias("2026-11-23T23:00:00Z", true), 1);    // amanhã
  assert.equal(dias("2026-11-24T10:00:00Z", true), 0);    // hoje
  assert.equal(dias("2026-11-01T12:00:00Z", false), 8);   // nova em 09/11
});

test("lua: as lunações se seguem sem buraco nem repetição",()=>{
  const a=load();
  let antes = null;
  for (let m = 0; m < 14; m++) {
    const t = a.run(`_luaProxima(${Date.UTC(2026, 0, 1) + m * 30 * 86400000}, false)`);
    assert.ok(t > 0, "achou lua no mês " + m);
    if (antes !== null && t !== antes) {
      const dias = (t - antes) / 86400000;
      assert.ok(dias > 29 && dias < 30.5, `lunação de ${dias.toFixed(2)} dias`);
    }
    antes = t;
  }
});

/* A faixa só existe na tela inicial — lá dentro, num lançamento, ela é
   barulho. A pegadinha é que "tela inicial" muda com o tamanho: no celular é o
   painel da fazenda, e a lista de viveiros é tela de DENTRO; no desktop não há
   painel e a lista É a inicial. Errei isso duas vezes, e erra calado: a faixa
   fica acesa onde não devia e nada quebra. */
test("faixa: a tela inicial do celular é o painel, a do desktop é a lista",()=>{
  const a=load();
  const v = (larg, home, lista, saindo) => a.run(`_fitaNaInicial(${larg}, ${home}, ${lista}, ${saindo})`);
  // celular: manda o painel, a lista não conta
  assert.equal(v(390, true,  false, false), true);
  assert.equal(v(390, false, true,  false), false);
  // desktop: manda a lista, e o painel não existe lá
  assert.equal(v(1100, false, true,  false), true);
  assert.equal(v(1100, false, false, false), false);
  assert.equal(v(1100, true,  false, false), false);
  // saindo da inicial some nos dois, mesmo com a tela anterior ainda na área
  assert.equal(v(390,  true, true, true), false);
  assert.equal(v(1100, true, true, true), false);
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
  // Calcário e dolomita passaram a cair na chave "saco" quando as embalagens
  // entraram. Não mudou desenho nenhum: _CX_ICONES.calcario e _CX_ICONES.saco
  // apontam para o MESMO icone-produto-saco.webp — conferi. O que o teste
  // continua guardando é que eles não caem em "outro" nem viram ração.
  assert.equal(chave('Calcário'), 'saco');          // com acento
  assert.equal(chave('Outros', 'Dolomita (P)'), 'saco');
  assert.equal(chave('Outros', 'Óxido de cálcio'), 'saco');
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

test("pausa: parar e retomar no mesmo dia nao deixa pausa nenhuma",()=>{
  // Uma pausa de zero dia não é pausa. Fechando-a em si mesma, o dia de hoje
  // ficava marcado como parado e a tela continuava dizendo "parado para
  // reforma" DEPOIS de retomar — o botão parecia não funcionar.
  const a=load();
  a.run(`Date = class extends Date { constructor(...x){ x.length ? super(...x) : super(2026,10,13,12); } };
         __v = { pausas: [{ de:'2026-11-13', ate:null }] };
         __hoje = _hojeLocal();
         __ontem = _maAddDias(__hoje, -1);
         __novas = __v.pausas
           .filter(p => !(p && p.de && !p.ate && p.de >= __hoje))
           .map(p => (p && p.de && !p.ate) ? { de: p.de, ate: __ontem } : p);`);
  assert.equal(a.run('__novas.length'), 0);
});

test("pausa: retomar depois de dias fecha o periodo ONTEM",()=>{
  // Ontem, e não hoje: hoje o viveiro já voltou a trabalhar, então hoje já
  // conta pro rateio.
  const a=load();
  a.run(`Date = class extends Date { constructor(...x){ x.length ? super(...x) : super(2026,10,13,12); } };
         __hoje = _hojeLocal(); __ontem = _maAddDias(__hoje, -1);
         __novas = [{ de:'2026-11-01', ate:null }]
           .filter(p => !(p && p.de && !p.ate && p.de >= __hoje))
           .map(p => (p && p.de && !p.ate) ? { de: p.de, ate: __ontem } : p);
         __v = { pausas: __novas };`);
  assert.equal(a.run('__novas[0].ate'), '2026-11-12');
  assert.equal(a.run('_viveiroPausadoEm(__v, "2026-11-12")'), true);
  assert.equal(a.run('_viveiroPausadoEm(__v, "2026-11-13")'), false, "hoje ja voltou a contar");
});

test("pausa: dias em preparacao descontam o que ficou parado",()=>{
  const a=load();
  a.run(`Date = class extends Date { constructor(...x){ x.length ? super(...x) : super(2026,10,30,12); } };
         __v = { dataPreparacao:'2026-11-01', pausas:[{ de:'2026-11-11', ate:'2026-11-20' }] };`);
  // 30 dias de novembro menos os 10 parados
  assert.equal(a.run('_diasEmPreparacao(__v)'), 20);
  a.run(`__v2 = { dataPreparacao:'2026-11-01', pausas:[] };`);
  assert.equal(a.run('_diasEmPreparacao(__v2)'), 30);
});

/* ═══════════════════════════════════════════════════════════════════════════
   EDITAR UM VIVEIRO ESPERANDO DESPESCA

   Bug relatado pelo dono: ele batizou um viveiro com um emoji no nome sem
   querer e não conseguia mais corrigir. O formulário de edição pedia "Total
   povoado" e "Laboratório" — dois campos que um viveiro esperando despesca
   NUNCA vai ter, porque ele é justamente o que não tem histórico. A validação
   barrava o salvamento e o cliente ficava trancado do lado de fora do próprio
   cadastro, sem saída pela interface.
   ═══════════════════════════════════════════════════════════════════════════ */
function telaEditar(a, viveiro) {
  a.run(`viveiros = [${JSON.stringify(viveiro)}];
         assinatura = { plano: 'pro', ativo: true };
         editarNomeViveiro(0);`);
  return a.get("area-gestao").innerHTML;
}

test("editar: viveiro esperando despesca nao pede total povoado nem laboratorio",()=>{
  const a=load();
  const html = telaEditar(a, { id:'v1', nome:'Viveiro - 6', tamanho:0.9,
    dataPovoamento:'2026-11-12', dataPreparacao:null, totalPovoado:null, laboratorio:null,
    semHistorico:true, pausas:[], custos:[], racoes:[], biometrias:[], ciclosFinalizados:[] });
  assert.ok(html.includes('id="editNomeViveiro"'), "tem que dar pra corrigir o nome");
  assert.ok(html.includes('id="editTamanhoViveiro"'));
  assert.ok(html.includes('id="editDataEspera"'), "e a data em que a espera comecou");
  assert.ok(!html.includes('id="editTotalPovoado"'), "total povoado NAO pode aparecer");
  assert.ok(!html.includes('id="editLaboratorio"'), "laboratorio NAO pode aparecer");
});

test("editar: viveiro em cultivo normal continua pedindo os tres campos",()=>{
  const a=load();
  const html = telaEditar(a, { id:'v1', nome:'Viveiro 1', tamanho:1.2,
    dataPovoamento:'2026-08-24', dataPreparacao:null, totalPovoado:'140000', laboratorio:'Aquatec',
    semHistorico:false, pausas:[], custos:[], racoes:[], biometrias:[], ciclosFinalizados:[] });
  assert.ok(html.includes('id="editDataPovoamento"'));
  assert.ok(html.includes('id="editTotalPovoado"'));
  assert.ok(html.includes('id="editLaboratorio"'));
  assert.ok(!html.includes('id="editDataEspera"'));
});

test("editar: viveiro em preparacao continua pedindo so a data de preparacao",()=>{
  const a=load();
  const html = telaEditar(a, { id:'v1', nome:'Viveiro 3', tamanho:1.5,
    dataPovoamento:null, dataPreparacao:'2026-10-01', totalPovoado:null, laboratorio:null,
    semHistorico:false, pausas:[], custos:[], racoes:[], biometrias:[], ciclosFinalizados:[] });
  assert.ok(html.includes('id="editDataPreparacao"'));
  assert.ok(!html.includes('id="editTotalPovoado"'));
  assert.ok(!html.includes('id="editDataEspera"'));
});

test("editar: a tela de editar nao carrega o bloco do CADASTRO",()=>{
  // Eu injetei o bloco "esperando despesca" do cadastro usando como âncora um
  // trecho que existe nas DUAS telas, e ele foi parar na de editar também —
  // escondido, mas com id duplicado e pronto pra confundir a próxima pessoa.
  const a=load();
  for (const sem of [true, false]) {
    const html = telaEditar(a, { id:'v1', nome:'V', tamanho:1, dataPovoamento:'2026-11-12',
      dataPreparacao:null, totalPovoado:'1', laboratorio:'L', semHistorico:sem,
      pausas:[], custos:[], racoes:[], biometrias:[], ciclosFinalizados:[] });
    assert.ok(!html.includes('id="cad-espera"'), `semHistorico=${sem}`);
    assert.ok(!html.includes('id="dataEspera"'), `semHistorico=${sem}`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   OS CARTÕES QUE RODAM NO PAINEL

   O que estes testes guardam não é o visual: é a regra de que POUCO DADO NÃO
   VIRA CONCLUSÃO. "Laboratório mais lucrativo" com dois ciclos de dois
   laboratórios é cara ou coroa vestida de conclusão, e alguém troca de
   fornecedor por causa disso. Cada cartão de comparação só entra no rodízio
   com base suficiente — e é fácil alguém afrouxar isso sem perceber.
   ═══════════════════════════════════════════════════════════════════════════ */
function _semearPainel(ciclos) {
  return `viveiros = [{ id:'v1', nome:'V1', dataPovoamento:'2026-09-01', dataPreparacao:null,
    totalPovoado:'100000', pausas:[], semHistorico:false, custos:[], racoes:[], biometrias:[],
    ciclosFinalizados: ${JSON.stringify(ciclos)} }];
    custosFixos = []; _custosFixosOk = true;
    Date = class extends Date { constructor(...x){ x.length ? super(...x) : super(2026,10,15,12); } };`;
}
const cicloBase = (over) => Object.assign({
  id: "c" + Math.random(), nomeViveiro: "V1", laboratorio: "Aquatec", cicloId: null,
  dataPovoamento: "2026-01-10", dataEncerramento: "2026-05-10", dataPreparacao: null,
  producaoFinal: 1000, producaoTotal: 1000, precoVenda: 20, despescas: [],
  fca: 1.4, sobrevivencia: 70, custoFixoRateado: 0,
}, over);

const cartoes = (a, ciclos) => {
  a.run(_semearPainel(ciclos));
  a.run(`__c = _insightsFazenda(viveiros, '2026-11-15', _resumoFazenda(viveiros, '2026-11-15'));`);
  return a.run(`__c.map(x => x.rotulo).join(" | ")`);
};

test("painel: 'melhor laboratorio' NAO aparece com um laboratorio so",()=>{
  const a=load();
  const r = cartoes(a, [cicloBase({laboratorio:"Aquatec"}), cicloBase({laboratorio:"Aquatec"}),
                        cicloBase({laboratorio:"Aquatec"})]);
  assert.ok(!r.includes("Melhor lab."), r);
});

test("painel: 'melhor laboratorio' NAO aparece com menos de tres ciclos",()=>{
  const a=load();
  const r = cartoes(a, [cicloBase({laboratorio:"Aquatec"}), cicloBase({laboratorio:"Marés"})]);
  assert.ok(!r.includes("Melhor lab."), "dois ciclos nao decidem laboratorio: " + r);
});

test("painel: com tres ciclos e dois laboratorios, ele aparece e escolhe o de maior media",()=>{
  const a=load();
  const r = cartoes(a, [
    cicloBase({laboratorio:"Aquatec", producaoFinal:1000, producaoTotal:1000, precoVenda:20}),
    cicloBase({laboratorio:"Aquatec", producaoFinal:1000, producaoTotal:1000, precoVenda:20}),
    cicloBase({laboratorio:"Marés",   producaoFinal:100,  producaoTotal:100,  precoVenda:20}),
  ]);
  assert.ok(r.includes("Melhor lab."), r);
  assert.equal(a.run(`__c.find(x => x.rotulo === "Melhor lab.").valor`), "Aquatec");
});

test("painel: 'melhor ciclo' NAO aparece com um ciclo so",()=>{
  const a=load();
  const r = cartoes(a, [cicloBase({})]);
  assert.ok(!r.includes("Melhor ciclo"), "com um ciclo, 'melhor' nao quer dizer nada: " + r);
  assert.ok(cartoes(a, [cicloBase({}), cicloBase({})]).includes("Melhor ciclo"));
});

test("painel: fazenda sem ciclo encerrado mostra so o que nao depende de historico",()=>{
  const a=load();
  const r = cartoes(a, []);
  for (const some of ["Melhor lab.", "Melhor ciclo", "Melhor FCA", "Produção"])
    assert.ok(!r.includes(some), `${some} nao devia aparecer: ${r}`);
  assert.ok(r.includes("Lucro"), r);
  // O segundo cartão é o que fala do viveiro em cultivo — o único que tem
  // assunto numa fazenda que ainda não fechou ciclo nenhum. Era "Próxima
  // despesca"; virou "Última biometria" quando o painel foi refeito. O teste
  // guarda a REGRA (sem histórico, ainda sobra um cartão vivo), não o nome.
  assert.ok(r.includes("Última biometria") || r.includes("Próxima despesca"), r);
});

test("painel: todo cartao de comparacao diz de quantos ciclos saiu",()=>{
  const a=load();
  cartoes(a, [cicloBase({laboratorio:"Aquatec"}), cicloBase({laboratorio:"Aquatec"}),
              cicloBase({laboratorio:"Marés"})]);
  const semNota = a.run(`__c.filter(x => /lab\\.|ciclo 2026|FCA|Produção/i.test(x.rotulo))
                              .filter(x => !/ciclo/.test(x.nota || "")).map(x => x.rotulo).join(",")`);
  assert.equal(semNota, "", "estes cartoes precisam dizer a base: " + semNota);
});

/* ───────────────────────────────────────────────────────────────────────────
   O AQUECIMENTO DAS ARTES SÓ SERVE SE OS ENDEREÇOS BATEREM

   _aquecerArtes() busca os desenhos no tempo ocioso para que a tela não os
   peça na hora do toque. Isso só funciona se o endereço aquecido for o MESMO
   que a tela pede, "?v=" incluído — um "?v=" diferente é outra chave de cache,
   e o aquecimento vira download inútil.

   O jeito de quebrar isto é banal e silencioso: trocar o "?v=" de uma arte na
   tela e esquecer da lista. Nada dá erro, nada aparece no console, e a lentidão
   volta sozinha. Daí este teste.
   ─────────────────────────────────────────────────────────────────────────── */
test("aquecimento: toda arte aquecida é uma arte que alguma tela realmente pede", () => {
  const bloco = source.match(/const _ARTES_DAS_TELAS = \[([\s\S]*?)\];/);
  assert.ok(bloco, "não achei a lista _ARTES_DAS_TELAS no script.js");
  const aquecidas = [...bloco[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
  assert.ok(aquecidas.length >= 5, "a lista de artes aquecidas encolheu: " + aquecidas.length);

  // Em vez de procurar texto solto no arquivo, MONTA as telas e lê o que elas
  // pedem de verdade. O "?v=" das portas da Simular venda mora num template a
  // vinte linhas da chamada, e nenhuma busca por proximidade acerta isso.
  const a = load();
  a.run(`viveiros = [{ id:'v1', nome:'V1', ciclosFinalizados:[],
      dataPovoamento:'2026-06-01', quantidadePovoada:250000, areaHectare:1,
      biometrias:[{id:'b1',data:'2026-07-01',gramatura:10}], racoes:[], custos:[] }];`);
  const pedidos = new Set();
  const colher = (html) => {
    for (const m of String(html || "").matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g))
      pedidos.add(m[1]);
  };
  for (const tela of ["abrirRelatorios()", "abrirSimularVenda()", "mostrarListaViveiros()"]) {
    try { a.run(tela); } catch (e) { /* tela que precisa de mais dado: tudo bem */ }
    colher(a.get("area-gestao").innerHTML);
  }
  // As pastilhas de custo não passam por uma tela: são uma constante.
  colher(a.run("Object.values(_CX_ICONES).join('')").replace(/href=/g, 'src='));

  assert.ok(pedidos.size >= 5,
    "as telas não produziram artes suficientes para o teste valer: " + [...pedidos].join(", "));

  const normal = (u) => u.replace(/^.*?assets\//, "assets/");
  const lista = new Set(aquecidas.map(normal));
  for (const pedido of pedidos) {
    assert.ok(lista.has(normal(pedido)),
      `a tela pede "${pedido}" e o aquecimento não tem esse endereço exato. ` +
      `Se foi só o "?v=" que mudou, o aquecimento virou download inútil ` +
      `e a lentidão voltou em silêncio. Lista atual: ${[...lista].join(", ")}`);
  }
});

test("aquecimento: nenhuma arte de tela ficou de fora da lista", () => {
  const bloco = source.match(/const _ARTES_DAS_TELAS = \[([\s\S]*?)\];/);
  const aquecidas = new Set([...bloco[1].matchAll(/"([^"]+)"/g)]
    .map(m => m[1].replace(/^.*\//, "").replace(/\?.*$/, "")));
  const telas = source.replace(bloco[0], "");

  // Toda arte .webp que alguma tela cita tem de estar sendo aquecida. Foto de
  // fazenda e avatar não entram: são de cada cliente, não arte do app.
  const citadas = new Set([...telas.matchAll(/([a-z0-9-]+\.webp)/gi)].map(m => m[1]));
  const faltando = [...citadas].filter(a => !aquecidas.has(a));
  assert.deepEqual(faltando, [],
    "arte de tela fora do aquecimento — vai nascer com o quadrado vazio: " + faltando.join(", "));
});

/* ───────────────────────────────────────────────────────────────────────────
   O ESPAÇO GUARDADO DA FAIXA DE PREÇOS

   A faixa chega do banco depois da tela já pintada, e como ela mora ACIMA do
   primeiro card, ao nascer empurrava tudo para baixo. Medido num Chromium com
   a rede estrangulada no servidor: 30px de uma vez, logo depois da tela de
   abertura sair. Era o "quando eu abro ela, é como se ela fosse descendo".

   A correção guarda a altura da última abertura e já nasce com o buraco do
   tamanho certo. Dois detalhes dela são fáceis de desfazer sem perceber, e é
   deles que estes testes cuidam.
   ─────────────────────────────────────────────────────────────────────────── */
test("faixa de preços: guarda o espaço que ela OCUPA, não a altura da caixa", () => {
  const a = load();
  const fita = a.get("fita-precos");
  const barra = element();
  // A .fp-barra tem margin: 10px -18px -12px. Como o #fita-precos não tem
  // borda nem padding, essas margens vazam para fora dele: a faixa ocupa
  // 32 + 10 - 12 = 30px, não 32. Guardar 32 fazia a tela subir 2px quando a
  // faixa real entrava — pequeno, mas é o mesmo defeito de novo, menor.
  barra.__estilo = { marginTop: "10px", marginBottom: "-12px" };
  fita.firstElementChild = barra;
  fita.__caixa = { height: 32, top: 0, width: 390 };

  a.run("_soltarEspacoDaFita()");

  assert.equal(a.run("localStorage.getItem('fitaPrecosAltura')"), "30",
    "guardou a altura da caixa em vez do espaço ocupado: a tela vai pular quando a faixa entrar");
});

test("faixa de preços: a reserva nasce do que foi guardado, e some quando não há preço", () => {
  const a = load();
  a.run("localStorage.setItem('fitaPrecosAltura','30')");
  const fita = a.get("fita-precos");

  a.run("_reservarEspacoDaFita()");
  assert.equal(fita.style.minHeight, "30px",
    "o buraco da faixa não foi reservado: a tela volta a descer quando o preço chegar");
  assert.equal(fita.classList.contains("fp-reservado"), true,
    "sem a classe, o :empty do CSS some com o espaço e a reserva não vale nada");

  // Administrador tirou a tabela do ar: _fitaPrecos não acha o que mostrar.
  // A reserva tem de ser desfeita, senão fica um vão vazio para sempre.
  a.run("precosCamarao = [];");
  fita.__caixa = { height: 0, top: 0, width: 390 };
  fita.firstElementChild = null;
  a.run("_fitaPrecos()");
  assert.equal(fita.classList.contains("fp-reservado"), false,
    "sem preço nenhum, a reserva continuou lá e vai sobrar um vão em branco");
  assert.equal(a.run("localStorage.getItem('fitaPrecosAltura')"), null,
    "sem preço nenhum, a altura guardada tinha de ser apagada");
});

test("faixa de preços: fora da tela inicial, não mede nem apaga o que estava guardado", () => {
  const a = load();
  a.run("localStorage.setItem('fitaPrecosAltura','30')");
  const fita = a.get("fita-precos");
  fita.classList.add("fp-fora");          // está escondida: mediria zero
  fita.__caixa = { height: 0, top: 0, width: 390 };

  a.run("_soltarEspacoDaFita()");

  assert.equal(a.run("localStorage.getItem('fitaPrecosAltura')"), "30",
    "mediu a faixa escondida e apagou a reserva: a próxima abertura volta a descer");
});

/* ───────────────────────────────────────────────────────────────────────────
   EDITAR O CUSTO FIXO PELA LINHA DO EXTRATO

   No extrato, "Mão de obra · R$ 320" não é um lançamento: é a FATIA daquele
   viveiro no custo fixo do mês. Não existe editar a fatia — edita-se o custo
   fixo que a gerou, e ela se recalcula.

   Para o menu poder abrir o cadastro certo, o rateio precisa SAIR com a
   identificação do custo fixo. Ele agrupava por essa chave e devolvia só os
   valores, jogando a chave fora; é essa perda que estes testes guardam.
   ─────────────────────────────────────────────────────────────────────────── */
function semearDoisFixos(a) {
  a.run(`custosFixos=[
      {id:'f-mo',nome:'Mão de obra',categoria:'mao_de_obra',valorMensal:3000,dataInicio:'2026-11-01',dataFim:null,ativo:true},
      {id:'f-en',nome:'Energia',categoria:'energia',valorMensal:600,dataInicio:'2026-11-01',dataFim:null,ativo:true}];
    viveiros=[{id:'v1',nome:'V1',dataPovoamento:'2026-11-01',ciclosFinalizados:[],custos:[],pausas:[]}];
    Date = class extends Date { constructor(...x){ x.length ? super(...x) : super(2026,10,30,12); } };`);
}

test("extrato: cada item do rateio sai com a chave do custo fixo que o gerou",()=>{
  const a=load(); semearDoisFixos(a);
  const itens = a.run(`JSON.stringify(_custoFixoRateadoPorItem('2026-11-01','2026-11-30', viveiros[0]))`);
  const lista = JSON.parse(itens);
  assert.equal(lista.length, 2, "esperava um item por custo fixo");
  for (const it of lista) {
    assert.ok(it.chave,
      `"${it.nome}" veio sem chave — o menu do extrato não tem como saber qual custo fixo abrir`);
    const achou = a.run(`custosFixos.some(c => (c.id || c.nome) === ${JSON.stringify(it.chave)})`);
    assert.ok(achou, `a chave "${it.chave}" não corresponde a nenhum custo fixo cadastrado`);
  }
});

test("extrato: a chave abre o custo fixo CERTO, mesmo com acento e espaço",()=>{
  const a=load(); semearDoisFixos(a);
  // Sem id, a chave vira o nome — e nome com acento viaja codificado dentro
  // do onclick. Decodificar no destino é o que faz "Mão de obra" casar.
  a.run(`custosFixos[0].id = null;`);
  const itens = JSON.parse(a.run(`JSON.stringify(_custoFixoRateadoPorItem('2026-11-01','2026-11-30', viveiros[0]))`));
  const mo = itens.find(x => /obra/i.test(x.nome));
  assert.equal(mo.chave, "Mão de obra", "sem id, a chave tem de ser o nome");

  // Simula a viagem pelo onclick: codifica na ida, a função decodifica.
  const abriu = a.run(`(() => {
      let aberto = null, erro = null;
      const original = _toastErro;
      abrirFormCustoFixo = (i) => { aberto = i; };
      _toastErro = (m) => { erro = m; };
      try { abrirCustoFixoPelaChave(encodeURIComponent(${JSON.stringify(mo.chave)}).replace(/'/g, "%27")); }
      finally { _toastErro = original; }
      return JSON.stringify({ aberto, erro });
    })()`);
  const r = JSON.parse(abriu);
  assert.equal(r.erro, null, "disse que não achou um custo fixo que existe");
  assert.equal(r.aberto, 0, "abriu o índice errado em custosFixos");
});

test("extrato: chave que não existe mais avisa, não abre formulário vazio",()=>{
  const a=load(); semearDoisFixos(a);
  // ATENCAO AO QUE ESTE TESTE JA ERROU: a primeira versao fazia
  // `mostrarErro = (m) => ...`, e com isso CRIAVA a funcao que deveria estar
  // conferindo. O teste passava e o app quebrava calado, porque mostrarErro
  // nao existe como global — e so uma variavel local dentro de
  // salvarCustoFixo. Agora o duble substitui _toastErro, que existe de
  // verdade, e o teste confere que a funcao real foi chamada.
  const r = JSON.parse(a.run(`(() => {
      let aberto = null, erro = null;
      if (typeof _toastErro !== "function") throw new Error("_toastErro nao existe mais");
      const original = _toastErro;
      abrirFormCustoFixo = (i) => { aberto = i; };
      _toastErro = (m) => { erro = m; };
      try { abrirCustoFixoPelaChave('f-que-foi-apagado'); }
      finally { _toastErro = original; }
      return JSON.stringify({ aberto, erro });
    })()`));
  assert.equal(r.aberto, null, "abriu um formulário para um custo fixo que não existe");
  assert.match(String(r.erro), /não está mais cadastrad/i);
});

test("extrato: a linha de custo fixo oferece editar, e NUNCA excluir",()=>{
  // Excluir dali apagaria mão de obra, energia e aluguel de TODOS os
  // viveiros e de todo o histórico, a partir de uma tela que mostra um
  // viveiro só. O menu tem de ter um item, não dois.
  const html = source.match(/function _cxLinha\(\{[\s\S]*?\n\}/)[0];
  assert.match(html, /acoes\.excluir \?/,
    "o botão Excluir voltou a ser incondicional em _cxLinha");

  for (const trecho of source.match(/acoes: it\.chave \? \{[\s\S]*?\} : null/g) || []) {
    assert.match(trecho, /abrirCustoFixoPelaChave/, "a linha do rateio parou de abrir o custo fixo");
    assert.ok(!/excluir:/.test(trecho),
      "alguém pôs Excluir na linha de custo fixo do extrato: apagaria para todos os viveiros");
  }
  const quantas = (source.match(/acoes: it\.chave \? \{/g) || []).length;
  assert.equal(quantas, 2, `esperava as duas visões do extrato (Detalhado e Geral), achei ${quantas}`);
});

/* ───────────────────────────────────────────────────────────────────────────
   O QUE CUSTOU  ×  O QUE SAIU DO CAIXA

   Nasceu de uma pergunta de cliente: "já paguei os R$ 4.000 de aluguel, por
   que o sistema não mostra?". Mostrava — espalhado em 90 dias, porque o
   sistema é por competência. As duas respostas estão certas; faltava a
   segunda existir.

   O risco desta tela não é dar erro: é dar um número REDONDO E INCOMPLETO
   que parece o caixa inteiro. Os testes abaixo guardam justamente os limites
   que a tela promete por escrito.
   ─────────────────────────────────────────────────────────────────────────── */
function cenarioCaixa(a) {
  a.run(`_finRegime = 'caixa'; _finPeriodoIni = '2026-11-01'; _finPeriodoFim = '2026-11-30';
    custosFixos=[{id:'f-al',nome:'Aluguel',categoria:'aluguel',valorMensal:4000,
                  dataInicio:'2026-11-01',dataFim:null,ativo:true}];
    viveiros=[{id:'v1',nome:'V1',dataPovoamento:'2026-11-01',ciclosFinalizados:[],pausas:[],
      custos:[{id:'c1',tipo:'outro',nomeProduto:'Ração',valor:500,categoria:'Ração',data:'2026-11-04'},
              {id:'c2',tipo:'outro',nomeProduto:'Cal',valor:120,categoria:'Outro',data:'2026-10-20'}]}];
    boletos=[
      {id:'b1',nome:'Aluguel do sítio',fornecedor:'Dona Maria',valor:4000,
       dataCompra:'2026-11-05',prazoDias:5,pago:true,dataPagamento:'2026-11-10',
       valorPago:4000,pagamentos:[{data:'2026-11-10',valor:4000}]},
      {id:'b2',nome:'Ração a prazo',fornecedor:'Agromar',valor:1000,
       dataCompra:'2026-11-02',prazoDias:30,pago:false,valorPago:400,
       pagamentos:[{data:'2026-11-08',valor:150},{data:'2026-12-20',valor:250}]}];
    Date = class extends Date { constructor(...x){ x.length ? super(...x) : super(2026,10,30,12); } };`);
}

test("caixa: o boleto entra no dia do PAGAMENTO, não no da compra",()=>{
  const a=load(); cenarioCaixa(a);
  const s = JSON.parse(a.run(`JSON.stringify(_finSaidasDeCaixa().saidas)`));
  const aluguel = s.find(x => /sítio/.test(x.nome));
  assert.ok(aluguel, "o boleto pago não apareceu no caixa");
  assert.equal(aluguel.data, "2026-11-10", "entrou pela data da compra, não do pagamento");
  assert.equal(aluguel.valor, 4000);
  assert.equal(aluguel.origem, "boleto");
});

test("caixa: cada pagamento parcial conta no seu próprio dia",()=>{
  const a=load(); cenarioCaixa(a);
  const s = JSON.parse(a.run(`JSON.stringify(_finSaidasDeCaixa().saidas)`));
  const parciais = s.filter(x => /prazo/.test(x.nome));
  assert.equal(parciais.length, 1,
    "esperava só a parcela de novembro; a de dezembro está fora do período");
  assert.equal(parciais[0].valor, 150);
  assert.equal(parciais[0].data, "2026-11-08");
});

test("caixa: custo fixo NUNCA entra — é a promessa escrita na tela",()=>{
  // O sistema sabe que o aluguel custa R$ 4.000/mês, mas não sabe em que dia
  // foi pago. Somar o rateio aqui seria competência disfarçada de caixa, que
  // é exatamente o engano que esta tela existe para desfazer.
  const a=load(); cenarioCaixa(a);
  const s = JSON.parse(a.run(`JSON.stringify(_finSaidasDeCaixa().saidas)`));
  for (const x of s) {
    assert.notEqual(x.origem, "fixo", "custo fixo vazou para o caixa");
    assert.ok(!/rateio/i.test(x.nome), `"${x.nome}" parece rateio e não pode estar no caixa`);
  }
  // E o total do caixa tem de ser diferente do da competência neste cenário,
  // senão as duas réguas estão medindo a mesma coisa e a tela não serve.
  const caixa = s.reduce((t,x)=>t+x.valor,0);
  const comp = a.run(`_custoFixoRateado('2026-11-01','2026-11-30', viveiros[0])`) + 500;
  assert.notEqual(Math.round(caixa), Math.round(comp),
    "caixa e competência deram o mesmo número — a separação não está valendo");
});

test("caixa: respeita o período, pelo dia do dinheiro",()=>{
  const a=load(); cenarioCaixa(a);
  const s = JSON.parse(a.run(`JSON.stringify(_finSaidasDeCaixa().saidas)`));
  assert.ok(!s.some(x => /Cal/.test(x.nome)),
    "entrou um custo de outubro num período de novembro");
  for (const x of s) {
    assert.ok(x.data >= "2026-11-01" && x.data <= "2026-11-30", `${x.nome} em ${x.data}`);
  }
});

test("fluxo: e da FAZENDA — viveiro escolhido no Relatorio nao vaza para ca",()=>{
  // O Fluxo nao tem seletor de viveiro: caixa e dinheiro da empresa saindo,
  // e nem haveria o que mostrar por viveiro (boleto nao tem viveiro). O
  // marcador e explicito de proposito: depender de "o <select> nao esta na
  // tela" faria uma tela nova somar a fazenda sem querer, e o numero
  // continuaria parecendo certo.
  const a=load(); cenarioCaixa(a);
  a.run(`document.getElementById('viveiroFinanceiro').value = '0'; _finEscopoFazenda = true;`);
  const r = JSON.parse(a.run(`JSON.stringify(_finSaidasDeCaixa())`));
  assert.equal(r.porViveiro, false, "o viveiro escolhido alcancou o Fluxo");
  assert.ok(r.saidas.some(x => x.origem === "boleto"),
    "o boleto da fazenda sumiu: o Fluxo esta se comportando como se fosse de um viveiro");

  // E a competencia, no Fluxo, tambem e da fazenda inteira.
  const c = JSON.parse(a.run(`JSON.stringify(_finColetarCustos().porViveiro)`));
  assert.equal(c, false, "a competencia do Fluxo ficou presa a um viveiro");
});

test("fluxo: as duas entradas marcam o escopo, e o Relatorio desmarca",()=>{
  const fluxo = source.match(/function abrirFluxoDe\(regime\)[\s\S]*?\n\}/)[0];
  assert.match(fluxo, /_finEscopoFazenda = true/,
    "abrirFluxoDe parou de marcar o escopo de fazenda");
  assert.ok(!/id="viveiroFinanceiro"/.test(fluxo),
    "voltou o seletor de viveiro para o Fluxo; ele e da fazenda inteira");

  const rel = source.match(/function abrirFinanceiro\(\)[\s\S]*?\n\}/)[0];
  assert.match(rel, /_finEscopoFazenda = false/,
    "o Relatorio nao desmarca o escopo: depois de ver o Fluxo, o viveiro escolhido seria ignorado la");
  assert.match(rel, /id="viveiroFinanceiro"/, "o Relatorio perdeu o seletor de viveiro");
});

test("caixa: lancar custo NAO e pagar — custo lancado nao vira saida",()=>{
  // Comprar probiotico a prazo e custo hoje e dinheiro saindo em 30 dias.
  // Usar a data do lancamento como dia do pagamento e chute, e no caixa
  // nao cabe chute. O cenario tem um custo de R$ 500 em 04/11 que NAO pode
  // aparecer; so o boleto pago e as parcelas entram.
  const a=load(); cenarioCaixa(a);
  const s = JSON.parse(a.run(`JSON.stringify(_finSaidasDeCaixa().saidas)`));
  assert.ok(s.length > 0, "o cenario tem boleto pago, o caixa nao podia estar vazio");
  for (const x of s) {
    assert.equal(x.origem, "boleto",
      `"${x.nome}" entrou no caixa sem ser pagamento registrado`);
  }
  // O boleto do cenario se chama "Racao a prazo", entao procurar a palavra
  // "racao" acusaria o inocente. O que prova a regra e o TOTAL: so os
  // pagamentos de boleto do periodo (4000 + 150), sem os R$ 500 do custo.
  const total = s.reduce((t,x)=>t+x.valor,0);
  assert.equal(total, 4150,
    `o caixa somou ${total}: deviam ser so os 4150 de boleto pago, sem o custo lancado`);
});

test("caixa: a tela mostra o total e nada mais que texto",()=>{
  // O dono tirou os textos explicativos: o aviso ambar, a comparacao com a
  // competencia e as frases de apoio. O que guarda a honestidade do numero
  // agora e so o codigo (_finSaidasDeCaixa), nao a tela.
  const bloco = source.match(/function _finRenderCaixa\([\s\S]*?\n\}/)[0];
  assert.match(bloco, /fin-caixa-total/, "sumiu o total do caixa");
  assert.ok(!/fin-caixa-aviso|fin-caixa-contra/.test(bloco),
    "os textos voltaram; se forem desejados de novo, e decisao do dono, nao acidente");
});

test("fluxo: o Relatorio financeiro NUNCA mostra o caixa",()=>{
  // _finRegime e global e a tela de Fluxo mexe nele. Sem a linha que fixa
  // competencia em abrirFinanceiro, quem visse o caixa e depois abrisse o
  // relatorio veria a tela de caixa dentro dos filtros do relatorio.
  const bloco = source.match(/function abrirFinanceiro\(\)[\s\S]*?\n\}/)[0];
  assert.match(bloco, /_finRegime = "competencia"/,
    "abrirFinanceiro parou de fixar competencia — o caixa vai vazar para o relatorio");
  assert.ok(!/fin-regime-btn/.test(bloco),
    "os botoes de regime voltaram para o relatorio; eles moram na tela de Fluxo");
});

test("fluxo: a escolha vem ANTES do numero",()=>{
  // Duas reguas nao sao dois formatos: sao duas perguntas. Mostrar um numero
  // na tela de escolha faria o produtor achar que ja e a resposta.
  const bloco = source.match(/function abrirFluxo\(\)[\s\S]*?\n\}/)[0];
  assert.match(bloco, /abrirFluxoDe\('competencia'\)/);
  assert.match(bloco, /abrirFluxoDe\('caixa'\)/);
  assert.ok(!/formatarNumeroBR|R\$/.test(bloco),
    "a tela de escolha passou a mostrar valor; ela so pergunta");
});

test("fluxo: no caixa nao existe Detalhado/Por tipo",()=>{
  // Aqueles dois botoes sao do mundo da competencia: no caixa a lista e
  // sempre por dia, e eles nao teriam o que fazer.
  const bloco = source.match(/function abrirFluxoDe\(regime\)[\s\S]*?\n\}/)[0];
  assert.match(bloco, /caixa \? "" : `<div class="fin-modo-toggle"/,
    "o seletor Detalhado/Por tipo deixou de ser escondido no caixa");
});

test("financeiro: toda tela que usa as listas precisa do .fin-topo-acoes",()=>{
  /* O 100-financeiro-v2.css inteiro esta escopado em
     `#area-gestao:has(> .fin-topo-acoes)` — 71 regras. Uma tela que monta
     as listas do financeiro SEM esse elemento como filho direto cai fora de
     todas elas de uma vez, e o sintoma nao parece CSS: a porcentagem de
     cada categoria aparece grudada no valor, em italico, porque o
     `.fin-linha-valor em` mora la. Foi exatamente o que aconteceu quando a
     tela de Fluxo nasceu com um <h3> solto no lugar do cabecalho. */
  const fonte = fs.readFileSync(path.join(__dirname, "../app/styles/100-financeiro-v2.css"), "utf8");
  const escopadas = (fonte.match(/:has\(> \.fin-topo-acoes\)/g) || []).length;
  assert.ok(escopadas > 30,
    `o escopo mudou (${escopadas} regras): confira se este teste ainda guarda a coisa certa`);

  for (const fn of ["abrirFinanceiro", "abrirFluxoDe"]) {
    const bloco = source.match(new RegExp(`function ${fn}\\([^)]*\\)[\\s\\S]*?\\n\\}`))[0];
    assert.ok(/area\.innerHTML/.test(bloco), `${fn} nao monta mais a tela — reveja este teste`);
    assert.match(bloco, /<div class="fin-topo-acoes">/,
      `${fn} monta a tela sem .fin-topo-acoes: as ${escopadas} regras do financeiro nao vao valer nela`);
  }
});

/* ───────────────────────────────────────────────────────────────────────────
   O CONVITE PARA INSTALAR

   No Android, o Chrome tem duas opcoes de nome parecido: "Instalar
   aplicativo" faz o app de verdade, e "Adicionar a tela inicial" faz um
   ATALHO, que abre em aba com a barra de endereco em cima. O dono instalou
   pela segunda e ficou com o sistema espremido dentro de uma aba.

   O convite tira a escolha do caminho. O que estes testes guardam e que ele
   nunca apareca sem o aval do Chrome, e nunca insista com quem disse nao.
   ─────────────────────────────────────────────────────────────────────────── */
test("instalar: a tira NAO aparece sem o aval do Chrome",()=>{
  // beforeinstallprompt so dispara quando a pagina e mesmo instalavel.
  // Mostrar o convite sem ele seria oferecer um botao que nao instala nada.
  // O elemento de mentira do sandbox ja nasce com conteudo, entao comparar
  // com "" testaria o stub, nao o codigo. O que importa e que a funcao NAO
  // ESCREVA nada: marca-se o conteudo e confere-se que continua intacto.
  const a=load();
  const alvo = a.get("convite-instalar");
  alvo.innerHTML = "__intacto__";
  a.run(`window.__convitePWA = null; _mostrarConviteInstalar();`);
  assert.equal(alvo.innerHTML, "__intacto__",
    "o convite apareceu sem o Chrome ter avisado que da para instalar");
});

test("instalar: quem dispensa nao ve de novo",()=>{
  const a=load();
  a.run(`window.__convitePWA = { prompt(){}, userChoice: Promise.resolve({outcome:'accepted'}) };
         _mostrarConviteInstalar();`);
  assert.match(a.get("convite-instalar").innerHTML, /inst-convite/, "o convite nao apareceu com o aval");

  a.run(`_dispensarConviteInstalar();`);
  assert.equal(a.get("convite-instalar").innerHTML, "", "nao sumiu ao dispensar");

  a.run(`_mostrarConviteInstalar();`);   // tenta de novo
  assert.equal(a.get("convite-instalar").innerHTML, "",
    "voltou a insistir depois de dispensado — o caminho mais curto para a pessoa parar de ler os avisos");
});

test("instalar: o evento e de uso unico e nao fica guardado",()=>{
  // Depois de prompt() o evento nao serve mais. Guarda-lo faria o segundo
  // toque nao abrir nada, e o botao viraria um botao morto.
  const bloco = source.match(/async function _instalarApp\([\s\S]*?\n\}/)[0];
  assert.match(bloco, /window\.__convitePWA = null/,
    "o evento nao e descartado depois de usado");
  assert.match(bloco, /await evento\.userChoice/, "nao espera a resposta da pessoa");
});

test("instalar: o botao desfaz o width:100% global dos botoes",()=>{
  // Existe um `button { width: 100% }` global. Sem width:auto, o botao
  // ocupava a linha inteira, espremia o texto a zero e vazava do cartao —
  // medido no navegador antes do conserto.
  // SEM OS COMENTARIOS. O comentario desta propria regra explica o
  // "width: auto", entao casar o texto cru deixava o teste verde com a
  // propriedade apagada — foi o que aconteceu na primeira versao deste
  // teste, e o defeito plantado passou batido.
  const css = fs.readFileSync(path.join(__dirname, "../app/styles/92-home.css"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const regra = css.match(/\.inst-btn \{[\s\S]*?\}/)[0];
  assert.match(regra, /width:\s*auto/,
    "o .inst-btn parou de desfazer o width:100% global e vai quebrar o cartao");
});

/* ───────────────────────────────────────────────────────────────────────────
   NENHUMA TELA PODE CHAMAR FUNÇÃO QUE NÃO EXISTE

   Esta guarda nasceu de um erro meu que chegou a produção: eu escrevi
   `mostrarErro(...)` em duas funções, acreditando que fosse global. Não é —
   é uma variável LOCAL dentro de salvarCustoFixo. Fora dali, a chamada
   explode com ReferenceError e o app para calado, sem mostrar o aviso que
   deveria mostrar.

   Pior: o teste daquela função passava, porque ele mesmo fazia
   `mostrarErro = ...` e assim CRIAVA a global que deveria estar conferindo.
   Um teste que inventa a peça que falta não guarda nada.
   ─────────────────────────────────────────────────────────────────────────── */
test("script: ninguém chama mostrarErro fora de quem a define",()=>{
  const linhas = source.split("\n");
  const dono = linhas.findIndex(l => /const mostrarErro\s*=/.test(l));
  assert.ok(dono > 0, "a variável local mostrarErro sumiu — reveja este teste");

  // De quem é aquela variável: a função que a declara.
  const nomeDono = (() => {
    for (let i = dono; i >= 0; i--) {
      const m = linhas[i].match(/^(?:async )?function ([A-Za-z_$][\w$]*)/);
      if (m) return m[1];
    }
    return null;
  })();
  assert.ok(nomeDono, "não achei a função dona de mostrarErro");

  const forasteiras = [];
  linhas.forEach((l, i) => {
    if (!/\bmostrarErro\(/.test(l)) return;
    if (/mostrarErroTipoRacao/.test(l)) return;
    for (let k = i; k >= 0; k--) {
      const m = linhas[k].match(/^(?:async )?function ([A-Za-z_$][\w$]*)/);
      if (m) { if (m[1] !== nomeDono) forasteiras.push(`linha ${i + 1} em ${m[1]}()`); break; }
    }
  });
  assert.deepEqual(forasteiras, [],
    `mostrarErro só existe dentro de ${nomeDono}(); fora dali quebra calado. Use _toastErro. ` +
    forasteiras.join("; "));
});

/* Recorta o corpo de uma função contando chaves. A primeira versão deste
   recorte era uma expressão regular com `[\s\S]*?\n\}` e ela parava na
   primeira chave de coluna 0 — que em função com callback dentro vem no
   meio. O teste morreu com "Cannot read properties of null" em vez de
   conferir coisa alguma. */
function corpoDaFuncao(src, nome) {
  const i = src.search(new RegExp(`^(?:async )?function ${nome}\\(`, "m"));
  assert.ok(i >= 0, `não achei a função ${nome}() no script`);
  let abriu = false, nivel = 0;
  for (let k = i; k < src.length; k++) {
    if (src[k] === "{") { abriu = true; nivel++; }
    else if (src[k] === "}") { nivel--; if (abriu && nivel === 0) return src.slice(i, k + 1); }
  }
  assert.fail(`${nome}() não fecha — chaves desbalanceadas?`);
}

test("script: o fluxo de assinatura só usa peças que existem",()=>{
  // As duas funções novas do pagamento, conferidas contra o que o arquivo
  // realmente declara. Inventar um helper aqui significa o cliente tocar em
  // "Assinar no cartão" e nada acontecer.
  /* Só as funções que o fluxo REALMENTE tem hoje. _pedirCpfCnpj esteve aqui
     e saiu: o CPF passou a ser pedido na própria página do Asaas. Uma lista
     fixa transformava essa remoção, que é correta, em teste vermelho. */
  const doFluxo = ["assinarNoCartao", "abrirAssinatura", "_pedirCpfCnpj"]
    .filter(n => new RegExp(`^(?:async )?function ${n}\\(`, "m").test(source));
  assert.ok(doFluxo.includes("assinarNoCartao") && doFluxo.includes("abrirAssinatura"),
    "sumiu uma função central do fluxo de assinatura: " + doFluxo.join(", "));
  const alvo = doFluxo.map(n => corpoDaFuncao(source, n)).join("\n");
  const chamadas = [...alvo.matchAll(/\b(_[a-zA-Z][\w$]*|mostrar[A-Z][\w$]*|formatarNumeroBR|supabaseClient)\s*\(/g)]
    .map(m => m[1]);
  const declaradas = new Set([
    ...[...source.matchAll(/^(?:async )?function ([A-Za-z_$][\w$]*)/gm)].map(m => m[1]),
    ...[...source.matchAll(/^(?:const|let|var) ([A-Za-z_$][\w$]*)\s*=/gm)].map(m => m[1]),
  ]);
  const inventadas = [...new Set(chamadas)].filter(n => !declaradas.has(n));
  assert.deepEqual(inventadas, [],
    "o fluxo de assinatura chama função que não existe no arquivo: " + inventadas.join(", "));
});

/* ───────────────────────────────────────────────────────────────────────────
   O CATÁLOGO DE PREÇO TEM DE SER PEDIDO AO BANCO

   Escrevi carregarPlanos() e não chamei em lugar nenhum. O resultado seria
   silencioso e convincente: a tela de planos abriria com "Não consegui
   carregar os planos agora", e eu teria passado a tarde atrás de um erro de
   permissão que não existia. Função que ninguém chama não é funcionalidade.
   ─────────────────────────────────────────────────────────────────────────── */
test("planos: a tela de planos pede o catálogo antes de desenhar",async()=>{
  // Teste FUNCIONAL, e não de texto: a primeira versão desta guarda procurava
  // a palavra "_planosTentou" no corpo da função. Eu apaguei o cache inteiro
  // e ela continuou passando, porque a palavra sobrava numa atribuição.
  const a = load();
  a.run(`
    globalThis.__consultas = 0;
    supabaseClient.from = () => { __consultas++; return { select:()=>({ eq:()=>({
      order:()=>Promise.resolve({ data:[{chave:'basico',nome:'Básico',
        viveiros_label:'2 a 5 viveiros',limite_viveiros:5,
        mensal:100,semestral:550,anual:1000,permite_cartao:true}], error:null })
    })}) }; };
    assinatura = { plano:'gratis', status:'ativo' };`);

  await a.run('abrirAssinatura()');
  assert.equal(a.run('__consultas'), 1,
    "abrir a tela de planos não consultou o banco — a tela mostraria 'não consegui carregar'");
  assert.equal(a.run('_planosCatalogo.length'), 1);
  assert.equal(a.run('_planosCatalogo[0].mensal'), 100);

  // Trocar o ciclo redesenha a tela inteira; não pode virar consulta por toque.
  await a.run("_planosCiclo='anual'; abrirAssinatura()");
  await a.run("_planosCiclo='semestral'; abrirAssinatura()");
  assert.equal(a.run('__consultas'), 1, "cada toque no ciclo está consultando o banco de novo");

  // E o cache tem de estar DENTRO de carregarPlanos, não só no portão de quem
  // chama: qualquer tela que pedir o catálogo depois não pode ir ao banco.
  await a.run('carregarPlanos()');
  assert.equal(a.run('__consultas'), 1,
    "carregarPlanos() não lembra que já perguntou — quem chamar direto consulta de novo");
});

test("planos: duas aberturas ao mesmo tempo fazem uma consulta só",async()=>{
  const a = load();
  a.run(`
    globalThis.__consultas = 0;
    supabaseClient.from = () => { __consultas++; return { select:()=>({ eq:()=>({
      order:()=>new Promise(r=>setTimeout(()=>r({data:[],error:null})))
    })}) }; };`);
  const p = a.run('Promise.all([carregarPlanos(), carregarPlanos(), carregarPlanos()])');
  a.flush();
  await p;
  assert.equal(a.run('__consultas'), 1, "a busca em voo não está sendo compartilhada");
});

test("planos: falha na leitura avisa e deixa tentar de novo",async()=>{
  const a = load();
  a.run(`
    globalThis.__consultas = 0;
    supabaseClient.from = () => { __consultas++; return { select:()=>({ eq:()=>({
      order:()=>Promise.resolve({ data:null, error:{message:'sem permissao'} })
    })}) }; };
    assinatura = { plano:'gratis', status:'ativo' };`);

  await a.run('abrirAssinatura()');
  const tela = a.get('area-gestao').innerHTML;
  assert.match(tela, /não consegui carregar os planos/i,
    "falhou a leitura e a tela não disse nada");
  assert.match(tela, /Tentar de novo/,
    "sem botão de tentar de novo o cliente fica preso no aviso");

  // E NENHUM preço pode aparecer: um valor velho na tela é pior que tela sem
  // valor — um faz o cliente desistir, o outro faz ele ser cobrado a mais.
  assert.ok(!/R\$\s*\d/.test(tela), "apareceu preço numa tela que não conseguiu ler o catálogo");

  // Forçar refaz a consulta.
  await a.run('carregarPlanos(true)');
  assert.equal(a.run('__consultas'), 2, "carregarPlanos(true) não refez a consulta");
});

/* O WhatsApp saiu de dentro dos cards e virou contato único no fim da tela.
   Com cinco planos, dois botões por card davam dez escolhas numa rolagem só. */
test("planos: o WhatsApp é um contato no fim da tela, não um botão por card",async()=>{
  const a = load();
  a.run(`
    supabaseClient.from = () => ({ select:()=>({ eq:()=>({
      order:()=>Promise.resolve({ data:[
        {chave:'gratis1',nome:'1 viveiro',viveiros_label:'1 viveiro',limite_viveiros:1,
         mensal:50,semestral:275,anual:500,permite_cartao:true},
        {chave:'basico',nome:'Básico',viveiros_label:'2 a 5 viveiros',limite_viveiros:5,
         mensal:100,semestral:550,anual:1000,permite_cartao:true},
        {chave:'pro',nome:'Pro',viveiros_label:'ilimitados',limite_viveiros:999999,
         mensal:500,semestral:2750,anual:5000,permite_cartao:true}], error:null })
    })}) });
    assinatura = { plano:'gratis', status:'ativo' };`);
  await a.run('abrirAssinatura()');
  const tela = a.get('area-gestao').innerHTML;

  // Conta LINKS (wa.me), não a palavra: o texto do botão também diz WhatsApp.
  const zaps = (tela.match(/wa\.me/g) || []).length;
  assert.equal(zaps, 1, `são ${zaps} links de WhatsApp na tela; tem de ser um só, no fim`);

  // E ele vem DEPOIS do último card, não no meio deles.
  assert.ok(tela.lastIndexOf("plano-card") < tela.indexOf("wa.me"),
    "o contato do WhatsApp está antes do último card — ele é o fim da tela");

  assert.equal((tela.match(/Assinar no cartão/g) || []).length, 2,
    "cada plano pago tem de ter o botão do cartão (o de 1 viveiro é liberado)");
});
