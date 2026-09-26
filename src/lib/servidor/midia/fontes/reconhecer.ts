// Arquivo: src/lib/servidor/midia/fontes/reconhecer.ts
// Decide o que um endereço realmente é, olhando três sinais em ordem de confiança:
// os primeiros bytes do corpo, o content-type e, só no fim, o caminho da URL.
//
// A ordem importa. Extensão mente nos dois sentidos: `.mp4` que devolve uma página de
// login é o caso mais comum de "o link não funciona", e um endereço assinado sem
// extensão nenhuma costuma ser um vídeo perfeitamente reproduzível. Função pura de
// propósito — é a peça que precisa estar certa, e testar com bytes é barato.

export type FormatoReconhecido =
  | 'MP4'
  | 'MATROSKA'
  | 'MPEG_TS'
  | 'HLS'
  | 'HTML'
  | 'VAZIO'
  | 'DESCONHECIDO';

const TIPOS_HLS = new Set([
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'audio/mpegurl',
  'audio/x-mpegurl'
]);

const TIPOS_DIRETOS: Record<string, FormatoReconhecido> = {
  'video/mp4': 'MP4',
  'video/quicktime': 'MP4',
  'video/webm': 'MATROSKA',
  'video/x-matroska': 'MATROSKA',
  'video/mp2t': 'MPEG_TS'
};

const EXTENSOES: Record<string, FormatoReconhecido> = {
  '.mp4': 'MP4',
  '.m4v': 'MP4',
  '.mov': 'MP4',
  '.webm': 'MATROSKA',
  '.mkv': 'MATROSKA',
  '.m3u8': 'HLS'
};

function porBytes(amostra: Buffer): FormatoReconhecido | null {
  if (amostra.length === 0) return 'VAZIO';

  // ISO-BMFF: o tamanho da caixa vem antes, o marcador `ftyp` fica no deslocamento 4.
  if (amostra.length >= 12 && amostra.subarray(4, 8).toString('latin1') === 'ftyp') return 'MP4';

  // EBML, base de Matroska e WebM.
  if (amostra.length >= 4 && amostra.readUInt32BE(0) === 0x1a45dfa3) return 'MATROSKA';

  const texto = amostra.subarray(0, 2048).toString('utf8').trimStart();
  if (texto.startsWith('#EXTM3U')) return 'HLS';

  const minusculo = texto.slice(0, 512).toLowerCase();
  if (
    minusculo.startsWith('<!doctype html') ||
    minusculo.startsWith('<html') ||
    minusculo.startsWith('<?xml') ||
    minusculo.includes('<head') ||
    minusculo.includes('<body')
  ) {
    return 'HTML';
  }

  // MPEG-TS sincroniza de 188 em 188 bytes; um byte 0x47 solto não vale nada.
  if (amostra.length >= 377 && amostra[0] === 0x47 && amostra[188] === 0x47 && amostra[376] === 0x47) {
    return 'MPEG_TS';
  }

  return null;
}

export function extensaoDoCaminho(url: URL): string {
  const caminho = url.pathname.toLowerCase();
  const ponto = caminho.lastIndexOf('.');
  const barra = caminho.lastIndexOf('/');
  return ponto > barra ? caminho.slice(ponto) : '';
}

export function reconhecerFormato(
  url: URL,
  tipoConteudo: string,
  amostra: Buffer
): { formato: FormatoReconhecido; origem: 'BYTES' | 'TIPO' | 'CAMINHO' | 'NENHUMA' } {
  const porConteudo = porBytes(amostra);
  if (porConteudo) return { formato: porConteudo, origem: 'BYTES' };

  // `VAZIO` sai acima junto com o resto: corpo sem nenhum byte vence o content-type. Um
  // servidor que anuncia `video/webm` e não entrega nada não tem vídeo nenhum, e aceitar
  // a palavra dele publicaria um episódio que abre em erro no primeiro play.

  const tipo = tipoConteudo.toLowerCase();
  if (TIPOS_HLS.has(tipo)) return { formato: 'HLS', origem: 'TIPO' };
  if (TIPOS_DIRETOS[tipo]) return { formato: TIPOS_DIRETOS[tipo], origem: 'TIPO' };
  if (tipo === 'text/html' || tipo === 'application/xhtml+xml') {
    return { formato: 'HTML', origem: 'TIPO' };
  }

  const extensao = EXTENSOES[extensaoDoCaminho(url)];
  if (extensao) return { formato: extensao, origem: 'CAMINHO' };

  return { formato: 'DESCONHECIDO', origem: 'NENHUMA' };
}

/** Endereço que caduca: vale gravar o aviso e oferecer revalidação depois. */
export function pareceTemporario(url: URL): boolean {
  const chaves = [...url.searchParams.keys()].map((chave) => chave.toLowerCase());
  const suspeitas = ['expires', 'expire', 'x-amz-expires', 'token', 'signature', 'x-goog-expires'];
  return chaves.some((chave) => suspeitas.includes(chave) || chave.startsWith('x-amz-'));
}
