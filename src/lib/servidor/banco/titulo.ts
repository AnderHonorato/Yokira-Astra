// Arquivo: src/lib/servidor/banco/titulo.ts
// Pagina de detalhes: titulo + temporadas + episodios + trailers + recomendacoes.

import { banco } from './cliente.js';
import { jaEstreou } from './estreia.js';
import {
  calcularNota,
  INCLUSAO_DE_CARTAO,
  paraCartao,
  paraDestaque,
  type TituloBruto
} from './mapear-titulo.js';
import { posterEmDataUri } from '../../visual/posters/gerar-poster.js';

export async function detalharTitulo(slug: string) {
  // Episodio agendado nao aparece na lista: ele ainda nao existe pra quem assiste.
  const noAr = jaEstreou();
  const titulo = await banco.titulo.findUnique({
    where: { slug },
    include: {
      ...INCLUSAO_DE_CARTAO,
      temporadas: {
        orderBy: { numero: 'asc' },
        include: {
          episodios: {
            where: noAr,
            orderBy: { numero: 'asc' },
            // Precisa saber se ha video para a lista nao oferecer play em episodio vazio.
            include: {
              fontes: { where: { estado: 'PRONTO' }, select: { id: true } },
              arquivos: { select: { variantes: { select: { id: true } } } }
            }
          }
        }
      }
    }
  });
  if (!titulo) return null;

  const bruto = titulo as unknown as TituloBruto;

  return {
    destaque: paraDestaque(bruto),
    nota: calcularNota(bruto.avaliacoes),
    visualizacoes: titulo.totalVisualizacoes,
    curtidas: titulo.totalCurtidas,
    temporadas: titulo.temporadas.map((temporada) => ({
      id: temporada.id,
      numero: temporada.numero,
      nome: temporada.nome,
      episodios: temporada.episodios.map((episodio) => ({
        id: episodio.id,
        numero: episodio.numero,
        nome: episodio.nome,
        // Zero significa "ninguem preencheu": a lista omite em vez de anunciar "0min".
        duracaoMinutos:
          episodio.duracaoSegundos > 0 ? Math.round(episodio.duracaoSegundos / 60) : 0,
        visualizacoes: episodio.totalVisualizacoes,
        temVideo:
          episodio.fontes.length > 0 ||
          episodio.arquivos.some((arquivo) => arquivo.variantes.length > 0),
        miniatura:
          episodio.miniaturaUrl ??
          posterEmDataUri(`${slug}-${episodio.id}`, `EP ${episodio.numero}`)
      }))
    }))
  };
}

export async function recomendacoesPara(slug: string, limite = 8) {
  const atual = await banco.titulo.findUnique({
    where: { slug },
    select: { id: true, generos: { select: { generoId: true } } }
  });
  if (!atual) return [];

  const brutos = (await banco.titulo.findMany({
    where: {
      situacao: 'PUBLICADO',
      id: { not: atual.id },
      generos: { some: { generoId: { in: atual.generos.map((g) => g.generoId) } } }
    },
    orderBy: { popularidade: 'desc' },
    take: limite,
    include: INCLUSAO_DE_CARTAO
  })) as unknown as TituloBruto[];

  return brutos.map((bruto) => paraCartao(bruto));
}

export async function proximosEpisodios(slug: string, limite = 3) {
  const episodios = await banco.episodio.findMany({
    where: { temporada: { titulo: { slug } }, ...jaEstreou() },
    orderBy: [{ temporada: { numero: 'desc' } }, { numero: 'desc' }],
    take: limite,
    include: { temporada: { select: { numero: true } } }
  });

  return episodios.map((episodio) => ({
    id: episodio.id,
    numero: episodio.numero,
    nome: episodio.nome,
    duracaoMinutos: Math.round(episodio.duracaoSegundos / 60),
    miniatura:
      episodio.miniaturaUrl ??
      posterEmDataUri(`${slug}-mais-${episodio.id}`, `EP ${episodio.numero}`)
  }));
}
