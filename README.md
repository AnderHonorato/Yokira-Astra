<div align="center">

<img src="static/marca/emblema-192.png" alt="Emblema Yōkira" width="96" />

# Yōkira Animes

Plataforma de catálogo e streaming de animes, em português, construída com
SvelteKit 5, Prisma e CSS puro.

**Esta é a cópia de trabalho `yokira-astra`, versão 1.1.0.** Ela é independente do
projeto original: banco, mídia, cookies, cache e porta são próprios. Nada aqui lê nem
escreve na pasta do original.

**Tudo roda em `http://localhost:4107`** — porta escolhida de propósito para não
brigar com projetos que já ocupam a 3000 ou a 5173.

</div>

---

## Índice

1. [O que é](#o-que-é)
2. [Como está organizado](#como-está-organizado)
3. [Requisitos](#requisitos)
4. [Instalação passo a passo](#instalação-passo-a-passo)
5. [Executar o projeto](#executar-o-projeto)
6. [Encerrar o servidor](#encerrar-o-servidor)
7. [Contas de demonstração](#contas-de-demonstração)
8. [Banco de dados](#banco-de-dados)
9. [Vídeo, FFmpeg e HLS](#vídeo-ffmpeg-e-hls)
10. [Painel administrativo](#painel-administrativo)
11. [Testes e verificação](#testes-e-verificação)
12. [Todos os comandos](#todos-os-comandos)
13. [Variáveis de ambiente](#variáveis-de-ambiente)
14. [Ir para produção](#ir-para-produção)
15. [Erros comuns](#erros-comuns)
16. [Documentação complementar](#documentação-complementar)

---

## O que é

Um catálogo de animes com hero rotativo, trilhas de cards arrastáveis, página de
título com episódios por temporada, player HLS, lista pessoal, progresso de
exibição, avaliações e um painel administrativo com upload e conversão de vídeo.

Alguns compromissos que valem saber de antemão:

- **Nenhum emoji e nenhuma biblioteca de ícones.** Os 29 ícones são SVG próprios
  em `src/lib/visual/icones/`, um arquivo por ícone.
- **Nada de `alert()`, `confirm()` ou `prompt()`.** Ações destrutivas passam por
  um diálogo próprio de dupla confirmação — validado também no servidor.
- **Nenhum conteúdo de terceiros versionado.** O catálogo de exemplo é fictício e
  os pôsteres são gradientes SVG gerados a partir do slug do título.
- **Tudo em português**: arquivos, funções, variáveis, rotas, textos e commits.

## Como está organizado

```
yokira-animees/
├── docs/                     Documentação, capturas e scripts de medição
├── prisma/                   schema, migrations, seed e catálogo fictício
├── scripts/                  Ferramentas de terminal (encerrar, exportar, promover…)
├── src/
│   ├── lib/
│   │   ├── estilos/          tema.css (todos os tokens), base.css, animacoes.css
│   │   ├── visual/           icones/, molduras/, marca/, posters/
│   │   ├── componentes/      casca/, home/, detalhes/, player/, comum/
│   │   ├── cliente/          cache em IndexedDB, pré-carregamento, ações do usuário
│   │   ├── servidor/         autenticacao/, banco/, armazenamento/, processamento/
│   │   └── validacoes/       Regras compartilhadas entre tela e servidor
│   ├── routes/               Páginas e endpoints
│   ├── app.html              Casca HTML, favicon e fonte
│   ├── hooks.server.ts       Sessão + cabeçalhos de segurança
│   └── service-worker.ts     Cache de assets e do catálogo
├── static/                   favicon.ico, emblemas, manifesto
└── testes/                   unitarios/, integracao/, ponta-a-ponta/
```

Cada componente é um par de arquivos com o mesmo nome: `nome.svelte` para a
marcação e `nome.css` para o estilo (mais `nome.ts` quando há lógica). O CSS entra
por `import './nome.css'` dentro do `<script>`, então as classes são globais e
levam sempre o prefixo do componente. Detalhes em
[`docs/sistema-visual.md`](docs/sistema-visual.md).

## Requisitos

| Item        | Versão             | Observação                                                                     |
| ----------- | ------------------ | ------------------------------------------------------------------------------ |
| **Node.js** | **22 ou superior** | Testado no 22.22. O 20 não serve: usamos `import` de nível superior em scripts |
| npm         | 10+                | Vem com o Node                                                                 |
| FFmpeg      | 6+                 | **Opcional.** Só para converter vídeo. O app roda sem ele                      |
| Git         | qualquer           | Para clonar                                                                    |

Confira o que você tem:

```bash
node --version    # precisa mostrar v22.x ou maior
npm --version
ffmpeg -version   # opcional
```

Sistema operacional: Linux, macOS ou **Windows nativo**. O `npm run encerrar` não
depende mais de `lsof` nem de `fuser`: o `npm run iniciar` anota qual processo é o
servidor deste projeto, e o encerrar derruba exatamente esse. Os comandos abaixo
funcionam iguais no PowerShell e no terminal do Git Bash.

## Instalação passo a passo

### 1. Entrar na pasta

```bash
cd yokira-astra
```

### 2. Instalar as dependências

```bash
npm install
```

O `postinstall` roda `svelte-kit sync && prisma generate`, **nessa ordem**. A ordem
importa: o `prisma generate` precisa do `.svelte-kit/tsconfig.json`, e numa pasta
recém-clonada esse arquivo ainda não existe. Sem o `svelte-kit sync` antes, o
`npm install` falha no fim com um erro que não fala nada sobre o que faltou.

O cliente do Prisma sai em `src/lib/servidor/banco/gerado/`. Essa pasta é gerada e
não vai para o Git — se você apagar, rode `npm run banco:gerar`.

### 3. Criar o arquivo `.env`

```bash
cp .env.exemplo .env
```

Abra o `.env` e troque **pelo menos** o `SEGREDO_SESSAO`. Gere um valor decente:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

O `.env` já vem com `PORT=4107` e `DATABASE_URL="file:./dev.db"`, então em
desenvolvimento não é preciso mexer em mais nada.

### 4. Criar o banco e popular

```bash
npm run preparar         # sync + generate + migrations + seed, em um comando
```

Ou passo a passo:

```bash
npm run banco:migrar     # cria dev.db e aplica as migrations
npm run banco:semear     # títulos fictícios, gêneros, episódios e contas
```

O seed é idempotente: pode rodar de novo quantas vezes quiser sem duplicar nada.

### 4b. Senha conhecida para entrar

O seed não troca a senha de uma conta que já existe — então, num banco herdado, a
senha do administrador pode não ser a do seed. Para garantir acesso local:

```bash
npm run contas:locais
```

Ele reajusta `admin@yokira.local` e `espectador@yokira.local` para
`YokiraLocal#2026` e imprime as credenciais. **Vale só nesta cópia local.**

### 5. Conferir se está tudo de pé

```bash
npm run verificar
```

Roda typecheck, lint, checagem de formatação e os testes unitários e de
integração. Se isso passar, a instalação está correta.

## Executar o projeto

### Desenvolvimento (com recarga automática)

```bash
npm run dev
```

Abre em **http://localhost:4107**. A porta é fixa (`strictPort`): se estiver
ocupada, o Vite **falha em vez de pular para outra** — assim você nunca fica na
dúvida sobre em qual porta o projeto subiu. Veja
[Encerrar o servidor](#encerrar-o-servidor) se isso acontecer.

### Produção (build otimizado)

```bash
npm run build     # gera a pasta build/
npm run iniciar   # sobe em http://localhost:4107
```

`npm run iniciar` usa `scripts/iniciar-servidor.ts`, que carrega o `.env` e força
`PORT=4107`. Rodar `node build/index.js` direto **sobe na 3000**, porque é o
padrão do adaptador Node e ele não lê arquivo de configuração.

Atalho que limpa a porta, reconstrói e sobe:

```bash
npm run iniciar:limpo
```

### Ver o build sem o servidor Node

```bash
npm run preview   # também na 4107
```

## Encerrar o servidor

### Se o terminal ainda está aberto

`Ctrl + C` na janela onde o servidor está rodando. É o jeito limpo.

### Se você fechou o terminal

```bash
npm run encerrar
```

O `npm run iniciar` deixa anotado, em `.runtime/servidor.json`, qual processo é o
servidor **deste** projeto. O encerrar lê essa anotação e derruba só ele:

```
Servidor encerrado (processo 20068, porta 4107).
```

Se não houver anotação, ele diz isso e **não faz nada**. É proposital: a versão
anterior perguntava ao sistema quem estava na porta e matava, o que derrubava
outro projeto que tivesse pegado a porta primeiro.

### Se a porta continuar ocupada por outra coisa

Aí o processo não é nosso, e a decisão é sua. Para ver quem está lá:

```bash
# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 4107 -State Listen | Select-Object OwningProcess

# Linux e macOS
lsof -ti tcp:4107
```

### Como confirmar que caiu

```bash
curl -s -o /dev/null -w "%{http_code}
" http://localhost:4107/
```

`000` significa que não há ninguém atendendo — porta livre. `200` significa que o
servidor continua no ar.

## Contas de demonstração

Criadas pelo `npm run banco:semear`. **São de desenvolvimento** — troque antes de
qualquer coisa parecida com produção.

| Papel         | E-mail                    | Senha              |
| ------------- | ------------------------- | ------------------ |
| Administrador | `admin@yokira.local`      | `YokiraAdmin#2024` |
| Espectador    | `espectador@yokira.local` | `YokiraDemo#2024`  |

As credenciais do administrador vêm de `ADMIN_EMAIL` e `ADMIN_SENHA` no `.env`.

Para promover uma conta já existente:

```bash
npm run banco:promover -- seu-email@dominio.com
```

Isso é feito por terminal de propósito: escalar privilégio pela interface é
convite a acidente.

## Banco de dados

SQLite em desenvolvimento, PostgreSQL preparado para produção. O arquivo
`dev.db` fica na raiz e **não vai para o Git**.

| Comando                                 | O que faz                                         |
| --------------------------------------- | ------------------------------------------------- |
| `npm run banco:migrar`                  | Cria/atualiza o banco a partir do `schema.prisma` |
| `npm run banco:gerar`                   | Regenera o cliente do Prisma                      |
| `npm run banco:semear`                  | Popula com o catálogo fictício e as contas        |
| `npm run banco:reiniciar`               | **Apaga tudo**, recria e semeia de novo           |
| `npm run banco:exportar > backup.json`  | Despeja o conteúdo em JSON                        |
| `npm run banco:importar -- backup.json` | Recria os registros a partir do JSON              |
| `npx prisma studio`                     | Abre o navegador de dados do Prisma               |

Para migrar para PostgreSQL, siga
[`docs/migracao-postgresql.md`](docs/migracao-postgresql.md) — o código da
aplicação não muda, só o adaptador e a URL.

## Vídeo, FFmpeg e HLS

Um episódio pode receber vídeo de quatro origens: **arquivo enviado**, **link direto
para o arquivo**, **playlist HLS remota** e **incorporação do YouTube ou do Vimeo**.
Só a primeira precisa de FFmpeg — as outras três tocam da origem, sem cópia.

A matriz completa do que é aceito, do que é verificado e do que a gente **não**
promete está em [`docs/fontes-de-midia.md`](docs/fontes-de-midia.md). Vale ler antes
de colar o primeiro link.

O app **funciona sem FFmpeg**: o catálogo, a navegação e todas as telas aparecem
normalmente, e link e incorporação continuam funcionando. Sem ele, o que não roda é a
conversão de arquivo enviado — o episódio fica na fila até alguém instalar.

### Instalar

```bash
# Ubuntu / Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
winget install Gyan.FFmpeg
```

Se o binário não estiver no PATH, aponte no `.env`:

```env
CAMINHO_FFMPEG="/caminho/completo/para/ffmpeg"
```

### Gerar um vídeo de teste

Sem depender de nenhum arquivo de terceiro:

```bash
npm run video:teste -- midia/teste.mp4 20
```

Cria um mp4 sintético de 20 segundos (barras de cor e um tom de áudio) em
`midia/`. Use esse arquivo no painel para exercitar o pipeline inteiro.

### Como funciona a conversão

1. O arquivo sobe **em fluxo** para `/api/admin/fontes/arquivo` e é gravado em
   `midia/originais/` — **fora de `static/`**, com nome gerado por `randomUUID()`.
   Os bytes vão para o disco enquanto chegam: um vídeo de horas nunca passa inteiro
   pela memória do servidor. O envio mostra progresso real e pode ser cancelado.
2. Um `TrabalhoProcessamento` entra na fila com **dono e prazo**. Se o processo cair
   no meio, o prazo vence e outro executor retoma — até três tentativas. É o que
   evita o episódio preso em "sendo preparado" para sempre.
3. Saem três variantes — 360p, 720p e 1080p — em `midia/hls/<id-do-arquivo>/`, mais
   a playlist mestre `mestre.m3u8`. Depois disso o `ffprobe` lê a duração real e
   corrige o cadastro do episódio.
4. **A fonte nova só entra no ar quando a conversão termina.** Até lá, o vídeo antigo
   do episódio continua tocando.
5. O player carrega `hls.js` por import dinâmico, e só em navegador que não toca HLS
   nativamente. No Safari o suporte é nativo e a biblioteca nem é baixada.

### Onde o trabalhador da fila roda

Hoje ele sobe junto com o processo web (`src/hooks.server.ts`), o que serve para uma
instalação só. `CONVERSOES_SIMULTANEAS` controla quantas conversões rodam ao mesmo
tempo (padrão 1, teto 4) — o FFmpeg usa o processador inteiro, e três conversões
juntas deixam o site lento para quem só quer assistir.

Para separar em um processo próprio, suba outra instância com `SEM_TRABALHADOR=1` no
processo web e sem essa variável no processo de conversão. A fila já aguenta os dois
lendo a mesma tabela: a reivindicação é atômica e o prazo protege contra trabalho
duplicado.

Nada disso vai para o Git: `midia/` está no `.gitignore`. E nada de mídia mora em
`static/`: lá o servidor de arquivos entregaria os segmentos sem sessão nem
assinatura — veja `docs/seguranca.md`.

## Painel administrativo

Em `/admin`, exige papel **EDITOR** ou superior. Mostra a contagem de títulos e
episódios, se o FFmpeg está disponível e a fila de processamento.

| Área      | Caminho            | Papel mínimo  | O que faz                                               |
| --------- | ------------------ | ------------- | ------------------------------------------------------- |
| Títulos   | `/admin/titulos`   | EDITOR        | Criar, buscar, editar, publicar; temporadas e episódios |
| Denúncias | `/admin/denuncias` | MODERADOR     | Ver abertas e resolvidas, marcar resolvida e reabrir    |
| Registro  | `/admin/registro`  | MODERADOR     | As 100 ações administrativas mais recentes              |
| Usuários  | `/admin/usuarios`  | ADMINISTRADOR | Buscar contas, trocar papel, remover                    |
| Vídeo     | `/admin/enviar`    | EDITOR        | Arquivo ou link, e qual origem fica no ar               |
| Faixas    | `/admin/faixas`    | EDITOR        | Texto e cores da faixa da home e das boas-vindas        |

Tudo que apaga passa pela dupla confirmação, e o servidor exige o token de uso
único emitido no passo 1 — pular a tela e chamar a API direto não funciona.
Não é possível rebaixar o último administrador.

As listas mostram no máximo 100 linhas, da mais recente para a mais antiga; a
tela avisa quando bate no teto e a busca resolve o resto.

### Dar vídeo a um episódio

1. Entre com `admin@yokira.local` e abra `/admin/enviar`.
2. **Passo 1 — qual episódio.** Digite o nome do anime ou do episódio. A lista é
   paginada e cobre o catálogo inteiro; ela também marca quais já têm vídeo.
3. **Passo 2 — de onde vem o vídeo.** Duas abas:
   - **Enviar arquivo**: `.mp4`, `.mkv`, `.mov` ou `.webm`. A tela mostra o limite
     real e o progresso do envio, e dá para cancelar no meio.
   - **Usar link**: cole o endereço e clique em **Verificar vídeo**. O veredito diz
     um de quatro estados — _Vídeo pronto_, _Precisa converter_, _Indisponível_ ou
     _Não dá para usar_ — e vem com uma prévia que roda neste navegador.
4. **Origens deste episódio**, no fim da página, lista tudo que já foi cadastrado e
   qual está no ar. Trocar é um clique e não apaga a anterior.

Colar um link **não baixa nada por padrão**. Só o que o navegador não tocaria é
trazido para cá e convertido. O detalhe está em
[`docs/fontes-de-midia.md`](docs/fontes-de-midia.md).

Use apenas conteúdo que você tem direito de distribuir.

### Faixa da home e boas-vindas

Em `/admin/faixas` dá para escrever o texto, escolher as duas cores do degradê e
ligar ou desligar cada faixa, com prévia ao lado usando o mesmo componente que a home
renderiza. A cor do texto é calculada a partir do degradê, então uma combinação clara
não deixa a faixa ilegível. Desligada — ou sem texto — ela não aparece para ninguém.

A mensagem de boas-vindas aparece **uma vez**, na home, no primeiro acesso de cada
pessoa depois de entrar.

## Testes e verificação

```bash
npm run verificar        # typecheck + lint + formatação + unitários + integração
npm run teste:unitario   # Vitest
npm run teste:ponta      # Playwright em 390 px e 1440 px
```

Os testes de integração criam um SQLite temporário próprio e rodam as migrations
nele — banco de verdade, não simulado.

O Playwright sobe o **build de produção** na porta **4100**, justamente para não
derrubar o `npm run dev` que você deixou aberto na 4107. Antes da primeira
execução:

```bash
npx playwright install chromium
```

Se o Chromium já estiver instalado em outro caminho:

```bash
CHROMIUM_EXECUTAVEL=/caminho/do/chromium npm run teste:ponta
```

## Todos os comandos

| Comando                             | O que faz                              |
| ----------------------------------- | -------------------------------------- |
| `npm run dev`                       | Servidor de desenvolvimento na 4107    |
| `npm run build`                     | Build de produção em `build/`          |
| `npm run iniciar`                   | Sobe o build na 4107                   |
| `npm run iniciar:limpo`             | Libera a porta, reconstrói e sobe      |
| `npm run preview`                   | Pré-visualiza o build na 4107          |
| `npm run encerrar`                  | Mata quem estiver na 4107              |
| `npm run verificar`                 | Typecheck + lint + formatação + testes |
| `npm run typecheck`                 | Só a checagem de tipos                 |
| `npm run lint`                      | Só o ESLint                            |
| `npm run formatar`                  | Aplica o Prettier                      |
| `npm run teste:unitario`            | Vitest                                 |
| `npm run teste:ponta`               | Playwright                             |
| `npm run banco:migrar`              | Migrations                             |
| `npm run banco:semear`              | Popula o banco                         |
| `npm run banco:reiniciar`           | Apaga e recria o banco                 |
| `npm run banco:promover -- email`   | Torna a conta administradora           |
| `npm run banco:exportar`            | Despejo em JSON                        |
| `npm run banco:importar -- arquivo` | Restaura do JSON                       |
| `npm run video:teste`               | Gera mp4 sintético para testes         |

## Variáveis de ambiente

Todas em `.env.exemplo`. As que importam:

| Variável                 | Padrão                  | Para que serve                                   |
| ------------------------ | ----------------------- | ------------------------------------------------ |
| `DATABASE_URL`           | `file:./dev.db`         | Conexão do Prisma                                |
| `SEGREDO_SESSAO`         | _(troque)_              | Segredo de sessão e tokens                       |
| `PORT`                   | `4107`                  | Porta do servidor                                |
| `ORIGIN`                 | `http://localhost:4107` | Origem pública — **obrigatória** em produção     |
| `PASTA_UPLOADS`          | `./midia/originais`     | Onde os originais são gravados                   |
| `PASTA_HLS`              | `./midia/hls`           | Onde saem os segmentos HLS (nunca em `static/`)  |
| `CAMINHO_FFMPEG`         | `ffmpeg`                | Binário do FFmpeg                                |
| `CAMINHO_FFPROBE`        | ao lado do FFmpeg       | Binário do ffprobe, usado para ler a duração     |
| `LIMITE_UPLOAD_BYTES`    | 8 GB                    | Teto real de upload, conferido durante a escrita |
| `CONVERSOES_SIMULTANEAS` | `1`                     | Conversões em paralelo (teto 4)                  |
| `SEM_TRABALHADOR`        | _(vazio)_               | Com valor, o processo web não consome a fila     |
| `PASTA_LEGENDAS`         | `./midia/legendas`      | Onde ficam os arquivos de legenda                |
| `ADMIN_EMAIL`            | `admin@yokira.local`    | Conta criada pelo seed                           |
| `ADMIN_SENHA`            | `YokiraAdmin#2024`      | Senha dessa conta                                |

`ORIGIN` errada em produção quebra o envio de formulários: o SvelteKit rejeita
POST de origem diferente por proteção contra CSRF.

## Ir para produção

```bash
npm ci
npx prisma generate
npx prisma migrate deploy      # nunca `migrate dev` em produção
npm run build
PORT=4107 ORIGIN=https://seu-dominio node build/index.js
```

Lista de conferência:

- [ ] `SEGREDO_SESSAO` longo e aleatório, fora do repositório
- [ ] `ORIGIN` apontando para o domínio real, com `https`
- [ ] `NODE_ENV=production` (o cookie de sessão só ganha `Secure` assim)
- [ ] PostgreSQL no lugar do SQLite ([guia](docs/migracao-postgresql.md))
- [ ] Proxy reverso terminando TLS e limitando requisições por IP
- [ ] Senha do administrador trocada
- [ ] `midia/` em disco com backup

## Erros comuns

**`Port 4107 is already in use`**
Alguém já está na porta. Rode `npm run encerrar` e tente de novo. A porta é fixa
de propósito para você não acabar com dois servidores em portas diferentes.

**`Cannot find module '$lib/servidor/banco/gerado/client'`**
O cliente do Prisma não foi gerado. `npm run banco:gerar`.

**`The table main.Usuario does not exist`**
Banco sem migrations. `npm run banco:migrar && npm run banco:semear`.

**`error: The datasource property 'url' is no longer supported in schema files`**
Você está com um `schema.prisma` antigo. No Prisma 7 a URL vive no
`prisma.config.ts`, e o `datasource` só declara o `provider`.

**`Executable doesn't exist at .../chrome-headless-shell`**
Navegador do Playwright ausente. `npx playwright install chromium`, ou aponte um
já instalado com `CHROMIUM_EXECUTAVEL`.

**O vídeo não aparece e a fila mostra `FALHOU`**
FFmpeg ausente ou fora do PATH. Confira `ffmpeg -version` e ajuste
`CAMINHO_FFMPEG` no `.env`. A mensagem exata do erro fica na coluna do trabalho,
em `/admin`.

**A fonte demora a trocar / o texto aparece com outra fonte primeiro**
Isso é intencional. A Inter é carregada sem bloquear a primeira pintura; até ela
chegar o texto usa `system-ui`. Foi o que derrubou o FCP de 12,9 s para 0,68 s —
veja [`docs/desempenho.md`](docs/desempenho.md).

**Mudei o CSS e nada acontece no build de produção**
Provavelmente você usou `:global(...)` num arquivo `.css`. Isso só existe dentro
do bloco `<style>` do Svelte; em CSS global use o seletor descendente normal.

**As telas continuam antigas mesmo depois do deploy**
Service worker com cache velho. Em Configurações, use **Limpar dados baixados**,
ou nas ferramentas do navegador: Application → Service Workers → Unregister.

## Documentação complementar

| Arquivo                                                      | Conteúdo                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------- |
| [`docs/sistema-visual.md`](docs/sistema-visual.md)           | Paleta, escala tipográfica, espaçamentos, regras de ícone |
| [`docs/seguranca.md`](docs/seguranca.md)                     | Senhas, sessões, CSRF, dupla confirmação, papéis          |
| [`docs/desempenho.md`](docs/desempenho.md)                   | Metodologia e números medidos                             |
| [`docs/migracao-postgresql.md`](docs/migracao-postgresql.md) | Passo a passo da migração                                 |
| [`docs/auditoria-visual.md`](docs/auditoria-visual.md)       | Comparação com as telas de referência                     |
| [`RESUMO-DA-ENTREGA.md`](RESUMO-DA-ENTREGA.md)               | O que foi feito, pontos de atenção e próximos passos      |
| [`docs/continuidade.md`](docs/continuidade.md)               | Regras, decisões e pendências para retomar o trabalho     |

---

<div align="center">

Catálogo de demonstração com títulos fictícios.
Nenhuma obra de terceiros é distribuída neste repositório.

</div>
