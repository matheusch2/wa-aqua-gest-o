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

- [ ] **Verificar as permissões do banco** — rodar o SQL de check-up (está no
  chat de 30/07). Achamos 27 funções que gravam sem confirmar se a linha foi
  mesmo alterada. É risco latente: só vira bug se faltar alguma política.
  Se o check-up acusar falta, aí sim vale endurecer essas funções.
- [ ] Atenção especial a `perfis` e `assinaturas`: se o usuário puder EDITAR
  essas tabelas, ele pode se dar plano pago ou virar admin. Ali o certo é só
  leitura para o usuário; quem escreve é a Edge Function.
- [ ] Ainda não auditados a fundo: `/ch2`, corridas/duplo toque, projeção de
  crescimento.
