// Arquivo: testes/integracao/fila-e-fontes.teste.ts
// As duas invariantes que sustentam o vídeo do episódio, contra um SQLite de verdade:
//
// 1. Um episódio nunca tem duas origens no ar ao mesmo tempo, e uma origem que ainda está
//    convertendo não entra no ar — é o que impede um upload novo de derrubar o vídeo que
//    já funcionava.
// 2. Um trabalho de conversão cujo dono sumiu volta a ser pego por outro. Sem isso, um
//    reinício do servidor deixa o episódio preso em "preparando" para sempre.
//
// O DATABASE_URL é apontado para o banco temporário ANTES de importar os módulos: o
// cliente do Prisma é um singleton lido na primeira importação.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CLI_DO_PRISMA = createRequire(import.meta.url).resolve('prisma/build/index.js');

let pasta = '';
let banco: (typeof import('../../src/lib/servidor/banco/cliente'))['banco'];
let fila: typeof import('../../src/lib/servidor/processamento/fila');
let fontes: typeof import('../../src/lib/servidor/banco/fontes-midia');

let episodioId = '';
let outroEpisodioId = '';

async function criarArquivo(paraEpisodio = episodioId) {
  return banco.arquivoMidia.create({
    data: {
      episodioId: paraEpisodio,
      caminho: `midia/originais/${Math.random()}.mp4`,
      tamanhoBytes: 10
    }
  });
}

beforeAll(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'yokira-fila-'));
  const url = `file:${join(pasta, 'teste.db')}`;
  execFileSync(process.execPath, [CLI_DO_PRISMA, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe'
  });
  process.env.DATABASE_URL = url;

  ({ banco } = await import('../../src/lib/servidor/banco/cliente'));
  fila = await import('../../src/lib/servidor/processamento/fila');
  fontes = await import('../../src/lib/servidor/banco/fontes-midia');

  const titulo = await banco.titulo.create({
    data: { slug: 'serie-fila', nome: 'Série da Fila', sinopse: 'x', ano: 2026 }
  });
  const temporada = await banco.temporada.create({
    data: { tituloId: titulo.id, numero: 1, nome: 'T1' }
  });
  const episodio = await banco.episodio.create({
    data: { temporadaId: temporada.id, numero: 1, nome: 'Piloto', duracaoSegundos: 1380 }
  });
  const outro = await banco.episodio.create({
    data: { temporadaId: temporada.id, numero: 2, nome: 'Segundo', duracaoSegundos: 1380 }
  });
  episodioId = episodio.id;
  outroEpisodioId = outro.id;
}, 180_000);

afterAll(async () => {
  await banco.$disconnect();
  rmSync(pasta, { recursive: true, force: true });
});

describe('fontes de mídia', () => {
  it('mantém uma origem no ar por episódio ao trocar', async () => {
    const primeira = await fontes.registrarFonteRemota({
      episodioId,
      token: 'p1',
      verificacao: veredito('https://cdn.exemplo.com/a.mp4')
    });
    const segunda = await fontes.registrarFonteRemota({
      episodioId,
      token: 'p2',
      verificacao: veredito('https://cdn.exemplo.com/b.mp4')
    });

    expect(primeira).not.toBe(segunda);
    const ativas = await banco.fonteMidia.findMany({ where: { episodioId, ativa: true } });
    expect(ativas).toHaveLength(1);
    expect(ativas[0].id).toBe(segunda);

    // Voltar para a anterior é um clique, não um novo cadastro.
    await fontes.ativarFonte(primeira);
    const depois = await banco.fonteMidia.findMany({ where: { episodioId, ativa: true } });
    expect(depois).toHaveLength(1);
    expect(depois[0].id).toBe(primeira);
  });

  it('não cria origem repetida quando o mesmo pedido chega duas vezes', async () => {
    const antes = await banco.fonteMidia.count({ where: { episodioId: outroEpisodioId } });
    const chamada = () =>
      fontes.registrarFonteRemota({
        episodioId: outroEpisodioId,
        token: 'clique-duplo',
        verificacao: veredito('https://cdn.exemplo.com/c.mp4')
      });

    const um = await chamada();
    const dois = await chamada();
    expect(um).toBe(dois);
    expect(await banco.fonteMidia.count({ where: { episodioId: outroEpisodioId } })).toBe(
      antes + 1
    );
  });

  it('recusa colocar no ar uma origem que ainda está convertendo', async () => {
    const arquivo = await criarArquivo();
    const id = await fontes.registrarFonteLocal(episodioId, arquivo.id, 'envio-1');

    await expect(fontes.ativarFonte(id)).rejects.toThrow(/ainda não está pronta/);
    const gravada = await banco.fonteMidia.findUnique({ where: { id } });
    expect(gravada?.ativa).toBe(false);
    expect(gravada?.estado).toBe('PROCESSANDO');
  });

  it('coloca no ar só quando a conversão termina', async () => {
    const arquivo = await criarArquivo();
    await fontes.registrarFonteLocal(episodioId, arquivo.id, 'envio-2');
    await fontes.marcarFontePronta(arquivo.id);

    const ativas = await banco.fonteMidia.findMany({ where: { episodioId, ativa: true } });
    expect(ativas).toHaveLength(1);
    expect(ativas[0].arquivoId).toBe(arquivo.id);
  });
});

describe('fila de conversão', () => {
  it('enfileira uma vez só o mesmo arquivo', async () => {
    const arquivo = await criarArquivo();
    const um = await fila.enfileirarProcessamento(arquivo.id);
    const dois = await fila.enfileirarProcessamento(arquivo.id);
    expect(um).toBe(dois);
  });

  it('devolve o trabalho a quem pega e não entrega duas vezes', async () => {
    const arquivo = await criarArquivo();
    const trabalhoId = await fila.enfileirarProcessamento(arquivo.id);

    const pego = await pegarTrabalho(trabalhoId);
    expect(pego?.arquivoId).toBe(arquivo.id);
    expect(pego?.tentativas).toBe(1);

    // Enquanto o prazo está de pé, ninguém mais leva.
    expect(await pegarTrabalho(trabalhoId)).toBeNull();
    await fila.concluirTrabalho(trabalhoId);
  });

  it('recupera trabalho cujo prazo venceu — é o reinício do servidor', async () => {
    const arquivo = await criarArquivo();
    const trabalhoId = await fila.enfileirarProcessamento(arquivo.id);
    await pegarTrabalho(trabalhoId);

    // Simula o processo que caiu: o prazo fica no passado e nunca é renovado.
    await banco.trabalhoProcessamento.update({
      where: { id: trabalhoId },
      data: { leaseAte: new Date(Date.now() - 60_000), executor: 'processo-que-morreu' }
    });

    const retomado = await pegarTrabalho(trabalhoId);
    expect(retomado?.id).toBe(trabalhoId);
    expect(retomado?.tentativas).toBe(2);
    await fila.concluirTrabalho(trabalhoId);
  });

  it('volta para a fila enquanto houver tentativa e desiste depois', async () => {
    const arquivo = await criarArquivo();
    const trabalhoId = await fila.enfileirarProcessamento(arquivo.id);

    for (let tentativa = 1; tentativa < fila.MAXIMO_DE_TENTATIVAS; tentativa += 1) {
      await pegarTrabalho(trabalhoId);
      expect(await fila.falharTrabalho(trabalhoId, 'ffmpeg saiu com erro')).toBe(false);
      const meio = await banco.trabalhoProcessamento.findUnique({ where: { id: trabalhoId } });
      expect(meio?.situacao).toBe('NA_FILA');
    }

    await pegarTrabalho(trabalhoId);
    expect(await fila.falharTrabalho(trabalhoId, 'ffmpeg saiu com erro')).toBe(true);
    const fim = await banco.trabalhoProcessamento.findUnique({ where: { id: trabalhoId } });
    expect(fim?.situacao).toBe('FALHOU');
    expect(await pegarTrabalho(trabalhoId)).toBeNull();
  });
});

/** Pega trabalhos até achar o esperado; a fila é global e há outros pendentes. */
async function pegarTrabalho(trabalhoId: string) {
  for (let tentativa = 0; tentativa < 12; tentativa += 1) {
    const pego = await fila.reivindicarTrabalho();
    if (!pego) return null;
    if (pego.id === trabalhoId) return pego;
    await fila.concluirTrabalho(pego.id);
  }
  return null;
}

/** Veredito de compatível, como o `verificar-fonte` devolveria. */
function veredito(url: string) {
  return {
    assinaturaPedido: 'teste',
    url,
    estado: 'COMPATIVEL' as const,
    tipo: 'DIRETO' as const,
    embedId: null,
    mime: 'video/mp4',
    temporaria: false,
    mensagem: 'ok',
    saida: null,
    avisos: [],
    qualidades: [],
    previa: { tipo: 'DIRETO' as const, url },
    confirmadaNoNavegador: false as const
  };
}
