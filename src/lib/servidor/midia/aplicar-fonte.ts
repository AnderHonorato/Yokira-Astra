// Arquivo: src/lib/servidor/midia/aplicar-fonte.ts
// O caminho único de "este episódio passa a ter vídeo". O envio avulso e o cadastro em
// lote entram aqui, então as duas telas tratam link e arquivo exatamente do mesmo jeito.
//
// A regra que manda: link que a origem já sabe servir NÃO é baixado. Só cai no download
// e na conversão o que o navegador não tocaria — e mesmo aí a fonte antiga continua no
// ar até a nova ficar pronta.

import { verificarFonte } from './fontes/verificar-fonte.js';
import { baixarParaEpisodio } from '../armazenamento/baixar-de-url.js';
import { gravarFluxo } from '../armazenamento/gravar-upload.js';
import { registrarFonteLocal, registrarFonteRemota } from '../banco/fontes-midia.js';
import { enfileirarProcessamento } from '../processamento/fila.js';
import type { Readable } from 'node:stream';

export class ErroDeFonteAplicada extends Error {}

export interface FonteAplicada {
  fonteId: string;
  /** Já dá para assistir, ou ainda vai passar pela conversão. */
  pronta: boolean;
  mensagem: string;
}

export async function aplicarLinkNoEpisodio(
  episodioId: string,
  url: string,
  token: string
): Promise<FonteAplicada> {
  // Verificado de novo aqui de propósito: o que o painel mostrou pode ter sido de outra
  // URL, ou o endereço pode ter saído do ar entre a conferência e o salvar.
  const verificacao = await verificarFonte(url, token);

  if (verificacao.estado === 'COMPATIVEL') {
    const fonteId = await registrarFonteRemota({ episodioId, verificacao, token });
    return { fonteId, pronta: true, mensagem: 'Vídeo no ar. Ele toca direto da origem.' };
  }

  if (verificacao.estado === 'PRECISA_PROCESSAR') {
    const arquivo = await baixarParaEpisodio({ episodioId, url });
    const fonteId = await registrarFonteLocal(episodioId, arquivo.id, token);
    await enfileirarProcessamento(arquivo.id);
    return {
      fonteId,
      pronta: false,
      mensagem: 'Arquivo trazido do link. A conversão começou e leva alguns minutos.'
    };
  }

  throw new ErroDeFonteAplicada(
    verificacao.saida ? `${verificacao.mensagem} ${verificacao.saida}` : verificacao.mensagem
  );
}

export interface PedidoDeArquivo {
  episodioId: string;
  nome: string;
  fluxo: ReadableStream<Uint8Array> | Readable;
  token: string;
}

export async function aplicarArquivoNoEpisodio(pedido: PedidoDeArquivo): Promise<FonteAplicada> {
  const arquivo = await gravarFluxo({
    episodioId: pedido.episodioId,
    nome: pedido.nome,
    fluxo: pedido.fluxo
  });
  const fonteId = await registrarFonteLocal(pedido.episodioId, arquivo.id, pedido.token);
  await enfileirarProcessamento(arquivo.id);
  return {
    fonteId,
    pronta: false,
    mensagem: 'Arquivo recebido. A conversão começou e leva alguns minutos.'
  };
}
