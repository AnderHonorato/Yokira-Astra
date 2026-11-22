/** Navegação real disponível no Yōkira Astra (SvelteKit). */
export const ACOES_ASTRA = [
  { rotulo: 'Explorar o acervo', href: '/catalogo' },
  { rotulo: 'Buscar um anime', href: '/buscar' }
] as const;

export const RESPOSTA_ASTRA =
  'Escolha o seu caminho. Eu acompanho sua próxima história pelo universo Yōkira.';
