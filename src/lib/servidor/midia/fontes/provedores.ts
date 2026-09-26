// Arquivo: src/lib/servidor/midia/fontes/provedores.ts
// Quando o link é uma PÁGINA e não um arquivo, o único caminho honesto é a incorporação
// oficial do provedor. Aqui só entram provedores cujo endereço de incorporação é
// documentado e estável, e o que sai é sempre um id extraído por regra própria — nunca
// HTML ou iframe vindo de quem colou o link.
//
// A lista é curta de propósito. Cada item novo é uma origem a mais liberada no CSP.

export type ProvedorSuportado = 'YOUTUBE' | 'VIMEO';

export interface Incorporacao {
  provedor: ProvedorSuportado;
  embedId: string;
  /** Endereço do iframe. Montado aqui, nunca recebido de fora. */
  url: string;
  origem: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;

function limpar(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

function segmentos(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean);
}

function doYoutube(url: URL): string | null {
  const host = limpar(url.hostname);
  const partes = segmentos(url);

  if (host === 'youtu.be') return partes[0] ?? null;

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (partes[0] === 'watch') return url.searchParams.get('v');
    if (partes[0] === 'embed' || partes[0] === 'shorts' || partes[0] === 'live') {
      return partes[1] ?? null;
    }
  }

  return null;
}

function doVimeo(url: URL): string | null {
  const host = limpar(url.hostname);
  const partes = segmentos(url);

  if (host === 'vimeo.com') {
    // Vimeo usa /<id> e também /channels/<canal>/<id>: o id é o último trecho numérico.
    for (let indice = partes.length - 1; indice >= 0; indice -= 1) {
      if (VIMEO_ID.test(partes[indice])) return partes[indice];
    }
    return null;
  }
  if (host === 'player.vimeo.com' && partes[0] === 'video') return partes[1] ?? null;

  return null;
}

/** Endereços de terceiros que o CSP precisa liberar em `frame-src`. */
export const ORIGENS_DE_INCORPORACAO = [
  'https://www.youtube-nocookie.com',
  'https://www.youtube.com',
  'https://player.vimeo.com'
];

export function reconhecerProvedor(url: URL): Incorporacao | null {
  const youtube = doYoutube(url);
  if (youtube && YOUTUBE_ID.test(youtube)) {
    return {
      provedor: 'YOUTUBE',
      embedId: youtube,
      // O domínio sem cookie é o mesmo player, sem gravar nada antes do play.
      url: `https://www.youtube-nocookie.com/embed/${youtube}?rel=0&modestbranding=1`,
      origem: 'https://www.youtube-nocookie.com'
    };
  }

  const vimeo = doVimeo(url);
  if (vimeo && VIMEO_ID.test(vimeo)) {
    return {
      provedor: 'VIMEO',
      embedId: vimeo,
      url: `https://player.vimeo.com/video/${vimeo}?dnt=1`,
      origem: 'https://player.vimeo.com'
    };
  }

  return null;
}

/** Reconstrói o endereço a partir do que foi gravado, sem confiar no que veio do banco. */
export function incorporacaoGravada(
  provedor: string,
  embedId: string
): Pick<Incorporacao, 'url' | 'origem'> | null {
  if (provedor === 'YOUTUBE' && YOUTUBE_ID.test(embedId)) {
    return {
      url: `https://www.youtube-nocookie.com/embed/${embedId}?rel=0&modestbranding=1`,
      origem: 'https://www.youtube-nocookie.com'
    };
  }
  if (provedor === 'VIMEO' && VIMEO_ID.test(embedId)) {
    return { url: `https://player.vimeo.com/video/${embedId}?dnt=1`, origem: 'https://player.vimeo.com' };
  }
  return null;
}

export function nomeDoProvedor(provedor: string): string {
  if (provedor === 'YOUTUBE') return 'YouTube';
  if (provedor === 'VIMEO') return 'Vimeo';
  return provedor;
}
