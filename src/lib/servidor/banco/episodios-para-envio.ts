// Arquivo: src/lib/servidor/banco/episodios-para-envio.ts
// Busca paginada dos episódios do painel de envio. Existe porque a versão anterior
// carregava `take: 60` num catálogo de 796 episódios: 92% deles não apareciam no seletor,
// e não havia como chegar neles de jeito nenhum.
//
// A busca casa contra o nome do título e o nome do episódio ao mesmo tempo, porque é
// assim que a pessoa procura: ela lembra "Lâmina" ou lembra "Costura", raramente os dois.

import { banco } from './cliente.js';
import type { EpisodiosSelecionaveis } from '../../contratos/midia.js';

export const POR_PAGINA = 20;

interface Filtro {
  busca?: string;
  pagina?: number;
}

function condicao(busca: string) {
  const termo = busca.trim();
  if (termo === '') return {};
  return {
    OR: [
      { nome: { contains: termo } },
      { temporada: { titulo: { nome: { contains: termo } } } },
      { temporada: { titulo: { slug: { contains: termo } } } }
    ]
  };
}

export async function episodiosParaEnvio(filtro: Filtro = {}): Promise<EpisodiosSelecionaveis> {
  const pagina = Math.max(1, Math.trunc(filtro.pagina ?? 1));
  const where = condicao(filtro.busca ?? '');

  const [total, encontrados] = await Promise.all([
    banco.episodio.count({ where }),
    banco.episodio.findMany({
      where,
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      orderBy: [
        { temporada: { titulo: { nome: 'asc' } } },
        { temporada: { numero: 'asc' } },
        { numero: 'asc' }
      ],
      include: {
        temporada: { include: { titulo: { select: { nome: true } } } },
        fontes: { where: { ativa: true }, select: { id: true } },
        arquivos: { select: { variantes: { select: { id: true } } } }
      }
    })
  ]);

  return {
    total,
    pagina,
    paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    episodios: encontrados.map((episodio) => ({
      id: episodio.id,
      titulo: episodio.temporada.titulo.nome,
      temporada: episodio.temporada.numero,
      numero: episodio.numero,
      nome: episodio.nome,
      // Conta como "tem vídeo" tanto a fonte nova quanto o HLS antigo já convertido.
      temVideo:
        episodio.fontes.length > 0 ||
        episodio.arquivos.some((arquivo) => arquivo.variantes.length > 0)
    }))
  };
}

export async function episodioExiste(id: string): Promise<boolean> {
  return (await banco.episodio.count({ where: { id } })) > 0;
}

export async function rotuloDoEpisodio(id: string): Promise<string | null> {
  const episodio = await banco.episodio.findUnique({
    where: { id },
    include: { temporada: { include: { titulo: { select: { nome: true } } } } }
  });
  if (!episodio) return null;
  return `${episodio.temporada.titulo.nome} — T${episodio.temporada.numero} EP${episodio.numero}`;
}
