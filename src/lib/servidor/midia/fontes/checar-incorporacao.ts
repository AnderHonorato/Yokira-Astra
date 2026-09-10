// Arquivo: src/lib/servidor/midia/fontes/checar-incorporacao.ts
// Pergunta ao próprio provedor se aquele vídeo pode ser incorporado. Sem isso, o painel
// diria "pronto" para vídeo privado, apagado ou com incorporação bloqueada, e o erro só
// apareceria para o espectador dentro de um iframe que a gente não consegue ler.
//
// Usa o endpoint oEmbed oficial dos dois provedores, pelo mesmo transporte protegido
// contra SSRF do resto. Falha de rede não reprova: melhor deixar salvar com aviso do
// que travar por causa de uma instabilidade momentânea do provedor.

import { sondar, type OpcoesSondagem } from './sondar-url.js';
import type { Incorporacao } from './provedores.js';

function enderecoOembed(incorporacao: Incorporacao): string | null {
  if (incorporacao.provedor === 'YOUTUBE') {
    const alvo = `https://www.youtube.com/watch?v=${incorporacao.embedId}`;
    return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(alvo)}`;
  }
  if (incorporacao.provedor === 'VIMEO') {
    const alvo = `https://vimeo.com/${incorporacao.embedId}`;
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(alvo)}`;
  }
  return null;
}

export async function checarIncorporacao(
  incorporacao: Incorporacao,
  opcoes: OpcoesSondagem = {}
): Promise<boolean> {
  const endereco = enderecoOembed(incorporacao);
  if (!endereco) return true;

  try {
    const resposta = await sondar(endereco, { ...opcoes, maximoBytes: 2048 });
    // 401 e 403 são a resposta do YouTube para vídeo que não pode sair do site dele;
    // 404 é vídeo apagado. Qualquer outro problema conta como instabilidade.
    if (resposta.status === 401 || resposta.status === 403 || resposta.status === 404) return false;
    return true;
  } catch {
    return true;
  }
}
