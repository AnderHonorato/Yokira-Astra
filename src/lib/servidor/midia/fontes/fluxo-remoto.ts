// Arquivo: src/lib/servidor/midia/fontes/fluxo-remoto.ts
// Abre o arquivo remoto inteiro, para o caso em que a origem não serve para tocar direto
// e o vídeo precisa vir para cá e ser convertido. Segue os redirecionamentos à mão,
// revalidando cada salto, e entrega um fluxo — nunca um Buffer.
//
// O teto de bytes não mora aqui: quem grava é que corta, porque é lá que se sabe quanto
// já foi para o disco. Aqui a única guarda de tamanho é recusar de cara um
// `content-length` que já anuncia estouro, para não abrir uma conexão inútil.

import { normalizarCabecalhos, pedirComIpFixado, ErroDeFonte } from './conexao-segura.js';
import { lerEndereco, MAXIMO_DE_SALTOS } from './sondar-url.js';
import type { Readable } from 'node:stream';

export interface FluxoRemoto {
  fluxo: Readable;
  urlFinal: URL;
  tamanhoAnunciado: number | null;
  tipoConteudo: string;
}

export interface OpcoesFluxo {
  tempoLimiteMs?: number;
  saltosMax?: number;
  tetoBytes?: number;
}

export async function abrirFluxoRemoto(
  bruto: string,
  opcoes: OpcoesFluxo = {}
): Promise<FluxoRemoto> {
  const saltosMax = opcoes.saltosMax ?? MAXIMO_DE_SALTOS;
  let url = lerEndereco(bruto);

  for (let salto = 0; salto <= saltosMax; salto += 1) {
    const resposta = await pedirComIpFixado(url, { tempoLimiteMs: opcoes.tempoLimiteMs });
    const cabecalhos = normalizarCabecalhos(resposta.headers);
    const status = resposta.statusCode ?? 0;

    if (status >= 300 && status < 400) {
      resposta.destroy();
      const destino = cabecalhos.location;
      if (!destino) throw new ErroDeFonte('O endereço redireciona para lugar nenhum.', 'RESPOSTA');
      url = lerEndereco(new URL(destino, url).toString());
      continue;
    }

    if (status < 200 || status >= 300) {
      resposta.destroy();
      throw new ErroDeFonte(`O endereço respondeu ${status} e não entregou o arquivo.`, 'RESPOSTA');
    }

    const anunciado = Number(cabecalhos['content-length'] ?? '');
    const tamanhoAnunciado = Number.isFinite(anunciado) && anunciado >= 0 ? anunciado : null;
    if (opcoes.tetoBytes && tamanhoAnunciado !== null && tamanhoAnunciado > opcoes.tetoBytes) {
      resposta.destroy();
      throw new ErroDeFonte('O arquivo desse link passa do limite de tamanho.', 'TAMANHO');
    }

    return {
      fluxo: resposta,
      urlFinal: url,
      tamanhoAnunciado,
      tipoConteudo: (cabecalhos['content-type'] ?? '').split(';')[0].trim().toLowerCase()
    };
  }

  throw new ErroDeFonte('Esse endereço redireciona vezes demais.', 'ENDERECO');
}
