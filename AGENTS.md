# Orientações para alterações

Use o [mapa da arquitetura](docs/arquitetura.md) para localizar a responsabilidade de cada pasta. Compare os testes na base e na versão alterada; registre falhas anteriores sem enfraquecer as verificações.

Preserve URLs públicas, escopo do service worker, manifesto, .nojekyll, .well-known/, CNAME, verificação Google e licença. Ausência de import não indica que uma página, imagem ou função possa ser removida.

Organize mudanças de banco em banco/migracoes/, consultas em banco/diagnosticos/ e versões substituídas em banco/historico/. Consulte banco/LEIA-ME.md antes de propor execução. Organização de arquivos não autoriza rodar SQL, publicar funções nem fazer deploy.
