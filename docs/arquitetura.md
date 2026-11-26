# Mapa do repositório

| Caminho | Responsabilidade |
|---|---|
| Raiz | Entradas públicas, redirecionamentos, estilos e ícones do site; sw.js mantém o escopo do PWA. |
| app/ | Aplicação do produtor, impressão, estilos e recursos da interface. |
| ch2/ | Administração e restauração. |
| blog/ | Artigos públicos com endereços próprios. |
| assets/ | Imagens e recursos públicos compartilhados. |
| .well-known/ | Associação do domínio ao aplicativo. |
| ferramentas/ | Utilitários de desenvolvimento e geração de recursos. |
| test/ | Testes Node e auxiliares locais em helpers/. |
| supabase/functions/ | Código das Edge Functions; publicação separada do site estático. |
| banco/migracoes/ | Scripts de criação e evolução do banco. A pasta não é uma sequência de execução. |
| banco/diagnosticos/ | Consultas de diagnóstico, separadas das alterações. |
| banco/historico/ | Versões superadas para consulta. Não executar. |
| docs/ | Documentação técnica e registros de verificação. |

O navegador carrega arquivos pelos caminhos publicados. Mover páginas, manifesto, folhas de estilo ou service worker requer revisar URLs, escopo e precache. Os SQLs são arquivos operacionais; não são carregados pelo aplicativo.

## JavaScript do produtor

A entrada é `app/index.html`. Ela carrega `app/js/numeros-br.js` antes de `app/script.js`, como scripts clássicos. Isso preserva o acesso às funções pelos eventos HTML e evita introduzir empacotamento. O auxiliar contém apenas a interpretação de separadores decimais e de milhar; não acessa DOM, sessão ou banco. O service worker guarda ambos os arquivos para uso offline.

O [inventário anterior à extração](javascript-inventario.tsv) registra as funções, inclusive callbacks, com a linha na base aa81899 e os nomes globais referenciados. A [lista global](javascript-globais.txt) inclui funções e variáveis de topo. As referências são estáticas por nome: podem incluir variáveis locais homônimas ou referências em closures, e não resolvem chamadas feitas por strings de HTML. Não use ausência nessa lista para apagar código.

Dependências externas a preservar: DOM e eventos HTML, armazenamento local, APIs de rede e navegação, cliente Supabase e Chart. Autenticação, assinatura, consultas e cálculos de cultivo continuam no script principal. Nenhuma declaração de função nomeada repetida ou corpo idêntico entre funções nomeadas foi encontrado na análise da base. Candidatos para revisão: _finOrdenacao, _linkWhatsAppRenovar e _linkWhatsAppPlano não têm segunda ocorrência nominal no script. toggleSenha aparece também em app/login.html, que tem sua própria implementação e seus próprios eventos. Nenhum deles foi removido.

## Verificação da primeira extração

A comparação usou Node 24.22.3. Antes dos ajustes no ambiente de testes: 181 aprovações e 11 falhas. Depois de atualizar os simuladores, antes e depois de extrair o bloco: 191 aprovações e uma falha de inicialização do navegador, sem testes pulados. O teste de navegador continua obrigatório quando Playwright está instalado. Instale o Chromium correspondente ao Playwright ou indique um executável real com CHROMIUM_PATH antes de rodar npm test. A execução offline em navegador real ainda precisa ser confirmada antes de integrar.

Os testes do painel agora simulam o seletor do plano e a área de revisão. O banco simulado do webhook isola as tabelas, registra as solicitações de revisão e o período confirmado; o aviso de atraso é encaminhado à função de conciliação. O teste verifica esse encaminhamento, não o SQL em produção. As funções do Supabase não foram alteradas.

## Para onde vai o JavaScript: módulos ES

O destino é módulo ES. A transição é gradual porque uma conversão de uma vez
quebraria o app em silêncio, e o motivo é concreto.

### O que impede converter o `script.js` hoje

Dentro de `<script type="module">` as funções **não viram globais**. Centenas de
botões do app chamam funções por atributo HTML (`onclick="abrirAssinatura()"`),
inclusive em telas montadas por template string dentro do próprio script.
Contagem feita em 26/11/2026 nas funções críticas: `abrirAssinatura` tem 5
`onclick`, `toggleSenha` tem 5, e `sairUsuario`, `abrirMinhaConta`,
`excluirMinhaConta`, `salvarNovaSenha`, `confirmarSairConta`,
`confirmarExcluirConta` e `carregarPlanos` têm 1 cada.

Transformar `app/script.js` em módulo apaga todos esses nomes do escopo global
de uma vez. O botão não dá erro de carregamento: o clique simplesmente não faz
nada. Nenhum teste atual pega isso.

### O que JÁ pode ser módulo

Verificado no arquivo: fora dos comentários, a única linha que **executa** no
topo do `script.js` é `const supabaseClient = supabase.createClient(...)`
(linha 37). Todo o resto são declarações, e a inicialização acontece depois, no
evento de carga. Nenhuma função de `app/js/numeros-br.js` é chamada em tempo de
análise.

Isso importa porque um `<script type="module">` é adiado: ele roda **depois** do
script clássico e **antes** do `DOMContentLoaded`. Como o `script.js` só chama
os auxiliares de dentro de funções, um auxiliar carregado como módulo chega a
tempo. A ordem só seria problema se alguém passasse a chamá-lo no topo.

### O padrão enquanto a transição não termina

Um arquivo extraído nasce assim:

1. **Escrito como módulo**: funções nomeadas, sem tocar em DOM, sessão ou
   `supabaseClient` — o que precisar deles recebe por parâmetro.
2. **Carregado como script clássico** (`<script src="js/nome.js">`) antes do
   `script.js`, como já faz o `numeros-br.js`. É o passo que preserva os
   eventos inline.
3. **Publicando o que o `script.js` usa** num bloco único e explícito no fim do
   arquivo, nunca espalhado:

   ```js
   // Ponte para o script clássico. Sai quando os eventos inline saírem.
   Object.assign(globalThis, { _parseVenc, _planoVencido, _dentroDaCarencia });
   ```

4. **Entrando em `ESSENCIAIS` no `sw.js`**, com `?v=` novo no HTML e `CACHE`
   novo no service worker. Há teste para isso desde 26/11/2026
   (`service worker: nenhum script próprio fica de fora do precache`): script
   fora do precache não deixa a tela abrir offline.

A virada para `export`/`import` de verdade acontece por arquivo, e só depois
que nenhum nome daquele arquivo for chamado por atributo HTML. O caminho para
chegar lá é trocar `onclick="x()"` por delegação de eventos — tarefa separada,
que não deve andar junto com a extração.

### Ordem e pré-requisito

A ordem recomendada e o risco de cada bloco estão em
[modulos-criticos.md](modulos-criticos.md). O pré-requisito registrado lá vale
repetir: as funções de permissão ganharam cobertura em
`test/permissoes.test.js` (37 casos) **antes** de qualquer extração, porque são
testes de caracterização — eles provam que a extração não mudou o
comportamento, e só servem para isso se existirem antes dela.
