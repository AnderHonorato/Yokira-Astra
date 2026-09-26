// Arquivo: src/lib/componentes/home/ordem-das-trilhas.ts
// Onde a trilha pessoal entra na home. Separado pra ser testavel: errar aqui e
// empurrar "Populares" pra fora da primeira tela de quem acabou de chegar.

import type { TrilhaDeConteudo } from '$servidor/banco/tipos-catalogo';

/**
 * Pessoal depois da primeira trilha geral, nunca antes: "Populares" e a promessa da
 * home pra quem nao tem historico, e quem tem chega nela do mesmo jeito.
 */
export function intercalarTrilhas(
  gerais: TrilhaDeConteudo[],
  pessoais: TrilhaDeConteudo[]
): TrilhaDeConteudo[] {
  if (pessoais.length === 0) return gerais;
  if (gerais.length === 0) return pessoais;

  return [gerais[0], ...pessoais, ...gerais.slice(1)];
}
