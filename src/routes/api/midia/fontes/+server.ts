// Arquivo: src/routes/api/midia/fontes/+server.ts
// Quais origens este episodio oferece ao espectador. Devolve rotulo e id, nunca
// endereco: o endereco so e montado no /api/midia/playlist, ja com a sessao de quem
// pediu, e um link assinado que saisse daqui valeria fora da tela de assistir.

import { error, json } from '@sveltejs/kit';
import { banco } from '$servidor/banco/cliente';
import { estreou, podeVerAntesDaEstreia } from '$servidor/banco/estreia';
import { fontesParaEspectador } from '$servidor/banco/fontes-para-espectador';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.usuario) throw error(401, 'Entre na sua conta para assistir.');

  const episodioId = url.searchParams.get('episodioId')?.trim();
  if (!episodioId) throw error(400, 'Episodio nao informado.');

  const episodio = await banco.episodio.findUnique({
    where: { id: episodioId },
    select: { publicadoEm: true }
  });
  if (!episodio) throw error(404, 'Episodio nao encontrado.');
  if (!estreou(episodio.publicadoEm) && !podeVerAntesDaEstreia(locals.usuario.papel)) {
    throw error(404, 'Episodio nao encontrado.');
  }

  return json(
    { fontes: await fontesParaEspectador(episodioId) },
    { headers: { 'cache-control': 'private, no-store' } }
  );
};
