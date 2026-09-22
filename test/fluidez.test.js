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
  a.get('msg-racao-sucesso').style.display='none';
  a.run(`pegarUsuarioLogado=async()=>({id:'usuario-teste'});
    supabaseClient.from=()=>({insert:()=>({select:()=>new Promise(r=>globalThis.__gravar=r)})});`);
  const pending=a.run('_executarSalvamento(__button,()=>salvarLancamentoRacao(0))');
  await Promise.resolve();await Promise.resolve();
  assert.equal(a.button.disabled,true);assert.equal(a.get('msg-racao-sucesso').style.display,'none');
  assert.equal(a.get('consumoRacao').value,'10');
  a.run('__gravar({data:[{id:"racao-nova"}],error:null})');await pending;
  assert.equal(a.button.disabled,false);assert.equal(a.get('msg-racao-sucesso').style.display,'flex');
  // A quantidade PERMANECE após salvar (pra repetir no dia seguinte); a data avança.
  assert.equal(a.get('consumoRacao').value,'10');assert.equal(a.get('dataRacao').value,'2026-09-22');
  assert.equal(a.errors.length,0);
});
test("salvamento real de ração: rejeição de rede não apaga o formulário",async()=>{
  const a=load();seed(a);
  a.get('dataRacao').value='2026-09-21';a.get('consumoRacao').value='10';a.get('tipoRacaoSelect').value='0';
  a.get('msg-racao-sucesso').style.display='none';
  a.run(`pegarUsuarioLogado=async()=>({id:'usuario-teste'});
    supabaseClient.from=()=>({insert:()=>({select:()=>Promise.reject(Error('rede'))})});`);
  await a.run('_executarSalvamento(__button,()=>salvarLancamentoRacao(0))');
  assert.equal(a.button.disabled,false);assert.equal(a.get('consumoRacao').value,'10');
  assert.equal(a.get('tipoRacaoSelect').value,'0');assert.equal(a.get('dataRacao').value,'2026-09-21');
  assert.equal(a.get('msg-racao-sucesso').style.display,'none');assert.equal(a.errors.length,1);
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
