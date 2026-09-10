// Arquivo: src/lib/servidor/recomendacoes/selecao-pessoal.ts
// Escolha de quem vira trilha e do que entra nela. Fica separado do banco porque e
// isto que erra em silencio: trilha repetindo o titulo que a pessoa acabou de ver,
// duas trilhas mostrando os mesmos oito cartoes, ou uma trilha de um item so.

/** Abaixo disso nao e trilha, e uma sobra: o carrossel fica com um buraco do lado. */
export const MINIMO_POR_TRILHA = 4;

/** Quantas trilhas pessoais a home aguenta antes de virar so recomendacao. */
export const MAXIMO_DE_TRILHAS = 2;

/**
 * Primeiros itens distintos, na ordem em que chegaram. O historico vem do mais
 * recente pro mais antigo e repete o mesmo titulo a cada 15s de exibicao, entao sem
 * isto as duas trilhas seriam do mesmo anime.
 */
export function primeirosUnicos<T>(itens: T[], chave: (item: T) => string, limite: number): T[] {
  const vistos = new Set<string>();
  const escolhidos: T[] = [];

  for (const item of itens) {
    if (escolhidos.length >= limite) break;
    const id = chave(item);
    if (vistos.has(id)) continue;
    vistos.add(id);
    escolhidos.push(item);
  }

  return escolhidos;
}

/**
 * Escolhe ate `limite` candidatos que ainda nao apareceram, registrando cada um em
 * `jaUsados`. O conjunto e alterado de proposito: a segunda trilha precisa saber o
 * que a primeira levou, senao as duas mostram os mesmos populares do genero.
 */
export function selecionarSemRepetir<T>(
  candidatos: T[],
  chave: (item: T) => string,
  jaUsados: Set<string>,
  limite: number
): T[] {
  const escolhidos: T[] = [];

  for (const candidato of candidatos) {
    if (escolhidos.length >= limite) break;
    const id = chave(candidato);
    if (jaUsados.has(id)) continue;
    jaUsados.add(id);
    escolhidos.push(candidato);
  }

  return escolhidos;
}
