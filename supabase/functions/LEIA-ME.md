# As Edge Functions

Estas funções rodam no Supabase, não no navegador. É onde mora o que não
pode chegar perto do celular do cliente: a chave da API do Asaas, a chave de
serviço do banco, o segredo do WhatsApp.

**Elas estavam SÓ no Supabase.** Não havia cópia aqui, nem histórico, nem
como saber o que mudou entre a versão 7 e a 19 — e a `criar-assinatura`, que
é a que cobra, já ia na 19. Uma função que recebe dinheiro sem estar no
controle de versão é a única coisa do projeto que não dava para revisar nem
voltar atrás.

Os arquivos aqui são cópia fiel do que está NO AR em 23/11/2026, lidos
direto do Supabase. Daqui para frente: mexeu, commita.

| pasta | o que faz | versão no ar |
|---|---|---|
| `criar-assinatura/` | cria o cliente no Asaas e gera a cobrança | 19 |
| `asaas-webhook/` | recebe o aviso de pagamento e muda o status da assinatura | 7 |
| `whatsapp-webhook/` | recebe as mensagens do WhatsApp | 5 |

## Como publicar uma alteração

Pelo painel do Supabase (Edge Functions → a função → Deploy), ou pelo CLI.
Depois **confira que subiu**: a versão no painel tem de ter aumentado.

Um detalhe que já custou tempo: **segredo novo só chega na função depois de
um redeploy.** Salvar o segredo e não republicar deixa a função rodando com
o valor antigo — ou sem valor nenhum — e o erro que aparece não fala de
segredo.

## O estado do pagamento hoje

A `criar-assinatura` aponta para **SANDBOX**:

```ts
const ASAAS_URL = Deno.env.get("ASAAS_API_URL") ?? "https://sandbox.asaas.com/api/v3";
```

Sem o segredo `ASAAS_API_URL` apontando para produção, tudo cai no padrão e
o dinheiro não existe. Os links já gerados no banco confirmam: todos em
`sandbox.asaas.com`.

Ela também cria uma **cobrança avulsa** (`POST /payments`), não uma
assinatura (`POST /subscriptions`). Por isso a coluna
`assinaturas.asaas_subscription_id` quase não é preenchida e não existe
cobrança automática no mês seguinte.
