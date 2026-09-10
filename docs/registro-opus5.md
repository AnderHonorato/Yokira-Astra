# Registro de andamento — continuação em `yokira-astra`

Executor: Claude Opus 5. Data de início: 2026-09-09.
Este arquivo é o registro operacional: decisões, comandos, evidências e o que
falta. O produto está no `README.md`; o histórico anterior, em
`docs/continuidade.md`.

## Regra de trabalho

O original `C:\Projetos\Andamento\Yokira\yokira-animees` é **somente leitura**.
Inventário inicial em `docs/evidencias/original-opus5-inicial.sha256` (471
arquivos) e `docs/evidencias/original-opus5-inicial.git.txt`. A conferência
final compara contra esses dois.

## Estado encontrado (2026-09-09)

`yokira-astra` era uma cópia independente parada no meio:

- Isolamento pronto: `.env` próprio (porta 4107, `yokira_astra_sessao`,
  `yokira-astra-cache`, banco e mídia próprios), git próprio na branch
  `codex/astra-1.1.0` **sem nenhum commit**.
- `prisma/schema.prisma` + `prisma/migrations/20260906000000_fontes_midia_fila`
  criam `FonteMidia` e os campos de fila (`tentativas`, `leaseAte`, `executor`).
  A migration **nunca tinha sido aplicada** ao `dev.db`.
- `src/lib/contratos/midia.ts` com os tipos do contrato.
- **Nenhuma linha de aplicação usava `FonteMidia`.** Nem servidor, nem painel,
  nem player. O requisito principal estava só no schema.
- `package.json` apontava para três scripts inexistentes
  (`scripts/desenvolver.ts`, `scripts/criar-contas-locais.ts`,
  `scripts/preparar-ambiente.mjs`), então `npm run dev` quebrava.
- `npm run verificar` falhava na formatação (5 arquivos), e por isso os testes
  unitários nunca chegavam a rodar.

## Verificação de base (antes de qualquer mudança minha)

| Etapa                     | Resultado                                 |
| ------------------------- | ----------------------------------------- |
| `npm run typecheck`       | 615 arquivos, 0 erros, 0 avisos           |
| `npm run lint`            | limpo                                     |
| `npm run formatar:checar` | **falha** em 5 arquivos                   |
| `npx vitest run`          | não executado (bloqueado pela formatação) |

## Feito

1. `package.json`: `dev` passou a ser `vite dev --port 4107 --strictPort`;
   `preparar` voltou a semear o banco; removidos `contas:locais` e
   `ambiente:local`, que apontavam para arquivos inexistentes.
2. `npx prettier --write` nos 5 arquivos. Eram só linhas em branco no fim,
   sobra da edição anterior; o conteúdo (identidade própria de cookie, cache e
   chave de audiência) estava correto e foi preservado.
3. `npx prisma migrate deploy` aplicou a migration pendente. A retrocompatível
   preencheu 5 `FonteMidia` a partir dos `ArquivoMidia` já existentes.
4. `npx vitest run`: **21 arquivos, 191 testes, todos passando.**

Banco depois disso: 15 títulos, 54 temporadas, **796 episódios**, 5 arquivos de
mídia, 15 variantes HLS, 8 usuários, 5 fontes de mídia.

> 796 episódios é exatamente o motivo de o seletor `take: 60` do
> `/admin/enviar` estar quebrado: ele mostra 7,5% do catálogo.

## Próximos passos

Ver a seção de pendências no fim deste arquivo, atualizada a cada etapa.
