// Arquivo: src/lib/componentes/player/carregar-hls.ts
// hls.js so entra por import dinamico e so quando o navegador nao toca HLS nativo.
// No Safari o suporte e nativo — carregar a biblioteca la seria ~150kB jogados fora.

export interface NivelDeQualidade {
  indice: number;
  altura: number;
  rotulo: string;
}

export interface MidiaAnexada {
  desanexar: () => void;
  /**
   * Niveis da playlist mestre. Vem vazio no HLS nativo: o Safari escolhe a qualidade
   * sozinho e nao expoe a lista, entao prometer um seletor la seria mentira.
   */
  niveis: NivelDeQualidade[];
  /** -1 devolve o controle pro automatico. */
  definirNivel: (indice: number) => void;
  nivelAtual: () => number;
}

export function suportaHlsNativo(video: HTMLVideoElement): boolean {
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

/** Sem niveis pra oferecer: o proprio navegador esta no comando da qualidade. */
function semSeletor(desanexar: () => void): MidiaAnexada {
  return { desanexar, niveis: [], definirNivel: () => {}, nivelAtual: () => -1 };
}

export async function anexarPlaylist(
  video: HTMLVideoElement,
  playlist: string,
  aoDescobrirNiveis: (niveis: NivelDeQualidade[]) => void = () => {}
): Promise<MidiaAnexada> {
  if (suportaHlsNativo(video)) {
    video.src = playlist;
    return semSeletor(() => video.removeAttribute('src'));
  }

  const { default: Hls } = await import('hls.js');
  if (!Hls.isSupported()) {
    video.src = playlist;
    return semSeletor(() => video.removeAttribute('src'));
  }

  // Buffer generoso de propósito. Com os 30 s antigos, uma variação de rede no meio de
  // um episódio de 23 min travava a imagem: o player consumia o pouco que tinha à frente
  // antes de o próximo trecho chegar. `startFragPrefetch` ainda busca o primeiro trecho
  // antes do play, então apertar o play já encontra vídeo pronto em vez de rodinha.
  const instancia = new Hls({
    maxBufferLength: 60,
    maxMaxBufferLength: 300,
    backBufferLength: 30,
    startFragPrefetch: true
  });
  instancia.loadSource(playlist);
  instancia.attachMedia(video);

  // A lista so existe depois que a playlist mestre chega, entao ela e avisada por
  // callback. Um CustomEvent no <video> tambem funcionaria, mas o Svelte nao tipa
  // evento inventado em elemento nativo e o typecheck reclamaria com razao.
  const niveis: NivelDeQualidade[] = [];
  instancia.on(Hls.Events.MANIFEST_PARSED, () => {
    niveis.length = 0;
    // Da maior pra menor: quem abre o menu quer a melhor qualidade no topo.
    instancia.levels
      .map((nivel, indice) => ({ indice, altura: nivel.height ?? 0, rotulo: `${nivel.height}p` }))
      .sort((a, b) => b.altura - a.altura)
      .forEach((nivel) => niveis.push(nivel));
    aoDescobrirNiveis([...niveis]);
  });

  return {
    desanexar: () => instancia.destroy(),
    niveis,
    definirNivel: (indice) => {
      instancia.currentLevel = indice;
    },
    nivelAtual: () => instancia.currentLevel
  };
}
