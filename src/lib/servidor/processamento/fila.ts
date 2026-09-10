// Arquivo: src/lib/servidor/processamento/fila.ts
// Fila de conversão com estado no banco. A versão anterior disparava
// `void processarArquivo(id)` de dentro da rota: sem registro de "quem está fazendo" e
// sem prazo, um reinício do servidor deixava o trabalho PROCESSANDO para sempre e o
// episódio preso num "ainda está sendo preparado" que nunca terminava.
//
// Aqui cada trabalho é reivindicado com um prazo (`leaseAte`) e um dono (`executor`).
// Quando o prazo vence sem renovação — porque o processo caiu — outro executor pega o
// trabalho de volta. É o mínimo para a fila sobreviver a um reinício.

import { randomUUID } from 'node:crypto';
import { banco } from '../banco/cliente.js';

export const PRAZO_DO_LEASE_MS = 2 * 60 * 1000;
export const MAXIMO_DE_TENTATIVAS = 3;

/** Identidade deste processo. Um reinício gera outra, e é isso que solta os presos. */
export const EXECUTOR = `${process.pid}-${randomUUID().slice(0, 8)}`;

export interface TrabalhoReivindicado {
  id: string;
  arquivoId: string;
  tentativas: number;
}

/**
 * Enfileira uma conversão. Idempotente de propósito: clique duplo, reenvio da requisição
 * e retomada do lote param no mesmo trabalho em vez de gerarem três conversões do mesmo
 * arquivo, cada uma escrevendo por cima da outra.
 */
export async function enfileirarProcessamento(arquivoId: string): Promise<string> {
  const pendente = await banco.trabalhoProcessamento.findFirst({
    where: { arquivoId, situacao: { in: ['NA_FILA', 'PROCESSANDO'] } },
    orderBy: { criadoEm: 'desc' }
  });
  if (pendente) return pendente.id;

  const criado = await banco.trabalhoProcessamento.create({
    data: { arquivoId, situacao: 'NA_FILA', progresso: 0 }
  });
  return criado.id;
}

/**
 * Pega um trabalho para si. Elege candidato e depois confirma com um `updateMany` que
 * repete a condição: se outro executor tiver chegado primeiro, o update afeta 0 linhas e
 * este aqui simplesmente tenta o próximo.
 */
export async function reivindicarTrabalho(): Promise<TrabalhoReivindicado | null> {
  const agora = new Date();
  const candidatos = await banco.trabalhoProcessamento.findMany({
    where: {
      tentativas: { lt: MAXIMO_DE_TENTATIVAS },
      OR: [
        { situacao: 'NA_FILA' },
        // Preso: quem pegou não renovou o prazo, então caiu.
        { situacao: 'PROCESSANDO', leaseAte: { lt: agora } }
      ]
    },
    orderBy: { criadoEm: 'asc' },
    take: 5,
    select: { id: true, arquivoId: true, tentativas: true, situacao: true }
  });

  for (const candidato of candidatos) {
    const { count } = await banco.trabalhoProcessamento.updateMany({
      where: {
        id: candidato.id,
        tentativas: { lt: MAXIMO_DE_TENTATIVAS },
        OR: [{ situacao: 'NA_FILA' }, { situacao: 'PROCESSANDO', leaseAte: { lt: agora } }]
      },
      data: {
        situacao: 'PROCESSANDO',
        executor: EXECUTOR,
        leaseAte: new Date(Date.now() + PRAZO_DO_LEASE_MS),
        tentativas: candidato.tentativas + 1,
        progresso: 0
      }
    });
    if (count === 1) {
      return {
        id: candidato.id,
        arquivoId: candidato.arquivoId,
        tentativas: candidato.tentativas + 1
      };
    }
  }

  return null;
}

/** Renova o prazo enquanto o ffmpeg trabalha. Sem isso a própria fila roubaria o trabalho. */
export async function renovarLease(trabalhoId: string, progresso?: number): Promise<void> {
  await banco.trabalhoProcessamento.updateMany({
    where: { id: trabalhoId, executor: EXECUTOR },
    data: {
      leaseAte: new Date(Date.now() + PRAZO_DO_LEASE_MS),
      ...(progresso === undefined ? {} : { progresso })
    }
  });
}

export async function concluirTrabalho(trabalhoId: string): Promise<void> {
  await banco.trabalhoProcessamento.updateMany({
    where: { id: trabalhoId, executor: EXECUTOR },
    data: { situacao: 'CONCLUIDO', progresso: 100, leaseAte: null }
  });
}

export async function falharTrabalho(trabalhoId: string, motivo: string): Promise<boolean> {
  const trabalho = await banco.trabalhoProcessamento.findUnique({ where: { id: trabalhoId } });
  if (!trabalho) return true;

  const desiste = trabalho.tentativas >= MAXIMO_DE_TENTATIVAS;
  await banco.trabalhoProcessamento.updateMany({
    where: { id: trabalhoId, executor: EXECUTOR },
    data: {
      // Ainda há tentativa sobrando: volta para a fila em vez de morrer aqui.
      situacao: desiste ? 'FALHOU' : 'NA_FILA',
      mensagem: motivo.slice(0, 400),
      leaseAte: null,
      executor: null
    }
  });
  return desiste;
}

export interface EstadoDaFila {
  naFila: number;
  processando: number;
  falharam: number;
}

export async function estadoDaFila(): Promise<EstadoDaFila> {
  const [naFila, processando, falharam] = await Promise.all([
    banco.trabalhoProcessamento.count({ where: { situacao: 'NA_FILA' } }),
    banco.trabalhoProcessamento.count({ where: { situacao: 'PROCESSANDO' } }),
    banco.trabalhoProcessamento.count({ where: { situacao: 'FALHOU' } })
  ]);
  return { naFila, processando, falharam };
}
