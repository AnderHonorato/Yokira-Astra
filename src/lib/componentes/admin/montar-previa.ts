// Arquivo: src/lib/componentes/admin/montar-previa.ts
// Ação de Svelte que pendura a prévia no elemento de vídeo. É ação, e não bloco reativo,
// de propósito: um `$:` que lê e escreve as mesmas variáveis vira laço, e o componente
// remontaria o vídeo a cada repintura — ele nunca chegaria a tocar.
//
// A ação tem ciclo de vida claro: monta ao aparecer, remonta quando o endereço muda,
// desmonta ao sair. É exatamente o que o caso pede.

import { anexarPlaylist, type MidiaAnexada } from '$componentes/player/carregar-hls';
import type { PreviaDaFonte } from '../../contratos/midia';

export interface RetornoDaPrevia {
  update: (nova: PreviaDaFonte) => void;
  destroy: () => void;
}

export function montarPrevia(
  video: HTMLVideoElement,
  entrada: { previa: PreviaDaFonte; aoFalhar: () => void }
): RetornoDaPrevia {
  let anexada: MidiaAnexada | undefined;
  let ultima = '';

  const aplicar = (previa: PreviaDaFonte) => {
    if (previa.url === ultima) return;
    ultima = previa.url;
    anexada?.desanexar();
    anexada = undefined;

    if (previa.tipo === 'HLS_REMOTO') {
      void anexarPlaylist(video, previa.url)
        .then((resultado) => (anexada = resultado))
        .catch(() => entrada.aoFalhar());
      return;
    }

    video.src = previa.url;
  };

  aplicar(entrada.previa);

  return {
    update: (nova) => aplicar(nova),
    destroy: () => {
      anexada?.desanexar();
      video.removeAttribute('src');
    }
  };
}
