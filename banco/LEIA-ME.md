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
| `admin-vencimento-nao-destrava.sql` | aplicada 23/11/2026 | migração `admin_ajustar_vencimento_nao_destrava_cancelado`; corpo conferido depois |
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

O código da Edge Function do WhatsApp morava aqui; foi para
`supabase/functions/whatsapp-webhook/`, junto com as outras.

## Não há pendência

Em 23/11/2026 o último arquivo aberto foi aplicado. O
`admin-vencimento-nao-destrava.sql` fechava um furo de cobrança que estava no
ar: ajustar a data de vencimento de um cliente **bloqueado** o destravava
sozinho, porque a função gravava `status = 'ativo'` sem olhar o estado
anterior.

Foi aplicado como **migração**, não pelo SQL Editor — por isso ele aparece em
`migrations`, ao contrário de quase tudo aqui. Depois de aplicar, o corpo da
função foi lido de volta para conferir que o `case` entrou mesmo.

Quem escapou enquanto o furo estava aberto: ninguém. Das 55 assinaturas, 3
estavam vencidas (duas no plano grátis, uma no básico há 3 dias) e todas
`ativo` desde outubro. Existe uma única assinatura `cancelado` no banco, com
vencimento em 2027.

## Ao escrever SQL novo aqui

Duas armadilhas que já custaram caro nesta pasta:

1. **Função existir não é função estar certa.** `CREATE OR REPLACE` troca o
   corpo de algo que já existia; conferir só o nome dá "aplicada" para uma
   versão velha. Quando o arquivo conserta um corpo, leia o `prosrc`.

2. **Procurar texto no `prosrc` engana.** Ao conferir o `whatsapp_gerar_codigo`,
   o padrão caçado apareceu *dentro de um comentário* que explicava por que
   aquele caminho tinha sido rejeitado — e o diagnóstico saiu invertido. Leia
   o corpo inteiro antes de concluir.
