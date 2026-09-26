// Arquivo: src/lib/servidor/banco/em-alta.ts
// A trilha "Em alta agora" da home. Junta as visualizações da janela recente, pontua com
// queda por idade e traz os títulos vencedores já no formato de cartão.
//
// A leitura da janela tem teto. Sem teto, um pico de audiência viraria uma consulta que
// carrega centenas de milhares de linhas para a memória a cada visita à home. Com teto, o
// que acontece no pior caso é a janela ficar mais curta do que os 14 dias — e isso está
// dito no retorno, para ninguém achar que a conta cobriu mais do que cobriu.

import { banco } from './cliente.js';
import { INCLUSAO_DE_CARTAO, paraCartao, type TituloBruto } from './mapear-titulo.js';
import { inicioDaJanela, pontuarTitulos } from './pontuacao-em-alta.js';
import type { CartaoDeTitulo } from './tipos-catalogo.js';

/** Teto de eventos lidos. 60 mil linhas de (id, data) é leitura barata e cabe folgado. */
export const TETO_DE_EVENTOS = 60_000;

export interface TrilhaEmAlta {
  cartoes: CartaoDeTitulo[];
  /** Verdadeiro quando o teto cortou a janela: a nota cobre menos tempo do que o previsto. */
  janelaCortada: boolean;
}

export async function titulosEmAlta(limite = 12, agora: Date = new Date()): Promise<TrilhaEmAlta> {
  const eventos = await banco.visualizacao.findMany({
    where: { criadoEm: { gte: inicioDaJanela(agora) } },
    orderBy: { criadoEm: 'desc' },
    take: TETO_DE_EVENTOS,
    select: { tituloId: true, criadoEm: true }
  });

  if (eventos.length === 0) return { cartoes: [], janelaCortada: false };

  const ranking = pontuarTitulos(eventos, agora).slice(0, limite);
  const ids = ranking.map((linha) => linha.tituloId);

  const titulos = await banco.titulo.findMany({
    where: { id: { in: ids }, situacao: 'PUBLICADO' },
    include: INCLUSAO_DE_CARTAO
  });

  // O banco devolve na ordem dele; a ordem que importa é a do ranking.
  const porId = new Map(titulos.map((titulo) => [titulo.id, titulo]));
  const cartoes = ids
    .map((id) => porId.get(id))
    .filter((titulo): titulo is (typeof titulos)[number] => titulo !== undefined)
    .map((titulo) => paraCartao(titulo as unknown as TituloBruto));

  return { cartoes, janelaCortada: eventos.length >= TETO_DE_EVENTOS };
}
