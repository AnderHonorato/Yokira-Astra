// Arquivo: src/lib/servidor/banco/fontes-para-espectador.ts
// A lista de origens que o espectador pode escolher. É diferente da lista do painel de
// propósito: aqui não sai endereço nenhum, nem o nome do servidor de origem. O que o
// espectador precisa saber é "existem três opções e esta é a que está tocando" — o
// endereço só é montado depois, quando ele escolhe, e sempre com a sessão dele.
//
// Fonte que ainda está convertendo não entra: oferecer um botão que abre num erro é pior
// do que não oferecer botão nenhum.

import { banco } from './cliente.js';
import { nomeDoProvedor } from '../midia/fontes/provedores.js';
import type { TipoFonteMidia } from '../../contratos/midia.js';

export interface OpcaoDeFonte {
  id: string;
  tipo: TipoFonteMidia;
  rotulo: string;
  /** Verdadeiro na que está no ar por padrão. */
  padrao: boolean;
  /** Player próprio: só nele valem nossos controles e a retomada exata. */
  nossoPlayer: boolean;
}

function nomeBase(tipo: string): string {
  if (tipo === 'HLS_LOCAL') return 'Yōkira';
  if (tipo === 'YOUTUBE' || tipo === 'VIMEO') return nomeDoProvedor(tipo);
  return 'Servidor';
}

export async function fontesParaEspectador(episodioId: string): Promise<OpcaoDeFonte[]> {
  const fontes = await banco.fonteMidia.findMany({
    where: { episodioId, estado: 'PRONTO' },
    orderBy: [{ ativa: 'desc' }, { criadaEm: 'asc' }],
    select: { id: true, tipo: true, ativa: true }
  });

  // Numera só quando há mais de uma do mesmo tipo. Três botões escritos "Yōkira" lado a
  // lado não dão escolha nenhuma: a pessoa não sabe em que está clicando.
  const quantosDoTipo = new Map<string, number>();
  for (const fonte of fontes) {
    quantosDoTipo.set(fonte.tipo, (quantosDoTipo.get(fonte.tipo) ?? 0) + 1);
  }

  const jaVistos = new Map<string, number>();
  return fontes.map((fonte) => {
    const posicao = (jaVistos.get(fonte.tipo) ?? 0) + 1;
    jaVistos.set(fonte.tipo, posicao);
    const base = nomeBase(fonte.tipo);
    const precisaNumerar = (quantosDoTipo.get(fonte.tipo) ?? 0) > 1 || base === 'Servidor';

    return {
      id: fonte.id,
      tipo: fonte.tipo as TipoFonteMidia,
      rotulo: precisaNumerar ? `${base} ${posicao}` : base,
      padrao: fonte.ativa,
      nossoPlayer: fonte.tipo === 'HLS_LOCAL'
    };
  });
}

/** Confere que a fonte pedida é mesmo deste episódio e está pronta. */
export async function fonteEscolhida(episodioId: string, fonteId: string) {
  return banco.fonteMidia.findFirst({
    where: { id: fonteId, episodioId, estado: 'PRONTO' },
    include: { arquivo: { include: { variantes: { select: { id: true } } } } }
  });
}
