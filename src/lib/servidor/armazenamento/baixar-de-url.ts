// Arquivo: src/lib/servidor/armazenamento/baixar-de-url.ts
// Traz um vídeo de um link para dentro do projeto, quando a origem não serve para tocar
// direto (formato que o navegador não abre, por exemplo) e o jeito é converter aqui.
//
// Este NÃO é mais o único caminho para "usar um link". Link de arquivo compatível,
// playlist HLS e página de YouTube ou Vimeo viram fonte reproduzida na origem, sem cópia
// nenhuma — quem decide isso é o `verificar-fonte.ts`. Baixar ficou reservado ao caso em
// que baixar é mesmo necessário.
//
// Quem abre a conexão é o SERVIDOR, então toda a proteção contra SSRF continua valendo:
// esquema conferido, IP resolvido e fixado, cada redirecionamento revalidado.

import { extname } from 'node:path';
import { abrirFluxoRemoto } from '../midia/fontes/fluxo-remoto.js';
import { ErroDeFonte } from '../midia/fontes/conexao-segura.js';
import { extensaoAceita, gravarFluxo, limiteDeUploadBytes } from './gravar-upload.js';

export class ErroDeDownload extends Error {}

const EXTENSAO_POR_TIPO: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv'
};

/** Nome de arquivo do link, para decidir a extensão. */
export function nomeDoLink(url: URL): string {
  const ultimo = url.pathname.split('/').filter(Boolean).pop() ?? '';
  return decodeURIComponent(ultimo);
}

/**
 * Escolhe a extensão de gravação. Um endereço assinado costuma não ter extensão nenhuma,
 * e recusar por isso reprovaria vídeo perfeitamente válido — então o content-type entra
 * como segunda opinião antes de desistir.
 */
export function extensaoDeGravacao(url: URL, tipoConteudo: string): string | null {
  const nome = nomeDoLink(url);
  if (extensaoAceita(nome)) return extname(nome).toLowerCase();
  return EXTENSAO_POR_TIPO[tipoConteudo] ?? null;
}

export interface PedidoDeDownload {
  episodioId: string;
  url: string;
}

export async function baixarParaEpisodio(pedido: PedidoDeDownload) {
  let remoto;
  try {
    remoto = await abrirFluxoRemoto(pedido.url, { tetoBytes: limiteDeUploadBytes() });
  } catch (erro) {
    throw new ErroDeDownload(
      erro instanceof ErroDeFonte || erro instanceof Error
        ? erro.message
        : 'Não consegui baixar esse link.'
    );
  }

  const extensao = extensaoDeGravacao(remoto.urlFinal, remoto.tipoConteudo);
  if (!extensao) {
    remoto.fluxo.destroy();
    throw new ErroDeDownload(
      'Não consegui identificar o formato do arquivo desse link. Envie o arquivo do computador.'
    );
  }

  try {
    return await gravarFluxo({
      episodioId: pedido.episodioId,
      nome: `do-link${extensao}`,
      fluxo: remoto.fluxo
    });
  } catch (erro) {
    throw new ErroDeDownload(
      erro instanceof Error ? erro.message : 'O download foi interrompido antes de terminar.'
    );
  }
}
