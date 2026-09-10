// Arquivo: src/lib/servidor/midia/fonte-para-player.ts
// Traduz a fonte gravada no banco para o que o player precisa saber. É aqui que o HLS
// próprio ganha assinatura e prazo, e é aqui que a incorporação de terceiro tem o
// endereço REMONTADO a partir do id — o que estiver gravado na coluna `url` nunca vira
// iframe, justamente para um registro adulterado não conseguir injetar endereço.

import { banco } from '../banco/cliente.js';
import { urlAssinada, VALIDADE_PLAYLIST_MS } from './assinatura-hls.js';
import { incorporacaoGravada } from './fontes/provedores.js';
import type { FonteParaPlayer, LegendaDaFonte, TipoFonteMidia } from '../../contratos/midia.js';

export class ErroDeReproducao extends Error {
  constructor(
    mensagem: string,
    readonly status: number
  ) {
    super(mensagem);
  }
}

async function legendasDoEpisodio(episodioId: string): Promise<LegendaDaFonte[]> {
  const legendas = await banco.legenda.findMany({
    where: { episodioId },
    select: { idioma: true, rotulo: true, id: true }
  });
  return legendas.map((legenda) => ({
    idioma: legenda.idioma,
    rotulo: legenda.rotulo,
    url: `/midia/legenda/${legenda.id}`
  }));
}

interface FonteGravada {
  tipo: string;
  url: string | null;
  embedId: string | null;
  mime: string | null;
  aviso: string | null;
  arquivoId: string | null;
}

export async function montarFonteParaPlayer(
  fonte: FonteGravada,
  episodioId: string,
  usuarioId: string
): Promise<FonteParaPlayer> {
  const legendas = await legendasDoEpisodio(episodioId);
  const base = {
    tipo: fonte.tipo as TipoFonteMidia,
    aviso: fonte.aviso ?? undefined,
    legendas
  };

  if (fonte.tipo === 'HLS_LOCAL') {
    if (!fonte.arquivoId) {
      throw new ErroDeReproducao('Este episódio ainda está sendo preparado.', 409);
    }
    const expiraEm = Date.now() + VALIDADE_PLAYLIST_MS;
    const assinada = urlAssinada({
      arquivoId: fonte.arquivoId,
      recurso: 'mestre.m3u8',
      usuarioId,
      expiraEm
    });
    // `playlist` continua no corpo porque é o nome que o player antigo lia.
    return { ...base, url: assinada, playlist: assinada, expiraEm };
  }

  if (fonte.tipo === 'YOUTUBE' || fonte.tipo === 'VIMEO') {
    const remontada = incorporacaoGravada(fonte.tipo, fonte.embedId ?? '');
    if (!remontada) {
      throw new ErroDeReproducao('A origem deste episódio não está mais utilizável.', 409);
    }
    return { ...base, url: remontada.url, origem: remontada.origem, embedId: fonte.embedId! };
  }

  if (!fonte.url) {
    throw new ErroDeReproducao('A origem deste episódio não está mais utilizável.', 409);
  }
  return { ...base, url: fonte.url, mime: fonte.mime ?? undefined };
}
