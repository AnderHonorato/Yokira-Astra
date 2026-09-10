// Arquivo: src/lib/servidor/banco/pontuacao-em-alta.ts
// O cálculo do "em alta agora". Função pura, sem banco: recebe as visualizações da janela
// e devolve a nota de cada título. Fica separada porque é a parte que precisa estar certa
// e porque uma trilha que se move sozinha é impossível de conferir a olho.
//
// A ideia é a mesma que os serviços de streaming usam: cada visualização vale menos
// conforme envelhece, em vez de somar tudo desde sempre. Um total acumulado prende no
// topo o que estourou há três meses, e a fileira que promete "agora" passa a mostrar o
// mesmo de sempre.
//
// A queda é exponencial por meia-vida: uma visualização de 24 h atrás vale metade de uma
// de agora, uma de 48 h vale um quarto, e assim por diante. Basta um número para explicar
// o comportamento inteiro, e ele é fácil de ajustar sem reescrever nada.

export const MEIA_VIDA_HORAS = 24;
/** Janela considerada. Mais do que isso praticamente não pontua com esta meia-vida. */
export const JANELA_DE_DIAS = 14;

export interface EventoDeAudiencia {
  tituloId: string;
  criadoEm: Date;
}

export interface PontuacaoDeTitulo {
  tituloId: string;
  pontos: number;
  /** Visualizações cruas na janela. Serve para a tela dizer "1,2 mil nos últimos dias". */
  visualizacoesNaJanela: number;
}

/**
 * Peso de um evento pela idade. Devolve 1 para agora e cai pela metade a cada meia-vida.
 * Idade negativa (relógio adiantado no cliente) é tratada como agora, nunca como bônus.
 */
export function pesoPorIdade(idadeMs: number, meiaVidaHoras = MEIA_VIDA_HORAS): number {
  if (!Number.isFinite(idadeMs) || idadeMs <= 0) return 1;
  const idadeHoras = idadeMs / 3_600_000;
  return Math.pow(0.5, idadeHoras / meiaVidaHoras);
}

export function pontuarTitulos(
  eventos: EventoDeAudiencia[],
  agora: Date = new Date(),
  meiaVidaHoras = MEIA_VIDA_HORAS
): PontuacaoDeTitulo[] {
  const acumulado = new Map<string, PontuacaoDeTitulo>();

  for (const evento of eventos) {
    const atual = acumulado.get(evento.tituloId) ?? {
      tituloId: evento.tituloId,
      pontos: 0,
      visualizacoesNaJanela: 0
    };
    atual.pontos += pesoPorIdade(agora.getTime() - evento.criadoEm.getTime(), meiaVidaHoras);
    atual.visualizacoesNaJanela += 1;
    acumulado.set(evento.tituloId, atual);
  }

  return [...acumulado.values()].sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    // Empate de nota decidido pelo id, para a ordem não trocar a cada requisição.
    return a.tituloId.localeCompare(b.tituloId);
  });
}

export function inicioDaJanela(agora: Date = new Date(), dias = JANELA_DE_DIAS): Date {
  return new Date(agora.getTime() - dias * 24 * 3_600_000);
}
