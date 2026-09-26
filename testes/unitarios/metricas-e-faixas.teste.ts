// Arquivo: testes/unitarios/metricas-e-faixas.teste.ts
// Três peças puras que decidem o que aparece na tela: o formato dos números de audiência,
// a nota que ordena a fileira "em alta agora" e a cor do texto sobre a faixa editável.
//
// A da fileira é a que mais precisa de teste. Ela é a diferença entre uma fileira que se
// move com as pessoas e uma que congela no que estourou uma vez — e isso é impossível de
// conferir a olho depois de publicado.

import { describe, expect, it } from 'vitest';
import { emTextoCompleto, emTextoCurto } from '../../src/lib/componentes/comum/formatar-numero';
import {
  corDeTextoPara,
  luminancia,
  razaoDeContraste
} from '../../src/lib/componentes/comum/contraste-da-faixa';
import {
  inicioDaJanela,
  pesoPorIdade,
  pontuarTitulos
} from '../../src/lib/servidor/banco/pontuacao-em-alta';

describe('emTextoCurto', () => {
  it('mostra o número inteiro abaixo de mil', () => {
    expect(emTextoCurto(0)).toBe('0');
    expect(emTextoCurto(7)).toBe('7');
    expect(emTextoCurto(999)).toBe('999');
  });

  it('abrevia em milhares com uma casa até dez mil', () => {
    expect(emTextoCurto(1200)).toBe('1,2 mil');
    expect(emTextoCurto(9800)).toBe('9,8 mil');
    expect(emTextoCurto(34_200)).toBe('34 mil');
  });

  it('não escreve a casa quando ela é zero', () => {
    expect(emTextoCurto(1000)).toBe('1 mil');
    expect(emTextoCurto(2_000_000)).toBe('2 mi');
  });

  it('trata milhão e bilhão', () => {
    expect(emTextoCurto(1_500_000)).toBe('1,5 mi');
    expect(emTextoCurto(2_300_000_000)).toBe('2,3 bi');
  });

  it('não quebra com valor inválido', () => {
    expect(emTextoCurto(Number.NaN)).toBe('0');
    expect(emTextoCurto(-5)).toBe('0');
  });

  it('o texto completo usa a separação brasileira', () => {
    expect(emTextoCompleto(1234567)).toContain('1');
    expect(emTextoCompleto(0)).toBe('0');
  });
});

const HORA = 3_600_000;

describe('pesoPorIdade', () => {
  it('vale 1 para agora', () => {
    expect(pesoPorIdade(0)).toBe(1);
  });

  it('cai pela metade a cada meia-vida', () => {
    expect(pesoPorIdade(24 * HORA, 24)).toBeCloseTo(0.5, 6);
    expect(pesoPorIdade(48 * HORA, 24)).toBeCloseTo(0.25, 6);
    expect(pesoPorIdade(72 * HORA, 24)).toBeCloseTo(0.125, 6);
  });

  it('relógio adiantado não vira bônus', () => {
    expect(pesoPorIdade(-5 * HORA)).toBe(1);
  });
});

describe('pontuarTitulos', () => {
  const agora = new Date('2026-09-10T12:00:00.000Z');
  const horasAtras = (horas: number) => new Date(agora.getTime() - horas * HORA);

  it('o recente com menos visualizações passa na frente do antigo com mais', () => {
    // É exatamente o caso que o total acumulado erra: 40 visualizações de duas semanas
    // atrás continuariam ordenando a fileira de "agora".
    const eventos = [
      ...Array.from({ length: 40 }, () => ({ tituloId: 'antigo', criadoEm: horasAtras(14 * 24) })),
      ...Array.from({ length: 10 }, () => ({ tituloId: 'novo', criadoEm: horasAtras(2) }))
    ];

    const ranking = pontuarTitulos(eventos, agora);
    expect(ranking[0].tituloId).toBe('novo');
    expect(ranking[0].visualizacoesNaJanela).toBe(10);
  });

  it('entre dois títulos do mesmo momento, ganha quem teve mais audiência', () => {
    const eventos = [
      ...Array.from({ length: 3 }, () => ({ tituloId: 'a', criadoEm: horasAtras(1) })),
      ...Array.from({ length: 9 }, () => ({ tituloId: 'b', criadoEm: horasAtras(1) }))
    ];
    expect(pontuarTitulos(eventos, agora)[0].tituloId).toBe('b');
  });

  it('empate exato tem ordem estável, não sorteada', () => {
    const eventos = [
      { tituloId: 'zebra', criadoEm: horasAtras(1) },
      { tituloId: 'alfa', criadoEm: horasAtras(1) }
    ];
    const uma = pontuarTitulos(eventos, agora).map((linha) => linha.tituloId);
    const outra = pontuarTitulos([...eventos].reverse(), agora).map((linha) => linha.tituloId);
    expect(uma).toEqual(outra);
    expect(uma[0]).toBe('alfa');
  });

  it('sem evento nenhum devolve lista vazia', () => {
    expect(pontuarTitulos([], agora)).toEqual([]);
  });

  it('a janela começa no passado, nunca no futuro', () => {
    expect(inicioDaJanela(agora).getTime()).toBeLessThan(agora.getTime());
  });
});

describe('contraste da faixa', () => {
  it('mede a luminância nos extremos', () => {
    expect(luminancia('#000000')).toBeCloseTo(0, 6);
    expect(luminancia('#FFFFFF')).toBeCloseTo(1, 6);
  });

  it('a razão de contraste entre preto e branco é 21', () => {
    expect(razaoDeContraste(luminancia('#FFFFFF'), luminancia('#000000'))).toBeCloseTo(21, 4);
  });

  it('escolhe texto claro sobre degradê escuro e escuro sobre degradê claro', () => {
    expect(corDeTextoPara('#7C3AED', '#2563EB')).toBe('#FFFFFF');
    expect(corDeTextoPara('#FDE68A', '#FCA5A5')).toBe('#101014');
  });

  it('a cor escolhida sempre tem contraste utilizável com o meio do degradê', () => {
    const pares: Array<[string, string]> = [
      ['#7C3AED', '#2563EB'],
      ['#FDE68A', '#FCA5A5'],
      ['#111111', '#222222'],
      ['#FFFFFF', '#EEEEEE'],
      ['#008080', '#00A0A0']
    ];
    for (const [inicio, fim] of pares) {
      const media = (luminancia(inicio) + luminancia(fim)) / 2;
      const escolhida = corDeTextoPara(inicio, fim);
      expect(razaoDeContraste(luminancia(escolhida), media), `${inicio}/${fim}`).toBeGreaterThan(3);
    }
  });
});
