// Arquivo: src/routes/+layout.server.ts
// O usuario da sessao desce pra toda pagina; sem isso cada rota faria a mesma consulta.

import { faixaVisivel } from '$servidor/banco/faixas-promocionais';
import { temPapelMinimo } from '$servidor/permissoes/papeis';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  // A mensagem do primeiro acesso aparece SÓ na home, e só para quem ainda não a viu.
  //
  // As duas condições importam. Um diálogo modal bloqueia a página inteira: aparecendo em
  // qualquer rota, ele parava quem tinha acabado de criar conta e clicado direto num
  // título, e chegava a cobrir o painel administrativo. Boas-vindas é assunto da porta de
  // entrada. Fora da home, nem a consulta acontece.
  const naHome = url.pathname === '/';
  const primeiroAcesso = Boolean(naHome && locals.usuario && !locals.usuario.boasVindasEm);

  return {
    usuario: locals.usuario,
    // Mesmo minimo que admin/+layout.server.ts exige. Resolvido aqui pra casca poder
    // mostrar o atalho do painel sem importar regra de servidor dentro do navegador.
    podeAcessarPainel: temPapelMinimo(locals.usuario?.papel, 'EDITOR'),
    boasVindas: primeiroAcesso ? await faixaVisivel('boas-vindas') : null
  };
};
