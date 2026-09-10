// Arquivo: src/lib/servidor/banco/catalogo.ts
// Consultas do catalogo publico. Uma funcao por trilha da home pra cada uma poder
// mudar de criterio sem mexer nas outras.

import { banco } from './cliente.js';
import { INCLUSAO_DE_CARTAO, paraCartao, paraDestaque, type TituloBruto } from './mapear-titulo.js';
import { contarAudienciaDeVariosTitulos } from './audiencia.js';
import { titulosEmAlta } from './em-alta.js';
import { faixaVisivel } from './faixas-promocionais.js';
import type { CatalogoPublico, TrilhaDeConteudo } from './tipos-catalogo.js';

// Versao 2: os cartoes passaram a trazer visualizacoes e curtidas, e a fileira "em alta"
// mudou de criterio. O numero e o que invalida o cache no IndexedDB de quem ja tem a
// versao antiga guardada — sem subir aqui, a home antiga continuaria sendo pintada.
export const VERSAO_DO_CATALOGO = 2;

async function buscar(where: object, ordem: object, limite = 14): Promise<TituloBruto[]> {
  return banco.titulo.findMany({
    where: { situacao: 'PUBLICADO', ...where },
    orderBy: ordem,
    take: limite,
    include: INCLUSAO_DE_CARTAO
  }) as unknown as Promise<TituloBruto[]>;
}

async function montarTrilha(
  chave: string,
  titulo: string,
  verMaisUrl: string,
  brutos: TituloBruto[]
): Promise<TrilhaDeConteudo> {
  const audiencia = await contarAudienciaDeVariosTitulos(brutos.map((t) => t.id));
  return {
    chave,
    titulo,
    verMaisUrl,
    itens: brutos.map((bruto) => paraCartao(bruto, audiencia.get(bruto.id) ?? 0))
  };
}

/**
 * A fileira de "em alta" sai da audiência real, com peso caindo por idade — o mesmo
 * princípio que os serviços de streaming usam. A versão anterior ordenava por uma marca
 * `emAlta` escrita à mão e pela data de atualização do cadastro: o que subisse uma vez
 * ficava lá até alguém desmarcar, que é justamente o defeito de uma fileira que se
 * anuncia como "agora".
 *
 * Quando ainda não há audiência acumulada — instalação nova — cai para a marca manual,
 * porque uma fileira vazia na primeira dobra é pior do que uma fileira curada.
 */
async function trilhaEmAlta(): Promise<TrilhaDeConteudo> {
  const { cartoes } = await titulosEmAlta(14);
  if (cartoes.length >= 4) {
    return {
      chave: 'em-alta',
      titulo: 'Em alta agora',
      verMaisUrl: '/catalogo?ordem=em-alta',
      itens: cartoes
    };
  }

  const curados = await buscar({ emAlta: true }, { atualizadoEm: 'desc' });
  return montarTrilha('em-alta', 'Em alta agora', '/catalogo?ordem=em-alta', curados);
}

export async function montarCatalogoPublico(): Promise<CatalogoPublico> {
  const [destaques, populares, novidades, emAlta, faixa] = await Promise.all([
    buscar({ destaque: true }, { popularidade: 'desc' }, 5),
    buscar({}, { popularidade: 'desc' }),
    buscar({ novidade: true }, { atualizadoEm: 'desc' }),
    trilhaEmAlta(),
    faixaVisivel('home')
  ]);

  const restantes = await Promise.all([
    montarTrilha('populares', 'Populares', '/catalogo?ordem=populares', populares),
    montarTrilha('novidades', 'Novidades', '/novidades', novidades)
  ]);

  return {
    destaques: destaques.map(paraDestaque),
    faixa: faixa
      ? {
          titulo: faixa.titulo,
          texto: faixa.texto,
          rotuloBotao: faixa.rotuloBotao,
          destino: faixa.destino,
          corInicial: faixa.corInicial,
          corFinal: faixa.corFinal
        }
      : null,
    // "Em alta agora" vem primeiro, logo abaixo do banner: é a fileira que muda com o
    // movimento das pessoas, e é ela que justifica voltar à home.
    trilhas: [emAlta, ...restantes],
    geradoEm: new Date().toISOString(),
    versao: VERSAO_DO_CATALOGO
  };
}

export async function listarCatalogoCompleto(genero?: string) {
  const brutos = await buscar(
    genero ? { generos: { some: { genero: { slug: genero } } } } : {},
    { nome: 'asc' },
    120
  );
  const audiencia = await contarAudienciaDeVariosTitulos(brutos.map((t) => t.id));
  return brutos.map((bruto) => paraCartao(bruto, audiencia.get(bruto.id) ?? 0));
}

export async function listarGeneros() {
  return banco.genero.findMany({ orderBy: { nome: 'asc' } });
}
