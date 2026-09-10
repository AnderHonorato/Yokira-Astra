// Arquivo: src/lib/servidor/midia/fontes/amostrar-resposta.ts
// Lê só o começo da resposta e fecha a conexão. É o que permite reconhecer o formato de
// um arquivo de 4 GB sem baixar 4 GB: os primeiros kB já contêm a caixa `ftyp` do MP4, o
// cabeçalho EBML do Matroska ou a primeira linha do m3u8.
//
// O corte é feito no fluxo, não depois: parar de ler é o que impede uma origem hostil de
// entupir a memória do servidor respondendo sem fim a um pedido pequeno.

import { normalizarCabecalhos, pedirComIpFixado, type OpcoesPedido } from './conexao-segura.js';
import { ErroDeFonte } from './conexao-segura.js';

export interface RespostaAberta {
  status: number;
  cabecalhos: Record<string, string>;
  destino: string | null;
  amostra: Buffer;
  truncada: boolean;
}

export interface OpcoesConexao extends OpcoesPedido {
  maximoBytes?: number;
}

export async function abrirConexao(
  url: URL,
  opcoes: OpcoesConexao = {}
): Promise<RespostaAberta> {
  const maximoBytes = opcoes.maximoBytes ?? 0;
  const resposta = await pedirComIpFixado(url, opcoes);
  const cabecalhos = normalizarCabecalhos(resposta.headers);
  const base = {
    status: resposta.statusCode ?? 0,
    cabecalhos,
    destino: cabecalhos.location ?? null
  };

  if (maximoBytes === 0) {
    resposta.destroy();
    return { ...base, amostra: Buffer.alloc(0), truncada: false };
  }

  return new Promise<RespostaAberta>((resolver, rejeitar) => {
    const pedacos: Buffer[] = [];
    let total = 0;
    let encerrado = false;

    const entregar = (truncada: boolean) => {
      if (encerrado) return;
      encerrado = true;
      resolver({ ...base, amostra: Buffer.concat(pedacos), truncada });
    };

    resposta.on('data', (pedaco: Buffer) => {
      if (encerrado) return;
      const faltando = maximoBytes - total;
      pedacos.push(pedaco.subarray(0, faltando));
      total += Math.min(pedaco.length, faltando);
      if (total >= maximoBytes) {
        resposta.destroy();
        entregar(true);
      }
    });
    resposta.on('end', () => entregar(false));
    resposta.on('close', () => entregar(total >= maximoBytes));
    resposta.on('error', () => {
      if (!encerrado) {
        encerrado = true;
        rejeitar(new ErroDeFonte('A conexão caiu no meio da resposta.', 'REDE'));
      }
    });
  });
}
