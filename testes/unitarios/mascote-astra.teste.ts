import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';

import { ACOES_ASTRA, RESPOSTA_ASTRA } from '../../src/lib/componentes/home/mascote-astra';

describe('Mascote Astra integrado à home', () => {
  it('leva apenas a páginas que existem no Yokira Astra', () => {
    expect(ACOES_ASTRA).toEqual([
      { rotulo: 'Explorar o acervo', href: '/catalogo' },
      { rotulo: 'Buscar um anime', href: '/buscar' }
    ]);
    for (const acao of ACOES_ASTRA) {
      expect(acao.href.startsWith('/')).toBe(true);
      expect(acao.href.startsWith('//')).toBe(false);
    }
  });

  it('fornece uma saudação clara e sem falsa funcionalidade de IA', () => {
    expect(RESPOSTA_ASTRA).toMatch(/próxima história/);
  });

  it('usa um arquivo real WebP pequeno, não depende do outro repositório', () => {
    const img = new URL('../../static/mascotes/astra.webp', import.meta.url);
    const dados = readFileSync(img);
    expect(dados.subarray(0, 4).toString()).toBe('RIFF');
    expect(dados.subarray(8, 12).toString()).toBe('WEBP');
    expect(statSync(img).size).toBeLessThan(50_000);
  });

  it('preserva o layout responsivo, foco e movimento reduzido', () => {
    const css = readFileSync(
      new URL('../../src/lib/componentes/home/mascote-astra.css', import.meta.url),
      'utf8'
    );
    const componente = readFileSync(
      new URL('../../src/lib/componentes/home/mascote-astra.svelte', import.meta.url),
      'utf8'
    );
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).not.toContain('position: fixed');
    expect(componente).toContain('aria-expanded');
    expect(componente).toContain('aria-controls');
    expect(componente).toContain('href={acao.href}');
  });
});
