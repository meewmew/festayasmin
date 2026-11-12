# Convite Yasmin 2000s

Publique este projeto pelo GitHub usando **Cloudflare Workers Builds**. O Worker serve o convite, a confirmação e o painel no mesmo endereço. O banco D1 `yasminfesta2000s` já está criado e a tabela `rsvps` já existe. O ID do banco está em `wrangler.jsonc`.

## Publicar

1. Envie o conteúdo desta pasta para a raiz de um repositório no GitHub. Inclua `public/`, `worker/`, `drizzle/`, `package.json`, `package-lock.json` e `wrangler.jsonc`.
2. Na mesma conta do Cloudflare onde está o banco D1, vá em **Workers & Pages → Create application → Import a repository** e selecione o repositório. Use `yasminfesta2000s` como nome do Worker, a raiz do repositório como diretório, o campo de build vazio e `npm run deploy` como comando de publicação.
3. Após a primeira publicação, abra **Settings → Variables and Secrets** do Worker. Adicione como segredos `ADMIN_PASSWORD` com a senha escolhida e `SESSION_SECRET` com uma chave aleatória. Para gerar a chave no terminal, execute `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
4. Abra o endereço `workers.dev` que o Cloudflare mostrar. A capa fica em `/`, a confirmação em `/confirmar` e o painel de convidados em `/yasmin`. Use a senha do painel apenas com a organização.

Se criar outro banco no futuro, troque o ID em `wrangler.jsonc` e aplique a migração com `npm run db:remote` em um terminal autenticado no Cloudflare. O banco desta cópia começa vazio.

## Testar no computador

Execute `npm ci` e `npm run db:local`. Para testar o painel, crie um arquivo local `.dev.vars` e preencha `ADMIN_PASSWORD` e `SESSION_SECRET` com valores de teste. Execute `npm run dev` e abra o endereço indicado pelo terminal. O teste usa um banco local.

[Conectar um repositório do GitHub](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/) · [Configurar segredos](https://developers.cloudflare.com/workers/configuration/secrets/)
