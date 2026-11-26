# Quota e bloqueio: revisão antes da produção

Base: 83bab17. Migração proposta: [segurança dos viveiros](../banco/migracoes/seguranca-viveiros-20261126.sql).
As definições anteriores da função, do gatilho e os grants do carimbo foram consultados sem escrita.

A regra de plano, tolerância e fuso permanece a da função existente. O gatilho AFTER confere
o total final do destino quando a operação acrescenta um ativo. Não há saneamento dos
excedentes: edição, desativação, registros inativos e históricos continuam válidos.
RLS continua responsável por autorizar o titular; a quota não autoriza transferências.
O carimbo continua ligado ao gatilho, com EXECUTE retirado de PUBLIC, anon e authenticated.

As 256 linhas de sincronização não guardam IDs de clientes. Uma admissão atualiza uma linha
antes de consultar a quota. Contas na mesma faixa podem esperar entre si. Sob snapshots
fixos pode ocorrer 40001, e operações em lote sobre vários titulares podem receber 40P01;
o chamador deve repetir a transação inteira nesses casos, não tratar o erro como aprovação.
Antes de liberar, conferir proprietário da função e da tabela interna (mesmo papel de
migração, com acesso à tabela sob RLS), conflitos de nomes, versão do servidor e plano
da consulta de contagem para contas grandes.

## Ensaio e reversão
No PostgreSQL local descartável: `bash test/postgres/validar-quota.sh` (usuário não-root,
initdb, pg_ctl e psql; PG_BIN_DIR opcional). O script cria seu próprio cluster sem TCP,
com dados fictícios, verifica o saldo legado, duas sessões, privilégios e o rollback.
A suíte do app permanece intacta. O workflow da branch não recebe credenciais do Supabase.
Só aprovar depois dos dois jobs verdes e de comparar o esquema real com a fixture mínima.

Falha na aplicação: a transação é atômica. Após commit, suspender temporariamente
admissões, comparar funções e ACL atuais com a definição capturada, revisar e executar
[a reversão](../banco/reversoes/seguranca-viveiros-20261126.sql) como proprietário em janela
aprovada. Não usar CASCADE. A reversão integral reabre a lacuna anterior e os grants
antigos; se o problema for só a quota, preservar a revogação do carimbo. Conferir
gatilhos, ACL, totais de ativos e histórico antes de reabrir.

## Decisão pendente: bloqueio administrativo
A função _contaBloqueada retorna false quando existe um objeto de plano efetivo, inclusive
o fallback comercial grátis. Na ausência de resposta, usa assinatura e contagem locais.
Além disso, admin-clientes traduz bloquear/reativar em cancelado/ativo na mesma coluna que
representa a cobrança. Um status cancelado, sozinho, não prova ação administrativa.

Proposta para aprovação: registrar bloqueio administrativo em estado separado, com autor,
data e motivo; só ação administrativa auditada poderia aplicar/remover. A RPC de plano
informaria plano comercial e bloqueio separadamente. Vencimento ou cancelamento seguiria
a regra comercial de plano efetivo; reativação administrativa só removeria a trava,
sem restabelecer plano pago. Cobranças e webhooks não removeriam bloqueios administrativos.
Garantir o bloqueio de escrita no servidor (RLS e RPCs), preservando leitura e histórico;
interface apenas explicaria o motivo. Sem confirmação do servidor, permitir consulta
e adiar escritas. Revisar casos antigos com evidência administrativa, nunca converter
todos os cancelamentos em bloqueios. Nenhuma dessas mudanças está nesta migração.
