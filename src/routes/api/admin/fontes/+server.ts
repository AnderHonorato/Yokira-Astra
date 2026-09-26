// Arquivo: src/routes/api/admin/fontes/+server.ts
// Lista, ativa e remove as fontes de um episódio. Um episódio pode ter várias — arquivo
// convertido aqui, link direto, playlist remota, incorporação — e trocar qual está no ar
// é uma operação corriqueira, não uma exclusão.
//
// Trocar não apaga: a fonte antiga continua gravada e volta a ser escolhida com um
// clique. É o que permite testar um link novo sem perder o vídeo que já funcionava.

import { error, json } from '@sveltejs/kit';
import { ativarFonte, listarFontes, removerFonte } from '$servidor/banco/fontes-midia';
import { banco } from '$servidor/banco/cliente';
import { registrarAcaoAdministrativa } from '$servidor/autenticacao/confirmacao';
import { exigirPapel } from '$servidor/permissoes/papeis';
import type { RequestHandler } from './$types';

const SEM_CACHE = { 'cache-control': 'private, no-store' };

export const GET: RequestHandler = async ({ url, locals }) => {
  exigirPapel(locals.usuario?.papel, 'EDITOR');

  const episodioId = (url.searchParams.get('episodioId') ?? '').trim();
  if (!episodioId) throw error(400, 'Episódio não informado.');

  return json({ fontes: await listarFontes(episodioId) }, { headers: SEM_CACHE });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  exigirPapel(locals.usuario?.papel, 'EDITOR');

  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const fonteId = typeof corpo?.fonteId === 'string' ? corpo.fonteId : '';
  if (!fonteId) throw error(400, 'Fonte não informada.');

  const fonte = await banco.fonteMidia.findUnique({ where: { id: fonteId } });
  if (!fonte) throw error(404, 'Essa fonte não existe mais.');

  try {
    await ativarFonte(fonteId);
  } catch (erro) {
    throw error(409, erro instanceof Error ? erro.message : 'Não deu para ativar essa fonte.');
  }

  await registrarAcaoAdministrativa(
    locals.usuario!.id,
    'ativar-fonte-de-midia',
    fonte.episodioId,
    fonte.tipo
  );
  return json({ fontes: await listarFontes(fonte.episodioId) }, { headers: SEM_CACHE });
};

export const DELETE: RequestHandler = async ({ url, locals }) => {
  exigirPapel(locals.usuario?.papel, 'EDITOR');

  const fonteId = (url.searchParams.get('fonteId') ?? '').trim();
  if (!fonteId) throw error(400, 'Fonte não informada.');

  const fonte = await banco.fonteMidia.findUnique({ where: { id: fonteId } });
  if (!fonte) throw error(404, 'Essa fonte não existe mais.');
  // Remover a que está no ar deixaria o episódio sem vídeo por descuido: primeiro ativa
  // outra, depois remove esta.
  if (fonte.ativa) throw error(409, 'Essa é a fonte no ar. Ative outra antes de remover.');

  await removerFonte(fonteId);
  await registrarAcaoAdministrativa(
    locals.usuario!.id,
    'remover-fonte-de-midia',
    fonte.episodioId,
    fonte.tipo
  );
  return json({ fontes: await listarFontes(fonte.episodioId) }, { headers: SEM_CACHE });
};
