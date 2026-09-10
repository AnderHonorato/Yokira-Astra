// Arquivo: src/lib/componentes/player/pedir-fonte.ts
// Pergunta ao servidor de onde tocar este episódio, no momento do play. Fica separado do
// componente para dar para testar a leitura da mensagem de erro sem montar um <video>.

import type { FonteParaPlayer } from '../../contratos/midia';

export interface OpcaoDeFonte {
  id: string;
  tipo: string;
  rotulo: string;
  padrao: boolean;
  nossoPlayer: boolean;
}

async function lerMensagem(resposta: Response): Promise<string> {
  // O `error()` do SvelteKit devolve {message}. Mostrar a mensagem do servidor é o que
  // separa "entre na sua conta" de "ainda está sendo preparado".
  const corpo = (await resposta.json().catch(() => null)) as { message?: string } | null;
  return corpo?.message ?? 'Não foi possível carregar o vídeo.';
}

export async function pedirFonte(
  episodioId: string,
  fonteId?: string,
  buscar: typeof fetch = fetch
): Promise<FonteParaPlayer> {
  const parametros = new URLSearchParams({ episodioId });
  if (fonteId) parametros.set('fonteId', fonteId);

  const resposta = await buscar(`/api/midia/playlist?${parametros.toString()}`, {
    headers: { accept: 'application/json' }
  });
  if (!resposta.ok) throw new Error(await lerMensagem(resposta));

  return (await resposta.json()) as FonteParaPlayer;
}

/** Lista de opções de origem. Falha aqui não impede assistir: cai para a origem padrão. */
export async function pedirOpcoesDeFonte(
  episodioId: string,
  buscar: typeof fetch = fetch
): Promise<OpcaoDeFonte[]> {
  const resposta = await buscar(`/api/midia/fontes?episodioId=${encodeURIComponent(episodioId)}`, {
    headers: { accept: 'application/json' }
  });
  if (!resposta.ok) return [];
  return ((await resposta.json()) as { fontes: OpcaoDeFonte[] }).fontes;
}

/** Incorporação de terceiro não passa pelo nosso <video>: tem quadro próprio. */
export function ehIncorporacao(fonte: Pick<FonteParaPlayer, 'tipo'>): boolean {
  return fonte.tipo === 'YOUTUBE' || fonte.tipo === 'VIMEO';
}

/** Só o HLS tem playlist mestre com variantes; o arquivo direto tem uma qualidade só. */
export function ehPlaylist(fonte: Pick<FonteParaPlayer, 'tipo'>): boolean {
  return fonte.tipo === 'HLS_LOCAL' || fonte.tipo === 'HLS_REMOTO';
}
