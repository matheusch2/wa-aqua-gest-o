# Módulos críticos — mapa para a extração

Levantamento de 26/11/2026, sobre `dd8e989` (branch `refatoracao/estrutura-20261126`).
Nada foi extraído nem alterado: este documento é só o mapa.

## Como foi levantado, e o que ele não cobre

Cada afirmação aqui veio de uma busca no código ou de uma consulta ao banco de
produção, não de leitura de documentação. Onde o número importa, ele está no
texto.

Três limites que o leitor precisa conhecer antes de confiar no mapa:

1. **O `docs/javascript-inventario.tsv` é textual e super-relata.** Conferi
   `_buscarPlanos`, que ele lista como dependente de `viveiros`. Não é: a palavra
   aparece como chave de objeto (`viveiros: p.viveiros_label`) e dentro de
   `limite_viveiros`. O inventário é um bom ponto de partida, mas cada dependência
   precisa ser olhada antes de virar decisão de extração.
2. **"Sem referência" não é "sem uso".** O app é servido por GitHub Pages: tudo é
   URL pública, e um `onclick` montado dentro de template string só aparece se a
   busca procurar por ele. Onde isso importa, contei os `onclick` explicitamente.
3. **O lado do banco foi lido em produção.** Funções, grants e advisors vêm de
   consulta ao projeto real, não dos arquivos em `banco/` — que, como já se viu
   em 26/11, podem divergir do que está publicado.

## Estado da suíte (tarefa 4)

O Work resolveu as falhas. Medido nesta branch:

```
npm test  ->  197 passaram, 0 falharam
```

O `docs/verificacao.md` registrou 11 falhas; eu havia medido 10 na `main` com
`npm test` inteiro. A diferença é a 11ª, `service worker: as duas promessas`, que
no ambiente deles não terminava dentro do limite de seis segundos. As duas
contagens descrevem o mesmo estado.

**Como foram resolvidas, que é o que interessa:** o Work melhorou o banco falso
(`test/helpers/webhook-banco-falso.mts` ganhou `upsert`, `is`, captura de `rpc` e
as tabelas `cobrancas_pix`, `periodos_cartao`, `cobranca_revisao`) e reescreveu as
asserções para o contrato novo. Não houve enfraquecimento: os casos continuam
afirmando comportamento, não apenas "não quebrou".

Dois deles, porém, **mudaram o contrato**, e isso merece decisão explícita, não
só um teste verde:

| caso | antes | agora |
|---|---|---|
| `pagamento sem dono` | HTTP 200 + log | HTTP **500** + linha em `cobranca_revisao` |
| `plano ausente do catálogo` | HTTP 200, ativa o acesso | HTTP **500**, não ativa, vai para revisão |

O 500 faz o Asaas **reenviar o aviso**. Para "pagamento sem dono" isso é um
reenvio que nunca vai resolver sozinho. Para "plano ausente", um cliente que
pagou fica sem acesso até alguém olhar a fila de revisão. As duas escolhas são
defensáveis — não inventar limite é melhor que inventar — mas são regra de
negócio nova, e hoje estão documentadas apenas como teste.

---

## 1. Autenticação e sessões

| função | onde | responsabilidade | depende de | risco | testes |
|---|---|---|---|---|---|
| `entrarUsuario` | `app/login.html:815` | login com e-mail/senha | `supabaseClient`, `_travarBtnLogin`, `_lockState` | **alto** | nenhum |
| `cadastrarUsuario` | `app/login.html:844` | cria conta | idem | **alto** | nenhum |
| `recuperarSenha` | `app/login.html:859` | envia e-mail de recuperação | idem | médio | nenhum |
| `definirNovaSenha` | `app/login.html:905` | grava a senha nova | idem | **alto** | nenhum |
| `_verificarLockLogin` / `_lockState` / `_cooldownMs` | `app/login.html:787,773,780` | trava progressiva após erros de senha | `localStorage` | médio | nenhum |
| `_irPorPerfil` | `app/login.html:523` | decide para onde mandar depois do login | `supabaseClient` | **alto** | nenhum |
| `_salvarUltimoAcesso` / `_lerUltimoAcesso` / `_esquecerUltimoAcesso` | `app/login.html:599,609,615` | lembra o último e-mail | `localStorage` | baixo | nenhum |
| `carregarViveiros` | `app/script.js:15407` | **a carga da sessão inteira**: viveiros, assinatura, plano efetivo, contato | `supabaseClient`, `assinatura`, `_planoEfetivo`, `viveiros`, `contato` | **alto** | indireto |
| `sairUsuario` | `app/script.js:308` | encerra a sessão | `supabaseClient` | médio | nenhum |
| `excluirMinhaConta` | `app/script.js:1343` | apaga a própria conta | `supabaseClient` | **alto** | nenhum |

**Observação de arquitetura:** o login mora inteiro dentro de `app/login.html`
(444 linhas de JS em `<script>` inline) e não compartilha nada com o
`app/script.js`. São dois mundos. Isso é bom para extrair — e ruim porque
`toggleSenha` existe duplicado nos dois (`login.html:571` e `script.js:1990`).

---

## 2. Permissões de acesso (modo somente leitura)

Este é o conjunto mais coeso do sistema e o melhor candidato a virar módulo.

| função | onde | responsabilidade | depende de | risco | testes |
|---|---|---|---|---|---|
| `_parseVenc` | `script.js:7919` | texto → data local | `_parseDataLocal` | baixo | **nenhum** |
| `_planoVencido` | `script.js:7944` | passou da carência? | `_DIAS_CARENCIA`, `_parseVenc` | baixo | **nenhum** |
| `_contaSituacao` | `script.js:1582` | classifica a situação da conta | `_DIAS_CARENCIA` | baixo | **nenhum** |
| `_planoLimiteEfetivo` | `script.js:7956` | quantos viveiros a conta pode ter | `_LIMITES_PLANO`, `_planoEfetivo`, `assinatura`, `_dentroDaCarencia`, `_planoVencido` | médio | **nenhum** |
| `_contaBloqueada` | `script.js:7971` | a conta está só de leitura? | `_planoEfetivo`, `assinatura`, `viveiros` | **alto** | **nenhum** |
| `_bloqueioEdicao` | `script.js:7989` | barra a edição e avisa | `_contaBloqueada`, `_toastErro` | **alto** | **nenhum** |
| `_viveirosLiberados` | `script.js:8011` | quais viveiros estão dentro do limite | `_planoEfetivo`, `_planoLimiteEfetivo`, `viveiros` | **alto** | **nenhum** |
| `_viveiroForaDoLimite` | `script.js:8032` | este viveiro passou do limite? | `_viveirosLiberados`, `viveiros` | **alto** | **nenhum** |
| `_bloqueioViveiro` | `script.js:8040` | barra o lançamento naquele viveiro | `_contaBloqueada`, `_viveiroForaDoLimite` | **alto** | **nenhum** |

**Onze funções que decidem quem pode escrever no sistema, e zero testes.**
Medido por busca direta: nenhuma delas é citada em `test/`. É o achado mais
importante deste levantamento, e muda a ordem recomendada mais adiante.

**Contrapeso que reduz o risco:** o limite não é só do cliente. O banco tem
`checar_limite_viveiros` como **gatilho** (confirmado em produção,
`usada_como_gatilho = 1`) e `viveiro_permite_lancamento`. Um erro na extração do
lado JS degrada a interface, não abre a porteira.

---

## 3. Assinaturas e vencimentos

| função | onde | responsabilidade | depende de | risco | testes |
|---|---|---|---|---|---|
| `carregarPlanos` / `_buscarPlanos` | `script.js:7869,7879` | catálogo de `public.planos`, com cache | `supabaseClient`, `_planosCatalogo`, `_planosTentou`, `_planosPromessa` | médio | **4 casos** |
| `_planoLabel` | `script.js:7901` | chave → nome visível | `_planosCatalogo` | baixo | nenhum |
| `verificarVencimentoPlano` | `script.js:7635` | avisa que o plano está vencendo | `assinatura`, `_DIAS_CARENCIA` | médio | **nenhum** |
| `abrirMinhaConta` | `script.js:1598` | tela da conta | `assinatura`, `_contaSituacao`, `carregarPlanos` | médio | nenhum |
| `abrirAssinatura` | `script.js:8083` | tela de planos | 18 globais (ver inventário) | **alto** | **4 casos** |
| `_linkWhatsAppPlano` / `_linkWhatsAppRenovar` | `script.js:7838,1663` | monta o link do WhatsApp | `_WHATSAPP_COMERCIAL` | baixo | nenhum |

No banco: `meu_plano_efetivo()`, `cotar_troca_plano(p_plano)`,
`assinatura_carimbar_valor()` (gatilho), `assinatura_gratis_sem_vencimento()`
(gatilho), `preservar_validade_pix_ativa()` (gatilho).

---

## 4. Limites de viveiros

Coberto na seção 2 do lado JS. Do lado do banco:

| objeto | tipo | observação |
|---|---|---|
| `checar_limite_viveiros()` | gatilho, SECURITY DEFINER | a trava de verdade; EXECUTE revogado de anon/authenticated |
| `viveiro_permite_lancamento(p_viveiro)` | RPC, SECURITY DEFINER | consulta por viveiro |
| `escolher_viveiro_gratuito(p_viveiro)` | RPC, SECURITY DEFINER | qual viveiro fica no plano grátis |
| `meu_plano_efetivo()` | RPC, SECURITY DEFINER | preenche `_planoEfetivo` em `script.js:15530` |
| `public.planos.limite_viveiros` | coluna | a fonte que deveria ser única |

---

## 5. Pagamentos Pix e cartão

| função | onde | responsabilidade | depende de | risco | testes |
|---|---|---|---|---|---|
| `assinarNoCartao(chave, botao, metodo, troca)` | `script.js:8172` | abre o checkout: Pix **ou** cartão, conforme `metodo` | `SUPABASE_URL`, `supabaseClient`, `_planosCatalogo`, `_planosCiclo`, `waRetornoPix` | **alto** | 2 menções |
| `waRetornoPix(retorno)` | `script.js:16475` | confere se o Pix foi confirmado ao voltar | `supabaseClient`, `consultar_meu_checkout_pix` | **alto** | **nenhum** |
| trecho de cotação | `script.js:8127` | chama `cotar_troca_plano` e desenha a diferença | `supabaseClient` | **alto** | nenhum |

O nome `assinarNoCartao` ficou errado: hoje ela atende os dois meios
(`script.js:8194` escolhe `assinar-pix` ou `assinar-cartao` pelo parâmetro).
Renomear é mexer na interface pública da função — fica para depois da extração,
não antes.

Edge Functions: `assinar-pix` (209 linhas), `assinar-cartao` (209).
RPCs: `cotar_troca_plano`, `confirmar_pagamento_pix`, `consultar_meu_checkout_pix`.
Tabelas: `cobrancas_pix`, `periodos_cartao`, `cobranca_revisao`, `assinaturas`.

---

## 6. Webhook Asaas

`supabase/functions/asaas-webhook/index.ts` — **680 linhas**, a maior função do
projeto e a única que transforma dinheiro em acesso.

| parte | linha | responsabilidade |
|---|---|---|
| `iguais` | 23 | comparação de token em tempo constante |
| `resposta` / `ok` / `falha` | 35,44,46 | respostas HTTP |
| `uuidValido` | 55 | valida referência externa |
| `localizarPix` | 65 | acha a cobrança Pix do evento |
| `processarPix` | 119 | aplica o pagamento Pix |
| `Deno.serve` | 375–680 | **305 linhas** com todo o fluxo de cartão |

O corpo do `Deno.serve` concentra: autenticação do webhook, roteamento de
`CHECKOUT_*`, `SUBSCRIPTION_*` e `PAYMENT_*`, a promoção de
`plano_checkout → plano`, o registro em `periodos_cartao` e a fila de revisão.
É o trecho que mais ganharia com separação — e o que menos pode ser mexido às
cegas.

Testes: `test/webhook-asaas.test.js` roda o arquivo **de verdade** num processo
filho com `--experimental-strip-types`, contra o banco falso. 9 casos. É a
melhor rede de segurança do projeto; qualquer extração aqui deve manter esse
arranjo funcionando.

---

## 7. Administração de clientes

`ch2/index.html` — 47 funções num arquivo só, sem módulo nenhum.

| função | linha | risco |
|---|---|---|
| `entrarAdmin` / `entrarPainel` / `revelarPainel` | 450,470,465 | **alto** — é o portão do painel |
| `chamar(body, fn)` | 407 | **alto** — fala com `admin-clientes-` (o slug tem hífen no fim) |
| `acao(btn, tipo, alvo)` | 1011 | **alto** — liberar / bloquear / trocar plano |
| `manual(btn, id, ajuste)` | 1000 | **alto** — chama `admin_painel_manual` |
| `excluirCliente` | 1053 | **alto** — chama `admin_excluir_cliente` |
| `baixarBackup` | 498 | médio |
| `carregarPrecos` / `_mrrCliente` | 316,331 | baixo |
| família `pc*` (preços do camarão) | 716–889 | baixo — 11 funções coesas |

RPCs de admin, todas SECURITY DEFINER: `admin_painel_manual`,
`admin_painel_acesso`, `admin_excluir_cliente`, `admin_pagamentos_vigentes`,
`admin_ajustar_vencimento`. **Conferi em produção que as cinco checam
`perfis.role = 'admin'` por dentro** — o grant para `authenticated` é seguro por
desenho, não por descuido.

---

## Dependências transversais

### Variáveis globais que atravessam domínios

| global | onde nasce | quem depende |
|---|---|---|
| `assinatura` | `script.js:46`, preenchida em `15527` | permissões, assinaturas, pagamentos |
| `_planoEfetivo` | `script.js:47`, preenchida em `15530` e `8080` | permissões, limites |
| `viveiros` | carga inicial | permissões, limites, tudo mais |
| `_planosCatalogo` + `_planosErro`/`_planosTentou`/`_planosPromessa` | `7857–7860` | assinaturas, pagamentos |
| `_planosCiclo` | `script.js:48` | tela de planos, pagamentos |
| `contato` | `script.js:41` | pagamentos, WhatsApp |
| `supabaseClient` | `script.js:37` (`const`) | todos |

Qualquer módulo extraído terá de **receber esses valores**, não lê-los do escopo
global — senão o módulo passa a depender da ordem de carga dos scripts, que é o
problema que a modularização deveria resolver.

### Manipuladores inline no HTML — a maior trava

Contei `on*="...nome("` para as funções críticas:

| função | `onclick` inline |
|---|---|
| `abrirAssinatura` | 5 |
| `toggleSenha` | 5 |
| `carregarPlanos` | 1 |
| `sairUsuario`, `excluirMinhaConta`, `salvarNovaSenha`, `abrirMinhaConta`, `confirmarSairConta`, `confirmarExcluirConta` | 1 cada |
| **todas as funções da seção 2 (permissões)** | **0** |
| `assinarNoCartao`, `waRetornoPix` | 0 |

Uma função chamada por `onclick=` **precisa continuar global**. Movê-la para um
módulo ES quebra o botão sem erro de build: o clique simplesmente não faz nada.
Essa contagem é o que separa "dá para extrair hoje" de "precisa de delegação de
eventos antes".

O padrão já existe no repositório: `app/js/numeros-br.js` foi extraído em
`95317e2` e continua global porque é carregado como `<script>` comum e
registrado no precache do `sw.js`. Funciona — mas é extração sem isolamento.
Vale decidir, antes do próximo passo, se o alvo é esse mesmo padrão ou módulos
ES de verdade. Os dois caminhos levam a códigos bem diferentes.

### Service worker

`sw.js` tem a lista `ESSENCIAIS` escrita à mão. **Todo arquivo JS novo precisa
entrar nela**, senão o app abre quebrado offline. Há um teste que cobre folhas
de estilo (`test/sw-rede-primeiro.test.js:271`) — **mas não cobre scripts**. Numa
extração que cria muitos arquivos, essa é a falha mais provável de passar
despercebida.

---

## Duplicidades, obsoletos e inconsistências (tarefa 3)

### O limite de viveiros está escrito em quatro lugares

| lugar | conteúdo |
|---|---|
| `public.planos.limite_viveiros` | **a fonte** |
| `app/script.js:7916` `_LIMITES_PLANO` | `{gratis:1, basico:5, intermediario:10, avancado:20, pro:999999}` |
| `supabase/functions/admin-clientes/index.ts` `LIMITES` | o mesmo, mais `gratis1` |
| `cobrancas_pix.limite_viveiros` | cópia no momento da cobrança (aqui faz sentido: é registro histórico) |

Hoje os três primeiros coincidem — conferi. O comentário na linha 7916 diz
"espelha a Edge Function admin-clientes", o que já admite a duplicação. É a mesma
armadilha que o preço teve em 24/11, quando três tabelas discordavam e um cliente
veria R$ 300 e seria cobrado R$ 160. **Alvo claro de unificação**, e barato:
`_LIMITES_PLANO` pode sair de `_planosCatalogo`, que já traz `limite`.

### Chaves de plano em dois dialetos

`gratis` (assinaturas antigas) e `gratis1` (catálogo) convivem. A Edge Function
`admin-clientes` aceita as duas; `_LIMITES_PLANO` só conhece `gratis`;
`cotar_troca_plano` recusa `plano = 'gratis'` explicitamente. Funciona por
acidente de cobertura, não por desenho.

### `toggleSenha` duplicada

`app/login.html:571` e `app/script.js:1990`. Mesma função, dois arquivos, 5
`onclick` apontando para cada lado.

### Obsoletos

| item | evidência | recomendação |
|---|---|---|
| Edge Function `criar-assinatura` | nenhuma chamada no repositório; publicada, v23, aponta para **sandbox** por padrão | desativar no Supabase (fora do escopo desta tarefa) |
| Edge Function `asaas-diagnostico` | não existe no repositório, ninguém chama | remover |
| `app/assets/fundo-login.webp` | só em `sw.js:60`; nenhum CSS/HTML usa | sai do precache |
| `supabase/functions/LEIA-ME.md` | tabela diz v19/v7/v5; em produção estão 23/17/9, e faltam 3 funções | atualizar |

### Uma regressão minha, encontrada neste levantamento

`assinatura_carimbar_valor()` — o gatilho que criei em 26/11 — é a **única**
função SECURITY DEFINER do schema `public` com EXECUTE para `PUBLIC`/`anon`.
Confirmado pelo advisor de segurança do Supabase
([lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)).
Todas as outras tiveram o grant revogado por `banco/migracoes/seguranca-advisor-revoke.sql`;
eu não segui a regra que aquele arquivo estabeleceu.

Explorável na prática? Não: é função de gatilho, e o Postgres recusa chamá-la
diretamente. Mas é inconsistência real e aparece em auditoria. Correção de uma
linha, para quando houver autorização de mexer no banco:

```sql
revoke execute on function public.assinatura_carimbar_valor() from public, anon, authenticated;
```

O advisor também aponta 4 tabelas com RLS ligado e **nenhuma política**
(`admin_historico`, `cobrancas_pix`, `periodos_cartao`, `viveiro_gratuito_escolha`).
Sem política, ninguém lê pela API do cliente — o que provavelmente é a intenção,
já que só o `service_role` as toca. Vale confirmar que é intenção, e não esquecimento.

---

## O que dá para extrair com segurança, e em que ordem (tarefas 5 e 6)

O critério que usei: **zero `onclick` inline**, dependências poucas e nomeáveis,
e efeito colateral contido. Risco aqui é risco de extração, não de existir.

### Ordem recomendada

**Passo 0 — antes de mover qualquer linha: escrever os testes que faltam.**

As onze funções de permissão não têm nenhum teste. Extrair primeiro e testar
depois significa que o teste vai descrever o que o módulo faz, não o que o
sistema fazia — e um erro de transcrição passa verde. O sandbox do
`test/fluidez.test.js` já carrega o `script.js` inteiro; dá para fixar o
comportamento atual sem mexer em nada.

Isso não é formalidade. Neste projeto, em 24/11, um teste passou verde enquanto
o app quebrava, porque o próprio teste criava a função que deveria estar
conferindo. Teste escrito depois da mudança tende a concordar com ela.

**Passo 1 — `plano-datas.js`** (risco baixo)
`_parseVenc`, `_planoVencido`, `_dentroDaCarencia`, `_contaSituacao`, `_DIAS_CARENCIA`.
Funções puras, entrada e saída simples, 0 `onclick`. Dependem só de
`_parseDataLocal`.

**Passo 2 — `plano-catalogo.js`** (risco baixo/médio)
`carregarPlanos`, `_buscarPlanos`, `_planoLabel`, `_LIMITES_PLANO`,
`_planosCatalogo` e seus três auxiliares de estado.
Já tem 4 testes. Recebe `supabaseClient` por parâmetro. **Aproveitar para matar
`_LIMITES_PLANO`**, lendo `limite` do catálogo.
Atenção: `carregarPlanos` tem 1 `onclick` (o botão "Tentar de novo") — ou
continua global, ou esse botão vira `addEventListener`.

**Passo 3 — `permissoes.js`** (risco alto, mas contido)
`_planoLimiteEfetivo`, `_contaBloqueada`, `_bloqueioEdicao`, `_viveirosLiberados`,
`_viveiroForaDoLimite`, `_bloqueioViveiro`.
0 `onclick`, mas lê `assinatura`, `_planoEfetivo` e `viveiros` do escopo global —
o módulo precisa recebê-los. Só depois do passo 0.

**Passo 4 — `ch2/precos-camarao.js`** (risco baixo)
As 11 funções `pc*` do painel. Coesas, isoladas do resto, e tirariam ~175 linhas
do `ch2/index.html`.

**Passo 5 — webhook: separar `Deno.serve`** (risco alto)
Quebrar as 305 linhas em `rotear(evento)`, `aplicarCartao()` e `registrarRevisao()`.
Tem 9 testes rodando o arquivo real — é a extração mais protegida do projeto,
apesar de ser a mais sensível.

### O que NÃO extrair agora

| função | por quê |
|---|---|
| `abrirAssinatura` | 18 globais e 5 `onclick` |
| `assinarNoCartao` | caminho do dinheiro, com 2 meios de pagamento e cotação no meio |
| `waRetornoPix` | sem teste nenhum, e decide se o cliente vê o acesso liberado |
| `carregarViveiros` | a carga da sessão inteira; mover isso é um projeto, não um passo |
| login (`app/login.html`) | 400 linhas inline, autenticação, zero testes |
| `entrarAdmin` / `chamar` / `acao` / `manual` / `excluirCliente` | portão do painel e ações destrutivas, sem testes |

---

## Riscos, em ordem de gravidade

1. **Onze funções de permissão sem um único teste.** É o que separa um cliente
   pagante de um bloqueado. Qualquer extração sem cobertura prévia é aposta.
2. **O `sw.js` não é atualizado sozinho, e nenhum teste cobre scripts.** Arquivo
   JS novo fora de `ESSENCIAIS` = app quebrado offline, sem aviso.
3. **`onclick` inline.** Mover uma função chamada por atributo HTML quebra o
   botão em silêncio — sem erro no console, sem falha de teste.
4. **O limite de viveiros em quatro lugares.** Mesma forma do problema de preço
   que custou caro em 24/11.
5. **Dois contratos novos do webhook que devolvem 500** (pagamento sem dono,
   plano fora do catálogo) e hoje só existem como teste. Merecem decisão escrita.
6. **`assinatura_carimbar_valor` com EXECUTE para `anon`.** Baixa gravidade real,
   mas é desvio da regra do próprio projeto e aparece em auditoria.

## Atualização de 26/11/2026 (etapa 4.1)

- As onze funções de permissão **passaram a ter testes**: `test/permissoes.test.js`,
  37 casos de caracterização. O passo 0 da ordem abaixo está cumprido.
- O precache de **scripts** ganhou guarda em `test/sw-rede-primeiro.test.js`.
- O padrão de extração foi decidido e está em `docs/arquitetura.md`.
- A investigação de segurança virou documento próprio:
  [seguranca-limites.md](seguranca-limites.md). O achado novo é grave: **o
  limite de viveiros pode ser contornado por UPDATE**, porque o gatilho só
  escuta INSERT e sai cedo quando `ativo` não é verdadeiro. Provado em ensaio
  desfeito.

## Recomendações para o Work

- Decidir **o padrão de extração antes do próximo arquivo**: script global (como
  `numeros-br.js`) ou módulo ES. Misturar os dois é pior que escolher o errado.
- Fazer o passo 0 (testes de permissão) como commit separado, sem nenhuma
  movimentação de código junto. Assim dá para ver o teste passar antes e depois.
- Acrescentar ao `test/sw-rede-primeiro.test.js` um caso que cubra **scripts**,
  e não só folhas de estilo, antes de criar o próximo arquivo JS.
- Corrigir o `supabase/functions/LEIA-ME.md`: a tabela de versões está três
  deploys atrasada e omite `assinar-cartao`, `assinar-pix` e `admin-clientes-`.
