// Arquivo: src/lib/componentes/player/estado-da-midia.ts
// Escuta o <video> num lugar so e devolve um retrato do estado. Antes eram sete
// handlers inline no markup, cada um mexendo numa variavel diferente — ler o que o
// player realmente sabia exigia caçar as sete.

export interface EstadoDaMidia {
  tocando: boolean;
  atual: number;
  duracao: number;
  /** Fim do ultimo trecho ja baixado, pra barra mostrar ate onde da pra avancar. */
  carregado: number;
  volume: number;
  mudo: boolean;
}

/** Estado antes de o <video> existir. Um lugar so pra nao divergir do retrato. */
export const MIDIA_PARADA: EstadoDaMidia = {
  tocando: false,
  atual: 0,
  duracao: 0,
  carregado: 0,
  volume: 1,
  mudo: false
};

const EVENTOS = [
  'play',
  'pause',
  'timeupdate',
  'durationchange',
  'loadedmetadata',
  'progress',
  'volumechange',
  'ended'
] as const;

/**
 * Ate onde da pra avancar a partir de onde o video esta agora. Pegar simplesmente o fim
 * do ultimo trecho baixado mentia depois de um retrocesso: o trecho de tras continuava na
 * memoria e a barra mostrava meia hora carregada logo depois de voltar para o comeco.
 */
export function fimDoTrechoAtual(video: HTMLVideoElement): number {
  const buffers = video.buffered;
  const agora = video.currentTime;
  for (let indice = 0; indice < buffers.length; indice += 1) {
    // Meio segundo de folga: o trecho costuma comecar alguns quadros depois do ponto.
    if (buffers.start(indice) <= agora + 0.5 && buffers.end(indice) >= agora) {
      return buffers.end(indice);
    }
  }
  return buffers.length > 0 ? buffers.end(buffers.length - 1) : 0;
}

export function retratoDaMidia(video: HTMLVideoElement): EstadoDaMidia {
  return {
    tocando: !video.paused && !video.ended,
    atual: video.currentTime,
    // Sem metadados a duracao vem NaN; zero mantem a barra em 0% em vez de sumir.
    duracao: Number.isFinite(video.duration) ? video.duration : 0,
    carregado: fimDoTrechoAtual(video),
    volume: video.volume,
    mudo: video.muted
  };
}

/** Liga os ouvintes e devolve como desligar. */
export function observarMidia(
  video: HTMLVideoElement,
  aoMudar: (estado: EstadoDaMidia) => void
): () => void {
  const avisar = () => aoMudar(retratoDaMidia(video));
  for (const evento of EVENTOS) video.addEventListener(evento, avisar);
  avisar();

  return () => {
    for (const evento of EVENTOS) video.removeEventListener(evento, avisar);
  };
}
