# Entrega — Yōkira `yokira-astra` 1.2.0

Cópia de trabalho: `C:\Projetos\Andamento\Yokira\yokira-astra`
Original (somente leitura, intacto): `C:\Projetos\Andamento\Yokira\yokira-animees`

---

## 1. O que eu encontrei

`yokira-astra` era uma cópia independente **parada no meio**. O isolamento estava
pronto — `.env` próprio na porta 4107, cookie `yokira_astra_sessao`, cache
`yokira-astra-cache`, banco e mídia próprios, Git próprio — mas:

- O Git tinha **zero commits**.
- `prisma/schema.prisma` declarava `FonteMidia` e os campos de fila, e a migration
  existia. **A migration nunca tinha sido aplicada**, e **nenhuma linha de aplicação
  usava `FonteMidia`.** O requisito principal existia só no schema.
- `package.json` apontava para três scripts inexistentes, então `npm run dev` quebrava.
- `npm run verificar` falhava na formatação de cinco arquivos e, por causa do
  encadeamento com `&&`, os testes unitários nunca chegavam a rodar.

Verificação de base, antes de eu tocar em qualquer coisa: typecheck 615 arquivos e
0 erros, lint limpo, **formatação falhando**, testes não executados.

---

## 2. O que foi entregue

### 2.1 Fontes de mídia — o requisito principal

Quatro origens, com a distinção que importa: **link que a origem já sabe servir não é
copiado.**

| Origem                     | O servidor baixa?        | Player      |
| -------------------------- | ------------------------ | ----------- |
| Arquivo enviado            | Sim, e converte para HLS | Nosso       |
| Link direto para o arquivo | Não                      | Nosso       |
| Playlist HLS remota        | Não                      | Nosso       |
| YouTube / Vimeo            | Não                      | Do provedor |

O reconhecimento olha três sinais, **nesta ordem**: os primeiros bytes do corpo, o
`content-type` e, só no fim, a extensão. A ordem cobre os dois enganos que aparecem na
prática — o `.mp4` que devolve página de login e o endereço assinado sem extensão que é
vídeo válido.

Ao colar um link, **Verificar vídeo** devolve um de quatro estados — _Vídeo pronto_,
_Precisa converter_, _Indisponível_, _Não dá para usar_ — com prévia que roda no
navegador. A tela separa as duas coisas de propósito: o veredito é do servidor, a prévia
é deste navegador. Juntar as duas num único "pronto" é o que faz um episódio entrar no ar
quebrado.

A matriz completa está em [`docs/fontes-de-midia.md`](docs/fontes-de-midia.md).

### 2.2 SSRF

Quem abre a conexão é o servidor, então o endereço colado é uma porta para dentro da
infraestrutura. O IP validado é **fixado** na conexão — conferir o nome e deixar o Node
resolver de novo abre a janela do DNS rebinding. Cada salto de redirecionamento volta a
passar pela mesma validação. Faixas privadas, loopback, link-local (incluindo
`169.254.169.254`), CGNAT, multicast e as equivalentes em IPv6, inclusive IPv4 disfarçado.

**Não existe atalho de configuração para desligar isso.** Os testes que precisam de
resposta controlada injetam o transporte; a exceção fica no teste, nunca no caminho de
produção.

### 2.3 Upload e fila

O upload fazia `arrayBuffer()` num limite anunciado de 8 GB — o arquivo inteiro passava
pela memória antes de tocar o disco. Agora é fluxo, com o teto conferido durante a
escrita, progresso real, cancelamento e limpeza do parcial.

A conversão era `void processarArquivo(id)` disparado da rota: um reinício deixava o
trabalho `PROCESSANDO` para sempre. Agora cada trabalho tem dono e prazo; prazo vencido
volta para a fila, até três tentativas.

**Fonte nova só entra no ar quando a conversão termina.** Até lá o vídeo antigo continua
tocando.

### 2.4 Painel

O seletor de episódio era um `<select>` com `take: 60` num catálogo de **796 episódios** —
92% do catálogo era inalcançável. Virou busca paginada que casa contra o nome do anime e o
do episódio, marcando quais já têm vídeo.

Origens já cadastradas ficam listadas: trocar qual está no ar é um clique e **não apaga a
anterior**.

### 2.5 Player

O mesmo quadro e os mesmos controles servem HLS local, playlist remota e arquivo direto.
YouTube e Vimeo ganham quadro separado, e a legenda embaixo diz que os controles são do
provedor — em vez de fingir o contrário. O endereço do iframe é remontado no servidor a
partir do id gravado, nunca lido da coluna `url`.

### 2.6 Pedidos que chegaram durante o trabalho

| Pedido                                          | Situação                           |
| ----------------------------------------------- | ---------------------------------- |
| Visualizações no episódio e na lista            | Entregue                           |
| Curtidas em todas as telas consumidas           | Entregue                           |
| Fileira de mais assistidos que se atualiza      | Entregue, com decaimento por idade |
| Recomendados pelo que o usuário assistiu        | Entregue                           |
| Pop-up de boas-vindas no primeiro acesso        | Entregue                           |
| Faixa retangular com degradê editável no painel | Entregue                           |
| Trocar o servidor/player do vídeo               | Entregue                           |
| Buffer adiantado no player próprio              | Entregue                           |
| Perguntar se quer voltar ao ponto               | Entregue                           |

Sobre a fileira "em alta": ela era ordenada por uma marca escrita à mão e pela data de
atualização do cadastro — o que subisse uma vez ficava lá. Agora cada visualização vale
menos conforme envelhece (meia-vida de 24 h). **Medido no banco de demonstração:** um
título com 400 visualizações de 13 dias atrás sai da fileira, e um com 120 de duas horas
atrás abre. O total acumulado puro ordenaria ao contrário.

### 2.7 Interface que prometia o que não entregava

- `"Legendas Br"` era fixo no cartão, na lista de episódios, no painel de trailers e na
  tela de assistir. **Não há uma única legenda cadastrada no sistema.** Cada lugar passou
  a dizer o que é verdade.
- O botão de baixar na lista de episódios não tinha ação nenhuma por trás.
- `<track kind="captions">` sem `src` no player.
- A duração vinha só do cadastro: a tela dizia "23min" ao lado de um vídeo de 3 s. Agora o
  `ffprobe` lê a duração real depois de converter.
- A barra de progresso mostrava meia hora carregada logo depois de um retrocesso.

### 2.8 Defeito anterior encontrado no caminho

Home e catálogo marcavam o próprio HTML como `private, max-age=30` — **com o estado da
sessão dentro**. Voltando dentro desses 30 s, o navegador servia a página de outro estado,
inclusive o cabeçalho de quem tinha acabado de sair da conta. Corrigido, com teste.

### 2.9 Windows

`npm run encerrar` procurava quem estava na porta com `lsof` e `fuser`: no Windows nenhum
dos dois existe, e onde existia matava o que estivesse ali. Agora o `iniciar` anota qual
processo é o nosso e o `encerrar` derruba exatamente esse. **Testado no PowerShell
nativo.**

---

## 3. Resultados dos testes

### Instalação do zero, em segunda cópia limpa

Cópia sem `node_modules`, sem `.svelte-kit`, sem `build`, sem `.git`, sem banco e sem
mídia; `.env` criado a partir do `.env.exemplo`.

| Etapa                             | Resultado                                              |
| --------------------------------- | ------------------------------------------------------ |
| `npm install` (com `postinstall`) | 390 pacotes, sem erro                                  |
| `npm run preparar`                | 3 migrations aplicadas + seed                          |
| `npm run typecheck`               | **685 arquivos, 0 erros, 0 avisos**                    |
| `npm run lint`                    | limpo                                                  |
| `npm run formatar:checar`         | limpo                                                  |
| `npm run teste:unitario`          | **29 arquivos, 276 testes, todos passando**            |
| `npm run build`                   | build de produção concluído                            |
| `npm run iniciar` + smoke         | 200 na home e na API; cabeçalhos de segurança no lugar |
| `npm run encerrar`                | derrubou o processo certo, no PowerShell               |

### Ponta a ponta (produção, dois perfis: celular 390 e desktop 1440)

**116 testes: 113 passaram, 1 falha corrigida e reconferida, 2 pulados.** Os pulados são
os que exigem internet, e o motivo aparece no relatório.

Destaques verificados de verdade:

- **Pipeline completo de vídeo**: arquivo enviado → convertido → episódio → play com
  `currentTime` avançando, avanço temporal funcionando e duração real lida. Abrir o player
  sem tocar o vídeo não conta como aprovação, e não foi isso que foi feito.
- Link direto de MP4 público verificado e salvo como origem no ar.
- Playlist HLS remota aceita, com as qualidades da origem listadas.
- YouTube reconhecido, com o iframe apontando para `youtube-nocookie.com`.
- Endereço que exige autenticação e endereço inexistente explicados em português, sem
  número de status cru.
- `127.0.0.1` e `169.254.169.254` recusados pelo endpoint de verificação.
- Conta sem papel de editor recusada em `/api/admin/fontes/verificar` e
  `/api/admin/episodios`.
- Boas-vindas aparece uma vez e não volta.
- Sair da conta some com o painel na volta imediata à home.

### Auditoria visual

30 telas capturadas antes e 32 depois, em desktop 1440 e celular 390, autenticado como
administrador. **0 erros de console** nas duas rodadas. Em `docs/capturas/antes/` e
`docs/capturas/depois/` (fora do Git: evidência de execução, não código).

---

## 4. Preservação do original

Inventário com hash de **471 arquivos** tirado antes de começar, em
`docs/evidencias/original-opus5-inicial.sha256`, e refeito no fim.

**Diferença: nenhuma.** O original está byte a byte como estava. `HEAD`, branch, remote e
`git status` idênticos.

A cópia é independente: nenhum remote, nenhum link ou junction, nenhum Git alternate,
nenhuma referência de runtime à pasta original. Banco, mídia, uploads, HLS, cookies,
cache, service worker e porta são próprios.

---

## 5. O que NÃO foi feito

Estado real, sem arredondar:

- **Publicação: não houve.** Nada foi para o GitHub, para a Vercel nem para qualquer
  serviço remoto. A cópia roda localmente e o build de produção foi gerado e testado
  localmente. Publicar depende de credenciais e de uma decisão sua.
- **Hospedagem em função serverless não foi preparada.** SQLite em disco e FFmpeg
  acompanhado por uma fila com prazo não sobrevivem a função efêmera. Ir para lá exige
  banco gerenciado, armazenamento de objetos e um processo de conversão separado — a fila
  já aguenta essa separação, mas a infraestrutura não foi montada.
- **Acessibilidade não foi certificada.** Foram feitas verificações concretas — foco
  visível, nome acessível, alvo de toque, contraste calculado da faixa, `prefers-reduced-motion`,
  `role`/`aria` nas peças novas. Isso não é o mesmo que uma auditoria WCAG completa, e
  seria desonesto chamar de conformidade.
- **Quatro vulnerabilidades altas continuam no `npm audit`**, todas em dependências
  transitivas de ferramenta (`mysql2` e `cookie`, que vêm do Prisma; `deepmerge-ts`). A
  correção que o npm oferece é `--force`, que rebaixaria o Prisma 7 para o 6 — mudança
  quebrada. `mysql2` nem é usado aqui: o banco é SQLite. O `sharp` tinha correção dentro
  da faixa já declarada e **foi atualizado** (0.35.3 → 0.35.4).
- **Nenhuma arte nova foi gerada.** As capas continuam sendo os gradientes SVG gerados a
  partir do slug — que é o catálogo demonstrativo do projeto, com títulos fictícios. Trocar
  isso por ilustração inventada seria pior: passaria a parecer catálogo real.
- **Legendas**: a tabela existe, o endpoint que serve o arquivo foi criado, e o player
  monta as faixas quando há. **Não há nenhuma cadastrada**, e não existe tela para cadastrar.
  A interface diz "Sem legenda" em vez de prometer.
- Os dois testes pulados de ponta a ponta dependem de internet.

---

## 6. Como abrir

```bash
cd C:\Projetos\Andamento\Yokira\yokira-astra
npm run dev
```

Abre em <http://localhost:4107>.

Contas locais (`npm run contas:locais` reajusta a senha):

| Conta                     | Senha              | Papel         |
| ------------------------- | ------------------ | ------------- |
| `admin@yokira.local`      | `YokiraLocal#2026` | Administrador |
| `espectador@yokira.local` | `YokiraLocal#2026` | Espectador    |

Valem **só nesta cópia local**.

Para ver o requisito principal: `/admin/enviar` → procure um episódio → aba **Usar link**
→ cole um endereço → **Verificar vídeo**.
