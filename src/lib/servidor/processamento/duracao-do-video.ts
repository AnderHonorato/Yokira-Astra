// Arquivo: src/lib/servidor/processamento/duracao-do-video.ts
// Lê a duração real do arquivo com o ffprobe, que vem junto com o ffmpeg.
//
// Existe porque a duração do episódio era só o que alguém tinha digitado no cadastro. Na
// tela de assistir isso aparecia como "23min" ao lado de um vídeo de três segundos: o
// número do cadastro e o vídeo de verdade discordando um do lado do outro. Depois de
// converter, quem manda é o arquivo.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const executar = promisify(execFile);

function binario(): string {
  const ffmpeg = process.env.CAMINHO_FFMPEG ?? 'ffmpeg';
  // O ffprobe mora ao lado do ffmpeg; quando o caminho é explícito, troca só o nome.
  return process.env.CAMINHO_FFPROBE ?? ffmpeg.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
}

/** Duração em segundos, arredondada. `null` quando o ffprobe não soube dizer. */
export async function duracaoEmSegundos(caminho: string): Promise<number | null> {
  try {
    const { stdout } = await executar(binario(), [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      caminho
    ]);
    const segundos = Number(stdout.trim());
    // Transmissão sem fim devolve "N/A" ou infinito: nesse caso não há duração a gravar.
    if (!Number.isFinite(segundos) || segundos <= 0) return null;
    return Math.round(segundos);
  } catch {
    return null;
  }
}
