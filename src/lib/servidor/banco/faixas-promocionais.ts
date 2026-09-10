// Arquivo: src/lib/servidor/banco/faixas-promocionais.ts
// As duas faixas editáveis pelo painel: a que aparece na home e a mensagem de
// boas-vindas do primeiro acesso. São dados, e não texto no código, porque o pedido é
// justamente poder trocar a mensagem sem publicar uma versão nova do site.
//
// As cores são validadas antes de gravar. Elas entram num `style` de gradiente, e aceitar
// texto livre ali seria deixar quem edita escrever CSS na página de todo mundo.

import { banco } from './cliente.js';

export type ChaveDeFaixa = 'home' | 'boas-vindas';

export const CHAVES: ChaveDeFaixa[] = ['home', 'boas-vindas'];

const COR_HEX = /^#[0-9a-fA-F]{6}$/;
const LIMITE_TITULO = 80;
const LIMITE_TEXTO = 400;
const LIMITE_ROTULO = 40;

export interface FaixaPublica {
  chave: string;
  ativa: boolean;
  titulo: string;
  texto: string;
  rotuloBotao: string | null;
  destino: string | null;
  corInicial: string;
  corFinal: string;
}

export class ErroDeFaixa extends Error {}

/** Destino interno apenas: link para fora daqui viraria redirecionamento aberto. */
function validarDestino(bruto: string): string | null {
  const destino = bruto.trim();
  if (destino === '') return null;
  if (!destino.startsWith('/') || destino.startsWith('//')) {
    throw new ErroDeFaixa('O destino precisa ser um endereço interno, começando com uma barra.');
  }
  return destino.slice(0, 200);
}

function validarCor(bruto: string, qual: string): string {
  const cor = bruto.trim();
  if (!COR_HEX.test(cor)) {
    throw new ErroDeFaixa(`A ${qual} precisa estar no formato #RRGGBB.`);
  }
  return cor.toUpperCase();
}

export async function lerFaixa(chave: ChaveDeFaixa): Promise<FaixaPublica | null> {
  const faixa = await banco.faixaPromocional.findUnique({ where: { chave } });
  if (!faixa) return null;
  return {
    chave: faixa.chave,
    ativa: faixa.ativa,
    titulo: faixa.titulo,
    texto: faixa.texto,
    rotuloBotao: faixa.rotuloBotao,
    destino: faixa.destino,
    corInicial: faixa.corInicial,
    corFinal: faixa.corFinal
  };
}

/** Só devolve o que está ligado E preenchido: faixa ligada e vazia não vira barra em branco. */
export async function faixaVisivel(chave: ChaveDeFaixa): Promise<FaixaPublica | null> {
  const faixa = await lerFaixa(chave);
  if (!faixa || !faixa.ativa) return null;
  if (faixa.titulo.trim() === '' && faixa.texto.trim() === '') return null;
  return faixa;
}

export async function listarFaixas(): Promise<FaixaPublica[]> {
  const faixas = await Promise.all(CHAVES.map((chave) => lerFaixa(chave)));
  return faixas.filter((faixa): faixa is FaixaPublica => faixa !== null);
}

export interface EdicaoDeFaixa {
  ativa: boolean;
  titulo: string;
  texto: string;
  rotuloBotao: string;
  destino: string;
  corInicial: string;
  corFinal: string;
}

export async function gravarFaixa(
  chave: ChaveDeFaixa,
  edicao: EdicaoDeFaixa
): Promise<FaixaPublica> {
  if (!CHAVES.includes(chave)) throw new ErroDeFaixa('Faixa desconhecida.');

  const rotulo = edicao.rotuloBotao.trim().slice(0, LIMITE_ROTULO);
  const destino = validarDestino(edicao.destino);
  // Botão sem destino é um botão que não leva a lugar nenhum.
  if (rotulo !== '' && destino === null) {
    throw new ErroDeFaixa('Informe para onde o botão leva, ou deixe o rótulo em branco.');
  }

  const dados = {
    ativa: edicao.ativa,
    titulo: edicao.titulo.trim().slice(0, LIMITE_TITULO),
    texto: edicao.texto.trim().slice(0, LIMITE_TEXTO),
    rotuloBotao: rotulo === '' ? null : rotulo,
    destino,
    corInicial: validarCor(edicao.corInicial, 'cor inicial'),
    corFinal: validarCor(edicao.corFinal, 'cor final')
  };

  await banco.faixaPromocional.upsert({
    where: { chave },
    create: { chave, ...dados },
    update: dados
  });

  return (await lerFaixa(chave))!;
}

/** Marca que a pessoa já viu as boas-vindas. Idempotente: só grava na primeira vez. */
export async function marcarBoasVindasVistas(usuarioId: string): Promise<void> {
  await banco.usuario.updateMany({
    where: { id: usuarioId, boasVindasEm: null },
    data: { boasVindasEm: new Date() }
  });
}
