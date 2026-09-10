// Arquivo: testes/integracao/recomendacoes.teste.ts
// Trilha "Porque voce viu X" contra banco de verdade. O que so aparece aqui: titulo
// ja assistido reaparecendo como recomendacao, e trilha curta demais sendo publicada.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rodarPrisma } from './preparar-banco';

// O modulo de recomendacoes usa a instancia unica de `banco/cliente`, que le a
// DATABASE_URL na importacao. Por isso o import e dinamico e vem depois do env.
let trilhasPessoais: (
  usuarioId: string
) => Promise<{ titulo: string; itens: { slug: string }[] }[]>;
let banco: Awaited<typeof import('../../src/lib/servidor/banco/cliente')>['banco'];

let pasta = '';
let usuarioId = '';

async function criarTitulo(slug: string, generoId: string, popularidade: number) {
  const titulo = await banco.titulo.create({
    data: { slug, nome: slug.toUpperCase(), sinopse: 'Sinopse.', ano: 2024, popularidade }
  });
  await banco.tituloGenero.create({ data: { tituloId: titulo.id, generoId } });
  return titulo;
}

/** Cria temporada + episodio e devolve o id do episodio, que e o que o historico guarda. */
async function criarEpisodio(tituloId: string) {
  const temporada = await banco.temporada.create({
    data: { tituloId, numero: 1, nome: 'Temporada 1' }
  });
  const episodio = await banco.episodio.create({
    data: { temporadaId: temporada.id, numero: 1, nome: 'Piloto', duracaoSegundos: 1380 }
  });
  return episodio.id;
}

beforeAll(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'yokira-recomendacoes-'));
  process.env.DATABASE_URL = `file:${join(pasta, 'teste.db')}`;
  rodarPrisma(['migrate', 'deploy'], process.env.DATABASE_URL);

  ({ banco } = await import('../../src/lib/servidor/banco/cliente'));
  ({ trilhasPessoais } =
    (await import('../../src/lib/servidor/banco/recomendacoes')) as unknown as {
      trilhasPessoais: typeof trilhasPessoais;
    });

  const usuario = await banco.usuario.create({
    data: { email: 'espectador@yokira.local', nome: 'Espectador', senhaHash: 'x' }
  });
  usuarioId = usuario.id;

  const acao = await banco.genero.create({ data: { nome: 'Ação', slug: 'acao' } });
  const comedia = await banco.genero.create({ data: { nome: 'Comédia', slug: 'comedia' } });

  // Base de acao: cinco vizinhos, o suficiente pra virar trilha.
  const assistidoAcao = await criarTitulo('assistido-acao', acao.id, 100);
  for (let indice = 1; indice <= 5; indice += 1) {
    await criarTitulo(`vizinho-acao-${indice}`, acao.id, 90 - indice);
  }

  // Base de comedia: so dois vizinhos, abaixo do minimo de quatro.
  const assistidoComedia = await criarTitulo('assistido-comedia', comedia.id, 100);
  for (let indice = 1; indice <= 2; indice += 1) {
    await criarTitulo(`vizinho-comedia-${indice}`, comedia.id, 90 - indice);
  }

  const episodioAcao = await criarEpisodio(assistidoAcao.id);
  const episodioComedia = await criarEpisodio(assistidoComedia.id);

  // Comedia e o mais recente: se o minimo nao valesse, ele viria como primeira trilha.
  await banco.historico.create({
    data: { usuarioId, episodioId: episodioAcao, vistoEm: new Date('2026-01-01T10:00:00Z') }
  });
  await banco.historico.create({
    data: { usuarioId, episodioId: episodioComedia, vistoEm: new Date('2026-01-02T10:00:00Z') }
  });
}, 120_000);

afterAll(async () => {
  await banco.$disconnect();
  rmSync(pasta, { recursive: true, force: true });
});

describe('trilhas pessoais', () => {
  it('nao inventa trilha pra quem nunca assistiu nada', async () => {
    const outro = await banco.usuario.create({
      data: { email: 'novo@yokira.local', nome: 'Novo', senhaHash: 'x' }
    });
    expect(await trilhasPessoais(outro.id)).toEqual([]);
  });

  it('recomenda pelo genero do que foi visto, sem devolver o que ja foi visto', async () => {
    const trilhas = await trilhasPessoais(usuarioId);

    expect(trilhas).toHaveLength(1);
    expect(trilhas[0].titulo).toBe('Porque você viu ASSISTIDO-ACAO');

    const slugs = trilhas[0].itens.map((item) => item.slug);
    expect(slugs).toHaveLength(5);
    expect(slugs).not.toContain('assistido-acao');
    expect(slugs).not.toContain('assistido-comedia');
    expect(slugs.every((slug) => slug.startsWith('vizinho-acao'))).toBe(true);
  });

  it('descarta a trilha que nao junta o minimo de cartoes', async () => {
    const trilhas = await trilhasPessoais(usuarioId);
    // Comedia foi o ultimo assistido e mesmo assim nao vira trilha: so tem dois vizinhos.
    expect(trilhas.map((trilha) => trilha.titulo)).not.toContain(
      'Porque você viu ASSISTIDO-COMEDIA'
    );
  });
});
