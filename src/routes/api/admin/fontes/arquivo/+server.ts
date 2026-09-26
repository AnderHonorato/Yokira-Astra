// Arquivo: src/routes/api/admin/fontes/arquivo/+server.ts
// Recebe o arquivo de vídeo em fluxo. É PUT com o corpo cru, e não um formulário
// multipart, por um motivo prático: o `formData()` do SvelteKit junta o arquivo inteiro
// na memória antes de entregar, e o limite anunciado aqui é de gigabytes. Com o corpo
// cru os bytes vão para o disco enquanto chegam, e o navegador ainda consegue mostrar
// progresso real do envio.

import { error, json } from '@sveltejs/kit';
import { Readable } from 'node:stream';
import { aplicarArquivoNoEpisodio } from '$servidor/midia/aplicar-fonte';
import {
  ErroDeUpload,
  extensaoAceita,
  limiteDeUploadBytes
} from '$servidor/armazenamento/gravar-upload';
import { episodioExiste } from '$servidor/banco/episodios-para-envio';
import { registrarAcaoAdministrativa } from '$servidor/autenticacao/confirmacao';
import { exigirPapel } from '$servidor/permissoes/papeis';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ request, url, locals }) => {
  // Autorização antes de tocar no corpo: um envio de 4 GB não pode ser lido para só
  // depois descobrirmos que a conta não podia enviar nada.
  exigirPapel(locals.usuario?.papel, 'EDITOR');

  const episodioId = (url.searchParams.get('episodioId') ?? '').trim();
  const nome = (url.searchParams.get('nome') ?? '').trim().slice(0, 200);
  const token = (url.searchParams.get('token') ?? '').trim().slice(0, 80);

  if (!episodioId) throw error(400, 'Escolha o episódio antes de enviar.');
  if (!extensaoAceita(nome)) throw error(400, 'Aceitamos mp4, mkv, mov e webm.');
  if (!(await episodioExiste(episodioId))) throw error(404, 'Esse episódio não existe mais.');

  const anunciado = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(anunciado) && anunciado > limiteDeUploadBytes()) {
    throw error(413, 'O arquivo passa do limite de tamanho aceito.');
  }
  if (!request.body) throw error(400, 'O envio chegou sem arquivo.');

  try {
    const aplicada = await aplicarArquivoNoEpisodio({
      episodioId,
      nome,
      fluxo: Readable.fromWeb(request.body as never),
      token
    });
    await registrarAcaoAdministrativa(locals.usuario!.id, 'enviar-video', episodioId, nome);
    return json(aplicada, { headers: { 'cache-control': 'private, no-store' } });
  } catch (erro) {
    if (erro instanceof ErroDeUpload) throw error(400, erro.message);
    throw error(400, erro instanceof Error ? erro.message : 'Falha no envio.');
  }
};
