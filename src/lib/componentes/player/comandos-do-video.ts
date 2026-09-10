// Arquivo: src/lib/componentes/player/comandos-do-video.ts
// As ações que os controles e o teclado disparam sobre o <video>. Ficam fora do
// componente porque são a parte que dá para testar sem montar nada, e porque tirá-las de
// lá é o que mantém o player dentro do limite de tamanho do projeto.
//
// Recebe funções em vez de elementos: no Svelte o `bind:this` só existe depois da
// primeira pintura, e guardar a referência aqui daria `undefined` na montagem.

import type { EstadoDaMidia } from './estado-da-midia';

export interface ComandosDoVideo {
  alternar: () => void;
  buscar: (segundos: number) => void;
  alternarMudo: () => void;
  alternarTelaCheia: () => void;
  definirVolume: (valor: number) => void;
  tempoAtual: () => number;
  duracao: () => number;
  volumeAtual: () => number;
}

export function criarComandos(
  obterVideo: () => HTMLVideoElement | undefined,
  obterQuadro: () => HTMLElement | undefined,
  obterEstado: () => EstadoDaMidia
): ComandosDoVideo {
  const comVideo = (acao: (video: HTMLVideoElement) => void) => () => {
    const video = obterVideo();
    if (video) acao(video);
  };

  return {
    alternar: comVideo((video) => {
      if (video.paused) void video.play().catch(() => undefined);
      else video.pause();
    }),
    buscar: (segundos: number) => {
      const video = obterVideo();
      if (video) video.currentTime = segundos;
    },
    alternarMudo: comVideo((video) => {
      video.muted = !video.muted;
    }),
    alternarTelaCheia: () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined);
        return;
      }
      void obterQuadro()
        ?.requestFullscreen()
        .catch(() => undefined);
    },
    definirVolume: (valor: number) => {
      const video = obterVideo();
      if (!video) return;
      video.volume = valor;
      video.muted = valor === 0;
    },
    tempoAtual: () => obterEstado().atual,
    duracao: () => obterEstado().duracao,
    volumeAtual: () => obterEstado().volume
  };
}

export const ERRO_DE_REPRODUCAO =
  'O vídeo não abriu. A origem pode estar fora do ar ou o formato pode não ser aceito por ' +
  'este navegador.';
