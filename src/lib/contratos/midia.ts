// Arquivo: src/lib/contratos/midia.ts
// Contrato compartilhado entre servidor, painel e player. Não importa módulo de
// servidor de propósito: o mesmo arquivo é lido pelos dois lados.

export type TipoFonteMidia = 'HLS_LOCAL' | 'DIRETO' | 'HLS_REMOTO' | 'YOUTUBE' | 'VIMEO';

/**
 * Estado do que a verificação no servidor conseguiu apurar. Verificar não é o mesmo que
 * reproduzir: `COMPATIVEL` diz que o endereço responde e tem formato que o navegador
 * costuma tocar, não que a reprodução foi confirmada.
 */
export type EstadoVerificacao =
  'COMPATIVEL' | 'PRECISA_PROCESSAR' | 'INDISPONIVEL' | 'INCOMPATIVEL';

export interface PreviaDaFonte {
  tipo: TipoFonteMidia;
  url: string;
  /** Origem do iframe, só nas incorporações. Serve para conferir a mensagem recebida. */
  origem?: string;
}

export interface ResultadoVerificacao {
  /**
   * Eco do pedido. O painel descarta resposta cuja assinatura não bate com a do campo
   * atual — sem isso, uma verificação lenta de uma URL antiga sobrescreve a nova.
   */
  assinaturaPedido: string;
  url: string;
  estado: EstadoVerificacao;
  tipo: TipoFonteMidia | null;
  embedId: string | null;
  mime: string | null;
  /** Endereço que caduca (assinado, com token). Vale revalidar depois. */
  temporaria: boolean;
  /** Frase curta que resume o estado. */
  mensagem: string;
  /** O que dá para fazer a respeito, quando há o que fazer. */
  saida: string | null;
  avisos: string[];
  qualidades: number[];
  previa: PreviaDaFonte | null;
  /** Nunca é verdadeiro no servidor: só o navegador confirma reprodução. */
  confirmadaNoNavegador: false;
}

export interface LegendaDaFonte {
  idioma: string;
  rotulo: string;
  url: string;
}

export interface FonteParaPlayer {
  tipo: TipoFonteMidia;
  url: string;
  /** Alias mantido para clientes antigos que só reproduzem HLS local. */
  playlist?: string;
  expiraEm?: number;
  embedId?: string;
  origem?: string;
  mime?: string;
  aviso?: string;
  legendas: LegendaDaFonte[];
}

export interface EpisodioSelecionavel {
  id: string;
  titulo: string;
  temporada: number;
  numero: number;
  nome: string;
  temVideo: boolean;
}

export interface EpisodiosSelecionaveis {
  episodios: EpisodioSelecionavel[];
  pagina: number;
  paginas: number;
  total: number;
}

export interface FonteListada {
  id: string;
  tipo: TipoFonteMidia;
  rotulo: string;
  detalhe: string;
  estado: string;
  ativa: boolean;
  temporaria: boolean;
  aviso: string | null;
  criadaEm: string;
}
