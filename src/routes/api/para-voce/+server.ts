// Arquivo: src/routes/api/para-voce/+server.ts
// Trilhas pessoais. Endpoint proprio, fora de /api/catalogo, porque aquela resposta e
// cache publico e o service worker a guarda — o que sai daqui e de uma pessoa so.

import { json } from '@sveltejs/kit';
import { trilhasPessoais } from '$servidor/banco/recomendacoes';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
  // Sem sessao nao e erro, e ausencia: a home simplesmente nao mostra trilha pessoal.
  setHeaders({ 'cache-control': 'private, no-store' });

  if (!locals.usuario) return json({ trilhas: [] });

  return json({ trilhas: await trilhasPessoais(locals.usuario.id) });
};
