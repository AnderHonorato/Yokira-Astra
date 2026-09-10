// Arquivo: src/lib/servidor/midia/fontes/mensagens-de-fonte.ts
// Todo texto que o painel mostra sobre um link mora aqui. Ficam juntos de propósito:
// são o que o administrador lê quando algo dá errado, e revisar tom e clareza num
// arquivo só é bem mais fácil do que caçar frase espalhada pela lógica.
//
// Regra dos textos: dizer o que aconteceu e o que dá para fazer. Nada de código de
// status cru, nada de "erro inesperado", nada de vocabulário de bastidor.

export interface Frase {
  mensagem: string;
  saida: string | null;
}

export function porStatus(status: number): Frase {
  if (status === 401 || status === 403) {
    return {
      mensagem: 'O endereço existe, mas exige login para ser aberto.',
      saida: 'Use um link público ou envie o arquivo do computador.'
    };
  }
  if (status === 404 || status === 410) {
    return {
      mensagem: 'Esse endereço não existe mais.',
      saida: 'Confira o link ou pegue um novo na origem.'
    };
  }
  if (status === 429) {
    return {
      mensagem: 'A origem pediu para esperar antes de tentar de novo.',
      saida: 'Tente novamente em alguns minutos.'
    };
  }
  if (status >= 500) {
    return {
      mensagem: 'O servidor de origem está com problema agora.',
      saida: 'Tente novamente mais tarde.'
    };
  }
  return {
    mensagem: `O endereço respondeu de um jeito que não dá para usar (${status}).`,
    saida: 'Confira se o link está completo e aponta para o vídeo.'
  };
}

export const HTML_EM_VEZ_DE_VIDEO: Frase = {
  mensagem: 'Esse endereço devolve uma página, não um vídeo.',
  saida: 'Cole o link do arquivo em si, ou o link de um vídeo do YouTube ou do Vimeo.'
};

export const VAZIO: Frase = {
  mensagem: 'O endereço respondeu sem nenhum conteúdo.',
  saida: 'Confira se o link ainda vale.'
};

export const FORMATO_DESCONHECIDO: Frase = {
  mensagem: 'Não reconheci nenhum vídeo nesse endereço.',
  saida: 'Aceitamos mp4, webm, playlists HLS e páginas do YouTube e do Vimeo.'
};

export const PRECISA_CONVERTER: Frase = {
  mensagem: 'Esse formato o navegador não toca direto.',
  saida: 'Dá para trazer o arquivo e converter aqui — leva alguns minutos.'
};

export const PRONTA_DIRETO: Frase = {
  mensagem: 'Vídeo compatível. Dá para tocar direto da origem.',
  saida: null
};

export const PRONTA_HLS: Frase = {
  mensagem: 'Playlist compatível. Dá para tocar direto da origem.',
  saida: null
};

export function prontaIncorporacao(nome: string): Frase {
  return {
    mensagem: `Vídeo do ${nome}. Vai tocar no player do próprio ${nome}.`,
    saida: null
  };
}

export function incorporacaoRecusada(nome: string): Frase {
  return {
    mensagem: `O ${nome} não libera esse vídeo para tocar fora do site dele.`,
    saida: 'Use outro link ou envie o arquivo do computador.'
  };
}

export const AVISO_SEM_FAIXA_DE_BYTES =
  'A origem não aceita pedido por trecho: avançar o vídeo pode ficar lento.';

export const AVISO_SEM_CORS =
  'A origem não libera leitura por outros sites. Alguns navegadores podem recusar a playlist.';

export const AVISO_TEMPORARIO =
  'Esse endereço parece ter prazo de validade. Quando ele vencer, o episódio para de tocar até você revalidar.';

export const AVISO_CRIPTOGRAFADA =
  'A playlist declara chave de criptografia. Se a chave exigir login, o vídeo não vai abrir aqui.';

export const AVISO_CONTROLES_DE_TERCEIRO =
  'Os controles são os do provedor. Retomar de onde parou e a troca de qualidade seguem as regras dele.';

export const AVISO_SEM_LEGENDA =
  'Nenhuma legenda cadastrada para este episódio.';
