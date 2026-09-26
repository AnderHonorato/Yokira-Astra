// Arquivo: src/lib/servidor/midia/fontes/sondar-url.ts
// Espia um endereço sem baixar o arquivo inteiro: segue os redirecionamentos à mão
// (cada salto volta a ser validado), lê no máximo alguns kB do corpo e devolve o que dá
// para decidir o formato. HEAD é tentado primeiro por ser barato, mas muitos servidores
// o recusam — nesse caso cai para um GET cortado no teto de bytes.
//
// O transporte é injetável para os testes usarem resposta de mentira sem afrouxar a
// validação de verdade: a exceção fica no teste, nunca no caminho de produção.

import { ErroDeFonte, TEMPO_LIMITE_PADRAO_MS } from './conexao-segura.js';
import { abrirConexao, type OpcoesConexao, type RespostaAberta } from './amostrar-resposta.js';

export type Transporte = (url: URL, opcoes: OpcoesConexao) => Promise<RespostaAberta>;

export const MAXIMO_DE_SALTOS = 4;
export const AMOSTRA_PADRAO_BYTES = 64 * 1024;

export interface Sondagem {
  urlFinal: URL;
  status: number;
  cabecalhos: Record<string, string>;
  amostra: Buffer;
  amostraTruncada: boolean;
  saltos: number;
  /** Verdadeiro quando o servidor recusou HEAD e a leitura veio de um GET cortado. */
  usouGet: boolean;
}

export interface OpcoesSondagem {
  transporte?: Transporte;
  maximoBytes?: number;
  tempoLimiteMs?: number;
  saltosMax?: number;
}

function tamanhoAnunciado(cabecalhos: Record<string, string>): number | null {
  const bruto = cabecalhos['content-length'];
  if (!bruto) return null;
  const numero = Number(bruto);
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

export function tipoDeConteudo(cabecalhos: Record<string, string>): string {
  return (cabecalhos['content-type'] ?? '').split(';')[0].trim().toLowerCase();
}

export function tamanhoDaResposta(cabecalhos: Record<string, string>): number | null {
  return tamanhoAnunciado(cabecalhos);
}

async function seguir(
  url: URL,
  opcoes: Required<Pick<OpcoesSondagem, 'transporte' | 'tempoLimiteMs' | 'saltosMax'>>,
  maximoBytes: number,
  metodo: 'GET' | 'HEAD',
  saltos: number
): Promise<{ resposta: RespostaAberta; urlFinal: URL; saltos: number }> {
  if (saltos > opcoes.saltosMax) {
    throw new ErroDeFonte('Esse endereço redireciona vezes demais.', 'ENDERECO');
  }

  const resposta = await opcoes.transporte(url, {
    metodo,
    maximoBytes,
    tempoLimiteMs: opcoes.tempoLimiteMs
  });

  if (resposta.status >= 300 && resposta.status < 400) {
    if (!resposta.destino) {
      throw new ErroDeFonte('O endereço redireciona para lugar nenhum.', 'RESPOSTA');
    }
    let proxima: URL;
    try {
      proxima = new URL(resposta.destino, url);
    } catch {
      throw new ErroDeFonte('O redirecionamento aponta para um endereço inválido.', 'ENDERECO');
    }
    return seguir(proxima, opcoes, maximoBytes, metodo, saltos + 1);
  }

  return { resposta, urlFinal: url, saltos };
}

export function lerEndereco(bruto: string): URL {
  let url: URL;
  try {
    url = new URL(bruto.trim());
  } catch {
    throw new ErroDeFonte('Esse link não é um endereço válido.', 'ENDERECO');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ErroDeFonte('Só aceitamos endereços que começam com http ou https.', 'ENDERECO');
  }
  return url;
}

export async function sondar(bruto: string, opcoes: OpcoesSondagem = {}): Promise<Sondagem> {
  const url = lerEndereco(bruto);
  const comuns = {
    transporte: opcoes.transporte ?? abrirConexao,
    tempoLimiteMs: opcoes.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS,
    saltosMax: opcoes.saltosMax ?? MAXIMO_DE_SALTOS
  };
  const maximoBytes = opcoes.maximoBytes ?? AMOSTRA_PADRAO_BYTES;

  let usouGet = false;
  let resultado = await seguir(url, comuns, 0, 'HEAD', 0).catch((erro) => {
    // Servidor que nem responde a HEAD não deve derrubar a verificação inteira.
    if (erro instanceof ErroDeFonte && erro.motivo === 'REDE') return null;
    throw erro;
  });

  const recusouHead =
    resultado === null ||
    resultado.resposta.status === 403 ||
    resultado.resposta.status === 405 ||
    resultado.resposta.status === 501 ||
    resultado.resposta.status >= 500;

  if (recusouHead || maximoBytes > 0) {
    usouGet = true;
    resultado = await seguir(url, comuns, maximoBytes, 'GET', 0);
  }

  if (!resultado) throw new ErroDeFonte('Não consegui ler esse endereço.', 'REDE');

  return {
    urlFinal: resultado.urlFinal,
    status: resultado.resposta.status,
    cabecalhos: resultado.resposta.cabecalhos,
    amostra: resultado.resposta.amostra,
    amostraTruncada: resultado.resposta.truncada,
    saltos: resultado.saltos,
    usouGet
  };
}
