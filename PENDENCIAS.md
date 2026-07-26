# Pendências — WA Aqua Gestão

Anotações do que está combinado pra fazer. (Sem senhas nem dados sensíveis aqui.)

## Próximo passo (Matheus vai retomar)
- [ ] **Adicionar o service worker** — arquivo que:
  - faz aparecer o botão "Instalar" no computador (Chrome/Edge);
  - é pré-requisito pra empacotar o app pra Play Store;
  - dá resistência offline básica.
  - Já temos: `manifest.json`, ícones (192/512), HTTPS. Só falta o service worker.

## Depois do service worker
- [ ] Gerar o pacote Android com o **PWABuilder** (a "casquinha" que abre o site — um código só).
- [ ] Conta de desenvolvedor da **Play Store**: US$ 25 (pagamento único).
- [ ] Configurar o `assetlinks.json` (Digital Asset Links) pro app abrir em tela cheia, sem barra do navegador.
- [ ] Preparar itens que a Play Store exige: **política de privacidade** (URL), descrição, prints, classificação de conteúdo.
- [ ] Atenção: conta pessoal nova na Play Console precisa rodar **teste fechado (~12 testadores por 14 dias)** antes de publicar pra todo mundo.

## Contexto útil
- Site: waaqua.com.br (GitHub Pages, branch `main`). Backend: Supabase (plano grátis por enquanto).
- Painel admin: `/ch2`. Restauração de backup: `/ch2/restaurar.html`.
- Meta pra subir pro Supabase Pro: por volta de ~10 clientes pagando.

## Futuro (sem pressa)
- [ ] Limpar a coluna esquisita `gen_random_uuid()` da tabela `viveiros` (SQL de 1 linha).
- [ ] Recorrência/renovação automática de pagamento (hoje é avulso).
