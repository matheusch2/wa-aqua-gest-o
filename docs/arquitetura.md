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
