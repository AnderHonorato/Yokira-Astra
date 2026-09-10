// Arquivo: src/lib/servidor/midia/fontes/verificar-fonte.ts
// Junta as peças: espia o endereço, decide o que ele é e devolve um veredito que o
// painel sabe mostrar. É o único lugar que diz "compatível" — e mesmo aqui isso quer
// dizer "o servidor abriu e reconheceu o formato", nunca "o navegador tocou".
//
// A verificação é refeita no servidor na hora de salvar. Esta função é só a que o
// painel chama para mostrar o estado antes de o administrador decidir.

import { sondar, tipoDeConteudo, lerEndereco, type OpcoesSondagem } from './sondar-url.js';
import { reconhecerFormato, pareceTemporario, extensaoDoCaminho } from './reconhecer.js';
import { reconhecerProvedor, nomeDoProvedor } from './provedores.js';
import { ErroDePlaylist } from './hls-remoto.js';
import { ErroDeFonte } from './conexao-segura.js';
import { verificarPlaylist } from './verificar-playlist.js';
import { checarIncorporacao } from './checar-incorporacao.js';
import { montarResultado } from './resultado-de-fonte.js';
import * as frases from './mensagens-de-fonte.js';
import type { ResultadoVerificacao } from '../../../contratos/midia.js';

async function comoIncorporacao(
  url: URL,
  assinatura: string,
  endereco: string,
  opcoes: OpcoesSondagem
): Promise<ResultadoVerificacao | null> {
  const incorporacao = reconhecerProvedor(url);
  if (!incorporacao) return null;

  const nome = nomeDoProvedor(incorporacao.provedor);
  if (!(await checarIncorporacao(incorporacao, opcoes))) {
    return montarResultado(assinatura, endereco, 'INDISPONIVEL', frases.incorporacaoRecusada(nome));
  }

  return montarResultado(assinatura, endereco, 'COMPATIVEL', frases.prontaIncorporacao(nome), {
    tipo: incorporacao.provedor,
    embedId: incorporacao.embedId,
    avisos: [frases.AVISO_CONTROLES_DE_TERCEIRO],
    previa: { tipo: incorporacao.provedor, url: incorporacao.url, origem: incorporacao.origem }
  });
}

export async function verificarFonte(
  bruto: string,
  assinaturaPedido: string,
  opcoes: OpcoesSondagem = {}
): Promise<ResultadoVerificacao> {
  let url: URL;
  try {
    url = lerEndereco(bruto);
  } catch (erro) {
    return montarResultado(assinaturaPedido, bruto, 'INCOMPATIVEL', {
      mensagem: erro instanceof Error ? erro.message : 'Esse link não é um endereço válido.',
      saida: 'Cole o endereço completo, começando por https://'
    });
  }

  const endereco = url.toString();
  const incorporado = await comoIncorporacao(url, assinaturaPedido, endereco, opcoes);
  if (incorporado) return incorporado;

  let sondagem;
  try {
    sondagem = await sondar(endereco, opcoes);
  } catch (erro) {
    const motivo = erro instanceof ErroDeFonte ? erro.motivo : 'REDE';
    return montarResultado(
      assinaturaPedido,
      endereco,
      motivo === 'ENDERECO' ? 'INCOMPATIVEL' : 'INDISPONIVEL',
      {
        mensagem: erro instanceof Error ? erro.message : 'Não consegui abrir esse endereço.',
        saida: motivo === 'TEMPO' ? 'Tente de novo ou envie o arquivo do computador.' : null
      }
    );
  }

  if (sondagem.status < 200 || sondagem.status >= 300) {
    return montarResultado(assinaturaPedido, endereco, 'INDISPONIVEL', frases.porStatus(sondagem.status));
  }

  const mime = tipoDeConteudo(sondagem.cabecalhos);
  const { formato } = reconhecerFormato(sondagem.urlFinal, mime, sondagem.amostra);

  if (formato === 'HTML') {
    return montarResultado(assinaturaPedido, endereco, 'INCOMPATIVEL', frases.HTML_EM_VEZ_DE_VIDEO);
  }
  if (formato === 'VAZIO') {
    return montarResultado(assinaturaPedido, endereco, 'INCOMPATIVEL', frases.VAZIO);
  }
  if (formato === 'HLS') {
    try {
      return await verificarPlaylist(
        assinaturaPedido,
        endereco,
        sondagem.amostra,
        sondagem.urlFinal,
        sondagem.cabecalhos,
        opcoes
      );
    } catch (erro) {
      if (!(erro instanceof ErroDePlaylist)) throw erro;
      return montarResultado(assinaturaPedido, endereco, 'INCOMPATIVEL', {
        mensagem: erro.message,
        saida: 'Confira se o link aponta para o m3u8 certo.'
      });
    }
  }

  // Matroska cobre webm e mkv: o primeiro toca no navegador, o segundo quase nunca.
  const extensao = extensaoDoCaminho(sondagem.urlFinal);
  const tocaNoNavegador =
    formato === 'MP4' || (formato === 'MATROSKA' && (mime === 'video/webm' || extensao === '.webm'));

  if (!tocaNoNavegador) {
    return montarResultado(assinaturaPedido, endereco, 'PRECISA_PROCESSAR', frases.PRECISA_CONVERTER, {
      tipo: 'DIRETO',
      mime: mime || null
    });
  }

  const avisos: string[] = [];
  if ((sondagem.cabecalhos['accept-ranges'] ?? '').toLowerCase() !== 'bytes') {
    avisos.push(frases.AVISO_SEM_FAIXA_DE_BYTES);
  }
  const temporaria = pareceTemporario(sondagem.urlFinal);
  if (temporaria) avisos.push(frases.AVISO_TEMPORARIO);

  return montarResultado(assinaturaPedido, endereco, 'COMPATIVEL', frases.PRONTA_DIRETO, {
    tipo: 'DIRETO',
    mime: mime || (formato === 'MP4' ? 'video/mp4' : 'video/webm'),
    temporaria,
    avisos,
    previa: { tipo: 'DIRETO', url: endereco }
  });
}
