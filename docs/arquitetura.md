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
