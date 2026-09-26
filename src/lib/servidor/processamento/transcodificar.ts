// Arquivo: src/lib/servidor/processamento/transcodificar.ts
// Roda o ffmpeg em processo separado. Não bloqueia o servidor web: quem chama é o
// trabalhador da fila, e o progresso vai para o banco a cada variante pronta.
//
// Não sabe nada sobre fila nem sobre fonte ativa de propósito: recebe um arquivo, escreve
// as variantes e avisa o progresso. Quem decide o que fazer com sucesso e com falha é o
// `trabalhador.ts`.

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { banco } from '../banco/cliente.js';
import { pastaDeHls } from '../midia/caminhos.js';
import { PERFIS, argumentosDaVariante, playlistMestre } from './perfis-hls.js';

const BINARIO = process.env.CAMINHO_FFMPEG ?? 'ffmpeg';

export type AvisoDeProgresso = (progresso: number) => void | Promise<void>;

export async function ffmpegDisponivel(): Promise<boolean> {
  return new Promise((resolver) => {
    const processo = spawn(BINARIO, ['-version']);
    processo.on('error', () => resolver(false));
    processo.on('close', (codigo) => resolver(codigo === 0));
  });
}

function executar(argumentos: string[]): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const processo = spawn(BINARIO, argumentos);
    let ultimaSaida = '';
    processo.stderr.on('data', (pedaco) => {
      ultimaSaida = String(pedaco).slice(-400);
    });
    processo.on('error', rejeitar);
    processo.on('close', (codigo) => {
      if (codigo === 0) resolver();
      else rejeitar(new Error(`ffmpeg saiu com codigo ${codigo}: ${ultimaSaida}`));
    });
  });
}

/**
 * Converte o arquivo nas variantes do perfil. Refazer é seguro: as variantes antigas do
 * mesmo arquivo são apagadas antes, então uma tentativa que morreu no meio não deixa
 * meia playlist gravada no banco.
 */
export async function processarArquivo(
  arquivoId: string,
  avisar: AvisoDeProgresso = () => {}
): Promise<void> {
  const arquivo = await banco.arquivoMidia.findUnique({ where: { id: arquivoId } });
  if (!arquivo) throw new Error('Arquivo de mídia não encontrado.');

  // Fora de static/: lá o servidor de arquivos entregaria os segmentos sem passar por
  // sessão nenhuma.
  const destino = join(pastaDeHls(), arquivoId);
  await mkdir(destino, { recursive: true });
  await banco.varianteHls.deleteMany({ where: { arquivoId } });

  for (const [indice, perfil] of PERFIS.entries()) {
    await executar(argumentosDaVariante(arquivo.caminho, destino, perfil));
    await banco.varianteHls.create({
      data: {
        arquivoId,
        altura: perfil.altura,
        taxaBits: perfil.taxaBits,
        // Nome do recurso, não URL: quem monta a URL é quem assina, no /api/midia/playlist.
        playlist: `${perfil.altura}p.m3u8`
      }
    });
    await avisar(Math.round(((indice + 1) / PERFIS.length) * 100));
  }

  await writeFile(join(destino, 'mestre.m3u8'), playlistMestre(PERFIS), 'utf8');
}
