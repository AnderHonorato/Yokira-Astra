// Arquivo: src/routes/api/boas-vindas/+server.ts
// Marca que a pessoa ja viu a mensagem do primeiro acesso. Chamado quando ela FECHA a
// mensagem, nao quando ela abre: marcar na abertura perderia o recado de quem teve a aba
// fechada antes de ler.

import { error, json } from '@sveltejs/kit';
import { marcarBoasVindasVistas } from '$servidor/banco/faixas-promocionais';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.usuario) throw error(401, 'Precisa entrar na conta.');
  await marcarBoasVindasVistas(locals.usuario.id);
  return json({ marcada: true }, { headers: { 'cache-control': 'private, no-store' } });
};
