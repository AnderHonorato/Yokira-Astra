// Arquivo: src/routes/api/admin/fontes/verificar/+server.ts
// Verifica um link antes de salvar. Quem abre a conexão é o SERVIDOR, então este é um
// endpoint sensível: só EDITOR para cima entra, há um teto de verificações em voo por
// pessoa, e toda a proteção contra SSRF mora no módulo de conexão, não aqui.
//
// A resposta devolve a assinatura do pedido de volta. O painel descarta o que não bate
// com o campo atual: sem isso, a verificação lenta de uma URL antiga chega depois e
// sobrescreve o resultado da URL nova.

import { error, json } from '@sveltejs/kit';
import { verificarFonte } from '$servidor/midia/fontes/verificar-fonte';
import { exigirPapel } from '$servidor/permissoes/papeis';
import type { RequestHandler } from './$types';

const TAMANHO_MAXIMO_DA_URL = 2048;

/** Teto de verificações simultâneas por pessoa: uma aba não vira um scanner de rede. */
const EM_VOO = new Map<string, number>();
const LIMITE_POR_PESSOA = 3;

export const POST: RequestHandler = async ({ request, locals }) => {
  exigirPapel(locals.usuario?.papel, 'EDITOR');
  const usuarioId = locals.usuario!.id;

  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) throw error(400, 'Pedido sem corpo.');

  const bruto = typeof corpo.url === 'string' ? corpo.url.trim() : '';
  const assinatura = typeof corpo.assinatura === 'string' ? corpo.assinatura.slice(0, 80) : '';
  if (bruto === '') throw error(400, 'Informe o link a verificar.');
  if (bruto.length > TAMANHO_MAXIMO_DA_URL) throw error(400, 'Esse link é longo demais.');

  const emVoo = EM_VOO.get(usuarioId) ?? 0;
  if (emVoo >= LIMITE_POR_PESSOA) {
    throw error(429, 'Muitas verificações ao mesmo tempo. Espere as anteriores terminarem.');
  }
  EM_VOO.set(usuarioId, emVoo + 1);

  try {
    const resultado = await verificarFonte(bruto, assinatura);
    return json(resultado, { headers: { 'cache-control': 'private, no-store' } });
  } finally {
    const restante = (EM_VOO.get(usuarioId) ?? 1) - 1;
    if (restante <= 0) EM_VOO.delete(usuarioId);
    else EM_VOO.set(usuarioId, restante);
  }
};
