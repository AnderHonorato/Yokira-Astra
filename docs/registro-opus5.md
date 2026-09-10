# Registro de andamento — continuação em `yokira-astra`

Executor: Claude Opus 5. Início: 2026-09-09. Entrega: 2026-09-10.

Este arquivo é o registro operacional: decisões, comandos, evidências e o que falta. O
produto está no `README.md`; o resumo da entrega, em `ENTREGA-OPUS5.md`; o histórico
anterior, em `docs/continuidade.md`.

## Regra de trabalho

O original `C:\Projetos\Andamento\Yokira\yokira-animees` é **somente leitura**. Inventário
inicial em `docs/evidencias/original-opus5-inicial.sha256` (471 arquivos) e
`docs/evidencias/original-opus5-inicial.git.txt`.

**Conferência final: nenhuma diferença.** O original está byte a byte como estava, com
`HEAD`, branch, remote e `git status` idênticos.

## Estado encontrado

`yokira-astra` era uma cópia independente parada no meio:

- Isolamento pronto: `.env` próprio (porta 4107, `yokira_astra_sessao`,
  `yokira-astra-cache`, banco e mídia próprios), Git próprio **sem nenhum commit**.
- `prisma/schema.prisma` + a migration `20260906000000_fontes_midia_fila` criavam
  `FonteMidia` e os campos de fila. A migration **nunca tinha sido aplicada** ao `dev.db`.
- `src/lib/contratos/midia.ts` com os tipos do contrato.
- **Nenhuma linha de aplicação usava `FonteMidia`.** Nem servidor, nem painel, nem player.
- `package.json` apontava para três scripts inexistentes, então `npm run dev` quebrava.
- `npm run verificar` falhava na formatação, e por isso os testes nunca rodavam.

### Verificação de base, antes de qualquer mudança

| Etapa                     | Resultado                                 |
| ------------------------- | ----------------------------------------- |
| `npm run typecheck`       | 615 arquivos, 0 erros, 0 avisos           |
| `npm run lint`            | limpo                                     |
| `npm run formatar:checar` | **falha** em 5 arquivos                   |
| `npx vitest run`          | não executado (bloqueado pela formatação) |

Banco depois de aplicar a migration pendente: 15 títulos, 54 temporadas, **796
episódios**, 5 arquivos de mídia, 15 variantes HLS, 8 usuários.

> 796 episódios é exatamente o motivo de o seletor `take: 60` do `/admin/enviar` estar
> quebrado: ele mostrava 7,5% do catálogo.

## Decisões que valem registrar

- **Link compatível não é baixado.** Só cai no download e na conversão o que o navegador
  não tocaria. Foi o que separou "usar um link" de "copiar um arquivo".
- **O IP validado é fixado na conexão.** Conferir o nome e deixar o Node resolver de novo
  abre a janela do DNS rebinding. Isso obrigou a trocar `fetch` por `node:http` com
  `lookup` próprio, e a separar amostragem (`amostrar-resposta.ts`) de download em fluxo
  (`fluxo-remoto.ts`) sobre a mesma base validada.
- **Teste não afrouxa proteção.** As fixtures locais ficariam em localhost, que é o que a
  proteção recusa. Por isso o transporte é injetável nos testes unitários, e os de ponta a
  ponta usam endereços públicos e são pulados sem internet.
- **Corpo vazio vence o content-type.** Um servidor que anuncia `video/webm` e não entrega
  nada não tem vídeo. Descoberto por um teste que eu escrevi errado primeiro: a
  implementação deixava o content-type ganhar.
- **Boas-vindas só na home.** Um diálogo modal bloqueia a página inteira. Aparecendo em
  qualquer rota, ele parava quem tinha acabado de criar conta e chegava a cobrir o painel.
- **A fileira "em alta" usa decaimento, não total.** Total acumulado prende no topo o que
  estourou uma vez, e a fileira que promete "agora" passa a mostrar o mesmo de sempre.

## Armadilhas encontradas nesta rodada

- **`tar --exclude=midia` também exclui `src/lib/servidor/midia/`.** O padrão sem barra
  casa com qualquer componente de caminho — o mesmo tropeço que o `.gitignore` do projeto
  já documenta. A primeira cópia limpa saiu com 14 erros de módulo por causa disso. Use
  `--exclude=./midia`.
- **`networkidle` não espera o roteador do SvelteKit.** As primeiras capturas saíram com o
  esqueleto de carregamento no lugar da página. O roteiro passou a esperar
  `.esqueleto-de-rota` sumir.
- **Fechar e navegar cancela o `fetch`.** A marcação de "já viu as boas-vindas" se perdia.
  Resolvido com `keepalive: true`.
- **Cache de HTML com estado de sessão dentro.** Home e catálogo marcavam a própria
  resposta como `private, max-age=30`. Foi o que fez a mensagem voltar na página seguinte
  — e, pior, mantinha o cabeçalho de quem tinha acabado de sair da conta.
- **Teste que liga estado global quebra os paralelos.** Ligar a faixa de boas-vindas
  derrubou 13 testes que rodavam ao mesmo tempo. O arquivo agora desliga no `afterAll`.
- **Reordenar as fileiras da home quebra teste que usa `.first()`.** O teste do carrossel
  media uma fileira e clicava na seta de outra. Escopar por seção resolveu; e no celular a
  seta de "Populares" passou a nascer abaixo da dobra, o que quebrou `elementFromPoint` —
  ele mede na janela, não na página.
- **Dois testes já vinham quebrados desta cópia**, e não por causa deste trabalho: o do
  tema conferia o cookie `yokira_tema` e o do cache o IndexedDB `yokira-cache`, com o nome
  do projeto original escrito à mão. Esta cópia usa nomes próprios, de propósito.

## Verificação final

| Etapa                               | Resultado                                              |
| ----------------------------------- | ------------------------------------------------------ |
| Instalação do zero em segunda cópia | 390 pacotes, `postinstall` na ordem certa              |
| `npm run typecheck`                 | 685 arquivos, 0 erros, 0 avisos                        |
| `npm run lint`                      | limpo                                                  |
| `npm run formatar:checar`           | limpo                                                  |
| `npm run teste:unitario`            | 29 arquivos, **276 testes**, todos passando            |
| `npm run build`                     | build de produção concluído                            |
| `npm run iniciar` + smoke           | 200 e cabeçalhos de segurança no lugar                 |
| `npm run encerrar`                  | derrubou o processo certo, no PowerShell nativo        |
| `npx playwright test`               | **116 testes: 113 passando, 2 pulados (sem internet)** |
| Auditoria visual                    | 32 telas, dois perfis, **0 erros de console**          |
| Comparação com o original           | **nenhuma diferença**                                  |

## Pendências

Em ordem de retorno:

1. **Tela de cadastro de legendas.** A tabela existe, o endpoint que serve o arquivo foi
   criado e o player monta as faixas quando há. Falta o cadastro — sem ele, a interface
   continua dizendo "Sem legenda", que é verdade e por isso está certo.
2. **Revalidar endereço temporário.** Hoje a fonte fica gravada com o aviso de prazo. Falta
   o botão de revalidar sem apagar o episódio.
3. **Processo de conversão separado.** A fila já aguenta (`SEM_TRABALHADOR=1` no web). Falta
   a infraestrutura, e ela só faz sentido junto com banco gerenciado.
4. **Hospedagem.** Nada foi publicado. SQLite em disco e FFmpeg com fila não sobrevivem a
   função efêmera; ir para lá exige banco gerenciado, armazenamento de objetos e o
   processo de conversão separado.
5. **Auditoria de acessibilidade de verdade.** O que foi feito são verificações pontuais,
   não conformidade WCAG.
6. **Quatro vulnerabilidades altas no `npm audit`**, todas transitivas de ferramenta. A
   correção oferecida é `--force`, que rebaixa o Prisma 7 para o 6.

## Do backlog herdado de `docs/continuidade.md`

Continua tudo aberto, com uma exceção: a trilha "Porque você viu X" estava pronta no
original como trabalho local não commitado e **foi trazida para cá**. As outras duas
frentes que nunca entregaram (SEO/PWA e arquitetura para escala) seguem sem resultado —
não presuma que existe.
