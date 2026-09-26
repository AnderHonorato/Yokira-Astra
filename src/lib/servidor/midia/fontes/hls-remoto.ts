// Arquivo: src/lib/servidor/midia/fontes/hls-remoto.ts
// Lê um m3u8 remoto o suficiente para saber se é reproduzível. Uma playlist é texto:
// aceitar só porque o content-type diz `application/x-mpegurl` deixaria passar arquivo
// vazio, playlist mestre sem nenhuma variante e playlist de mídia sem nenhum segmento —
// os três abrem o player num erro que ninguém consegue explicar.
//
// Os endereços de dentro são resolvidos contra a URL da própria playlist, porque a
// esmagadora maioria usa caminho relativo. Parser puro: sem rede aqui.

export interface VarianteRemota {
  url: string;
  altura: number | null;
  largura: number | null;
  taxaBits: number | null;
  codecs: string[];
}

export interface PlaylistLida {
  tipo: 'MESTRE' | 'MIDIA';
  variantes: VarianteRemota[];
  segmentos: number;
  /** Chave de criptografia declarada; DRM ou chave própria não tocam no nosso player. */
  temCriptografia: boolean;
}

export class ErroDePlaylist extends Error {}

function atributos(linha: string): Record<string, string> {
  const mapa: Record<string, string> = {};
  // Valores entre aspas podem conter vírgula (CODECS="avc1.64001f,mp4a.40.2").
  const padrao = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;
  let achado: RegExpExecArray | null;
  while ((achado = padrao.exec(linha)) !== null) {
    mapa[achado[1]] = achado[2].replace(/^"|"$/g, '');
  }
  return mapa;
}

function resolver(referencia: string, base: URL): string {
  try {
    return new URL(referencia, base).toString();
  } catch {
    throw new ErroDePlaylist('A playlist aponta para um endereço inválido.');
  }
}

export function lerPlaylist(texto: string, base: URL): PlaylistLida {
  const linhas = texto
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);

  if (linhas[0] !== '#EXTM3U') {
    throw new ErroDePlaylist('Esse endereço não devolveu uma playlist HLS.');
  }

  const variantes: VarianteRemota[] = [];
  let segmentos = 0;
  let temCriptografia = false;
  let pendente: Record<string, string> | null = null;

  for (const linha of linhas) {
    if (linha.startsWith('#EXT-X-STREAM-INF:')) {
      pendente = atributos(linha.slice('#EXT-X-STREAM-INF:'.length));
      continue;
    }
    if (linha.startsWith('#EXT-X-KEY:')) {
      const chave = atributos(linha.slice('#EXT-X-KEY:'.length));
      if ((chave.METHOD ?? 'NONE') !== 'NONE') temCriptografia = true;
      continue;
    }
    if (linha.startsWith('#EXTINF:')) {
      segmentos += 1;
      continue;
    }
    if (linha.startsWith('#')) continue;

    if (pendente) {
      const resolucao = (pendente.RESOLUTION ?? '').split('x');
      variantes.push({
        url: resolver(linha, base),
        largura: Number(resolucao[0]) || null,
        altura: Number(resolucao[1]) || null,
        taxaBits: Number(pendente.BANDWIDTH) || null,
        codecs: (pendente.CODECS ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      });
      pendente = null;
    }
  }

  if (variantes.length > 0) return { tipo: 'MESTRE', variantes, segmentos: 0, temCriptografia };
  if (segmentos > 0) return { tipo: 'MIDIA', variantes: [], segmentos, temCriptografia };

  throw new ErroDePlaylist('A playlist não lista nenhuma qualidade nem nenhum trecho de vídeo.');
}

/** Melhor variante para conferir: a de menor banda baixa mais rápido. */
export function varianteMaisLeve(lida: PlaylistLida): VarianteRemota | null {
  if (lida.variantes.length === 0) return null;
  return [...lida.variantes].sort(
    (a, b) => (a.taxaBits ?? Number.MAX_SAFE_INTEGER) - (b.taxaBits ?? Number.MAX_SAFE_INTEGER)
  )[0];
}

export function alturasDisponiveis(lida: PlaylistLida): number[] {
  return [...new Set(lida.variantes.map((v) => v.altura).filter((a): a is number => a !== null))]
    .sort((a, b) => b - a);
}
