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
