// Arquivo: src/lib/servidor/banco/tipos-catalogo.ts
// Formato que sai do servidor e entra nos componentes. Fica separado do Prisma pra
// interface nunca depender do shape do ORM (e pra poder cachear no IndexedDB sem surpresa).

export interface CartaoDeTitulo {
  id: string;
  slug: string;
  nome: string;
  ano: number;
  nota: number | null;
  poster: string;
  classificacao: string;
  novidade: boolean;
  temporadas: number;
  ehFilme: boolean;
  rotuloSecundario: string;
  /** Total acumulado de visualizacoes do titulo. */
  visualizacoes: number;
  /** Curtidas: avaliacao nota 10. */
  curtidas: number;
  assistindoAgora: number;
  sinopseCurta: string;
}

export interface TrilhaDeConteudo {
  chave: string;
  titulo: string;
  verMaisUrl: string;
  itens: CartaoDeTitulo[];
}

export interface DestaqueDoHero {
  id: string;
  slug: string;
  nome: string;
  sinopse: string;
  ano: number;
  classificacao: string;
  generos: string[];
  temporadas: number;
  ehFilme: boolean;
  arte: string;
  novidade: boolean;
  chamadaGratuita: string;
}

/** Faixa editavel da home. Nula quando ninguem ligou ou ninguem escreveu nada nela. */
export interface FaixaDaHome {
  titulo: string;
  texto: string;
  rotuloBotao: string | null;
  destino: string | null;
  corInicial: string;
  corFinal: string;
}

export interface CatalogoPublico {
  destaques: DestaqueDoHero[];
  faixa: FaixaDaHome | null;
  trilhas: TrilhaDeConteudo[];
  geradoEm: string;
  versao: number;
}
