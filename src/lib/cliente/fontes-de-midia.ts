// Arquivo: src/lib/cliente/fontes-de-midia.ts
// Conversa do painel com os endpoints de fonte. Fica fora dos componentes porque a parte
// difícil aqui não é desenhar nada: é garantir que a resposta de uma verificação antiga
// não sobrescreva o resultado da URL que está no campo agora.
//
// A guarda é a assinatura. Cada pedido leva uma, o servidor devolve a mesma de volta, e
// quem chegar com assinatura diferente da atual é descartado sem tocar na tela.

import type {
  EpisodiosSelecionaveis,
  FonteListada,
  ResultadoVerificacao
} from '../contratos/midia';

let sequencia = 0;

export function novaAssinatura(): string {
  sequencia += 1;
  return `v${sequencia}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Token de idempotência de um envio. Reenviar o mesmo não cria uma segunda fonte. */
export function novoToken(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function lerErro(resposta: Response): Promise<string> {
  const corpo = (await resposta.json().catch(() => null)) as { message?: string } | null;
  return corpo?.message ?? 'Não deu para falar com o servidor.';
}

export async function buscarEpisodios(
  busca: string,
  pagina: number,
  sinal?: AbortSignal
): Promise<EpisodiosSelecionaveis> {
  const endereco = `/api/admin/episodios?busca=${encodeURIComponent(busca)}&pagina=${pagina}`;
  const resposta = await fetch(endereco, {
    signal: sinal,
    headers: { accept: 'application/json' }
  });
  if (!resposta.ok) throw new Error(await lerErro(resposta));
  return (await resposta.json()) as EpisodiosSelecionaveis;
}

export async function verificarLink(
  url: string,
  assinatura: string,
  sinal?: AbortSignal
): Promise<ResultadoVerificacao> {
  const resposta = await fetch('/api/admin/fontes/verificar', {
    method: 'POST',
    signal: sinal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url, assinatura })
  });
  if (!resposta.ok) throw new Error(await lerErro(resposta));
  return (await resposta.json()) as ResultadoVerificacao;
}

export async function listarFontesDoEpisodio(episodioId: string): Promise<FonteListada[]> {
  const resposta = await fetch(`/api/admin/fontes?episodioId=${encodeURIComponent(episodioId)}`, {
    headers: { accept: 'application/json' }
  });
  if (!resposta.ok) throw new Error(await lerErro(resposta));
  return ((await resposta.json()) as { fontes: FonteListada[] }).fontes;
}

export async function ativarFonteNoServidor(fonteId: string): Promise<FonteListada[]> {
  const resposta = await fetch('/api/admin/fontes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fonteId })
  });
  if (!resposta.ok) throw new Error(await lerErro(resposta));
  return ((await resposta.json()) as { fontes: FonteListada[] }).fontes;
}

export async function removerFonteNoServidor(fonteId: string): Promise<FonteListada[]> {
  const resposta = await fetch(`/api/admin/fontes?fonteId=${encodeURIComponent(fonteId)}`, {
    method: 'DELETE'
  });
  if (!resposta.ok) throw new Error(await lerErro(resposta));
  return ((await resposta.json()) as { fontes: FonteListada[] }).fontes;
}
