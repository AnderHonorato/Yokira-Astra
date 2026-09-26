<div align="center">

<img src="static/marca/emblema-192.png" alt="Emblema Yōkira" width="96" />

# Yōkira Astra

Plataforma de catálogo e streaming de animes, em português, feita com SvelteKit,
Prisma, SQLite e FFmpeg.

**Roda em `http://localhost:4107`** (porta fixa, definida no `package.json`).

</div>

---

## Índice

1. [O que é e como funciona](#o-que-é-e-como-funciona)
2. [Requisitos](#requisitos)
3. [Instalação](#instalação)
4. [Como rodar](#como-rodar)
5. [Como encerrar](#como-encerrar)
6. [Funcionalidades](#funcionalidades)
7. [Login padrão](#login-padrão)
8. [Variáveis de ambiente](#variáveis-de-ambiente)
9. [Testes e verificação](#testes-e-verificação)
10. [Todos os comandos](#todos-os-comandos)
11. [Erros comuns](#erros-comuns)
12. [Documentação complementar](#documentação-complementar)

---

## O que é e como funciona

Um catálogo de animes com home em trilhas, página de título com temporadas e
episódios, player de vídeo próprio, lista pessoal, progresso de exibição,
avaliações, contas com verificação de e-mail e um painel administrativo que cadastra
títulos e dá vídeo aos episódios (por upload convertido em HLS ou por link).

### Stack

| Camada       | Tecnologia                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| Front e back | SvelteKit 2 + Svelte 5, servidor Node via `@sveltejs/adapter-node`, Vite 8 |
| Linguagem    | TypeScript                                                                 |
| Banco        | SQLite (arquivo `dev.db`) via Prisma 7 + `@prisma/adapter-better-sqlite3`  |
| Senhas       | Argon2 (`@node-rs/argon2`)                                                 |
| Vídeo        | FFmpeg/ffprobe no servidor (conversão para HLS 360p/720p/1080p) e `hls.js` |
| E-mail       | Terminal, arquivo local ou API do Resend (escolhido por variável)          |
| Estilo       | CSS puro, sem framework de UI                                              |
| Testes       | Vitest (unitários e integração) e Playwright (ponta a ponta)               |

### Como as partes se encaixam

- **Páginas e API** ficam em `src/routes/`. As páginas são renderizadas no servidor;
  os endpoints `+server.ts` em `src/routes/api/` atendem as ações do navegador
  (lista, progresso, avaliação, audiência, painel etc.).
- **Regras de servidor** ficam em `src/lib/servidor/`: autenticação e sessão, acesso
  ao banco, gravação de upload, fila de conversão, e-mail, recomendações e mídia.
- **`src/hooks.server.ts`** roda em toda requisição: lê o cookie de sessão
  (`yokira_astra_sessao`), aplica o tema e devolve cabeçalhos de segurança. É também
  onde sobe o **trabalhador da fila de conversão**, no mesmo processo web (a menos que
  `SEM_TRABALHADOR` esteja definida).
- **Banco**: o Prisma lê `DATABASE_URL` (`prisma.config.ts`) e gera o cliente em
  `src/lib/servidor/banco/gerado/`. O schema e as migrations estão em `prisma/`.
- **Mídia** (originais enviados, segmentos HLS, capas, legendas) fica em `midia/`,
  fora de `static/` e fora do Git. Os segmentos só são servidos pelas rotas
  `/midia/...` e `/api/midia/playlist`, com links assinados por HMAC usando
  `SEGREDO_SESSAO`.
- **Serviços externos**: FFmpeg (binário local, opcional) e Resend (só se
  `EMAIL_TRANSPORTE=resend`). Vídeos por link podem vir de arquivo direto, playlist
  HLS remota ou incorporação do YouTube/Vimeo.
- **Navegador**: `src/service-worker.ts` guarda em cache os assets e o catálogo
  público; o player carrega `hls.js` só quando o navegador não toca HLS nativamente.

### Pastas

```
yokira-astra/
├── .github/workflows/   CI: tipos, lint, formatação, testes e build a cada PR para main
├── docs/                Documentação técnica e scripts de auditoria/medição
├── prisma/              schema.prisma, migrations, seed e catálogo fictício
├── scripts/             Ferramentas de terminal (iniciar, encerrar, contas, exportar/importar)
├── src/
│   ├── lib/
│   │   ├── cliente/     Código que roda só no navegador (cache, pré-carga, ações)
│   │   ├── componentes/ Componentes Svelte: casca, home, detalhes, player, admin, comum
│   │   ├── contratos/   Tipos compartilhados entre servidor e tela
│   │   ├── estilos/     Tokens de tema e CSS base
│   │   ├── servidor/    Autenticação, banco, armazenamento, processamento, e-mail, mídia
│   │   ├── validacoes/  Regras de validação usadas na tela e no servidor
│   │   └── visual/      Ícones SVG, marca, molduras e pôsteres gerados
│   ├── routes/          Páginas, endpoints de API e rotas de mídia
│   ├── app.html         Casca HTML
│   ├── hooks.server.ts  Sessão, tema, cabeçalhos de segurança e trabalhador da fila
│   └── service-worker.ts Cache de assets e do catálogo
├── static/              Favicon, emblemas, fontes Inter e manifesto
├── testes/              unitarios/, integracao/ e ponta-a-ponta/
└── midia/               (gerada, fora do Git) uploads, HLS, capas, legendas, e-mails locais
```

## Requisitos

| Item                | Versão                                | Observação                                                    |
| ------------------- | ------------------------------------- | ------------------------------------------------------------- |
| Node.js             | 22 ou superior                        | É a versão usada no CI (`.github/workflows/verificacoes.yml`) |
| npm                 | 10 ou superior                        | Vem com o Node                                                |
| Banco               | —                                     | SQLite em arquivo; não precisa de servidor de banco           |
| FFmpeg (+ ffprobe)  | qualquer recente                      | **Opcional.** Só para converter vídeo enviado por upload      |
| Chromium Playwright | via `npx playwright install chromium` | Só para `npm run teste:ponta`                                 |
| Git                 | qualquer                              | Para clonar                                                   |

```bash
node --version
npm --version
ffmpeg -version
```

## Instalação

### 1. Clonar

```bash
git clone https://github.com/AnderHonorato/Yokira-Astra.git
cd Yokira-Astra
```

### 2. Instalar dependências

```bash
npm install
```

O `postinstall` roda `svelte-kit sync && prisma generate`, gerando o cliente do
Prisma em `src/lib/servidor/banco/gerado/` (pasta fora do Git).

### 3. Criar o `.env` a partir do exemplo

```bash
# Windows (PowerShell)
Copy-Item .env.exemplo .env

# Linux, macOS ou Git Bash
cp .env.exemplo .env
```

Troque pelo menos o `SEGREDO_SESSAO`. Para gerar um valor:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 4. Migrar e semear o banco

Tudo de uma vez (sync + generate + `prisma migrate deploy` + seed):

```bash
npm run preparar
```

Ou em etapas:

```bash
npm run banco:migrar   # prisma migrate dev: cria dev.db e aplica as migrations
npm run banco:semear   # gêneros, títulos fictícios, temporadas, episódios e contas
```

O seed é idempotente: rodar de novo não duplica registros.

### 5. Conferir

```bash
npm run verificar
```

## Como rodar

### Desenvolvimento

```bash
npm run dev
```

Executa `vite dev --port 4107 --strictPort`, com recarga automática.
Acesse **http://localhost:4107**. Com `--strictPort`, se a porta estiver ocupada o
Vite falha em vez de subir em outra.

### Produção

```bash
npm run build     # gera build/
npm run iniciar   # sobe o build
```

`npm run iniciar` executa `scripts/iniciar-servidor.ts`, que carrega o `.env`, usa
`PORT` (padrão `4107`), `HOST` (padrão `127.0.0.1`) e `ORIGIN` (padrão
`http://localhost:<PORT>`), anota o processo em `.runtime/servidor.json` e sobe o
`build/index.js`. Acesse **http://localhost:4107**.

Atalho que encerra o servidor anotado, reconstrói e sobe de novo:

```bash
npm run iniciar:limpo
```

Pré-visualizar o build com o Vite (também na 4107):

```bash
npm run preview
```

> Rodar `node build/index.js` diretamente não lê o `.env` e sobe na porta padrão do
> adapter-node (3000). Use `npm run iniciar`.

Em produção, defina também `NODE_ENV=production`, um `SEGREDO_SESSAO` próprio (o
servidor recusa servir mídia com o valor de exemplo) e `ORIGIN` com o domínio real.

## Como encerrar

### Parada limpa

`Ctrl + C` no terminal onde o servidor está rodando (vale para `npm run dev`,
`npm run iniciar` e `npm run preview`).

### Script do projeto

```bash
npm run encerrar
```

Executa `scripts/encerrar-servidor.ts`: lê `.runtime/servidor.json` e envia
`SIGTERM` **só** ao processo anotado pelo `npm run iniciar`. Se não houver anotação,
ele avisa e não mata nada — portanto **não encerra o `npm run dev`** nem o
`npm run preview`, que não fazem essa anotação.

### Porta presa (Windows)

Descubra o PID que está escutando na porta:

```bash
netstat -ano | findstr :4107
```

A última coluna é o PID. Confira que é um processo `node.exe` antes de matar:

```bash
tasklist /FI "PID eq <pid>"
```

Encerre:

```bash
taskkill /PID <pid> /F
```

Alternativa em PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 4107 -State Listen | Select-Object OwningProcess
Stop-Process -Id <pid> -Force
```

Linux e macOS: `lsof -ti tcp:4107` para ver o PID e `kill <pid>` para encerrar.

## Funcionalidades

### Área pública

- **Home (`/`)**: banner de destaque, trilhas de cards em carrossel, trilha
  "Em alta agora" calculada pela audiência recente (com a marcação manual do painel
  como reserva quando ainda não há audiência), trilhas pessoais para quem está logado
  (`/api/para-voce`), faixa promocional e mensagem de boas-vindas editáveis no painel.
- **Catálogo (`/catalogo`)**, **Gêneros (`/generos`)**, **Novidades (`/novidades`)**
  com os episódios recém-adicionados e **Buscar (`/buscar`)**.
- **Página do título (`/titulo/[slug]`)**: sinopse, métricas (visualizações e
  curtidas), temporadas e episódios, avaliação e botão de Minha Lista.
- **Assistir (`/assistir/[episodioId]`)**: player com controles próprios, HLS
  (nativo ou `hls.js`), incorporação de YouTube/Vimeo, troca de origem do vídeo,
  pergunta para retomar de onde parou, legendas, progresso salvo e contagem de
  audiência.
- **Minha Lista (`/minha-lista`)**.
- **Conta**: criar conta (`/cadastrar`), entrar (`/entrar`), sair (`/sair`),
  confirmar e-mail (`/verificar-email`), recuperar e redefinir senha por link enviado
  por e-mail (`/recuperar-senha`, `/redefinir-senha`).
- **Configurações (`/configuracoes`)**: tema claro/escuro, número de sessões ativas,
  reenviar confirmação de e-mail, limpar dados baixados, limpar histórico de
  exibição, encerrar todas as sessões e excluir a conta — as ações críticas passam
  por dupla confirmação validada também no servidor.
- **Cache offline**: service worker com cache de assets e do catálogo, e aviso na
  tela quando a conexão cai.

### Painel administrativo (`/admin`)

Exige papel **EDITOR** ou superior. Papéis existentes: `ESPECTADOR`, `EDITOR`,
`MODERADOR`, `ADMINISTRADOR`.

| Área      | Caminho                                 | Papel mínimo  | O que faz                                                                                                                              |
| --------- | --------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Painel    | `/admin`                                | EDITOR        | Contagem de títulos e episódios, disponibilidade do FFmpeg e fila de conversão                                                         |
| Títulos   | `/admin/titulos`, `/admin/titulos/[id]` | EDITOR        | Criar, editar e publicar títulos (série ou filme), temporadas, episódios, episódios em lote e capa (imagem enviada ou quadro do vídeo) |
| Vídeo     | `/admin/enviar`                         | EDITOR        | Escolher o episódio e enviar arquivo (upload em fluxo) ou colar link verificado; escolher qual origem fica no ar                       |
| Faixas    | `/admin/faixas`                         | EDITOR        | Texto, cores e liga/desliga da faixa da home e da mensagem de boas-vindas                                                              |
| Denúncias | `/admin/denuncias`                      | MODERADOR     | Listar denúncias, marcar como resolvida e reabrir                                                                                      |
| Registro  | `/admin/registro`                       | MODERADOR     | As 100 ações administrativas mais recentes                                                                                             |
| Usuários  | `/admin/usuarios`                       | ADMINISTRADOR | Buscar contas, trocar papel e remover                                                                                                  |

Promover uma conta existente a administrador é feito só pelo terminal:

```bash
npm run banco:promover -- email@dominio.com
```

### Conversão de vídeo

Arquivos enviados vão para `midia/originais/`, entram numa fila persistida no banco
(com até três tentativas) e são convertidos pelo FFmpeg em HLS (360p, 720p e 1080p)
em `midia/hls/`. Sem FFmpeg, o site funciona normalmente, mas a conversão de upload
não roda. Detalhes em [`docs/fontes-de-midia.md`](docs/fontes-de-midia.md).

## Login padrão

> [!WARNING]
> **Credenciais de desenvolvimento.** Existem para testar localmente. Troque as
> senhas (ou remova as contas) antes de qualquer exposição pública.

Criadas por `npm run banco:semear` (arquivo `prisma/contas-de-demonstracao.ts`):

| Papel         | E-mail                    | Senha              | De onde vem                                                   |
| ------------- | ------------------------- | ------------------ | ------------------------------------------------------------- |
| Administrador | `admin@yokira.local`      | `YokiraAdmin#2024` | `ADMIN_EMAIL` / `ADMIN_SENHA` do `.env`; esses são os padrões |
| Espectador    | `espectador@yokira.local` | `YokiraDemo#2024`  | Fixo no código do seed                                        |

O seed **não troca a senha de uma conta que já existe**. Se o banco veio de outro
lugar e a senha não confere, rode:

```bash
npm run contas:locais
```

Ele cria ou reajusta as duas contas (`scripts/criar-contas-locais.ts`) com a senha
`YokiraLocal#2026` — o e-mail e a senha do administrador podem ser trocados por
`ADMIN_LOCAL_EMAIL` e `ADMIN_LOCAL_SENHA` — e imprime as credenciais no terminal.

## Variáveis de ambiente

Todas as variáveis da aplicação estão em `.env.exemplo`. Os valores abaixo são
exemplos/padrões, nunca segredos reais.

| Variável                 | Para que serve                                                                     | Exemplo / padrão                                     |
| ------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL`           | Conexão do Prisma com o SQLite                                                     | `file:./dev.db`                                      |
| `SEGREDO_SESSAO`         | Assina links de mídia (HLS) e sessões; em produção não pode ser o valor de exemplo | `troque-este-valor-por-uma-string-longa-e-aleatoria` |
| `PORT`                   | Porta do `npm run iniciar`                                                         | `4107`                                               |
| `HOST`                   | Interface em que o servidor de produção escuta                                     | `127.0.0.1`                                          |
| `ORIGIN`                 | URL pública; obrigatória e correta em produção (proteção CSRF do SvelteKit)        | `http://localhost:4107`                              |
| `PASTA_UPLOADS`          | Onde os vídeos enviados são gravados                                               | `./midia/originais`                                  |
| `PASTA_HLS`              | Onde saem os segmentos HLS (não pode ficar dentro de `static/`)                    | `./midia/hls`                                        |
| `PASTA_CAPAS`            | Onde ficam as capas                                                                | `./midia/capas`                                      |
| `PASTA_LEGENDAS`         | Onde ficam as legendas                                                             | `./midia/legendas`                                   |
| `LIMITE_UPLOAD_BYTES`    | Tamanho máximo de upload                                                           | `8589934592` (8 GB)                                  |
| `CAMINHO_FFMPEG`         | Binário do FFmpeg                                                                  | `ffmpeg`                                             |
| `CAMINHO_FFPROBE`        | Binário do ffprobe (por padrão, ao lado do FFmpeg)                                 | `ffprobe`                                            |
| `CONVERSOES_SIMULTANEAS` | Conversões em paralelo (teto 4)                                                    | `1`                                                  |
| `SEM_TRABALHADOR`        | Com qualquer valor, o processo web não consome a fila de conversão                 | _(vazio)_                                            |
| `EMAIL_TRANSPORTE`       | `console` (padrão), `arquivo` ou `resend`                                          | `arquivo`                                            |
| `EMAIL_ARQUIVO`          | Arquivo que recebe uma linha JSON por e-mail quando o transporte é `arquivo`       | `./midia/emails-locais.log`                          |
| `EMAIL_REMETENTE`        | Remetente dos e-mails                                                              | `Yokira Astra <local@yokira.test>`                   |
| `RESEND_API_KEY`         | Chave da API do Resend, exigida só com `EMAIL_TRANSPORTE=resend`                   | `re_xxxxxxxxxxxxxxxx`                                |
| `ADMIN_EMAIL`            | E-mail do administrador criado pelo seed                                           | `admin@yokira.local`                                 |
| `ADMIN_SENHA`            | Senha desse administrador                                                          | `YokiraAdmin#2024`                                   |
| `ADMIN_LOCAL_EMAIL`      | E-mail do administrador do `npm run contas:locais`                                 | `admin@yokira.local`                                 |
| `ADMIN_LOCAL_SENHA`      | Senha usada pelo `npm run contas:locais`                                           | `YokiraLocal#2026`                                   |
| `NODE_ENV`               | `production` ativa as exigências de produção (segredo próprio, cookie seguro)      | `production`                                         |

Só para testes e scripts de auditoria:

| Variável              | Para que serve                                         | Exemplo / padrão       |
| --------------------- | ------------------------------------------------------ | ---------------------- |
| `PORTA_TESTE`         | Porta em que o Playwright sobe o build                 | `4100`                 |
| `CHROMIUM_EXECUTAVEL` | Caminho de um Chromium já instalado, para o Playwright | `/caminho/do/chromium` |
| `CI`                  | Liga retentativas e o reporter do GitHub no Playwright | `true`                 |

O nome do cookie de sessão não é variável de ambiente: é a constante
`NOME_COOKIE_SESSAO` em `src/lib/servidor/autenticacao/sessao.ts`.

## Testes e verificação

```bash
npm run verificar        # typecheck + lint + formatação + unitários/integração
npm run typecheck        # svelte-kit sync + svelte-check
npm run lint             # ESLint
npm run formatar:checar  # Prettier (só confere)
npm run teste:unitario   # Vitest: testes/unitarios e testes/integracao
npm run teste:ponta      # Playwright: celular 390 px e desktop 1440 px
```

- Os testes de integração criam um SQLite temporário e aplicam as migrations.
- O Playwright faz o build, prepara um banco próprio (`midia/teste.db`, via
  `npm run teste:preparar`) e sobe o servidor na porta **4100**, sem mexer no
  `dev.db` nem na 4107. Antes da primeira execução:

```bash
npx playwright install chromium
```

## Todos os comandos

| Comando                                         | O que faz                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                                   | Servidor de desenvolvimento na 4107 (porta estrita)                            |
| `npm run build`                                 | Build de produção em `build/`                                                  |
| `npm run preview`                               | Pré-visualiza o build na 4107                                                  |
| `npm run iniciar`                               | Sobe o build com o `.env` carregado e anota o processo                         |
| `npm run iniciar:limpo`                         | `encerrar` + `build` + `iniciar`                                               |
| `npm run encerrar`                              | Encerra o processo anotado pelo `iniciar`                                      |
| `npm run typecheck`                             | `svelte-kit sync` + `svelte-check`                                             |
| `npm run lint`                                  | ESLint                                                                         |
| `npm run formatar`                              | Aplica o Prettier                                                              |
| `npm run formatar:checar`                       | Confere a formatação sem alterar                                               |
| `npm run teste:unitario`                        | Vitest (unitários e integração)                                                |
| `npm run teste:ponta`                           | Playwright                                                                     |
| `npm run teste:preparar`                        | `prisma migrate deploy` + seed (usado pelo Playwright)                         |
| `npm run verificar`                             | typecheck + lint + formatar:checar + teste:unitario                            |
| `npm run banco:migrar`                          | `prisma migrate dev`                                                           |
| `npm run banco:gerar`                           | `prisma generate`                                                              |
| `npm run banco:semear`                          | Executa o seed (`prisma/seed.ts`)                                              |
| `npm run banco:reiniciar`                       | **Apaga o banco**, reaplica as migrations e semeia                             |
| `npm run banco:promover -- <email>`             | Torna uma conta existente ADMINISTRADOR                                        |
| `npm run banco:exportar > backup.json`          | Despeja gêneros, títulos, temporadas, episódios e usuários (sem senha) em JSON |
| `npm run banco:importar -- backup.json`         | Recria o catálogo a partir do JSON (usuários não são importados)               |
| `npm run contas:locais`                         | Cria/reajusta as contas locais com senha conhecida                             |
| `npm run preparar`                              | sync + generate + `prisma migrate deploy` + seed                               |
| `npm run video:teste -- <saida.mp4> <segundos>` | Gera um vídeo sintético com FFmpeg para testar o pipeline                      |
| `postinstall` (automático)                      | `svelte-kit sync` + `prisma generate` após o `npm install`                     |

O arquivo gerado por `banco:exportar` contém e-mails de usuários; `backup*.json`
está no `.gitignore`.

## Erros comuns

**`Port 4107 is already in use`**
Outro processo está na porta. Se foi o `npm run iniciar`, rode `npm run encerrar`;
senão, veja [Porta presa (Windows)](#porta-presa-windows).

**`npm run encerrar` diz que nenhum servidor está anotado, mas a porta continua ocupada**
O servidor foi aberto com `npm run dev`/`preview` (que não anotam o processo) ou é
de outro programa. Use `netstat -ano | findstr :4107` e `taskkill /PID <pid> /F`.

**`Cannot find module '.../banco/gerado/client'`**
O cliente do Prisma não foi gerado. Rode `npm run banco:gerar`.

**`The table main.Usuario does not exist`**
Banco sem migrations. Rode `npm run banco:migrar` e `npm run banco:semear` (ou
`npm run preparar`).

**Login com a senha do seed não funciona**
O seed não altera a senha de contas já existentes. Rode `npm run contas:locais`.

**`SEGREDO_SESSAO ainda e o valor de exemplo. Gere um proprio antes de servir midia.`**
Em produção (`NODE_ENV=production`) o valor de exemplo é recusado. Gere um segredo
e coloque no `.env`.

**Formulários falham em produção com erro de CSRF (POST de outra origem)**
`ORIGIN` diferente da URL usada no navegador. Ajuste `ORIGIN` no `.env`.

**`EMAIL_TRANSPORTE=resend exige RESEND_API_KEY.` / `EMAIL_TRANSPORTE=arquivo exige EMAIL_ARQUIVO.`**
Falta a variável correspondente ao transporte escolhido.

**O servidor subiu na porta 3000**
Foi iniciado com `node build/index.js`, que não lê o `.env`. Use `npm run iniciar`.

**Vídeo enviado não fica pronto e a fila mostra `FALHOU`**
FFmpeg ausente ou fora do PATH. Confira `ffmpeg -version` e ajuste `CAMINHO_FFMPEG`
(e `CAMINHO_FFPROBE`, se necessário). A mensagem do erro aparece na fila em `/admin`.

**`Executable doesn't exist at ...chrome-headless-shell`**
Falta o navegador do Playwright: `npx playwright install chromium`, ou aponte um já
instalado com `CHROMIUM_EXECUTAVEL`.

**As telas continuam antigas depois de atualizar**
Cache do service worker. Em `/configuracoes`, use **Limpar dados baixados**, ou nas
ferramentas do navegador: Application → Service Workers → Unregister.

## Documentação complementar

| Arquivo                                                      | Conteúdo                                         |
| ------------------------------------------------------------ | ------------------------------------------------ |
| [`docs/fontes-de-midia.md`](docs/fontes-de-midia.md)         | Origens de vídeo aceitas e como são verificadas  |
| [`docs/seguranca.md`](docs/seguranca.md)                     | Senhas, sessões, CSRF, dupla confirmação, papéis |
| [`docs/migracao-postgresql.md`](docs/migracao-postgresql.md) | Como trocar o SQLite pelo PostgreSQL             |
| [`docs/sistema-visual.md`](docs/sistema-visual.md)           | Paleta, tipografia, espaçamentos e ícones        |
| [`docs/desempenho.md`](docs/desempenho.md)                   | Metodologia e números medidos                    |
| [`docs/continuidade.md`](docs/continuidade.md)               | Decisões e pendências para retomar o trabalho    |

---

<div align="center">

Catálogo de demonstração com títulos fictícios.
Nenhuma obra de terceiros é distribuída neste repositório.

</div>

<!-- GERENCIADOR-SERVIDORES:INICIO -->

## Execução local

Linha independente da plataforma Yōkira adaptada para Astra.

Porta principal reservada: `3100`. As portas são administradas centralmente para permitir vários projetos abertos ao mesmo tempo.

```powershell
# Iniciar
powershell -ExecutionPolicy Bypass -File "C:\Projetos\GERENCIADOR-SERVIDORES\servidores.ps1" iniciar "yokira-astra"

# Consultar o estado
powershell -ExecutionPolicy Bypass -File "C:\Projetos\GERENCIADOR-SERVIDORES\servidores.ps1" status

# Encerrar
powershell -ExecutionPolicy Bypass -File "C:\Projetos\GERENCIADOR-SERVIDORES\servidores.ps1" parar "yokira-astra"
```

Os registros de execução ficam em `C:\Projetos\GERENCIADOR-SERVIDORES\logs`. O gerenciador não copia arquivos `.env`; como os logs reproduzem a saída do próprio aplicativo, revise-os antes de compartilhar.
<!-- GERENCIADOR-SERVIDORES:FIM -->
