// Arquivo: src/lib/componentes/comum/contraste-da-faixa.ts
// Escolhe texto claro ou escuro para a faixa a partir das cores do degradê. Existe
// porque quem edita a faixa escolhe as cores no painel e não tem como saber que texto
// branco some sobre amarelo — e o resultado disso é uma faixa ilegível no ar até alguém
// reclamar.
//
// A conta é a luminância relativa da WCAG, aplicada ao ponto médio do degradê. Não é o
// mesmo que medir o contraste em cada pixel da faixa, mas erra pouco: o degradê usado
// aqui é linear e curto.

/** Luminância relativa (WCAG 2.1), de 0 (preto) a 1 (branco). */
export function luminancia(hex: string): number {
  const limpo = hex.replace('#', '');
  if (limpo.length !== 6) return 0;

  const canais = [0, 2, 4].map((inicio) => {
    const valor = parseInt(limpo.slice(inicio, inicio + 2), 16) / 255;
    return valor <= 0.03928 ? valor / 12.92 : Math.pow((valor + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

/** Razão de contraste entre duas luminâncias, como a WCAG define. */
export function razaoDeContraste(umaLuminancia: number, outra: number): number {
  const clara = Math.max(umaLuminancia, outra);
  const escura = Math.min(umaLuminancia, outra);
  return (clara + 0.05) / (escura + 0.05);
}

const BRANCO = 1;
const QUASE_PRETO = luminancia('#101014');

/**
 * Cor do texto sobre o degradê. Compara o contraste do branco e do quase preto contra o
 * ponto médio e devolve o que ler melhor — não o que combinar melhor.
 */
export function corDeTextoPara(corInicial: string, corFinal: string): string {
  const media = (luminancia(corInicial) + luminancia(corFinal)) / 2;
  const comBranco = razaoDeContraste(BRANCO, media);
  const comEscuro = razaoDeContraste(QUASE_PRETO, media);
  return comBranco >= comEscuro ? '#FFFFFF' : '#101014';
}
