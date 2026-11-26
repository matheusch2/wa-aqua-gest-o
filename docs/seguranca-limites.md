# Segurança dos limites de viveiros e das permissões

Levantamento de 26/11/2026, etapa 4.1. **Nada foi alterado no banco.** Tudo
abaixo foi conferido no projeto de produção por consulta, e o contorno descrito
na seção 1 foi provado num bloco `DO` que termina em exceção — a exceção desfaz
as escritas, e a contagem depois confirmou zero resíduo.

---

## 1. O limite de viveiros pode ser contornado por UPDATE

**Gravidade: alta. Explorável hoje, por qualquer cliente logado, com a chave
pública do app.**

### O que protege o limite

Uma coisa só: o gatilho `trg_limite_viveiros` na tabela `public.viveiros`.

```
tgname: trg_limite_viveiros   tabela: viveiros
eventos: INSERT               nível: ROW      momento: BEFORE
função: checar_limite_viveiros (SECURITY DEFINER)
```

Criado pela migração `20261124162340 validade_limite_viveiros`, em 24/11/2026.

### As duas brechas, no próprio código do gatilho

```sql
IF NEW.ativo IS NOT TRUE THEN RETURN NEW; END IF;   -- sai cedo
...
SELECT count(*) INTO qtd FROM public.viveiros WHERE user_id=NEW.user_id AND ativo IS TRUE;
IF qtd >= limite THEN RAISE EXCEPTION 'LIMITE_PLANO: ...'; END IF;
```

1. **O gatilho não dispara em UPDATE.** Só `INSERT`.
2. **Em INSERT, ele sai antes de contar quando `ativo` não é verdadeiro.**

### A política de RLS deixa o UPDATE passar

```
usuarios_update_viveiros | UPDATE | {public}
  qual:       (auth.uid() = user_id)
  with_check: (auth.uid() = user_id)
```

Só confere o dono. Nada impede o cliente de escrever `ativo = true`.

### Os dois caminhos

**Reativar um viveiro apagado.** O app não apaga viveiro: ele desativa
(`app/script.js:6779`, `update({ ativo: false })`). Então toda conta que já
apagou viveiro tem candidatos prontos:

```
PATCH /rest/v1/viveiros?id=eq.<viveiro inativo do próprio usuário>
{"ativo": true}
```

**Criar quantos quiser, do zero.** Em dois passos:

```
POST  /rest/v1/viveiros        {"user_id": <eu>, "nome": "x", "ativo": false}   -- gatilho sai cedo
PATCH /rest/v1/viveiros?id=eq.<novo>   {"ativo": true}                          -- sem gatilho
```

### A prova

Ensaio sobre um cliente real do plano grátis (limite 1), desfeito ao final:

```
cliente gratis, viveiros ativos hoje: 3 (limite do plano: 1)
1) INSERT ativo=true  -> barrado: LIMITE_PLANO: 3 viveiro(s), limite 1
2a) INSERT ativo=false -> passou (o gatilho sai cedo)
2b) UPDATE para ativo  -> PASSOU. ativos agora: 4
```

O caminho direto é barrado; o desvio passa.

### Alguém já usou?

**Não há indício de exploração.** Quatro contas estão acima do limite hoje —
três no grátis com 2 e 3 viveiros ativos, e uma no `basico` cujo limite efetivo
é 1 (plano fora de vigência). Mas os viveiros excedentes foram criados em
**junho e julho de 2026**, e o gatilho é de **24/11/2026**: são anteriores à
regra, não burla dela.

Isso também diz que, quando o gatilho passar a valer em UPDATE, essas contas
vão precisar de tratamento — ou ficam impedidas de reativar qualquer coisa.

### Correção sugerida (NÃO aplicada)

Fazer o gatilho valer também em UPDATE, contando só quando o viveiro está
*virando* ativo:

```sql
-- no corpo de checar_limite_viveiros, antes de contar:
--   em UPDATE, só interessa a transição de inativo para ativo
IF TG_OP = 'UPDATE' AND OLD.ativo IS TRUE THEN RETURN NEW; END IF;

-- e o gatilho passa a escutar os dois eventos:
drop trigger if exists trg_limite_viveiros on public.viveiros;
create trigger trg_limite_viveiros
  before insert or update on public.viveiros
  for each row execute function public.checar_limite_viveiros();
```

Antes de aplicar, decidir o que fazer com as quatro contas legadas: a conta
delas passa a estourar o limite na primeira reativação. Conferir também se
alguma rotina do app atualiza `viveiros` em lote — a contagem roda por linha.

### O que NÃO é caminho de contorno

- **DELETE**: não há política de DELETE em `viveiros`. O cliente não apaga.
- **RPCs**: nenhuma das 26 funções do schema `public` insere ou ativa viveiro.
  `escolher_viveiro_gratuito` só grava a escolha; `viveiro_permite_lancamento`
  só lê.
- **service_role / Edge Functions**: nenhuma escreve em `viveiros`. A única
  menção é uma leitura em `admin-clientes` (`select user_id ... eq('ativo', true)`),
  para contar viveiros na listagem do painel.

---

## 2. `assinatura_carimbar_valor` com EXECUTE para `anon`

**Gravidade: baixa na prática, mas é desvio da regra do próprio projeto.**

É a **única** função `SECURITY DEFINER` do schema `public` com EXECUTE para
`PUBLIC`/`anon`. Confirmado por consulta e pelo advisor de segurança do
Supabase ([lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)).

Foi criada em 26/11/2026, na migração `assinatura_valor_contratado`, e o
`revoke` não acompanhou. Todas as outras tiveram o grant retirado por
`banco/migracoes/seguranca-advisor-revoke.sql`, que estabeleceu a regra.

**Por que a gravidade real é baixa:** é função de gatilho (`usada_como_gatilho = 1`).
O Postgres recusa chamá-la diretamente — `trigger functions can only be called
as triggers` —, então a chamada por `/rest/v1/rpc/` não executa nada. O
problema é de consistência e de auditoria, não de porta aberta.

### Correção sugerida (NÃO aplicada)

```sql
revoke execute on function public.assinatura_carimbar_valor() from public, anon, authenticated;
```

Uma linha, no mesmo formato das outras em `seguranca-advisor-revoke.sql`.

---

## 3. As demais funções `SECURITY DEFINER` chamáveis por `authenticated`

O advisor aponta 13. **Doze são por desenho**, e conferi o motivo de cada
grupo:

- As cinco `admin_*` (`admin_ajustar_vencimento`, `admin_excluir_cliente`,
  `admin_pagamentos_vigentes`, `admin_painel_acesso`, `admin_painel_manual`)
  **checam `perfis.role = 'admin'` por dentro** — verificado no corpo das cinco.
  O grant para `authenticated` é o que permite o painel funcionar; a barreira
  está dentro.
- As de usuário (`meu_plano_efetivo`, `cotar_troca_plano`,
  `escolher_viveiro_gratuito`, `viveiro_permite_lancamento`,
  `consultar_meu_checkout_pix`, `whatsapp_gerar_codigo`, `whatsapp_desconectar`)
  agem sobre `auth.uid()` e não aceitam um usuário alvo.

A décima terceira é a `assinatura_carimbar_valor` da seção 2.

---

## 4. Quatro tabelas com RLS ligado e nenhuma política

Apontado pelo advisor: `admin_historico`, `cobrancas_pix`, `periodos_cartao`,
`viveiro_gratuito_escolha`.

Sem política, a API do cliente não lê nem escreve nessas tabelas — só o
`service_role`, que ignora RLS. Pelo uso de cada uma, **parece ser a intenção**:
são tabelas de registro interno, escritas pelas Edge Functions e pelos gatilhos.

Vale confirmar que é intenção e não esquecimento, porque as quatro guardam
informação de pagamento, e uma política acrescentada por engano as abriria de
uma vez.

---

## 5. Inconsistência de regra encontrada pelos testes

Não é falha de segurança, mas muda quem consegue escrever no app. Registrada
aqui porque veio do mesmo levantamento, e com teste que fixa o comportamento
atual (`test/permissoes.test.js`).

**`_contaBloqueada()` hoje quase nunca bloqueia.** A função começa com:

```js
if (_planoEfetivo) return false;
```

E `meu_plano_efetivo()` — conferida no banco — **nunca devolve nulo quando
responde**: para quem não está vigente ela devolve
`{plano:'gratis', limite_viveiros:1, ...}`, que é um objeto verdadeiro. Como
`_planoEfetivo` é preenchido em toda carga (`app/script.js:15530`), a trava
global se desliga inclusive para um cliente cancelado.

O que ainda protege: o limite por viveiro cai para 1, e
`_bloqueioViveiro` continua barrando os excedentes. O que deixou de proteger:
`_bloqueioEdicao`, usado por catálogos, boletos, custos fixos e produtos.

A regra local só volta a valer quando a RPC falha — aí `_planoEfetivo` fica
nulo e o caminho antigo roda.

**Não foi alterado.** Decidir se o certo é o servidor mandar sozinho (e então
remover o caminho local, que hoje é morto) ou se a trava global deve voltar a
olhar o conteúdo da resposta, e não só a existência dela.
