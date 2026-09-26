// Arquivo: src/routes/+page.ts
// Home carregada por um `load` universal: no servidor busca direto (o fetch do
// SvelteKit resolve o endpoint interno sem sair pela rede, entao o HTML continua
// chegando pintado); no navegador le o IndexedDB primeiro e revalida atras.
//
// Era aqui que estava a espera: com `+page.server.ts` toda navegacao de cliente
// parava no round-trip do `__data.json` antes de pintar qualquer coisa.

import { browser } from '$app/environment';
import { carregarComCache } from '$cliente/carga-instantanea';
import { CHAVE_DO_CATALOGO, VALIDADE_DO_CATALOGO_MS } from '$cliente/precarregamento';
import type { CatalogoPublico, TrilhaDeConteudo } from '$servidor/banco/tipos-catalogo';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, setHeaders, parent }) => {
  const buscar = async (): Promise<CatalogoPublico> => {
    const resposta = await fetch('/api/catalogo', { headers: { accept: 'application/json' } });
    if (!resposta.ok) throw new Error('Catálogo indisponível');
    return (await resposta.json()) as CatalogoPublico;
  };

  // Trilha pessoal nunca derruba a home: sem sessao, com erro ou sem historico, o
  // resultado e o mesmo — lista vazia, e a home fica exatamente como estava.
  const buscarPessoais = async (): Promise<TrilhaDeConteudo[]> => {
    const { usuario } = await parent();
    if (!usuario) return [];
    try {
      const resposta = await fetch('/api/para-voce', { headers: { accept: 'application/json' } });
      if (!resposta.ok) return [];
      return ((await resposta.json()) as { trilhas: TrilhaDeConteudo[] }).trilhas;
    } catch {
      return [];
    }
  };

  if (!browser) {
    const [catalogo, pessoais] = await Promise.all([buscar(), buscarPessoais()]);
    // O HTML da home carrega o estado da SESSÃO dentro dele: quem está logado, se o
    // atalho do painel aparece, se a mensagem de boas-vindas ainda não foi vista. Guardar
    // isso no cache do navegador, ainda que por 30 s, devolve a página de outro estado —
    // o cabeçalho de quem acabou de sair, ou a mensagem de primeiro acesso já dispensada.
    // O "abrir na hora" continua existindo: ele vem do IndexedDB, logo abaixo, e do cache
    // público do `/api/catalogo`, que não tem nada de pessoal dentro.
    setHeaders({ 'cache-control': 'private, no-store' });
    return { catalogo, pessoais, pessoaisAtrasadas: null, atualizacao: null };
  }

  const carga = await carregarComCache<CatalogoPublico>({
    chave: CHAVE_DO_CATALOGO,
    validadeMs: VALIDADE_DO_CATALOGO_MS,
    buscar,
    // `geradoEm` muda a cada resposta; comparar com ele trocaria o objeto sempre
    // e reiniciaria o hero rotativo sem motivo.
    ignorar: ['geradoEm']
  });

  return {
    catalogo: carga.valor,
    // No navegador a trilha pessoal chega atras: esperar por ela aqui devolveria a
    // espera de rede que o cache em IndexedDB existe pra eliminar.
    pessoais: [] as TrilhaDeConteudo[],
    pessoaisAtrasadas: buscarPessoais(),
    atualizacao: carga.atualizacao
  };
};
