// Arquivo: src/routes/admin/faixas/+page.server.ts
// Edicao das duas faixas: a da home e a mensagem de boas-vindas. Sao dados no banco, e
// nao texto no codigo, justamente pra trocar a mensagem nao exigir publicar versao nova.

import { fail } from '@sveltejs/kit';
import {
  CHAVES,
  ErroDeFaixa,
  gravarFaixa,
  listarFaixas,
  type ChaveDeFaixa
} from '$servidor/banco/faixas-promocionais';
import { registrarAcaoAdministrativa } from '$servidor/autenticacao/confirmacao';
import { exigirPapel } from '$servidor/permissoes/papeis';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  exigirPapel(locals.usuario?.papel, 'EDITOR');
  return { faixas: await listarFaixas() };
};

export const actions: Actions = {
  salvar: async ({ request, locals }) => {
    exigirPapel(locals.usuario?.papel, 'EDITOR');

    const formulario = await request.formData();
    const chave = String(formulario.get('chave') ?? '') as ChaveDeFaixa;
    if (!CHAVES.includes(chave)) return fail(400, { mensagem: 'Faixa desconhecida.' });

    try {
      await gravarFaixa(chave, {
        ativa: formulario.get('ativa') === 'sim',
        titulo: String(formulario.get('titulo') ?? ''),
        texto: String(formulario.get('texto') ?? ''),
        rotuloBotao: String(formulario.get('rotuloBotao') ?? ''),
        destino: String(formulario.get('destino') ?? ''),
        corInicial: String(formulario.get('corInicial') ?? ''),
        corFinal: String(formulario.get('corFinal') ?? '')
      });
    } catch (erro) {
      if (erro instanceof ErroDeFaixa) return fail(400, { mensagem: erro.message, chave });
      throw erro;
    }

    await registrarAcaoAdministrativa(locals.usuario!.id, 'editar-faixa', chave);
    return { mensagem: 'Faixa salva.', chave };
  }
};
