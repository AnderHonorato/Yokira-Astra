// Arquivo: src/routes/api/admin/episodios/+server.ts
// Alimenta o seletor de episódios do painel de envio. É endpoint próprio, e não dado da
// página, porque a busca digita e pagina sem recarregar — e porque a resposta é privada:
// a lista de episódios não publicados não pode cair em cache compartilhado.

import { error, json } from '@sveltejs/kit';
import { episodiosParaEnvio } from '$servidor/banco/episodios-para-envio';
import { exigirPapel } from '$servidor/permissoes/papeis';
import type { RequestHandler } from './$types';

const LIMITE_DE_BUSCA = 80;

export const GET: RequestHandler = async ({ url, locals }) => {
  exigirPapel(locals.usuario?.papel, 'EDITOR');

  const busca = (url.searchParams.get('busca') ?? '').slice(0, LIMITE_DE_BUSCA);
  const paginaBruta = Number(url.searchParams.get('pagina') ?? '1');
  if (!Number.isFinite(paginaBruta) || paginaBruta < 1) throw error(400, 'Página inválida.');

  const resultado = await episodiosParaEnvio({ busca, pagina: Math.trunc(paginaBruta) });

  return json(resultado, { headers: { 'cache-control': 'private, no-store' } });
};
