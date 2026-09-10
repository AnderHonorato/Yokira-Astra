// Arquivo: testes/unitarios/nota-e-poster.teste.ts

import { describe, expect, it } from 'vitest';
import { calcularNota, paraCartao } from '../../src/lib/servidor/banco/mapear-titulo';
import { paletaDo, posterEmDataUri, semear } from '../../src/lib/visual/posters/gerar-poster';

describe('calcularNota', () => {
  it('sem avaliacao devolve null, nao zero', () => {
    expect(calcularNota([])).toBeNull();
  });

  it('arredonda pra uma casa decimal', () => {
    expect(calcularNota([{ nota: 8 }, { nota: 9 }, { nota: 9 }])).toBe(8.7);
  });
});

const BRUTO = {
  id: 'a1',
  slug: 'lamina-do-crepusculo',
  nome: 'Lâmina do Crepúsculo',
  sinopse: 'Uma sinopse qualquer para o teste.',
  ano: 2021,
  classificacao: '16',
  novidade: true,
  posterUrl: null,
  arteHeroUrl: null,
  tipo: 'SERIE',
  totalVisualizacoes: 1234,
  totalCurtidas: 56,
  temporadas: [{ numero: 1 }, { numero: 2 }],
  generos: [{ genero: { nome: 'Ação' } }],
  avaliacoes: [{ nota: 9 }]
};

describe('paraCartao', () => {
  it('novidade vira "2ª Temporada" na segunda linha', () => {
    expect(paraCartao(BRUTO).rotuloSecundario).toBe('2ª Temporada');
  });

  /**
   * O rotulo antigo era "Legendas Br" fixo em todo titulo sem novidade. Nao havia — e
   * continua nao havendo — uma unica legenda cadastrada no sistema, entao a segunda linha
   * do cartao anunciava algo que o catalogo nao entrega. Agora ela diz o que e verdade.
   */
  it('titulo comum diz quantas temporadas tem, em vez de prometer legenda', () => {
    expect(paraCartao({ ...BRUTO, novidade: false }).rotuloSecundario).toBe('2 temporadas');
    expect(
      paraCartao({ ...BRUTO, novidade: false, temporadas: [{ numero: 1 }] }).rotuloSecundario
    ).toBe('1 temporada');
  });

  it('filme nao anuncia temporada nenhuma', () => {
    expect(paraCartao({ ...BRUTO, tipo: 'FILME' }).rotuloSecundario).toBe('Filme');
  });

  it('leva visualizacoes e curtidas para o cartao', () => {
    const cartao = paraCartao(BRUTO);
    expect(cartao.visualizacoes).toBe(1234);
    expect(cartao.curtidas).toBe(56);
  });

  it('gera poster proprio quando nao ha arte cadastrada', () => {
    expect(paraCartao(BRUTO).poster.startsWith('data:image/svg+xml')).toBe(true);
  });
});

describe('poster procedural', () => {
  it('e deterministico: o mesmo slug gera sempre o mesmo poster', () => {
    expect(posterEmDataUri('teste', 'Teste')).toBe(posterEmDataUri('teste', 'Teste'));
    expect(semear('a')).not.toBe(semear('b'));
  });

  it('sempre escolhe uma paleta valida', () => {
    expect(paletaDo('qualquer-coisa')).toHaveLength(3);
  });
});
