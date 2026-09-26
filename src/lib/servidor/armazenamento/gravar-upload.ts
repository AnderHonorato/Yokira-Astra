// Arquivo: src/lib/servidor/armazenamento/gravar-upload.ts
// Grava o vídeo fora de static/ (nada de expor o original ao público) e devolve o
// registro no banco. Quem transcodifica lê daqui.
//
// A gravação é em fluxo, não em Buffer. A versão anterior fazia `arrayBuffer()` num
// limite anunciado de 8 GB: o arquivo inteiro passava pela memória do processo antes de
// tocar o disco, e dois envios grandes ao mesmo tempo derrubavam o servidor. Aqui os
// bytes vão para o disco enquanto chegam, e o teto é conferido no caminho — o
// `content-length` é dica, nunca garantia.

import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { banco } from '../banco/cliente.js';
import { reconhecerFormato } from '../midia/fontes/reconhecer.js';

const EXTENSOES_ACEITAS = new Set(['.mp4', '.mkv', '.mov', '.webm']);
const LIMITE_PADRAO_BYTES = 8 * 1024 * 1024 * 1024;

export class ErroDeUpload extends Error {}

/** Teto real de upload. Configurável porque ele depende do disco de quem hospeda. */
export function limiteDeUploadBytes(): number {
  const bruto = Number(process.env.LIMITE_UPLOAD_BYTES ?? '');
  return Number.isFinite(bruto) && bruto > 0 ? bruto : LIMITE_PADRAO_BYTES;
}

export const TAMANHO_MAXIMO_BYTES = LIMITE_PADRAO_BYTES;

export function extensaoAceita(nome: string): boolean {
  return EXTENSOES_ACEITAS.has(extname(nome).toLowerCase());
}

export function pastaDeUploads(): string {
  return process.env.PASTA_UPLOADS ?? './midia/originais';
}

/** Corta o fluxo no teto e guarda o começo para conferir o formato de verdade. */
function contadorComAmostra(teto: number, amostra: Buffer[]) {
  let total = 0;
  return new Transform({
    transform(pedaco: Buffer, _codificacao, seguir) {
      total += pedaco.length;
      if (total > teto) {
        seguir(new ErroDeUpload('O arquivo passou do limite de tamanho.'));
        return;
      }
      if (amostra.length === 0) amostra.push(pedaco.subarray(0, 4096));
      seguir(null, pedaco);
    }
  });
}

export interface PedidoDeGravacao {
  episodioId: string;
  nome: string;
  fluxo: ReadableStream<Uint8Array> | Readable;
}

export async function gravarFluxo(pedido: PedidoDeGravacao) {
  const { episodioId, nome, fluxo } = pedido;
  if (!extensaoAceita(nome)) {
    throw new ErroDeUpload('Aceitamos mp4, mkv, mov e webm.');
  }

  const pasta = pastaDeUploads();
  await mkdir(pasta, { recursive: true });

  const extensao = extname(nome).toLowerCase();
  // Nome sorteado: o nome de origem entraria num caminho de disco. Só a extensão, já
  // validada contra a lista fechada, sobrevive.
  const finalCaminho = join(pasta, `${randomUUID()}${extensao}`);
  const parcial = `${finalCaminho}.parcial`;
  const amostra: Buffer[] = [];

  try {
    const entrada = fluxo instanceof Readable ? fluxo : Readable.fromWeb(fluxo as never);
    await pipeline(
      entrada,
      contadorComAmostra(limiteDeUploadBytes(), amostra),
      createWriteStream(parcial)
    );
  } catch (erro) {
    // Interrupção no meio deixaria lixo no disco e um registro sem arquivo no banco.
    await rm(parcial, { force: true });
    throw erro instanceof ErroDeUpload
      ? erro
      : new ErroDeUpload('O envio foi interrompido antes de terminar.');
  }

  const informacao = await stat(parcial);
  if (informacao.size === 0) {
    await rm(parcial, { force: true });
    throw new ErroDeUpload('O arquivo chegou vazio.');
  }

  // Extensão não é prova: um .mp4 pode ser um HTML renomeado.
  const { formato } = reconhecerFormato(
    new URL(`file:///${encodeURIComponent(nome)}`),
    '',
    Buffer.concat(amostra)
  );
  if (formato !== 'MP4' && formato !== 'MATROSKA') {
    await rm(parcial, { force: true });
    throw new ErroDeUpload('Esse arquivo não parece um vídeo. Confira o que foi selecionado.');
  }

  await rename(parcial, finalCaminho);

  return banco.arquivoMidia.create({
    data: { episodioId, caminho: finalCaminho, tamanhoBytes: informacao.size }
  });
}

/** Caminho antigo, ainda usado pelos testes e pelo envio em lote de arquivos pequenos. */
export async function gravarBytes(episodioId: string, bytes: Buffer, nome: string) {
  return gravarFluxo({ episodioId, nome, fluxo: Readable.from(bytes) });
}

export async function gravarUpload(episodioId: string, arquivo: File) {
  if (arquivo.size > limiteDeUploadBytes()) {
    throw new ErroDeUpload('O arquivo passou do limite de tamanho.');
  }
  return gravarFluxo({ episodioId, nome: arquivo.name, fluxo: arquivo.stream() });
}
