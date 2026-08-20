# Pendências — WA Aqua Gestão

Anotações do que está combinado pra fazer. (Sem senhas nem dados sensíveis aqui.)

## Service worker — FEITO (20/08)
`sw.js` na raiz, registrado em `index.html` e `login.html`.
- **Regra de ouro: rede sempre primeiro.** Ele nunca segura versão velha do
  sistema. O cache só entra quando a rede falha. Testado: com o servidor
  passando a mandar uma versão nova, o app pegou a nova, não a guardada.
- Fora do alcance dele de propósito: Supabase, o CDN e o painel `/ch2`.
- Offline: o app abre com a última versão que passou por ali.
- Como desligar, se um dia atrapalhar: instruções no topo do próprio `sw.js`.
- Chrome confirma os critérios de instalação: manifesto sem erros, nome,
  `start_url`, `standalone`, ícones 192/512, service worker ativo com `fetch`.

## Próximo passo (Play Store)
- [ ] Gerar o pacote Android com o **PWABuilder** (a "casquinha" que abre o site — um código só).
- [ ] Conta de desenvolvedor da **Play Store**: US$ 25 (pagamento único).
- [ ] Configurar o `assetlinks.json` (Digital Asset Links) pro app abrir em tela cheia, sem barra do navegador.
- [ ] Preparar itens que a Play Store exige: **política de privacidade** (URL), descrição, prints, classificação de conteúdo.
- [ ] Atenção: conta pessoal nova na Play Console precisa rodar **teste fechado (~12 testadores por 14 dias)** antes de publicar pra todo mundo.

## Corrigir ciclo encerrado (a refazer do zero, quando quisermos)
Foi feito e depois **removido** do código, para ser repensado com calma. Se
retomar, o commit com a implementação está no histórico do Git (procure por
"Permite corrigir as despescas parciais de um ciclo ja encerrado").

- [ ] Corrigir os dados do encerramento (data, produção final, peso médio, preço, observações).
- [ ] Corrigir as despescas parciais congeladas no ciclo.
- Regra que vale lembrar: mexer nesses campos **tem** que recalcular produção
  total, FCA, produtividade, sobrevivência e dias — senão o relatório fica
  incoerente. E é preciso distinguir "ciclo antigo sem histórico salvo" de
  "histórico vazio", ou apagar todas as parciais ressuscita o valor antigo.
- Decidir antes: de onde se entra nessa tela.

## Contexto útil
- Site: waaqua.com.br (GitHub Pages, branch `main`). Backend: Supabase (plano grátis por enquanto).
- Painel admin: `/ch2`. Restauração de backup: `/ch2/restaurar.html`.
- Meta pra subir pro Supabase Pro: por volta de ~10 clientes pagando.

## Energia — FEITO (20/08)
Financeiro → **Energia**. Lança a conta pelo PERÍODO DA LEITURA (duas datas),
não pelo dia em que ela chegou. O app sugere a divisão pelos dias que cada
viveiro rodou e o Matheus **ajusta cada valor na mão** — energia não é
proporcional a dias, depende de aeradores e bombas.
- **O problema do ciclo encerrado está resolvido.** Uma fatia por (viveiro ×
  ciclo): se o período pega um ciclo que encerrou no meio, aquele pedaço é
  lançado com o `ciclo_id` do ciclo ENCERRADO e o resto com o do novo.
  Funciona porque o relatório de ciclo soma os custos ao vivo pelo `ciclo_id` —
  o encerramento só congela biometria, ração, despesca e o rateio fixo.
  Testado: conta de 01–30/07 com ciclo encerrado em 20/07 → ciclo velho recebeu
  R$ 200, ciclo novo R$ 100, sem mistura.
- Categoria fixa "Energia" (o financeiro agrupa por categoria; descrição
  diferente a cada mês criaria um grupo novo todo mês). A descrição fica no
  nome, que é como o histórico do viveiro agrupa.
- Barra rateio maior que a conta. Rateio menor é permitido e avisa quanto ficou
  de fora — o medidor pode cobrir a casa, não só o cultivo.
- Viveiro fora do limite do plano não entra no rateio (é somente leitura).

## Fluidez — medido, não chutado (20/08)
Medi as telas com um cliente grande (20 viveiros, 100 ciclos encerrados,
13.820 custos): **nenhuma tela passa de 36 ms para desenhar**. Renderização
não é o gargalo — não vale otimizar ali.

O peso estava na ABERTURA do app: `select("*")` na tabela `ciclos` trazia o
histórico completo (biometrias, rações, despescas em JSON) de todo ciclo
encerrado, e isso é ~96% do peso da tabela — 146 KB já com 10 ciclos, ~1 MB
com 60 — para uma tela que quase nunca se abre.
- Agora a abertura pede só as colunas do resumo; o histórico chega quando o
  relatório daquele ciclo é aberto, uma vez por ciclo.
- Se a consulta por coluna falhar (coluna que não existe), cai de volta no
  `select("*")` — senão o app inteiro não abriria, porque `ciclos` é
  essencial. Testado simulando a falha: o app abre normal.
- Efeito colateral bom: "Histórico de ciclos" caiu de 21 ms para 9 ms.

## Limpeza (20/08)
- **33 KB a menos no `style.css`** (169 → 136 KB, −19%): 144 classes que não
  existem em lugar nenhum do HTML. Eram restos de redesenhos — dois layouts
  antigos de relatório (`rc-*`, `rel-*`), o menu suspenso antigo (`menu-*`) e a
  tela de boletos antiga.
  Como foi conferido: removi só seletores em que ALGUMA classe está morta (um
  seletor `.a .b` nunca casa se `.b` não existe), e depois comparei o estilo
  calculado de cada elemento em 33 telas, no claro e no escuro — 0 diferenças.
  Se um dia for repetir: cuidado com classe montada por prefixo
  (`bt-badge-${st.tipo}`) e com nome que só aparece dentro do `${...}`
  (`${p.ativo ? "on" : ""}`). Uma varredura ingênua marca essas como mortas.
- Conferido e está limpo: 0 funções sem referência, 0 variáveis de topo sem uso,
  0 `alert`/`confirm` nativos, 0 `toISOString` em data local (o único que existe
  é o comentário avisando pra não usar). Os 5 `catch` vazios são deliberados.
- Última inconsistência de leitura de número corrigida: a edição de biometria
  fazia `replace(",", ".")` na mão em vez de usar `parseDecimalBR`.

## Logo do topo (20/08)
A logo sumiu do app. **Não foi a limpeza de CSS** — conferido: `.logo-img`
nunca existiu no `style.css`; quem estiliza é `.logo-circulo img`, idêntica
antes e depois. A causa é que o `index.html` puxava a logo de um hospedeiro
de imagens grátis (`i.postimg.cc`). Se ele cai, apaga o arquivo ou passa a
bloquear link externo, a logo do produto some do app de todo mundo.
Agora usa `logo-wa.jpg`, que já estava no repositório, e o service worker
guarda ela (aparece até offline). Nenhuma imagem do app depende mais de fora.

**Lição pra próxima limpeza de CSS:** meu teste de regressão visual só olhava
`#area-gestao *` — a barra do topo ficava de fora. Se um dia repetir, inclua
`body *`.

## Futuro (sem pressa)
- [ ] Limpar a coluna esquisita `gen_random_uuid()` da tabela `viveiros` (SQL de 1 linha).
- [ ] Recorrência/renovação automática de pagamento (hoje é avulso).

## Revisão geral — onde paramos (30/07)
Corrigido nesta rodada: vírgula engolida nos campos numéricos (erro de 10x),
rateio de custo fixo congelado no encerramento, vigência por período nos custos
fixos, pausa do manejo automático, custos misturando ciclos, entrada do app
(16 idas ao servidor → 2).

- [x] **Permissões do banco verificadas (31/07) — está tudo certo.**
  Cada operação que o app usa tem política, e nada além disso está aberto.
  `perfis` e `assinaturas` são somente leitura para o usuário — é isso que
  impede alguém de se promover a admin ou se dar plano pago.
  Ausências que o check-up aponta e são CORRETAS, não mexer:
  - `admin_historico`: nenhuma política — só a Edge Function escreve.
  - `biometrias`, `racoes`, `despescas`: sem UPDATE — editar é apagar e gravar.
  - `viveiros`: sem DELETE — excluir é `ativo = false` (exclusão suave).
  Consequência: os 27 pontos que gravam sem confirmar a linha NÃO precisam ser
  mexidos. Mas guarde a regra: se um dia o app passar a usar uma operação nova
  numa dessas tabelas (ex.: UPDATE em `racoes`), vai falhar em silêncio até a
  política ser criada.
- [x] **Corridas / duplo toque auditadas (19/08) — 2 bugs reais corrigidos.**
  1. **Custo automático em dobro.** A varredura que roda ao abrir o app e a que
     roda ao salvar/ativar um manejo podiam correr juntas. As duas perguntavam
     "já lancei esse dia?" antes de qualquer uma gravar → o ciclo inteiro de
     manejo automático entrava DUPLICADO no custo. Reproduzido em teste: 26
     lançamentos onde deviam ser 13. Corrigido com fila (uma varredura por vez,
     e um lançamento por vez).
  2. **Protocolo duplicado.** Dois toques no "Salvar protocolo" criavam dois
     protocolos iguais — e depois os dois lançavam. Reproduzido: 2 onde devia
     ser 1.
  Também travados contra duplo toque: chavinha de pausar manejo, ativar/desativar
  custo fixo, desfazer último pagamento, marcar/desmarcar boleto pago, salvar
  fazenda, trocar senha, remover foto. Varredura completa: dos 47 pontos que
  gravam no banco, os 42 clicáveis estão travados; os 5 restantes são internos
  (não têm botão).
- [x] **Painel `/ch2` auditado (20/08).**
  Segurança está correta: chave publicável (nunca a service_role), toda ação
  privilegiada passa pela Edge Function que confere o papel no servidor,
  `noindex`, anti-iframe. Quem não é admin leva 401 e não vê dado nenhum.
  Corrigido:
  - **Risco de liberar o plano duas vezes.** Se a lista falhasse ao recarregar
    DEPOIS de a ação já ter dado certo, a tela dizia "Erro" e destravava o
    botão — o 2º clique somava mais 30 dias. Agora só a ação em si pode dizer
    "erro"; se a lista não atualiza, avisa que deu certo e mantém o botão
    travado. Mesma correção em "Excluir conta".
  - Página em branco quando o servidor não respondia na abertura (as duas telas
    começam escondidas e não havia proteção). Agora cai no login com aviso.
  - Toda primeira chamada gastava uma ida ao servidor que sempre falhava
    (tentava o nome antigo da função primeiro). Invertida a ordem.
  - Escapado o texto do histórico (era o único ponto que ia pro HTML cru).
- [x] **Projeção de crescimento auditada (20/08) — 3 correções.**
  - **Vírgula engolida no peso-alvo.** Digitar "22,5" virava 22 (usava
    `parseFloat` em vez de `parseDecimalBR`) — e os botões − / + ao lado já
    liam certo, então os dois controles discordavam. O campo também mostrava
    "19.5" com ponto; agora é vírgula.
  - **Gráficos acumulando.** Nenhum gráfico do app era destruído ao redesenhar
    a tela. 20 toques no +/- deixavam 21 gráficos órfãos vivos, cada um com
    seu observador de redimensionamento — o celular ia ficando lento.
  - **Gráfico parava de atualizar.** Cada tela desenha dentro de um
    `setTimeout`; em toques rápidos o desenho antigo acordava depois do
    redesenho, ocupava o canvas novo, e o desenho certo era recusado pelo
    Chart.js ("Canvas is already in use") — exceção e gráfico congelado.
    Reproduzido: 5 falhas em 20 toques.
  - **Ganho/dia da projeção** (decidido com o Matheus em 20/08): passou a ser
    o ganho do ciclo — peso da última biometria menos o da primeira, dividido
    pelos dias entre elas. Antes era a média simples dos intervalos, que dava
    peso igual a um intervalo de 3 dias e a um de 21. Com biometria semanal os
    dois dão o mesmo número; num mesmo cultivo de 3 g a 10 g em 21 dias, o
    cálculo antigo dizia 2,33 / 1,75 / 2,05 g/sem só conforme o espaçamento
    das pesagens — e chegou a errar a data prevista em 11 dias.
