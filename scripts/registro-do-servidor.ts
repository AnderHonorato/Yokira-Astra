// Arquivo: scripts/registro-do-servidor.ts
// Anota qual processo é o nosso servidor. Existe por causa de uma regra simples: encerrar
// tem que derrubar o servidor deste projeto, e nada além disso.
//
// A versão anterior perguntava ao sistema quem estava na porta e matava. Isso é errado de
// duas formas: no Windows os comandos usados (`lsof`, `fuser`) não existem, então o
// encerrar nunca funcionava; e onde funcionava, matava o que estivesse ali — inclusive
// outro projeto de outra pessoa que tivesse pegado a porta primeiro.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const ARQUIVO = resolve('.runtime/servidor.json');

export interface RegistroDoServidor {
  pid: number;
  porta: number;
  iniciadoEm: string;
  raiz: string;
}

export async function anotarServidor(porta: number): Promise<void> {
  await mkdir(dirname(ARQUIVO), { recursive: true });
  const registro: RegistroDoServidor = {
    pid: process.pid,
    porta,
    iniciadoEm: new Date().toISOString(),
    raiz: resolve('.')
  };
  await writeFile(ARQUIVO, JSON.stringify(registro, null, 2), 'utf8');
}

export async function lerRegistro(): Promise<RegistroDoServidor | null> {
  const bruto = await readFile(ARQUIVO, 'utf8').catch(() => null);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as RegistroDoServidor;
  } catch {
    return null;
  }
}

export async function apagarRegistro(): Promise<void> {
  await rm(ARQUIVO, { force: true });
}

/** `kill(pid, 0)` não mata: só responde se o processo existe e é alcançável. */
export function processoVivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    return (erro as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export const CAMINHO_DO_REGISTRO = ARQUIVO;
