# Pendências — WA Aqua Gestão

Anotações do que está combinado pra fazer. (Sem senhas nem dados sensíveis aqui.)

## Próximo passo (Matheus vai retomar)
- [ ] **Adicionar o service worker** — arquivo que:
  - faz aparecer o botão "Instalar" no computador (Chrome/Edge);
  - é pré-requisito pra empacotar o app pra Play Store;
  - dá resistência offline básica.
  - Já temos: `manifest.json`, ícones (192/512), HTTPS. Só falta o service worker.

## Depois do service worker
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
