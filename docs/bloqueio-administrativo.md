# Bloqueio administrativo separado da situação comercial

Relatório de 27/11/2026, branch `seguranca/bloqueio-administrativo-20261126`
(a partir de `65d6885`). **Nada foi aplicado em produção e nada foi publicado.**
O Supabase foi consultado para auditar, e a migração foi ensaiada contra o
banco real dentro de uma transação desfeita no fim.

---

## 1. O problema, com o caso que já aconteceu

Hoje as duas coisas são o mesmo campo, `assinaturas.status`:

| quem escreve | o que grava |
|---|---|
| "Bloquear" no painel | `status = 'cancelado'` |
| "Reativar" no painel | `status = 'ativo'` |
| "Liberar" no painel (comercial) | `status = 'ativo'` |
| Pix confirmado | `status = 'ativo'` |
| Cartão confirmado | `status = 'ativo'` |
| `SUBSCRIPTION_DELETED` | `status = 'cancelado'` |

Quem escreve por último manda.

**O caso está no `admin_historico`** (conta `93fdb707`):

```
15/09 23:39:51  bloquear
01/10 14:37:25  liberar     <- status voltou para 'ativo'
01/10 14:37:37  bloquear    <- 12 segundos depois
```

Um "Liberar", que é ação **comercial**, desligou um bloqueio administrativo
que estava de pé havia duas semanas. Quem estava no painel percebeu e refez o
bloqueio 12 segundos depois.

### Investigação das contas antigas

Cinco bloqueios e cinco reativações, em **três clientes**, entre 15/09 e
02/11. Cruzei cada bloqueio com o que veio depois — ações administrativas,
Pix pagos e períodos de cartão:

| cliente | bloqueado em | o que veio depois | situação hoje |
|---|---|---|---|
| `32bcf26d` | 12/10 | nada | `cancelado` — **bloqueio de pé** |
| `93fdb707` | 12/10 | `reativar` 49 s depois; Pix pago em 24/11 | `ativo` |
| `9f1b0724` | 02/11 | `liberar` + `reativar` + `liberar` em 08/11 | `ativo` |

**Nenhum pagamento desfez um bloqueio.** Todos os desbloqueios têm uma ação
administrativa correspondente. O caminho existia; não foi percorrido por um
pagamento. O que foi percorrido, uma vez, foi o "Liberar".

**Nenhum dos cinco bloqueios tem motivo registrado** — a Edge Function
gravava `detalhes = {}`. Também não tem responsável utilizável: ela escreve
com `service_role`, que não tem `auth.uid()`.

---

## 2. Auditoria dos caminhos de escrita

### RLS

- `assinaturas` só tem política de **SELECT**. O cliente não escreve nela por
  PostgREST; toda escrita vem de RPC `SECURITY DEFINER` ou de `service_role`.
- `racoes`, `biometrias`, `despescas`, `custos` e `ciclos` têm políticas
  **RESTRICTIVE** (`plano_insert`, `plano_update`, `plano_delete`) chamando
  `viveiro_permite_lancamento()`. É a porta de escrita no servidor, e ela
  funciona: RESTRICTIVE combina com E, não com OU.
- **Não passam por essa porta:** `viveiros`, `boletos`, `custos_fixos`,
  `produtos`, `tipos_racao` — só política permissiva de dono. Era o buraco que
  sobrava, e é o que as políticas novas fecham.

### RPCs

Das 26 funções do schema `public`, cinco escrevem `assinaturas`:
`admin_painel_manual`, `confirmar_pagamento_pix`, `tratar_aviso_cobranca`,
`criar_assinatura_padrao` e `admin_ajustar_vencimento` (via a primeira). As
cinco `admin_*` conferem `perfis.role = 'admin'` por dentro — verificado no
corpo de cada uma.

### Edge Functions

- `admin-clientes` (`service_role`): `bloquear`/`reativar` gravavam `status`.
- `asaas-webhook` (`service_role`): grava `status` em quatro pontos.
- `assinar-pix` / `assinar-cartao`: escrevem só os campos de checkout.
- **`whatsapp-webhook` não toca em assinatura nem em acesso** — só confirma
  identidade por `whatsapp_confirmar`. Fora do alcance desta mudança.

### Frontend

`_contaBloqueada()` decide o modo somente leitura na tela. Ele começa com
`if (_planoEfetivo) return false`, e `meu_plano_efetivo()` nunca devolve nulo
quando responde — registrado em `docs/seguranca-limites.md` (branch de
refatoração). Por isso a trava da tela hoje quase não age; o que segura é o
servidor.

---

## 3. O que a mudança faz

### Banco (`banco/migracoes/bloqueio-administrativo-20261127.sql`)

1. **Três colunas** em `assinaturas`: `bloqueio_admin_em`,
   `bloqueio_admin_por`, `bloqueio_admin_motivo`. Bloqueado é
   `bloqueio_admin_em IS NOT NULL` — não é mais um valor de `status`.
   Uma `CHECK` impede bloqueio sem motivo.
2. **Gatilho `trg_assinatura_bloqueio_admin`**: recusa qualquer escrita nessas
   três colunas que não venha das funções dedicadas. Vale para `service_role`
   também — ele ignora RLS, mas não ignora gatilho. É isso que torna
   "pagamento não desfaz bloqueio" uma garantia estrutural, e não uma
   convenção.
3. **`admin_bloquear_cliente` / `admin_desbloquear_cliente`**: exigem papel de
   admin e motivo de 3 a 180 caracteres, registram no `admin_historico`, e
   mexem **só** nas três colunas. O desbloqueio ainda compara o antes e o
   depois e desfaz a operação se plano, ciclo, status, limite ou vencimento
   tiverem mudado.
4. **`meu_plano_efetivo()`** passa a devolver `bloqueio_admin`,
   `bloqueio_admin_desde` e `bloqueio_admin_motivo`. Plano, limite e
   vencimento continuam sendo a situação **comercial**, que o bloqueio não
   altera.
5. **`viveiro_permite_lancamento()`** devolve falso quando bloqueado — e com
   isso as cinco tabelas já protegidas passam a recusar escrita.
6. **Políticas novas** em `viveiros`, `boletos`, `custos_fixos`, `produtos` e
   `tipos_racao`: INSERT, UPDATE e DELETE, uma a uma. **Nunca `FOR ALL`** —
   isso alcançaria o SELECT e o cliente perderia a consulta dos próprios
   dados, que é justamente o que se quer preservar.
7. **Carga inicial** a partir do `admin_historico`: marca quem tem "bloquear"
   como última ação administrativa. Hoje: **uma conta**.

### Código

- **Painel (`ch2/index.html`)**: "Reativar" virou "Desbloquear"; os dois
  botões chamam as RPCs com o JWT do administrador (não mais a Edge Function),
  pedem o motivo e recusam texto curto antes de ir ao servidor. A lista ganhou
  um selo próprio de bloqueio administrativo, com a data e o motivo no
  `title`; o selo comercial `cancelado` voltou a dizer "Cancelado".
- **`admin-clientes`**: `bloquear`/`reativar` passam a responder **410** com
  instrução. Recusar explicitamente, em vez de apagar, evita que um painel
  velho em cache continue bloqueando pelo caminho antigo em silêncio.
- **`app/script.js`**: `_bloqueioAdministrativo()` e `_avisoBloqueio()` novos;
  `_contaBloqueada()` passa a considerar o bloqueio **antes** do atalho do
  `_planoEfetivo`. O aviso deixa de mandar pagar: quem foi bloqueado pelo
  suporte não resolve pagando, e dizer o contrário faz a pessoa pagar à toa.

---

## 4. Como foi ensaiado

### Contra o banco de produção, numa transação desfeita

A migração inteira rodou dentro de `BEGIN … ROLLBACK`, contra o schema real.
Resultado, com resíduo conferido em zero depois:

```
pagamento limpando o bloqueio  -> barrado: BLOQUEIO_ADMIN_PROTEGIDO
pagamento só no comercial      -> passou (correto)
meu_plano_efetivo              -> bloqueio_admin=true, plano=basico, limite=5
viveiro_permite_lancamento     -> false
o cliente continua lendo       -> 2 viveiros
trg_limite_viveiros            -> tgtype 21 (AFTER INSERT OR UPDATE), intacto
carga inicial                  -> 1 conta marcada
```

A terceira linha é o ponto da tarefa: a situação comercial segue intacta
(`basico`, limite 5) e a conta está bloqueada assim mesmo.

### Testes automatizados

`test/bloqueio-administrativo.test.js` — 16 casos, todos provados com defeito
plantado, um de cada vez:

| defeito plantado | casos que quebram |
|---|---|
| a tela ignora o bloqueio administrativo | 3 |
| o aviso volta a mandar pagar | 1 |
| o painel para de pedir motivo | 1 |
| a Edge Function volta a gravar `status` | 1 |
| o desbloqueio deixa de conferir o plano | 1 |
| a migração encosta na quota | 1 |
| a reversão perde o passo 0 | 1 |

### O que **não** deu para rodar aqui

O ensaio de banco em cluster próprio. Esta máquina tem só o cliente `psql`,
sem `initdb`/`pg_ctl`. Escrevi `test/postgres/bloqueio.sql` e
`test/postgres/validar-bloqueio.sh` no mesmo molde do `validar-quota.sh` do
hotfix, com workflow em `.github/workflows/validar-bloqueio-administrativo.yml`
— **eles nunca foram executados**. A sintaxe do shell foi conferida
(`bash -n`); a do SQL, não. Rodar na CI é pré-requisito para aplicar.

---

## 5. Estado dos testes

| | antes | depois |
|---|---:|---:|
| passam | 187 | **203** |
| falham | 10 | **10** |
| ignorados | 0 | 0 |

As 10 falhas são herdadas da `main` e **não têm relação com esta mudança**:
são os testes de `planos` e `webhook` que a branch `refatoracao/estrutura-20261126`
já corrigiu (lá são 235 passando). Confirmei que são exatamente as mesmas de
antes das minhas alterações. Quando as duas branches se encontrarem, a conta
passa a ser 235 + 16.

Não toquei em `test/fluidez.test.js`, `test/helpers/*` nem
`test/sw-rede-primeiro.test.js`, justamente para não conflitar com a branch de
refatoração. Também não encostei na modularização do JavaScript.

---

## 6. Plano de reversão

`banco/reversoes/bloqueio-administrativo-20261127.sql`, na ordem inversa:
políticas, funções de plano de volta à versão de 26/11, gatilho e RPCs, e por
último as colunas.

**Reverter apaga quem está bloqueado.** O histórico em `admin_historico`
permanece (as ações e os motivos ficam), mas o *estado* se perde. Por isso o
arquivo começa com um **passo 0** que não é destrutivo: uma consulta que lista
os bloqueados, para alguém anotar antes. A reversão termina conferindo que a
correção crítica de quota continua de pé (`tgtype = 21` e o schema
`wa_quota_interna`), e falha se não estiver.

Se o motivo da reversão for um defeito pontual, corrigir o defeito é melhor
que reverter tudo: depois da reversão esses clientes voltam a ter como única
trava o `assinaturas.status`, que é o problema de origem.

---

## 7. O que fica em aberto, para a revisão

1. **A conta `32bcf26d`.** Depois da carga inicial ela fica bloqueada pelos
   dois caminhos: `status = 'cancelado'` (comercial) e `bloqueio_admin_em`
   preenchido. Deliberadamente não reescrevi o `status` — não dá para
   reconstruir com confiança se aquele "cancelado" era comercial ou era o
   bloqueio. Alguém precisa decidir, com a conta à vista, qual é a situação
   comercial dela.
2. **Os motivos migrados são um carimbo**, não o motivo real: "Migrado do
   histórico administrativo em 27/11/2026; motivo original não foi registrado
   na época." Não havia o que migrar.
3. **A ordem de publicação importa.** O painel novo chama RPCs que ainda não
   existem; a Edge Function nova recusa o caminho antigo. Aplicar na ordem:
   (1) migração, (2) Edge Function, (3) painel e app. Entre (1) e (3) o painel
   antigo continua funcionando pelo caminho velho — daí o 410 vir depois da
   migração, e não antes.
4. **`_contaBloqueada()` continua com o atalho do `_planoEfetivo`.** Acrescentei
   o bloqueio administrativo antes dele, mas a inconsistência comercial
   registrada em `docs/seguranca-limites.md` segue de pé. É assunto da outra
   branch; misturar aqui atrapalharia as duas.
5. **O gatilho depende de um sinal de sessão** (`wa.bloqueio_admin`). Quem
   escrever uma função nova com `set_config('wa.bloqueio_admin','1',true)`
   contorna a proteção. É uma barreira contra engano, não contra um
   administrador do banco decidido — e nenhuma barreira dentro do banco seria.
