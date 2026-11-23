# O que já rodou no banco

Esta pasta guarda o SQL do projeto. O problema dela nunca foi o conteúdo:
era não dar para saber, abrindo um arquivo, se ele **já rodou** ou se é
trabalho esperando.

O Supabase só registra em `migrations` o que entra pela ferramenta de
migração. Tudo que foi colado no SQL Editor — que é a maior parte daqui —
não deixa rastro nenhum. De 12 arquivos, **um** aparece no histórico.

Então a única prova confiável é outra: **o objeto existe no banco?** Foi
assim que cada linha abaixo foi conferida em 23/11/2026, perguntando ao
banco de produção, não à memória de ninguém. Cada arquivo também leva o
carimbo no topo.

| arquivo | estado | como foi conferido |
|---|---|---|
| `admin-vencimento-nao-destrava.sql` | **PENDENTE** | o corpo de `admin_ajustar_vencimento` ainda grava `status='ativo'` sempre |
| `pausa-e-sem-historico.sql` | aplicada | migração `viveiro_pausas_e_sem_historico`, 13/11/2026 |
| `precos-camarao.sql` | aplicada | tabela `precos_camarao` + função `precos_camarao_carimbo` existem |
| `racao-duas-por-dia.sql` | aplicada | índice `ux_racoes_viveiro_data_tipo` existe |
| `racao-preco-no-lancamento.sql` | aplicada | coluna `racoes.custo_por_kg` existe |
| `rpc-boletos.sql` | aplicada | função `pagar_boleto` existe |
| `rpc-ciclos.sql` | aplicada | funções `encerrar_ciclo` e `reiniciar_ciclo` existem |
| `rpc-custos-fixos.sql` | aplicada | função `reajustar_custo_fixo` existe |
| `seguranca-advisor-revoke.sql` | aplicada | nenhuma `SECURITY DEFINER` do `public` com EXECUTE para PUBLIC |
| `seguranca-b03-diagnostico.sql` | histórico | só lê; serviu para liberar a migração B03 |
| `seguranca-b03-migracao.sql` | aplicada | 5 chaves estrangeiras apontando para `viveiros` |
| `whatsapp-vinculo.sql` | aplicada | tabela, índice e as 3 funções existem, já na versão corrigida |

`whatsapp-webhook.ts` não é SQL: é o código da Edge Function, guardado aqui
ao lado do SQL que ela usa.

## A pendência

`admin-vencimento-nao-destrava.sql` conserta um furo de cobrança que está
**no ar agora**: ajustar a data de vencimento de um cliente **bloqueado** o
destrava sozinho, porque a função grava `status = 'ativo'` sem olhar o
estado anterior. A correção é uma linha, e o arquivo tem o `CREATE OR
REPLACE` inteiro pronto para colar no SQL Editor.

## Ao escrever SQL novo aqui

Duas armadilhas que já custaram caro nesta pasta:

1. **Função existir não é função estar certa.** `CREATE OR REPLACE` troca o
   corpo de algo que já existia; conferir só o nome dá "aplicada" para uma
   versão velha. Quando o arquivo conserta um corpo, leia o `prosrc`.

2. **Procurar texto no `prosrc` engana.** Ao conferir o `whatsapp_gerar_codigo`,
   o padrão caçado apareceu *dentro de um comentário* que explicava por que
   aquele caminho tinha sido rejeitado — e o diagnóstico saiu invertido. Leia
   o corpo inteiro antes de concluir.
