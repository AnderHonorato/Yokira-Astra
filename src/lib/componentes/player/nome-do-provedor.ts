// Arquivo: src/lib/componentes/player/nome-do-provedor.ts
// Nome de exibição do provedor no cliente. Existe separado do módulo de servidor porque
// o componente não pode importar nada de `$servidor`.

export function nomeDoProvedorNoCliente(tipo: string): string {
  if (tipo === 'YOUTUBE') return 'YouTube';
  if (tipo === 'VIMEO') return 'Vimeo';
  return 'provedor';
}
