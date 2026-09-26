// Arquivo: src/routes/api/midia/playlist/+server.ts
// Diz ao player de onde tocar este episódio, no momento do play. Fica fora da carga da
// página de propósito: endereço assinado embutido no HTML seria cacheado junto com ela e
// continuaria valendo depois que o usuário saiu.
//
// O nome do arquivo é histórico — hoje ele responde por qualquer tipo de fonte, não só
// pela playlist do HLS próprio.

import { error, json } from '@sveltejs/kit';
import { banco } from '$servidor/banco/cliente';
import { estreou, podeVerAntesDaEstreia } from '$servidor/banco/estreia';
import { fonteAtivaDoEpisodio } from '$servidor/banco/fontes-midia';
import { fonteEscolhida } from '$servidor/banco/fontes-para-espectador';
import { ErroDeReproducao, montarFonteParaPlayer } from '$servidor/midia/fonte-para-player';
import type { RequestHandler } from './$types';

const SEM_CACHE = { 'cache-control': 'private, no-store' };

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.usuario) throw error(401, 'Entre na sua conta para assistir.');

  const episodioId = url.searchParams.get('episodioId')?.trim();
  if (!episodioId) throw error(400, 'Episódio não informado.');

  // A página já barra o agendado, mas este endpoint aceita um id direto: sem a mesma
  // checagem aqui, quem soubesse o id assistiria antes da estreia.
  const episodio = await banco.episodio.findUnique({
    where: { id: episodioId },
    select: { publicadoEm: true }
  });
  if (!episodio) throw error(404, 'Episódio não encontrado.');
  if (!estreou(episodio.publicadoEm) && !podeVerAntesDaEstreia(locals.usuario.papel)) {
    throw error(404, 'Episódio não encontrado.');
  }

  // O espectador pode trocar de origem sem sair da página. O id vem por parâmetro, mas
  // quem confere se ele é mesmo deste episódio é o servidor — id de outro episódio aqui
  // seria um jeito de assistir ao que não estreou.
  const escolhidoId = url.searchParams.get('fonteId')?.trim();
  const ativa = escolhidoId
    ? await fonteEscolhida(episodioId, escolhidoId)
    : await fonteAtivaDoEpisodio(episodioId);

  if (escolhidoId && !ativa) throw error(404, 'Essa opção não está mais disponível.');

  if (ativa) {
    try {
      const fonte = await montarFonteParaPlayer(ativa, episodioId, locals.usuario.id);
      return json(fonte, { headers: SEM_CACHE });
    } catch (erro) {
      if (erro instanceof ErroDeReproducao) throw error(erro.status, erro.message);
      throw erro;
    }
  }

  // Episódio anterior às fontes: continua tocando pelo caminho antigo.
  const arquivo = await banco.arquivoMidia.findFirst({
    where: { episodioId },
    orderBy: { criadoEm: 'desc' },
    include: {
      variantes: { select: { id: true } },
      trabalhos: { orderBy: { criadoEm: 'desc' }, take: 1 }
    }
  });

  if (!arquivo) throw error(404, 'Este episódio ainda não tem vídeo.');

  // Sem variante não há o que tocar. A mensagem separa "espera um pouco" de "deu ruim",
  // porque o usuário faz coisas diferentes em cada caso.
  if (arquivo.variantes.length === 0) {
    throw error(
      409,
      arquivo.trabalhos[0]?.situacao === 'FALHOU'
        ? 'O preparo deste episódio falhou. Avise a administração.'
        : 'Este episódio ainda está sendo preparado. Tente de novo em alguns minutos.'
    );
  }

  const fonte = await montarFonteParaPlayer(
    { tipo: 'HLS_LOCAL', url: null, embedId: null, mime: null, aviso: null, arquivoId: arquivo.id },
    episodioId,
    locals.usuario.id
  );
  return json(fonte, { headers: SEM_CACHE });
};
