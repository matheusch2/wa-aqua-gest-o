# Orientações para alterações

Use o [mapa da arquitetura](docs/arquitetura.md) para localizar a responsabilidade de cada pasta. Compare os testes na base e na versão alterada; registre falhas anteriores sem enfraquecer as verificações.

Preserve URLs públicas, escopo do service worker, manifesto, .nojekyll, .well-known/, CNAME, verificação Google e licença. Ausência de import não indica que uma página, imagem ou função possa ser removida.

Organize mudanças de banco em banco/migracoes/, consultas em banco/diagnosticos/ e versões substituídas em banco/historico/. Consulte banco/LEIA-ME.md antes de propor execução. Organização de arquivos não autoriza rodar SQL, publicar funções nem fazer deploy.

Escreva JavaScript novo em arquivo próprio, no formato de módulo ES, mas carregue-o como script clássico antes de app/script.js e publique os nomes usados pelo script num único bloco no fim do arquivo. Converter app/script.js em módulo apaga as funções chamadas por atributos onclick, e o botão para de responder sem erro nenhum. O padrão completo e o porquê estão em docs/arquitetura.md.

Todo arquivo JavaScript novo entra em ESSENCIAIS no sw.js, com ?v= novo no HTML e CACHE novo no service worker. Há teste que cobre isso.

As funções de permissão têm testes de caracterização em test/permissoes.test.js: eles registram o comportamento atual, inclusive onde ele diverge do esperado. Ao mexer nessas funções, mude o teste junto e diga no commit o que mudou de regra — um caso que passa a valer outra coisa sem aviso anula a rede de proteção da extração.
