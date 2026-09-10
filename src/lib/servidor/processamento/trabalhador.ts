// Arquivo: src/lib/servidor/processamento/trabalhador.ts
// O laço que consome a fila. Sobe junto com o servidor e fica acordando de tempos em
// tempos; ao reiniciar, ele encontra sozinho os trabalhos cujo prazo venceu e recomeça.
//
// A concorrência é baixa de propósito: o ffmpeg usa o processador inteiro, e três
// conversões ao mesmo tempo deixam o site lento para quem só quer assistir. Quem hospeda
// em máquina maior aumenta pelo `CONVERSOES_SIMULTANEAS`.
//
// Este é o modelo "processo web também converte". Serve para uma instalação só. A
// alternativa — processo separado lendo a mesma fila — está descrita no README, e a fila
// já foi escrita para aguentar as duas.

import { concluirTrabalho, falharTrabalho, reivindicarTrabalho, renovarLease } from './fila.js';
import { processarArquivo } from './transcodificar.js';
import { duracaoEmSegundos } from './duracao-do-video.js';
import { marcarFonteFalha, marcarFontePronta } from '../banco/fontes-midia.js';
import { banco } from '../banco/cliente.js';

/** Corrige a duração do episódio com o que o arquivo realmente tem. */
async function gravarDuracaoReal(arquivoId: string): Promise<void> {
  const arquivo = await banco.arquivoMidia.findUnique({ where: { id: arquivoId } });
  if (!arquivo) return;

  const segundos = await duracaoEmSegundos(arquivo.caminho);
  if (segundos === null) return;

  await banco.episodio.update({
    where: { id: arquivo.episodioId },
    data: { duracaoSegundos: segundos }
  });
}

const INTERVALO_OCIOSO_MS = 5000;

function simultaneas(): number {
  const bruto = Number(process.env.CONVERSOES_SIMULTANEAS ?? '');
  return Number.isFinite(bruto) && bruto >= 1 ? Math.min(Math.trunc(bruto), 4) : 1;
}

let rodando = false;
let parar = false;

async function umTrabalho(): Promise<boolean> {
  const trabalho = await reivindicarTrabalho();
  if (!trabalho) return false;

  try {
    await processarArquivo(trabalho.arquivoId, (progresso) =>
      renovarLease(trabalho.id, progresso).catch(() => undefined)
    );
    await concluirTrabalho(trabalho.id);
    // Depois de converter, quem sabe a duração é o arquivo — não o que foi digitado no
    // cadastro. Falha aqui não reprova a conversão: o vídeo já está pronto.
    await gravarDuracaoReal(trabalho.arquivoId).catch(() => undefined);
    await marcarFontePronta(trabalho.arquivoId);
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : 'Falha na conversão.';
    const desistiu = await falharTrabalho(trabalho.id, motivo);
    // Só marca a fonte como falha quando não há mais tentativa: entre uma tentativa e
    // outra o episódio continua "em preparo", que é o que de fato está acontecendo.
    if (desistiu) await marcarFonteFalha(trabalho.arquivoId, motivo);
  }
  return true;
}

/** Uma rodada. Banco fora do ar por um instante não pode matar o laço: devolve false. */
async function umaRodada(): Promise<boolean> {
  try {
    const lote = await Promise.all(
      Array.from({ length: simultaneas() }, () => umTrabalho().catch(() => false))
    );
    return lote.some(Boolean);
  } catch {
    return false;
  }
}

async function laco(): Promise<void> {
  while (!parar) {
    const trabalhou = await umaRodada();
    if (!trabalhou) await new Promise((resolver) => setTimeout(resolver, INTERVALO_OCIOSO_MS));
  }
  rodando = false;
}

/** Idempotente: chamar duas vezes não cria dois laços. */
export function iniciarTrabalhador(): void {
  if (rodando) return;
  rodando = true;
  parar = false;
  void laco();
}

export function pararTrabalhador(): void {
  parar = true;
}

export function trabalhadorAtivo(): boolean {
  return rodando;
}
