// Arquivo: src/lib/servidor/midia/fontes/resultado-de-fonte.ts
// Fábrica do veredito. Existe para que nenhum caminho da verificação esqueça um campo
// do contrato: o padrão é "não sei nada", e cada caso só preenche o que apurou.

import type { ResultadoVerificacao } from '../../../contratos/midia.js';
import type { Frase } from './mensagens-de-fonte.js';

const PADRAO = {
  tipo: null,
  embedId: null,
  mime: null,
  temporaria: false,
  avisos: [] as string[],
  qualidades: [] as number[],
  previa: null,
  confirmadaNoNavegador: false as const
};

export function montarResultado(
  assinaturaPedido: string,
  url: string,
  estado: ResultadoVerificacao['estado'],
  frase: Frase,
  extras: Partial<ResultadoVerificacao> = {}
): ResultadoVerificacao {
  return {
    ...PADRAO,
    assinaturaPedido,
    url,
    estado,
    mensagem: frase.mensagem,
    saida: frase.saida,
    ...extras
  };
}
