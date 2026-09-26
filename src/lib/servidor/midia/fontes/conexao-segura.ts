// Arquivo: src/lib/servidor/midia/fontes/conexao-segura.ts
// Abre UMA conexão HTTP com o IP que já foi conferido. É o ponto onde o SSRF é
// realmente barrado: conferir o nome e depois deixar o Node resolver de novo abre a
// janela do DNS rebinding — entre a checagem e a conexão o nome pode passar a apontar
// para 169.254.169.254. Aqui o IP validado é fixado no `lookup`, e a conexão vai para
// ele mesmo, com o Host e o SNI do nome original.
//
// Não segue redirecionamento de propósito: cada salto tem que voltar a passar pela
// validação, e isso é trabalho de quem chama.

import { request as pedidoHttp, type IncomingMessage } from 'node:http';
import { request as pedidoHttps } from 'node:https';
import { lookup as resolverDns } from 'node:dns/promises';
import { enderecoPrivado } from '../../armazenamento/endereco-privado.js';

export const TEMPO_LIMITE_PADRAO_MS = 8000;

export type MotivoDeFalha =
  | 'ENDERECO'
  | 'REDE'
  | 'TEMPO'
  | 'TAMANHO'
  | 'RESPOSTA'
  | 'FORMATO'
  | 'PROVEDOR';

export class ErroDeFonte extends Error {
  constructor(
    mensagem: string,
    readonly motivo: MotivoDeFalha = 'REDE'
  ) {
    super(mensagem);
  }
}

/** Confere esquema e para onde o nome aponta de verdade. Devolve o IP a fixar. */
export async function resolverEnderecoPublico(url: URL): Promise<string> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ErroDeFonte('Só aceitamos endereços http e https.', 'ENDERECO');
  }

  const resolvidos = await resolverDns(url.hostname, { all: true }).catch(() => {
    throw new ErroDeFonte('Não consegui encontrar esse endereço na internet.', 'ENDERECO');
  });

  // Basta um IP interno para recusar: um nome pode devolver vários e o Node escolheria
  // qualquer um deles.
  if (resolvidos.length === 0 || resolvidos.some((item) => enderecoPrivado(item.address))) {
    throw new ErroDeFonte('Esse endereço aponta para a rede interna do servidor.', 'ENDERECO');
  }

  return resolvidos[0].address;
}

/** `lookup` que devolve sempre o IP já validado, nas duas assinaturas que o Node usa. */
function fixar(ip: string) {
  const familia = ip.includes(':') ? 6 : 4;
  return (_nome: string, opcoes: unknown, retorno: unknown) => {
    if (typeof opcoes === 'object' && opcoes !== null && 'all' in opcoes && opcoes.all) {
      (retorno as (e: null, r: unknown) => void)(null, [{ address: ip, family: familia }]);
      return;
    }
    (retorno as (e: null, a: string, f: number) => void)(null, ip, familia);
  };
}

export interface OpcoesPedido {
  metodo?: 'GET' | 'HEAD';
  tempoLimiteMs?: number;
}

/**
 * Faz o pedido e entrega a resposta ainda aberta. Quem chama decide se lê uma amostra e
 * fecha, ou se consome o fluxo inteiro — as duas coisas passam pela mesma validação.
 */
export async function pedirComIpFixado(
  url: URL,
  opcoes: OpcoesPedido = {}
): Promise<IncomingMessage> {
  const ipFixado = await resolverEnderecoPublico(url);
  const pedir = url.protocol === 'https:' ? pedidoHttps : pedidoHttp;
  const tempoLimiteMs = opcoes.tempoLimiteMs ?? TEMPO_LIMITE_PADRAO_MS;

  return new Promise<IncomingMessage>((resolver, rejeitar) => {
    const requisicao = pedir(
      url,
      {
        method: opcoes.metodo ?? 'GET',
        lookup: fixar(ipFixado) as never,
        headers: {
          // Sem credencial nenhuma do site: o pedido é para terceiro.
          accept: '*/*',
          'user-agent': 'Yokira/1.0 (verificador de video)'
        }
      },
      (resposta) => resolver(resposta)
    );

    requisicao.setTimeout(tempoLimiteMs, () => {
      requisicao.destroy();
      rejeitar(new ErroDeFonte('O endereço demorou demais para responder.', 'TEMPO'));
    });
    requisicao.on('error', (erro) => {
      rejeitar(new ErroDeFonte(`Não consegui abrir o endereço: ${erro.message}`, 'REDE'));
    });
    requisicao.end();
  });
}

export function normalizarCabecalhos(brutos: NodeJS.Dict<string | string[]>) {
  const normalizados: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(brutos)) {
    if (valor !== undefined) normalizados[chave.toLowerCase()] = String(valor);
  }
  return normalizados;
}
