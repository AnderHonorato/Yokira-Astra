// Arquivo: src/lib/componentes/comum/formatar-numero.ts
// Número grande em texto curto, do jeito que se lê em português: "1,2 mil", "3,4 mi".
// Fica fora do componente para ser testável, e porque o mesmo formato precisa valer no
// cartão, na página do título e na lista de episódios — três telas mostrando o mesmo
// total com aparências diferentes parecem três totais diferentes.

/** Abaixo disto o número inteiro é mais claro do que qualquer abreviação. */
const LIMITE_INTEIRO = 1000;

function abreviar(valor: number, divisor: number, sufixo: string): string {
  const reduzido = valor / divisor;
  // Uma casa até 10, nenhuma acima: "9,8 mil" ajuda, "34,2 mil" só polui.
  const casas = reduzido < 10 ? 1 : 0;
  const texto = reduzido.toFixed(casas).replace('.', ',');
  // 1,0 mil é ruído: nesse ponto o número redondo diz o mesmo.
  return `${texto.endsWith(',0') ? texto.slice(0, -2) : texto} ${sufixo}`;
}

export function emTextoCurto(valor: number): string {
  if (!Number.isFinite(valor) || valor <= 0) return '0';
  const inteiro = Math.floor(valor);

  if (inteiro < LIMITE_INTEIRO) return String(inteiro);
  if (inteiro < 1_000_000) return abreviar(inteiro, 1_000, 'mil');
  if (inteiro < 1_000_000_000) return abreviar(inteiro, 1_000_000, 'mi');
  return abreviar(inteiro, 1_000_000_000, 'bi');
}

/** Número por extenso, para o texto acessível e para telas com espaço de sobra. */
export function emTextoCompleto(valor: number): string {
  if (!Number.isFinite(valor) || valor <= 0) return '0';
  return Math.floor(valor).toLocaleString('pt-BR');
}
