// Arquivo: src/lib/servidor/banco/visualizacoes.ts
// Conta uma visualização quando o vídeo COMEÇA A TOCAR, não quando a página abre. A
// diferença não é detalhe: contar a abertura infla o número com quem passou o mouse por
// cima de um cartão e voltou, e é exatamente esse número inflado que depois ordena a
// trilha de mais assistidos.
//
// A mesma pessoa no mesmo episódio não conta duas vezes dentro da janela. Sem isso, dar
// F5 três vezes vale três visualizações e o ranking vira o que o mais insistente mandar.
//
// A linha em `Visualizacao` serve ao ranking recente; os contadores denormalizados em
// `Episodio` e `Titulo` servem às telas, que precisam do total sem varrer nada.

import { banco } from './cliente.js';

/** Janela de repetição. Reassistir amanhã conta de novo; dar F5 agora, não. */
export const JANELA_DE_REPETICAO_MS = 6 * 60 * 60 * 1000;

export interface VisualizacaoRegistrada {
  contou: boolean;
  totalDoEpisodio: number;
}

export async function registrarVisualizacao(
  episodioId: string,
  usuarioId: string | null
): Promise<VisualizacaoRegistrada> {
  const episodio = await banco.episodio.findUnique({
    where: { id: episodioId },
    select: { totalVisualizacoes: true, temporada: { select: { tituloId: true } } }
  });
  if (!episodio) return { contou: false, totalDoEpisodio: 0 };

  if (usuarioId) {
    const recente = await banco.visualizacao.findFirst({
      where: {
        episodioId,
        usuarioId,
        criadoEm: { gte: new Date(Date.now() - JANELA_DE_REPETICAO_MS) }
      },
      select: { id: true }
    });
    if (recente) return { contou: false, totalDoEpisodio: episodio.totalVisualizacoes };
  }

  const tituloId = episodio.temporada.tituloId;
  // Transação: a linha do ranking e os dois contadores das telas entram juntos, ou não
  // entram. Meio caminho aqui é um total que não bate com a lista.
  await banco.$transaction([
    banco.visualizacao.create({ data: { episodioId, tituloId, usuarioId } }),
    banco.episodio.update({
      where: { id: episodioId },
      data: { totalVisualizacoes: { increment: 1 } }
    }),
    banco.titulo.update({ where: { id: tituloId }, data: { totalVisualizacoes: { increment: 1 } } })
  ]);

  return { contou: true, totalDoEpisodio: episodio.totalVisualizacoes + 1 };
}

/** Recontagem a partir das linhas. Serve para conserto, não para o caminho normal. */
export async function recalcularContadores(): Promise<void> {
  const porEpisodio = await banco.visualizacao.groupBy({
    by: ['episodioId'],
    _count: { _all: true }
  });
  for (const linha of porEpisodio) {
    await banco.episodio.update({
      where: { id: linha.episodioId },
      data: { totalVisualizacoes: linha._count._all }
    });
  }

  const porTitulo = await banco.visualizacao.groupBy({ by: ['tituloId'], _count: { _all: true } });
  for (const linha of porTitulo) {
    await banco.titulo.update({
      where: { id: linha.tituloId },
      data: { totalVisualizacoes: linha._count._all }
    });
  }
}

/** Curtida é avaliação nota 10. O contador acompanha para as telas não recontarem. */
export async function sincronizarCurtidas(tituloId: string): Promise<number> {
  const total = await banco.avaliacao.count({ where: { tituloId, nota: 10 } });
  await banco.titulo.update({ where: { id: tituloId }, data: { totalCurtidas: total } });
  return total;
}
