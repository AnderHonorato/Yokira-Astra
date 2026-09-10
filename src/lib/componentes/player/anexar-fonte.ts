// Arquivo: src/lib/componentes/player/anexar-fonte.ts
// Escolhe como pendurar a fonte no <video>. HLS passa pelo hls.js (ou pelo suporte
// nativo do Safari); arquivo direto é `src` puro, que o navegador já sabe tocar e ainda
// ganha busca por trecho de graça quando a origem aceita.
//
// Incorporação de terceiro não chega aqui: ela tem quadro próprio, e fingir que os
// nossos controles mandam no player do YouTube seria mentira na interface.

import { anexarPlaylist, type MidiaAnexada, type NivelDeQualidade } from './carregar-hls';
import { ehPlaylist } from './pedir-fonte';
import type { FonteParaPlayer } from '../../contratos/midia';

function semNiveis(desanexar: () => void): MidiaAnexada {
  return { desanexar, niveis: [], definirNivel: () => {}, nivelAtual: () => -1 };
}

export async function anexarFonte(
  video: HTMLVideoElement,
  fonte: FonteParaPlayer,
  aoDescobrirNiveis: (niveis: NivelDeQualidade[]) => void = () => {}
): Promise<MidiaAnexada> {
  if (ehPlaylist(fonte)) {
    return anexarPlaylist(video, fonte.playlist ?? fonte.url, aoDescobrirNiveis);
  }

  video.src = fonte.url;
  return semNiveis(() => {
    video.removeAttribute('src');
    video.load();
  });
}
