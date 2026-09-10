// Arquivo: src/lib/servidor/banco/fontes-midia.ts
// Guarda de onde vem o vídeo de cada episódio. Um episódio pode ter várias fontes
// gravadas, mas só uma ativa — e a troca é sempre "desliga a antiga, liga a nova" dentro
// da mesma transação, porque o índice parcial do banco recusa duas ativas ao mesmo tempo.
//
// Fonte nova nunca entra ativa antes de estar pronta. É a regra que impede um upload em
// conversão de derrubar o vídeo que já estava tocando.

import { createHash } from 'node:crypto';
import { banco } from './cliente.js';
import { incorporacaoGravada, nomeDoProvedor } from '../midia/fontes/provedores.js';
import type { FonteListada, ResultadoVerificacao, TipoFonteMidia } from '../../contratos/midia.js';

export type EstadoDaFonte = 'PENDENTE' | 'PROCESSANDO' | 'PRONTO' | 'FALHOU';

/**
 * Mesma chave para o mesmo pedido: clique duplo e reenvio da requisição param no mesmo
 * registro em vez de criarem duas fontes iguais.
 */
export function chaveDeIdempotencia(episodioId: string, tipo: string, alvo: string): string {
  return createHash('sha256').update(`${episodioId}|${tipo}|${alvo}`).digest('hex').slice(0, 40);
}

function rotuloDaFonte(tipo: string, url: string | null, embedId: string | null): string {
  if (tipo === 'HLS_LOCAL') return 'Arquivo enviado e convertido aqui';
  if (tipo === 'DIRETO') return 'Link direto para o arquivo';
  if (tipo === 'HLS_REMOTO') return 'Playlist HLS na origem';
  if (tipo === 'YOUTUBE' || tipo === 'VIMEO') {
    return `Vídeo do ${nomeDoProvedor(tipo)}${embedId ? ` (${embedId})` : ''}`;
  }
  return url ?? tipo;
}

export async function listarFontes(episodioId: string): Promise<FonteListada[]> {
  const fontes = await banco.fonteMidia.findMany({
    where: { episodioId },
    orderBy: [{ ativa: 'desc' }, { criadaEm: 'desc' }],
    include: { arquivo: { select: { caminho: true, tamanhoBytes: true } } }
  });

  return fontes.map((fonte) => ({
    id: fonte.id,
    tipo: fonte.tipo as TipoFonteMidia,
    rotulo: rotuloDaFonte(fonte.tipo, fonte.url, fonte.embedId),
    detalhe: fonte.url ?? fonte.arquivo?.caminho ?? '',
    estado: fonte.estado,
    ativa: fonte.ativa,
    temporaria: fonte.temporaria,
    aviso: fonte.aviso,
    criadaEm: fonte.criadaEm.toISOString()
  }));
}

export async function fonteAtivaDoEpisodio(episodioId: string) {
  return banco.fonteMidia.findFirst({
    where: { episodioId, ativa: true },
    include: { arquivo: { include: { variantes: { select: { id: true } } } } }
  });
}

/** Desliga a atual e liga a escolhida. Só ativa fonte já pronta. */
export async function ativarFonte(id: string): Promise<void> {
  const fonte = await banco.fonteMidia.findUnique({ where: { id } });
  if (!fonte) throw new Error('Fonte não encontrada.');
  if (fonte.estado !== 'PRONTO') {
    throw new Error('Essa fonte ainda não está pronta para entrar no ar.');
  }
  if (fonte.ativa) return;

  await banco.$transaction([
    banco.fonteMidia.updateMany({
      where: { episodioId: fonte.episodioId, ativa: true },
      data: { ativa: false }
    }),
    banco.fonteMidia.update({ where: { id }, data: { ativa: true } })
  ]);
}

export interface PedidoDeFonteRemota {
  episodioId: string;
  verificacao: ResultadoVerificacao;
  /** Token que o painel manda junto; entra na chave para o clique duplo não duplicar. */
  token: string;
}

export async function registrarFonteRemota(pedido: PedidoDeFonteRemota): Promise<string> {
  const { episodioId, verificacao, token } = pedido;
  if (!verificacao.tipo) throw new Error('Fonte sem tipo reconhecido.');

  const alvo = verificacao.embedId ?? verificacao.url;
  const chave = chaveDeIdempotencia(episodioId, verificacao.tipo, `${alvo}|${token}`);

  const existente = await banco.fonteMidia.findUnique({ where: { chaveIdempotencia: chave } });
  if (existente) {
    await ativarFonte(existente.id);
    return existente.id;
  }

  const criada = await banco.fonteMidia.create({
    data: {
      episodioId,
      tipo: verificacao.tipo,
      url: verificacao.url,
      embedId: verificacao.embedId,
      mime: verificacao.mime,
      estado: 'PRONTO',
      ativa: false,
      temporaria: verificacao.temporaria,
      aviso: verificacao.avisos.length > 0 ? verificacao.avisos.join(' ') : null,
      chaveIdempotencia: chave,
      assinaturaPedido: verificacao.assinaturaPedido,
      verificadaEm: new Date()
    }
  });

  await ativarFonte(criada.id);
  return criada.id;
}

/** Upload: nasce pendente e só é ativada quando a conversão termina. */
export async function registrarFonteLocal(
  episodioId: string,
  arquivoId: string,
  token: string
): Promise<string> {
  const chave = chaveDeIdempotencia(episodioId, 'HLS_LOCAL', `${arquivoId}|${token}`);
  const criada = await banco.fonteMidia.upsert({
    where: { chaveIdempotencia: chave },
    create: {
      episodioId,
      arquivoId,
      tipo: 'HLS_LOCAL',
      estado: 'PROCESSANDO',
      ativa: false,
      chaveIdempotencia: chave,
      assinaturaPedido: token
    },
    update: {}
  });
  return criada.id;
}

export async function marcarFontePronta(arquivoId: string): Promise<void> {
  const fonte = await banco.fonteMidia.findFirst({ where: { arquivoId } });
  if (!fonte) return;
  await banco.fonteMidia.update({ where: { id: fonte.id }, data: { estado: 'PRONTO' } });
  await ativarFonte(fonte.id);
}

export async function marcarFonteFalha(arquivoId: string, motivo: string): Promise<void> {
  const fonte = await banco.fonteMidia.findFirst({ where: { arquivoId } });
  if (!fonte) return;
  await banco.fonteMidia.update({
    where: { id: fonte.id },
    data: { estado: 'FALHOU', aviso: motivo.slice(0, 400) }
  });
}

export async function removerFonte(id: string): Promise<void> {
  await banco.fonteMidia.delete({ where: { id } });
}

/** Reconstrói o endereço da incorporação a partir do id gravado, sem confiar no banco. */
export function enderecoDeIncorporacao(tipo: string, embedId: string | null) {
  return embedId ? incorporacaoGravada(tipo, embedId) : null;
}
