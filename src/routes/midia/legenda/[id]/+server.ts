// Arquivo: src/routes/midia/legenda/[id]/+server.ts
// Entrega o arquivo de legenda de um episódio. Exige sessão, como o vídeo: legenda é a
// transcrição da obra, não vale menos do que ela. O caminho vem do banco e nunca da URL,
// então não há travessia de diretório a barrar aqui — o que existe é a conferência de
// que o arquivo realmente mora dentro da pasta de legendas.

import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { error } from '@sveltejs/kit';
import { banco } from '$servidor/banco/cliente';
import type { RequestHandler } from './$types';

const PASTA_PADRAO = './midia/legendas';

function pastaDeLegendas(): string {
  return resolve(process.env.PASTA_LEGENDAS?.trim() || PASTA_PADRAO);
}

export const GET: RequestHandler = async ({ params, locals, setHeaders }) => {
  if (!locals.usuario) throw error(401, 'Entre na sua conta para ver as legendas.');

  const legenda = await banco.legenda.findUnique({ where: { id: params.id } });
  if (!legenda) throw error(404, 'Legenda não encontrada.');

  const raiz = pastaDeLegendas();
  const absoluto = isAbsolute(legenda.caminho) ? resolve(legenda.caminho) : join(raiz, legenda.caminho);
  if (absoluto !== raiz && !absoluto.startsWith(raiz + sep)) {
    throw error(404, 'Legenda não encontrada.');
  }

  const bytes = await readFile(absoluto).catch(() => null);
  if (!bytes) throw error(404, 'Legenda não encontrada.');

  setHeaders({
    'content-type': 'text/vtt; charset=utf-8',
    'cache-control': 'private, max-age=3600',
    'x-content-type-options': 'nosniff'
  });

  return new Response(new Uint8Array(bytes));
};
