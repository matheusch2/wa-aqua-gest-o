# Verificação da reorganização — 26/11/2026

Base: `e368108`, idêntica à main no início. Node v24.22.3. O comando npm test não encerrou no intervalo observado; para contar cada caso, cada arquivo foi executado separadamente com o mesmo Node, relatório TAP e limite de seis segundos. O processo do service worker não encerrou nesse limite; seus resultados emitidos estão incluídos.

| Casos com resultado | Antes | Depois |
|---|---:|---:|
| Passaram | 181 | 181 |
| Falharam | 11 | 11 |

Os nomes e resultados coincidem. Não havia lista nominal das dez falhas anteriores para confronto. Falhas reproduzidas:

- planos: a tela de planos pede o catálogo antes de desenhar
- planos: falha na leitura avisa e deixa tentar de novo
- planos: o WhatsApp é um contato no fim da tela, não um botão por card
- service worker: as duas promessas
- webhook: checkout abandonado não mexe no plano de quem já paga
- webhook: checkout pago troca o plano e zera a escolha
- webhook: o mesmo aviso dez vezes dá no mesmo que uma
- webhook: cobrança do mês seguinte não ressuscita escolha velha
- webhook: atraso não troca plano, só marca pendente
- webhook: plano que sumiu do catálogo ativa, mas não inventa limite
- webhook: pagamento sem dono não escreve em ninguém

## Arquivos movidos sem edição

- `banco/seguranca-b03-diagnostico.sql` → `banco/diagnosticos/seguranca-b03-diagnostico.sql`
- `banco/troca-proporcional.sql` → `banco/historico/troca-proporcional.sql`
- `banco/admin-vencimento-aceita-semestral.sql` → `banco/migracoes/admin-vencimento-aceita-semestral.sql`
- `banco/admin-vencimento-nao-destrava.sql` → `banco/migracoes/admin-vencimento-nao-destrava.sql`
- `banco/assinatura-plano-pretendido.sql` → `banco/migracoes/assinatura-plano-pretendido.sql`
- `banco/avisos-e-retorno-pix.sql` → `banco/migracoes/avisos-e-retorno-pix.sql`
- `banco/conciliacao-periodos-20261126.sql` → `banco/migracoes/conciliacao-periodos-20261126.sql`
- `banco/painel-admin-acesso-manual-auditado.sql` → `banco/migracoes/painel-admin-acesso-manual-auditado.sql`
- `banco/pausa-e-sem-historico.sql` → `banco/migracoes/pausa-e-sem-historico.sql`
- `banco/pix-confirmado-vinculo-cartao.sql` → `banco/migracoes/pix-confirmado-vinculo-cartao.sql`
- `banco/planos.sql` → `banco/migracoes/planos.sql`
- `banco/precos-camarao.sql` → `banco/migracoes/precos-camarao.sql`
- `banco/racao-duas-por-dia.sql` → `banco/migracoes/racao-duas-por-dia.sql`
- `banco/racao-preco-no-lancamento.sql` → `banco/migracoes/racao-preco-no-lancamento.sql`
- `banco/rpc-boletos.sql` → `banco/migracoes/rpc-boletos.sql`
- `banco/rpc-ciclos.sql` → `banco/migracoes/rpc-ciclos.sql`
- `banco/rpc-custos-fixos.sql` → `banco/migracoes/rpc-custos-fixos.sql`
- `banco/seguranca-advisor-revoke.sql` → `banco/migracoes/seguranca-advisor-revoke.sql`
- `banco/seguranca-b03-migracao.sql` → `banco/migracoes/seguranca-b03-migracao.sql`
- `banco/upgrade-proporcional-correcoes.sql` → `banco/migracoes/upgrade-proporcional-correcoes.sql`
- `banco/whatsapp-vinculo.sql` → `banco/migracoes/whatsapp-vinculo.sql`
