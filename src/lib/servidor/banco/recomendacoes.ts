// Arquivo: src/lib/servidor/banco/recomendacoes.ts
// Trilhas "Porque voce viu X": o que o historico ja acumulava e ninguem lia.
//
// Nao vive em /api/catalogo de proposito. Aquela resposta e `public, max-age=300` e o
// service worker a guarda em cache compartilhado; trilha pessoal ali sairia para o
// proximo visitante do mesmo navegador.

import { banco } from './cliente.js';
import { contarAudienciaDeVariosTitulos } from './audiencia.js';
import { INCLUSAO_DE_CARTAO, paraCartao, type TituloBruto } from './mapear-titulo.js';
import {
  MAXIMO_DE_TRILHAS,
  MINIMO_POR_TRILHA,
  primeirosUnicos,
  selecionarSemRepetir
} from '../recomendacoes/selecao-pessoal.js';
import type { TrilhaDeConteudo } from './tipos-catalogo.js';

/** Quantos registros de historico olhar pra tras. Cada 15s de exibicao grava um. */
const HISTORICO_CONSIDERADO = 120;
const ITENS_POR_TRILHA = 12;

interface TituloDoHistorico {
  id: string;
  slug: string;
  nome: string;
  generoIds: string[];
  generoSlug: string | null;
}

async function titulosDoHistorico(usuarioId: string): Promise<TituloDoHistorico[]> {
  const registros = await banco.historico.findMany({
    where: { usuarioId },
    orderBy: { vistoEm: 'desc' },
    take: HISTORICO_CONSIDERADO,
    select: {
      episodio: {
        select: {
          temporada: {
            select: {
              titulo: {
                select: {
                  id: true,
                  slug: true,
                  nome: true,
                  generos: { select: { generoId: true, genero: { select: { slug: true } } } }
                }
              }
            }
          }
        }
      }
    }
  });

  return registros.map(({ episodio }) => {
    const titulo = episodio.temporada.titulo;
    return {
      id: titulo.id,
      slug: titulo.slug,
      nome: titulo.nome,
      generoIds: titulo.generos.map((ligacao) => ligacao.generoId),
      generoSlug: titulo.generos[0]?.genero.slug ?? null
    };
  });
}

async function candidatosParecidos(base: TituloDoHistorico, excluir: string[]) {
  if (base.generoIds.length === 0) return [];

  return (await banco.titulo.findMany({
    where: {
      situacao: 'PUBLICADO',
      id: { notIn: excluir },
      generos: { some: { generoId: { in: base.generoIds } } }
    },
    // Buscamos alem do necessario porque a trilha seguinte descarta o que a anterior levou.
    orderBy: { popularidade: 'desc' },
    take: ITENS_POR_TRILHA * (MAXIMO_DE_TRILHAS + 1),
    include: INCLUSAO_DE_CARTAO
  })) as unknown as TituloBruto[];
}

/**
 * Trilhas personalizadas para quem tem historico. Devolve lista vazia — nunca uma
 * trilha pela metade — quando nao ha material: bloco vazio na home e pior que bloco
 * nenhum.
 */
export async function trilhasPessoais(usuarioId: string): Promise<TrilhaDeConteudo[]> {
  const vistos = await titulosDoHistorico(usuarioId);
  if (vistos.length === 0) return [];

  const idsVistos = [...new Set(vistos.map((titulo) => titulo.id))];
  const bases = primeirosUnicos(vistos, (titulo) => titulo.id, MAXIMO_DE_TRILHAS);

  const jaUsados = new Set<string>();
  const rascunhos: { base: TituloDoHistorico; itens: TituloBruto[] }[] = [];

  for (const base of bases) {
    const candidatos = await candidatosParecidos(base, idsVistos);
    const itens = selecionarSemRepetir(
      candidatos,
      (candidato) => candidato.id,
      jaUsados,
      ITENS_POR_TRILHA
    );
    if (itens.length >= MINIMO_POR_TRILHA) rascunhos.push({ base, itens });
  }

  if (rascunhos.length === 0) return [];

  // Uma consulta de audiencia para todas as trilhas: N+1 aqui multiplicaria por trilha.
  const audiencia = await contarAudienciaDeVariosTitulos(
    rascunhos.flatMap((rascunho) => rascunho.itens.map((item) => item.id))
  );

  return rascunhos.map(({ base, itens }) => ({
    chave: `porque-viu-${base.slug}`,
    titulo: `Porque você viu ${base.nome}`,
    verMaisUrl: base.generoSlug ? `/catalogo?genero=${base.generoSlug}` : '/catalogo',
    itens: itens.map((item) => paraCartao(item, audiencia.get(item.id) ?? 0))
  }));
}
