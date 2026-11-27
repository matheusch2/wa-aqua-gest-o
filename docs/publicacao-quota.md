Hotfix isolado da main e derivado da correção 73c189d. Não executa deploy.
O CI cria um cluster PostgreSQL 17.6 descartável; não usa credenciais.

Antes da aplicação: repetir conferência do esquema, proprietário postgres, gatilho
BEFORE INSERT original, inexistência de wa_quota_interna e janela sem DDL concorrente.
Executar somente banco/migracoes/seguranca-viveiros-20261126.sql, em transação como
postgres. Não reaplicar. Conferir gatilhos, ACL efetivas, histórico e totais antes/depois.
Timeout de lock: abortar e escolher outra janela; não forçar desconexões.

A admissão lê a assinatura existente com FOR SHARE até o commit; se a atualização do plano
vier primeiro, espera pelo novo plano (ou aborta por snapshot antigo). Se a admissão vier
primeiro, um downgrade posterior preserva o ativo como legado. Sem assinatura visível
o limite continua 1; um upgrade simultâneo pode exigir nova tentativa após confirmação.
40001 e 40P01 exigem repetir a transação inteira. Mudanças em lote sobre vários
titulares e colisões entre as 256 faixas podem introduzir espera; monitorar estes códigos.

O rollback em banco/reversoes restaura somente a quota anterior, sem devolver EXECUTE ao
cliente. Suspender admissões durante a reversão: a proteção original só cobria INSERT.
Nenhuma alteração de assinatura, bloqueio administrativo, interface ou histórico.
