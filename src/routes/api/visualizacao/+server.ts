// Arquivo: src/routes/api/visualizacao/+server.ts
// Registra que alguem comecou a assistir. Chamado no primeiro `play` do episodio, nao na
// abertura da pagina: contar a abertura infla o numero com quem so passou por ali, e esse
// numero inflado e o que depois ordena a trilha de mais assistidos.
//
// Visitante sem conta tambem conta — o numero e de audiencia, nao de contas. Sem conta
// nao ha como evitar a repeticao, entao so quem esta logado tem janela anti-F5.

import { error, json } from '@sveltejs/kit';
import { banco } from '$servidor/banco/cliente';
import { estreou, podeVerAntesDaEstreia } from '$servidor/banco/estreia';
import { registrarVisualizacao } from '$servidor/banco/visualizacoes';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const episodioId = typeof corpo?.episodioId === 'string' ? corpo.episodioId.trim() : '';
  if (!episodioId) throw error(400, 'Episodio nao informado.');

  const episodio = await banco.episodio.findUnique({
    where: { id: episodioId },
    select: { publicadoEm: true }
  });
  if (!episodio) throw error(404, 'Episodio nao encontrado.');

  // Episodio agendado nao acumula audiencia por quem espiou antes da estreia.
  if (!estreou(episodio.publicadoEm)) {
    if (!podeVerAntesDaEstreia(locals.usuario?.papel)) throw error(404, 'Episodio nao encontrado.');
    return json({ contou: false, total: 0 }, { headers: { 'cache-control': 'private, no-store' } });
  }

  const resultado = await registrarVisualizacao(episodioId, locals.usuario?.id ?? null);
  return json(
    { contou: resultado.contou, total: resultado.totalDoEpisodio },
    { headers: { 'cache-control': 'private, no-store' } }
  );
};
