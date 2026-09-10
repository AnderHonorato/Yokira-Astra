// Arquivo: src/lib/servidor/banco/mapear-titulo.ts
// Traducao Prisma -> formato da interface. Isolado pra ser testavel sem tocar no banco.

import { arteLargaEmDataUri, posterEmDataUri } from '../../visual/posters/gerar-poster.js';
import type { CartaoDeTitulo, DestaqueDoHero } from './tipos-catalogo.js';

export interface TituloBruto {
  id: string;
  slug: string;
  nome: string;
  sinopse: string;
  ano: number;
  classificacao: string;
  novidade: boolean;
  posterUrl: string | null;
  arteHeroUrl: string | null;
  tipo: string;
  totalVisualizacoes: number;
  totalCurtidas: number;
  temporadas: { numero: number }[];
  generos: { genero: { nome: string } }[];
  avaliacoes: { nota: number }[];
}

/**
 * O que toda consulta de cartao precisa trazer junto. Estava copiado em tres modulos;
 * na terceira copia virou risco de as trilhas divergirem sem ninguem perceber.
 */
export const INCLUSAO_DE_CARTAO = {
  temporadas: { select: { numero: true } },
  generos: { select: { genero: { select: { nome: true } } } },
  avaliacoes: { select: { nota: true } }
} as const;

/** Media real das avaliacoes, uma casa decimal. Sem avaliacao devolve null (nao zero). */
export function calcularNota(avaliacoes: { nota: number }[]): number | null {
  if (avaliacoes.length === 0) return null;
  const soma = avaliacoes.reduce((total, item) => total + item.nota, 0);
  return Math.round((soma / avaliacoes.length) * 10) / 10;
}

/**
 * Segunda linha do cartao. Antes era "Legendas Br" fixo em todo titulo sem novidade —
 * uma promessa que o cadastro nao sustentava, ja que nao ha uma unica legenda no sistema.
 * Agora diz o que o proprio catalogo sabe: quantas temporadas, ou que e filme.
 */
function rotuloDoCartao(bruto: TituloBruto, temporadas: number, ultimaTemporada: number): string {
  if (bruto.tipo === 'FILME') return 'Filme';
  if (bruto.novidade) return `${ultimaTemporada}ª Temporada`;
  if (temporadas > 1) return `${temporadas} temporadas`;
  return '1 temporada';
}

export function paraCartao(bruto: TituloBruto, assistindoAgora = 0): CartaoDeTitulo {
  const temporadas = bruto.temporadas.length;
  const ultimaTemporada = temporadas > 0 ? Math.max(...bruto.temporadas.map((t) => t.numero)) : 1;

  return {
    id: bruto.id,
    slug: bruto.slug,
    nome: bruto.nome,
    ano: bruto.ano,
    nota: calcularNota(bruto.avaliacoes),
    poster: bruto.posterUrl ?? posterEmDataUri(bruto.slug, bruto.nome),
    classificacao: bruto.classificacao,
    novidade: bruto.novidade,
    temporadas,
    ehFilme: bruto.tipo === 'FILME',
    rotuloSecundario: rotuloDoCartao(bruto, temporadas, ultimaTemporada),
    visualizacoes: bruto.totalVisualizacoes,
    curtidas: bruto.totalCurtidas,
    assistindoAgora,
    sinopseCurta: bruto.sinopse.slice(0, 160)
  };
}

export function paraDestaque(bruto: TituloBruto): DestaqueDoHero {
  return {
    id: bruto.id,
    slug: bruto.slug,
    nome: bruto.nome,
    sinopse: bruto.sinopse,
    ano: bruto.ano,
    classificacao: bruto.classificacao,
    generos: bruto.generos.map((ligacao) => ligacao.genero.nome),
    temporadas: bruto.temporadas.length,
    ehFilme: bruto.tipo === 'FILME',
    // Deitada: o hero agora e a arte cobrindo o painel inteiro, nao um retrato ao lado.
    arte: bruto.arteHeroUrl ?? arteLargaEmDataUri(`${bruto.slug}-hero`, bruto.nome),
    novidade: bruto.novidade,
    chamadaGratuita: 'Versão de período de 30 dias gratuito'
  };
}
