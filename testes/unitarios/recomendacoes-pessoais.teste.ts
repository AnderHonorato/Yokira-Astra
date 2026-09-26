// Arquivo: testes/unitarios/recomendacoes-pessoais.teste.ts
// A escolha das trilhas pessoais. Sao tres modos de errar em silencio: duas trilhas
// do mesmo anime, duas trilhas com os mesmos cartoes, e a pessoal empurrando
// "Populares" pra fora da primeira tela.

import { describe, expect, it } from 'vitest';
import {
  MAXIMO_DE_TRILHAS,
  primeirosUnicos,
  selecionarSemRepetir
} from '../../src/lib/servidor/recomendacoes/selecao-pessoal';
import { intercalarTrilhas } from '../../src/lib/componentes/home/ordem-das-trilhas';
import type { TrilhaDeConteudo } from '../../src/lib/servidor/banco/tipos-catalogo';

const chave = (item: { id: string }) => item.id;

function trilha(nome: string): TrilhaDeConteudo {
  return { chave: nome, titulo: nome, verMaisUrl: `/${nome}`, itens: [] };
}

describe('primeirosUnicos', () => {
  it('ignora repeticao e preserva a ordem de chegada', () => {
    // O historico grava a cada 15s de exibicao: um episodio de 24 min vira ~96 linhas
    // do mesmo titulo. Sem deduplicar, as duas trilhas sairiam do mesmo anime.
    const historico = [{ id: 'a' }, { id: 'a' }, { id: 'a' }, { id: 'b' }, { id: 'a' }];

    expect(primeirosUnicos(historico, chave, MAXIMO_DE_TRILHAS)).toEqual([
      { id: 'a' },
      { id: 'b' }
    ]);
  });

  it('respeita o limite mesmo com muitos distintos', () => {
    const historico = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    expect(primeirosUnicos(historico, chave, 2)).toHaveLength(2);
  });

  it('devolve vazio pra historico vazio', () => {
    expect(primeirosUnicos([], chave, 2)).toEqual([]);
  });
});

describe('selecionarSemRepetir', () => {
  it('nao repete o que a trilha anterior levou', () => {
    const jaUsados = new Set<string>();
    const candidatos = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];

    const primeira = selecionarSemRepetir(candidatos, chave, jaUsados, 2);
    const segunda = selecionarSemRepetir(candidatos, chave, jaUsados, 2);

    expect(primeira).toEqual([{ id: 'x' }, { id: 'y' }]);
    expect(segunda).toEqual([{ id: 'z' }]);
    expect(primeira.some((item) => segunda.includes(item))).toBe(false);
  });

  it('devolve vazio quando tudo ja foi usado', () => {
    const jaUsados = new Set(['x']);
    expect(selecionarSemRepetir([{ id: 'x' }], chave, jaUsados, 5)).toEqual([]);
  });
});

describe('intercalarTrilhas', () => {
  it('poe a pessoal depois da primeira geral', () => {
    const gerais = [trilha('populares'), trilha('em-alta'), trilha('novidades')];
    const ordem = intercalarTrilhas(gerais, [trilha('porque-viu-x')]).map((t) => t.chave);

    expect(ordem).toEqual(['populares', 'porque-viu-x', 'em-alta', 'novidades']);
  });

  it('devolve as gerais intactas quando nao ha pessoal', () => {
    const gerais = [trilha('populares'), trilha('em-alta')];
    expect(intercalarTrilhas(gerais, [])).toBe(gerais);
  });

  it('nao perde a pessoal quando nao ha geral nenhuma', () => {
    const pessoais = [trilha('porque-viu-x')];
    expect(intercalarTrilhas([], pessoais)).toEqual(pessoais);
  });
});
