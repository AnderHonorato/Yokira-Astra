// Arquivo: src/lib/servidor/midia/fontes/verificar-playlist.ts
// Confere um m3u8 remoto: lê a playlist, e quando ela é mestre também abre a qualidade
// mais leve. Playlist mestre cujas variantes não respondem é o defeito que só aparece
// no play — conferir aqui custa um pedido pequeno e evita um episódio quebrado no ar.

import { sondar, type OpcoesSondagem } from './sondar-url.js';
import { lerPlaylist, varianteMaisLeve, alturasDisponiveis } from './hls-remoto.js';
import { pareceTemporario } from './reconhecer.js';
import { montarResultado } from './resultado-de-fonte.js';
import * as frases from './mensagens-de-fonte.js';
import type { ResultadoVerificacao } from '../../../contratos/midia.js';

export async function verificarPlaylist(
  assinatura: string,
  endereco: string,
  amostra: Buffer,
  base: URL,
  cabecalhos: Record<string, string>,
  opcoes: OpcoesSondagem
): Promise<ResultadoVerificacao> {
  const lida = lerPlaylist(amostra.toString('utf8'), base);
  const avisos: string[] = [];
  if (!cabecalhos['access-control-allow-origin']) avisos.push(frases.AVISO_SEM_CORS);
  if (lida.temCriptografia) avisos.push(frases.AVISO_CRIPTOGRAFADA);

  const leve = varianteMaisLeve(lida);
  if (leve) {
    const filha = await sondar(leve.url, { ...opcoes, maximoBytes: 4096 });
    if (filha.status < 200 || filha.status >= 300) {
      return montarResultado(assinatura, endereco, 'INDISPONIVEL', {
        mensagem: 'A playlist abre, mas a qualidade que ela aponta não responde.',
        saida: 'Confira se o endereço das qualidades ainda vale na origem.'
      });
    }
  }

  const temporaria = pareceTemporario(base);
  if (temporaria) avisos.push(frases.AVISO_TEMPORARIO);

  return montarResultado(assinatura, endereco, 'COMPATIVEL', frases.PRONTA_HLS, {
    tipo: 'HLS_REMOTO',
    mime: 'application/vnd.apple.mpegurl',
    temporaria,
    avisos,
    qualidades: alturasDisponiveis(lida),
    previa: { tipo: 'HLS_REMOTO', url: endereco }
  });
}
