// Arquivo: src/routes/admin/enviar/+page.server.ts
// Página de dar vídeo a um episódio. O arquivo sobe pelo endpoint de fluxo
// (`/api/admin/fontes/arquivo`), que aguenta gigabytes; o link fica aqui como ação de
// formulário, para funcionar mesmo com o JavaScript desligado.
//
// Colar um link não baixa nada por padrão. O que decide é a verificação: origem que já
// sabe servir vira fonte reproduzida de lá; só o que o navegador não tocaria é trazido
// para cá e convertido.

import { fail } from '@sveltejs/kit';
import { episodiosParaEnvio } from '$servidor/banco/episodios-para-envio';
import { aplicarLinkNoEpisodio, ErroDeFonteAplicada } from '$servidor/midia/aplicar-fonte';
import { limiteDeUploadBytes } from '$servidor/armazenamento/gravar-upload';
import { ffmpegDisponivel } from '$servidor/processamento/transcodificar';
import { registrarAcaoAdministrativa } from '$servidor/autenticacao/confirmacao';
import { exigirPapel } from '$servidor/permissoes/papeis';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const busca = (url.searchParams.get('busca') ?? '').slice(0, 80);
  const pagina = Math.max(1, Number(url.searchParams.get('pagina') ?? '1') || 1);

  return {
    // Primeira página já vem do servidor: a tela abre utilizável mesmo sem JavaScript.
    listaInicial: await episodiosParaEnvio({ busca, pagina }),
    buscaInicial: busca,
    limiteBytes: limiteDeUploadBytes(),
    temFfmpeg: await ffmpegDisponivel()
  };
};

export const actions: Actions = {
  link: async ({ request, locals }) => {
    exigirPapel(locals.usuario?.papel, 'EDITOR');

    const formulario = await request.formData();
    const episodioId = String(formulario.get('episodioId') ?? '').trim();
    const link = String(formulario.get('link') ?? '').trim();
    const token = String(formulario.get('token') ?? '')
      .trim()
      .slice(0, 80);

    if (episodioId === '') return fail(400, { mensagem: 'Escolha o episódio.' });
    if (link === '') return fail(400, { mensagem: 'Cole o link do vídeo.' });

    try {
      const aplicada = await aplicarLinkNoEpisodio(episodioId, link, token);
      await registrarAcaoAdministrativa(
        locals.usuario!.id,
        'enviar-video-por-link',
        episodioId,
        link.slice(0, 200)
      );
      return { mensagem: aplicada.mensagem, pronta: aplicada.pronta };
    } catch (erro) {
      if (erro instanceof ErroDeFonteAplicada) return fail(400, { mensagem: erro.message });
      return fail(400, {
        mensagem: erro instanceof Error ? erro.message : 'Não deu para usar esse link.'
      });
    }
  }
};
