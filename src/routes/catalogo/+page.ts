// Arquivo: src/routes/catalogo/+page.ts
// Mesmo desenho da home: cache primeiro, revalidacao atras. A chave leva o genero
// junto porque cada filtro e uma lista diferente — sem isso, trocar de genero
// mostraria a lista do genero anterior.

import { browser } from '$app/environment';
import { carregarComCache } from '$cliente/carga-instantanea';
import { VALIDADE_DO_CATALOGO_MS } from '$cliente/precarregamento';
import type { CartaoDeTitulo } from '$servidor/banco/tipos-catalogo';
import type { PageLoad } from './$types';

export interface GeneroListado {
  id: string;
  slug: string;
  nome: string;
}

export interface CatalogoEmGrade {
  itens: CartaoDeTitulo[];
  generos: GeneroListado[];
  generoAtivo: string | null;
  geradoEm: string;
}

export const load: PageLoad = async ({ url, fetch, setHeaders }) => {
  const genero = url.searchParams.get('genero');
  const consulta = genero ? `?genero=${encodeURIComponent(genero)}` : '';

  const buscar = async (): Promise<CatalogoEmGrade> => {
    const resposta = await fetch(`/api/catalogo/completo${consulta}`, {
      headers: { accept: 'application/json' }
    });
    if (!resposta.ok) throw new Error('Catálogo indisponível');
    return (await resposta.json()) as CatalogoEmGrade;
  };

  if (!browser) {
    // Mesmo motivo da home: o HTML carrega o estado da sessao dentro dele, e guardar
    // isso no navegador devolve a pagina de outro estado depois de entrar ou sair.
    setHeaders({ 'cache-control': 'private, no-store' });
    return { grade: await buscar(), atualizacao: null };
  }

  const carga = await carregarComCache<CatalogoEmGrade>({
    chave: `catalogo-grade:${genero ?? 'todos'}`,
    validadeMs: VALIDADE_DO_CATALOGO_MS,
    buscar,
    ignorar: ['geradoEm']
  });

  return { grade: carga.valor, atualizacao: carga.atualizacao };
};
